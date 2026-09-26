/**
 * Server-rendered pages, in both languages. The controls are plain links: the
 * site works without JavaScript. Every user-facing string comes from the
 * catalogue in i18n.ts - none is written here.
 */
import { SITE, THRESHOLDS, SOURCES } from '../config.js';
import type { Snapshot, SourceStatus } from '../types.js';
import type { OfferView, Pick, Recommendation, RecommendationRequest } from '../engine/recommend.js';
import { formatScore, metricLabel, workFactor } from '../engine/recommend.js';
import type { Change } from '../engine/changes.js';
import { SCENARIOS, TASK_IDS, PRIORITIES, BUDGETS, CLOSE_POINTS, INTENSITY_IDS } from '../engine/scenarios.js';
import { accountName, usabilityLabel } from '../engine/usability.js';
import { signupUrl } from '../engine/signup.js';
import { configFor } from '../engine/opencode.js';
import { activePromotions, EVEN_USD, retentionUntil, type ChoiceOption, type PlanComparison, type PlanRow } from '../engine/plans.js';
import { t, pagePath, otherLang, type Lang } from '../i18n.js';
import type { RunStatus } from '../pipeline/store.js';
import { msUntilNextRun } from '../scheduler.js';
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

const percent = (share: number, lang: Lang): string =>
  new Intl.NumberFormat(locale(lang), { style: 'percent', maximumFractionDigits: 0 }).format(share);

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

type PageId = 'home' | 'method' | 'go' | 'sources' | 'status';

