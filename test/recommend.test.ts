import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetFor, recommend, type RecommendationRequest } from '../src/engine/recommend.js';
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

/** Monthly on the bug scenario: v/cheap ~3.7 USD, v/strong ~43 USD, v/weak ~1.9 USD. */
const base = () =>
  snapshot(
    [model('v/cheap'), model('v/strong'), model('v/weak')],
    [
      offer({ id: 'cheap-a', modelKey: 'v/cheap', providerId: 'alfa', prices: { inputPerMTok: 0.2, outputPerMTok: 0.6, cacheReadPerMTok: 0.02, cacheWritePerMTok: 0.2 } }),
      offer({ id: 'cheap-b', modelKey: 'v/cheap', providerId: 'beta', prices: { inputPerMTok: 0.4, outputPerMTok: 1.2, cacheReadPerMTok: 0.04, cacheWritePerMTok: 0.4 } }),
      offer({ id: 'strong-a', modelKey: 'v/strong', providerId: 'gamma', prices: { inputPerMTok: 2, outputPerMTok: 10, cacheReadPerMTok: 0.2, cacheWritePerMTok: 2.5 } }),
      offer({ id: 'weak-a', modelKey: 'v/weak', providerId: 'delta', prices: { inputPerMTok: 0.1, outputPerMTok: 0.3, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.1 } }),
    ],
    [evidence('v/cheap', 60, { costPerTask: 0.3 }), evidence('v/strong', 78, { costPerTask: 1.1 }), evidence('v/weak', 30, { costPerTask: 0.1 })],
  );

test('the everyday pick is the best score within the everyday budget', () => {
  const r = recommend(base(), req());
  assert.equal(r.everyday?.model.key, 'v/cheap');
  assert.equal(r.everyday?.offer.providerId, 'alfa'); // the cheapest provider for that model
});

test('the model for hard problems is the best score within the larger budget', () => {
  const r = recommend(base(), req());
  assert.equal(r.hard?.model.key, 'v/strong');
  assert.ok(r.hard!.quality.value - r.everyday!.quality.value >= 3);
});

test('a weaker model does not win just because it costs less', () => {
  const r = recommend(base(), req());
  assert.notEqual(r.everyday?.model.key, 'v/weak');
});

test('a larger budget buys a higher score', () => {
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
    [
      offer({ id: 'a', modelKey: 'v/a', providerId: 'p1', prices: { inputPerMTok: 0.1, outputPerMTok: 0.4, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.1 } }),
      offer({ id: 'b', modelKey: 'v/b', providerId: 'p2', prices: { inputPerMTok: 0.5, outputPerMTok: 2, cacheReadPerMTok: 0.05, cacheWritePerMTok: 0.5 } }),
    ],
    [evidence('v/a', 70), evidence('v/b', 71)],
  );
  const r = recommend(s, req());
  assert.equal(r.hard, null); // 1 point is a tie, not a better model
  assert.match(r.notes.join(" "), /non serve un secondo modello/);
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
  // v/cheap would win the budget, but its score is not comparable.
  assert.notEqual(r.everyday?.model.key, 'v/cheap');
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
  assert.equal(r.everyday?.cost.totalUsd, r.everyday?.offer.prices.inputPerMTok); // price per 1M × 1M tokens
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
  );
  const r = recommend(s, req({ priority: 'quality' }));
  // OpenAI's own API can be told "xhigh"; a reseller gives no such control, so only "low" counts there.
  assert.equal(r.everyday?.offer.providerId, 'openai');
  assert.equal(r.everyday?.quality.value, 78);
  assert.equal(r.everyday?.quality.effort, 'xhigh');
});

