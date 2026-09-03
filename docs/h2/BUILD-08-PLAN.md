# BUILD-08 — Operational extraction — schválený plán

**Status:** SCHVÁLENO Honzíkem 2026-09-03, s doplněním Rozhodnutí 5
(vlastní `model_id`/`purpose` pro Haiku metering, odlišné od Sonnetu) na
jeho výslovný požadavek. Implementace začíná v nové session (čisté
rehydratace) — tenhle commit je jen zápis schváleného plánu.

## Rozsah (Build Specification v1.0, Technical Architecture v1.2 §6.1, §7.4)

- Realtime Haiku extrakce strukturovaných kandidátů pro **operational
  needs**: intent, entities, commands, tasks, reminders, open loops,
  explicitní user actions,
- nesmí být psychologickou evidence promotion cestou (žádné dlouhodobé
  claims — to je blind extraction / evidence architektura, BUILD-14/16),
- typed output + deterministic validator.

**DoD (Build Specification §6 — BUILD-08 nemá vlastní AT owner, stejná
třída jako BUILD-01/02/13/18):** invalid/malformed structured result
nesmí změnit operational DB state. Ověřuje se schema/unit/integration
testy tohoto slicu, ne AT číslem — "to neznamená, že je volitelné"
(Build Spec §6).

## Co BUILD-08 znovu nestaví

Skoro celá infrastruktura je hotová z BUILD-07: `callAnthropicModel()`
(Haiku volání), `recordLlmRun()`, `recordAnthropicUsage()`, prompt
registry (`createDraftPromptVersion`/`runPromptFixtureSuite`/
`activatePromptVersion` pro `purpose='OPERATIONAL_EXTRACTION'`). BUILD-08
tohle nestaví znovu — jen to použije s Haiku modelem a extrakčně
specifickým výstupním tvarem.

`operational_extractions` (BUILD-02, `0003_prompts_and_llm.sql`) už má
plný CRUD+RLS grant pro `h2_runtime` (je v `owner_scoped_tables`) —
**žádná nová migrace**. Žádný nový credential — Haiku běží přes stejný
`H2_ANTHROPIC_API_KEY` jako Sonnet (BUILD-07).

**Explicitně: pro tenhle slice neočekávám žádný STOP.** Implementace,
testy i merge nepotřebují nic od tebe — žádnou migraci, žádný nový
credential, žádný nový balíček. Jediná budoucí závislost na
`H2_ANTHROPIC_API_KEY` je stejná, už otevřená položka z BUILD-07 (ruční
certifikace promptu), ne nová.

## Rozhodnutí 1: výstupní tvar — obecný kandidátní kontejner, ne finální objekty

Architektura řadí "intent, entities, commands, tasks, reminders, open
loops, explicitní user actions" pod jeden extrakční výstup, ale skutečné
CRUD/state machines pro Projects/Commitments/Tasks/Open Loops/Reminders
jsou **BUILD-12**, ne BUILD-08. BUILD-08 tedy nevytváří žádné řádky v
`tasks`/`commitments`/`open_loops`/`reminders` — jen zapisuje
**kandidáty** do `operational_extractions.output` (jsonb).

Zod schéma (`h2/extraction/operational-schema.ts`) je záměrně obecný
kontejner:
```ts
{
  candidates: Array<{
    type: "INTENT" | "ENTITY" | "COMMAND" | "TASK" | "REMINDER" | "OPEN_LOOP" | "USER_ACTION",
    payload: Record<string, unknown>,
    confidence?: number,
  }>
}
```
Hluboká validace obsahu `payload` (např. přesný tvar TASK kandidáta) je
BUILD-12's rozhodnutí, až bude vědět, co skutečně konzumuje — fingovat
ho teď by se stejně muselo předělat (stejná logika jako BUILD-07's škrt
`h2/prompts/schemas/*.ts`).

## Rozhodnutí 2: `operational_extractions.status` — OK/INVALID teď, REJECTED rezervováno

