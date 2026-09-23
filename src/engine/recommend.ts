/**
 * Recommendation engine.
 *
 * Order of operations, deliberately: pick the models first on measured coding
 * quality, then pick the cheapest provider that satisfies the user's
 * constraints, then check the resulting total. Quality scores are never divided
 * by price, and scores from different harnesses are never compared.
 */
import { THRESHOLDS } from '../config.js';
import { hoursSince } from '../lib/normalize.js';
import type { ModelRecord, Offer, QualityEvidence, Replacement, Snapshot } from '../types.js';
import { costOf, type CostBreakdown } from './cost.js';
import { isIdentified, providerKey, usabilityOf, type Usability } from './usability.js';
import { successorOf } from './lineage.js';
import { OPENAI_EFFORTS } from './opencode.js';
import { gateFor, SCENARIOS, type Priority, type TaskId, type TokenMix } from './scenarios.js';
import { t, type Lang, type ReasonCode } from '../i18n.js';


export interface RecommendationRequest {
  task: TaskId;
  priority: Priority;
  lang: Lang;
  /** Real usage supplied by the user; replaces the scenario when present. */
  usage?: Partial<TokenMix> | null;
  currentModelKey?: string | null;
  currentOfferId?: string | null;
}

export interface QualityView {
  value: number;
  metric: QualityEvidence['metric'];
  harness: string;
  harnessKey: string;
  measuredAt: string | null;
  sourceUrl: string;
  /** False when the score comes from outside the reference comparability group. */
  comparable: boolean;
  stale: boolean;
  instanceCalls: number | null;
  /** Reasoning effort of the measured variant, normalised: "high", "xhigh", "max"... */
  effort: string | null;
  /** Artificial Analysis cost per task of that variant, when published. */
  costPerTask: number | null;
  /** A provisional score carried over from the version this model follows. */
  inheritedFrom: { modelKey: string; harness: string } | null;
}

export interface OfferView {
  offer: Offer;
  cost: CostBreakdown;
  /** Whether buying this needs a new account with a third party. */
  usability: Usability;
}

export interface Pick {
  model: ModelRecord;
  offer: Offer;
  cost: CostBreakdown;
  /** The recommended offer as a view, carrying how usable it is. */
  chosen: OfferView;
  quality: QualityView;
  reason: string;
  whenToUse: string | null;
  alternatives: OfferView[];
  /** How many provider offers were compared for this model. */
  offersCompared: number;
  provisional: boolean;
  provisionalReasons: string[];
  /** A newer version of the same line, on sale but not yet measured on code. */
  successor: { key: string; name: string; releaseDate: string | null } | null;
}

export interface Recommendation {
  generatedAt: string;
  request: RecommendationRequest;
  mix: TokenMix;
  usingCustomUsage: boolean;
  everyday: Pick | null;
  hard: Pick | null;
  /** Retired models that would have competed, whose newer version is not measured yet. */
  replacements: Replacement[];
  /** Human-readable account of what was excluded and why. */
  method: {
    referenceHarness: string | null;
    referenceHarnessModels: number;
    gate: { everyday: number; hard: number };
    candidateModels: number;
    excluded: { reason: ReasonCode; count: number }[];
    snapshotAgeHours: number | null;
    snapshotStale: boolean;
  };
  savings: {
    /** Why we cannot compare, when we cannot: the user always gets an answer. */
    outcome: 'compared' | 'already-recommended' | 'no-price' | 'no-evidence' | 'no-seller' | 'unknown-model';
    currentModelName: string | null;
    currentTotalUsd: number | null;
    /** Which provider that price belongs to: it is a reference, not your bill. */
    currentProviderName: string | null;
    recommendedTotalUsd: number | null;
    deltaUsd: number | null;
    note: string;
  } | null;
  notes: string[];
}

const fmtUsd = (v: number) => `${v < 10 ? v.toFixed(2) : v.toFixed(0)} USD`;

/** How a metric is named on the page. */
export const metricLabel = (metric: QualityEvidence['metric']): string =>
  metric === 'aa_coding_index' ? 'Artificial Analysis Coding Index' : metric === 'swebench_verified' ? 'SWE-bench Verified' : 'Aider polyglot';

/** A score in its own unit: index points for Artificial Analysis, a percentage for the others. */
export const formatScore = (value: number, metric: QualityEvidence['metric'], digits = 1): string =>
  metric === 'aa_coding_index' ? value.toFixed(digits) : `${value.toFixed(digits)}%`;

