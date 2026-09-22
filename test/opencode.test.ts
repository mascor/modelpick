import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOpenCodeConfig } from '../src/engine/opencode.js';
import { model, offer } from './fixtures.js';

const everyday = {
  model: model('anthropic/claude-sonnet-5'),
  offer: offer({ id: 'a', modelKey: 'anthropic/claude-sonnet-5', providerId: 'anthropic', remoteModelId: 'claude-sonnet-5', apiKeyEnv: 'ANTHROPIC_API_KEY' }),
};
const hard = {
  model: model('anthropic/claude-opus-5'),
  offer: offer({ id: 'b', modelKey: 'anthropic/claude-opus-5', providerId: 'openrouter', sourceId: 'openrouter', remoteModelId: 'anthropic/claude-opus-5', apiKeyEnv: 'OPENROUTER_API_KEY', access: 'intermediary', broker: 'OpenRouter' }),
};

test('the configuration uses the OpenCode provider/model format', () => {
  const c = buildOpenCodeConfig(everyday, hard)!;
  assert.equal(c.everydayId, 'anthropic/claude-sonnet-5');
  assert.equal(c.backupId, 'openrouter/anthropic/claude-opus-5');
  assert.equal(JSON.parse(c.json).model, 'anthropic/claude-sonnet-5');
  assert.equal(JSON.parse(c.json).$schema, 'https://opencode.ai/config.json');
});

test('no API key ever ends up in the generated file', () => {
  const c = buildOpenCodeConfig(everyday, hard)!;
  assert.ok(!/sk-|api[_-]?key"\s*:\s*"[^{]/i.test(c.json));
  assert.deepEqual(c.envVars, ['ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY']);
  assert.match(c.instructions.join(' '), /non la chiede e non la riceve mai/);
});

test('we do not promise an automatic switch to the backup model', () => {
  const c = buildOpenCodeConfig(everyday, hard)!;
  assert.match(c.instructions.join(' '), /non passa automaticamente/);
  assert.equal(JSON.parse(c.json).small_model, undefined);
});

test('without an everyday model no configuration is generated', () => {
  assert.equal(buildOpenCodeConfig(null, hard), null);
});
