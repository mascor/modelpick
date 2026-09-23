/**
 * Artificial Analysis, free API tier. Primary quality evidence: the Coding
 * Index, measured by one organisation with one method across hundreds of
 * models and kept current, so every score shares a single comparability group.
 *
 * The free quota is 100 calls per 24 hours and the whole list is a handful of
 * pages. The download is cached on disk and reused for `AA.cacheHours`, so an
 * update rerun on the same day makes no calls at all.
 *
 * Values are reported exactly as published (Data Platform Terms, section 3.1),
 * always with the attribution the terms require.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AA, HTTP, PATHS } from '../config.js';
import { hoursSince, matchForm } from '../lib/normalize.js';
import type { QualityEvidence } from '../types.js';
import { lineOf } from '../engine/lineage.js';

export interface AaModel {
  id: string;
  name: string;
  slug: string;
  release_date: string | null;
  model_creator: { id: string; name: string } | null;
  artificial_analysis_intelligence_index_cost?: { total_cost?: number | null; cost_per_task?: { total_cost?: number | null } | null } | null;
  evaluations: {
    artificial_analysis_intelligence_index: number | null;
    artificial_analysis_coding_index: number | null;
    artificial_analysis_agentic_index: number | null;
  };
}

interface Page {
  tier: string;
  intelligence_index_version: number;
  pagination: { page: number; total_pages: number; has_more: boolean };
  data: AaModel[];
}

export interface AaDownload {
  fetchedAt: string;
  indexVersion: number | null;
  calls: number;
  models: AaModel[];
}

const CACHE_FILE = () => join(PATHS.cache, 'artificialanalysis-models.json');

/** One page, no retries on 429: an exhausted daily quota does not come back in seconds. */
async function getPage(page: number): Promise<Page> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP.timeoutMs);
  try {
    const res = await fetch(`${AA.baseUrl}?page=${page}`, {
      signal: controller.signal,
      headers: { 'x-api-key': AA.apiKey, 'user-agent': HTTP.userAgent, accept: 'application/json' },
    });
    if (!res.ok) {
      const reset = res.headers.get('x-ratelimit-reset');
      throw new Error(`Artificial Analysis: HTTP ${res.status} on page ${page}${reset ? ` (quota resets at ${new Date(Number(reset) * 1000).toISOString()})` : ''}`);
    }
    return (await res.json()) as Page;
  } finally {
    clearTimeout(timer);
  }
}

/** The full model list: from the disk cache when recent enough, otherwise from the API. */
export async function downloadAa(now = Date.now(), cacheFile = CACHE_FILE()): Promise<AaDownload & { fromCache: boolean }> {
  try {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8')) as AaDownload;
    const age = hoursSince(cached.fetchedAt, now);
    if (age !== null && age < AA.cacheHours && cached.models.length) return { ...cached, fromCache: true };
  } catch {
    /* no usable cache */
  }
  if (!AA.apiKey) throw new Error('Artificial Analysis: AA_API_KEY not set.');

  const models: AaModel[] = [];
  let indexVersion: number | null = null;
  let calls = 0;
  for (let page = 1; page <= AA.maxPages; page++) {
    const res = await getPage(page);
    calls++;
    indexVersion = res.intelligence_index_version ?? indexVersion;
    models.push(...res.data);
    if (!res.pagination.has_more) break;
  }
  const download: AaDownload = { fetchedAt: new Date(now).toISOString(), indexVersion, calls, models };
  await mkdir(dirname(cacheFile), { recursive: true });
  await writeFile(cacheFile, JSON.stringify(download), 'utf8');
  return { ...download, fromCache: false };
}

/**
 * Dated snapshots of a model: "V4 Flash 0423" and "V4 Flash 0731" are not the
 * same product. Four-digit month-day tags and full dates both count; a bare
 * year does not, and neither does a parameter count like "80B" or "2.4T".
 */
