# Metodo di selezione

Questo documento descrive le regole con cui ModelPick sceglie due modelli e un provider per ciascuno. Le stesse regole sono riassunte, in forma leggibile, sulla pagina `/metodo` del sito.

## 1. Ordine delle decisioni

**Prima i modelli, poi i provider, infine la convenienza complessiva.**

1. Un modello entra nel confronto solo se esiste una **misura di qualità sul codice degli ultimi 7 giorni** che lo riguarda. Un modello senza una misura recente non può vincere.
2. Per ogni modello ammesso si raccolgono tutte le offerte monitorate e si tengono quelle che soddisfano i requisiti dell'utente.
3. Ogni offerta viene calcolata per intero sullo stesso scenario di consumo, commissioni incluse.

## 2. Comparabilità delle prove

Il problema principale dei benchmark pubblici non è trovarli: è non confrontare cose diverse.

Ogni misura porta con sé un **gruppo di confronto** (`harnessKey`) composto da: nome dell'agente, sua versione, numero di tentativi consentiti, livello di sforzo di ragionamento. Due misure appartengono allo stesso gruppo solo se questi quattro elementi coincidono.

**Fonte principale: Artificial Analysis Coding Index.** Viene scaricato dall'API di Artificial Analysis a ogni aggiornamento (una sola volta: lo scaricamento resta in cache per 20 ore, così rieseguire l'aggiornamento non consuma chiamate). Tutti i modelli sono misurati dalla stessa organizzazione con lo stesso metodo, quindi formano un unico gruppo di confronto (`aa-coding-index|<versione dell'indice>`). Quando lo stesso modello è pubblicato in più varianti di sforzo di ragionamento, teniamo la variante con il punteggio più alto e la indichiamo in pagina. I valori sono riportati come pubblicati, con l'attribuzione "Source: Artificial Analysis (artificialanalysis.ai)" e la dichiarazione che le scelte sono di ModelPick e non di Artificial Analysis.

**Solo dati recenti.** Una misura di qualità più vecchia di **7 giorni** non viene usata, in nessun caso. Per Artificial Analysis la data è quella dello scaricamento; se l'API non risponde si riusano i valori dell'ultimo scaricamento riuscito finché hanno meno di 7 giorni, poi il modello esce dal confronto. SWE-bench e Aider sono spenti per questo motivo: le loro misure hanno spesso mesi.

Il **gruppo di riferimento** è Artificial Analysis quando presente; in sua assenza, il gruppo SWE-bench che ha misurato più modelli. Solo i modelli presenti nel gruppo di riferimento entrano nel confronto: un modello misurato altrove viene escluso con motivazione esplicita, non convertito né riscalato.

## 3. Soglie di qualità

La priorità scelta dall'utente determina il punteggio minimo sul Coding Index di Artificial Analysis. Le soglie mantengono all'incirca la selettività che avevano su SWE-bench: il quotidiano deve stare nella metà, nel 35% o nel 25% migliore dei modelli misurati.

| Priorità | Quotidiano | Problemi difficili |
|---|---|---|
| Risparmio | 45 | 68 |
| Equilibrio | 55 | 72 |
| Qualità | 65 | 75 |

Se il riferimento torna a essere SWE-bench (Artificial Analysis non disponibile), valgono le soglie in percentuale di problemi risolti: 45/62, 55/68, 64/72.

Il significato di "il migliore" dipende dalla priorità scelta, ed è l'unica domanda che il sito pone:

- con **spendere poco** ed **equilibrio**, il modello quotidiano è la combinazione modello-provider **meno costosa fra quelle che superano la soglia**: una scelta economica che raggiunge una qualità adeguata, non la più economica in assoluto;
- con **lavorare bene**, è il **punteggio più alto** disponibile; il prezzo interviene solo come spareggio fra modelli che stanno entro 2 punti dal massimo, dove la differenza non è significativa.
- Il **modello per i problemi difficili** deve superare il quotidiano di almeno **3 punti** misurati nello stesso gruppo di confronto. All'interno di una fascia di 2 punti dal punteggio massimo si preferisce il più economico: sotto quella soglia la differenza non è significativa e non vale il costo.
- Se nessun modello soddisfa queste condizioni, **non si assegna un vincitore** e il sito lo dichiara.

## 4. Che cosa non facciamo

- Non dividiamo il punteggio di qualità per il prezzo.
- Non trattiamo la differenza fra due punteggi come una percentuale di qualità.
- Non confrontiamo misure ottenute con banchi di prova, versioni o condizioni diverse.
- Non equipariamo versioni, quantizzazioni o modalità diverse dello stesso modello.
- Non assumiamo che il prezzo di un intermediario valga anche acquistando direttamente dal provider.
- Non inventiamo consumi, percentuali di cache o tassi di riuscita.
- Non promettiamo copertura mondiale né sicurezza garantita.

