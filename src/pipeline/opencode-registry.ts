/**
 * The set of model ids OpenCode will actually accept.
 *
 * We publish commands people paste into a terminal, so "it should work" is not
 * good enough: the list is extracted from OpenCode itself when the image is
 * built, and any offer whose id is not in it cannot be recommended.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PATHS } from '../config.js';
import { modelIdFor } from '../engine/opencode.js';
import type { Offer } from '../types.js';

export interface Registry {
  ids: Set<string>;
  version: string | null;
}

export async function loadRegistry(): Promise<Registry | null> {
  try {
    const raw = await readFile(join(PATHS.registry, 'models.txt'), 'utf8');
    const ids = new Set(raw.split('\n').map((l) => l.trim()).filter(Boolean));
    if (!ids.size) return null;
    let version: string | null = null;
    try {
      version = (await readFile(join(PATHS.registry, 'version.txt'), 'utf8')).trim() || null;
    } catch {
      /* version is a nicety, not a requirement */
    }
    return { ids, version };
  } catch {
    return null;
  }
}

/** Marks every offer with the id OpenCode would use and whether it accepts it. */
export function applyRegistry(offers: Offer[], registry: Registry | null): { verified: number; rejected: number } {
  let verified = 0;
  let rejected = 0;
  for (const offer of offers) {
    const id = modelIdFor(offer);
    offer.opencodeId = id;
    if (!registry) {
      // Without the list we cannot claim anything, so nothing is marked verified.
      offer.opencodeVerified = false;
      continue;
    }
    offer.opencodeVerified = registry.ids.has(id);
    if (offer.opencodeVerified) verified++;
    else rejected++;
  }
  return { verified, rejected };
}
