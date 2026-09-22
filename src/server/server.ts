/** HTTP server: server-rendered pages plus a small JSON API. */
import { join } from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { SERVER, SITE, SOURCES } from '../config.js';
import { recommend, type AccessNeed, type PrivacyNeed, type RecommendationRequest } from '../engine/recommend.js';
import { buildOpenCodeConfig } from '../engine/opencode.js';
import { SCENARIOS, TASK_IDS, PRIORITIES, type Priority, type TaskId } from '../engine/scenarios.js';
import { priceHistory, listRuns } from '../pipeline/store.js';
import { homePage, methodPage, sourcesPage, statusPage } from './html.js';
import { currentSnapshot, currentStatus } from './snapshot.js';

type Query = Record<string, string | undefined>;

const positive = (v: string | undefined): number | undefined => {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function parseRequest(q: Query): RecommendationRequest {
  const task = (TASK_IDS as string[]).includes(q['task'] ?? '') ? (q['task'] as TaskId) : 'bug';
  const priority = (PRIORITIES as string[]).includes(q['priority'] ?? '') ? (q['priority'] as Priority) : 'equilibrio';
  const privacy: PrivacyNeed = ['nessuno', 'no-training', 'zero-retention'].includes(q['privacy'] ?? '')
    ? (q['privacy'] as PrivacyNeed)
    : 'nessuno';
  const access: AccessNeed = q['access'] === 'solo-diretto' ? 'solo-diretto' : 'qualsiasi';
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
    country: (q['country'] ?? 'IT').toUpperCase().slice(0, 6),
    privacy,
    access,
    usage: hasUsage ? usage : null,
    currentModelKey: q['currentModel'] || null,
    currentOfferId: q['currentOffer'] || null,
  };
}

export async function buildServer() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, trustProxy: true });

  await app.register(fastifyStatic, {
    root: join(import.meta.dirname, 'public'),
    prefix: '/static/',
    maxAge: '1h',
  });

  /** Everything a page needs: snapshot, recommendation and OpenCode config. */
  const compute = async (query: Query) => {
    const snapshot = await currentSnapshot();
    const request = parseRequest(query);
    if (!snapshot) return { snapshot: null, request, rec: null, config: null, models: [] };
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
    return { snapshot, request, rec, config, models };
  };

  app.get('/', async (req, reply) => {
    const { snapshot, request, rec, config, models } = await compute(req.query as Query);
    reply.type('text/html; charset=utf-8');
    return homePage({ rec, snapshot, models, request, config });
  });

  app.get('/metodo', async (_req, reply) => {
    reply.type('text/html; charset=utf-8');
    return methodPage();
  });

  app.get('/fonti', async (_req, reply) => {
    reply.type('text/html; charset=utf-8');
    return sourcesPage(await currentSnapshot());
  });

  app.get('/stato', async (_req, reply) => {
    reply.type('text/html; charset=utf-8');
    return statusPage(await currentSnapshot(), await currentStatus());
  });

  app.get('/opencode.json', async (req, reply) => {
    const { config } = await compute(req.query as Query);
    if (!config) return reply.code(404).send({ errore: 'Nessuna raccomandazione disponibile.' });
    reply.header('content-disposition', 'attachment; filename="opencode.json"');
    reply.type('application/json; charset=utf-8');
    return config.json;
  });

  app.get('/api/raccomandazione', async (req) => {
    const { snapshot, request, rec, config } = await compute(req.query as Query);
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
