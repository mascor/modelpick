/**
 * Two languages, one catalogue. Sentences the engine composes live here too,
 * as functions, so no user-facing Italian is left hard-coded in the logic.
 */
export type Lang = 'it' | 'en';
export const LANGS: Lang[] = ['it', 'en'];
export const DEFAULT_LANG: Lang = 'it';

/** Reason codes the engine emits instead of prose. */
export type ReasonCode =
  | 'no-tools'
  | 'model-context'
  | 'no-seller'
  | 'not-comparable'
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
  htmlLang: string;
  siteDescription: string;
  nav: { choice: string; method: string; sources: string; status: string; code: string; otherLang: string; otherLangCode: string };
  home: {
    title: string;
    pricesVerified: (when: string) => string;
    noData: string;
    stale: string;
    everyday: string;
    hard: string;
    perMonth: (amount: string) => string;
    benchmark: (value: string, when: string) => string;
    incompleteEstimate: string;
    getKey: (account: string) => string;
    open: string;
    copy: string;
    copyCommand: string;
    copyConfig: string;
    saveConfig: (provider: string) => string;
    whereToBuy: string;
    otherProviders: (n: number) => string;
    key: string;
    noEveryday: string;
    noHard: string;
    customise: string;
    scenarioNote: (input: string, output: string, cache: string) => string;
    workType: string;
    priority: string;
    tokensIn: string;
    tokensOut: string;
    cacheRead: string;
    cacheWrite: string;
    currentModel: string;
    notSet: string;
    defaultValue: string;
    recompute: string;
    comparison: (provider: string | null, delta: string, cheaper: boolean) => string;
    whyThis: string;
    theEvidence: (value: string, metric: string, harness: string, when: string) => string;
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
  usability: { hub: string; direct: string; reseller: (p: string) => string; unknown: string };
  reasons: Record<ReasonCode, string>;
  engine: {
    everydayCheapest: (value: string, metric: string, gate: string, price: string) => string;
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
    orderTitle: string;
    order: string[];
    notTitle: string;
    not: string[];
    thresholdsTitle: string;
    thresholds: [string, string][];
    missingTitle: string;
    missing: string;
    limitsTitle: string;
    limits: string[];
  };
  sources: { title: string; cols: [string, string, string, string, string]; active: string; off: string; failed: string; never: string };
  status: {
    title: string;
    intro: string;
    lastRun: (when: string) => string;
    ok: string;
    problems: string;
    published: string;
    notPublished: string;
    never: string;
    warnings: (n: number) => string;
    dataTitle: string;
    cols: [string, string, string, string, string];
    reused: (age: string) => string;
    duration: (ms: string) => string;
  };
}

