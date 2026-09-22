# ModelPick

**Il modello giusto. Il provider più conveniente.**

Applicazione web open source che risponde a tre domande, senza registrazione:

> Quale modello uso per il lavoro quotidiano? Quale per i problemi difficili? Da quale provider mi conviene acquistare oggi?

La prima versione è dedicata alla **programmazione con [OpenCode](https://opencode.ai)**. L'architettura è pensata per aggiungere in seguito scrittura, analisi di documenti e automazioni: i connettori delle fonti, l'archivio storico e il motore di raccomandazione sono moduli separati dall'interfaccia.

Sito: <https://modelpick.cloudsalus.com>

## Come funziona

1. **Raccolta** — un connettore per fonte scarica modelli, prezzi per provider e misure di qualità sul codice.
2. **Normalizzazione** — nomi, versioni e unità vengono ricondotti a una chiave canonica. Versioni, quantizzazioni e modalità diverse restano offerte distinte.
3. **Validazione** — prezzi fuori scala scartati, variazioni anomale messe in quarantena, campi obbligatori verificati. Un prezzo mancante non diventa mai zero.
4. **Storico** — ogni esecuzione è salvata per intero in `data/runs/` con la provenienza dei dati.
5. **Raccomandazione** — prima i modelli sulle prove di qualità, poi il provider meno costoso che soddisfa i requisiti, infine il totale con le commissioni.
6. **Pubblicazione atomica** — `data/current.json` viene sostituito con `rename()`: chi legge non vede mai uno stato intermedio.

Le regole complete e le soglie sono su [`/metodo`](https://modelpick.cloudsalus.com/metodo) e in [METHODOLOGY.md](METHODOLOGY.md).

## Fonti

| Fonte | Stato | Perché |
|---|---|---|
| [OpenRouter API](https://openrouter.ai/models) | attiva | API pubblica non autenticata, un'offerta per provider con prezzi, quantizzazione e disponibilità |
| [Models.dev](https://models.dev) | attiva | listini diretti dei provider e capacità dichiarate; è anche il registro che usa OpenCode |
| [SWE-bench Verified](https://github.com/SWE-bench/experiments) | attiva | misure di qualità sul codice in condizioni confrontabili |
| [Aider polyglot](https://aider.chat/docs/leaderboards/) | attiva | seconda misura sul codice, licenza Apache-2.0 |
| Artificial Analysis | **spenta** | il riuso dei dati strutturati sembra regolato da termini separati a pagamento |
| pricepertoken.com | **spenta** | nessun termine di riuso pubblicato, nessuna API |
| cheaperinference.com | **spenta** | `robots.txt` blocca `/api/`, termini non ancora letti integralmente |
| llmprice.gitlab.io | non integrata | dichiara di aggregare models.dev, che leggiamo già alla fonte |

Una fonte resta spenta finché non ne abbiamo letto per intero le condizioni di riuso. **La licenza MIT di questo codice non si applica ai dati di terzi.**

## Avvio rapido

```bash
cp .env.example .env
docker compose up -d          # web su 127.0.0.1:8031 + scheduler quotidiano
docker compose run --rm web node dist/pipeline/run.js   # prima raccolta dati
```

Senza Docker (serve Node 22+):

```bash
npm install
npm run build
npm run update     # una raccolta dati
npm start          # server
npm run scheduler  # aggiornamento quotidiano
```

Nessun segreto è necessario: le quattro fonti attive sono API pubbliche non autenticate.

## Aggiornamento quotidiano

Il servizio `scheduler` esegue la raccolta ogni giorno alle **06:30 Europe/Rome**, indipendentemente dalle visite al sito, e recupera da solo se all'avvio trova dati più vecchi di 24 ore. Orario e fuso si cambiano con `MODELPICK_RUN_HOUR`, `MODELPICK_RUN_MINUTE`, `MODELPICK_TZ`.

Lo stato di ogni esecuzione, per fonte, è visibile su [`/stato`](https://modelpick.cloudsalus.com/stato) e in `data/last-run.json`.

## Struttura

```
src/
  config.ts          soglie, fonti, regole in un unico posto
  lib/               http con timeout e ritentativi, scrittura atomica, normalizzazione
  sources/           un connettore per fonte, abilitabile singolarmente
  pipeline/          raccolta, validazione, archivio, esecuzione
  engine/            scenari, costi, raccomandazione, configurazione OpenCode
  server/            pagine rese lato server e API JSON
test/                test su calcoli, commissioni, normalizzazione, dati obsoleti, raccomandazioni
```

## API

| Percorso | Risposta |
|---|---|
| `GET /api/raccomandazione?task=&priority=&country=&privacy=&access=` | le due raccomandazioni complete di motivazioni e fonti |
| `GET /api/stato` | esito dell'ultimo aggiornamento |
| `GET /api/fonti` | fonti monitorate, licenze e stato |
| `GET /api/modelli` | modelli con misure di qualità |
| `GET /api/storico?model=` | serie storica del prezzo minimo |
| `GET /salute` | health check |

## Licenza

Codice: [MIT](LICENSE). I dati di terze parti restano dei rispettivi titolari, con le attribuzioni indicate su `/fonti`.
