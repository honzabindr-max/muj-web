# Phase 2A — úklid br/pt runu

**Datum:** 2026-06-05  
**pilot_id:** `2a_x6op9`  
**Akce:** UPDATE `suggest_depth_pilot_runs` pro br/pt (run_id=7)

---

## Provedený UPDATE

```sql
UPDATE suggest_depth_pilot_runs
SET
  status               = 'failed',
  stop_reason          = 'gha_timeout',
  notes                = 'GitHub Actions timeout after depth-0; depth-1 not completed',
  finished_at          = NOW(),
  request_count        = 14,
  depth0_query_count   = 14,
  depth1_query_count   = 0,
  depth0_suggest_count = 138,   -- zjištěno SELECT COUNT(*) ze suggestions
  cap_hit              = false
WHERE pilot_id = '2a_x6op9'
  AND gl = 'br' AND hl = 'pt'
  AND status = 'running';
```

`depth0_suggest_count=138` zjištěno přes `SELECT COUNT(*) FROM suggest_depth_pilot_suggestions WHERE run_id=7 AND depth=0`.

---

## 1. Runs pro pilot_id='2a_x6op9'

| gl/hl | status | req | d0_q | d1_q | d0_sugg | d1_sugg | new_phrases | dead | error_rate | cap | stop_reason |
|-------|--------|----:|-----:|-----:|--------:|--------:|------------:|-----:|-----------|-----|-------------|
| cz/cs | completed | 150 | 14 | 136 | 138 | 1 299 | 1 062 | 9 | 0.0000 | false | — |
| de/de | completed | 151 | 14 | 137 | 140 | 1 319 | 1 091 | 7 | 0.0000 | false | — |
| ad/ca | completed | 150 | 14 | 136 | 138 | 1 285 | 1 065 | 5 | 0.0000 | false | — |
| us/en | completed | 149 | 14 | 135 | 140 | 1 325 | 1 069 | 8 | 0.0000 | false | — |
| fr/fr | completed | 152 | 14 | 138 | 140 | 1 357 | 1 122 | 5 | 0.0000 | false | — |
| **br/pt** | **failed** | **14** | **14** | **0** | **138** | **0** | **0** | **0** | null | false | **gha_timeout** |

jp/ja: žádný run row — trh nebyl dosažen.

---

## 2. Suggestions per market / depth

| gl/hl | depth | phrases |
|-------|------:|--------:|
| ad/ca | 0 | 136 |
| ad/ca | 1 | 1 065 |
| br/pt | 0 | **138** |
| br/pt | 1 | — (0) |
| cz/cs | 0 | 136 |
| cz/cs | 1 | 1 062 |
| de/de | 0 | 137 |
| de/de | 1 | 1 091 |
| fr/fr | 0 | 138 |
| fr/fr | 1 | 1 122 |
| us/en | 0 | 135 |
| us/en | 1 | 1 069 |

br/pt: depth=0 zachycen (138 frází), depth=1 neexistuje. Konzistentní s run row.

---

## 3. Parent queries per market

| gl/hl | pq_count |
|-------|--------:|
| cz/cs | 136 |
| de/de | 137 |
| ad/ca | 136 |
| us/en | 135 |
| fr/fr | 138 |
| br/pt | — (0) |

br/pt: žádné parent_queries záznamy — depth-1 neproběhl. Správně.

---

## 4. Produkční tabulky — nedotčeny

| Tabulka | Řádky | Stav |
|---------|------:|------|
| google_suggestions_v3 | 958 | ✅ nedotčena |
| google_suggestions_v2 | 1 162 756 | ✅ nedotčena |
| crawler_control | 1 | ✅ nedotčena |
| google_crawler_state | 204 | ✅ nedotčena |

Hodnoty shodné s měřením před pilotem.

---

## Stav Phase 2A po úklidu

| Market | výsledek |
|--------|----------|
| cz/cs | ✅ completed |
| de/de | ✅ completed |
| ad/ca | ✅ completed |
| us/en | ✅ completed |
| fr/fr | ✅ completed |
| br/pt | ⚠️ failed (gha_timeout) — d0 zachován |
| jp/ja | — not reached |

**DB je konzistentní.** Žádný `status='running'` záznam pro pilot `2a_x6op9`.

---

## Rozhodnutí

5/7 trhů bráno jako uzavřený validační vzorek pro Phase 2A. br/pt + jp/ja se nedojíždí — yield 7.81–8.13× je konzistentní signál dostatečný pro rozhodnutí o depth-1 v produkci. BR/JP lze případně dojet jako doplňkový jazykový test, ne blocker.
