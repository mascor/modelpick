/**
 * Can the reader actually buy this today?
 *
 * A price is useless if using it means opening an account with a reseller
 * nobody has heard of. We therefore separate offers into three kinds and lead
 * with the ones a developer can use in one step.
 */
import { normalizeVendor } from '../lib/normalize.js';
import type { Offer } from '../types.js';

export type Usability =
  | 'hub'          // one account, almost every model: OpenRouter
  | 'diretto'      // the company that makes the model, sold by itself
  | 'rivenditore'; // a third party: needs its own account and key

/** Model vendor -> the provider ids through which that vendor sells directly. */
const FIRST_PARTY: Record<string, string[]> = {
  anthropic: ['anthropic'],
  openai: ['openai'],
  google: ['google', 'google-vertex'],
  deepseek: ['deepseek'],
  minimax: ['minimax', 'minimax-cn'],
  moonshot: ['moonshotai', 'moonshot'],
  'z-ai': ['zai', 'z-ai'],
  qwen: ['alibaba'],
  'x-ai': ['xai'],
  mistralai: ['mistral'],
  amazon: ['amazon-bedrock'],
  microsoft: ['azure'],
};

export function usabilityOf(offer: Offer, modelVendor: string): Usability {
  if (offer.sourceId === 'openrouter' || offer.providerId === 'openrouter') return 'hub';
  const vendor = normalizeVendor(modelVendor);
  return (FIRST_PARTY[vendor] ?? []).includes(offer.providerId) ? 'diretto' : 'rivenditore';
}

/** True when the offer can be used without signing up with a third party. */
export const isReadyToUse = (u: Usability): boolean => u !== 'rivenditore';

/**
 * With whom you actually open the account. For a routed offer that is the
 * broker, not the company running the hardware behind it: saying "account
 * GMICloud" for an OpenRouter route would send the reader to the wrong site.
 */
export const accountName = (offer: Offer): string =>
  offer.access === 'intermediary' && offer.broker ? offer.broker : offer.providerName;

export const usabilityLabel = (u: Usability, offer: Offer): string => {
  if (u === 'hub') return `account OpenRouter, instradato su ${offer.providerName}`;
  if (u === 'diretto') return `account ${offer.providerName}, direttamente da chi fa il modello`;
  return `account ${offer.providerName}`;
};