Schéma (`0003_prompts_and_llm.sql`) definuje `status in ('OK', 'INVALID',
'REJECTED')`, ale architektura nespecifikuje rozdíl mezi `INVALID` a
`REJECTED` explicitně (na rozdíl od `blind_extractions`, kde `REJECTED_
FAIL_CLOSED` má jasný, jinde definovaný význam — zakázaná reference).

**Rozhodnutí:** BUILD-08 produkuje jen `OK` (zod validace prošla) a
`INVALID` (zod validace selhala — malformed/neplatný JSON tvar). `REJECTED`
zůstává ve schématu nepoužité, rezervované pro budoucí business-rule
odmítnutí (např. BUILD-12 objeví kandidáta, co porušuje nějakou
doménovou hranici) — nevymýšlím ho teď bez konkrétního use-case.

**DoD naplněno takhle:** `INVALID` řádek se do `operational_extractions`
zapíše (auditní/observabilní účel — víme, že se pokus stal a selhal), ale
protože BUILD-08 vůbec nezapisuje do žádné jiné "operational" tabulky
(`tasks`/`commitments`/...), invalid výsledek nemá kam propsat škodu —
"operational DB state" ve smyslu věcí, co BUILD-12 později čte, zůstává
nedotčené triviálně, ne složitým rollbackem.

## Rozhodnutí 3: žádný produkční trigger (stejné jako BUILD-05/06/07)

`extractOperationalCandidates()` je volatelná přímo (testy, budoucí ruční
skript), ale nic ji dnes nevolá automaticky z webhook/queue cesty.
Skutečné zapojení "extrakce běží při každé zprávě souběžně s Buddy
odpovědí" patří **BUILD-10** (Buddy runtime), který jediný ví, kdy a jak
extrakci zavolat vůči skutečnému konverzačnímu tahu. Stejný důvod jako
předchozí sliky: BUILD-08 dává mechanismus, ne zapojení.

## Rozhodnutí 4: token budget — jen output cap teď, input trimming je BUILD-09

Architektura §7.4 pinuje `OPERATIONAL_EXTRACTION` na `max_input_tokens=
8000`, `max_output_tokens=2048`. BUILD-08 nastaví `maxOutputTokens=2048`
na Haiku volání (drobné rozšíření `callAnthropicModel()` o volitelný
parametr, default zůstává současných 4096 pro Sonnet). **Input strop/
trimming (P0–P4 deterministic relevance floor, token budget enforcement
napříč purpose) je celý BUILD-09 (Context Engine)** — BUILD-08 zatím
extrahuje jen z jednoho syrového user tahu (plaintext zprávy), ne z
sestaveného context packu, takže input header dnes nemá co trimovat.

## Rozhodnutí 5: vlastní `model_id` a vlastní `purpose` pro metering — od začátku rozlišitelné

Haiku volání běží pod stejným `H2_ANTHROPIC_API_KEY` jako Sonnet
(Rozhodnutí, žádný nový credential), ale v `usage_ledger`/`llm_runs`
nesmí splynout do jedné položky, jinak nejde zpětně zjistit, co přesně
utrácí — Honzíkův výslovný požadavek.

**Rozhodnutí, explicitně:**
- `model_id = H2_MODELS.extraction` (`claude-haiku-4-5-20251001`) — **nikdy**
  `H2_MODELS.buddy`. `recordAnthropicUsage()`/`recordLlmRun()` (BUILD-07,
  beze změny) už berou `modelId` jako parametr, takže tohle není nová
  funkcionalita — jen disciplína v tom, čím `extractOperationalCandidates()`
  volání parametrizuje. Cenově se to navíc přirozeně odliší samo
  (`ANTHROPIC_PRICING_USD_PER_MTOK['claude-haiku-4-5-20251001']` = `$1`/`$5`
  za MTok, ne Sonnetových `$2`/`$10` — smíchání by bylo poznat i na
  chybné ceně, ne jen na chybějícím rozlišení).
- `purpose = 'OPERATIONAL_EXTRACTION'` — **vlastní**, odlišný od
  `'BUDDY_RESPONSE'` (budoucí BUILD-10) i od `'voice_transcription'`
  (BUILD-06). Přesně stejný string se používá na třech místech
  konzistentně: `prompt_versions.purpose`, `llm_runs.purpose`,
  `usage_ledger.purpose` — jedna hodnota, žádný alias/zkratka.