/** Days since a measurement; null when it carries no date. */
const ageDays = (e: QualityEvidence, now: number): number | null => {
  const h = hoursSince(e.measuredAt, now);
  return h === null ? null : h / 24;
};

/** Only recent measurements count: older ones describe a model that may no longer exist as measured. */
export const isFresh = (e: QualityEvidence, now = Date.now()): boolean => {
  const d = ageDays(e, now);
  return d !== null && d <= THRESHOLDS.evidenceMaxAgeDays;
};

/** Metrics in order of preference for the reference group. */
const METRIC_PRIORITY: QualityEvidence['metric'][] = ['aa_coding_index', 'swebench_verified'];

/**
 * The reference comparability group: Artificial Analysis when present (one
 * method across hundreds of models), otherwise the SWE-bench harness that
 * measured the most models. Comparing inside it is fair; nothing else is used.
 */
function referenceGroup(evidence: QualityEvidence[]): {
  key: string | null;
  label: string | null;
  size: number;
  metric: QualityEvidence['metric'] | null;
} {
  const metric = METRIC_PRIORITY.find((m) => evidence.some((e) => e.metric === m)) ?? null;
  const byHarness = new Map<string, Set<string>>();
  for (const e of evidence) {
    if (e.metric !== metric) continue;
    const set = byHarness.get(e.harnessKey) ?? new Set<string>();
    set.add(e.modelKey);
    byHarness.set(e.harnessKey, set);
  }
  let best: { key: string; size: number } | null = null;
  for (const [key, set] of byHarness) {
    if (!best || set.size > best.size) best = { key, size: set.size };
  }
  if (!best) return { key: null, label: null, size: 0, metric: null };
  const label = metric === 'aa_coding_index'
    ? best.key.replace(/^aa-coding-index\|/, 'Artificial Analysis Coding Index ')
    : evidence.find((e) => e.harnessKey === best!.key)?.harness ?? best.key;
  return { key: best.key, label, size: best.size, metric };
}

/**
 * A model's score inside the reference comparability group. Scores measured
 * elsewhere are deliberately not returned: comparing a SWE-bench run with an
 * Aider run, or two different agent scaffolds, would compare different things.
 */
function bestQuality(
  modelKey: string,
  evidence: QualityEvidence[],
  refKey: string | null,
  now: number,
): QualityView | null {
  const mine = evidence.filter((e) => e.modelKey === modelKey);
  if (!mine.length) return null;
  const pickFrom = (rows: QualityEvidence[]) =>
    rows.reduce((a, b) => (b.value > a.value ? b : a));

  const inRef = refKey ? mine.filter((e) => e.harnessKey === refKey) : [];
  if (!inRef.length) return null;
  return viewOf(pickFrom(inRef), now);
}

/** "Adaptive Reasoning, Xhigh Effort" -> "xhigh"; null when the variant names no effort. */
export function effortOf(variant: string | null): string | null {
  if (!variant) return null;
  const v = variant.toLowerCase();
  if (/non-reasoning/.test(v)) return 'none';
  for (const e of ['xhigh', 'max', 'high', 'medium', 'minimal', 'low']) if (new RegExp(`\\b${e}\\b`).test(v)) return e;
  return null;
}

/** One measured variant as the engine shows it. */
function viewOf(e: QualityEvidence, now: number): QualityView {
  const measured = e.measuredAt ? Date.parse(e.measuredAt) : NaN;
  return {
    value: e.value,
    metric: e.metric,
    harness: e.harness,
    harnessKey: e.harnessKey,
    measuredAt: e.measuredAt,
    sourceUrl: e.sourceUrl,
    comparable: true,
    stale: Number.isNaN(measured) ? true : now - measured > THRESHOLDS.evidenceFreshDays * 86_400_000,
    instanceCalls: e.instanceCalls,
    effort: effortOf(e.reasoningEffort),
    costPerTask: e.costPerTask ?? null,
    inheritedFrom: e.inheritedFrom ?? null,
  };
}

/**
 * The variants a buyer of this offer actually gets. A score measured at a
 * reasoning effort the buyer cannot select would promise more than they get:
 * - OpenAI's own API: OpenCode sets the effort, so every settable variant counts;
 * - Anthropic's own API: OpenCode uses "high" unless changed by hand;
 * - anywhere else we cannot tell, so only the lowest measured variant counts.
 */
