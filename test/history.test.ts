import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addSnapshot, pointsOf, seriesFor, type PriceHistory } from '../src/pipeline/history.js';
import { costOf } from '../src/engine/cost.js';
import { SCENARIOS, TASK_IDS } from '../src/engine/scenarios.js';
import { evidence, model, now, offer, snapshot } from './fixtures.js';

const key = 'anthropic/claude-sonnet-5';
const cheap = offer({ id: 'cheap', modelKey: key, providerId: 'anthropic', prices: { inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1.25 } });
const dear = offer({ id: 'dear', modelKey: key, providerId: 'anthropic', prices: { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheWritePerMTok: 3.75 } });
const unmeasured = offer({ id: 'x', modelKey: 'anthropic/other', providerId: 'anthropic' });
const snap = (runId: string, at: Date, offers = [cheap, dear, unmeasured]) =>
  snapshot([model(key), model('anthropic/other')], offers.map((o) => ({ ...o, observedAt: at.toISOString() })), [evidence(key, 70)], { runId, generatedAt: at.toISOString() });
const fresh = (): PriceHistory => ({ version: 1, tasks: [...TASK_IDS], runs: [], models: {} });

test('a point is the monthly cost of the cheapest offer we would recommend, per kind of work', () => {
  const points = pointsOf(snap('r1', now));
  assert.deepEqual([...points.keys()], [key], 'models without quality evidence are left out');
  const [at, ...costs] = points.get(key)!;
  assert.equal(at, now.toISOString());
  const expected = TASK_IDS.map((t) => Math.round(costOf(cheap, SCENARIOS[t].monthly).totalUsd! * 100) / 100);
  assert.deepEqual(costs, expected);
});

test('the same run is never counted twice, and points stay in time order', () => {
  const h = fresh();
  const later = new Date(now.getTime() + 86_400_000);
  addSnapshot(h, snap('r2', later));
  addSnapshot(h, snap('r1', now));
  addSnapshot(h, snap('r2', later));
  assert.deepEqual(h.models[key]!.map((p) => p[0]), [now.toISOString(), later.toISOString()]);
});

test('points older than the kept window are dropped', () => {
  const h = fresh();
  addSnapshot(h, snap('old', new Date(now.getTime() - 500 * 86_400_000)));
  addSnapshot(h, snap('new', now));
  assert.equal(h.models[key]!.length, 1);
});

test('the series of one kind of work skips updates where no offer qualified', () => {
  const h = fresh();
  addSnapshot(h, snap('r1', now));
  const s = seriesFor(h, key, 'bug');
  assert.equal(s.length, 1);
  assert.equal(s[0]!.usd, Math.round(costOf(cheap, SCENARIOS.bug.monthly).totalUsd! * 100) / 100);
  assert.deepEqual(seriesFor(h, 'nobody/none', 'bug'), []);
  assert.deepEqual(seriesFor(null, key, 'bug'), []);
});