- Důsledek pro `checkModelDrift()` (BUILD-07, beze změny kódu): už dnes
  mapuje `purpose` → `H2ModelPurpose` přes `PURPOSE_TO_MODEL_PURPOSE`
  slovník, kde `OPERATIONAL_EXTRACTION → 'extraction'` je **už zapsáno**
  (BUILD-07 `h2/prompts/model-drift.ts`) — BUILD-08 na tomhle nic nemění,
  jen ho poprvé skutečně použije.
- Testový důkaz (Test plán, doplnit): po fake Haiku volání assert
  `llm_runs.model_id === 'claude-haiku-4-5-20251001'` (ne Sonnet ID) a
  `usage_ledger` řádky mají `purpose='OPERATIONAL_EXTRACTION'`, cena
  odpovídá Haiku sazbě — ne jen "nějaký model_id/usage existuje", ale
  přesně TENHLE.

## Návrh API (bude upřesněno při implementaci)

- `h2/extraction/operational-schema.ts` — zod `OperationalExtractionOutputSchema` (Rozhodnutí 1).
- `h2/extraction/operational-extraction.ts` — `extractOperationalCandidates(pool, ownerId, rawEventId, messageText, credentials, callModel?)`: `getActivePromptVersion(pool, 'OPERATIONAL_EXTRACTION')` → `callAnthropicModel()` (injektovatelné, stejný vzor jako BUILD-06/07) → zod validace → jedna transakce: `insert operational_extractions` (status OK/INVALID) + `recordLlmRun()` + `recordAnthropicUsage()`, atomicky (Rozhodnutí z BUILD-07 beze změny — zavolalo se, zaplatilo se, i při INVALID).
- Drobná úprava `h2/prompts/anthropic-adapter.ts` — `callAnthropicModel(modelId, promptContent, input, apiKey, maxOutputTokens = 4096)`.

## Test plán

- Happy path: fake `callModel` vrátí validní kandidáty → `operational_extractions` řádek `status='OK'`, `output` odpovídá vstupu, `llm_runs` + 2 `usage_ledger` řádky (Anthropic metering, BUILD-07 beze změny).
- Malformed output: fake `callModel` vrátí nevalidní tvar → `status='INVALID'`, **přesto** se zapíše `llm_runs`/usage (zavolalo se, zaplatilo se — konzistentní s BUILD-07 AT-34 testem). Assert, že žádná jiná tabulka (`tasks`/`commitments`/`open_loops`/`reminders`) nemá žádný nový řádek (DoD — "nesmí změnit operational DB state").
- Žádná `ACTIVE` verze pro `OPERATIONAL_EXTRACTION` purpose → `extractOperationalCandidates()` vrátí explicitní chybu, ne tichý no-op.
- `callAnthropicModel()` s `maxOutputTokens` parametrem → assert `max_tokens` v request body odpovídá.
- **Metering rozlišitelnost (Rozhodnutí 5):** po happy-path testu assert `llm_runs.model_id === 'claude-haiku-4-5-20251001'` (přesně, ne jen "nějaký model"), `llm_runs.purpose === 'OPERATIONAL_EXTRACTION'`, oba `usage_ledger` řádky mají stejný `purpose`/`model_id` a `cost_usd` odpovídá Haiku sazbě (`$1`/`$5` za MTok), ne Sonnetově.

## Co zůstává mimo scope (vědomě)

- Skutečné vytváření/aktualizace `tasks`/`commitments`/`open_loops`/`reminders`/`projects` z kandidátů (BUILD-12).
- Zapojení do live message-processing/Buddy runtime cesty (BUILD-10).
- Input-side token budget/context assembly (BUILD-09 Context Engine).
- Business-rule `REJECTED` odmítnutí (nespecifikováno, rezervováno beze změny).
- Ruční certifikace `OPERATIONAL_EXTRACTION` promptu proti reálnému Haiku — stejná otevřená položka jako BUILD-07, ne nová.
