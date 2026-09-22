/**
 * Collection stage. Each source is isolated: one failing source degrades that
 * slice of the data (falling back to the last good values, with their age made
 * explicit) instead of failing the whole update.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PATHS, SOURCES, sourceById } from '../config.js';
import { matchForm, hoursSince } from '../lib/normalize.js';
import type { ModelRecord, Offer, QualityEvidence, Snapshot, SourceStatus } from '../types.js';
import { fetchCatalogue, fetchOffers } from '../sources/openrouter.js';
import { fetchModelsDev } from '../sources/modelsdev.js';
import { fetchSweBench } from '../sources/swebench.js';
import { fetchAider } from '../sources/aider.js';
import { pendingStatus } from '../sources/pending.js';

export interface Collected {
  models: Map<string, ModelRecord>;
  offers: Offer[];
  evidence: QualityEvidence[];
  statuses: SourceStatus[];
  warnings: string[];
}

const baseStatus = (id: string): SourceStatus => {
  const cfg = sourceById(id)!;
  return {
    id: cfg.id,
    name: cfg.name,
    url: cfg.url,
    outcome: 'ok',
    note: cfg.note,
    licence: cfg.licence,
    attribution: cfg.attribution,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationMs: null,
    itemCount: 0,
    error: null,
    servedFromCache: false,
    dataAgeHours: null,
  };
};

const finish = (s: SourceStatus, count: number): SourceStatus => ({
  ...s,
  outcome: 'ok',
  finishedAt: new Date().toISOString(),
  durationMs: Date.now() - Date.parse(s.startedAt!),
  itemCount: count,
});

/** Reuse of the previous run's rows when a source is down, with their real age. */
const fallback = (s: SourceStatus, err: unknown, count: number, ageHours: number | null): SourceStatus => ({
  ...s,
  outcome: 'failed',
  finishedAt: new Date().toISOString(),
  durationMs: Date.now() - Date.parse(s.startedAt!),
  itemCount: count,
  error: err instanceof Error ? err.message : String(err),
  servedFromCache: count > 0,
  dataAgeHours: ageHours,
});

const mergeModel = (into: Map<string, ModelRecord>, m: ModelRecord) => {
  const existing = into.get(m.key);
  if (!existing) {
    into.set(m.key, m);
    return;
  }
  into.set(m.key, {
    ...existing,
    // Prefer any known value over a null one; keep the first non-null.
    family: existing.family ?? m.family,
    releaseDate: existing.releaseDate ?? m.releaseDate,
    contextTokens: existing.contextTokens ?? m.contextTokens,
    maxOutputTokens: existing.maxOutputTokens ?? m.maxOutputTokens,
    toolCall: existing.toolCall ?? m.toolCall,
    reasoning: existing.reasoning ?? m.reasoning,
    openWeights: existing.openWeights ?? m.openWeights,
    officialUrl: existing.officialUrl ?? m.officialUrl,
    aliases: [...new Set([...existing.aliases, ...m.aliases])],
    sourceIds: [...new Set([...existing.sourceIds, ...m.sourceIds])],
  });
};

