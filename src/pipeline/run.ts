/**
 * One update: collect, validate, publish atomically. Designed to be run by the
 * scheduler, by hand, or by an operator debugging a source.
 */
import { randomUUID } from 'node:crypto';
import { SOURCES } from '../config.js';
import type { Snapshot } from '../types.js';
import { collect } from './collect.js';
import { validateOffers } from './validate.js';
import { loadCurrent, publish, pruneRuns, writeStatus, type RunStatus } from './store.js';

export async function runUpdate(): Promise<RunStatus> {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const runId = `${startedAt.replace(/[:.]/g, '-')}_${randomUUID().slice(0, 8)}`;
  const previous = await loadCurrent();

  const warnings: string[] = [];
  let published = false;
  let ok = true;
  let message = '';
  let statuses: RunStatus['sources'] = [];

  try {
    const collected = await collect(previous, startedAt);
    const validation = validateOffers(collected.offers, previous);
    warnings.push(...collected.warnings, ...validation.warnings);

    const dropSummary = new Map<string, number>();
    for (const d of validation.dropped) dropSummary.set(d.reason, (dropSummary.get(d.reason) ?? 0) + 1);
    for (const [reason, count] of dropSummary) warnings.push(`${count} offerte scartate: ${reason}.`);

    const liveSources = collected.statuses.filter((s) => s.outcome === 'ok');
    const failedSources = collected.statuses.filter((s) => s.outcome === 'failed');
    statuses = collected.statuses.map((s) => ({ id: s.id, outcome: s.outcome, itemCount: s.itemCount, error: s.error }));

    const snapshot: Snapshot = {
      version: 1,
      runId,
      generatedAt: new Date().toISOString(),
      models: Object.fromEntries(collected.models),
      offers: validation.kept,
      evidence: collected.evidence,
      sources: collected.statuses,
      warnings,
      stats: {
        modelCount: collected.models.size,
        offerCount: validation.kept.length,
        evidenceCount: collected.evidence.length,
        sourcesOk: liveSources.length,
        sourcesFailed: failedSources.length,
      },
    };

    // Never replace a good snapshot with an empty one.
    const tooThin = snapshot.offers.length === 0 || snapshot.evidence.length === 0;
    if (tooThin && previous) {
      ok = false;
      message = 'Aggiornamento non pubblicato: risultato incompleto, resta valido lo snapshot precedente.';
      warnings.push(message);
    } else {
      await publish(snapshot);
      published = true;
      const pruned = await pruneRuns();
      message = `Pubblicate ${snapshot.offers.length} offerte su ${snapshot.stats.modelCount} modelli, ${snapshot.evidence.length} prove di qualità.${pruned ? ` ${pruned} run storiche rimosse.` : ''}`;
      if (failedSources.length) ok = false;
    }
  } catch (err) {
    ok = false;
    message = `Aggiornamento fallito: ${err instanceof Error ? err.message : String(err)}`;
    warnings.push(message);
  }

  const status: RunStatus = {
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    ok,
    published,
    durationMs: Date.now() - started,
    message,
    warnings,
    sources: statuses.length ? statuses : SOURCES.map((s) => ({ id: s.id, outcome: 'skipped', itemCount: 0, error: null })),
  };
  await writeStatus(status);
  return status;
}

// Allow `node dist/pipeline/run.js` as a one-shot update.
const invokedDirectly = process.argv[1] && /run\.(ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  runUpdate()
    .then((s) => {
      console.log(`[modelpick] ${s.ok ? 'OK' : 'ATTENZIONE'} ${s.message}`);
      for (const w of s.warnings) console.log(`[modelpick]   - ${w}`);
      process.exit(s.published ? 0 : 1);
    })
    .catch((err) => {
      console.error('[modelpick] errore fatale', err);
      process.exit(1);
    });
}
