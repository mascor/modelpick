import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breakEven, comparePlan, planMonth, retentionUntil } from '../src/engine/plans.js';
import { recommend } from '../src/engine/recommend.js';
import type { Plan } from '../src/types.js';
import { evidence, model, offer, snapshot } from './fixtures.js';

const close = (a: number | null | undefined, b: number) => assert.ok(a !== null && a !== undefined && Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('below the allowance a month costs the fee alone', () => {
  const m = planMonth(10, 60, 20, 20);
  assert.equal(m.coveredShare, 1);
  assert.equal(m.overageUsd, 0);
  assert.equal(m.totalUsd, 10);
});

test('exactly at the allowance nothing is charged beyond the fee', () => {
  const m = planMonth(10, 15, 15, 15);
  assert.equal(m.coveredShare, 1);
  assert.equal(m.totalUsd, 10);
});

test('beyond the allowance only the uncovered share is paid, at pay-as-you-go prices', () => {
  // Uses 30 of a 15 allowance: half the work is covered, the other half costs half of 24.
  const m = planMonth(10, 15, 30, 24);
  close(m.coveredShare, 0.5);
  close(m.overageUsd, 12);
  close(m.totalUsd, 22);
});

test('break-even: the plan wins from the fee upwards when pay-as-you-go is no dearer than the provider', () => {
  assert.deepEqual(breakEven(10, 60, 2, 3, 2), { fromUsd: 10, toUsd: null });
});

test('break-even: an upper end where the allowance runs out and pay-as-you-go costs more', () => {
  // Provider 2 per unit, plan draws 3 of 60 and charges 3 beyond: equal at k = (60 - 10) / (3 - 2) = 50 units.
  const r = breakEven(10, 60, 2, 3, 3);
  assert.equal(r?.fromUsd, 10);
  close(r?.toUsd, 100);
});

test('break-even: never, when the allowance is gone before the provider reaches the fee', () => {
  // Provider 18 per unit, the allowance covers 15/31 of a unit: at the fee the plan is already paying overage.
  assert.equal(breakEven(10, 15, 18, 31, 31), null);
});

test('break-even: a lower end past the allowance when pay-as-you-go is cheaper than the provider', () => {
  // Allowance covers 0.5 units; beyond it the plan costs 5 per unit against the provider's 20.
  const r = breakEven(10, 15, 20, 30, 5);
  // 10 + (k - 0.5) * 5 = 20k -> k = 7.5 / 15 = 0.5: exactly where the allowance ends.
  close(r?.fromUsd, 10);
  assert.equal(r?.toUsd, null);
});

test('reads the end date of a zero-retention agreement', () => {
  assert.equal(retentionUntil('ZDR_UNTIL:2026-09-30'), '2026-09-30');
  assert.equal(retentionUntil(null), null);
  assert.equal(retentionUntil('something else'), null);
});

const PLAN: Plan = {
  id: 'go',
  name: 'Go',
  providerId: 'go-provider',
  monthlyFeeUsd: 10,
  fiveHourPercent: 20,
  weeklyPercent: 50,
  overageProviderId: 'zen',
  models: {
    m: { capUsd: 60, retentionDays: 0, trainsOnData: false },
    peaky: { capUsd: 60, retentionDays: 0, trainsOnData: false, peakPrices: { inputPerMTok: 2, outputPerMTok: 10 } },
  },
  sourceUrl: 'https://example.test/go',
  checkedAt: new Date().toISOString().slice(0, 10),
};

const usage = { input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 };
const req = { task: 'bug' as const, priority: 'balanced' as const, lang: 'en' as const, usage };

function fixture() {
  const go = offer({ id: 'go-m', modelKey: 'v/m', providerId: 'go-provider', remoteModelId: 'm', planId: 'go', opencodeVerified: true });
  const cheap = offer({ id: 'cheap', modelKey: 'v/m', providerId: 'cheap', opencodeVerified: true, prices: { inputPerMTok: 0.5, outputPerMTok: 1, cacheReadPerMTok: null, cacheWritePerMTok: null } });
  const dear = offer({ id: 'dear', modelKey: 'v/m', providerId: 'dear', opencodeVerified: true, prices: { inputPerMTok: 3, outputPerMTok: 9, cacheReadPerMTok: null, cacheWritePerMTok: null } });
  const unverified = offer({ id: 'unknown', modelKey: 'v/m', providerId: 'unknown', opencodeVerified: false, prices: { inputPerMTok: 0.01, outputPerMTok: 0.01, cacheReadPerMTok: null, cacheWritePerMTok: null } });
  const peaky = offer({ id: 'go-peaky', modelKey: 'v/peaky', providerId: 'go-provider', remoteModelId: 'peaky', planId: 'go', opencodeVerified: true });
  return snapshot([model('v/m'), model('v/peaky')], [go, cheap, dear, unverified, peaky], [evidence('v/m', 60)], { plans: [structuredClone(PLAN)] });
}

test('compares the plan with the cheapest usable provider, never with an unverified one', () => {
  const cmp = comparePlan(fixture(), 'go', req)!;
  const row = cmp.rows.find((r) => r.planModelId === 'm')!;
  assert.equal(row.direct?.offer.id, 'cheap');
  close(row.direct?.cost.totalUsd, 1.5);
  // The fixture price is 1 in + 5 out: 6 of a 60 allowance, so the month is the fee.
  close(row.month?.drawUsd, 6);
  close(row.month?.totalUsd, 10);
  close(row.savingUsd, -8.5);
  assert.equal(row.overageFrom, 'plan-list');
});

test('draws the allowance at busy-hour prices where the plan has them', () => {
  const row = comparePlan(fixture(), 'go', req)!.rows.find((r) => r.planModelId === 'peaky')!;
  assert.equal(row.peakApplied, true);
  close(row.month?.drawUsd, 12); // 2 in + 10 out
});

test('plan offers never compete as a pay-per-token price on the main page', () => {
  const s = fixture();
  // Make the plan's list price the cheapest there is: it must still not win.
  s.offers.find((o) => o.id === 'go-m')!.prices = { inputPerMTok: 0.001, outputPerMTok: 0.001, cacheReadPerMTok: null, cacheWritePerMTok: null };
  const rec = recommend(s, req);
  assert.notEqual(rec.everyday?.offer.id, 'go-m');
  assert.ok(!rec.everyday?.alternatives.some((a) => a.offer.id === 'go-m'));
});

test('terms read long ago are flagged as possibly out of date', () => {
  const s = fixture();
  s.plans![0]!.checkedAt = '2020-01-01';
  assert.equal(comparePlan(s, 'go', req)!.stale, true);
  assert.equal(comparePlan(fixture(), 'go', req)!.stale, false);
});

test('a month the allowance does not cover is "not enough", never a saving', () => {
  const s = fixture();
  s.plans![0]!.models.m!.capUsd = 3; // the month draws 6
  const row = comparePlan(s, 'go', req)!.rows.find((r) => r.planModelId === 'm')!;
  assert.equal(row.verdict, 'not-enough');
  assert.equal(row.savingUsd, null);
  close(row.month?.coveredShare, 0.5);
});

test('the plan wins only when the fee covers the month and the provider costs more', () => {
  const s = fixture();
  for (const id of ['cheap', 'dear']) s.offers.find((o) => o.id === id)!.prices = { inputPerMTok: 6, outputPerMTok: 6, cacheReadPerMTok: null, cacheWritePerMTok: null };
  const cmp = comparePlan(s, 'go', req)!;
  const row = cmp.rows.find((r) => r.planModelId === 'm')!;
  assert.equal(row.verdict, 'plan');
  close(row.savingUsd, 2); // 12 at the provider against the 10 fee
  assert.equal(cmp.summary.best?.planModelId, 'm');
});
