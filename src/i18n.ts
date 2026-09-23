/**
 * Two languages, one catalogue. Sentences the engine composes live here too,
 * as functions, so no user-facing Italian is left hard-coded in the logic.
 */
export type Lang = 'it' | 'en';
export const LANGS: Lang[] = ['it', 'en'];
export const DEFAULT_LANG: Lang = 'en';

/**
 * Italian only for browsers whose first language is Italian; everyone else,
 * crawlers without the header included, gets English.
 */
export function browserLang(acceptLanguage: string | undefined): Lang {
  if (!acceptLanguage) return 'en';
  const ranked = acceptLanguage
    .split(',')
    .map((part, i) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { tag: tag.toLowerCase(), q: q ? Number(q.slice(2)) : 1, i };
    })
    .filter((x) => x.tag && x.tag !== '*' && Number.isFinite(x.q) && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  return ranked[0]?.tag.split('-')[0] === 'it' ? 'it' : 'en';
}

/** Cookie that remembers a language picked by hand from the menu. */
export const LANG_COOKIE = 'mp_lang';

/** Reason codes the engine emits instead of prose. */
export type ReasonCode =
  | 'no-tools'
  | 'model-context'
  | 'no-seller'
  | 'not-comparable'
  | 'stale-evidence'
  | 'no-usable-offer'
  | 'over-price-cap'
  | 'demo'
  | 'quarantine'
  | 'suspended'
  | 'stale-price'
  | 'offer-no-tools'
  | 'offer-context'
  | 'offer-uptime'
  | 'incomplete-prices'
  | 'plan-based'
  | 'opencode-unknown';

export interface Catalog {
  notFound: { title: string; message: string; back: string };
  htmlLang: string;
  siteDescription: string;
  siteTagline: string;
  nav: { choice: string; method: string; sources: string; status: string; code: string; otherLang: string; otherLangCode: string };
  home: {
    title: string;
    pricesVerified: (when: string) => string;
    noData: string;
    stale: string;
    everyday: string;
    hard: string;
    perMonth: (amount: string) => string;
    benchmark: (value: string, metric: string, when: string) => string;
    evidenceNoDate: string;
    incompleteEstimate: string;
    successor: (name: string) => string;
    inherited: (from: string) => string;
    effort: (level: string) => string;
    perTask: (usd: string) => string;
    replaced: (retired: string, successor: string) => string;
    getKey: (account: string) => string;
    open: string;
    copy: string;
    copyCommand: string;
    copied: string;
    copyBlocked: string;
    copyConfig: string;
    saveConfig: (provider: string) => string;
    whereToBuy: string;
    otherProviders: (n: number) => string;
    key: string;
    noEveryday: string;
    noHard: string;
    workType: string;
    priority: string;
    comparison: (provider: string | null, delta: string, cheaper: boolean) => string;
    answer: (model: string, price: string) => string;
    answerNone: string;
    updatedAt: (time: string) => string;
    detailsFor: (model: string) => string;
    showPreview: string;
    currentTitle: string;
    currentSame: (model: string) => string;
    currentSamePrice: (price: string) => string;
    currentNoSeller: (model: string) => string;
    currentNoEvidence: (model: string) => string;
    currentNoPrice: (model: string) => string;
    currentUnknown: string;
    showConfig: string;
    whyThis: string;
    theEvidence: (value: string, metric: string, harness: string, when: string) => string;
    aaSource: string;
    aaDisclaimer: string;
    whoIs: (provider: string) => string;
    profileKnown: (country: string, gdpr: string) => string;
    profileUnknown: string;
    geoNote: string;
    directoryLink: string;
    priceChecked: (when: string) => string;
    verifiedWith: (version: string) => string;
    priceSource: string;
    modelPage: string;
    monthlyTotal: string;
    notAvailable: string;
    gdprYes: string;
    gdprNo: string;
    gdprUnknown: string;
    countryUnknown: string;
  };
  priorities: Record<string, string>;
  tasks: Record<string, string>;
  usability: { hub: string; hubNote: string; direct: string; reseller: (p: string) => string; unknown: string };
  reasons: Record<ReasonCode, string>;
  engine: {
    everydayCheapest: (value: string, metric: string, gate: string, price: string) => string;
    everydayBalanced: (value: string, metric: string, gate: string, price: string) => string;
    everydayBest: (value: string, metric: string, price: string) => string;
    hardReason: (value: string, metric: string, gap: string | null) => string;
    hardWhen: string;
    noWinner: (gate: string) => string;
    noBackup: (points: string) => string;
    noBackupBest: string;
    provisionalCrossHarness: string;
    provisionalStale: (days: string) => string;
    provisionalFee: string;
    provisionalCacheAssumption: string;
    provisionalSingle: string;
    provisionalUnidentified: string;
    savingsNoPrice: string;
    savingsNote: string;
    cacheReadAssumption: string;
    cacheWriteAssumption: string;
    feeOpenRouter: string;
    pinNote: (provider: string) => string;
    cannotPin: (provider: string) => string;
  };
  changes: {
    newPick: string;
    modelChanged: (model: string, provider: string) => string;
    providerChanged: (provider: string, price: string) => string;
    priceMoved: (down: boolean, from: string, to: string) => string;
    unchanged: string;
  };
  costLines: { input: string; output: string; cacheRead: string; cacheWrite: string };
  method: {
    title: string;
    intro: string;
    stepsTitle: string;
    steps: string[];
    gatesTitle: string;
    gatesCols: [string, string, string, string];
    gatesNote: (gap: string) => string;
    capNote: (mean: string, models: string, months: string) => string;
    capMissing: string;
    costTitle: string;
    costCols: [string, string, string, string];
    costNote: string;
    rulesTitle: string;
    rules: string[];
    excludedTitle: string;
    excluded: (t: { offerHours: string; uptime: string; jump: string }) => string[];
    limitsTitle: string;
    limits: string[];
    fullDetails: string;
  };
  sources: { title: string; cols: [string, string, string, string, string]; active: string; failed: string; never: string };
  status: {
    title: string;
    ok: (when: string) => string;
    problems: (when: string) => string;
    notPublished: string;
    never: string;
    next: (when: string) => string;
    models: string;
    offers: string;
    evidence: string;
    sourcesTitle: string;
    cols: [string, string, string];
    fresh: string;
    reused: (hours: string) => string;
    failed: string;
    technical: (n: number) => string;
  };
}

