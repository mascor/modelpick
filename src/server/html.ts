/**
 * Server-rendered pages. The form is a plain GET form: the site works without
 * JavaScript, which also keeps it readable for screen readers and crawlers.
 */
import { SITE, THRESHOLDS, SOURCES } from '../config.js';
import type { ModelRecord, Snapshot, SourceStatus } from '../types.js';
import type { Pick, Recommendation, RecommendationRequest } from '../engine/recommend.js';
import { SCENARIOS, TASK_IDS, PRIORITIES } from '../engine/scenarios.js';
import type { OpenCodeConfigResult } from '../engine/opencode.js';
import type { RunStatus } from '../pipeline/store.js';

export const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const nf = new Intl.NumberFormat('it-IT');
const nf2 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf4 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

const usd = (v: number | null): string => (v === null ? 'non disponibile' : `${v < 10 ? nf4.format(v) : nf2.format(v)} USD`);
const tokens = (v: number): string => (v >= 1_000_000 ? `${nf.format(Math.round(v / 100_000) / 10)} M` : nf.format(v));

const dateIt = (iso: string | null | undefined): string => {
  if (!iso) return 'data non disponibile';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'data non disponibile';
  return d.toLocaleString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
};
const dayIt = (iso: string | null | undefined): string => {
  if (!iso) return 'data non nota';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'data non nota';
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' });
};

