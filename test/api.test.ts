import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('the API answers in English and the legacy Italian paths still work', async () => {
  process.env.MODELPICK_DATA_DIR ??= await mkdtemp(join(tmpdir(), 'mp-api-'));
  const { buildServer } = await import('../src/server/server.js');
  const app = await buildServer();
  try {
    const health = await app.inject({ url: '/health' });
    assert.equal(health.statusCode, 200);
    assert.equal(health.json().status, 'ok');
    assert.equal((await app.inject({ url: '/salute' })).json().stato, 'ok');

    const status = (await app.inject({ url: '/api/status' })).json();
    assert.ok('updatedAt' in status && 'lastRun' in status && 'storedRuns' in status);
    const legacyStatus = (await app.inject({ url: '/api/stato' })).json();
    assert.ok('aggiornatoIl' in legacyStatus && 'ultimaEsecuzione' in legacyStatus);

    const sources = (await app.inject({ url: '/api/sources' })).json() as { state: string }[];
    assert.ok(sources.length > 0 && sources.every((s) => typeof s.state === 'string'));
    assert.ok(((await app.inject({ url: '/api/fonti' })).json() as { stato: string }[]).every((s) => typeof s.stato === 'string'));

    const rec = (await app.inject({ url: '/api/recommendation' })).json();
    assert.ok('error' in rec || 'recommendation' in rec);
    const history = await app.inject({ url: '/api/history' });
    assert.equal(history.statusCode, 400);
    assert.match(history.json().error, /model/);

    for (const url of ['/api/models', '/api/scenarios', '/api/modelli', '/api/scenari']) {
      assert.equal((await app.inject({ url })).statusCode, 200, url);
    }
    const missing = await app.inject({ url: '/api/nothing-here' });
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error, 'Not found.');
  } finally {
    await app.close();
  }
});

test('old links with Italian values land on the same choice', async () => {
  const { parseRequest } = await import('../src/server/server.js');
  const old = parseRequest({ task: 'analisi', priority: 'qualita' });
  assert.equal(old.task, 'analysis');
  assert.equal(old.priority, 'quality');
  assert.equal(parseRequest({ task: 'piccole-modifiche', priority: 'risparmio' }).task, 'small-changes');
  assert.equal(parseRequest({ priority: 'risparmio' }).priority, 'cheap');
  assert.equal(parseRequest({ task: 'new-features', priority: 'balanced' }).task, 'new-features');
  assert.equal(parseRequest({ task: 'nonsense' }).task, 'bug');
});
