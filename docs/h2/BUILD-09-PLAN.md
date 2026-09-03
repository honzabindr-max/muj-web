# BUILD-09 — Context Engine — návrh plánu

**Status:** SCHVÁLENO Honzíkem 2026-09-03, včetně Rozhodnutí 1–4, s
doplněním retry/quarantine odpovědi do Rozhodnutí 2 a "bezpečné mergnout
samostatně" věty u každého kroku (obojí na jeho výslovný požadavek).
**Explicitně: pro celý tenhle slice neočekávám žádný STOP** (viz "Proč
žádný STOP" níže) — na rozdíl od BUILD-04/07 se nečeká na žádnou
migraci, credential ani env proměnnou před implementací ani mergem
kteréhokoli ze 4 kroků.

## Rozsah (Build Specification §2 BUILD-09, Technical Architecture v1.2 §7)

- Deterministic relevance floor (§7.3),
- entity resolution (viz Rozhodnutí 1 — v1 přes BUILD-08 ENTITY kandidáty),
- context reasons (`context_run_items.reason`),
- P0–P4 priorita (§7.4),
- token budgety podle purpose (§7.4 tabulka, 7 purposes),
- omission audit (`context_runs.omitted_item_ids`/`omission_reason`),
- third-person runtime cap (§31.10, invariant I5),
- Reasoning Lab pouze explicit deep-dive/review (§7.3).

**DoD (Build Specification §2 BUILD-09):** AT-21, AT-22, AT-23, AT-24,
AT-25, AT-58, AT-66 + context manifest snapshot tests.

Plné znění AT z Technical Architecture v1.2 §32 (ověřeno živě v Notionu,
ne z paměti):
- **AT-21** Čistá emoční zpráva bez project entity → nesouvisející
  project/commitment context se nenačte.
- **AT-22** Emoční zpráva explicitně zmiňuje experiment → relevantní
  experiment context je dostupný.
- **AT-23** Hypotéza se bez explicitního deep-dive/review nedostane do
  běžného runtime.
- **AT-24** Third-person epizody nevytvoří automatický person
  claim/pattern.
- **AT-25** Relationship deep-dive může načíst relevantní epizody, ale
  output nesmí převést Honzíkův report na psychologický fakt o třetí
  osobě.
- **AT-58** Kontext přesáhne token budget → builder odřízne pouze nižší
  priority, P0 operational/current-message context zůstane a
  `omitted_item_ids` jsou auditované.
- **AT-66** Normal runtime request načte nejvýše 2 epizody o jedné třetí
  osobě; explicit relationship deep-dive může načíst více, ale
  `third_party_aggregation_allowed = false` zůstává vždy.

## Proč žádný STOP — schema/grant audit napřed, ne předpoklad

Grep proti migracím (ne domněnka):
- `context_packs`/`context_runs`/`context_run_items` (`0004_context.sql`,
  BUILD-02) i **všechny ostatní tabulky**, ze kterých bude Context
  Builder číst — `projects`/`priorities`/`commitments`/`open_loops`/
  `tasks`/`reminders` (`0005_executive.sql`), `experiments`/
  `experiment_observations` (`0006_experiments.sql`), `evidence_items`/
  `claims`/`claim_evidence`/`mechanisms` (`0007_evidence.sql`) — jsou
  **všechny** v `owner_scoped_tables` poli (`0011_roles_and_rls.sql`),
  takže `h2_runtime` už má plný `select, insert, update, delete` grant na
  každou z nich. `domains` má `select` grant (`h2_runtime`, `h2_job`).
- Žádná nová migrace, žádný nový credential — Context Engine sám
  nevolá žádný LLM, jen připravuje vstup pro budoucí BUILD-10.
- Jediný "dluh" z předchozích sliců, který BUILD-09 splácí: BUILD-08
  Rozhodnutí 4 (input token trimming pro `OPERATIONAL_EXTRACTION` — dnes
  jen output cap `maxOutputTokens=2048`, input strop čeká na tento slice).

## Co BUILD-09 znovu nestaví / proč budou P1–P4 v produkci zatím prázdné

Producentské tabulky pro P1–P4 kandidáty (`projects`/`commitments`/...
skutečné CRUD z BUILD-12, `experiments` z BUILD-17, `claims`/
`mechanisms`/`evidence_items` z BUILD-16/14) v produkci v době BUILD-09
**z velké části nemají žádná reálná data** — jejich producenti přijdou v
pozdějších slicích. BUILD-09 staví **mechanismus** (Context Builder), ne
naplnění dat — stejný vzor jako BUILD-05 (queue mechanismus dřív, než
BUILD-07/10 měly co skutečně zpracovávat) nebo BUILD-06/07/08
(injektovatelné funkce testované fejky/seedem, zapojení do živé cesty je
pozdější slice). Testy proto seedují tyto tabulky přímo (schéma existuje
od BUILD-02) — produkce zůstane s prázdnými P1–P4 kandidáty, dokud
BUILD-12/14/16/17 nedodají reálné řádky. To je očekávané, ne bug.

## Rozhodnutí 1: entity resolution v1 = BUILD-08 ENTITY kandidáti, ne nová extrakce

Build Specification zmiňuje "entity resolution" jako součást BUILD-09, ale
Technical Architecture nedefinuje samostatný resolver — jen požaduje, že
"zpráva přímo odkazuje na entity/project/experiment/commitment" (§7.3).
Skutečné pojmenované executive objekty (Projects/Commitments/...) vznikají
až BUILD-12. Jediný dnes živý zdroj "o čem je tahle zpráva" je BUILD-08
`operational_extractions` (`type='ENTITY'` kandidáti pro aktuální
`raw_event_id`).

**Rozhodnutí:** `h2/context/resolve-entities.ts` čte poslední `OK`
`operational_extractions` řádek pro daný `raw_event_id` a mapuje jeho
`ENTITY` kandidáty na `ResolvedEntity[]` (volný `label`/`refType`, žádná
FK na neexistující executive objekty). Relevance floor (Rozhodnutí
navazuje) pak matchuje P1–P4 zdroje proti těmto labelům jednoduchým
case-insensitive porovnáním jména (`projects.name`, `experiments.question`
atd.) — hrubé, ale deterministické a testovatelné. BUILD-12 může tenhle
resolver později nahradit skutečným entity-linking nad reálnými objekty;
BUILD-09 na to nechává čistý seam (`ResolvedEntity` typ, jeden bod
volání), ne zamknutou implementaci.

## Rozhodnutí 2: P0-overflow = hlasitá typovaná chyba, ne chunking flow

§7.4: "Pokud se do limitu nevejde samotný P0 obsah, builder nesmí potichu
sumarizovat nebo zahodit část user message; použije explicitní
large-input/chunking flow." Skutečný chunking flow je netriviální
feature bez dnešního use-case — `BUDDY_RESPONSE` má 24 000 vstupních
tokenů a P0 (current message + operační stav nutný k akci) dnes nemá
reálnou šanci to samo vyčerpat. Fingovat chunking teď by se stejně muselo
předělat, až se objeví konkrétní scénář (stejná logika jako BUILD-07's
škrt `h2/prompts/schemas/*.ts`).

**Rozhodnutí:** `fitToBudget()` při P0-overflow throwne `H2ContextBudgetError`
(`code: 'P0_EXCEEDS_BUDGET'`) — hlasitě, nikdy tiše. Skutečný
chunking/summarization flow zůstává budoucí, need-driven slice.

**Co se s jobem reálně stane (Honzíkova otázka):** BUILD-09 samo nevolá
`claimNextJob()`/`recordJobFailure()` — to je BUILD-05, zapojení do
job-processing cesty je BUILD-10 (stejně jako u zbytku Context Enginu).
Až se to zapojí, `H2ContextBudgetError` poteče přes **stejnou** uniformní
retry/backoff/karanténu jako každá jiná chyba (BUILD-05, BUILD-06
Rozhodnutí 6 — "žádná klasifikace retryable/non-retryable", `errorCode`
je jen observabilita, neřídí control flow). BUILD-09 tenhle uniformní
model nemění — přidávat teď retryable/non-retryable rozlišení by
znamenalo zasahovat do uzavřeného, mergnutého BUILD-05 kvůli
hypotetickému scénáři, který dnešní limity (24 000 vstupních tokenů pro
`BUDDY_RESPONSE`, P0 = current message + operační stav) reálně
nedosahují.

**Oprava k "tři zaplacená volání navíc":** `fitToBudget()` běží **před**
jakýmkoli LLM voláním (je to kontrola nad odhadnutými tokeny, ne nad
odpovědí modelu) — stejně jako retrofit input-trim v
`extractOperationalCandidates()` (Krok 1) běží před `callAnthropicModel()`.
Tři pokusy tedy nejsou tři zaplacená Anthropic volání, ale tři **rychlé,
bezplatné** no-op pokusy (žádný network call ven), jen zpožděné o
backoff (5 s → 15 s → 30 s ≈ 50 s) před karanténou. Cena je nulová,
cena je jen latence do karantény — akceptovatelné pro scénář, který dnes
navíc není dosažitelný (viz výše). Pokud by se to v budoucnu ukázalo
jako reálně dosažitelné a otravné, fast-track-do-karantény pro
deterministicky neopravitelné chyby je rozumné vylepšení BUILD-05 v
době BUILD-10 zapojení — ne teď, kvůli hypotéze.

## Rozhodnutí 3: `context_packs` mimo scope BUILD-09

`context_packs` (per-domain `summary` jsonb cache) není v Build
Specification DoD zmíněný (jen `context_runs`/`context_run_items` + AT
testy) a jeho FK na `domains` stejně nemá co ukazovat — `domains` se
seeduje až BUILD-18 (24-domain My Map). Nechávám tabulku netknutou;
budoucí slice (pravděpodobně BUILD-18 nebo BUILD-24) rozhodne, kdo a kdy
do ní píše.

## Rozhodnutí 4: zdroj "third-party episode" = `evidence_items.person_id`, ne nová tabulka

Architektura nemá samostatnou `persons`/`entities` tabulku — third-party
marker žije na `evidence_items.person_id` (`0007_evidence.sql`, sloupcový
komentář "vyplněno pro third-party evidence, §13"). Third-person cap
(AT-24/AT-25/AT-66, §31.10) se tedy vynucuje v `h2/context/sources/episodes.ts`
nad touto tabulkou (`person_id is not null` = third-party episode).
`evidence_items` je BUILD-14 producent — v produkci prázdná do té doby
(viz "Co BUILD-09 znovu nestaví" výše), testy seedují přímo.

## Implementační strategie: 4 kroky, ne jeden diff

BUILD-09 pokrývá 7 AT + snapshot testy + entity resolution + budget fit +
third-person boundary — výrazně větší než dosavadní slicey (BUILD-07 mělo
8 modulů/20 testů). Místo jednoho branch/PR (pravidlo "1 blok = 1
branch = 1 PR", BUILD-STATUS.md pravidlo 1) navrhuju **4 samostatné
branch/PR/merge cykly pod stejným BUILD-09**, každý nezávisle
mergovatelný a testovatelný, každý s vlastním evidence blokem v
BUILD-STATUS.md. AT ownership zůstává BUILD-09 jako celek (Build Spec
matice se nemění) — jde jen o to, jak se tam dojde. Tohle je Code-owned
implementační rozhodnutí (neotevírá Product Spec/I1–I8/architekturu), ale
píšu ho explicitně, ať vidíš členění dřív, než začnu.

### Krok 1 — Token Budget Contract + context_run persistence

`branch/h2-build-09-step1-token-budget`

- `h2/context/token-budget.ts` — `CONTEXT_TOKEN_BUDGETS`: pinned config
  pro všech 7 purposes z §7.4 tabulky (`BUDDY_RESPONSE` 24000/2048,
  `BUDDY_DEEP_DIVE` 48000/8192, `OPERATIONAL_EXTRACTION` 8000/2048,
  `BLIND_EXTRACTION` 8000/2048, `WEEKLY_FACTUAL_REVIEW` 32000/4096,
  `WEEKLY_EPISTEMIC_REVIEW` 48000/6144, `MONTHLY_REVIEW` 80000/8192).
  `estimateTokens(text)` — konzervativní heuristika (repo nemá
  tokenizer knihovnu; `input_tokens_estimated` vs `input_tokens_actual`
  ve schématu už počítá s tím, že estimate je aproximace, actual přijde
  z API response).
- `h2/context/priority.ts` — `ContextPriority = 'P0'|'P1'|'P2'|'P3'|'P4'`,
  `ContextCandidateItem` typ (`itemType`, `itemId`, `priority`, `reason`,
  `tokensEstimated`, `personId?`).
- `h2/context/budget-fit.ts` — `fitToBudget(p0Items, otherItems,
  maxInputTokens)`: čistá funkce, P0 nikdy neodřízne (Rozhodnutí 2 na
  overflow), jinak odřezává deterministicky `P4 → P1`. Vrací
  `{included, omitted, omissionReason}`.
- `h2/context/persist-context-run.ts` — `persistContextRun()`: jedna
  owner-scoped transakce, zapíše `context_runs` (agregátní
  `input_tokens_estimated`/`max_input_tokens`/`omission_reason` atd.) +
  `context_run_items` (per-item `included`/`priority`/`reason`, "current
  message" jako `item_type='CURRENT_MESSAGE'`, `item_id=rawEventId`,
  vždy `included=true`, `priority='P0'`).
- **Retrofit BUILD-08:** `extractOperationalCandidates()` nově počítá
  `estimateTokens(messageText)` proti
  `CONTEXT_TOKEN_BUDGETS.OPERATIONAL_EXTRACTION.maxInputTokens` (8000) —
  při overflow stejná hlasitá chyba jako Rozhodnutí 2 (žádné tiché
  ořezání user zprávy). Uzavírá BUILD-08 Rozhodnutí 4 debt.

**AT:** AT-58. **Testy:** `fitToBudget()` overflow scénář (jen non-P0
odřezáno, `omitted_item_ids` auditované), P0-overflow →
`H2ContextBudgetError`, `persistContextRun()` round-trip proti reálné
`h2_runtime` roli, retrofit test (dlouhá zpráva → extrakce odmítne
hlasitě, ne tiše).

**Proč je bezpečné mergnout samostatně:** všechny nové moduly jsou
čisté/injektovatelné funkce, které nikdo nevolá (Krok 2–4 na nich teprve
budou stavět) — jediná změna v už existujícím, dnes běžícím kódu je
retrofit `extractOperationalCandidates()`, a tu funkci žádná produkční
cesta zatím nespouští (BUILD-08 Rozhodnutí 3, žádný trigger). Merge tedy
nemění chování žijící produkce ani neponechává main v mezistavu, kde
něco volá něco neúplného — AT-58 je Kroku 1 vlastní a plně zelený sám o
sobě, DoD celého BUILD-09 se uzavírá až Krokem 4.

### Krok 2 — Deterministic relevance floor + entity resolution (v1)

`branch/h2-build-09-step2-relevance-floor`

- `h2/context/relevance-floor.ts` — `passesRelevanceFloor(candidate,
  resolvedEntities, purpose)`: 3 podmínky z §7.3 (přímý odkaz na
  entity/project/experiment/commitment; nutný operační stav k akci;
  explicitní deep-dive).
- `h2/context/resolve-entities.ts` — `resolveMessageEntities()`
  (Rozhodnutí 1): čte poslední `OK` `operational_extractions` pro
  `raw_event_id`, mapuje `ENTITY` kandidáty na `ResolvedEntity[]`.

**AT:** AT-21, AT-22, AT-23. **Testy:** čistá emoční zpráva bez entit →
floor odmítne nesouvisející candidate (AT-21); resolved entity typu
experiment → floor propustí matchující experiment candidate (AT-22);
`purpose='BUDDY_RESPONSE'` + hypotéza (`claims.state='HYPOTEZA'`) → floor
odmítne, `purpose='BUDDY_DEEP_DIVE'` → floor propustí (AT-23).

**Proč je bezpečné mergnout samostatně:** `relevance-floor.ts` a
`resolve-entities.ts` jsou další čisté/read-only funkce bez volajícího —
nezasahují do Kroku 1 (na jeho typech jen stojí) ani do žádné produkční
cesty. AT-21/22/23 se ověřují přímo proti těmto funkcím (unit úroveň),
ne přes nedokončenou orchestraci — takže jsou zeleně testovatelné a
uzavřené už v tomto kroku, bez závislosti na Kroku 3/4.

### Krok 3 — Source providers (P1–P4) + third-person cap

`branch/h2-build-09-step3-source-providers`

- `h2/context/sources/executive.ts` — `projects`/`commitments`/`tasks`/
  `open_loops`/`reminders` kandidáti (P1, aktivní stav + entity match).
- `h2/context/sources/knowledge.ts` — `mechanisms`/`claims`
  (`state in ('VALIDOVANO','MECHANISMUS','LIVING_OS')` only — P2) +
  `experiments` (P1, entity match — AT-22 zdroj).
- `h2/context/sources/episodes.ts` — third-party cap (Rozhodnutí 4):
  max 2 `evidence_items.person_id` epizody normální runtime / max 10
  explicit deep-dive, `third_party_aggregation_allowed=false` vždy,
  nikdy negeneruje person claim/pattern objekt (I5).

**AT:** AT-24, AT-25, AT-66. **Testy:** third-party epizody nevytvoří
person claim (AT-24), deep-dive output zůstává Honzíkův report o
zkušenosti, ne fakt o osobě (AT-25 — assert na tvar/labeling výstupu, ne
jen na count), normal cap 2 / deep-dive cap 10, `third_party_aggregation_allowed`
vždy `false` i při deep-dive (AT-66).

**Proč je bezpečné mergnout samostatně:** source providery jsou
read-only query funkce nad tabulkami, které dnes v produkci nemají
reálná data (viz "Co BUILD-09 znovu nestaví") — vrací prázdné/testovací
seznamy, nic je zatím nevolá mimo testy. AT-24/25/66 (third-person cap)
se ověřují přímo na `episodes.ts` nad seedovanými `evidence_items`, takže
jsou uzavřené a zelené bez čekání na Krok 4's orchestraci.

### Krok 4 — `buildContextPack()` orchestrace + context manifest snapshot testy

`branch/h2-build-09-step4-orchestration`

- `h2/context/build-context-pack.ts` — `buildContextPack(pool, ownerId,
  purpose, rawEventId, messageText)`: `resolveMessageEntities()` →
  kandidáti ze všech source providerů (Krok 3) → `passesRelevanceFloor()`
  filtr (Krok 2) → `fitToBudget()` (Krok 1) → `persistContextRun()`
  (Krok 1) → vrátí sestavený context manifest (P0 + included P1–P4
  položky, připravené pro budoucí BUILD-10 prompt assembly).
- Context manifest snapshot testy (explicitní DoD položka z Build
  Specification) — několik reprezentativních scénářů serializovaných a
  assertovaných na stabilní tvar.

**Uzavírá DoD celého BUILD-09** — end-to-end průchod všech 7 AT přes
`buildContextPack()`, ne jen izolované jednotky z Kroků 1–3.

**Proč je bezpečné mergnout samostatně:** `buildContextPack()` je nová
volatelná funkce, kterou po mergi Kroku 4 pořád nic v produkci nespouští
(žádný route/job trigger — zapojení je BUILD-10, stejně jako u BUILD-05
až BUILD-08). Merge tohoto kroku tedy nemění chování žijící produkce;
rozdíl oproti Krokům 1–3 je jen v tom, že tady se poprvé skládá DoD
celého slicu dohromady (celý AT-21..25/58/66 set + snapshot testy), ne v
tom, že by main po mergi byl v nekonzistentním mezistavu.

## Test plán (souhrn)

Detaily u jednotlivých kroků výše. Souhrnně: 7/7 AT (AT-21, AT-22, AT-23,
AT-24, AT-25, AT-58, AT-66) + snapshot testy + retrofit BUILD-08 input
trim test. Testy pod skutečnou rolí `h2_runtime` (stejný vzor jako
BUILD-04–08), s přímým seedem `projects`/`experiments`/`claims`/
`evidence_items`/... (schéma z BUILD-02, žádné čekání na BUILD-12/14/16/17
data).

## Co zůstává mimo scope (vědomě)

- Zapojení do živé Buddy runtime cesty — `buildContextPack()` je
  volatelná přímo, žádný produkční trigger (stejný vzor jako
  BUILD-05/06/07/08). Zapojení je BUILD-10.
- Skutečný chunking/summarization flow pro P0 overflow (Rozhodnutí 2) —
  dnes nedosažitelný scénář.
- `context_packs` per-domain summary cache (Rozhodnutí 3).
- Reálná data v P1–P4 producentských tabulkách — přijdou s
  BUILD-12/14/16/17.
- Vylepšená entity resolution nad skutečnými executive objekty
  (Rozhodnutí 1) — BUILD-12's rozhodnutí, ne BUILD-09.
- Reasoning Lab UI/flow samotný (explicitní deep-dive request) —
  BUILD-09 jen respektuje `purpose='BUDDY_DEEP_DIVE'` jako vstupní
  parametr, kdo/jak ho nastaví je BUILD-10/BUILD-26.

## Co potřebuji od Honzíka

**Nic mechanického** — žádná migrace, žádný nový credential, žádná nová
env proměnná v žádném ze 4 kroků (ověřeno gramaticky proti migracím
výše, ne předpokladem). Jediné, co budu potřebovat průběžně, je běžné
**GO na merge** každého ze 4 kroků do `main` (push branche + otevření PR
GO nepotřebuje, jak je zavedené pravidlo 4 v BUILD-STATUS.md). Pokud
během implementace narazím na něco, co tenhle plán neřeší, zastavím se a
napíšu — **ale dnes žádný takový bod nevidím.**
