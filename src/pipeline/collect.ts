/**
 * Collection stage. Each source is isolated: one failing source degrades that
 * slice of the data (falling back to the last good values, with their age made
 * explicit) instead of failing the whole update.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PATHS, SOURCES, sourceById } from '../config.js';
import { deprecatedKeys, successorOf } from '../engine/lineage.js';
import { matchForm, hoursSince } from '../lib/normalize.js';
import type { ModelRecord, Offer, Plan, ProviderProfile, QualityEvidence, Replacement, Snapshot, SourceStatus, UsageSignal } from '../types.js';
import { fetchUsage } from '../sources/opencodedata.js';
import { fetchCatalogue, fetchOffers } from '../sources/openrouter.js';
import { fetchModelsDev } from '../sources/modelsdev.js';
import { fetchSweBench } from '../sources/swebench.js';
import { fetchAider } from '../sources/aider.js';
import { aaEvidence, downloadAa } from '../sources/artificialanalysis.js';
import { fetchInfrabase, findProfile } from '../sources/infrabase.js';
import { pendingStatus } from '../sources/pending.js';
import { applyRegistry, loadRegistry } from './opencode-registry.js';

export interface Collected {
  opencodeVersion: string | null;
  models: Map<string, ModelRecord>;
  providers: Map<string, ProviderProfile>;
  offers: Offer[];
  evidence: QualityEvidence[];
  statuses: SourceStatus[];
  warnings: string[];
  replacements: Replacement[];
  usage: UsageSignal[];
  plans: Plan[];
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
  // Models their maker has deprecated: never shown, whoever still sells them.
  const retired = new Set<string>();
  const models = new Map<string, ModelRecord>();
  const providers = new Map<string, ProviderProfile>();
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
      for (const k of cat.deprecated) retired.add(k);
      pathByKey = cat.pathByKey;
      agentCapableKeys = cat.agentCapableKeys;
      statuses.push(finish(st, cat.models.length));
    } catch (err) {
      const rows = prevOffersBySource('openrouter');
      offers.push(...rows);
      for (const m of Object.values(previous?.models ?? {})) mergeModel(models, m);
      statuses.push(fallback(st, err, rows.length, ageOf(rows)));
      warnings.push(`OpenRouter unreachable: using data from the last successful update.`);
    }
  }

  /** Comparison index: any foreign spelling of a model resolves to our key. */
  const formsOf = (m: ModelRecord): string[] => {
    const slug = m.key.slice(m.key.indexOf('/') + 1);
    return [matchForm(slug), matchForm(m.displayName), ...m.aliases.map(matchForm)].filter(Boolean);
  };
  const knownKeys = new Map<string, string>();
  // Every model each spelling has pointed at, from every source record, in
  // arrival order: the quality index below picks among them.
  const formKeys = new Map<string, string[]>();
  const indexModel = (m: ModelRecord) => {
    for (const form of formsOf(m)) {
      if (!knownKeys.has(form)) knownKeys.set(form, m.key);
      const keys = formKeys.get(form) ?? [];
      if (!keys.includes(m.key)) formKeys.set(form, [...keys, m.key]);
    }
  };
  for (const m of models.values()) indexModel(m);

  // Hand-curated corrections win over automatic matching: they exist precisely
  // because the automatic rule got something wrong.
  let manualAliases: [string, string][] = [];
  try {
    const file = JSON.parse(await readFile(join(PATHS.curated, 'aliases.json'), 'utf8')) as {
      alias?: Record<string, string>;
    };
    manualAliases = Object.entries(file.alias ?? {});
  } catch {
    // The file is optional.
  }
  for (const [foreign, key] of manualAliases) if (models.has(key)) knownKeys.set(matchForm(foreign), key);

  // 2. Direct provider prices and declared capabilities.
  if (enabled.has('modelsdev')) {
    const st = baseStatus('modelsdev');
    try {
      const res = await fetchModelsDev(observedAt, knownKeys);
      for (const m of res.models) {
        mergeModel(models, m);
        indexModel(m);
      }
      for (const k of res.deprecated) retired.add(k);
      if (res.deprecatedOffers) warnings.push(`${res.deprecatedOffers} offers left out: the seller lists them as deprecated.`);
      offers.push(...res.offers);
      statuses.push(finish(st, res.offers.length));
    } catch (err) {
      const rows = prevOffersBySource('modelsdev');
      offers.push(...rows);
      statuses.push(fallback(st, err, rows.length, ageOf(rows)));
      warnings.push('Models.dev unreachable: direct prices from the last successful update.');
    }
  }

  // 3. Quality evidence.
  // Scores are matched once every price source is in, so the result does not
  // depend on the order the sources list their models: a spelling shared by
  // several models goes to the maker's canonical model, then to the one most
  // providers sell (a provider's private copy never takes the score of the
  // model everyone else sells), and a manual alias can point at a model that
  // only models.dev knows.
  const qualityKeys = new Map<string, string>();
  {
    const sellers = new Map<string, number>();
    for (const o of offers) sellers.set(o.modelKey, (sellers.get(o.modelKey) ?? 0) + 1);
    const sold = (key: string) => sellers.get(key) ?? 0;
    // OpenRouter's catalogue uses the maker's canonical names: a model it lists
    // is the real one, a same-named model only models.dev knows is a seller's copy.
    const canonical = (key: string) => (models.get(key)?.sourceIds.includes('openrouter') ? 1 : 0);
    for (const [form, keys] of formKeys) {
      // Stable sort: on a tie the first model to claim the spelling keeps it.
      const best = [...keys].sort((a, b) => canonical(b) - canonical(a) || sold(b) - sold(a))[0];
      if (best) qualityKeys.set(form, best);
    }
    for (const [foreign, key] of manualAliases) {
      if (models.has(key)) qualityKeys.set(matchForm(foreign), key);
      else warnings.push(`Manual alias ignored: "${foreign}" points to an unknown model (${key}).`);
    }
  }
  if (enabled.has('swebench')) {
    const st = baseStatus('swebench');
    try {
      const res = await fetchSweBench(observedAt, qualityKeys);
      evidence.push(...res.evidence);
      statuses.push(finish(st, res.evidence.length));
      if (res.unmatched.length) {
        warnings.push(`SWE-bench: ${res.unmatched.length} results not matched to a known model (e.g. ${res.unmatched.slice(0, 3).join(', ')}).`);
      }
    } catch (err) {
      const rows = prevEvidenceBySource('swebench');
      evidence.push(...rows);
      statuses.push(fallback(st, err, rows.length, ageOf(rows)));
      warnings.push('SWE-bench unreachable: quality evidence from the last successful update.');
    }
  }

  if (enabled.has('aider')) {
    const st = baseStatus('aider');
    try {
      const res = await fetchAider(observedAt, qualityKeys);
      evidence.push(...res.evidence);
      statuses.push(finish(st, res.evidence.length));
    } catch (err) {
      const rows = prevEvidenceBySource('aider');
      evidence.push(...rows);
      statuses.push(fallback(st, err, rows.length, ageOf(rows)));
      warnings.push('Aider unreachable: quality evidence from the last successful update.');
    }
  }

  // Artificial Analysis: the primary quality evidence, downloaded once per update.
  if (enabled.has('artificialanalysis')) {
    const st = baseStatus('artificialanalysis');
    try {
      const dl = await downloadAa();
      const res = aaEvidence(dl, qualityKeys, observedAt, (key) => models.get(key)?.displayName ?? '');
      evidence.push(...res.evidence);
      if (res.inherited.length) warnings.push(`Artificial Analysis: ${res.inherited.length} new versions carry the Coding Index of the version they follow, provisionally (${res.inherited.slice(0, 3).join('; ')}).`);
      statuses.push({ ...finish(st, res.evidence.length), servedFromCache: dl.fromCache, dataAgeHours: hoursSince(dl.fetchedAt) });
      if (!dl.fromCache) warnings.push(`Artificial Analysis: ${dl.models.length} models downloaded with ${dl.calls} calls.`);
      if (res.wrongSnapshot.length) {
        warnings.push(`Artificial Analysis: ${res.wrongSnapshot.length} scores discarded because they were measured on another dated build of the model (e.g. ${res.wrongSnapshot.slice(0, 2).join('; ')}).`);
      }
      if (res.unmatched.length) {
        warnings.push(`Artificial Analysis: ${res.unmatched.length} models not matched to a known model (e.g. ${res.unmatched.slice(0, 3).join(', ')}).`);
      }
    } catch (err) {
      // Yesterday's values are still usable: the engine drops them once they pass the age limit.
      const rows = prevEvidenceBySource('artificialanalysis');
      evidence.push(...rows);
      statuses.push(fallback(st, err, rows.length, ageOf(rows)));
      warnings.push('Artificial Analysis unreachable: quality evidence from the last successful update.');
    }
  }

  // What OpenCode users keep using: it only breaks near-ties between scores.
  let usage: UsageSignal[] = [];
  if (enabled.has('opencodedata')) {
    const st = baseStatus('opencodedata');
    try {
      const res = await fetchUsage(qualityKeys, observedAt);
      usage = res.signals;
      statuses.push(finish(st, usage.length));
      if (res.unmatched.length) warnings.push(`OpenCode data: ${res.unmatched.length} models not matched to a known model (e.g. ${res.unmatched.slice(0, 3).join(', ')}).`);
    } catch (err) {
      // Yesterday's figures stay usable while they are recent.
      usage = (previous?.usage ?? []).filter((u) => (hoursSince(u.observedAt) ?? Infinity) < 7 * 24);
      statuses.push(fallback(st, err, usage.length, usage.length ? hoursSince(usage[0]!.observedAt) : null));
      warnings.push('OpenCode data unreachable: usage figures from the last successful update.');
    }
  }

  // 4. Per-provider offers, asked only for models we could actually recommend:
  //    a model with no measured evidence cannot win, so its endpoints are noise.
  if (enabled.has('openrouter') && pathByKey.size) {
    const withEvidence = new Set(evidence.map((e) => e.modelKey));
    const wanted = agentCapableKeys.filter((k) => withEvidence.has(k));
    const st = baseStatus('openrouter');
    st.name = 'OpenRouter (per-provider offers)';
    try {
      const res = await fetchOffers(wanted, pathByKey, observedAt);
      offers.push(...res.offers);
      if (res.failures.length) warnings.push(`OpenRouter: ${res.failures.length} models without provider details.`);
      statuses.push(finish(st, res.offers.length));
    } catch (err) {
      const rows = prevOffersBySource('openrouter');
      offers.push(...rows);
      statuses.push(fallback(st, err, rows.length, ageOf(rows)));
    }
  }

  // Who the providers are: headquarters, GDPR, official website.
  if (enabled.has('infrabase')) {
    const st = baseStatus('infrabase');
    try {
      // Look up by name only the providers that actually appear in the offers.
      const names = [...new Set(offers.map((o) => o.providerName))];
      const res = await fetchInfrabase(names);
      for (const p of res.providers) providers.set(p.key, p);
      // Every offer carries who the provider is, so the card can say it
      // without going back to the directory.
      for (const offer of offers) {
        const profile = findProfile(providers.values(), offer.providerName);
        offer.profile = profile
          ? {
              siteUrl: profile.siteUrl,
              hqCountry: profile.hqCountry,
              gdpr: profile.gdpr,
              directoryUrl: profile.directoryUrl,
            }
          : null;
      }
      statuses.push(finish(st, res.providers.length));
    } catch (err) {
      for (const [k, v] of Object.entries(previous?.providers ?? {})) providers.set(k, v);
      statuses.push(fallback(st, err, providers.size, null));
      warnings.push('Infrabase unreachable: provider profiles from the last successful update.');
    }
  }

  // Providers suspended by hand: the price may be right, but if an account
  // cannot be opened the recommendation is useless.
  try {
    const file = JSON.parse(await readFile(join(PATHS.curated, 'providers-sospesi.json'), 'utf8')) as {
      sospesi?: Record<string, string>;
    };
    const suspended = file.sospesi ?? {};
    let excluded = 0;
    for (const offer of offers) {
      const reason = suspended[offer.providerId];
      if (reason) {
        offer.blockedReason = reason;
        excluded++;
      }
    }
    if (excluded) warnings.push(`${excluded} offers excluded: provider suspended by hand.`);
  } catch {
    // The list is optional.
  }

  // Capped subscription plans: their offers draw down an allowance instead of
  // being billed per token, so they are tagged and compared on their own page.
  let plans: Plan[] = [];
  try {
    const file = JSON.parse(await readFile(join(PATHS.curated, 'plans.json'), 'utf8')) as { plans?: Plan[] };
    plans = file.plans ?? [];
    for (const plan of plans) {
      let tagged = 0;
      for (const offer of offers) {
        if (offer.providerId !== plan.providerId) continue;
        offer.planId = plan.id;
        tagged++;
      }
      const priced = new Set(offers.filter((o) => o.planId === plan.id).map((o) => o.remoteModelId));
      const unpriced = Object.keys(plan.models).filter((id) => !priced.has(id));
      if (unpriced.length) warnings.push(`${plan.name}: ${unpriced.length} models in the plan with no price from any source (${unpriced.slice(0, 3).join(', ')}).`);
      if (!tagged) warnings.push(`${plan.name}: no offer from any source.`);
    }
  } catch {
    // The list is optional.
  }

  // OpenRouter's own endpoint list names the provider and its price, and lets
  // the configuration pin it. Where we have it, the generic OpenRouter price
  // models.dev reports (whichever provider OpenRouter happens to route to) is
  // not a price anyone can be sure to pay.
  {
    const routed = new Set(offers.filter((o) => o.sourceId === 'openrouter').map((o) => o.modelKey));
    const before = offers.length;
    offers.splice(0, offers.length, ...offers.filter((o) => !(o.sourceId === 'modelsdev' && o.providerId === 'openrouter' && routed.has(o.modelKey))));
    if (before > offers.length) warnings.push(`${before - offers.length} generic OpenRouter prices left out: OpenRouter lists the actual providers for those models.`);
  }

  // A deprecated model goes with its dated builds and the variants sellers
  // publish under it, from every source and from yesterday's fallback data.
  let gone = new Set<string>();
  // The last score of each retired model: its newer version may deserve a mention.
  const retiredScores = new Map<string, QualityEvidence>();
  if (retired.size) {
    gone = deprecatedKeys(retired, models.keys());
    for (const e of evidence) {
      const prev = retiredScores.get(e.modelKey);
      if (gone.has(e.modelKey) && (!prev || e.value > prev.value)) retiredScores.set(e.modelKey, e);
    }
    const before = offers.length;
    offers.splice(0, offers.length, ...offers.filter((o) => !gone.has(o.modelKey)));
    evidence.splice(0, evidence.length, ...evidence.filter((e) => !gone.has(e.modelKey)));
    usage = usage.filter((u) => !gone.has(u.modelKey));
    warnings.push(`${gone.size} deprecated models hidden with ${before - offers.length} offers (e.g. ${[...retired].slice(0, 3).join(', ')}).`);
  }

  // Last step: which commands OpenCode actually accepts.
  const registry = await loadRegistry();
  const result = applyRegistry(offers, registry);
  if (!registry) {
    warnings.push('OpenCode model list not available: no offer can be verified.');
  } else if (result.rejected) {
    warnings.push(`${result.rejected} offers excluded: OpenCode does not recognise that model-provider pair.`);
  }

  // A retired model that scored, whose newer version is on sale in a usable way
  // but has no measurement yet: the page says so instead of staying silent.
  const measured = new Set(evidence.map((e) => e.modelKey));
  const onSale = new Set(offers.filter((o) => o.opencodeVerified !== false && !o.blockedReason).map((o) => o.modelKey));
  const unmeasured = [...onSale].filter((k) => !measured.has(k));
  const replacements: Replacement[] = [];
  for (const [key, e] of retiredScores) {
    const next = successorOf(key, unmeasured, (k) => models.get(k)?.releaseDate ?? null);
    if (!next || replacements.some((r) => r.successorKey === next && r.retiredScore >= e.value)) continue;
    const i = replacements.findIndex((r) => r.successorKey === next);
    const row: Replacement = {
      retiredKey: key,
      retiredName: models.get(key)?.displayName ?? key,
      retiredScore: e.value,
      retiredMetric: e.metric,
      successorKey: next,
      successorName: models.get(next)?.displayName ?? next,
    };
    if (i >= 0) replacements[i] = row;
    else replacements.push(row);
  }

  return { opencodeVersion: registry?.version ?? null, models, providers, offers, evidence, statuses, warnings, replacements, usage, plans };
}