const it: Catalog = {
  htmlLang: 'it',
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
    benchmark: (v, w) => `benchmark ${v}`,
    incompleteEstimate:
      'Stima incompleta: una commissione applicabile non è quantificabile, il confronto fra provider vicini può ribaltarsi.',
    getKey: (a) => `Prendi la chiave su ${a}`,
    open: 'Apri',
    copy: 'Copia',
    copyCommand: 'Copia comando',
    copyConfig: 'Copia configurazione',
    saveConfig: (p) => `Salva opencode.json con ${p} fissato`,
    whereToBuy: 'Dove comprarlo',
    otherProviders: (n) => `Altri ${n} provider`,
    key: 'chiave',
    noEveryday:
      'Nessun modello supera la soglia di qualità con un prezzo verificato. Preferiamo non indicare un vincitore piuttosto che indicarne uno senza prove.',
    noHard: 'Nessun modello risolve abbastanza più problemi da giustificarne un secondo.',
    customise: 'Cambia il tipo di lavoro o i tuoi consumi',
    scenarioNote: (i, o, c) =>
      `Di base stimiamo i costi su un mese di lavoro con un agente di codice: ${i} token di input, ${o} di output, ${c} letti dalla cache. È un'ipotesi dichiarata, non una misura dei tuoi consumi.`,
    workType: 'Tipo di lavoro',
    priority: 'Cosa conta di più',
    tokensIn: 'Token di input al mese',
    tokensOut: 'Token di output al mese',
    cacheRead: 'Lettura cache al mese',
    cacheWrite: 'Scrittura cache al mese',
    currentModel: 'Modello che usi oggi',
    notSet: 'Non indicato',
    defaultValue: 'predefinito',
    recompute: 'Ricalcola',
    comparison: (p, d, cheaper) =>
      `Confronto con il <strong>prezzo più basso monitorato</strong> per il modello che hai indicato${p ? ` (${p})` : ''}, non con quello che paghi tu: <strong>${d} al mese in ${cheaper ? 'meno' : 'più'}</strong> sugli stessi consumi.`,
    whyThis: 'Perché proprio questo',
    theEvidence: (v, m, h, w) => `<strong>La prova.</strong> ${v} di problemi risolti su ${m}, misurato con ${h} il ${w}.`,
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
  priorities: { risparmio: 'Spendere poco', equilibrio: 'Equilibrio', qualita: 'Lavorare bene' },
  tasks: {
    'piccole-modifiche': 'Piccole modifiche',
    bug: 'Correzione di bug',
    'nuove-funzionalita': 'Nuove funzionalità',
    refactoring: 'Refactoring',
    analisi: 'Analisi di un progetto',
  },
  usability: {
    hub: 'via OpenRouter',
    direct: 'diretto',
    reseller: (p) => `account ${p}`,
    unknown: 'provider non identificato',
  },
  reasons: {
    'no-tools': 'il modello non supporta gli strumenti',
    'model-context': 'contesto del modello insufficiente per questa attività',
    'no-seller': 'nessun provider monitorato vende questo modello',
    'not-comparable': 'misurato solo con banchi di prova non confrontabili con quello di riferimento',
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
    everydayCheapest: (v, m, g, p) =>
      `Risolve il ${v} dei problemi su ${m}, sopra la soglia di ${g} richiesta per questa priorità, ed è la combinazione modello-provider meno costosa fra quelle che ci riescono (${p} al mese sullo scenario scelto).`,
    everydayBest: (v, m, p) =>
      `È il punteggio più alto fra i modelli misurati nelle stesse condizioni (${v} su ${m}), e fra quelli che stanno in questa fascia è il meno costoso: ${p} al mese sullo scenario scelto.`,
    hardReason: (v, m, gap) =>
      `Risolve il ${v} dei problemi su ${m}${gap ? `, ${gap} punti percentuali sopra il modello quotidiano, misurati nelle stesse condizioni` : ''}: la capacità superiore è documentata, non dedotta dal prezzo.`,
    hardWhen:
      'Tienilo per i bug che non si riproducono, i refactoring su molti file e il codice che il modello di ogni giorno continua a sbagliare.',
    noWinner: (g) =>
      `Nessun modello supera la soglia di qualità di ${g} con un provider identificabile: non assegniamo un vincitore.`,
    noBackup: (p) =>
      `Nessun modello documenta una capacità superiore di almeno ${p} punti rispetto al quotidiano: preferiamo non indicare un backup piuttosto che indicarne uno senza prove.`,
    noBackupBest:
      'Fra i modelli con prove confrontabili, quello di ogni giorno è già il più capace: non abbiamo prove sufficienti per consigliarne un secondo.',
    provisionalCrossHarness: 'la prova disponibile viene da un banco di prova diverso da quello di riferimento',
    provisionalStale: (d) => `la misura ha più di ${d} giorni`,
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
      'OpenRouter applica una commissione sull’acquisto dei crediti (i prezzi per token sono invece passanti)',
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
    title: 'Metodo, soglie e limiti',
    intro:
      'Questa pagina descrive come si arriva alle due raccomandazioni. Se qualcosa qui non ti convince, la scelta giusta è non fidarti del risultato: per questo pubblichiamo tutto.',
    orderTitle: 'Ordine delle decisioni',
    order: [
      '<strong>Prima i modelli.</strong> Consideriamo solo modelli con una misura pubblicata di qualità sul codice, ottenuta nelle stesse condizioni degli altri. Un modello senza prove confrontabili non può vincere.',
      '<strong>La tua scelta cambia che cosa significa "il migliore".</strong> Con "spendere poco" ed "equilibrio" prendiamo il modello meno costoso che supera la soglia di qualità. Con "lavorare bene" prendiamo il punteggio più alto, e il prezzo decide solo fra modelli praticamente pari.',
      '<strong>Poi i provider.</strong> Per ogni modello ammesso cerchiamo tutte le offerte monitorate e teniamo quelle di provider che sappiamo identificare.',
      '<strong>Infine la convenienza.</strong> Ogni offerta viene calcolata per intero, commissioni incluse, sullo stesso scenario di consumo.',
    ],
    notTitle: 'Che cosa non facciamo',
    not: [
      'Non dividiamo il punteggio di qualità per il prezzo: non è una misura di niente.',
      'Non trattiamo la differenza fra due punteggi come una percentuale di qualità.',
      'Non confrontiamo misure ottenute con banchi di prova, versioni o condizioni diverse.',
      'Non equipariamo versioni, quantizzazioni o modalità diverse dello stesso modello.',
      'Non assumiamo che il prezzo di un intermediario valga anche comprando direttamente dal provider.',
      'Non inventiamo consumi, percentuali di cache o tassi di riuscita.',
      'Non chiediamo il paese di utilizzo né requisiti sul trattamento dei dati: nessuna fonte che leggiamo li pubblica in forma strutturata, quindi sarebbero domande senza effetto.',
    ],
    thresholdsTitle: 'Soglie in vigore',
    thresholds: [],
    missingTitle: 'Dati mancanti',
    missing:
      'Un prezzo mancante non diventa mai zero: l\'offerta viene esclusa dal confronto e lo diciamo. Se un provider non pubblica il prezzo della cache, quei token sono conteggiati al prezzo di input, che è un limite superiore, e l\'ipotesi è dichiarata. Se una fonte non risponde, conserviamo l\'ultimo dato valido e ne dichiariamo l\'età. Se le prove non bastano, la raccomandazione è marcata come provvisoria; se non bastano proprio, non assegniamo un vincitore.',
    limitsTitle: 'Limiti dichiarati',
    limits: [
      'Copriamo i provider monitorati dalle fonti abilitate, non tutto il mercato.',
      'Un provider che nessuna directory curata elenca non viene consigliato: resta visibile nel confronto, marcato come non identificato.',
      'Gli scenari di consumo sono ipotesi dichiarate e modificabili, non misure dei tuoi consumi.',
      'I banchi di prova pubblici misurano un agente su compiti standard: sono un indizio serio, non una garanzia sul tuo repository.',
      'OpenCode non passa automaticamente a un modello di riserva: il secondo modello va selezionato a mano.',
    ],
  },
  sources: {
    title: 'Fonti',
    cols: ['Fonte', 'Stato', 'Licenza o condizioni', 'Nota', 'Righe'],
    active: 'attiva',
    off: 'non abilitata',
    failed: 'errore nell\'ultimo aggiornamento',
    never: 'mai eseguita',
  },
  status: {
    title: 'Stato degli aggiornamenti',
    intro: 'L\'aggiornamento gira sul server ogni giorno alle 06:30 (Europe/Rome), indipendentemente dalle visite al sito.',
    lastRun: (w) => `Ultimo tentativo: ${w}`,
    ok: 'riuscito',
    problems: 'con problemi',
    published: 'pubblicato',
    notPublished: 'non pubblicato',
    never: 'Nessun aggiornamento ancora eseguito.',
    warnings: (n) => `Segnalazioni (${n})`,
    dataTitle: 'Dati pubblicati',
    cols: ['Fonte', 'Esito', 'Righe', 'Nota', 'Durata'],
    reused: (a) => `dati riusati, età ${a}`,
    duration: (ms) => `${ms} ms`,
  },
};

