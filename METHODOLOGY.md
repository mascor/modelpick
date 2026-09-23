# Selection method

This document describes the rules ModelPick uses to pick two models and one provider for each. The same rules are summarised, in plain language, on the site's `/en/method` page.

## 1. Order of decisions

**Models first, then providers, then the total cost.**

1. A model enters the comparison only if it has a **Coding Index read in the last 7 days**: measured, or provisional as described in section 3. A model with neither cannot win.
2. For every eligible model we collect all monitored offers and keep the ones that meet the user's requirements.
3. Every offer is priced in full on the same usage scenario, fees included.

## 2. Comparability of the evidence

The main problem with public benchmarks is not finding them: it is not comparing different things.

Every measurement carries a **comparability group** (`harnessKey`) made of: agent name, its version, number of attempts allowed, reasoning effort. Two measurements belong to the same group only if all four match.

**Primary source: the Artificial Analysis Coding Index.** It is downloaded from the Artificial Analysis API at every update (once only: the download is cached for 20 hours, so rerunning the update spends no calls). Every model is measured by the same organisation with the same method, so they form a single comparability group (`aa-coding-index|<index version>`). When the same model is published in several reasoning-effort variants, every variant is kept; which one counts depends on what the buyer can select (section 3). Values are reported as published, with the attribution "Source: Artificial Analysis (artificialanalysis.ai)" and a statement that the picks are ModelPick's and not Artificial Analysis'.

**One model, one build.** A dated snapshot is part of a model's identity: "V4 Flash 0423" and "V4 Flash 0731" are different products. When the name on the source and the name in our catalogue both carry a date and the dates disagree, the score goes to our model with the source's date in its name (a score for "V4 Pro 0813" goes to `deepseek-v4-pro-0813`); if we sell no build with that date, the score is dropped rather than attached to another build, and the run says how many scores that cost.

**Retired models are never shown.** A model is retired when its maker lists it as deprecated on its own price list in models.dev, or when OpenRouter gives it a retirement date. The model goes with its dated builds and the variants resellers publish under it ("-0731", ":thinking", "-flex", "@eu"), but not with a different version ("gpt-4" retired does not touch GPT-4.1). An offer a seller lists as deprecated is left out too.

**A newer version is always mentioned.** A model on sale with no Coding Index, measured or provisional, cannot win. When a pick has a newer version of the same line on sale (DeepSeek V4 Flash → V4.1 Flash; newer means a higher version number and a later release date, so Grok 4.20, older than Grok 4.7, is not its successor), its card says so; and when a retired model would have cleared the bar, the page names its newer version and says it is not measured yet.

**One spelling, one model.** Scores are matched after every price source is in. When several of our models share a spelling, the score goes to the one sold by the most providers, so a single provider's private copy of a model never takes the score of the model everyone else sells. Pairs the rules miss are corrected by hand in `data/curated/aliases.json`, each with its reason; the file also lists the pairs we deliberately leave unmatched.

**The date we can prove.** Artificial Analysis does not publish when it ran a measurement, so what we show is the date we read the index, worded as such. Where a source does publish a measurement date, such as SWE-bench, that date is shown instead.

**Recent data only.** A quality score read more than **7 days** ago is never used. For Artificial Analysis the date is the date of the download, not of the test, which Artificial Analysis does not publish: a test run months ago and still published today counts as read today; if the API does not respond we reuse the values from the last successful download while they are less than 7 days old, after which the model leaves the comparison. SWE-bench and Aider are off for this reason: their measurements are often months old.

The **reference group** is Artificial Analysis when present; failing that, the SWE-bench group that measured the most models. Only models in the reference group enter the comparison: a model measured elsewhere is excluded with an explicit reason, never converted or rescaled.

## 3. The choice rule

**Each priority has a monthly budget. Within it, the models within 3 points of the best Artificial Analysis Coding Index are treated as close; among them, the one OpenCode users keep using most wins (the cheaper on equal retention), and without usage figures the cheapest wins.** The model for hard problems is chosen the same way with the larger budget, and is named only if it scores more than 3 points above the everyday one. When the runner-up in the same budget is within 3 points of a pick, the card shows it as a close alternative, with its score and price.

