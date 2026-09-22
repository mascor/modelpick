/**
 * Server-rendered pages. The form is a plain GET form: the site works without
 * JavaScript, which also keeps it readable for screen readers and crawlers.
 */
import { SITE, THRESHOLDS, SOURCES } from '../config.js';
import type { ModelRecord, Snapshot, SourceStatus } from '../types.js';
import type { OfferView, Pick, Recommendation, RecommendationRequest } from '../engine/recommend.js';
import { accountName, usabilityLabel } from '../engine/usability.js';
import { signupUrl } from '../engine/signup.js';
import { modelIdFor } from '../engine/opencode.js';
import type { Change } from '../engine/changes.js';
import { SCENARIOS, TASK_IDS, PRIORITIES, type Priority } from '../engine/scenarios.js';
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

const usd = (v: number | null): string => (v === null ? 'non disponibile' : `${nf2.format(v)} USD`);

/** "DeepSeek: DeepSeek V3.2" -> "DeepSeek V3.2": il fornitore e gia scritto accanto. */
const nomeModello = (raw: string): string => {
  const i = raw.indexOf(': ');
  return i > 0 ? raw.slice(i + 2) : raw;
};
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

/**
 * How to buy, and how to switch. Every provider row carries the two things you
 * need: what it costs you per month, and the exact command to use it.
 */
function renderConfronto(pick: Pick, role: string): string {
  const riga = (o: OfferView, i: number, scelto: boolean) => {
    const id = `cmd-${role}-${i}`;
    const comando = `opencode -m ${modelIdFor(o.offer)}`;
    return `<tr${scelto ? ' class="scelto"' : ''}>
      <td>
        <strong>${esc(o.offer.providerName)}</strong>
        <span class="meta">${esc(usabilityLabel(o.usability, o.offer))}</span>
      </td>
      <td class="num nowrap"><strong>${esc(usd(o.cost.totalUsd))}</strong></td>
      <td class="azione">
        <code class="nascosto" id="${esc(id)}">${esc(comando)}</code>
        ${signupUrl(o.offer) ? `<a class="riga-link" href="${esc(signupUrl(o.offer)!)}" target="_blank" rel="noopener">chiave</a>` : ''}
        <button class="bottone bottone--contorno bottone--piccolo" type="button" data-copia="#${esc(id)}">Copia</button>
      </td>
    </tr>`;
  };

  const primi = pick.alternatives.slice(0, 3);
  const restanti = pick.alternatives.slice(3);

  return `<div class="acquisto">
    <h4 class="acquisto__titolo">Dove comprarlo</h4>
    <table class="tabella confronto">
      <tbody>
        ${riga(pick.chosen, 0, true)}
        ${primi.map((o, i) => riga(o, i + 1, false)).join('')}
      </tbody>
    </table>
    ${restanti.length ? `<details class="dettagli">
      <summary>Altri ${esc(String(restanti.length))} provider</summary>
      <div class="dettagli__corpo">
        <table class="tabella confronto"><tbody>${restanti.slice(0, 16).map((o, i) => riga(o, i + 100, false)).join('')}</tbody></table>
      </div>
    </details>` : ''}
  </div>`;
}

