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
  task: 'bug', priority: 'balanced', lang: 'it', usage: null, currentModelKey: null, currentOfferId: null, ...over,
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

test('a quality measurement older than 7 days is not used', () => {
  const r = recommend(two([evidence('v/a', 70, { measuredAt: daysAgo(8) }), evidence('v/b', 60)]), req());
  assert.equal(r.everyday?.model.key, 'v/b');
  assert.ok(r.method.excluded.some((e) => e.reason === 'stale-evidence'));
});

test('without recent measurements we name no model', () => {
  const r = recommend(two([evidence('v/a', 70, { measuredAt: '2026-02-01' })]), req());
  assert.equal(r.everyday, null);
});

test('Artificial Analysis takes precedence over SWE-bench as the reference', () => {
  // SWE-bench would prefer v/a; AA, which is the reference, prefers v/b.
  const r = recommend(two([evidence('v/a', 80), aa('v/b', 60), aa('v/a', 40)]), req());
  assert.equal(r.everyday?.model.key, 'v/b');
  assert.equal(r.everyday?.quality.metric, 'aa_coding_index');
  assert.match(r.method.referenceHarness ?? '', /Artificial Analysis/);
  assert.doesNotMatch(r.everyday!.reason, /%/); // the index is not a percentage
});

test('AA effort variants map to the model and the best one is kept', () => {
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
      m('unknown-1', 'Unknown', 50),
    ] },
    known,
    new Date().toISOString(),
  );
  assert.equal(ev.length, 1);
  assert.equal(ev[0]!.value, 78);
  assert.equal(ev[0]!.reasoningEffort, 'Max Effort');
  assert.deepEqual(unmatched, ['unknown-1']);
});

test('a recent AA download is reused without calling the API', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mp-aa-'));
  await mkdir(join(dir, 'cache'), { recursive: true });
  await writeFile(join(dir, 'cache', 'artificialanalysis-models.json'), JSON.stringify({
    fetchedAt: new Date(Date.now() - 3_600_000).toISOString(), indexVersion: 4.3, calls: 4,
    models: [{ id: 'x', name: 'X', slug: 'x', release_date: null, model_creator: null, evaluations: { artificial_analysis_intelligence_index: null, artificial_analysis_coding_index: 50, artificial_analysis_agentic_index: null } }],
  }));
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new Error('no call expected'); }) as typeof fetch;
  try {
    const dl = await downloadAa(Date.now(), join(dir, 'cache', 'artificialanalysis-models.json'));
    assert.equal(dl.fromCache, true);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a score measured on another dated build is not used', () => {
  const known = new Map([[matchForm('deepseek-v4-flash'), 'deepseek/deepseek-v4-flash']]);
  const ourNames = new Map([['deepseek/deepseek-v4-flash', 'DeepSeek: DeepSeek V4 Flash 0423']]);
  const m = (slug: string, name: string): AaModel => ({
    id: slug, name, slug, release_date: null, model_creator: null,
    evaluations: { artificial_analysis_intelligence_index: null, artificial_analysis_coding_index: 69.1, artificial_analysis_agentic_index: null },
  });
  const run = (name: string) =>
    aaEvidence(
      { fetchedAt: new Date().toISOString(), indexVersion: 4.3, calls: 1, models: [m('deepseek-v4-flash', name)] },
      known,
      new Date().toISOString(),
      (k) => ourNames.get(k) ?? '',
    );

  const otherBuild = run('DeepSeek V4 Flash 0731 (Reasoning, Max Effort)');
  assert.equal(otherBuild.evidence.length, 0);
  assert.equal(otherBuild.wrongSnapshot.length, 1);

  const sameBuild = run('DeepSeek V4 Flash 0423 (Reasoning, Max Effort)');
  assert.equal(sameBuild.evidence.length, 1);

  // A parameter count is not a date: it must not block the match.
  const known2 = new Map([[matchForm('qwen3-8-2-4t-a95b'), 'qwen/qwen3-8-2-4t-a95b']]);
  const ourNames2 = new Map([['qwen/qwen3-8-2-4t-a95b', 'Qwen3.8 2.4T A95B']]);
  const params = aaEvidence(
    { fetchedAt: new Date().toISOString(), indexVersion: 4.3, calls: 1, models: [m('qwen3-8-2-4t-a95b', 'Qwen3.8 2.4T A95B')] },
    known2, new Date().toISOString(), (k) => ourNames2.get(k) ?? '',
  );
  assert.equal(params.evidence.length, 1);
});

test('a score for a dated build goes to the dated model we sell, not the older one', () => {
  const known = new Map([
    [matchForm('deepseek-v4-pro'), 'deepseek/deepseek-v4-pro'],
    [matchForm('deepseek-v4-pro-0813'), 'deepseek/deepseek-v4-pro-0813'],
  ]);
  const names = new Map([
    ['deepseek/deepseek-v4-pro', 'DeepSeek: DeepSeek V4 Pro 0423'],
    ['deepseek/deepseek-v4-pro-0813', 'DeepSeek: DeepSeek V4 Pro 0813'],
  ]);
  const r = aaEvidence(
    { fetchedAt: new Date().toISOString(), indexVersion: 4.3, calls: 1, models: [{
      id: 'x', slug: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro 0813 (Reasoning, Max Effort)', release_date: null, model_creator: null,
      evaluations: { artificial_analysis_intelligence_index: null, artificial_analysis_coding_index: 68.8, artificial_analysis_agentic_index: null },
    }] },
    known, new Date().toISOString(), (k) => names.get(k) ?? '',
  );
  assert.deepEqual(r.evidence.map((e) => [e.modelKey, e.value]), [['deepseek/deepseek-v4-pro-0813', 68.8]]);
  assert.equal(r.wrongSnapshot.length, 0);
});

test('the model the user declared always gets an answer', () => {
  const s = two([aa('v/a', 70), aa('v/b', 60)]);
  const recommended = recommend(s, req({ currentModelKey: 'v/a', priority: 'quality' }));
  assert.equal(recommended.savings?.outcome, 'already-recommended');

  const unknownModel = recommend(s, req({ currentModelKey: 'v/unknown' }));
  assert.equal(unknownModel.savings?.outcome, 'unknown-model');

  const withoutEvidence = snapshot(
    [model('v/a'), model('v/b'), model('v/c')],
    [
      offer({ id: 'a', modelKey: 'v/a', providerId: 'alfa', prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1 } }),
      offer({ id: 'c', modelKey: 'v/c', providerId: 'gamma', prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1 } }),
    ],
    [aa('v/a', 70)],
  );
  assert.equal(recommend(withoutEvidence, req({ currentModelKey: 'v/c' })).savings?.outcome, 'compared');
  assert.equal(recommend(withoutEvidence, req({ currentModelKey: 'v/b' })).savings?.outcome, 'no-seller');
});
