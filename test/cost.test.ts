import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costOf } from '../src/engine/cost.js';
import { offer } from './fixtures.js';

const mix = { input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 };

test('somma input e output sullo stesso provider', () => {
  const c = costOf(offer({ id: 'a', modelKey: 'v/m', providerId: 'p' }), mix);
  assert.equal(c.complete, true);
  assert.equal(c.tokensUsd, 6); // 1 USD input + 5 USD output
  assert.equal(c.totalUsd, 6);
});

test('un prezzo mancante non diventa mai zero', () => {
  const o = offer({ id: 'a', modelKey: 'v/m', providerId: 'p' });
  o.prices.outputPerMTok = null;
  const c = costOf(o, mix);
  assert.equal(c.complete, false);
  assert.equal(c.totalUsd, null);
  assert.deepEqual(c.missing, ['Output']);
});

test('un prezzo mancante che lo scenario non usa non blocca il calcolo', () => {
  const o = offer({ id: 'a', modelKey: 'v/m', providerId: 'p' });
  o.prices.cacheWritePerMTok = null;
  const c = costOf(o, mix); // lo scenario non usa la cache
  assert.equal(c.complete, true);
  assert.equal(c.totalUsd, 6);
});

test('le commissioni percentuali si applicano alla spesa per token', () => {
  const o = offer({
    id: 'a',
    modelKey: 'v/m',
    providerId: 'p',
    fees: [{ kind: 'credit_fee', percent: 10, note: 'commissione crediti', sourceUrl: 'https://example.test' }],
  });
  const c = costOf(o, mix);
  assert.equal(c.feesUsd, 0.6);
  assert.equal(c.totalUsd, 6.6);
});

test('una commissione fissa e un abbonamento si sommano al totale', () => {
  const o = offer({
    id: 'a',
    modelKey: 'v/m',
    providerId: 'p',
    fees: [{ kind: 'subscription', amountUsd: 20, note: 'abbonamento obbligatorio', sourceUrl: 'https://example.test' }],
  });
  assert.equal(costOf(o, mix).totalUsd, 26);
});

test('una commissione senza importo verificato resta dichiarata ma non inventata', () => {
  const o = offer({
    id: 'a',
    modelKey: 'v/m',
    providerId: 'p',
    fees: [{ kind: 'credit_fee', note: 'commissione sui crediti', sourceUrl: 'https://example.test' }],
  });
  const c = costOf(o, mix);
  assert.deepEqual(c.unquantifiedFees, ['commissione sui crediti']);
  assert.equal(c.feesUsd, 0);
  assert.equal(c.totalUsd, 6);
});

test('la ricarica minima e un vincolo, non un costo', () => {
  const o = offer({
    id: 'a',
    modelKey: 'v/m',
    providerId: 'p',
    fees: [{ kind: 'minimum_topup', amountUsd: 10, note: 'ricarica minima 10 USD', sourceUrl: 'https://example.test' }],
  });
  const c = costOf(o, mix);
  assert.deepEqual(c.constraints, ['ricarica minima 10 USD']);
  assert.equal(c.totalUsd, 6);
});
