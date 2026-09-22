import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recommend, type RecommendationRequest } from '../src/engine/recommend.js';
import { aaEvidence, aaModelKey, downloadAa, type AaModel } from '../src/sources/artificialanalysis.js';
import { matchForm } from '../src/lib/normalize.js';
import { evidence, model, offer, snapshot } from './fixtures.js';

const req = (over: Partial<RecommendationRequest> = {}): RecommendationRequest => ({
  task: 'bug', priority: 'equilibrio', lang: 'it', usage: null, currentModelKey: null, currentOfferId: null, ...over,
});
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const aa = (modelKey: string, value: number, over = {}) =>
  evidence(modelKey, value, { metric: 'aa_coding_index', harnessKey: 'aa-coding-index|v4.3', sourceId: 'artificialanalysis', ...over });

const two = (ev: ReturnType<typeof evidence>[]) =>
  snapshot(
    [model('v/a'), model('v/b')],
    [
      offer({ id: 'a', modelKey: 'v/a', providerId: 'alfa', prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1 } }),
      offer({ id: 'b', modelKey: 'v/b', providerId: 'beta', prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1 } }),
    ],
    ev,
  );

test('una misura di qualita piu vecchia di 7 giorni non viene usata', () => {
  const r = recommend(two([evidence('v/a', 70, { measuredAt: daysAgo(8) }), evidence('v/b', 60)]), req());
  assert.equal(r.everyday?.model.key, 'v/b');
  assert.ok(r.method.excluded.some((e) => e.reason === 'stale-evidence'));
});

test('senza misure recenti non indichiamo nessun modello', () => {
  const r = recommend(two([evidence('v/a', 70, { measuredAt: '2026-02-01' })]), req());
  assert.equal(r.everyday, null);
});

test('Artificial Analysis ha la precedenza su SWE-bench come riferimento', () => {
  // SWE-bench preferirebbe v/a; AA, che e il riferimento, preferisce v/b.
  const r = recommend(two([evidence('v/a', 80), aa('v/b', 60), aa('v/a', 40)]), req());
  assert.equal(r.everyday?.model.key, 'v/b');
  assert.equal(r.everyday?.quality.metric, 'aa_coding_index');
  assert.match(r.method.referenceHarness ?? '', /Artificial Analysis/);
  assert.doesNotMatch(r.everyday!.reason, /%/); // l'indice non e una percentuale
});

test('le varianti di sforzo AA si associano al modello e resta la migliore', () => {
  const known = new Map([[matchForm('claude-opus-5'), 'anthropic/claude-opus-5']]);
  const m = (slug: string, name: string, v: number): AaModel => ({
    id: slug, name, slug, release_date: null, model_creator: null,
    evaluations: { artificial_analysis_intelligence_index: null, artificial_analysis_coding_index: v, artificial_analysis_agentic_index: null },
  });
  assert.equal(aaModelKey(m('claude-opus-5-xhigh', 'Claude Opus 5 (Xhigh)', 1), known), 'anthropic/claude-opus-5');
  const { evidence: ev, unmatched } = aaEvidence(
    { fetchedAt: new Date().toISOString(), indexVersion: 4.3, calls: 4, models: [
      m('claude-opus-5-medium', 'Claude Opus 5 (Medium Effort)', 74.3),
      m('claude-opus-5', 'Claude Opus 5 (Max Effort)', 78),
      m('ignoto-1', 'Ignoto', 50),
    ] },
    known,
    new Date().toISOString(),
  );
  assert.equal(ev.length, 1);
  assert.equal(ev[0]!.value, 78);
  assert.equal(ev[0]!.reasoningEffort, 'Max Effort');
  assert.deepEqual(unmatched, ['ignoto-1']);
});

test('uno scaricamento AA recente viene riusato senza chiamare l API', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mp-aa-'));
  await mkdir(join(dir, 'cache'), { recursive: true });
  await writeFile(join(dir, 'cache', 'artificialanalysis-models.json'), JSON.stringify({
    fetchedAt: new Date(Date.now() - 3_600_000).toISOString(), indexVersion: 4.3, calls: 4,
    models: [{ id: 'x', name: 'X', slug: 'x', release_date: null, model_creator: null, evaluations: { artificial_analysis_intelligence_index: null, artificial_analysis_coding_index: 50, artificial_analysis_agentic_index: null } }],
  }));
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new Error('nessuna chiamata attesa'); }) as typeof fetch;
  try {
    const dl = await downloadAa(Date.now(), join(dir, 'cache', 'artificialanalysis-models.json'));
    assert.equal(dl.fromCache, true);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});
