/** HTTP server: server-rendered pages plus a small JSON API. */
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { SERVER, SITE, SOURCES } from '../config.js';
import { recommend, type RecommendationRequest } from '../engine/recommend.js';
import { buildOpenCodeConfig } from '../engine/opencode.js';
import { SCENARIOS, TASK_IDS, PRIORITIES, type Priority, type TaskId } from '../engine/scenarios.js';
import { browserLang, DEFAULT_LANG, isLang, LANG_COOKIE, pagePath, type Lang } from '../i18n.js';
import { priceHistory, listRuns, previousRun } from '../pipeline/store.js';
import { describeChange, type Change } from '../engine/changes.js';
import { homePage, methodPage, sourcesPage, statusPage } from './html.js';
import { currentSnapshot, currentStatus } from './snapshot.js';

type Query = Record<string, string | undefined>;

const positive = (v: string | undefined): number | undefined => {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function parseRequest(q: Query, lang: Lang = DEFAULT_LANG): RecommendationRequest {
  const task = (TASK_IDS as string[]).includes(q['task'] ?? '') ? (q['task'] as TaskId) : 'bug';
  const priority = (PRIORITIES as string[]).includes(q['priority'] ?? '') ? (q['priority'] as Priority) : 'equilibrio';
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
    if (!snapshot) return { snapshot: null, request, rec: null, config: null, models: [], changes: noChanges };
    const rec = recommend(snapshot, request);
    const config = buildOpenCodeConfig(
      rec.everyday ? { model: rec.everyday.model, offer: rec.everyday.offer } : null,
      rec.hard ? { model: rec.hard.model, offer: rec.hard.offer } : null,
    );
    // The form only lists models a developer could plausibly be coding with:
    // something measured on a coding benchmark and actually sold somewhere.
    const withOffers = new Set(snapshot.offers.map((o) => o.modelKey));
    const measured = new Set(snapshot.evidence.map((e) => e.modelKey));
    const models = Object.values(snapshot.models).filter((m) => withOffers.has(m.key) && measured.has(m.key));

    // What moved since the previous published update: the reason to open the
    // page in the morning at all.
    let changes = noChanges;
    const before = await previousRun(snapshot.runId);
    if (before) {
      const prima = recommend(before, request);
      changes = {
        everyday: describeChange(prima.everyday, rec.everyday, lang),
        hard: describeChange(prima.hard, rec.hard, lang),
      };
    }
    return { snapshot, request, rec, config, models, changes };
  };

  /** The same four pages in two languages: Italian at the root, English under /en. */
  /** The language this visitor gets: a choice made from the menu first, then the browser's first language. */
  const cookieLang = (header: string | undefined): Lang | null => {
    const m = new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=(it|en)(?:;|$)`).exec(header ?? '');
    return m && isLang(m[1]) ? m[1] : null;
  };

  /**
   * Before every page: remember a language picked from the menu (?lang=), and
   * send anyone who has not asked for Italian from the Italian pages to the
   * English ones.
   */
  const negotiate = (lang: Lang, page: 'home' | 'method' | 'sources' | 'status') =>
    async (req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => {
      const query = { ...(req.query as Query) };
      const picked = isLang(query['lang']) ? query['lang'] : null;
      if (picked) {
        reply.header('set-cookie', `${LANG_COOKIE}=${picked}; Path=/; Max-Age=31536000; SameSite=Lax`);
        delete query['lang'];
      }
      const wanted = picked ?? cookieLang(req.headers.cookie) ?? browserLang(req.headers['accept-language']);
      reply.header('vary', 'Accept-Language, Cookie');
      if (lang === 'it' && wanted !== 'it') {
        const qs = new URLSearchParams(query as Record<string, string>).toString();
        return reply.redirect(pagePath('en', page) + (qs ? `?${qs}` : ''), 302);
      }
    };

  const registra = (lang: Lang, paths: { home: string; method: string; sources: string; status: string }) => {
    app.get(paths.home, { onRequest: negotiate(lang, 'home') }, async (req, reply) => {
      const { snapshot, request, rec, models, changes } = await compute(req.query as Query, lang);
      reply.type('text/html; charset=utf-8');
      return homePage({ lang, rec, snapshot, models, request, changes });
    });
    app.get(paths.method, { onRequest: negotiate(lang, 'method') }, async (_req, reply) => {
      reply.type('text/html; charset=utf-8');
      return methodPage(lang);
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

  registra('it', { home: '/', method: '/metodo', sources: '/fonti', status: '/stato' });
  registra('en', { home: '/en', method: '/en/method', sources: '/en/sources', status: '/en/status' });
  // Trailing slash on the English home, so /en/ works like /en.
  app.get('/en/', async (req, reply) => reply.redirect('/en' + (req.raw.url?.includes('?') ? req.raw.url.slice(req.raw.url.indexOf('?')) : ''), 301));

  const langOf = (q: Query): Lang => (isLang(q['lang']) ? q['lang'] : DEFAULT_LANG);

  app.get('/opencode.json', async (req, reply) => {
    const { config } = await compute(req.query as Query, langOf(req.query as Query));
    if (!config) return reply.code(404).send({ errore: 'Nessuna raccomandazione disponibile.' });
    reply.header('content-disposition', 'attachment; filename="opencode.json"');
    reply.type('application/json; charset=utf-8');
    return config.json;
  });

  app.get('/api/raccomandazione', async (req) => {
    const { snapshot, request, rec, config } = await compute(req.query as Query, langOf(req.query as Query));
    if (!snapshot) return { errore: 'Nessuno snapshot pubblicato.' };
    return { richiesta: request, raccomandazione: rec, opencode: config, aggiornatoIl: snapshot.generatedAt };
  });

  app.get('/api/stato', async () => ({
    snapshot: (await currentSnapshot())?.stats ?? null,
    aggiornatoIl: (await currentSnapshot())?.generatedAt ?? null,
    ultimaEsecuzione: await currentStatus(),
    esecuzioniStoriche: (await listRuns(30)).length,
  }));

  app.get('/api/fonti', async () => {
    const snapshot = await currentSnapshot();
    return SOURCES.map((s) => ({
      ...s,
      stato: snapshot?.sources.find((x) => x.id === s.id)?.outcome ?? 'mai eseguita',
    }));
  });

  app.get('/api/modelli', async () => {
    const snapshot = await currentSnapshot();
    if (!snapshot) return [];
    const evidence = new Set(snapshot.evidence.map((e) => e.modelKey));
    return Object.values(snapshot.models)
      .filter((m) => evidence.has(m.key))
      .map((m) => ({ chiave: m.key, nome: m.displayName, contesto: m.contextTokens, strumenti: m.toolCall }));
  });

  app.get('/api/scenari', async () => SCENARIOS);

  app.get('/api/storico', async (req, reply) => {
    const model = (req.query as Query)['model'];
    if (!model) return reply.code(400).send({ errore: 'Parametro "model" mancante.' });
    return { modello: model, serie: await priceHistory(model) };
  });

  // Browsers ask for /favicon.ico on their own: same CloudSalus icon as the <link> tags.
  app.get('/favicon.ico', async (_req, reply) => reply.redirect('/static/favicon-32.png', 301));

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
