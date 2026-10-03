# SAM-BYT — audit report (3. 10. 2026)

Read-only audit před refreshem trhu. Žádná produkční data, schéma, auth, URL ani deploy se neměnily. Výstupy jsou na větvi `audit/sam-byt-2026-10-03` (nemergeováno → žádný Vercel production deploy).

## Shrnutí

| Položka | Hodnota | Zdroj |
|---|---|---|
| Počet aktuálních bytů | **11** (`sam-01`…`sam-11`; Bystrc 6, Komín 2, Jundrov 3) | `data/sam-byt/listings.json` @ `origin/main` |
| Integritní brána | sedí: 11 / nájem 218 500 / known_min 266 452 / 54 fotek / complete jen sam-11 | `CURRENT_SAM_BYT_CATALOG.json` → `integrity_gate_check` |
| Byty se Samovými daty | **NEOVĚŘENO — čeká na lokální export** | prod Neon DB |
| Byty s Honzíkovými daty | **NEOVĚŘENO — čeká na lokální export** | prod Neon DB |
| Persistence katalogu | statický JSON v repu, build-time import | |
| Persistence uživatelského stavu | serverová — Neon Postgres (`sam_byt_user_listing_state` + historie `sam_byt_decision_events`), PATCH s optimistic concurrency | kód |
| localStorage / sessionStorage | **nepoužívá se** | grep |
| Migrace | 1 (`0001_init.sql`), ruční runner s evidencí | |

## Health check (úkol 5)

| Kontrola | Výsledek |
|---|---|
| /sam-byt se načte | **neověřeno ze session** — `www.good-inventions.work` je blokovaný egress proxy cloud session (curl i WebFetch) |
| Autentizace funguje | z kódu ano (scrypt, session cookie, 401 bez session); živě **neověřeno** |
| Data bytů se načtou | katalog validní, brána prochází lokálně |
| Serverové ukládání existuje | **ano** (kód: `PATCH /api/sam-byt/state/[listingId]` → transakční upsert + event log; export skript otestován proti lokální DB se stejným schématem) |
| Nejde jen o localStorage | **ano**, potvrzeno grepem |
| Fotky mají fallback | **ano** — `ImageWithFallback` (placeholder + odkaz „Fotky v původním inzerátu"), řeší i ORB race po hydrataci |
| source_url dostupné | **neověřeno ze session** (egress). 11 source_url + 1 alternative_url + 54 fotek připraveno ke kontrole skriptem |

Živý health check: `npx tsx sam-byt/audit/healthcheck-readonly.ts` (jen GET bez přihlášení, žádné parsování inzerátů) → `SAM_BYT_HEALTHCHECK_RESULT.json`.

## Kritická rizika (detail v `SAM_BYT_MIGRATION_RISKS.md`)
1. Integritní brána zadrátovaná na 11 konkrétních bytů → jakákoli změna katalogu shodí build.
2. DB CHECK `listing_id ~ '^sam-(0[1-9]|1[01])$'` → nový byt `sam-12+` vyžaduje migraci (explicitní GO).
3. Odebrání bytu z JSON skryje jeho uživatelský stav (není FK) → jen archivovat, nikdy mazat.
4. Katalog nemá `availability_status` / `archived_at` / portálové ID jako pole.
5. Páry Vondrákova (sam-06/10) a Jasanová (sam-08/09) — riziko falešného sloučení při matchingu.
6. Uživatelský stav zatím nemá zálohu mimo produkční DB.

## Je bezpečné zahájit refresh?
**Ne, zatím ne.** Podmínky:
1. Read-only export stavu z produkce existuje a počty jsou zapsané sem (baseline).
2. Neon branch snapshot + git tag (Fáze 0 v `SAM_BYT_MIGRATION_RISKS.md`).
3. Schválený plán migrace 0002 (aditivní) a náhrady integritní brány — samostatné kroky s GO.

## Soubory

| Soubor | Obsah |
|---|---|
| `CURRENT_SAM_BYT_CATALOG.json` | 11 bytů, požadovaná pole + `_field_mapping` + odvozená portálová ID + `raw` (původní objekt) |
| `CURRENT_SAM_BYT_USER_STATE.json` | schéma a struktura podle `internal_id`, hodnoty `PENDING_LOCAL_EXPORT` (osobní data nepatří do repa) |
| `SAM_BYT_ARCHITECTURE.md` | architektura a DB |
| `SAM_BYT_MIGRATION_RISKS.md` | rizika + backup/rollback plán |
| `SAM_BYT_IDENTITY_MATCHING_SPEC.md` | hierarchie identity bytu |
| `sam-byt/audit/export-state-readonly.ts` | read-only export stavu (`BEGIN … READ ONLY`, bez password_hash/token_hash) |
| `sam-byt/audit/healthcheck-readonly.ts` | read-only HTTP health check |

## Doplnění po lokálním exportu
_(zde doplnit agregáty z výstupu `export-state-readonly.ts`: `table_counts`, `listings_with_sam_nondefault`, `listings_with_honzik_nondefault`, `events_total`, `orphan_state_rows`)_

---
AUDIT BLOCKED — uživatelský stav je jen v produkční Neon DB a cloud session k ní nemá přístup (ani přes web — doména je blokovaná egress proxy); je potřeba lokálně spustit `export-state-readonly.ts` a `healthcheck-readonly.ts`.