const DATE_TAGS = (text: string): string[] =>
  [...text.matchAll(/(?<![\d.])(\d{8}|\d{4})(?![\d.])/g)]
    .map((m) => m[1]!)
    .filter((tag) => (tag.length === 8 ? /^20\d{6}$/.test(tag) : !/^(19|20)\d\d$/.test(tag)))
    .map((tag) => (tag.length === 8 ? tag.slice(4) : tag));

/**
 * True when both names carry a dated snapshot and the dates disagree: the
 * score belongs to a different build of the model than the one on sale.
 */
export function differentSnapshot(aaName: string, ourName: string): boolean {
  const theirs = DATE_TAGS(aaName);
  const ours = DATE_TAGS(ourName);
  if (!theirs.length || !ours.length) return false;
  return !theirs.some((tag) => ours.includes(tag));
}

/**
 * The name matched an older build of ours, but the build AA measured may be on
 * sale under its dated name: "DeepSeek V4 Pro 0813" is our "deepseek-v4-pro-0813".
 */
function datedSibling(
  m: AaModel,
  key: string,
  knownKeys: Map<string, string>,
  displayNameOf: (modelKey: string) => string,
): string | null {
  const theirs = `${m.name} ${m.slug}`;
  const base = key.slice(key.indexOf('/') + 1);
  for (const tag of DATE_TAGS(theirs)) {
    const sibling = knownKeys.get(matchForm(`${base}-${tag}`));
    if (sibling && sibling !== key && !differentSnapshot(theirs, displayNameOf(sibling))) return sibling;
  }
  return null;
}

/** Reasoning-effort variants are published as suffixed slugs of the same model. */
const VARIANT = /-(max|xhigh|high|medium|low|minimal|non-reasoning|reasoning|thinking|adaptive)$/;

/** Our key for an AA model: exact slug first, then without the effort suffix. */
export function aaModelKey(m: AaModel, knownKeys: Map<string, string>): string | null {
  for (const form of [m.slug, m.name]) {
    let s = form;
    let key = knownKeys.get(matchForm(s));
    while (!key && VARIANT.test(s)) {
      s = s.replace(VARIANT, '');
      key = knownKeys.get(matchForm(s));
    }
    if (key) return key;
  }
  return null;
}

/** "Claude Opus 5 (Adaptive Reasoning, Max Effort)" -> "Adaptive Reasoning, Max Effort". */
const variantOf = (name: string): string | null => /\(([^)]*)\)\s*$/.exec(name)?.[1] ?? null;

/**
 * Coding Index evidence, one row per effort variant of each model of ours
 * (the engine chooses which variant a buyer actually gets), with the cost per
 * task Artificial Analysis measured for that variant.
 *
 * A model that has no Coding Index yet, but whose Intelligence Index is at
 * least that of the version it follows in the same line, carries that
 * version's Coding Index as a provisional score (see METHODOLOGY.md).
 */
