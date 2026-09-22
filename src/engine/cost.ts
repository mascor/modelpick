/**
 * Cost of one offer over one usage scenario. Every component comes from the
 * same offer: mixing one provider's input price with another's output price is
 * structurally impossible here.
 */
import type { Offer } from '../types.js';
import type { TokenMix } from './scenarios.js';
import { t, type Lang } from '../i18n.js';

export interface CostLine {
  label: string;
  tokens: number;
  usdPerMTok: number | null;
  usd: number | null;
}

export interface CostBreakdown {
  /** False when a price needed by this scenario is unknown. */
  complete: boolean;
  missing: string[];
  /** Conservative fallbacks applied, stated so the user can judge them. */
  assumptions: string[];
  /** True when the offer has no per-token price (free tier or bundled plan). */
  planBased: boolean;
  lines: CostLine[];
  tokensUsd: number | null;
  feesUsd: number | null;
  feeNotes: string[];
  constraints: string[];
  /** Fees that certainly apply but whose amount we could not verify. */
  unquantifiedFees: string[];
  totalUsd: number | null;
}

const line = (label: string, tokens: number, price: number | null): CostLine => ({
  label,
  tokens,
  usdPerMTok: price,
  usd: price === null ? null : (tokens / 1_000_000) * price,
});

export function costOf(offer: Offer, mix: TokenMix, lang: Lang = 'it'): CostBreakdown {
  const c = t(lang);
  const assumptions: string[] = [];
  const input = offer.prices.inputPerMTok;

  /**
   * A provider that does not publish a cache price does not give cache away:
   * those tokens are billed as ordinary input. Charging them at the input price
   * is an upper bound, never a discount, and it is declared to the user.
   */
  let cacheRead = offer.prices.cacheReadPerMTok;
  if (cacheRead === null && mix.cacheRead > 0 && input !== null) {
    cacheRead = input;
    assumptions.push(c.engine.cacheReadAssumption);
  }
  let cacheWrite = offer.prices.cacheWritePerMTok;
  if (cacheWrite === null && mix.cacheWrite > 0 && input !== null) {
    cacheWrite = input;
    assumptions.push(c.engine.cacheWriteAssumption);
  }

  const lines: CostLine[] = [
    line(c.costLines.input, mix.input, input),
    line(c.costLines.output, mix.output, offer.prices.outputPerMTok),
    line(c.costLines.cacheRead, mix.cacheRead, cacheRead),
    line(c.costLines.cacheWrite, mix.cacheWrite, cacheWrite),
  ];

  // No per-token price at all: a free tier or a flat plan. Its real cost is not
  // published per token, so it must not be compared as if it were zero.
  const planBased = (input === 0 || input === null) && (offer.prices.outputPerMTok === 0 || offer.prices.outputPerMTok === null);

  const missing: string[] = [];
  let tokensUsd = 0;
  for (const l of lines) {
    if (l.tokens === 0) continue; // a price we do not need cannot make the estimate incomplete
    if (l.usd === null) {
      missing.push(l.label);
      continue;
    }
    tokensUsd += l.usd;
  }

  // A missing price is never treated as free.
  const complete = missing.length === 0;

  let feesUsd = 0;
  const feeNotes: string[] = [];
  const constraints: string[] = [];
  const unquantifiedFees: string[] = [];
  // Source connectors store a code for notes the user will read, so the text
  // can be rendered in whichever language the page is in.
  const feeText = (note: string) => (note === 'OPENROUTER_CREDIT_FEE' ? c.engine.feeOpenRouter : note);
  for (const fee of offer.fees) {
    if (fee.kind === 'minimum_topup') {
      constraints.push(feeText(fee.note));
      continue;
    }
    if (!fee.percent && !fee.amountUsd) {
      // Known to apply, amount unverified: shown to the user, never guessed at.
      unquantifiedFees.push(feeText(fee.note));
      continue;
    }
    if (fee.percent) {
      const amount = (tokensUsd * fee.percent) / 100;
      feesUsd += amount;
      feeNotes.push(`${feeText(fee.note)}: +${fee.percent}%`);
    }
    if (fee.amountUsd) {
      feesUsd += fee.amountUsd;
      feeNotes.push(`${feeText(fee.note)}: +${fee.amountUsd.toFixed(2)} USD`);
    }
  }

  return {
    complete,
    missing,
    assumptions,
    planBased,
    lines,
    tokensUsd: complete ? tokensUsd : null,
    feesUsd: complete ? feesUsd : null,
    feeNotes,
    constraints,
    unquantifiedFees,
    totalUsd: complete ? tokensUsd + feesUsd : null,
  };
}
