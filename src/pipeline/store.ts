/** Storage: immutable run files as history, one atomically replaced current file. */
import { mkdir, readdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PATHS } from '../config.js';
import { readJson, writeJsonAtomic } from '../lib/atomic.js';
import type { Snapshot } from '../types.js';

/** Runs kept on disk. Roughly four months of daily history. */
const KEEP_RUNS = Number(process.env.MODELPICK_KEEP_RUNS ?? '120');

export interface RunStatus {
  runId: string;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  published: boolean;
  durationMs: number;
  message: string;
  warnings: string[];
  sources: { id: string; outcome: string; itemCount: number; error: string | null }[];
}

export const loadCurrent = () => readJson<Snapshot>(PATHS.current);
export const loadStatus = () => readJson<RunStatus>(PATHS.status);

export async function publish(snapshot: Snapshot): Promise<void> {
  await mkdir(PATHS.runs, { recursive: true });
  // History first: the run file exists before anything points at it.
  await writeJsonAtomic(join(PATHS.runs, `${snapshot.runId}.json`), snapshot);
  await writeJsonAtomic(PATHS.current, snapshot);
}

export const writeStatus = (status: RunStatus) => writeJsonAtomic(PATHS.status, status);

export async function pruneRuns(keep = KEEP_RUNS): Promise<number> {
  let files: string[];
  try {
    files = (await readdir(PATHS.runs)).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return 0;
  }
  const doomed = files.slice(0, Math.max(0, files.length - keep));
  for (const f of doomed) await unlink(join(PATHS.runs, f)).catch(() => {});
  return doomed.length;
}

export async function listRuns(limit = 60): Promise<string[]> {
  try {
    const files = (await readdir(PATHS.runs)).filter((f) => f.endsWith('.json')).sort();
    return files.slice(-limit).reverse().map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}

/** Cheapest complete price seen for a model in each stored run. */
export async function priceHistory(modelKey: string, limit = 60): Promise<{ at: string; usdPerMTokInput: number | null; offerCount: number }[]> {
  const runs = (await listRuns(limit)).reverse();
  const out: { at: string; usdPerMTokInput: number | null; offerCount: number }[] = [];
  for (const runId of runs) {
    try {
      const snap = JSON.parse(await readFile(join(PATHS.runs, `${runId}.json`), 'utf8')) as Snapshot;
      const prices = snap.offers
        .filter((o) => o.modelKey === modelKey && !o.demo && o.prices.inputPerMTok !== null)
        .map((o) => o.prices.inputPerMTok!);
      out.push({
        at: snap.generatedAt,
        usdPerMTokInput: prices.length ? Math.min(...prices) : null,
        offerCount: prices.length,
      });
    } catch {
      /* a missing or unreadable run is simply not part of the series */
    }
  }
  return out;
}
