/** Shared domain types. All prices are USD per 1,000,000 tokens unless stated. */

export type Iso = string;

export interface PriceSet {
  /** USD per 1M input tokens. null = unknown (never coerce to 0). */
  inputPerMTok: number | null;
  outputPerMTok: number | null;
  cacheReadPerMTok: number | null;
  cacheWritePerMTok: number | null;
}

export type FeeKind =
  | 'platform_fee'      // percentage taken on top of token spend
  | 'credit_fee'        // fee applied when buying credits
  | 'minimum_topup'     // smallest purchase accepted
  | 'subscription';     // mandatory recurring cost

export interface Fee {
  kind: FeeKind;
  /** Percentage points, e.g. 5 = +5%. */
  percent?: number;
  /** Fixed USD amount (per top-up or per month). */
  amountUsd?: number;
  note: string;
  sourceUrl: string;
}

export type Access = 'direct' | 'intermediary';

export interface DataPolicy {
  /** true = provider may train on prompts. null = unknown. */
  trainsOnData: boolean | null;
  /** Zero data retention available. */
  zeroRetention: boolean | null;
  note: string | null;
}

export interface Promo {
  description: string;
  endsAt: Iso | null;
  sourceUrl: string;
}

/** One buyable combination of model + provider + route. */
export interface Offer {
  id: string;
  modelKey: string;
  providerId: string;
  providerName: string;
  access: Access;
  /** Set when access === 'intermediary' (e.g. "openrouter"). */
  broker: string | null;
  prices: PriceSet;
  currency: 'USD';
  fees: Fee[];
  contextTokens: number | null;
  maxOutputTokens: number | null;
  supportsTools: boolean | null;
  /** Weight precision actually served; different quantizations are NOT the same offer. */
  quantization: string | null;
  uptime30m: number | null;
  throughputTps: number | null;
  latencyS: number | null;
  /** ISO-3166 alpha-2 codes, or 'global', or null when unknown. */
  regions: string[] | 'global' | null;
  dataPolicy: DataPolicy;
  promo: Promo | null;
  /** Model id as this provider spells it, needed to write a working config. */
  remoteModelId: string | null;
  /** Environment variable the provider's SDK reads its key from. */
  apiKeyEnv: string | null;
  sourceId: string;
  sourceUrl: string;
  observedAt: Iso;
  /** Demo rows are excluded from public recommendations. */
  demo: boolean;
  /** Set when validation distrusts this row; quarantined offers cannot win. */
  quarantine?: string | null;
}

export interface ModelRecord {
  /** Canonical key, e.g. "anthropic/claude-sonnet-5". */
  key: string;
  displayName: string;
  vendor: string;
  family: string | null;
  releaseDate: Iso | null;
  contextTokens: number | null;
  maxOutputTokens: number | null;
  toolCall: boolean | null;
  reasoning: boolean | null;
  openWeights: boolean | null;
  /** Foreign ids seen in the wild that resolve to this key. */
  aliases: string[];
  sourceIds: string[];
  officialUrl: string | null;
}

export type QualityMetric = 'swebench_verified' | 'aider_polyglot';

/**
 * A measured coding result. `harnessKey` groups runs that are comparable with
 * each other; scores from different harness keys are never compared.
 */
export interface QualityEvidence {
  modelKey: string;
  metric: QualityMetric;
  /** Percentage of tasks solved (0-100). */
  value: number;
  harness: string;
  harnessKey: string;
  attempts: number | null;
  /** Mean model calls per task: a proxy for work done per solved task. */
  instanceCalls: number | null;
  reasoningEffort: string | null;
  measuredAt: Iso | null;
  sourceId: string;
  sourceUrl: string;
  observedAt: Iso;
}

export type SourceOutcome = 'ok' | 'failed' | 'disabled' | 'skipped';

export interface SourceStatus {
  id: string;
  name: string;
  url: string;
  outcome: SourceOutcome;
  /** Why a source is disabled, e.g. pending terms-of-use review. */
  note: string | null;
  licence: string;
  attribution: string;
  startedAt: Iso | null;
  finishedAt: Iso | null;
  durationMs: number | null;
  itemCount: number;
  error: string | null;
  /** True when this run reused cached data instead of fresh data. */
  servedFromCache: boolean;
  /** Age in hours of the data actually used. */
  dataAgeHours: number | null;
}

export interface Snapshot {
  version: 1;
  runId: string;
  generatedAt: Iso;
  models: Record<string, ModelRecord>;
  offers: Offer[];
  evidence: QualityEvidence[];
  sources: SourceStatus[];
  warnings: string[];
  stats: {
    modelCount: number;
    offerCount: number;
    evidenceCount: number;
    sourcesOk: number;
    sourcesFailed: number;
  };
}