The 3 points are a project choice, used everywhere the rule compares two scores: we have no analysis of the measurement's uncertainty that would make it a statistical margin. It says "close enough to let usage and price decide", nothing more.

| Priority | Every day | Hard problems |
|---|---|---|
| Spend less | 5 USD | 50 USD |
| Balanced | 20 USD | 100 USD |
| Best results | 50 USD | 250 USD |

Budgets are USD per month for bug fixing, for the cheapest usable offer of each model. For the other kinds of work they grow with the work: the budget is multiplied by the median, over today's priced offers of measured models, of the month's cost for that work divided by the month's cost for bug fixing (about 0.5× for small edits, 2× for understanding a codebase), and rounded to whole dollars. A heavier kind of work therefore does not get a weaker model for the same priority. The factors in force are on the method page. At the same total price we prefer the offer whose provider the configuration can hold. If no measured model fits the budget, no winner is named and the site says so.

**Usage, from OpenCode.** OpenCode publishes, at opencode.ai/data, how many of the people who used a model in a week were still using it the next week. It is read once per daily update (the page has no API; the site owner chose to read it, with attribution) and only models with at least 1,000 eligible user-weeks count. Retention can depend on price, free tiers, defaults or habit, so it is not proof of better code; it only decides among models already treated as close. Beyond 3 points the score always wins.

This replaces the earlier quality thresholds, price caps per task and bands: one rule a reader can check by hand. The cost per task that Artificial Analysis publishes is not used to choose, because it is computed at the maker's list prices, not at the price of the provider we send the reader to.

**The reasoning effort the buyer can actually use.** A model's score and cost depend on its reasoning effort. A variant counts only if the buyer gets it: on OpenAI's own API OpenCode can set `reasoningEffort` (none to xhigh), so the configuration we publish sets it; on Anthropic's own API OpenCode uses "high" unless changed by hand, so the "high" variant counts; anywhere else the effort cannot be chosen through the configuration, so only the lowest measured variant counts.

**Provisional scores for new versions.** A new version that Artificial Analysis has not measured on code yet, whose Intelligence Index is at least that of the previous version of the same line, carries the previous version's Coding Index, flagged as provisional on the page. On the measured history (71 successor pairs meeting that condition) the new version scored at least as well on code in 67 cases, with a median gain of 15 points; the four exceptions include one drop of 13.8 points. It is a record of the past, not a probability for the next release. The pairs are listed in [docs/successor-backtest.md](docs/successor-backtest.md), produced by `tools/successor-backtest.ts` from the Artificial Analysis download. The provisional score is replaced by the real one as soon as it is published.

## 4. What we do not do

- We do not divide a quality score by a price.
- We do not treat the gap between two scores as a percentage of quality.
- We do not compare measurements taken with different harnesses, versions or conditions.
- We do not treat different versions, quantisations or modes of a model as the same product, with one declared exception: the provisional score of a new version (section 3).
- We do not assume a broker's price also applies when buying straight from the provider.
- We do not invent usage figures, cache ratios or success rates.
- We do not promise worldwide coverage or guaranteed security.

## 4-bis. Verified commands

The site publishes commands that people paste into a terminal, so an identifier looking correct is not enough.

While the image is built we install OpenCode and ask it for the list of models it accepts (`opencode models`, with dummy keys that only make it list the providers: no call to any model). The list goes into the image, and the data collection checks every offer against it.

An offer whose identifier is not on that list is **neither recommended nor shown**: the command would not run. In the latest update this excludes about 6,600 offers out of 7,700.

The version of OpenCode the check was made with is stated under every recommendation.

