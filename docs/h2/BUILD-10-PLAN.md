# BUILD-10 — Buddy runtime — návrh plánu

**Status (aktualizace 2026-09-03):** Implementace hotová na branchi
`build/h2-build-10-buddy-runtime` (commit `c3126d1`), čeká na push+PR+
Honzíkovo GO k mergi. `H2_ANTHROPIC_API_KEY` je od 2026-09-03 živě
ověřen na Vercelu (production i preview, `check-required-env.ts`) —
blokátor č. 1 z původního znění téhle sekce je pryč. Ruční certifikace
prvního `BUDDY_RESPONSE` promptu proti reálnému Sonnetu
(`activatePromptVersion()`, BUILD-07 — vyžaduje recent re-auth, kterou
umí udělat jen Honzík v prohlížeči) zůstává samostatný, neproběhlý krok
— **žádné reálné Sonnet volání v téhle implementaci neproběhlo**,
všech 16 nových testů běží proti mockovanému `callAnthropicModel`
(stejná disciplína jako BUILD-07/08/09). Detaily viz Evidence blok v
[BUILD-STATUS.md](./BUILD-STATUS.md).

Command Gate scope je oproti návrhu níže zúžený — implementována jen
exact-match re-detekce `/stop`/`/pause`/`/resume` (DEC-007 bod 5). Bare-
word/IGNORE/DELETE/HARD_DELETE/RECONSIDER/CORRECT detekce zůstává mimo
scope: přesná protokolová syntaxe (I7.7) je jen v uzamčené Notion §8.1
v plném znění, ne v tomhle plánu ani v DECISIONS.md — hádání by
riskovalo I7.6 porušení. Forward-pointer, ne provedeno.

