# BUILD-07 — Prompt Registry & model adapter — schválený plán

**Status:** SCHVÁLENO Honzíkem 2026-09-03, s doplněním Rozhodnutí 3
(Anthropic metering od prvního dne) a Rozhodnutí 7 (strojová kontrola
"jen `activatePromptVersion()` zapisuje ACTIVE") na jeho výslovný
požadavek. `H2_ANTHROPIC_API_KEY` se zakládá až u reálného STOPu, ne
dřív — implementace, testy i merge běží bez něj.

## Rozsah (Build Specification v1.0, Technical Architecture v1.2 §9)

- Anthropic adapter (Sonnet/Haiku),
- OpenAI transcription adapter — **retrofit** BUILD-06 Whisper volání pod
  stejnou provenance disciplínu jako Sonnet/Haiku (viz Rozhodnutí 5),
- prompt registry lifecycle `DRAFT → TESTING → ACTIVE → RETIRED`,
- schema fixtures + adversarial fixtures,
- activation gate,
- rollback,
- `llm_runs` provenance (model/prompt/schema/input manifest),
- model drift health check (jen funkce, bez BUILD-23 zapojení).

**DoD:** AT-33, AT-34, AT-35, AT-36, AT-63 (Build Specification §6).

Acceptance testy (doslovně z Technical Architecture §32):
- **AT-33** „Structured prompt bez passing fixtures → nelze ACTIVE."
- **AT-34** „Aktivace promptu s invalid JSON schema outputem → blokována."
- **AT-35** „Rollback vrátí přesnou minulou version, nikoliv edit history."
- **AT-36** „LLM run ukládá model/prompt/schema/input manifest provenance."
- **AT-63** „Prompt/model drift: změna `model_id` bez passing test runu →
  activation blocked a health hlásí mismatch."

## Co BUILD-07 znovu nestaví

Schéma je celé už hotové z BUILD-02 (`0003_prompts_and_llm.sql`):
`prompt_versions` (lifecycle check constraint, partial unique index
"nejvýš jedna ACTIVE per purpose"), `prompt_test_runs`, `llm_runs`
(FK z `responses.llm_run_id`), `operational_extractions`,
`blind_extractions` — vše doslovně podle architektury. `H2_MODELS`
pinned model IDs jsou taky hotové z BUILD-01
(`h2/config/models.ts`: `buddy=claude-sonnet-5`,
`extraction=claude-haiku-4-5-20251001`, `transcription=whisper-1`).

Skutečný Buddy runtime (stance BE_WITH/EXPLORE/ACT, intent layer,
konverzace) zůstává mimo scope — to je BUILD-10. BUILD-07 staví
**infrastrukturu volání modelu + registr**, ne samotnou konverzaci.
Operational/blind extraction LOGIKA (co se extrahuje) je BUILD-08/14 —
BUILD-07 dává jen obecný `callAnthropicModel()`/`recordLlmRun()`
mechanismus, který si BUILD-08/10/14 později půjčí.

## Rozhodnutí 1: jedna nová migrace — GRANT na prompt_versions/prompt_test_runs

`h2_runtime` má dnes (migrace `0011_roles_and_rls.sql`, řádek 96) **jen
SELECT** na `prompt_versions`/`prompt_test_runs` — nemůže vytvořit ani
DRAFT verzi, natož zapsat test run. `llm_runs`/`operational_extractions`/
`blind_extractions` naopak plný CRUD+RLS grant už mají (jsou v
`owner_scoped_tables` poli, BUILD-02) — pro ně žádná změna netřeba.

Komentář přímo v `0003_prompts_and_llm.sql` (řádky 20-22) říká: "ACTIVE
status nesmí nastavit obecný runtime CRUD — vynucuje se na aplikační
vrstvě přes `activatePromptVersion()` a GRANT, **ne přes DB trigger**,
aby zůstala jedna auditovatelná cesta v kódu." To je explicitní pokyn pro
BUILD-07: enforcement je kód + GRANT, ne SECURITY DEFINER Postgres
funkce ani column-level privilege split (zvažoval jsem to, zamítám jako
zbytečnou komplexitu nad rámec toho, co architektura žádá).

**Nová migrace `0015_prompt_registry_runtime_grants.sql`:**
```sql
grant select, insert, update on prompt_versions to h2_runtime;
grant select, insert on prompt_test_runs to h2_runtime;
```
Enforcement, že `status='ACTIVE'`/`activated_at`/`retired_at` nastaví
**jen** `h2/prompts/activation.ts` `activatePromptVersion()`, je na
úrovni kódu (jediná funkce v repu, co tahle pole zapisuje) — stejný vzor
jako BUILD-05 `quarantineJob()` je jediná cesta do `QUARANTINED`. Kódová
disciplína sama ale drží jen do chvíle, kdy si na ni někdo nevzpomene —
strojová kontrola v CI je Rozhodnutí 7.

