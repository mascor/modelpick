import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, type RecommendationRequest } from '../src/engine/recommend.js';
import { evidence, model, now, offer, snapshot } from './fixtures.js';

const req = (over: Partial<RecommendationRequest> = {}): RecommendationRequest => ({
  task: 'bug',
  priority: 'balanced',
  lang: 'it',
  usage: null,
  currentModelKey: null,
  currentOfferId: null,
  ...over,
});

/** A cheap model above the gate, an expensive and better one, a weak one. */
const base = () =>
  snapshot(
    [model('v/cheap'), model('v/strong'), model('v/weak')],
    [
      offer({ id: 'cheap-a', modelKey: 'v/cheap', providerId: 'alfa', prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1 } }),
      offer({ id: 'cheap-b', modelKey: 'v/cheap', providerId: 'beta', prices: { inputPerMTok: 2, outputPerMTok: 6, cacheReadPerMTok: 0.2, cacheWritePerMTok: 2 } }),
      offer({ id: 'strong-a', modelKey: 'v/strong', providerId: 'gamma', prices: { inputPerMTok: 8, outputPerMTok: 30, cacheReadPerMTok: 0.8, cacheWritePerMTok: 10 } }),
      offer({ id: 'weak-a', modelKey: 'v/weak', providerId: 'delta', prices: { inputPerMTok: 0.1, outputPerMTok: 0.3, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.1 } }),
    ],
    [evidence('v/cheap', 60, { costPerTask: 0.3 }), evidence('v/strong', 78, { costPerTask: 1.1 }), evidence('v/weak', 30, { costPerTask: 0.1 })],
    { costReference: { meanPerTask: 1, models: 3, sinceDays: 183 } },
  );

test('the everyday pick is the cheapest that clears the gate, not the best', () => {
  const r = recommend(base(), req());
  assert.equal(r.everyday?.model.key, 'v/cheap');
  assert.equal(r.everyday?.offer.providerId, 'alfa'); // the cheapest provider for that model
});

test('the backup has documented superior quality', () => {
  const r = recommend(base(), req());
  assert.equal(r.hard?.model.key, 'v/strong');
  assert.ok(r.hard!.quality.value - r.everyday!.quality.value >= 3);
});

test('a model below the gate does not win even if it costs very little', () => {
  const r = recommend(base(), req());
  assert.notEqual(r.everyday?.model.key, 'v/weak');
});

test('"work well" picks the highest score, not the cheapest above the gate', () => {
  const cheap = recommend(base(), req({ priority: 'cheap' }));
  const quality = recommend(base(), req({ priority: 'quality' }));
  assert.equal(cheap.everyday?.model.key, 'v/cheap');
  assert.equal(quality.everyday?.model.key, 'v/strong');
  // the three choices cannot all give the same answer
  assert.notEqual(cheap.everyday?.model.key, quality.everyday?.model.key);
});

test('on equal scores "work well" still prefers the cheaper one', () => {
  const s = snapshot(
    [model('v/pricey'), model('v/bargain')],
    [
      offer({ id: 'pricey', modelKey: 'v/pricey', providerId: 'pricey', prices: { inputPerMTok: 10, outputPerMTok: 30, cacheReadPerMTok: 1, cacheWritePerMTok: 10 } }),
      offer({ id: 'bargain', modelKey: 'v/bargain', providerId: 'bargain', prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1 } }),
    ],
    [evidence('v/pricey', 80), evidence('v/bargain', 79)],
  );
  assert.equal(recommend(s, req({ priority: 'quality' })).everyday?.model.key, 'v/bargain');
});

test('demo data never enters public recommendations', () => {
  const s = base();
  s.offers.push(offer({ id: 'demo', modelKey: 'v/cheap', providerId: 'omega', demo: true, prices: { inputPerMTok: 0.01, outputPerMTok: 0.01, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.01 } }));
  const r = recommend(s, req());
  assert.notEqual(r.everyday?.offer.providerId, 'omega');
});

test('a price not recently verified cannot win', () => {
  const s = base();
  const stale = offer({
    id: 'cheap-old',
    modelKey: 'v/cheap',
    providerId: 'old',
    observedAt: new Date(now.getTime() - 1000 * 3600 * 200).toISOString(),
    prices: { inputPerMTok: 0.2, outputPerMTok: 0.2, cacheReadPerMTok: 0.02, cacheWritePerMTok: 0.2 },
  });
  s.offers.push(stale);
  const r = recommend(s, req());
  assert.notEqual(r.everyday?.offer.providerId, 'old');
});

