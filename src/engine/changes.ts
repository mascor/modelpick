/**
 * Difference against the previous published update. This is what makes the page
 * worth opening in the morning: not the numbers, but what moved since yesterday.
 */
import type { Pick } from './recommend.js';
import { t, type Lang } from '../i18n.js';

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

export function describeChange(before: Pick | null, now: Pick | null, lang: Lang = 'it'): Change | null {
  const c = t(lang).changes;
  if (!now) return null;
  if (!before) return { text: c.newPick, moved: true };

  if (before.model.key !== now.model.key) {
    return { text: c.modelChanged(nome(before.model.displayName), before.offer.providerName), moved: true };
  }
  if (before.offer.providerId !== now.offer.providerId) {
    return { text: c.providerChanged(before.offer.providerName, usd(before.cost.totalUsd!)), moved: true };
  }
  const a = before.cost.totalUsd;
  const b = now.cost.totalUsd;
  if (a !== null && b !== null && a > 0 && Math.abs(b - a) / a > 0.01) {
    return { text: c.priceMoved(b < a, usd(a), usd(b)), moved: true };
  }
  return { text: c.unchanged, moved: false };
}