const it: Catalog = {
  htmlLang: 'it',
  notFound: {
    title: 'Pagina non trovata',
    message: 'Questo indirizzo non esiste. Forse il link è vecchio o contiene un errore di battitura.',
    back: 'Vai alla scelta di oggi',
  },
  siteTagline: 'Il modello giusto. Il provider più conveniente.',
  siteDescription:
    'Quale modello AI usare oggi per programmare, quale tenere per i problemi difficili e da quale provider conviene comprarlo. Prezzi verificati ogni giorno.',
  nav: { choice: 'Scelta', method: 'Metodo', sources: 'Fonti', status: 'Stato', code: 'Codice', otherLang: 'EN', otherLangCode: 'en' },
  home: {
    title: 'Che modello usi oggi',
    pricesVerified: (w) => `Prezzi verificati il ${w}`,
    noData: 'Non è ancora stato pubblicato nessun aggiornamento verificato.',
    stale: 'Questi dati non sono stati verificati oggi: la data reale è qui sopra.',
    everyday: '🟢 Ogni giorno',
    hard: '🟠 Per i problemi difficili',
    perMonth: (a) => `${a} stimati al mese a consumo`,
    benchmark: (v, m, w) => `${m} ${v} · letto il ${w}`,
    replaced: (o, n) => `${o} è stato ritirato dal produttore. La versione nuova, ${n}, non è ancora misurata sul codice da Artificial Analysis: per questo non possiamo ancora confrontarla.`,
    inherited: (f) => `Punteggio provvisorio: Artificial Analysis non ha ancora misurato questa versione sul codice, quindi usiamo quello di ${f}, la versione precedente. Nel 95% dei casi misurati la versione nuova è stata almeno altrettanto buona.`,
    effort: (l) => `sforzo ${l}`,
    perTask: (u) => `${u} USD per task`,
    successor: (n) => `È uscito ${n}: Artificial Analysis non l'ha ancora misurato sul codice, per questo non possiamo confrontarlo.`,
    incompleteEstimate:
      'Stima incompleta: una commissione applicabile non è quantificabile, il confronto fra provider vicini può ribaltarsi.',
    getKey: (a) => `Prendi la chiave su ${a}`,
    open: 'Apri',
    copy: 'Copia',
    copyCommand: 'Copia comando',
    copied: 'Copiato',
    copyBlocked: 'Non è stato possibile copiare: il testo è selezionato, copialo a mano.',
    copyConfig: 'Copia configurazione',
    saveConfig: (p) => `Salva opencode.json con ${p} fissato`,
    whereToBuy: 'Dove comprarlo',
    otherProviders: (n) => `Altri ${n} provider`,
    key: 'chiave',
    noEveryday:
      'Nessun modello supera la soglia di qualità con un prezzo verificato. Preferiamo non indicare un vincitore piuttosto che indicarne uno senza prove.',
    noHard: 'Nessun modello risolve abbastanza più problemi da giustificarne un secondo.',
    workType: 'Tipo di lavoro',
    priority: 'Cosa conta di più',
    comparison: (p, d, cheaper) =>
      `Confronto con il <strong>prezzo più basso monitorato</strong> per il modello che hai indicato${p ? ` (${p})` : ''}, non con quello che paghi tu: <strong>${d} al mese in ${cheaper ? 'meno' : 'più'}</strong> sugli stessi consumi.`,
    answer: (m, p) => `Oggi usa ${m}, ${p} al mese.`,
    answerNone: 'Oggi non possiamo indicare un vincitore: le prove disponibili non bastano.',
    updatedAt: (t2) => `aggiornato alle ${t2}`,
    detailsFor: (m) => `Comandi, provider e prezzi per ${m}`,
    showPreview: 'Vedi il testo',
    currentTitle: 'Il modello che usi oggi',
    currentSame: (m) => `Stai già usando il modello che consigliamo: ${m}.`,
    currentSamePrice: (p) => `Qui sotto trovi il provider più economico che lo vende: ${p} al mese sugli stessi consumi.`,
    currentNoSeller: (m) => `Nessun provider monitorato vende ${m} in questo momento, quindi non possiamo confrontarne il prezzo.`,
    currentNoEvidence: (m) => `Di ${m} non abbiamo una misura di qualità degli ultimi 7 giorni: possiamo mostrarne il prezzo, ma non metterlo a confronto con i modelli consigliati.`,
    currentNoPrice: (m) => `Per ${m} nessuna offerta monitorata ha un prezzo completo per questo scenario: un prezzo mancante non lo trattiamo come zero, quindi non calcoliamo il confronto.`,
    currentUnknown: 'Il modello indicato non è fra quelli che monitoriamo.',
    showConfig: 'Mostra quello che copi',
    whyThis: 'Perché proprio questo',
    theEvidence: (v, m, h, w) => `<strong>La prova.</strong> ${v} su ${m} (${h}), indice letto il ${w}.`,
    evidenceNoDate:
      'Artificial Analysis non pubblica la data in cui esegue la misura: quella indicata è la data in cui abbiamo letto il suo indice.',
    // Wording required verbatim by the Artificial Analysis terms (section 5.1).
    aaSource: 'Source: Artificial Analysis (artificialanalysis.ai)',
    aaDisclaimer:
      'Punteggi di qualità: Source: Artificial Analysis (artificialanalysis.ai). La scelta di modello e provider è di ModelPick e non rappresenta il punto di vista di Artificial Analysis, che non l\'ha verificata né approvata.',
    whoIs: (p) => `Chi è ${p}.`,
    profileKnown: (c, g) => `Sede ${c}, GDPR ${g}`,
    profileUnknown:
      'Nessuna directory curata che leggiamo elenca questo provider: oltre al prezzo non abbiamo elementi per descriverlo.',
    geoNote: 'La disponibilità per paese non è pubblicata in forma strutturata da nessuna fonte che leggiamo.',
    directoryLink: 'Scheda nella directory Infrabase',
    priceChecked: (w) => `Prezzo verificato il ${w}.`,
    verifiedWith: (v) => `Comando verificato con OpenCode ${v}.`,
    priceSource: 'Fonte del prezzo',
    modelPage: 'Pagina del modello',
    monthlyTotal: 'Totale stimato al mese',
    notAvailable: 'non disponibile',
    gdprYes: 'dichiarato conforme',
    gdprNo: 'non dichiarato conforme',
    gdprUnknown: 'non valutato',
    countryUnknown: 'non dichiarata',
  },
  priorities: { cheap: 'Spendere poco', balanced: 'Equilibrio', quality: 'Risultati migliori' },
  tasks: {
    'small-changes': 'Piccole modifiche',
    bug: 'Correzione di bug',
    'new-features': 'Nuove funzionalità',
    refactoring: 'Refactoring',
    analysis: 'Analisi di un progetto',
  },
  usability: {
    hub: 'via OpenRouter',
    hubNote: 'Compri da OpenRouter con la sua chiave: basta quella, non serve un account con il provider che esegue il modello.',
    direct: 'diretto',
    reseller: (p) => `account ${p}`,
    unknown: 'provider non identificato',
  },
  reasons: {
    'no-tools': 'il modello non supporta gli strumenti',
    'model-context': 'contesto del modello insufficiente per questa attività',
    'no-seller': 'nessun provider monitorato vende questo modello',
    'not-comparable': 'misurato solo con banchi di prova non confrontabili con quello di riferimento',
    'stale-evidence': 'nessuna misura di qualità degli ultimi 7 giorni',
    'no-usable-offer': 'nessuna offerta utilizzabile',
    'over-price-cap': 'costa troppo rispetto alla media',
    demo: 'dato dimostrativo',
    quarantine: 'prezzo in quarantena per variazione anomala',
    suspended: 'provider sospeso: non risulta possibile aprire un account',
    'stale-price': 'prezzo non verificato di recente',
    'offer-no-tools': 'non supporta gli strumenti richiesti da un agente di codice',
    'offer-context': 'contesto insufficiente per questa attività',
    'offer-uptime': 'disponibilità recente troppo bassa',
    'incomplete-prices': 'prezzi incompleti per questo scenario',
    'plan-based': 'offerta gratuita o inclusa in un piano: nessun prezzo per token pubblicato da confrontare',
    'opencode-unknown': 'OpenCode non riconosce questo modello presso questo provider',
  },
  engine: {
    everydayBalanced: (v, m, g, p) =>
      `Ottiene ${v} su ${m}, il punteggio più alto fra i modelli sopra la soglia di ${g} che costano al massimo il doppio del più economico (${p} al mese sullo scenario scelto).`,
    everydayCheapest: (v, m, g, p) =>
      `Ottiene ${v} su ${m}, sopra la soglia di ${g} richiesta per questa priorità, ed è la combinazione modello-provider meno costosa fra quelle che ci riescono (${p} al mese sullo scenario scelto).`,
    everydayBest: (v, m, p) =>
      `È il punteggio più alto fra i modelli misurati nelle stesse condizioni (${v} su ${m}), e fra quelli che stanno in questa fascia è il meno costoso: ${p} al mese sullo scenario scelto.`,
    hardReason: (v, m, gap) =>
      `Ottiene ${v} su ${m}${gap ? `, ${gap} punti sopra il modello quotidiano, misurati nelle stesse condizioni` : ''}: la capacità superiore è documentata, non dedotta dal prezzo.`,
    hardWhen:
      'Tienilo per i bug che non si riproducono, i refactoring su molti file e il codice che il modello di ogni giorno continua a sbagliare.',
    noWinner: (g) =>
      `Nessun modello supera la soglia di qualità di ${g} con un provider identificabile: non assegniamo un vincitore.`,
    noBackup: (p) =>
      `Nessun modello documenta una capacità superiore di almeno ${p} punti rispetto al quotidiano: preferiamo non indicare un backup piuttosto che indicarne uno senza prove.`,
    noBackupBest:
      'Fra i modelli con prove confrontabili, quello di ogni giorno è già il più capace: non abbiamo prove sufficienti per consigliarne un secondo.',
    provisionalCrossHarness: 'la prova disponibile viene da un banco di prova diverso da quello di riferimento',
    provisionalStale: (d) => `la misura di qualità ha più di ${d} giorni`,
    provisionalFee: 'una commissione applicabile non è quantificabile automaticamente',
    provisionalCacheAssumption: "il costo usa un'ipotesi prudenziale sui prezzi di cache non pubblicati",
    provisionalSingle: 'un solo provider monitorato soddisfa i requisiti',
    provisionalUnidentified: 'nessun provider identificabile vende questo modello',
    savingsNoPrice: 'Non abbiamo un prezzo verificato per il modello indicato, quindi non calcoliamo un confronto.',
    savingsNote:
      'Confronto fra il prezzo più basso che monitoriamo per il tuo modello e quello consigliato, sugli stessi consumi. Non sappiamo quanto paghi davvero: indicaci il tuo provider per un confronto reale.',
    cacheReadAssumption:
      'Questo provider non pubblica un prezzo per la lettura della cache: quei token sono conteggiati al prezzo di input.',
    cacheWriteAssumption:
      'Questo provider non pubblica un prezzo per la scrittura della cache: quei token sono conteggiati al prezzo di input.',
    feeOpenRouter:
      'Commissione OpenRouter sull\'acquisto dei crediti: 5,5% con carta (minimo 0,80 USD per ricarica), 5% con cripto. I prezzi per token passano invariati',
    pinNote: () =>
      'Senza questa configurazione OpenRouter può instradare la richiesta su un altro provider, a un prezzo diverso da quello indicato.',
    cannotPin: (p) =>
      `OpenRouter sceglie il provider al momento della richiesta e non possiamo fissare ${p}: il prezzo effettivo può differire.`,
  },
  changes: {
    newPick: "Nuova raccomandazione: nell'aggiornamento precedente non ce n'era una.",
    modelChanged: (m, p) => `Modello cambiato: prima consigliavamo ${m} da ${p}.`,
    providerChanged: (p, price) => `Provider cambiato: il più economico era ${p} a ${price} al mese.`,
    priceMoved: (down, f, t) => `Prezzo ${down ? 'sceso' : 'salito'} da ${f} a ${t} al mese.`,
    unchanged: "Invariato rispetto all'aggiornamento precedente.",
  },
  costLines: { input: 'Input', output: 'Output', cacheRead: 'Lettura cache', cacheWrite: 'Scrittura cache' },
  method: {
    title: 'Come scegliamo',
    intro: 'Ogni mattina alle 6:30 ripetiamo questi passi con prezzi e punteggi appena scaricati.',
    stepsTitle: 'In quattro passi',
    steps: [
      '<strong>Qualità.</strong> Contano solo i modelli con un Coding Index di Artificial Analysis misurato negli ultimi 7 giorni.',
      '<strong>Soglia.</strong> Il modello deve superare la soglia di qualità della priorità che hai scelto.',
      '<strong>Tetto di prezzo.</strong> Non deve costare per task più di un multiplo della media del mercato: 1,25 volte con "Spendere poco" ed "Equilibrio", 5 volte con "Risultati migliori".',
      '<strong>Scelta.</strong> Con "Spendere poco" vince il più economico al mese. Con "Equilibrio" vince il punteggio più alto fra i modelli che costano al massimo il doppio del più economico. Con "Risultati migliori" vince il punteggio più alto, e il prezzo decide solo fra modelli entro 2 punti.',
    ],
    gatesTitle: 'Soglie e tetti',
    gatesCols: ['Priorità', 'Ogni giorno', 'Problemi difficili', 'Tetto per task'],
    gatesNote: (g) => `Punteggio minimo sul Coding Index. Il modello per i problemi difficili deve anche fare almeno ${g} punti più di quello di ogni giorno: se nessuno ci riesce, non lo indichiamo.`,
    capNote: (m, n, mo) => `Tetto per task: multiplo della media di ${m} USD per task, calcolata ogni giorno su ${n} varianti di modelli usciti negli ultimi ${mo} mesi (costo misurato da Artificial Analysis). Un modello di cui AA non pubblica il costo per task non può superare lo stesso multiplo della spesa mensile media dei candidati.`,
    capMissing: 'Oggi il costo medio per task non è disponibile: il tetto non viene applicato.',
    costTitle: 'Il costo al mese',
    costCols: ['Tipo di lavoro', 'Input', 'Output', 'Dalla cache'],
    costNote: "Token al mese per una persona che usa un agente di codice ogni giorno. Sono ipotesi dichiarate, non misure dei tuoi consumi. Un prezzo mancante non diventa mai zero: se manca il prezzo della cache, quei token costano come l'input.",
    rulesTitle: 'Tre regole per non promettere troppo',
    rules: [
      '<strong>Lo sforzo di ragionamento che puoi davvero usare.</strong> Lo stesso modello fa punteggi e costi diversi a seconda dello sforzo (per esempio high o xhigh). Contiamo solo quello che la configurazione può impostare: con l\'API diretta di OpenAI lo scriviamo nella configurazione; con quella di Anthropic vale "high", il predefinito di OpenCode; altrove non si può scegliere, quindi contiamo il punteggio più basso misurato.',
      '<strong>Modelli ritirati mai.</strong> Se il produttore ritira un modello non lo mostriamo più, neanche nelle versioni datate o nelle varianti dei rivenditori.',
      '<strong>Versioni nuove non ancora misurate.</strong> Se Artificial Analysis non ha ancora misurato sul codice una versione nuova, ma il suo Intelligence Index è almeno pari a quello della versione precedente, usiamo il Coding Index della versione precedente e lo segnaliamo come provvisorio. Sui casi misurati, la versione nuova è stata almeno altrettanto buona 95 volte su 100.',
    ],
    excludedTitle: "Quando un'offerta è esclusa",
    excluded: (t) => [
      'Il produttore ha ritirato il modello.',
      'Costa più del tetto per task della priorità scelta.',
      `Il prezzo ha più di ${t.offerHours} ore.`,
      `Il provider è stato disponibile meno del ${t.uptime} delle volte nell'ultima mezz'ora.`,
      'Il contesto è troppo piccolo per il tipo di lavoro scelto.',
      'OpenCode non riconosce la coppia modello-provider: il comando non partirebbe.',
      `Il prezzo è cambiato più di ${t.jump} volte dall'aggiornamento precedente: resta in attesa di conferma.`,
    ],
    limitsTitle: 'Limiti',
    limits: [
      'Copriamo i provider raggiunti dalle nostre fonti, non tutto il mercato.',
      'Un benchmark misura compiti standard: è un indizio serio, non una garanzia sul tuo codice.',
      'Il costo per task di Artificial Analysis viene dai loro test, ai prezzi del produttore: serve a confrontare i modelli fra loro, non a prevedere la tua bolletta.',
      'OpenCode non passa da solo al modello per i problemi difficili: va scelto a mano con /models.',
    ],
    fullDetails: 'Tutti i dettagli, comprese le regole per associare i modelli, in METHODOLOGY.md',
  },
  sources: {
    title: 'Fonti',
    cols: ['Fonte', 'Stato', 'Licenza o condizioni', 'Nota', 'Righe'],
    active: 'attiva',
    failed: 'errore nell\'ultimo aggiornamento',
    never: 'mai eseguita',
  },
  status: {
    title: 'Stato degli aggiornamenti',
    ok: (w) => `Aggiornato il ${w}`,
    problems: (w) => `Ultimo aggiornamento con problemi: ${w}`,
    notPublished: "I nuovi dati non sono stati pubblicati: resta valido l'aggiornamento precedente.",
    never: 'Nessun aggiornamento ancora eseguito.',
    next: (w) => `Prossimo aggiornamento: ${w}`,
    models: 'modelli',
    offers: 'offerte',
    evidence: 'punteggi di qualità',
    sourcesTitle: 'Fonti',
    cols: ['Fonte', 'Esito', 'Righe'],
    fresh: 'aggiornata',
    reused: (h) => `dati di ${h} ore fa`,
    failed: 'non raggiungibile',
    technical: (n) => `Dettagli tecnici (${n}, in inglese)`,
  },
};