Otázka umístění Command Gate (§8.1 Sovereignty Fast Lane) je od
2026-09-03 **vyřešená** — [DEC-007](./DECISIONS.md#dec-007), rozhodnutí
Honzíka po adversarial review přes GPT: **C2**, control fast path jako
side effect v ingestu, nikdy jako exkluzivní routing. Implementace
retrofitu do BUILD-04 (`h2/ingestion/ingest-message.ts`) je hotová
samostatně, PŘED zbytkem BUILD-10 (viz sekce "DEC-007" níže) — branch
`build/h2-build-04-command-fast-path-retrofit`, čeká na Honzíkovo GO k
mergi (push+PR proběhly, merge ne).

## Rozsah (Build Specification §2 BUILD-10, Technical Architecture v1.2 §7, §8)

- stance `BE_WITH | EXPLORE | ACT` (§7.2),
- intent layer (§7.2: `SHARE, EVENT, SELF_REPORT, EMOTION, IDEA, QUESTION,
  TASK, PROJECT, DECISION, COMMITMENT, RECONSIDERATION, OPEN_LOOP,
  CORRECTION, DELETE, REMINDER, PLANNING, REFLECTION`),
- short mobile-first responses,
- max jedna otázka defaultně,
- no forced psychoanalysis,
- commands/sovereignty gate před reasoningem (§8),
- Response object durable commit před delivery.

**DoD (Build Specification §2 BUILD-10):** AT-09, AT-50, AT-62.

Plné znění (ověřeno živě v Notionu, §32):
- **AT-09** Crash po action write → retry nevytvoří druhý side effect.
- **AT-50** Žádný LLM output není přímo autoritativním DB state
  transition bez deterministic validation.
- **AT-62** Response je durable committed, processor crashne před
  delivery → retry znovu nevolá Sonnet, použije stejný response
  ID/text a provede pouze chybějící idempotentní side effects.

## §7.1 Runtime pipeline (co BUILD-10 orchestruje)

```
CURRENT MESSAGE
  ↓
COMMAND GATE                    ← §8, DEC-007 (fast path v BUILD-04 hotový, pipeline stage tady)
  ↓
ENTITY / INTENT DETECTION       ← BUILD-08 (operational_extractions) + nový intent klasifikátor
  ↓
CONVERSATION STANCE             ← nový, BE_WITH/EXPLORE/ACT
  ↓
DETERMINISTIC RELEVANCE FLOOR   ← BUILD-09 (hotovo, MERGED)
  ↓
CONTEXT PACK RETRIEVAL          ← BUILD-09 buildContextPack() (hotovo, MERGED)
  ↓
EPISTEMIC + PRIVACY FILTER      ← nový (I4/I5 enforcement nad manifestem)
  ↓
BUDDY MODEL                     ← BUILD-07 callAnthropicModel(H2_MODELS.buddy) (hotovo, MERGED)
  ↓
ACTION VALIDATION               ← nový, ale bez skutečných ACT capabilities dnes (viz scope)
```

BUILD-10 je z velké části **skládačka už hotových mechanismů** (BUILD-05
queue/lease/fencing, BUILD-07 prompt registry/model adapter, BUILD-08
operational extraction, BUILD-09 Context Engine) + tři nové vrstvy:
Command Gate, stance/intent klasifikace, epistemic/privacy filtr nad
manifestem.

## Co BUILD-10 znovu nestaví

- `responses`/`response_deliveries` schéma — hotové z BUILD-02
  (`0002_messaging.sql`). `responses.source_raw_event_id` je **UNIQUE**
  — druhá vrstva obrany proti duplicitní odpovědi vedle fencingu.
- `commitJobResult(pool, registry, token, work)` (BUILD-05,
  `h2/processing/commit.ts`) — atomický, fencing-chráněný zápis
  `responses` řádku + `owner_processing_state` update. BUILD-10 do něj
  jen dodá `work()` (zavolá Sonnet, sestaví plaintext odpověď).
- `claimNextJob()`/`renewLease()`/`recordJobFailure()`/`quarantineJob()`
  (BUILD-05) — queue/retry/backoff/karanténa beze změny.
- `callAnthropicModel(modelId, promptContent, input, apiKey,
  maxOutputTokens)` + `recordLlmRun()` + `recordAnthropicUsage()`
  (BUILD-07) — Sonnet volání, provenance, metering. `H2_MODELS.buddy =
  'claude-sonnet-5'`.
- `getActivePromptVersion(pool, 'BUDDY_RESPONSE')` (BUILD-07) — prompt
  registry, `activatePromptVersion()` gate (recent re-auth + passing
  test run) beze změny.
- `buildContextPack(pool, ownerId, purpose, rawEventId, messageText)`
  (BUILD-09, právě MERGED) — celý Context Engine (relevance floor,
  token budget, third-person cap, audit trail). BUILD-10 mu jen
  předá `purpose='BUDDY_RESPONSE'` (nebo `'BUDDY_DEEP_DIVE'` u
  explicitního deep-dive) a dostane zpátky manifest.
- `resolveMessageEntities()`/operational extraction (BUILD-08) — pro
  entity detekci uvnitř Context Enginu, beze změny.

## DEC-007 — umístění Command Gate (vyřešeno, C2)

Plné znění rozhodnutí, adversarial review nálezu a I7.1–I7.7
sub-invariantů je v [docs/h2/DECISIONS.md](./DECISIONS.md#dec-007).
Souhrn pro tenhle plán:

**Co bylo špatně na mém prvním doporučení (B):** navrhoval jsem, aby
control command **vůbec nevytvořil** `message_processing_job` — GPT
review našlo reálnou chybu: chybná/hraniční klasifikace textu by tak
**nevratně** připravila tu konkrétní zprávu o normální zpracování
(I7.6). To je horší než pomalá reakce na PAUSE/STOP, ne lepší.

**Rozhodnutí (C2), implementačně:**
1. `ingestMessage()` (BUILD-04) **vždy** vytvoří `raw_event` i
   `message_processing_job` — i pro control command. Žádná zpráva
   nikdy nezmizí z lifecycle kvůli klasifikaci.
2. Přesná syntaxe `/stop`/`/pause`/`/resume` (trim, case-insensitive,
   celá zpráva) navíc zavolá `bumpOwnerControlEpochWithClient()` ve
   **stejné** transakci jako insert `raw_event`u (dědí dedup + per-owner
   ordering — žádná druhá transakce, žádné crash window).
3. Holé "stop"/"pause" v přirozené větě řeší až Command Gate stage
   uvnitř BUILD-10's vlastní pipeline (kontext, ne destruktivní při
   chybě).
4. `IGNORE` (potřebuje cíl) zůstává výhradně v Command Gate stage, ne
   ve fast path.
5. Job z control commandu BUILD-10 zpracuje jako no-op s potvrzením —
   Command Gate re-detekuje **stejnou** `detectFastPathControlCommand()`
   funkcí; shoda je strukturální důkaz, že epoch už byl bumpnutý při
   ingestu (žádný nový sloupec/marker, žádná migrace).

**Implementační stav:** retrofit bodu 1–2 do BUILD-04 je hotový
samostatně (`h2/ingestion/control-fast-path.ts` — sdílená
`detectFastPathControlCommand()`, `h2/processing/control-epoch.ts` —
nová `bumpOwnerControlEpochWithClient()` vedle stávající pool-based
verze, `h2/ingestion/ingest-message.ts` — volá obojí v existující
transakci). Branch `build/h2-build-04-command-fast-path-retrofit`,
push+PR proběhly, **čeká na Honzíkovo GO k mergi** (zásah do uzavřeného
BUILD-04, samostatně reviewovatelný před zbytkem BUILD-10). Bod 3–5
(Command Gate stage, no-op zpracování) zůstává implementace BUILD-10
samotného — viz "Návrh API" níže.

**Ověření I7.5 proti `commitJobResult()` (na Honzíkovu žádost):** platí
beze změny kódu pro jediný navenek viditelný efekt, který BUILD-10 samo
přidává — zápis `responses` řádku (fencing check nad `lease_epoch` +
`owner_control_epoch` atomicky, BUILD-05 AT-67/AT-71). **Nalezená
mezera mimo BUILD-10 scope:** skutečné **odeslání** odpovědi je BUILD-11's
`response_deliveries` mechanismus, který dnes **nemá žádnou
`owner_control_epoch` kontrolu** (schéma z BUILD-02 epoch sloupec vůbec
nenese) — committed-ale-nedoručená odpověď se dnes doručí i po
mezitímním PAUSE/STOP. Není to BUILD-10/BUILD-05 mezera (delivery
mechanismus ještě neexistuje), ale je to otevřený bod pro **BUILD-11
plánování** — zapsáno zde jako forward-pointer, neřeším ho teď
vymýšlením BUILD-11 kódu předčasně.

## Rozhodnutí 1 (návrh, ne konečné): AT-62 dedup check před `work()`

`commitJobResult()` (BUILD-05) volá `work()` **bezpodmínečně** při
každém volání — nemá vlastní "už jsem tohle udělal?" check.
`responses.source_raw_event_id` je UNIQUE, takže duplicitní insert by
spadl na DB constraint, ale to je *pozdě* — Sonnet by se mezitím
zavolal a zaplatil znovu, což AT-62 explicitně zakazuje ("retry znovu
nevolá Sonnet").

**Návrh:** BUILD-10's job-processing funkce (volající `commitJobResult`)
udělá vlastní pre-check **před** sestavením `work()`: `select id,
payload_ciphertext from responses where source_raw_event_id = $1`. Pokud
řádek existuje, přeskočí `callAnthropicModel()` úplně, dešifruje
existující text a provede jen zbývající idempotentní side effects
(např. re-trigger delivery scheduling pro BUILD-11, pokud ta ještě
neproběhla) — přesně AT-62 znění.

## Rozhodnutí 2 (návrh): ACT capability validation je dnes no-op

§7.1's poslední stage "ACTION VALIDATION" předpokládá reálné ACT
capabilities (Calendar write, atd.) — ty přicházejí až BUILD-13+.
`action_permissions`/`action_executions` schéma existuje (BUILD-02), ale
nemá dnes co validovat. **Návrh:** BUILD-10 stage existuje jako
pojmenovaný krok (typed no-op passthrough), aby pipeline měla správný
tvar pro budoucí zapojení, ale fakticky nic nevaliduje/nespouští, dokud
BUILD-13+ nedodá první reálnou ACT capability.

## Návrh API (bude upřesněno při implementaci)

- `h2/buddy/command-gate.ts` — Command Gate stage (DEC-007 bod 3–5):
  re-detekuje `detectFastPathControlCommand()` (sdílené s BUILD-04,
  `h2/ingestion/control-fast-path.ts`) — shoda = epoch už bumpnutý při
  ingestu, Gate NESMÍ bumpnout znovu, jen sestaví potvrzení jako no-op
  response. Širší, kontextová klasifikace (holé "stop" ve větě, `IGNORE`
  s cílem, `DELETE`/`HARD_DELETE`/`RECONSIDER`/`CORRECT`) je samostatná
  logika v tomhle stage, pořád deterministická, ne LLM (§8.1 "nejde o
  LLM klasifikaci a detector nesmí hádat význam běžné věty", I7.7
  "control intent má být protokolová struktura, ne odvozený z
  přirozeného jazyka").
- `h2/buddy/intent.ts` — typy pro intent enum (§7.2), klasifikace zatím
  pravděpodobně přes stejné Haiku/Sonnet volání jako stance (upřesnit
  při implementaci — možná součást jednoho Sonnet volání s structured
  output, ne samostatný model call navíc kvůli nákladům).
- `h2/buddy/generate-response.ts` — `generateBuddyResponse(pool,
  registry, credentials, token)`: AT-62 dedup check → Command Gate →
  `buildContextPack()` → `getActivePromptVersion(pool,
  'BUDDY_RESPONSE')` → `callAnthropicModel()` → `commitJobResult()` s
  `work` closure.
- Drobné rozšíření `h2/processing/commit.ts`? Pravděpodobně ne — `work`
  closure pattern už existuje a stačí.

## Test plán (návrh, upřesní se)

- AT-09: crash po `commitJobResult()` (response write), retry
  nevytvoří druhý `responses` řádek ani druhé volání Sonnetu (navazuje
  na Rozhodnutí 1 dedup check).
- AT-50: fake/malformed Sonnet output → žádná přímá DB state transition
  bez zod/deterministické validace (stejný vzor jako BUILD-08's
  OperationalExtractionOutputSchema).
- AT-62: fencing selže PO úspěšném Sonnet volání ale PŘED commitem →
  druhý pokus najde existující `responses` řádek (Rozhodnutí 1), nevolá
  Sonnet znovu, dokončí jen chybějící side effecty.
- Command Gate: `detectSovereigntyCommand()` unit testy (exact match,
  ne fuzzy — běžná věta obsahující slovo "stop" uprostřed věty se
  NESMÍ detekovat jako command).
- Mockovaný `callAnthropicModel` v CI (stejné jako BUILD-07/08/09
  fixtures) — žádné reálné Sonnet volání v automatických testech.
  Ruční certifikace proti reálnému Sonnetu je samostatný krok (viz STOP
  výše).

## Co zůstává mimo scope (vědomě)

- Skutečné ACT capabilities (Calendar write atd.) — BUILD-13+.
- Delivery (Telegram/web outbound) — BUILD-11.
- Reálná exekuce DELETE/HARD_DELETE/RECONSIDER příkazů detekovaných
  Command Gate — hluboká sémantika je BUILD-12 (Reconsideration)/BUILD-20
  (Deletion Ledger); BUILD-10 je jen detekuje a routuje.
- Skutečná fencing kontrola na delivery (BUILD-11 mezera nalezená při
  DEC-007 review, viz výše) — mimo scope BUILD-10, forward-pointer pro
  BUILD-11.
- Reasoning Lab UI (explicitní deep-dive request z produktu) — BUILD-10
  jen respektuje `purpose='BUDDY_DEEP_DIVE'` jako vstup do
  `buildContextPack()`, odkud přijde je BUILD-26 (web UI).

## Co potřebuji od Honzíka (aktualizace 2026-09-03)

1. ~~`H2_ANTHROPIC_API_KEY` ve Vercelu~~ — HOTOVO, živě ověřeno
   `check-required-env.ts` proti production i preview.
2. **Ruční certifikace prvního `BUDDY_RESPONSE` promptu** proti reálnému
   Sonnetu — `activatePromptVersion()` vyžaduje recent re-auth (5min
   okno, jen v prohlížeči) + passing test run + zatím neexistující DRAFT
   `prompt_versions` řádek pro `BUDDY_RESPONSE` (žádný `createDraftPrompt
   Version()` call dnes v produkci pro žádný purpose neproběhl — stejná
   mezera jako BUILD-08's `OPERATIONAL_EXTRACTION`). Zůstává jediný
   krok, u kterého Honzík chce být osobně přítomen.
3. ~~Rozhodnutí o umístění Command Gate~~ — HOTOVO, [DEC-007](./DECISIONS.md#dec-007) (C2).
4. ~~GO na merge retrofit PR~~ — HOTOVO, PR #32 mergnut (`57190c5`).
5. **GO na push branche `build/h2-build-10-buddy-runtime` a otevření PR**
   — implementace hotová, 217/217 testů lokálně, tsc/build čisté (viz
   Evidence blok v BUILD-STATUS.md). Push/PR podle Pravidla 4 GO
   nepotřebují, ale Honzík chtěl vidět dokončený stav před timto krokem.

Zbývá jen bod 2 — bez aktivního `BUDDY_RESPONSE` promptu
`generateBuddyResponse()` v produkci vždy vyhodí `H2BuddyRuntimeError
("NO_ACTIVE_PROMPT")` pro cokoliv, co není přesný `/stop`/`/pause`/
`/resume` (ten projde bez promptu, je to Command Gate no-op).
