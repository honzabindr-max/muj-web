# COST-MODES — nákladové režimy + pre-call guard — návrh plánu (v1)

**Status:** NÁVRH — čeká na adversarial review a Honzíkovo GO. **NEIMPLEMENTOVÁNO,
žádná migrace nespuštěna, žádný kód nezměněn.** Zdroj zadání: GPT gate
„H2 Architecture Delta Review v2" (2026-09-29) schválil cost modes + pre-call
enforcement jako **P0**. Tenhle dokument není BUILD blok — předbíhá část
BUILD-27 (Usage & budget guardrails) a uzavírá otevřenou položku M1 deploy gate
„tvrdý strop 35 USD/měsíc vynucený". Navrhuje založit dva záznamy v
DECISIONS.md: **DEC-011** (cost modes, Rozhodnutí 1–5) a **DEC-012** (profile
bridge, Rozhodnutí 6). DEC-010 je obsazené paralelní větví („Linking Your AI —
delta review v2"). Žádný z nich se nezapisuje teď — až po rozhodnutí.

> **Všechny odkazy `soubor:řádek` v tomhle dokumentu jsou pinované na commit
> `be0fc89`** (`be0fc896d94c1f0a31e3e61290a782e2b13e4881`, `main` k 2026-09-29).
> Paralelní větev přesouvá `docs/h2/BUILD-STATUS.md` do `docs/h2/history/build/`
> — odkazy na živý soubor by se rozbily. Klíčové odkazy mají GitHub permalink
> s hashem (reference na konci dokumentu).

## Rozsah

Pět věcí, které GPT gate požaduje, plus jedno architektonické rozhodnutí:

1. Kde žije aktivní cost mode (`ZERO` / `LEAN` / `NORMAL` / `DEEP` / `MANUAL`) a
   kdo ho smí přepnout — včetně z Telegramu přes Command Gate jako protokolový
   příkaz (I7.7). → Rozhodnutí 1
2. Jediný pre-call guard před `callAnthropicModel()`: mode → povolený purpose →
   certifikovaný pár → odhad ceny → strop per-job / den / měsíc → teprve pak
   `llm_attempt`. Chování při odmítnutí per purpose bez falešné karantény
   (DEC-008). → Rozhodnutí 2
3. `pricing_catalog` (seed + čtení) místo cen natvrdo. → Rozhodnutí 3
4. Trivial-turn gate (RED-TEAM-FINDINGS bod 2) jako druhá úspora. → Rozhodnutí 4
5. Chování v `ZERO`. → Rozhodnutí 5
6. **ARCHITECTURE DECISION REQUIRED:** jak se identita/preference z budoucího
   Neon profilu dostanou k nástrojům mimo runtime. → Rozhodnutí 6

## Výchozí stav — ověřeno proti kódu na `be0fc89`

| Tvrzení | Ověřeno |
|---|---|
| LLM volají v runtime jen dva moduly, oba přes `callAnthropicModel()` | [`generate-response.ts:150 @ be0fc89`][gr150] (`BUDDY_RESPONSE`), [`operational-extraction.ts:75 @ be0fc89`][oe75] (`OPERATIONAL_EXTRACTION`). Třetí místo je `h2/prompts/fixtures.ts @ be0fc89` s injektovaným `callModel` — operátorský certifikační běh (certify skript v PR #49), ne runtime. |
| `withLlmAttempt()` obaluje **celou** `generateBuddyResponse()`, včetně dedup a command cesty, kde se LLM nevolá | [`process-owner-queue.ts:137 @ be0fc89`][poq137]; extrakce [`process-owner-queue.ts:95 @ be0fc89`][poq95] |
| Certifikace (PASS v `prompt_test_runs`) se kontroluje **jen při aktivaci**, runtime bere `getActivePromptVersion(purpose)` bez ohledu na model | [`activation.ts:42-51 @ be0fc89`][act42]; `registry.ts:33-40 @ be0fc89`. `checkModelDrift()` (`model-drift.ts:33 @ be0fc89`) není nikam zapojený (komentář: BUILD-23). |
| Ceny jsou natvrdo v kódu | [`h2/prompts/usage.ts:11-14 @ be0fc89`][us11] (Sonnet 5: 2 / 10 USD/MTok, Haiku 4.5: 1 / 5 USD/MTok); [`h2/voice/usage.ts:16 @ be0fc89`][vu16] (Whisper 0,006 USD/min, komentář `:9`: „`pricing_catalog` lookup je BUILD-27") |
| `pricing_catalog` existuje jen jako schéma, kód z něj nečte; `h2_runtime` má SELECT | [`0010_billing_and_ops.sql:26-40 @ be0fc89`][m0010], `0011_roles_and_rls.sql:97 @ be0fc89`. `unit_price_usd numeric(12,6)`. |
| `provider_policy_catalog` = retenční snapshot poskytovatele pro Privacy/Delete UI, **ne** policy pro routing ani náklady; nikdo ho nečte | `0010_billing_and_ops.sql:42-50 @ be0fc89` (komentář „provider retention snapshot zobrazený v Privacy/Delete UI") |
| `usage_ledger` se zapisuje, ale **nikde nesčítá**; neúspěšná volání (refusal, max_tokens, timeout) usage nezapisují | `generate-response.ts:146-149 @ be0fc89` (komentář „known gap"); žádný `sum(cost_usd)` v TS kódu |
| H2 Buddy nemá žádný finanční strop; M1 gate ho požaduje | [`BUILD-STATUS.md:876 @ be0fc89`][bs876], [`BUILD-STATUS.md:886 @ be0fc89`][bs886] (nezaškrtnuto) |
| H2-IW strop má — vzor | [`h2iw/config.py:60-61 @ be0fc89`][iwc60] (`DAILY_LLM_CALL_CAP = 200`, `MONTHLY_USD_CAP = 3.00`), `h2iw/main.py:109,173-203 @ be0fc89` (kontrola před voláním, notice „⛔ denní/měsíční strop", `LLM_UNAVAILABLE` 1× denně), ledger `llm_calls` (`h2iw/store.py:48 @ be0fc89`) |
| Intent se neklasifikuje samostatným LLM voláním — vrací ho `BUDDY_RESPONSE` | `stance-intent-schema.ts:45-49 @ be0fc89` (`{responseText, stance, intent[]}`) |
| Command Gate je deterministický exact lookup | [`control-fast-path.ts:20-28 @ be0fc89`][cfp20] (`/stop`, `/pause`, `/resume`, `trim().toLowerCase()`), aplikace při ingestu `ingest-message.ts:129-135 @ be0fc89`, ack cesta [`generate-response.ts:117-124 @ be0fc89`][gr117] |
| Každá chyba Buddy cesty jde do `recordJobFailure()` → případně `QUARANTINED` + notice | [`process-owner-queue.ts:69-81 @ be0fc89`][poq69] (`classifyError`), `:153-158`; Anthropic 400 je non-retryable (`prompts/errors.ts:42-51 @ be0fc89`) → okamžitá karanténa |
| Žádná owner-level tabulka nastavení neexistuje; stav „pause" ani „čeká na potvrzení" se nikde neukládá | `owners` (`0001`), `owner_processing_state` (`0002_messaging.sql:71-79 @ be0fc89`), `action_permissions` (`0005`); RED-TEAM-FINDINGS.md bod 2 @ be0fc89 |
| Poslední migrace `0020_system_notice_deliveries.sql`, další číslo **0021** | `h2/db/migrations/ @ be0fc89` |
| Fronta ownera je serializovaná (jeden aktivní job na ownera) | `lease.ts:177-222 @ be0fc89` (`claimNextJob`, `owner_processing_state.active_job_id`) |

**Důsledek pro návrh:** guard nemůže stát „před `llm_attempt`" bez přesunu
`withLlmAttempt()` z `process-owner-queue.ts` dovnitř, těsně kolem skutečného
volání (Rozhodnutí 2). A protože se intent vrací až z `BUDDY_RESPONSE`, guard
**nesmí** počítat s levným „intent" voláním jako prvním krokem — rozhodnutí
se dělá jen z deterministických vstupů (režim, purpose, certifikace, cena,
útrata).

## Co tenhle plán znovu nestaví

- `llm_attempts` + `withLlmAttempt()` (0017, BUILD-11 Rozhodnutí 10) — použije
  se, jen se přesune místo volání.
- Processing budget (0018, [DEC-008](./DECISIONS.md#dec-008)) — beze změny
  schématu; sémantický dopad viz „Dopad na invarianty a rozhodnutí".
- Command Gate (DEC-007) — rozšiřuje se o druhou lookup tabulku, mechanismus
  zůstává.
- `usage_ledger` zápis (`recordAnthropicUsage`, `recordWhisperUsage`) — mění
  se jen zdroj ceny.
- Delivery (`deliverResponse`) a `system_notice_deliveries` (0020).

---

## Rozhodnutí 1 (návrh): kde žije aktivní cost mode a kdo ho smí přepnout

**Kontext:** režim je owner-scoped provozní stav, který se mění za běhu (i z
mobilu přes Telegram) a jehož změny chceme auditovat. Dnes pro něj není
místo — žádná `owner_settings` tabulka, feature flagy jsou konstanty v kódu
(`h2/config/capabilities.ts:21-33 @ be0fc89`).

**Varianty:**
- (A) env proměnná / konstanta v `h2/config` — změna = deploy, z Telegramu
  nepřepnutelné, žádný audit.
- (B) nový sloupec na `owner_processing_state` — míchá lease/fencing stav
  (BUILD-05) s nákladovou politikou; každá změna režimu by sahala na řádek,
  který drží aktivní lease.
- (C) nová tabulka `owner_cost_policy`, jeden řádek na ownera, s auditem
  poslední změny.

**Doporučení: (C).**

```
owner_cost_policy
  owner_id            uuid PK → owners
  mode                text   CHECK in ('ZERO','LEAN','NORMAL','DEEP','MANUAL')
  per_job_cap_usd     numeric(10,4)
  daily_cap_usd       numeric(10,4)
  monthly_cap_usd     numeric(10,4)  CHECK (monthly_cap_usd <= 35)
  deep_until          timestamptz null   -- DEEP automaticky vyprší
  changed_via         text   CHECK in ('MIGRATION_SEED','TELEGRAM_COMMAND','WEB_REAUTH')
  source_raw_event_id uuid null → raw_events   -- který příkaz změnu způsobil
  updated_at          timestamptz
```

`CHECK (monthly_cap_usd <= 35)` přenáší schválený M1 strop přímo do schématu:
zvýšit ho jde **jen migrací** (= Honzíkovo GO, Pravidlo 4), ne příkazem ani
webem. **Chybějící řádek = fail-closed jako `ZERO` + `incidents` řádek.**

**Definice režimů:**

| Režim | Povolené purpose | Poznámka |
|---|---|---|
| `ZERO` | žádný | Buddy odpovídá deterministicky (Rozhodnutí 5) |
| `LEAN` | `BUDDY_RESPONSE` | bez extrakce; trivial-turn gate nahrazuje i Buddy odpověď (Rozhodnutí 4) |
| `NORMAL` | `BUDDY_RESPONSE`, `OPERATIONAL_EXTRACTION` | dnešní chování |
| `DEEP` | `NORMAL` + `BUDDY_DEEP_DIVE` | runtime `BUDDY_DEEP_DIVE` dnes nepoužívá (přijde s BUILD-26), takže prakticky `NORMAL` + vyšší `per_job_cap`; vyprší v `deep_until` zpět do `NORMAL` |
| `MANUAL` | jako `ZERO`; LLM jen pro zprávu začínající protokolovým prefixem `/ask ` | **Otevřené pro review:** zadání význam `MANUAL` nedefinuje. Tohle je návrh Code, ne převzatá definice. |

**Režim nikdy nemění model.** Model je zamčený v `h2/config/models.ts @
be0fc89` (Technical Architecture v1.2 §1) a každý pár prompt × model musí mít
PASS certifikaci. Pokud by `LEAN` měl v budoucnu jet na levnějším modelu,
potřebuje vlastní certifikovaný pár — jinak ho guard odmítne (`NOT_CERTIFIED`,
Rozhodnutí 2). Tenhle plán žádnou změnu modelu nenavrhuje.

**Kdo smí přepínat:**

- **Owner z Telegramu, protokolovým příkazem přes Command Gate (I7.7).** Nová
  lookup tabulka `PROTOCOL_COMMANDS` vedle `FAST_PATH_COMMANDS` v
  `control-fast-path.ts`, **stejná disciplína: exact whole-message match po
  `trim().toLowerCase()`, žádné NLP**:
  - `/mode zero`, `/mode lean`, `/mode normal`, `/mode manual` — změna režimu,
  - `/mode` — výpis aktuálního režimu a stropů,
  - `/cost` — útrata dnes / tento měsíc proti stropům.
- Změna se aplikuje **při ingestu, ve stejné transakci jako `raw_event`**
  (stejný vzor jako bump `owner_control_epoch`, `ingest-message.ts:129-135 @
  be0fc89`). Idempotence podle `raw_event_id` (I7.3 — duplicitní webhook
  nezmění režim dvakrát), pořadí podle input sequence (I7.4). Potvrzení
  ownerovi jde deterministicky stejnou cestou jako dnešní control ack
  (`generate-response.ts:117-124 @ be0fc89`), bez LLM.
- **`/mode deep` a jakákoli změna stropů jen přes web s `requireRecentReauth()`**
  (`h2/identity/session.ts @ be0fc89`, stejný vzor jako aktivace promptu).
  Z Telegramu přijde deterministická odpověď s odkazem na web.
- **Proč asymetrie:** Telegram je autentizovaný jen allowlistem
  (`H2_TELEGRAM_OWNER_USER_ID`). Kompromitovaný Telegram účet smí režim jen
  snížit nebo se pohybovat pod existujícími stropy — nikdy je zvednout.
  I `/mode normal` ze `ZERO` je bezpečné, protože stropy platí v každém režimu.

**Změna režimu nebumpuje `owner_control_epoch`.** Není to sovereignty akce
(I7), ale nákladová politika. Volání, které už prošlo guardem a je u
poskytovatele, doběhne, doručí se a započítá se do útraty. Guard se
vyhodnocuje před **každým** voláním, takže nový režim platí od dalšího volání.

**Dopad:** nová tabulka (migrace 0021), rozšíření `control-fast-path.ts`,
`command-gate.ts`, `ingest-message.ts`; nová webová akce s reauth.

---

## Rozhodnutí 2 (návrh): jediný pre-call guard před `callAnthropicModel()`

**Kontext:** dnes mezi rozhodnutím „zpracuj job" a placeným voláním nestojí
nic — ani režim, ani strop, ani runtime kontrola certifikace. Guard musí být
**jediné** místo, přes které jde každé runtime LLM volání, jinak se dá obejít.

**Návrh:** nový modul `h2/cost/guard.ts` s funkcí

```ts
guardedModelCall(ctx: { pool, token, purpose }, modelId, promptContent, input, maxOutputTokens, outputSchema?)
  → { allowed: true, result: AnthropicCallResult }
  | { allowed: false, reason: GuardDenialReason }
```

Oba runtime volající (`generate-response.ts`, `operational-extraction.ts`)
volají `guardedModelCall()` místo `callAnthropicModel()`. **Build-governance
test** (po vzoru `h2/build-governance/__tests__/prompt-activation-single-writer.test.ts
@ be0fc89`) vynutí, že `callAnthropicModel` importuje v `h2/` jen
`h2/cost/guard.ts` (výjimka: `fixtures.ts` s injektovaným `callModel`, viz níže).

**Pořadí kroků uvnitř guardu (každý krok může odmítnout, dál se nepokračuje):**

1. **Policy:** načíst `owner_cost_policy` (owner scope). Chybí → `NO_POLICY`.
   `DEEP` s `deep_until < now()` → zapsat návrat do `NORMAL` a pokračovat
   jako `NORMAL`.
2. **Režim → purpose:** purpose není v povolené sadě režimu (tabulka v
   Rozhodnutí 1) → `MODE_BLOCKS_PURPOSE`.
3. **Certifikovaný pár:** aktivní `prompt_versions` řádek pro purpose +
   `modelId` musí mít PASS řádek v `prompt_test_runs` (`prompt_version_id`,
   `model_id`, `status='PASS'`; pokrývá existující index
   `prompt_test_runs_lookup_idx`, `0003_prompts_and_llm.sql:40 @ be0fc89`).
   Chybí → `NOT_CERTIFIED`. Tím se zároveň runtime poprvé zapojí do toho, co
   dnes dělá nezapojený `checkModelDrift()`: změna `H2_MODELS` bez
   recertifikace se zastaví tady, ne až u uživatele.
4. **Odhad ceny (konzervativní):**
   `estimateTokens(promptContent + input) × cena_input + maxOutputTokens × cena_output`.
   `estimateTokens()` už existuje a záměrně nadhodnocuje
   (`h2/context/token-budget.ts:41 @ be0fc89`, 3,5 znaku/token). Cena z
   `pricing_catalog` (Rozhodnutí 3). Chybí → `NO_PRICE`.
5. **Stropy** (den a měsíc v časové zóně `Europe/Prague`):
   - **útrata** = `sum(usage_ledger.cost_usd)` za období
     \+ `sum(llm_attempts.estimated_cost_usd)` u pokusů **bez** ledger záznamu
     (`status in ('CALL_INTENT','FAILED_CONFIRMED','ABANDONED_UNKNOWN')`).
     Tím se konzervativně zalepí známá mezera „neúspěšné volání nezapisuje
     usage" (refusal / max_tokens / timeout) — bez opravy té mezery samotné.
     `FAILED_CONFIRMED` po 400/401 nezaplacené bylo → nadhodnocení, přijatelné.
   - `útrata_job + odhad > per_job_cap_usd` → `CAP_JOB`
     (job = všechny purpose a všechny pokusy jednoho `message_processing_jobs` řádku),
   - `útrata_den + odhad > daily_cap_usd` → `CAP_DAY`,
   - `útrata_měsíc + odhad > monthly_cap_usd` → `CAP_MONTH`.
6. **Teprve potom** `withLlmAttempt()` (insert `CALL_INTENT` s novým sloupcem
   `estimated_cost_usd`) → `callAnthropicModel()`.

**Souběh:** race dvou jobů stejného ownera mezi krokem 5 a 6 nehrozí — fronta
ownera je serializovaná (`claimNextJob`, jeden `active_job_id`). Systém je
single-owner. Zapsáno jako výslovný předpoklad; pokud by se to změnilo
(paralelní purpose v jednom jobu, víc ownerů na sdíleném stropu), krok 5 a
insert v kroku 6 musí běžet pod `pg_advisory_xact_lock` na ownera.

**Přesun `withLlmAttempt()`:** z `process-owner-queue.ts:95` a `:137 @
be0fc89` dovnitř guardu, těsně kolem `callAnthropicModel()`. Vedlejší efekt:
zmizí dnešní „fantomové" `llm_attempts` řádky pro command a dedup cestu, kde
se LLM vůbec nevolá. Dopad na `charged_processing_ms` (DEC-008) viz
„Dopad na invarianty a rozhodnutí".

**Odmítnutí je typovaná návratová hodnota, ne výjimka.** Proto nikdy
neprojde `classifyError()` → `recordJobFailure()`, tedy **nespálí retry pokus
a nevytvoří falešnou karanténu** (DEC-008). Seznam důvodů:
`NO_POLICY`, `MODE_BLOCKS_PURPOSE`, `NOT_CERTIFIED`, `NO_PRICE`, `CAP_JOB`,
`CAP_DAY`, `CAP_MONTH`. Každé odmítnutí zapíše řádek do nové tabulky
`llm_guard_denials` (audit + podklad pro `/cost`) a `logH2Event()`.

**Chování při odmítnutí per purpose:**

| Purpose | Co se stane s jobem | Co dostane owner |
|---|---|---|
| `BUDDY_RESPONSE` | `commitJobResult()` s deterministickou šablonou podle důvodu (Rozhodnutí 5) → `RESPONSE_READY` → `DELIVERED`. `attempt_count` se nezvyšuje nad rámec claimu, žádný `recordJobFailure()`, žádný `QUARANTINED`. Zpráva zůstává v `raw_events` (I6). | Krátkou deterministickou zprávu s důvodem a dalším krokem (`/cost`, `/mode normal`). |
| `BUDDY_RESPONSE` s `NOT_CERTIFIED` / `NO_POLICY` | Totéž + `incidents` řádek (`incident_type='COST_GUARD_CONFIG'`, `severity='CRITICAL'`) — je to chyba konfigurace, ne politika, a operátor o ní musí vědět. | „AI odpověď je dočasně vypnutá (konfigurace). Zpráva je uložená." |
| `OPERATIONAL_EXTRACTION` | Tiché přeskočení — extrakce je už dnes best-effort (`process-owner-queue.ts:83-107 @ be0fc89`). Řádek v `llm_guard_denials`, job pokračuje na `BUDDY_RESPONSE`. | Nic. |
| Certifikační běh (`fixtures.ts`, operátorský skript) | Mimo runtime guard — běží ručně operátorem, ne z fronty. Útrata jde do `usage_ledger`, **takže se počítá do měsíčního stropu runtime**. | — |

**Zamítnutá varianta (B):** nový job status `DEFERRED_POLICY` (odmítnutý job
počká, až režim/strop dovolí). Mění `message_processing_jobs_status_check`
uzavřeného BUILD-02 bloku a odpověď by přišla za hodiny až dny — zastaralá.
Deterministická odpověď + uložený `raw_event` je jednodušší a poctivější.

**Doporučení mimo tento plán:** certify skript z PR #49 by měl před během
zkontrolovat zbývající měsíční rozpočet (stejný dotaz jako krok 5), jinak
jedno kolo certifikace může vyčerpat měsíc runtime. Poznámka do PR #49.

**Návrh hodnot stropů → GPT gate (hodnota, ne Honzíkova otázka):**

| Veličina | Výpočet | Návrh |
|---|---|---|
| Worst-case `BUDDY_RESPONSE` volání | 24 000 × 2 USD/MTok + 2 048 × 10 USD/MTok | ≈ 0,069 USD |
| Worst-case `OPERATIONAL_EXTRACTION` volání | 8 000 × 1 USD/MTok + 2 048 × 5 USD/MTok | ≈ 0,018 USD |
| Job se 3 pokusy, obě purpose | 3 × (0,069 + 0,018) | ≈ 0,26 USD |
| `per_job_cap_usd` | | **0,30** |
| `daily_cap_usd` | 35 / 30 ≈ 1,17 + rezerva na špičku | **1,50** |
| `monthly_cap_usd` | M1 gate ([`BUILD-STATUS.md:876 @ be0fc89`][bs876]) | **35,00** (již schváleno) |

---

## Rozhodnutí 3 (návrh): `pricing_catalog` napojit teď, ne až BUILD-27

**Kontext:** `BUILD-STATUS.md:876 @ be0fc89` nechává `pricing_catalog` v
BUILD-27. Guard ale potřebuje cenu **před** voláním, `recordAnthropicUsage()`
**po** volání. Pokud by guard četl katalog a ledger konstanty (nebo naopak),
odhad a skutečnost se při první změně ceníku tiše rozjedou a strop přestane
znamenat to, co říká.

**Varianty:**
- (A) guard čte konstanty z `usage.ts`, katalog až BUILD-27 — nulová práce
  teď, ale ceník dál v kódu (změna ceny = deploy) a BUILD-27 bude muset
  přepojit dvě místa.
- (B) napojit katalog teď pro guard i ledger — seed + jedna čtecí funkce.

**Doporučení: (B).**
- `h2/cost/pricing.ts`: `getUnitPrice(client, resource, unit, at)` — řádek
  s `effective_from <= at` a (`effective_to is null` nebo `> at`), nejnovější
  `effective_from`. Čte ho guard **a** `recordAnthropicUsage()` /
  `recordWhisperUsage()`.
- `ANTHROPIC_PRICING_USD_PER_MTOK` a `WHISPER_RATE_USD_PER_MINUTE` se smažou.
  **Žádný fallback na konstantu** — chybějící cena: guard odmítne
  (`NO_PRICE`), `recordAnthropicUsage()` hodí chybu jako dnes pro neznámý
  model (`usage.ts @ be0fc89`). Jeden zdroj pravdy.
- `resource` pojmenování: `anthropic/claude-sonnet-5`,
  `anthropic/claude-haiku-4-5-20251001`, `openai/whisper-1`; cena za jednotku
  (1 token, 1 minuta).
- **Přesnost:** `numeric(12,6)` unese 0,000001 USD/token (= 1 USD/MTok), ale ne
  levnější ceny (např. cache read Haiku 0,1 USD/MTok = 0,0000001). Návrh:
  `alter column unit_price_usd type numeric(18,12)` — tabulka je prázdná,
  změna typu je bezpečná.
- Cache tokeny (`cache_creation_input_tokens`, `cache_read_input_tokens`)
  runtime H2 Buddy nepoužívá (`anthropic-adapter.ts @ be0fc89` je nevrací) —
  mimo scope.

**BUILD-27 si ponechá:** warning při 25 USD, pozastavení neurgentních
background syntéz při 30 USD, `projected_monthly_cost` dashboard (AT-70).

---

## Rozhodnutí 4 (návrh): trivial-turn gate jako druhá úspora (RED-TEAM-FINDINGS bod 2)

**Kontext:** RED-TEAM-FINDINGS.md bod 2 @ be0fc89 požaduje deterministický
gate, který triviální zprávy („ok", „díky", emoji) nepustí na
`OPERATIONAL_EXTRACTION`. Dvě tvrdá pravidla: **exact whitelist, ne fuzzy
match** (disciplína I7.7) a **nikdy při čekání na potvrzení ownera**.
Poznámka „`extractOperationalCandidates()` nemá v produkci volajícího" z toho
bodu už neplatí — volá ji `process-owner-queue.ts:134 @ be0fc89` (jen
konstatováno, RED-TEAM soubor se nemění).

**Návrh:**
- **Normalizace:** `trim()` + `toLowerCase()` + Unicode NFC. Nic dalšího —
  žádný ořez interpunkce ani diakritiky; varianty se vyjmenují explicitně.
- **Whitelist (návrh, hodnota → GPT gate):** `ok`, `oki`, `okay`, `jj`, `jo`,
  `díky`, `diky`, `dík`, `děkuju`, `dekuju`, `super`, `👍`, `🙏`, `❤️`.
- **Účinek podle režimu:**
  - všechny režimy: přeskočí `OPERATIONAL_EXTRACTION` (bez guard volání,
    bez `llm_guard_denials` řádku — není to odmítnutí, ale nulová práce),
  - `LEAN`: nahradí i `BUDDY_RESPONSE` deterministickým ackem („👍"),
  - `NORMAL` / `DEEP`: Buddy dál odpovídá — kvalita konverzace má přednost.
- **Nikdy při čekání na potvrzení.** Stav „čeká na potvrzení" dnes nikde
  neexistuje. Návrh **deterministické proxy, fail-closed:** gate se
  nevyhodnotí, pokud poslední doručená Buddy odpověď ownerovi obsahuje znak
  `?`, nebo pokud to byla odpověď na protokolový příkaz. False positive (gate
  zbytečně vypnutý) jen sníží úsporu; false negative (zahozené potvrzení) proxy
  nepřipouští, dokud Buddy nepokládá otázky bez `?`. **Proxy výslovně ke
  kontrole v review.**
- Skutečný stav `awaiting_owner_reply` (strukturované pole ve výstupu
  `BUDDY_RESPONSE`) by vyžadoval změnu schématu výstupu + recertifikaci
  promptu (= placené certifikační kolo) → patří do BUILD-12 spolu s
  RED-TEAM bodem 1.

---

## Rozhodnutí 5 (návrh): chování v `ZERO`

**Co v `ZERO` funguje beze změny:**
- ingest: šifrovaný `raw_event` i `message_processing_jobs` řádek vzniknou
  vždy (I6),
- control příkazy `/stop`, `/pause`, `/resume` a protokolové `/mode`, `/cost`
  fungují v každém režimu i při vyčerpaném stropu (I7.1 — control nesmí
  záviset na dostupnosti LLM ani rozpočtu),
- delivery do Telegramu (Telegram API nic nestojí).

**Co Buddy odpoví bez LLM** — deterministická šablona podle důvodu odmítnutí,
česky, bez jakéhokoli tvrzení o obsahu zprávy (I4):

| Důvod | Šablona (návrh) |
|---|---|
| `MODE_BLOCKS_PURPOSE` v `ZERO` | „🔕 Režim ZERO — odpovídám bez AI. Zprávu jsem uložil, nic se neztratilo. Zpět: /mode normal · útrata: /cost" |
| `MODE_BLOCKS_PURPOSE` v `MANUAL` | „✋ Režim MANUAL — AI odpoví jen na zprávu začínající /ask. Zpráva je uložená." |
| `CAP_DAY` / `CAP_MONTH` | „⛔ Denní/měsíční strop AI dosažen (X / Y USD). Zpráva je uložená, odpovím zase po resetu stropu. Stav: /cost" |
| `CAP_JOB` | „⛔ Tahle zpráva by přesáhla strop na jednu zprávu. Uloženo, bez AI odpovědi." |
| `NOT_CERTIFIED` / `NO_POLICY` / `NO_PRICE` | „⚠️ AI odpověď je dočasně vypnutá (konfigurace). Zpráva je uložená." |

**Návrat do `NORMAL`** zprávy z doby `ZERO` zpětně nezpracuje: každá už má
`responses` řádek a dedup podle `source_raw_event_id`
(`find-existing-response.ts @ be0fc89`) zabrání druhé odpovědi. Hromadný
„reprocess" je mimo scope.

---

## Rozhodnutí 6 — ARCHITECTURE DECISION REQUIRED: identita/preference z budoucího Neon profilu → nástroje mimo runtime

**Kontext:** budoucí profil ownera v Neon (h2-runtime) bude obsahovat
identitu a preference. Otázka: jak se dostanou k nástrojům **mimo** runtime —
Claude chat memory, GPT project instructions, Claude Code — aniž by se
prolomil context firewall. Profil zatím neexistuje; pojem „context firewall"
v repu na `be0fc89` nikde definovaný není. **Pracovní definice pro tohle
rozhodnutí:** runtime kontext neteče ven automaticky, a vnější nástroje
nezapisují do runtime.

**Varianty:**

| | Popis | Context firewall | Soukromí / secrets | Čerstvost | Údržba |
|---|---|---|---|---|---|
| **(A) nic** | Žádný most. Každý nástroj má vlastní ručně psanou paměť (jako dnes CLAUDE.md, GPT instructions). | Maximální — nic neteče. | Nulové riziko navíc. | Zdroje se rozjíždějí, owner udržuje 3+ kopie. | Nulová v kódu, ruční u ownera. |
| **(B) ruční export** | Owner na webu po `requireRecentReauth()` vygeneruje role-scoped markdown snapshot jen z polí označených `portable`. Bez hypotéz (I4), bez dat třetích osob (I5), bez raw events. Audit event. Owner vloží ručně. | Jednosměrný, přes člověka — owner vidí přesně, co odchází. | Žádný token v cizím systému. Po vložení platí retence cílového poskytovatele — zobrazit ji z `provider_policy_catalog` (to je jeho legitimní použití). | Zastaralé do dalšího exportu. | Malá: jedna stránka + jedna view funkce. |
| **(C) autentizovaný read-only endpoint s role views** (`chat` / `gpt` / `code`) | Nástroj si profil stáhne sám. | Otevírá automatický odchozí tok. | Dlouhodobý bearer token by musel žít v GPT instructions / Claude memory → **podle Secret Handling = leak**. GPT project instructions ani Claude chat memory fetch neumí, prakticky by sloužil jen Claude Code. Větší útočná plocha. | Živé. | Střední: auth, rotace tokenů, rate limit, audit. |
| **(D) read-only MCP jen pro Claude Code** | Krátkodobý token vydaný po reauth, jen role view `code`. | Automatický tok, ale jen do jednoho lokálního nástroje. | Token krátkodobý, mimo cizí systémy. | Živé. | Střední. |

**Doporučení Code (nerozhoduje se tady):** **(B) teď**, (D) znovu zvážit až
po BUILD-20 (deletion ledger — export musí respektovat smazaná data) a
BUILD-26 (web povrchy). (C) zamítnout — secret v cizích systémech je v přímém
rozporu se Secret Handling pravidly a dvě ze tří cílových aplikací ho stejně
neumí použít.

**Dopad na I1–I8:** I4 (export nesmí vydávat hypotézu za fakt — jen pole
`portable` s potvrzeným stavem), I5 (žádná agregace třetích osob v exportu),
I7 (owner explicitně spouští každý export). Zbytek viz tabulka níže.

**Rozhoduje Honzík** po adversarial review; zapíše se jako **DEC-012**.

---

## Dopad na invarianty a rozhodnutí

Doslovné znění I1–I8 v repu na `be0fc89` není (žije v Notion — *H2 Buddy —
Technical Architecture v1.2 (LOCKED)*, `BUILD-STATUS.md:837 @ be0fc89`). V repu
jsou jen I7.1–I7.7 (`DECISIONS.md:122-129 @ be0fc89`) a glosy I4–I7 v kódu.

| Položka | Dopad |
|---|---|
| **I1, I2, I3, I8** | **ČEKÁ NA OVĚŘENÍ proti Notion Technical Architecture v1.2 (Opus).** Předběžně bez dopadu: guard ani režimy nepíšou do Living OS / evidence dat (`0007_evidence.sql`), jen do nových nákladových tabulek. |
| **I4** (epistemic honesty) | Fallback šablony (Rozhodnutí 5) konstatují jen stav systému, nic o obsahu zprávy. Export v Rozhodnutí 6 (B) jen potvrzená `portable` pole. |
| **I5** (third-party aggregation) | Profile export i role views bez dat třetích osob. Guard sám I5 nemění. |
| **I6** (Versioned Raw Evidence) | `raw_event` vzniká v každém režimu; guard stojí až za ingestem. Odmítnutá zpráva není ztracená. |
| **I7** (Human Sovereignty) | Guard nikdy neblokuje control příkazy. |
| I7.1 | Control příkazy nezávisí na LLM ani na rozpočtu — fungují v `ZERO` i při `CAP_MONTH`. |
| I7.2 | `/mode`, `/cost` mají immutable `raw_event` jako každá zpráva. |
| I7.3 | Změna režimu idempotentní podle `raw_event_id` (`source_raw_event_id`). |
| I7.4 | Aplikace při ingestu v transakci s `raw_event` → deterministické per-owner pořadí. |
| I7.5 | Fencing beze změny. Útrata není „navenek viditelný efekt" (`DECISIONS.md:130 @ be0fc89`), takže guard nemusí být fencovaný. |
| I7.6 | `/mode …` je exact whole-message match — běžná věta s „mode" se nezklasifikuje. Prefix `/ask ` v `MANUAL`: zpráva je vždy uložená v `raw_events`, žádná nevratná ztráta. |
| I7.7 | Režim je protokolová struktura, ne odvozený z přirozeného jazyka. Trivial-turn gate stejná disciplína. |
| **[DEC-001](./DECISIONS.md#dec-001)** | Nový kód v `h2/cost/` na rootu — konzistentní s (B). |
| **[DEC-008](./DECISIONS.md#dec-008)** | (1) Odmítnutí guardem ≠ selhání: žádný `recordJobFailure()`, žádný spálený pokus, **žádná falešná karanténa**. (2) **Přesun `withLlmAttempt()` dovnitř guardu zužuje `charged_processing_ms` na čistý LLM stage** (bez context buildingu, dešifrování, commitu). To je změna sémantiky „kumulativní ACTIVE/stage čas" a **vyžaduje výslovné potvrzení v review.** Alternativa: nechat vnější obal pro processing čas a dovnitř guardu dát jen odhad ceny na samostatný řádek → dva `llm_attempts` řádky na volání. Doporučení: přesun (jednodušší, odstraní fantomové řádky pro command cestu; LLM volání je jediný stage s nenulovým hard timeoutem, `CALL_TIMEOUT_MS = 60 s`). (3) Pozorování mimo scope: Anthropic 400 „credit balance is too low" dnes vede na **falešnou karanténu** (non-retryable `ANTHROPIC_BAD_REQUEST`). Náprava po vzoru H2-IW DEC-009 Doplněk 9 (`LLM_UNAVAILABLE`, pokus se nepočítá) je samostatný slice. |
| **[DEC-009](./DECISIONS.md#dec-009)** | H2-IW je vzor (strop volání/den + USD/měsíc, ledger, notice 1× denně). Jeho SQLite ledger `llm_calls` na VPS ale guard nevidí a naopak — stropy jsou oddělené per ledger, **celkovou útratu Anthropic účtu nic v kódu nevynucuje.** Doporučení mimo kód: nastavit spend limit v Anthropic Console jako vnější pojistku nad oběma. |

---

## Implementační strategie: 4 kroky, ne jeden diff (po vzoru BUILD-11)

### Krok 1 — migrace 0021 + `pricing_catalog` jako jediný zdroj ceny

**Obsah:** `0021_cost_modes.sql` (celá, viz níže); `h2/cost/pricing.ts`
(`getUnitPrice`); `recordAnthropicUsage()` a `recordWhisperUsage()` čtou cenu
z katalogu; smazání konstant.
**Migrace:** 0021.
**Proč je bezpečné mergnout samostatně:** chování beze změny — mění se jen
zdroj ceny, seed nese stejné hodnoty jako dnešní konstanty. Nové tabulky
nikdo nečte.
**Závislost:** žádná. **Vyžaduje Honzíkovo GO na migraci** (Pravidlo 4).

### Krok 2 — guard + přesun `withLlmAttempt()`

**Obsah:** `h2/cost/guard.ts`; oba runtime volající přes `guardedModelCall()`;
odmítnutí `BUDDY_RESPONSE` → deterministická odpověď přes `commitJobResult()`;
odmítnutí extrakce → skip; `llm_guard_denials` zápis; governance test
„jediný importér `callAnthropicModel`".
**Migrace:** žádná (používá 0021).
**Proč je bezpečné mergnout samostatně:** seed je `NORMAL` se stropy nad
dnešní reálnou útratou → chování totožné, dokud se nesáhne na strop.
**Závislost:** Krok 1 (tabulky + ceny).

### Krok 3 — protokolové příkazy + web

**Obsah:** `PROTOCOL_COMMANDS` (`/mode …`, `/cost`) v `control-fast-path.ts`
a `command-gate.ts`; aplikace změny v `ingest-message.ts`; webová akce pro
`DEEP` a stropy s `requireRecentReauth()`; šablony `ZERO` / `MANUAL`;
`/ask ` prefix pro `MANUAL`.
**Migrace:** žádná.
**Proč je bezpečné mergnout samostatně:** dokud owner příkaz nepošle, nic se
nemění.
**Závislost:** Krok 2.

### Krok 4 — trivial-turn gate

**Obsah:** whitelist + normalizace; proxy „čeká na potvrzení"; zapojení v
`process-owner-queue.ts` před extrakcí a v `LEAN` před Buddy.
**Migrace:** žádná.
**Proč je bezpečné mergnout samostatně:** jen ubírá volání, nikdy nepřidává.
**Závislost:** Krok 2 (režim `LEAN`).

### Migrace — souhrn

| # | Krok | Soubor | Tabulka/sloupec | Zasahuje uzavřený blok? |
|---|------|--------|------------------|--------------------------|
| 1 | Krok 1 | `0021_cost_modes.sql` (nová) | nová `owner_cost_policy` | Ne — aditivní, FK na `owners` (BUILD-02) |
| 1 | Krok 1 | `0021_cost_modes.sql` | nová `llm_guard_denials` | Ne — aditivní, FK na `message_processing_jobs` |
| 1 | Krok 1 | `0021_cost_modes.sql` | `llm_attempts.estimated_cost_usd` (nový nullable sloupec) | Aditivně BUILD-11 (`0017`) |
| 1 | Krok 1 | `0021_cost_modes.sql` | `pricing_catalog.unit_price_usd` změna typu + seed 5 řádků | ANO — `0010` (BUILD-02 éra); tabulka prázdná, žádná data se nepřepisují |

### Návrh SQL — **ČEKÁ NA GO, NESPOUŠTĚT**

```sql
-- H2 Buddy — h2-runtime — 0021_cost_modes
-- COST-MODES-PLAN.md Rozhodnutí 1–3. NÁVRH, neaplikováno.

-- 1) pricing_catalog: přesnost + seed (tabulka je prázdná)
alter table pricing_catalog alter column unit_price_usd type numeric(18, 12);

insert into pricing_catalog (resource, unit, unit_price_usd) values
  ('anthropic/claude-sonnet-5',            'tokens_input',  0.000002),
  ('anthropic/claude-sonnet-5',            'tokens_output', 0.000010),
  ('anthropic/claude-haiku-4-5-20251001',  'tokens_input',  0.000001),
  ('anthropic/claude-haiku-4-5-20251001',  'tokens_output', 0.000005),
  ('openai/whisper-1',                     'minutes',       0.006);

-- 2) owner_cost_policy
create table owner_cost_policy (
  owner_id uuid primary key references owners (id),
  mode text not null default 'NORMAL',
  per_job_cap_usd numeric(10, 4) not null,
  daily_cap_usd numeric(10, 4) not null,
  monthly_cap_usd numeric(10, 4) not null,
  deep_until timestamptz null,
  changed_via text not null,
  source_raw_event_id uuid null references raw_events (id),
  updated_at timestamptz not null default now(),

  constraint owner_cost_policy_mode_check check (mode in ('ZERO', 'LEAN', 'NORMAL', 'DEEP', 'MANUAL')),
  constraint owner_cost_policy_changed_via_check check (changed_via in ('MIGRATION_SEED', 'TELEGRAM_COMMAND', 'WEB_REAUTH')),
  constraint owner_cost_policy_caps_nonneg check (per_job_cap_usd >= 0 and daily_cap_usd >= 0 and monthly_cap_usd >= 0),
  constraint owner_cost_policy_monthly_hard_cap check (monthly_cap_usd <= 35),
  constraint owner_cost_policy_deep_until check ((mode = 'DEEP') = (deep_until is not null))
);

-- Seed PŘED zapnutím force RLS (migrátor jinak neprojde owner_isolation policy).
-- Hodnoty čekají na GPT gate (Rozhodnutí 2).
insert into owner_cost_policy (owner_id, mode, per_job_cap_usd, daily_cap_usd, monthly_cap_usd, changed_via)
select id, 'NORMAL', 0.30, 1.50, 35.00, 'MIGRATION_SEED' from owners;

alter table owner_cost_policy enable row level security;
alter table owner_cost_policy force row level security;
create policy owner_isolation on owner_cost_policy
  using (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid)
  with check (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid);
grant select, insert, update on owner_cost_policy to h2_runtime;

-- 3) llm_attempts: odhad ceny pro konzervativní součet útraty
alter table llm_attempts add column estimated_cost_usd numeric(10, 4) null;

-- 4) llm_guard_denials
create table llm_guard_denials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  job_id uuid not null references message_processing_jobs (id),
  purpose text not null,
  model_id text not null,
  reason text not null,
  estimated_cost_usd numeric(10, 4) null,
  created_at timestamptz not null default now(),

  constraint llm_guard_denials_reason_check check (
    reason in ('NO_POLICY', 'MODE_BLOCKS_PURPOSE', 'NOT_CERTIFIED', 'NO_PRICE', 'CAP_JOB', 'CAP_DAY', 'CAP_MONTH')
  )
);
create index llm_guard_denials_owner_created_idx on llm_guard_denials (owner_id, created_at);

alter table llm_guard_denials enable row level security;
alter table llm_guard_denials force row level security;
create policy owner_isolation on llm_guard_denials
  using (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid)
  with check (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid);
grant select, insert on llm_guard_denials to h2_runtime;
```

Poznámky k migraci:
- RLS + grant vzor převzatý z `0017_llm_attempts.sql:44-50 @ be0fc89`.
- Ověření po aplikaci přes `_h2_migrations` na obou Neon větvích (Pravidlo 5).
- Produkční migrace = Honzíkovo GO (Pravidlo 4).
- Seed `pricing_catalog` = stejné hodnoty jako dnešní konstanty
  (`usage.ts:11-14`, `voice/usage.ts:16 @ be0fc89`), převedené na cenu za
  jednotku.

---

## Test plán (návrh, upřesní se při implementaci)

Všechno s mockovaným `callAnthropicModel` (vzor BUILD-10 — žádné reálné
volání v CI).

- **ZERO** (Rozhodnutí 5): zpráva v `ZERO` → 0× `callModel`, `responses` řádek
  s šablonou, delivery `DELIVERED`, žádný `QUARANTINED`, `attempt_count` = 1. (Krok 2)
- **CAP_MONTH** (Rozhodnutí 2): útrata ledger + odhady ≥ strop → odmítnuto,
  řádek v `llm_guard_denials`, šablona se stropem, žádná karanténa. (Krok 2)
- **Hranice stropu** (Rozhodnutí 2): útrata těsně pod stropem, odhad přes →
  odmítnuto; odhad pod → povoleno. (Krok 2)
- **Nezaplacená mezera** (Rozhodnutí 2): `llm_attempts` řádek
  `ABANDONED_UNKNOWN` s `estimated_cost_usd` bez ledger řádku se počítá do
  útraty. (Krok 2)
- **NOT_CERTIFIED** (Rozhodnutí 2): aktivní prompt bez PASS pro `H2_MODELS.buddy`
  → odmítnuto + `incidents` řádek, bez karantény. (Krok 2)
- **NO_PRICE** (Rozhodnutí 3): chybí řádek v `pricing_catalog` → odmítnuto;
  `recordAnthropicUsage()` hodí chybu. (Krok 1/2)
- **NO_POLICY** (Rozhodnutí 1): chybí `owner_cost_policy` → chová se jako
  `ZERO` + incident. (Krok 2)
- **Extrakce odmítnutá** (Rozhodnutí 2): `LEAN` → extrakce 0×, Buddy 1×. (Krok 2)
- **Governance** (Rozhodnutí 2): `callAnthropicModel` importuje v `h2/` jen
  `h2/cost/guard.ts`. (Krok 2)
- **Fantomové attempts** (Rozhodnutí 2): `/stop` → 0 `llm_attempts` řádků. (Krok 2)
- **`/mode zero` idempotence** (Rozhodnutí 1, I7.3): stejný `raw_event_id` 2× →
  jedna změna. (Krok 3)
- **`/mode deep` z Telegramu** (Rozhodnutí 1): odmítnuto, odpověď s odkazem na
  web, režim beze změny. (Krok 3)
- **Věta s „mode"** (I7.6): „dej mi mode zero prosím" → není příkaz. (Krok 3)
- **`/stop` při `CAP_MONTH`** (I7.1): funguje, epoch se bumpne. (Krok 3)
- **Trivial „díky"** (Rozhodnutí 4): po odpovědi bez `?` → extrakce 0×; po
  odpovědi s `?` → gate se nevyhodnotí, extrakce proběhne. (Krok 4)
- **„ok, a zítra?"** (Rozhodnutí 4): není ve whitelistu → normální cesta. (Krok 4)
- **DEEP expirace** (Rozhodnutí 1): `deep_until` v minulosti → guard zapíše
  `NORMAL` a pokračuje. (Krok 3)

## Co zůstává mimo scope (vědomě)

- Zbytek BUILD-27: warning 25 USD, pauza background syntéz 30 USD,
  `projected_monthly_cost` dashboard.
- Hromadný reprocess zpráv odpovězených v `ZERO` / pod stropem.
- `awaiting_owner_reply` jako strukturované pole výstupu `BUDDY_RESPONSE`
  (BUILD-12, s RED-TEAM bodem 1).
- Vynucení `/pause` („Buddy do odvolání nereaguje") — dnes se stav pause
  nikde neukládá, jen se bumpne epoch. Zjištěno při průzkumu, samostatný slice.
- Anthropic 400 „credit balance" → falešná karanténa (DEC-008 pozorování).
- Whisper runtime guard — `transcribeVoiceJob()` nemá produkčního volajícího.
- H2-IW ledger (samostatný systém, DEC-009).
- Prompt caching v H2 Buddy runtime.

## Co potřebuji od Honzíka

Hodnoty (stropy, whitelist, šablony) jdou přes GPT gate, ne na Honzíka.
Na Honzíkovi jsou jen brány:

1. Poslat tenhle plán na adversarial review (GPT gate, pak Codex).
2. GO na plán po review (případně v2 po zapracování nálezů).
3. GO na produkční migraci `0021_cost_modes.sql` — až při implementaci Kroku 1.
4. Rozhodnutí 6 (profile bridge) → DEC-012.

---

[gr150]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/buddy/generate-response.ts#L150-L157
[gr117]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/buddy/generate-response.ts#L117-L124
[oe75]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/extraction/operational-extraction.ts#L75
[poq69]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/processing/process-owner-queue.ts#L69-L81
[poq95]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/processing/process-owner-queue.ts#L95-L97
[poq137]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/processing/process-owner-queue.ts#L137-L139
[act42]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/prompts/activation.ts#L42-L51
[us11]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/prompts/usage.ts#L11-L14
[vu16]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/voice/usage.ts#L16
[m0010]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/db/migrations/0010_billing_and_ops.sql#L26-L52
[bs876]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/docs/h2/BUILD-STATUS.md#L876
[bs886]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/docs/h2/BUILD-STATUS.md#L886
[iwc60]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/inbox-watcher/h2iw/config.py#L60-L61
[cfp20]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/ingestion/control-fast-path.ts#L20-L28
