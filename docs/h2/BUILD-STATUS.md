# H2 Buddy — Build Status

Aktuální snapshot. Historie (fakta beze změny, přesunuto celé 2026-09-29): [docs/h2/history/build/BUILD-STATUS-2026-09-29.md](./history/build/BUILD-STATUS-2026-09-29.md). Rozhodnutí + Authority map: [DECISIONS.md](./DECISIONS.md).

Nová session: přečti tenhle soubor + [DECISIONS.md](./DECISIONS.md). Historii otevírej jen na vyžádání nebo když ti tady chybí detail (evidence bloky, PR odkazy, plné znění Pravidel).

## Aktuální stav (2026-09-29)

- **Vývoj H2 Buddy (BUILD-12+) POZASTAVEN** od 2026-09-23 kvůli nákladové architektuře.
- **H2-IW — H2 Inbox Watcher: V PROVOZU** od 2026-09-23 15:08 UTC (timer na Hetzner VPS `hz`, minutely), pilot *H2 Planning OS*. Rozhodnutí + doplňky 1–10: [DECISIONS.md#dec-009](./DECISIONS.md#dec-009). Plná evidence (PR odkazy, eval kola, E2E) je v historii výše, ne tady.
- **DEC-010 (2026-09-29):** GPT Architecture Delta Review v2 stanovila rozsah dalšího H2 vývoje (cost modes, deterministický Janitor, bootstrap cleanup, owner-scoped profil, sensitivity defaults, certifikovaný router, skill metadata, Planning Validator v1) a authority mapu. [DECISIONS.md#dec-010](./DECISIONS.md#dec-010).
- **M1 (Buddy Live): NOT STARTED.** BUILD-10 a BUILD-11 zůstávají TODO — viz tabulka níže a M1 deploy gate.

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
| BUILD-10 | Buddy runtime | TODO |
| BUILD-11 | Telegram + web delivery | TODO — Pravidlo 10 (delivery musí testovat `owner_control_epoch`) |
| — | **MILESTONE M1 — Buddy Live** | **NOT STARTED** |
| BUILD-12 | Executive objects | TODO |
| BUILD-13 | Google Calendar | TODO |
| BUILD-14 | Blind learning pipeline | TODO |
| BUILD-15 | Influence linking / I8 | TODO |
| BUILD-16 | Evidence / claims / deterministic metrics | TODO |
| BUILD-17 | Experiments & Living OS | TODO |
| BUILD-18 | 24-domain My Map + Discoveries | TODO |
| BUILD-19 | Timeline & Memory Inspector | TODO |
| BUILD-20 | Deletion Ledger + selective hard delete | TODO |
| BUILD-21 | Backups & restore | TODO |
| BUILD-22 | Full H2 Destruction | TODO |
| BUILD-23 | Scheduler, jobs, health | TODO |
| BUILD-24 | Proactivity & cycles | TODO |
| BUILD-25 | Reviews & Wrapped | TODO |
| BUILD-26 | Full web product surfaces | TODO |
| BUILD-27 | Usage & budget guardrails | TODO |
| BUILD-28 | Exit Package | TODO |

## M1 deploy gate (Buddy Live)

- [ ] Všechny acceptance testy vlastněné BUILD-01 až BUILD-11 / BUILD-03A jsou zelené.
- [ ] Produkční secrets/config jsou ověřené.
- [ ] Smoke test proběhne na produkci: Telegram text + voice + web.
- [ ] Minimální metering: `usage_ledger` zápisy živé + tvrdý strop 35 USD/měsíc vynucený.
- [ ] `docs/h2/EXPERIMENT-0.md` založen.
- [ ] Neon h2-runtime a h2-control upgradovány z Free na **Launch** plán, History Retention na **7 dní** (DEC-003).
- [ ] Roli `h2_migrator` nastaveno heslo, migrace přes ni místo `neondb_owner` (DEC-006).

## Otevřené položky

- BUILD-10/BUILD-11 čekají na pozastavení z DEC-009 (nákladová architektura) — neřeší se, dokud owner nerozhodne pokračovat.
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
10. BUILD-11 se nesmí uzavřít AT GREEN bez testu, že delivery neodešle odpověď při stale `owner_control_epoch`.
11. Žádné no-code automation platformy (Zapier/Make/n8n) v core message-processing (data plane) cestě H2 Buddy. Autentizovaný ping bez payloadu (control plane, např. queue wakeup) je přípustný za podmínek v historii.
12. Migrační env workflow: `.env.migrate.preview` + `.env.migrate.production`, hesla se vkládají jednou za session přes `write-migrate-env.sh`.

## Zdroje pravdy

Viz [Authority map v DECISIONS.md](./DECISIONS.md#authority-map). Notion mirror (*H2 Buddy — Build Status (mirror)*) je odvozený výstup, ne autoritativní — zdroj pravdy zůstává tento repozitář.
