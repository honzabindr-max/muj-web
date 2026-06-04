# v3 Schema -- Navrh (ke schvaleni)

**Stav:** NAVRH -- zadna migrace, zadny CREATE TABLE v ostre DB.
**Datum navrhu:** 2026-06-04
**Kontext:** Viz docs/benchmark-1a-integrity-result.md

---

## Motivace

Dataset v2 (`google_suggestions_v2`) byl sbirany metodou per-request global rotation
(ruzna exit IP pri kazdem requestu, bez country targeting). Benchmark 1A prokaza, ze
geolokace exit IP meni obsah Google suggest dat (median Jaccard A vs C = 0.43; cz/cs = 0.25).

v3 = nova cisty sber s plnou audit trail proxy metadat per run.

---

## Principy designu

1. **Metadata runu zvlast od frazi** -- proxy/session metadata se neopakuji u kazde fraze;
   dohledavaji se pres FK `crawler_run_id`.

2. **Auditovatelnost** -- kazda fraze ma traceable provenance (ktery run, jaka proxy metoda,
   jaka exit zeme, jaka collection quality).

3. **Oddeleni clean od noisy** -- `collection_quality` na urovni runu umoznuje filtry bez
   mazani dat.

4. **v2 zustava nezmenen** -- v2 je read-only seed pool, v3 je novy cisty sber; zadne sdileni
   tabulek.

5. **Unikatnost per trh** -- UNIQUE(source, gl, hl, phrase_norm) zajistuje, ze stejna fraze
   ve dvou zemich jsou dva validni zaznamy (ruzny market signal), ale duplicity uvnitr trhu
   jsou deduplikovany.

---

## Navrhovanane tabulky

### suggest_crawler_runs_v3

Metadata jednoho crawl runu (jedna sticky session = jeden zaznam).

```sql
CREATE TABLE suggest_crawler_runs_v3 (
  crawler_run_id        text        PRIMARY KEY,
  started_at            timestamptz NOT NULL,
  finished_at           timestamptz,
  source                text        NOT NULL DEFAULT 'google',
  -- 'sticky_country_matched' | 'sticky_fallback' | 'global_rotating'
  collection_method     text        NOT NULL,
  proxy_mode            text        NOT NULL,
  requested_gl          text        NOT NULL,
  requested_hl          text        NOT NULL,
  -- zeme, pro ktere byl proxy nakonfigurovan
  requested_country     text,
  -- skutecna exit zeme overena pres ip-api.com
  exit_country          text,
  -- 'exact_match' | 'fallback' | 'unknown'
  country_match_status  text        NOT NULL DEFAULT 'unknown',
  -- 'clean' | 'degraded' | 'noisy'
  collection_quality    text        NOT NULL,
  -- SHA-256 hash exit IP (ne samotna IP -- privacy)
  exit_ip_hash          text,
  -- SHA-256 hash session ID (ne plaintext)
  session_id_hash       text,
  request_count         int         NOT NULL DEFAULT 0,
  -- 'running' | 'completed' | 'paused' | 'failed'
  status                text        NOT NULL DEFAULT 'running',
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
```

**Klice a indexy (navrh):**
```sql
CREATE INDEX idx_crawler_runs_v3_market
  ON suggest_crawler_runs_v3 (requested_gl, requested_hl, collection_quality);

CREATE INDEX idx_crawler_runs_v3_started
  ON suggest_crawler_runs_v3 (started_at DESC);
```

**Poznamky:**
- `crawler_run_id` = UUID nebo `{gl}_{hl}_{datum}_{random8}`, generovan crawlerem
- `exit_ip_hash` a `session_id_hash` jsou SHA-256 -- pouzitelne pro deduplikaci a audit
  bez ulozeni raw credentials
- `collection_quality = 'clean'` pouze pokud `country_match_status = 'exact_match'`
- `collection_quality = 'degraded'` pro fallback (schvaleny Tier B) nebo drobne odchylky
- `collection_quality = 'noisy'` pro global rotation nebo neoverene country (nemel by
  vznikat novy noisy data v v3, ale sloupec umoznuje migrace nebo emergency sber)

---

### google_suggestions_v3

Samotne fraze. Kazda fraze ma traceable provenance pres `crawler_run_id`.

