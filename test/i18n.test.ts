import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, t, pagePath, otherLang, isLang } from '../src/i18n.js';

test('ogni lingua ha lo stesso insieme di chiavi', () => {
  const chiavi = (o: unknown, prefisso = ''): string[] => {
    if (o === null || typeof o !== 'object') return [prefisso];
    return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === 'function' || Array.isArray(v) ? [`${prefisso}.${k}`] : chiavi(v, `${prefisso}.${k}`),
    );
  };
  const it = chiavi(t('it')).sort();
  const en = chiavi(t('en')).sort();
  assert.deepEqual(en, it, 'il catalogo inglese deve avere le stesse chiavi di quello italiano');
});

test('nessun testo inglese e rimasto in italiano', () => {
  const en = t('en');
  assert.equal(en.nav.method, 'Method');
  assert.equal(en.home.everyday, '🟢 Every day');
  assert.notEqual(en.home.title, t('it').home.title);
});

test('i percorsi separano le due lingue e si rimandano a vicenda', () => {
  assert.equal(pagePath('it', 'home'), '/');
  assert.equal(pagePath('en', 'home'), '/en');
  assert.equal(pagePath('en', 'method'), '/en/method');
  assert.equal(otherLang('it'), 'en');
  assert.equal(otherLang('en'), 'it');
  assert.equal(LANGS.length, 2);
  assert.ok(isLang('en'));
  assert.ok(!isLang('de'));
});