**Providers we add.** A few providers that OpenCode does not ship with are added, one by one on request, through the configuration we publish: today only SiliconFlow. models.dev states its OpenAI-compatible API address, client and key name; the configuration declares the provider and the model, and OpenCode lists the model once the file is in place (checked against OpenCode itself). Such an offer needs the file: the card does not offer the plain command for it.

For offers routed through a broker the command alone does not pick the provider: the configuration pins it, and it can be copied or downloaded as `opencode.json` for that pick alone (`/opencode.json?role=everyday` or `role=hard`). The card also gives the plain command (`opencode -m provider/model`) for starting right away, and says what is lost without the file: the pinned provider, and so the quoted price, or the reasoning effort the score was measured with.

## 5. Cost calculation

Every offer is priced **entirely on a single provider**: it is structurally impossible to combine one provider's input price with another's output price, because the calculation starts from a single offer object.

Input, output, cache reads and cache writes are added up, each at that provider's price, then the applicable fees.

Handling of missing data:

| Situation | Behaviour |
|---|---|
| Price missing and needed by the scenario | the offer is excluded from the comparison, never treated as free |
| Cache price not published | cache tokens are billed **at the input price**, which is an upper bound, and the assumption is stated on the page |
| No per-token price (flat plan or free tier) | the offer does not take part in the price comparison: its real cost is not published per token |
| Fee certain but its amount not verifiable | declared as "not quantified" and shown, never estimated |
| Seller's own fees | applied by who sells, not by which source described the offer: an OpenRouter price carries OpenRouter's fee whether it came from their API or from models.dev |
| OpenRouter credit purchase fee | 5.5% by card, 0.80 USD minimum per top-up, 5% by crypto, as declared in their FAQ; the percentage is applied to the total, the minimum is stated as a condition |
| Minimum top-up or mandatory subscription | shown as a constraint of the offer |

The default usage scenarios are **stated, editable assumptions**, not measurements. Users can replace them with their own usage.

Savings are only calculated against a configuration the user has declared, and are always labelled as an estimate.

## 5-bis. Capped subscription plans (OpenCode Go)

A capped plan charges a fixed monthly fee and gives each model a monthly allowance, counted in dollars **at the plan's own list prices**. Those per-token prices are therefore not a price anyone pays: they only measure how fast the allowance runs out. So plan offers **never compete on the main page** (reason `capped-plan`); they are compared on their own page, `/go` (`/en/go`), and in the API at `/api/plans/opencode-go?task=…`.

The plan's terms (fee, allowance per model, 5-hour and weekly windows, retention, busy-hour prices) are read by hand from the plan's documentation into `data/curated/plans.json`, with the day they were read. Past `MODELPICK_PLAN_MAX_DAYS` (default 30) the page says they may be out of date. Per-token prices still come from the sources (models.dev), like every other offer, and the plan's offers must pass the same checks (OpenCode accepts the id, recent price, tools, context).

For one month of the chosen work, with `C` the allowance the month uses (plan prices), `T` the model's allowance, `O` the month at the pay-as-you-go prices that apply beyond it and `P` the cheapest provider we would recommend for the same model:

| Situation | Plan month |
|---|---|
| `C ≤ T` | the fee |
| `C > T` | the fee + `(1 − T/C) × O`: only the share of the work the allowance does not cover, at pay-as-you-go prices |

Beyond the allowance the plan stops unless "Use balance" is enabled; with it, OpenCode Go bills the rest from the OpenCode Zen balance, so `O` uses Zen's price for the same model when a source publishes one, otherwise the plan's own list price (stated on the row).

**When the plan pays off.** Both bills grow with the amount of work: the provider's in a straight line, the plan's flat up to the allowance and then at `O`. The page gives the range of monthly spend at the provider in which the plan costs less:

- if the allowance still covers the work when the provider reaches the fee (`fee / P ≤ T / C`): from the fee upwards, up to `P × (T·O/C − fee) / (O − P)` when `O > P`, with no upper end otherwise;
- otherwise, only when pay-as-you-go is cheaper than the provider (`O < P`): from `P × (fee − T·O/C) / (P − O)` upwards; if not, never.

