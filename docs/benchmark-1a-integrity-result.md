# Benchmark 1A -- Data Integrity Result

**run_id:** `a0hci8eu`
**datum:** 2026-06-04 08:54 UTC
**zdroj dat:** suggest_benchmark_runs, GitHub Actions artifact benchmark-1a-26941550426

---

## Co se testovalo

**Gatekeeper otazka:** Meni exit-IP zeme (a basic browser context) Google suggest vysledky pro stejne gl/hl/prefix?

### Trhy (3)
- `cz/cs` -- Ceska republika
- `de/de` -- Nemecko
- `ad/ca` -- Andorra (primo, bez fallbacku)

### Prefixy (8)
`a`, `ai`, `how`, `best`, `de`, `kf`, `apple`, `0o`

### Varianty
| Varianta | Popis |
|----------|-------|
| A | Produkcni chovani -- per-request globalni rotace proxy (ruzna exit IP pri kazdem requestu) |
| C | Sticky country-matched IP -- stejna zeme jako gl, produkcni headers (UA, Accept-Language) |
| D-lite | Stejna sticky session a exit IP jako C, browser-like UA a Accept-Language |

### Benchmark parametry
- Endpoint: `https://suggestqueries.google.com/complete/search`
- Query params: `client=firefox`, `gl`, `hl`, `q`
- Sticky session: IPRoyal residential proxy, `_country-{gl}` v password, lifetime 10 min
- Pauzy: 1--2 s mezi requesty
- Zadne cookies, zadna browser session

---

## Vysledky

### Pocty requestu a HTTP statusy

| Varianta | Total | HTTP 200 | 403 | Error |
|----------|-------|----------|-----|-------|
| A | 24 | 23 | 0 | 1 (cz/cs prefix `a`, pravdepodobne timeout rotujiciho proxy) |
| C | 24 | 24 | 0 | 0 |
| D-lite | 24 | 24 | 0 | 0 |

### Not-comparable dvojice
- A vs C: **1** (cz/cs, prefix `a`, varianta A mela error)
- A vs D-lite: **1** (stejna)
- C vs D-lite: **0**

### Median SET overlap (Jaccard) -- A vs C

| Trh | Comparable | Median Jaccard | Hodnoty |
|-----|-----------|---------------|---------|
| cz/cs | 7 / 8 | **0.2500** | 0.11, 0.18, 0.18, **0.25**, 0.33, 0.43, 0.82 |
| de/de | 8 / 8 | **0.4286** | 0.18, 0.33, 0.33, **0.43, 0.43**, 0.54, 0.54, 0.54 |
| ad/ca | 8 / 8 | **0.5385** | 0.11, 0.33, 0.43, **0.54, 0.54**, 0.82, 1.00, 1.00 |
| **Celkem** | **23 / 24** | **0.4286** | median ze vsech 23 hodnot |

### Median SET overlap -- A vs D-lite

Identicky s A vs C (viz tabulka vyse). Browser headers nemaji vliv na vysledky.

### Median SET overlap -- C vs D-lite

| Trh | Median Jaccard |
|-----|---------------|
| cz/cs | **1.0000** |
| de/de | **1.0000** |
| ad/ca | **1.0000** |
| Celkem | **1.0000** |

---

## Zavery

### 1. Exit IP / geolokace MENI obsah Google suggest dat

Median SET overlap A vs C = **0.4286** -- tzn. rotating a sticky country-matched proxy vracejici
suggesce, ktere se z ~57 % neprekreyvaji. CZ trh je nejcitlivejsi (0.2500), AD nejmensi rozdil
(0.5385). Vsechna cisla jsou pod rozhodovacim prahem 0.70.

**Rozhodovaci pasmo:** < 0.70 -- STOP deep crawl; zvazit restart s konzistentni metodikou.

### 2. Browser headers (UA, Accept-Language) NEMENI obsah

C vs D-lite = **1.0000** ve vsech trzich. User-Agent ani Accept-Language neovlivnuji, ktere suggesce
Google vraci. Jediny relevantni faktor je geolokace exit IP.

### 3. Zadne 403 / blokace

Varianta A (globalni rotace) mela 0 blokaci z 23 uspesnych requestu. Blokace neni hlavni problem
stavajiciho sberace.

### 4. 1 error u varianty A (cz/cs, prefix `a`)

Pravdepodobne transientni timeout na rotujicim proxy. Nevypovida o systematicke blokaci.

---

## Rozhodnuti (padla mimo tento dokument, zde jen zaznamenana)

### dataset v2 -- exploratory / noisy / mixed-geo seed pool

Tabulka `google_suggestions_v2` (~1.05M frazi) byla sbirana metodou per-request global rotation
bez country targeting. Na zaklade vysledku benchmarku je tento dataset:

- **exploratory / noisy / mixed-geo** -- NE cisty market signal
- **NEpouzivat jako presny market signal** pro country-specific analyzy
- **NEMAZAT** -- pouzitelny jako seed pool (kandidati frazi k overeni cistou metodou)

### deep crawl pres per-request global rotation je ZAKAZANY

Nova data pro market-specific analyzy NESMI byt sbirana metodou per-request global rotation.
Kazdy novy sber musi pouzivat sticky country-matched session (IPRoyal `_country-{gl}` format
overeny timto benchmarkem).

### v3 -- nova cisty sber

Novy sber bude pouzivat sticky country-matched sessions a bude ulozen do novych tabulek v3
(viz docs/v3-schema-navrh.md). Stavajici v2 zustava nezmenen.

---

*Tento benchmark nemeni produkcni crawler a nedela produkcni rozhodnuti.*
*Zdrojova data: suggest_benchmark_runs, run_id=a0hci8eu, 2026-06-04.*
