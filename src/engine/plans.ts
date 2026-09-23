/**
 * Capped subscription plans (OpenCode Go) against pay-per-token providers.
 *
 * A plan charges a fixed fee and gives each model a monthly allowance, drawn
 * down at the plan's own list prices. Its per-token price is therefore not a
 * price anyone pays: what a month costs depends on how much of the allowance
 * the month uses. So the plan is never ranked as a plain offer; this module
 * works out, for the same month of work, the plan's bill, the cheapest
 * provider's bill, and the range of monthly spend in which the plan wins.
 */
import { THRESHOLDS } from '../config.js';
import { hoursSince } from '../lib/normalize.js';
import type { ModelRecord, Offer, Plan, PlanModel, Snapshot } from '../types.js';
import type { ReasonCode } from '../i18n.js';
import { costOf } from './cost.js';
import type { TokenMix } from './scenarios.js';
import { CLOSE_POINTS, SCENARIOS } from './scenarios.js';
import {
  deliverable,
  isFresh,
  knownProviders,
  mixFor,
  offerBlocker,
  rankOffers,
  referenceGroup,
  viewOf,
  type OfferView,
  type QualityView,
  type RecommendationRequest,
} from './recommend.js';

/** What one month of the given work costs on the plan. */
export interface PlanMonth {
  /** Allowance this month of work would use, USD at the plan's prices. */
  drawUsd: number;
  capUsd: number;
  /** Share of the month's work the allowance covers, 0-1. */
  coveredShare: number;
  /** Cost of the work beyond the allowance, at pay-as-you-go prices ("Use balance"). */
  overageUsd: number;
  /** Fee plus overage. */
  totalUsd: number;
}

/**
 * One month on the plan. `overageMonthUsd` is what the whole month would cost
 * at the pay-as-you-go prices that apply beyond the allowance: only the share
 * the allowance does not cover is charged at them.
 */
export function planMonth(feeUsd: number, capUsd: number, drawUsd: number, overageMonthUsd: number): PlanMonth {
  const coveredShare = drawUsd <= capUsd ? 1 : capUsd / drawUsd;
  const overageUsd = (1 - coveredShare) * overageMonthUsd;
  return { drawUsd, capUsd, coveredShare, overageUsd, totalUsd: feeUsd + overageUsd };
}

/**
 * The range of monthly spend at the cheapest provider in which the plan costs
 * less, for work of the same shape at any volume. Both bills grow with volume:
 * the provider's in a straight line, the plan's flat up to the allowance and
 * then at pay-as-you-go prices.
 *
 * @param providerUsd the provider's bill for one unit of work (P)
 * @param drawUsd allowance one unit of work uses (C)
 * @param overageUsd one unit of work at pay-as-you-go prices (O)
 * @returns spend at the provider, from-to (to = null: no upper end); null when the plan never wins
 */
export function breakEven(
  feeUsd: number,
  capUsd: number,
  providerUsd: number,
  drawUsd: number,
  overageUsd: number,
): { fromUsd: number; toUsd: number | null } | null {
  const [fee, T, P, C, O] = [feeUsd, capUsd, providerUsd, drawUsd, overageUsd];
  if (!(P > 0) || !(C > 0)) return null;
  const capUnits = T / C; // units of work the allowance covers
  // Inside the allowance the plan costs the fee: it wins once the provider costs more.
  if (fee / P <= capUnits) {
    // Beyond the allowance each unit costs O on the plan and P at the provider.
    if (O <= P) return { fromUsd: fee, toUsd: null };
    const k = (T * O / C - fee) / (O - P);
    return { fromUsd: fee, toUsd: k * P };
  }
  // The allowance runs out before the provider reaches the fee: the plan can
  // only catch up if pay-as-you-go is cheaper than the provider.
  if (O >= P) return null;
  const k = (fee - T * O / C) / (P - O);
  return { fromUsd: k * P, toUsd: null };
}

