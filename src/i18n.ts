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
    alternative: (name: string, score: string, price: string) => string;
    provisionalShort: string;
    usage: (rate: string) => string;
    opencodeSource: string;
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
    runCommand: string;
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
    costCols: [string, string, string, string];
    costNote: string;
    guaranteesTitle: string;
    guarantees: string[];
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
    alternative: (n, s, p) => `Alternativa molto vicina: ${n}, Coding Index ${s}, ${p} al mese.`,
    provisionalShort: 'provvisorio',
    opencodeSource: 'Source: OpenCode (opencode.ai/data)',
    usage: (r) => `${r}% degli utenti di OpenCode lo usa ancora la settimana dopo`,
    successor: (n) => `È uscito ${n}: Artificial Analysis non l'ha ancora misurato sul codice, per questo non possiamo confrontarlo.`,
    incompleteEstimate:
      'Stima incompleta: una commissione applicabile non è quantificabile, il confronto fra provider vicini può ribaltarsi.',
    getKey: (a) => `Crea un account su ${a} e una chiave API: è lì che paghi.`,
    exportKey: 'Mettila nel terminale, prima di avviare OpenCode:',
    stepsIntro: (s, m) => `Ti servono due cose: OpenCode, il programma con cui scrivi codice insieme al modello, e un account su ${s}, che ti vende l'uso di ${m} e te lo fa pagare.`,
    savePinned: (r, p) => `Salva questa configurazione come opencode.json nella cartella del progetto. Dice a ${r} di usare sempre ${p}, il provider con il prezzo che vedi: senza, ${r} può sceglierne un altro, a un altro prezzo.`,
    saveEffort: (e) => `Salva questa configurazione come opencode.json nella cartella del progetto. Imposta lo sforzo di ragionamento "${e}", quello con cui è stato misurato il punteggio.`,
    runCommand: 'Avvia OpenCode con questo modello:',
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
    everydayReason: (v, m, b, p) =>
      `Ottiene ${v} su ${m}: il punteggio più alto fra i modelli che costano al massimo ${b} al mese (questo costa ${p} sullo scenario scelto).`,
    usageReason: (v, m, b, p, pts, r) =>
      `Ottiene ${v} su ${m}, entro ${pts} punti dal migliore fra i modelli che costano al massimo ${b} al mese: a quella distanza i benchmark non li separano, e il ${r}% degli utenti di OpenCode lo usa ancora la settimana dopo, più degli altri. Costa ${p}.`,
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
    rule: 'Per ogni priorità c\'è un budget al mese. Nel budget vince il modello con il Coding Index più alto di Artificial Analysis. Se un altro modello è entro 3 punti, i benchmark non bastano a separarli: vince quello che gli utenti di OpenCode continuano a usare di più la settimana dopo (senza questo dato, entro 1 punto vince il più economico). Il modello per i problemi difficili si sceglie allo stesso modo con il budget più alto, e lo indichiamo solo se fa meglio di quello di ogni giorno. Se il secondo classificato nello stesso budget è entro 3 punti, lo mostriamo come alternativa.',
    budgetCols: ['Priorità', 'Ogni giorno', 'Problemi difficili'],
    budgetNote: 'Budget in USD al mese, sul tipo di lavoro che hai scelto.',
    costTitle: 'Come stimiamo il costo al mese',
    costCols: ['Tipo di lavoro', 'Input', 'Output', 'Dalla cache'],
    costNote: "Token al mese per una persona che usa un agente di codice ogni giorno, moltiplicati per il prezzo del provider, commissioni incluse. Sono ipotesi dichiarate, non misure dei tuoi consumi. Un prezzo mancante non diventa mai zero: se manca quello della cache, quei token costano come l'input.",
    guaranteesTitle: 'Cosa garantiamo',
    guarantees: [
      '<strong>Punteggi recenti.</strong> Contano solo misure degli ultimi 7 giorni, anche per i dati d\'uso di OpenCode.',
      '<strong>Niente modelli ritirati.</strong> Se il produttore ritira un modello non lo mostriamo più, neanche nelle versioni datate o nelle varianti dei rivenditori.',
      '<strong>Il punteggio che otterrai davvero.</strong> Lo stesso modello rende in modo diverso a seconda dello sforzo di ragionamento. Contiamo solo quello che puoi impostare: con l\'API diretta di OpenAI lo scriviamo nella configurazione, con quella di Anthropic vale "high", il predefinito di OpenCode; altrove contiamo il punteggio più basso misurato.',
      '<strong>Versioni nuove.</strong> Se una versione nuova non è ancora misurata sul codice, ma il suo Intelligence Index è almeno pari a quello della precedente, usa il punteggio della precedente, segnalato come provvisorio. Sui casi misurati la versione nuova è stata almeno altrettanto buona 95 volte su 100.',
    ],
    excludedTitle: "Quando un'offerta è esclusa",
    excluded: (t) => [
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
    alternative: (n, s, p) => `A very close alternative: ${n}, Coding Index ${s}, ${p} per month.`,
    provisionalShort: 'provisional',
    opencodeSource: 'Source: OpenCode (opencode.ai/data)',
    usage: (r) => `${r}% of OpenCode users still use it the following week`,
    successor: (n) => `${n} is out: Artificial Analysis has not measured it on code yet, so we cannot compare it.`,
    incompleteEstimate:
      'Incomplete estimate: one applicable fee cannot be quantified, so a close call between providers could flip.',
    getKey: (a) => `Create an account on ${a} and an API key: that is who bills you.`,
    exportKey: 'Put it in your terminal before starting OpenCode:',
    stepsIntro: (s, m) => `You need two things: OpenCode, the program you write code with together with the model, and an account on ${s}, which sells you the use of ${m} and bills you for it.`,
    savePinned: (r, p) => `Save this configuration as opencode.json in the project folder. It tells ${r} to always use ${p}, the provider with the price you see: without it, ${r} may pick another one, at another price.`,
    saveEffort: (e) => `Save this configuration as opencode.json in the project folder. It sets the reasoning effort to "${e}", the one the score was measured with.`,
    runCommand: 'Start OpenCode with this model:',
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
    everydayReason: (v, m, b, p) =>
      `Scores ${v} on ${m}: the highest score among the models costing at most ${b} per month (this one costs ${p} on the chosen scenario).`,
    usageReason: (v, m, b, p, pts, r) =>
      `Scores ${v} on ${m}, within ${pts} points of the best among the models costing at most ${b} per month: at that distance benchmarks do not separate them, and ${r}% of OpenCode users still use it the following week, more than the others. It costs ${p}.`,
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
    rule: 'Each priority has a monthly budget. Within the budget, the model with the highest Artificial Analysis Coding Index wins. If another model is within 3 points, benchmarks cannot separate them: the one OpenCode users keep using most the following week wins (without that figure, within 1 point the cheaper one wins). The model for hard problems is chosen the same way with the larger budget, and we only name it if it does better than the everyday one. If the runner-up in the same budget is within 3 points, we show it as an alternative.',
    budgetCols: ['Priority', 'Every day', 'Hard problems'],
    budgetNote: 'Budgets in USD per month, on the kind of work you chose.',
    costTitle: 'How we estimate the monthly cost',
    costCols: ['Kind of work', 'Input', 'Output', 'From cache'],
    costNote: "Tokens per month for one person using a coding agent every day, times the provider's price, fees included. They are stated assumptions, not measurements of your usage. A missing price never becomes zero: if the cache price is missing, those tokens cost as much as input.",
    guaranteesTitle: 'What we guarantee',
    guarantees: [
      '<strong>Recent scores.</strong> Only measurements from the last 7 days count, OpenCode usage figures included.',
      '<strong>No retired models.</strong> When the maker retires a model we no longer show it, nor its dated builds or resellers\' variants.',
      '<strong>The score you will actually get.</strong> The same model performs differently depending on its reasoning effort. We only count what you can set: with OpenAI\'s own API we write it into the configuration, with Anthropic\'s it is "high", OpenCode\'s default; elsewhere we count the lowest measured score.',
      '<strong>New versions.</strong> If a new version is not yet measured on code, but its Intelligence Index is at least that of the previous one, it uses the previous one\'s score, flagged as provisional. Across measured cases the new version was at least as good 95 times out of 100.',
    ],
    excludedTitle: 'When an offer is excluded',
    excluded: (t) => [
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
