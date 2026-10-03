# SAM-BYT — architektura (audit 3. 10. 2026)

Stav kódu: `origin/main` @ `120b26f`. Poslední změna kódu/dat /sam-byt: `32fb86f` (22. 9. 2026), data `04647d8` (22. 9. 2026).

## 1. Zdrojový kód

| Vrstva | Cesta |
|---|---|
| Stránky (RSC) | `app/sam-byt/page.tsx` (přehled / login), `app/sam-byt/byt/[id]/page.tsx` (detail) |
| UI komponenty | `app/sam-byt/_components/*` (app-shell, listing-card, detail-view, decision-controls, samuv-vyber, compare-drawer, filters-bar, image-with-fallback, gallery, login-form, pet-badge) |
| Klientský stav | `app/sam-byt/_lib/use-sam-byt-state.ts` (fetch + 15 s polling + PATCH) |
| API | `app/api/sam-byt/auth/{login,logout}`, `me`, `state` (GET), `state/[listingId]` (PATCH), `events` (GET) |
| Doména | `sam-byt/types.ts`, `sam-byt/data/{listings,price,pets}.ts`, `sam-byt/state/repository.ts` |
| Auth | `sam-byt/auth/{session,server-session,require-session,password,rate-limit,csrf}.ts` |
| DB | `sam-byt/db/pool.ts`, `sam-byt/db/migrate.ts`, `sam-byt/db/migrations/0001_init.sql`, skripty `sam-byt/db/scripts/*` |
| Data | `data/sam-byt/listings.json` (katalog), `raw-extraction.json`, `AUDIT.md` (extrakce 22. 9. 2026) |
| Testy | `sam-byt/__tests__/*` (gate, repository, session, password, price, pets), `app/sam-byt/_components/__tests__/source-link.test.tsx` |

## 2. Framework
Next.js **16.2.1** (App Router), React **19.2.4**, TypeScript, Tailwind. Route handlery `runtime = "nodejs"`, `dynamic = "force-dynamic"`. DB driver `pg` ^8.16.4.

## 3. Hosting / deploy
Vercel, auto-deploy z `main` (viz `CLAUDE.md`). Žádný samostatný CI deploy krok pro sam-byt; testy běží v `.github/workflows/h2-tests.yml` proti dočasnému Postgresu. Hlavičky: CSP `img-src` whitelist (`d18-a.sdn.cz api.bezrealitky.cz t.rmcl.cz www.bazos.cz`), `X-Robots-Tag: noindex`, API `Cache-Control: private, no-store` (`next.config.ts`).

## 4. Databáze
Izolovaný **Neon Postgres** projekt sam-byt. Runtime: `SAM_BYT_DATABASE_URL` (Vercel env), lazy `pg.Pool` v `sam-byt/db/pool.ts`. Migrace a seed: `SAM_BYT_MIGRATOR_DATABASE_URL` z lokálního `.env.migrate.sam-byt.<preview|production>` (gitignored). DB drží **jen uživatelský stav a auth**, ne katalog.

## 5. Reprezentace bytů
**Statický JSON** `data/sam-byt/listings.json`, importovaný při buildu (`sam-byt/data/listings.ts`). 11 objektů, ~70 polí (typ `Listing` v `sam-byt/types.ts`). Import spouští integritní bránu `validateGate()`: přesně 11 záznamů, ID `sam-01…sam-11` v pořadí, součet `rent_czk` = 218 500, součet `display_monthly_price.known_min_czk` = 266 452, 54 fotek, `is_complete` jen u `sam-11`, pevné pořadí ploch. Jakákoli změna katalogu bez úpravy brány shodí build/start.

UI cenu bere z `display_monthly_price` (ne z `known_monthly_total_czk`), vybavení/balkon z `display_*` polí.

## 6. Stabilní identifikátory
- `id` = `sam-NN` — jediný interní klíč; zároveň `listing_id` v DB a URL detailu `/sam-byt/byt/{id}`. Žádný slug.
- Portálové ID nejsou samostatné pole; jdou odvodit ze `source_url` (Sreality numerické ID, Bezrealitky ID, Bazoš ID, ID RK) a ze `source_name` („ID zakázky …"). Odvozené hodnoty jsou v `CURRENT_SAM_BYT_CATALOG.json` (`source_listing_ref`, `agency_listing_ref`).
- **Omezení:** `ListingId` je TS union `sam-01…sam-11`; DB CHECK `listing_id ~ '^sam-(0[1-9]|1[01])$'` v `sam_byt_user_listing_state` i `sam_byt_decision_events`. `sam-12+` nelze uložit bez migrace.

## 7. Uživatelský stav
Tabulka `sam_byt_user_listing_state`, PK `(user_id, listing_id)`, jeden řádek na uživatele a byt (vzniká až při první úpravě):

| Požadavek | Sloupec | Pozn. |
|---|---|---|
| favorit | `favorite boolean` | nesmí být zároveň `decision='reject'` (CHECK) |
| rozhodnutí / status | `decision` ∈ `unreviewed, favorite, maybe, want_viewing, reject` | `want_viewing` = „Chci na prohlídku". Pozor: `decision='favorite'` a `favorite=true` jsou dva různé údaje |
| komentář | `notes text` ≤ 2000 | Sam i Honzík mají každý svůj |
| hodnocení | `rating_price, rating_pet, rating_location, rating_balcony, rating_furnishing` 1–5 / null | |
| verze | `version int`, `updated_at` | optimistic concurrency (409 při konfliktu) |
| historie | `sam_byt_decision_events` (id, user_id, listing_id, field, old_value, new_value, created_at) | append-only, zápis ve stejné transakci (`repository.ts:207-224`) |

Sam a Honzík mají **identické schéma**; rozlišení přes `user_id` → `sam_byt_users.username`. Samostatný „wants_viewing" sloupec ani status inzerátu (pronajato/archiv) neexistuje.

## 8. Autentizace
Dva pevné účty (`sam_byt_users.username CHECK in ('sam','honzik')`), heslo scrypt (`scrypt$salt$hash`). Login `POST /api/sam-byt/auth/login` → náhodný 32B token v httpOnly cookie `sam_byt_session` (30 dní), v DB jen sha256 hash (`sam_byt_sessions`). Rate-limit 8 neúspěchů/15 min na jméno, 20/15 min na IP (`sam_byt_login_attempts`). PATCH/logout vyžadují same-origin (Origin/Referer). Oprávnění: Sam čte jen svůj stav; Honzík čte svůj + Samův (`state/route.ts`) a historii (`events`, limit 100, jen honzik).

## 9. localStorage / sessionStorage
**Nepoužívá se.** (grep přes `app/sam-byt`, `app/api/sam-byt`, `sam-byt`.) Klient drží stav jen v React state, zdroj pravdy je server. Neuložená rozepsaná poznámka se ztratí při zavření stránky — nejde o persistentní data.

## 10. Migrace
Ano: `sam-byt/db/migrations/0001_init.sql` (jediná). Runner `sam-byt/db/migrate.ts` — abecedně, každá v transakci, evidence v `_sam_byt_migrations`, idempotentní. Spouští se ručně (`migrate-neon.ts preview|production`), ne při deployi.

## Datový tok
```
data/sam-byt/listings.json ──build──► getAllListings() ──► RSC page / AppShell
                                                  │
browser ──GET /api/sam-byt/state (15 s)──► Neon: sam_byt_user_listing_state
        ──PATCH /api/sam-byt/state/:id──► tx: upsert (version) + decision_events
```