/**
 * Which is the better deal for this month of work:
 * - plan: the fee covers the whole month and the provider would cost more;
 * - direct: the fee covers the month but the provider costs less;
 * - not-enough: the allowance runs out before the month ends, so the fee does
 *   not buy this month of work at all (the rest would be paid per token);
 * - even: the difference is noise next to the estimate.
 */
export type PlanVerdict = 'plan' | 'direct' | 'not-enough' | 'even';

/** Differences up to this are a tie: noise next to the estimates they come from. */
export const EVEN_USD = 0.1;

export interface PlanRow {
  planModelId: string;
  terms: PlanModel;
  modelKey: string;
  model: ModelRecord | null;
  offer: Offer;
  /** Why the plan's own offer cannot be used, e.g. OpenCode does not know the id. */
  blocker: ReasonCode | null;
  /** The score a buyer through the plan gets; null when not measured in the last days. */
  quality: QualityView | null;
  /** The allowance is drawn at busy-hour prices (an upper bound). */
  peakApplied: boolean;
  /** Beyond the allowance: priced from the pay-as-you-go seller, or from the plan's own list. */
  overageFrom: 'seller' | 'plan-list';
  month: PlanMonth | null;
  /** The cheapest provider we would recommend for the same model and month of work. */
  direct: OfferView | null;
  /**
   * Provider bill minus the fee, only when the fee covers the whole month:
   * positive when the plan is cheaper. Null when the allowance does not last
   * the month, because then the fee is not what the month costs.
   */
  savingUsd: number | null;
  verdict: PlanVerdict | null;
  breakEven: { fromUsd: number; toUsd: number | null } | null;
  /** Spend at the provider that buys the same work as the whole allowance. */
  allowanceWorthUsd: number | null;
}

/** One way to spend a month: a model on the plan, or a model paid per token. */
export interface ChoiceOption {
  kind: 'plan' | 'per-token';
  modelKey: string;
  model: ModelRecord | null;
  quality: QualityView;
  /** The month's cost: the fee for the plan, the cheapest provider's bill otherwise. */
  costUsd: number;
  providerName: string;
  offer: Offer;
}

/**
 * The answer to "what should I use", with the plan as one option among all.
 * The same rule as the main page, with the plan's fee as the budget: the
 * highest score within budget; options within CLOSE_POINTS of it count as
 * equal and the cheapest wins. The alternative is the best option of the
 * other kind, so the plan always gets its fair line.
 */
export interface PlanChoice {
  budgetUsd: number;
  recommended: ChoiceOption | null;
  /** The highest score within budget, the reference the CLOSE_POINTS rule counts from. */
  top: ChoiceOption | null;
  alternative: ChoiceOption | null;
  /** Options compared, both kinds. */
  compared: number;
}

/** The highest-scoring option within budget (the cheaper one on equal scores). */
export function topWithin(options: ChoiceOption[], budgetUsd: number): ChoiceOption | null {
  const within = options.filter((o) => o.costUsd <= budgetUsd + 1e-9);
  return within.sort((a, b) => b.quality.value - a.quality.value || a.costUsd - b.costUsd)[0] ?? null;
}

export function chooseWithin(options: ChoiceOption[], budgetUsd: number): ChoiceOption | null {
  const within = options.filter((o) => o.costUsd <= budgetUsd + 1e-9);
  if (!within.length) return null;
  const top = Math.max(...within.map((o) => o.quality.value));
  const close = within.filter((o) => o.quality.value >= top - CLOSE_POINTS);
  return close.sort((a, b) => a.costUsd - b.costUsd || b.quality.value - a.quality.value)[0]!;
}

export interface PlanComparison {
  plan: Plan;
  mix: TokenMix;
  rows: PlanRow[];
  choice: PlanChoice;
  /** The documentation was read too long ago to vouch for the figures. */
  stale: boolean;
  checkedAgeDays: number | null;
  summary: {
    usable: number;
    planCheaper: number;
    /** Highest-scoring usable model in the plan. */
    best: PlanRow | null;
  };
}

