import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { browserLang } from '../src/i18n.js';

test('italiano solo se la prima lingua del browser e l italiano', () => {
  assert.equal(browserLang('it-IT,it;q=0.9,en;q=0.8'), 'it');
  assert.equal(browserLang('it'), 'it');
  assert.equal(browserLang('en-US,en;q=0.9,it;q=0.8'), 'en');
  assert.equal(browserLang('de-DE,de;q=0.9'), 'en');
  assert.equal(browserLang('fr;q=0.5,it;q=0.9'), 'it'); // conta il peso, non l ordine
  assert.equal(browserLang(undefined), 'en');
  assert.equal(browserLang('*'), 'en');
});

test('le pagine italiane rimandano all inglese chi non ha chiesto l italiano', async () => {
  process.env.MODELPICK_DATA_DIR = await mkdtemp(join(tmpdir(), 'mp-lang-'));
  const { buildServer } = await import('../src/server/server.js');
  const app = await buildServer();
  try {
    const en = await app.inject({ url: '/metodo?task=bug', headers: { 'accept-language': 'en-GB,en' } });
    assert.equal(en.statusCode, 302);
    assert.equal(en.headers.location, '/en/method?task=bug');

    const none = await app.inject({ url: '/' });
    assert.equal(none.statusCode, 302);
    assert.equal(none.headers.location, '/en');

    const it = await app.inject({ url: '/metodo', headers: { 'accept-language': 'it-IT,it;q=0.9' } });
    assert.equal(it.statusCode, 200);

    // Scelta dal menu: vale anche con un browser inglese, e viene ricordata.
    const scelta = await app.inject({ url: '/metodo?lang=it', headers: { 'accept-language': 'en' } });
    assert.equal(scelta.statusCode, 200);
    assert.match(String(scelta.headers['set-cookie']), /mp_lang=it/);
    const dopo = await app.inject({ url: '/metodo', headers: { 'accept-language': 'en', cookie: 'mp_lang=it' } });
    assert.equal(dopo.statusCode, 200);

    // Un italiano che sceglie l inglese dal menu non viene riportato indietro.
    const via = await app.inject({ url: '/', headers: { 'accept-language': 'it', cookie: 'mp_lang=en' } });
    assert.equal(via.statusCode, 302);

    const inglese = await app.inject({ url: '/en/method', headers: { 'accept-language': 'it' } });
    assert.equal(inglese.statusCode, 200);
  } finally {
    await app.close();
  }
});
