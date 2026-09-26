import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchInfrabase, readListing } from '../src/sources/infrabase.js';

const row = (name: string) => ({ name, hq_country: 'US', gdpr: true });

test('a listing is read page by page until next_offset is null', async () => {
  const seen: string[] = [];
  const get = async (url: string) => {
    seen.push(url);
    const offset = Number(new URL(url).searchParams.get('offset'));
    if (offset === 0) return { results: [row('A'), row('B')], next_offset: 2 };
    if (offset === 2) return { results: [row('C')], next_offset: null };
    throw new Error('unexpected page');
  };
  const rows = await readListing('category=inference-apis', get);
  assert.deepEqual(rows.map((r) => r.name), ['A', 'B', 'C']);
  assert.equal(seen.length, 2);
});

test('a cursor that does not move forward ends the listing', async () => {
  let calls = 0;
  const rows = await readListing('category=inference-apis', async () => (calls++, { results: [row('A')], next_offset: 0 }));
  assert.equal(rows.length, 1);
  assert.equal(calls, 1);
});

test('only providers the listings miss get a targeted search', async () => {
  const searched: string[] = [];
  const get = async (url: string) => {
    const q = new URL(url).searchParams.get('q');
    if (q) {
      searched.push(q);
      return { results: q === 'Rare Cloud' ? [row('Rare Cloud')] : [] };
    }
    return { results: [row('Together AI'), row('DeepInfra')], next_offset: null };
  };
  const res = await fetchInfrabase(['DeepInfra', 'Together', 'Rare Cloud'], get);
  assert.deepEqual(searched, ['Rare Cloud']);
  assert.deepEqual(res.providers.map((p) => p.name).sort(), ['DeepInfra', 'Rare Cloud', 'Together AI']);
});
