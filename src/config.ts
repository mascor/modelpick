/**
 * Single place for every rule, threshold and switch. Anything a maintainer may
 * need to tune lives here and is documented in METHODOLOGY.md.
 */
import { join } from 'node:path';

const env = process.env;
const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);
const bool = (v: string | undefined, d: boolean) => (v === undefined ? d : v === 'true' || v === '1');

export const ROOT = env.MODELPICK_ROOT ?? process.cwd();
export const DATA_DIR = env.MODELPICK_DATA_DIR ?? join(ROOT, 'data');
export const PATHS = {
  data: DATA_DIR,
  cache: join(DATA_DIR, 'cache'),
  runs: join(DATA_DIR, 'runs'),
  curated: join(DATA_DIR, 'curated'),
  current: join(DATA_DIR, 'current.json'),
  status: join(DATA_DIR, 'last-run.json'),
  /** Model ids OpenCode accepts, extracted from OpenCode at image build time. */
  registry: env.MODELPICK_REGISTRY_DIR ?? join(ROOT, 'registry'),
};

export const SERVER = {
  host: env.HOST ?? '0.0.0.0',
  port: num(env.PORT, 8031),
};

export const SCHEDULE = {
  /** Documented daily run time, Europe/Rome. Kept before 08:00 as required. */
  timezone: env.MODELPICK_TZ ?? 'Europe/Rome',
  hour: num(env.MODELPICK_RUN_HOUR, 6),
  minute: num(env.MODELPICK_RUN_MINUTE, 30),
  /** Run once at boot if the published snapshot is older than this. */
  catchUpAfterHours: num(env.MODELPICK_CATCHUP_HOURS, 24),
};

export const HTTP = {
  timeoutMs: num(env.MODELPICK_HTTP_TIMEOUT_MS, 30_000),
  retries: num(env.MODELPICK_HTTP_RETRIES, 3),
  backoffMs: num(env.MODELPICK_HTTP_BACKOFF_MS, 1_000),
  concurrency: num(env.MODELPICK_HTTP_CONCURRENCY, 6),
  userAgent:
    env.MODELPICK_USER_AGENT ??
    'ModelPick/0.1 (+https://modelpick.cloudsalus.com; open-source price comparison; contact via GitHub issues)',
};

export const THRESHOLDS = {
  /** An offer older than this may still be shown, but can never win. */
  offerStaleHours: num(env.MODELPICK_OFFER_STALE_HOURS, 48),
  /** Beyond this the whole snapshot is flagged as out of date in the UI. */
  snapshotStaleHours: num(env.MODELPICK_SNAPSHOT_STALE_HOURS, 36),
  /**
   * Quality evidence older than this is not used at all: a measurement from
   * months ago says little about a model that has been updated since.
   */
  evidenceMaxAgeDays: num(env.MODELPICK_EVIDENCE_MAX_DAYS, 7),
  /** Evidence older than this, but within the maximum, makes the pick provisional. */
  evidenceFreshDays: num(env.MODELPICK_EVIDENCE_FRESH_DAYS, 2),
  /** Reject a price that moved more than this factor vs the previous run. */
  priceJumpFactor: num(env.MODELPICK_PRICE_JUMP_FACTOR, 5),
  /** Upper sanity bound, USD per 1M tokens. Above this we assume a unit error. */
  maxPricePerMTok: num(env.MODELPICK_MAX_PRICE, 2_000),
  /** Offers below this uptime are not eligible to win. */
  minUptime30m: num(env.MODELPICK_MIN_UPTIME, 90),
  /** Minimum context an offer must serve to be usable with a coding agent. */
  minContextTokens: num(env.MODELPICK_MIN_CONTEXT, 100_000),
  /** A backup must beat the everyday pick by at least this many points. */
  backupQualityGapPoints: num(env.MODELPICK_BACKUP_GAP, 3),
};

/** Artificial Analysis API: private key, and a download at most once per update. */
export const AA = {
  apiKey: env.AA_API_KEY ?? '',
  baseUrl: 'https://artificialanalysis.ai/api/v2/language/models/free',
  /** A download younger than this is reused, so rerunning the update costs no calls. */
  cacheHours: num(env.MODELPICK_AA_CACHE_HOURS, 20),
  /** Safety cap on pagination (free quota: 100 calls per 24 hours). */
  maxPages: 20,
};

export interface SourceConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  licence: string;
  attribution: string;
  /** Explains a disabled source, shown verbatim on the sources page. */
  note: string | null;
}

/**
 * Sources are opt-in per source. Anything whose reuse terms we have not read in
 * full ships disabled: our MIT licence does not extend to third-party data.
 */
