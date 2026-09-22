# ModelPick

**The right model. The cheapest provider.**

Open source web app that answers three questions, with no sign-up:

> Which model do I use for everyday work? Which one for hard problems? Which provider should I buy from today?

The first version is dedicated to **coding with [OpenCode](https://opencode.ai)**. The architecture is built to add writing, document analysis and automations later: the source connectors, the history store and the recommendation engine are modules separate from the interface.

Site: <https://modelpick.cloudsalus.com> — English by default, Italian for browsers whose first language is Italian.

## How it works

1. **Collection** — one connector per source downloads models, per-provider prices and coding-quality measurements.
2. **Normalisation** — names, versions and units are mapped to a canonical key. Different versions, quantisations and modes stay separate offers.
3. **Validation** — out-of-range prices are discarded, abnormal changes quarantined, required fields checked. A missing price never becomes zero.
4. **History** — every run is stored in full in `data/runs/`, with the provenance of the data.
5. **Recommendation** — models first, on quality evidence; then the cheapest provider that meets the requirements; then the total, fees included.
6. **Command verification** — every model-provider pair is checked against the list of identifiers OpenCode actually accepts, extracted from OpenCode itself when the image is built. An offer OpenCode cannot address is neither recommended nor shown.
7. **Atomic publish** — `data/current.json` is replaced with `rename()`: readers never see an intermediate state.

The full rules and thresholds are at [`/en/method`](https://modelpick.cloudsalus.com/en/method) and in [METHODOLOGY.md](METHODOLOGY.md).

## Sources

| Source | State | Why |
|---|---|---|
| [OpenRouter API](https://openrouter.ai/models) | active | public unauthenticated API, one offer per provider with prices, quantisation and availability |
| [Models.dev](https://models.dev) | active | providers' own price lists and declared capabilities; also the registry OpenCode uses |
| [Artificial Analysis](https://artificialanalysis.ai/) | active, **primary quality source** | Coding Index from the API (free tier, key in `AA_API_KEY`), downloaded once per update; attribution and non-endorsement statement on every page |
| [SWE-bench Verified](https://github.com/SWE-bench/experiments) | **off** | published measurements are often months old, and we only use quality evidence from the last 7 days |
| [Aider polyglot](https://aider.chat/docs/leaderboards/) | **off** | the leaderboard is not updated every week |
| pricepertoken.com | **off** | no published reuse terms, no API |
| cheaperinference.com | **off** | `robots.txt` blocks `/api/`, terms not yet read in full |
| llmprice.gitlab.io | not integrated | states it aggregates models.dev, which we already read at the source |

A source stays off until we have read its reuse terms in full. **The MIT licence of this code does not extend to third-party data.**

## Quick start

```bash
cp .env.example .env
docker compose up -d          # web on 127.0.0.1:8031 + daily scheduler
docker compose run --rm web node dist/pipeline/run.js   # first data collection
```

Without Docker (needs Node 22+):

```bash
npm install
npm run build
npm run update     # one data collection
npm start          # server
npm run scheduler  # daily update
```

`robots.txt` and `sitemap.xml` are served by the app itself, in both languages.

One secret is needed: `AA_API_KEY`, a free Artificial Analysis API key, which is the primary quality source. The other active sources are public unauthenticated APIs. Without that key the site still runs, on whichever other quality source is enabled.

## Daily update

The `scheduler` service runs the collection every day at **06:30 Europe/Rome**, regardless of site traffic, and catches up on its own if it finds data older than 24 hours at startup. Time and zone are set with `MODELPICK_RUN_HOUR`, `MODELPICK_RUN_MINUTE`, `MODELPICK_TZ`.

The outcome of each run, per source, is visible at [`/en/status`](https://modelpick.cloudsalus.com/en/status) and in `data/last-run.json`.

## Layout

```
src/
  config.ts          thresholds, sources and rules in one place
  lib/               http with timeouts and retries, atomic writes, normalisation
  sources/           one connector per source, each enabled on its own
  pipeline/          collection, validation, store, run
  engine/            scenarios, costs, recommendation, OpenCode config
  server/            server-rendered pages and JSON API
test/                tests on costs, fees, normalisation, stale data, recommendations
```

## API

| Path | Response |
|---|---|
| `GET /api/recommendation?task=&priority=` | both recommendations, with their reasons and sources |
| `GET /api/status` | outcome of the last update |
| `GET /api/sources` | monitored sources, licences and state |
| `GET /api/models` | models with quality measurements |
| `GET /api/scenarios` | the usage scenarios behind the monthly prices |
| `GET /api/history?model=` | history of the lowest price |
| `GET /health` | health check |

The first version of the API used Italian paths (`/api/raccomandazione`, `/api/stato`, `/api/fonti`, `/api/modelli`, `/api/scenari`, `/api/storico`, `/salute`). They still answer, with their original Italian field names, so existing callers keep working; new code should use the paths above.

## Licence

Code: [MIT](LICENSE). Third-party data remains the property of its owners, with the attributions listed at [`/en/sources`](https://modelpick.cloudsalus.com/en/sources).
