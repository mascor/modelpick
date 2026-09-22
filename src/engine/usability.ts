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
  | 'hub'            // one account, almost every model: OpenRouter
  | 'diretto'        // the company that makes the model, sold by itself
  | 'rivenditore'    // a third party we can identify in a curated directory
  | 'sconosciuto';   // a third party no directory we read lists at all

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

/**
 * @param known normalised names of providers listed in a curated directory.
 *        A reseller absent from every directory we read is one we cannot
 *        describe to the reader beyond its price, which is not enough to
 *        recommend it.
 */
export function usabilityOf(offer: Offer, modelVendor: string, known?: Set<string>): Usability {
  if (offer.sourceId === 'openrouter' || offer.providerId === 'openrouter') return 'hub';
  const vendor = normalizeVendor(modelVendor);
  if ((FIRST_PARTY[vendor] ?? []).includes(offer.providerId)) return 'diretto';
  if (!known) return 'rivenditore';
  return known.has(providerKey(offer.providerName)) ? 'rivenditore' : 'sconosciuto';
}

/** "GMI Cloud" and "GMICloud" are the same company written by two sources. */
export const providerKey = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Whether we can tell the reader who this company is. */
export const isIdentified = (u: Usability): boolean => u !== 'sconosciuto';

/**
 * With whom you actually open the account. For a routed offer that is the
 * broker, not the company running the hardware behind it: saying "account
 * GMICloud" for an OpenRouter route would send the reader to the wrong site.
 */
export const accountName = (offer: Offer): string =>
  offer.access === 'intermediary' && offer.broker ? offer.broker : offer.providerName;

export const usabilityLabel = (u: Usability, offer: Offer): string => {
  if (u === 'hub') return 'via OpenRouter';
  if (u === 'diretto') return 'diretto';
  if (u === 'sconosciuto') return 'provider non identificato';
  return `account ${offer.providerName}`;
};
