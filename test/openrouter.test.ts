import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endpointRouting } from '../src/sources/openrouter.js';

test('the routing slug keeps the endpoint suffix: a base slug matches every endpoint of the provider', () => {
  // Measured on 2026-09-26: "google-ai-studio" billed the standard price,
  // "google-ai-studio/flex" half of it.
  assert.deepEqual(endpointRouting('google-ai-studio/flex'), { routingSlug: 'google-ai-studio/flex', serviceTier: 'flex' });
  assert.deepEqual(endpointRouting('google-vertex/global/priority'), { routingSlug: 'google-vertex/global/priority', serviceTier: 'priority' });
  assert.deepEqual(endpointRouting('gmicloud/fp8'), { routingSlug: 'gmicloud/fp8', serviceTier: null });
  assert.deepEqual(endpointRouting('deepinfra'), { routingSlug: 'deepinfra', serviceTier: null });
});

test('an endpoint without a tag cannot be pinned', () => {
  assert.deepEqual(endpointRouting(null), { routingSlug: null, serviceTier: null });
  assert.deepEqual(endpointRouting(undefined), { routingSlug: null, serviceTier: null });
});
