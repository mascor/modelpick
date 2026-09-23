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
  /** Availability over the last day, when the source publishes it. */
  uptime1d?: number | null;
  /**
   * A provider OpenCode does not ship with, added by the configuration we
   * publish (OpenAI-compatible API, from models.dev): the offer is usable only
   * with that file.
   */
  customProvider?: { id: string; name: string; npm: string; baseURL: string; env: string } | null;
  throughputTps: number | null;
  latencyS: number | null;
  /** ISO-3166 alpha-2 codes, or 'global', or null when unknown. */
  regions: string[] | 'global' | null;
  dataPolicy: DataPolicy;
  /** Model id as this provider spells it, needed to write a working config. */
  remoteModelId: string | null;
  /** Environment variable the provider's SDK reads its key from. */
  apiKeyEnv: string | null;
  /** The provider's own documentation, used to send the reader to the key page. */
  providerDocUrl: string | null;
  /** Slug the broker uses to route to this provider, when it can be pinned. */
  routingSlug: string | null;
  /** The provider/model string OpenCode addresses this offer with. */
  opencodeId?: string | null;
  /** True when OpenCode actually accepts that id. Unverified offers are never recommended. */
  opencodeVerified?: boolean;
  /** Who the provider is, from a curated directory. Null when no directory lists it. */
  profile?: { siteUrl: string | null; hqCountry: string | null; gdpr: boolean | null; directoryUrl: string | null } | null;
  sourceId: string;
  sourceUrl: string;
  observedAt: Iso;
  /** Demo rows are excluded from public recommendations. */
  demo: boolean;
  /** Set when validation distrusts this row; quarantined offers cannot win. */
  quarantine?: string | null;
  /** Set when the provider is suspended: the price may be real, the account is not obtainable. */
  blockedReason?: string | null;
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

export type QualityMetric = 'aa_coding_index' | 'swebench_verified' | 'aider_polyglot';

/**
 * A measured coding result. `harnessKey` groups runs that are comparable with
 * each other; scores from different harness keys are never compared.
 */
export interface QualityEvidence {
  modelKey: string;
  metric: QualityMetric;
  /** Score as published: percentage of tasks solved, or index points for Artificial Analysis. */
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
  /** USD per task on Artificial Analysis' own runs of this variant, when published. */
  costPerTask?: number | null;
  /** Artificial Analysis Intelligence Index of this variant, when published. */
  intelligenceIndex?: number | null;
  /**
   * Set when the model has no Coding Index yet and carries the one measured on
   * the version it follows: a provisional score, shown as such.
   */
  inheritedFrom?: { modelKey: string; harness: string } | null;
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

export interface ProviderProfile {
  key: string;
  name: string;
  siteUrl: string | null;
  hqCountry: string | null;
  gdpr: boolean | null;
  directoryUrl: string | null;
  updatedAt: Iso | null;
}

/** A retired model whose newer version is on sale but not yet measured on code. */
export interface Replacement {
  retiredKey: string;
  retiredName: string;
  /** The retired model's last score, to know whether it would have competed. */
  retiredScore: number;
  retiredMetric: QualityEvidence['metric'];
  successorKey: string;
  successorName: string;
}

/** What people who code with OpenCode keep using (opencode.ai/data). */
export interface UsageSignal {
  modelKey: string;
  /** The model as OpenCode names it. */
  name: string;
  /** Share of user-weeks followed by another week of use, 0-100. */
  retentionRate: number;
  eligibleUserWeeks: number;
  /** Mean cost of a session, USD, when published. */
  sessionCostUsd: number | null;
  observedAt: Iso;
}

export interface Snapshot {
  version: 1;
  runId: string;
  generatedAt: Iso;
  models: Record<string, ModelRecord>;
  /** Who the providers are, keyed by normalised name. */
  providers?: Record<string, ProviderProfile>;
  offers: Offer[];
  evidence: QualityEvidence[];
  sources: SourceStatus[];
  warnings: string[];
  /** Which OpenCode version the commands were verified against. */
  opencodeVersion?: string | null;
  replacements?: Replacement[];
  usage?: UsageSignal[];
  stats: {
    modelCount: number;
    offerCount: number;
    evidenceCount: number;
    sourcesOk: number;
    sourcesFailed: number;
  };
}
