import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, type RecommendationRequest } from '../src/engine/recommend.js';
import { evidence, model, now, offer, snapshot } from './fixtures.js';

const req = (over: Partial<RecommendationRequest> = {}): RecommendationRequest => ({
  task: 'bug',
  priority: 'equilibrio',
  lang: 'it',
  usage: null,
  currentModelKey: null,
  currentOfferId: null,
  ...over,
});

/** A cheap model above the gate, an expensive and better one, a weak one. */
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

test('the everyday pick is the cheapest that clears the gate, not the best', () => {
  const r = recommend(base(), req());
  assert.equal(r.everyday?.model.key, 'v/economico');
  assert.equal(r.everyday?.offer.providerId, 'alfa'); // the cheapest provider for that model
});

test('the backup has documented superior quality', () => {
  const r = recommend(base(), req());
  assert.equal(r.hard?.model.key, 'v/bravo');
  assert.ok(r.hard!.quality.value - r.everyday!.quality.value >= 3);
});

test('a model below the gate does not win even if it costs very little', () => {
  const r = recommend(base(), req());
  assert.notEqual(r.everyday?.model.key, 'v/scarso');
});

test('"work well" picks the highest score, not the cheapest above the gate', () => {
  const economico = recommend(base(), req({ priority: 'risparmio' }));
  const qualita = recommend(base(), req({ priority: 'qualita' }));
  assert.equal(economico.everyday?.model.key, 'v/economico');
  assert.equal(qualita.everyday?.model.key, 'v/bravo');
  // the three choices cannot all give the same answer
  assert.notEqual(economico.everyday?.model.key, qualita.everyday?.model.key);
});

test('on equal scores "work well" still prefers the cheaper one', () => {
  const s = snapshot(
    [model('v/caro'), model('v/conveniente')],
    [
      offer({ id: 'caro', modelKey: 'v/caro', providerId: 'caro', prices: { inputPerMTok: 10, outputPerMTok: 30, cacheReadPerMTok: 1, cacheWritePerMTok: 10 } }),
      offer({ id: 'conv', modelKey: 'v/conveniente', providerId: 'conveniente', prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1 } }),
    ],
    [evidence('v/caro', 80), evidence('v/conveniente', 79)],
  );
  assert.equal(recommend(s, req({ priority: 'qualita' })).everyday?.model.key, 'v/conveniente');
});

test('demo data never enters public recommendations', () => {
  const s = base();
  s.offers.push(offer({ id: 'demo', modelKey: 'v/economico', providerId: 'omega', demo: true, prices: { inputPerMTok: 0.01, outputPerMTok: 0.01, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.01 } }));
  const r = recommend(s, req());
  assert.notEqual(r.everyday?.offer.providerId, 'omega');
});