export const SOURCES: SourceConfig[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    url: 'https://openrouter.ai/models',
    enabled: bool(env.SOURCE_OPENROUTER, true),
    licence: 'API pubblica non autenticata',
    attribution: 'Prezzi per provider da openrouter.ai/api/v1',
    note: null,
  },
  {
    id: 'modelsdev',
    name: 'Models.dev',
    url: 'https://models.dev',
    enabled: bool(env.SOURCE_MODELSDEV, true),
    licence: 'Dataset aperto (models.dev/api.json)',
    attribution: 'Listini diretti e capacità dei modelli da models.dev',
    note: null,
  },
  {
    id: 'swebench',
    name: 'SWE-bench Verified (leaderboard experiments)',
    url: 'https://github.com/SWE-bench/experiments',
    enabled: bool(env.SOURCE_SWEBENCH, false),
    licence: 'Licenza non dichiarata dal repository',
    attribution: 'Risultati SWE-bench Verified, repository SWE-bench/experiments',
    note:
      'Disattivata: le misure pubblicate hanno spesso mesi e usiamo solo prove di qualità di al massimo 7 giorni.',
  },
  {
    id: 'aider',
    name: 'Aider polyglot benchmark',
    url: 'https://aider.chat/docs/leaderboards/',
    enabled: bool(env.SOURCE_AIDER, false),
    licence: 'Apache-2.0',
    attribution: 'Aider polyglot leaderboard, repository Aider-AI/aider (Apache-2.0)',
    note: 'Disattivata: la classifica non viene aggiornata ogni settimana e usiamo solo prove di qualità di al massimo 7 giorni.',
  },
  {
    id: 'infrabase',
    name: 'Infrabase.ai',
    url: 'https://infrabase.ai/compare/inference-apis',
    enabled: bool(env.SOURCE_INFRABASE, true),
    licence: 'CC-BY-4.0',
    attribution: 'Dati sui provider da Infrabase.ai, licenza CC-BY-4.0',
    note: 'Directory curata a mano: sede legale, stato GDPR e sito ufficiale di ogni provider. Il robots.txt del sito indirizza esplicitamente gli agenti alla sua API pubblica.',
  },
  {
    id: 'artificialanalysis',
    name: 'Artificial Analysis',
    url: 'https://artificialanalysis.ai/',
    enabled: bool(env.SOURCE_ARTIFICIALANALYSIS, false) && Boolean(env.AA_API_KEY),
    licence: 'Artificial Analysis Terms of Use e Data Platform Terms',
    attribution: 'Source: Artificial Analysis (artificialanalysis.ai)',
    note:
      "Fonte principale della qualità: Coding Index scaricato dall'API a ogni aggiornamento. Richiede una chiave (AA_API_KEY). I valori sono riportati come pubblicati; Artificial Analysis non ha verificato né approvato le scelte di ModelPick.",
  },
  {
    id: 'pricepertoken',
    name: 'Price Per Token',
    url: 'https://pricepertoken.com/',
    enabled: bool(env.SOURCE_PRICEPERTOKEN, false),
    licence: 'Non dichiarata',
    attribution: 'pricepertoken.com',
    note: 'Disattivata: nessun termine di riuso pubblicato e nessuna API. Da usare solo come controllo manuale.',
  },
  {
    id: 'cheaperinference',
    name: 'Cheaper Inference',
    url: 'https://www.cheaperinference.com/',
    enabled: bool(env.SOURCE_CHEAPERINFERENCE, false),
    licence: 'Da verificare (/legal/terms)',
    attribution: 'cheaperinference.com',
    note: 'Disattivata: robots.txt blocca /api/ e i termini non sono ancora stati letti integralmente.',
  },
  {
    id: 'llmprice',
    name: 'llmprice.gitlab.io',
    url: 'https://llmprice.gitlab.io/',
    enabled: false,
    licence: 'Ridondante',
    attribution: 'llmprice.gitlab.io',
    note:
      'Non integrata di proposito: il sito dichiara di aggregare models.dev, che leggiamo già alla fonte. Evitiamo una copia di seconda mano.',
  },
];

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);
export const enabledSources = () => SOURCES.filter((s) => s.enabled);

/** Public site metadata. */
export const SITE = {
  name: 'ModelPick',
  tagline: 'Il modello giusto. Il provider più conveniente.',
  domain: env.MODELPICK_DOMAIN ?? 'modelpick.cloudsalus.com',
  repo: env.MODELPICK_REPO ?? 'https://github.com/mascor/modelpick',
};
