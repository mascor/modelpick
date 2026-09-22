/**
 * Where to go to get a key. "export QIHANG_API_KEY" tells nobody where to
 * register, so every provider carries a link.
 *
 * The curated entries point straight at the page where the key is created and
 * were checked by hand; everything else falls back to the provider's own
 * documentation URL, which comes from the source data.
 */
import type { Offer } from '../types.js';

/** Provider id -> page where you create the API key. Verified manually. */
const KEY_PAGE: Record<string, string> = {
  openrouter: 'https://openrouter.ai/keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
  google: 'https://aistudio.google.com/apikey',
  deepseek: 'https://platform.deepseek.com/api_keys',
};

/**
 * For a routed offer the account belongs to the broker, not to the company
 * running the model, so the link must point at the broker.
 */
export function signupUrl(offer: Offer): string | null {
  if (offer.access === 'intermediary') {
    const broker = (offer.broker ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    return KEY_PAGE[broker] ?? null;
  }
  return KEY_PAGE[offer.providerId] ?? offer.profile?.siteUrl ?? offer.providerDocUrl ?? null;
}
