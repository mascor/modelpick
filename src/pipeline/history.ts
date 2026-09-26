/**
 * Price history: what each measured model cost a month, update after update.
 *
 * Run files are complete snapshots of several MB, and only the last few months
 * are kept. The chart needs one number per model, kind of work and update, so
 * every publish appends that to a small index that outlives the runs. The
 * number is computed as the card computes it: the cheapest offer we would
 * recommend for that model, on the scenario of that kind of work.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PATHS } from '../config.js';
import { readJson, writeJsonAtomic } from '../lib/atomic.js';
import { knownProviders, rankOffers } from '../engine/recommend.js';
import { SCENARIOS, TASK_IDS, type TaskId } from '../engine/scenarios.js';
import type { Offer, Snapshot } from '../types.js';

export const HISTORY_PATH = join(PATHS.data, 'price-history.json');
/** A year of chart plus a margin; older points are dropped. */
const KEEP_DAYS = 400;

/** One update: when it was published, and the monthly USD per kind of work (null when no offer qualified). */
export type HistoryPoint = [at: string, ...costs: (number | null)[]];

export interface PriceHistory {
  version: 1;
  /** Order of the costs in every point. */
  tasks: TaskId[];
  /** Run ids already counted, so a rebuild or a repeated publish adds nothing twice. */
  runs: string[];
  models: Record<string, HistoryPoint[]>;
}

const empty = (): PriceHistory => ({ version: 1, tasks: [...TASK_IDS], runs: [], models: {} });

const round = (n: number) => Math.round(n * 100) / 100;

/** The monthly cost of every measured model in one snapshot, per kind of work. */
export function pointsOf(snapshot: Snapshot): Map<string, HistoryPoint> {
  const now = Date.parse(snapshot.generatedAt);
  const known = knownProviders(snapshot);
  const measured = new Set(snapshot.evidence.map((e) => e.modelKey));
  const byModel = new Map<string, Offer[]>();
  for (const o of snapshot.offers) {
    if (!measured.has(o.modelKey) || o.demo || o.planId) continue;
    (byModel.get(o.modelKey) ?? byModel.set(o.modelKey, []).get(o.modelKey)!).push(o);
  }
  const out = new Map<string, HistoryPoint>();
  for (const [key, offers] of byModel) {
    const vendor = snapshot.models[key]?.vendor ?? key.split('/')[0] ?? '';
    const costs = TASK_IDS.map((task) => {
      const s = SCENARIOS[task];
      const { ready } = rankOffers(offers, s.monthly, { task, priority: 'balanced', lang: 'en' }, s.minContextTokens, now, vendor, known);
      const total = ready[0]?.cost.totalUsd;
      return typeof total === 'number' ? round(total) : null;
    });
    if (costs.some((c) => c !== null)) out.set(key, [snapshot.generatedAt, ...costs]);
  }
  return out;
}

/** Adds one snapshot to the history, keeping points in time order and at most KEEP_DAYS old. */
export function addSnapshot(history: PriceHistory, snapshot: Snapshot): PriceHistory {
  if (history.runs.includes(snapshot.runId)) return history;
  for (const [key, point] of pointsOf(snapshot)) {
    const series = (history.models[key] ??= []);
    series.push(point);
    series.sort((a, b) => a[0].localeCompare(b[0]));
  }
  history.runs.push(snapshot.runId);
  const cutoff = new Date(Date.parse(snapshot.generatedAt) - KEEP_DAYS * 86_400_000).toISOString();
  for (const [key, series] of Object.entries(history.models)) {
    const kept = series.filter((p) => p[0] >= cutoff);
    if (kept.length) history.models[key] = kept;
    else delete history.models[key];
  }
  history.runs = history.runs.slice(-KEEP_DAYS * 4);
  return history;
}

export const loadHistory = () => readJson<PriceHistory>(HISTORY_PATH);

/**
 * Called after every publish. Without an index yet, it is built from all the
 * runs still on disk, so the chart starts with the months already collected.
 */
export async function recordHistory(snapshot: Snapshot): Promise<void> {
  let history = await loadHistory().catch(() => null);
  if (!history || history.version !== 1) {
    history = empty();
    let files: string[] = [];
    try {
      files = (await readdir(PATHS.runs)).filter((f) => f.endsWith('.json')).sort();
    } catch {
      /* no runs yet */
    }
    for (const f of files) {
      try {
        addSnapshot(history, JSON.parse(await readFile(join(PATHS.runs, f), 'utf8')) as Snapshot);
      } catch {
        /* an unreadable run is simply not part of the series */
      }
    }
  }
  addSnapshot(history, snapshot);
  await writeJsonAtomic(HISTORY_PATH, history);
}

/** The series of one model for one kind of work, without the updates where no offer qualified. */
export function seriesFor(history: PriceHistory | null, modelKey: string, task: TaskId): { at: string; usd: number }[] {
  const i = history?.tasks.indexOf(task) ?? -1;
  if (!history || i < 0) return [];
  return (history.models[modelKey] ?? [])
    .map((p) => ({ at: p[0], usd: p[i + 1] as number | null }))
    .filter((p): p is { at: string; usd: number } => typeof p.usd === 'number');
}
