# Layer 2C-2 v1: CZ Entity / Keyword Demand Map — Report

**Datum:** 2026-06-12
**Korpus:** cz_strict (gl=cz, hl=cs, diacritic filter)
**Commit:** 5e38f51

---

## CSV výstupy

| Soubor | Řádků |
|--------|-------|
| `layer_2c_cz_entity_inventory.csv` | 66 504 |
| `layer_2c_cz_head_term_clusters.csv` | 29 484 |
| `layer_2c_cz_token_ngram_frequency.csv` | 4 000 (2k tokens + 2k bigramů) |
| `layer_2c_cz_opportunity_candidates.csv` | 90 |
| `layer_2c_v1_audit.csv` | 16 |

---

## Top 15 head terms (podle počtu frází)

| Head term | Frází | Poznámka |
|-----------|-------|---------|
| zš | 246 | základní škola |
| účet | 91 | bankovní / online účty |
| čd | 71 | České dráhy |
| sb | 71 | zkratka |
| ad | 64 | zkratka |
| týden | 63 | časový kontext |
| andělská | 59 | pravděpodobně adresa/lokalita |
| ac | 59 | zkratka |
| kč | 58 | cenotvorba / CZK queries |
| mš | 57 | mateřská škola |
| čt | 54 | Česká televize |
| jiří | 52 | jméno |
| martin | 51 | jméno |
| mudr | 51 | zdravotní intent |
| jan | 50 | jméno |

---

## Top 15 opportunity klastrů (opportunity_relevance_score)

| Cluster | Score | Commercial signal | Počet frází |
|---------|-------|-------------------|-------------|
| zš | 0.317 | 0.00 | 246 |
| řidičák | 0.152 | 0.21 | 38 |
| účet | 0.111 | 0.00 | 91 |
| čd | 0.109 | 0.03 | 71 |
| kč | 0.105 | 0.07 | 58 |
| mš | 0.098 | 0.00 | 57 |
| psč | 0.095 | 0.00 | 45 |
| ac | 0.094 | 0.02 | 59 |
| sb | 0.087 | 0.00 | 71 |
| ad | 0.086 | 0.02 | 64 |
| týden | 0.077 | 0.00 | 63 |
| ženy | 0.074 | 0.10 | 20 |
| nn | 0.074 | 0.10 | 20 |
| andělská | 0.072 | 0.00 | 59 |
| ah | 0.068 | 0.02 | 42 |

---

## 3 největší zjištění

### 1. Komerční záměr je vzácný, ale čistý (1,0 % frází)
Pouze 693 frází z 66 504 nese komerční modifier (cena, koupit, sleva…). High-precision signál kupní fáze. Nejsilnější cluster: **řidičák** (21 % frází komerčních) — autoškoly, ceny kurzů, srovnání.

### 2. Dominují institucionální zkratky, ne produkty
Top head terms jsou `zš`, `mš`, `čd`, `mudr`, `čt` — veřejné instituce a zkratky. CZ diacritic queries jsou silně info-intent orientované. Produktový prostor je až níže v longtailu.

### 3. Lokální intent na 1,9 %, geograficky koncentrovaný
1 244 frází nese lokalizační token (Praha, Brno, Ostrava…). Praha dominuje. Pro regionální obsahovou strategii (Brno, Ostrava) je méně obsazený prostor.

---

## Audit (guardrail)

| Check | Výsledek |
|-------|---------|
| corpus_scope | cz_strict |
| phrase_count | 66 504 |
| precision_mode | high |
| recall_mode | intentionally_low |
| not_full_market_census | true |
| excluded_segments | no_diacritic; cz_soft_unanchored; foreign_leakage; cz_soft_clean |
| distinct_head_terms_clean | 29 484 |
| commercial_phrases | 693 |
| local_phrases | 1 244 |
| question_phrases | 300 |
| opportunity_candidates | 90 |

---

## Evidence

- Commit: `5e38f51` (branch: main)
- DB: READ-ONLY, 66 504 řádků ověřeno
- Push: čeká na autora