function renderDettagli(pick: Pick): string {
  const q = pick.quality;
  const righe = pick.cost.lines
    .filter((l) => l.tokens > 0)
    .map((l) => `<div class="prezzi__riga">
        <span class="prezzi__etichetta">${esc(l.label)} · ${esc(tokens(l.tokens))} token</span>
        <span>${esc(usd(l.usd))}</span>
      </div>`)
    .join('');
  const commissioni = [
    ...pick.cost.feeNotes.map((n) => `<div class="prezzi__riga"><span class="prezzi__etichetta">${esc(n)}</span><span>${esc(usd(pick.cost.feesUsd))}</span></div>`),
    ...pick.cost.unquantifiedFees.map((n) => `<div class="prezzi__riga"><span class="prezzi__etichetta">${esc(n)}</span><span class="etichetta etichetta--commissione">non quantificata</span></div>`),
  ].join('');

  return `<details class="dettagli">
    <summary>Perché proprio questo</summary>
    <div class="dettagli__corpo">
      <p>${esc(pick.reason)}</p>
      <p><strong>La prova.</strong> ${esc(q.value.toFixed(1))}% di problemi risolti su ${q.metric === 'swebench_verified' ? 'SWE-bench Verified' : 'Aider polyglot'}, misurato con ${esc(q.harness)} il ${esc(dayIt(q.measuredAt))}. <a href="${esc(q.sourceUrl)}" rel="noopener">Vedi la misura</a>.</p>
      <div class="prezzi">${righe}${commissioni}
        <div class="prezzi__riga prezzi__riga--totale"><span>Totale stimato al mese</span><span>${esc(usd(pick.cost.totalUsd))}</span></div>
      </div>
      ${pick.cost.assumptions.length ? `<p class="meta">${pick.cost.assumptions.map(esc).join(' ')}</p>` : ''}
      ${pick.provisional ? `<p class="meta">Raccomandazione provvisoria: ${esc(pick.provisionalReasons.join('; '))}.</p>` : ''}
      <p class="meta">Prezzo verificato il ${esc(dateIt(pick.offer.observedAt))}. <a href="${esc(pick.offer.sourceUrl)}" rel="noopener">Fonte del prezzo</a>${pick.model.officialUrl ? ` · <a href="${esc(pick.model.officialUrl)}" rel="noopener">Pagina del modello</a>` : ''}.</p>
    </div>
  </details>`;
}

function renderPick(
  pick: Pick | null,
  role: 'quotidiano' | 'difficile',
  change: Change | null,
  empty: string,
): string {
  const titolo = role === 'quotidiano' ? '🟢 Ogni giorno' : '🟠 Quando si blocca';
  if (!pick) {
    return `<article class="scheda pick pick--${role}">
      <p class="pick__ruolo">${esc(titolo)}</p>
      <div class="avviso avviso--neutro">${esc(empty)}</div>
    </article>`;
  }
  return `<article class="scheda pick pick--${role}">
    <p class="pick__ruolo">${esc(titolo)}</p>
    <h3 class="pick__modello">${esc(nomeModello(pick.model.displayName))}</h3>
    <p class="pick__sintesi"><strong>${esc(usd(pick.cost.totalUsd))}</strong> al mese · <strong>${esc(pick.quality.value.toFixed(0))}%</strong> di problemi risolti</p>
    ${change?.moved ? `<p class="pick__cambio pick__cambio--mosso">${esc(change.text)}</p>` : ''}
    <ol class="passi">
      <li class="passo">
        <span class="passo__testo">Prendi la chiave su <strong>${esc(accountName(pick.offer))}</strong></span>
        ${signupUrl(pick.offer) ? `<a class="bottone bottone--contorno bottone--piccolo" href="${esc(signupUrl(pick.offer)!)}" target="_blank" rel="noopener">Apri</a>` : ''}
      </li>
      ${pick.offer.apiKeyEnv ? `<li class="passo">
        <code class="passo__codice" id="key-${esc(role)}">export ${esc(pick.offer.apiKeyEnv)}="la-tua-chiave"</code>
        <button class="bottone bottone--contorno bottone--piccolo" type="button" data-copia="#key-${esc(role)}">Copia</button>
      </li>` : ''}
      <li class="passo">
        <code class="passo__codice" id="config-${esc(role)}">opencode -m ${esc(modelIdFor(pick.offer))}</code>
        <button class="bottone bottone--piccolo" type="button" data-copia="#config-${esc(role)}">Copia</button>
      </li>
    </ol>
    ${renderConfronto(pick, role)}
    ${renderDettagli(pick)}
  </article>`;
}