const en: Catalog = {
  htmlLang: 'en',
  notFound: {
    title: 'Page not found',
    message: 'This address does not exist. The link may be old or contain a typo.',
    back: "Go to today's pick",
  },
  siteTagline: 'The right model. The cheapest provider.',
  siteDescription:
    'Which AI model to use for coding today, which one to keep for hard problems, and the cheapest provider selling it. Prices checked every day.',
  nav: { choice: 'Pick', method: 'Method', sources: 'Sources', status: 'Status', code: 'Code', otherLang: 'IT', otherLangCode: 'it' },
  home: {
    title: 'Which model to use today',
    pricesVerified: (w) => `Prices checked on ${w}`,
    noData: 'No verified update has been published yet.',
    stale: 'This data was not checked today: the real date is above.',
    everyday: '🟢 Every day',
    hard: '🟠 For hard problems',
    perMonth: (a) => `${a} estimated per month, pay as you go`,
    benchmark: (v, m, w) => `${m} ${v} · read on ${w}`,
    replaced: (o, n) => `${o} has been retired by its maker. Its newer version, ${n}, is not yet measured on code by Artificial Analysis, so we cannot compare it yet.`,
    inherited: (f) => `Provisional score: Artificial Analysis has not measured this version on code yet, so we use the one of ${f}, the previous version. In 95% of measured cases the newer version was at least as good.`,
    effort: (l) => `${l} effort`,
    perTask: (u) => `${u} USD per task`,
    successor: (n) => `${n} is out: Artificial Analysis has not measured it on code yet, so we cannot compare it.`,
    incompleteEstimate:
      'Incomplete estimate: one applicable fee cannot be quantified, so a close call between providers could flip.',
    getKey: (a) => `Get your key from ${a}`,
    open: 'Open',
    copy: 'Copy',
    copyCommand: 'Copy command',
    copied: 'Copied',
    copyBlocked: 'Could not copy: the text is selected, copy it by hand.',
    copyConfig: 'Copy config',
    saveConfig: (p) => `Save opencode.json pinning ${p}`,
    whereToBuy: 'Where to buy it',
    otherProviders: (n) => `${n} more providers`,
    key: 'key',
    noEveryday:
      'No model clears the quality bar with a verified price. We would rather name no winner than name one without evidence.',
    noHard: 'No model solves enough additional problems to justify a second one.',
    workType: 'Kind of work',
    priority: 'What matters most',
    comparison: (p, d, cheaper) =>
      `Compared with the <strong>lowest price we track</strong> for the model you named${p ? ` (${p})` : ''}, not with what you actually pay: <strong>${d} per month ${cheaper ? 'less' : 'more'}</strong> on the same usage.`,
    answer: (m, p) => `Today use ${m}, ${p} per month.`,
    answerNone: 'We cannot name a winner today: the available evidence is not enough.',
    updatedAt: (t2) => `updated at ${t2}`,
    detailsFor: (m) => `Commands, providers and prices for ${m}`,
    showPreview: 'See the text',
    currentTitle: 'The model you use today',
    currentSame: (m) => `You are already using the model we recommend: ${m}.`,
    currentSamePrice: (p) => `Below is the cheapest provider selling it: ${p} per month on the same usage.`,
    currentNoSeller: (m) => `No monitored provider sells ${m} right now, so we cannot compare its price.`,
    currentNoEvidence: (m) => `We have no quality measurement from the last 7 days for ${m}: we can show its price, but not compare it with the recommended models.`,
    currentNoPrice: (m) => `No monitored offer for ${m} has a complete price for this scenario: we never treat a missing price as zero, so we do not compute the comparison.`,
    currentUnknown: 'The model you named is not one we monitor.',
    showConfig: 'Show what you are copying',
    whyThis: 'Why this one',
    theEvidence: (v, m, h, w) => `<strong>The evidence.</strong> ${v} on ${m} (${h}), index read on ${w}.`,
    evidenceNoDate:
      'Artificial Analysis does not publish when it runs the measurement: the date shown is the date we read its index.',
    aaSource: 'Source: Artificial Analysis (artificialanalysis.ai)',
    aaDisclaimer:
      'Quality scores: Source: Artificial Analysis (artificialanalysis.ai). The model and provider picks are made by ModelPick and do not represent the views of Artificial Analysis, which has not reviewed or endorsed them.',
    whoIs: (p) => `Who ${p} is.`,
    profileKnown: (c, g) => `Headquarters ${c}, GDPR ${g}`,
    profileUnknown:
      'No curated directory we read lists this provider: beyond its price we have nothing to tell you about it.',
    geoNote: 'No source we read publishes country availability in structured form.',
    directoryLink: 'Entry in the Infrabase directory',
    priceChecked: (w) => `Price checked on ${w}.`,
    verifiedWith: (v) => `Command verified against OpenCode ${v}.`,
    priceSource: 'Price source',
    modelPage: 'Model page',
    monthlyTotal: 'Estimated monthly total',
    notAvailable: 'not available',
    gdprYes: 'stated as compliant',
    gdprNo: 'not stated as compliant',
    gdprUnknown: 'not assessed',
    countryUnknown: 'not stated',
  },
  priorities: { cheap: 'Spend less', balanced: 'Balanced', quality: 'Best results' },
  tasks: {
    'small-changes': 'Small edits',
    bug: 'Bug fixing',
    'new-features': 'New features',
    refactoring: 'Refactoring',
    analysis: 'Understanding a codebase',
  },
  usability: {
    hub: 'via OpenRouter',
    hubNote: 'You buy from OpenRouter with its key: that is all you need, no account with the provider running the model.',
    direct: 'direct',
    reseller: (p) => `${p} account`,
    unknown: 'unidentified provider',
  },
  reasons: {
    'no-tools': 'the model does not support tool calling',
    'model-context': 'the model context is too small for this kind of work',
    'no-seller': 'no monitored provider sells this model',
    'not-comparable': 'only measured on benchmarks not comparable with the reference one',
    'stale-evidence': 'no quality measurement from the last 7 days',
    'no-usable-offer': 'no usable offer',
    'over-price-cap': 'too expensive compared with the average',
    demo: 'demo data',
    quarantine: 'price quarantined after an implausible change',
    suspended: 'provider suspended: an account could not be opened',
    'stale-price': 'price not checked recently',
    'offer-no-tools': 'does not support the tools a coding agent needs',
    'offer-context': 'context too small for this kind of work',
    'offer-uptime': 'recent availability too low',
    'incomplete-prices': 'prices incomplete for this scenario',
    'plan-based': 'free tier or bundled plan: no per-token price published to compare',
    'opencode-unknown': 'OpenCode does not recognise this model at this provider',
  },
  engine: {
    everydayBalanced: (v, m, g, p) =>
      `Scores ${v} on ${m}, the highest among the models above the ${g} bar that cost at most twice the cheapest one (${p} per month on the chosen scenario).`,
    everydayCheapest: (v, m, g, p) =>
      `Scores ${v} on ${m}, above the ${g} bar set by this priority, and it is the cheapest model-provider pair that clears it (${p} per month on the chosen scenario).`,
    everydayBest: (v, m, p) =>
      `It has the highest score among models measured under identical conditions (${v} on ${m}), and it is the cheapest of those in that band: ${p} per month on the chosen scenario.`,
    hardReason: (v, m, gap) =>
      `Scores ${v} on ${m}${gap ? `, ${gap} points above the everyday model, measured under identical conditions` : ''}: the extra capability is documented, not inferred from the price.`,
    hardWhen:
      'Keep it for bugs that will not reproduce, refactors spanning many files, and code the everyday model keeps getting wrong.',
    noWinner: (g) => `No model clears the ${g} quality bar with an identifiable provider: we name no winner.`,
    noBackup: (p) =>
      `No model documents at least ${p} points more capability than the everyday pick: we would rather name no backup than one without evidence.`,
    noBackupBest:
      'Among models with comparable evidence, the everyday pick is already the most capable: we have no grounds to recommend a second one.',
    provisionalCrossHarness: 'the available measurement comes from a different harness than the reference one',
    provisionalStale: (d) => `the quality measurement is more than ${d} days old`,
    provisionalFee: 'one applicable fee cannot be quantified automatically',
    provisionalCacheAssumption: 'the cost relies on a conservative assumption about unpublished cache prices',
    provisionalSingle: 'only one monitored provider meets the requirements',
    provisionalUnidentified: 'no identifiable provider sells this model',
    savingsNoPrice: 'We have no verified price for that model, so we do not compute a comparison.',
    savingsNote:
      'A comparison between the lowest price we track for your model and the recommended one, on the same usage. We do not know what you actually pay: tell us your provider for a real comparison.',
    cacheReadAssumption:
      'This provider publishes no cache read price: those tokens are billed at the input price.',
    cacheWriteAssumption:
      'This provider publishes no cache write price: those tokens are billed at the input price.',
    feeOpenRouter:
      "OpenRouter's fee on buying credits: 5.5% by card (0.80 USD minimum per top-up), 5% by crypto. Per-token prices are passed through unchanged",
    pinNote: () =>
      'Without this config OpenRouter may route the request to a different provider, at a different price.',
    cannotPin: (p) =>
      `OpenRouter picks the provider at request time and we cannot pin ${p}: the price you pay may differ.`,
  },
  changes: {
    newPick: 'New recommendation: the previous update had none.',
    modelChanged: (m, p) => `Model changed: we previously recommended ${m} from ${p}.`,
    providerChanged: (p, price) => `Provider changed: the cheapest was ${p} at ${price} per month.`,
    priceMoved: (down, f, t) => `Price ${down ? 'down' : 'up'} from ${f} to ${t} per month.`,
    unchanged: 'Unchanged since the previous update.',
  },
  costLines: { input: 'Input', output: 'Output', cacheRead: 'Cache read', cacheWrite: 'Cache write' },
  method: {
    title: 'How we choose',
    intro: 'Every morning at 6:30 (Rome time) we repeat these steps on freshly downloaded prices and scores.',
    stepsTitle: 'In four steps',
    steps: [
      '<strong>Quality.</strong> Only models with an Artificial Analysis Coding Index measured in the last 7 days count.',
      '<strong>Bar.</strong> The model must clear the quality bar of the priority you chose.',
      '<strong>Price cap.</strong> It must not cost more per task than a multiple of the market average: 1.25 times with "Spend less" and "Balanced", 5 times with "Best results".',
      '<strong>Choice.</strong> With "Spend less" the cheapest per month wins. With "Balanced" the highest score wins among the models costing at most twice the cheapest. With "Best results" the highest score wins, and price only decides between models within 2 points.',
    ],
    gatesTitle: 'Bars and caps',
    gatesCols: ['Priority', 'Every day', 'Hard problems', 'Cap per task'],
    gatesNote: (g) => `Minimum Coding Index score. The model for hard problems must also score at least ${g} points above the everyday one: if none does, we name none.`,
    capNote: (m, n, mo) => `Cap per task: a multiple of the mean of ${m} USD per task, recomputed every day over ${n} variants of models released in the last ${mo} months (cost measured by Artificial Analysis). A model whose cost per task AA does not publish cannot exceed the same multiple of the candidates' mean monthly spend.`,
    capMissing: 'The mean cost per task is not available today: no cap is applied.',
    costTitle: 'The monthly cost',
    costCols: ['Kind of work', 'Input', 'Output', 'From cache'],
    costNote: 'Tokens per month for one person using a coding agent every day. They are stated assumptions, not measurements of your usage. A missing price never becomes zero: if the cache price is missing, those tokens cost as much as input.',
    rulesTitle: 'Three rules so we do not overpromise',
    rules: [
      '<strong>The reasoning effort you can actually use.</strong> The same model scores and costs differently depending on its effort (for example high or xhigh). We only count what the configuration can set: with OpenAI\'s own API we write it into the configuration; with Anthropic\'s it is "high", OpenCode\'s default; elsewhere it cannot be chosen, so we count the lowest measured score.',
      '<strong>Never retired models.</strong> When the maker retires a model we no longer show it, nor its dated builds or resellers\' variants.',
      '<strong>New versions not measured yet.</strong> If Artificial Analysis has not measured a new version on code yet, but its Intelligence Index is at least that of the previous version, we use the previous version\'s Coding Index and flag it as provisional. Across measured cases, the new version was at least as good 95 times out of 100.',
    ],
    excludedTitle: 'When an offer is excluded',
    excluded: (t) => [
      'The maker has retired the model.',
      'It costs more than the cap per task of the chosen priority.',
      `The price is more than ${t.offerHours} hours old.`,
      `The provider was available less than ${t.uptime} of the time in the last half hour.`,
      'The context is too small for the chosen kind of work.',
      'OpenCode does not recognise the model-provider pair: the command would not start.',
      `The price changed more than ${t.jump} times since the previous update: it waits for confirmation.`,
    ],
    limitsTitle: 'Limits',
    limits: [
      'We cover the providers our sources reach, not the whole market.',
      'A benchmark measures standard tasks: a serious signal, not a guarantee about your code.',
      "Artificial Analysis' cost per task comes from their own runs at the maker's prices: it compares models with each other, it does not predict your bill.",
      'OpenCode does not switch to the model for hard problems on its own: pick it by hand with /models.',
    ],
    fullDetails: 'All the details, including how models are matched, in METHODOLOGY.md',
  },
  sources: {
    title: 'Sources',
    cols: ['Source', 'State', 'Licence or terms', 'Note', 'Rows'],
    active: 'active',
    failed: 'failed in the last update',
    never: 'never run',
  },
  status: {
    title: 'Update status',
    ok: (w) => `Updated on ${w}`,
    problems: (w) => `Last update had problems: ${w}`,
    notPublished: 'The new data was not published: the previous update is still in use.',
    never: 'No update has run yet.',
    next: (w) => `Next update: ${w}`,
    models: 'models',
    offers: 'offers',
    evidence: 'quality scores',
    sourcesTitle: 'Sources',
    cols: ['Source', 'Result', 'Rows'],
    fresh: 'updated',
    reused: (h) => `data from ${h} hours ago`,
    failed: 'unreachable',
    technical: (n) => `Technical details (${n})`,
  },
};

const CATALOGS: Record<Lang, Catalog> = { it, en };

export const t = (lang: Lang): Catalog => CATALOGS[lang] ?? CATALOGS[DEFAULT_LANG];
export const isLang = (v: string | undefined): v is Lang => v === 'it' || v === 'en';

export type Page = 'home' | 'method' | 'sources' | 'status';

/** Italian pages live at the root with Italian slugs, English under /en. */
const PATHS_BY_LANG: Record<Lang, Record<Page, string>> = {
  it: { home: '/', method: '/metodo', sources: '/fonti', status: '/stato' },
  en: { home: '/en', method: '/en/method', sources: '/en/sources', status: '/en/status' },
};

export const pagePath = (lang: Lang, page: Page): string => PATHS_BY_LANG[lang][page];
export const otherLang = (lang: Lang): Lang => (lang === 'it' ? 'en' : 'it');