## Rozhodnutí 2: credentials — Anthropic API klíč, NOVÝ, ale ne na začátek

BUILD-07 je **první** místo v H2, co reálně volá Claude API
programaticky (na rozdíl od Claude Code, kterým tenhle kód píšu). Bude
potřeba:

**`H2_ANTHROPIC_API_KEY`** — nový účet/klíč na console.anthropic.com s
aktivním billingem, odděleným od tvého Claude Code/Claude.ai předplatného.

`H2_OPENAI_API_KEY` (BUILD-06) zůstává stejný, jen se v BUILD-07 přidá
druhé volací místo (retrofit, Rozhodnutí 5) — nežádám ho znovu, jen
připomínám, že reálná hodnota ve Vercelu ještě čeká na tebe z minula.

**Honzíkovo explicitní zadání:** účet/klíč založí, až to bude reálný STOP
pro další postup — ne dřív. Implementace + všechny automatické testy
(mockovaný `fetch`, Rozhodnutí 6) běží bez něj od prvního commitu, merge
do `main` na klíč nečeká. Pokud narazím na krok, který se bez reálného
klíče nedá udělat (typicky: první skutečná certifikace promptu proti
Sonnetu/Haiku), **zastavím se a napíšu to jako explicitní STOP** — s
popisem přesně toho, co tím krokem ověřujeme, ne jen "pošli klíč".

**Žádný nový npm balíček.** Anthropic adapter jde přes syrový `fetch`
(`https://api.anthropic.com/v1/messages`), stejný styl jako BUILD-06
OpenAI adaptér — bez `@anthropic-ai/sdk` závislosti.

## Rozhodnutí 3: metering pro Anthropic volání — od prvního dne, ne BUILD-27

Whisper (BUILD-06) zapisuje do `usage_ledger` už teď. Honzíkovo zadání:
Claude API volání musí dělat totéž od prvního commitu — Anthropic bude
řádově dražší než Whisper (Sonnet `$2`/`$10` za MTok in/out, Haiku
`$1`/`$5` — architektura §28 — proti Whisperu `$0.006`/min), takže je to
první místo, kde metering reálně něco znamená.

**Co se zapisuje, přesně:** `h2/prompts/usage.ts`
`recordAnthropicUsage(client, ownerId, purpose, modelId, inputTokens,
outputTokens)` — **dva** `usage_ledger` řádky na jedno volání (input a
output mají různou cenu, nejde je sečíst do jednoho `quantity`):
- `purpose = <purpose parametru>` (např. `'buddy_response'`,
  `'operational_extraction'` — stejný `purpose`, jakým se loguje `llm_runs`
  řádek pro totéž volání),
- `model_id = <přesné pinned ID>` (`claude-sonnet-5` nebo
  `claude-haiku-4-5-20251001`, nikdy zkrácené/obecné jméno),
- řádek 1: `unit = 'tokens_input'`, `quantity = inputTokens`, `cost_usd =
  inputTokens / 1_000_000 * cena_za_input_MTok`,
- řádek 2: `unit = 'tokens_output'`, `quantity = outputTokens`, `cost_usd
  = outputTokens / 1_000_000 * cena_za_output_MTok`.

(Přesné názvy `tokens_input`/`tokens_output` — existující `usage_ledger_
unit_check` z BUILD-02 (`0010_billing_and_ops.sql`) povoluje jen
`'tokens_input', 'tokens_output', 'minutes', 'compute_hours',
'storage_gb'` — zjištěno až při implementaci, žádný nový constraint
netřeba, jen se použije správné jméno.)

Sazby (`ANTHROPIC_PRICING_USD_PER_MTOK`, referenční hodnoty přímo z
architektury §28, stejný vzor jako `WHISPER_RATE_USD_PER_MINUTE` v
BUILD-06 — `pricing_catalog` lookup zůstává BUILD-27):
```ts
{
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
}
```