export function aaEvidence(
  download: AaDownload,
  knownKeys: Map<string, string>,
  observedAt: string,
  displayNameOf: (modelKey: string) => string = () => '',
): { evidence: QualityEvidence[]; unmatched: string[]; wrongSnapshot: string[]; inherited: string[] } {
  const version = download.indexVersion !== null ? `v${download.indexVersion}` : 'undeclared version';
  const rows = new Map<string, { key: string; m: AaModel; value: number }>();
  const unscored: { key: string; m: AaModel }[] = [];
  const unmatched: string[] = [];
  const wrongSnapshot: string[] = [];
  const ourKeys = new Set(knownKeys.values());
  const costOf = (m: AaModel): number | null => m.artificial_analysis_intelligence_index_cost?.cost_per_task?.total_cost ?? null;

  const keyFor = (m: AaModel): string | null => {
    let key = aaModelKey(m, knownKeys);
    if (!key) return null;
    // "claude-sonnet-4:thinking" is a mode of claude-sonnet-4: the score goes to the model.
    const base = key.split(':')[0]!;
    if (base !== key && ourKeys.has(base)) key = base;
    // Better no score than the score of another build of the model.
    if (differentSnapshot(`${m.name} ${m.slug}`, displayNameOf(key))) {
      const sibling = datedSibling(m, key, knownKeys, displayNameOf);
      if (!sibling) {
        wrongSnapshot.push(`${m.slug} \u2260 ${displayNameOf(key)}`);
        return null;
      }
      key = sibling;
    }
    return key;
  };

  for (const m of download.models) {
    const value = m.evaluations?.artificial_analysis_coding_index;
    const intelligence = m.evaluations?.artificial_analysis_intelligence_index;
    if (typeof value !== 'number') {
      if (typeof intelligence === 'number') {
        const key = aaModelKey(m, knownKeys);
        if (key) unscored.push({ key: key.split(':')[0]!, m });
      }
      continue;
    }
    const key = keyFor(m);
    if (!key) {
      if (!aaModelKey(m, knownKeys)) unmatched.push(m.slug);
      continue;
    }
    const id = `${key}|${m.name}`;
    if (!rows.has(id)) rows.set(id, { key, m, value });
  }

  const row = (modelKey: string, m: AaModel, value: number, inheritedFrom: QualityEvidence['inheritedFrom']): QualityEvidence => ({
    modelKey,
    metric: 'aa_coding_index',
    value,
    // The variant AA measured, named as AA publishes it.
    harness: m.name,
    harnessKey: `aa-coding-index|${version}`,
    attempts: null,
    instanceCalls: null,
    reasoningEffort: variantOf(m.name),
    // The index is the provider's current value on the day we downloaded it.
    measuredAt: download.fetchedAt,
    sourceId: 'artificialanalysis',
    sourceUrl: `https://artificialanalysis.ai/models/${encodeURIComponent(m.slug)}`,
    observedAt,
    costPerTask: costOf(m),
    intelligenceIndex: m.evaluations?.artificial_analysis_intelligence_index ?? null,
    inheritedFrom,
  });
  const evidence: QualityEvidence[] = [...rows.values()].map(({ key, m, value }) => row(key, m, value, null));

  // Provisional scores for new versions, from the version they follow.
  const scored = new Set(evidence.map((e) => e.modelKey));
  const bestOf = new Map<string, QualityEvidence>();
  for (const e of evidence) {
    const prev = bestOf.get(e.modelKey);
    if (!prev || e.value > prev.value) bestOf.set(e.modelKey, e);
  }
  const inherited: string[] = [];
  const done = new Set<string>();
  for (const { key, m } of unscored) {
    if (scored.has(key) || done.has(key)) continue;
    const own = lineOf(key);
    if (!own) continue;
    let parent: { key: string; version: number[] } | null = null;
    for (const k of scored) {
      const l = lineOf(k);
      if (!l || l.line !== own.line || !olderVersion(l.version, own.version)) continue;
      if (!parent || olderVersion(parent.version, l.version)) parent = { key: k, version: l.version };
    }
    const from = parent ? bestOf.get(parent.key) : undefined;
    const mine = unscored.filter((u) => u.key === key);
    const myIntelligence = Math.max(...mine.map((u) => u.m.evaluations?.artificial_analysis_intelligence_index ?? -Infinity));
    if (!from || from.intelligenceIndex == null || myIntelligence < from.intelligenceIndex) continue;
    const variant = mine.find((u) => u.m.evaluations?.artificial_analysis_intelligence_index === myIntelligence)!.m;
    evidence.push(row(key, variant, from.value, { modelKey: from.modelKey, harness: from.harness }));
    inherited.push(`${key} \u2190 ${from.modelKey}`);
    done.add(key);
  }

  return { evidence, unmatched, wrongSnapshot, inherited };
}

/** True when version a comes before version b ([4] before [4, 1]). */
const olderVersion = (a: number[], b: number[]): boolean => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
};
