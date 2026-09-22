import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOffers } from '../src/pipeline/validate.js';
import { offer, snapshot } from './fixtures.js';

test('scarta le offerte senza alcun prezzo', () => {
  const o = offer({ id: 'a', modelKey: 'v/m', providerId: 'p' });
  o.prices = { inputPerMTok: null, outputPerMTok: null, cacheReadPerMTok: null, cacheWritePerMTok: null };
  const r = validateOffers([o], null);
  assert.equal(r.kept.length, 0);
  assert.match(r.dropped[0]!.reason, /nessun prezzo/);
});

test('scarta i prezzi fuori scala come probabile errore di unita', () => {
  const o = offer({ id: 'a', modelKey: 'v/m', providerId: 'p' });
  o.prices.inputPerMTok = 50_000;
  assert.equal(validateOffers([o], null).kept.length, 0);
});

test('mette in quarantena una variazione anomala invece di fidarsi', () => {
  const before = offer({ id: 'a', modelKey: 'v/m', providerId: 'p' });
  const after = offer({ id: 'a', modelKey: 'v/m', providerId: 'p' });
  after.prices.inputPerMTok = 100; // da 1 a 100 USD/1M
  const r = validateOffers([after], snapshot([], [before], []));
  assert.equal(r.kept.length, 1);
  assert.match(r.kept[0]!.quarantine!, /variazione anomala/);
});

test('una variazione normale non viene messa in quarantena', () => {
  const before = offer({ id: 'a', modelKey: 'v/m', providerId: 'p' });
  const after = offer({ id: 'a', modelKey: 'v/m', providerId: 'p' });
  after.prices.inputPerMTok = 1.2;
  const r = validateOffers([after], snapshot([], [before], []));
  assert.equal(r.kept[0]!.quarantine, null);
});
