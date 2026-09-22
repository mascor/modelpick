# Contributing to ModelPick

Thank you. This project lives on verifiable data, so there is one main rule: **every claim must have a source anyone can check.**

## Reporting a data error

Open an issue with:

- what the site shows (screenshot, or URL with its parameters);
- what it should show;
- the source that proves it (official pricing page, documentation, API response);
- the date and time you checked.

Price errors come first: a wrong price produces a wrong recommendation.

## Adding a provider or a source

Before the code comes the legal part:

1. Read the source's access and reuse terms **in full** and quote them in the issue.
2. Check `robots.txt` and whether an official API exists: we always prefer structured data over scraping.
3. State which attribution the source requires.

Only then:

4. Add the entry to `SOURCES` in `src/config.ts`, with its licence, attribution and note, in Italian and in English. **New sources start disabled** (`enabled: false`).
5. Write the connector in `src/sources/<name>.ts`. It must return `Offer[]` or `QualityEvidence[]`, and must never invent a missing value.
6. Wire it into `src/pipeline/collect.ts` with its own `try/catch` and a fallback to the previous data.
7. Add tests covering at least one real response.

A source is only enabled once its reuse terms are clear.

## Changing the method

Thresholds and rules live in `src/config.ts` and `src/engine/scenarios.ts`. A change to the method requires:

- the reasoning in the pull request;
- an update to `METHODOLOGY.md` and to the `/en/method` and `/metodo` pages;
- tests covering the new behaviour.

Changing a threshold changes public recommendations: it is not a cosmetic change.

## Development

```bash
npm install
npm test          # tests on costs, fees, normalisation, stale data, language, recommendations
npm run typecheck
npm run dev       # server with auto-reload
npm run dev:update  # one data collection without building
```

Before opening a pull request: `npm run typecheck && npm test`.

## Non-negotiable principles

- A missing price never becomes zero.
- Measurements taken under different conditions are not compared.
- Different versions, quantisations and modes are different offers.
- If the evidence is not enough, we say "provisional recommendation", or name no winner.
- Sponsorships and affiliate deals, should they ever exist, are declared and do not affect the ordering.

## Language

The user interface is bilingual (Italian and English, in `src/i18n.ts`) and every source carries its texts in both languages. This documentation is in English. Issues and pull requests are welcome in either language.
