# COST-MODES — P0a / P0b — plán v3

**Status:** v3, čeká na review. **NEIMPLEMENTOVÁNO** — žádná migrace, kód, provoz ani secrets se neměnily.
**Závazný vstup:** Codex *„H2 Buddy — rozhodnutí o přiměřeném rozsahu P0"* (2026-09-30, varianta **C**).
Nahrazuje v2 (`a7e5ac0`, zůstává v historii) i v1; obsah v2 se nepřenáší, pokud ho rozhodnutí nepožaduje.
**Pin:** odkazy `soubor:řádek` jsou na `be0fc89`; kód se do `main` (`120b26f`) nezměnil.

## 1. Cíl (požadavek 1)

- **P0a chrání ovládání a dostupnost:** nezávislá nouzová brzda účinná i na starý kód; billing latch, aby
  vyčerpaný kredit nevedl na falešnou karanténu; režimy `ZERO < MANUAL < NORMAL` s řízeným zapínáním AI.
- **P0b vynucuje konzervativní příděl nově přijatých volání:** každé přijetí nevratně odečte pevnou částku
  **R**; stropy 0,30 USD/job, 1,50 USD/den, 35 USD/měsíc platí na součet odpočtů.
- **Není cílem:** přesné účetnictví, důkaz za historický měsíc, souhrnný strop Anthropic účtu. `usage_ledger`
  zůstává jako diagnostika, není autoritou pro limit.
- **Rozpočet:** 35 USD = Buddy provoz; certifikace jsou v P0-lite produkčně blokované (§8). H2-IW má
  samostatné 3 USD (DEC-009). Předplacený kredit bez auto-reloadu je fakt dodaný ownerem — vnější konečná
  zásoba, ne náhrada lokální ochrany; zapnutí auto-reloadu vyžaduje nové posouzení.

## 2. Dvě dodávky, vlastní GO brány (požadavek 2)

| Dodávka | Obsah | GO brány | Závislost |
|---|---|---|---|
| **P0a-1** | Nouzová brzda — runbook, bez kódu | fyzický test brzdy | nic; dodat **první** |
| **P0a-2 + P0a-3** | Billing latch + režimy (1 migrace + kód) | plán, migrace, deploy, přepnutí ownera do MANUAL | P0a-1 |
| **P0b** | Pevný příděl R | důkaz R, migrace, T0 + deploy | P0a-2/3; **blokováno bez důkazu R** (§6.1) |

P0a nečeká na R. Žádný rollout v2 pod jiným názvem (bez settlementu, rezervací, katalogu, opening balance).

## 3. P0a-1 — nouzová brzda (požadavek 3)

