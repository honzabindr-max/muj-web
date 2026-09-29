# COST-MODES — nákladové režimy + pre-call guard — návrh plánu (v2)

**Status:** **v2 — po adversarial gate, čeká na nové review.** **NEIMPLEMENTOVÁNO,
žádná migrace nespuštěna, žádný kód nezměněn.** v1 (commit `062f060`) prošla
Codex adversarial gate *„H2 Buddy — adversarial gate nákladových režimů"*
(2026-09-29, verdikt **MODIFY**, posuzovaný HEAD
`062f06024a30df14d1052e83f109e48699b56ab4`). v2 zapracovává všech 12 závazných
změn z gate (mapa v sekci „Změny v2 oproti v1"). Gate není GO k migraci ani
nasazení — po v2 následuje nové review a Honzíkovo GO.

Zdroj zadání v1: GPT gate „H2 Architecture Delta Review v2" (2026-09-29)
schválil cost modes + pre-call enforcement jako **P0**. Dokument není BUILD
blok — předbíhá část BUILD-27 (Usage & budget guardrails) a řeší otevřenou
položku M1 deploy gate „tvrdý strop 35 USD/měsíc vynucený" v rozsahu
definovaném v sekci „Rozpočtový kontrakt". Navrhuje dva záznamy v
DECISIONS.md: **DEC-011** (cost modes, guard, účetní kontrakt, billing breaker)
a **DEC-012** (profile bridge). DEC-010 je obsazené (PR #70, na `main`). Nic
z toho se nezapisuje teď — až po review a GO.

> **Všechny odkazy `soubor:řádek` v tomhle dokumentu jsou pinované na commit
> `be0fc89`** (`be0fc896d94c1f0a31e3e61290a782e2b13e4881`). PR #70 mezitím
> přesunul `docs/h2/BUILD-STATUS.md` do `docs/h2/history/build/` — odkazy na
> živý soubor by se rozbily, pin to řeší. Klíčové odkazy mají GitHub permalink
> s hashem (reference na konci dokumentu).

## Změny v2 oproti v1 (gate → sekce)

| # | Závazná změna z gate | Kde v dokumentu |
|---|---|---|
| 1 | 35 USD = Buddy provoz + jeho certifikace ve stejném ledgeru; H2-IW samostatně 3 USD; žádné tvrzení o stropu celého Anthropic účtu | „Rozpočtový kontrakt"; řádek DEC-009 v „Dopad na invarianty" |
| 2 | Autorizační matice, pořadí režimů, MANUAL kontrakt, `policy_version`, historie změn, jednotné pořadí writerů, DEEP mimo P0 | Rozhodnutí 1 |
| 3 | Atomický check-and-reserve místo check-then-call, i pro certifikace | Rozhodnutí 2 → „Protokol check-and-reserve" |
| 4 | Rezervace = doložitelná horní mez ceny celého requestu; 1 pokus = 1 rezervace; ochrana rozpočtu odpovědi před extrakcí | Rozhodnutí 2 → „Horní mez rezervace" |
| 5 | Settlement attempt ↔ usage, idempotence, usage i při refusal/max_tokens, timeout ≠ nula, období podle přijetí, bezpečný počáteční stav | „Účetní kontrakt (settlement)" |
| 6 | DEC-008: oddělené měření času a evidence LLM pokusu | Rozhodnutí 2 → „Čas vs. peníze (DEC-008)"; řádek DEC-008 v „Dopad na invarianty" |
| 7 | Billing breaker v P0 | „Billing breaker (P0)" |
| 8 | Cenový snapshot, zákaz překryvu intervalů, certifikační vazba na předanou dvojici | Rozhodnutí 3; Rozhodnutí 2 → krok „Certifikace" |
| 9 | Šablony podle tabulky z gate, `/cost`, ZERO ≠ PAUSE | Rozhodnutí 5 |
| 10 | Trivial-turn, DEEP a profile bridge mimo P0; DEC-012 A/B/C/D | Rozhodnutí 4 (vyřazeno); Rozhodnutí 6; „Co zůstává mimo scope" |
| 11 | Rollout: napřed aditivní schéma + účetnictví + mock testy, pak společná aktivace; default ZERO; seed NORMAL jako explicitní krok | „Implementační strategie" |
| 12 | Regresní matice z gate; návrhy DEC-011/012 | „Povinné regresní scénáře"; „Návrhy DEC-011 a DEC-012" |

Fakt doložený pro v2 (nic se nestaví): adapter volá API syrovým `fetch` bez SDK
a bez vnitřního retry — splnění požadavku „žádný skrytý retry" (viz „Výchozí stav").

## Rozsah

**P0 (tento plán):**

1. Owner-scoped cost policy (`ZERO` / `MANUAL` / `LEAN` / `NORMAL`), autorizační
   matice Telegram/web, historie změn. → Rozhodnutí 1
2. Jediný pre-call guard s atomickým check-and-reserve, horní mez ceny,
   certifikační vazba, odmítnutí bez falešné karantény. → Rozhodnutí 2
3. Účetní kontrakt: rezervace → vypořádání, období, počáteční stav. → „Účetní kontrakt"
4. Billing breaker pro vyčerpaný kredit poskytovatele. → „Billing breaker"
5. `pricing_catalog` s cenovým snapshotem jako jediný zdroj ceny. → Rozhodnutí 3
6. Deterministické šablony a `/cost`. → Rozhodnutí 5

**Vyřazeno z P0 (gate bod 10):** trivial-turn gate (Rozhodnutí 4, REJECT),
režim `DEEP`, implementace profile bridge (Rozhodnutí 6 = jen směr pro DEC-012).

## Výchozí stav — ověřeno proti kódu na `be0fc89`

| Tvrzení | Ověřeno |
|---|---|
| LLM volají v runtime jen dva moduly, oba přes `callAnthropicModel()` | [`generate-response.ts:150 @ be0fc89`][gr150] (`BUDDY_RESPONSE`), [`operational-extraction.ts:75 @ be0fc89`][oe75] (`OPERATIONAL_EXTRACTION`). Třetí místo je `h2/prompts/fixtures.ts @ be0fc89` s injektovaným `callModel` — operátorský certifikační běh (certify skript v PR #49), ne runtime. |
| **Adapter volá API syrovým `fetch`, bez SDK a bez vnitřního retry** | [`anthropic-adapter.ts:4-6 @ be0fc89`][aa4] (komentář „syrový `fetch`, žádná `@anthropic-ai/sdk` závislost"), [`:59`][aa59] jediný `fetch`, žádná smyčka; 429/5xx se jen hodí jako typovaná chyba. **Tím je splněn požadavek gate „jeden provider pokus = jedna rezervace, žádný skrytý HTTP/SDK retry".** Retry existuje jen na úrovni jobu (`recordJobFailure`) a každý takový pokus půjde novou rezervací. |
| Adapter u HTTP 400 **nečte tělo chyby** | [`anthropic-adapter.ts:83-85 @ be0fc89`][aa83] → vždy `ANTHROPIC_BAD_REQUEST`. Billing klasifikace (viz „Billing breaker") vyžaduje čtení error body — implementační důsledek. |
| Refusal / max_tokens hodí chybu **bez usage** | `anthropic-adapter.ts:102-106 @ be0fc89`; komentář `generate-response.ts:146-149 @ be0fc89` („known gap"). Adapter musí vracet usage i s chybou (viz „Účetní kontrakt"). |
| Runtime čte aktivní prompt z registry, model z configu | [`generate-response.ts:129 @ be0fc89`][gr129] (`getActivePromptVersion()`), [`:151`][gr150] (`H2_MODELS.buddy`) |
| `withLlmAttempt()` obaluje **celou** `generateBuddyResponse()`, včetně dedup a command cesty, kde se LLM nevolá | [`process-owner-queue.ts:137 @ be0fc89`][poq137]; extrakce [`process-owner-queue.ts:95 @ be0fc89`][poq95] — extrakce běží **před** Buddy odpovědí (`:133-139`) |
| `llm_attempts.job_id` je `NOT NULL`, statusy `CALL_INTENT`/`SUCCEEDED`/`FAILED_CONFIRMED`/`ABANDONED_UNKNOWN`, žádná cena | `0017_llm_attempts.sql:22-35 @ be0fc89` |
| `usage_ledger` = řádek na jednotku (`tokens_input`, `tokens_output`, …), `cost_usd numeric(10,4)`, bez vazby na pokus | `0010_billing_and_ops.sql:6-22 @ be0fc89` — `numeric(10,4)` zaokrouhluje jednotlivé volání (≈ 0,0001 USD) |
| Certifikace (PASS v `prompt_test_runs`) se kontroluje **jen při aktivaci** | [`activation.ts:42-51 @ be0fc89`][act42]; `registry.ts:33-40 @ be0fc89`. `checkModelDrift()` (`model-drift.ts:33 @ be0fc89`) není zapojený (BUILD-23). |
| Ceny jsou natvrdo v kódu | [`h2/prompts/usage.ts:11-14 @ be0fc89`][us11] (Sonnet 5: 2 / 10 USD/MTok, Haiku 4.5: 1 / 5 USD/MTok); [`h2/voice/usage.ts:16 @ be0fc89`][vu16] (Whisper 0,006 USD/min) |
| `pricing_catalog` existuje jen jako schéma, kód z něj nečte; `unit_price_usd numeric(12,6)`; žádná ochrana proti překryvu intervalů | [`0010_billing_and_ops.sql:26-40 @ be0fc89`][m0010], `0011_roles_and_rls.sql:97 @ be0fc89` |
| `provider_policy_catalog` = retenční snapshot pro Privacy/Delete UI, ne routing ani náklady | `0010_billing_and_ops.sql:42-50 @ be0fc89` |
| `usage_ledger` se zapisuje, ale nikde nesčítá | žádný `sum(cost_usd)` v TS kódu |
| H2 Buddy nemá finanční strop; M1 gate ho požaduje | [`BUILD-STATUS.md:876 @ be0fc89`][bs876], [`:886`][bs886] |
| H2-IW strop má — vzor, včetně billing klasifikace | [`h2iw/config.py:60-61 @ be0fc89`][iwc60] (`MONTHLY_USD_CAP = 3.00`); `h2iw/main.py:188-199, 274-277 @ be0fc89` (`is_llm_unavailable`: „credit balance"); [DEC-009](./DECISIONS.md#dec-009) Doplněk 9 (`DECISIONS.md:217 @ be0fc89`) |
| Intent vrací `BUDDY_RESPONSE`, ne samostatné volání | `stance-intent-schema.ts:45-49 @ be0fc89` |
| Command Gate je deterministický exact lookup | [`control-fast-path.ts:20-28 @ be0fc89`][cfp20], aplikace při ingestu `ingest-message.ts:129-135 @ be0fc89`, ack cesta [`generate-response.ts:117-124 @ be0fc89`][gr117] |
| Každá chyba Buddy cesty jde do `recordJobFailure()`; Anthropic 400 je non-retryable → okamžitá karanténa | [`process-owner-queue.ts:69-81 @ be0fc89`][poq69], `:153-158`; `prompts/errors.ts:42-51 @ be0fc89` |
| Žádná owner-level tabulka nastavení; stav „pause" se neukládá | `owners` (`0001`), `owner_processing_state` (`0002_messaging.sql:71-79 @ be0fc89`) |
| Poslední migrace `0020_system_notice_deliveries.sql`, další **0021** | `h2/db/migrations/ @ be0fc89` |
| Fronta ownera je serializovaná přes lease | `lease.ts:177-222 @ be0fc89` — **není** to důkaz vyloučení starého workeru po expiraci lease ani souběhu s certifikací (gate §2); guard proto zamyká sám. |

## Co tenhle plán znovu nestaví

- `llm_attempts` + `withLlmAttempt()` (0017, BUILD-11 Rozhodnutí 10) — rozšíří
  se o rezervaci a settlement, obal se přesune těsně kolem volání.
- Processing budget (0018, [DEC-008](./DECISIONS.md#dec-008)) — **beze změny
  sémantiky**, viz „Čas vs. peníze".
- Command Gate (DEC-007) — rozšiřuje se o druhou lookup tabulku, mechanismus
  a C2 zůstávají.
- Delivery (`deliverResponse`) a `system_notice_deliveries` (0020).

---

## Rozpočtový kontrakt (gate bod 1)

- **35 USD/měsíc = strop H2 Buddy provozu + certifikačních běhů Buddy promptů,
  vedených ve stejném ledgeru** (`llm_attempts` + `usage_ledger` v Neon
  `h2-runtime`). Certifikace smí obejít runtime požadavek na existující PASS,
  **nesmí** obejít rezervaci ani účtování — jde stejným protokolem
  check-and-reserve (per volání).
- **H2-IW (Inbox Watcher) má samostatný strop 3 USD/měsíc** ve vlastním SQLite
  ledgeru `llm_calls` na VPS ([DEC-009](./DECISIONS.md#dec-009)). Tento plán ho
  nemění a nesdílí s ním ledger ani ceník.
- **Tento plán negarantuje žádný strop celého Anthropic účtu.** Součet obou
  systémů není nikde vynucený. Pokud má M1 znamenat 35 USD pro celé H2, musí
  se před přijetím změnit rozpočtový kontrakt a zahrnout Watcher — to je
  rozhodnutí mimo tento dokument.
- **Předplacený kredit bez auto-reloadu je vnější konečná zásoba, ne měsíční
  limit**: může dojít dřív než lokální strop i být vyšší. Nenahrazuje lokální
  guard; jeho vyčerpání řeší „Billing breaker".
- `CHECK (monthly_cap_usd <= 35)` v DB omezuje **konfiguraci**, ne skutečnou
  útratu. Skutečnou útratu vynucuje až guard s rezervacemi; sám CHECK M1 gate
  neuzavírá.
- Hodnoty stropů (gate §3 ACCEPT jako startovní nastavení): **per-job 0,30 /
  den 1,50 / měsíc 35,00 USD.** Denní maximum není denní příděl (30 × 1,50 =
  45) — měsíční strop se vynucuje nezávisle. Další úpravy jen podle četnosti
  odmítnutí a skutečné ceny, ne podle dojmu.

---

## Rozhodnutí 1 (návrh): cost policy, autorizační matice, historie změn

**Kontext:** režim je owner-scoped provozní stav, mění se za běhu (i z mobilu
přes Telegram) a jeho změny musí být auditovatelné a seřazené vůči placeným
voláním. Dnes pro něj není místo (`h2/config/capabilities.ts:21-33 @ be0fc89`
jsou konstanty).

**Doporučení (beze změny od v1): samostatná tabulka `owner_cost_policy`**
(varianty A env / B sloupec na `owner_processing_state` zamítnuté z důvodů v1:
deploy pro změnu, míchání s lease stavem). v2 přidává `policy_version` a
append-only historii.

### Režimy a pořadí oprávnění

Pořadí oprávnění k placeným voláním: **`ZERO < MANUAL < LEAN < NORMAL`**
(`DEEP` bude nad `NORMAL`, ale v P0 neexistuje — viz níže).

| Režim | Povolené purpose | Poznámka |
|---|---|---|
| `ZERO` | žádný | Deterministická odpověď (Rozhodnutí 5). `/ask` v ZERO nic neodemkne. |
| `MANUAL` | `BUDDY_RESPONSE` **jen** pro zprávu s platným `/ask` (kontrakt níže) | Bez extrakce, bez background práce, bez trvalé změny režimu. |
| `LEAN` | `BUDDY_RESPONSE` | Bez extrakce. (v1 trivial-turn náhrada Buddy odpovědi vyřazena — Rozhodnutí 4.) |
| `NORMAL` | `BUDDY_RESPONSE`, `OPERATIONAL_EXTRACTION` | Dnešní rozsah volání. |

**Režim nikdy nemění model** (beze změny od v1): model je zamčený v
`h2/config/models.ts @ be0fc89` a každý pár prompt × model musí mít PASS.

**`DEEP` je vyřazen z P0** (gate bod 10): runtime `BUDDY_DEEP_DIVE` nepoužívá
(přijde s BUILD-26), takže nemá odlišnou funkci ani určený zvýšený per-job
limit. Není v `CHECK` migrace 0021. Až se bude zavádět, návrh musí určit:
funkci, zvýšený per-job cap, automatický zdroj změny v historii (`EXPIRY`),
obnovu běžného per-job capu při expiraci, pravidlo „expirace nepřepíše
mezitím nastavené ZERO" a to, že efektivní omezení platí i bez úspěšného
úklidového zápisu expirace (guard čte `deep_until` sám).

### MANUAL kontrakt (gate bod 2)

MANUAL = výslovná žádost o **jednu** Buddy odpověď, ne povolení celé pipeline.

- **Přesný parser**, žádné NLP: aktuální autentizovaná zpráva po `trim()`
  začíná přesně `/ask ` (lomítko, `ask`, mezera) a zbytek po `trim()` je
  neprázdný. Nic jiného.
- Výsledek parseru se uloží jako důvěryhodně odvozený příznak vázaný na
  `raw_event_id` (vedle nezměněného raw textu, I6). Guard čte **jen tento
  příznak** aktuálního jobu.
- **Holé `/ask`** (bez textu) → deterministická nápověda bez LLM.
- **`/ask` v `ZERO`** → šablona ZERO, 0 volání. Režim se nemění.
- **Prefix v historii, citaci, přeposlané zprávě nebo ve výstupu modelu nic
  nepovoluje** — rozhoduje jen parser nad aktuální zprávou.
- Povolený purpose je pouze `BUDDY_RESPONSE`; extrakce ani background práce
  se nespustí. Retry stejného jobu zůstává pod stejným per-job capem.
- **Zbytkové riziko (přijaté):** kompromitovaný Telegram v již zapnutém
  MANUAL může posílat `/ask` až do stropu. Asymetrie chrání před *zvýšením*
  oprávnění, ne před každým zneužitím autentizovaného kanálu.

### Autorizační matice (gate bod 2)

| Změna | Telegram (Command Gate, protokolový příkaz) | Web (`requireRecentReauth()`) |
|---|---|---|
| Na stejný nebo nižší režim (např. `NORMAL → MANUAL`, `NORMAL → ZERO`, `LEAN → ZERO`) | **Ano** | Ano |
| Na vyšší režim (např. `ZERO → NORMAL`, `ZERO → MANUAL`, `MANUAL → LEAN`) | **Ne** — deterministická odpověď s odkazem na web | **Ano** |
| Částky stropů (per-job / den / měsíc) | **Ne** | Ano, v mezích `CHECK` |
| `/mode` (výpis), `/cost` (výpis) | Ano, v každém režimu | Ano |
| Obnova billing breakeru | Ne | Ano (viz „Billing breaker") |

`ZERO → NORMAL` je zvýšení oprávnění k placeným voláním i při nezměněných
stropech — věta v1 „`/mode normal` ze `ZERO` je bezpečné" je **odstraněna**.

Protokolové příkazy (`PROTOCOL_COMMANDS` vedle `FAST_PATH_COMMANDS` v
`control-fast-path.ts`, exact whole-message match po `trim().toLowerCase()`):
`/mode zero`, `/mode manual`, `/mode lean`, `/mode normal`, `/mode`, `/cost`.
`/ask …` není protokolový příkaz — je to parser nad zprávou, která dál prochází
normálním lifecycle (DEC-007 C2: cost příkaz ani `/ask` nevyřazují zprávu z
lifecycle).

### `policy_version`, historie a pořadí writerů (gate bod 2)

- `owner_cost_policy.policy_version bigint` — zvyšuje se při každé změně.
- **Append-only `owner_cost_policy_changes`:** `id`, `owner_id`,
  `operation_id uuid UNIQUE` (idempotence), `from_version`, `to_version`,
  `old_policy jsonb`, `new_policy jsonb`, `actor` (`OWNER` / `SYSTEM` /
  `MIGRATION`), `channel` (`TELEGRAM_COMMAND` / `WEB_REAUTH` / `ROLLOUT`),
  `source_raw_event_id uuid UNIQUE NULL`, `created_at`. Jen INSERT pro
  `h2_runtime`.
- **Jediný writer `applyPolicyChange(ownerId, expectedVersion, change, operationId, channel)`**,
  volaný z Telegram ingestu, z webu i (budoucí) z expirace. V jedné transakci:
  1. `pg_advisory_xact_lock` na **owner budget lock** (tentýž zámek jako
     rezervace v Rozhodnutí 2),
  2. idempotence: `operation_id` / `source_raw_event_id` už v historii → no-op,
     vrátí původní výsledek,
  3. compare-and-set: `policy_version = expectedVersion`, jinak odmítnout jako
     stale (web ukáže aktuální stav),
  4. autorizace podle matice (kanál × směr změny),
  5. UPDATE policy + INSERT historie.
- Telegram: `expectedVersion` = verze načtená při ingestu téže transakce;
  idempotence podle `raw_event_id` (I7.3), pořadí podle input sequence (I7.4).
  **Retry starého webhooku** narazí na `source_raw_event_id UNIQUE` → no-op,
  nevrátí starší policy. **Stale web update** (formulář načtený před novějším
  ZERO) neprojde compare-and-set.

### Účinnost změny (gate bod 2.6)

Změna policy a přijetí nového volání (rezervace) se serializují na **stejném
owner budget zámku**. Volání, jehož rezervace se commitla před změnou na ZERO,
smí doběhnout, doručit se a započítat. Po commitu změny už žádná nová
rezervace nevznikne. **ZERO není STOP:** nebumpuje `owner_control_epoch` a
neruší rozběhnuté volání; fencing doručení při skutečném `/stop` / `/pause`
zůstává beze změny.

**Chybějící řádek policy = fail-closed** (`NO_POLICY`, žádné placené volání) +
incident.

**Dopad:** migrace 0021 (tabulky), `control-fast-path.ts`, `command-gate.ts`,
`ingest-message.ts` (parser `/ask`, aplikace `/mode`), nová webová akce s reauth.

---

## Rozhodnutí 2 (návrh): jediný pre-call guard s atomickým check-and-reserve

**Kontext:** mezi rozhodnutím „zpracuj job" a placeným voláním dnes nestojí
nic. Guard musí být **jediné** místo, přes které jde každé placené volání
(runtime i certifikace), a strop musí být tvrdý i při souběhu, starém workeru
a nejisté ceně.

**Modul `h2/cost/guard.ts`:**

```ts
guardedModelCall(ctx: {
  pool, token /* FencingToken | CertificationRunRef */, purpose,
  promptVersionId, promptContent, modelId,   // přesně to, co se odešle
  input, maxOutputTokens, outputSchema?,
}) → { allowed: true, result, attemptId }
   | { allowed: false, reason: GuardDenialReason }
```

Volající předává **`promptVersionId` + `promptContent` + `modelId`, které se
skutečně odešlou**. Guard aktivní prompt znovu **nečte** (dnes
`generate-response.ts:129` čte prompt z registry a `:151` bere model z
`H2_MODELS.buddy` — tuto dvojici guard dostane hotovou). Build-governance test
(vzor `h2/build-governance/__tests__/prompt-activation-single-writer.test.ts
@ be0fc89`) vynutí, že `callAnthropicModel` importuje v `h2/` jen
`h2/cost/guard.ts`; certifikační skript volá `guardedModelCall` v režimu
`CERTIFICATION` (bez požadavku na existující PASS).

### Protokol check-and-reserve (gate bod 3)

**Fáze 1 — krátká DB transakce pod owner budget zámkem**
(`pg_advisory_xact_lock(hash('h2_budget', owner_id))`), žádné síťové volání
uvnitř:

1. **Policy:** načíst `owner_cost_policy` → chybí: `NO_POLICY`.
2. **Režim → purpose** (tabulka Rozhodnutí 1; pro `MANUAL` příznak `/ask`
   aktuálního `raw_event_id`) → `MODE_BLOCKS_PURPOSE`.
3. **Billing breaker** pro credential `OPEN` → `PROVIDER_BILLING_UNAVAILABLE`
   (`HALF_OPEN` viz „Billing breaker").
4. **Platný lease:** runtime — fencing token jobu je stále aktuální
   (`owner_processing_state.active_job_id`, lease neexpiroval, epoch sedí);
   jinak `H2FencingError` jako dnes (ne denial). Certifikace — platný
   certifikační běh.
5. **Certifikace:** existuje PASS v `prompt_test_runs` pro **předanou**
   dvojici (`promptVersionId`, `modelId`) → jinak `NOT_CERTIFIED`. Předaný
   `promptContent` musí odpovídat obsahu verze `promptVersionId` (hash) —
   souběžná aktivace jiné verze mezi čtením a voláním tak nemůže vytvořit
   nesoulad „ověřeno B, odesláno A". (Režim `CERTIFICATION` tento krok
   přeskakuje.)
6. **Cenový snapshot:** jediná platná cena pro `(resource, unit)` v čase
   přijetí (Rozhodnutí 3) → chybí nebo nejednoznačná: `NO_PRICE`.
7. **Horní mez rezervace** (podsekce níže) → nepodporovaný payload:
   `UNSUPPORTED_REQUEST`.
8. **Zbývající rozpočet** (útrata + držené rezervace, „Účetní kontrakt"):
   `job + rezervace > per_job_cap` → `CAP_JOB`; den → `CAP_DAY`; měsíc →
   `CAP_MONTH`. Pro extrakci navíc ochrana odpovědi (níže).
9. **INSERT `llm_attempts`** ve stavu `RESERVED` s rezervací, cenovým
   snapshotem, `period_day`/`period_month` a `policy_version`. **COMMIT.**

**Fáze 2 — síťové volání mimo zámek a mimo transakci.** Zámek se nikdy
nedrží přes provider call (I7.1: control cesta nesmí čekat na síťový timeout
modelu pod DB lockem).

**Fáze 3 — vypořádání** (samostatná idempotentní transakce, „Účetní kontrakt").

Stejný protokol platí pro **všechny spendery rozpočtu** — runtime Buddy,
runtime extrakci i certifikační běhy (rezervace per volání; pouhý dotaz na
zbytek před celým během nestačí). Rezervace starého, již přijatého volání
se do zůstatku počítá, dokud není vypořádaná.

### Horní mez rezervace (gate bod 4)

- **Rezervace = doložitelná horní mez ceny celého requestu**: systémový
  prompt + historie/kontext + výstupní schéma + overhead requestu (role,
  formátování, tool/format definice) na vstupu, plus `maxOutputTokens` na
  výstupu, každá část × sazba z cenového snapshotu.
- Poměr 3,5 znaku/token (`h2/context/token-budget.ts:41 @ be0fc89`) **není**
  zaručená horní mez pro libovolný text. Pokud implementace nedoloží horní
  mez (např. bajty UTF-8 jako strop počtu tokenů + pevná rezerva na overhead,
  doložená testem proti tokenizeru), **rezervuje se vynucený maximální vstup
  requestu + maximální výstup**: vstup se před voláním tvrdě omezí na
  `maxInputTokens` purpose (`CONTEXT_TOKEN_BUDGETS`), výstup na
  `maxOutputTokens`, a rezervuje se `maxInputTokens × sazba_in +
  maxOutputTokens × sazba_out`.
- Payload, jehož cenu nelze omezit (nepodporovaný typ obsahu, cache tokeny,
  nástroje s neznámým účtováním) → fail-closed `UNSUPPORTED_REQUEST`.
- **Zaokrouhlení vždy nahoru**, výpočet v `numeric(18,12)`; zobrazení se
  zaokrouhluje až ve výstupu `/cost`.
- **Jeden provider pokus = jedna rezervace.** Adapter nemá skrytý retry
  (`anthropic-adapter.ts:4-6,59 @ be0fc89`); job-level retry jde vždy novou
  rezervací. Per-job cap zahrnuje obě purpose a všechny pokusy jobu.
- **Ochrana rozpočtu odpovědi před volitelnou extrakcí:** extrakce běží před
  Buddy odpovědí (`process-owner-queue.ts:133-139 @ be0fc89`). Guard ji
  přijme jen když zbývající rozpočet (job, den, měsíc) ≥ rezervace extrakce
  **+** horní mez rezervace Buddy odpovědi. Jinak se extrakce přeskočí
  (`BUDGET_RESERVED_FOR_RESPONSE`, bez incidentu) a Buddy odpověď má prostor.

Orientační horní meze při cenách v1 (vstup plánu, ne ověřený ceník; gate §3):
Buddy 24 000 × 2 + 2 048 × 10 USD/MTok = **0,06848 USD**; extrakce 8 000 × 1 +
2 048 × 5 USD/MTok = **0,01824 USD**; 3 pokusy obou purpose **0,26016 USD** →
per-job 0,30 má rezervu 0,03984 USD. Denní 1,50 USD ≈ 17 průchodů obou purpose;
vyšší bezpečná rezervace může legitimně snížit dostupnost — to není důvod
podhodnocovat guard.

### Čas vs. peníze — DEC-008 zachováno (gate bod 6)

v1 navrhovala přesun `withLlmAttempt()` dovnitř guardu se zúžením
`charged_processing_ms` na čistý LLM stage. **Gate to zamítl; v2 to ruší.**

- **Dva měřiče, jeden LLM řádek:**
  - *Vnější stage měřič* (nový, bez `llm_attempts` řádku) v
    `process-owner-queue.ts` měří ACTIVE/stage čas celé práce jobu — context
    building, dešifrování, commit, extrakci i Buddy stage — a účtuje ho do
    processing budgetu přesně podle DEC-008. Backoff a čekání ve frontě se
    dál neúčtují; přerušené stage mají explicitní časový limit podle DEC-008
    (`CALL_TIMEOUT_MS = 60 s` pro LLM stage beze změny).
  - *Vnitřní evidence provider pokusu* v guardu: jeden `llm_attempts` řádek
    = jeden skutečný provider pokus (rezervace + settlement).
- `charged_processing_ms` se **nezužuje**; zůstává nositelem kumulativního
  ACTIVE/stage času ve smyslu DEC-008 (implementace ho plní z vnějšího
  měřiče). **Nikdy dva LLM řádky na jedno volání.**
- Vedlejší efekt beze změny od v1: zmizí fantomové `llm_attempts` pro command
  a dedup cestu (tam se LLM nevolá) — čas těchto cest měří vnější měřič.

### Odmítnutí vs. chyba

**Policy denial je typovaná návratová hodnota, ne výjimka**: neprojde
`classifyError()` → `recordJobFailure()`, **nespálí retry pokus a nevytvoří
karanténu** (DEC-008). Důvody:
`NO_POLICY`, `MODE_BLOCKS_PURPOSE`, `NOT_CERTIFIED`, `NO_PRICE`,
`UNSUPPORTED_REQUEST`, `CAP_JOB`, `CAP_DAY`, `CAP_MONTH`,
`BUDGET_RESERVED_FOR_RESPONSE`, `PROVIDER_BILLING_UNAVAILABLE`.
Každé odmítnutí → řádek `llm_guard_denials` + `logH2Event()`.

- **Denial není univerzální obsluha chyb.** Výpadek DB, chyba programu nebo
  nemožnost bezpečně zapsat rezervaci **se nepřeznačuje na denial** —
  poskytovatel se nevolá a job jde standardní infrastrukturní cestou
  (`classifyError` → retry/karanténa podle DEC-008).
- **Konfigurační odmítnutí** (`NO_POLICY`, `NOT_CERTIFIED`, `NO_PRICE`,
  `UNSUPPORTED_REQUEST`) vyvolá incident (`COST_GUARD_CONFIG`, `CRITICAL`)
  **i u extrakce**; opakované stejné incidenty se agregují (jeden otevřený
  incident na `(owner, reason, purpose)`, počítadlo výskytů).

| Purpose | Odmítnutí → job | Owner dostane |
|---|---|---|
| `BUDDY_RESPONSE` | `commitJobResult()` s deterministickou šablonou (Rozhodnutí 5) → `RESPONSE_READY` → `DELIVERED`. Žádný `recordJobFailure()`, žádný `QUARANTINED`. Strojový důvod fallbacku uložen u odpovědi. | Šablonu podle důvodu. |
| `OPERATIONAL_EXTRACTION` | Přeskočení (best-effort jako dnes, `process-owner-queue.ts:83-107 @ be0fc89`); job pokračuje na Buddy. Konfigurační důvody → incident. | Nic. |
| Certifikační běh | Běh se zastaví s důvodem; útrata už přijatých volání je v ledgeru. | — (operátor) |

**Zamítnutá varianta (B), beze změny od v1:** job status `DEFERRED_POLICY`.

---

## Účetní kontrakt (settlement) (gate bod 5)

### Stav ceny pokusu

Každý `llm_attempts` řádek (runtime i certifikace) má **nezávisle na výsledku
zpracování** stav ceny `cost_state`:

| `cost_state` | Význam | Částka v útratě |
|---|---|---|
| `RESERVED` | Rezervace držena, skutečná cena neznámá | `reserved_cost_usd` |
| `SETTLED` | Skutečná cena známá (z usage) | `actual_cost_usd` |
| `RELEASED` | Prokazatelně neodesláno / nezpoplatněno, s `release_reason` | 0 |

Invariant (DB `CHECK`): **každý pokus má buď skutečnou cenu, nebo drženou
rezervaci — nikdy obojí, nikdy nic** (`SETTLED ⇔ actual_cost_usd is not
null`; `RESERVED ⇔ actual_cost_usd is null`; `RELEASED ⇒ release_reason is
not null`).

**Útrata za období** = `sum(actual_cost_usd where SETTLED) +
sum(reserved_cost_usd where RESERVED)` přes `llm_attempts` daného ownera a
období + opening balance (níže). Pro `/cost` se obě části zobrazují zvlášť.

### Vazba attempt ↔ usage, idempotence

- `usage_ledger.llm_attempt_id uuid NULL → llm_attempts`, `UNIQUE
  (llm_attempt_id, unit)` — vazba 1:1 pokus ↔ sada usage řádků (ledger je
  řádek na jednotku). Whisper a jiné zdroje bez pokusu mají `NULL`.
- **Settlement je idempotentní:** jedna transakce
  `settleAttempt(attemptId, usage)` zapíše usage řádky (`ON CONFLICT DO
  NOTHING`) a přepne `RESERVED → SETTLED` jen pokud je řádek stále
  `RESERVED`. Opakované vypořádání nic nezdvojí.
- `actual_cost_usd` = usage × **sazby z cenového snapshotu rezervace**, ne nový
  lookup (Rozhodnutí 3).
- `usage_ledger.cost_usd` se rozšíří na `numeric(18,12)` (dnes `numeric(10,4)`
  zaokrouhluje jednotlivá volání).

### Kdy se co stane

| Situace | Výsledek |
|---|---|
| Úspěšná odpověď | Usage z odpovědi → `SETTLED`. |
| **Refusal / max_tokens / nevalidní výstup** | Usage z odpovědi se **uloží** → `SETTLED`; chyba zpracování se řeší zvlášť. Adapter musí vracet usage i s typovanou chybou (dnes hází bez usage, `anthropic-adapter.ts:102-106 @ be0fc89`). |
| Úspěch u poskytovatele, pak selhání ledger zápisu / pád procesu | Pokus zůstává `RESERVED` (rezervace drží útratu) — **nezmizí**. Oprava účetnictví samostatně; **žádné nové placené volání** kvůli účetní chybě (DEC-008). |
| **Timeout / síťová chyba po odeslání** | `RESERVED` natrvalo (dokud se usage neprokáže). Timeout ani uplynutí TTL **nedokazují nulovou útratu**. |
| Crash před odesláním (prokázáno: request nikdy neopustil proces) | `RELEASED`, `release_reason='NOT_SENT'`. |
| HTTP chyba, kterou poskytovatel prokazatelně neúčtuje (billing 400, 401/403, 429) | `RELEASED` s důvodem (`PROVIDER_BILLING_UNAVAILABLE`, `AUTH`, `RATE_LIMITED`). Jiné 400 a 5xx: `RESERVED` (konzervativně). |
| Reap `ABANDONED_UNKNOWN` (DEC-008) | Cena zůstává `RESERVED`. Status zpracování a stav ceny jsou nezávislé sloupce. |

### Období

`period_day` a `period_month` (kalendář **Europe/Prague**) se zapíší **při
přijetí pokusu** (rezervaci) a při vypořádání se nemění; stejně job identita.
Pokus přijatý před půlnocí a dokončený po ní patří do dne přijetí. Přechod
letního/zimního času řeší výpočet data v `Europe/Prague`, ne pevný offset.
Interní období **nejsou slibována jako totožná** s vyúčtováním poskytovatele.

### Bezpečný počáteční stav (staré attempts s NULL)

Staré `llm_attempts` (před aktivací) nemají rezervaci ani vazbu na usage —
**`NULL` nesmí znamenat nulu.** Při aktivaci guardu se pro aktuální měsíc (a
den) zapíše **opening balance** do `cost_period_openings (owner_id,
period_month, period_day null, amount_usd, basis jsonb)`:

```
opening(měsíc) = sum(usage_ledger.cost_usd v měsíci, bez llm_attempt_id)
               + sum(horní mez purpose × počet starých attempts v měsíci,
                     které nemají prokazatelně přiřazený usage)
```

Stejně pro aktuální den. Přepočet (dvojí započtení zaplaceného pokusu) je
přijatelný, podpočet ne. Staré neuzavřené pokusy (`CALL_INTENT`) se počítají
horní mezí. Následující měsíc začíná čistě z nových řádků. `basis` obsahuje
vstupy výpočtu (audit).

---

## Billing breaker (P0) (gate bod 7)

**Problém:** předplacený kredit dojde, poskytovatel vrací 400 „credit balance
is too low"; dnes to je non-retryable `ANTHROPIC_BAD_REQUEST` → **falešná
karanténa** normální zprávy.

1. **Klasifikace:** adapter u HTTP 400 přečte error body a pouze konkrétní
   odpověď o nedostatku kreditu (zpráva obsahuje „credit balance is too low";
   precedens `h2iw/main.py:274-277 @ be0fc89` a test
   `h2iw/tests/test_runner.py:796 @ be0fc89`) klasifikuje jako
   `PROVIDER_BILLING_UNAVAILABLE`. **Ostatní 400 zůstávají
   `ANTHROPIC_BAD_REQUEST`** — chybný request se nemaskuje.
2. **Pokus:** zůstane v auditu (`llm_attempts`), cena `RELEASED` s důvodem
   (billing odpověď je doložitelně nezpoplatněná). **Nespotřebuje failure
   retry budget, nevyvolá karanténu.** Skutečně odpracovaný čas se účtuje
   podle DEC-008 (vnější měřič).
3. **Sdílený breaker** per credential (`provider_availability`: `provider`,
   `credential_ref` (název secretu, ne hodnota), `state`
   `CLOSED`/`OPEN`/`HALF_OPEN`, `opened_at`, `last_notice_period`,
   `probe_attempt_id`). Guard ho čte v kroku 3 check-and-reserve → při `OPEN`
   extrakce, následná Buddy odpověď ani další joby **API nevolají**.
4. **Buddy job** se dokončí deterministickou šablonou
   `PROVIDER_BILLING_UNAVAILABLE` (Rozhodnutí 5), **bez automatického
   pozdějšího replaye**. Po obnovení kreditu owner pošle novou žádost.
5. **Incident + provozní upozornění nejvýše 1× za den Europe/Prague**
   (`last_notice_period`).
6. **Obnova:** jen po web `requireRecentReauth()` explicitní akcí „obnovit" →
   `HALF_OPEN`. Pod owner budget zámkem se připustí **nejvýše jeden
   serializovaný zkušební požadavek** (první další požadavek splňující policy i
   limity; `probe_attempt_id`). Úspěch → `CLOSED`; další billing odmítnutí →
   `OPEN`. Žádná retry smyčka, žádné automatické dobíjení, žádný live dotaz na
   kredit (není podmínkou P0).
7. **User policy se nepřepisuje** (žádné automatické přepnutí na ZERO) —
   dostupnost poskytovatele je samostatný stav.
8. Watcher (DEC-009) si ponechává vlastní chování (položky čekají a zpracují
   se samy) — jiný lifecycle, sdílí se jen klasifikace.

Control cesta (`/stop`, `/pause`, `/resume`, `/mode`, `/cost`) na breakeru
nezávisí (I7.1).

---

## Rozhodnutí 3 (návrh): `pricing_catalog` s cenovým snapshotem

**Doporučení (beze změny od v1): napojit katalog teď pro guard i ledger**
(`h2/cost/pricing.ts`), konstanty `ANTHROPIC_PRICING_USD_PER_MTOK` a
`WHISPER_RATE_USD_PER_MINUTE` smazat, **žádný fallback na konstantu**.
v2 doplňuje (gate bod 8):

- **Cenový snapshot:** při rezervaci guard vybere jedinou účinnou verzi ceny
  pro každou `(resource, unit)` a **uloží její ID a sazby** k pokusu
  (`llm_attempts.price_snapshot jsonb`: `[{pricing_id, unit,
  unit_price_usd}]`). **Settlement počítá ze snapshotu**, ne z nového lookupu
  podle času dokončení. Změna ceníku mezi rezervací a vypořádáním tedy nic
  nerozbije.
- **Zákaz překrývajících se intervalů** stejného `(resource, unit)`:
  exclusion constraint `EXCLUDE USING gist (resource WITH =, unit WITH =,
  tstzrange(effective_from, effective_to) WITH &&)` (`btree_gist`). Lookup
  „vezmi nejnovější" se ruší — nejednoznačnost = `NO_PRICE`, ne tichá volba.
- **Platné sazby:** `CHECK (unit_price_usd > 0)`, `CHECK (effective_to is null
  or effective_to > effective_from)`.
- **Audit ceníku:** sloupce `source` (URL/dokument ceníku) a `created_by`;
  změny jen migrací/operátorským skriptem (runtime má jen SELECT).
- **Přesnost:** `unit_price_usd numeric(18,12)` (gate ACCEPT);
  `reserved_cost_usd`, `actual_cost_usd`, `usage_ledger.cost_usd` také
  `numeric(18,12)`; rezervace zaokrouhlovat nahoru.
- **Chybějící cena se řeší před voláním** (`NO_PRICE`). Pozdější selhání
  evidence drží rezervaci a opravuje se účetně; není důvod znovu platit.
- **Certifikační vazba:** viz Rozhodnutí 2, krok 5 — guard dostává od
  volajícího konkrétní `prompt_version_id` + `model_id`, které se skutečně
  odešlou, a ověřuje PASS pro tuto dvojici; aktivní prompt znovu nečte.
- `resource` pojmenování: `anthropic/claude-sonnet-5`,
  `anthropic/claude-haiku-4-5-20251001`, `openai/whisper-1`.
- Cache tokeny runtime nepoužívá — request s nimi je `UNSUPPORTED_REQUEST`.
- **Whisper** smí zůstat bez runtime guardu **jen dokud je produkční placená
  cesta nepřístupná** (`transcribeVoiceJob()` nemá produkčního volajícího).
  Její zapnutí vyžaduje stejnou nákladovou bránu; ZERO nesmí tajně platit
  přepis hlasu.
- Katalog se připraví a seed ověří **před** přepnutím čtenářů (Fáze A),
  včetně strategie návratu, která neobnoví nehlídané volání.

**BUILD-27 si ponechá:** warning při 25 USD, pozastavení neurgentních
background syntéz při 30 USD, `projected_monthly_cost` dashboard (AT-70).

---

## Rozhodnutí 4 — trivial-turn gate: **VYŘAZENO z P0** (gate REJECT)

v1 navrhovala whitelist (`ok`, `jo`, `díky`, 👍 …) + proxy „poslední Buddy
odpověď neobsahuje `?`". **Gate verdikt REJECT:** absence otazníku nedokazuje
absenci čekajícího potvrzení. Protipříklad: Buddy napíše „Pokud návrh platí,
potvrď ho slovem jo." → owner `jo` → v LEAN by dostal 👍 a potvrzení by se
nezpracovalo. Poslední doručená zpráva navíc nemusí být ta, na kterou owner
odpovídá. Exact lookup je deterministický, ale **není automaticky sémanticky
bezpečný** — `/stop` je předem dohodnutý protokol, `jo` ne.

**Rozhodnutí pro P0:** žádný sémantický skip. LEAN šetří vynecháním extrakce.
Podmínky pro budoucí návrh jsou v „Co zůstává mimo scope".

---

## Rozhodnutí 5 (návrh): chování v `ZERO` a šablony

**Co funguje v každém režimu i při vyčerpaném rozpočtu či otevřeném breakeru:**
- ingest: šifrovaný `raw_event` i job vzniknou vždy (I6),
- control `/stop`, `/pause`, `/resume` a protokolové `/mode`, `/cost` — control
  účinek nezávisí na LLM, rozpočtu ani na conversation queue (I7.1),
- delivery do Telegramu.

**Šablony (gate §6, doslova):**

| Situace | Text |
|---|---|
| `ZERO` | „Režim ZERO. Zpráva je uložená; AI ji nezpracovala. Zapnutí AI vyžaduje potvrzení na webu. Stav: /mode · /cost." |
| `MANUAL` bez `/ask` | „Režim MANUAL. Zpráva je uložená. Pro AI odpověď pošli novou zprávu začínající /ask a textem dotazu." |
| `CAP_DAY` / `CAP_MONTH` | „Na tuto AI odpověď nestačí zbývající denní/měsíční rozpočet. Zpráva je uložená. Automaticky ji později nezpracuji. Stav a obnova limitu: /cost." |
| `CAP_JOB` | „Tato žádost se nevejde do rozpočtu na jednu zprávu. Zpráva je uložená; AI odpověď nevznikla." |
| `PROVIDER_BILLING_UNAVAILABLE` | „AI je nedostupná kvůli vyčerpanému kreditu poskytovatele. Zpráva je uložená. Po obnovení kreditu pošli dotaz znovu." |
| Chyba konfigurace (`NO_POLICY`, `NOT_CERTIFIED`, `NO_PRICE`, `UNSUPPORTED_REQUEST`) | „AI odpověď je dočasně vypnutá kvůli konfiguraci. Zpráva je uložená; automatická pozdější odpověď není naplánovaná." |

Doplňkové deterministické texty (mimo tabulku gate, stejná pravidla): holé
`/ask` → nápověda k použití; `/mode <vyšší>` z Telegramu → „Zvýšení režimu
vyžaduje potvrzení na webu." + aktuální režim.

**Pravidla:**
- **Žádný příslib pozdější odpovědi** — job se dokončí, replay neexistuje.
- **„Zpráva je uložená" jen po potvrzeném zápisu** `raw_event` (fallback se
  generuje až z jobu, který vzniká po commitu `raw_event`; pokud by šablona
  vznikala jinde, text se bez potvrzení nepoužije).
- Odmítnutí `spent + reservation > cap` neznamená, že utracená částka dosáhla
  stropu — texty to netvrdí.
- **Strojový důvod fallbacku** se ukládá u odpovědi (pro web a audit).
  `DELIVERED` znamená doručení odpovědi, ne věcné vyřešení požadavku.
- Nízký cap ≠ nedostatek kreditu poskytovatele — oddělené šablony.

**`/cost` ukáže:** skutečnou útratu (`SETTLED` + opening), držené rezervace
(`RESERVED`), zbývající rozpočet (den / měsíc), a **konkrétní další hranici
období** v Europe/Prague (např. „denní limit se obnoví 1. 10. 00:00"), plus
stav breakeru.

**ZERO není náhrada chybějícího trvalého PAUSE.** ZERO jen blokuje placená
volání; Buddy dál odpovídá šablonou. Plán ani UI netvrdí, že ZERO vytváří
persistentní umlčení. Oprava `/pause` je samostatný slice (mimo scope).

**Návrat do vyššího režimu** zprávy z doby ZERO zpětně nezpracuje (dedup podle
`source_raw_event_id`, `find-existing-response.ts @ be0fc89`). Hromadný replay
je mimo scope.

---

## Rozhodnutí 6 — profile bridge (návrh pro DEC-012; implementace mimo P0)

**Kontext beze změny od v1:** jak se identita/preference z budoucího Neon
profilu dostanou k nástrojům mimo runtime (Claude chat memory, GPT project
instructions, Claude Code) bez prolomení context firewallu. Pracovní definice:
runtime kontext neteče ven automaticky, vnější nástroje nezapisují do runtime.

| Varianta | Verdikt v2 (podle gate) | Rozhodnutí |
|---|---|---|
| **(A) žádný most** | **Dočasný stav** | Dokud neexistuje profil a bezpečný exportní kontrakt. Nepřidává riziko mostu; existující ruční kopie (CLAUDE.md, GPT instructions) mohou dál zastarávat. |
| **(B) ruční export po reauth** | **První budoucí most** | Směr se schvaluje teď, staví se **až po splnění podmínek exportu a mazání** (níže), samostatně od cost P0. |
| **(C) read-only endpoint s tokenem v instructions/memory** | **Zamítnuto** | Důvodem je **uložení credentialu** v promptu/paměti cizího nástroje (Secret Handling = leak) a zbytečný rozsah, ne samotný HTTPS endpoint. |
| **(D) read-only MCP pro Claude Code** | **K novému review** | Vyžaduje doloženou potřebu automatické čerstvosti a stejnou ochranu dat jako C. MCP samo není bezpečnostní výhoda. |

**Podmínky B (před stavbou):**
- Serverový allowlist rolí a polí, default deny; jen ownerem potvrzená
  `portable` pole — žádné raw events, hypotézy (I4), secrets ani data třetích
  osob (I5). Označení `portable` nesmí přidělovat LLM.
- Náhled přesného obsahu a explicitní export po `requireRecentReauth()`; audit
  bez kopie citlivého payloadu. Snapshot nese čas, verzi schématu/profilu a
  původ.
- **Smazaná a odvolaná pole vyloučena už v první verzi** (závislost na
  deletion ledgeru BUILD-20). Nová kopie neodstraní starou vloženou jinde —
  owner tuto hranici vidí.
- Retenční údaj z `provider_policy_catalog` s datem a rozsahem platnosti; není
  technická garance smazání. Exportní cesta nemá přístup k ostatním runtime
  datům.

**Podmínky D (pro nové review):** scope jen `profile:read:code`, krátká
platnost, audience, revokace; credential ve správci tajemství nebo paměti
autorizovaného klienta, nikdy v promptu, URL ani logu; ověřit, že token nejde
do modelového kontextu. Data z lokálního MCP se mohou stát vstupem cloudového
modelu; exportovaná pole se přijímají jako data, ne jako instrukce.

---

## Dopad na invarianty a rozhodnutí

Doslovné znění I1–I8 v repu na `be0fc89` není (Notion — *H2 Buddy — Technical
Architecture v1.2 (LOCKED)*, `BUILD-STATUS.md:837 @ be0fc89`). V repu jsou jen
I7.1–I7.7 (`DECISIONS.md:122-129 @ be0fc89`).

| Položka | Dopad |
|---|---|
| **I1, I2, I3, I8** | **ČEKÁ NA OVĚŘENÍ proti Notion Technical Architecture v1.2 (Opus).** Předběžně bez dopadu: guard nepíše do Living OS / evidence dat, jen do nákladových tabulek. |
| **I4** | Šablony konstatují jen stav systému a neslibují neexistující budoucí práci. Export B jen potvrzená `portable` pole. |
| **I5** | Export bez dat třetích osob. Guard I5 nemění. |
| **I6** | `raw_event` vzniká v každém režimu; guard stojí za ingestem. |
| I7.1 | Control účinek nezávisí na LLM, rozpočtu, breakeru ani conversation queue; žádný DB lock přes provider call. |
| I7.2 | `/mode`, `/cost`, `/ask` mají immutable `raw_event`. |
| I7.3 | Změna policy idempotentní (`operation_id`, `source_raw_event_id` UNIQUE); settlement idempotentní. |
| I7.4 | Jednotné pořadí writerů policy a rezervací na owner budget zámku; compare-and-set `policy_version`. |
| I7.5 | Fencing commit/delivery beze změny, platí i pro fallback delivery. Finanční lock + lease check v rezervaci je **samostatný** požadavek, ne přepis I7.5. |
| I7.6 | `/mode` exact match; `/ask` přesný parser nad aktuální zprávou; zpráva vždy uložená. Trivial-turn skip v P0 není. |
| I7.7 | Režim je protokolová struktura; `/ask` protokolový prefix. Whitelist konverzačních slov se nepoužívá jako I7.7 ekvivalent. |
| **[DEC-001](./DECISIONS.md#dec-001)** | Nový kód v `h2/cost/`. |
| **[DEC-007](./DECISIONS.md#dec-007)** | C2 zachováno: cost příkaz ani `/ask` nevyřazují zprávu z lifecycle; žádný exkluzivní command routing. |
| **[DEC-008](./DECISIONS.md#dec-008)** | (1) Denial ≠ selhání: žádný `recordJobFailure()`, žádná karanténa. (2) **ACTIVE/stage časové účetnictví beze změny** — vnější měřič bez LLM řádku, `charged_processing_ms` se nezužuje, jeden LLM řádek na jedno volání. (3) Billing 400 přestává vést na falešnou karanténu (P0). (4) Účetní chyba po odpovědi nespálí další LLM pokus. |
| **[DEC-009](./DECISIONS.md#dec-009)** | Watcher má samostatný strop 3 USD a vlastní ledger; tento plán ho nemění a **negarantuje souhrnný strop Anthropic účtu**. Přebírá se klasifikace billing nedostupnosti (Doplněk 9), ne chování obnovy (Buddy bez replaye, Watcher s automatickou obnovou). Buddy katalog nepřepojuje Watcher. ZERO nevypíná Watcher. |

---

## Implementační strategie (gate bod 11)

Žádná fáze se nepopisuje jako „beze změny chování" bez důkazu. U každé je
výčet nových failure modes a návrat, který neotevře nehlídanou cestu.

### Fáze A — aditivní schéma + ceny + účetní kontrakt + mock testy (guard neaktivní)

**Obsah:** migrace `0021_cost_modes.sql` (níže); `h2/cost/pricing.ts`
(snapshot lookup); `h2/cost/accounting.ts` (rezervace, settlement, období,
opening balance) jako knihovna; adapter vrací usage i s chybou a čte 400 body
(klasifikace, zatím bez breakeru); vnější stage měřič; kompletní mock test
suite regresní matice pro účetnictví, ceny, souběh a hranice.
**Není zapnuto:** runtime volající dál volají adapter napřímo, `usage.ts`
konstanty zůstávají čtenářem ceny (katalog se jen seeduje a ověří).
**Nové failure modes:** migrace (DDL na `llm_attempts`, `usage_ledger`,
`pricing_catalog`); `alter column type` na neprázdném `usage_ledger` (rozšíření
přesnosti, přepis tabulky); exclusion constraint vyžaduje `btree_gist`.
**Návrat:** nové sloupce/tabulky nikdo nečte → revert kódu stačí; schéma zůstává.
**Vyžaduje GO na migraci** (Pravidlo 4).

### Fáze B — společná aktivace: guard + billing breaker + ovládání

**Obsah (jeden deploy):** `h2/cost/guard.ts` a přepojení obou runtime
volajících + certifikačního skriptu; governance test „jediný importér
`callAnthropicModel`"; čtenáři ceny přepnuti na katalog, konstanty smazány;
breaker; `PROTOCOL_COMMANDS` (`/mode …`, `/cost`), parser `/ask`, webová akce
(zvýšení režimu, stropy, obnova breakeru) s reauth; šablony; opening balance
zapsaný jako součást aktivace.
**Proč společně:** guard bez breakeru by při vyčerpaném kreditu dál
karanténoval; guard bez ovládání by owner v ZERO nemohl bezpečně změnit.
**Default nové policy = `ZERO`** (DDL default). Chybějící řádek = fail-closed.
**Seed existujícího ownera na `NORMAL`** = samostatný explicitní SQL krok
rolloutu (`applyPolicyChange`, `channel='ROLLOUT'`, záznam v historii), s
vlastním Honzíkovým GO, proveden **po** nasazení Fáze B. Do té doby je owner
bez řádku nebo v ZERO → Buddy odpovídá šablonou.
**Nové failure modes:** odmítnutí legitimních zpráv při chybné policy/ceně
(fail-closed, incident); vyšší bezpečná rezervace snižuje dostupnost;
dodatečná DB transakce + advisory lock na každé volání.
**Návrat:** owner → `ZERO` (Telegram, vždy povoleno) = okamžité zastavení
placených volání. Revert deploye na verzi před Fází B **by obnovil nehlídanou
cestu** → nepovolený postup; místo něj fix-forward nebo ZERO.

### Migrace — souhrn

| Krok | Tabulka/sloupec | Zasahuje uzavřený blok? |
|---|---|---|
| Fáze A | nová `owner_cost_policy` (+ `policy_version`, default `ZERO`) | Ne — aditivní |
| Fáze A | nová `owner_cost_policy_changes` | Ne |
| Fáze A | nová `llm_guard_denials` | Ne |
| Fáze A | nová `provider_availability` | Ne |
| Fáze A | nová `cost_period_openings` | Ne |
| Fáze A | `llm_attempts`: `origin`, `job_id` nullable (jen pro `CERTIFICATION`), `prompt_version_id`, `cost_state`, `reserved_cost_usd`, `actual_cost_usd`, `release_reason`, `price_snapshot`, `period_day`, `period_month`, `policy_version` | Aditivně BUILD-11 (`0017`); `job_id` `NOT NULL` → podmíněný CHECK |
| Fáze A | `usage_ledger`: `llm_attempt_id` + UNIQUE, `cost_usd` → `numeric(18,12)` | ANO — `0010`; rozšíření přesnosti, data se nemění |
| Fáze A | `pricing_catalog`: `numeric(18,12)`, CHECK, exclusion constraint, `source`, seed | ANO — `0010`; tabulka prázdná |

### Návrh SQL — **ČEKÁ NA GO, NESPOUŠTĚT** (náčrt, upřesní se v implementaci)

```sql
-- H2 Buddy — h2-runtime — 0021_cost_modes
-- COST-MODES-PLAN.md v2 (Fáze A). NÁVRH, neaplikováno.

create extension if not exists btree_gist;

-- 1) pricing_catalog: přesnost, validace, zákaz překryvu, audit, seed
alter table pricing_catalog alter column unit_price_usd type numeric(18, 12);
alter table pricing_catalog add column source text not null default 'seed:h2/prompts/usage.ts@be0fc89';
alter table pricing_catalog add constraint pricing_catalog_price_positive check (unit_price_usd > 0);
alter table pricing_catalog add constraint pricing_catalog_interval_valid
  check (effective_to is null or effective_to > effective_from);
alter table pricing_catalog add constraint pricing_catalog_no_overlap
  exclude using gist (resource with =, unit with =, tstzrange(effective_from, effective_to) with &&);

insert into pricing_catalog (resource, unit, unit_price_usd) values
  ('anthropic/claude-sonnet-5',            'tokens_input',  0.000002),
  ('anthropic/claude-sonnet-5',            'tokens_output', 0.000010),
  ('anthropic/claude-haiku-4-5-20251001',  'tokens_input',  0.000001),
  ('anthropic/claude-haiku-4-5-20251001',  'tokens_output', 0.000005),
  ('openai/whisper-1',                     'minutes',       0.006);

-- 2) owner_cost_policy (default ZERO, bez seedu NORMAL — to je krok rolloutu Fáze B)
create table owner_cost_policy (
  owner_id uuid primary key references owners (id),
  mode text not null default 'ZERO',
  policy_version bigint not null default 1,
  per_job_cap_usd numeric(10, 4) not null default 0.30,
  daily_cap_usd numeric(10, 4) not null default 1.50,
  monthly_cap_usd numeric(10, 4) not null default 35.00,
  updated_at timestamptz not null default now(),

  constraint owner_cost_policy_mode_check check (mode in ('ZERO', 'MANUAL', 'LEAN', 'NORMAL')),
  constraint owner_cost_policy_caps_nonneg check (per_job_cap_usd >= 0 and daily_cap_usd >= 0 and monthly_cap_usd >= 0),
  constraint owner_cost_policy_monthly_hard_cap check (monthly_cap_usd <= 35)
);

create table owner_cost_policy_changes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  operation_id uuid not null unique,
  from_version bigint null,
  to_version bigint not null,
  old_policy jsonb null,
  new_policy jsonb not null,
  actor text not null,
  channel text not null,
  source_raw_event_id uuid null unique references raw_events (id),
  created_at timestamptz not null default now(),

  constraint owner_cost_policy_changes_actor_check check (actor in ('OWNER', 'SYSTEM', 'MIGRATION')),
  constraint owner_cost_policy_changes_channel_check check (channel in ('TELEGRAM_COMMAND', 'WEB_REAUTH', 'ROLLOUT'))
);

-- 3) llm_attempts: rezervace + settlement + certifikace
alter table llm_attempts alter column job_id drop not null;
alter table llm_attempts
  add column origin text not null default 'RUNTIME',
  add column prompt_version_id uuid null references prompt_versions (id),
  add column cost_state text null,               -- NULL = pre-aktivační řádek (řeší opening balance)
  add column reserved_cost_usd numeric(18, 12) null,
  add column actual_cost_usd numeric(18, 12) null,
  add column release_reason text null,
  add column price_snapshot jsonb null,
  add column period_day date null,               -- Europe/Prague, při přijetí
  add column period_month date null,             -- první den měsíce, Europe/Prague
  add column policy_version bigint null;
alter table llm_attempts add constraint llm_attempts_origin_check check (origin in ('RUNTIME', 'CERTIFICATION'));
alter table llm_attempts add constraint llm_attempts_job_required check (origin = 'CERTIFICATION' or job_id is not null);
alter table llm_attempts add constraint llm_attempts_cost_state_check check (
  cost_state is null
  or (cost_state = 'RESERVED' and reserved_cost_usd is not null and actual_cost_usd is null)
  or (cost_state = 'SETTLED'  and actual_cost_usd is not null)
  or (cost_state = 'RELEASED' and actual_cost_usd is null and release_reason is not null)
);
create index llm_attempts_owner_period_idx on llm_attempts (owner_id, period_month, period_day);

-- 4) usage_ledger: vazba na pokus + přesnost
alter table usage_ledger alter column cost_usd type numeric(18, 12);
alter table usage_ledger add column llm_attempt_id uuid null references llm_attempts (id);
create unique index usage_ledger_attempt_unit_uniq on usage_ledger (llm_attempt_id, unit) where llm_attempt_id is not null;

-- 5) llm_guard_denials
create table llm_guard_denials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  job_id uuid null references message_processing_jobs (id),
  origin text not null default 'RUNTIME',
  purpose text not null,
  model_id text not null,
  prompt_version_id uuid null,
  reason text not null,
  policy_version bigint null,
  reservation_usd numeric(18, 12) null,
  created_at timestamptz not null default now(),

  constraint llm_guard_denials_reason_check check (reason in (
    'NO_POLICY', 'MODE_BLOCKS_PURPOSE', 'NOT_CERTIFIED', 'NO_PRICE', 'UNSUPPORTED_REQUEST',
    'CAP_JOB', 'CAP_DAY', 'CAP_MONTH', 'BUDGET_RESERVED_FOR_RESPONSE', 'PROVIDER_BILLING_UNAVAILABLE'
  ))
);
create index llm_guard_denials_owner_created_idx on llm_guard_denials (owner_id, created_at);

-- 6) provider_availability (billing breaker; credential_ref = název secretu, nikdy hodnota)
create table provider_availability (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  provider text not null,
  credential_ref text not null,
  state text not null default 'CLOSED',
  opened_at timestamptz null,
  last_notice_period date null,
  probe_attempt_id uuid null references llm_attempts (id),
  updated_at timestamptz not null default now(),

  constraint provider_availability_state_check check (state in ('CLOSED', 'OPEN', 'HALF_OPEN')),
  unique (owner_id, provider, credential_ref)
);

-- 7) cost_period_openings (bezpečný počáteční stav)
create table cost_period_openings (
  owner_id uuid not null references owners (id),
  period_month date not null,
  period_day date null,
  amount_usd numeric(18, 12) not null check (amount_usd >= 0),
  basis jsonb not null,
  created_at timestamptz not null default now(),
  unique (owner_id, period_month, period_day)
);

-- RLS + granty: owner_isolation vzor z 0017_llm_attempts.sql:44-50 @ be0fc89
-- pro owner_cost_policy (select, update; insert jen přes rollout krok),
-- owner_cost_policy_changes (select, insert), llm_guard_denials (select, insert),
-- provider_availability (select, update), cost_period_openings (select).
```

Poznámky: seed `pricing_catalog` = hodnoty dnešních konstant
(`usage.ts:11-14`, `voice/usage.ts:16 @ be0fc89`) převedené na cenu za
jednotku; ověření po aplikaci přes `_h2_migrations` na obou Neon větvích
(Pravidlo 5); produkční migrace = Honzíkovo GO (Pravidlo 4).

---

## Povinné regresní scénáře (gate, doslova + fáze)

Všechno s mockovaným poskytovatelem — žádné placené volání v CI.

| Oblast | Minimální důkaz | Fáze |
|---|---|---|
| Telegram/web | ZERO → NORMAL/MANUAL odmítnuto; NORMAL → MANUAL/ZERO povoleno; webový stale update nepřepíše novější ZERO; retry starého webhooku nevrátí starší policy. | B |
| MANUAL | Bez prefixu, prázdný `/ask`, prefix v historii a `/ask` v ZERO: 0 callů. Platný `/ask` v MANUAL: jen Buddy, společný cap přes retry. | B |
| Souběh | Dva uchazeči o poslední rozpočet včetně stale workeru/certifikace nepřijmou náklady přes limit; policy změna a rezervace mají jednoznačné pořadí. | A (knihovna), B (zapojení) |
| Finanční účetnictví | Crash před odesláním, timeout po odeslání, úspěch před pádem ledgeru, refusal/max_tokens s usage, opakované vypořádání: cena nikde nevypadne ani se nezdvojí. | A |
| Hranice | Částka přesně na capu a těsně nad ním; rezervace se nezaokrouhlí dolů; půlnoc, konec měsíce, změna času; staré NULL odhady nemají nulovou cenu. | A |
| Request/certifikace | Ceny pokryjí celý request; nepodporovaný payload fail-closed; současná aktivace promptu nezamění ověřený a odeslaný obsah; žádný skrytý retry. | A (cena), B (guard) |
| DEC-008 | Pomalý context/commit se započítá, čekání ve frontě/backoff nikoli; `/stop` bez LLM attempt; policy denial nezpůsobí failure ani karanténu. | A (měřič), B |
| Kredit | Konkrétní billing 400 bez karantény; další joby při otevřeném breakeru nevolají API; jiný 400 nezamaskován; obnova bez retry bouře. | B |
| Šablony/control | STOP funguje i při zablokované conversation queue a vyčerpaném rozpočtu; fallback respektuje fencing; žádný příslib automatického replaye. | B |
| Trivial-turn | „Potvrď slovem jo." → `jo` se neztratí; v P0 není žádný whitelist skip. | B |
| Profile bridge | V samostatném slicu: neportable/třetí osoba/smazané pole nikdy v exportu, reauth a audit fungují, credential se nevrací v payloadu. | mimo P0 |

Doplňkové testy z v1, které zůstávají: governance „jediný importér
`callAnthropicModel`" (B); extrakce přeskočená při nedostatku rozpočtu na
odpověď (A/B); `NO_POLICY` fail-closed + incident (B); věta „dej mi mode zero
prosím" není příkaz (B); opening balance s pre-aktivačními `CALL_INTENT`
řádky (A).

---

## Co zůstává mimo scope (vědomě)

- **Trivial-turn gate** (gate REJECT). Budoucí návrh smí vzniknout jen s:
  explicitním stavem otevřeného požadavku `pending` / `none` / `unknown`,
  vazbou na relevantní konverzaci/odpověď, testy více otevřených požadavků;
  **skip povolí jen doložené `none`, `unknown` ho vypíná**; potvrzení významné
  akce nesmí autorizovat jen modelové pole nebo emoji; `awaiting_owner_reply`
  ve výstupu modelu je pomocný údaj, ne autorita. Whitelist se nepřebírá do
  Watcheru.
- **Režim `DEEP`** — podmínky v Rozhodnutí 1.
- **Implementace profile bridge** — DEC-012 jen směr (Rozhodnutí 6).
- Zbytek BUILD-27: warning 25 USD, pauza background syntéz 30 USD,
  `projected_monthly_cost` dashboard.
- Hromadný replay zpráv odpovězených šablonou.
- Vynucení trvalého `/pause` — dnes se stav pause neukládá; samostatný slice.
  ZERO ho nenahrazuje.
- Whisper runtime guard — do doby, než bude placená cesta produkčně dostupná.
- H2-IW ledger a strop (DEC-009, samostatný systém); souhrnný strop H2.
- Prompt caching v H2 Buddy runtime.
- Live API na stav kreditu, billing dashboard, automatické dobíjení.

---

## Návrhy DEC-011 a DEC-012 (zapíší se do DECISIONS.md až po review a GO)

**DEC-011 — H2 Buddy nákladové režimy a pre-call guard (návrh):**
Owner-scoped `owner_cost_policy` s režimy `ZERO < MANUAL < LEAN < NORMAL`,
`policy_version` a append-only historií; Telegram smí jen stejný/nižší režim,
zvýšení a částky jen web s recent reauth; MANUAL = přesný `/ask ` parser → jen
`BUDDY_RESPONSE`. Každé placené volání (runtime i certifikace) jde přes jediný
guard s atomickým check-and-reserve pod owner budget zámkem; rezervace =
doložitelná horní mez ceny celého requestu, 1 provider pokus = 1 rezervace,
síť mimo zámek. Účetní kontrakt: každý pokus má skutečnou cenu nebo drženou
rezervaci, idempotentní settlement ze cenového snapshotu, období podle přijetí
(Europe/Prague), bezpečný opening balance. Rozpočet 35 USD = Buddy provoz +
certifikace; Watcher 3 USD samostatně; žádný strop celého účtu. DEC-008
zachováno (oddělené měření času). Billing breaker pro vyčerpaný kredit bez
karantény a bez replaye. Trivial-turn skip a DEEP nejsou součástí.

**DEC-012 — profile bridge (návrh):** (A) žádný most jako dočasný stav;
(B) ruční export po reauth jako první budoucí most, stavět až po splnění
podmínek exportu a mazání; (D) MCP pro Claude Code k novému review;
(C) endpoint s tokenem v instructions/memory zamítnut kvůli uložení
credentialu v cizím nástroji.

## Co potřebuji od Honzíka

Hodnoty a metodika jdou přes GPT/Codex gate, ne na Honzíka. Na Honzíkovi jsou
jen brány:

1. Poslat v2 na nové review (gate nad v2).
2. GO na plán po review.
3. GO na migraci `0021_cost_modes.sql` — až při implementaci Fáze A.
4. GO na aktivaci Fáze B a zvlášť na rollout krok „seed owner `NORMAL`".
5. DEC-011 / DEC-012 zapsat po GO.

---

[gr150]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/buddy/generate-response.ts#L150-L157
[gr129]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/buddy/generate-response.ts#L129
[gr117]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/buddy/generate-response.ts#L117-L124
[oe75]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/extraction/operational-extraction.ts#L75
[aa4]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/prompts/anthropic-adapter.ts#L4-L6
[aa59]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/prompts/anthropic-adapter.ts#L59-L71
[aa83]: https://github.com/honzabindr-max/muj-web/blob/be0fc896d94c1f0a31e3e61290a782e2b13e4881/h2/prompts/anthropic-adapter.ts#L83-L85
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
