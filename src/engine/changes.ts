/**
 * Difference against the previous published update. This is what makes the page
 * worth opening in the morning: not the numbers, but what moved since yesterday.
 */
import type { Pick } from './recommend.js';

export interface Change {
  /** Short sentence for the card. */
  text: string;
  /** True when something actually moved, so the UI can highlight it. */
  moved: boolean;
}

const usd = (v: number) => `${v.toFixed(2)} USD`;
const nome = (raw: string) => {
  const i = raw.indexOf(': ');
  return i > 0 ? raw.slice(i + 2) : raw;
};

export function describeChange(before: Pick | null, now: Pick | null): Change | null {
  if (!now) return null;
  if (!before) return { text: 'Nuova raccomandazione: nell\'aggiornamento precedente non ce n\'era una.', moved: true };

  if (before.model.key !== now.model.key) {
    return {
      text: `Modello cambiato: prima consigliavamo ${nome(before.model.displayName)} da ${before.offer.providerName}.`,
      moved: true,
    };
  }
  if (before.offer.providerId !== now.offer.providerId) {
    return {
      text: `Provider cambiato: il più economico era ${before.offer.providerName} a ${usd(before.cost.totalUsd!)} al mese.`,
      moved: true,
    };
  }
  const a = before.cost.totalUsd;
  const b = now.cost.totalUsd;
  if (a !== null && b !== null && a > 0 && Math.abs(b - a) / a > 0.01) {
    return {
      text: `Prezzo ${b < a ? 'sceso' : 'salito'} da ${usd(a)} a ${usd(b)} al mese.`,
      moved: true,
    };
  }
  return { text: 'Invariato rispetto all\'aggiornamento precedente.', moved: false };
}
