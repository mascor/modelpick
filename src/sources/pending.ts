/**
 * Placeholders for sources whose reuse terms are not settled. They exist so the
 * sources page can explain, per source, exactly why nothing is being collected -
 * and so enabling one later is a config change, not a rewrite.
 */
import type { SourceStatus } from '../types.js';
import { sourceById } from '../config.js';

export function pendingStatus(id: string): SourceStatus {
  const cfg = sourceById(id)!;
  return {
    id: cfg.id,
    name: cfg.name,
    url: cfg.url,
    outcome: 'disabled',
    note: cfg.note,
    licence: cfg.licence,
    attribution: cfg.attribution,
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    itemCount: 0,
    error: null,
    servedFromCache: false,
    dataAgeHours: null,
  };
}