Stated assumptions, shown on the page:

- the documentation gives the allowance **per model**; whether two models used in the same month each have their own is not stated in so many words, so every row assumes a single model;
- DeepSeek models cost more at busy hours: the allowance is drawn at those prices, an upper bound;
- prices that rise beyond a context length are taken at the base price, as everywhere on the site;
- the 5-hour (20%) and weekly (50%) windows are stated, not modelled: the monthly figures assume work spread over the month.

## 6. Operating thresholds

| Rule | Value | Effect |
|---|---|---|
| Price not checked for more than | 48 hours | cannot win the comparison |
| Snapshot older than | 36 hours | flagged as out of date on the page |
| Quality measurement older than | 7 days | not used |
| Quality measurement older than | 2 days | makes the recommendation provisional |
| Price change beyond a factor of | 5× | offer quarantined, cannot win |
| Price above | 2000 USD/1M tokens | discarded as a likely unit error |
| Availability over the last 30 minutes below | 90% | offer excluded |
| Availability over the last day below | 98% | offer excluded (OpenRouter publishes it; for direct sellers it is not published, and missing is treated as unknown, not as good) |
| Direct purchase from a cloud platform (Amazon Bedrock, Google Vertex, Azure) | — | cannot win: it needs a cloud account, billing and model access; through OpenRouter the account is OpenRouter's |
| Minimum context | 100k tokens, or more depending on the task | offer excluded |

Every value is configurable through environment variables (see `.env.example`) and documented in `src/config.ts`.

## 7. Provisional recommendation

A recommendation is marked **provisional** when at least one of these is true:

- the quality measurement is more than 2 days old (for example because Artificial Analysis did not respond);
- an applicable fee cannot be quantified automatically;
- the cost relies on the conservative assumption about unpublished cache prices;
- only one monitored provider meets the requirements.

## 8. Stated limits

- **Who has to be identifiable.** A third party we cannot name is not a recommendation: for a direct purchase from a reseller we require an entry in a curated directory. Two cases need no entry. The company that made the model, selling its own model (Anthropic for Claude, OpenAI for GPT), is identified by definition. And when the offer is routed through OpenRouter, the account and the invoice are OpenRouter's, while the provider behind it only supplies the machines; the page always states who runs the model and who bills you.
- We cover the providers monitored by the enabled sources, not the whole market. The wording used on the site is always: *"the cheapest among the monitored providers that meet your requirements"*.
- **We do not ask for your country or data-handling requirements.** No source we read publishes geographic availability or data policy in structured form: those questions did not change the result, and a question with no effect is worse than no question. Anyone with constraints of that kind has to check them on the provider's site before buying.
- Public benchmarks measure an agent on standard tasks: a serious signal, not a guarantee about your repository.
- **The same tokens for every model.** The monthly estimate multiplies the same token volumes by each model's prices, so a model that reasons at length and produces more output can cost more than estimated. We looked for a correction: Artificial Analysis publishes only a total cost per task, without splitting input, output and cache, on tasks that do not use the cache, and the factor it yields swings between 0.1× and 10× with the price list rather than with consumption; OpenCode's real cost per session covers only a handful of models. Neither is applied; where OpenCode publishes it, the card shows the real cost per session as information.
- **One source for quality.** Every score comes from Artificial Analysis. The other benchmarks we know publish measurements that are months old, which the 7-day rule excludes: we prefer one recent source to several stale ones, and say so.
- **Data retention by providers.** OpenRouter does not publish, per provider, whether prompts are retained. Privacy is therefore an option, off by default: when the reader turns it on, the configuration adds `data_collection: "deny"` and allows OpenRouter to fall back to another provider, because pinning a provider that retains data would make every request fail. With privacy on, the quoted price is no longer guaranteed, and the card says so. Direct purchases follow the seller's own policy. OpenRouter also lets you set this once for your whole account, in its privacy settings.
- OpenCode does not fall back to a backup model automatically: the second model has to be selected by hand.
