# Contribuire a ModelPick

Grazie. Questo progetto vive di dati verificabili, quindi la regola principale è una sola: **ogni affermazione deve avere una fonte controllabile.**

## Segnalare un errore nei dati

Apri una issue con:

- che cosa mostra il sito (schermata o URL con i parametri);
- che cosa dovrebbe mostrare;
- la fonte che lo dimostra (pagina prezzi ufficiale, documentazione, risposta dell'API);
- data e ora della verifica.

Gli errori sui prezzi hanno priorità: un prezzo sbagliato produce una raccomandazione sbagliata.

## Aggiungere un provider o una fonte

Prima del codice serve la parte legale:

1. Leggi **per intero** le condizioni di accesso e riuso della fonte e riportale nella issue.
2. Verifica `robots.txt` e l'esistenza di un'API ufficiale: preferiamo sempre dati strutturati allo scraping.
3. Indica quale attribuzione richiede la fonte.

Solo dopo:

4. Aggiungi la voce in `SOURCES` dentro `src/config.ts`, con licenza, attribuzione e nota. **Le fonti nuove nascono disattivate** (`enabled: false`).
5. Scrivi il connettore in `src/sources/<nome>.ts`. Deve restituire `Offer[]` o `QualityEvidence[]` e non deve mai inventare un valore mancante.
6. Aggancialo in `src/pipeline/collect.ts` con il proprio blocco `try/catch` e il fallback ai dati precedenti.
7. Aggiungi test su almeno un caso reale di risposta.

Una fonte viene attivata solo quando i suoi termini di riuso sono chiari.

## Modificare il metodo

Soglie e regole stanno in `src/config.ts` e `src/engine/scenarios.ts`. Una modifica al metodo richiede:

- la motivazione nella pull request;
- l'aggiornamento di `METHODOLOGY.md` e della pagina `/metodo`;
- i test che coprono il nuovo comportamento.

Cambiare una soglia cambia le raccomandazioni pubbliche: non è una modifica cosmetica.

## Sviluppo

```bash
npm install
npm test          # 41 test su calcoli, commissioni, normalizzazione, dati obsoleti, raccomandazioni
npm run typecheck
npm run dev       # server in ricarica automatica
npm run dev:update  # una raccolta dati senza build
```

Prima di aprire una pull request: `npm run typecheck && npm test`.

## Principi che non si negoziano

- Un prezzo mancante non diventa zero.
- Misure ottenute in condizioni diverse non si confrontano.
- Versioni, quantizzazioni e modalità diverse sono offerte diverse.
- Se le prove non bastano, si dichiara "raccomandazione provvisoria" o non si assegna un vincitore.
- Sponsorizzazioni e affiliazioni, se mai esisteranno, vanno dichiarate e non influenzano l'ordine.
