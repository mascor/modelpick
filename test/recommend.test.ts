import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, type RecommendationRequest } from '../src/engine/recommend.js';
import { evidence, model, now, offer, snapshot } from './fixtures.js';

const req = (over: Partial<RecommendationRequest> = {}): RecommendationRequest => ({
  task: 'bug',
  priority: 'equilibrio',
  usage: null,
  currentModelKey: null,
  currentOfferId: null,
  ...over,
});

/** Un modello economico sopra soglia, uno costoso e piu bravo, uno scarso. */
const base = () =>
  snapshot(
    [model('v/economico'), model('v/bravo'), model('v/scarso')],
    [
      offer({ id: 'eco-a', modelKey: 'v/economico', providerId: 'alfa', prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1 } }),
      offer({ id: 'eco-b', modelKey: 'v/economico', providerId: 'beta', prices: { inputPerMTok: 2, outputPerMTok: 6, cacheReadPerMTok: 0.2, cacheWritePerMTok: 2 } }),
      offer({ id: 'bravo-a', modelKey: 'v/bravo', providerId: 'gamma', prices: { inputPerMTok: 8, outputPerMTok: 30, cacheReadPerMTok: 0.8, cacheWritePerMTok: 10 } }),
      offer({ id: 'scarso-a', modelKey: 'v/scarso', providerId: 'delta', prices: { inputPerMTok: 0.1, outputPerMTok: 0.3, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.1 } }),
    ],
    [evidence('v/economico', 60), evidence('v/bravo', 78), evidence('v/scarso', 30)],
  );

test('il quotidiano e il piu economico che supera la soglia, non il piu bravo', () => {
  const r = recommend(base(), req());
  assert.equal(r.everyday?.model.key, 'v/economico');
  assert.equal(r.everyday?.offer.providerId, 'alfa'); // il provider piu economico per quel modello
});

test('il backup ha una qualita superiore documentata', () => {
  const r = recommend(base(), req());
  assert.equal(r.hard?.model.key, 'v/bravo');
  assert.ok(r.hard!.quality.value - r.everyday!.quality.value >= 3);
});

test('un modello sotto soglia non vince nemmeno se costa pochissimo', () => {
  const r = recommend(base(), req());
  assert.notEqual(r.everyday?.model.key, 'v/scarso');
});

test('la priorita qualita alza la soglia e cambia la scelta', () => {
  const r = recommend(base(), req({ priority: 'qualita' }));
  assert.equal(r.everyday?.model.key, 'v/bravo'); // 60 non basta piu, 78 si
});

test('i dati dimostrativi non entrano mai nelle raccomandazioni pubbliche', () => {
  const s = base();
  s.offers.push(offer({ id: 'demo', modelKey: 'v/economico', providerId: 'omega', demo: true, prices: { inputPerMTok: 0.01, outputPerMTok: 0.01, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.01 } }));
  const r = recommend(s, req());
  assert.notEqual(r.everyday?.offer.providerId, 'omega');
});

test('un prezzo non verificato di recente non puo vincere', () => {
  const s = base();
  const stale = offer({
    id: 'eco-vecchio',
    modelKey: 'v/economico',
    providerId: 'vecchio',
    observedAt: new Date(now.getTime() - 1000 * 3600 * 200).toISOString(),
    prices: { inputPerMTok: 0.2, outputPerMTok: 0.2, cacheReadPerMTok: 0.02, cacheWritePerMTok: 0.2 },
  });
  s.offers.push(stale);
  const r = recommend(s, req());
  assert.notEqual(r.everyday?.offer.providerId, 'vecchio');
});

test('un prezzo in quarantena non puo vincere', () => {
  const s = base();
  s.offers.push(offer({ id: 'q', modelKey: 'v/economico', providerId: 'quarantena', quarantine: 'variazione anomala', prices: { inputPerMTok: 0.01, outputPerMTok: 0.01, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.01 } }));
  const r = recommend(s, req());
  assert.notEqual(r.everyday?.offer.providerId, 'quarantena');
});

test('senza un modello sufficientemente migliore non indichiamo un backup', () => {
  const s = snapshot(
    [model('v/a'), model('v/b')],
    [offer({ id: 'a', modelKey: 'v/a', providerId: 'p1' }), offer({ id: 'b', modelKey: 'v/b', providerId: 'p2' })],
    [evidence('v/a', 70), evidence('v/b', 71)],
  );
  const r = recommend(s, req());
  assert.equal(r.hard, null);
  assert.match(r.notes.join(" "), /capacità superiore/);
});

