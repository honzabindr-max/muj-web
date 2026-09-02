# H2 Buddy — Build Status

**Aktuální slice:** BUILD-03 — Crypto & privacy foundation, AT GREEN, čeká na Honzíkovo GO k merge (PR #14). BUILD-01 (PR #11) a BUILD-02 (PR #12 + #13, vč. plného Neon provisioningu — production i preview ověřeny) jsou MERGED.
**Poslední deployment:** [PR #11](https://github.com/honzabindr-max/muj-web/pull/11), [PR #12](https://github.com/honzabindr-max/muj-web/pull/12) a [PR #13](https://github.com/honzabindr-max/muj-web/pull/13) mergnuty do `main`, Vercel auto-deploy proběhl přes existující GitHub integraci. Toto NENÍ H2 Buddy M1 produkční deployment (BUILD-01–03 negenerují uživatelsky viditelnou funkčnost).
**Stav milestone M1 (Buddy Live):** NOT STARTED — 0 / 11 bloků DEPLOYED (BUILD-01–BUILD-11 vč. BUILD-03A), BUILD-01/02/03 AT GREEN
**Otevřené ARCHITECTURE DECISION REQUIRED:** 0 (DEC-001–DEC-004 vyřešeny, DEC-004 je zaznamenané riziko pro budoucí pg upgrade, viz [DECISIONS.md](./DECISIONS.md))

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

## Bloky BUILD-01 — BUILD-28

Stavy: `TODO` | `IN PROGRESS` | `AT GREEN` | `DEPLOYED` | `BLOCKED`

| Blok | Název | Stav | Vlastněné AT (ownership matrix) | Evidence |
|---|---|---|---|---|
| BUILD-01 | Foundation & configuration | AT GREEN | — (schema/unit/integration testy slice: 21/21 zelených, viz evidence block) | [PR #11](https://github.com/honzabindr-max/muj-web/pull/11) MERGED, branch `build/h2-build-01-foundation-config`, KROK 0 (lazy config, žádný dopad na existující stránky bez H2 env) ověřen + zamčen regresními testy |
| BUILD-02 | Neon data layer | AT GREEN — DOKONČENO vč. provisioningu (production + preview ověřeny) | — (21/21 DB testů zelených proti lokální Postgres 17 + role/RLS ověřeno proti reálnému Neon oběma prostředími) | [PR #12](https://github.com/honzabindr-max/muj-web/pull/12) MERGED, [PR #13](https://github.com/honzabindr-max/muj-web/pull/13) MERGED (tooling); DEC-003 (Free plán do M1), DEC-004 (pg SSL warning, budoucí upgrade) |
| BUILD-03 | Crypto & privacy foundation | AT GREEN | AT-41, AT-42 (24/24 testů zelených, viz evidence block) | [PR #14](https://github.com/honzabindr-max/muj-web/pull/14), branch `build/h2-build-03-crypto-privacy`, čeká na Honzíkovo GO k merge |
| BUILD-03A | Identity, sessions & recent re-auth | TODO | AT-64 | — |
| BUILD-04 | Unified ingestion | TODO | AT-01, AT-02, AT-48, AT-61 | — |
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