const en: Catalog = {
  htmlLang: 'en',
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
    benchmark: (v, w) => `benchmark ${v}`,
    incompleteEstimate:
      'Incomplete estimate: one applicable fee cannot be quantified, so a close call between providers could flip.',
    getKey: (a) => `Get your key from ${a}`,
    open: 'Open',
    copy: 'Copy',
    copyCommand: 'Copy command',
    copyConfig: 'Copy config',
    saveConfig: (p) => `Save opencode.json pinning ${p}`,
    whereToBuy: 'Where to buy it',
    otherProviders: (n) => `${n} more providers`,
    key: 'key',
    noEveryday:
      'No model clears the quality bar with a verified price. We would rather name no winner than name one without evidence.',
    noHard: 'No model solves enough additional problems to justify a second one.',
    customise: 'Change the kind of work or your usage',
    scenarioNote: (i, o, c) =>
      `By default we price a month of work with a coding agent: ${i} input tokens, ${o} output, ${c} read from cache. It is a stated assumption, not a measurement of your usage.`,
    workType: 'Kind of work',
    priority: 'What matters most',
    tokensIn: 'Input tokens per month',
    tokensOut: 'Output tokens per month',
    cacheRead: 'Cache reads per month',
    cacheWrite: 'Cache writes per month',
    currentModel: 'Model you use today',
    notSet: 'Not set',
    defaultValue: 'default',
    recompute: 'Recalculate',
    comparison: (p, d, cheaper) =>
      `Compared with the <strong>lowest price we track</strong> for the model you named${p ? ` (${p})` : ''}, not with what you actually pay: <strong>${d} per month ${cheaper ? 'less' : 'more'}</strong> on the same usage.`,
    whyThis: 'Why this one',
    theEvidence: (v, m, h, w) => `<strong>The evidence.</strong> ${v} of problems solved on ${m}, measured with ${h} on ${w}.`,
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
  priorities: { risparmio: 'Spend less', equilibrio: 'Balanced', qualita: 'Best results' },
  tasks: {
    'piccole-modifiche': 'Small edits',
    bug: 'Bug fixing',
    'nuove-funzionalita': 'New features',
    refactoring: 'Refactoring',
    analisi: 'Understanding a codebase',
  },
  usability: {
    hub: 'via OpenRouter',
    direct: 'direct',
    reseller: (p) => `${p} account`,
    unknown: 'unidentified provider',
  },
  reasons: {
    'no-tools': 'the model does not support tool calling',
    'model-context': 'the model context is too small for this kind of work',
    'no-seller': 'no monitored provider sells this model',
    'not-comparable': 'only measured on benchmarks not comparable with the reference one',
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
    everydayCheapest: (v, m, g, p) =>
      `Solves ${v} of problems on ${m}, above the ${g} bar set by this priority, and it is the cheapest model-provider pair that clears it (${p} per month on the chosen scenario).`,
    everydayBest: (v, m, p) =>
      `It has the highest score among models measured under identical conditions (${v} on ${m}), and it is the cheapest of those in that band: ${p} per month on the chosen scenario.`,
    hardReason: (v, m, gap) =>
      `Solves ${v} of problems on ${m}${gap ? `, ${gap} percentage points above the everyday model, measured under identical conditions` : ''}: the extra capability is documented, not inferred from the price.`,
    hardWhen:
      'Keep it for bugs that will not reproduce, refactors spanning many files, and code the everyday model keeps getting wrong.',
    noWinner: (g) => `No model clears the ${g} quality bar with an identifiable provider: we name no winner.`,
    noBackup: (p) =>
      `No model documents at least ${p} points more capability than the everyday pick: we would rather name no backup than one without evidence.`,
    noBackupBest:
      'Among models with comparable evidence, the everyday pick is already the most capable: we have no grounds to recommend a second one.',
    provisionalCrossHarness: 'the available measurement comes from a different harness than the reference one',
    provisionalStale: (d) => `the measurement is more than ${d} days old`,
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
    feeOpenRouter: 'OpenRouter charges a fee when you buy credits (per-token prices are passed through unchanged)',
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
    title: 'Method, thresholds and limits',
    intro:
      'This page describes how the two recommendations are reached. If something here does not convince you, the right response is not to trust the result: that is why we publish all of it.',
    orderTitle: 'Order of decisions',
    order: [
      '<strong>Models first.</strong> We only consider models with a published coding-quality measurement obtained under the same conditions as the others. A model without comparable evidence cannot win.',
      '<strong>Your choice changes what "best" means.</strong> With "spend less" and "balanced" we take the cheapest model that clears the quality bar. With "best results" we take the highest score, and price only decides between models that are practically tied.',
      '<strong>Providers second.</strong> For every eligible model we collect all monitored offers and keep those from providers we can identify.',
      '<strong>Total cost last.</strong> Each offer is priced in full, fees included, on the same usage scenario.',
    ],
    notTitle: 'What we do not do',
    not: [
      'We do not divide a quality score by a price: that measures nothing.',
      'We do not treat the gap between two scores as a percentage of quality.',
      'We do not compare measurements taken with different harnesses, versions or conditions.',
      'We do not treat different versions, quantisations or modes of a model as the same product.',
      'We do not assume a broker price also applies when buying straight from the provider.',
      'We do not invent usage figures, cache ratios or success rates.',
      'We do not ask for your country or data-handling requirements: no source we read publishes them in structured form, so those questions would change nothing.',
    ],
    thresholdsTitle: 'Thresholds in force',
    thresholds: [],
    missingTitle: 'Missing data',
    missing:
      'A missing price never becomes zero: the offer is excluded from the comparison and we say so. If a provider publishes no cache price, those tokens are billed at the input price, which is an upper bound, and the assumption is stated. If a source fails, we keep the last valid data and state its age. If the evidence is thin the recommendation is marked provisional; if it is absent we name no winner.',
    limitsTitle: 'Stated limits',
    limits: [
      'We cover the providers reached by the enabled sources, not the whole market.',
      'A provider no curated directory lists is not recommended: it stays visible in the comparison, marked as unidentified.',
      'Usage scenarios are stated, editable assumptions, not measurements of your usage.',
      'Public benchmarks measure an agent on standard tasks: a serious signal, not a guarantee about your repository.',
      'OpenCode does not switch to a backup model on its own: the second model must be selected by hand.',
    ],
  },
  sources: {
    title: 'Sources',
    cols: ['Source', 'State', 'Licence or terms', 'Note', 'Rows'],
    active: 'active',
    off: 'not enabled',
    failed: 'failed in the last update',
    never: 'never run',
  },
  status: {
    title: 'Update status',
    intro: 'The update runs on the server every day at 06:30 (Europe/Rome), independently of site traffic.',
    lastRun: (w) => `Last attempt: ${w}`,
    ok: 'succeeded',
    problems: 'with problems',
    published: 'published',
    notPublished: 'not published',
    never: 'No update has run yet.',
    warnings: (n) => `Warnings (${n})`,
    dataTitle: 'Published data',
    cols: ['Source', 'Outcome', 'Rows', 'Note', 'Duration'],
    reused: (a) => `data reused, age ${a}`,
    duration: (ms) => `${ms} ms`,
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