**Atomicita:** `recordAnthropicUsage()` běží **ve stejné transakci** jako
`recordLlmRun()` (oba přijímají `PoolClient`, ne `Pool` — volající je
zavolá vedle sebe v jednom `withOwnerScope` bloku, stejný vzor jako
BUILD-06 `commitVoiceTranscript()` volá `recordWhisperUsage()`). Metering
se váže na to, že API **vrátilo token counts** (tedy volání proběhlo a
stálo peníze), ne na to, jestli výstup později projde zod validací —
i fixture, co skončí `FAIL` na schema validaci, se reálně zavolal a
stojí, takže se metruje (AT-34's "blokovaná aktivace" neznamená
"nezaplacené volání").

**Co zůstává odloženo do M1 gate/BUILD-27, stejně explicitně jako v
BUILD-06-PLAN.md:** enforcement 35 USD/měsíc stropu (BUILD-07 jen
zapisuje spotřebu) a `pricing_catalog` lookup (hardcoded sazby výše).
Důvod odkladu je stejný jako u BUILD-06 — bez reálného volání (Rozhodnutí
6) nic v produkci dnes limit nemůže překročit.

## Rozhodnutí 4: output schema validace přes zod v kódu, ne generický JSON-Schema interpreter

`prompt_versions.output_schema jsonb` zůstává **auditní/dokumentační
otisk** (co si architektura žádá jako "schema version" evidenci), ne
runtime enforcement mechanismus. Skutečná validace strukturovaného
výstupu běží přes `zod` schema definovaný v kódu per purpose
(`h2/prompts/schemas/*.ts`) — `zod` je už jediná validační knihovna v
repu (`h2/config/schema.ts` atd.), přidávat `ajv`/obecný JSON-Schema
interpreter pro jeden use-case by byla zbytečná závislost navíc.
AT-34 ("invalid JSON schema output → blokována") se tak testuje jako
"zod parse selže → test run FAIL → nelze ACTIVATE", ne jako generický
JSON-Schema engine.

## Rozhodnutí 5: retrofit BUILD-06 Whisper volání pod `llm_runs` provenance