function deliverable(variants: QualityEvidence[], offer: Offer): QualityEvidence[] {
  if (variants.length <= 1) return variants;
  if (offer.providerId === 'openai' && offer.sourceId !== 'openrouter') {
    const settable = variants.filter((v) => OPENAI_EFFORTS.has(effortOf(v.reasoningEffort) ?? ''));
    if (settable.length) return settable;
  }
  if (offer.providerId === 'anthropic' && offer.sourceId !== 'openrouter') {
    const high = variants.filter((v) => effortOf(v.reasoningEffort) === 'high');
    if (high.length) return high;
  }
  return [variants.reduce((a, b) => (b.value < a.value ? b : a))];
}

/** How far above the market's mean cost per task a pick may go, by priority. */
export const PRICE_CAP: Record<Priority, number> = { cheap: 1.25, balanced: 1.25, quality: 5 };

/** With "balanced", the everyday pick may cost up to this many times the cheapest one above the bar. */
export const BALANCED_PRICE_FACTOR = 2;

/** Offer-level eligibility. Returns null when usable, otherwise the reason it is not. */
function offerBlocker(offer: Offer, req: RecommendationRequest, minContext: number, now: number): ReasonCode | null {
  void req;
  if (offer.demo) return 'demo';
  // We publish commands to paste: if OpenCode does not know this model-provider
  // pair, the command does not run and the offer should not even be shown.
  if (offer.opencodeVerified === false) return 'opencode-unknown';
  if (offer.blockedReason) return 'suspended';
  if (offer.quarantine) return 'quarantine';
  const age = hoursSince(offer.observedAt, now);
  if (age !== null && age > THRESHOLDS.offerStaleHours) return 'stale-price';
  if (offer.supportsTools === false) return 'offer-no-tools';
  if (offer.contextTokens !== null && offer.contextTokens < minContext) return 'offer-context';
  if (offer.uptime30m !== null && offer.uptime30m < THRESHOLDS.minUptime30m) return 'offer-uptime';
  return null;
}

function rankOffers(
  offers: Offer[],
  mix: TokenMix,
  req: RecommendationRequest,
  minContext: number,
  now: number,
  modelVendor = '',
  known?: Set<string>,
) {
  const usable: OfferView[] = [];
  const blocked: ReasonCode[] = [];
  for (const offer of offers) {
    const blocker = offerBlocker(offer, req, minContext, now);
    if (blocker) {
      blocked.push(blocker);
      continue;
    }
    const cost = costOf(offer, mix, req.lang);
    // An incomplete cost cannot be compared with a complete one.
    if (!cost.complete) {
      blocked.push('incomplete-prices');
      continue;
    }
    // Free tiers and bundled plans have a real cost that is not published per
    // token: treating them as 0 would make them win every comparison.
    if (cost.planBased) {
      blocked.push('plan-based');
      continue;
    }
    usable.push({ offer, cost, usability: usabilityOf(offer, modelVendor, known) });
  }
  // At the same price prefer the offer whose provider we can actually hold:
  // an unpinned broker route may be served by anyone, at another price.
  const pinnable = (o: Offer) => (o.providerId === 'openrouter' ? Boolean(o.routingSlug) : true);
  usable.sort(
    (a, b) =>
      a.cost.totalUsd! - b.cost.totalUsd! ||
      Number(pinnable(b.offer)) - Number(pinnable(a.offer)) ||
      a.offer.providerName.localeCompare(b.offer.providerName),
  );
  // Offers you can use straight away come first; the others stay visible with
  // their price, clearly marked as requiring a new account.
  // Only providers we can actually describe are eligible to be recommended.
  const ready = usable.filter((o) => isIdentified(o.usability));
  return { usable, ready, blocked };
}