```sql
CREATE TABLE google_suggestions_v3 (
  id              bigserial   PRIMARY KEY,
  crawler_run_id  text        NOT NULL REFERENCES suggest_crawler_runs_v3(crawler_run_id),
  source          text        NOT NULL DEFAULT 'google',
  gl              text        NOT NULL,
  hl              text        NOT NULL,
  phrase          text        NOT NULL,
  -- lower(btrim(regexp_replace(phrase, '\s+', ' ', 'g'))) -- stejna normalizace jako v2
  phrase_norm     text        NOT NULL,
  depth           int         NOT NULL DEFAULT 0,
  -- prefix, ktery vedl k nalezeni teto fraze
  seed_prefix     text,
  -- fraze, ktera vedla k teto frazi (BFS parent)
  parent_phrase   text,
  -- poradi ve vysledku Google (0-indexed)
  raw_position    int,
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_v3_market_phrase UNIQUE (source, gl, hl, phrase_norm)
);
```

**Klice a indexy (navrh):**
```sql
CREATE INDEX idx_suggestions_v3_market
  ON google_suggestions_v3 (gl, hl, depth);

CREATE INDEX idx_suggestions_v3_run
  ON google_suggestions_v3 (crawler_run_id);

CREATE INDEX idx_suggestions_v3_phrase
  ON google_suggestions_v3 (phrase_norm);
```

**Poznamky:**
- UNIQUE constraint je PER TRH: `(source, gl, hl, phrase_norm)` -- stejna fraze v CZ a DE
  jsou dva validni zaznamy
- `phrase_norm` = normalizovana fraze (same regex jako v2); umoznuje deduplikaci i pri
  ruznych verzeich captializace/whitespace
- `crawler_run_id` FK zajistuje, ze kazda fraze ma dohledatelny run s proxy metadaty
- `raw_position` umoznuje budouci analyzy poradi navrhu (ranking signal)

---

## collection_quality logika

| country_match_status | proxy_mode | collection_quality |
|---------------------|------------|-------------------|
| exact_match | sticky_country_matched | **clean** |
| fallback | sticky_fallback | **degraded** |
| unknown | cokoliv | **noisy** |
| exact_match | global_rotating | **noisy** (nepouzivat, ale zaznameno) |

**Pravidlo:** Do v3 jde pouze `clean` nebo schvaleny `degraded`. `noisy` data se v v3
nenachazi (jsou v2).

---

## Vztah v2 a v3

```
google_suggestions_v2    -- stavajici, read-only, mixed-geo, seed pool
  ~1.05M frazi
  bez proxy metadat
  NEmazat, NEkombinovat s v3 bez oznaceni

suggest_crawler_runs_v3  -- nova metadata runu
  |
  +-- google_suggestions_v3  -- nova cisty fraze s full provenance
```

**Pouziti v2 jako seed poolu:**
Fraze z v2 lze pouzit jako `seed_prefix` kandidaty pro v3 sber -- tzn. proverit, zda
stejna fraze existuje i pri country-matched sberani. Toto porovnani (v2 vs v3 overlap)
je validacni krok benchmarku (viz recrawl strategie nize).

---

## Navrzena recrawl strategie (text, neimplementovat)

### Faze 1 -- Tier A clean recrawl (depth 1)
- Spustit pouze pro Tier A trhy (exact country-matched proxy dostupny)
- depth 1 (roots + jeden level rozsireni), sticky country-matched session
- Ulozit do v3 s `collection_quality = 'clean'`
- Odhadovany rozsah: viz proxy_country_coverage.csv (Tier A seznam)

### Faze 2 -- Validace zjisteni z benchmarku
- Porovnat v3 (clean) vs v2 (noisy) na stejnych trzich pro stejne prefixy
- Spocitat set overlap: ocekavame ~0.43 Jaccard (v souladu s benchmarkem)
- Potvrzeni validates benchmark metodiku

### Faze 3 -- depth 2+ (pouze po schvaleni)
- Teprve po validaci Tier A depth 1 vysledku
- Rozhodnutim vedeni projektu

### Tier B trhy
- Fallback jen po rucnim schvaleni (viz proxy_country_coverage.csv)
- Ulozit s `collection_quality = 'degraded'`, `country_match_status = 'fallback'`

### Tier C trhy
- Zatim bez reseni; zaznameno, co chybi

### v2 seed pool
- Fraze z v2 pouzit jako kandidaty k overeni (ne jako hotova data)
- Nezahrnut do v3 bez overeni country-matched metodou

---

*Tento dokument je navrh ke schvaleni. Zadna migrace ani CREATE TABLE neni soucasti tohoto
dokumentu. Schvaleni a implementace jsou samostatnym krokem.*
