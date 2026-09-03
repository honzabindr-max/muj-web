# H2 Buddy — Build Status

**Aktuální slice:** BUILD-04 — Unified ingestion, AT GREEN (68/68 nových testů, 114/114 v celém repu; CI zelené na [PR #18](https://github.com/honzabindr-max/muj-web/pull/18)). Migrace `0014_telegram_rejected_audit_event.sql` aplikována a ověřena přímým dotazem na `_h2_migrations` na **production i preview** větvi h2-runtime (viz evidence níže). Env proměnné `H2_TELEGRAM_WEBHOOK_SECRET` + `H2_TELEGRAM_OWNER_USER_ID` jsou ve Vercelu (production + preview). **Poslední krok: merge PR #18 do `main`.** BUILD-01 (PR #11), BUILD-02 (PR #12+#13), BUILD-03 (PR #14), BUILD-03A (PR #15) a hotfix (PR #17) jsou MERGED.

**Evidence (migrace 0014):**
```
Commit: e5d05d3 (0014_telegram_rejected_audit_event.sql), branch build/h2-build-04-unified-ingestion
Branch: build/h2-build-04-unified-ingestion (PR #18, nemergnuto do main)
DB: h2-runtime production — 0014 v _h2_migrations, applied_at 2026-09-03T06:43:26.898Z;
    h2-runtime preview — 0014 v _h2_migrations, applied_at 2026-09-03T06:46:54.870Z;
    identity_audit_events_event_type_check na obou obsahuje TELEGRAM_MESSAGE_REJECTED_UNKNOWN_SENDER
    (ověřeno přímým SELECT z _h2_migrations + pg_get_constraintdef, ne předpokladem)
GHA: run 33722329096 (h2-tests) — pass
Artifact: N/A
Deployment: žádný produkční Vercel deploy zatím (merge do main čeká na GO)
Timestamp: 2026-09-03
Verified by: Code, přímý SQL dotaz proti oběma Neon větvím pod migrátorskou rolí (neondb_owner, DEC-006)
Remaining risk: merge do main + potvrzení produkčního Vercel deploye
```
**Poslední deployment:** [PR #11](https://github.com/honzabindr-max/muj-web/pull/11), [PR #12](https://github.com/honzabindr-max/muj-web/pull/12), [PR #13](https://github.com/honzabindr-max/muj-web/pull/13), [PR #14](https://github.com/honzabindr-max/muj-web/pull/14), [PR #15](https://github.com/honzabindr-max/muj-web/pull/15) a [PR #17](https://github.com/honzabindr-max/muj-web/pull/17) mergnuty do `main`, Vercel auto-deploy proběhl přes existující GitHub integraci. Reálné přihlášení přes Google na `good-inventions.work` živě ověřeno a funkční (po hotfixu PR #17 + aplikaci migrací 0012+0013 na produkční i preview větev Neonu). BUILD-04 zatím žádný deployment nemá (branch čeká na PR/GO).
**Stav milestone M1 (Buddy Live):** NOT STARTED — 0 / 11 bloků DEPLOYED (BUILD-01–BUILD-11 vč. BUILD-03A), BUILD-01/02/03/03A AT GREEN a MERGED, BUILD-04 AT GREEN lokálně a čeká na merge
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

## BUILD-04 — Unified ingestion (AT GREEN, migrace ověřena na production i preview, NEMERGNUTO)

- `h2/ingestion/ingest-message.ts` — `ingestMessage()`: jediná doménová funkce, kterou volají Telegram i web (AT-48). Owner-scoped transakce (`withOwnerScope`, stejný RLS vzor jako BUILD-03A hotfix), advisory lock per owner kolem alokace `conversation_sequence`/`input_sequence` (§5), dedup podle `(owner_id, channel, external_event_id)` (AT-02), `message_processing_job` vzniká výhradně pro `speaker=USER` (AT-61).
- `h2/ingestion/telegram-auth.ts` — Telegram identity boundary (§31.1): **allowlist** jednoho `telegram_user_id` z `H2_TELEGRAM_OWNER_USER_ID` (ne first-contact enrollment jako u Google — Telegram update samo o sobě nedokazuje identitu) + `timingSafeEqual` ověření `X-Telegram-Bot-Api-Secret-Token` proti `H2_TELEGRAM_WEBHOOK_SECRET`. `resolveEnrolledOwnerId()` připojuje Telegram na existujícího (Google-enrollnutého) ownera, nikdy nevytváří nový owner řádek.
- `app/api/h2/telegram/webhook/route.ts` — cesta přesně podle Technical Architecture v1.2 §3. Failure model (§27): neplatný/chybějící webhook secret → 401 (request není prokazatelně od Telegramu, žádný retry loop nehrozí); cizí `telegram_user_id` → **200** (Honzíkova korekce — Telegram by na ne-200 opakoval doručení donekonečna), payload se neuloží, `TELEGRAM_MESSAGE_REJECTED_UNKNOWN_SENDER` audit event bez obsahu (nový migrace 0014). Update bez `text` (voice/photo/…) → 200 no-op, mimo scope tohoto slicu (voice ingest je BUILD-06).
- `app/api/h2/web/messages/route.ts` — cesta přesně podle §3. Auth `requireOwnerSession()` + `assertSameOrigin()` (BUILD-03A write-endpoint kontrakt), `clientMessageId` (UUID) jako web ekvivalent Telegram `update_id` pro idempotenci.
- `h2/db/migrations/0014_telegram_rejected_audit_event.sql` — rozšiřuje `identity_audit_events_event_type_check` o `TELEGRAM_MESSAGE_REJECTED_UNKNOWN_SENDER`, aditivní. **Aplikováno a ověřeno na production i preview h2-runtime** (přímý dotaz na `_h2_migrations` + `pg_get_constraintdef`, viz evidence blok nahoře), přes migrátorskou roli `neondb_owner` (DEC-006 odchylka, ne `h2_migrator`).
- `h2/config/capabilities.ts` — `telegramIngest` a `webBuddyChat` feature flags přepnuty na `true` (AT GREEN); `telegramVoice` zůstává `false` (BUILD-06).
- Bonusová oprava (stejná třída jako CI race z BUILD-03A): `h2/db/scripts/ensure-test-roles.ts` teď nastavuje LOGIN password pro `h2_runtime`/`h2_job`/`h2_blind_reader`/`h2_control` přesně jednou v globalSetup místo v každém test souboru zvlášť — s víc test soubory běžícími paralelně (přidanými touto slicí) `ALTER ROLE ... PASSWORD` na sdílené cluster-wide roli spadalo na `tuple concurrently updated`. Opraveno i pro existující `rls.test.ts`, `control.test.ts`, `production-signin-flow.test.ts`.

**Ověřeno:** 68/68 nových testů (`ingest-message.test.ts`, `telegram-auth.test.ts`, oba route testy — přímé volání handleru, ne tunel/reálný Telegram), 114/114 testů v celém repu, `npx tsc --noEmit` čistě, `npm run build` čistě (obě nové routy se objevují jako `ƒ` dynamic, žádný dopad na existující statické stránky).

**Vstupy od Honzíka (přijato):** `H2_TELEGRAM_OWNER_USER_ID=6034875251` (allowlist), setWebhook registrace + reálný `H2_TELEGRAM_BOT_TOKEN` a `H2_TELEGRAM_WEBHOOK_SECRET` provádí Honzík sám z prohlížeče (DEC-005 — secret se nesmí objevit v session transcriptu; kód BUILD-04 `H2_TELEGRAM_BOT_TOKEN` vůbec nečte, odchozí Telegram volání jsou BUILD-11).

**Zbývá pro uzavření slicu:**
1. ~~přidat `H2_TELEGRAM_WEBHOOK_SECRET` + `H2_TELEGRAM_OWNER_USER_ID` do Vercelu (production + preview)~~ — HOTOVO (Honzík),
2. ~~aplikovat migraci 0014 na production i preview `h2-runtime` a ověřit přímým dotazem na `_h2_migrations`~~ — HOTOVO, viz evidence blok nahoře,
3. merge branch `build/h2-build-04-unified-ingestion` (PR #18) do `main` — GO uděleno, čeká na provedení,
4. potvrdit produkční Vercel deploy po mergi,
5. Honzíkovo `setWebhook` proti Telegram API reálným tokenem.

## Bloky BUILD-01 — BUILD-28

Stavy: `TODO` | `IN PROGRESS` | `AT GREEN` | `DEPLOYED` | `BLOCKED`

| Blok | Název | Stav | Vlastněné AT (ownership matrix) | Evidence |
|---|---|---|---|---|
| BUILD-01 | Foundation & configuration | AT GREEN | — (schema/unit/integration testy slice: 21/21 zelených, viz evidence block) | [PR #11](https://github.com/honzabindr-max/muj-web/pull/11) MERGED, branch `build/h2-build-01-foundation-config`, KROK 0 (lazy config, žádný dopad na existující stránky bez H2 env) ověřen + zamčen regresními testy |
| BUILD-02 | Neon data layer | AT GREEN — DOKONČENO vč. provisioningu (production + preview ověřeny) | — (21/21 DB testů zelených proti lokální Postgres 17 + role/RLS ověřeno proti reálnému Neon oběma prostředími) | [PR #12](https://github.com/honzabindr-max/muj-web/pull/12) MERGED, [PR #13](https://github.com/honzabindr-max/muj-web/pull/13) MERGED (tooling); DEC-003 (Free plán do M1), DEC-004 (pg SSL warning, budoucí upgrade) |
| BUILD-03 | Crypto & privacy foundation | AT GREEN — MERGED | AT-41, AT-42 (24/24 testů zelených, viz evidence block) | [PR #14](https://github.com/honzabindr-max/muj-web/pull/14) MERGED, branch `build/h2-build-03-crypto-privacy` |
| BUILD-03A | Identity, sessions & recent re-auth | AT GREEN — MERGED, DEPLOYED, produkční hotfix aplikován | AT-64 (90/90 testů v repu zelených) | [PR #15](https://github.com/honzabindr-max/muj-web/pull/15) MERGED, branch `build/h2-build-03a-identity-sessions`, ověřeno živým Google OAuth přihlášením na produkci; [PR #17](https://github.com/honzabindr-max/muj-web/pull/17) MERGED — hotfix produkčního `AccessDenied` (viz sekce výše), migrace 0012+0013 aplikovány na production i preview |
| BUILD-04 | Unified ingestion | AT GREEN, migrace 0014 ověřena na production+preview — čeká na merge PR #18 (GO uděleno) | AT-01, AT-02, AT-48, AT-61 | [PR #18](https://github.com/honzabindr-max/muj-web/pull/18), branch `build/h2-build-04-unified-ingestion`; viz sekce výše |
| BUILD-05 | Queue, lease, fencing, quarantine | TODO | AT-03, AT-06, AT-07, AT-54, AT-67, AT-71 | — |
| BUILD-06 | Voice transcription | TODO | AT-04, AT-05 | — |
| BUILD-07 | Prompt Registry & model adapter | TODO | AT-33, AT-34, AT-35, AT-36, AT-63 | — |
| BUILD-08 | Operational extraction | TODO | — (schema/unit/integration testy slice) | — |
| BUILD-09 | Context Engine | TODO | AT-21, AT-22, AT-23, AT-24, AT-25, AT-58, AT-66 | — |
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
