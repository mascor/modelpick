/**
 * Validation sits between collection and publication. Its job is to make sure a
 * bad row cannot become a recommendation: a missing price never becomes zero,
 * and an implausible jump is quarantined rather than trusted.
 */
import { THRESHOLDS } from '../config.js';
import type { Offer, PriceSet, Snapshot } from '../types.js';

export interface ValidationReport {
  kept: Offer[];
  dropped: { offer: Offer; reason: string }[];
  warnings: string[];
}

const priceFields: (keyof PriceSet)[] = ['inputPerMTok', 'outputPerMTok', 'cacheReadPerMTok', 'cacheWritePerMTok'];

const sane = (v: number | null): boolean => v === null || (Number.isFinite(v) && v >= 0 && v <= THRESHOLDS.maxPricePerMTok);

export function validateOffers(offers: Offer[], previous: Snapshot | null): ValidationReport {
  const kept: Offer[] = [];
  const dropped: { offer: Offer; reason: string }[] = [];
  const warnings: string[] = [];

  const before = new Map<string, Offer>();
  for (const o of previous?.offers ?? []) before.set(o.id, o);

  const seen = new Set<string>();
  for (const offer of offers) {
    // Two rows sharing an id would mean two products treated as one.
    if (seen.has(offer.id)) {
      dropped.push({ offer, reason: 'identificativo di offerta duplicato' });
      continue;
    }
    seen.add(offer.id);

    // An offer with no usable price is not an offer.
    const anyPrice = priceFields.some((f) => offer.prices[f] !== null);
    if (!anyPrice) {
      dropped.push({ offer, reason: 'nessun prezzo disponibile' });
      continue;
    }

    const insane = priceFields.find((f) => !sane(offer.prices[f]));
    if (insane) {
      dropped.push({ offer, reason: `prezzo fuori scala su ${insane} (possibile errore di unità)` });
      continue;
    }

    if (offer.prices.inputPerMTok === null && offer.prices.outputPerMTok === null) {
      dropped.push({ offer, reason: 'mancano sia il prezzo di input sia quello di output' });
      continue;
    }

    const prior = before.get(offer.id);
    let quarantine: string | null = null;
    if (prior) {
      for (const f of priceFields) {
        const now = offer.prices[f];
        const then = prior.prices[f];
        if (now === null || then === null || then === 0) continue;
        const factor = now / then;
        if (factor > THRESHOLDS.priceJumpFactor || factor < 1 / THRESHOLDS.priceJumpFactor) {
          quarantine = `variazione anomala su ${f}: da ${then} a ${now} USD/1M token rispetto all\'ultimo aggiornamento`;
          warnings.push(`${offer.id}: ${quarantine}`);
          break;
        }
      }
    }

    kept.push({ ...offer, quarantine });
  }

  return { kept, dropped, warnings };
}
