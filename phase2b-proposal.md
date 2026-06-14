# Phase 2B — produkční strategie Tier A clean crawler

**Datum:** 2026-06-05  
**Vstupní data:** Phase 2A pilot (`2a_x6op9`), 5/7 trhů, yield 7.81–8.13×  
**Stav:** návrh — nic nespouštět, žádné DB změny

---

## 1. Metodika depth-0 + depth-1

### Princip (ověřeno Phase 2A)

```
Pro každý market (gl/hl):
  1. IP check — ověření sticky country proxy
  2. depth-0: 14 seedů → unique fráze do seen-setu
  3. select_parents(): top N frází z depth-0 jako parenti pro depth-1
  4. depth-1: každý parent jako query → nové fráze filtrované seen-setem
  5. Zápis do DB (depth-0 hned po dokončení, depth-1 po market loop)
```

### Seed list (14 seedů, beze změny z Phase 2A)
`a, ai, how, best, de, kf, apple, 0o, s, b, jak, wie, youtube, amazon`

Seed list je záměrně heterogenní — single-char (geo-specifické) + global brand (stabilní baseline) + language-specific (jak, wie). Pro Tier A produkci beze změny.

### Dedup
- intra-run seen-set per market přes depth-0 + depth-1
- DB ON CONFLICT `(pilot_id, source, gl, hl, phrase_norm)` — ignore-duplicates

---

## 2. Request/cost model pro 172 Tier A trhů

### Parametry odvozené z Phase 2A

| Parametr | Phase 2A hodnota | Použito v modelu |
|----------|-----------------|-----------------|
| d0_unique per market | 135–138 | **136** (průměr) |
| yield (d1_new / d1_req) | 7.81–8.13 | **7.93** |
| dead branch rate | 3.6–6.6 % | **5 %** |
| avg latency per request | ~1.1 s | **1.1 s** |
| error rate | 0.00 % | **0 %** |
| time per market | 6–7 min | **7 min** (+10 % rezerva) |
| outlier markets (malé země) | ad/ca ~12 min | viz batch plán |

### Request budget pro 172 trhů

| Leg | Výpočet | Počet requestů |
|-----|---------|---------------:|
| IP checks | 172 × 1 | **172** |
| depth-0 | 14 seeds × 172 | **2 408** |
| depth-1 raw | 136 parents × 172 | 23 392 |
| depth-1 po skip rule | × 0.95 | **~22 222** |
| **Celkem** | | **~24 802** |

### Objem frází (odhad)

| | Výpočet | Fráze |
|-|---------|------:|
| d0 unique | 136 × 172 | ~23 400 |
| d1 new | 7.93 × ~22 222 | ~176 200 |
| **Celkem nových frází** | | **~199 600** |

### Proxy a runtime náklady

| Metrika | Odhad |
|---------|-------|
| Celkový čas crawlu | 172 × 7 min = **1 204 min (~20 h)** |
| Data přenesená (est.) | 24 802 req × 3.5 KB = **~87 MB** |
| GHA compute (ubuntu-latest) | ~20 h × $0.008/min = **~$9.60** |
| IPRoyal proxy | měsíční subscription — hlavní náklad je čas (subscription běží dál) |

> IPRoyal subscription: **zrušit ihned po dokončení full crawlu** (viz CLAUDE.md).

---

## 3. Limity per market

Odvozeny z Phase 2A + margin pro produkci:

```python
MAX_DEPTH                             = 1
MAX_DEPTH1_PARENT_QUERIES_PER_MARKET  = 140   # min(d0_unique, 140)
MAX_DEPTH1_CHILDREN_PER_PARENT        = 10
MAX_REQUESTS_PER_MARKET               = 180   # 14 d0 + 140 d1 + 26 rezerva
ERROR_RATE_STOP                       = 0.15  # po min. 10 requestech
ERROR_RATE_MIN_REQUESTS               = 10
GLOBAL_STOP_FAILED_MARKETS            = 5     # větší batch → benevolentnější
GLOBAL_CAP_REQUESTS                   = 4 800 # 25 markets × 180 + rezerva
DB_CHUNK_SIZE                         = 500
```

`GLOBAL_CAP_REQUESTS` se nastavuje per-batch (viz sekce 5).

---

## 4. Skip pravidlo: dead parents

### Problém
Phase 2A ukázala, že ~5 % depth-1 requestů jsou dead branches — fráze, které Google vrátí identicky jako v depth-0. Nejčastější vzorec: parent_phrase je přesně jeden ze 14 seedů.

### Skip rule A — přesná shoda se seedem

```python
SEED_NORMS = {normalize(s) for s in SEED_PREFIXES}

# V select_depth1_parents():
if parent_phrase_norm in SEED_NORMS:
    skip  # parent == seed → 100% duplicity jisté
```

Zachytí: `apple`, `youtube`, `amazon`, `best`, `jak`, `wie`, `ai` (single-char seed), `0o` atd.