test('senza prove di qualita non si assegna alcun vincitore', () => {
  const s = snapshot([model('v/a')], [offer({ id: 'a', modelKey: 'v/a', providerId: 'p1' })], []);
  const r = recommend(s, req());
  assert.equal(r.everyday, null);
  assert.match(r.notes.join(' '), /non assegniamo un vincitore/);
});

test('un modello misurato con un altro banco di prova non entra nel confronto', () => {
  const s = base();
  // "ref" misura due modelli, "altro-banco" uno solo: il gruppo di riferimento e "ref".
  s.evidence = [
    evidence('v/economico', 60, { harnessKey: 'altro-banco', harness: 'un altro agente' }),
    evidence('v/bravo', 78),
    evidence('v/scarso', 30),
  ];
  const r = recommend(s, req());
  // v/economico costerebbe meno ma il suo punteggio non e confrontabile: vince v/bravo.
  assert.equal(r.everyday?.model.key, 'v/bravo');
  assert.equal(r.everyday?.quality.comparable, true);
  assert.ok(r.method.excluded.some((e) => /non confrontabili/.test(e.reason)));
});

test('un offerta gratuita o a piano non vince il confronto sul prezzo', () => {
  const s = base();
  s.offers.push(
    offer({
      id: 'piano',
      modelKey: 'v/economico',
      providerId: 'piano-forfait',
      prices: { inputPerMTok: 0, outputPerMTok: 0, cacheReadPerMTok: 0, cacheWritePerMTok: 0 },
    }),
  );
  const r = recommend(s, req());
  assert.notEqual(r.everyday?.offer.providerId, 'piano-forfait');
});

test('un prezzo di cache non pubblicato viene conteggiato al prezzo di input, mai gratis', () => {
  const s = base();
  const senzaCache = offer({
    id: 'senza-cache',
    modelKey: 'v/economico',
    providerId: 'senza-cache',
    prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: null, cacheWritePerMTok: null },
  });
  s.offers.push(senzaCache);
  const r = recommend(s, req());
  // alfa pubblica prezzi di cache bassi: resta piu conveniente di chi non li pubblica.
  assert.equal(r.everyday?.offer.providerId, 'alfa');
  const alt = r.everyday!.alternatives.find((a) => a.offer.providerId === 'senza-cache');
  assert.ok(alt, 'l offerta senza prezzi di cache resta confrontabile');
  assert.ok(alt!.cost.assumptions.length > 0, 'l ipotesi prudenziale viene dichiarata');
});

test('un intermediario e un provider diretto competono sullo stesso prezzo totale', () => {
  const s = snapshot(
    [model('v/a')],
    [
      offer({ id: 'diretto', modelKey: 'v/a', providerId: 'diretto', prices: { inputPerMTok: 2, outputPerMTok: 6, cacheReadPerMTok: 0.2, cacheWritePerMTok: 2 } }),
      offer({ id: 'broker', modelKey: 'v/a', providerId: 'broker', access: 'intermediary', broker: 'OpenRouter', prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1 } }),
    ],
    [evidence('v/a', 70)],
  );
  assert.equal(recommend(s, req()).everyday?.offer.providerId, 'broker');
});

test('i consumi indicati dall utente sostituiscono lo scenario', () => {
  const r = recommend(base(), req({ usage: { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } }));
  assert.equal(r.usingCustomUsage, true);
  assert.equal(r.mix.input, 1_000_000);
  assert.equal(r.everyday?.cost.totalUsd, 1); // 1 USD/1M × 1M token
});

test('il risparmio si calcola solo su una configurazione dichiarata', () => {
  const senza = recommend(base(), req());
  assert.equal(senza.savings, null);
  const con = recommend(base(), req({ currentModelKey: 'v/bravo' }));
  assert.ok(con.savings!.currentTotalUsd! > con.savings!.recommendedTotalUsd!);
  assert.ok(con.savings!.deltaUsd! > 0);
});

test('un offerta con prezzi incompleti non entra nel confronto', () => {
  const s = base();
  const incompleta = offer({ id: 'inc', modelKey: 'v/economico', providerId: 'incompleto' });
  incompleta.prices.outputPerMTok = null;
  s.offers.push(incompleta);
  const r = recommend(s, req());
  assert.ok(!r.everyday!.alternatives.some((a) => a.offer.providerId === 'incompleto'));
});
