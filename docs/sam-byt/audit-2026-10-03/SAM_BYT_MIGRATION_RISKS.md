# SAM-BYT — rizika a doporučení před refreshem trhu

## Kritická rizika (blokují naivní refresh)

1. **Pevně zadrátovaný katalog 11 bytů.** `sam-byt/data/listings.ts` (`EXPECTED_IDS`, součty, počet fotek, pořadí ploch) shodí build při jakékoli změně `listings.json`. Refresh musí bránu nahradit obecnou validací (unikátní ID, ID jen přibývají, žádné existující ID nezmizí).
2. **DB CHECK na `listing_id`** `^sam-(0[1-9]|1[01])$` v `sam_byt_user_listing_state` i `sam_byt_decision_events` + TS union `ListingId`. Uložit stav k `sam-12+` nejde bez migrace → **ALTER TABLE = explicitní GO**, samostatný krok.
3. **Odstranění bytu z JSON = skrytí uživatelského stavu.** `listing_id` není FK; data v DB zůstanou, ale UI je nezobrazí a PATCH vrátí 404 (`isValidListingId`). Neztratí se fyzicky, ale prakticky zmizí. → nikdy nemazat z katalogu, jen archivovat.
4. **Přečíslování / recyklace ID** by přesunulo Samovy poznámky na jiný byt. → ID jsou neměnná, nové byty od `sam-12`.
5. **Žádný stav inzerátu v katalogu.** Chybí `availability_status` / `archived_at`; `listing_status` je volný text. Pronajatý byt nejde označit bez schématu katalogu.
6. **Nejistý match** (viz `SAM_BYT_IDENTITY_MATCHING_SPEC.md`): Vondrákova (sam-06/10) a Jasanová (sam-08/09) jsou reálné páry, kde automatické sloučení podle ulice + dispozice přenese stav na špatný byt.
7. **Uživatelský stav nebyl ze session ověřen** — chybí přístup k produkční DB. Než se cokoli změní, musí existovat read-only export (`sam-byt/audit/export-state-readonly.ts`).

## Střední rizika
- `decision='favorite'` vs `favorite=true` — dva paralelní „favority"; při mapování neztratit ani jeden.
- Hodnocení (`rating_price`) se vztahuje k ceně v době hodnocení; po změně ceny může být zavádějící → v UI označit změnu, hodnotu nepřepisovat.
- `/api/sam-byt/events` vrací jen 100 posledních událostí — pro zálohu historie nestačí, nutný přímý SELECT (export skript to dělá).
- Fotky na `t.rmcl.cz` s tokenem (sam-03, sam-06) mohou expirovat; nové CDN domény budou potřebovat rozšíření CSP `img-src` v `next.config.ts`.
- Hotlink obrázků může selhat (ORB); fallback existuje (`image-with-fallback.tsx`).
- Žabovřesky: `district` je typově otevřený string a názvy čtvrtí nejsou v UI/filtrech zadrátované (grep: jen typová nápověda v `sam-byt/types.ts:82`) — přidání nevyžaduje změnu kódu kromě brány.

## Backup / snapshot / rollback plán (pro následnou aktualizaci)

### Fáze 0 — snapshot (read-only, žádný zásah do aplikace)
1. `npx tsx sam-byt/audit/export-state-readonly.ts production` → `CURRENT_SAM_BYT_USER_STATE.local.json` (mimo git; uložit kopii mimo repo, např. šifrovaně na Drive).
2. Zaznamenat agregáty (`table_counts`, `summary`) do audit reportu — slouží jako baseline.
3. Neon: vytvořit **branch** z produkce (`sam-byt-pre-refresh-2026-10`) — Neon branch je copy-on-write snapshot, produkci nemění. (Ruční krok v Neon konzoli, s GO.)
4. Git tag na aktuálním `main` (`sam-byt-pre-refresh-2026-10`) — rollback kódu + katalogu.

### Fáze 1 — aditivní schéma katalogu (kód, bez DB)
- Do `Listing` přidat volitelná pole: `source_listing_refs[]`, `availability_status` (`active|reserved|rented|gone|unknown`), `archived_at`, `first_seen_at`, `last_seen_at`, `superseded_by`, `price_history[]`.
- Bránu nahradit invariantem: množina ID ⊇ ID z baseline (`sam-01…sam-11`), ID unikátní, formát `sam-\d{2,}`.
- UI: archivované byty skryté ve výchozím filtru, ale dohledatelné; stav Sama/Honzíka u nich zůstává viditelný.

### Fáze 2 — migrace 0002 (samostatný krok, explicitní GO)
- Jen rozšíření CHECK regexu na `^sam-\d{2,}$` v obou tabulkách (drop + add constraint v jedné transakci, `NOT VALID` + `VALIDATE`). Žádný DROP sloupce/tabulky, žádný UPDATE dat.
- Nejdřív preview DB, pak produkce. Před i po: `table_counts` + hash stavu (`md5(string_agg(... order by user_id, listing_id))`) se musí shodovat.

### Fáze 3 — refresh katalogu
- Matcher → diff report (MATCH/NEW/GONE) → ruční kontrola všech `MATCH_PROBABLE`, `AMBIGUOUS` a každého bytu s uživatelským stavem → GO.
- Aplikace = jen změna `listings.json` (nové záznamy přidané, `GONE` → `availability_status`, `archived_at`; nic se nemaže). DB stav se nemění.
- Deploy přes PR → preview deploy → kontrola na preview → merge.

### Rollback
| Co selže | Rollback |
|---|---|
| Katalog / UI | `git revert` merge commitu (nebo redeploy předchozího Vercel deploymentu „Promote to Production"). DB stav je netknutý, ID se nezměnila → stav se automaticky znovu spáruje. |
| Migrace 0002 | Constraint lze vrátit na původní regex jen pokud neexistují řádky `sam-12+`; jinak ponechat širší constraint (je zpětně kompatibilní). Krajní případ: Neon branch restore z Fáze 0 (ztratí změny po snapshotu → porovnat s exportem). |
| Ztráta / poškození stavu | Obnova z `CURRENT_SAM_BYT_USER_STATE.local.json` (obsahuje všechny sloupce + celou historii) nebo z Neon branch. |

### Garance
- Zachování uživatelských stavů: DB tabulky stavu se refreshem nemění, ID jsou neměnná.
- Žádné fyzické mazání: katalog jen přidává / archivuje; žádný DELETE v DB.
- Rollback: git tag + Neon branch + JSON export = tři nezávislé body obnovy.
