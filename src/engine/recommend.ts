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
import type { ModelRecord, Offer, QualityEvidence, Snapshot } from '../types.js';
import { costOf, type CostBreakdown } from './cost.js';
import { isIdentified, providerKey, usabilityOf, type Usability } from './usability.js';
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
}

export interface Recommendation {
  generatedAt: string;
  request: RecommendationRequest;
  mix: TokenMix;
  usingCustomUsage: boolean;
  everyday: Pick | null;
  hard: Pick | null;
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
  const staleMs = THRESHOLDS.evidenceFreshDays * 86_400_000;
  const pickFrom = (rows: QualityEvidence[]) =>
    rows.reduce((a, b) => (b.value > a.value ? b : a));

  const inRef = refKey ? mine.filter((e) => e.harnessKey === refKey) : [];
  if (!inRef.length) return null;
  const chosen = pickFrom(inRef);
  const measured = chosen.measuredAt ? Date.parse(chosen.measuredAt) : NaN;
  return {
    value: chosen.value,
    metric: chosen.metric,
    harness: chosen.harness,
    harnessKey: chosen.harnessKey,
    measuredAt: chosen.measuredAt,
    sourceUrl: chosen.sourceUrl,
    comparable: true,
    stale: Number.isNaN(measured) ? true : now - measured > staleMs,
    instanceCalls: chosen.instanceCalls,
  };
}

/** Offer-level eligibility. Returns null when usable, otherwise the reason it is not. */
function offerBlocker(offer: Offer, req: RecommendationRequest, minContext: number, now: number): ReasonCode | null {
  void req;
  if (offer.demo) return 'demo';
  // Pubblichiamo comandi da incollare: se OpenCode non conosce questa coppia
  // modello-provider, il comando non parte e l'offerta non va nemmeno mostrata.
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
  const pronte = usable.filter((o) => isIdentified(o.usability));
  return { usable, pronte, blocked };
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

  const excluded = new Map<ReasonCode, number>();
  const bump = (reason: ReasonCode) => excluded.set(reason, (excluded.get(reason) ?? 0) + 1);

  interface Candidate {
    model: ModelRecord;
    quality: QualityView;
    /** Every usable offer, cheapest first. */
    offers: OfferView[];
    /** The subset that needs no new account. */
    pronte: OfferView[];
  }
  const candidates: Candidate[] = [];

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
    const { usable, pronte, blocked } = rankOffers(offers, mix, req, minContext, now, model.vendor, known);
    if (!usable.length) {
      bump(blocked[0] ?? 'no-usable-offer');
      continue;
    }
    candidates.push({ model, quality, offers: usable, pronte });
  }

  /**
   * The cheapest offer among providers we can identify. Needing an account is
   * normal and simply stated; being unable to say who the company is, is not.
   */
  const sceltaDi = (c: Candidate): OfferView => c.pronte[0] ?? c.offers[0]!;

  const toPick = (cand: Candidate, role: 'everyday' | 'hard', other: Candidate | null): Pick => {
    const best = sceltaDi(cand);
    const provisionalReasons: string[] = [];
    if (!cand.quality.comparable) provisionalReasons.push(c.engine.provisionalCrossHarness);
    if (cand.quality.stale) provisionalReasons.push(c.engine.provisionalStale(String(THRESHOLDS.evidenceFreshDays)));
    if (best.cost.unquantifiedFees.length) provisionalReasons.push(c.engine.provisionalFee);
    if (best.cost.assumptions.length) provisionalReasons.push(c.engine.provisionalCacheAssumption);
    if (cand.offers.length === 1) provisionalReasons.push(c.engine.provisionalSingle);
    if (!cand.pronte.length) provisionalReasons.push(c.engine.provisionalUnidentified);

    const price = fmtUsd(best.cost.totalUsd!);
    const label = metricLabel(cand.quality.metric);
    const score = formatScore(cand.quality.value, cand.quality.metric);
    const gap = other ? (cand.quality.value - other.quality.value).toFixed(1) : null;

    const reason =
      role === 'everyday'
        ? req.priority === 'qualita'
          ? c.engine.everydayBest(score, label, price)
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
    };
  };

  /**
   * The user's single choice changes what "best" means, which is the whole point
   * of asking it:
   * - spend less / balanced: the cheapest model that clears the quality gate;
   * - work well: the highest measured score, with price only breaking ties
   *   inside a band where the score difference is not meaningful.
   */
  const everydayPool = candidates.filter((c) => c.quality.value >= gate.everyday);
  const byPrice = (a: Candidate, b: Candidate) => sceltaDi(a).cost.totalUsd! - sceltaDi(b).cost.totalUsd!;
  let everydayCandidate: Candidate | null;
  if (req.priority === 'qualita') {
    const top = everydayPool.reduce((max, c) => Math.max(max, c.quality.value), 0);
    const band = everydayPool.filter((c) => c.quality.value >= top - 2).sort(byPrice);
    everydayCandidate = band[0] ?? null;
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
      req.priority === 'qualita'
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