## 4-bis. Comandi verificati

Il sito pubblica comandi che le persone incollano in un terminale, quindi non basta che un identificativo sembri corretto.

Durante la build dell'immagine installiamo OpenCode e gli chiediamo l'elenco dei modelli che accetta (`opencode models`, con chiavi finte che servono solo a fargli elencare i provider: nessuna chiamata a un modello). L'elenco finisce nell'immagine e la raccolta dati lo confronta con ogni offerta.

Un'offerta il cui identificativo non è in quell'elenco **non viene né consigliata né mostrata**: il comando non partirebbe. Nell'ultimo aggiornamento questo esclude circa 6.600 offerte su 7.700.

La versione di OpenCode con cui la verifica è stata fatta è indicata sotto ogni raccomandazione.

Per le offerte instradate da un intermediario il comando da solo non sceglie il provider: si copia la configurazione che lo fissa. Vedi la sezione 1.

## 5. Calcolo dei costi

Ogni offerta è calcolata **per intero sul singolo provider**: è strutturalmente impossibile combinare il prezzo di input di un provider con quello di output di un altro, perché il calcolo parte da un unico oggetto offerta.

Si sommano input, output, lettura e scrittura della cache, ciascuno al prezzo di quel provider, poi le commissioni applicabili.

Gestione dei dati mancanti:

| Situazione | Comportamento |
|---|---|
| Prezzo assente e necessario allo scenario | l'offerta è esclusa dal confronto, mai trattata come gratuita |
| Prezzo di cache non pubblicato | i token di cache sono conteggiati **al prezzo di input**, che è un limite superiore, e l'ipotesi è dichiarata in pagina |
| Nessun prezzo per token (piano forfettario o livello gratuito) | l'offerta non partecipa al confronto sul prezzo: il costo reale non è pubblicato per token |
| Commissione certa ma di importo non verificabile | dichiarata come "non quantificata" e mostrata, mai stimata |
| Ricarica minima o abbonamento obbligatorio | mostrati come vincolo dell'offerta |

Gli scenari di consumo predefiniti sono **ipotesi dichiarate e modificabili**, non misure. L'utente può sostituirle con i propri consumi.

Il risparmio viene calcolato solo rispetto a una configurazione che l'utente ha dichiarato, ed è sempre etichettato come stima.

## 6. Soglie operative

| Regola | Valore | Effetto |
|---|---|---|
| Prezzo non verificato da più di | 48 ore | non può vincere il confronto |
| Snapshot più vecchio di | 36 ore | segnalato come obsoleto in pagina |
| Misura di qualità più vecchia di | 7 giorni | non viene usata |
| Misura di qualità più vecchia di | 2 giorni | rende la raccomandazione provvisoria |
| Variazione di prezzo oltre un fattore | 5× | offerta in quarantena, esclusa dalla vittoria |
| Prezzo superiore a | 2000 USD/1M token | scartato come probabile errore di unità |
| Disponibilità recente sotto | 90% | offerta esclusa |
| Contesto minimo | 100k token, o più secondo l'attività | offerta esclusa |

Tutti i valori sono configurabili via variabili d'ambiente (vedi `.env.example`) e documentati in `src/config.ts`.

## 7. Raccomandazione provvisoria

Una raccomandazione è marcata **provvisoria** quando almeno una di queste condizioni è vera:

- la misura di qualità ha più di 2 giorni (per esempio perché Artificial Analysis non ha risposto);
- una commissione applicabile non è quantificabile automaticamente;
- il costo usa l'ipotesi prudenziale sui prezzi di cache non pubblicati;
- un solo provider monitorato soddisfa i requisiti.

## 8. Limiti dichiarati

- Copriamo i provider monitorati dalle fonti abilitate, non tutto il mercato. La formula usata sul sito è sempre: *"il più economico tra i provider monitorati che soddisfano i tuoi requisiti"*.
- **Non chiediamo il paese di utilizzo né requisiti sul trattamento dei dati.** Nessuna fonte che leggiamo pubblica la disponibilità geografica o la politica sui dati in forma strutturata: erano domande che non cambiavano il risultato, e una domanda senza effetto è peggio di nessuna domanda. Chi ha vincoli di questo tipo deve verificarli sul sito del provider prima di acquistare.
- I banchi di prova pubblici misurano un agente su compiti standard: sono un indizio serio, non una garanzia sul tuo repository.
- OpenCode non passa automaticamente a un modello di riserva: il secondo modello va selezionato a mano.
