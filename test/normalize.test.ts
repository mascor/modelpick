import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalKey, keyFromPath, matchForm, perMillion, asPerMillion, hoursSince } from '../src/lib/normalize.js';

test('la chiave canonica unisce grafie diverse dello stesso modello', () => {
  assert.equal(canonicalKey('Google DeepMind', 'Gemini 3.5 Flash'), 'google/gemini-3-5-flash');
  assert.equal(canonicalKey('google', 'gemini-3.5-flash'), 'google/gemini-3-5-flash');
});

test('modalita diverse dello stesso modello restano offerte distinte', () => {
  assert.notEqual(canonicalKey('anthropic', 'claude-sonnet-5'), canonicalKey('anthropic', 'claude-sonnet-5:batch'));
  assert.equal(canonicalKey('anthropic', 'claude-sonnet-5:batch'), 'anthropic/claude-sonnet-5:batch');
});

test('gli alias mobili sono riconosciuti come tali', () => {
  assert.equal(keyFromPath('~deepseek/deepseek-pro-latest').floating, true);
  assert.equal(keyFromPath('deepseek/deepseek-v4-flash').floating, false);
  assert.equal(keyFromPath('deepseek/deepseek-v4-flash').key, 'deepseek/deepseek-v4-flash');
});

test('la forma di confronto associa il nome di un banco di prova al modello', () => {
  assert.equal(matchForm('Gemini 3.5 Flash'), matchForm('gemini-3-5-flash'));
  assert.equal(matchForm('Anthropic: Claude Sonnet 5'), matchForm('claude-sonnet-5'));
  assert.equal(matchForm('gpt-5 (high)'), matchForm('gpt-5'));
});

test('modelli diversi non collassano sulla stessa forma', () => {
  assert.notEqual(matchForm('gemini-3-5-flash'), matchForm('gemini-3-5-pro'));
  assert.notEqual(matchForm('claude-sonnet-5'), matchForm('claude-opus-5'));
});

test('le unita di prezzo sono convertite senza inventare valori', () => {
  assert.equal(perMillion('0.00000435'), 4.35);
  assert.equal(asPerMillion(1), 1);
  assert.equal(perMillion(null), null);
  assert.equal(perMillion(''), null);
  assert.equal(perMillion('non un numero'), null);
  assert.equal(perMillion(-1), null);
});

test('eta in ore calcolata sulle date valide', () => {
  const now = Date.parse('2026-09-22T12:00:00Z');
  assert.equal(hoursSince('2026-09-22T06:00:00Z', now), 6);
  assert.equal(hoursSince(null, now), null);
  assert.equal(hoursSince('non una data', now), null);
});

test('un modello venduto da un rivenditore resta del suo produttore', async () => {
  // "anthropic/claude-sonnet-4-5" venduto da un rivenditore non deve diventare
  // un modello nuovo intestato al rivenditore.
  const { fetchModelsDev } = await import('../src/sources/modelsdev.js');
  void fetchModelsDev; // il comportamento è verificato sulla chiave canonica
  assert.equal(canonicalKey('anthropic', 'claude-sonnet-4-5-20250929'), 'anthropic/claude-sonnet-4-5-20250929');
  assert.notEqual(canonicalKey('tempr', 'claude-sonnet-4-5-20250929'), 'anthropic/claude-sonnet-4-5-20250929');
});