test('a price not recently verified cannot win', () => {
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

test('a quarantined price cannot win', () => {
  const s = base();
  s.offers.push(offer({ id: 'q', modelKey: 'v/economico', providerId: 'quarantena', quarantine: 'abnormal change', prices: { inputPerMTok: 0.01, outputPerMTok: 0.01, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.01 } }));
  const r = recommend(s, req());
  assert.notEqual(r.everyday?.offer.providerId, 'quarantena');
});

test('without a sufficiently better model we name no backup', () => {
  const s = snapshot(
    [model('v/a'), model('v/b')],
    [offer({ id: 'a', modelKey: 'v/a', providerId: 'p1' }), offer({ id: 'b', modelKey: 'v/b', providerId: 'p2' })],
    [evidence('v/a', 70), evidence('v/b', 71)],
  );
  const r = recommend(s, req());
  assert.equal(r.hard, null);
  assert.match(r.notes.join(" "), /capacità superiore/);
});

test('without quality evidence no winner is assigned', () => {
  const s = snapshot([model('v/a')], [offer({ id: 'a', modelKey: 'v/a', providerId: 'p1' })], []);
  const r = recommend(s, req());
  assert.equal(r.everyday, null);
  assert.match(r.notes.join(' '), /non assegniamo un vincitore/);
});

test('a model measured with another benchmark does not enter the comparison', () => {
  const s = base();
  // "ref" measures two models, "altro-banco" only one: the reference group is "ref".
  s.evidence = [
    evidence('v/economico', 60, { harnessKey: 'altro-banco', harness: 'another agent' }),
    evidence('v/bravo', 78),
    evidence('v/scarso', 30),
  ];
  const r = recommend(s, req());
  // v/economico would cost less but its score is not comparable: v/bravo wins.
  assert.equal(r.everyday?.model.key, 'v/bravo');
  assert.equal(r.everyday?.quality.comparable, true);
  assert.ok(r.method.excluded.some((e) => e.reason === 'not-comparable'));
});

test('a free or plan-based offer does not win the price comparison', () => {
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

test('an unpublished cache price is charged at the input price, never free', () => {
  const s = base();
  const senzaCache = offer({
    id: 'senza-cache',
    modelKey: 'v/economico',
    providerId: 'senza-cache',
    prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: null, cacheWritePerMTok: null },
  });
  s.offers.push(senzaCache);
  const r = recommend(s, req());
  // alfa publishes low cache prices: it stays cheaper than those that do not publish them.
  assert.equal(r.everyday?.offer.providerId, 'alfa');
  const alt = r.everyday!.alternatives.find((a) => a.offer.providerId === 'senza-cache');
  assert.ok(alt, 'the offer without cache prices stays comparable');
  assert.ok(alt!.cost.assumptions.length > 0, 'the conservative assumption is declared');
});

test('a broker and a direct provider compete on the same total price', () => {
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

test('usage supplied by the user replaces the scenario', () => {
  const r = recommend(base(), req({ usage: { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } }));
  assert.equal(r.usingCustomUsage, true);
  assert.equal(r.mix.input, 1_000_000);
  assert.equal(r.everyday?.cost.totalUsd, 1); // 1 USD/1M × 1M token
});

test('savings are computed only against a declared configuration', () => {
  const senza = recommend(base(), req());
  assert.equal(senza.savings, null);
  const con = recommend(base(), req({ currentModelKey: 'v/bravo' }));
  assert.ok(con.savings!.currentTotalUsd! > con.savings!.recommendedTotalUsd!);
  assert.ok(con.savings!.deltaUsd! > 0);
});

test('an offer with incomplete prices does not enter the comparison', () => {
  const s = base();
  const incompleta = offer({ id: 'inc', modelKey: 'v/economico', providerId: 'incompleto' });
  incompleta.prices.outputPerMTok = null;
  s.offers.push(incompleta);
  const r = recommend(s, req());
  assert.ok(!r.everyday!.alternatives.some((a) => a.offer.providerId === 'incompleto'));
});

test('a model OpenCode does not recognise is neither recommended nor shown', () => {
  const s = base();
  // The cheapest offer of all, but with an id OpenCode rejects.
  s.offers.push(
    offer({
      id: 'ignoto',
      modelKey: 'v/economico',
      providerId: 'ignoto',
      opencodeVerified: false,
      prices: { inputPerMTok: 0.01, outputPerMTok: 0.02, cacheReadPerMTok: 0.001, cacheWritePerMTok: 0.01 },
    }),
  );
  const r = recommend(s, req());
  assert.notEqual(r.everyday?.offer.providerId, 'ignoto');
  assert.ok(!r.everyday!.alternatives.some((a) => a.offer.providerId === 'ignoto'));
});

test('if no provider has a valid id the model leaves the comparison', () => {
  const s = snapshot(
    [model('v/solo')],
    [offer({ id: 'x', modelKey: 'v/solo', providerId: 'ignoto', opencodeVerified: false })],
    [evidence('v/solo', 75)],
  );
  const r = recommend(s, req());
  assert.equal(r.everyday, null);
  assert.ok(r.method.excluded.some((e) => e.reason === 'opencode-unknown'));
});

test('every recommended offer carries an id OpenCode accepts', () => {
  const r = recommend(base(), req());
  for (const p of [r.everyday, r.hard]) {
    if (!p) continue;
    assert.notEqual(p.offer.opencodeVerified, false, `${p.offer.providerId} must be verified`);
  }
});

test('on equal price the offer with a pinnable provider wins', () => {
  const s = snapshot(
    [model('v/a')],
    [
      // Same spend: one goes through automatic routing, the other pins the provider.
      offer({ id: 'libero', modelKey: 'v/a', providerId: 'openrouter', providerName: 'OpenRouter', sourceId: 'modelsdev', prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1 } }),
      offer({ id: 'fissato', modelKey: 'v/a', providerId: 'deepinfra', providerName: 'DeepInfra', sourceId: 'openrouter', routingSlug: 'deepinfra', prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1 } }),
    ],
    [evidence('v/a', 70, { metric: 'aa_coding_index', harnessKey: 'aa-coding-index|v4.3' })],
  );
  const r = recommend(s, req({ priority: 'equilibrio' }));
  assert.equal(r.everyday?.offer.id, 'fissato');
});