test('within the budget the highest score wins, and a tie within 1 point goes to the cheaper', () => {
  const s = snapshot(
    [model('v/good'), model('v/good-plus'), model('v/great')],
    [
      offer({ id: 'g', modelKey: 'v/good', providerId: 'a', prices: { inputPerMTok: 0.1, outputPerMTok: 0.4, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.1 } }),
      offer({ id: 'gp', modelKey: 'v/good-plus', providerId: 'b', prices: { inputPerMTok: 0.5, outputPerMTok: 2, cacheReadPerMTok: 0.05, cacheWritePerMTok: 0.5 } }),
      offer({ id: 'gr', modelKey: 'v/great', providerId: 'c', prices: { inputPerMTok: 10, outputPerMTok: 40, cacheReadPerMTok: 1, cacheWritePerMTok: 10 } }),
    ],
    [evidence('v/good', 70), evidence('v/good-plus', 70.8), evidence('v/great', 80)],
  );
  const r = recommend(s, req()); // balanced: 20 USD every day, 100 for hard problems
  assert.equal(r.everyday?.model.key, 'v/good'); // 70.8 is within 1 point: the cheaper wins
  assert.equal(r.hard, null); // v/great costs over 100 USD a month
  const best = recommend(s, req({ priority: 'quality' })); // 50 and 250 USD
  assert.equal(best.hard?.model.key, 'v/great');
});

test('a runner-up within 3 points in the same budget is shown as the alternative', () => {
  const cheapPrices = { inputPerMTok: 0.1, outputPerMTok: 0.4, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.1 };
  const s = snapshot(
    [model('v/first'), model('v/close'), model('v/far')],
    [
      offer({ id: 'f', modelKey: 'v/first', providerId: 'a', prices: cheapPrices }),
      offer({ id: 'c', modelKey: 'v/close', providerId: 'b', prices: { ...cheapPrices, inputPerMTok: 0.12 } }),
      offer({ id: 'x', modelKey: 'v/far', providerId: 'c', prices: cheapPrices }),
    ],
    [evidence('v/first', 71.5), evidence('v/close', 69.1), evidence('v/far', 60)],
  );
  const r = recommend(s, req({ priority: 'cheap' }));
  assert.equal(r.everyday?.model.key, 'v/first');
  assert.equal(r.everyday?.alternative?.score, 69.1);
  const alone = recommend(snapshot([model('v/first'), model('v/far')], [s.offers[0]!, s.offers[2]!], [s.evidence[0]!, s.evidence[2]!]), req({ priority: 'cheap' }));
  assert.equal(alone.everyday?.alternative, null); // 11.5 points behind is not "very close"
});

test('within 3 points the model OpenCode users keep most wins; beyond 3 points the score wins', () => {
  const prices = { inputPerMTok: 0.1, outputPerMTok: 0.4, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.1 };
  const usage = (modelKey: string, retentionRate: number) => ({ modelKey, name: modelKey, retentionRate, eligibleUserWeeks: 20000, sessionCostUsd: null, observedAt: now.toISOString() });
  const make = (loved: number) =>
    snapshot(
      [model('v/top'), model('v/loved')],
      [offer({ id: 't', modelKey: 'v/top', providerId: 'a', prices }), offer({ id: 'l', modelKey: 'v/loved', providerId: 'b', prices: { ...prices, inputPerMTok: 0.12 } })],
      [evidence('v/top', 71.5), evidence('v/loved', loved)],
      { usage: [usage('v/top', 40), usage('v/loved', 85)] },
    );
  const near = recommend(make(69.1), req({ priority: 'cheap' }));
  assert.equal(near.everyday?.model.key, 'v/loved');
  assert.equal(near.everyday?.decidedByUsage, true);
  assert.equal(recommend(make(66), req({ priority: 'cheap' })).everyday?.model.key, 'v/top');
});

test('budgets grow with the kind of work, so heavier work does not get a weaker model', () => {
  const s = base();
  const bug = budgetFor(s, 'balanced', { input: 8_000_000, output: 900_000, cacheRead: 40_000_000, cacheWrite: 4_000_000 });
  const analysis = budgetFor(s, 'balanced', { input: 20_000_000, output: 600_000, cacheRead: 90_000_000, cacheWrite: 9_000_000 });
  assert.deepEqual(bug, { everyday: 20, hard: 100 });
  assert.ok(analysis.everyday > bug.everyday && analysis.hard > bug.hard);
});