export function layout(opts: { lang: Lang; title: string; description: string; body: string; active: PageId }): string {
  const c = t(opts.lang);
  const other = otherLang(opts.lang);
  const canonical = `https://${SITE.domain}${pagePath(opts.lang, opts.active)}`;
  const nav: [PageId, string][] = [
    ['home', c.nav.choice],
    ['method', c.nav.method],
    ['go', c.nav.go],
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
<body data-copied="${esc(c.home.copied)}" data-copy-blocked="${esc(c.home.copyBlocked)}">
<header class="header">
  <div class="header__bar">
    <div class="brand">
      <a class="brand__name" href="${esc(pagePath(opts.lang, 'home'))}">MODELPICK</a>
      <a class="brand__by" href="${esc(CLOUDSALUS_URL)}" rel="noopener">by CloudSalus</a>
    </div>
    <nav class="menu">
      ${nav.map(([id, label]) => `<a href="${esc(pagePath(opts.lang, id))}"${opts.active === id ? ' aria-current="page"' : ''}>${id === 'go' ? `<span class="menu__long">${esc(label)}</span><span class="menu__short">${esc(c.nav.goShort)}</span>` : esc(label)}</a>`).join('')}
      <a href="${esc(SITE.repo)}" rel="noopener">${esc(c.nav.code)}</a>
      <a class="lang-switch" href="${esc(pagePath(other, opts.active))}?lang=${esc(other)}" hreflang="${esc(other)}">${esc(c.nav.otherLang)}</a>
    </nav>
  </div>
</header>
<main>${opts.body}</main>
<footer class="footer">
  <div class="container footer__rows">
    <p class="meta">${esc(c.home.aaDisclaimer)} <a href="https://artificialanalysis.ai/" rel="noopener">artificialanalysis.ai</a></p>
    <p class="meta"><strong>${esc(SITE.name)}</strong> by <a href="${esc(CLOUDSALUS_URL)}" rel="noopener">CloudSalus</a> · <a href="${esc(pagePath(opts.lang, 'method'))}">${esc(c.nav.method)}</a> · <a href="${esc(pagePath(opts.lang, 'sources'))}">${esc(c.nav.sources)}</a> · <a href="${esc(pagePath(opts.lang, 'status'))}">${esc(c.nav.status)}</a> · MIT</p>
  </div>
</footer>
<script src="/static/app.js?v=${ASSET_VERSION.js}" defer></script>
</body>
</html>`;
}


/** The name of the version a provisional score comes from, as Artificial Analysis publishes it. */
const snapshotName = (_key: string, harness: string): string => harness.replace(/\s*\([^)]*\)\s*$/, '');

/** The provider comparison: the answer to "where do I buy this". */
function renderComparison(pick: Pick, role: string, lang: Lang, privacy = false): string {
  const c = t(lang);
  const row = (o: OfferView, i: number, chosen: boolean) => {
    const id = `cmd-${role}-${i}`;
    const conf = configFor(o.offer, lang, pick.quality.effort, privacy);
    // Rows routed through OpenRouter share the same command: what changes is
    // the pinned provider, so the configuration is what gets copied.
    const payload = conf.config ?? conf.command;
    const label = conf.config ? c.home.copyConfig : c.home.copy;
    const link = signupUrl(o.offer);
    return `<tr${chosen ? ' class="chosen"' : ''}>
      <td>
        <strong>${esc(o.offer.providerName)}</strong>${o.offer.serviceTier ? ` <span class="label label--info" title="${esc(c.usability.tierNote[o.offer.serviceTier](o.offer.providerName))}">${esc(c.usability.tier[o.offer.serviceTier])}</span>` : ''}
        <span class="meta">${esc(usabilityLabel(o.usability, o.offer, lang))}</span>
      </td>
      <td class="num nowrap"><strong>${esc(usd(o.cost.totalUsd, lang))}</strong></td>
      <td class="action">
        ${link && o.offer.sourceId !== 'openrouter' ? `<a class="row-link" href="${esc(link)}" target="_blank" rel="noopener">${esc(c.home.key)}</a>` : ''}
        <button class="button button--outline button--small" type="button" data-copy="#${esc(id)}">${esc(label)}</button>
        <pre hidden><code id="${esc(id)}">${esc(payload)}</code></pre>
      </td>
    </tr>`;
  };

  const shown = pick.alternatives.slice(0, 3);
  const rest = pick.alternatives.slice(3);

  return `<div class="purchase">
    <h4 class="purchase__title">${esc(c.home.whereToBuy)}</h4>
    <table class="table comparison">
      <tbody>
        ${row(pick.chosen, 0, true)}
        ${shown.map((o, i) => row(o, i + 1, false)).join('')}
      </tbody>
    </table>
    ${rest.length ? `<details class="details">
      <summary>${esc(c.home.otherProviders(rest.length))}</summary>
      <div class="details__body">
        <table class="table comparison"><tbody>${rest.slice(0, 16).map((o, i) => row(o, i + 100, false)).join('')}</tbody></table>
      </div>
    </details>` : ''}
  </div>`;
}

function renderDetails(pick: Pick, lang: Lang, opencodeVersion: string | null): string {
  const c = t(lang);
  const q = pick.quality;
  const f = fmt(lang);
  const costRows = pick.cost.lines
    .filter((l) => l.tokens > 0)
    .map((l) => `<div class="prices__row">
        <span class="prices__label">${esc(l.label)} · ${esc(tokens(l.tokens, lang))} token</span>
        <span>${esc(usd(l.usd, lang))}</span>
      </div>`)
    .join('');
  const feeRows = [
    ...pick.cost.feeNotes.map((n) => `<div class="prices__row"><span class="prices__label">${esc(n)}</span><span>${esc(usd(pick.cost.feesUsd, lang))}</span></div>`),
    ...pick.cost.unquantifiedFees.map((n) => `<div class="prices__row"><span class="prices__label">${esc(n)}</span><span class="label label--fee">—</span></div>`),
  ].join('');

  const profile = pick.offer.profile;
  const gdpr = profile?.gdpr === true ? c.home.gdprYes : profile?.gdpr === false ? c.home.gdprNo : c.home.gdprUnknown;

  return `<details class="details">
    <summary>${esc(c.home.whyThis)}</summary>
    <div class="details__body">
      <p>${esc(pick.reason)}</p>
      <p>${c.home.theEvidence(esc(formatScore(q.value, q.metric)), esc(evidenceLabel(q)), esc(q.harness), esc(dateDay(q.measuredAt, lang)))} ${q.metric === 'aa_coding_index'
        ? `<a href="${esc(q.sourceUrl)}" rel="noopener">${esc(c.home.aaSource)}</a>.`
        : `<a href="${esc(q.sourceUrl)}" rel="noopener">${esc(c.home.priceSource)}</a>.`}</p>
      ${q.metric === 'aa_coding_index' ? `<p class="meta">${esc(c.home.evidenceNoDate)}</p>` : ''}
      <div class="prices">${costRows}${feeRows}
        <div class="prices__row prices__row--total"><span>${esc(c.home.monthlyTotal)}</span><span>${esc(usd(pick.cost.totalUsd, lang))}</span></div>
      </div>
      ${pick.cost.assumptions.length ? `<p class="meta">${pick.cost.assumptions.map(esc).join(' ')}</p>` : ''}
      ${pick.provisional ? `<p class="meta">${esc(pick.provisionalReasons.join('; '))}.</p>` : ''}
      <p><strong>${esc(c.home.whoIs(pick.offer.providerName))}</strong> ${profile
        ? `${esc(c.home.profileKnown(profile.hqCountry ?? c.home.countryUnknown, gdpr))}${profile.directoryUrl ? `. <a href="${esc(profile.directoryUrl)}" rel="noopener">${esc(c.home.directoryLink)}</a>` : ''}.`
        : esc(c.home.profileUnknown)} ${esc(c.home.geoNote)}</p>
      <p class="meta">${esc(c.home.priceChecked(dateLong(pick.offer.observedAt, lang)))} ${opencodeVersion ? esc(c.home.verifiedWith(opencodeVersion)) : ''} <a href="${esc(pick.offer.sourceUrl)}" rel="noopener">${esc(c.home.priceSource)}</a>${pick.model.officialUrl ? ` · <a href="${esc(pick.model.officialUrl)}" rel="noopener">${esc(c.home.modelPage)}</a>` : ''}. ${esc(f.n.format(pick.offersCompared))} provider.</p>
    </div>
  </details>`;
}

/**
 * @param providersApart true when the provider table is shown in its own card
 *        next to this one, so the card does not repeat it.
 */
function renderPick(pick: Pick | null, role: 'everyday' | 'hard', change: Change | null, lang: Lang, empty: string, opencodeVersion: string | null, request: RecommendationRequest, go: PlanComparison | null = null, providersApart = false): string {
  const c = t(lang);
  // Only when the fee alone covers this month of work and costs less than the pick.
  const planRow = pick ? go?.rows.find((r) => r.modelKey === pick.model.key && !r.blocker && r.month) : undefined;
  const goHint = pick && go && planRow?.month && planRow.month.coveredShare >= 1 && go.plan.monthlyFeeUsd + EVEN_USD <= pick.cost.totalUsd!
    ? c.go.homeHint(modelName(pick.model.displayName), usd(go.plan.monthlyFeeUsd, lang))
    : null;
  const title = role === 'everyday' ? c.home.everyday : c.home.hard;
  if (!pick) {
    return `<article class="card pick pick--${role}">
      <p class="pick__role">${esc(title)}</p>
      <div class="notice notice--neutral">${esc(empty)}</div>
    </article>`;
  }
  const conf = configFor(pick.offer, lang, pick.quality.effort, request.privacy ?? false);
  const link = signupUrl(pick.offer);
  return `<article class="card pick pick--${role}${role === 'everyday' ? ' pick--featured' : ''}" id="${esc(role)}">
    <p class="pick__role">${esc(title)}</p>
    <h3 class="pick__model">${esc(modelName(pick.model.displayName))}</h3>
    <p class="pick__summary">${esc(c.home.perMonth('\u0000')).replace('\u0000', `<strong class="pick__price">${esc(usd(pick.cost.totalUsd, lang))}</strong>`)}</p>
    <p class="pick__evidence">${esc(c.home.benchmark(formatScore(pick.quality.value, pick.quality.metric), pick.quality.metric === 'aa_coding_index' ? 'Coding Index' : metricLabel(pick.quality.metric), dateShort(pick.quality.measuredAt, lang)))}${pick.quality.effort ? ` · ${esc(c.home.effort(pick.quality.effort))}` : ''}${pick.usage ? `<br>${esc(c.home.usage(fmt(lang).n.format(pick.usage.retentionRate)))}${pick.usage.sessionCostUsd !== null ? ` · ${esc(c.home.sessionCost((pick.usage.sessionCostUsd < 0.01 ? fmt(lang).n4 : fmt(lang).n2).format(pick.usage.sessionCostUsd)))}` : ''} · <a href="https://opencode.ai/data/" rel="noopener">${esc(c.home.opencodeSource)}</a>` : ''}${pick.quality.metric === 'aa_coding_index' ? ` · <a href="${esc(pick.quality.sourceUrl)}" rel="noopener">${esc(c.home.aaSource)}</a>` : ''}</p>
    ${pick.quality.inheritedFrom ? `<p class="alert">${esc(c.home.inherited(modelName(snapshotName(pick.quality.inheritedFrom.modelKey, pick.quality.inheritedFrom.harness))))}</p>` : ''}
    ${pick.successor ? `<p class="alert">${esc(c.home.successor(modelName(pick.successor.name)))}</p>` : ''}
    ${pick.cost.unquantifiedFees.length ? `<p class="alert">${esc(c.home.incompleteEstimate)}</p>` : ''}
    ${change?.moved ? `<p class="pick__change pick__change--moved">${esc(change.text)}</p>` : ''}
    <p class="pick__why">${esc(pick.reason)}</p>
    ${pick.offer.serviceTier ? `<p class="alert">${esc(c.usability.tierNote[pick.offer.serviceTier](pick.offer.providerName))}</p>` : ''}
    ${goHint ? `<p class="pick__plan"><a href="${esc(pagePath(lang, 'go'))}?task=${esc(request.task)}">${esc(goHint)}</a></p>` : ''}
    ${pick.alternative && !providersApart ? `<p class="pick__alternative">${esc(c.home.alternative(modelName(pick.alternative.name), `${formatScore(pick.alternative.score, pick.quality.metric)}${pick.alternative.provisional ? ` (${c.home.provisionalShort})` : ''}`, usd(pick.alternative.totalUsd, lang)))}</p>` : ''}
    <details class="details details--actions">
      <summary>${esc(c.home.detailsFor(modelName(pick.model.displayName)))}</summary>
      <div class="details__body">
    <p class="steps__intro">${esc(c.home.stepsIntro(accountName(pick.offer), modelName(pick.model.displayName)))}</p>
    <ol class="steps">
      <li class="step">
        <span class="step__text">${esc(c.home.getKey(accountName(pick.offer)))}</span>
        ${link ? `<a class="button button--outline button--small" href="${esc(link)}" target="_blank" rel="noopener">${esc(c.home.open)}</a>` : ''}
      </li>
      ${pick.offer.apiKeyEnv ? `<li class="step">
        <span class="step__text">${esc(c.home.exportKey)}</span>
      </li>
      <li class="step step--config">
        <code class="step__code" id="key-${esc(role)}">export ${esc(pick.offer.apiKeyEnv)}="..."</code>
        <button class="button button--outline button--small" type="button" data-copy="#key-${esc(role)}">${esc(c.home.copy)}</button>
      </li>` : ''}
      ${conf.config ? `<li class="step">
        <span class="step__text">${esc(conf.requiresFile ? c.home.saveCustom(pick.offer.customProvider?.name ?? pick.offer.providerName) : conf.pinNote ? c.home.savePinned(accountName(pick.offer), pick.offer.providerName) : c.home.saveEffort(pick.quality.effort ?? ''))}</span>
        <button class="button button--small" type="button" data-copy="#config-${esc(role)}">${esc(c.home.copyConfig)}</button>
        <a class="button button--outline button--small" href="/opencode.json?${esc(new URLSearchParams({ task: request.task, priority: request.priority, role, ...(request.privacy ? { privacy: '1' } : {}) }).toString())}">${esc(c.home.downloadFile)}</a>
      </li>
      <li class="step step--config">
        <details class="details details--copy">
          <summary>${esc(c.home.showConfig)}</summary>
          <pre class="code"><code id="config-${esc(role)}">${esc(conf.config)}</code></pre>
        </details>
      </li>
      ${conf.requiresFile ? '' : `      <li class="step">
        <span class="step__text">${esc(c.home.orQuick)}</span>
      </li>
      <li class="step step--config">
        <code class="step__code" id="quick-${esc(role)}">${esc(conf.command)}</code>
        <button class="button button--outline button--small" type="button" data-copy="#quick-${esc(role)}">${esc(c.home.copyCommand)}</button>
      </li>
      <li class="step step--config"><span class="steps__note">${esc(conf.pinNote ? c.home.quickPinLost(accountName(pick.offer)) : c.home.quickEffortLost)}</span></li>`}` : `<li class="step">
        <span class="step__text">${esc(c.home.runCommand)}</span>
      </li>
      <li class="step step--config">
        <code class="step__code" id="config-${esc(role)}">${esc(conf.command)}</code>
        <button class="button button--small" type="button" data-copy="#config-${esc(role)}">${esc(c.home.copyCommand)}</button>
      </li>`}
    </ol>
    ${conf.pinNote && !conf.config ? `<p class="steps__note">${esc(conf.pinNote)}</p>` : ''}
    ${conf.config && conf.pinNote ? `<p class="steps__privacy">${esc(request.privacy ? c.home.privacyOn(accountName(pick.offer), pick.offer.providerName) : c.home.privacyOff(accountName(pick.offer)))} <a href="${esc(withParams(request, lang, { privacy: request.privacy ? '0' : '1' }))}#${esc(role)}">${esc(request.privacy ? c.home.privacyDisable : c.home.privacyEnable)}</a></p>` : ''}
    ${providersApart ? '' : renderComparison(pick, role, lang, request.privacy ?? false)}
    ${renderDetails(pick, lang, opencodeVersion)}
      </div>
    </details>
  </article>`;
}



/** Whatever model the user declared, they get an answer about it. */
function renderCurrentModel(rec: Recommendation | null, lang: Lang): string {
  const c = t(lang);
  const s = rec?.savings;
  if (!s) return '';
  const name = s.currentModelName ? modelName(s.currentModelName) : '';
  const body =
    s.outcome === 'compared' && s.deltaUsd !== null
      ? c.home.comparison(s.currentProviderName ? esc(s.currentProviderName) : null, esc(usd(Math.abs(s.deltaUsd), lang)), s.deltaUsd > 0)
      : s.outcome === 'already-recommended'
        ? `${esc(c.home.currentSame(name))}${s.currentTotalUsd !== null ? ` ${esc(c.home.currentSamePrice(usd(s.currentTotalUsd, lang)))}` : ''}`
        : s.outcome === 'no-seller'
          ? esc(c.home.currentNoSeller(name))
          : s.outcome === 'no-evidence'
            ? esc(c.home.currentNoEvidence(name))
            : s.outcome === 'no-price'
              ? esc(c.home.currentNoPrice(name))
              : esc(c.home.currentUnknown);
  return `<div class="savings savings--${s.outcome}">
    <p class="savings__title">${esc(c.home.currentTitle)}</p>
    <p>${body}</p>
  </div>`;
}

/** Same page, one parameter changed: the controls are links, so they work without JavaScript. */
const withParams = (req: RecommendationRequest, lang: Lang, overrides: Record<string, string>): string => {
  const q = new URLSearchParams();
  if (req.task) q.set('task', req.task);
  if (req.priority) q.set('priority', req.priority);
  for (const [k, v] of Object.entries({
    input: req.usage?.input, output: req.usage?.output, cacheRead: req.usage?.cacheRead, cacheWrite: req.usage?.cacheWrite,
  })) if (v !== undefined && v !== null) q.set(k, String(v));
  if (req.currentModelKey) q.set('currentModel', req.currentModelKey);
  if (req.privacy) q.set('privacy', '1');
  for (const [k, v] of Object.entries(overrides)) q.set(k, v);
  if (q.get('privacy') === '0') q.delete('privacy');
  return `${pagePath(lang, 'home')}?${q.toString()}`;
};

/** Line icons for the kinds of work: decoration only, the name says it all. */
const TASK_ICONS: Record<string, string> = {
  'small-changes': '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  bug: '<rect x="7" y="8" width="10" height="12" rx="5"/><path d="M12 8v12M4 13h3M17 13h3M5 8l2.5 2M19 8l-2.5 2M5 19l2.5-2M19 19l-2.5-2M9 5l1.5 2M15 5l-1.5 2"/>',
  'new-features': '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
  refactoring: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  analysis: '<path d="M3 5.5C5.5 4.5 8.5 4.5 12 6.5c3.5-2 6.5-2 9-1V19c-2.5-1-5.5-1-9 1-3.5-2-6.5-2-9-1V5.5z"/><path d="M12 6.5V20"/>',
};
const icon = (paths: string) =>
  `<svg class="icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

/**
 * The model finder: what you work on, what matters most, and the usage the
 * prices assume. Every choice is a link, so it works without JavaScript.
 */
function renderFinder(rec: Recommendation | null, snapshot: Snapshot | null, req: RecommendationRequest, lang: Lang): string {
  const c = t(lang);
  const time = snapshot ? new Date(snapshot.generatedAt).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }) : '';
  const mix = rec?.mix ?? SCENARIOS[req.task].monthly;
  const taskName = c.tasks[req.task] ?? SCENARIOS[req.task].label;
  return `<aside class="card finder">
    <h1 class="finder__title">${esc(c.home.title)}</h1>
    ${rec?.everyday
      ? `<p class="answer__line">${esc(c.home.answer(modelName(rec.everyday.model.displayName), usd(rec.everyday.cost.totalUsd, lang)))}</p>`
      : `<p class="answer__line">${esc(c.home.answerNone)}</p>`}
    <p class="answer__date">${snapshot ? esc(c.home.updatedAt(time)) : esc(c.home.noData)}</p>
    <h2 class="finder__question" id="q-task">${esc(c.home.workQuestion)}</h2>
    <nav class="tasks" aria-labelledby="q-task">
      ${TASK_IDS.map((id) => `<a class="choice task${id === req.task ? ' choice--active' : ''}" href="${esc(withParams(req, lang, { task: id }))}"${id === req.task ? ' aria-current="true"' : ''}>
        ${icon(TASK_ICONS[id] ?? '')}
        <span class="task__text"><span class="task__name">${esc(c.tasks[id] ?? SCENARIOS[id].label)}</span><span class="task__note">${esc(c.taskNotes[id] ?? '')}</span></span>
        <span class="task__mark" aria-hidden="true"></span>
      </a>`).join('')}
    </nav>
    <h2 class="finder__question" id="q-priority">${esc(c.home.priorityQuestion)}</h2>
    <nav class="segmented" aria-labelledby="q-priority">
      ${PRIORITIES.map((p) => `<a class="choice segment${p === req.priority ? ' choice--active' : ''}" href="${esc(withParams(req, lang, { priority: p }))}"${p === req.priority ? ' aria-current="true"' : ''}>${esc(c.priorities[p] ?? p)}</a>`).join('')}
    </nav>
    <details class="details usage">
      <summary>${esc(c.home.usageTitle)}</summary>
      <div class="details__body">
        <p class="meta">${esc(rec?.usingCustomUsage ? c.home.usageCustom : c.home.usageIntro(taskName))}</p>
        <dl class="usage__rows">
          ${(['input', 'output', 'cacheRead', 'cacheWrite'] as const).map((k) => `<div><dt>${esc(c.home.usageRows[k])}</dt><dd>${esc(tokens(mix[k], lang))}</dd></div>`).join('')}
        </dl>
        <p class="meta"><a href="${esc(pagePath(lang, 'method'))}">${esc(c.home.usageMore)}</a></p>
      </div>
    </details>
  </aside>`;
}