export function recommend(snapshot: Snapshot, req: RecommendationRequest): Recommendation {
  const now = Date.now();
  const c = t(req.lang);
  // Providers a curated directory lists, plus their own first-party sellers.
  // The directory writes a company with its product ("Anthropic Claude") where
  // our offers carry the company alone, so the first word counts as a name too,
  // but only when it belongs to exactly one entry.
  const directory = Object.values(snapshot.providers ?? {});
  const known = new Set(directory.map((p) => providerKey(p.name)));
  const firstWords = directory.map((p) => providerKey(p.name.split(/\s+/)[0] ?? ''));
  for (const word of firstWords) {
    if (word && firstWords.filter((w) => w === word).length === 1) known.add(word);
  }
  const scenario = SCENARIOS[req.task];
  const mix: TokenMix = {
    input: req.usage?.input ?? scenario.monthly.input,
    output: req.usage?.output ?? scenario.monthly.output,
    cacheRead: req.usage?.cacheRead ?? scenario.monthly.cacheRead,
    cacheWrite: req.usage?.cacheWrite ?? scenario.monthly.cacheWrite,
  };
  const usingCustomUsage = Boolean(
    req.usage && (req.usage.input || req.usage.output || req.usage.cacheRead || req.usage.cacheWrite),
  );
  const minContext = Math.max(scenario.minContextTokens, THRESHOLDS.minContextTokens);
  // Only recent evidence exists as far as the engine is concerned.
  const evidence = snapshot.evidence.filter((e) => isFresh(e, now));
  const ref = referenceGroup(evidence);
  const gate = gateFor(ref.metric, req.priority);
  const unit = (v: number) => (ref.metric === 'aa_coding_index' ? String(v) : `${v}%`);

  const offersByModel = new Map<string, Offer[]>();
  for (const o of snapshot.offers) {
    const list = offersByModel.get(o.modelKey) ?? [];
    list.push(o);
    offersByModel.set(o.modelKey, list);
  }

  // Models someone sells in a usable way but nobody has measured on code yet:
  // they cannot win, but a newer version of a pick must not go unmentioned.
  const measured = new Set(snapshot.evidence.map((e) => e.modelKey));
  const unmeasured = [...offersByModel.entries()]
    .filter(([key, list]) => !measured.has(key) && list.some((o) => offerBlocker(o, req, minContext, now) === null))
    .map(([key]) => key);

  const excluded = new Map<ReasonCode, number>();
  const bump = (reason: ReasonCode) => excluded.set(reason, (excluded.get(reason) ?? 0) + 1);

  interface Candidate {
    model: ModelRecord;
    quality: QualityView;
    /** Every usable offer, cheapest first. */
    offers: OfferView[];
    /** The subset that needs no new account. */
    ready: OfferView[];
  }
  const candidates: Candidate[] = [];

  const pending: { model: ModelRecord; variants: QualityEvidence[]; usable: OfferView[]; ready: OfferView[] }[] = [];
  for (const model of Object.values(snapshot.models)) {
    const quality = bestQuality(model.key, evidence, ref.key, now);
    if (!quality) {
      if (evidence.some((e) => e.modelKey === model.key)) {
        bump('not-comparable');
      } else if (snapshot.evidence.some((e) => e.modelKey === model.key)) {
        bump('stale-evidence');
      }
      continue; // no comparable coding evidence: cannot be recommended
    }
    if (model.toolCall === false) {
      bump('no-tools');
      continue;
    }
    if (model.contextTokens !== null && model.contextTokens < minContext) {
      bump('model-context');
      continue;
    }
    const offers = offersByModel.get(model.key) ?? [];
    if (!offers.length) {
      bump('no-seller');
      continue;
    }
    const { usable, ready, blocked } = rankOffers(offers, mix, req, minContext, now, model.vendor, known);
    if (!usable.length) {
      bump(blocked[0] ?? 'no-usable-offer');
      continue;
    }
    const variants = evidence.filter((e) => e.modelKey === model.key && e.harnessKey === ref.key);
    pending.push({ model, variants, usable, ready });
  }

  // Price caps, as a multiple of the market's mean cost per task (Artificial
  // Analysis, recent models). A variant with no published cost per task is
  // held to the same multiple of the mean monthly cost of the candidates.
  const taskCap = snapshot.costReference ? snapshot.costReference.meanPerTask * PRICE_CAP[req.priority] : null;
  const monthly = pending.map((p) => p.usable[0]!.cost.totalUsd).filter((v): v is number => v !== null);
  const monthlyCap = monthly.length ? (monthly.reduce((a, b) => a + b, 0) / monthly.length) * PRICE_CAP[req.priority] : null;
  const affordable = (v: QualityEvidence, o: OfferView) =>
    v.costPerTask != null ? taskCap === null || v.costPerTask <= taskCap : monthlyCap === null || (o.cost.totalUsd ?? Infinity) <= monthlyCap;

  // Each offer gets the best variant its buyer can actually have, within the cap;
  // offers that deliver the same variant form one candidate.
  for (const p of pending) {
    const groups = new Map<QualityEvidence, OfferView[]>();
    for (const o of p.usable) {
      const within = deliverable(p.variants, o.offer).filter((v) => affordable(v, o));
      if (!within.length) continue;
      const best = within.reduce((a, b) => (b.value > a.value ? b : a));
      groups.set(best, [...(groups.get(best) ?? []), o]);
    }
    if (!groups.size) {
      bump('over-price-cap');
      continue;
    }
    for (const [variant, offers] of groups) {
      candidates.push({ model: p.model, quality: viewOf(variant, now), offers, ready: offers.filter((o) => p.ready.includes(o)) });
    }
  }

  /**
   * The cheapest offer among providers we can identify. Needing an account is
   * normal and simply stated; being unable to say who the company is, is not.
   */
  const choiceOf = (c: Candidate): OfferView => c.ready[0] ?? c.offers[0]!;

  const toPick = (cand: Candidate, role: 'everyday' | 'hard', other: Candidate | null): Pick => {
    const best = choiceOf(cand);
    const provisionalReasons: string[] = [];
    if (!cand.quality.comparable) provisionalReasons.push(c.engine.provisionalCrossHarness);
    if (cand.quality.stale) provisionalReasons.push(c.engine.provisionalStale(String(THRESHOLDS.evidenceFreshDays)));
    if (best.cost.unquantifiedFees.length) provisionalReasons.push(c.engine.provisionalFee);
    if (best.cost.assumptions.length) provisionalReasons.push(c.engine.provisionalCacheAssumption);
    if (cand.offers.length === 1) provisionalReasons.push(c.engine.provisionalSingle);
    if (!cand.ready.length) provisionalReasons.push(c.engine.provisionalUnidentified);

    const price = fmtUsd(best.cost.totalUsd!);
    const label = metricLabel(cand.quality.metric);
    const score = formatScore(cand.quality.value, cand.quality.metric);
    const gap = other ? (cand.quality.value - other.quality.value).toFixed(1) : null;

    const reason =
      role === 'everyday'
        ? req.priority === 'quality'
          ? c.engine.everydayBest(score, label, price)
          : req.priority === 'balanced'
            ? c.engine.everydayBalanced(score, label, unit(gate.everyday), price)
            : c.engine.everydayCheapest(score, label, unit(gate.everyday), price)
        : c.engine.hardReason(score, label, gap);

    const whenToUse = role === 'hard' ? c.engine.hardWhen : null;

    return {
      model: cand.model,
      offer: best.offer,
      cost: best.cost,
      chosen: best,
      quality: cand.quality,
      reason,
      whenToUse,
      alternatives: cand.offers.filter((o) => o !== best).slice(0, 20),
      offersCompared: cand.offers.length,
      provisional: provisionalReasons.length > 0,
      provisionalReasons,
      successor: (() => {
        const key = successorOf(cand.model.key, unmeasured);
        const m = key ? snapshot.models[key] : undefined;
        return m ? { key: m.key, name: m.displayName, releaseDate: m.releaseDate } : null;
      })(),
    };
  };

  /**
   * The user's single choice changes what "best" means, which is the whole point
   * of asking it:
   * - spend less: the cheapest model that clears the quality gate;
   * - balanced: the best score among those costing at most twice the cheapest;
   * - best results: the highest measured score, with price only breaking ties
   *   inside a band where the score difference is not meaningful.
   * Every pick also stays under the price cap of its priority (PRICE_CAP).
   */
  const everydayPool = candidates.filter((c) => c.quality.value >= gate.everyday);
  const byPrice = (a: Candidate, b: Candidate) => choiceOf(a).cost.totalUsd! - choiceOf(b).cost.totalUsd!;
  let everydayCandidate: Candidate | null;
  if (req.priority === 'quality') {
    const top = everydayPool.reduce((max, c) => Math.max(max, c.quality.value), 0);
    const band = everydayPool.filter((c) => c.quality.value >= top - 2).sort(byPrice);
    everydayCandidate = band[0] ?? null;
  } else if (req.priority === 'balanced') {
    // Balanced: a little more money for clearly more quality. Among the models
    // costing at most BALANCED_PRICE_FACTOR times the cheapest one, the best score wins.
    const cheapest = [...everydayPool].sort(byPrice)[0];
    const limit = cheapest ? choiceOf(cheapest).cost.totalUsd! * BALANCED_PRICE_FACTOR : 0;
    const affordable = everydayPool.filter((c) => choiceOf(c).cost.totalUsd! <= limit);
    everydayCandidate = affordable.sort((a, b) => b.quality.value - a.quality.value || byPrice(a, b))[0] ?? null;
  } else {
    everydayCandidate = [...everydayPool].sort(byPrice)[0] ?? null;
  }

  // Backup: documented superior capability, not merely a higher price.
  const minHard = Math.max(
    gate.hard,
    (everydayCandidate?.quality.value ?? 0) + THRESHOLDS.backupQualityGapPoints,
  );
  const hardPool = candidates.filter((c) => c.quality.value >= minHard && c.model.key !== everydayCandidate?.model.key);
  hardPool.sort((a, b) => b.quality.value - a.quality.value);
  const topScore = hardPool[0]?.quality.value ?? 0;
  // Within a 2-point band the difference is not meaningful, so prefer the cheaper one.
  const topBand = hardPool.filter((c) => c.quality.value >= topScore - 2);
  topBand.sort((a, b) => a.offers[0]!.cost.totalUsd! - b.offers[0]!.cost.totalUsd!);
  const hardCandidate = topBand[0] ?? null;

  const everyday = everydayCandidate ? toPick(everydayCandidate, 'everyday', null) : null;
  const hard = hardCandidate ? toPick(hardCandidate, 'hard', everydayCandidate) : null;

  const notes: string[] = [];
  if (!everyday) notes.push(c.engine.noWinner(unit(gate.everyday)));
  if (everyday && !hard) {
    notes.push(
      req.priority === 'quality'
        ? c.engine.noBackupBest
        : c.engine.noBackup(String(THRESHOLDS.backupQualityGapPoints)),
    );
  }

  // Savings are only claimed against a configuration the user actually declared.
  // Whatever the user picked, they get an answer: silence looks like a bug.
  let savings: Recommendation['savings'] = null;
  if (req.currentModelKey) {
    const current = snapshot.models[req.currentModelKey] ?? null;
    const currentOffers = (offersByModel.get(req.currentModelKey) ?? []).filter(
      (o) => !req.currentOfferId || o.id === req.currentOfferId,
    );
    const ranked = rankOffers(currentOffers, mix, req, minContext, now, current?.vendor ?? '', known).usable;
    const currentTotal = ranked[0]?.cost.totalUsd ?? null;
    const recommendedTotal = everyday?.cost.totalUsd ?? null;
    const outcome: Recommendation['savings'] extends null ? never : NonNullable<Recommendation['savings']>['outcome'] =
      !current
        ? 'unknown-model'
        : req.currentModelKey === everyday?.model.key
          ? 'already-recommended'
          : currentTotal !== null && recommendedTotal !== null
            ? 'compared'
            : !currentOffers.length
              ? 'no-seller'
              : !evidence.some((e) => e.modelKey === req.currentModelKey)
                ? 'no-evidence'
                : 'no-price';
    savings = {
      outcome,
      currentModelName: current?.displayName ?? null,
      currentTotalUsd: currentTotal,
      currentProviderName: ranked[0]?.offer.providerName ?? null,
      recommendedTotalUsd: recommendedTotal,
      deltaUsd: currentTotal !== null && recommendedTotal !== null ? currentTotal - recommendedTotal : null,
      note: currentTotal === null ? c.engine.savingsNoPrice : c.engine.savingsNote,
    };
  }

  const snapshotAge = hoursSince(snapshot.generatedAt, now);
  return {
    generatedAt: snapshot.generatedAt,
    request: req,
    mix,
    usingCustomUsage,
    everyday,
    hard,
    replacements: (snapshot.replacements ?? []).filter(
      (r) =>
        r.retiredMetric === ref.metric &&
        r.retiredScore >= gate.everyday &&
        r.successorKey !== everyday?.successor?.key &&
        r.successorKey !== hard?.successor?.key,
    ),
    method: {
      referenceHarness: ref.label,
      referenceHarnessModels: ref.size,
      gate,
      candidateModels: candidates.length,
      excluded: [...excluded.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      snapshotAgeHours: snapshotAge,
      snapshotStale: snapshotAge !== null && snapshotAge > THRESHOLDS.snapshotStaleHours,
    },
    savings,
    notes,
  };
}
