# Phase 2A Depth-1 Pilot — výsledky

**Datum:** 2026-06-05  
**GitHub Actions run ID:** `27015280164`  
**Commit hash:** `073af32`  
**pilot_id:** `2a_x6op9`  
**Workflow status:** ⚠️ `timed_out` (45 min limit) — 5/7 trhů dokončeno, br/pt depth-0 zachycen, jp/ja nedosažen

---

## Per-market výsledky

| Market | exit_cc | status | req | d0_q | d1_q | d0_sugg | d1_sugg | new_phrases | dead | err_rate | cap |
|--------|---------|--------|----:|-----:|-----:|--------:|--------:|------------:|-----:|----------|-----|
| cz/cs | CZ | ✅ completed | 150 | 14 | 136 | 138 | 1 299 | 1 062 | 9 | 0.00 % | — |
| de/de | DE | ✅ completed | 151 | 14 | 137 | 140 | 1 319 | 1 091 | 7 | 0.00 % | — |
| ad/ca | AD | ✅ completed | 150 | 14 | 136 | 138 | 1 285 | 1 065 | 5 | 0.00 % | — |
| us/en | US | ✅ completed | 149 | 14 | 135 | 140 | 1 325 | 1 069 | 8 | 0.00 % | — |
| fr/fr | FR | ✅ completed | 152 | 14 | 138 | 140 | 1 357 | 1 122 | 5 | 0.00 % | — |
| br/pt | BR | ⚠️ killed (d0 only) | — | — | — | 138 | — | — | — | — | — |
| jp/ja | — | ⚠️ not reached | — | — | — | — | — | — | — | — | — |

**Legenda:** `d0_q` = depth-0 queries (seedy), `d1_q` = depth-1 queries (parenti), `d0_sugg` / `d1_sugg` = raw returned phrases, `new_phrases` = nové unikátní fráze přidané depth-1 (po dedup), `dead` = dead branches

---

## Celkové výsledky (5 dokončených trhů)

| Metrika | Hodnota |
|---------|--------:|
| d0 unikátní fráze | **682** |
| d1 nové fráze | **5 409** |
| **Yield ratio (d1 / d0)** | **≈ 7.93 ×** |
| Dead branches | **34** (≈ 5 % requestů) |
| Celkem requests | **752** |
| Error rate | **0.00 %** |

### Yield per market

| Market | d0_unique | d1_new | yield ratio | avg new/req |
|--------|----------:|-------:|------------:|------------:|
| cz/cs | 136 | 1 062 | 7.81 × | 7.81 |
| de/de | 137 | 1 091 | 7.96 × | 7.96 |
| ad/ca | 136 | 1 065 | 7.83 × | 7.83 |
| us/en | 135 | 1 069 | 7.92 × | 7.92 |
| fr/fr | 138 | 1 122 | 8.13 × | 8.13 |
| **avg** | **136.4** | **1 081.8** | **7.93 ×** | **7.93** |

---

## Top 10 parentů (nejvyšší new_phrase_count)

| gl/hl | parent_phrase | origin_seed | new | dup | returned | dead? |
|-------|---------------|-------------|----:|----:|--------:|-------|
| cz/cs | 0or | 0o | 10 | 0 | 10 | ✗ |
| ad/ca | andorra telecom | a | 9 | 1 | 10 | ✗ |
| ad/ca | andbus | a | 9 | 1 | 10 | ✗ |
| ad/ca | andorra difusio | a | 9 | 1 | 10 | ✗ |
| ad/ca | air nostrum | a | 9 | 1 | 10 | ✗ |
| ad/ca | andbank | a | 9 | 1 | 10 | ✗ |
| ad/ca | air europa | ai | 9 | 1 | 10 | ✗ |
| ad/ca | airbnb | ai | 9 | 1 | 10 | ✗ |
| ad/ca | as | a | 9 | 1 | 10 | ✗ |
| ad/ca | aixirivall | ai | 9 | 1 | 10 | ✗ |

---

## Top 10 dead / low-yield branches

