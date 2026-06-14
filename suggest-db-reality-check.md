# suggest-db — Reality check (před stavbou monitoringu)

**Projekt:** suggest-db (repo `muj-web`) — crawler suggestion frází ze Seznamu a Googlu, data v Supabase, dashboard na `/suggest`
**Supabase project ref:** `tjwumduiadkpzigmerza`
**Datum kontroly:** 2026-05-30
**Rozsah:** pouze čtení, nic neměněno

---

## 1. Supabase

### Počty řádků
| Tabulka | Řádků |
|---|---|
| `suggestions` (Seznam) | **130 504** |
| `google_suggestions` (Google) | **578 776** |
| **Celkem** | **709 280** |

> Pozn.: CLAUDE.md mluví o „233k+ frází" — realita je **3× víc** (709k). Ta poznámka je zastaralá.

### `crawl_state` (Seznam, id=1)
| status | current_prefix | processed | queue_size | started_at | updated_at | count_after |
|---|---|---|---|---|---|---|
| `running` | `lzčý` | 188 071 | 843 180 | 2026-03-24 17:29 | **2026-05-26 07:02** | 130 504 |

### `google_crawl_state` (Google, id=1)
| status | current_prefix | processed | queue_size | started_at | updated_at | count_after |
|---|---|---|---|---|---|---|
| `running` | `aftt` | 15 058 | 3 070 444 | 2026-03-25 08:45 | **2026-05-25 23:58** | 578 776 |

### `runs` (posledních 5)
| id | root_prefix | started_at | finished_at | status | queries | new |
|---|---|---|---|---|---|---|
| 5 | `auto` | 2026-03-24 17:17 | — | `running` | 19 | 166 |
| 4 | `a,á,b,c,…` | 2026-03-24 16:22 | 2026-03-24 17:08 | `completed` | 1 | 9 |
| 3 | `jak` | 2026-03-24 15:50 | 2026-03-24 15:50 | `completed` | 1 | 0 |
| 2 | `jak` | 2026-03-24 15:46 | — | `running` | 0 | 0 |
| 1 | `jak` | 2026-03-24 15:40 | — | `running` | 0 | 0 |

---

## 2. Jak dashboard `/suggest` čte data

- **Soubor:** `app/suggest/_hooks/use-crawl-data.ts` (+ `app/suggest/page.tsx`)
- **Žádný API endpoint / route handler.** Dashboard čte **přímo z prohlížeče** přes Supabase JS klient (`@/lib/supabase`), anon key, polling **každé 3 s**.
- Pro každý engine (`fetchEngine`) dělá 3 dotazy paralelně:
  1. **count** — `from(table).select("*", {count:"exact", head:true})` → počet řádků
  2. **stav** — `from(stateTable).select("*").eq("id",1).single()` → celý řádek `crawl_state` / `google_crawl_state`
  3. **recent** — `from(table).select("id, phrase").order("id",{ascending:false}).limit(8)` → posledních 8 frází, `latest` = nejnovější
- Tabulky: `suggestions` + `crawl_state`, `google_suggestions` + `google_crawl_state`.
- **Tabulku `runs` dashboard vůbec nečte.** Stav („běží/neběží", progress) odvozuje výhradně z `crawl_state.status` / `updated_at` / `processed` / `queue_size`.

---

## 3. GitHub Actions workflowy (crawlery)

| Soubor | Cron | Interval | Spouští |
|---|---|---|---|
| `.github/workflows/crawl.yml` ("Auto Crawl") | `*/30 * * * *` | každých **30 min** | `crawler_auto.py` (Seznam) |
| `.github/workflows/crawl_google.yml` ("Google Crawl") | `*/40 * * * *` | každých **40 min** | `crawler_google.py` (Google) |

Oba: count_before → run crawler → count_after, zápis do `crawl_state`/`google_crawl_state` přes `save_count.py`, Telegram notifikace. **Ani jeden nezapisuje do tabulky `runs`** — všechny kroky kromě samotného crawleru mají `continue-on-error: true`.

---

## Shrnutí reality

- **Dat je v DB hodně a sedí:** 130,5k Seznam + 578,8k Google = **709k frází**. `count_after` v obou state tabulkách přesně odpovídá počtu řádků.
- **Crawlery ale ~4 dny nic nedělají.** Poslední zápis do DB: **Seznam 26. 5. 07:02**, **Google 25. 5. 23:58** — přitom cron je každých 30/40 min. Dnes je 30. 5., takže od 25.–26. 5. **nic neproběhlo**. Cron buď GitHubem vypnutý (Actions automaticky deaktivuje scheduled workflow po ~60 dnech nečinnosti), nebo crawler padá. `status` přitom trvale visí na `running` a nikdy se neresetuje, takže stav v DB **lže** — vypadá to, že běží, ale neběží.
- **Tabulka `runs` je mrtvá:** poslední záznamy jsou z **24. 3.**, žádný workflow do ní nepíše a dashboard ji ignoruje. „Poslední dokončený run" v reálném slova smyslu neexistuje — id=4 (24. 3.) je poslední `completed`, zbytek visí na `running`.
- **Dashboard nemá serverovou vrstvu:** čte Supabase přímo z klienta a o „živosti" rozhoduje jen podle `crawl_state` — což je teď zastaralé a zavádějící.

**Pointa pro monitoring:** než cokoli stavět, je potřeba rozhodnout dvě věci — (a) proč crawlery od 25.–26. 5. neběží (GitHub Actions disabled vs. failing), a (b) že jediný spolehlivý „heartbeat" je `crawl_state.updated_at`, ne `status` (ten je permanentně `running`) a ne `runs` (mrtvá).