test('a quarantined price cannot win', () => {
  const s = base();
  s.offers.push(offer({ id: 'q', modelKey: 'v/cheap', providerId: 'quarantined', quarantine: 'abnormal change', prices: { inputPerMTok: 0.01, outputPerMTok: 0.01, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.01 } }));
  const r = recommend(s, req());
  assert.notEqual(r.everyday?.offer.providerId, 'quarantined');
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
  // "ref" measures two models, "other-bench" only one: the reference group is "ref".
  s.evidence = [
    evidence('v/cheap', 60, { harnessKey: 'other-bench', harness: 'another agent' }),
    evidence('v/strong', 78, { costPerTask: 1.1 }),
    evidence('v/weak', 30, { costPerTask: 0.1 }),
  ];
  const r = recommend(s, req());
  // v/cheap would cost less but its score is not comparable: v/strong wins.
  assert.equal(r.everyday?.model.key, 'v/strong');
  assert.equal(r.everyday?.quality.comparable, true);
  assert.ok(r.method.excluded.some((e) => e.reason === 'not-comparable'));
});

test('a free or plan-based offer does not win the price comparison', () => {
  const s = base();
  s.offers.push(
    offer({
      id: 'plan',
      modelKey: 'v/cheap',
      providerId: 'flat-plan',
      prices: { inputPerMTok: 0, outputPerMTok: 0, cacheReadPerMTok: 0, cacheWritePerMTok: 0 },
    }),
  );
  const r = recommend(s, req());
  assert.notEqual(r.everyday?.offer.providerId, 'flat-plan');
});

test('an unpublished cache price is charged at the input price, never free', () => {
  const s = base();
  const noCache = offer({
    id: 'no-cache',
    modelKey: 'v/cheap',
    providerId: 'no-cache',
    prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: null, cacheWritePerMTok: null },
  });
  s.offers.push(noCache);
  const r = recommend(s, req());
  // alfa publishes low cache prices: it stays cheaper than those that do not publish them.
  assert.equal(r.everyday?.offer.providerId, 'alfa');
  const alt = r.everyday!.alternatives.find((a) => a.offer.providerId === 'no-cache');
  assert.ok(alt, 'the offer without cache prices stays comparable');
  assert.ok(alt!.cost.assumptions.length > 0, 'the conservative assumption is declared');
});

test('a broker and a direct provider compete on the same total price', () => {
  const s = snapshot(
    [model('v/a')],
    [
      offer({ id: 'direct', modelKey: 'v/a', providerId: 'direct', prices: { inputPerMTok: 2, outputPerMTok: 6, cacheReadPerMTok: 0.2, cacheWritePerMTok: 2 } }),
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
  const without = recommend(base(), req());
  assert.equal(without.savings, null);
  const withCurrent = recommend(base(), req({ currentModelKey: 'v/strong' }));
  assert.ok(withCurrent.savings!.currentTotalUsd! > withCurrent.savings!.recommendedTotalUsd!);
  assert.ok(withCurrent.savings!.deltaUsd! > 0);
});

test('an offer with incomplete prices does not enter the comparison', () => {
  const s = base();
  const incomplete = offer({ id: 'incomplete', modelKey: 'v/cheap', providerId: 'incomplete' });
  incomplete.prices.outputPerMTok = null;
  s.offers.push(incomplete);
  const r = recommend(s, req());
  assert.ok(!r.everyday!.alternatives.some((a) => a.offer.providerId === 'incomplete'));
});

test('a model OpenCode does not recognise is neither recommended nor shown', () => {
  const s = base();
  // The cheapest offer of all, but with an id OpenCode rejects.
  s.offers.push(
    offer({
      id: 'unknown',
      modelKey: 'v/cheap',
      providerId: 'unknown',
      opencodeVerified: false,
      prices: { inputPerMTok: 0.01, outputPerMTok: 0.02, cacheReadPerMTok: 0.001, cacheWritePerMTok: 0.01 },
    }),
  );
  const r = recommend(s, req());
  assert.notEqual(r.everyday?.offer.providerId, 'unknown');
  assert.ok(!r.everyday!.alternatives.some((a) => a.offer.providerId === 'unknown'));
});

test('if no provider has a valid id the model leaves the comparison', () => {
  const s = snapshot(
    [model('v/lone')],
    [offer({ id: 'x', modelKey: 'v/lone', providerId: 'unknown', opencodeVerified: false })],
    [evidence('v/lone', 75)],
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
      offer({ id: 'routed', modelKey: 'v/a', providerId: 'openrouter', providerName: 'OpenRouter', sourceId: 'modelsdev', prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1 } }),
      offer({ id: 'pinned', modelKey: 'v/a', providerId: 'deepinfra', providerName: 'DeepInfra', sourceId: 'openrouter', routingSlug: 'deepinfra', prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1 } }),
    ],
    [evidence('v/a', 70, { metric: 'aa_coding_index', harnessKey: 'aa-coding-index|v4.3' })],
  );
  const r = recommend(s, req({ priority: 'balanced' }));
  assert.equal(r.everyday?.offer.id, 'pinned');
});

