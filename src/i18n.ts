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
  | 'cloud-account'
  | 'demo'
  | 'quarantine'
  | 'suspended'
  | 'stale-price'
  | 'offer-no-tools'
  | 'offer-context'
  | 'offer-uptime'
  | 'incomplete-prices'
  | 'plan-based'
  | 'capped-plan'
  | 'opencode-unknown';

export interface Catalog {
  notFound: { title: string; message: string; back: string };
  htmlLang: string;
  siteDescription: string;
  siteTagline: string;
  nav: { choice: string; method: string; go: string; goShort: string; sources: string; status: string; code: string; otherLang: string; otherLangCode: string };
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
    alternative: (name: string, score: string, price: string) => string;
    provisionalShort: string;
    usage: (rate: string) => string;
    opencodeSource: string;
    sessionCost: (usd: string) => string;
    inherited: (from: string) => string;
    effort: (level: string) => string;
    replaced: (retired: string, successor: string) => string;
    getKey: (account: string) => string;
    open: string;
    copy: string;
    copyCommand: string;
    copied: string;
    copyBlocked: string;
    copyConfig: string;
    exportKey: string;
    stepsIntro: (seller: string, model: string) => string;
    savePinned: (router: string, provider: string) => string;
    saveEffort: (effort: string) => string;
    saveCustom: (provider: string) => string;
    runCommand: string;
    orQuick: string;
    privacyOff: (router: string) => string;
    privacyOn: (router: string, provider: string) => string;
    privacyEnable: string;
    privacyDisable: string;
    quickPinLost: (router: string) => string;
    quickEffortLost: string;
    downloadFile: string;
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
    everydayReason: (value: string, metric: string, budget: string, price: string) => string;
    hardReason: (value: string, metric: string, gap: string, budget: string, price: string) => string;
    usageReason: (value: string, metric: string, budget: string, price: string, points: string, rate: string) => string;
    closeCheaper: (value: string, metric: string, budget: string, price: string, points: string, top: string) => string;
    hardWhen: string;
    noWinner: (budget: string) => string;
    noBackup: (budget: string) => string;
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
    ruleTitle: string;
    rule: string;
    budgetCols: [string, string, string];
    budgetNote: string;
    costTitle: string;
    costCols: [string, string, string, string, string];
    costNote: string;
    guaranteesTitle: string;
    guarantees: string[];
    excludedTitle: string;
    excluded: (t: { offerHours: string; uptime: string; uptimeDay: string; jump: string }) => string[];
    limitsTitle: string;
    limits: string[];
    fullDetails: string;
  };
  go: {
    title: string;
    description: string;
    intro: (fee: string) => string;
    answer: (task: string, n: string, total: string) => string;
    answerBest: (model: string, score: string, go: string, direct: string, provider: string) => string;
    answerNone: string;
    cols: [string, string, string, string, string, string, string, string];
    allowanceUsed: (pct: string, cap: string) => string;
    covers: (pct: string) => string;
    goCheaper: (amount: string) => string;
    directCheaper: (amount: string) => string;
    even: string;
    range: (from: string, to: string) => string;
    rangeOpen: (from: string) => string;
    never: string;
    noDirect: string;
    unmeasured: string;
    retentionZero: string;
    retentionDays: (n: string) => string;
    retentionUnknown: string;
    training: string;
    zdrUntil: (date: string) => string;
    zdrEnded: (date: string) => string;
    peak: string;
    overageList: string;
    howTitle: string;
    how: (five: string, week: string) => string[];
    setup: string;
    source: (date: string) => string;
    stale: (days: string) => string;
    noPlan: string;
    unusableTitle: (n: number) => string;
    homeLink: string;
    homeHint: (model: string, go: string, covered: string) => string;
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
  nav: { choice: 'Scelta', method: 'Metodo', go: 'OpenCode Go', goShort: 'Go', sources: 'Fonti', status: 'Stato', code: 'Codice', otherLang: 'EN', otherLangCode: 'en' },
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
    inherited: (f) => `Punteggio provvisorio: Artificial Analysis non ha ancora misurato questa versione sul codice, quindi usiamo quello di ${f}, la versione precedente. In passato la versione nuova è stata almeno altrettanto buona in 67 casi su 71, ma non è una garanzia.`,
    effort: (l) => `sforzo ${l}`,
    alternative: (n, s, p) => `Alternativa molto vicina: ${n}, Coding Index ${s}, ${p} al mese.`,
    provisionalShort: 'provvisorio',
    opencodeSource: 'Source: OpenCode (opencode.ai/data)',
    sessionCost: (u) => `nell'uso reale su OpenCode costa in media ${u} USD a sessione`,
    usage: (r) => `${r}% degli utenti di OpenCode lo usa ancora la settimana dopo`,
    successor: (n) => `È uscito ${n}: Artificial Analysis non l'ha ancora misurato sul codice, per questo non possiamo confrontarlo.`,
    incompleteEstimate:
      'Stima incompleta: una commissione applicabile non è quantificabile, il confronto fra provider vicini può ribaltarsi.',
    getKey: (a) => `Crea un account su ${a} e una chiave API: è lì che paghi.`,
    exportKey: 'Mettila nel terminale, prima di avviare OpenCode:',
    stepsIntro: (s, m) => `Ti servono due cose: OpenCode, il programma con cui scrivi codice insieme al modello, e un account su ${s}, che ti vende l'uso di ${m} e te lo fa pagare.`,
    savePinned: (r, p) => `Salva questa configurazione come opencode.json nella cartella del progetto: dice a ${r} di usare sempre ${p}, il provider del prezzo indicato.`,
    saveCustom: (p) => `Salva questa configurazione come opencode.json nella cartella del progetto: aggiunge ${p} a OpenCode, che non lo conosce di serie. Senza il file il comando non funziona.`,
    saveEffort: (e) => `Salva questa configurazione come opencode.json nella cartella del progetto. Imposta lo sforzo di ragionamento "${e}", quello con cui è stato misurato il punteggio.`,
    runCommand: 'Avvia OpenCode con questo modello:',
    orQuick: 'Oppure avvia subito OpenCode con questo modello, senza file:',
    privacyOff: (r) => `Non vuoi che il tuo codice venga conservato? Con la privacy attiva ${r} usa solo provider che non conservano quello che invii; il prezzo può cambiare.`,
    privacyOn: (r, p) => `Privacy attiva: ${r} usa solo provider che non conservano quello che invii. Se ${p} non lo garantisce, passa a un altro, e il prezzo può essere diverso da quello indicato.`,
    privacyEnable: 'Attiva la privacy',
    privacyDisable: 'Disattiva la privacy',
    quickPinLost: (r) => `Senza il file ${r} sceglie il provider da solo: il prezzo può essere diverso da quello indicato.`,
    quickEffortLost: 'Senza il file resta lo sforzo di ragionamento predefinito, non quello del punteggio indicato.',
    downloadFile: 'Scarica opencode.json',
    open: 'Apri',
    copy: 'Copia',
    copyCommand: 'Copia comando',
    copied: 'Copiato',
    copyBlocked: 'Non è stato possibile copiare: il testo è selezionato, copialo a mano.',
    copyConfig: 'Copia configurazione',
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
    'cloud-account': 'serve un account su una piattaforma cloud',
    demo: 'dato dimostrativo',
    quarantine: 'prezzo in quarantena per variazione anomala',
    suspended: 'provider sospeso: non risulta possibile aprire un account',
    'stale-price': 'prezzo non verificato di recente',
    'offer-no-tools': 'non supporta gli strumenti richiesti da un agente di codice',
    'offer-context': 'contesto insufficiente per questa attività',
    'offer-uptime': 'disponibilità recente troppo bassa',
    'incomplete-prices': 'prezzi incompleti per questo scenario',
    'plan-based': 'offerta gratuita o inclusa in un piano: nessun prezzo per token pubblicato da confrontare',
    'capped-plan': 'inclusa in un abbonamento con tetto (OpenCode Go): confrontata nella sua pagina, non come prezzo a consumo',
    'opencode-unknown': 'OpenCode non riconosce questo modello presso questo provider',
  },
  engine: {
    everydayReason: (v, m, b, p) =>
      `Ottiene ${v} su ${m}: il punteggio più alto fra i modelli che costano al massimo ${b} al mese (questo costa ${p} sullo scenario scelto).`,
    usageReason: (v, m, b, p, pts, r) =>
      `Ottiene ${v} su ${m}, entro ${pts} punti dal migliore fra i modelli che costano al massimo ${b} al mese: li consideriamo abbastanza vicini da far decidere l'uso, e il ${r}% degli utenti di OpenCode lo usa ancora la settimana dopo, più degli altri. Costa ${p}.`,
    closeCheaper: (v, m, b, p, pts, t) =>
      `Ottiene ${v} su ${m}, entro ${pts} punti dal migliore (${t}) fra i modelli che costano al massimo ${b} al mese: li consideriamo abbastanza vicini, e questo costa meno (${p}).`,
    hardReason: (v, m, gap, b, p) =>
      `Ottiene ${v} su ${m}, ${gap} punti più del modello di ogni giorno: il punteggio più alto fra i modelli che costano al massimo ${b} al mese (questo costa ${p}).`,
    hardWhen:
      'Tienilo per i bug che non si riproducono, i refactoring su molti file e il codice che il modello di ogni giorno continua a sbagliare.',
    noWinner: (b) => `Nessun modello misurato costa meno di ${b} al mese con un provider identificabile: non assegniamo un vincitore.`,
    noBackup: (b) => `Entro ${b} al mese nessun modello fa meglio di quello di ogni giorno: non serve un secondo modello.`,
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
    intro: 'Ogni mattina alle 6:30 ripetiamo la scelta con prezzi e punteggi appena scaricati.',
    ruleTitle: 'La regola',
    rule: 'Per ogni priorità c\'è un budget al mese. Nel budget guardiamo il Coding Index di Artificial Analysis: i modelli entro 3 punti dal migliore li consideriamo abbastanza vicini, ed è una scelta nostra, non una misura dell\'incertezza. Fra questi vince quello che gli utenti di OpenCode continuano a usare di più la settimana dopo (a parità, il più economico); se il dato d\'uso manca, vince il più economico. Il modello per i problemi difficili si sceglie allo stesso modo con il budget più alto, e lo indichiamo solo se fa più di 3 punti in più. Se il secondo classificato è entro 3 punti, lo mostriamo come alternativa.',
    budgetCols: ['Priorità', 'Ogni giorno', 'Problemi difficili'],
    budgetNote: 'Budget in USD al mese per la Correzione di bug. Per gli altri tipi di lavoro cresce in proporzione ai token: vedi la colonna «Budget» nella tabella accanto.',
    costTitle: 'Come stimiamo il costo al mese',
    costCols: ['Tipo di lavoro', 'Input', 'Output', 'Dalla cache', 'Budget'],
    costNote: "Token al mese per una persona che usa un agente di codice ogni giorno, moltiplicati per il prezzo del provider, commissioni incluse. Sono ipotesi dichiarate, non misure dei tuoi consumi, e sono le stesse per tutti i modelli: chi ragiona a lungo può consumare di più e costare più della stima. La colonna «Budget» dice quanto costa quel lavoro rispetto alla Correzione di bug, come mediana delle offerte di oggi. Un prezzo mancante non diventa mai zero: se manca quello della cache, quei token costano come l'input.",
    guaranteesTitle: 'Cosa garantiamo',
    guarantees: [
      '<strong>Dati recenti.</strong> Contano solo dati letti negli ultimi 7 giorni, anche quelli d\'uso di OpenCode. Artificial Analysis non pubblica quando ha fatto una prova: la data è quella in cui leggiamo il punteggio.',
      '<strong>Niente modelli ritirati.</strong> Se il produttore ritira un modello non lo mostriamo più, neanche nelle versioni datate o nelle varianti dei rivenditori.',
      '<strong>La stessa configurazione che è stata misurata.</strong> Lo stesso modello rende in modo diverso a seconda dello sforzo di ragionamento. Contiamo solo quello che puoi impostare, senza poter garantire il risultato sul tuo progetto: con l\'API diretta di OpenAI lo scriviamo nella configurazione, con quella di Anthropic vale "high", il predefinito di OpenCode; altrove contiamo il punteggio più basso misurato.',
      '<strong>Versioni nuove.</strong> Se una versione nuova non è ancora misurata sul codice, ma il suo Intelligence Index è almeno pari a quello della precedente, usa il punteggio della precedente, segnalato come provvisorio. Nei 71 casi storici la versione nuova è stata almeno altrettanto buona 67 volte: è un dato del passato, non una garanzia per la prossima. L\'elenco è pubblicato.',
    ],
    excludedTitle: "Quando un'offerta è esclusa",
    excluded: (t) => [
      `Il prezzo ha più di ${t.offerHours} ore.`,
      `Il provider è stato disponibile meno del ${t.uptime} nell'ultima mezz'ora, o meno del ${t.uptimeDay} nell'ultimo giorno. Chi vende direttamente spesso non lo pubblica: in quel caso il dato manca, non lo consideriamo buono.`,
      'Si compra direttamente da una piattaforma cloud (Amazon Bedrock, Google Vertex, Azure): servono un account cloud e permessi in più. Passando da OpenRouter invece l\'account è OpenRouter.',
      'Il contesto è troppo piccolo per il tipo di lavoro scelto.',
      'OpenCode non riconosce la coppia modello-provider: il comando non partirebbe. Fa eccezione SiliconFlow, che OpenCode non ha di serie: lo aggiunge la configurazione che pubblichiamo.',
      `Il prezzo è cambiato più di ${t.jump} volte dall'aggiornamento precedente: resta in attesa di conferma.`,
    ],
    limitsTitle: 'Limiti',
    limits: [
      'Copriamo i provider raggiunti dalle nostre fonti, non tutto il mercato.',
      'Un benchmark misura compiti standard: è un indizio serio, non una garanzia sul tuo codice.',
      'Tutti i punteggi vengono da Artificial Analysis: gli altri benchmark che conosciamo pubblicano misure vecchie di mesi.',
      'OpenRouter non pubblica quali provider conservano i dati inviati. Nella scheda puoi attivare la privacy: la configurazione chiede a OpenRouter di usare solo provider che non li conservano, e se quello indicato non lo garantisce ne sceglie un altro, anche a un prezzo diverso. Di base è spenta. Per gli acquisti diretti vale la politica del venditore.',
      'OpenCode non passa da solo al modello per i problemi difficili: va scelto a mano con /models.',
    ],
    fullDetails: 'Tutti i dettagli, comprese le regole per associare i modelli, in METHODOLOGY.md',
  },
  go: {
    title: 'OpenCode Go o pagare a consumo?',
    description: "Quanto costa lo stesso mese di lavoro con l'abbonamento OpenCode Go e con il provider più economico, modello per modello.",
    intro: (fee) =>
      `OpenCode Go costa ${fee} al mese e dà a ogni modello un tetto mensile, contato ai prezzi di listino di Go: 15, 30 o 60 USD a seconda del modello. Qui confrontiamo lo stesso mese di lavoro su Go e presso il provider più economico che monitoriamo.`,
    answer: (task, n, total) => `Per ${task}, Go costa meno del provider più economico per ${n} dei ${total} modelli che include.`,
    answerBest: (m, sc, go, d, p) => `Il suo miglior modello misurato, ${m} (${sc}), costa ${go} al mese su Go contro ${d} da ${p}.`,
    answerNone: 'Nessun modello di Go è utilizzabile con i dati di oggi.',
    cols: ['Modello', 'Coding Index', 'Tetto usato', 'Su Go', 'Provider più economico', 'Differenza', 'Go conviene fra', 'Dati'],
    allowanceUsed: (pct, cap) => `${pct} di ${cap}`,
    covers: (pct) => `il tetto copre il ${pct} del mese`,
    goCheaper: (a) => `Go −${a}`,
    directCheaper: (a) => `provider −${a}`,
    even: 'pari',
    range: (f, t) => `${f} e ${t} al mese dal provider`,
    rangeOpen: (f) => `oltre ${f} al mese dal provider`,
    never: 'mai, per questo tipo di lavoro',
    noDirect: 'nessun provider utilizzabile',
    unmeasured: 'non misurato',
    retentionZero: 'nessuna conservazione',
    retentionDays: (n) => `conservati ${n} giorni`,
    retentionUnknown: 'conservati',
    training: 'usati per addestrare',
    zdrUntil: (d) => `accordo di conservazione zero fino al ${d}`,
    zdrEnded: (d) => `accordo di conservazione zero scaduto il ${d}: rinnovo non confermato`,
    peak: 'prezzi delle ore di punta',
    overageList: 'oltre il tetto: prezzo di listino di Go (nessun prezzo a consumo trovato)',
    howTitle: 'Come leggerla',
    how: (five, week) => [
      '«Tetto usato» è quanto del tetto mensile del modello si consuma con questo mese di lavoro. Oltre il 100% Go si ferma, a meno di attivare «Use balance»: allora il resto si paga ai prezzi a consumo di OpenCode Zen, ed è l\'importo che mostriamo.',
      '«Go conviene fra» è la spesa mensile presso il provider più economico per cui Go costa meno, per lavoro dello stesso tipo in qualsiasi quantità. Sotto il limite inferiore il canone non si ripaga; sopra quello superiore il tetto è finito e il consumo costa più del provider.',
      'La documentazione indica il tetto per ogni modello. Non dice esplicitamente se due modelli usati nello stesso mese hanno ciascuno il proprio tetto: ogni riga ipotizza un solo modello.',
      `In 5 ore si può usare al massimo il ${five}% del tetto mensile, in una settimana il ${week}%: una giornata intensa incontra il limite delle 5 ore molto prima di quello mensile.`,
      'I modelli DeepSeek costano di più nelle ore di punta (01–04 e 06–10 UTC, dal lunedì al venerdì): contiamo il tetto a quei prezzi, un limite superiore.',
      'Alcuni modelli costano di più oltre una certa lunghezza di contesto (per esempio Grok oltre 200K token): come in tutto il sito, usiamo il prezzo base.',
      'Un solo abbonato per workspace, e Go è pensato per il traffico di un agente di codice: non è un modo per far girare le chiamate API di una propria applicazione.',
    ],
    setup: 'Per usarlo: in OpenCode esegui /connect, scegli OpenCode Go e incolla la chiave della console. I modelli si chiamano opencode-go/<id>.',
    source: (d) => `Condizioni lette dalla documentazione di OpenCode Go il ${d}.`,
    stale: (n) => `Queste condizioni sono state lette ${n} giorni fa e potrebbero essere cambiate.`,
    noPlan: "I dati del piano non sono ancora pubblicati: arrivano con il prossimo aggiornamento quotidiano.",
    unusableTitle: (n) => `Modelli di Go esclusi oggi (${n})`,
    homeLink: "Stai valutando OpenCode Go? Confronta l'abbonamento con i prezzi a consumo",
    homeHint: (m, go, cov) => `${m} è incluso anche in OpenCode Go: ${go} al mese per questo lavoro, con il tetto che copre il ${cov} del mese.`,
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
  nav: { choice: 'Pick', method: 'Method', go: 'OpenCode Go', goShort: 'Go', sources: 'Sources', status: 'Status', code: 'Code', otherLang: 'IT', otherLangCode: 'it' },
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
    inherited: (f) => `Provisional score: Artificial Analysis has not measured this version on code yet, so we use the one of ${f}, the previous version. In the past the newer version was at least as good in 67 cases out of 71, but that is no guarantee.`,
    effort: (l) => `${l} effort`,
    alternative: (n, s, p) => `A very close alternative: ${n}, Coding Index ${s}, ${p} per month.`,
    provisionalShort: 'provisional',
    opencodeSource: 'Source: OpenCode (opencode.ai/data)',
    sessionCost: (u) => `in real use on OpenCode it costs ${u} USD per session on average`,
    usage: (r) => `${r}% of OpenCode users still use it the following week`,
    successor: (n) => `${n} is out: Artificial Analysis has not measured it on code yet, so we cannot compare it.`,
    incompleteEstimate:
      'Incomplete estimate: one applicable fee cannot be quantified, so a close call between providers could flip.',
    getKey: (a) => `Create an account on ${a} and an API key: that is who bills you.`,
    exportKey: 'Put it in your terminal before starting OpenCode:',
    stepsIntro: (s, m) => `You need two things: OpenCode, the program you write code with together with the model, and an account on ${s}, which sells you the use of ${m} and bills you for it.`,
    savePinned: (r, p) => `Save this configuration as opencode.json in the project folder: it tells ${r} to always use ${p}, the provider of the price shown.`,
    saveCustom: (p) => `Save this configuration as opencode.json in the project folder: it adds ${p} to OpenCode, which does not ship with it. Without the file the command does not work.`,
    saveEffort: (e) => `Save this configuration as opencode.json in the project folder. It sets the reasoning effort to "${e}", the one the score was measured with.`,
    runCommand: 'Start OpenCode with this model:',
    orQuick: 'Or start OpenCode with this model right away, no file:',
    privacyOff: (r) => `Do not want your code retained? With privacy on, ${r} only uses providers that do not retain what you send; the price may change.`,
    privacyOn: (r, p) => `Privacy on: ${r} only uses providers that do not retain what you send. If ${p} does not guarantee it, it moves to another one, and the price may differ from the one shown.`,
    privacyEnable: 'Turn privacy on',
    privacyDisable: 'Turn privacy off',
    quickPinLost: (r) => `Without the file ${r} picks the provider itself: the price may differ from the one shown.`,
    quickEffortLost: 'Without the file the default reasoning effort applies, not the one the score was measured with.',
    downloadFile: 'Download opencode.json',
    open: 'Open',
    copy: 'Copy',
    copyCommand: 'Copy command',
    copied: 'Copied',
    copyBlocked: 'Could not copy: the text is selected, copy it by hand.',
    copyConfig: 'Copy config',
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
    'cloud-account': 'needs an account on a cloud platform',
    demo: 'demo data',
    quarantine: 'price quarantined after an implausible change',
    suspended: 'provider suspended: an account could not be opened',
    'stale-price': 'price not checked recently',
    'offer-no-tools': 'does not support the tools a coding agent needs',
    'offer-context': 'context too small for this kind of work',
    'offer-uptime': 'recent availability too low',
    'incomplete-prices': 'prices incomplete for this scenario',
    'plan-based': 'free tier or bundled plan: no per-token price published to compare',
    'capped-plan': 'part of a capped subscription (OpenCode Go): compared on its own page, not as a pay-per-token price',
    'opencode-unknown': 'OpenCode does not recognise this model at this provider',
  },
  engine: {
    everydayReason: (v, m, b, p) =>
      `Scores ${v} on ${m}: the highest score among the models costing at most ${b} per month (this one costs ${p} on the chosen scenario).`,
    usageReason: (v, m, b, p, pts, r) =>
      `Scores ${v} on ${m}, within ${pts} points of the best among the models costing at most ${b} per month: we consider them close enough for usage to decide, and ${r}% of OpenCode users still use it the following week, more than the others. It costs ${p}.`,
    closeCheaper: (v, m, b, p, pts, t) =>
      `Scores ${v} on ${m}, within ${pts} points of the best (${t}) among the models costing at most ${b} per month: we consider them close enough, and this one costs less (${p}).`,
    hardReason: (v, m, gap, b, p) =>
      `Scores ${v} on ${m}, ${gap} points above the everyday model: the highest score among the models costing at most ${b} per month (this one costs ${p}).`,
    hardWhen:
      'Keep it for bugs that will not reproduce, refactors spanning many files, and code the everyday model keeps getting wrong.',
    noWinner: (b) => `No measured model costs less than ${b} per month with an identifiable provider: we name no winner.`,
    noBackup: (b) => `Within ${b} per month no model does better than the everyday one: there is no need for a second model.`,
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
    intro: 'Every morning at 6:30 (Rome time) we repeat the choice on freshly downloaded prices and scores.',
    ruleTitle: 'The rule',
    rule: 'Each priority has a monthly budget. Within it we look at the Artificial Analysis Coding Index: models within 3 points of the best are treated as close enough, a choice of ours rather than a measure of uncertainty. Among them, the one OpenCode users keep using most the following week wins (the cheaper on a tie); without usage figures, the cheapest wins. The model for hard problems is chosen the same way with the larger budget, and named only if it scores more than 3 points higher. If the runner-up is within 3 points, we show it as an alternative.',
    budgetCols: ['Priority', 'Every day', 'Hard problems'],
    budgetNote: 'Budgets in USD per month for bug fixing. For other kinds of work they grow with the tokens: see the «Budget» column in the table alongside.',
    costTitle: 'How we estimate the monthly cost',
    costCols: ['Kind of work', 'Input', 'Output', 'From cache', 'Budget'],
    costNote: "Tokens per month for one person using a coding agent every day, times the provider's price, fees included. They are stated assumptions, not measurements of your usage, and they are the same for every model: one that reasons at length may use more and cost more than the estimate. The «Budget» column says how much that work costs compared with bug fixing, as the median of today's offers. A missing price never becomes zero: if the cache price is missing, those tokens cost as much as input.",
    guaranteesTitle: 'What we guarantee',
    guarantees: [
      '<strong>Recent data.</strong> Only data read in the last 7 days counts, OpenCode usage figures included. Artificial Analysis does not publish when it ran a test: the date is when we read the score.',
      '<strong>No retired models.</strong> When the maker retires a model we no longer show it, nor its dated builds or resellers\' variants.',
      '<strong>The configuration that was measured.</strong> The same model performs differently depending on its reasoning effort. We only count what you can set, without being able to guarantee the result on your project: with OpenAI\'s own API we write it into the configuration, with Anthropic\'s it is "high", OpenCode\'s default; elsewhere we count the lowest measured score.',
      '<strong>New versions.</strong> If a new version is not yet measured on code, but its Intelligence Index is at least that of the previous one, it uses the previous one\'s score, flagged as provisional. In 71 past cases the new version was at least as good 67 times: a fact about the past, not a guarantee for the next one. The list is published.',
    ],
    excludedTitle: 'When an offer is excluded',
    excluded: (t) => [
      `The price is more than ${t.offerHours} hours old.`,
      `The provider was available less than ${t.uptime} in the last half hour, or less than ${t.uptimeDay} over the last day. Direct sellers often do not publish it: then the figure is missing, and we do not treat it as good.`,
      'It is bought straight from a cloud platform (Amazon Bedrock, Google Vertex, Azure): that needs a cloud account and extra permissions. Through OpenRouter the account is OpenRouter\'s.',
      'The context is too small for the chosen kind of work.',
      'OpenCode does not recognise the model-provider pair: the command would not start. SiliconFlow is the exception: OpenCode does not ship with it, and the configuration we publish adds it.',
      `The price changed more than ${t.jump} times since the previous update: it waits for confirmation.`,
    ],
    limitsTitle: 'Limits',
    limits: [
      'We cover the providers our sources reach, not the whole market.',
      'A benchmark measures standard tasks: a serious signal, not a guarantee about your code.',
      'Every score comes from Artificial Analysis: the other benchmarks we know publish measurements that are months old.',
      'OpenRouter does not publish which providers retain what you send. On the card you can turn privacy on: the configuration asks OpenRouter to use only providers that do not retain it, and if the one shown does not guarantee that it picks another, possibly at another price. It is off by default. For direct purchases the seller\'s own policy applies.',
      'OpenCode does not switch to the model for hard problems on its own: pick it by hand with /models.',
    ],
    fullDetails: 'All the details, including how models are matched, in METHODOLOGY.md',
  },
  go: {
    title: 'OpenCode Go or pay per token?',
    description: 'What the same month of work costs on the OpenCode Go subscription and at the cheapest provider, model by model.',
    intro: (fee) =>
      `OpenCode Go costs ${fee} a month and gives each model a monthly allowance, counted at Go's own list prices: 15, 30 or 60 USD depending on the model. Here the same month of work is priced on Go and at the cheapest provider we track.`,
    answer: (task, n, total) => `For ${task}, Go costs less than the cheapest provider for ${n} of the ${total} models it includes.`,
    answerBest: (m, sc, go, d, p) => `Its best measured model, ${m} (${sc}), costs ${go} a month on Go against ${d} at ${p}.`,
    answerNone: 'No Go model is usable with today\'s data.',
    cols: ['Model', 'Coding Index', 'Allowance used', 'On Go', 'Cheapest provider', 'Difference', 'Go pays off between', 'Data'],
    allowanceUsed: (pct, cap) => `${pct} of ${cap}`,
    covers: (pct) => `allowance covers ${pct} of the month`,
    goCheaper: (a) => `Go −${a}`,
    directCheaper: (a) => `provider −${a}`,
    even: 'even',
    range: (f, t) => `${f} and ${t} a month at the provider`,
    rangeOpen: (f) => `above ${f} a month at the provider`,
    never: 'never, for this kind of work',
    noDirect: 'no usable provider',
    unmeasured: 'not measured',
    retentionZero: 'not retained',
    retentionDays: (n) => `kept ${n} days`,
    retentionUnknown: 'retained',
    training: 'used for training',
    zdrUntil: (d) => `zero-retention agreement until ${d}`,
    zdrEnded: (d) => `zero-retention agreement ended on ${d}: renewal not confirmed`,
    peak: 'busy-hour prices',
    overageList: "beyond the allowance: Go's own list price (no pay-as-you-go price found)",
    howTitle: 'How to read it',
    how: (five, week) => [
      '"Allowance used" is how much of the model\'s monthly allowance this month of work takes. Past 100% Go stops unless "Use balance" is on: then the rest is billed at OpenCode Zen\'s pay-as-you-go prices, and that is the amount shown.',
      '"Go pays off between" is the monthly spend at the cheapest provider for which Go costs less, for work of the same kind in any quantity. Below the lower end the fee does not pay for itself; above the upper end the allowance is used up and pay-as-you-go costs more than the provider.',
      'The documentation states the allowance per model. It does not say in so many words whether two models used in the same month each have their own: every row assumes a single model.',
      `No more than ${five}% of the monthly allowance in 5 hours and ${week}% in a week: an intense day hits the 5-hour window long before the monthly one.`,
      'DeepSeek models cost more at busy hours (01–04 and 06–10 UTC, Monday to Friday): the allowance is counted at those prices, an upper bound.',
      'Some models cost more beyond a context length (Grok above 200K tokens, for example): as everywhere on this site, the base price is used.',
      'One subscriber per workspace, and Go is meant for coding-agent traffic: it is not a way to run your own application\'s API calls.',
    ],
    setup: 'To use it: in OpenCode run /connect, choose OpenCode Go and paste the key from the console. Models are called opencode-go/<id>.',
    source: (d) => `Terms read from the OpenCode Go documentation on ${d}.`,
    stale: (n) => `These terms were read ${n} days ago and may have changed.`,
    noPlan: 'Plan data is not published yet: it arrives with the next daily update.',
    unusableTitle: (n) => `Go models left out today (${n})`,
    homeLink: 'Thinking about OpenCode Go? Compare the subscription with pay-per-token prices',
    homeHint: (m, go, cov) => `${m} is also in OpenCode Go: ${go} a month for this work, with the allowance covering ${cov} of the month.`,
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

export type Page = 'home' | 'method' | 'go' | 'sources' | 'status';

/** Italian pages live at the root with Italian slugs, English under /en. */
const PATHS_BY_LANG: Record<Lang, Record<Page, string>> = {
  it: { home: '/', method: '/metodo', go: '/go', sources: '/fonti', status: '/stato' },
  en: { home: '/en', method: '/en/method', go: '/en/go', sources: '/en/sources', status: '/en/status' },
};

export const pagePath = (lang: Lang, page: Page): string => PATHS_BY_LANG[lang][page];
export const otherLang = (lang: Lang): Lang => (lang === 'it' ? 'en' : 'it');
