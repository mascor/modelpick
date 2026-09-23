/**
 * Models.dev: open catalogue of providers, models and first-party prices.
 * Gives us what OpenRouter cannot: the price of buying straight from the
 * provider's own API, plus declared capabilities (tools, context, reasoning).
 */
import { openRouterCreditFee } from './openrouter.js';
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

/**
 * Several resellers key their models as "vendor/model" (for example
 * "anthropic/claude-sonnet-4-5" sold by a reseller). Taking the reseller as the
 * vendor created a phantom duplicate of a model we already knew, which then
 * competed in the ranking as if it were a different product.
 */
const splitVendor = (modelId: string): { vendor: string | null; slug: string } => {
  const slash = modelId.indexOf('/');
  if (slash <= 0) return { vendor: null, slug: modelId };
  return { vendor: modelId.slice(0, slash), slug: modelId.slice(slash + 1) };
};

const guessVendor = (modelId: string, providerId: string): string => {
  const { vendor, slug: bare } = splitVendor(modelId);
  if (vendor) return vendor;
  const slug = normalizeSlug(bare);
  for (const [re, v] of VENDOR_BY_PREFIX) if (re.test(slug)) return v;
  return providerId;
};

interface MdModel {
  id: string;
  name?: string;
  family?: string;
  release_date?: string;
  last_updated?: string;
  /** 'deprecated' or 'beta' when the seller says so. */
  status?: string;
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
  /** Base URL of an OpenAI-compatible API. */
  api?: string;
  models?: Record<string, MdModel>;
}

/**
 * Providers OpenCode does not ship with that we add through the published
 * configuration, one by one on request: each needs an OpenAI-compatible API
 * whose address, client and key name models.dev states.
 */
const CUSTOM_PROVIDERS = new Set(['siliconflow']);

export interface ModelsDevResult {
  models: ModelRecord[];
  offers: Offer[];
  /** provider id -> display name, for the sources page. */
  providers: Map<string, string>;
  /** Models their own maker lists as deprecated. */
  deprecated: string[];
  /** Offers left out because the seller lists them as deprecated. */
  deprecatedOffers: number;
}

/**
 * Providers that are the maker of the models they list, by the vendor part of
 * our keys: when one of them marks a model deprecated, the model is retired.
 */
const MAKERS: Record<string, string> = {
  deepseek: 'deepseek',
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  mistral: 'mistralai',
  xai: 'x-ai',
  alibaba: 'qwen',
  moonshotai: 'moonshot',
  zai: 'z-ai',
  minimax: 'minimax',
};

/**
 * @param knownKeys canonical keys already discovered elsewhere, indexed by
 *        comparison form, so the same model does not appear twice under two ids.
 */
export async function fetchModelsDev(observedAt: string, knownKeys: Map<string, string>): Promise<ModelsDevResult> {
  const body = await fetchJson<Record<string, MdProvider>>(API);
  const models = new Map<string, ModelRecord>();
  const offers: Offer[] = [];
  const providers = new Map<string, string>();
  const deprecated = new Set<string>();
  let deprecatedOffers = 0;

  for (const [providerId, provider] of Object.entries(body)) {
    providers.set(providerId, provider.name ?? providerId);
    for (const [modelId, model] of Object.entries(provider.models ?? {})) {
      const vendor = guessVendor(modelId, providerId);
      const { slug: bareSlug } = splitVendor(modelId);
      const fallbackKey = canonicalKey(vendor, bareSlug);
      // The maker's own id can differ from everyone else's ("deepseek-flash" is
      // DeepSeek V4.1 Flash): the published name is the second way to find it.
      const key =
        knownKeys.get(matchForm(bareSlug)) ??
        (model.name ? knownKeys.get(matchForm(`${vendor} ${model.name}`)) : undefined) ??
        fallbackKey;
      if (model.status === 'deprecated' && MAKERS[providerId] === key.slice(0, key.indexOf('/'))) deprecated.add(key);

      // Every seller's id for the model is a spelling other sources may use.
      const seen = models.get(key);
      if (seen && !seen.aliases.includes(modelId)) seen.aliases.push(modelId);
      if (!seen) {
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
      if (model.status === 'deprecated') {
        deprecatedOffers++;
        continue;
      }

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
        // Same seller, same purchase conditions: buying through OpenRouter carries
        // its credit fee whichever source described the price.
        fees: providerId === 'openrouter' ? [openRouterCreditFee()] : [],
        contextTokens: model.limit?.context ?? null,
        maxOutputTokens: model.limit?.output ?? null,
        supportsTools: model.tool_call ?? null,
        quantization: null,
        uptime30m: null,
        throughputTps: null,
        latencyS: null,
        regions: null,
        dataPolicy: { trainsOnData: null, zeroRetention: null, note: null },
        remoteModelId: modelId,
        customProvider:
          CUSTOM_PROVIDERS.has(providerId) && provider.api && provider.npm === '@ai-sdk/openai-compatible' && provider.env?.[0]
            ? { id: providerId, name: provider.name ?? providerId, npm: provider.npm, baseURL: provider.api, env: provider.env[0] }
            : null,
        apiKeyEnv: provider.env?.[0] ?? null,
        providerDocUrl: provider.doc ?? null,
        routingSlug: null,
        sourceId: 'modelsdev',
        sourceUrl: `https://models.dev/#${providerId}`,
        observedAt,
        demo: false,
      });
    }
  }

  return { models: [...models.values()], offers, providers, deprecated: [...deprecated], deprecatedOffers };
}