export async function collect(previous: Snapshot | null, observedAt: string): Promise<Collected> {
  const models = new Map<string, ModelRecord>();
  const offers: Offer[] = [];
  const evidence: QualityEvidence[] = [];
  const statuses: SourceStatus[] = [];
  const warnings: string[] = [];

  const enabled = new Set(SOURCES.filter((s) => s.enabled).map((s) => s.id));
  for (const cfg of SOURCES) if (!cfg.enabled) statuses.push(pendingStatus(cfg.id));

  const prevOffersBySource = (id: string) => (previous?.offers ?? []).filter((o) => o.sourceId === id);
  const prevEvidenceBySource = (id: string) => (previous?.evidence ?? []).filter((e) => e.sourceId === id);
  const ageOf = (rows: { observedAt: string }[]) => (rows.length ? hoursSince(rows[0]!.observedAt) : null);

  // 1. OpenRouter catalogue first: it gives the naming everyone else is matched against.
  let pathByKey = new Map<string, string>();
  let agentCapableKeys: string[] = [];
  if (enabled.has('openrouter')) {
    const st = baseStatus('openrouter');
    try {
      const cat = await fetchCatalogue(observedAt);
      for (const m of cat.models) mergeModel(models, m);
      pathByKey = cat.pathByKey;
      agentCapableKeys = cat.agentCapableKeys;
      statuses.push(finish(st, cat.models.length));
    } catch (err) {
      const rows = prevOffersBySource('openrouter');
      offers.push(...rows);
      for (const m of Object.values(previous?.models ?? {})) mergeModel(models, m);
      statuses.push(fallback(st, err, rows.length, ageOf(rows)));
      warnings.push(`OpenRouter non raggiungibile: uso i dati dell\'ultimo aggiornamento riuscito.`);
    }
  }

  /** Comparison index: any foreign spelling of a model resolves to our key. */
  const knownKeys = new Map<string, string>();
  const indexModel = (m: ModelRecord) => {
    const slug = m.key.slice(m.key.indexOf('/') + 1);
    for (const form of [matchForm(slug), matchForm(m.displayName), ...m.aliases.map(matchForm)]) {
      if (form && !knownKeys.has(form)) knownKeys.set(form, m.key);
    }
  };
  for (const m of models.values()) indexModel(m);

  // Hand-curated corrections win over automatic matching: they exist precisely
  // because the automatic rule got something wrong.
  try {
    const file = JSON.parse(await readFile(join(PATHS.curated, 'aliases.json'), 'utf8')) as {
      alias?: Record<string, string>;
    };
    for (const [foreign, key] of Object.entries(file.alias ?? {})) {
      if (models.has(key)) knownKeys.set(matchForm(foreign), key);
      else warnings.push(`Alias manuale ignorato: "${foreign}" punta a un modello sconosciuto (${key}).`);
    }
  } catch {
    // The file is optional.
  }

  // 2. Direct provider prices and declared capabilities.
  if (enabled.has('modelsdev')) {
    const st = baseStatus('modelsdev');
    try {
      const res = await fetchModelsDev(observedAt, knownKeys);
      for (const m of res.models) {
        mergeModel(models, m);
        indexModel(m);
      }
      offers.push(...res.offers);
      statuses.push(finish(st, res.offers.length));
    } catch (err) {
      const rows = prevOffersBySource('modelsdev');
      offers.push(...rows);
      statuses.push(fallback(st, err, rows.length, ageOf(rows)));
      warnings.push('Models.dev non raggiungibile: prezzi diretti dall\'ultimo aggiornamento riuscito.');
    }
  }

  // 3. Quality evidence.
  if (enabled.has('swebench')) {
    const st = baseStatus('swebench');
    try {
      const res = await fetchSweBench(observedAt, knownKeys);
      evidence.push(...res.evidence);
      statuses.push(finish(st, res.evidence.length));
      if (res.unmatched.length) {
        warnings.push(`SWE-bench: ${res.unmatched.length} risultati non associati a un modello noto (es. ${res.unmatched.slice(0, 3).join(', ')}).`);
      }
    } catch (err) {
      const rows = prevEvidenceBySource('swebench');
      evidence.push(...rows);
      statuses.push(fallback(st, err, rows.length, ageOf(rows)));
      warnings.push('SWE-bench non raggiungibile: prove di qualità dall\'ultimo aggiornamento riuscito.');
    }
  }

  if (enabled.has('aider')) {
    const st = baseStatus('aider');
    try {
      const res = await fetchAider(observedAt, knownKeys);
      evidence.push(...res.evidence);
      statuses.push(finish(st, res.evidence.length));
    } catch (err) {
      const rows = prevEvidenceBySource('aider');
      evidence.push(...rows);
      statuses.push(fallback(st, err, rows.length, ageOf(rows)));
      warnings.push('Aider non raggiungibile: prove di qualità dall\'ultimo aggiornamento riuscito.');
    }
  }

  // 4. Per-provider offers, asked only for models we could actually recommend:
  //    a model with no measured evidence cannot win, so its endpoints are noise.
  if (enabled.has('openrouter') && pathByKey.size) {
    const withEvidence = new Set(evidence.map((e) => e.modelKey));
    const wanted = agentCapableKeys.filter((k) => withEvidence.has(k));
    const st = baseStatus('openrouter');
    st.name = 'OpenRouter (offerte per provider)';
    try {
      const res = await fetchOffers(wanted, pathByKey, observedAt);
      offers.push(...res.offers);
      if (res.failures.length) warnings.push(`OpenRouter: ${res.failures.length} modelli senza dettaglio provider.`);
      statuses.push(finish(st, res.offers.length));
    } catch (err) {
      const rows = prevOffersBySource('openrouter');
      offers.push(...rows);
      statuses.push(fallback(st, err, rows.length, ageOf(rows)));
    }
  }

  return { models, offers, evidence, statuses, warnings };
}
