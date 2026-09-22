import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costOf } from '../src/engine/cost.js';
import { offer } from './fixtures.js';

const mix = { input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 };

test('adds input and output on the same provider', () => {
  const c = costOf(offer({ id: 'a', modelKey: 'v/m', providerId: 'p' }), mix);
  assert.equal(c.complete, true);
  assert.equal(c.tokensUsd, 6); // 1 USD input + 5 USD output
  assert.equal(c.totalUsd, 6);
});

test('a missing price never becomes zero', () => {
  const o = offer({ id: 'a', modelKey: 'v/m', providerId: 'p' });
  o.prices.outputPerMTok = null;
  const c = costOf(o, mix);
  assert.equal(c.complete, false);
  assert.equal(c.totalUsd, null);
  assert.deepEqual(c.missing, ['Output']);
});

test('a missing price the scenario does not use does not block the calculation', () => {
  const o = offer({ id: 'a', modelKey: 'v/m', providerId: 'p' });
  o.prices.cacheWritePerMTok = null;
  const c = costOf(o, mix); // the scenario does not use the cache
  assert.equal(c.complete, true);
  assert.equal(c.totalUsd, 6);
});

test('percentage fees apply to the token spend', () => {
  const o = offer({
    id: 'a',
    modelKey: 'v/m',
    providerId: 'p',
    fees: [{ kind: 'credit_fee', percent: 10, note: 'credit fee', sourceUrl: 'https://example.test' }],
  });
  const c = costOf(o, mix);
  assert.equal(c.feesUsd, 0.6);
  assert.equal(c.totalUsd, 6.6);
});

test('a fixed fee and a subscription add up to the total', () => {
  const o = offer({
    id: 'a',
    modelKey: 'v/m',
    providerId: 'p',
    fees: [{ kind: 'subscription', amountUsd: 20, note: 'mandatory subscription', sourceUrl: 'https://example.test' }],
  });
  assert.equal(costOf(o, mix).totalUsd, 26);
});

test('a fee with no verified amount stays declared but is not invented', () => {
  const o = offer({
    id: 'a',
    modelKey: 'v/m',
    providerId: 'p',
    fees: [{ kind: 'credit_fee', note: 'fee on credits', sourceUrl: 'https://example.test' }],
  });
  const c = costOf(o, mix);
  assert.deepEqual(c.unquantifiedFees, ['fee on credits']);
  assert.equal(c.feesUsd, 0);
  assert.equal(c.totalUsd, 6);
});

test('the minimum top-up is a constraint, not a cost', () => {
  const o = offer({
    id: 'a',
    modelKey: 'v/m',
    providerId: 'p',
    fees: [{ kind: 'minimum_topup', amountUsd: 10, note: 'minimum top-up 10 USD', sourceUrl: 'https://example.test' }],
  });
  const c = costOf(o, mix);
  assert.deepEqual(c.constraints, ['minimum top-up 10 USD']);
  assert.equal(c.totalUsd, 6);
});