export function layout(opts: { title: string; description: string; body: string; active?: string }): string {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Courier+Prime:wght@400;700&display=swap">
<link rel="stylesheet" href="/static/styles.css">
</head>
<body>
<header class="intestazione">
  <div class="intestazione__barra">
    <a class="marchio" href="/">
      <span class="marchio__nome">MODELPICK</span>
      <span class="marchio__di">by CloudSalus</span>
    </a>
    <nav class="menu">
      <a href="/"${opts.active === 'home' ? ' aria-current="page"' : ''}>Scelta</a>
      <a href="/metodo"${opts.active === 'metodo' ? ' aria-current="page"' : ''}>Metodo</a>
      <a href="/fonti"${opts.active === 'fonti' ? ' aria-current="page"' : ''}>Fonti</a>
      <a href="/stato"${opts.active === 'stato' ? ' aria-current="page"' : ''}>Stato</a>
      <a href="${esc(SITE.repo)}">Codice</a>
    </nav>
  </div>
</header>
<main>${opts.body}</main>
<footer class="pie">
  <div class="contenitore pie__righe">
    <div>
      <p><strong>${esc(SITE.name)}</strong> — ${esc(SITE.tagline)}</p>
      <p class="meta">Progetto open source di CloudSalus. Codice con licenza MIT; i dati di terze parti restano dei rispettivi titolari.</p>
    </div>
    <div>
      <p><a href="/metodo">Metodo e limiti</a> · <a href="/fonti">Fonti</a> · <a href="/stato">Stato aggiornamenti</a></p>
      <p class="meta">Nessuna sponsorizzazione influenza l\'ordine dei risultati. Non chiediamo mai le tue chiavi API.</p>
    </div>
  </div>
</footer>
<script src="/static/app.js" defer></script>
</body>
</html>`;
}

const option = (value: string, label: string, selected: string): string =>
  `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`;

const COUNTRIES: [string, string][] = [
  ['IT', 'Italia'], ['CH', 'Svizzera'], ['FR', 'Francia'], ['DE', 'Germania'], ['ES', 'Spagna'],
  ['GB', 'Regno Unito'], ['US', 'Stati Uniti'], ['OTHER', 'Altro paese'],
];

function renderForm(req: RecommendationRequest, models: ModelRecord[]): string {
  const modelOptions = models
    .slice()
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((m) => option(m.key, m.displayName, req.currentModelKey ?? ''))
    .join('');
  return `<form class="modulo" method="get" action="/">
  <div class="modulo__righe">
    <div class="campo">
      <label for="task">Attività principale</label>
      <select id="task" name="task">${TASK_IDS.map((t) => option(t, SCENARIOS[t].label, req.task)).join('')}</select>
    </div>
    <div class="campo">
      <label for="priority">Priorità</label>
      <select id="priority" name="priority">${PRIORITIES.map((p) => option(p, p === 'qualita' ? 'Qualità' : p[0]!.toUpperCase() + p.slice(1), req.priority)).join('')}</select>
    </div>
    <div class="campo">
      <label for="country">Paese di utilizzo</label>
      <select id="country" name="country">${COUNTRIES.map(([c, l]) => option(c, l, req.country)).join('')}</select>
    </div>
    <div class="campo">
      <label for="access">Acquisto</label>
      <select id="access" name="access">
        ${option('qualsiasi', 'Diretto o tramite intermediario', req.access)}
        ${option('solo-diretto', 'Solo diretto dal provider', req.access)}
      </select>
    </div>
    <div class="campo">
      <label for="privacy">Requisiti sui dati</label>
      <select id="privacy" name="privacy">
        ${option('nessuno', 'Nessun requisito particolare', req.privacy)}
        ${option('no-training', 'Niente addestramento sui miei dati', req.privacy)}
        ${option('zero-retention', 'Conservazione zero', req.privacy)}
      </select>
    </div>
  </div>
  <details class="dettagli" ${req.currentModelKey || req.usage ? 'open' : ''}>
    <summary>Facoltativo: la tua configurazione attuale e i tuoi consumi</summary>
    <div class="dettagli__corpo">
      <div class="modulo__righe">
        <div class="campo">
          <label for="currentModel">Modello che usi oggi</label>
          <select id="currentModel" name="currentModel">
            <option value="">Non indicato</option>${modelOptions}
          </select>
          <span class="campo__aiuto">Serve solo per stimare il risparmio.</span>
        </div>
        <div class="campo">
          <label for="input">Token di input al mese</label>
          <input id="input" name="input" type="number" min="0" step="100000" value="${req.usage?.input ?? ''}" placeholder="scenario predefinito">
        </div>
        <div class="campo">
          <label for="output">Token di output al mese</label>
          <input id="output" name="output" type="number" min="0" step="10000" value="${req.usage?.output ?? ''}" placeholder="scenario predefinito">
        </div>
        <div class="campo">
          <label for="cacheRead">Lettura cache al mese</label>
          <input id="cacheRead" name="cacheRead" type="number" min="0" step="100000" value="${req.usage?.cacheRead ?? ''}" placeholder="scenario predefinito">
        </div>
        <div class="campo">
          <label for="cacheWrite">Scrittura cache al mese</label>
          <input id="cacheWrite" name="cacheWrite" type="number" min="0" step="100000" value="${req.usage?.cacheWrite ?? ''}" placeholder="scenario predefinito">
        </div>
      </div>
      <p class="campo__aiuto">Lasciando i campi vuoti usiamo lo scenario dell\'attività scelta, che è un\'ipotesi dichiarata e non una misura dei tuoi consumi.</p>
    </div>
  </details>
  <div class="modulo__azioni">
    <button class="bottone bottone--gradiente" type="submit">Aggiorna la scelta</button>
    <span class="meta">Nessuna registrazione, nessun account, nessuna chiave API.</span>
  </div>
</form>`;
}

function renderCost(pick: Pick): string {
  const rows = pick.cost.lines
    .filter((l) => l.tokens > 0)
    .map(
      (l) => `<div class="prezzi__riga">
        <span class="prezzi__etichetta">${esc(l.label)} · ${esc(tokens(l.tokens))} token × ${l.usdPerMTok === null ? 'prezzo ignoto' : esc(nf4.format(l.usdPerMTok)) + ' USD/1M'}</span>
        <span>${esc(usd(l.usd))}</span>
      </div>`,
    )
    .join('');
  const fees = pick.cost.feeNotes.map((n) => `<div class="prezzi__riga"><span class="prezzi__etichetta">${esc(n)}</span><span>${esc(usd(pick.cost.feesUsd))}</span></div>`).join('');
  const unq = pick.cost.unquantifiedFees
    .map((n) => `<div class="prezzi__riga"><span class="prezzi__etichetta">${esc(n)}</span><span class="etichetta etichetta--commissione">non quantificata</span></div>`)
    .join('');
  const assumptions = pick.cost.assumptions.length
    ? `<p class="meta" style="margin:0">${pick.cost.assumptions.map(esc).join(' ')}</p>`
    : '';
  return `<div class="prezzi">
    ${rows}${fees}${unq}
    <div class="prezzi__riga prezzi__riga--totale"><span>Totale stimato al mese</span><span>${esc(usd(pick.cost.totalUsd))}</span></div>
    ${assumptions}
  </div>`;
}

function renderPick(pick: Pick | null, role: 'quotidiano' | 'difficile', empty: string): string {
  const title = role === 'quotidiano' ? '🟢 Modello per il lavoro quotidiano' : '🟠 Modello per i problemi difficili';
  if (!pick) {
    return `<article class="scheda pick pick--${role}">
      <p class="pick__ruolo">${esc(title)}</p>
      <div class="avviso avviso--neutro">${esc(empty)}</div>
    </article>`;
  }
  const q = pick.quality;
  const badges = [
    pick.offer.access === 'direct'
      ? '<span class="etichetta etichetta--ok">acquisto diretto</span>'
      : `<span class="etichetta etichetta--info">tramite ${esc(pick.offer.broker ?? 'intermediario')}</span>`,
    pick.provisional ? '<span class="etichetta etichetta--attenzione">raccomandazione provvisoria</span>' : '',
    pick.offer.quantization ? `<span class="etichetta etichetta--info">quantizzazione ${esc(pick.offer.quantization)}</span>` : '',
  ].join(' ');

  const alternatives = pick.alternatives.length
    ? `<table class="tabella">
        <thead><tr><th>Altri provider monitorati</th><th class="num">Input USD/1M</th><th class="num">Output USD/1M</th><th class="num">Totale mese</th></tr></thead>
        <tbody>${pick.alternatives
          .map(
            (a) => `<tr>
              <td>${esc(a.offer.providerName)}${a.offer.access === 'intermediary' ? ` <span class="meta">(via ${esc(a.offer.broker ?? 'intermediario')})</span>` : ''}</td>
              <td class="num">${a.offer.prices.inputPerMTok === null ? '—' : esc(nf4.format(a.offer.prices.inputPerMTok))}</td>
              <td class="num">${a.offer.prices.outputPerMTok === null ? '—' : esc(nf4.format(a.offer.prices.outputPerMTok))}</td>
              <td class="num">${esc(usd(a.cost.totalUsd))}</td>
            </tr>`,
          )
          .join('')}</tbody>
      </table>`
    : '<p class="meta">Nessun altro provider monitorato soddisfa i requisiti per questo modello.</p>';

  return `<article class="scheda pick pick--${role}">
    <p class="pick__ruolo">${esc(title)}</p>
    <h3 class="pick__modello">${esc(pick.model.displayName)}</h3>
    <p class="pick__provider">Provider: <strong>${esc(pick.offer.providerName)}</strong> — il più economico tra i provider monitorati che soddisfano i tuoi requisiti.</p>
    <p>${badges}</p>
    <p class="pick__perche">${esc(pick.reason)}</p>
    ${pick.whenToUse ? `<p class="pick__perche">${esc(pick.whenToUse)}</p>` : ''}
    ${renderCost(pick)}
    ${pick.provisional ? `<div class="avviso">Raccomandazione provvisoria: ${esc(pick.provisionalReasons.join('; '))}.</div>` : ''}
    <p>
      ${pick.model.officialUrl ? `<a class="bottone bottone--contorno bottone--piccolo" href="${esc(pick.model.officialUrl)}" rel="noopener">Pagina ufficiale</a>` : ''}
      <a class="bottone bottone--contorno bottone--piccolo" href="#opencode">Configura in OpenCode</a>
    </p>
    <details class="dettagli">
      <summary>Perché questa scelta?</summary>
      <div class="dettagli__corpo">
        <p><strong>Prova di qualità usata.</strong> ${esc(q.value.toFixed(1))}% di problemi risolti su ${q.metric === 'swebench_verified' ? 'SWE-bench Verified' : 'Aider polyglot'}, misurato con ${esc(q.harness)}, rilevazione del ${esc(dayIt(q.measuredAt))}. ${q.comparable ? 'Il punteggio appartiene al gruppo di confronto di riferimento.' : 'Attenzione: il punteggio viene da un banco di prova diverso da quello di riferimento, quindi non è direttamente confrontabile con gli altri.'} ${q.instanceCalls !== null ? `Media di ${esc(nf2.format(q.instanceCalls))} chiamate al modello per problema.` : ''} <a href="${esc(q.sourceUrl)}" rel="noopener">Fonte</a>.</p>
        <p><strong>Come abbiamo calcolato il costo.</strong> Ogni offerta e calcolata per intero sul singolo provider: non mescoliamo mai il prezzo di input di un provider con quello di output di un altro. ${pick.cost.constraints.length ? `Vincoli dichiarati dal provider: ${esc(pick.cost.constraints.join('; '))}.` : ''}</p>
        <p><strong>Contesto e capacità dell\'offerta.</strong> ${pick.offer.contextTokens ? `${esc(nf.format(pick.offer.contextTokens))} token di contesto` : 'contesto non dichiarato'}${pick.offer.maxOutputTokens ? `, fino a ${esc(nf.format(pick.offer.maxOutputTokens))} token di output` : ''}${pick.offer.uptime30m !== null ? `, disponibilità recente ${esc(nf2.format(pick.offer.uptime30m))}%` : ''}.</p>
        <p><strong>Disponibilità geografica e trattamento dei dati.</strong> ${pick.offer.regions === null ? 'Non abbiamo dati verificati sulla disponibilità per paese di questa offerta, quindi non promettiamo che sia acquistabile ovunque.' : 'Disponibilità dichiarata: ' + esc(String(pick.offer.regions))}. ${pick.offer.dataPolicy.trainsOnData === null ? 'Il trattamento dei dati non è documentato nelle fonti che leggiamo: verificalo presso il provider.' : ''}</p>
        <p><strong>Prezzo verificato il</strong> ${esc(dateIt(pick.offer.observedAt))} — <a href="${esc(pick.offer.sourceUrl)}" rel="noopener">fonte del prezzo</a>.</p>
        ${alternatives}
      </div>
    </details>
  </article>`;
}

function renderMethodBox(rec: Recommendation): string {
  const m = rec.method;
  return `<details class="dettagli">
    <summary>Come sono state prese queste due decisioni</summary>
    <div class="dettagli__corpo">
      <ul class="elenco">
        <li>Prima i modelli, poi i provider: selezioniamo i modelli sulle prove di qualità nel codice, e solo dopo cerchiamo il provider meno costoso che soddisfa i tuoi requisiti.</li>
        <li>Gruppo di confronto di riferimento: ${m.referenceHarness ? `${esc(m.referenceHarness)}, ${esc(String(m.referenceHarnessModels))} modelli misurati nelle stesse condizioni` : 'nessuno disponibile'}.</li>
        <li>Soglia di qualità per la priorità scelta: ${esc(String(m.gate.everyday))}% per il quotidiano, ${esc(String(m.gate.hard))}% per i problemi difficili.</li>
        <li>Modelli arrivati al confronto finale: ${esc(String(m.candidateModels))}.</li>
        <li>Scenario di consumo: ${rec.usingCustomUsage ? 'i consumi che hai inserito' : 'lo scenario predefinito dell\'attività scelta'} — ${esc(tokens(rec.mix.input))} input, ${esc(tokens(rec.mix.output))} output, ${esc(tokens(rec.mix.cacheRead))} lettura cache, ${esc(tokens(rec.mix.cacheWrite))} scrittura cache al mese.</li>
      </ul>
      ${m.excluded.length ? `<p><strong>Esclusioni.</strong></p><ul class="elenco">${m.excluded.slice(0, 8).map((e) => `<li>${esc(String(e.count))} modelli: ${esc(e.reason)}.</li>`).join('')}</ul>` : ''}
      <p class="meta">Non dividiamo il punteggio di qualità per il prezzo, non trattiamo le differenze di punteggio come percentuali di qualità e non confrontiamo misure ottenute con banchi di prova diversi. Il metodo completo e sulla <a href="/metodo">pagina del metodo</a>.</p>
    </div>
  </details>`;
}

function renderOpenCode(config: OpenCodeConfigResult | null): string {
  if (!config) return '';
  return `<section class="sezione sezione--alt" id="opencode">
    <div class="contenitore">
      <h2>Configura in OpenCode</h2>
      <p>Configurazione pronta per i modelli scelti. Le chiavi restano tue: qui trovi solo il nome della variabile d ambiente da impostare.</p>
      <div class="scheda">
        <pre class="codice" id="opencode-json">${esc(config.json)}</pre>
        <p>
          <button class="bottone bottone--piccolo" type="button" data-copia="#opencode-json">Copia la configurazione</button>
          <a class="bottone bottone--contorno bottone--piccolo" href="/opencode.json${config.everydayId ? `?model=${encodeURIComponent(config.everydayId)}` : ''}" download="opencode.json">Scarica opencode.json</a>
          <a class="bottone bottone--contorno bottone--piccolo" href="https://opencode.ai/docs/config/" rel="noopener">Documentazione OpenCode</a>
        </p>
        <ul class="elenco">${config.instructions.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      </div>
    </div>
  </section>`;
}

export function homePage(opts: {
  rec: Recommendation | null;
  snapshot: Snapshot | null;
  models: ModelRecord[];
  request: RecommendationRequest;
  config: OpenCodeConfigResult | null;
}): string {
  const { rec, snapshot, models, request, config } = opts;
  const verified = snapshot ? dateIt(snapshot.generatedAt) : null;
  const stale = rec?.method.snapshotStale ?? false;

  const body = `
<section class="hero">
  <div class="contenitore">
    <p class="hero__sopratitolo">${esc(SITE.tagline)}</p>
    <h1>Quale modello uso oggi, e da chi conviene comprarlo?</h1>
    <p class="hero__testo">Due scelte, non una classifica: un modello per il lavoro quotidiano e uno per i problemi difficili, con il provider meno costoso tra quelli monitorati che soddisfano i tuoi requisiti. Prima versione dedicata alla programmazione con OpenCode.</p>
  </div>
</section>

<section class="sezione">
  <div class="contenitore">
    <div class="scheda">${renderForm(request, models)}</div>
  </div>
</section>

<section class="sezione sezione--alt">
  <div class="contenitore">
    ${!snapshot ? '<div class="avviso avviso--errore">Non e ancora stato pubblicato nessun aggiornamento verificato: le raccomandazioni compariranno dopo la prima raccolta dati riuscita.</div>' : ''}
    ${stale ? `<div class="avviso">I dati pubblicati hanno più di ${esc(String(THRESHOLDS.snapshotStaleHours))} ore. Li mostriamo lo stesso, ma con la loro data reale: non diciamo "aggiornato oggi" per dati non verificati oggi.</div>` : ''}
    ${rec?.notes.map((n) => `<div class="avviso">${esc(n)}</div>`).join('') ?? ''}
    <div class="risultati">
      ${renderPick(rec?.everyday ?? null, 'quotidiano', 'Nessun modello soddisfa insieme la soglia di qualità e i requisiti indicati. Preferiamo non indicare un vincitore piuttosto che indicarne uno senza prove.')}
      ${renderPick(rec?.hard ?? null, 'difficile', 'Nessun modello documenta una capacità superiore sufficiente a giustificare un secondo modello.')}
    </div>
    ${rec?.savings ? `<div class="scheda" style="margin-top:20px">
      <h3>Confronto con la tua configurazione attuale</h3>
      <p>${rec.savings.currentTotalUsd === null ? esc(rec.savings.note) : `Sullo stesso scenario la tua configurazione attuale costa ${esc(usd(rec.savings.currentTotalUsd))} al mese, quella consigliata ${esc(usd(rec.savings.recommendedTotalUsd))}. Differenza stimata: ${esc(usd(rec.savings.deltaUsd))}.`}</p>
      <p class="meta">${esc(rec.savings.note)}</p>
    </div>` : ''}
    <div class="scheda" style="margin-top:20px">
      <p class="meta">Ultima verifica dei dati: <strong>${esc(verified ?? 'mai')}</strong>${snapshot ? ` · ${esc(nf.format(snapshot.stats.offerCount))} offerte da ${esc(nf.format(snapshot.stats.modelCount))} modelli · ${esc(nf.format(snapshot.stats.evidenceCount))} misure di qualità` : ''}</p>
      ${rec ? renderMethodBox(rec) : ''}
    </div>
  </div>
</section>

${renderOpenCode(config)}
`;
  return layout({
    title: `${SITE.name} — ${SITE.tagline}`,
    description:
      'Quale modello AI usare per programmare ogni giorno, quale tenere per i problemi difficili e da quale provider conviene comprarlo oggi. Dati verificati e aggiornati ogni giorno.',
    body,
    active: 'home',
  });
}

export function methodPage(): string {
  const body = `<section class="sezione">
  <div class="contenitore">
    <h1>Metodo, soglie e limiti</h1>
    <p>Questa pagina descrive esattamente come si arriva alle due raccomandazioni. Se qualcosa qui non ti convince, la scelta giusta e non fidarti del risultato: per questo pubblichiamo tutto.</p>

    <div class="scheda" style="margin-bottom:20px">
      <h2>Ordine delle decisioni</h2>
      <ol class="elenco">
        <li><strong>Prima i modelli.</strong> Consideriamo solo modelli con una misura pubblicata di qualità sul codice. Un modello senza prove non può vincere.</li>
        <li><strong>Poi i provider.</strong> Per ogni modello ammesso cerchiamo tutte le offerte monitorate e teniamo quelle che soddisfano i requisiti indicati.</li>
        <li><strong>Infine la convenienza.</strong> Ogni offerta viene calcolata per intero, commissioni incluse, sullo stesso scenario di consumo.</li>
      </ol>
    </div>

    <div class="scheda" style="margin-bottom:20px">
      <h2>Che cosa non facciamo</h2>
      <ul class="elenco">
        <li>Non dividiamo il punteggio di qualità per il prezzo: non è una misura di niente.</li>
        <li>Non trattiamo la differenza fra due punteggi come una percentuale di qualità.</li>
        <li>Non confrontiamo misure ottenute con banchi di prova, versioni o condizioni diverse: ogni misura porta con se il gruppo di confronto a cui appartiene.</li>
        <li>Non equipariamo versioni, quantizzazioni o modalita diverse dello stesso modello: sono offerte distinte.</li>
        <li>Non assumiamo che il prezzo di un intermediario valga anche comprando direttamente dal provider.</li>
        <li>Non inventiamo consumi, percentuali di cache o tassi di riuscita.</li>
      </ul>
    </div>

    <div class="scheda" style="margin-bottom:20px">
      <h2>Soglie in vigore</h2>
      <table class="tabella">
        <tbody>
          <tr><td>Un prezzo non verificato da più di</td><td class="num">${esc(String(THRESHOLDS.offerStaleHours))} ore</td><td>non può vincere il confronto</td></tr>
          <tr><td>Uno snapshot più vecchio di</td><td class="num">${esc(String(THRESHOLDS.snapshotStaleHours))} ore</td><td>viene segnalato come obsoleto in pagina</td></tr>
          <tr><td>Una misura di qualità più vecchia di</td><td class="num">${esc(String(THRESHOLDS.evidenceStaleDays))} giorni</td><td>rende la raccomandazione provvisoria</td></tr>
          <tr><td>Una variazione di prezzo oltre un fattore</td><td class="num">${esc(String(THRESHOLDS.priceJumpFactor))}×</td><td>mette l\'offerta in quarantena</td></tr>
          <tr><td>Un prezzo superiore a</td><td class="num">${esc(String(THRESHOLDS.maxPricePerMTok))} USD/1M</td><td>viene scartato come probabile errore di unità</td></tr>
          <tr><td>Disponibilità recente sotto</td><td class="num">${esc(String(THRESHOLDS.minUptime30m))}%</td><td>esclude l\'offerta</td></tr>
          <tr><td>Il modello di riserva deve superare il quotidiano di almeno</td><td class="num">${esc(String(THRESHOLDS.backupQualityGapPoints))} punti</td><td>altrimenti non lo indichiamo</td></tr>
        </tbody>
      </table>
    </div>

    <div class="scheda" style="margin-bottom:20px">
      <h2>Dati mancanti</h2>
      <p>Un prezzo mancante non diventa mai zero: l\'offerta viene esclusa dal confronto e lo diciamo. Se una fonte non risponde, conserviamo l\'ultimo dato valido e ne dichiariamo l\'età. Se le prove non bastano, la raccomandazione e marcata come <em>provvisoria</em>; se non bastano proprio, non assegniamo un vincitore.</p>
    </div>

    <div class="scheda">
      <h2>Limiti dichiarati</h2>
      <ul class="elenco">
        <li>Copriamo i provider monitorati dalle fonti abilitate, non tutto il mercato. La formula che usiamo e sempre: "il più economico tra i provider monitorati che soddisfano i tuoi requisiti".</li>
        <li>La disponibilità per paese è il trattamento dei dati spesso non sono pubblicati in modo strutturato: quando non li conosciamo lo scriviamo invece di indovinare.</li>
        <li>Gli scenari di consumo sono ipotesi dichiarate e modificabili, non misure dei tuoi consumi.</li>
        <li>I banchi di prova pubblici misurano un agente su compiti standard: sono un indizio serio, non una garanzia sul tuo repository.</li>
      </ul>
    </div>
  </div>
</section>`;
  return layout({ title: `Metodo — ${SITE.name}`, description: 'Come ModelPick sceglie i modelli e i provider: regole, soglie, dati mancanti e limiti.', body, active: 'metodo' });
}

export function sourcesPage(snapshot: Snapshot | null): string {
  const statuses = new Map<string, SourceStatus>();
  for (const s of snapshot?.sources ?? []) if (!statuses.has(s.id)) statuses.set(s.id, s);

  const rows = SOURCES.map((cfg) => {
    const st = statuses.get(cfg.id);
    const state = !cfg.enabled
      ? '<span class="etichetta etichetta--attenzione">non abilitata</span>'
      : st?.outcome === 'ok'
        ? '<span class="etichetta etichetta--ok">attiva</span>'
        : st
          ? '<span class="etichetta etichetta--attenzione">errore nell\'ultimo aggiornamento</span>'
          : '<span class="etichetta etichetta--info">mai eseguita</span>';
    return `<tr>
      <td><a href="${esc(cfg.url)}" rel="noopener">${esc(cfg.name)}</a></td>
      <td>${state}</td>
      <td>${esc(cfg.licence)}</td>
      <td>${esc(cfg.note ?? cfg.attribution)}</td>
      <td class="num">${esc(st ? nf.format(st.itemCount) : '—')}</td>
    </tr>`;
  }).join('');

  const body = `<section class="sezione">
  <div class="contenitore">
    <h1>Fonti e provider monitorati</h1>
    <p>Prima di integrare una fonte ne controlliamo le condizioni di accesso e di riuso. La licenza MIT del nostro codice non si applica ai dati di terzi: ogni fonte resta dei suoi titolari e viene attribuita.</p>
    <div class="scheda" style="margin-bottom:20px">
      <table class="tabella">
        <thead><tr><th>Fonte</th><th>Stato</th><th>Licenza o condizioni</th><th>Nota</th><th class="num">Righe</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="scheda" style="margin-bottom:20px">
      <h2>Perché alcune fonti sono spente</h2>
      <p>Una fonte resta spenta finche non abbiamo letto per intero le sue condizioni di riuso. Preferiamo una copertura più piccola e difendibile a una più grande e discutibile. Se conosci i termini di una di queste fonti, o rappresenti la fonte stessa, scrivici: abilitarla e una riga di configurazione.</p>
    </div>
    <div class="scheda">
      <h2>Sponsorizzazioni e affiliazioni</h2>
      <p>Oggi non esistono accordi di sponsorizzazione né link di affiliazione. Se in futuro ce ne saranno, saranno dichiarati in questa pagina e non influenzeranno l\'ordine dei risultati, che resta determinato solo dal metodo pubblicato.</p>
    </div>
  </div>
</section>`;
  return layout({ title: `Fonti — ${SITE.name}`, description: 'Fonti dati monitorate da ModelPick, licenze, attribuzioni è stato di ogni connettore.', body, active: 'fonti' });
}

export function statusPage(snapshot: Snapshot | null, status: RunStatus | null): string {
  const sources = (snapshot?.sources ?? [])
    .map(
      (s) => `<tr>
        <td>${esc(s.name)}</td>
        <td>${esc(s.outcome)}</td>
        <td class="num">${esc(nf.format(s.itemCount))}</td>
        <td>${s.error ? esc(s.error) : s.servedFromCache ? `dati riusati, età ${s.dataAgeHours !== null ? esc(nf2.format(s.dataAgeHours)) + ' ore' : 'non nota'}` : '—'}</td>
        <td class="num">${s.durationMs !== null ? esc(nf.format(s.durationMs)) + ' ms' : '—'}</td>
      </tr>`,
    )
    .join('');

  const body = `<section class="sezione">
  <div class="contenitore">
    <h1>Stato degli aggiornamenti</h1>
    <p>L aggiornamento gira sul server ogni giorno alle 06:30 (Europe/Rome), indipendentemente dalle visite al sito.</p>
    ${status ? `<div class="scheda" style="margin-bottom:20px">
      <p><strong>Ultimo tentativo:</strong> ${esc(dateIt(status.finishedAt))} — ${status.ok ? '<span class="etichetta etichetta--ok">riuscito</span>' : '<span class="etichetta etichetta--attenzione">con problemi</span>'} ${status.published ? '<span class="etichetta etichetta--ok">pubblicato</span>' : '<span class="etichetta etichetta--attenzione">non pubblicato</span>'}</p>
      <p>${esc(status.message)}</p>
      <p class="meta">Durata: ${esc(nf.format(status.durationMs))} ms · identificativo ${esc(status.runId)}</p>
      ${status.warnings.length ? `<details class="dettagli"><summary>Segnalazioni (${esc(String(status.warnings.length))})</summary><div class="dettagli__corpo"><ul class="elenco">${status.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div></details>` : ''}
    </div>` : '<div class="avviso">Nessun aggiornamento ancora eseguito.</div>'}
    ${snapshot ? `<div class="scheda">
      <h2>Dati pubblicati</h2>
      <p class="meta">Snapshot ${esc(snapshot.runId)} del ${esc(dateIt(snapshot.generatedAt))}</p>
      <table class="tabella">
        <thead><tr><th>Fonte</th><th>Esito</th><th class="num">Righe</th><th>Nota</th><th class="num">Durata</th></tr></thead>
        <tbody>${sources}</tbody>
      </table>
    </div>` : ''}
  </div>
</section>`;
  return layout({ title: `Stato — ${SITE.name}`, description: 'Stato dell\'ultimo aggiornamento dati di ModelPick, per fonte.', body, active: 'stato' });
}
