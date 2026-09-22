/**
 * OpenRouter: public, unauthenticated JSON API.
 * - /models        -> model catalogue (context, tool support, naming)
 * - /models/:id/endpoints -> one row per provider actually serving that model
 *
 * We deliberately ignore the aggregate price in /models: it describes whatever
 * provider the router happens to pick, which is not a thing you can buy on
 * purpose. Only per-endpoint rows become offers.
 */
import { fetchJson, pooled } from '../lib/http.js';
import { keyFromPath, perMillion } from '../lib/normalize.js';
import type { Fee, ModelRecord, Offer } from '../types.js';

const BASE = 'https://openrouter.ai/api/v1';

/**
 * OpenRouter passes provider pricing through without markup but charges a fee
 * when you buy credits. The amount is rendered client-side on their FAQ, so it
 * is not machine-verifiable: we carry it as an unquantified fee (surfaced in
 * the UI) unless a maintainer pins a verified percentage via env.
 */
const CREDIT_FEE_PERCENT = process.env.OPENROUTER_CREDIT_FEE_PERCENT
  ? Number(process.env.OPENROUTER_CREDIT_FEE_PERCENT)
  : undefined;
const CREDIT_FEE_URL = 'https://openrouter.ai/docs/faq';

/**
 * The fee belongs to the seller, not to the source that described the offer:
 * buying through OpenRouter costs the same whether models.dev or OpenRouter's
 * own API told us the per-token price. Both connectors use this.
 */
export const openRouterCreditFee = (): Fee => ({
  kind: 'credit_fee',
  ...(CREDIT_FEE_PERCENT !== undefined && Number.isFinite(CREDIT_FEE_PERCENT) ? { percent: CREDIT_FEE_PERCENT } : {}),
  note: 'OPENROUTER_CREDIT_FEE',
  sourceUrl: CREDIT_FEE_URL,
});

interface OrModel {
  id: string;
  canonical_slug?: string | null;
  name: string;
  created?: number;
  context_length?: number | null;
  architecture?: { output_modalities?: string[]; input_modalities?: string[] };
  top_provider?: { context_length?: number | null; max_completion_tokens?: number | null };
  supported_parameters?: string[];
  /** Set when the model is scheduled for retirement. */
  expiration_date?: string | null;
}

interface OrEndpoint {
  name: string;
  provider_name: string;
  tag?: string | null;
  context_length?: number | null;
  max_completion_tokens?: number | null;
  quantization?: string | null;
  status?: number | null;
  uptime_last_30m?: number | null;
  throughput_last_30m?: number | null;
  latency_last_30m?: number | null;
  supported_parameters?: string[];
  pricing?: Record<string, string | number | null>;
}

export interface OpenRouterCatalogue {
  models: ModelRecord[];
  /** Model keys that accept tools and emit text: the only ones a coding agent can drive. */
  agentCapableKeys: string[];
  /** canonical key -> OpenRouter path, needed to ask for its endpoints. */
  pathByKey: Map<string, string>;
  /** Models with a retirement date: deprecated, even before the date. */
  deprecated: string[];
}

export async function fetchCatalogue(observedAt: string): Promise<OpenRouterCatalogue> {
  const body = await fetchJson<{ data: OrModel[] }>(`${BASE}/models`);
  const models: ModelRecord[] = [];
  const agentCapableKeys: string[] = [];
  const pathByKey = new Map<string, string>();
  const deprecated: string[] = [];

  for (const m of body.data ?? []) {
    const { key, floating } = keyFromPath(m.id);
    // Floating aliases (~vendor/model-latest) point at a moving target: they are
    // not a stable thing to recommend.
    if (floating) continue;

    const tools = (m.supported_parameters ?? []).includes('tools');
    const textOut = (m.architecture?.output_modalities ?? ['text']).includes('text');
    const slash = key.indexOf('/');
    models.push({
      key,
      displayName: m.name,
      vendor: key.slice(0, slash),
      family: null,
      releaseDate: m.created ? new Date(m.created * 1000).toISOString() : null,
      contextTokens: m.context_length ?? m.top_provider?.context_length ?? null,
      maxOutputTokens: m.top_provider?.max_completion_tokens ?? null,
      toolCall: tools,
      reasoning: (m.supported_parameters ?? []).includes('reasoning'),
      openWeights: null,
      aliases: [m.id, m.canonical_slug ?? ''].filter(Boolean),
      sourceIds: ['openrouter'],
      officialUrl: `https://openrouter.ai/${m.id}`,
    });
    pathByKey.set(key, m.id);
    if (m.expiration_date) deprecated.push(key);
    if (tools && textOut) agentCapableKeys.push(key);
  }
  void observedAt;
  return { models, agentCapableKeys, pathByKey, deprecated };
}

/**
 * One offer per provider endpoint. Quantizations are kept apart: an fp8 route
 * and a bf16 route of the same model are different products.
 */
export async function fetchOffers(
  keys: string[],
  pathByKey: Map<string, string>,
  observedAt: string,
): Promise<{ offers: Offer[]; failures: string[] }> {
  const wanted = keys.filter((k) => pathByKey.has(k));
  const offers: Offer[] = [];
  const failures: string[] = [];

  const results = await pooled(wanted, async (key) => {
    const path = pathByKey.get(key)!;
    const body = await fetchJson<{ data?: { endpoints?: OrEndpoint[] } }>(
      `${BASE}/models/${path}/endpoints`,
    );
    return { key, path, endpoints: body.data?.endpoints ?? [] };
  });

  for (const [i, r] of results.entries()) {
    const key = wanted[i]!;
    if (r.status === 'rejected') {
      failures.push(`${key}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
      continue;
    }
    for (const ep of r.value.endpoints) {
      const p = ep.pricing ?? {};
      const providerId = ep.provider_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      offers.push({
        id: `openrouter:${r.value.path}:${providerId}:${ep.tag ?? 'default'}`,
        modelKey: key,
        providerId,
        providerName: ep.provider_name,
        access: 'intermediary',
        broker: 'OpenRouter',
        prices: {
          inputPerMTok: perMillion(p['prompt']),
          outputPerMTok: perMillion(p['completion']),
          cacheReadPerMTok: perMillion(p['input_cache_read']),
          cacheWritePerMTok: perMillion(p['input_cache_write']),
        },
        currency: 'USD',
        fees: [openRouterCreditFee()],
        contextTokens: ep.context_length ?? null,
        maxOutputTokens: ep.max_completion_tokens ?? null,
        supportsTools: (ep.supported_parameters ?? []).includes('tools'),
        quantization: ep.quantization ?? null,
        uptime30m: ep.uptime_last_30m ?? null,
        throughputTps: ep.throughput_last_30m ?? null,
        latencyS: ep.latency_last_30m ?? null,
        regions: null,
        dataPolicy: { trainsOnData: null, zeroRetention: null, note: null },
        remoteModelId: r.value.path,
        apiKeyEnv: 'OPENROUTER_API_KEY',
        providerDocUrl: null,
        // "gmicloud/fp8" -> "gmicloud": the slug OpenRouter accepts in
        // provider.order, without which the request is routed elsewhere.
        routingSlug: ep.tag ? ep.tag.split('/')[0]! : null,
        sourceId: 'openrouter',
        sourceUrl: `https://openrouter.ai/${r.value.path}/providers`,
        observedAt,
        demo: false,
      });
    }
  }
  return { offers, failures };
}
