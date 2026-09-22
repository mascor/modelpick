import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOffers } from '../src/pipeline/validate.js';
import { offer, snapshot } from './fixtures.js';

test('drops offers without any price', () => {
  const o = offer({ id: 'a', modelKey: 'v/m', providerId: 'p' });
  o.prices = { inputPerMTok: null, outputPerMTok: null, cacheReadPerMTok: null, cacheWritePerMTok: null };
  const r = validateOffers([o], null);
  assert.equal(r.kept.length, 0);
  assert.match(r.dropped[0]!.reason, /no price/);
});

test('drops out-of-range prices as a likely unit error', () => {
  const o = offer({ id: 'a', modelKey: 'v/m', providerId: 'p' });
  o.prices.inputPerMTok = 50_000;
  assert.equal(validateOffers([o], null).kept.length, 0);
});

test('quarantines an abnormal change instead of trusting it', () => {
  const before = offer({ id: 'a', modelKey: 'v/m', providerId: 'p' });
  const after = offer({ id: 'a', modelKey: 'v/m', providerId: 'p' });
  after.prices.inputPerMTok = 100; // from 1 to 100 USD/1M
  const r = validateOffers([after], snapshot([], [before], []));
  assert.equal(r.kept.length, 1);
  assert.match(r.kept[0]!.quarantine!, /abnormal change/);
});

test('a normal change is not quarantined', () => {
  const before = offer({ id: 'a', modelKey: 'v/m', providerId: 'p' });
  const after = offer({ id: 'a', modelKey: 'v/m', providerId: 'p' });
  after.prices.inputPerMTok = 1.2;
  const r = validateOffers([after], snapshot([], [before], []));
  assert.equal(r.kept[0]!.quarantine, null);
});
