/**
 * Server-rendered pages, in both languages. The form is a plain GET form: the
 * site works without JavaScript. Every user-facing string comes from the
 * catalogue in i18n.ts - none is written here.
 */
import { SITE, THRESHOLDS, SOURCES } from '../config.js';
import type { ModelRecord, Snapshot, SourceStatus } from '../types.js';
import type { OfferView, Pick, Recommendation, RecommendationRequest } from '../engine/recommend.js';
import { formatScore, metricLabel } from '../engine/recommend.js';
import type { Change } from '../engine/changes.js';
import { SCENARIOS, TASK_IDS, PRIORITIES } from '../engine/scenarios.js';
import { accountName, usabilityLabel } from '../engine/usability.js';
import { signupUrl } from '../engine/signup.js';
import { buildOpenCodeConfig, configFor } from '../engine/opencode.js';
import { t, pagePath, otherLang, type Lang } from '../i18n.js';
import type { RunStatus } from '../pipeline/store.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

/** Content hash of a static file, so a changed file is never served from a stale browser cache. */
const version = (file: string): string => {
  try {
    return createHash('sha1').update(readFileSync(new URL(`./public/${file}`, import.meta.url))).digest('hex').slice(0, 8);
  } catch {
    return 'dev';
  }
};
const CLOUDSALUS_URL = 'https://cloudsalus.com/';
const ASSET_VERSION = { css: version('styles.css'), js: version('app.js'), og: version('og.png') };

export const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const locale = (lang: Lang) => (lang === 'en' ? 'en-GB' : 'it-IT');

