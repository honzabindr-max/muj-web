# Phase 2B Pilot — Eval data pull
**pilot_id:** `2b_cgyb4` | **Trhy:** us/gb/ca/nl/br (pl vynecháno) | **Datum:** 2026-06-11

---

## Runs summary

| gl | hl | status | d0_queries | d1_queries | new_phrases | dead_branches | error_rate | cap_hit | stop_reason |
|----|----|----|---:|---:|---:|---:|---:|---|---|
| br | pt | completed_cap_hit | 57 | 173 | 1 227 | 12 | 0.00 % | ✓ | max_requests_per_market |
| ca | en | completed_cap_hit | 61 | 169 | 1 440 | 2 | 0.00 % | ✓ | max_requests_per_market |
| gb | en | completed_cap_hit | 61 | 169 | 1 453 | 4 | 0.43 % | ✓ | max_requests_per_market |
| nl | nl | completed | 56 | 170 | 1 193 | 15 | 0.88 % | — | — |
| us | en | completed_cap_hit | 61 | 169 | 1 388 | 10 | 3.48 % | ✓ | max_requests_per_market |

> pl/pl: aborted_error_rate (d0=59, d1=0, error_rate=38.98%) — řeší se zvlášť.

---

## a) D1 frází per (gl, seed_category)

| gl | intent | alpha | digit | brand | **total_d1** |
|----|-------:|------:|------:|------:|-------------:|
| br | 698 | 374 | 72 | 83 | **1 227** |
| ca | 957 | 364 | 35 | 84 | **1 440** |
| gb | 967 | 361 | 36 | 89 | **1 453** |
| nl | 587 | 389 | 128 | 89 | **1 193** |
| us | 958 | 355 | 34 | 41 | **1 388** |

### D0 frází per (gl, seed_category) — pro porovnání

| gl | intent | alpha | digit | brand | **total_d0** |
|----|-------:|------:|------:|------:|-------------:|
| br | 110 | 260 | 99 | 93 | **562** |
| ca | 150 | 260 | 100 | 89 | **599** |
| gb | 150 | 260 | 100 | 85 | **595** |
| nl | 100 | 250 | 100 | 95 | **545** |
| us | 150 | 260 | 100 | 89 | **599** |

---

## b) R2 candidate flag

**Sloupec `r2_candidate_flag` (ani žádný r2* sloupec) v tabulce `suggest_pilot_2b_suggestions` NEEXISTUJE.**
R2 rate nelze spočítat z DB. Eval skript to musí detekovat sám — heuristika: `phrase_norm` obsahuje `parent_phrase_norm` jako prefix/substring (= Google expandoval frázi o slovo dál).

---

## c) Brand kategorie — d1 coverage

| gl | brand_seeds_s_d1 | total_brand_d1 | top seeds (d1 count) |
|----|---:|---:|---|
| br | 3/10 | 83 | mercado livre (43), samsung (27), revolut (13) |
| ca | 3/10 | 84 | amazon (57), samsung (18), apple (9) |
| gb | 2/10 | 89 | samsung (45), amazon (44) |
| nl | 3/10 | 89 | bol.com (62), samsung (18), apple (9) |
| us | 1/10 | 41 | amazon (41) |

> Poznámka: brand seeds pool = 10 seedů pro en/pt/nl. Většina brandů nezgenerovala unique d1 fráze (dead branches nebo pure duplicity z d0). Nízká brand seed coverage (1–3/10) je normální — brand R1/nav coverage metriku lze počítat z dostupných dat.
