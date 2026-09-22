import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { browserLang } from '../src/i18n.js';

test('Italian only when the browser\'s first language is Italian', () => {
  assert.equal(browserLang('it-IT,it;q=0.9,en;q=0.8'), 'it');
  assert.equal(browserLang('it'), 'it');
  assert.equal(browserLang('en-US,en;q=0.9,it;q=0.8'), 'en');
  assert.equal(browserLang('de-DE,de;q=0.9'), 'en');
  assert.equal(browserLang('fr;q=0.5,it;q=0.9'), 'it'); // the weight counts, not the order
  assert.equal(browserLang(undefined), 'en');
  assert.equal(browserLang('*'), 'en');
});

test('Italian pages redirect to English anyone who did not ask for Italian', async () => {
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

    // Chosen from the menu: it holds even with an English browser, and is remembered.
    const picked = await app.inject({ url: '/metodo?lang=it', headers: { 'accept-language': 'en' } });
    assert.equal(picked.statusCode, 200);
    assert.match(String(picked.headers['set-cookie']), /mp_lang=it/);
    const remembered = await app.inject({ url: '/metodo', headers: { 'accept-language': 'en', cookie: 'mp_lang=it' } });
    assert.equal(remembered.statusCode, 200);

    // An Italian who picks English from the menu is not sent back.
    const via = await app.inject({ url: '/', headers: { 'accept-language': 'it', cookie: 'mp_lang=en' } });
    assert.equal(via.statusCode, 302);

    const english = await app.inject({ url: '/en/method', headers: { 'accept-language': 'it' } });
    assert.equal(english.statusCode, 200);
  } finally {
    await app.close();
  }
});

test('bots get the page in the language of the address; robots and sitemap exist', async () => {
  process.env.MODELPICK_DATA_DIR = await mkdtemp(join(tmpdir(), 'mp-bot-'));
  const { buildServer } = await import('../src/server/server.js');
  const app = await buildServer();
  try {
    const bot = await app.inject({ url: '/', headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } });
    assert.equal(bot.statusCode, 200);
    assert.match(bot.body, /<html lang="it"/);

    const whatsapp = await app.inject({ url: '/metodo', headers: { 'user-agent': 'WhatsApp/2.23' } });
    assert.equal(whatsapp.statusCode, 200);

    // A person with an English browser is still sent to English.
    const person = await app.inject({ url: '/', headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) Safari/605', 'accept-language': 'en-GB' } });
    assert.equal(person.statusCode, 302);

    const robots = await app.inject({ url: '/robots.txt' });
    assert.equal(robots.statusCode, 200);
    assert.match(robots.body, /Sitemap: https:\/\/[^\s]+\/sitemap\.xml/);

    const sitemap = await app.inject({ url: '/sitemap.xml' });
    assert.equal(sitemap.statusCode, 200);
    assert.match(sitemap.body, /hreflang="it"/);
    assert.match(sitemap.body, /hreflang="x-default"/);
  } finally {
    await app.close();
  }
});