| gl/hl | parent_phrase | origin_seed | new | dup | returned | dead? |
|-------|---------------|-------------|----:|----:|--------:|-------|
| de/de | apple | apple | 0 | 10 | 10 | ✓ |
| de/de | ai | ai | 0 | 10 | 10 | ✓ |
| cz/cs | jak | jak | 0 | 10 | 10 | ✓ |
| cz/cs | best | best | 0 | 10 | 10 | ✓ |
| de/de | 0o | 0o | 0 | 10 | 10 | ✓ |
| cz/cs | 0o | 0o | 0 | 10 | 10 | ✓ |
| cz/cs | apple | apple | 0 | 10 | 10 | ✓ |
| cz/cs | amazon | amazon | 0 | 10 | 10 | ✓ |
| ad/ca | amazon | a | 0 | 10 | 10 | ✓ |
| de/de | youtube | youtube | 0 | 10 | 10 | ✓ |

**Vzorec dead branches:** vždy 1-gram seedy (apple, youtube, amazon, best, 0o, jak) — jejich d0 výsledky jsou identické s d1 výsledky, takže nic nového nepřidají. Tento vzorec je konzistentní napříč trhy.

---

## DB stav po běhu

### Pilot tabulky (zápis povolen)

| Tabulka | Řádky |
|---------|------:|
| suggest_depth_pilot_runs | 6 (5 completed + 1 running/br) |
| suggest_depth_pilot_suggestions | 5 + 6 trhů × d0+d1 |
| suggest_depth_pilot_parent_queries | 5 trhů × ~136 requestů |

### Produkční tabulky (nesmí být dotčeny)

| Tabulka | Řádky | Stav |
|---------|------:|------|
| google_suggestions_v3 | 958 | ✅ nedotčena |
| google_suggestions_v2 | 1 162 756 | ✅ nedotčena |
| crawler_control | 1 | ✅ nedotčena |
| google_crawler_state | 204 | ✅ nedotčena |

---

## Bezpečnostní potvrzení

- ✅ Credentials (`PROXY_URL`, `SUPABASE_KEY`) maskované jako `***` v GHA logu
- ✅ `exit_ip` nikde v logu ani DB — logováno pouze `exit_cc=XX`
- ✅ Produkční crawler nedotčen (workflow manuální, žádný schedule)
- ✅ Artifact `phase-2a-pilot-summary.json` nevygenerován (script zabit před `write_summary()`)

---

## Příčina timeoutu

Workflow limit: **45 min**. Celková délka 7 trhů: **~50+ min**.

| Market | trvání |
|--------|-------:|
| setup + IP checks | ~5 min |
| cz/cs | ~6 min |
| de/de | ~7 min |
| ad/ca | **~12 min** ← outlier (Andorra proxy latence) |
| us/en | ~6 min |
| fr/fr | ~7 min |
| pauzy mezi trhy | ~4 min |
| **Celkem** | **~47 min** |

ad/ca trvá 2× déle kvůli vyšší proxy latenci do Andorry.

---

## Nedokončené trhy

### br/pt (Brazil, Portuguese)
- Depth-0: **138 frází** zapsáno do `suggest_depth_pilot_suggestions`
- Run row (`run_id=7`): status=`running`, všechny countery na 0 (script zabit před `update_run_row()`)
- Depth-1: nespuštěno

### jp/ja (Japan, Japanese)
- Nic nespuštěno, žádná data v DB

---

## Závěr a doporučení

### Klíčový výsledek
Depth-1 přidává **~7.93× více unikátních frází** než depth-0 při nulovém error rate. Yield je konzistentní napříč všemi trhy (7.81–8.13×). Tento výsledek je silný argument pro zahrnutí depth-1 do produkčního crawleru.

### Dead branches
~5 % depth-1 requestů jsou dead branches — vždy 1-gram seedy, které Google vrací identicky jako v d0. Tyto lze v produkci přeskočit (saved ~5 % requestů).

### Otevřené otázky
1. **Stačí 5/7 trhů?** Yield ~7.9× je velmi konzistentní — br/pt a jp/ja pravděpodobně nepřinesou překvapení.
2. **Dokončit br/pt + jp/ja?** Možnosti:
   - (a) Zvýšit timeout na **65 min** a spustit nový run pro zbývající 2 trhy (nový `pilot_id`)
   - (b) Zvýšit timeout na **65 min** a opakovat celý 7-market run v novém pilot_id
   - (c) Přijmout 5/7 jako dostatečný vzorek pro rozhodnutí o depth-1 v produkci

### Technická poznámka: br/pt run row
`run_id=7` má status=`running` v DB. Před dalším pilot runem je dobré ho manuálně nastavit na `aborted`:
```sql
UPDATE suggest_depth_pilot_runs
SET status = 'aborted', stop_reason = 'gha_timeout', finished_at = NOW()
WHERE run_id = 7;
```