const fmt = (lang: Lang) => ({
  n: new Intl.NumberFormat(locale(lang)),
  n2: new Intl.NumberFormat(locale(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  n4: new Intl.NumberFormat(locale(lang), { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
});

const usd = (v: number | null, lang: Lang): string =>
  v === null ? t(lang).home.notAvailable : `${fmt(lang).n2.format(v)} USD`;

const tokens = (v: number, lang: Lang): string => {
  const f = fmt(lang);
  return v >= 1_000_000 ? `${f.n.format(Math.round(v / 100_000) / 10)} M` : f.n.format(v);
};

const dateLong = (iso: string | null | undefined, lang: Lang): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale(lang), {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome',
  });
};
const dateDay = (iso: string | null | undefined, lang: Lang): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(lang), { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' });
};
/** Day and month: every date shown is recent, so the day is what matters. */
const dateShort = (iso: string | null | undefined, lang: Lang): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(lang), { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' });
};

/** "Artificial Analysis Coding Index v4.3" from the comparability key, or the plain metric name. */
const evidenceLabel = (q: { metric: Pick['quality']['metric']; harnessKey: string }): string =>
  q.metric === 'aa_coding_index'
    ? q.harnessKey.replace(/^aa-coding-index\|/, 'Artificial Analysis Coding Index ')
    : metricLabel(q.metric);

/** "DeepSeek: DeepSeek V3.2" -> "DeepSeek V3.2": the vendor is written beside it. */
const modelName = (raw: string): string => {
  const i = raw.indexOf(': ');
  return i > 0 ? raw.slice(i + 2) : raw;
};

type PageId = 'home' | 'method' | 'sources' | 'status';

export function layout(opts: { lang: Lang; title: string; description: string; body: string; active: PageId }): string {
  const c = t(opts.lang);
  const other = otherLang(opts.lang);
  const canonical = `https://${SITE.domain}${pagePath(opts.lang, opts.active)}`;
  const nav: [PageId, string][] = [
    ['home', c.nav.choice],
    ['method', c.nav.method],
    ['sources', c.nav.sources],
    ['status', c.nav.status],
  ];
  return `<!doctype html>
<html lang="${esc(c.htmlLang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="https://${esc(SITE.domain)}/static/og.png?v=${ASSET_VERSION.og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(SITE.name)} — ${esc(c.siteTagline)}">
<meta property="og:locale" content="${opts.lang === 'it' ? 'it_IT' : 'en_GB'}">
<meta property="og:locale:alternate" content="${opts.lang === 'it' ? 'en_GB' : 'it_IT'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(opts.title)}">
<meta name="twitter:description" content="${esc(opts.description)}">
<meta name="twitter:image" content="https://${esc(SITE.domain)}/static/og.png?v=${ASSET_VERSION.og}">
<link rel="alternate" hreflang="it" href="https://${esc(SITE.domain)}${esc(pagePath('it', opts.active))}">
<link rel="alternate" hreflang="en" href="https://${esc(SITE.domain)}${esc(pagePath('en', opts.active))}">
<link rel="alternate" hreflang="x-default" href="https://${esc(SITE.domain)}${esc(pagePath('en', opts.active))}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Courier+Prime:wght@400;700&display=swap">
<link rel="stylesheet" href="/static/styles.css?v=${ASSET_VERSION.css}">
<link rel="icon" href="/static/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/static/favicon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="/static/apple-touch-icon.png">
</head>
<body data-copiato="${esc(c.home.copied)}" data-copia-bloccata="${esc(c.home.copyBlocked)}">
<header class="intestazione">
  <div class="intestazione__barra">
    <div class="marchio">
      <a class="marchio__nome" href="${esc(pagePath(opts.lang, 'home'))}">MODELPICK</a>
      <a class="marchio__di" href="${esc(CLOUDSALUS_URL)}" rel="noopener">by CloudSalus</a>
    </div>
    <nav class="menu">
      ${nav.map(([id, label]) => `<a href="${esc(pagePath(opts.lang, id))}"${opts.active === id ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('')}
      <a href="${esc(SITE.repo)}" rel="noopener">${esc(c.nav.code)}</a>
      <a class="lingua" href="${esc(pagePath(other, opts.active))}?lang=${esc(other)}" hreflang="${esc(other)}">${esc(c.nav.otherLang)}</a>
    </nav>
  </div>
</header>
<main>${opts.body}</main>
<footer class="pie">
  <div class="contenitore pie__righe">
    <p class="meta">${esc(c.home.aaDisclaimer)} <a href="https://artificialanalysis.ai/" rel="noopener">artificialanalysis.ai</a></p>
    <p class="meta"><strong>${esc(SITE.name)}</strong> by <a href="${esc(CLOUDSALUS_URL)}" rel="noopener">CloudSalus</a> · <a href="${esc(pagePath(opts.lang, 'method'))}">${esc(c.nav.method)}</a> · <a href="${esc(pagePath(opts.lang, 'sources'))}">${esc(c.nav.sources)}</a> · <a href="${esc(pagePath(opts.lang, 'status'))}">${esc(c.nav.status)}</a> · MIT</p>
  </div>
</footer>
<script src="/static/app.js?v=${ASSET_VERSION.js}" defer></script>
</body>
</html>`;
}

const option = (value: string, label: string, selected: string): string =>
  `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`;

/** The provider comparison: the answer to "where do I buy this". */
function renderConfronto(pick: Pick, role: string, lang: Lang): string {
  const c = t(lang);
  const riga = (o: OfferView, i: number, scelto: boolean) => {
    const id = `cmd-${role}-${i}`;
    const conf = configFor(o.offer, lang);
    // Righe instradate da OpenRouter condividono lo stesso comando: quello che
    // cambia e' il provider fissato, quindi si copia la configurazione.
    const payload = conf.config ?? conf.command;
    const etichetta = conf.config ? c.home.copyConfig : c.home.copy;
    const link = signupUrl(o.offer);
    return `<tr${scelto ? ' class="scelto"' : ''}>
      <td>
        <strong>${esc(o.offer.providerName)}</strong>
        <span class="meta">${esc(usabilityLabel(o.usability, o.offer, lang))}</span>
      </td>
      <td class="num nowrap"><strong>${esc(usd(o.cost.totalUsd, lang))}</strong></td>
      <td class="azione">
        ${link ? `<a class="riga-link" href="${esc(link)}" target="_blank" rel="noopener">${esc(c.home.key)}</a>` : ''}
        <button class="bottone bottone--contorno bottone--piccolo" type="button" data-copia="#${esc(id)}">${esc(etichetta)}</button>
      </td>
    </tr>
    <tr class="riga-config">
      <td colspan="3">
        <details class="dettagli dettagli--copia">
          <summary>${esc(c.home.showConfig)}</summary>
          <pre class="codice"><code id="${esc(id)}">${esc(payload)}</code></pre>
        </details>
      </td>
    </tr>`;
  };

  const primi = pick.alternatives.slice(0, 3);
  const restanti = pick.alternatives.slice(3);

  return `<div class="acquisto">
    <h4 class="acquisto__titolo">${esc(c.home.whereToBuy)}</h4>
    <table class="tabella confronto">
      <tbody>
        ${riga(pick.chosen, 0, true)}
        ${primi.map((o, i) => riga(o, i + 1, false)).join('')}
      </tbody>
    </table>
    ${restanti.length ? `<details class="dettagli">
      <summary>${esc(c.home.otherProviders(restanti.length))}</summary>
      <div class="dettagli__corpo">
        <table class="tabella confronto"><tbody>${restanti.slice(0, 16).map((o, i) => riga(o, i + 100, false)).join('')}</tbody></table>
      </div>
    </details>` : ''}
  </div>`;
}

function renderDettagli(pick: Pick, lang: Lang, opencodeVersion: string | null): string {
  const c = t(lang);
  const q = pick.quality;
  const f = fmt(lang);
  const righe = pick.cost.lines
    .filter((l) => l.tokens > 0)
    .map((l) => `<div class="prezzi__riga">
        <span class="prezzi__etichetta">${esc(l.label)} · ${esc(tokens(l.tokens, lang))} token</span>
        <span>${esc(usd(l.usd, lang))}</span>
      </div>`)
    .join('');
  const commissioni = [
    ...pick.cost.feeNotes.map((n) => `<div class="prezzi__riga"><span class="prezzi__etichetta">${esc(n)}</span><span>${esc(usd(pick.cost.feesUsd, lang))}</span></div>`),
    ...pick.cost.unquantifiedFees.map((n) => `<div class="prezzi__riga"><span class="prezzi__etichetta">${esc(n)}</span><span class="etichetta etichetta--commissione">—</span></div>`),
  ].join('');

  const profilo = pick.offer.profile;
  const gdpr = profilo?.gdpr === true ? c.home.gdprYes : profilo?.gdpr === false ? c.home.gdprNo : c.home.gdprUnknown;

  return `<details class="dettagli">
    <summary>${esc(c.home.whyThis)}</summary>
    <div class="dettagli__corpo">
      <p>${esc(pick.reason)}</p>
      <p>${c.home.theEvidence(esc(formatScore(q.value, q.metric)), esc(evidenceLabel(q)), esc(q.harness), esc(dateDay(q.measuredAt, lang)))} ${q.metric === 'aa_coding_index'
        ? `<a href="${esc(q.sourceUrl)}" rel="noopener">${esc(c.home.aaSource)}</a>.`
        : `<a href="${esc(q.sourceUrl)}" rel="noopener">${esc(c.home.priceSource)}</a>.`}</p>
      ${q.metric === 'aa_coding_index' ? `<p class="meta">${esc(c.home.evidenceNoDate)}</p>` : ''}
      <div class="prezzi">${righe}${commissioni}
        <div class="prezzi__riga prezzi__riga--totale"><span>${esc(c.home.monthlyTotal)}</span><span>${esc(usd(pick.cost.totalUsd, lang))}</span></div>
      </div>
      ${pick.cost.assumptions.length ? `<p class="meta">${pick.cost.assumptions.map(esc).join(' ')}</p>` : ''}
      ${pick.provisional ? `<p class="meta">${esc(pick.provisionalReasons.join('; '))}.</p>` : ''}
      <p><strong>${esc(c.home.whoIs(pick.offer.providerName))}</strong> ${profilo
        ? `${esc(c.home.profileKnown(profilo.hqCountry ?? c.home.countryUnknown, gdpr))}${profilo.directoryUrl ? `. <a href="${esc(profilo.directoryUrl)}" rel="noopener">${esc(c.home.directoryLink)}</a>` : ''}.`
        : esc(c.home.profileUnknown)} ${esc(c.home.geoNote)}</p>
      <p class="meta">${esc(c.home.priceChecked(dateLong(pick.offer.observedAt, lang)))} ${opencodeVersion ? esc(c.home.verifiedWith(opencodeVersion)) : ''} <a href="${esc(pick.offer.sourceUrl)}" rel="noopener">${esc(c.home.priceSource)}</a>${pick.model.officialUrl ? ` · <a href="${esc(pick.model.officialUrl)}" rel="noopener">${esc(c.home.modelPage)}</a>` : ''}. ${esc(f.n.format(pick.offersCompared))} provider.</p>
    </div>
  </details>`;
}

function renderPick(pick: Pick | null, role: 'quotidiano' | 'difficile', change: Change | null, lang: Lang, empty: string, opencodeVersion: string | null): string {
  const c = t(lang);
  const titolo = role === 'quotidiano' ? c.home.everyday : c.home.hard;
  if (!pick) {
    return `<article class="scheda pick pick--${role}">
      <p class="pick__ruolo">${esc(titolo)}</p>
      <div class="avviso avviso--neutro">${esc(empty)}</div>
    </article>`;
  }
  const conf = configFor(pick.offer, lang);
  const link = signupUrl(pick.offer);
  return `<article class="scheda pick pick--${role}">
    <p class="pick__ruolo">${esc(titolo)}</p>
    <h3 class="pick__modello">${esc(modelName(pick.model.displayName))}</h3>
    <p class="pick__sintesi">${esc(c.home.perMonth('\u0000')).replace('\u0000', `<strong class="pick__prezzo">${esc(usd(pick.cost.totalUsd, lang))}</strong>`)}</p>
    <p class="pick__prova">${esc(c.home.benchmark(formatScore(pick.quality.value, pick.quality.metric), pick.quality.metric === 'aa_coding_index' ? 'Coding Index' : metricLabel(pick.quality.metric), dateShort(pick.quality.measuredAt, lang)))}${pick.quality.metric === 'aa_coding_index' ? ` · <a href="${esc(pick.quality.sourceUrl)}" rel="noopener">${esc(c.home.aaSource)}</a>` : ''}</p>
    ${pick.cost.unquantifiedFees.length ? `<p class="allerta">${esc(c.home.incompleteEstimate)}</p>` : ''}
    ${change?.moved ? `<p class="pick__cambio pick__cambio--mosso">${esc(change.text)}</p>` : ''}
    <ol class="passi">
      <li class="passo">
        <span class="passo__testo">${esc(c.home.getKey(accountName(pick.offer)))}</span>
        ${link ? `<a class="bottone bottone--contorno bottone--piccolo" href="${esc(link)}" target="_blank" rel="noopener">${esc(c.home.open)}</a>` : ''}
      </li>
      ${pick.offer.apiKeyEnv ? `<li class="passo">
        <code class="passo__codice" id="key-${esc(role)}">export ${esc(pick.offer.apiKeyEnv)}="..."</code>
        <button class="bottone bottone--contorno bottone--piccolo" type="button" data-copia="#key-${esc(role)}">${esc(c.home.copy)}</button>
      </li>` : ''}
      ${conf.config ? `<li class="passo">
        <span class="passo__testo">${esc(c.home.saveConfig(pick.offer.providerName))}</span>
        <button class="bottone bottone--piccolo" type="button" data-copia="#config-${esc(role)}">${esc(c.home.copyConfig)}</button>
      </li>
      <li class="passo passo--config">
        <details class="dettagli dettagli--copia">
          <summary>${esc(c.home.showConfig)}</summary>
          <pre class="codice"><code id="config-${esc(role)}">${esc(conf.config)}</code></pre>
        </details>
      </li>` : `<li class="passo">
        <code class="passo__codice" id="config-${esc(role)}">${esc(conf.command)}</code>
        <button class="bottone bottone--piccolo" type="button" data-copia="#config-${esc(role)}">${esc(c.home.copyCommand)}</button>
      </li>`}
    </ol>
    ${conf.pinNote ? `<p class="passi__nota">${esc(conf.pinNote)}</p>` : ''}
    ${renderConfronto(pick, role, lang)}
    ${renderDettagli(pick, lang, opencodeVersion)}
  </article>`;
}

/** Everything that used to be a question, tucked away for whoever wants it. */
function renderIpotesi(req: RecommendationRequest, rec: Recommendation | null, models: ModelRecord[], lang: Lang): string {
  const c = t(lang);
  const modelOptions = models
    .slice()
    .sort((a, b) => modelName(a.displayName).localeCompare(modelName(b.displayName)))
    .map((m) => option(m.key, modelName(m.displayName), req.currentModelKey ?? ''))
    .join('');
  return `<details class="dettagli dettagli--ipotesi">
    <summary>${esc(c.home.customise)}</summary>
    <div class="dettagli__corpo">
      ${rec ? `<p class="meta">${esc(c.home.scenarioNote(tokens(rec.mix.input, lang), tokens(rec.mix.output, lang), tokens(rec.mix.cacheRead, lang)))}</p>` : ''}
      <form class="modulo" method="get" action="${esc(pagePath(lang, 'home'))}">
        <div class="modulo__righe">
          <div class="campo">
            <label for="task">${esc(c.home.workType)}</label>
            <select id="task" name="task">${TASK_IDS.map((t2) => option(t2, c.tasks[t2] ?? SCENARIOS[t2].label, req.task)).join('')}</select>
          </div>
          <div class="campo">
            <label for="priority">${esc(c.home.priority)}</label>
            <select id="priority" name="priority">${PRIORITIES.map((p) => option(p, c.priorities[p] ?? p, req.priority)).join('')}</select>
          </div>
          <div class="campo">
            <label for="input">${esc(c.home.tokensIn)}</label>
            <input id="input" name="input" type="number" min="0" step="1" value="${req.usage?.input ?? ''}" placeholder="${esc(c.home.defaultValue)}">
          </div>
          <div class="campo">
            <label for="output">${esc(c.home.tokensOut)}</label>
            <input id="output" name="output" type="number" min="0" step="1" value="${req.usage?.output ?? ''}" placeholder="${esc(c.home.defaultValue)}">
          </div>
          <div class="campo">
            <label for="cacheRead">${esc(c.home.cacheRead)}</label>
            <input id="cacheRead" name="cacheRead" type="number" min="0" step="1" value="${req.usage?.cacheRead ?? ''}" placeholder="${esc(c.home.defaultValue)}">
          </div>
          <div class="campo">
            <label for="cacheWrite">${esc(c.home.cacheWrite)}</label>
            <input id="cacheWrite" name="cacheWrite" type="number" min="0" step="1" value="${req.usage?.cacheWrite ?? ''}" placeholder="${esc(c.home.defaultValue)}">
          </div>
          <div class="campo">
            <label for="currentModel">${esc(c.home.currentModel)}</label>
            <select id="currentModel" name="currentModel">
              <option value="">${esc(c.home.notSet)}</option>${modelOptions}
            </select>
          </div>
        </div>
        <div class="modulo__azioni">
          <button class="bottone bottone--piccolo" type="submit">${esc(c.home.recompute)}</button>
        </div>
      </form>
    </div>
  </details>`;
}

/** One file that sets up both picks: no more copying one over the other. */
function renderEntrambi(rec: Recommendation | null, lang: Lang): string {
  const c = t(lang);
  if (!rec?.everyday || !rec.hard) return '';
  const config = buildOpenCodeConfig(
    { model: rec.everyday.model, offer: rec.everyday.offer },
    { model: rec.hard.model, offer: rec.hard.offer },
  );
  if (!config) return '';
  const query = new URLSearchParams({ task: rec.request.task, priority: rec.request.priority, lang }).toString();
  return `<div class="scheda entrambi">
    <h3>${esc(c.home.bothTitle)}</h3>
    <p>${esc(c.home.bothIntro(config.everydayId, config.backupId ?? ''))}</p>
    ${(() => {
      const senzaPin = [
        config.pinned.everyday ? null : config.everydayId,
        config.pinned.hard ? null : config.backupId,
      ].filter(Boolean) as string[];
      return senzaPin.length
        ? `<p class="allerta">${esc(c.home.bothNotPinned(senzaPin.join(', ')))}</p>`
        : `<p class="meta">${esc(c.home.bothPinned)}</p>`;
    })()}
    <pre class="codice"><code id="config-entrambi">${esc(config.json)}</code></pre>
    <p class="modulo__azioni">
      <button class="bottone" type="button" data-copia="#config-entrambi">${esc(c.home.copyConfig)}</button>
      <a class="bottone bottone--contorno" href="/opencode.json?${esc(query)}">${esc(c.home.download)}</a>
    </p>
    <p class="meta">${esc(c.home.bothSwitch(config.backupId ?? ''))}</p>
  </div>`;
}

/** Whatever model the user declared, they get an answer about it. */
function renderAttuale(rec: Recommendation | null, lang: Lang): string {
  const c = t(lang);
  const s = rec?.savings;
  if (!s) return '';
  const nome = s.currentModelName ? modelName(s.currentModelName) : '';
  const corpo =
    s.outcome === 'compared' && s.deltaUsd !== null
      ? c.home.comparison(s.currentProviderName ? esc(s.currentProviderName) : null, esc(usd(Math.abs(s.deltaUsd), lang)), s.deltaUsd > 0)
      : s.outcome === 'already-recommended'
        ? `${esc(c.home.currentSame(nome))}${s.currentTotalUsd !== null ? ` ${esc(c.home.currentSamePrice(usd(s.currentTotalUsd, lang)))}` : ''}`
        : s.outcome === 'no-seller'
          ? esc(c.home.currentNoSeller(nome))
          : s.outcome === 'no-evidence'
            ? esc(c.home.currentNoEvidence(nome))
            : s.outcome === 'no-price'
              ? esc(c.home.currentNoPrice(nome))
              : esc(c.home.currentUnknown);
  return `<div class="risparmio risparmio--${s.outcome}">
    <p class="risparmio__titolo">${esc(c.home.currentTitle)}</p>
    <p>${corpo}</p>
  </div>`;
}

export function homePage(opts: {
  lang: Lang;
  rec: Recommendation | null;
  snapshot: Snapshot | null;
  models: ModelRecord[];
  request: RecommendationRequest;
  changes: { everyday: Change | null; hard: Change | null };
}): string {
  const { lang, rec, snapshot, models, request, changes } = opts;
  const c = t(lang);
  const stale = rec?.method.snapshotStale ?? false;

  const body = `
<section class="hero hero--compatto">
  <div class="contenitore">
    <p class="hero__sopratitolo">${snapshot ? esc(c.home.pricesVerified(dateLong(snapshot.generatedAt, lang))) : esc(c.home.noData)}</p>
    <h1>${esc(c.home.title)}</h1>
  </div>
</section>

<section class="sezione">
  <div class="contenitore">
    ${!snapshot ? `<div class="avviso avviso--errore">${esc(c.home.noData)}</div>` : ''}
    ${stale ? `<div class="avviso">${esc(c.home.stale)}</div>` : ''}
    ${rec?.notes.map((n) => `<div class="avviso">${esc(n)}</div>`).join('') ?? ''}
    ${renderAttuale(rec, lang)}
    <div class="risultati">
      ${renderPick(rec?.everyday ?? null, 'quotidiano', changes.everyday, lang, c.home.noEveryday, snapshot?.opencodeVersion ?? null)}
      ${renderPick(rec?.hard ?? null, 'difficile', changes.hard, lang, c.home.noHard, snapshot?.opencodeVersion ?? null)}
    </div>
    ${renderEntrambi(rec, lang)}
    <div class="coda">
      ${renderIpotesi(request, rec, models, lang)}
    </div>
  </div>
</section>
`;
  return layout({
    lang,
    title: `${SITE.name} — ${c.home.title}`,
    description: c.siteDescription,
    body,
    active: 'home',
  });
}

/** A wrong address still gets the site: header, menu and a way back. */
export function notFoundPage(lang: Lang): string {
  const c = t(lang);
  const body = `<section class="sezione">
  <div class="contenitore">
    <h1>${esc(c.notFound.title)}</h1>
    <div class="scheda">
      <p>${esc(c.notFound.message)}</p>
      <p><a class="bottone" href="${esc(pagePath(lang, 'home'))}">${esc(c.notFound.back)}</a></p>
    </div>
  </div>
</section>`;
  return layout({ lang, title: `${c.notFound.title} — ${SITE.name}`, description: c.siteDescription, body, active: 'home' });
}

export function methodPage(lang: Lang): string {
  const c = t(lang);
  const m = c.method;
  const soglie: [string, string][] = [
    [String(THRESHOLDS.offerStaleHours), lang === 'en' ? 'hours: a price older than this cannot win' : 'ore: un prezzo più vecchio non può vincere'],
    [String(THRESHOLDS.snapshotStaleHours), lang === 'en' ? 'hours: the data is flagged as out of date' : 'ore: i dati vengono segnalati come obsoleti'],
    [String(THRESHOLDS.evidenceMaxAgeDays), lang === 'en' ? 'days: an older quality measurement is not used' : 'giorni: una misura di qualità più vecchia non viene usata'],
    [String(THRESHOLDS.evidenceFreshDays), lang === 'en' ? 'days: an older measurement makes the pick provisional' : 'giorni: una misura più vecchia rende la scelta provvisoria'],
    [`${THRESHOLDS.priceJumpFactor}×`, lang === 'en' ? 'price change: the offer is quarantined' : 'variazione di prezzo: offerta in quarantena'],
    [`${THRESHOLDS.maxPricePerMTok} USD/1M`, lang === 'en' ? 'above this a price is discarded as a unit error' : 'oltre questo il prezzo è scartato come errore di unità'],
    [`${THRESHOLDS.minUptime30m}%`, lang === 'en' ? 'minimum recent availability' : 'disponibilità recente minima'],
    [String(THRESHOLDS.backupQualityGapPoints), lang === 'en' ? 'points the backup must add' : 'punti che il modello di riserva deve aggiungere'],
  ];
  const body = `<section class="sezione">
  <div class="contenitore">
    <h1>${esc(m.title)}</h1>
    <p>${esc(m.intro)}</p>
    <div class="scheda" style="margin-bottom:20px"><h2>${esc(m.orderTitle)}</h2><ol class="elenco">${m.order.map((x) => `<li>${x}</li>`).join('')}</ol></div>
    <div class="scheda" style="margin-bottom:20px"><h2>${esc(m.notTitle)}</h2><ul class="elenco">${m.not.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="scheda" style="margin-bottom:20px"><h2>${esc(m.thresholdsTitle)}</h2>
      <table class="tabella"><tbody>${soglie.map(([v, d]) => `<tr><td class="num"><strong>${esc(v)}</strong></td><td>${esc(d)}</td></tr>`).join('')}</tbody></table>
    </div>
    <div class="scheda" style="margin-bottom:20px"><h2>${esc(m.missingTitle)}</h2><p>${esc(m.missing)}</p></div>
    <div class="scheda"><h2>${esc(m.limitsTitle)}</h2><ul class="elenco">${m.limits.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
  </div>
</section>`;
  return layout({ lang, title: `${m.title} — ${SITE.name}`, description: m.intro, body, active: 'method' });
}

export function sourcesPage(snapshot: Snapshot | null, lang: Lang): string {
  const c = t(lang);
  const f = fmt(lang);
  const statuses = new Map<string, SourceStatus>();
  for (const s of snapshot?.sources ?? []) if (!statuses.has(s.id)) statuses.set(s.id, s);

  const rows = SOURCES.map((cfg) => {
    const st = statuses.get(cfg.id);
    const state = !cfg.enabled
      ? `<span class="etichetta etichetta--attenzione">${esc(c.sources.off)}</span>`
      : st?.outcome === 'ok'
        ? `<span class="etichetta etichetta--ok">${esc(c.sources.active)}</span>`
        : st
          ? `<span class="etichetta etichetta--attenzione">${esc(c.sources.failed)}</span>`
          : `<span class="etichetta etichetta--info">${esc(c.sources.never)}</span>`;
    const [, colState, colLicence, colNote, colCount] = c.sources.cols;
    const testi = lang === 'en' ? cfg.en : cfg;
    return `<tr>
      <td class="pila__titolo"><a href="${esc(cfg.url)}" rel="noopener">${esc(cfg.name)}</a></td>
      <td data-etichetta="${esc(colState)}">${state}</td>
      <td data-etichetta="${esc(colLicence)}">${esc(testi.licence)}</td>
      <td data-etichetta="${esc(colNote)}">${esc(testi.note ?? testi.attribution)}</td>
      <td class="num" data-etichetta="${esc(colCount)}">${esc(st ? f.n.format(st.itemCount) : '—')}</td>
    </tr>`;
  }).join('');

  const body = `<section class="sezione">
  <div class="contenitore">
    <h1>${esc(c.sources.title)}</h1>
    <div class="scheda">
      <table class="tabella tabella--pila">
        <thead><tr>${c.sources.cols.map((h, i) => `<th${i === 4 ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
</section>`;
  return layout({ lang, title: `${c.sources.title} — ${SITE.name}`, description: c.siteDescription, body, active: 'sources' });
}

export function statusPage(snapshot: Snapshot | null, status: RunStatus | null, lang: Lang): string {
  const c = t(lang);
  const f = fmt(lang);
  const sources = (snapshot?.sources ?? [])
    .map((s) => `<tr>
        <td class="pila__titolo">${esc(s.name)}</td>
        <td data-etichetta="${esc(c.status.cols[1])}">${esc(s.outcome)}</td>
        <td class="num" data-etichetta="${esc(c.status.cols[2])}">${esc(f.n.format(s.itemCount))}</td>
        <td data-etichetta="${esc(c.status.cols[3])}">${s.error ? esc(s.error) : s.servedFromCache ? esc(c.status.reused(s.dataAgeHours !== null ? f.n2.format(s.dataAgeHours) + ' h' : '—')) : '—'}</td>
        <td class="num" data-etichetta="${esc(c.status.cols[4])}">${s.durationMs !== null ? esc(c.status.duration(f.n.format(s.durationMs))) : '—'}</td>
      </tr>`)
    .join('');

  const body = `<section class="sezione">
  <div class="contenitore">
    <h1>${esc(c.status.title)}</h1>
    <p>${esc(c.status.intro)}</p>
    ${status ? `<div class="scheda" style="margin-bottom:20px">
      <p><strong>${esc(c.status.lastRun(dateLong(status.finishedAt, lang)))}</strong> — ${status.ok ? `<span class="etichetta etichetta--ok">${esc(c.status.ok)}</span>` : `<span class="etichetta etichetta--attenzione">${esc(c.status.problems)}</span>`} ${status.published ? `<span class="etichetta etichetta--ok">${esc(c.status.published)}</span>` : `<span class="etichetta etichetta--attenzione">${esc(c.status.notPublished)}</span>`}</p>
      <p>${esc(status.message)}</p>
      ${status.warnings.length ? `<details class="dettagli"><summary>${esc(c.status.warnings(status.warnings.length))}</summary><div class="dettagli__corpo"><ul class="elenco">${status.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div></details>` : ''}
    </div>` : `<div class="avviso">${esc(c.status.never)}</div>`}
    ${snapshot ? `<div class="scheda">
      <h2>${esc(c.status.dataTitle)}</h2>
      <p class="meta">${esc(dateLong(snapshot.generatedAt, lang))}</p>
      <table class="tabella tabella--pila">
        <thead><tr>${c.status.cols.map((h, i) => `<th${i === 2 || i === 4 ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${sources}</tbody>
      </table>
    </div>` : ''}
  </div>
</section>`;
  return layout({ lang, title: `${c.status.title} — ${SITE.name}`, description: c.siteDescription, body, active: 'status' });
}
