# H2 Buddy — Build Status

**Aktuální slice:** BUILD-09 — Context Engine, **IN PROGRESS** — plán schválen Honzíkem ([docs/h2/BUILD-09-PLAN.md](./BUILD-09-PLAN.md), 4 kroky/PR). **Krok 1 (Token Budget Contract + context_run persistence + retrofit BUILD-08 input trim) — UZAVŘENO**, MERGED, nasazeno na produkci. PR [#27](https://github.com/honzabindr-max/muj-web/pull/27) mergnut do `main` (merge commit `df7c78a`), Vercel auto-deploy proběhl (`dpl_6sVj7YmFsNdoJFSYFgQgySUfUdpX`), `/api/h2/health` živě ověřen. Žádná nová migrace, žádný nový credential — `check-required-env.ts` beze změny nálezu. **Krok 2 (deterministic relevance floor + entity resolution v1) — implementace hotová**, branch `build/h2-build-09-step2-relevance-floor`, čeká na push+PR a Honzíkovo GO k mergi. BUILD-08 (PR #26) je od minula UZAVŘENO — AT GREEN, MERGED (`417c789`), nasazeno na produkci. BUILD-01 (PR #11), BUILD-02 (PR #12+#13), BUILD-03 (PR #14), BUILD-03A (PR #15), BUILD-04 (PR #18+#19), BUILD-05 (PR #20), BUILD-06 (PR #22), BUILD-07 (PR #24), BUILD-08 (PR #26), BUILD-09 Krok 1 (PR #27) a hotfix (PR #17) jsou MERGED. **Nová session: začni čtením tohoto souboru + BUILD-09-PLAN.md + DECISIONS.md.**

**Evidence (BUILD-09 Krok 2, implementace hotová, čeká na push+PR):**
```
Commit: c644964 (implementace + testy)
Branch: build/h2-build-09-step2-relevance-floor
DB: žádná nová migrace — čte operational_extractions (BUILD-08), žádný nový zápis.
GHA: čeká se na push + otevření PR
Artifact: N/A
Deployment: N/A — relevance-floor.ts a resolve-entities.ts jsou další čisté/read-only
    funkce bez volajícího (Krok 3-4 na nich teprve staví), merge sám o sobě nezmění chování
    žijící produkce.
Timestamp: 2026-09-03
Verified by: Code — lokálně 174/174 testů zelených (45 souborů, vč. 13 nových: AT-21
    přes passesRelevanceFloor() bez entity/required/hypotézy, AT-22 entity match
    case-insensitive, AT-23 hypotéza blokovaná mimo BUDDY_DEEP_DIVE, resolveMessageEntities()
    ENTITY mapping/INVALID filtr/missing-label skip/nejnovější-OK-řádek), `npx tsc --noEmit`
    čistě, `npm run build` čistě (žádné nové routy)
Remaining risk: žádné funkční — Krok 2 nemá produkční trigger, DoD celého BUILD-09 se
    uzavírá až Krokem 4.
```
**Evidence (BUILD-09 Krok 1 celý krok):**
```
Commit: 4fc64c2 (implementace + testy), 6e13baa + 55b065a (docs), merge df7c78a do main
Branch: build/h2-build-09-step1-token-budget (PR #27, MERGED, branch smazána po mergi)
DB: žádná nová migrace — context_runs/context_run_items (0004_context.sql, BUILD-02) už mají
    plný CRUD grant pro h2_runtime (0011_roles_and_rls.sql).
GHA: run 33745005718 (PR #27, h2-tests) — pass
Artifact: N/A
Deployment: Vercel production, deployment dpl_6sVj7YmFsNdoJFSYFgQgySUfUdpX, target=production,
    vytvořen ihned po mergi (10:37), state READY; živě ověřeno curl -sL
    https://good-inventions.work/api/h2/health → {"status":"ok"}
Timestamp: 2026-09-03
Verified by: Code — CI, Vercel CLI (vercel inspect, vercel ls --prod), živý curl na produkci,
    h2/db/scripts/check-required-env.ts proti production i preview (161/161 testů lokálně,
    tsc/build čisté)
Remaining risk: žádné funkční — Krok 1 nemá produkční trigger, DoD celého BUILD-09 se
    uzavírá až Krokem 4 (viz plán, "proč bezpečné mergnout samostatně" u každého kroku).
```
**Evidence (BUILD-08 celý slice):**
```
Commit: a5a9f11 (implementace + testy), dbe3a03 + 8052d21 (docs), merge 417c789 do main
Branch: build/h2-build-08-operational-extraction (PR #26, MERGED, branch smazána po mergi)
DB: žádná nová migrace — operational_extractions (0003_prompts_and_llm.sql, BUILD-02) už má
    plný CRUD+RLS grant pro h2_runtime (je v owner_scoped_tables).
GHA: run 33742774536 (PR #26, h2-tests) — pass
Artifact: N/A
Deployment: Vercel production, deployment dpl_C9RFhCDSpueSnCsw68EDrbs6inrL, target=production,
    vytvořen ihned po mergi (10:13), state READY; živě ověřeno curl -sL
    https://good-inventions.work/api/h2/health → {"status":"ok"}
Timestamp: 2026-09-03
Verified by: Code — CI, Vercel CLI (vercel inspect, vercel ls --prod), živý curl na produkci,
    h2/db/scripts/check-required-env.ts proti production i preview (151/151 testů lokálně,
    tsc/build čisté)
Remaining risk: reálné Anthropic (Haiku) volání zatím neověřeno (mockovaný callModel) — stejná
    otevřená položka jako BUILD-07 (ruční certifikace promptu proti reálnému modelu), ne nová.
```
**Evidence (BUILD-07 celý slice):**
```
Commit: 82c76e0 (implementace + testy), 87f061f (docs), merge dbec556 do main
Branch: build/h2-build-07-prompt-registry (PR #24, MERGED, branch smazána po mergi)
DB: migrace 0015_prompt_registry_runtime_grants.sql — grant select/insert/update na
    prompt_versions a select/insert na prompt_test_runs pro h2_runtime (dřív jen SELECT).
    Aplikována a ověřena přímým dotazem na _h2_migrations PŘED mergem: h2-runtime preview
    applied_at 2026-09-03T09:43:36.503Z, h2-runtime production applied_at
    2026-09-03T09:47:54.953Z. Žádná nová tabulka/sloupec — schéma je celé z BUILD-02.
GHA: run 33740125492 (PR, h2-tests) — pass
Artifact: N/A
Deployment: Vercel production, deployment dpl_GajgTX5d47SdpewC7mTwFNSxoMEG, target=production,
    vytvořen ihned po mergi (11:48:12), state READY; živě ověřeno curl -sL
    https://good-inventions.work/api/h2/health → {"status":"ok"}
Timestamp: 2026-09-03
Verified by: Code — CI, přímý SQL dotaz na _h2_migrations proti oběma Neon větvím, Vercel CLI
    (vercel inspect, vercel ls), živý curl na produkci, h2/db/scripts/check-required-env.ts
    proti production i preview (146/146 testů lokálně, tsc/build čisté)
Remaining risk: reálné Anthropic/OpenAI volání zatím neověřeno (mockovaný fetch, Rozhodnutí
    6) — ruční certifikace čeká na H2_ANTHROPIC_API_KEY, vyžádám si ho zvlášť jako explicitní
    STOP, až na něj dojde.
```
**Evidence (BUILD-06 celý slice):**
```
Commit: a217506 (implementace + testy), 446bd45 (docs), merge d61860e do main
Branch: build/h2-build-06-voice-transcription (PR #22, MERGED, branch smazána po mergi)
DB: žádná nová migrace — transcript se zapisuje in-place do raw_events.payload_ciphertext,
    usage_ledger už existuje z BUILD-02 (viz docs/h2/BUILD-06-PLAN.md Rozhodnutí 1/4)
GHA: run 33737639151 (PR, h2-tests) — pass
Artifact: N/A
Deployment: Vercel production, deployment dpl_ChYNSo3bcfbL5pCwppZMHDHDx7PL, target=production,
    vytvořen ihned po mergi (11:16:27), state READY; aliasy vč. good-inventions.work; živě
    ověřeno curl -sL https://good-inventions.work/api/h2/health → {"status":"ok"}
Timestamp: 2026-09-03
Verified by: Code — CI, Vercel CLI (vercel inspect, vercel ls --prod), živý curl na produkci,
    h2/db/scripts/check-required-env.ts proti production i preview (134/134 testů lokálně,
    `npx tsc --noEmit` čistě, `npm run build` čistě)
Remaining risk: žádné funkční — BUILD-06 nemá automatický produkční trigger, takže chybějící
    H2_OPENAI_API_KEY nic v produkci dnes nerozbíjí. Reálné Telegram/Whisper volání zatím
    neověřeno end-to-end (mockovaný fetch v testech) — ruční verifikace čeká na
    H2_OPENAI_API_KEY od Honzíka (H2_TELEGRAM_BOT_TOKEN už ve Vercelu je)
```
**Evidence (BUILD-05 celý slice):**
```
Commit: f2d5f81 (implementace + testy), 2fa3deb (docs), merge c802edd do main
Branch: build/h2-build-05-queue-lease-fencing (PR #20, MERGED, branch smazána po mergi)
DB: žádná nová migrace — 0002_messaging.sql (BUILD-02) a 0009_proactivity_and_jobs.sql
    (schéma incidents) beze změny, žádný nový sloupec/constraint
GHA: run 33734216901 (PR, h2-tests) — pass; run 33734400228 (PR po docs commitu) — pass
Artifact: N/A
Deployment: Vercel production, deployment dpl_23RojA1yQwwXym1e9rbsi5RUAi4y, target=production,
    vytvořen ihned po mergi (10:42:50, ~3 min po merge commitu), state READY; aliasy vč.
    good-inventions.work; živě ověřeno curl -sL https://good-inventions.work/api/h2/health
    → {"status":"ok"}
Timestamp: 2026-09-03
Verified by: Code — CI, Vercel CLI (vercel inspect, vercel ls --prod), živý curl na produkci,
    h2/db/scripts/check-required-env.ts proti production i preview
Remaining risk: žádné funkční — BUILD-05 nemá HTTP povrch, žádný produkční trigger (Rozhodnutí
    2), takže merge sám o sobě nemění chování žijící produkce. check-required-env.ts hlásí
    chybějící H2_LEDGER_HMAC_KEY na obou prostředích — STEJNÝ, už z BUILD-04 známý nález
    (BUILD-20/Deletion Ledger, mimo scope BUILD-05, hmac.ts se touhle slicí nemění)
```
**Evidence (BUILD-04 celý slice):**
```
Commit: e5d05d3 (implementace), d425cc5 + 38f5907 (docs), merge 76a7d40 do main
Branch: build/h2-build-04-unified-ingestion (PR #18, MERGED)
DB: h2-runtime production — 0014 v _h2_migrations, applied_at 2026-09-03T06:43:26.898Z;
    h2-runtime preview — 0014 v _h2_migrations, applied_at 2026-09-03T06:46:54.870Z;
    identity_audit_events_event_type_check na obou obsahuje TELEGRAM_MESSAGE_REJECTED_UNKNOWN_SENDER
    (ověřeno přímým SELECT z _h2_migrations + pg_get_constraintdef, ne předpokladem)
GHA: run 33722329096 (PR, h2-tests) — pass; run 33725057044 (main, h2-tests, commit 76a7d40) — pass
Artifact: N/A
Deployment: Vercel production, deployment dpl_Bwqy4G3jPyiJ99ziTDmcehA7i8AE, target=production,
    commit 76a7d40, state READY; živě ověřeno curl -sL https://good-inventions.work/api/h2/health
    → {"status":"ok"}
Timestamp: 2026-09-03
Verified by: Code — CI, přímý SQL dotaz proti oběma Neon větvím (neondb_owner, DEC-006),
    Vercel deployments API, živý curl na produkci
Remaining risk: žádné — end-to-end živě ověřeno (viz PR #19 evidence a smoke test sekce níže):
    4 raw_events (telegram/USER), 4 message_processing_jobs PENDING, 0 rejected-sender audit
```
**Poslední deployment:** [PR #11](https://github.com/honzabindr-max/muj-web/pull/11), [PR #12](https://github.com/honzabindr-max/muj-web/pull/12), [PR #13](https://github.com/honzabindr-max/muj-web/pull/13), [PR #14](https://github.com/honzabindr-max/muj-web/pull/14), [PR #15](https://github.com/honzabindr-max/muj-web/pull/15), [PR #17](https://github.com/honzabindr-max/muj-web/pull/17), [PR #18](https://github.com/honzabindr-max/muj-web/pull/18), [PR #19](https://github.com/honzabindr-max/muj-web/pull/19), [PR #20](https://github.com/honzabindr-max/muj-web/pull/20), [PR #22](https://github.com/honzabindr-max/muj-web/pull/22), [PR #24](https://github.com/honzabindr-max/muj-web/pull/24) a [PR #26](https://github.com/honzabindr-max/muj-web/pull/26) mergnuty do `main`, Vercel auto-deploy proběhl přes existující GitHub integraci. Reálné přihlášení přes Google na `good-inventions.work` živě ověřeno a funkční (po hotfixu PR #17 + aplikaci migrací 0012+0013 na produkční i preview větev Neonu). BUILD-04 (Telegram/web ingest routy) nasazeno na produkci a **živě ověřeno end-to-end** — reálné Telegram zprávy prošly `setWebhook` → `ingestMessage()` → DB. BUILD-05 (queue/lease/fencing/quarantine) nasazeno na produkci — bez HTTP povrchu, ověřeno jen zdravím `/api/h2/health` a testy pod `h2_runtime`. BUILD-06 (voice transcription) nasazeno na produkci — ingest větev live (feature flag `telegramVoice=true`), zpracování (download/transkripce) zatím bez produkčního triggeru, čeká na ruční end-to-end verifikaci s `H2_OPENAI_API_KEY`. BUILD-07 (prompt registry & model adapter) nasazeno na produkci — migrace 0015 aplikována na obou Neon větvích, mechanismus bez produkčního triggeru, čeká na ruční certifikaci s `H2_ANTHROPIC_API_KEY`. BUILD-08 (operational extraction) nasazeno na produkci — žádná migrace, žádný nový credential, mechanismus bez produkčního triggeru (zapojení je BUILD-10).
**Stav milestone M1 (Buddy Live):** NOT STARTED — 0 / 11 bloků DEPLOYED (BUILD-01–BUILD-11 vč. BUILD-03A), BUILD-01/02/03/03A/04/05/06/07/08 AT GREEN, MERGED, nasazeny; BUILD-04 živě ověřeno end-to-end; BUILD-06/07 čekají na ruční end-to-end ověření (voice, resp. Anthropic certifikace)
**Otevřené ARCHITECTURE DECISION REQUIRED:** 0 (DEC-001–DEC-006 vyřešeny/zaznamenány; DEC-004 zaznamenané riziko pro budoucí pg upgrade, DEC-005 uzavřený bezpečnostní incident "no exposure confirmed by owner", DEC-006 vědomá odchylka — migrace běží přes `neondb_owner`, ne `h2_migrator` — s remedy odloženým do M1 deploy gate, viz [DECISIONS.md](./DECISIONS.md))

## Zdroje pravdy

| Co | Kde | Poznámka |
|---|---|---|
| Produkt / architektura / zadání | Notion — *H2 BUDDY — Complete Product Specification v1.0*, *H2 Buddy — Technical Architecture v1.2 (LOCKED — BUILD APPROVED)*, *H2 Buddy — Build Specification v1.0* | Uzamčené. Tento soubor je nesmí zmenšovat ani znovu otevírat. |
| Stav stavby | tento soubor — `docs/h2/BUILD-STATUS.md` | Aktualizuje se vždy ve stejném commitu jako práce, kterou popisuje. Nikdy zvlášť. Mirror v Notionu (viz níže) je odvozený, ne autoritativní. |
| Rozhodnutí | `docs/h2/DECISIONS.md` | ARCHITECTURE DECISION REQUIRED log. |
| Důkaz | git (commit / branch / PR) + CI + DB | Text v Notionu, paměť ani tvrzení agenta nejsou důkaz. |

**Notion mirror:** stránka *H2 Buddy — Build Status (mirror)* pod *H2 Buddy — Build Specification v1.0* je needitovatelný automatický zrcadlový výstup tohoto souboru a `DECISIONS.md`. Aktualizuje se po každém commitu, který mění jeden z těchto dvou souborů, ve stejném kroku jako commit — zdroj pravdy zůstává vždy tento repozitář.

## Pravidla

1. Jeden BUILD blok = jedna větev = jeden PR = jeden evidence block. Nikdy dva bloky rozdělané současně.
2. Slice je hotový, až jsou jeho acceptance testy z Acceptance Test Ownership Matrix (Build Specification §6) zelené. Bloky bez vlastního AT ownera (BUILD-01, BUILD-02, BUILD-08, BUILD-13, BUILD-18) se ověřují schema/unit/integration testy daného slice — to neznamená, že jsou volitelné.
3. Nejasnost, která by měnila Product Spec, I1–I8 nebo Locked Architecture → `ARCHITECTURE DECISION REQUIRED`, zápis do `DECISIONS.md`, zastavit **pouze** dotčený slice a pokračovat jiným nezávislým.
4. GO od Honzíka je potřeba na: merge do `main` (spouští produkční deployment), přidání env proměnných nebo secrets do Vercelu, produkční migrace, cokoli utrácející peníze nebo měnící limit, cokoli mazající data nebo rozšiřující oprávnění. Push branche a otevření PR GO nepotřebují — to je běžná součást „jeden BUILD blok = jedna větev = jeden PR" workflow.
5. **Migrace se na Neon neaplikují automaticky při Vercel deploy.** Existence souboru v `h2/db/migrations/` neznamená, že běží na produkci nebo na preview větvi — to zjistil hotfix po BUILD-03A: migrace `0012_identity_reauth.sql` byla mergnutá a nasazená týden, ale na produkční ani preview databázi nikdy neproběhla (viz hotfix sekce v BUILD-03A níže), což se navenek projevilo jako `AccessDenied` při přihlášení. Trvalé pravidlo: **žádný slice s novou migrací se nepovažuje za uzavřený, dokud není ověřeno (přímým dotazem na `_h2_migrations`, ne předpokladem), že migrace skutečně proběhla na produkční i preview větvi obou Neon projektů.**
6. **Kanonická doména pro externí registrace je `www.good-inventions.work`, ne apex.** Apex `good-inventions.work` dělá `307` redirect na `www.` (Vercel/DNS konfigurace, mimo H2 scope) a většina webhook doručovatelů (Telegram Bot API prokazatelně, BUILD-04 nález 2026-09-03) redirect nenásleduje — request na apex URL je tak nedoručitelný, přestože samotná aplikace běží a `curl -L` z terminálu redirect transparentně proleze. **Trvalé pravidlo: jakákoli budoucí externí webhook/callback registrace (Telegram, Google Calendar OAuth/push notifications, budoucí provideři) musí použít `https://www.good-inventions.work/...`, nikdy apex.** Stejná třída chyby jako chybějící `www.` redirect URI v Google Cloud Console u BUILD-03A (§ hotfix níže) — externí služby a prohlížeče se chovají k redirectům jinak než `curl -L`/uživatel v prohlížeči.
7. **Standardní ad hoc ověřovací nástroj: `h2/db/scripts/verify-ingestion.ts`.** Připojí se jako role `h2_runtime` (ne admin/owner — stejné poučení jako BUILD-03A hotfix) přes `.env.verify` (jednorázově zapsaný `bash h2/db/scripts/write-verify-env.sh`, natrvalo ponechaný na disku stejně jako `.env.local` — 600, `.gitignore`, nemazat po každém použití). Vypíše počty `raw_events` podle `channel`/`speaker`, posledních 20 raw events, počty `message_processing_jobs` podle stavu a posledních 20 `identity_audit_events` — vždy jen counts/states/timestamps, nikdy payload. Použít v každém dalším slicu místo psaní ad hoc SQL pokaždé znovu. **Gotcha objevená při prvním použití (2026-09-03):** `raw_events`/`message_processing_jobs` mají FORCE RLS (§4.3) vyžadující `app.owner_id` v session — první verze skriptu ho nenastavovala a tiše vracela 0 řádků bez ohledu na realitu (vypadalo to jako "nic nedorazilo", ve skutečnosti šlo o dotaz, co nic nesměl vidět). Opravený skript nejdřív vyřeší jediného ownera přes `owners` (bez RLS), pak scopuje transakci přes `set_config('app.owner_id', ...)`, přesně jako `withOwnerScope()`.
8. **Preflight kontrola produkčních env proměnných je povinný krok deploy gate — ruční, ne CI.** Chybějící produkční env proměnná je stejná třída chyby jako neaplikovaná migrace (pravidlo 5): lokální běh a CI ji nemůžou odhalit, protože běží proti vlastní sadě proměnných, ne proti produkčnímu Vercelu (BUILD-04 nález 2026-09-03 — chyběly `H2_ENCRYPTION_ACTIVE_KEY_VERSION`/`H2_ENCRYPTION_KEY_V1`, Telegram webhook padal na `500`). CI/GitHub Actions varianta vědomě zamítnuta (Honzík) — čtení produkčních Vercel proměnných by vyžadovalo nový Vercel token jako CI secret, novou únikovou plochu kvůli chybě, co se objeví jednou za slice, ne za commit. Místo toho: `h2/build-governance/required-env.ts` (manifest `requireEnv()` volání napříč kódem, stejný vzor jako `at-ownership.ts`) + `h2/db/scripts/check-required-env.ts` (parsuje `vercel env ls production`/`preview`, porovná JMÉNA proměnných proti manifestu, **nikdy hodnoty**). Spustit před jakoukoli novou externí integrací (Telegram, budoucí Calendar OAuth atd.) a po `vercel env add`. **Trvalé pořadí kroků, nikdy obráceně: env proměnná → deploy → ověření.** Env proměnná přidaná do Vercelu se do už běžící instance nedostane — potřebuje nový build/deployment (BUILD-04 nález: Honzík přidal `H2_ENCRYPTION_KEY_V1` v 07:52, ale poslední redeploy byl z 07:43, takže požadavky dál padaly na `500` až do dalšího redeploye).
9. **Ověřovací skript, který místo chyby vrátí 0, je horší než žádný — musí selhat hlasitě na chybějící/špatný scope, ne tiše prázdný výsledek.** `verify-ingestion.ts` (pravidlo 7) kvůli chybějícímu `app.owner_id` tiše vracel 0 řádků i s daty reálně v DB — RLS na owner-scoped tabulkách nehlásí chybu, jen tiše filtruje na nulu, takže "nemám oprávnění/špatný scope" a "opravdu nic nedorazilo" vypadají v konzoli identicky. To je nebezpečnější než kdyby skript spadl, protože vede k mylnému, sebejistě vyhlížejícímu závěru ("nic nedorazilo") přesně tam, kde to nejvíc bolí — při diagnostice produkčního incidentu. **Trvalé pravidlo: každý ověřovací skript nad RLS-chráněnými daty musí po nastavení scope (`set_config`) OVĚŘIT readbackem, že se scope skutečně nastavil (`current_setting(...)`), a pokud ne, vyhodit chybu, ne pokračovat na dotaz.** `verify-ingestion.ts` teď tenhle readback guard má. **Audit ostatních DB skriptů (`grep -rln "new Client\|new Pool" h2/`, 2026-09-03):** `check-neon-roles.ts` čte jen `pg_roles`/`pg_class`/`pg_tables` (systémové katalogy, RLS se na ně nevztahuje) — bez rizika. `ensure-test-roles.ts` a `migrate-*.ts` běží jako `h2_migrator`/lokální superuser (`bypassrls`) a dělají jen DDL — bez rizika. `verify-ingestion.ts` byl jediný postižený.

## Poznámky k zadání (úpravy patřící do M1)

Tyto dvě úpravy zadání byly rozhodnuty mimo Build Specification v1.0 a patří do M1, ne až do svých původně určených bloků:

1. **Minimální metering před prvním produkčním deploymentem.** Zápis do `usage_ledger` (podle Technical Architecture §28 — purpose, exact `model_id`, token/minute count) a tvrdý měsíční strop **35 USD** musí být hotové a funkční už v rámci M1 deploy gate, ne až v BUILD-27. Zbytek budget logiky (warning 25 USD, pozastavení neurgentních background syntéz při 30 USD, `pricing_catalog`, `projected_monthly_cost` dashboard) zůstává v BUILD-27 beze změny.
2. **EXPERIMENT-0 sběr dat od prvního produkčního dne.** Při M1 deploymentu se založí `docs/h2/EXPERIMENT-0.md` pro sběr: dny spontánního použití, počet vlastních zpráv, kolikrát odpověď pomohla, kolikrát Buddy naštval nebo špatně pochopil, kolikrát Honzík opravoval paměť, kolik proaktivních zásahů ignoroval. Soubor se zakládá až v okamžiku M1 deploymentu, ne dřív.

Obě položky jsou zahrnuty v **M1 deploy gate** checklistu níže.

## M1 deploy gate (Buddy Live)

- [ ] Všechny acceptance testy vlastněné BUILD-01 až BUILD-11 / BUILD-03A jsou zelené.
- [ ] Produkční secrets/config jsou ověřené.
- [ ] Smoke test proběhne na produkci: Telegram text + voice + web.
- [ ] Minimální metering: `usage_ledger` zápisy živé + tvrdý strop 35 USD/měsíc vynucený (viz poznámka č. 1 výše).
- [ ] `docs/h2/EXPERIMENT-0.md` založen (viz poznámka č. 2 výše).
- [ ] Neon h2-runtime a h2-control upgradovány z Free na **Launch** plán, History Retention nastavena na **7 dní** (viz DEC-003 — dnes Free/6h, dočasná odchylka do M1, ne dřív).
- [ ] Roli `h2_migrator` nastaveno heslo a `.env.migrate` přegenerován tak, aby migrace běžely pod ní, ne pod `neondb_owner` (viz DEC-006 — dnes vědomá odchylka, funkčně bezpečná, ale ne princip nejmenších oprávnění).

## BUILD-02 — Neon provisioning (DOKONČENO)

Schema/migrace/RLS/role hotové, otestované proti lokální Postgres 17
(21/21 testů zelených) a mergnuté do `main` (PR #12).

Neon projekty h2-runtime a h2-control založeny (region Frankfurt, Postgres 18,
Free plán/6h retention do M1 — DEC-003; hlavní větev se v obou jmenuje
`production`, ne `main`). Migrace aplikovány na `production` obou projektů,
preview větve založeny až po migracích (`parent = production`, zdědily
hotové schéma i role). Vercel: 8 proměnných (`H2_RUNTIME_DATABASE_URL`,
`H2_JOB_DATABASE_URL`, `H2_BLIND_READER_DATABASE_URL`, `H2_CONTROL_DATABASE_URL`
× production/preview) přidány jako Secret (write-only, nejde stáhnout
`vercel env pull`).

**Ověřeno `h2/db/scripts/check-neon-roles.ts` proti oběma prostředím**
(current_user, `rolbypassrls`, `relrowsecurity`/`relforcerowsecurity` na
`raw_events`, append-only na `h2_control` přes záměrně odmítnutý UPDATE):

| Role | Production | Preview |
|---|---|---|
| h2_runtime | connectedAsExpected ✓, bypassrls false ✓, RLS enabled+forced ✓, 43 tabulek | stejné (ověřeno přes dočasný `/api/h2/db-check`, později nahrazený lokálním skriptem) |
| h2_job | ✓ | ✓ |
| h2_blind_reader | ✓ | ✓ |
| h2_control | connectedAsExpected ✓, bypassrls false ✓, appendOnlyEnforced ✓, 2 tabulky | ✓ |

Cestou se našly a opravily dva reálné bugy (ne teoretické): (1)
`H2_RUNTIME_DATABASE_URL` byla omylem nastavena na výchozí `neondb_owner`
connection string místo role `h2_runtime` — opraveno v obou prostředích;
(2) `write-migrate-env.sh` mělo `echo` na stdout uvnitř funkce zachytávané
přes `$(...)`, což korumpovalo zapsané `.env.migrate` — opraveno (`echo >&2`)
a doplněna validace formátu. Obě opravy jsou v `build/h2-migration-tooling`
(PR #13, zatím nemergnuto — funguje lokálně i bez mergu, čeká na Honzíkovo
GO k mergi jako běžná dokončená tooling práce).

DEC-004: `pg`/`pg-connection-string` hlásí SSL mode deprecation warning
(`sslmode=require`) — zaznamenáno jako riziko pro budoucí pg major upgrade,
neřeší se teď.

## BUILD-03 — Crypto & privacy foundation (AT GREEN)

- `h2/crypto/envelope.ts` — AES-256-GCM encrypt/decrypt, formát `[12B IV][16B auth tag][ciphertext]`, `encryption_key_version` se drží v DB sloupci (už existuje z BUILD-02), ne uvnitř envelope.
- `h2/crypto/keys.ts` — key registry z `H2_ENCRYPTION_KEY_V{n}` (base64, 32 B) + `H2_ENCRYPTION_ACTIVE_KEY_VERSION`, fail-closed přes stejný `requireEnv` vzor jako BUILD-01.
- `h2/crypto/rotation.ts` — resumable batch re-encryption (§24 flow). Idempotentní: každá dávka cílí `WHERE key_version = fromVersion`, takže crash uprostřed neztrácí stav — příští spuštění pokračuje na zbývajících řádcích. Ověřeno proti reálné Postgres (AT-41 mixed v1/v2 čitelnost, AT-42 resumability po simulovaném crashi).
- `h2/crypto/hmac.ts` — HMAC helper pro Deletion Ledger selector/hash chain, samostatný `H2_LEDGER_HMAC_KEY`.
- `h2/privacy/retention.ts` — čisté cutoff funkce podle §31.8 pro kategorie, které H2 sám aktivně maže (voice audio quarantined, provider debug response, platform logs, server-side export). **Scoping poznámka:** samotný plánovač (kdy job spustit) je BUILD-23 (Scheduler, jobs, health) — bez schedulera nedává smysl stavět běžící cron job teď. Tento modul odpovídá na "co je expirované", BUILD-23 na "kdy to spustit".
- Sanitizace logů: crypto modul nic nikam neloguje (žádný `console.log`/`logH2Event` volání v `h2/crypto/*`), takže se spoléhá na už existující kontrakt `h2/logging/logger.ts` z BUILD-01 (typově nemá pole pro payload, runtime guard na délku) — nebylo potřeba nic nového přidávat.

DoD splněn: mixed key-version data čitelná během rotace (AT-41, testováno), žádný plaintext payload nejde do platform logs (crypto modul neloguje vůbec).

**AT ownership CI kontrola (Build Spec §6):** dřív existovala jen jako text v této tabulce, ne jako spustitelný kód. Teď: `h2/build-governance/at-ownership.ts` (strojový zrcadlový obraz matice) + test, který ověří žádnou duplicitu/mezeru v AT-01..AT-72 a že dokončené bloky mají skutečné test pokrytí svých AT. Potvrzeno: AT-41 i AT-42 patří výhradně BUILD-03. Nový `.github/workflows/h2-tests.yml` (dřív žádný CI test běh neexistoval) tuto kontrolu spouští na každém PR do `main` — ověřeno živým GHA během (run 33674346107): **68/68 testů zelených v CI**, vč. DB-závislých testů proti postgres:17 service containeru.

## BUILD-03A — Identity, sessions & recent re-auth (AT GREEN)

- `h2/identity/owner-enrollment.ts` — první přihlášení enrolluje ownera, další přihlášení stejným Google sub projde, jiný sub je odmítnut. "Přesně jeden povolený owner" (§31.1) je vynucený na úrovni web auth enrollmentu, ne jako DB-wide constraint na `owners` — ta tabulka musí zůstat schopná nést víc řádků (testovací fixtures napříč BUILD-02/03 testy na tom stavějí). Race-safe přes `pg_advisory_xact_lock`, testováno souběžným enrollmentem dvou různých účtů (vyhraje přesně jeden).
- `h2/identity/session.ts` — `requireOwnerSession()` a `requireRecentReauth(maxAge=5m)`, přesně ty typed helpery, které Build Spec u BUILD-03A výslovně vyžaduje jako jedinou cestu k ověření identity (AT-64 testováno: re-auth do 5 min projde, po 5 min selže, po obnovení re-auth pokračuje).
- `h2/identity/csrf.ts` — `assertSameOrigin()` pro write/admin endpointy.
- `h2/identity/audit.ts` — `recordIdentityEvent()`, bez tokenů/payloadu (§31.1).
- `h2/db/migrations/0012_identity_reauth.sql` — `owners.recent_reauth_at` + `identity_audit_events` (RLS stejný tvar jako `incidents`), ověřeno proti fresh lokální DB.
- `h2/identity/auth-config.ts` + `auth.ts` (root) + `app/api/auth/[...nextauth]/route.ts` — živá Auth.js (`next-auth@5.0.0-beta.32`, podporuje Next 16) instance. `buildAuthConfig()` je záměrně NEHÁZEJÍCÍ (na rozdíl od zbytku h2/config vzoru) — `NextAuth()` se volá na module scope a `next build`'s route collection modul natahuje i bez requestu; bez H2 env vrátí degradovaný config (prázdné providers), ne pád buildu. Ověřeno: `npm run build` čistě bez jediné H2 proměnné i s reálnými credentials.
- `h2/identity/owner-session.ts` (BUILD-01 placeholder) nahrazen reálnou implementací přes `auth()`.
- **Živě ověřeno end-to-end:** Honzík se lokálně přihlásil přes `http://localhost:3000/api/auth/signin` svým Google účtem. DB po přihlášení: 1 owner s `google_sub`, `recent_reauth_at` nastaveno a v 5min okně, `identity_audit_events` obsahuje přesně 1 `LOGIN_SUCCESS` navázaný na ownera, žádné `LOGIN_REJECTED_UNKNOWN_OWNER`.

DEC-005: incident s `.env.local` (viz DECISIONS.md) — uzavřen Honzíkem bez rotace, nález "no exposure confirmed by owner".

**CI flaky race (nalezeno a opraveno v rámci tohoto slicu):** první dva CI běhy na PR #15 spadly na race condition — role (`h2_migrator` atd.) jsou cluster-wide a paralelně běžící vitest test soubory je zkoušely vytvořit současně na sdíleném CI Postgres, což občas skončilo raw `unique_violation` místo bezpečně odchyceného `duplicate_object`. Opraveno `h2/db/scripts/ensure-test-roles.ts` jako vitest `globalSetup` — založí všech 6 rolí sekvenčně, jednou, PŘED spuštěním libovolného paralelního test souboru, takže k race nemůže dojít. Advisory lock (`pg_advisory_xact_lock`) v migracích zůstal jako druhá vrstva obrany. Ověřeno živě v CI: 24/24 souborů, 90/90 testů.

Vercel env doplněn (production + preview zvlášť): `H2_GOOGLE_CLIENT_ID`, `H2_GOOGLE_CLIENT_SECRET`, `H2_AUTH_SECRET`, `H2_RUNTIME_DATABASE_URL` + zbytek H2 proměnných (14 celkem, ověřeno `vercel env ls`). PR #15 mergnut, produkční deployment proběhl.

### Hotfix po nasazení — produkční `AccessDenied` (PR #17, MERGED)

Po doplnění chybějící `www.` redirect URI v Google Cloud Console (mismatch vyřešen) končilo reálné přihlášení na produkci na `/api/auth/error?error=AccessDenied` — Google souhlas prošel, spadlo to až na vlastním owner allowlistu. Diagnostika (přímé `psql` připojení jako role `h2_runtime`, ne admin) odhalila **tři** reálné produkční mezery, žádná z nich se neprojevila lokálně, protože lokální testy/vývoj se připojují bez explicitní role (OS superuser přes trust auth, bypassuje GRANT i RLS úplně):

1. **Migrace `0011_roles_and_rls.sql` grantla `h2_runtime` na `owners` jen `SELECT`.** Enrollment prvního přihlášení (`INSERT` nového ownera) i `requireRecentReauth` (`UPDATE recent_reauth_at`) pod touto rolí spadly na `permission denied for table owners`. Opraveno `h2/db/migrations/0013_owners_runtime_write_grants.sql` (`grant insert, update on owners to h2_runtime`).
2. **`identity_audit_events` má RLS (0012), ale `signIn` callback nikdy nenastavoval `SET LOCAL app.owner_id`** před zápisem `LOGIN_SUCCESS` eventu s vyplněným `owner_id` → insert pod `h2_runtime` spadl na RLS violation. Opraveno novým `h2/db/with-owner-scope.ts` (transakční `set_config('app.owner_id', ...)` wrapper), `h2/identity/audit.ts` teď přijímá `Pool | PoolClient`, `auth.ts` zapisuje `LOGIN_SUCCESS` přes `withOwnerScope`.
3. **Migrace `0012_identity_reauth.sql` sama nikdy neproběhla na produkci ani na preview větvi** — byla mergnutá a nasazená s PR #15, ale nikdo ji nespustil proti reálnému Neonu (viz nové trvalé pravidlo č. 5 výše). `identity_audit_events` tedy na produkci vůbec neexistovala. Zjištěno až při spouštění hotfix migrace: `_h2_migrations` na produkci ukazoval poslední aplikovanou jako `0011`, `0012` a `0013` se aplikovaly ve stejném běhu (2026-09-02, hotfix).

Nový regresní test `h2/identity/__tests__/production-signin-flow.test.ts` běží celý signIn flow pod skutečnou omezenou rolí `h2_runtime` (ne admin) — přesně tenhle typ testu by všechny tři mezery odchytil před nasazením. CI zelené (test job pass), 93+ testů v repu. Migrace 0012+0013 aplikovány na produkční i preview větev `h2-runtime` (ověřeno přímým dotazem na `_h2_migrations`, ne předpokladem). Honzík živě ověřil reálné přihlášení na `good-inventions.work` — funkční.

DEC-006 (zaznamenáno při hotfixu): `.env.migrate` obsahuje connection stringy role `neondb_owner`, ne `h2_migrator` — role `h2_migrator` ze schématu existuje, ale nikdy jí nebylo nastaveno heslo, takže migrace reálně běží přes owner účet. Vědomá odchylka, remedy odložen do M1 deploy gate (viz [DECISIONS.md](./DECISIONS.md) a checklist níže).

## BUILD-04 — Unified ingestion (AT GREEN — MERGED, DEPLOYED)

- `h2/ingestion/ingest-message.ts` — `ingestMessage()`: jediná doménová funkce, kterou volají Telegram i web (AT-48). Owner-scoped transakce (`withOwnerScope`, stejný RLS vzor jako BUILD-03A hotfix), advisory lock per owner kolem alokace `conversation_sequence`/`input_sequence` (§5), dedup podle `(owner_id, channel, external_event_id)` (AT-02), `message_processing_job` vzniká výhradně pro `speaker=USER` (AT-61).
- `h2/ingestion/telegram-auth.ts` — Telegram identity boundary (§31.1): **allowlist** jednoho `telegram_user_id` z `H2_TELEGRAM_OWNER_USER_ID` (ne first-contact enrollment jako u Google — Telegram update samo o sobě nedokazuje identitu) + `timingSafeEqual` ověření `X-Telegram-Bot-Api-Secret-Token` proti `H2_TELEGRAM_WEBHOOK_SECRET`. `resolveEnrolledOwnerId()` připojuje Telegram na existujícího (Google-enrollnutého) ownera, nikdy nevytváří nový owner řádek.
- `app/api/h2/telegram/webhook/route.ts` — cesta přesně podle Technical Architecture v1.2 §3. Failure model (§27): neplatný/chybějící webhook secret → 401 (request není prokazatelně od Telegramu, žádný retry loop nehrozí); cizí `telegram_user_id` → **200** (Honzíkova korekce — Telegram by na ne-200 opakoval doručení donekonečna), payload se neuloží, `TELEGRAM_MESSAGE_REJECTED_UNKNOWN_SENDER` audit event bez obsahu (nový migrace 0014). Update bez `text` (voice/photo/…) → 200 no-op, mimo scope tohoto slicu (voice ingest je BUILD-06).
- `app/api/h2/web/messages/route.ts` — cesta přesně podle §3. Auth `requireOwnerSession()` + `assertSameOrigin()` (BUILD-03A write-endpoint kontrakt), `clientMessageId` (UUID) jako web ekvivalent Telegram `update_id` pro idempotenci.
- `h2/db/migrations/0014_telegram_rejected_audit_event.sql` — rozšiřuje `identity_audit_events_event_type_check` o `TELEGRAM_MESSAGE_REJECTED_UNKNOWN_SENDER`, aditivní. **Aplikováno a ověřeno na production i preview h2-runtime** (přímý dotaz na `_h2_migrations` + `pg_get_constraintdef`, viz evidence blok nahoře), přes migrátorskou roli `neondb_owner` (DEC-006 odchylka, ne `h2_migrator`).
- `h2/config/capabilities.ts` — `telegramIngest` a `webBuddyChat` feature flags přepnuty na `true` (AT GREEN); `telegramVoice` zůstává `false` (BUILD-06).
- Bonusová oprava (stejná třída jako CI race z BUILD-03A): `h2/db/scripts/ensure-test-roles.ts` teď nastavuje LOGIN password pro `h2_runtime`/`h2_job`/`h2_blind_reader`/`h2_control` přesně jednou v globalSetup místo v každém test souboru zvlášť — s víc test soubory běžícími paralelně (přidanými touto slicí) `ALTER ROLE ... PASSWORD` na sdílené cluster-wide roli spadalo na `tuple concurrently updated`. Opraveno i pro existující `rls.test.ts`, `control.test.ts`, `production-signin-flow.test.ts`.

**Ověřeno:** 68/68 nových testů (`ingest-message.test.ts`, `telegram-auth.test.ts`, oba route testy — přímé volání handleru, ne tunel/reálný Telegram), 114/114 testů v celém repu, `npx tsc --noEmit` čistě, `npm run build` čistě (obě nové routy se objevují jako `ƒ` dynamic, žádný dopad na existující statické stránky).

**Vstupy od Honzíka (přijato):** `H2_TELEGRAM_OWNER_USER_ID=6034875251` (allowlist), setWebhook registrace + reálný `H2_TELEGRAM_BOT_TOKEN` a `H2_TELEGRAM_WEBHOOK_SECRET` provádí Honzík sám z prohlížeče (DEC-005 — secret se nesmí objevit v session transcriptu; kód BUILD-04 `H2_TELEGRAM_BOT_TOKEN` vůbec nečte, odchozí Telegram volání jsou BUILD-11).

**Uzavření slicu:**
1. ~~přidat `H2_TELEGRAM_WEBHOOK_SECRET` + `H2_TELEGRAM_OWNER_USER_ID` do Vercelu (production + preview)~~ — HOTOVO (Honzík),
2. ~~aplikovat migraci 0014 na production i preview `h2-runtime` a ověřit přímým dotazem na `_h2_migrations`~~ — HOTOVO, viz evidence blok nahoře,
3. ~~merge branch `build/h2-build-04-unified-ingestion` (PR #18) do `main`~~ — HOTOVO, merge commit `76a7d40`,
4. ~~potvrdit produkční Vercel deploy po mergi~~ — HOTOVO, `dpl_Bwqy4G3jPyiJ99ziTDmcehA7i8AE` READY, `/api/h2/health` živě ověřen,
5. ~~Honzíkovo `setWebhook` proti Telegram API reálným tokenem~~ — HOTOVO, ale viz smoke test níže.

### Post-deploy smoke test (2026-09-03) — tři reálné nálezy, kód beze změny

1. **Apex `307` redirect na `www.` — Telegram request nikdy nedorazil.** Honzík zaregistroval `setWebhook` na `https://good-inventions.work/api/h2/telegram/webhook`; Vercel runtime logy (production, 24h okno) ukázaly nulu requestů na tuto cestu, DB (`h2_runtime`, `verify-ingestion.ts`) potvrdila 0 raw_events/jobs. Diagnostikováno postupně (Vercel logy → DB → `getWebhookInfo`): apex redirectuje 307 na `www.`, Telegram redirect nenásleduje. Opraveno přeregistrací webhooku na `www.` variantu (Honzík) — **operační krok, ne kód.** Zapsáno jako trvalé pravidlo č. 6 výše.
2. **`H2_TELEGRAM_WEBHOOK_SECRET` mismatch.** Po opravě URL dorazilo 9 requestů, všech 9 s HTTP 401 `TELEGRAM_SECRET_MISMATCH` (Vercel runtime logy) — kód se choval přesně podle návrhu (odmítl, nic nezapsal do DB, žádný audit event, protože request není prokazatelně od Telegramu). Root cause: hodnota secretu ve Vercelu produkci nesedí s `secret_token` použitým v `setWebhook`. Náprava: Honzík vygeneroval nový secret, přepsal ho ve Vercelu (production i preview), zavolal `setWebhook` znovu — vyřešeno.
3. **Chybějící `H2_ENCRYPTION_ACTIVE_KEY_VERSION`/`H2_ENCRYPTION_KEY_V1` ve Vercelu (obě prostředí) → `500`.** Po opravě secretu dorazilo 9 requestů, všech s HTTP 500 `H2_CONFIG_INVALID` (Vercel runtime logy) — `loadEncryptionKeyRegistry()` (BUILD-03) nikdy neměla ve Vercelu svoje proměnné, mezera latentní od BUILD-03, neprojevila se dřív, protože BUILD-04 je první živá cesta, co crypto modul v produkci skutečně volá. Diagnostikováno křížovou kontrolou kódu (`requireEnv()` volání na cestě webhooku) proti `vercel env ls` — ne odhadem. Honzík proměnné doplnil, ale **první redeploy proběhl PŘED přidáním proměnných** (env přidán 07:52, běžící deployment z 07:43) → requesty dál padaly na 500 až do druhého redeploye. Vyřešeno, živě ověřeno: 2 raw_events (`telegram/USER`, 07:55:50–51Z), 2 `message_processing_jobs` `PENDING`, 0 rejected-sender audit eventů. Zapsáno jako trvalé pravidlo č. 8 výše (preflight nástroj) + pravidlo o pořadí env→deploy→ověření.

Žádný z nálezů nevyžadoval změnu kódu BUILD-04 — všechny příčiny jsou mimo repo (DNS/redirect topologie, Vercel secret konfigurace, chybějící env proměnné). Vedlejším produktem bylo i odhalení a oprava bugu v samotném `verify-ingestion.ts` (chybějící `app.owner_id` scope, viz pravidlo 7) a vznik `h2/build-governance/required-env.ts` + `h2/db/scripts/check-required-env.ts` jako preflight nástroje pro příští slicey.

## BUILD-05 — Queue, lease, fencing, quarantine (AT GREEN — MERGED, DEPLOYED)

Plán schválen Honzíkem 2026-09-03, zapsán beze změny v [docs/h2/BUILD-05-PLAN.md](./BUILD-05-PLAN.md). Nízkoúrovňový mechanismus zpracování fronty nad už existujícím schématem BUILD-02 (`0002_messaging.sql`) — žádná nová migrace, žádné nové env proměnné, žádný produkční trigger (viz plán, Rozhodnutí 2 — `after()`/scheduler zapojení patří až BUILD-10/BUILD-23, aby produkce netvořila placeholder responses dřív, než je co reálně spouštět).

- `h2/processing/lease.ts` — `claimNextJob(pool, ownerId, processorId?)`: nejnižší dostupná processable sequence mezi joby ve stavu PENDING/PROCESSING/RETRY_PENDING (§4.3) — QUARANTINED a RESPONSE_READY/DELIVERED jsou "settled", neblokují. Owner-scoped transakce zamyká `owner_processing_state` řádek (`for update`), což samo serializuje konkurentní claimy pro stejného ownera — žádný samostatný advisory lock. Reap větev: vypršelý lease aktivního jobu se buď okamžitě reklamuje jako nový pokus bez backoff (vypršení leasu samo je ta čekací doba — AT-07), nebo jde do karantény, pokud jsou vyčerpané pokusy/deadline, a claim pokračuje na dalším jobu v pořadí (AT-54). `renewLease()` — fencing-chráněný heartbeat pro dlouho běžící pokus.
- `h2/processing/commit.ts` — `commitJobResult(pool, registry, token, work)`: `work` je injektovaná funkce (BUILD-05 negeneruje skutečnou Buddy odpověď, to je BUILD-07/10) — jen bezpečně commitne, co `work` vrátí, přesně jednou. Fencing NENÍ "přečti epoch, pak zapiš" (TOCTOU) — je to jedna atomická `UPDATE ... WHERE` s epoch podmínkou (lease_epoch I owner_control_epoch zároveň) přímo v SQL. `responses.source_raw_event_id` UNIQUE je druhá vrstva obrany na DB úrovni.
- `h2/processing/quarantine.ts` — `recordJobFailure()` (explicitní nahlášené selhání, backoff 5s→15s→30s před dalším pokusem) a `quarantineJob()` (terminální přechod, exactly-once incident + `quarantine_notice_sent_at` marker přes vlastní atomický `WHERE ... IS NULL` guard). Max 3 pokusy, text deadline 120s / voice deadline 300s od prvního pokusu.
- `h2/processing/control-epoch.ts` — `bumpOwnerControlEpoch()`: primitiv pro budoucí explicitní PAUSE/STOP command (BUILD-12), bez nutnosti stavět skutečný command parser teď.
- `h2/processing/errors.ts` — `H2FencingError`, `H2QueueError`. Neaktuální fencing token vždy exception, nikdy tichý no-op úspěch.

**Testy pod skutečnou rolí `h2_runtime`** (stejný vzor jako BUILD-04 `ingest-message.test.ts`), 6 nových testů:
- `h2/processing/__tests__/lease.test.ts` — AT-06 (pořadí + blocking), AT-03/AT-07 (crash po ACK, lease vyprší, recovery claim+commit uspěje, přesně jedna response).
- `h2/processing/__tests__/commit.test.ts` — AT-67 (dva skuteční souběžní klienti přes `Promise.all`, jen aktuální epoch commitne), AT-71 (`bumpOwnerControlEpoch()` invaliduje rozpracovaný token stejně jako lease_epoch).
- `h2/processing/__tests__/quarantine.test.ts` — AT-54 (3 selhané pokusy → QUARANTINED, přesně 1 incident + 1 notice, karanténní mezera neblokuje další job v pořadí; plus samostatný race test na souběžný dvojí pokus o karanténu stejného jobu).

**Ověřeno:** 6/6 nových testů zelených, 120/120 testů v celém repu (32 souborů), `npx tsc --noEmit` čistě, `npm run build` čistě (žádné nové routy — BUILD-05 nemá HTTP povrch).

**Uzavření slicu:**
1. ~~implementace + testy podle schváleného plánu~~ — HOTOVO, viz evidence blok nahoře,
2. ~~push branche, otevřít PR~~ — HOTOVO, [PR #20](https://github.com/honzabindr-max/muj-web/pull/20) (Honzíkovo GO na tenhle krok bylo dané předem),
3. ~~zelené GHA na PR #20~~ — HOTOVO, run 33734216901 + 33734400228 pass,
4. ~~Honzíkovo GO k mergi do `main`~~ — HOTOVO, merge commit `c802edd`,
5. ~~potvrdit produkční Vercel deploy po mergi~~ — HOTOVO, `dpl_23RojA1yQwwXym1e9rbsi5RUAi4y` READY, `/api/h2/health` živě ověřen,
6. ~~preflight `check-required-env.ts` proti production i preview~~ — HOTOVO, jediný nález (`H2_LEDGER_HMAC_KEY`) je už z BUILD-04 známý a mimo scope BUILD-05.

## BUILD-06 — Voice transcription (AT GREEN — MERGED, DEPLOYED)

Plán schválen Honzíkem 2026-09-03, doplněn na jeho výslovný požadavek o
Rozhodnutí 4 (metering), 5 (šifrování) a 6 (Whisper failure handling) —
[docs/h2/BUILD-06-PLAN.md](./BUILD-06-PLAN.md). Žádná nová migrace,
žádný produkční trigger (stejná logika jako BUILD-05 Rozhodnutí 2).

- `h2/voice/reference-handle.ts` — malý JSON (`telegramFileId`,
  `durationSeconds`) zašifrovaný stejným envelope jako každý payload;
  ingest (BUILD-04 `ingestMessage()`, beze změny) ho zapíše jako
  `raw_events.payload_ciphertext` s `payload_type='VOICE'`.
- `h2/voice/telegram-download.ts`, `h2/voice/transcribe.ts` — tenké
  adaptéry na `fetch` (Telegram `getFile`+download, OpenAI Whisper
  `whisper-1`), `AbortController` timeout 45s na obojí. Testováno
  mockovaným `fetch`, žádné reálné volání v CI (Rozhodnutí 3).
  `h2/voice/config.ts` — fail-closed `requireEnv({H2_TELEGRAM_BOT_TOKEN,
  H2_OPENAI_API_KEY})`.
  `h2/voice/errors.ts` — `H2VoiceDownloadError`, `H2VoiceTranscriptionError`.
- `h2/voice/commit-transcript.ts` — `commitVoiceTranscript()`: JEDNA
  fencing-chráněná transakce, která zároveň (a) přepíše
  `raw_events.payload_ciphertext`/`encryption_key_version` in-place
  reference handle → transcript (Rozhodnutí 1/5, `UPDATE` je z podstaty
  idempotentní, žádný nový sloupec/migrace) a (b) zapíše `usage_ledger`
  řádek (`h2/voice/usage.ts` — `purpose='voice_transcription'`,
  `model_id='whisper-1'`, `unit='minutes'`, `quantity` z Telegramem
  nahlášeného `voice.duration`, `cost_usd` z referenční sazby
  `$0.006/min`) — atomicky, buď oba zápisy, nebo žádný (Rozhodnutí 4).
- `h2/voice/process-voice-job.ts` — `transcribeVoiceJob()`: decrypt
  reference handle → download → transcribe → `commitVoiceTranscript()`.
  **Nevolá `commitJobResult()`** (žádná placeholder response, stejný
  důvod jako BUILD-05 Rozhodnutí 2) — volající to dělá odděleně se svým
  vlastním `work`, přesně jako BUILD-05 AT-03 test. `download`/`transcribe`
  throwlé chyby se nepolykají — jdou přes BUILD-05
  `recordJobFailure()`/`claimNextJob()` retry/backoff/karanténu beze
  změny (Rozhodnutí 6); jediný rozdíl je existující
  `deadlineSecondsFor('VOICE') = 300s`.
- `app/api/h2/telegram/webhook/route.ts` — nová větev pro `message.voice`
  (za feature flagem `telegramVoice`, teď `true`): ingestuje reference
  handle, **nevolá** download/transcribe synchronně (route modul je
  neimportuje vůbec) — ACK je čistě po `ingestMessage()` commitu, žádné
  síťové volání ve webhook requestu (AT-04 "okamžitý ACK"). Existující
  TEXT větev beze změny.
- `h2/config/capabilities.ts` — `telegramVoice: false → true`.
- `h2/build-governance/required-env.ts` — `H2_TELEGRAM_BOT_TOKEN`,
  `H2_OPENAI_API_KEY` (fail-closed, ale nic v produkci je zatím
  automaticky nepoužije — žádný trigger).

**Testy pod skutečnou rolí `h2_runtime`**, 14 nových:
- `h2/voice/__tests__/process-voice-job.test.ts` — AT-04 (300s deadline
  potvrzen, transcript in-place, přesně 1 response + 1 usage_ledger
  řádek), AT-05 (timeoutlý Whisper → retry bez druhého raw_eventu, jen 1
  usage_ledger řádek — selhaný pokus usage nezapíše), voice deadline 300s
  s jedním retry bez karantény, metering atomicita (fencing selže →
  nula usage_ledger řádků, transcript se nezapíše).
- `h2/voice/__tests__/telegram-download.test.ts`,
  `h2/voice/__tests__/transcribe.test.ts` — mockovaný `fetch`: happy
  path, non-200/429/500, timeout.
- `app/api/h2/telegram/webhook/__tests__/route.voice.test.ts` — AT-04
  ingest větev (okamžitý ACK, reference handle v DB), duplicitní
  update_id.
- Upraven existující `route.test.ts` (voice už není no-op — nahrazeno
  `photo` jako příklad nepodporovaného typu).

**Ověřeno:** 14/14 nových testů zelených, 134/134 testů v celém repu
(36 souborů), `npx tsc --noEmit` čistě, `npm run build` čistě (žádné
nové routy).

**Co zůstává mimo scope (vědomě, viz plán):** skutečná Buddy odpověď
(BUILD-10), automatické produkční spuštění (`after()`/scheduler,
Rozhodnutí 2), enforcement 35 USD/měsíc stropu (M1 gate/BUILD-27 —
BUILD-06 jen zapisuje spotřebu), `pricing_catalog` lookup (BUILD-27),
jakýkoli storage pro audio (audio se nikdy nepersistuje).

**Uzavření slicu:**
1. ~~implementace + testy podle schváleného plánu~~ — HOTOVO, viz evidence blok nahoře,
2. ~~push branche, otevřít PR~~ — HOTOVO, [PR #22](https://github.com/honzabindr-max/muj-web/pull/22),
3. ~~zelené GHA na PR~~ — HOTOVO, run 33737639151 pass,
4. ~~Honzíkovo GO k mergi do `main`~~ — HOTOVO, merge commit `d61860e`,
5. ~~potvrdit produkční Vercel deploy po mergi~~ — HOTOVO, `dpl_ChYNSo3bcfbL5pCwppZMHDHDx7PL` READY, `/api/h2/health` živě ověřen,
6. ~~preflight `check-required-env.ts` proti production i preview~~ — HOTOVO, nález přesně podle očekávání: `H2_OPENAI_API_KEY` chybí (nový), `H2_TELEGRAM_BOT_TOKEN` **už ve Vercelu je** (Honzík ho tam dal dřív, kód ho do teď nečetl), `H2_LEDGER_HMAC_KEY` starý známý nález (BUILD-20). Nic z toho neblokuje — žádný trigger volání nespouští,
7. ruční end-to-end verifikace (reálný Telegram download + reálný Whisper call) — ČEKÁ na `H2_OPENAI_API_KEY` od Honzíka, vyžádám si ho zvlášť až budu chtít verifikaci dělat.

## BUILD-07 — Prompt Registry & model adapter (AT GREEN — MERGED, DEPLOYED)

Plán schválen Honzíkem 2026-09-03, doplněn na jeho výslovný požadavek o
Rozhodnutí 3 (Anthropic metering od prvního dne) a Rozhodnutí 7 (strojová
governance kontrola) — [docs/h2/BUILD-07-PLAN.md](./BUILD-07-PLAN.md).
Schéma (`prompt_versions`, `prompt_test_runs`, `llm_runs`) je celé z
BUILD-02, jediná nová migrace jsou GRANTy.

- `h2/db/migrations/0015_prompt_registry_runtime_grants.sql` — `h2_runtime`
  dostává `select, insert, update` na `prompt_versions` a `select, insert`
  na `prompt_test_runs` (dřív jen SELECT). Aktivace (`status='ACTIVE'`)
  zůstává výhradně přes `h2/prompts/activation.ts`, ne DB trigger — přesně
  podle poznámky v `0003_prompts_and_llm.sql`.
- `h2/prompts/anthropic-adapter.ts` — `callAnthropicModel()`: syrový
  `fetch` na Anthropic Messages API, `AbortController` timeout 60s, žádná
  `@anthropic-ai/sdk` závislost. `h2/prompts/config.ts` — fail-closed
  `requireEnv({H2_ANTHROPIC_API_KEY})`. `h2/prompts/errors.ts` —
  `H2PromptActivationError`, `H2AnthropicCallError`.
- `h2/prompts/registry.ts` — `createDraftPromptVersion()`,
  `getActivePromptVersion()`.
- `h2/prompts/fixtures.ts` — `runPromptFixtureSuite()`: běží fixtury
  (happy-path/malformed-input/adversarial-context/schema-validation)
  proti injektovanému `callModel`, zapisuje `llm_runs` + Anthropic usage
  **za každý fixture, co se skutečně zavolal** (i když later selže
  validace — zavolalo se, zaplatilo se), pak jeden `prompt_test_runs`
  souhrn (`PASS`/`FAIL`).
- `h2/prompts/activation.ts` — **jediná** funkce v repu, co smí nastavit
  `status='ACTIVE'`: `activatePromptVersion()` (recent re-auth →
  passing test run pro přesnou kombinaci verze/model/schema/fixture-set →
  atomicky retire staré ACTIVE + aktivuje nové) a `rollbackPromptVersion()`
  (AT-35 — re-aktivace přesné starší verze, žádná editace historie).
- `h2/prompts/llm-run.ts` — `recordLlmRun()`: `llm_runs` provenance
  (AT-36 — model/prompt/schema/input manifest).
- `h2/prompts/usage.ts` — `recordAnthropicUsage()`: **dva** `usage_ledger`
  řádky na volání (`tokens_input`/`tokens_output`, různá cena — Sonnet
  `$2`/`$10` za MTok, Haiku `$1`/`$5`, referenční sazby z architektury
  §28), atomicky se stejnou transakcí jako `recordLlmRun()`. Metering od
  prvního dne (Honzíkův požadavek), enforcement 35 USD/měsíc stropu
  zůstává odloženo do M1 gate/BUILD-27 stejně jako u BUILD-06.
- `h2/prompts/model-drift.ts` — `checkModelDrift()` (AT-63): porovná
  pinned `H2_MODELS` s poslední certifikovanou kombinací; pro Whisper
  (bez promptu) porovnává proti poslednímu `llm_runs.model_id`. Čistá
  funkce, bez zapojení do live health endpointu (BUILD-23).
- **Retrofit BUILD-06:** `h2/voice/commit-transcript.ts` teď zapisuje i
  `llm_runs` řádek pro Whisper (`purpose='voice_transcription'`), atomicky
  se stávající `usage_ledger`/`raw_events` transakcí — sjednocuje
  provenance napříč providery.
- `h2/build-governance/__tests__/prompt-activation-single-writer.test.ts`
  — strojová kontrola (Rozhodnutí 7): projde `h2/`/`app/` a ověří, že
  vzor "UPDATE/INSERT na `prompt_versions` nastavující `'ACTIVE'`"
  existuje jen v `h2/prompts/activation.ts`. Regresní fixture dokazuje,
  že regex skutečně něco chytí (ne jen vždycky projde).
- `h2/build-governance/required-env.ts` — `H2_ANTHROPIC_API_KEY`
  (fail-closed).

**Testy pod skutečnou rolí `h2_runtime`**, 20 nových:
- `h2/prompts/__tests__/registry-activation.test.ts` — AT-33 (DRAFT bez
  passing run → odmítnuto), AT-34 (invalid output → FAIL, activation
  blocked, ale usage/llm_runs se přesto zapsaly), AT-36 (provenance),
  AT-35 (rollback vrací přesnou verzi), AT-63 (model drift + activation
  blocked na necertifikovaný model_id).
- `h2/prompts/__tests__/anthropic-adapter.test.ts` — mockovaný `fetch`.
- `h2/build-governance/__tests__/prompt-activation-single-writer.test.ts`
  — governance kontrola + regresní fixture + false-positive test (TS
  union typ, testovací assert).
- Rozšířeny `h2/voice/__tests__/process-voice-job.test.ts` testy o
  `llm_runs` assert (retrofit) a atomicity assert (fencing selže → nula
  `llm_runs` řádků taky).

**Ověřeno:** 20/20 nových testů zelených, 146/146 testů v celém repu
(39 souborů), `npx tsc --noEmit` čistě, `npm run build` čistě.

**Škrt oproti návrhu:** `h2/prompts/schemas/*.ts` (zod schémata per
purpose) se nestavěly jako samostatné soubory — žádný reálný purpose
ještě nemá definovaný obsah (BUILD-08/10/14), fingované schéma by se
stejně muselo předělat. Typy (`ValidateOutputFn`/`CallModelFn`) žijí v
`h2/prompts/fixtures.ts`, konkrétní validátor si dodá volající (test/
budoucí slice).

**Co zůstává mimo scope (vědomě, viz plán):** skutečná Buddy konverzace
(BUILD-10), operational/blind extraction obsahová logika (BUILD-08/14),
model drift health endpoint (BUILD-23), skutečná certifikace promptu
proti reálnému Sonnetu/Haiku (ruční krok, credentials zvlášť), admin/web
UI pro aktivaci/rollback (BUILD-26).

**Uzavření slicu:**
1. ~~implementace + testy podle schváleného plánu~~ — HOTOVO, viz evidence blok nahoře,
2. ~~push branche, otevřít PR~~ — HOTOVO, [PR #24](https://github.com/honzabindr-max/muj-web/pull/24),
3. ~~zelené GHA na PR~~ — HOTOVO, run 33740125492 pass,
4. ~~aplikovat migraci 0015 na production i preview a ověřit přímým dotazem na `_h2_migrations`~~ — HOTOVO, PŘED mergem (preview `09:43:36.503Z`, production `09:47:54.953Z`),
5. ~~Honzíkovo GO k mergi do `main`~~ — HOTOVO, merge commit `dbec556`,
6. ~~potvrdit produkční Vercel deploy po mergi~~ — HOTOVO, `dpl_GajgTX5d47SdpewC7mTwFNSxoMEG` READY, `/api/h2/health` živě ověřen,
7. ~~preflight `check-required-env.ts` proti production i preview~~ — HOTOVO, nález přesně podle očekávání: `H2_ANTHROPIC_API_KEY` nově chybí, vedle už známých `H2_OPENAI_API_KEY`/`H2_LEDGER_HMAC_KEY` — nic z toho neblokuje,
8. ruční certifikace prvního promptu proti reálnému Sonnetu/Haiku — ČEKÁ na `H2_ANTHROPIC_API_KEY` od Honzíka, vyžádám si ho jako explicitní STOP, až na něj dojde.

## BUILD-08 — Operational extraction (AT GREEN — MERGED, DEPLOYED)

Plán schválen Honzíkem 2026-09-03, doplněn na jeho výslovný požadavek o
Rozhodnutí 5 (vlastní `model_id`/`purpose` pro Haiku metering) —
[docs/h2/BUILD-08-PLAN.md](./BUILD-08-PLAN.md). Skoro celá infrastruktura
je hotová z BUILD-07 (`callAnthropicModel()`, `recordLlmRun()`,
`recordAnthropicUsage()`, `getActivePromptVersion()`) — BUILD-08 ji jen
použije s Haiku modelem, žádná nová migrace (`operational_extractions` už
má plný CRUD+RLS grant pro `h2_runtime` z BUILD-02).

- `h2/extraction/operational-schema.ts` — zod `OperationalExtractionOutputSchema`
  (Rozhodnutí 1): obecný kandidátní kontejner (`candidates: Array<{type,
  payload, confidence?}>`), ne finální CRUD objekty — hluboká validace
  `payload` je BUILD-12's rozhodnutí.
- `h2/extraction/operational-extraction.ts` — `extractOperationalCandidates(pool,
  ownerId, rawEventId, messageText, credentials, callModel?)`:
  `getActivePromptVersion(pool, 'OPERATIONAL_EXTRACTION')` (chybějící
  ACTIVE verze → `H2ExtractionError`, ne tichý no-op) → `callModel`
  (injektovatelný, stejný vzor jako BUILD-06/07, default `callAnthropicModel`)
  s `maxOutputTokens=2048` (Rozhodnutí 4) → zod validace → JEDNA transakce
  (`withOwnerScope`): `recordLlmRun()` + `recordAnthropicUsage()` +
  `insert operational_extractions` (`status` OK/INVALID) — atomicky,
  zavolalo se/zaplatilo se i při INVALID (stejná disciplína jako BUILD-07
  AT-34). `status='REJECTED'` zůstává ve schématu nepoužité, rezervované
  pro budoucí business-rule odmítnutí (Rozhodnutí 2).
- `h2/prompts/anthropic-adapter.ts` — `callAnthropicModel()` rozšířen o
  volitelný pátý parametr `maxOutputTokens` (default `4096`, beze změny
  chování pro existující Sonnet volání z BUILD-07).
- `h2/extraction/errors.ts` — `H2ExtractionError` (`NO_ACTIVE_PROMPT_VERSION`).
- Metering rozlišitelnost (Rozhodnutí 5): `model_id` vždy `H2_MODELS.extraction`
  (`claude-haiku-4-5-20251001`), `purpose` vždy `'OPERATIONAL_EXTRACTION'`
  — nikdy nesplyne se `'BUDDY_RESPONSE'` ani `'voice_transcription'` v
  `usage_ledger`/`llm_runs`. `PURPOSE_TO_MODEL_PURPOSE` mapping pro
  `checkModelDrift()` (`h2/prompts/model-drift.ts`) byl už zapsán v
  BUILD-07 — BUILD-08 na něm nic nemění, jen ho poprvé skutečně použije.
- Žádný produkční trigger (Rozhodnutí 3, stejné jako BUILD-05/06/07) —
  `extractOperationalCandidates()` je volatelná přímo (testy, budoucí
  ruční skript), zapojení do live message-processing cesty je BUILD-10.

**Testy pod skutečnou rolí `h2_runtime`**, 5 nových:
- `h2/extraction/__tests__/operational-extraction.test.ts` — žádná
  ACTIVE verze → `H2ExtractionError`; happy path (status OK, `output`
  odpovídá vstupu, `llm_runs` + 2 `usage_ledger` řádky, metering
  rozlišitelnost od Sonnetu — `model_id`/`purpose` přesně Haiku, cena
  Haiku sazbě `$1`/`$5` za MTok, ne Sonnetově `$2`/`$10`); malformed
  output (status INVALID, ale `llm_runs`/`usage_ledger` se přesto
  zapsaly, a **žádný** nový řádek v `tasks`/`commitments`/`open_loops`/
  `reminders` — DoD).
- Rozšířen `h2/prompts/__tests__/anthropic-adapter.test.ts` o 2 testy:
  `maxOutputTokens` parametr se propíše do `max_tokens` v request body;
  bez parametru zůstává default `4096`.

**Ověřeno:** 5/5 nových testů zelených, 151/151 testů v celém repu (40
souborů), `npx tsc --noEmit` čistě, `npm run build` čistě (žádné nové
routy — BUILD-08 nemá HTTP povrch).

**Co zůstává mimo scope (vědomě, viz plán):** skutečné vytváření/aktualizace
`tasks`/`commitments`/`open_loops`/`reminders`/`projects` z kandidátů
(BUILD-12), zapojení do live message-processing/Buddy runtime cesty
(BUILD-10), input-side token budget/context assembly (BUILD-09), business-rule
`REJECTED` odmítnutí (nespecifikováno, rezervováno beze změny), ruční
certifikace `OPERATIONAL_EXTRACTION` promptu proti reálnému Haiku — stejná
otevřená položka jako BUILD-07, ne nová.

**Uzavření slicu:**
1. ~~implementace + testy podle schváleného plánu~~ — HOTOVO, viz evidence blok nahoře,
2. ~~push branche, otevřít PR~~ — HOTOVO, [PR #26](https://github.com/honzabindr-max/muj-web/pull/26),
3. ~~zelené GHA na PR~~ — HOTOVO, run 33742774536 (h2-tests) pass,
4. ~~Honzíkovo GO k mergi do `main`~~ — HOTOVO, merge commit `417c789`,
5. ~~potvrdit produkční Vercel deploy po mergi~~ — HOTOVO, `dpl_C9RFhCDSpueSnCsw68EDrbs6inrL` READY, `/api/h2/health` živě ověřen,
6. ~~preflight `check-required-env.ts` proti production i preview~~ — HOTOVO, nález přesně podle očekávání: žádná nová proměnná, jen 3 už známé (`H2_LEDGER_HMAC_KEY` BUILD-20, `H2_OPENAI_API_KEY` BUILD-06, `H2_ANTHROPIC_API_KEY` BUILD-07) — nic z toho neblokuje, žádný trigger volání nespouští.

## BUILD-09 — Context Engine (IN PROGRESS — Krok 1/4 MERGED, DEPLOYED)

Plán schválen Honzíkem 2026-09-03 vč. Rozhodnutí 1–4 —
[docs/h2/BUILD-09-PLAN.md](./BUILD-09-PLAN.md). Rozčleněno do 4
samostatných branch/PR/merge kroků pod jedním BUILD-09 (AT ownership
matice se nemění) — žádný krok nemá produkční trigger, main tedy nikdy
není v nekonzistentním mezistavu mezi merge.

### Krok 1 — Token Budget Contract + context_run persistence (MERGED, DEPLOYED)

- `h2/context/token-budget.ts` — `CONTEXT_TOKEN_BUDGETS` (7 purposes,
  §7.4 tabulka), `estimateTokens()` konzervativní heuristika.
- `h2/context/priority.ts` — `ContextPriority`/`ContextCandidateItem`
  typy, `sumTokens()`, `currentMessageItem()` (P0 reprezentace aktuální
  zprávy, `item_type='CURRENT_MESSAGE'`, `item_id=raw_events.id`).
- `h2/context/budget-fit.ts` — `fitToBudget()`: P0 se nikdy neodřízne
  (P0-overflow → `H2ContextBudgetError('P0_EXCEEDS_BUDGET')`, Rozhodnutí
  2), jinak deterministicky odřezává P4→P1.
- `h2/context/persist-context-run.ts` — `persistContextRun()`: jedna
  owner-scoped transakce, `context_runs` + `context_run_items` (included
  i omitted položky, auditovatelný `omission_reason`).
- **Retrofit BUILD-08 Rozhodnutí 4 debt:** `extractOperationalCandidates()`
  teď kontroluje `estimateTokens(messageText)` proti
  `CONTEXT_TOKEN_BUDGETS.OPERATIONAL_EXTRACTION.maxInputTokens` (8000)
  **před** voláním Haiku — overflow je stejná hlasitá `H2ContextBudgetError`,
  žádné volání/zápis do `llm_runs`/`usage_ledger`/`operational_extractions`.

**Odpověď na Honzíkovu otázku (retry/karanténa u P0-overflow):**
`H2ContextBudgetError` dnes nikam neteče (BUILD-09 nevolá
`claimNextJob()`/`recordJobFailure()` — zapojení je BUILD-10). Až se
zapojí, poteče stejnou uniformní BUILD-05 retry/backoff/karanténou jako
každá jiná chyba (BUILD-06 Rozhodnutí 6 — žádná retryable/non-retryable
klasifikace). Protože kontrola běží **před** LLM voláním (ověřeno testem
— oversized zpráva nechá nula řádků v `llm_runs`/`usage_ledger`), tři
pokusy před karanténou nejsou tři zaplacená volání, jen tři bezplatné
no-op pokusy + ~50s backoff latence.

**Testy pod skutečnou rolí `h2_runtime`**, 10 nových: `fitToBudget()`
overflow/P0-exceeds/deterministické-pořadí (AT-58), `persistContextRun()`
round-trip, `CONTEXT_TOKEN_BUDGETS`/`estimateTokens()` sanity, retrofit
test (oversized zpráva → `H2ContextBudgetError`, nula řádků ve všech
třech tabulkách).

**Ověřeno:** 10/10 nových testů zelených, 161/161 testů v celém repu (43
souborů), `npx tsc --noEmit` čistě, `npm run build` čistě (žádné nové
routy).

**Uzavření Kroku 1:**
1. ~~implementace + testy podle schváleného plánu~~ — HOTOVO, viz evidence blok nahoře,
2. ~~push branche, otevřít PR~~ — HOTOVO, [PR #27](https://github.com/honzabindr-max/muj-web/pull/27),
3. ~~zelené GHA na PR~~ — HOTOVO, run 33745005718 (h2-tests) pass,
4. ~~Honzíkovo GO k mergi do `main`~~ — HOTOVO, merge commit `df7c78a`,
5. ~~potvrdit produkční Vercel deploy po mergi~~ — HOTOVO, `dpl_6sVj7YmFsNdoJFSYFgQgySUfUdpX` READY, `/api/h2/health` živě ověřen,
6. ~~preflight `check-required-env.ts` proti production i preview~~ — HOTOVO, beze změny nálezu (jen 3 už známé proměnné).

### Krok 2 — Deterministic relevance floor + entity resolution v1 (implementace hotová)

- `h2/context/relevance-floor.ts` — `passesRelevanceFloor(candidate,
  resolvedEntities, purpose)`: hypotéza (`isHypothesis`) projde jen při
  `purpose='BUDDY_DEEP_DIVE'` (AT-23, Reasoning Lab gate — má přednost
  před entity matchem); jinak `requiredForAction` vždy projde (condition
  2); jinak `matchLabel` musí case-insensitive sedět na resolved entitu
  (condition 1, AT-22); jinak floor odmítne (AT-21).
- `h2/context/resolve-entities.ts` — `resolveMessageEntities()`
  (Rozhodnutí 1): čte poslední `status='OK'` `operational_extractions`
  řádek pro `raw_event_id`, mapuje `type='ENTITY'` kandidáty na
  `ResolvedEntity[]` (`label` z `name`/`label`/`title`/`text` pole
  payloadu, `refType` z `refType`/`entityType` nebo `UNKNOWN`).
- `h2/context/priority.ts` — `ContextCandidateItem` rozšířen o volitelná
  `matchLabel`/`requiredForAction`/`isHypothesis` (zpětně kompatibilní,
  `persistContextRun()` z Kroku 1 je ignoruje — jen runtime matching).

**AT:** AT-21, AT-22, AT-23. **Testy pod skutečnou rolí `h2_runtime`**,
13 nových: `passesRelevanceFloor()` (7 unit testů vč. case-insensitive
matche a "hypotéza má přednost"), `resolveMessageEntities()` (6 testů
vč. ENTITY-only filtr, INVALID řádek se ignoruje, chybějící label se
přeskočí, nejnovější OK řádek vyhrává při víc extrakcích).

**Ověřeno:** 13/13 nových testů zelených, 174/174 testů v celém repu (45
souborů), `npx tsc --noEmit` čistě, `npm run build` čistě (žádné nové
routy).

**Proč bezpečné mergnout samostatně:** oba moduly jsou další
čisté/read-only funkce bez volajícího — Krok 3–4 na nich teprve budou
stavět, nic v produkci je zatím nespouští.

**Uzavření Kroku 2:**
1. ~~implementace + testy podle schváleného plánu~~ — HOTOVO, viz evidence blok nahoře,
2. push branche, otevřít PR — PROBÍHÁ,
3. zelené GHA na PR — ČEKÁ SE,
4. Honzíkovo GO k mergi do `main` — ČEKÁ SE (žádná migrace, žádný env, jen běžné GO na merge).

## Bloky BUILD-01 — BUILD-28

Stavy: `TODO` | `IN PROGRESS` | `AT GREEN` | `DEPLOYED` | `BLOCKED`

| Blok | Název | Stav | Vlastněné AT (ownership matrix) | Evidence |
|---|---|---|---|---|
| BUILD-01 | Foundation & configuration | AT GREEN | — (schema/unit/integration testy slice: 21/21 zelených, viz evidence block) | [PR #11](https://github.com/honzabindr-max/muj-web/pull/11) MERGED, branch `build/h2-build-01-foundation-config`, KROK 0 (lazy config, žádný dopad na existující stránky bez H2 env) ověřen + zamčen regresními testy |
| BUILD-02 | Neon data layer | AT GREEN — DOKONČENO vč. provisioningu (production + preview ověřeny) | — (21/21 DB testů zelených proti lokální Postgres 17 + role/RLS ověřeno proti reálnému Neon oběma prostředími) | [PR #12](https://github.com/honzabindr-max/muj-web/pull/12) MERGED, [PR #13](https://github.com/honzabindr-max/muj-web/pull/13) MERGED (tooling); DEC-003 (Free plán do M1), DEC-004 (pg SSL warning, budoucí upgrade) |
| BUILD-03 | Crypto & privacy foundation | AT GREEN — MERGED | AT-41, AT-42 (24/24 testů zelených, viz evidence block) | [PR #14](https://github.com/honzabindr-max/muj-web/pull/14) MERGED, branch `build/h2-build-03-crypto-privacy` |
| BUILD-03A | Identity, sessions & recent re-auth | AT GREEN — MERGED, DEPLOYED, produkční hotfix aplikován | AT-64 (90/90 testů v repu zelených) | [PR #15](https://github.com/honzabindr-max/muj-web/pull/15) MERGED, branch `build/h2-build-03a-identity-sessions`, ověřeno živým Google OAuth přihlášením na produkci; [PR #17](https://github.com/honzabindr-max/muj-web/pull/17) MERGED — hotfix produkčního `AccessDenied` (viz sekce výše), migrace 0012+0013 aplikovány na production i preview |
| BUILD-04 | Unified ingestion | AT GREEN — MERGED, DEPLOYED, živě ověřeno end-to-end (reálné Telegram zprávy → DB) | AT-01, AT-02, AT-48, AT-61 | [PR #18](https://github.com/honzabindr-max/muj-web/pull/18) + [PR #19](https://github.com/honzabindr-max/muj-web/pull/19) MERGED; viz sekce výše |
| BUILD-05 | Queue, lease, fencing, quarantine | AT GREEN — MERGED, DEPLOYED (bez HTTP povrchu, ověřeno jen zdravím + testy) | AT-03, AT-06, AT-07, AT-54, AT-67, AT-71 | [PR #20](https://github.com/honzabindr-max/muj-web/pull/20) MERGED, branch `build/h2-build-05-queue-lease-fencing`; viz sekce výše |
| BUILD-06 | Voice transcription | AT GREEN — MERGED, DEPLOYED (ingest live, zpracování čeká na ruční ověření) | AT-04, AT-05 | [PR #22](https://github.com/honzabindr-max/muj-web/pull/22) MERGED, branch `build/h2-build-06-voice-transcription`; viz sekce výše |
| BUILD-07 | Prompt Registry & model adapter | AT GREEN — MERGED, DEPLOYED (mechanismus bez produkčního triggeru, čeká na ruční certifikaci) | AT-33, AT-34, AT-35, AT-36, AT-63 | [PR #24](https://github.com/honzabindr-max/muj-web/pull/24) MERGED, branch `build/h2-build-07-prompt-registry`; viz sekce výše |
| BUILD-08 | Operational extraction | AT GREEN — MERGED, DEPLOYED (bez produkčního triggeru, zapojení je BUILD-10) | — (schema/unit/integration testy slice: 5/5 nových zelených, viz evidence block) | [PR #26](https://github.com/honzabindr-max/muj-web/pull/26) MERGED, branch `build/h2-build-08-operational-extraction`; viz sekce výše |
| BUILD-09 | Context Engine | IN PROGRESS — Krok 1/4 MERGED, DEPLOYED; Krok 2/4 implementace hotová, čeká na push+PR | AT-21, AT-22, AT-23, AT-24, AT-25, AT-58, AT-66 | [PR #27](https://github.com/honzabindr-max/muj-web/pull/27) MERGED (Krok 1); Krok 2 branch `build/h2-build-09-step2-relevance-floor` |
| BUILD-10 | Buddy runtime | TODO | AT-09, AT-50, AT-62 | — |
| BUILD-11 | Telegram + web delivery | TODO | AT-10 | — |
| — | **MILESTONE M1 — Buddy Live** | **NOT STARTED** | — | — |
| BUILD-12 | Executive objects | TODO | AT-08, AT-27, AT-28, AT-30, AT-31, AT-32, AT-51 | — |
| BUILD-13 | Google Calendar | TODO | — (schema/unit/integration testy slice) | — |
| BUILD-14 | Blind learning pipeline | TODO | AT-11, AT-12, AT-13 | — |
| BUILD-15 | Influence linking / I8 | TODO | AT-14, AT-15, AT-16, AT-45, AT-60 | — |
| BUILD-16 | Evidence / claims / deterministic metrics | TODO | AT-17, AT-18, AT-19, AT-20 | — |
| BUILD-17 | Experiments & Living OS | TODO | AT-29 | — |
| BUILD-18 | 24-domain My Map + Discoveries | TODO | — (schema/unit/integration testy slice) | — |
| BUILD-19 | Timeline & Memory Inspector | TODO | AT-26, AT-65 | — |
| BUILD-20 | Deletion Ledger + selective hard delete | TODO | AT-37, AT-68, AT-69 | — |
| BUILD-21 | Backups & restore | TODO | AT-38, AT-39, AT-46, AT-56, AT-57 | — |
| BUILD-22 | Full H2 Destruction | TODO | AT-40 | — |
| BUILD-23 | Scheduler, jobs, health | TODO | AT-43, AT-44, AT-47, AT-55, AT-72 | — |
| BUILD-24 | Proactivity & cycles | TODO | AT-53 | — |
| BUILD-25 | Reviews & Wrapped | TODO | AT-59 | — |
| BUILD-26 | Full web product surfaces | TODO | AT-49 | — |
| BUILD-27 | Usage & budget guardrails (zbytek po vyjmutí minimálního meteringu do M1) | TODO | AT-70 | — |
| BUILD-28 | Exit Package | TODO | AT-52 | — |

## Log deploymentů

| Datum | Slice | Commit | URL | Poznámka |
|---|---|---|---|---|
| 2026-09-02 | BUILD-01 | `e6368d0` (merge #11) | Vercel auto-deploy (produkce muj-web) | Config/logger/health foundation, žádná nová uživatelsky viditelná funkčnost. |
| 2026-09-02 | BUILD-02 | merge #12 | Vercel auto-deploy (produkce muj-web) | DB schema/migrace, žádná Neon infrastruktura ani runtime dopad (nic H2 se zatím k DB nepřipojuje). |
| 2026-09-02 | BUILD-03 | merge #14 (`4dc44da`) | Vercel auto-deploy (produkce muj-web) | Crypto & privacy foundation, žádná nová uživatelsky viditelná funkčnost. |
| 2026-09-02 | BUILD-03A | merge #15 (`5da0399`) | Vercel auto-deploy (produkce muj-web), `good-inventions.work` | Google OAuth živě zapojen. Po tomto deployi se objevil produkční `AccessDenied` bug (viz hotfix). |
| 2026-09-02 | Hotfix (post-03A) | merge #17 (`c687def`) | Vercel auto-deploy (produkce muj-web), `good-inventions.work` | Opraveny 3 mezery (owners GRANT, RLS scope, chybějící migrace 0012 na produkci). Migrace 0012+0013 aplikovány na production i preview `h2-runtime`. Reálné přihlášení na produkci živě ověřeno Honzíkem — funkční. |
| 2026-09-03 | BUILD-04 | merge #18 (`76a7d40`) | Vercel auto-deploy (produkce muj-web, `dpl_Bwqy4G3jPyiJ99ziTDmcehA7i8AE`), `good-inventions.work` | Unified ingestion — `ingestMessage()` + Telegram/web routy. Migrace 0014 aplikována a ověřena na production i preview `h2-runtime` PŘED mergem. `/api/h2/health` živě ověřen po deployi. Telegram webhook zatím neregistrován (Honzíkovo `setWebhook` s reálným tokenem, mimo scope Code). |
| 2026-09-03 | BUILD-04 post-deploy fix | merge #19 (`68f9cde`) | Vercel auto-deploy (produkce muj-web, `dpl_HnYrRVC3vukun9QxZySXxWT4EFL9`), `good-inventions.work` | Oprava `verify-ingestion.ts` (tiché nulování na chybějící `app.owner_id` scope, pravidlo 9) + nový `check-required-env.ts` preflight nástroj (pravidlo 8). **BUILD-04 živě potvrzen end-to-end na produkci** po tomto deployi: `check-required-env.ts` OK na obou prostředích kromě `H2_LEDGER_HMAC_KEY` (BUILD-20, mimo scope, informační), `verify-ingestion.ts` ukázal 4 `raw_events` (`telegram/USER`), 4 `message_processing_jobs` `PENDING`, 0 rejected-sender audit eventů. |
| 2026-09-03 | BUILD-05 | merge #20 (`c802edd`) | Vercel auto-deploy (produkce muj-web, `dpl_23RojA1yQwwXym1e9rbsi5RUAi4y`), `good-inventions.work` | Queue/lease/fencing/quarantine (`h2/processing/*`) — žádná migrace, žádný nový env, žádný HTTP povrch ani produkční trigger (Rozhodnutí 2), takže merge sám o sobě nemění chování žijící produkce. `/api/h2/health` živě ověřen po deployi. `check-required-env.ts` opět jen `H2_LEDGER_HMAC_KEY` (stejný známý nález, BUILD-20). |
| 2026-09-03 | BUILD-06 | merge #22 (`d61860e`) | Vercel auto-deploy (produkce muj-web, `dpl_ChYNSo3bcfbL5pCwppZMHDHDx7PL`), `good-inventions.work` | Voice transcription — Telegram voice ingest větev live (`telegramVoice=true`), zpracování (`h2/voice/*`) beze produkčního triggeru. `/api/h2/health` živě ověřen po deployi. `check-required-env.ts` nově hlásí `H2_OPENAI_API_KEY` chybí (BUILD-06, čeká na Honzíka) vedle staršího `H2_LEDGER_HMAC_KEY` (BUILD-20); `H2_TELEGRAM_BOT_TOKEN` byl ve Vercelu už přítomný. |
| 2026-09-03 | BUILD-07 | merge #24 (`dbec556`) | Vercel auto-deploy (produkce muj-web, `dpl_GajgTX5d47SdpewC7mTwFNSxoMEG`), `good-inventions.work` | Prompt Registry & model adapter (`h2/prompts/*`) — migrace 0015 (GRANTy na `prompt_versions`/`prompt_test_runs`) aplikována a ověřena na obou Neon větvích PŘED mergem. Retrofit BUILD-06: Whisper teď zapisuje i `llm_runs`. Žádný HTTP povrch ani produkční trigger. `/api/h2/health` živě ověřen po deployi. `check-required-env.ts` nově hlásí `H2_ANTHROPIC_API_KEY` chybí (BUILD-07, čeká na Honzíka) vedle `H2_OPENAI_API_KEY`/`H2_LEDGER_HMAC_KEY`. |
| 2026-09-03 | BUILD-08 | merge #26 (`417c789`) | Vercel auto-deploy (produkce muj-web, `dpl_C9RFhCDSpueSnCsw68EDrbs6inrL`), `good-inventions.work` | Operational extraction (`h2/extraction/*`) — žádná nová migrace, žádný nový credential (Haiku sdílí `H2_ANTHROPIC_API_KEY` se Sonnetem). Drobné rozšíření `callAnthropicModel()` o `maxOutputTokens`. Žádný HTTP povrch ani produkční trigger (zapojení je BUILD-10). `/api/h2/health` živě ověřen po deployi. `check-required-env.ts` beze změny nálezu — jen 3 už známé (`H2_LEDGER_HMAC_KEY`, `H2_OPENAI_API_KEY`, `H2_ANTHROPIC_API_KEY`). |
