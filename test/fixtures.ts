import type { ModelRecord, Offer, QualityEvidence, Snapshot } from '../src/types.js';

// Relative to the real clock: the engine judges freshness against Date.now().
export const now = new Date(Date.now() - 3_600_000);

export const offer = (over: Partial<Offer> & Pick<Offer, 'id' | 'modelKey' | 'providerId'>): Offer => ({
  providerName: over.providerId,
  access: 'direct',
  broker: null,
  prices: { inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1.25 },
  currency: 'USD',
  fees: [],
  contextTokens: 400_000,
  maxOutputTokens: 64_000,
  supportsTools: true,
  quantization: null,
  uptime30m: 99,
  throughputTps: null,
  latencyS: null,
  regions: null,
  dataPolicy: { trainsOnData: null, zeroRetention: null, note: null },
  promo: null,
  remoteModelId: over.modelKey.split('/')[1] ?? over.modelKey,
  apiKeyEnv: 'TEST_API_KEY',
  providerDocUrl: 'https://example.test/docs',
  routingSlug: null,
  sourceId: 'test',
  sourceUrl: 'https://example.test/offer',
  observedAt: now.toISOString(),
  demo: false,
  quarantine: null,
  ...over,
});

export const model = (key: string, over: Partial<ModelRecord> = {}): ModelRecord => ({
  key,
  displayName: key,
  vendor: key.split('/')[0]!,
  family: null,
  releaseDate: null,
  contextTokens: 400_000,
  maxOutputTokens: 64_000,
  toolCall: true,
  reasoning: true,
  openWeights: false,
  aliases: [],
  sourceIds: ['test'],
  officialUrl: 'https://example.test/model',
  ...over,
});

export const evidence = (modelKey: string, value: number, over: Partial<QualityEvidence> = {}): QualityEvidence => ({
  modelKey,
  metric: 'swebench_verified',
  value,
  harness: 'mini-SWE-agent 2.4.2',
  harnessKey: 'ref',
  attempts: 1,
  instanceCalls: 30,
  reasoningEffort: 'medium',
  measuredAt: now.toISOString(),
  sourceId: 'swebench',
  sourceUrl: 'https://example.test/run',
  observedAt: now.toISOString(),
  ...over,
});

export const snapshot = (models: ModelRecord[], offers: Offer[], ev: QualityEvidence[], extra: Partial<Snapshot> = {}): Snapshot => ({
  version: 1,
  runId: 'test-run',
  generatedAt: now.toISOString(),
  models: Object.fromEntries(models.map((m) => [m.key, m])),
  offers,
  evidence: ev,
  sources: [],
  warnings: [],
  stats: { modelCount: models.length, offerCount: offers.length, evidenceCount: ev.length, sourcesOk: 1, sourcesFailed: 0 },
  ...extra,
});