const HISTORY_RANGES = [['30d', 30], ['3m', 92], ['1y', 366]] as const;
const DAY_MS = 86_400_000;

/**
 * The monthly cost of the recommended model over time, one chart per range the
 * data actually covers. The range switch is radio buttons and CSS: it works
 * without JavaScript.
 */
function renderHistory(series: { at: string; usd: number }[], taskName: string, lang: Lang): string {
  if (series.length < 2) return '';
  const c = t(lang);
  const last = Date.parse(series[series.length - 1]!.at);
  const first = Date.parse(series[0]!.at);
  // A range is offered only when the data reaches past the shorter one before it.
  const ranges = HISTORY_RANGES.filter(([, days], i) => {
    const shorter = i === 0 ? 0 : HISTORY_RANGES[i - 1]![1];
    return last - first > shorter * DAY_MS;
  }).map(([id, days]) => ({ id, points: series.filter((p) => Date.parse(p.at) >= last - days * DAY_MS) }))
    .filter((r) => r.points.length >= 2);
  if (!ranges.length) return '';

  const W = 320, H = 110, L = 4, R = 4, T = 8, B = 8;
  const chart = (points: { at: string; usd: number }[], id: string) => {
    const xs = points.map((p) => Date.parse(p.at));
    const ys = points.map((p) => p.usd);
    const x0 = xs[0]!, x1 = xs[xs.length - 1]!;
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (hi - lo < 0.01) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.1;
    lo = Math.max(0, lo - pad); hi += pad;
    const px = (x: number) => L + ((x - x0) / Math.max(1, x1 - x0)) * (W - L - R);
    const py = (y: number) => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${px(xs[i]!).toFixed(1)},${py(p.usd).toFixed(1)}`).join(' ');
    const area = `${line} L${px(x1).toFixed(1)},${H - B} L${px(x0).toFixed(1)},${H - B} Z`;
    const day = (iso: string) => id === '1y'
      ? new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'it-IT', { month: 'short', year: 'numeric', timeZone: 'Europe/Rome' })
      : dateShort(iso, lang);
    const summary = c.home.historySummary(day(points[0]!.at), day(points[points.length - 1]!.at), usd(Math.min(...ys), lang), usd(Math.max(...ys), lang), usd(ys[ys.length - 1]!, lang));
    return `<figure class="history__panel history__panel--${id}">
      <div class="history__plot">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(summary)}">
          <path class="history__area" d="${area}"/>
          <path class="history__line" d="${line}" vector-effect="non-scaling-stroke"/>
        </svg>
      </div>
      <figcaption class="history__x meta" aria-hidden="true"><span>${esc(day(points[0]!.at))}</span><span>${esc(`${fmt(lang).n2.format(Math.min(...ys))}–${usd(Math.max(...ys), lang)}`)}</span><span>${esc(day(points[points.length - 1]!.at))}</span></figcaption>
    </figure>`;
  };

  return `<div class="history">
    <div class="history__head">
      <h3 class="history__title">${esc(c.home.historyTitle)}</h3>
      ${ranges.length > 1 ? `<fieldset class="history__ranges"><legend class="visually-hidden">${esc(c.home.historyRangeLabel)}</legend>${ranges.map((r, i) => `<input class="visually-hidden history__radio history__radio--${r.id}" type="radio" name="history-range" id="history-${r.id}"${i === 0 ? ' checked' : ''}><label for="history-${r.id}">${esc(c.home.historyRanges[r.id])}</label>`).join('')}</fieldset>` : ''}
    </div>
    <div class="history__panels">${ranges.map((r) => chart(r.points, r.id)).join('')}</div>
    <p class="meta">${esc(c.home.historyNote(taskName))}</p>
  </div>`;
}

/** The other ways to go for the same work: what each other priority would pick. */
function renderOthers(pick: Pick | null, others: { priority: string; pick: Pick | null }[], req: RecommendationRequest, lang: Lang): string {
  const c = t(lang);
  const seen = new Set(pick ? [pick.model.key] : []);
  const items: string[] = [];
  if (pick?.alternative) {
    items.push(`<li class="option">
      <span class="option__text"><span class="option__name">${esc(modelName(pick.alternative.name))}</span><span class="meta">${esc(c.home.closeAlternative)} · Coding Index ${esc(formatScore(pick.alternative.score, pick.quality.metric))}</span></span>
      <span class="option__price"><strong>${esc(usd(pick.alternative.totalUsd, lang))}</strong><span class="meta">${esc(c.home.perMonthShort)}</span></span>
    </li>`);
  }
  for (const o of others) {
    if (!o.pick || seen.has(o.pick.model.key)) continue;
    seen.add(o.pick.model.key);
    items.push(`<li class="option">
      <a class="option__link" data-swap href="${esc(withParams(req, lang, { priority: o.priority }))}">
        <span class="option__text"><span class="option__name">${esc(modelName(o.pick.model.displayName))}</span><span class="meta">${esc(c.home.otherPriority(c.priorities[o.priority] ?? o.priority))} · Coding Index ${esc(formatScore(o.pick.quality.value, o.pick.quality.metric))}</span></span>
        <span class="option__price"><strong>${esc(usd(o.pick.cost.totalUsd, lang))}</strong><span class="meta">${esc(c.home.perMonthShort)}</span></span>
      </a>
    </li>`);
  }
  return `<section class="card board__card">
    <h2 class="board__title">${esc(c.home.otherOptions)}</h2>
    ${items.length ? `<ul class="options">${items.join('')}</ul>` : `<p class="meta">${esc(c.home.noOtherOptions)}</p>`}
  </section>`;
}

export function homePage(opts: {
  lang: Lang;
  rec: Recommendation | null;
  snapshot: Snapshot | null;
  request: RecommendationRequest;
  changes: { everyday: Change | null; hard: Change | null };
  go?: PlanComparison | null;
  /** The everyday pick of each other priority, for the same work. */
  others?: { priority: string; pick: Pick | null }[];
  /** Monthly cost of the everyday pick at each update, for the chosen work. */
  history?: { at: string; usd: number }[];
}): string {
  const { lang, rec, snapshot, request, changes } = opts;
  const go = opts.go ?? null;
  const c = t(lang);
  const stale = rec?.method.snapshotStale ?? false;

  const everyday = rec?.everyday ?? null;
  const body = `
<section class="dashboard">
  <div class="container dashboard__grid">
    ${renderFinder(rec, snapshot, request, lang)}
    <div class="board">
      ${!snapshot ? `<div class="notice notice--error">${esc(c.home.noData)}</div>` : ''}
      ${stale ? `<div class="notice">${esc(c.home.stale)}</div>` : ''}
      ${rec?.notes.map((n) => `<div class="notice">${esc(n)}</div>`).join('') ?? ''}
      ${rec?.replacements.map((r) => `<p class="alert">${esc(c.home.replaced(modelName(r.retiredName), modelName(r.successorName)))}</p>`).join('') ?? ''}
      ${renderCurrentModel(rec, lang)}
      ${renderPick(everyday, 'everyday', changes.everyday, lang, c.home.noEveryday, snapshot?.opencodeVersion ?? null, request, go, true)}
      ${everyday ? `<div class="board__row">
        ${renderOthers(everyday, opts.others ?? [], request, lang)}
        <section class="card board__card">
          <h2 class="board__title">${esc(c.home.providerPrices(modelName(everyday.model.displayName)))}</h2>
          ${renderComparison(everyday, 'everyday', lang, request.privacy ?? false)}
          ${renderHistory(opts.history ?? [], c.tasks[request.task] ?? SCENARIOS[request.task].label, lang)}
        </section>
      </div>` : ''}
      ${renderPick(rec?.hard ?? null, 'hard', changes.hard, lang, c.home.noHard, snapshot?.opencodeVersion ?? null, request, go)}
      ${go ? `<p class="plan-link"><a href="${esc(pagePath(lang, 'go'))}?task=${esc(request.task)}">${esc(c.go.homeLink)} →</a></p>` : ''}
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

/** Only what should give a buyer pause about their data; nothing when the model keeps nothing. */
function planDataWarning(row: PlanRow, lang: Lang, now = Date.now()): string | null {
  const c = t(lang).go;
  const r = row.terms.retentionDays;
  if (row.terms.trainsOnData) return c.training;
  if (r === null) return c.retainedUnknown;
  if (r > 0) return c.retained(String(r));
  const until = retentionUntil(row.terms.note);
  // The agreement covers the whole last day, in any time zone.
  if (until && now > Date.parse(`${until}T23:59:59-12:00`)) return c.zdrEnded(dateDay(until, lang));
  return null;
}

/**
 * Is Go worth it, and with which model: the answer in one sentence, then one
 * row per measured model with the two monthly bills and which one is lower.
 * Everything else (allowance, windows, assumptions) sits behind "How we work it out".
 */
export function goPage(opts: { lang: Lang; snapshot: Snapshot | null; request: RecommendationRequest; go: PlanComparison | null }): string {
  const { lang, request, go } = opts;
  const c = t(lang);
  const g = c.go;
  const taskName = (c.tasks[request.task] ?? SCENARIOS[request.task].label).toLowerCase();
  const intensity = request.intensity ?? 'standard';
  // Plain links carrying both choices, so the page works without JavaScript and links can be shared.
  const link = (task: string, level: string) => `${pagePath(lang, 'go')}?${new URLSearchParams({ task, ...(level !== 'standard' ? { intensity: level } : {}) }).toString()}`;
  const choices = `<div class="choices">
      <span class="choices__label">${esc(c.home.workType)}</span>
      ${TASK_IDS.map((id) => `<a class="choice${id === request.task ? ' choice--active' : ''}" href="${esc(link(id, intensity))}"${id === request.task ? ' aria-current="true"' : ''}>${esc(c.tasks[id] ?? SCENARIOS[id].label)}</a>`).join('')}
    </div>
    <div class="choices">
      <span class="choices__label">${esc(g.intensityLabel)}</span>
      ${INTENSITY_IDS.map((id) => `<a class="choice${id === intensity ? ' choice--active' : ''}" href="${esc(link(request.task, id))}"${id === intensity ? ' aria-current="true"' : ''}>${esc(g.intensities[id] ?? id)}</a>`).join('')}
    </div>`;

  if (!go) {
    const body = `<section class="answer"><div class="container"><h1 class="answer__title">${esc(g.title)}</h1></div></section>
<section class="section"><div class="container"><div class="notice">${esc(g.noPlan)}</div></div></section>`;
    return layout({ lang, title: `${g.title} — ${SITE.name}`, description: g.description, body, active: 'go' });
  }

  const name = (r: PlanRow) => modelName(r.model?.displayName ?? r.planModelId);
  const priced = go.rows.filter((r) => !r.blocker && r.month);
  const shown = priced.filter((r) => r.quality && r.direct);
  const more = go.rows.filter((r) => !shown.includes(r));
  // A tie sits with Go ("same cost"), never under a title saying per token costs less.
  const winners = shown.filter((r) => r.verdict === 'plan' || r.verdict === 'even');
  const losers = shown.filter((r) => r.verdict === 'direct');
  const notEnough = shown.filter((r) => r.verdict === 'not-enough');

  const f = fmt(lang);
  const fee = usd(go.plan.monthlyFeeUsd, lang);
  const { recommended, alternative } = go.choice;
  const optName = (o: ChoiceOption) => modelName(o.model?.displayName ?? o.modelKey);
  const answer = !recommended
    ? g.noData
    : recommended.kind === 'plan'
      ? g.answerPlan(taskName, optName(recommended), fee)
      : g.answerToken(taskName, optName(recommended), usd(recommended.costUsd, lang));

  /** The plan's limits, promotion and check date, beside any option on the plan. */
  const planTerms = (o: ChoiceOption): string => {
    const row = go.rows.find((r) => r.offer.id === o.offer.id);
    if (!row) return '';
    const promo = activePromotions(go.plan).find((p) => p.planModelId === row.planModelId);
    return `<div class="plan__terms">
      <p>${esc(g.fits(usd(row.terms.capUsd, lang), f.n.format(go.plan.fiveHourPercent), f.n.format(go.plan.weeklyPercent)))}</p>
      ${promo ? `<p>${esc(g.promo(f.n.format(promo.capMultiplier), dateDay(promo.until, lang)))}</p>` : ''}
      <p class="meta">${esc(g.checked(dateDay(go.plan.checkedAt, lang)))} <a href="${esc(go.plan.sourceUrl)}" rel="noopener">opencode.ai/docs/go</a></p>
    </div>`;
  };

  const card = (o: ChoiceOption | null, role: 'recommended' | 'alternative'): string => {
    const cls = role === 'recommended' ? 'pick--everyday' : 'pick--hard';
    const title = role === 'recommended' ? g.recommended : g.alternative;
    if (!o) {
      const empty = !recommended ? g.noData : recommended.kind === 'plan' ? g.noAltToken(fee) : g.noAltPlan;
      return `<article class="card pick ${cls}"><p class="pick__role">${esc(title)}</p><div class="notice notice--neutral">${esc(empty)}</div></article>`;
    }
    const top = go.choice.top;
    // Name the reference the 3-point rule counts from, or the choice looks arbitrary.
    const why = role !== 'recommended'
      ? (o.kind === 'plan' ? g.whyAltPlan : g.whyAltToken(fee))
      : top && top !== o
        ? g.whyClose(fee, optName(top), formatScore(top.quality.value, top.quality.metric), usd(top.costUsd, lang), optName(o), String(CLOSE_POINTS))
        : g.whyRecommended(fee);
    const versus = role === 'alternative' && recommended
      ? g.versus(f.n.format(Math.max(0, recommended.quality.value - o.quality.value)), o.costUsd > recommended.costUsd, usd(Math.abs(o.costUsd - recommended.costUsd), lang))
      : null;
    const warning = o.kind === 'plan' ? (() => { const r = go.rows.find((x) => x.offer.id === o.offer.id); return r ? planDataWarning(r, lang) : null; })() : null;
    return `<article class="card pick ${cls}">
      <p class="pick__role">${esc(title)}</p>
      <h2 class="pick__model">${esc(optName(o))}</h2>
      <p class="pick__summary">${esc(g.perMonth('\u0000')).replace('\u0000', `<strong class="pick__price">${esc(usd(o.costUsd, lang))}</strong>`)}</p>
      <p class="pick__evidence">${esc(o.kind === 'plan' ? g.onPlan : g.perToken(o.providerName))} · Coding Index ${esc(formatScore(o.quality.value, o.quality.metric))}</p>
      ${warning ? `<p class="alert">${esc(warning)}</p>` : ''}
      <p class="pick__why">${esc(why)}${versus ? ` ${esc(versus)}` : ''}</p>
      ${o.kind === 'plan' ? planTerms(o) : ''}
    </article>`;
  };

  const row = (r: PlanRow) => {
    const m = r.month!;
    const covers = percent(m.coveredShare, lang);
    const verdict = r.verdict === 'not-enough'
      ? `<span class="label label--warning">${esc(g.notEnough(covers))}</span>`
      : r.verdict === 'even'
        ? `<span class="meta">${esc(g.even)}</span>`
        : r.verdict === 'plan'
          ? `<span class="label label--ok">${esc(g.goWins(usd(r.savingUsd!, lang)))}</span>`
          : `<span class="label label--info">${esc(g.payWins(usd(-r.savingUsd!, lang)))}</span>`;
    const warning = planDataWarning(r, lang);
    const promo = activePromotions(go.plan).find((p) => p.planModelId === r.planModelId);
    const notes = [warning, promo ? g.promo(f.n.format(promo.capMultiplier), dateDay(promo.until, lang)) : null].filter(Boolean) as string[];
    return `<tr${r.verdict === 'plan' ? ' class="chosen"' : ''}>
      <td class="stack__title">${esc(name(r))}${notes.map((n) => `<span class="visually-hidden">, </span><span class="label label--warning plan__warn">${esc(n)}</span>`).join('')}</td>
      <td class="num" data-label="${esc(g.cols[1])}">${esc(formatScore(r.quality!.value, r.quality!.metric))}</td>
      <td class="num nowrap" data-label="${esc(g.cols[2])}"><strong>${esc(usd(go.plan.monthlyFeeUsd, lang))}</strong>${m.coveredShare < 1 ? `<span class="meta">${esc(g.lasts(covers))}</span>` : ''}</td>
      <td class="num nowrap" data-label="${esc(g.cols[3])}"><strong>${esc(usd(r.direct!.cost.totalUsd, lang))}</strong><span class="meta">${esc(r.direct!.offer.providerName)}</span></td>
      <td data-label="${esc(g.cols[4])}">${verdict}</td>
    </tr>`;
  };

  const table = (rows: PlanRow[]) => `<table class="table table--stack plan__table">
        <thead><tr>${g.cols.map((h, i) => `<th${i >= 1 && i <= 3 ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(row).join('')}</tbody>
      </table>`;

  const body = `<section class="answer">
  <div class="container">
    <h1 class="answer__title">${esc(g.title)}</h1>
    <p class="answer__line">${esc(answer)}</p>
    <p class="answer__date">${esc(g.scenario(taskName, g.intensities[intensity] ?? intensity, g.intensityNotes[intensity] ?? ''))}</p>
    ${choices}
  </div>
</section>
<section class="section">
  <div class="container plan">
    ${go.stale ? `<div class="notice">${esc(g.stale(f.n.format(go.checkedAgeDays ?? 0)))}</div>` : ''}
    <div class="results plan__cards">
      ${card(recommended, 'recommended')}
      ${card(alternative, 'alternative')}
    </div>
    ${winners.length ? `<div class="card">
      <h2 class="plan__title">${esc(g.winnersTitle)}</h2>
      ${table(winners)}
      <p class="meta">${esc(g.cols[1])}: Artificial Analysis Coding Index. ${esc(g.setup)}</p>
    </div>` : ''}
    ${losers.length ? `<details class="details"${winners.length ? '' : ' open'}>
      <summary>${esc(g.losersTitle(losers.length))}</summary>
      <div class="details__body">${table(losers)}</div>
    </details>` : ''}
    ${notEnough.length ? `<details class="details">
      <summary>${esc(g.notEnoughTitle(notEnough.length))}</summary>
      <div class="details__body">${table(notEnough)}</div>
    </details>` : ''}
    ${more.length ? `<details class="details">
      <summary>${esc(g.moreTitle(more.length))}</summary>
      <div class="details__body"><ul class="list">${more.map((r) => `<li><strong>${esc(name(r))}</strong>: ${esc(r.blocker ? c.reasons[r.blocker] : !r.quality ? g.unmeasured : !r.direct ? g.noDirect : c.reasons['incomplete-prices'])}${r.month && !r.blocker ? ` · ${esc(r.month.coveredShare < 1 ? g.lasts(percent(r.month.coveredShare, lang)) : g.fitsCap)}` : ''}</li>`).join('')}</ul></div>
    </details>` : ''}
    <details class="details">
      <summary>${esc(g.howTitle)}</summary>
      <div class="details__body">
        <ul class="list">${[...g.how(taskName, `${(g.intensities[intensity] ?? intensity).toLowerCase()} (${g.intensityNotes[intensity] ?? ''})`, fee, f.n.format(go.plan.fiveHourPercent), f.n.format(go.plan.weeklyPercent)), g.tokens(tokens(go.mix.input, lang), tokens(go.mix.output, lang), tokens(go.mix.cacheRead, lang))].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <p class="meta">${esc(g.source(dateDay(go.plan.checkedAt, lang)))} <a href="${esc(go.plan.sourceUrl)}" rel="noopener">opencode.ai/docs/go</a> · ${esc(c.home.aaDisclaimer)}</p>
      </div>
    </details>
  </div>
</section>`;
  return layout({ lang, title: `${g.title} — ${SITE.name}`, description: g.description, body, active: 'go' });
}

/** A wrong address still gets the site: header, menu and a way back. */
export function notFoundPage(lang: Lang): string {
  const c = t(lang);
  const body = `<section class="section">
  <div class="container">
    <h1>${esc(c.notFound.title)}</h1>
    <div class="card">
      <p>${esc(c.notFound.message)}</p>
      <p><a class="button" href="${esc(pagePath(lang, 'home'))}">${esc(c.notFound.back)}</a></p>
    </div>
  </div>
</section>`;
  return layout({ lang, title: `${c.notFound.title} — ${SITE.name}`, description: c.siteDescription, body, active: 'home' });
}

export function methodPage(lang: Lang, snapshot: Snapshot | null = null): string {
  const c = t(lang);
  const m = c.method;
  const f = fmt(lang);
  const usd = (v: number) => `${f.n.format(v)} USD`;
  const budgets = PRIORITIES.map((p) =>
    `<tr><td>${esc(c.priorities[p] ?? p)}</td><td class="num">${esc(usd(BUDGETS[p].everyday))}</td><td class="num">${esc(usd(BUDGETS[p].hard))}</td></tr>`,
  ).join('');
  // Millions throughout, so the columns read at a glance.
  const millions = (v: number) => `${f.n.format(Math.round(v / 100_000) / 10)} M`;
  const costs = TASK_IDS.map((id) => {
    const mix = SCENARIOS[id].monthly;
    const factor = snapshot ? workFactor(snapshot, mix) : null;
    return `<tr><td>${esc(c.tasks[id] ?? SCENARIOS[id].label)}</td><td class="num">${esc(millions(mix.input))}</td><td class="num">${esc(millions(mix.output))}</td><td class="num">${esc(millions(mix.cacheRead))}</td><td class="num">${factor === null ? '—' : `${esc(f.n2.format(factor))}×`}</td></tr>`;
  }).join('');
  const excluded = m.excluded({
    offerHours: String(THRESHOLDS.offerStaleHours),
    uptime: `${f.n.format(THRESHOLDS.minUptime30m)}%`,
    uptimeDay: `${f.n.format(THRESHOLDS.minUptime1d)}%`,
    jump: f.n.format(THRESHOLDS.priceJumpFactor),
  });
  const th = (cols: string[]) => `<thead><tr>${cols.map((x, k) => `<th${k ? ' class="num"' : ''}>${esc(x)}</th>`).join('')}</tr></thead>`;
  const body = `<section class="section">
  <div class="container method">
    <h1>${esc(m.title)}</h1>
    <p class="meta">${esc(m.intro)}</p>
    <div class="method__grid">
      <div class="card"><h2>${esc(m.ruleTitle)}</h2>
        <p class="method__rule">${esc(m.rule)}</p>
        <table class="table">${th(m.budgetCols)}<tbody>${budgets}</tbody></table>
        <p class="meta">${esc(m.budgetNote)}</p>
      </div>
      <div class="card"><h2>${esc(m.costTitle)}</h2>
        <table class="table">${th(m.costCols)}<tbody>${costs}</tbody></table>
        <p class="meta">${esc(m.costNote)}</p>
      </div>
    </div>
    <div class="card"><h2>${esc(m.guaranteesTitle)}</h2><ul class="list">${m.guarantees.map((x) => `<li>${x}</li>`).join('')}</ul></div>
    <div class="method__grid">
      <div class="card"><h2>${esc(m.excludedTitle)}</h2><ul class="list">${excluded.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="card"><h2>${esc(m.limitsTitle)}</h2><ul class="list">${m.limits.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    </div>
    <p class="meta"><a href="${esc(SITE.repo)}/blob/main/METHODOLOGY.md" rel="noopener">${esc(m.fullDetails)}</a></p>
  </div>
</section>`;
  return layout({ lang, title: `${m.title} — ${SITE.name}`, description: m.intro, body, active: 'method' });
}

export function sourcesPage(snapshot: Snapshot | null, lang: Lang): string {
  const c = t(lang);
  const f = fmt(lang);
  const statuses = new Map<string, SourceStatus>();
  for (const s of snapshot?.sources ?? []) if (!statuses.has(s.id)) statuses.set(s.id, s);

  // Only the sources in use: a disabled one is a note for developers, not for visitors.
  const rows = SOURCES.filter((cfg) => cfg.enabled).map((cfg) => {
    const st = statuses.get(cfg.id);
    const state = st?.outcome === 'ok'
      ? `<span class="label label--ok">${esc(c.sources.active)}</span>`
      : st
        ? `<span class="label label--warning">${esc(c.sources.failed)}</span>`
        : `<span class="label label--info">${esc(c.sources.never)}</span>`;
    const [, colState, colLicence, colNote, colCount] = c.sources.cols;
    const texts = lang === 'en' ? cfg.en : cfg;
    return `<tr>
      <td class="stack__title"><a href="${esc(cfg.url)}" rel="noopener">${esc(cfg.name)}</a></td>
      <td data-label="${esc(colState)}">${state}</td>
      <td data-label="${esc(colLicence)}">${esc(texts.licence)}</td>
      <td data-label="${esc(colNote)}">${esc(texts.note ?? texts.attribution)}</td>
      <td class="num" data-label="${esc(colCount)}">${esc(st ? f.n.format(st.itemCount) : '—')}</td>
    </tr>`;
  }).join('');

  const body = `<section class="section">
  <div class="container">
    <h1>${esc(c.sources.title)}</h1>
    <div class="card">
      <table class="table table--stack">
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
  // One row per source in use: OpenRouter reports its models and its offers separately.
  const bySource = new Map<string, { rows: number; failed: boolean; reusedHours: number | null }>();
  for (const s of snapshot?.sources ?? []) {
    if (s.outcome === 'disabled') continue;
    const row = bySource.get(s.id) ?? { rows: 0, failed: false, reusedHours: null };
    row.rows += s.itemCount;
    row.failed ||= s.outcome === 'failed';
    if (s.servedFromCache && s.dataAgeHours !== null) row.reusedHours = Math.max(row.reusedHours ?? 0, s.dataAgeHours);
    bySource.set(s.id, row);
  }
  const sources = SOURCES.filter((cfg) => bySource.has(cfg.id)).map((cfg) => {
    const row = bySource.get(cfg.id)!;
    const result = row.failed
      ? `<span class="label label--warning">${esc(c.status.failed)}</span>`
      : row.reusedHours !== null
        ? `<span class="label label--info">${esc(c.status.reused(f.n.format(Math.round(row.reusedHours))))}</span>`
        : `<span class="label label--ok">${esc(c.status.fresh)}</span>`;
    return `<tr><td>${esc(cfg.name)}</td><td>${result}</td><td class="num">${esc(f.n.format(row.rows))}</td></tr>`;
  }).join('');
  const stat = (n: number, label: string) => `<div class="stat"><span class="stat__value">${esc(f.n.format(n))}</span><span class="stat__label">${esc(label)}</span></div>`;
  const next = dateLong(new Date(Date.now() + msUntilNextRun()).toISOString(), lang);

  const body = `<section class="section">
  <div class="container status">
    <h1>${esc(c.status.title)}</h1>
    ${status
      ? `<div class="card">
      <p class="status__line">${status.ok ? '✓' : '⚠'} ${esc(status.ok ? c.status.ok(dateLong(status.finishedAt, lang)) : c.status.problems(dateLong(status.finishedAt, lang)))}</p>
      ${status.published ? '' : `<p class="alert">${esc(c.status.notPublished)}</p>`}
      <p class="meta">${esc(c.status.next(next))}</p>
      ${snapshot ? `<div class="stats">${stat(snapshot.stats.modelCount, c.status.models)}${stat(snapshot.stats.offerCount, c.status.offers)}${stat(snapshot.stats.evidenceCount, c.status.evidence)}</div>` : ''}
    </div>`
      : `<div class="notice">${esc(c.status.never)}</div>`}
    ${sources ? `<div class="card">
      <h2>${esc(c.status.sourcesTitle)}</h2>
      <table class="table"><thead><tr><th>${esc(c.status.cols[0])}</th><th>${esc(c.status.cols[1])}</th><th class="num">${esc(c.status.cols[2])}</th></tr></thead><tbody>${sources}</tbody></table>
    </div>` : ''}
    ${status?.warnings.length ? `<details class="details status__technical"><summary>${esc(c.status.technical(status.warnings.length))}</summary><div class="details__body"><ul class="list">${status.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div></details>` : ''}
  </div>
</section>`;
  return layout({ lang, title: `${c.status.title} — ${SITE.name}`, description: c.siteDescription, body, active: 'status' });
}
