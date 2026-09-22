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
import { isReadyToUse, usabilityOf, type Usability } from './usability.js';
import { QUALITY_GATE, SCENARIOS, type Priority, type TaskId, type TokenMix } from './scenarios.js';


export interface RecommendationRequest {
  task: TaskId;
  priority: Priority;
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
    excluded: { reason: string; count: number }[];
    snapshotAgeHours: number | null;
    snapshotStale: boolean;
  };
  savings: {
    currentTotalUsd: number | null;
    recommendedTotalUsd: number | null;
    deltaUsd: number | null;
    note: string;
  } | null;
  notes: string[];
}

const fmtUsd = (v: number) => `${v < 10 ? v.toFixed(2) : v.toFixed(0)} USD`;

/**
 * The reference comparability group is the harness that measured the most
 * models. Comparing inside it is fair; anything else is provisional evidence.
 */
function referenceGroup(evidence: QualityEvidence[]): { key: string | null; label: string | null; size: number } {
  const byHarness = new Map<string, Set<string>>();
  for (const e of evidence) {
    if (e.metric !== 'swebench_verified') continue;
    const set = byHarness.get(e.harnessKey) ?? new Set<string>();
    set.add(e.modelKey);
    byHarness.set(e.harnessKey, set);
  }
  let best: { key: string; size: number } | null = null;
  for (const [key, set] of byHarness) {
    if (!best || set.size > best.size) best = { key, size: set.size };
  }
  if (!best) return { key: null, label: null, size: 0 };
  const label = evidence.find((e) => e.harnessKey === best!.key)?.harness ?? best.key;
  return { key: best.key, label, size: best.size };
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
  const staleMs = THRESHOLDS.evidenceStaleDays * 86_400_000;
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
function offerBlocker(offer: Offer, req: RecommendationRequest, minContext: number, now: number): string | null {
  if (offer.demo) return 'dato dimostrativo';
  if (offer.quarantine) return 'prezzo in quarantena per variazione anomala';
  const age = hoursSince(offer.observedAt, now);
  if (age !== null && age > THRESHOLDS.offerStaleHours) return `prezzo non verificato da oltre ${THRESHOLDS.offerStaleHours} ore`;
  if (offer.supportsTools === false) return 'non supporta gli strumenti richiesti da un agente di codice';
  if (offer.contextTokens !== null && offer.contextTokens < minContext) return 'contesto insufficiente per questa attività';
  if (offer.uptime30m !== null && offer.uptime30m < THRESHOLDS.minUptime30m) return 'disponibilità recente troppo bassa';
  return null;
}

function rankOffers(
  offers: Offer[],
  mix: TokenMix,
  req: RecommendationRequest,
  minContext: number,
  now: number,
  modelVendor = '',
) {
  const usable: OfferView[] = [];
  const blocked: string[] = [];
  for (const offer of offers) {
    const blocker = offerBlocker(offer, req, minContext, now);
    if (blocker) {
      blocked.push(blocker);
      continue;
    }
    const cost = costOf(offer, mix);
    // An incomplete cost cannot be compared with a complete one.
    if (!cost.complete) {
      blocked.push('prezzi incompleti per questo scenario');
      continue;
    }
    // Free tiers and bundled plans have a real cost that is not published per
    // token: treating them as 0 would make them win every comparison.
    if (cost.planBased) {
      blocked.push('offerta gratuita o inclusa in un piano: nessun prezzo per token pubblicato da confrontare');
      continue;
    }
    usable.push({ offer, cost, usability: usabilityOf(offer, modelVendor) });
  }
  usable.sort((a, b) => (a.cost.totalUsd! - b.cost.totalUsd!) || a.offer.providerName.localeCompare(b.offer.providerName));
  // Offers you can use straight away come first; the others stay visible with
  // their price, clearly marked as requiring a new account.
  const pronte = usable.filter((o) => isReadyToUse(o.usability));
  return { usable, pronte, blocked };
}

export function recommend(snapshot: Snapshot, req: RecommendationRequest): Recommendation {
  const now = Date.now();
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
  const gate = QUALITY_GATE[req.priority];
  const ref = referenceGroup(snapshot.evidence);

  const offersByModel = new Map<string, Offer[]>();
  for (const o of snapshot.offers) {
    const list = offersByModel.get(o.modelKey) ?? [];
    list.push(o);
    offersByModel.set(o.modelKey, list);
  }

  const excluded = new Map<string, number>();
  const bump = (reason: string) => excluded.set(reason, (excluded.get(reason) ?? 0) + 1);

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
    const quality = bestQuality(model.key, snapshot.evidence, ref.key, now);
    if (!quality) {
      if (snapshot.evidence.some((e) => e.modelKey === model.key)) {
        bump('misurato solo con banchi di prova non confrontabili con quello di riferimento');
      }
      continue; // no comparable coding evidence: cannot be recommended
    }
    if (model.toolCall === false) {
      bump('il modello non supporta gli strumenti');
      continue;
    }
    if (model.contextTokens !== null && model.contextTokens < minContext) {
      bump('contesto del modello insufficiente per questa attività');
      continue;
    }
    const offers = offersByModel.get(model.key) ?? [];
    if (!offers.length) {
      bump('nessun provider monitorato vende questo modello');
      continue;
    }
    const { usable, pronte, blocked } = rankOffers(offers, mix, req, minContext, now, model.vendor);
    if (!usable.length) {
      bump(blocked[0] ?? 'nessuna offerta utilizzabile');
      continue;
    }
    candidates.push({ model, quality, offers: usable, pronte });
  }

  /**
   * The cheapest offer, full stop: that is what the site promises. Needing an
   * account with the provider is normal - it is stated, not avoided.
   */
  const sceltaDi = (c: Candidate): OfferView => c.offers[0]!;

  const toPick = (c: Candidate, role: 'everyday' | 'hard', other: Candidate | null): Pick => {
    const best = sceltaDi(c);
    const provisionalReasons: string[] = [];
    if (!c.quality.comparable) provisionalReasons.push('la prova disponibile viene da un banco di prova diverso da quello di riferimento');
    if (c.quality.stale) provisionalReasons.push(`la misura ha più di ${THRESHOLDS.evidenceStaleDays} giorni`);
    if (best.cost.unquantifiedFees.length) provisionalReasons.push('una commissione applicabile non è quantificabile automaticamente');
    if (best.cost.assumptions.length) provisionalReasons.push('il costo usa un\'ipotesi prudenziale sui prezzi di cache non pubblicati');
    if (c.offers.length === 1) provisionalReasons.push('un solo provider monitorato soddisfa i requisiti');

    const price = best.cost.totalUsd!;
    const metricLabel = c.quality.metric === 'swebench_verified' ? 'SWE-bench Verified' : 'Aider polyglot';
    const reason =
      role === 'everyday'
        ? req.priority === 'qualita'
          ? `È il punteggio più alto fra i modelli misurati nelle stesse condizioni (${c.quality.value.toFixed(1)}% su ${metricLabel}), e fra quelli che stanno in questa fascia è il meno costoso: ${fmtUsd(price)} al mese sullo scenario scelto.`
          : `Risolve il ${c.quality.value.toFixed(1)}% dei problemi su ${metricLabel}, sopra la soglia di ${gate.everyday}% richiesta per questa priorità, ed è la combinazione modello-provider meno costosa fra quelle che ci riescono (${fmtUsd(price)} al mese sullo scenario scelto).`
        : `Risolve il ${c.quality.value.toFixed(1)}% dei problemi su ${metricLabel}${other ? `, ${(c.quality.value - other.quality.value).toFixed(1)} punti percentuali sopra il modello quotidiano, misurati nelle stesse condizioni` : ''}: la capacità superiore è documentata, non dedotta dal prezzo.`;

    const whenToUse =
      role === 'hard'
        ? other
          ? 'Tienilo per i bug che non si riproducono, i refactoring su molti file e il codice che il modello di ogni giorno continua a sbagliare.'
          : 'Usalo quando il modello di ogni giorno non arriva a una soluzione.'
        : null;

    return {
      model: c.model,
      offer: best.offer,
      cost: best.cost,
      chosen: best,
      quality: c.quality,
      reason,
      whenToUse,
      alternatives: c.offers.filter((o) => o !== best).slice(0, 20),
      offersCompared: c.offers.length,
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
  if (!everyday) {
    notes.push(
      `Nessun modello supera la soglia di qualità di ${gate.everyday}% con un provider che soddisfa i tuoi requisiti: non assegniamo un vincitore.`,
    );
  }
  if (everyday && !hard) {
    notes.push(
      req.priority === 'qualita'
        ? 'Con questa priorità il modello di ogni giorno è già il migliore misurato: un secondo modello non aggiungerebbe niente.'
        : `Nessun modello documenta una capacità superiore di almeno ${THRESHOLDS.backupQualityGapPoints} punti rispetto al quotidiano: preferiamo non indicare un backup piuttosto che indicarne uno senza prove.`,
    );
  }

  // Savings are only claimed against a configuration the user actually declared.
  let savings: Recommendation['savings'] = null;
  if (req.currentModelKey) {
    const currentOffers = (offersByModel.get(req.currentModelKey) ?? []).filter(
      (o) => !req.currentOfferId || o.id === req.currentOfferId,
    );
    const ranked = rankOffers(currentOffers, mix, req, minContext, now, snapshot.models[req.currentModelKey]?.vendor ?? '').usable;
    const currentTotal = ranked[0]?.cost.totalUsd ?? null;
    const recommendedTotal = everyday?.cost.totalUsd ?? null;
    savings = {
      currentTotalUsd: currentTotal,
      recommendedTotalUsd: recommendedTotal,
      deltaUsd: currentTotal !== null && recommendedTotal !== null ? currentTotal - recommendedTotal : null,
      note:
        currentTotal === null
          ? 'Non abbiamo un prezzo verificato per la tua configurazione attuale, quindi non calcoliamo un risparmio.'
          : 'Stima sui consumi indicati, non una misura: confronta gli stessi volumi sulle due offerte.',
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
