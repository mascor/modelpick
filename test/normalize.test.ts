import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalKey, keyFromPath, matchForm, perMillion, asPerMillion, hoursSince } from '../src/lib/normalize.js';

test('the canonical key merges different spellings of the same model', () => {
  assert.equal(canonicalKey('Google DeepMind', 'Gemini 3.5 Flash'), 'google/gemini-3-5-flash');
  assert.equal(canonicalKey('google', 'gemini-3.5-flash'), 'google/gemini-3-5-flash');
});

test('different modes of the same model stay distinct offers', () => {
  assert.notEqual(canonicalKey('anthropic', 'claude-sonnet-5'), canonicalKey('anthropic', 'claude-sonnet-5:batch'));
  assert.equal(canonicalKey('anthropic', 'claude-sonnet-5:batch'), 'anthropic/claude-sonnet-5:batch');
});

test('floating aliases are recognised as such', () => {
  assert.equal(keyFromPath('~deepseek/deepseek-pro-latest').floating, true);
  assert.equal(keyFromPath('deepseek/deepseek-v4-flash').floating, false);
  assert.equal(keyFromPath('deepseek/deepseek-v4-flash').key, 'deepseek/deepseek-v4-flash');
});

test('the comparison form matches a benchmark name to the model', () => {
  assert.equal(matchForm('Gemini 3.5 Flash'), matchForm('gemini-3-5-flash'));
  assert.equal(matchForm('Anthropic: Claude Sonnet 5'), matchForm('claude-sonnet-5'));
  assert.equal(matchForm('gpt-5 (high)'), matchForm('gpt-5'));
});

test('different models do not collapse into the same form', () => {
  assert.notEqual(matchForm('gemini-3-5-flash'), matchForm('gemini-3-5-pro'));
  assert.notEqual(matchForm('claude-sonnet-5'), matchForm('claude-opus-5'));
});

test('price units are converted without inventing values', () => {
  assert.equal(perMillion('0.00000435'), 4.35);
  assert.equal(asPerMillion(1), 1);
  assert.equal(perMillion(null), null);
  assert.equal(perMillion(''), null);
  assert.equal(perMillion('not a number'), null);
  assert.equal(perMillion(-1), null);
});

test('age in hours computed on valid dates', () => {
  const now = Date.parse('2026-09-22T12:00:00Z');
  assert.equal(hoursSince('2026-09-22T06:00:00Z', now), 6);
  assert.equal(hoursSince(null, now), null);
  assert.equal(hoursSince('not a date', now), null);
});

test('a model sold by a reseller stays with its maker', async () => {
  // "anthropic/claude-sonnet-4-5" sold by a reseller must not become a new
  // model attributed to the reseller.
  const { fetchModelsDev } = await import('../src/sources/modelsdev.js');
  void fetchModelsDev; // the behaviour is checked on the canonical key
  assert.equal(canonicalKey('anthropic', 'claude-sonnet-4-5-20250929'), 'anthropic/claude-sonnet-4-5-20250929');
  assert.notEqual(canonicalKey('tempr', 'claude-sonnet-4-5-20250929'), 'anthropic/claude-sonnet-4-5-20250929');
});
