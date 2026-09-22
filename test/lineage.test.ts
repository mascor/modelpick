import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deprecatedKeys, lineOf, successorOf } from '../src/engine/lineage.js';

test('a deprecated model takes its dated builds and seller variants with it, not other versions', () => {
  const all = [
    'deepseek/deepseek-v4-flash',
    'deepseek/deepseek-v4-flash-0731',
    'deepseek/deepseek-v4-flash-20260731',
    'deepseek/deepseek-v4-flash:thinking',
    'deepseek/deepseek-v4-flash-0731@eu',
    'deepseek/deepseek-v4-flash-flex',
    'deepseek/deepseek-v4-1-flash',
    'deepseek/deepseek-v4-pro',
    'openai/gpt-4',
    'openai/gpt-4-0613',
    'openai/gpt-4-1',
    'openai/gpt-4o',
    'other/deepseek-v4-flash',
  ];
  const out = deprecatedKeys(['deepseek/deepseek-v4-flash', 'openai/gpt-4'], all);
  assert.deepEqual(
    [...out].sort(),
    [
      'deepseek/deepseek-v4-flash',
      'deepseek/deepseek-v4-flash-0731',
      'deepseek/deepseek-v4-flash-0731@eu',
      'deepseek/deepseek-v4-flash-20260731',
      'deepseek/deepseek-v4-flash-flex',
      'deepseek/deepseek-v4-flash:thinking',
      'openai/gpt-4',
      'openai/gpt-4-0613',
    ],
  );
});

test('the line of a model is its name without the version', () => {
  assert.deepEqual(lineOf('deepseek/deepseek-v4-1-flash'), { line: 'deepseek/deepseek-flash', version: [4, 1] });
  assert.deepEqual(lineOf('deepseek/deepseek-v4-flash-0731'), { line: 'deepseek/deepseek-flash', version: [4] });
  assert.deepEqual(lineOf('anthropic/claude-sonnet-4-5'), { line: 'anthropic/claude-sonnet', version: [4, 5] });
  assert.equal(lineOf('deepseek/deepseek-v4-1-flash:thinking'), null);
  assert.equal(lineOf('deepseek/deepseek-v4-1-flash-free'), null);
});

test('the successor is the newest version of the same line, never another line', () => {
  const unmeasured = [
    'deepseek/deepseek-v4-1-flash',
    'deepseek/deepseek-v4-1-flash-flex',
    'deepseek/deepseek-v5-pro',
    'google/gemini-3-5-flash-lite',
  ];
  assert.equal(successorOf('deepseek/deepseek-v4-flash-0731', unmeasured), 'deepseek/deepseek-v4-1-flash');
  assert.equal(successorOf('deepseek/deepseek-v4-1-flash', unmeasured), null);
  assert.equal(successorOf('google/gemini-3-flash', unmeasured), null);
  assert.equal(successorOf('deepseek/deepseek-v4-pro-0813', unmeasured), 'deepseek/deepseek-v5-pro');
});

test('a full date in the name is not a version', () => {
  assert.equal(lineOf('openai/gpt-4o-2024-05-13')?.version.join('.'), undefined);
  assert.equal(successorOf('openai/gpt-4o-2024-05-13', ['openai/gpt-4o-2024-11-20']), null);
});