test('a pick never costs more per task than 1.25 times the mean, or 5 times with "best results"', () => {
  const s = snapshot(
    [model('v/cheap'), model('v/luxury')],
    [
      offer({ id: 'cheap-a', modelKey: 'v/cheap', providerId: 'alfa', prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1 } }),
      offer({ id: 'lux-a', modelKey: 'v/luxury', providerId: 'beta', prices: { inputPerMTok: 5, outputPerMTok: 20, cacheReadPerMTok: 0.5, cacheWritePerMTok: 5 } }),
    ],
    [evidence('v/cheap', 60, { costPerTask: 0.5 }), evidence('v/luxury', 82, { costPerTask: 3 })],
    { costReference: { meanPerTask: 1, models: 2, sinceDays: 183 } },
  );
  const balanced = recommend(s, req());
  assert.equal(balanced.hard, null); // 3 USD per task is above 1.25 x 1
  assert.ok(balanced.method.excluded.some((e) => e.reason === 'over-price-cap'));
  const best = recommend(s, req({ priority: 'quality' }));
  assert.equal(best.everyday?.model.key, 'v/luxury'); // within 5 x 1
});

test('a score counts only at an effort the buyer can actually select', () => {
  const s = snapshot(
    [model('openai/sol')],
    [
      offer({ id: 'direct', modelKey: 'openai/sol', providerId: 'openai', prices: { inputPerMTok: 1, outputPerMTok: 3, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1 } }),
      offer({ id: 'reseller', modelKey: 'openai/sol', providerId: 'other', prices: { inputPerMTok: 0.5, outputPerMTok: 1.5, cacheReadPerMTok: 0.05, cacheWritePerMTok: 0.5 } }),
    ],
    [
      evidence('openai/sol', 78, { reasoningEffort: 'xhigh', costPerTask: 1 }),
      evidence('openai/sol', 70, { reasoningEffort: 'low', costPerTask: 0.3 }),
    ],
    { costReference: { meanPerTask: 1, models: 2, sinceDays: 183 } },
  );
  const r = recommend(s, req({ priority: 'quality' }));
  // OpenAI's own API can be told "xhigh"; a reseller gives no such control, so only "low" counts there.
  assert.equal(r.everyday?.offer.providerId, 'openai');
  assert.equal(r.everyday?.quality.value, 78);
  assert.equal(r.everyday?.quality.effort, 'xhigh');
});

test('"balanced" takes clearly more quality for a little more money, "spend less" does not', () => {
  const s = snapshot(
    [model('v/cheapest'), model('v/better')],
    [
      offer({ id: 'a', modelKey: 'v/cheapest', providerId: 'alfa', prices: { inputPerMTok: 0.06, outputPerMTok: 0.18, cacheReadPerMTok: 0.012, cacheWritePerMTok: 0.06 } }),
      offer({ id: 'b', modelKey: 'v/better', providerId: 'beta', prices: { inputPerMTok: 0.1, outputPerMTok: 0.5, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.1 } }),
    ],
    [evidence('v/cheapest', 57, { costPerTask: 0.2 }), evidence('v/better', 69, { costPerTask: 0.26 })],
    { costReference: { meanPerTask: 1, models: 2, sinceDays: 183 } },
  );
  assert.equal(recommend(s, req({ priority: 'cheap' })).everyday?.model.key, 'v/cheapest');
  assert.equal(recommend(s, req({ priority: 'balanced' })).everyday?.model.key, 'v/better');
});