**Proč ne env ve Vercelu:** env proměnné jsou vázané na deployment; změna platí jen pro nové deploymenty,
běžící si drží hodnoty z buildu ([Vercel docs — Environment
Variables](https://vercel.com/docs/environment-variables); precedens v repu: nastavení z dashboardu se do
deploymentů nepropisovalo, `history/build/BUILD-STATUS-2026-09-29.md:7` na `main`). Odebrání klíče z env ani
nový přepínač starý kód nezastaví. Vypnutí `cron-job.org` wake pokrývá jen jeden ze tří triggerů (§7).

**Zvolený mechanismus: deaktivace Anthropic API klíče v Anthropic Console.** Autorizaci vyhodnocuje
poskytovatel, takže brzda platí pro každý kód nesoucí klíč — staré deploymenty, `after()` úlohy v letu,
lokální skripty. Žádný nový panel.

**Klíče podle názvů proměnných (hodnoty nečteny):**

| Spender | Proměnná | Kde |
|---|---|---|
| Buddy runtime | `H2_ANTHROPIC_API_KEY` | Vercel env + lokálně `muj-web/.env.local` (`h2/prompts/config.ts:17`) |
| H2-IW Watcher | `ANTHROPIC_API_KEY` | Hetzner `/etc/h2-inbox-watcher/env` (`h2iw/config.py:99,115`, `deploy/set-secret.sh`) |
| H2-IW eval (operátor) | `H2_ANTHROPIC_API_KEY` z `muj-web/.env.local` | `h2/inbox-watcher/RUNBOOK.md:47`, `scripts/eval_fixtures.py:120` |

**Sdílení:** Buddy a Watcher čtou **různé názvy proměnných**; zda obsahují stejnou hodnotu, nelze z repa bez
čtení hodnot doložit. **Doloženo je sdílení účtu/kreditu:** vyčerpání kreditu 2026-09-23 zasáhlo Watcher
(DEC-009 Doplněk 9, `DECISIONS.md:217`) a eval Watcheru běží na Buddy klíči. Runbook proto předpokládá, že
klíč **může být sdílený**: deaktivace `H2_ANTHROPIC_API_KEY` zastaví Buddy a H2-IW eval, a při shodě hodnot i
Watcher — dopad při havárii přijatý rozhodnutím. Watcher to zvládne podle DEC-009 (položky čekají, notice 1×
denně, po obnově se zpracují samy).

**Co může doběhnout:** požadavky přijaté poskytovatelem před deaktivací se mohou dokončit a být vyúčtované —
zpětné odvolání se neslibuje. Buddy nestreamuje; volání je omezené `CALL_TIMEOUT_MS = 60 s`
(`anthropic-adapter.ts:10`). Další requesty dostanou 401/403 → `ANTHROPIC_AUTH_ERROR`
(`anthropic-adapter.ts:86-88`), dnes non-retryable, takže joby během brzdy skončí v karanténě s notifikací.
Při havárii přijatelné (raw zprávy zůstávají, I6); auth chyba se nemaskuje jako billing.

**Obnova:** pokud Console umí reaktivovat stejný klíč, stačí reaktivace. Jinak: nový klíč → Vercel env
`H2_ANTHROPIC_API_KEY` → **redeploy** (env je per-deployment) → `.env.local` → při sdílení i Watcher
(`set-secret.sh ANTHROPIC_API_KEY` + restart služby). Která varianta platí, se zapíše při fyzickém testu.

**Fyzický důkaz bez placené generace (až po GO):** `GET /v1/models` s klíčem → 200 (negeneruje); deaktivace;
stejný dotaz → 401; Telegram zpráva → notice/karanténa, **0 nových `usage_ledger` řádků**; obnova → 200.

**Runbook:** `docs/h2/runbooks/EMERGENCY-BRAKE.md` vznikne v dodávce P0a-1 (kroky, dopad na Watcher a eval,
doběh, obnova). **ZERO ani billing latch nejsou nouzová brzda** — žijí v Buddy aplikaci a starý kód je nečte.

## 4. P0a-2 — billing latch AVAILABLE / BLOCKED (požadavek 4)

**Klasifikace:** adapter u HTTP 400 **přečte tělo chyby** (dnes ho nečte, `anthropic-adapter.ts:83-85`). Jen
zpráva obsahující `credit balance is too low` → `PROVIDER_BILLING_UNAVAILABLE` (precedens
`h2iw/main.py:274-277`, test `h2iw/tests/test_runner.py:796`). Každé jiné 400, i nečitelné tělo, zůstává
`ANTHROPIC_BAD_REQUEST`.

**Stav:** `provider_billing_state` — řádek na credential: `credential_ref` (název proměnné, nikdy hodnota),
`state`, `state_version`, `blocked_at`, `last_notice_day`, `updated_at`. Migrace vloží `AVAILABLE` (kredit
podle ownera je).

| Výsledek volání | Latch | Job |
|---|---|---|
| Billing 400 | → `BLOCKED`, `state_version`+1 (i opožděná chyba vždy znovu zavírá) | Šablona přes `commitJobResult()` → `DELIVERED`; **žádný `recordJobFailure()`, karanténa ani spotřeba retry**; incident + upozornění max 1× za den Europe/Prague |
| Úspěch | **beze změny — úspěch nikdy neodblokuje** | normálně |
| Jiná chyba (auth, 429, 5xx, jiné 400, timeout) | beze změny | stávající `classifyError()` |

**Při `BLOCKED`** se API nevolá (latch se čte v `acceptModelCall`, §5.4): extrakce se přeskočí, Buddy vrátí
šablonu. Control příkazy fungují dál — aplikují se při ingestu a latch nečtou.

**Ruční obnova:** jen web + `requireRecentReauth()`. Formulář nese `expected_version` + `operation_id`;
transakce pod owner zámkem: stejné `operation_id` = no-op; CAS `state_version = expected_version`, jinak stale
→ odmítnout; `BLOCKED → AVAILABLE`, verze +1; audit v `owner_cost_policy_changes` (`kind='BILLING_RESET'`).
Starý duplicitní požadavek pozdější blokaci neodemkne (blokace zvýšila verzi). Obnova je povolení zkusit
provoz, ne ověření zůstatku — před další billing odpovědí projde i víc volání; přesně jeden probe se
neslibuje. Žádný HALF_OPEN, probe ID, automatický reset ani kontrola kreditu placeným voláním.

**Nečitelný stav:** chybí řádek → nevolat model, šablona „chyba konfigurace" + incident. DB chyba → nevolat
model, infrastrukturní cesta (`classifyError`), ne odmítnutí. Odpracovaný čas podle DEC-008 (§5.6).

## 5. P0a-3 — režimy ZERO < MANUAL < NORMAL (požadavek 5)

### 5.1 Význam

| Režim | Placená volání |
|---|---|
| `ZERO` | žádná nová |
| `MANUAL` | jen `BUDDY_RESPONSE` na aktuální autentizovanou zprávu s platným `/ask`; bez extrakce a background práce |
| `NORMAL` | existující rozsah (`BUDDY_RESPONSE` + `OPERATIONAL_EXTRACTION`) |

**Default po aktivaci `ZERO`** (DDL default; chybějící řádek = ZERO + incident). **Doporučený první běžný
režim `MANUAL`** — web + reauth, samostatné GO. ZERO není persistentní PAUSE ani nouzová brzda. Režim nemění
model ani prompt; runtime dál používá schválené artefakty (`generate-response.ts:129` prompt z registry,
`:151` `H2_MODELS.buddy`) — žádný nový bypass PASS.

### 5.2 `/ask` kontrakt

Deterministický parser nad **aktuální** dešifrovanou zprávou jobu (`readMessageText`,
`process-owner-queue.ts:131`): po `trim()` začíná přesně `/ask ` a zbytek po `trim()` je neprázdný. Čistá
funkce nad immutable `raw_event` → každý retry dá stejný výsledek, příznak se neukládá. Holé `/ask` → nápověda
bez LLM. `/ask` v ZERO nic neodemkne. Prefix v historii, citaci nebo výstupu modelu nic nepovoluje. `/ask`
není command — zpráva jde normálním lifecycle (DEC-007 C2). Přijaté zbytkové riziko: kompromitovaný Telegram v
zapnutém MANUAL může posílat `/ask` až do stropů P0b.

### 5.3 Kdo mění režim, audit, idempotence

| Změna | Telegram | Web + `requireRecentReauth()` |
|---|---|---|
| Stejný / nižší režim | ano (`/mode zero`, `/mode manual`, `/mode normal`) | ano |
| Vyšší režim (ZERO→MANUAL/NORMAL, MANUAL→NORMAL) | **ne** — „Zvýšení vyžaduje potvrzení na webu." | ano |
| Limity (P0b) | ne | ano |
| `/mode`, `/cost` (výpis) | ano | ano |

Protokolové příkazy = nová tabulka vedle `FAST_PATH_COMMANDS` (`control-fast-path.ts:20-28`), exact
whole-message match po `trim().toLowerCase()` (I7.7). Aplikace při ingestu ve stejné transakci jako
`raw_event` (vzor `owner_control_epoch`, `ingest-message.ts:129-135`; I7.4).

- `owner_cost_policy`: `owner_id` PK, `mode`, `policy_version`, `updated_at`.
- Append-only `owner_cost_policy_changes`: `operation_id` UNIQUE, `source_raw_event_id` UNIQUE NULL, `kind`
  (`MODE`/`LIMITS`/`BILLING_RESET`), `old`/`new` jsonb, `from_version`/`to_version`, `actor`, `channel`
  (`TELEGRAM_COMMAND`/`WEB_REAUTH`/`ROLLOUT`), `created_at`.
- Retry starého webhooku → `source_raw_event_id` UNIQUE → no-op, starší policy nevrátí. Stale web formulář
  neprojde CAS na `policy_version`.
- Jediný writer `applyPolicyChange()` (Telegram i web) pod owner zámkem (§5.4), autorizace podle matice.

### 5.4 Pořadí vůči přijetí volání

Každé placené volání projde `acceptModelCall(purpose)`: krátká transakce pod `pg_advisory_xact_lock` na ownera
(stejný zámek jako `applyPolicyChange()` a obnova latche) — přečte policy + latch, vyhodnotí
režim/purpose/`/ask`, v P0b zapíše odpočet (§6), COMMIT. **Síť až po commitu, mimo zámek.** Volání přijaté
před commitem změny na ZERO smí doběhnout a doručit se; po commitu nové přijetí nevznikne.

`acceptModelCall` se volá těsně před `callModel` v `generate-response.ts:150` a
`operational-extraction.ts:75`. Governance test: `callAnthropicModel` importuje jen `h2/cost/accept.ts`
(`fixtures.ts` s injektovaným `callModel` viz §8). Odmítnutí je typovaná hodnota: Buddy → šablona přes
`commitJobResult()` bez `recordJobFailure()` a karantény; extrakce → skip; řádek v `llm_guard_denials` (owner,
job, purpose, důvod, `policy_version`).

### 5.5 Šablony (tabulka z gate nad v1, jen existující stavy)

| Situace | Text | Dodávka |
|---|---|---|
| ZERO | „Režim ZERO. Zpráva je uložená; AI ji nezpracovala. Zapnutí AI vyžaduje potvrzení na webu. Stav: /mode · /cost." | P0a |
| MANUAL bez `/ask` | „Režim MANUAL. Zpráva je uložená. Pro AI odpověď pošli novou zprávu začínající /ask a textem dotazu." | P0a |
| CAP_DAY / CAP_MONTH | „Na tuto AI odpověď nestačí zbývající denní/měsíční rozpočet. Zpráva je uložená. Automaticky ji později nezpracuji. Stav a obnova limitu: /cost." | P0b |
| CAP_JOB | „Tato žádost se nevejde do rozpočtu na jednu zprávu. Zpráva je uložená; AI odpověď nevznikla." | P0b |
| PROVIDER_BILLING_UNAVAILABLE | „AI je nedostupná kvůli vyčerpanému kreditu poskytovatele. Zpráva je uložená. Po obnovení kreditu pošli dotaz znovu." | P0a |
| Chyba konfigurace | „AI odpověď je dočasně vypnutá kvůli konfiguraci. Zpráva je uložená; automatická pozdější odpověď není naplánovaná." | P0a |

Žádný příslib pozdější odpovědi ani replaye. „Zpráva je uložená" je pravda — job vzniká až po commitu
`raw_event`. Strojový důvod fallbacku se ukládá u odpovědi; fencing doručení (I7.5) platí i pro fallback.
`/cost`: P0a ukáže režim a latch; P0b přidá čerpaný příděl, zbytek a další hranici období — označené jako
**konzervativní příděl**, ne vyúčtovaná cena.

### 5.6 DEC-008 se nezhorší (bez refaktoru měřiče)

`withLlmAttempt()` zůstává **na stejném místě** (`process-owner-queue.ts:95,137`); `charged_processing_ms` má
stejnou sémantiku, obal dál měří celou stage; žádný druhý LLM řádek. Jediný nový čas je krátká transakce
`acceptModelCall` — běží uvnitř už měřené stage, takže se účtuje; backoff zůstává neúčtovaný. Ve prospěch
DEC-008: billing 400 a odmítnutí režimem/latchem přestávají být failure a nespálí pokus. Známý stav z dneška
zůstává: odmítnutý Buddy job má fantomový `llm_attempts` řádek bez provider volání — oprava je P1 refaktor
měřiče.

## 6. P0b — pevný příděl R (požadavek 6)

### 6.1 Podporované requesty a důkaz R

R je stejná pro každé povolené volání a ≥ prokázanému maximu ceny jednoho povoleného requestu. Pravidlo je
verzované (`r_rule_version`), auditované a zmrazené; změna modelu, formátu nebo ceny vyžaduje nový důkaz,
jinak se cesta blokuje. Žádný bezpodmínečný fallback.

| Purpose | Model | Max vstup (celý request) | Max výstup | USD/MTok in/out | Horní mez |
|---|---|---|---|---|---|
| `BUDDY_RESPONSE` | `claude-sonnet-5` | 24 000 tok. | 2 048 (`max_tokens`, vynucuje API) | 2 / 10 | 0,06848 USD |
| `OPERATIONAL_EXTRACTION` | `claude-haiku-4-5-20251001` | 8 000 tok. | 2 048 | 1 / 5 | 0,01824 USD |

Ceny: `h2/prompts/usage.ts:11-14`, shodné s aktuálním ceníkem Anthropic. Limity: `CONTEXT_TOKEN_BUDGETS`
(`h2/context/token-budget.ts`). Cache, tools, obrázky, hlas a jiné modely nejsou podporované → odmítnout.

**Návrh R:** jednotka **mikro-USD (µUSD, `bigint`)**; R = max(0,06848; 0,01824) nahoru = **68 480 µUSD**;
stropy 300 000 / 1 500 000 / 35 000 000 µUSD. Důsledek: **max 4 přijetí na job** (273 920 µUSD) — v NORMAL 2
plné průchody extrakce + Buddy, v MANUAL 3 Buddy pokusy (`MAX_ATTEMPTS = 3`, `quarantine.ts:21`); den 21
přijetí, měsíc 511. Když to nestačí, zmenší se request — nevymýšlí se menší cena.

**P0b je dnes BLOKOVANÁ — horní mez vstupu není doložená.** `maxInputTokens` se dnes kontroluje **odhadem**
`estimateTokens()` (3,5 znaku/token, `token-budget.ts`), což není zaručená mez; a není doloženo, že budget
pokrývá systémový prompt, JSON schéma (`output_config.format`) a overhead. Důkaz R vyžaduje jednu cestu
(metodiku rozhodne gate):
- **(a)** tvrdý pre-flight limit na skutečný počet tokenů přes `POST /v1/messages/count_tokens` (stejný model,
  systém, zprávy, schéma); selhání nebo překročení → neodeslat. Nutno doložit z dokumentace Anthropic, že
  endpoint negeneruje, není zpoplatněný a započítá `output_config.format`.
- **(b)** bajtový strop celého requestu s doloženou vazbou „tokeny ≤ bajty + konstanta" — v dokumentaci
  Anthropic taková vazba **není**, bez zdroje neprojde. Bez důkazu R zůstává P0b blokovaná.

### 6.2 Tabulka odpočtů (append-only)

```sql
-- NÁČRT, neaplikováno — migrace P0b
create table budget_deductions (
  id uuid primary key,                 -- identita fyzického pokusu (acceptModelCall)
  owner_id uuid not null references owners (id),
  job_id uuid not null references message_processing_jobs (id),
  purpose text not null,
  model_id text not null,
  amount_microusd bigint not null check (amount_microusd > 0),
  period_day date not null,            -- Europe/Prague v okamžiku přijetí
  period_month date not null,          -- 1. den měsíce, Europe/Prague
  policy_version bigint not null,
  r_rule_version text not null,
  created_at timestamptz not null default now()
);
create index budget_deductions_owner_period_idx on budget_deductions (owner_id, period_month, period_day);
-- h2_runtime jen SELECT + INSERT (žádný UPDATE/DELETE) → neměnná částka i období; RLS podle 0017:44-50.
```

Bez `cost_state`, skutečné ceny, release a oprav odpočtů; `usage_ledger` beze změny, bez `pricing_catalog` a
`btree_gist`. Limity (µUSD), `r_rule_version` a `t0` jsou sloupce `owner_cost_policy` (verze + audit).

### 6.3 Protokol odpočtu

`acceptModelCall` (§5.4) v P0b pod owner zámkem, jedna transakce: (1) policy, latch a platnost jobu — fencing
token aktuální (`active_job_id`, lease, epoch), jinak `H2FencingError` jako dnes; (2) `sum(amount)` za job,
den a měsíc od `t0`; (3) `+R` přes strop → `CAP_JOB` / `CAP_DAY` / `CAP_MONTH`; (4) INSERT odpočtu, COMMIT.
Síť až potom.

- **Souběh:** zámek serializuje i dva workery po expiraci lease i změnu policy; starý worker s neplatným
  tokenem neprojde krokem 1.
- **Jeden fyzický pokus = jeden odpočet:** id se generuje pro každé volání, nikdy se nerecykluje. Adapter nemá
  skrytý retry — syrový `fetch`, bez SDK, bez smyčky (`anthropic-adapter.ts:4-6,59`).
- **Nový retry = nový odpočet** v mezích `MAX_ATTEMPTS` a job capu.
- **Nejistota o odeslání** (timeout, pád po commitu): odpočet zůstává. Pád před commitem nic neodečetl a
  volání neodešlo.
- **DB chyba** → nevolat model, infrastrukturní cesta, ne denial.
- **Extrakce v NORMAL** může spotřebovat poslední prostor; Buddy pak vrátí rozpočtovou šablonu. Přednost
  odpovědi **není** garantovaná.
- Nerovnost *skutečná cena ≤ Σ odpočtů ≤ limit* platí za předpokladu správného R a úplného pokrytí (§8).

## 7. T0 a staré joby (požadavek 7)

**Executory Buddy** (produkční alias, `maxDuration = 300 s`): Telegram webhook `after()`
(`app/api/h2/telegram/webhook/route.ts:30`), web `POST /api/h2/web/messages` `after()` (`route.ts:21`),
`cron-job.org` → `POST /api/internal/queue-wakeup` (`route.ts:28`, 30 min).

**Aktivace P0b:**
1. Pozastavit `cron-job.org` wake (nastavení mimo repo, dělá Honzík).
2. Owner → `ZERO` (P0a) — nové zprávy nedostanou placené volání.
3. Rozpracované joby (`PENDING` / `RETRY_PENDING` / `PROCESSING`): dokončit ve starém systému, nebo ukončit
   existujícím `h2/db/scripts/clear-stale-pending-jobs.ts --confirm` (→ `MANUALLY_CLEARED`, precedens BUILD-11
   Krok 4) s vysvětlením ownerovi; opakování = nová explicitní žádost. **Žádný starý job nepokračuje s
   obnoveným per-job rozpočtem.**
4. Deploy + promote P0b; čekat ≥ 300 s (`maxDuration`) + 60 s (`CALL_TIMEOUT_MS`), než doběhnou `after()`
   úlohy starého deploymentu.
5. **Zapsat T0** (`owner_cost_policy.t0`, audit `channel='ROLLOUT'`); počítají se jen odpočty od T0.
6. Obnovit wake, owner → MANUAL (web, GO). Staré deploymenty zůstávají dosažitelné na unikátních URL (triggery
   na ně nemíří) — proti tomu chrání brzda P0a-1, ne T0.

**První období:** den a měsíc T0 se v `/cost` označí jako **„limit na nová volání od aktivace"**. Dřívější
útrata se nedopočítává a celková útrata kalendářního měsíce T0 se negarantuje; úplný limit platí od prvního
celého následujícího měsíce. Hranice Europe/Prague podle přijetí, bez příslibu shody s výpisem poskytovatele.
**T0 ani odpočty se při deployi neresetují** (jsou v DB).

**Návrh úpravy M1 gate** (`history/build/BUILD-STATUS-2026-09-29.md`, položka „Minimální metering"):
> ~~tvrdý strop 35 USD/měsíc vynucený~~ → **P0a přijata** (brzda, billing latch, režimy) **a P0b přijata**
> (konzervativní příděl R na každé nové přijetí od T0; stropy 0,30 / 1,50 / 35 USD na součet odpočtů; první
> kalendářní měsíc jen „limit na nová volání od aktivace"; souhrnný strop Anthropic účtu — Watcher, eval —
> mimo rozsah).

**DEC-011 (návrh, zapíše se po GO):** H2 Buddy nákladové řízení P0-lite = **P0a** (nouzová brzda na úrovni
klíče poskytovatele; binární billing latch s ruční obnovou po reauth; režimy `ZERO < MANUAL < NORMAL`,
Telegram jen dolů, default ZERO, `/ask` kontrakt) + **P0b** (pevný odpočet R na každý fyzický pokus v
append-only tabulce, stropy na součet odpočtů od T0). Přesné účetnictví, settlement, katalog cen, LEAN/DEEP a
trivial-turn jsou P1 podle doložené potřeby.

## 8. Spendeři (požadavek 8)

| Spender | Stav v P0-lite | Důkaz |
|---|---|---|
| Runtime `BUDDY_RESPONSE` | **krytý** `acceptModelCall` (P0a režim + latch, P0b odpočet) | governance test: jediný importér `callAnthropicModel` |
| Runtime `OPERATIONAL_EXTRACTION` | **krytý** stejně; v ZERO/MANUAL neběží. K 2026-09-05 bez aktivního promptu v produkci (`BUILD-STATUS-2026-09-29.md:7`), aktuální stav ČEKÁ NA OVĚŘENÍ v DB | totéž |
| Job retry (`MAX_ATTEMPTS = 3`) | **krytý** — každý fyzický pokus znovu přes `acceptModelCall` + nový odpočet | test „nový retry" |
| Certifikace (`h2/prompts/fixtures.ts`, certify skript) | **produkčně blokovaná** — skript je jen v otevřeném PR #49, na `main` není. PR #49 se nemerguje, dokud certifikace nejde přes stejný odpočet a limity. Runtime nedostane bypass PASS. | governance test: `fixtures.ts` bez produkčního volajícího, jediný importér adapteru |
| Hlas (Whisper, `transcribeVoiceJob`) | **prokazatelně vypnutý** — bez produkčního volajícího; zapnutí vyžaduje stejné krytí; ZERO nesmí platit přepis | governance test: žádný import z `app/` |
| H2-IW Watcher | **samostatný** — 3 USD, vlastní ledger (DEC-009); sdílí účet/kredit, klíč možná (§3) | mimo plán |
| H2-IW eval (operátor) | **mimo Buddy ledger**, běží na `H2_ANTHROPIC_API_KEY`; do P0b se nepočítá; zastaví ho brzda | `RUNBOOK.md:47` |

## 9. Regresní testy a konec gate (požadavek 9)

Testy s mockem poskytovatele; test 1 fyzicky podle §3, bez placené generace, až po GO.

| # | Test | Dodávka |
|---|---|---|
| 1 | **Brzda proti staré verzi:** klíč deaktivován → nezměněný deployment i `curl /v1/models` dostanou 401; obnova → 200 | P0a-1 (fyzicky) |
| 2 | **Billing bez karantény:** mock 400 `credit balance is too low` → BLOCKED, šablona, `DELIVERED`, žádný `recordJobFailure`; další job 0 volání; jiné 400 → `ANTHROPIC_BAD_REQUEST` | P0a-2 |
| 3 | **Reset / stale reset:** aktuální verze → AVAILABLE; stale formulář odmítnut; duplicitní `operation_id` no-op; starý reset po nové blokaci neodemkne; úspěch neodblokuje | P0a-2 |
| 4 | **ZERO/MANUAL:** ZERO → 0 volání; MANUAL bez prefixu, holé `/ask`, prefix v citaci, `/ask` v ZERO → 0 volání; platný `/ask` v MANUAL → jen Buddy; Telegram ZERO→MANUAL odmítnut; stale webhook policy nevrátí | P0a-3 |
| 5 | **Dva souběžné odpočty na hranici** o poslední R → projde právě jeden | P0b |
| 6 | **Stale lease:** expirovaný token → žádný odpočet ani volání | P0b |
| 7 | **Crash před/po odpočtu:** před commitem 0 odpočtů a 0 volání; po commitu odpočet zůstává | P0b |
| 8 | **Nový retry:** druhý fyzický pokus = druhý odpočet; nad job capem `CAP_JOB` | P0b |
| 9 | **Hranice období:** přesně na capu a těsně nad; půlnoc, konec měsíce, změna času (Europe/Prague); období podle přijetí | P0b |
| 10 | **Znovunasazení bez resetu:** po redeployi součty a T0 beze změny | P0b |
| 11 | **Žádný bypass certifikací:** governance test importérů; žádná cesta bez PASS | P0a/P0b |

**Konec gate:** **P0a** je přijata po prokázání svých tří funkcí — brzda (test 1), billing latch (2–3), režimy
(4). **P0b** je přijata po prokázání nerovnosti *skutečná cena ≤ Σ odpočtů ≤ limit* v deklarovaném rozsahu
(důkaz R §6.1 + testy 5–11). Nový požadavek je blokátor **jen tehdy**, když ukazuje porušení tohoto kontraktu
nebo existujícího bezpečnostního invariantu.

## Mimo scope (vědomě)

- P1 nebo samostatný slice podle doložené potřeby: settlement, `cost_state`, rezervace, opening balance,
  HALF_OPEN/probe, dynamický `pricing_catalog`, změna typů `usage_ledger`, `btree_gist`, LEAN, DEEP,
  trivial-turn skip, garantovaná přednost odpovědi před extrakcí, odstranění fantomových `llm_attempts`,
  trvalý `/pause`.
- Souhrnný strop Anthropic účtu (Watcher, eval, další klienti).
- **Profile bridge (DEC-012, návrh z v2 beze změny):** (A) žádný most jako dočasný stav; (B) ruční export po
  reauth jako první budoucí most, stavět až po splnění podmínek exportu a mazání (allowlist `portable` polí,
  náhled, audit, vyloučení smazaných polí); (D) MCP pro Claude Code k novému review; (C) endpoint s tokenem v
  instructions/memory zamítnut kvůli uložení credentialu v cizím nástroji. Implementace není součástí P0.

## Brány (Honzík)

1. Review v3 → GO na plán.
2. GO na fyzický test brzdy (P0a-1).
3. GO na migraci + deploy P0a; pak GO na přepnutí do MANUAL.
4. Gate rozhodne metodiku důkazu R (a/b) → GO na P0b, T0 a pozastavení wake.
5. Po GO zapsat DEC-011 a úpravu M1 gate.
