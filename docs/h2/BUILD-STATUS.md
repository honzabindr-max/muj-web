# H2 Buddy — Build Status

Aktuální snapshot. Historie (fakta beze změny, přesunuto celé 2026-09-29): [docs/h2/history/build/BUILD-STATUS-2026-09-29.md](./history/build/BUILD-STATUS-2026-09-29.md). Rozhodnutí + Authority map: [DECISIONS.md](./DECISIONS.md).

Nová session: přečti tenhle soubor + [DECISIONS.md](./DECISIONS.md). Historii otevírej jen na vyžádání nebo když ti tady chybí detail (evidence bloky, PR odkazy, plné znění Pravidel).

## Aktuální stav (2026-09-29)

- **Vývoj H2 Buddy (BUILD-12+) POZASTAVEN** od 2026-09-23 kvůli nákladové architektuře (historie ř. 3 — "STAV 2026-09-23" odstavec; **ne** DEC-009 — DEC-009 je samostatné rozhodnutí o H2-IW pilotu, ne o pozastavení BUILD-12+).
- **BUILD-10 (Buddy runtime): DEPLOYED. BUILD-11 (Telegram + web delivery): KOMPLETNÍ** — MERGED, NASAZENO, [PR #47](https://github.com/honzabindr-max/muj-web/pull/47) (historie ř. 4).
- **M1 (Buddy Live): DOSAŽENO 2026-09-05** — ověřeno přímým dotazem do produkční DB, ne jen tvrzením (historie ř. 5–7: první reálná Buddy odpověď přes Telegram, end-to-end příchozí zpráva → job → Sonnet → delivery).
- **H2-IW — H2 Inbox Watcher: V PROVOZU** od 2026-09-23 15:08 UTC (timer na Hetzner VPS `hz`, minutely), pilot *H2 Planning OS*. Rozhodnutí + doplňky 1–10: [DECISIONS.md#dec-009](./DECISIONS.md#dec-009). Nasazení po posledním zápisu do historie/DECISIONS.md, jeden řádek na PR podle `git log`:
  - 2026-09-24 [PR #65](https://github.com/honzabindr-max/muj-web/pull/65) — celodenní kalendářní událost se nikdy nevytváří místo timed EVENTu (Planning OS v0.11 §3).
  - 2026-09-24 [PR #66](https://github.com/honzabindr-max/muj-web/pull/66) — all-day popup jen pro jednodenní povinnost, zrušen výchozí `povinnost` (v0.11.1).
  - 2026-09-25 [PR #68](https://github.com/honzabindr-max/muj-web/pull/68) — `deadline_date` se nikdy neposílá do Todoistu, opakovaná apply chyba jde do karantény.
  - 2026-09-26 [PR #69](https://github.com/honzabindr-max/muj-web/pull/69) — chyba apply u jedné položky už nekrmí run-failure streak.
  - 2026-09-26 [PR #67](https://github.com/honzabindr-max/muj-web/pull/67) — kontrola konzistence dne v týdnu vs. datum pro EVENT/BLOCK/TASK.
- **DEC-010 (2026-09-29):** GPT Architecture Delta Review v2 stanovila rozsah dalšího H2 vývoje (cost modes, deterministický Janitor, bootstrap cleanup, owner-scoped profil, sensitivity defaults, certifikovaný router, skill metadata, Planning Validator v1) a authority mapu. [DECISIONS.md#dec-010](./DECISIONS.md#dec-010).

## Bloky BUILD-01 — BUILD-28

Stavy: `TODO` | `IN PROGRESS` | `AT GREEN` | `DEPLOYED` | `BLOCKED`. Plná evidence (PR odkazy, commity, AT ownership) je v historii výše.

| Blok | Název | Stav |
|---|---|---|
| BUILD-01 | Foundation & configuration | AT GREEN |
| BUILD-02 | Neon data layer | AT GREEN — DOKONČENO |
| BUILD-03 | Crypto & privacy foundation | AT GREEN — MERGED |
| BUILD-03A | Identity, sessions & recent re-auth | AT GREEN — MERGED, DEPLOYED |
| BUILD-04 | Unified ingestion | AT GREEN — MERGED, DEPLOYED |
| BUILD-05 | Queue, lease, fencing, quarantine | AT GREEN — MERGED, DEPLOYED |
| BUILD-06 | Voice transcription | AT GREEN — MERGED, DEPLOYED |
| BUILD-07 | Prompt Registry & model adapter | AT GREEN — MERGED, DEPLOYED |
| BUILD-08 | Operational extraction | AT GREEN — MERGED, DEPLOYED |
| BUILD-09 | Context Engine | AT GREEN — MERGED, DEPLOYED (4 kroky/PR) |
| BUILD-10 | Buddy runtime | **DEPLOYED** |
| BUILD-11 | Telegram + web delivery | **KOMPLETNÍ — MERGED, DEPLOYED** ([PR #47](https://github.com/honzabindr-max/muj-web/pull/47)); Pravidlo 10 (delivery testuje `owner_control_epoch`) splněno — 6 testů v `h2/delivery/__tests__/deliver-response.test.ts` |
| — | **MILESTONE M1 — Buddy Live** | **DOSAŽENO 2026-09-05** |
| BUILD-12 | Executive objects | TODO — pozastaveno (viz "Aktuální stav") |
| BUILD-13 | Google Calendar | TODO — pozastaveno |
| BUILD-14 | Blind learning pipeline | TODO — pozastaveno |
| BUILD-15 | Influence linking / I8 | TODO — pozastaveno |
| BUILD-16 | Evidence / claims / deterministic metrics | TODO — pozastaveno |
| BUILD-17 | Experiments & Living OS | TODO — pozastaveno |
| BUILD-18 | 24-domain My Map + Discoveries | TODO — pozastaveno |
| BUILD-19 | Timeline & Memory Inspector | TODO — pozastaveno |
| BUILD-20 | Deletion Ledger + selective hard delete | TODO — pozastaveno |
| BUILD-21 | Backups & restore | TODO — pozastaveno |
| BUILD-22 | Full H2 Destruction | TODO — pozastaveno |
| BUILD-23 | Scheduler, jobs, health | TODO — pozastaveno |
| BUILD-24 | Proactivity & cycles | TODO — pozastaveno |
| BUILD-25 | Reviews & Wrapped | TODO — pozastaveno |
| BUILD-26 | Full web product surfaces | TODO — pozastaveno |
| BUILD-27 | Usage & budget guardrails | TODO — pozastaveno |
| BUILD-28 | Exit Package | TODO — pozastaveno |

**Tabulka v historii (ř. 1479–1481) je zastaralá, platí záhlaví historie ř. 3–7.** Historický soubor se nemění — tenhle řádek je jen upozornění, kam se dívat.

## M1 deploy gate (Buddy Live) — stav podle dostupného důkazu

- [x] Všechny acceptance testy vlastněné BUILD-01 až BUILD-11 / BUILD-03A jsou zelené. — historie ř. 4–7 (BUILD-11 KOMPLETNÍ, M1 DOSAŽENO) + AT-10/Pravidlo 10 testy explicitně zmíněné (historie ř. 386–388).
- [x] Produkční secrets/config jsou ověřené. — `check-required-env.ts` opakovaně OK proti production i preview napříč evidence bloky historie, žádný chybějící nález ke dni M1.
- Smoke test proběhne na produkci: Telegram text + voice + web. — **ČÁSTEČNĚ.** Telegram text ověřen (M1 odstavec: 3 reálné zprávy 2026-09-05). Voice a web smoke test nemá v historii vlastní evidence blok — **neověřeno**.
- Minimální metering: `usage_ledger` zápisy živé + tvrdý strop 35 USD/měsíc vynucený. — `usage_ledger`/`llm_runs` zápisy živé (BUILD-07/BUILD-10 evidence). Tvrdý měsíční strop 35 USD **NENÍ vynucený** — checklist v historii zůstal nezaškrtnutý a žádný enforcement kód není v historii zmíněný. Řeší COST-MODES plán (DEC-011, samostatná dávka).
- `docs/h2/EXPERIMENT-0.md` založen. — soubor v repu neexistuje. **Neověřeno/nesplněno.**
- Neon h2-runtime a h2-control upgradovány z Free na **Launch** plán, History Retention na **7 dní**. — žádný důkaz upgradu v historii, DEC-003 poslední zmínka je stále Free/6h. **Neověřeno.**
- Roli `h2_migrator` nastaveno heslo, migrace přes ni místo `neondb_owner`. — DEC-006 poslední zmínka je stále vědomá odchylka na `neondb_owner`. **Neověřeno.**

M1 DOSAŽENO (produkční provoz funguje) a M1 deploy gate (formální checklist) nejsou totéž — gate má 3 nesplněné/neověřené položky přesto, že Buddy živě odpovídal na produkci. Tenhle soubor to jen přesně reportuje, neřeší.

## Otevřené položky

- BUILD-12+ čekají na rozhodnutí ownera pokračovat po pozastavení z 2026-09-23 (nákladová architektura) — **ne** z DEC-009.
- M1 deploy gate: metering strop, `EXPERIMENT-0.md`, Neon Launch upgrade, `h2_migrator` heslo — viz checklist výše.
- Retry taxonomie, Haiku Structured Outputs (`OPERATIONAL_EXTRACTION`) a refuz/ořez metering mezera — forward-pointery zapsané v historii, neimplementováno.
- Plné znění otevřených bodů (číslované 1–7, stav 2026-09-04) je v historii výše — nekopíruje se sem, ať se nerozchází se zdrojem.

## Pravidla — přehled (plné znění v historii)

1. Jeden BUILD blok = jedna větev = jeden PR = jeden evidence block.
2. Slice je hotový, až jsou jeho AT (nebo schema/unit/integration testy) zelené.
3. Nejasnost měnící Product Spec/I1–I8/Locked Architecture → `ARCHITECTURE DECISION REQUIRED` do DECISIONS.md, zastavit jen dotčený slice.
4. GO od Honzíka je potřeba na: merge do `main`, env/secrets ve Vercelu, produkční migrace, utrácení/limity, mazání dat, rozšíření oprávnění.
5. Migrace se na Neon neaplikují automaticky — ověřovat vždy přímým dotazem na `_h2_migrations`, ne předpokladem.
6. Kanonická externí doména je `https://www.good-inventions.work/...`, nikdy apex (redirect webhooky nenásledují).
7. Standardní ad hoc ověřovací nástroj: `h2/db/scripts/verify-ingestion.ts` (role `h2_runtime`, jen counts/states/timestamps).
8. Preflight kontrola produkčních env proměnných je povinný ruční krok deploy gate: `h2/build-governance/required-env.ts` + `h2/db/scripts/check-required-env.ts`. Pořadí: env proměnná → deploy → ověření.
9. Ověřovací skript nad RLS-chráněnými daty musí po `set_config` ověřit readbackem, že scope skutečně platí — tichá nula je horší než chyba.
10. BUILD-11 se nesmí uzavřít AT GREEN bez testu, že delivery neodešle odpověď při stale `owner_control_epoch`. — **splněno**, viz tabulka výše.
11. Žádné no-code automation platformy (Zapier/Make/n8n) v core message-processing (data plane) cestě H2 Buddy. Autentizovaný ping bez payloadu (control plane, např. queue wakeup) je přípustný za podmínek v historii.
12. Migrační env workflow: `.env.migrate.preview` + `.env.migrate.production`, hesla se vkládají jednou za session přes `write-migrate-env.sh`.

## Zdroje pravdy

Viz [Authority map v DECISIONS.md](./DECISIONS.md#authority-map). Notion mirror (*H2 Buddy — Build Status (mirror)*) je odvozený výstup, ne autoritativní — zdroj pravdy zůstává tento repozitář.