Build Specification řadí "OpenAI transcription adapter" explicitně pod
BUILD-07, ne BUILD-06 — architektura chce **jednotnou** provenance napříč
providery (§9.2: "Každý významný run ukládá purpose/model_id/prompt_
version/schema_version/..."). BUILD-06 dnes zapisuje jen `usage_ledger`
(cena/minuty), NE `llm_runs` (provenance/audit).

**Rozhodnutí:** BUILD-07 přidá `recordLlmRun()` volání do
`h2/voice/commit-transcript.ts` `commitVoiceTranscript()` — VE STEJNÉ
transakci jako `raw_events` update + `usage_ledger` insert (Whisper
metering z BUILD-06 zůstává beze změny — `recordWhisperUsage()` už
existuje a splňuje totéž, co Rozhodnutí 3 žádá pro Anthropic; retrofit
tady doplňuje jen chybějící `llm_runs` provenance řádek, ne metering).
`purpose =
'voice_transcription'`, `model_id = 'whisper-1'`, `prompt_version_id =
null` (Whisper nemá prompt), `input_reference_manifest = null` (žádný
raw content do logu). Model drift check pro `transcription` purpose pak
porovnává `H2_MODELS.transcription` proti poslednímu `llm_runs.model_id`
záznamu (Whisper nemá `prompt_test_runs`/aktivační gate — jen jeden
pinned model, žádná verzovaná prompt content).

To neznamená změnu chování BUILD-06 (žádost/odpověď stejná), jen přidává
audit řádek navíc — bezpečné, aditivní, netestované chování se nemění
(existující BUILD-06 testy zůstávají zelené, přidá se jen assert na nový
`llm_runs` řádek).

## Rozhodnutí 6: žádné reálné Anthropic/OpenAI volání v automatických testech — implementace i merge bez klíče

Stejný princip jako BUILD-06 Rozhodnutí 3, teď Honzíkem explicitně
potvrzený i pro Anthropic. `h2/prompts/anthropic-adapter.ts` je tenký
adaptér na `fetch`, testovaný mockovaným `fetch` — nikdy reálná síť.
Registry lifecycle testy (AT-33, AT-34, AT-35, AT-36, AT-63) injektují
fake `callModel` funkci — ověřují mechanismus (gating, rollback,
provenance, metering), ne skutečnou kvalitu Sonnet odpovědi.
Implementace, testy i merge do `main` proběhnou **bez `H2_ANTHROPIC_API_KEY`**.

Skutečná certifikace promptu (fixture suite proti reálnému modelu) je
**samostatný ruční krok**, který se stane skutečným STOPem, až na něj
dojde — Code se v tu chvíli zastaví a napíše explicitní STOP s popisem,
co přesně se tím krokem ověřuje (typicky: "certifikovat prompt verzi X
pro purpose Y proti modelu Z — bez toho nejde `activatePromptVersion()`
reálně použít, mechanismus je ale hotový a otestovaný i bez toho").

## Rozhodnutí 7: enforcement ACTIVE — strojová kontrola v CI, ne jen konvence

Rozhodnutí 1 řeklo "jen `activatePromptVersion()` smí zapsat
`status='ACTIVE'`" jako kódovou disciplínu — Honzíkova připomínka:
disciplína bez stroje drží jen do chvíle, kdy si na ni někdo nevzpomene.
Stejný vzor jako `h2/build-governance/at-ownership.ts` — mechanická
kontrola, ne jen text v plánu.

**Nový `h2/build-governance/__tests__/prompt-activation-single-writer.test.ts`:**
projde všechny `.ts` soubory pod `h2/`/`app/` (mimo `__tests__/` adresáře
— testovací asserty typu `expect(status).toBe("ACTIVE")` nejsou zápis,
nemá smysl je zakazovat) a regexem `/(update|insert)[^;]*prompt_versions[^;]*'ACTIVE'/is`
ověří, že vzor "UPDATE/INSERT dotýkající se `prompt_versions` nastavující
`'ACTIVE'`" existuje **jen** v `h2/prompts/activation.ts`. Najde-li se
jinde, test spadne se jménem souboru. Regex je záměrně vázaný na
`update`/`insert` + `prompt_versions` + `'ACTIVE'` pohromadě, ne na holý
string `"ACTIVE"` — jinak by trefil i legitimní TS union typ
(`"DRAFT"|"TESTING"|"ACTIVE"|"RETIRED"`) nebo testovací assert, což by
byl false positive, ne skutečná ochrana.

Tohle prasklo v CI při každém budoucím pokusu obejít
`activatePromptVersion()` (např. BUILD-08/10 by chtěly "jen rychle"
aktivovat prompt přímo) — ne až za tři měsíce v produkci.

## Návrh API (bude upřesněno při implementaci)

- `h2/prompts/config.ts` — `loadPromptProviderConfig()`: fail-closed `requireEnv({H2_ANTHROPIC_API_KEY})`, stejný vzor jako `h2/voice/config.ts`.
- `h2/prompts/anthropic-adapter.ts` — `callAnthropicModel(modelId, promptContent, input, apiKey)`: syrový `fetch` na Messages API, `AbortController` timeout, vrací `{text, inputTokens, outputTokens}`.
- `h2/prompts/registry.ts` — `createDraftPromptVersion()`, `getActivePromptVersion(pool, purpose)`.
- `h2/prompts/fixtures.ts` — typ pro fixture (`{name, input, kind: 'happy_path'|'malformed_input'|'adversarial_context'|'schema_validation', expectedOutcome}`), `runPromptFixtureSuite(pool, promptVersionId, modelId, schemaVersion, fixtureSetVersion, fixtures, callModel, validateOutput)` → zapíše jeden `prompt_test_runs` řádek (`PASS`/`FAIL` + `results` jsonb detail per fixture).
- `h2/prompts/activation.ts` — `activatePromptVersion(pool, ownerId, promptVersionId, modelId, schemaVersion, fixtureSetVersion)`: `requireRecentReauth()` (BUILD-03A) → ověří existenci `PASS` `prompt_test_runs` pro přesnou kombinaci → jedna transakce: retire staré `ACTIVE` (stejný `purpose`) + aktivuje nové (partial unique index `prompt_versions_one_active_per_purpose` jako druhá vrstva obrany). `rollbackPromptVersion(pool, ownerId, purpose, targetVersion)` = tenký wrapper nad `activatePromptVersion()` na explicitně danou starší verzi (AT-35 — žádná editace historie, jen re-aktivace).
- `h2/prompts/llm-run.ts` — `recordLlmRun(client, {ownerId, purpose, modelId, promptVersionId, schemaVersion, inputReferenceManifest, tokens, latencyMs, status, errorCode})`: insert do `llm_runs`, volatelné zevnitř cizí transakce (`PoolClient`, stejný vzor jako `h2/voice/usage.ts`).
- `h2/prompts/usage.ts` — `ANTHROPIC_PRICING_USD_PER_MTOK`, `recordAnthropicUsage(client, ownerId, purpose, modelId, inputTokens, outputTokens)` (Rozhodnutí 3).
- `h2/prompts/model-drift.ts` — `checkModelDrift(pool, purpose)`: porovná `H2_MODELS[purpose]` s `model_id` poslední `PASS` kombinace; vrací `{configured, certified, drift: boolean}` — čistá funkce, nikam se sama nezapojuje (BUILD-23 zapojení).
- Retrofit: `h2/voice/commit-transcript.ts` — přidat `recordLlmRun()` volání (Rozhodnutí 5).
- `h2/build-governance/__tests__/prompt-activation-single-writer.test.ts` — governance test (Rozhodnutí 7).

**Škrt v implementaci oproti návrhu:** `h2/prompts/schemas/*.ts` (zod
schémata per purpose, Rozhodnutí 4) se nakonec nestavěly jako samostatné
soubory — žádný reálný purpose (BUDDY_RESPONSE/OPERATIONAL_EXTRACTION/…)
ještě nemá definovaný obsah (to je BUILD-08/10/14), takže "reálné" schéma
by bylo fingované a stejně by ho ta budoucí slice musela předělat.
`ValidateOutputFn`/`CallModelFn` typy (Rozhodnutí 4 princip beze změny —
zod, ne generický JSON-Schema interpreter) žijí v `h2/prompts/fixtures.ts`,
konkrétní zod validátor si testy/budoucí slicey dodají inline.

## Test plán

- **AT-33:** vytvořit DRAFT prompt verzi, pokus o `activatePromptVersion()` bez jakéhokoli `PASS` `prompt_test_runs` → odmítnuto, `status` zůstává `DRAFT`.
- **AT-34:** fake `callModel` vrátí výstup, co neprojde zod schématem → `runPromptFixtureSuite()` zapíše `FAIL` → `activatePromptVersion()` odmítnuto.
- **AT-35:** verze 1 ACTIVE → certifikovat + aktivovat verzi 2 → `rollbackPromptVersion()` zpět na verzi 1 → assert `prompt_versions` řádek verze 1 má nový `activated_at` (ne editovaný starý), verze 2 je `RETIRED`, žádná verze 3 ani edit historie nevznikla.
- **AT-36:** `recordLlmRun()` po fake `callAnthropicModel()` volání → assert `llm_runs` řádek má `model_id`, `prompt_version_id`, `schema_version`, `input_reference_manifest` vyplněné.
- **AT-63:** `H2_MODELS.buddy` v konfiguraci změněn (test-only override) → `checkModelDrift()` hlásí `drift: true` → `activatePromptVersion()` s tímhle `modelId` odmítnuto (žádný `PASS` run pro NOVOU kombinaci `model_id`, i kdyby stará kombinace `PASS` měla).
- **Metering (Rozhodnutí 3):** fake `callModel` vrátí `{inputTokens: 1000, outputTokens: 500}` → po `recordLlmRun()` + `recordAnthropicUsage()` assert přesně 2 nové `usage_ledger` řádky (`tokens_input`/`tokens_output`), `cost_usd` odpovídá pinned sazbě pro daný `model_id`. Samostatný test, že fixture se selhávající zod validací (AT-34 scénář) **přesto** zapíše usage (zaplatilo se, i když aktivace neprošla).
- Retrofit test v `h2/voice/__tests__/process-voice-job.test.ts` nebo nový `commit-transcript.test.ts`: `commitVoiceTranscript()` zapíše i `llm_runs` řádek (`purpose='voice_transcription'`) atomicky se stávajícím `usage_ledger`/`raw_events` update.
- Adaptér (`anthropic-adapter.test.ts`): mockovaný `fetch`, stejný vzor jako BUILD-06.
- **Governance (Rozhodnutí 7):** `prompt-activation-single-writer.test.ts` — pozitivní test (najde vzor v `activation.ts`, projde) + regresní fixture (dočasně vloží zakázaný vzor do pomocného test-fixture souboru mimo `activation.ts`, ověří že test na něj spadne — dokazuje, že kontrola skutečně něco hlídá, ne že jen vždycky projde).

## Co zůstává mimo scope (vědomě)

- Skutečná Buddy konverzace/stance/intent layer (BUILD-10).
- Operational/blind extraction obsahová logika (BUILD-08/14) — BUILD-07 dává jen obecný adapter, ne co se extrahuje.
- Model drift **health endpoint**/scheduler zapojení (BUILD-23) — jen čistá `checkModelDrift()` funkce.
- Skutečná certifikace jakéhokoli promptu proti reálnému Sonnetu/Haiku — ruční krok po implementaci, credentials si vyžádám zvlášť.
- Admin/web UI pro aktivaci/rollback (BUILD-26) — `activatePromptVersion()`/`rollbackPromptVersion()` jsou TS funkce volatelné přímo (testy), ne HTTP endpoint.
