# DR-027 brána „nejdřív hotové“ — etapa 4 (PR 0)

Stav: **verdikt brány DR-027 pro etapu 4, bez Zbrojíře.** Je to vstup pro nezávislou kontrolu, ne uzavřený stav.
Datum: 4. 11. 2026. Zpracoval: Claude Code (Opus 5.5), větev `tars/etapa4-0`.
Vstup: `NAVRH-v6.md` §12 (předběžný průzkum, tabulka kandidátů), §0 body 1–3, §8.1, §10, §14.

## 1. Role Zbrojíř: kde je a proč „bez Zbrojíře“

- V repu `muj-web` role Zbrojíř **neexistuje**. Hledáno v celém repu (`Zbroj`, bez ohledu na velikost písmen). Nalezeny jen dva datové CSV soubory (`data/layer_2c/…`), které s rolí nesouvisí. `.claude/agents/` kartu Zbrojíře nemá. `tars/orch/` ho jako oddělení ani adaptér nemá.
- Role je definovaná jen v Notionu: TARS-ORCH-001 §2g (DR-025) a stránka „TARS — Radar nástrojů (Zbrojíř)“. Radar dnes plní týdenní cloudová úloha, ne spustitelná role v repu.
- Proto brána proběhla **bez Zbrojíře**: postup DR-027 provedl Claude Code sám, podle definice §2g (katalog, radar, doporučení s cenou, rizikem a tokem dat). Pravidlo „tvůrce ≠ kontrolor“ platí: tento verdikt musí zkontrolovat jiná rodina modelů (GPT), dřív než se o něj opře PR 1–5.

## 2. Pravidla brány (DR-027, Decision Register 2. 11. 2026)

1. Průzkum zahrnuje oficiální funkce Claude Code a Codexu, pluginy, skilly a MCP, open source na GitHubu (existence, aktivita, licence) a placené služby.
2. Verdikt pro každou část: **PŘEVZÍT / PŘEVZÍT VZORY / STAVĚT VLASTNÍ**, se zdůvodněním. „Stavět vlastní“ jen tehdy, když hotové řešení prokazatelně nesplní požadavky vlastníka (bezpečnost, předplatné místo API, mobil, čeština, Notion), nebo když je přechod dražší než vlastní stavba.
3. Zadání stavby bez verdiktu je neplatné.
4. Platí zpětně (audit „převzít vs. stavět“ z 2. 11.). Pro tento dokument se netýká.
5. Velikost průzkumu odpovídá velikosti stavby. Etapa 4 je nová část systému, proto plný audit.

Navíc z DR-025 a TARS-ORCH-001 §2g: instalace nového nástroje, nový tok dat nebo placený nástroj = vizuální karta vlastníkovi. V tomto dokumentu se nic neinstaluje.

Verdikt **NEPŘEVZÍT** v tabulce znamená „hotové řešení existuje, ale ani vzor se nepřebírá“. DR-027 ho výslovně nejmenuje. Je to upřesnění, ne nová kategorie: u NEPŘEVZÍT je vždy uvedeno, co se místo toho použije.

## 3. Požadavky etapy 4, proti kterým se hodnotí

Z `NAVRH-v6.md` §1 a §14:

- R1 Bez nové služby, frameworku, závislosti a nákladu (úvod v6, „Pravidla beze změny“).
- R2 Běh na Macu pod launchd, na předplatném (`claude -p`, `codex exec`), bez veřejného endpointu (Mac za NAT).
- R3 Napojení na stávající lease, CAS a fence (`Store`), journal efektů (`EffectJournal`), `goBlocker` a TARS-GUARD. Nic se neobchází.
- R4 Nejistota = HOLD, nic se nemaže, každý GO je `provenance: observed` (DR-039).
- R5 Notion je místo podání a důkazu (P09, DR-024).

## 4. Ověření zdrojů (4. 11. 2026, kolem 23:30 CET)

Licence a aktivita jsou znovu ověřené v tomto PR, ne opsané z §12:

| Kandidát | Příkaz / zdroj | Výsledek |
| --- | --- | --- |
| Inngest | `gh api repos/inngest/inngest`, `/releases/latest`, `/license` | GitHub `NOASSERTION`. `LICENSE.md` začíná „Server Side Public License, Version 1.0 … Apache 2.0 Future License“. Release v1.49.0 z 23. 10. 2026, push 4. 11. 2026, nearchivováno |
| Trigger.dev | `gh api repos/triggerdotdev/trigger.dev`, `/releases/latest` | `Apache-2.0`, release v4.8.3 z 30. 10. 2026, push 3. 11. 2026 |
| Temporal | `gh api repos/temporalio/temporal`, `/releases/latest` | `MIT`, release v1.32.2 z 2. 11. 2026, push 4. 11. 2026 |
| pm2 | `gh api repos/Unitech/pm2`, `/license`, `contents/GNU-AGPL-3.0.txt` | GitHub `NOASSERTION`. `LICENSE` odkazuje na `GNU-AGPL-3.0.txt`, ten začíná „GNU AFFERO GENERAL PUBLIC LICENSE Version 3“. Release v7.1.2 z 3. 11. 2026 |
| supervisord | `gh api repos/Supervisor/supervisor`, `contents/LICENSES.txt` | GitHub `NOASSERTION`. `LICENSES.txt` je BSD-style („Redistribution and use in source and binary forms, with or without modification, are permitted…“). Poslední push 21. 12. 2025 |
| `@lomatina/queue-lite` | `npm view`, `gh api repos/lolmatina/queue-lite` | npm `MIT`, 0.1.0, změna 1. 6. 2026. GitHub `license: null` (bez souboru LICENSE), push 2. 6. 2026, 5 hvězd |
| `@inharness-ai/sqlite-queue` | `npm view` | `MIT`, 0.1.0, změna 12. 5. 2026 |
| `@zbil/liteque` | `npm view` | `MIT`, 0.3.0, změna 3. 1. 2025 |
| launchd | `launchd.plist(5)` (keith.github.io/xcode-man-pages) | `StartInterval`: „that interval will be missed due to shortcomings in kqueue(3)“. `StartCalendarInterval`: „launchd will start the job the next time the computer wakes up“. `WatchPaths`: „highly race-prone, and it is entirely possible for modifications to be missed“. `AbandonProcessGroup` a `ExitTimeOut` popsané |
| Node kill skupiny | nodejs/node#65052 | Uzavřeno 12. 9. 2026 opravou #65054 („don't kill own process group on failed spawn“). Neúspěšný `spawn` má `pid` 0 a `kill` zasáhl volajícího. Guard proti `pid` 0 a nedefinovanému `pid` zůstává povinný |
| Claude Code `-p` | code.claude.com/docs/en/headless, changelog, `claude --version` = 2.1.317 | Viz §5, řádky watchdog a reset |
| Codex | `codex exec --help` (lokálně) | Podpříkaz `resume` („Resume a previous session by id or pick the most recent with --last“), přepínač `--json` („Print events to stdout as JSONL“), `-o/--output-last-message`, `--ephemeral` |
| Notion webhooks | developers.notion.com/reference/webhooks-events-delivery | Řídké payloady („must call the API for the latest data“), doručení „at-most-once“, až 8 opakování během zhruba 24 h, bez zaručeného pořadí, `page.properties_updated` se agreguje |
| SessionEnd | anthropics/claude-code#41577 | **Oprava proti §12:** issue není o režimu `-p`. Popisuje, že Claude Code při ukončení zabije asynchronní práci uvnitř hooku `SessionEnd`. Uzavřeno 4. 4. 2026 jako duplikát #24206. Verdikt se nemění, mění se důvod |

## 5. Verdikty