/** Everything that used to be a question, tucked away for whoever wants it. */
function renderIpotesi(req: RecommendationRequest, rec: Recommendation | null, models: ModelRecord[]): string {
  const modelOptions = models
    .slice()
    .sort((a, b) => nomeModello(a.displayName).localeCompare(nomeModello(b.displayName)))
    .map((m) => option(m.key, nomeModello(m.displayName), req.currentModelKey ?? ''))
    .join('');
  return `<details class="dettagli dettagli--ipotesi">
    <summary>Cambia il tipo di lavoro o i tuoi consumi</summary>
    <div class="dettagli__corpo">
      <p class="meta">Di base stimiamo i costi su un mese di lavoro con un agente di codice: ${rec ? `${esc(tokens(rec.mix.input))} token di input, ${esc(tokens(rec.mix.output))} di output, ${esc(tokens(rec.mix.cacheRead))} letti dalla cache. È un'ipotesi dichiarata, non una misura dei tuoi consumi.` : ''}</p>
      <form class="modulo" method="get" action="/">
        <div class="modulo__righe">
          <div class="campo">
            <label for="task">Tipo di lavoro</label>
            <select id="task" name="task">${TASK_IDS.map((t) => option(t, SCENARIOS[t].label, req.task)).join('')}</select>
          </div>
          <div class="campo">
            <label for="priority">Cosa conta di più</label>
            <select id="priority" name="priority">
              ${option('risparmio', 'Spendere poco', req.priority)}
              ${option('equilibrio', 'Equilibrio', req.priority)}
              ${option('qualita', 'Lavorare bene', req.priority)}
            </select>
          </div>
          <div class="campo">
            <label for="input">Token di input al mese</label>
            <input id="input" name="input" type="number" min="0" step="100000" value="${req.usage?.input ?? ''}" placeholder="predefinito">
          </div>
          <div class="campo">
            <label for="output">Token di output al mese</label>
            <input id="output" name="output" type="number" min="0" step="10000" value="${req.usage?.output ?? ''}" placeholder="predefinito">
          </div>
          <div class="campo">
            <label for="cacheRead">Lettura cache al mese</label>
            <input id="cacheRead" name="cacheRead" type="number" min="0" step="100000" value="${req.usage?.cacheRead ?? ''}" placeholder="predefinito">
          </div>
          <div class="campo">
            <label for="cacheWrite">Scrittura cache al mese</label>
            <input id="cacheWrite" name="cacheWrite" type="number" min="0" step="100000" value="${req.usage?.cacheWrite ?? ''}" placeholder="predefinito">
          </div>
          <div class="campo">
            <label for="currentModel">Modello che usi oggi</label>
            <select id="currentModel" name="currentModel">
              <option value="">Non indicato</option>${modelOptions}
            </select>
          </div>
        </div>
        <div class="modulo__azioni">
          <button class="bottone bottone--piccolo" type="submit">Ricalcola</button>
        </div>
      </form>
    </div>
  </details>`;
}

function renderMetodoBreve(rec: Recommendation): string {
  const m = rec.method;
  return `<details class="dettagli">
    <summary>Come scegliamo</summary>
    <div class="dettagli__corpo">
      <p>Prima i modelli, poi i provider. Entra nel confronto solo un modello con una misura di qualità sul codice ottenuta nelle stesse condizioni degli altri${m.referenceHarness ? ` (${esc(m.referenceHarness)}, ${esc(String(m.referenceHarnessModels))} modelli)` : ''}. Fra quelli che superano la soglia di ${esc(String(m.gate.everyday))}%, scegliamo il più economico. Il secondo modello deve risolvere almeno 3 punti in più, misurati allo stesso modo.</p>
      <p class="meta">Modelli arrivati al confronto: ${esc(String(m.candidateModels))}.${m.excluded.length ? ` Esclusi: ${m.excluded.slice(0, 3).map((e) => `${esc(String(e.count))} per ${esc(e.reason)}`).join(', ')}.` : ''} Il metodo completo è su <a href="/metodo">/metodo</a>, le fonti su <a href="/fonti">/fonti</a>.</p>
    </div>
  </details>`;
}

export function homePage(opts: {
  rec: Recommendation | null;
  snapshot: Snapshot | null;
  models: ModelRecord[];
  request: RecommendationRequest;
  config: OpenCodeConfigResult | null;
  changes: { everyday: Change | null; hard: Change | null };
}): string {
  const { rec, snapshot, models, request, config, changes } = opts;
  const stale = rec?.method.snapshotStale ?? false;

  const body = `
<section class="hero hero--compatto">
  <div class="contenitore">
    <p class="hero__sopratitolo">${snapshot ? `Verificato il ${esc(dateIt(snapshot.generatedAt))}` : 'Nessun dato verificato'}</p>
    <h1>Che modello usi oggi</h1>
  </div>
</section>

<section class="sezione">
  <div class="contenitore">
    ${!snapshot ? '<div class="avviso avviso--errore">Non è ancora stato pubblicato nessun aggiornamento verificato.</div>' : ''}
    ${stale ? '<div class="avviso">Questi dati non sono stati verificati oggi: la data reale è qui sopra.</div>' : ''}
    ${rec?.notes.map((n) => `<div class="avviso">${esc(n)}</div>`).join('') ?? ''}
    <div class="risultati">
      ${renderPick(rec?.everyday ?? null, 'quotidiano', changes.everyday, 'Nessun modello supera la soglia di qualità con un prezzo verificato. Preferiamo non indicare un vincitore piuttosto che indicarne uno senza prove.')}
      ${renderPick(rec?.hard ?? null, 'difficile', changes.hard, 'Nessun modello risolve abbastanza più problemi da giustificarne un secondo.')}
    </div>
    ${rec?.savings && rec.savings.deltaUsd !== null ? `<p class="risparmio">Rispetto a quello che usi oggi: ${rec.savings.deltaUsd > 0 ? `<strong>risparmi ${esc(usd(rec.savings.deltaUsd))} al mese</strong>` : `<strong>spendi ${esc(usd(Math.abs(rec.savings.deltaUsd)))} in più al mese</strong>`}, sugli stessi consumi. Stima, non misura.</p>` : ''}
    <div class="coda">
      ${renderIpotesi(request, rec, models)}
      ${rec ? renderMetodoBreve(rec) : ''}
      ${config ? `<details class="dettagli">
        <summary>File di configurazione completo</summary>
        <div class="dettagli__corpo">
          <pre class="codice" id="opencode-json">${esc(config.json)}</pre>
          <p>
            <button class="bottone bottone--piccolo" type="button" data-copia="#opencode-json">Copia</button>
            <a class="bottone bottone--contorno bottone--piccolo" href="/opencode.json?task=${esc(request.task)}&priority=${esc(request.priority)}" download="opencode.json">Scarica</a>
          </p>
          <ul class="elenco">${config.instructions.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
        </div>
      </details>` : ''}
    </div>
  </div>
</section>
`;
  return layout({
    title: `${SITE.name} — ${SITE.tagline}`,
    description:
      'Quale modello AI usare oggi per programmare, quale tenere per i problemi difficili e da quale provider conviene comprarlo. Prezzi verificati ogni giorno.',
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
        <li><strong>Prima i modelli.</strong> Consideriamo solo modelli con una misura pubblicata di qualità sul codice, ottenuta nelle stesse condizioni degli altri. Un modello senza prove confrontabili non può vincere.</li>
        <li><strong>La tua scelta cambia che cosa significa "il migliore".</strong> Con "spendere poco" ed "equilibrio" prendiamo il modello meno costoso che supera la soglia di qualità. Con "lavorare bene" prendiamo il punteggio più alto, e il prezzo decide solo fra modelli praticamente pari.</li>
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
