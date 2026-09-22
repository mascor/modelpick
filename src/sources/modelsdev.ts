/**
 * Models.dev: open catalogue of providers, models and first-party prices.
 * Gives us what OpenRouter cannot: the price of buying straight from the
 * provider's own API, plus declared capabilities (tools, context, reasoning).
 */
import { fetchJson } from '../lib/http.js';
import { asPerMillion, canonicalKey, matchForm, normalizeSlug } from '../lib/normalize.js';
import type { ModelRecord, Offer } from '../types.js';

const API = 'https://models.dev/api.json';

/** Providers that resell someone else's inference rather than serving their own. */
const BROKERS = new Set([
  'openrouter', 'requesty', 'orcarouter', 'nano-gpt', 'nanogpt', 'poe', 'opencode',
  'vercel', 'aihubmix', 'chutes', 'novità', 'kilocode', 'llmgateway', 'anannas',
]);

/** Model-id prefix -> owning vendor, used when a model is new to us. */
const VENDOR_BY_PREFIX: [RegExp, string][] = [
  [/^claude/, 'anthropic'],
  [/^(gpt|o[1-9]|codex|davinci|chatgpt)/, 'openai'],
  [/^(gemini|gemma)/, 'google'],
  [/^deepseek/, 'deepseek'],
  [/^(qwen|qwq)/, 'qwen'],
  [/^kimi/, 'moonshot'],
  [/^glm/, 'z-ai'],
  [/^grok/, 'x-ai'],
  [/^llama/, 'meta-llama'],
  [/^(mistral|magistral|devstral|codestral|ministral|pixtral)/, 'mistralai'],
  [/^minimax/, 'minimax'],
  [/^command/, 'cohere'],
  [/^nova/, 'amazon'],
  [/^phi/, 'microsoft'],
];

const guessVendor = (modelId: string, providerId: string): string => {
  const slug = normalizeSlug(modelId);
  for (const [re, vendor] of VENDOR_BY_PREFIX) if (re.test(slug)) return vendor;
  return providerId;
};

interface MdModel {
  id: string;
  name?: string;
  family?: string;
  release_date?: string;
  last_updated?: string;
  tool_call?: boolean;
  reasoning?: boolean;
  open_weights?: boolean;
  knowledge?: string;
  modalities?: { input?: string[]; output?: string[] };
  limit?: { context?: number; output?: number };
  cost?: { input?: number; output?: number; cache_read?: number; cache_write?: number };
}

interface MdProvider {
  id: string;
  name?: string;
  doc?: string;
  env?: string[];
  npm?: string;
  models?: Record<string, MdModel>;
}

export interface ModelsDevResult {
  models: ModelRecord[];
  offers: Offer[];
  /** provider id -> display name, for the sources page. */
  providers: Map<string, string>;
}

/**
 * @param knownKeys canonical keys already discovered elsewhere, indexed by
 *        comparison form, so the same model does not appear twice under two ids.
 */
export async function fetchModelsDev(observedAt: string, knownKeys: Map<string, string>): Promise<ModelsDevResult> {
  const body = await fetchJson<Record<string, MdProvider>>(API);
  const models = new Map<string, ModelRecord>();
  const offers: Offer[] = [];
  const providers = new Map<string, string>();

  for (const [providerId, provider] of Object.entries(body)) {
    providers.set(providerId, provider.name ?? providerId);
    for (const [modelId, model] of Object.entries(provider.models ?? {})) {
      const vendor = guessVendor(modelId, providerId);
      const fallbackKey = canonicalKey(vendor, modelId);
      const key = knownKeys.get(matchForm(modelId)) ?? fallbackKey;

      if (!models.has(key)) {
        models.set(key, {
          key,
          displayName: model.name ?? modelId,
          vendor,
          family: model.family ?? null,
          releaseDate: model.release_date ?? null,
          contextTokens: model.limit?.context ?? null,
          maxOutputTokens: model.limit?.output ?? null,
          toolCall: model.tool_call ?? null,
          reasoning: model.reasoning ?? null,
          openWeights: model.open_weights ?? null,
          aliases: [modelId],
          sourceIds: ['modelsdev'],
          officialUrl: provider.doc ?? null,
        });
      }

      const cost = model.cost;
      // No price block at all means "not sold here", not "free".
      if (!cost || (cost.input === undefined && cost.output === undefined)) continue;

      const isBroker = BROKERS.has(providerId);
      offers.push({
        // The provider's own model id keeps the id unique even when two model
        // variants resolve to the same canonical key.
        id: `modelsdev:${providerId}:${modelId}`,
        modelKey: key,
        providerId,
        providerName: provider.name ?? providerId,
        access: isBroker ? 'intermediary' : 'direct',
        broker: isBroker ? (provider.name ?? providerId) : null,
        prices: {
          inputPerMTok: asPerMillion(cost.input),
          outputPerMTok: asPerMillion(cost.output),
          cacheReadPerMTok: asPerMillion(cost.cache_read),
          cacheWritePerMTok: asPerMillion(cost.cache_write),
        },
        currency: 'USD',
        fees: [],
        contextTokens: model.limit?.context ?? null,
        maxOutputTokens: model.limit?.output ?? null,
        supportsTools: model.tool_call ?? null,
        quantization: null,
        uptime30m: null,
        throughputTps: null,
        latencyS: null,
        regions: null,
        dataPolicy: { trainsOnData: null, zeroRetention: null, note: null },
        promo: null,
        remoteModelId: modelId,
        apiKeyEnv: provider.env?.[0] ?? null,
        providerDocUrl: provider.doc ?? null,
        sourceId: 'modelsdev',
        sourceUrl: `https://models.dev/#${providerId}`,
        observedAt,
        demo: false,
      });
    }
  }

  return { models: [...models.values()], offers, providers };
}
