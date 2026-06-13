# S3 Read Cutover Report — 2026-06-13

## Scope
Dashboard/Vercel čte přes Hetzner proxy místo přímo Supabase.
Env flag `SUGGEST_READ_SOURCE=supabase|hetzner_proxy`, default `supabase` (beze změny bez Vercel akce).

## Závislosti splněny před implementací
- **F1B Shadow Read PASS** (2026-06-13): suggestions DELTA=0, všech 5 tabulek shoda Supabase↔Hetzner
- **F2 S3 prod smoke PASS** (2026-06-13, commit 909dc56): 9/9 smoke, proxy https://suggest.good-inventions.work

---

## Diff summary — co se změnilo

### Nové soubory
| Soubor | Popis |
|--------|-------|
| `lib/suggest-reader.ts` | Server-side modul: reads SUGGEST_READ_SOURCE, routes reads, fallback logic |
| `app/api/suggest/dashboard-rows/route.ts` | API route → readDashboardRows() |
| `app/api/suggest/dashboard-state/route.ts` | API route → readDashboardState() |
| `app/api/suggest/new-phrases-24h/route.ts` | API route → readNewPhrases24h() |

### Upravené soubory
| Soubor | Co se změnilo |
|--------|---------------|
| `app/suggest/_hooks/use-dashboard-data.ts` | `supabase.rpc(...)` → `fetch('/api/suggest/...')` (3 volání) |
| `.env.local` | Přidány SUGGEST_READ_SOURCE=supabase + prázdný SUGGEST_PROXY_TOKEN (placeholder) |

### Realtime — beze změny
Supabase Realtime WebSocket zůstává pro triggery postgres_changes. Data pak jdou přes `/api/suggest/dashboard-state` (server route). Token se Realtime kanálu NETÝKÁ.

---

## Dashboard smoke — oba režimy

### Supabase mode (SUGGEST_READ_SOURCE=supabase)
| Endpoint | Rows | Status |
|----------|------|--------|
| /api/suggest/dashboard-rows | 205 | ✓ PASS |
| /api/suggest/dashboard-state | 204 | ✓ PASS |
| /api/suggest/new-phrases-24h | 0 | ✓ PASS |

Matches F1B + F2 smoke (205 rows / 204 state / 0 new-phrases-24h).

### Hetzner proxy mode (SUGGEST_READ_SOURCE=hetzner_proxy)
Plný test s reálným tokenem: **ČEKÁ NA VERCEL GO-1 (Honzík).**
F1B+F2 already verified: data identická se Supabase, proxy 9/9 smoke PASS.

---

## Fallback test — PASS

Config: `SUGGEST_READ_SOURCE=hetzner_proxy SUGGEST_PROXY_TOKEN=INVALID_TEST`

| Endpoint | Výsledek | Log |
|----------|----------|-----|
| /api/suggest/dashboard-rows | 205 rows (supabase fallback) | `proxy HTTP 403` |
| /api/suggest/dashboard-state | 204 rows (supabase fallback) | `proxy HTTP 403` |

Fallback log: `[suggest-reader] proxy error, falling back to supabase: proxy HTTP 403`
- Žádná hodnota tokenu v logu ✓
- Fallback vrátil správný počet řádků ✓

**Fallback expiry task:** Odstranit fallback kód po S3 PASS (cutover v Vercelu) + 7 dní.
Kdo: Code (git). Trigger: Honzík potvrdí S3 PASS.

---

## Token-leak grep — CLEAN

```
grep -r "SUGGEST_PROXY_TOKEN|SUGGEST_READ_SOURCE|suggest-reader|proxyFetch|hetzner_proxy" .next/static/
```
Výsledek: **0 matches** — žádný server-only kód ani env var název v client bundlu.

---

## Vercel env instrukce pro Honzíka (GO-1)

### Krok 1 — přidat SUGGEST_PROXY_TOKEN (server-side, secret)
1. Vercel Dashboard → muj-web-next → Settings → Environment Variables
2. Add Variable:
   - Name: `SUGGEST_PROXY_TOKEN`
   - Value: (vezmi z Hetzner serveru: `cat /etc/suggest-proxy/.env | grep SUGGEST_PROXY_TOKEN`)
   - Environment: Production ✓ (Preview volitelné, Development NE)
   - **Unchecked "Expose to browser"** — musí být server-only
3. Save

### Krok 2 — přepnout na proxy
1. Ve stejném Settings → Environment Variables najdi (nebo přidej) `SUGGEST_READ_SOURCE`
2. Value: `hetzner_proxy`
3. Environment: Production ✓
4. Save → klikni "Redeploy" (nebo pushni prázdný commit)

### Krok 3 — ověření po deployi
```
curl https://good-inventions.work/api/suggest/dashboard-rows | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{len(d)} rows')"
```
Očekávaný výsledek: `205 rows`

### Rollback (kdykoli, reverzibilní)
Stačí přepnout `SUGGEST_READ_SOURCE` zpět na `supabase` ve Vercel → Redeploy.
**Žádný git revert, žádný kód není potřeba.**

---

## Build evidence
- Build: `npm run build` — ✓ Compiled successfully in 1055ms
- TypeScript: ✓ Finished in 865ms
- Routes: `/api/suggest/dashboard-rows` ƒ, `/api/suggest/dashboard-state` ƒ, `/api/suggest/new-phrases-24h` ƒ (Dynamic server-rendered ✓)
- Token leak grep: CLEAN
- Date: 2026-06-13