| Oblast | Kandidát | Licence / aktivita | Verdikt | Zdůvodnění proti R1–R5 |
| --- | --- | --- | --- | --- |
| inbox | Notion REST `POST /v1/data_sources/{id}/query` | služba, už v repu (`findRowByOrderId`, panel.ts) | **PŘEVZÍT** | Splňuje R2 (polling bez endpointu) i R5. Stránkování `has_more`/`next_cursor` ověřeno v kroku 0 (`INBOX-MAPA.md` §3.1) |
| inbox | Notion webhooks `page.properties_updated` | služba | **PŘEVZÍT VZORY** | Endpoint nesplní R2 (Mac za NAT, potřebuje URL pro doručení). Doručení „at-most-once“ a bez pořadí, takže by stejně potřeboval polling jako pravdu. Přebírá se vzor: událost jen jako signál, stav vždy z API |
| inbox / Q1-B | Notion komentáře (`created_by`) | služba | **PŘEVZÍT VZORY** pro Q1-B | Mimo etapu 4. Fable jedná přes OAuth vlastníka, takže `created_by` sám autora nerozliší (krok 0 §2.3) |
| fronta / claim | `@lomatina/queue-lite` | MIT (npm), jediné vydání 0.1.0, 5 měsíců bez změny | **NEPŘEVZÍT** | Nezralost. Místo něj claim prepare/commit nad `Store` (§5 návrhu) |
| fronta / claim | `@inharness-ai/sqlite-queue` | MIT, 0.1.0 | **PŘEVZÍT VZORY** | Lease a at-least-once jsou dobrý vzor. Závislost porušuje R1 a nepřipojí se na `Store` fence a journal (R3) |
| fronta / claim | `@zbil/liteque` | MIT, 0.3.0, 22 měsíců bez změny | **PŘEVZÍT VZORY** | Totéž jako výše, navíc neudržované |
| fronta / claim | vlastní protokol nad `Store` a `EffectJournal` | v repu | **STAVĚT VLASTNÍ** | Žádný kandidát nesplní R3 (napojení na stávající lease, CAS, fence a journal) bez přepisu jádra. Přechod na cizí frontu je dražší než rozšíření `Store` |
| durable execution | Inngest | SSPL 1.0 → Apache 2.0 po 3 letech, aktivní | **PŘEVZÍT VZORY** | Durable steps a idempotency keys jako vzor pro `attempts/` (§7). Nasazení porušuje R1 (server) a SSPL je nevhodná licence |
| durable execution | Trigger.dev | Apache-2.0, aktivní | **PŘEVZÍT VZORY** | Self-host potřebuje Postgres a Redis (R1). Vzor: checkpoint a pokračování kroku |
| durable execution | Temporal | MIT, aktivní | **PŘEVZÍT VZORY** | Server + DB (R1). Vzor: deterministický replay z historie událostí, odpovídá journalu a reconcileru (§7) |
| watchdog | launchd `StartCalendarInterval`, `AbandonProcessGroup`, `ExitTimeOut` | součást macOS | **PŘEVZÍT** | Ověřeno v man stránce. Řeší zmeškaný běh po spánku a zbylé procesy (§0 body 1–2) |
| watchdog | launchd `WatchPaths` / `QueueDirectories` | součást macOS | **NEPŘEVZÍT** | Man stránka: „highly race-prone“. Porušuje R4 (ztracená událost bez HOLD) |
| watchdog | pm2 | AGPL-3.0, aktivní | **NEPŘEVZÍT** | Další démon (R1), AGPL. launchd už úlohu plní |
| watchdog | supervisord | BSD-style, push 12/2025 | **NEPŘEVZÍT** | Další démon a Python runtime (R1). launchd už úlohu plní |
| watchdog | Node `spawn({ detached: true })` + `process.kill(-pgid)` | součást Node | **PŘEVZÍT** | Ukončí celou skupinu včetně vnuků (§0 bod 3). Povinný guard: `pid` musí být kladné celé číslo, jinak žádný `kill` (nodejs/node#65052) |
| watchdog | Claude Code `-p`: SIGTERM ukončí strom procesů Bash, `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`, `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | nainstalovaný nástroj 2.1.317 | **PŘEVZÍT** | Headless docs: „On SIGTERM, Claude Code terminates the process tree of any Bash command that is still running“ a čekání na práci na pozadí je omezené stropem. Bez nové závislosti. Zbytkové riziko: vnuk se `setsid` (§15 bod 3 návrhu) |
| watchdog / reset | Claude Code `CLAUDE_CODE_RETRY_WATCHDOG` (+ `…_MAX_USAGE_LIMIT_WAIT_MS`, `…_USAGE_LIMIT_RECHECK_MS`) | nainstalovaný nástroj, changelog 2.1.301–2.1.311 | **PŘEVZÍT VZORY**, zapnutí ne | Bez stropu proces mlčky čeká na reset a drží lease (Radar 2026-11-03, řádek 2). Etapa 4 řeší čekání vlastním `PAUSED` a probuzením (§10.2), ne čekáním uvnitř dítěte. Zapnutí by změnilo prostředí dítěte, to je změna chování mimo PR 0 |
| reset | Claude Code `stream-json` událost `system/api_retry` (`error: rate_limit`) | nainstalovaný nástroj | **PŘEVZÍT** jako zdroj pro parser | Strukturovaný signál limitu místo hledání v textu, kde je k dispozici. Parser hlášek o resetu zůstává STAVĚT (níže) |
| completion event | Claude Code hook `SessionEnd` | nainstalovaný nástroj | **NEPŘEVZÍT** | Async práce v hooku se při ukončení zabije (#41577 → #24206). Konec běhu se pozná z exit kódu a výstupu `-p` |
| watchdog / reset | Codex `exec --json`, `codex exec resume` | nainstalovaný nástroj, ověřeno `codex exec --help` | **PŘEVZÍT** | Oba přepínače lokálně existují (dřív jen sekundární zdroje). Bez nové závislosti. Konkrétní tvar JSONL událostí ověří PR 4a testem |
| N03 hranice | git `GIT_CONFIG_COUNT/KEY/VALUE`, `GH_CONFIG_DIR` | součást git a gh | **PŘEVZÍT** | Bez závislosti. Patří do PR 4b (třída B) |
| reset | `Intl` (Node) pro Europe/Prague, gap/fold | součást Node | **PŘEVZÍT** | Bez závislosti |
| reset | parser `parseReset(text, received_at, defaultTz)` | — | **STAVĚT VLASTNÍ** | Hotový parser českých a anglických hlášek CLI o limitu neexistuje. Malý, testovatelný kód |
| dispatch | Claude Code cloud sessions | služba | **NEPŘEVZÍT** | Běží mimo Mac, mimo lease, journal a TARS-GUARD (R2, R3) |
| dispatch | dispatcher fable/dev nad inboxem | — | **STAVĚT VLASTNÍ** | Musí sedět na claim, revalidaci a allowlist efektů (§5, §3.3, §6.4). Žádný hotový nástroj tuto vazbu nemá |

## 6. Závěr brány

- **Žádná nová služba, framework, závislost ani náklad.** Platí R1. Nic se neinstaluje, žádný nový tok dat, proto karta vlastníkovi podle DR-025 není potřeba.
- **STAVĚT VLASTNÍ** jen u tří částí: claim/fronta nad `Store`, parser resetu a dispatcher. U každé je uvedeno, který požadavek hotové řešení nesplní.
- **Rozdíly proti předběžné tabulce §12 návrhu v6:**
  1. Codex `exec --json` a `resume`: z PŘEVZÍT VZORY na **PŘEVZÍT**, protože přepínače jsou lokálně ověřené.
  2. `SessionEnd`: verdikt NEPŘEVZÍT zůstává, opravený důvod (async práce v hooku, ne režim `-p`).
  3. Nové řádky: `CLAUDE_CODE_RETRY_WATCHDOG` (Radar 2026-11-03), `system/api_retry` a výslovné řádky STAVĚT VLASTNÍ pro claim.
- **Otevřené:** konkrétní tvar JSONL událostí Codexu a hlášek o limitu ověří testy PR 1 a PR 4a. Nezávislá kontrola tohoto verdiktu (GPT) zatím neproběhla.

## Zdroje

- DR-027, DR-025, DR-024: Notion „02 — Decision Register“
- TARS-ORCH-001 §2g (Notion)
- TARS — Radar nástrojů (Zbrojíř), Radar 2026-11-03 (Notion)
- launchd.plist(5): https://keith.github.io/xcode-man-pages/launchd.plist.5.html
- Claude Code headless: https://code.claude.com/docs/en/headless
- Claude Code changelog: https://code.claude.com/docs/en/changelog
- SessionEnd: https://github.com/anthropics/claude-code/issues/41577
- Node: https://github.com/nodejs/node/issues/65052
- Notion webhooks: https://developers.notion.com/reference/webhooks-events-delivery
- GitHub: https://github.com/inngest/inngest , https://github.com/triggerdotdev/trigger.dev , https://github.com/temporalio/temporal , https://github.com/Unitech/pm2 , https://github.com/Supervisor/supervisor , https://github.com/lolmatina/queue-lite
- npm: https://www.npmjs.com/package/@lomatina/queue-lite , https://www.npmjs.com/package/@inharness-ai/sqlite-queue , https://www.npmjs.com/package/@zbil/liteque