/** The plan's prices, with busy-hour prices where the plan has them. */
function drawPrices(offer: Offer, terms: PlanModel): Offer {
  if (!terms.peakPrices) return offer;
  return { ...offer, prices: { ...offer.prices, ...terms.peakPrices } };
}

export function comparePlan(snapshot: Snapshot, planId: string, req: RecommendationRequest): PlanComparison | null {
  const plan = snapshot.plans?.find((p) => p.id === planId);
  if (!plan) return null;
  const now = Date.now();
  const mix = mixFor(req);
  const minContext = Math.max(SCENARIOS[req.task].minContextTokens, THRESHOLDS.minContextTokens);
  const known = knownProviders(snapshot);
  const evidence = snapshot.evidence.filter((e) => isFresh(e, now));
  const ref = referenceGroup(evidence);

  const rows: PlanRow[] = [];
  for (const offer of snapshot.offers) {
    if (offer.planId !== plan.id || !offer.remoteModelId) continue;
    const terms = plan.models[offer.remoteModelId];
    if (!terms) continue; // priced by a source, but not in the plan as documented
    const model = snapshot.models[offer.modelKey] ?? null;
    const blocker = offerBlocker(offer, req, minContext, now, true);

    const variants = evidence.filter((e) => e.modelKey === offer.modelKey && e.harnessKey === ref.key);
    const within = deliverable(variants, offer);
    const quality = within.length ? viewOf(within.reduce((a, b) => (b.value > a.value ? b : a)), now) : null;

    const draw = costOf(drawPrices(offer, terms), mix, req.lang);
    const seller = plan.overageProviderId
      ? snapshot.offers.find((o) => o.providerId === plan.overageProviderId && o.modelKey === offer.modelKey && !o.quarantine)
      : undefined;
    const sellerCost = seller ? costOf(seller, mix, req.lang) : null;
    const overage = sellerCost?.complete && !sellerCost.planBased ? sellerCost : draw;
    const month = draw.complete && overage.totalUsd !== null
      ? planMonth(plan.monthlyFeeUsd, terms.capUsd, draw.totalUsd!, overage.totalUsd)
      : null;

    const others = snapshot.offers.filter((o) => o.modelKey === offer.modelKey && !o.planId);
    const ranked = rankOffers(others, mix, req, minContext, now, model?.vendor ?? '', known);
    const direct = ranked.ready[0] ?? ranked.usable[0] ?? null;
    const P = direct?.cost.totalUsd ?? null;
    const covered = month !== null && month.coveredShare >= 1;
    const saving = covered && P !== null ? P - plan.monthlyFeeUsd : null;
    const verdict: PlanVerdict | null = !month || P === null
      ? null
      : !covered
        ? 'not-enough'
        : Math.abs(saving!) < EVEN_USD
          ? 'even'
          : saving! > 0
            ? 'plan'
            : 'direct';

    rows.push({
      planModelId: offer.remoteModelId,
      terms,
      modelKey: offer.modelKey,
      model,
      offer,
      blocker,
      quality,
      peakApplied: Boolean(terms.peakPrices),
      overageFrom: overage === draw ? 'plan-list' : 'seller',
      month,
      direct,
      savingUsd: saving,
      verdict,
      breakEven: month && P !== null ? breakEven(plan.monthlyFeeUsd, terms.capUsd, P, month.drawUsd, overage.totalUsd!) : null,
      allowanceWorthUsd: month && P !== null && month.drawUsd > 0 ? (terms.capUsd / month.drawUsd) * P : null,
    });
  }

  // Usable and measured first, best score first; then the unmeasured; then the unusable.
  const rank = (r: PlanRow) => (r.blocker ? 2 : r.quality ? 0 : 1);
  rows.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (b.quality?.value ?? 0) - (a.quality?.value ?? 0) ||
      a.planModelId.localeCompare(b.planModelId),
  );

  const usable = rows.filter((r) => !r.blocker && r.month);

  // Every measured model paid per token, at its cheapest usable provider.
  const perToken: ChoiceOption[] = [];
  const offersByModel = new Map<string, Offer[]>();
  for (const o of snapshot.offers) {
    if (o.planId) continue;
    const list = offersByModel.get(o.modelKey) ?? [];
    list.push(o);
    offersByModel.set(o.modelKey, list);
  }
  for (const model of Object.values(snapshot.models)) {
    if (model.toolCall === false || (model.contextTokens !== null && model.contextTokens < minContext)) continue;
    const variants = evidence.filter((e) => e.modelKey === model.key && e.harnessKey === ref.key);
    if (!variants.length) continue;
    const ranked = rankOffers(offersByModel.get(model.key) ?? [], mix, req, minContext, now, model.vendor, known);
    const best = ranked.ready[0] ?? ranked.usable[0];
    if (!best) continue;
    const within = deliverable(variants, best.offer);
    if (!within.length) continue;
    perToken.push({
      kind: 'per-token',
      modelKey: model.key,
      model,
      quality: viewOf(within.reduce((a, b) => (b.value > a.value ? b : a)), now),
      costUsd: best.cost.totalUsd!,
      providerName: best.offer.providerName,
      offer: best.offer,
    });
  }
  // The plan only counts where its fee buys the whole month.
  const onPlan: ChoiceOption[] = usable
    .filter((r) => r.quality && r.month!.coveredShare >= 1)
    .map((r) => ({
      kind: 'plan' as const,
      modelKey: r.modelKey,
      model: r.model,
      quality: r.quality!,
      costUsd: plan.monthlyFeeUsd,
      providerName: plan.name,
      offer: r.offer,
    }));
  const recommended = chooseWithin([...perToken, ...onPlan], plan.monthlyFeeUsd);
  // As an alternative, the plan is only offered for a model it actually serves
  // better than paying per token: never "the same model for 10 USD instead of 2".
  const planWins = new Set(usable.filter((r) => r.verdict === 'plan').map((r) => r.offer.id));
  const onPlanWinning = onPlan.filter((o) => planWins.has(o.offer.id) && o.modelKey !== recommended?.modelKey);
  const alternative = recommended?.kind === 'plan'
    ? chooseWithin(perToken.filter((o) => o.modelKey !== recommended.modelKey), plan.monthlyFeeUsd)
    : chooseWithin(onPlanWinning, plan.monthlyFeeUsd);

  const checkedAgeHours = hoursSince(`${plan.checkedAt}T00:00:00Z`, now);
  const checkedAgeDays = checkedAgeHours === null ? null : Math.floor(checkedAgeHours / 24);
  return {
    plan,
    mix,
    rows,
    choice: { budgetUsd: plan.monthlyFeeUsd, recommended, top: topWithin([...perToken, ...onPlan], plan.monthlyFeeUsd), alternative, compared: perToken.length + onPlan.length },
    stale: checkedAgeDays === null || checkedAgeDays > THRESHOLDS.planMaxAgeDays,
    checkedAgeDays,
    summary: {
      usable: usable.length,
      planCheaper: usable.filter((r) => r.verdict === 'plan').length,
      // Rows come best score first: the best measured model the plan pays off with.
      best: usable.find((r) => r.quality && r.verdict === 'plan') ?? null,
    },
  };
}

/** The date a "ZDR_UNTIL:YYYY-MM-DD" note carries, or null. */
export function retentionUntil(note: string | null | undefined): string | null {
  const m = /^ZDR_UNTIL:(\d{4}-\d{2}-\d{2})$/.exec(note ?? '');
  return m ? m[1]! : null;
}

/** Promotions still running on the given day; an expired one is never applied. */
export function activePromotions(plan: Plan, now = Date.now()): NonNullable<Plan['promotions']> {
  return (plan.promotions ?? []).filter((p) => now <= Date.parse(`${p.until}T23:59:59-12:00`));
}