**Úspora: ~3–5 requestů per market (2–4 %)**

### Skip rule B — parent == origin_seed (subset A)

```python
if parent_phrase_norm == normalize(origin_seed):
    skip
```

Méně agresivní varianta — přeskočí pouze frázi přesně rovnou jejímu vlastnímu origin seedu. Bezpečnější, ale zachytí méně.

### Doporučení

Použít **skip rule A** (SEED_NORMS set). Důvod: pokud fráze je přesně jeden ze seedů, byl na ni dotazován vlastní depth-0 request a jeho výsledky jsou v seen-setu. Dotaz by vrátil 100% duplicity bez výjimky.

Skip rule **nereplace** dead branch detekci — dead branches se stále logují zpětně pro analýzu (některé nejsou předvídatelné).

---

## 5. Batchování: regiony nebo prioritní trhy

### Proč batche
GHA `timeout-minutes` max = **360 min (6 h)**. Při 7 min/market = **max ~50 markets per job**. 172 / 50 = **4 jobs minimum**.

### Varianta A — Batch po 25 markets (doporučeno pro start)

| Batch | Markets | Odhadovaný čas | GHA job |
|-------|---------|----------------|---------|
| 1 — pilot subset | 20 trhů | ~2.5 h | samostatný |
| 2 — EU West | 25 trhů | ~3.2 h | |
| 3 — EU East + LatAm | 25 trhů | ~3.2 h | |
| 4 — APAC | 25 trhů | ~3.8 h (JP latence) | |
| 5 — MENA + ostatní | 25 trhů | ~3.2 h | |
| 6 — zbývající | ~22 trhů | ~2.8 h | |

Každý batch = 1 GHA workflow run s vlastním `pilot_id` a `batch_id`.

### Varianta B — Batch podle priority (alternativa)

```
Tier A-1 (top 20 markets by value): en, de, fr, es, pt, ja, ko, zh, nl, it,
                                      pl, ru, sv, tr, ar, cs, hu, da, fi, no
Tier A-2: dalších ~50 markets
Tier A-3: zbývající
```

Tier A-1 se crawluje první a samostatně — pokud pipeline selže, máme data z nejhodnotnějších trhů.

### Doporučení: nejprve 20-market pilot subset

Spustit **Batch 1 jako verifikační krok** před full 172-market crawlem (viz sekce 8).

---

## 6. Timeout / runtime plán

### Per-market timing (worst case)

| Fáze | Čas |
|------|-----|
| IP check + retry | 5–15 s |
| depth-0 (14 seeds × 1.5 s incl. pauza) | ~21 s |
| DB write d0 | ~1 s |
| depth-1 (135 parents × 1.5 s) | ~203 s |
| DB write d1 + pq | ~2 s |
| Pauza mezi markety | 8–15 s |
| **Celkem per market** | **~4.5–4.2 min** |

> Phase 2A reálně: 6–7 min per market (Python overhead, proxy jitter, GHA runner).  
> Ad/ca outlier: 12 min — Andorra proxy vyšší latence. Podobné může nastat pro jiné malé/exotické markety (mv, bt, tl...).

### Nastavení timeoutů

```yaml
# Per batch (25 markets):
timeout-minutes: 240   # 4 h — rezerva pro outlier markets

# Pro APAC batch (JP latence):
timeout-minutes: 300   # 5 h
```

### Ochrana před překročením

```python
# Soft limit: před spuštěním dalšího marketu zkontroluj elapsed čas
SOFT_TIMEOUT_MINUTES = 210  # 3.5 h — pokud překročen, uzavři batch gracefully

if elapsed_minutes > SOFT_TIMEOUT_MINUTES:
    print(f"SOFT TIMEOUT: {elapsed_minutes:.1f} min, ukončuji batch")
    break  # nezačínat další market, zapsat summary a artifact
```

Soft timeout zajistí, že script sám dokončí aktuální market a zapíše artifact před GHA killem.

---

## 7. Monitoring a abort logika

### Market-level abort (zachovat z Phase 2A)

```python
ErrorTracker:
  - kumulativní per market (d0 + d1 dohromady)
  - stop when: total >= 10 AND rate >= 0.15
  - po abortu: market_status = 'aborted_error_rate', pokračuj dalším
```

### Batch-level abort

```python
GLOBAL_STOP_FAILED_MARKETS = 5   # 5 failed/aborted → abort celý batch
GLOBAL_CAP_REQUESTS = batch_size × 180 + 200  # per-batch cap
```

### IP mismatch handling

```python
# Phase 2A: IP mismatch → skip market, log, pokračuj
# Phase 2B produkce: stejné chování, ale NAVÍC:
IP_MISMATCH_RETRY = 1   # 1 retry s novou session_id před skipem
```

### Artifact (povinný pro produkci)

JSON artifact se generuje vždy (`if: always()`), i při partial run nebo abort:

```json
{
  "batch_id": "b1_XXXXX",
  "pilot_id": "prod_XXXXX",
  "batch_name": "eu-west-25",
  "started_at": "...",
  "finished_at": "...",
  "soft_timeout_hit": false,
  "markets_attempted": 25,
  "markets_completed": 24,
  "markets_failed": 1,
  "totals": {
    "d0_unique": 3400,
    "d1_new": 27000,
    "dead_branches": 170,
    "total_requests": 4250
  },
  "markets": [...]
}
```

### Telegram notifikace (doporučeno)

Po každém dokončeném batchnotu pošli summary do Telegram botu (existující infrastruktura):

```
✅ Phase 2B Batch 1 dokončen
Trhy: 20/20 completed
d0: 2720 frází | d1 new: 21600 frází
Čas: 2h 38min | Requests: 4080
```

---

## 8. Doporučení: začít 20-market pilot subsetem

### Proč ne rovnou 172

1. **Pipeline verifikace**: Phase 2A používala pilotní tabulky. Phase 2B píše do produkčních tabulek (`google_suggestions_v3` nebo nová schema). Schema migrace musí proběhnout a být ověřena na malém vzorku.
2. **Outlier discovery**: Některé Tier A markety mohou mít extrémní latenci, nulový autocomplete (prázdné odpovědi), nebo geo-specifické blokády. 20-market run ukáže distribuci.
3. **Cost control**: Proxy subscription — neplatit za chyby v plném běhu.
4. **Soft timeout kalibrace**: Ověřit, že 240 min timeout na 25 markets je reálný.

### Doporučený 20-market pilot subset (Tier A-1)

Top jazyky podle coverage v stávající v2 databázi + geo-diversita:

| # | gl | hl | region |
|---|----|----|--------|
| 1 | us | en | NA |
| 2 | gb | en | EU West |
| 3 | de | de | EU West |
| 4 | fr | fr | EU West |
| 5 | es | es | EU South |
| 6 | it | it | EU South |
| 7 | pl | pl | EU East |
| 8 | cz | cs | EU East |
| 9 | nl | nl | EU West |
| 10 | se | sv | EU North |
| 11 | br | pt | LatAm |
| 12 | mx | es | LatAm |
| 13 | jp | ja | APAC |
| 14 | kr | ko | APAC |
| 15 | au | en | APAC |
| 16 | in | en | APAC |
| 17 | tr | tr | MENA |
| 18 | sa | ar | MENA |
| 19 | za | en | Africa |
| 20 | ca | en | NA |

Tento subset pokrývá 10 jazyků, 6 regionů, ~60 % hodnoty Tier A.

### Rozhodovací kritéria po pilot subsetu

| Výsledek | Rozhodnutí |
|----------|-----------|
| ≥18/20 completed, yield ≥6×, error rate <5% | ✅ Spustit full 172 |
| 15–17/20, yield ≥5×, lokalizované problémy | ⚠️ Opravit problémové markety, pak spustit |
| <15/20 nebo yield <4× | ❌ Investigovat, neposouvat |

---

## 9. Otevřené otázky před implementací

1. **Cílová tabulka**: Psát do `google_suggestions_v3` (rozšířit schéma o `depth` sloupec), nebo nová produkční tabulka `google_suggestions_v4`? V3 má zatím jen 958 řádků — pravděpodobně testovací.

2. **Deduplikace vůči existujícím datům**: Mají se depth-1 fráze dedupovat i proti stávajícím v2 datům (1.16M frází), nebo pouze intra-run?

3. **Paralelizace**: Phase 2A: sekvenční market-by-market. Phase 2B: lze spustit paralelní GHA jobs pro různé batche (různé market subsets). Sdílená DB jako synchronizační bod.

4. **Run tracking**: Zachovat `suggest_depth_pilot_runs` schéma pro produkční logy, nebo vytvořit `google_crawl_runs` tabulku s rozšířenými metadaty?

5. **skip_rule implementace**: Verifikovat, že `SEED_NORMS` skip pravidlo nekollizuje s legitimate parenty — např. "amazon" jako parent z seed "a" pro menší market kde Amazon není lokálně dominantní (potenciálně nové fráze). Možná bezpečnější: skip pouze pokud `origin_seed == parent_phrase_norm`.

---

## Shrnutí

| Oblast | Rozhodnutí |
|--------|-----------|
| Metodika | depth-0 + depth-1, 14 seedů, sticky country proxy |
| Celkové requesty (172 trhů) | ~24 800 |
| Odhadované nové fráze | ~199 600 |
| Skip pravidlo | parent_phrase_norm in SEED_NORMS |
| Batch velikost | 20–25 markets / job |
| Timeout per job | 240–300 min |
| Soft timeout | 210 min (graceful exit) |
| Start strategie | **20-market pilot subset**, pak full 172 |
| Monitoring | artifact JSON + Telegram notifikace |
| Blokery před spuštěním | cílová tabulka, dedup strategie vůči v2 |
