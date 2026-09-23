/** HTTP server: server-rendered pages plus a small JSON API. */
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { SERVER, SITE, SOURCES } from '../config.js';
import { recommend, type RecommendationRequest } from '../engine/recommend.js';
import { buildOpenCodeConfig } from '../engine/opencode.js';
import { INTENSITY_IDS, SCENARIOS, TASK_IDS, PRIORITIES, type Intensity, type Priority, type TaskId } from '../engine/scenarios.js';
import { browserLang, DEFAULT_LANG, isLang, LANG_COOKIE, LANGS, pagePath, type Lang, type Page } from '../i18n.js';
import { priceHistory, listRuns, previousRun } from '../pipeline/store.js';
import { describeChange, type Change } from '../engine/changes.js';
import { goPage, homePage, methodPage, notFoundPage, sourcesPage, statusPage } from './html.js';
import { comparePlan } from '../engine/plans.js';
import { currentSnapshot, currentStatus } from './snapshot.js';

type Query = Record<string, string | undefined>;

const positive = (v: string | undefined): number | undefined => {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/** The first links used Italian values; they keep landing on the same choice. */
const LEGACY_VALUES: Record<string, string> = {
  risparmio: 'cheap',
  equilibrio: 'balanced',
  qualita: 'quality',
  'piccole-modifiche': 'small-changes',
  'nuove-funzionalita': 'new-features',
  analisi: 'analysis',
};
const current = (v: string | undefined): string => (v && LEGACY_VALUES[v]) || v || '';

export function parseRequest(q: Query, lang: Lang = DEFAULT_LANG): RecommendationRequest {
  const t = current(q['task']);
  const p = current(q['priority']);
  const task = (TASK_IDS as string[]).includes(t) ? (t as TaskId) : 'bug';
  const priority = (PRIORITIES as string[]).includes(p) ? (p as Priority) : 'balanced';
  const usage = {
    input: positive(q['input']),
    output: positive(q['output']),
    cacheRead: positive(q['cacheRead']),
    cacheWrite: positive(q['cacheWrite']),
  };
  const hasUsage = Object.values(usage).some((v) => v !== undefined);
  return {
    task,
    priority,
    lang,
    usage: hasUsage ? usage : null,
    currentModelKey: q['currentModel'] || null,
    currentOfferId: q['currentOffer'] || null,
    privacy: q['privacy'] === '1',
    intensity: (INTENSITY_IDS as string[]).includes(q['intensity'] ?? '') ? (q['intensity'] as Intensity) : 'standard',
  };
}

export async function buildServer() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, trustProxy: true });

  await app.register(fastifyStatic, {
    root: fileURLToPath(new URL('./public', import.meta.url)),
    prefix: '/static/',
    maxAge: '1h',
  });

  /** Everything a page needs: snapshot, recommendation and OpenCode config. */
  const compute = async (query: Query, lang: Lang = DEFAULT_LANG) => {
    const snapshot = await currentSnapshot();
    const request = parseRequest(query, lang);
    const noChanges: { everyday: Change | null; hard: Change | null } = { everyday: null, hard: null };
    if (!snapshot) return { snapshot: null, request, rec: null, config: null, changes: noChanges };
    const rec = recommend(snapshot, request);
    const config = buildOpenCodeConfig(
      rec.everyday ? { model: rec.everyday.model, offer: rec.everyday.offer, effort: rec.everyday.quality.effort } : null,
      rec.hard ? { model: rec.hard.model, offer: rec.hard.offer, effort: rec.hard.quality.effort } : null,
      request.privacy ?? false,
    );
    // What moved since the previous published update: the reason to open the
    // page in the morning at all.
    let changes = noChanges;
    const before = await previousRun(snapshot.runId);
    if (before) {
      const earlier = recommend(before, request);
      changes = {
        everyday: describeChange(earlier.everyday, rec.everyday, lang),
        hard: describeChange(earlier.hard, rec.hard, lang),
      };
    }
    return { snapshot, request, rec, config, changes };
  };

  /** The same four pages in two languages: Italian at the root, English under /en. */
  /** The language this visitor gets: a choice made from the menu first, then the browser's first language. */
  const cookieLang = (header: string | undefined): Lang | null => {
    const m = new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=(it|en)(?:;|$)`).exec(header ?? '');
    return m && isLang(m[1]) ? m[1] : null;
  };

  /**
   * Crawlers and link-preview fetchers get the page in the language of the URL
   * they asked for. Redirecting them would leave the Italian pages unindexable
   * and would show an English preview for an Italian link.
   */
  const isBot = (ua: string | undefined): boolean =>
    /bot|crawler|spider|slurp|facebookexternalhit|whatsapp|slack|twitterbot|discord|telegram|linkedin|embedly|preview|pinterest|applebot|bingpreview|google-inspectiontool|duckduckbot|yandex|baiduspider|semrush|ahrefs|petal|headlesschrome|lighthouse/i.test(ua ?? '');

  /**
   * Before every page: remember a language picked from the menu (?lang=), and
   * send anyone who has not asked for Italian from the Italian pages to the
   * English ones.
   */
  const negotiate = (lang: Lang, page: Page) =>
    async (req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => {
      const query = { ...(req.query as Query) };
      const picked = isLang(query['lang']) ? query['lang'] : null;
      if (picked) {
        reply.header('set-cookie', `${LANG_COOKIE}=${picked}; Path=/; Max-Age=31536000; SameSite=Lax`);
        delete query['lang'];
      }
      const wanted = picked ?? cookieLang(req.headers.cookie) ?? browserLang(req.headers['accept-language']);
      reply.header('vary', 'Accept-Language, Cookie, User-Agent');
      if (lang === 'it' && wanted !== 'it' && !isBot(req.headers['user-agent'])) {
        const qs = new URLSearchParams(query as Record<string, string>).toString();
        return reply.redirect(pagePath('en', page) + (qs ? `?${qs}` : ''), 302);
      }
    };

  const register = (lang: Lang, paths: Record<Page, string>) => {
    app.get(paths.home, { onRequest: negotiate(lang, 'home') }, async (req, reply) => {
      const { snapshot, request, rec, changes } = await compute(req.query as Query, lang);
      const go = snapshot ? comparePlan(snapshot, 'opencode-go', request) : null;
      reply.type('text/html; charset=utf-8');
      return homePage({ lang, rec, snapshot, request, changes, go });
    });
    app.get(paths.go, { onRequest: negotiate(lang, 'go') }, async (req, reply) => {
      const snapshot = await currentSnapshot();
      const request = parseRequest(req.query as Query, lang);
      reply.type('text/html; charset=utf-8');
      return goPage({ lang, snapshot, request, go: snapshot ? comparePlan(snapshot, 'opencode-go', request) : null });
    });
    app.get(paths.method, { onRequest: negotiate(lang, 'method') }, async (_req, reply) => {
      reply.type('text/html; charset=utf-8');
      return methodPage(lang, await currentSnapshot());
    });
    app.get(paths.sources, { onRequest: negotiate(lang, 'sources') }, async (_req, reply) => {
      reply.type('text/html; charset=utf-8');
      return sourcesPage(await currentSnapshot(), lang);
    });
    app.get(paths.status, { onRequest: negotiate(lang, 'status') }, async (_req, reply) => {
      reply.type('text/html; charset=utf-8');
      return statusPage(await currentSnapshot(), await currentStatus(), lang);
    });
  };

  register('it', { home: pagePath('it', 'home'), method: pagePath('it', 'method'), go: pagePath('it', 'go'), sources: pagePath('it', 'sources'), status: pagePath('it', 'status') });
  register('en', { home: pagePath('en', 'home'), method: pagePath('en', 'method'), go: pagePath('en', 'go'), sources: pagePath('en', 'sources'), status: pagePath('en', 'status') });
  // Trailing slash on the English home, so /en/ works like /en.
  app.get('/en/', async (req, reply) => reply.redirect('/en' + (req.raw.url?.includes('?') ? req.raw.url.slice(req.raw.url.indexOf('?')) : ''), 301));

  const langOf = (q: Query): Lang => (isLang(q['lang']) ? q['lang'] : DEFAULT_LANG);

  // role=everyday|hard downloads the file for that pick alone; without it, both.
  app.get('/opencode.json', async (req, reply) => {
    const q = req.query as Query;
    const { config: both, rec } = await compute(q, langOf(q));
    const one = q['role'] === 'everyday' ? rec?.everyday : q['role'] === 'hard' ? rec?.hard : null;
    const config = one ? buildOpenCodeConfig({ model: one.model, offer: one.offer, effort: one.quality.effort }, null, rec?.request.privacy ?? false) : both;
    if (!config) return reply.code(404).send({ error: 'No recommendation available.' });
    reply.header('content-disposition', 'attachment; filename="opencode.json"');
    reply.type('application/json; charset=utf-8');
    return config.json;
  });

  // The API speaks English. The Italian paths it had first stay, unchanged in
  // shape, so nobody who already calls them breaks.
  const recommendationData = async (q: Query) => {
    const { snapshot, request, rec, config } = await compute(q, langOf(q));
    return { snapshot, request, rec, config };
  };
  const statusData = async () => {
    const snapshot = await currentSnapshot();
    return { stats: snapshot?.stats ?? null, updatedAt: snapshot?.generatedAt ?? null, lastRun: await currentStatus(), runs: (await listRuns(30)).length };
  };
  const sourcesData = async () => {
    const snapshot = await currentSnapshot();
    return SOURCES.map((s) => ({ s, outcome: snapshot?.sources.find((x) => x.id === s.id)?.outcome ?? null }));
  };
  const modelsData = async () => {
    const snapshot = await currentSnapshot();
    if (!snapshot) return [];
    const evidence = new Set(snapshot.evidence.map((e) => e.modelKey));
    return Object.values(snapshot.models).filter((m) => evidence.has(m.key));
  };

  app.get('/api/recommendation', async (req) => {
    const { snapshot, request, rec, config } = await recommendationData(req.query as Query);
    if (!snapshot) return { error: 'No snapshot published yet.' };
    return { request, recommendation: rec, opencode: config, updatedAt: snapshot.generatedAt };
  });
  app.get('/api/status', async () => {
    const d = await statusData();
    return { snapshot: d.stats, updatedAt: d.updatedAt, lastRun: d.lastRun, storedRuns: d.runs };
  });
  app.get('/api/sources', async () => (await sourcesData()).map(({ s, outcome }) => ({ ...s, state: outcome ?? 'never-run' })));
  app.get('/api/models', async () =>
    (await modelsData()).map((m) => ({ key: m.key, name: m.displayName, contextTokens: m.contextTokens, tools: m.toolCall })),
  );
  app.get('/api/scenarios', async () => SCENARIOS);
  // The plan against the cheapest provider, per model, for the chosen kind of work.
  app.get('/api/plans/opencode-go', async (req) => {
    const q = req.query as Query;
    const snapshot = await currentSnapshot();
    if (!snapshot) return { error: 'No snapshot published yet.' };
    const request = parseRequest(q, langOf(q));
    const go = comparePlan(snapshot, 'opencode-go', request);
    if (!go) return { error: 'No plan data published yet.' };
    return {
      plan: go.plan,
      task: request.task,
      mix: go.mix,
      stale: go.stale,
      intensity: request.intensity ?? 'standard',
      summary: { usable: go.summary.usable, planCheaper: go.summary.planCheaper, best: go.summary.best?.planModelId ?? null },
      choice: Object.fromEntries((['recommended', 'alternative'] as const).map((k) => {
        const o = go.choice[k];
        return [k, o ? { kind: o.kind, modelKey: o.modelKey, provider: o.providerName, monthUsd: o.costUsd, quality: o.quality.value } : null];
      })),
      promotions: go.plan.promotions ?? [],
      rows: go.rows.map((r) => ({
        model: r.planModelId,
        modelKey: r.modelKey,
        opencodeId: r.offer.opencodeId ?? null,
        excluded: r.blocker,
        quality: r.quality ? { value: r.quality.value, metric: r.quality.metric, measuredAt: r.quality.measuredAt } : null,
        capUsd: r.terms.capUsd,
        allowanceUsedUsd: r.month?.drawUsd ?? null,
        coveredShare: r.month?.coveredShare ?? null,
        planMonthUsd: r.month?.totalUsd ?? null,
        overageFrom: r.overageFrom,
        peakPrices: r.peakApplied,
        cheapestProvider: r.direct ? { provider: r.direct.offer.providerName, offerId: r.direct.offer.id, monthUsd: r.direct.cost.totalUsd } : null,
        savingUsd: r.savingUsd,
        verdict: r.verdict,
        paysOffBetweenUsd: r.breakEven,
        retentionDays: r.terms.retentionDays,
        trainsOnData: r.terms.trainsOnData,
        note: r.terms.note ?? null,
      })),
      updatedAt: snapshot.generatedAt,
    };
  });
  app.get('/api/history', async (req, reply) => {
    const model = (req.query as Query)['model'];
    if (!model) return reply.code(400).send({ error: 'Missing "model" parameter.' });
    return { model, series: await priceHistory(model) };
  });

  // Legacy Italian paths, same responses as before.
  app.get('/api/raccomandazione', async (req) => {
    const { snapshot, request, rec, config } = await recommendationData(req.query as Query);
    if (!snapshot) return { errore: 'Nessuno snapshot pubblicato.' };
    return { richiesta: request, raccomandazione: rec, opencode: config, aggiornatoIl: snapshot.generatedAt };
  });
  app.get('/api/stato', async () => {
    const d = await statusData();
    return { snapshot: d.stats, aggiornatoIl: d.updatedAt, ultimaEsecuzione: d.lastRun, esecuzioniStoriche: d.runs };
  });
  app.get('/api/fonti', async () => (await sourcesData()).map(({ s, outcome }) => ({ ...s, stato: outcome ?? 'mai eseguita' })));
  app.get('/api/modelli', async () =>
    (await modelsData()).map((m) => ({ chiave: m.key, nome: m.displayName, contesto: m.contextTokens, strumenti: m.toolCall })),
  );
  app.get('/api/scenari', async () => SCENARIOS);
  app.get('/api/storico', async (req, reply) => {
    const model = (req.query as Query)['model'];
    if (!model) return reply.code(400).send({ errore: 'Parametro "model" mancante.' });
    return { modello: model, serie: await priceHistory(model) };
  });

  // Browsers ask for /favicon.ico on their own: same CloudSalus icon as the <link> tags.
  app.get('/favicon.ico', async (_req, reply) => reply.redirect('/static/favicon-32.png', 301));

  app.get('/robots.txt', async (_req, reply) => {
    reply.type('text/plain; charset=utf-8').header('cache-control', 'public, max-age=3600');
    return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /opencode.json\n\nSitemap: https://${SITE.domain}/sitemap.xml\n`;
  });

  /** Both languages, each page declared as the alternate of the other. */
  app.get('/sitemap.xml', async (_req, reply) => {
    const pages: Page[] = ['home', 'go', 'method', 'sources', 'status'];
    const updated = ((await currentSnapshot())?.generatedAt ?? new Date().toISOString()).slice(0, 10);
    const url = (lang: Lang, page: Page) => `https://${SITE.domain}${pagePath(lang, page)}`;
    const entries = pages
      .flatMap((page) =>
        LANGS.map(
          (lang) => `  <url>
    <loc>${url(lang, page)}</loc>
    <lastmod>${updated}</lastmod>
${LANGS.map((alt) => `    <xhtml:link rel="alternate" hreflang="${alt}" href="${url(alt, page)}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${url('en', page)}"/>
  </url>`,
        ),
      )
      .join('\n');
    reply.type('application/xml; charset=utf-8').header('cache-control', 'public, max-age=3600');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries}\n</urlset>\n`;
  });

  // A wrong address is a person who got lost, not a JSON client: the API keeps JSON.
  app.setNotFoundHandler(async (req, reply) => {
    const url = req.raw.url ?? '';
    if (url.startsWith('/api/') || url.startsWith('/static/') || url === '/health' || url === '/salute') {
      return reply.code(404).send({ error: 'Not found.', url });
    }
    const lang = cookieLang(req.headers.cookie) ?? browserLang(req.headers['accept-language']);
    reply.code(404).type('text/html; charset=utf-8').header('vary', 'Accept-Language, Cookie');
    return notFoundPage(lang);
  });

  app.get('/health', async () => {
    const snapshot = await currentSnapshot();
    return { status: 'ok', site: SITE.name, snapshot: snapshot ? snapshot.generatedAt : null };
  });
  app.get('/salute', async () => {
    const snapshot = await currentSnapshot();
    return { stato: 'ok', sito: SITE.name, snapshot: snapshot ? snapshot.generatedAt : null };
  });

  return app;
}

const invokedDirectly = process.argv[1] && /server\.(ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const app = await buildServer();
  try {
    await app.listen({ host: SERVER.host, port: SERVER.port });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
