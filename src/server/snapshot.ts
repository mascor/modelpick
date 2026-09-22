/** Reads the published snapshot, reloading only when the file actually changes. */
import { stat } from 'node:fs/promises';
import { PATHS } from '../config.js';
import { loadCurrent, loadStatus, type RunStatus } from '../pipeline/store.js';
import type { Snapshot } from '../types.js';

let cached: Snapshot | null = null;
let cachedMtime = 0;
let cachedStatus: RunStatus | null = null;
let statusMtime = 0;

export async function currentSnapshot(): Promise<Snapshot | null> {
  try {
    const { mtimeMs } = await stat(PATHS.current);
    if (mtimeMs !== cachedMtime) {
      cached = await loadCurrent();
      cachedMtime = mtimeMs;
    }
  } catch {
    // No snapshot published yet: the pages say so instead of inventing data.
    return null;
  }
  return cached;
}

export async function currentStatus(): Promise<RunStatus | null> {
  try {
    const { mtimeMs } = await stat(PATHS.status);
    if (mtimeMs !== statusMtime) {
      cachedStatus = await loadStatus();
      statusMtime = mtimeMs;
    }
  } catch {
    return null;
  }
  return cachedStatus;
}
