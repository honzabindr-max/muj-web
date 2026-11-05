# DR-027 brána „nejdřív hotové“ — etapa 4 (PR 0), verze 2

Stav: **návrh verdiktu brány DR-027 pro etapu 4, verze 2 po nezávislé kontrole GPT (4. 11. 2026).** Brána **není uzavřená**: autor podle DR-027 (Zbrojíř) chybí, viz §1. Do rozhodnutí vlastníka je stav brány **HOLD pro práci, která na ní závisí**, ne globální STOP.
Datum: 5. 11. 2026. Zpracoval: Claude Code (Opus 5.5), větev `tars/etapa4-0`.
Vstup: návrh etapy 4 v6 §12 (předběžný průzkum), schválený dodatek v6.1 (body Radaru), nezávislá kontrola GPT brány v1 (nálezy G-01 až G-08).

## 0. Co se změnilo proti verzi 1

| Nález GPT | Co je ve v2 jinak | Kde |
| --- | --- | --- |
| G-01 chybí Zbrojíř | Neřešeno, čeká na rozhodnutí vlastníka (výjimka nebo role Zbrojíře) | §1 |
| G-02 watchdog vs. v6.1 | Watchdog = PŘEVZÍT pro PR 4c po PR 1, s limity a testy podle v6.1. PR 0 nic nezapíná | §5 řádek W5, §6 |
| G-03 čtvrtý typ verdiktu | Verdikt oblasti jen PŘEVZÍT / PŘEVZÍT VZORY / STAVĚT VLASTNÍ. NEPŘEVZÍT je jen stav odmítnutého kandidáta | §2, §5 |
| G-04 chybí matice průzkumu | Nová matice kategorie → registry → datum → nejbližší kandidát → důvod vyřazení | §4 |
| G-05 `claude --bare -p`, Agent SDK | Výslovně vyřazeno s důvody a s pojistkou proti pozdější „optimalizaci“ | §5 řádky D3, D4, §7 |
| G-06 chybí srovnání nákladů | Orientační srovnání A (vlastní) vs. B (nejlepší hotový) a důkaz k parseru resetu | §8 |
| G-07 licence jako jediný důvod | Licence nikde není jediný důvod. Deklarace oddělená od právního ověření | §3, §5 |
| G-08 reprodukovatelnost | Verze nebo commit SHA a datum ověření u rozhodujících kandidátů | §3 |

## 1. Role Zbrojíř — čeká na rozhodnutí vlastníka

- DR-027 ukládá průzkum a verdikt Zbrojíři. Návrh v6 §12 a plán PR 0 počítají s plnou bránou se Zbrojířem.
- V repu `muj-web` role Zbrojíř neexistuje (ověřeno ve v1: žádná karta v `.claude/agents/`, žádné oddělení v `tars/orch/`). Role je popsaná jen mimo repo, radar dnes plní týdenní cloudová úloha.
- Tento dokument zpracoval Claude Code bez Zbrojíře. Nezávislá kontrola GPT chybějícího autora nenahrazuje.
- **Stav: čeká na rozhodnutí vlastníka (výjimka nebo role Zbrojíře).** Možnosti:
  1. jednorázová výjimka vlastníka z DR-027 pro PR 0 s uvedeným rozsahem, nebo
  2. malý verzovaný kontrakt role Zbrojíře v repu, který tento verdikt vydá nebo ratifikuje.
- Do rozhodnutí: brána jako uzavřená = **FAIL**. Stavba, která podle DR-027 bod 3 potřebuje verdikt (PR 3, PR 4c, PR 5), čeká. Opravy textů PR 0 (DR-022 → DR-024) na bráně nezávisí.

## 2. Pravidla brány (DR-027)

1. Průzkum zahrnuje oficiální funkce Claude Code a Codexu, pluginy, skilly a MCP, open source na GitHubu (existence, aktivita, licence) a placené služby.
2. Verdikt pro každou **funkční oblast**: **PŘEVZÍT / PŘEVZÍT VZORY / STAVĚT VLASTNÍ**, se zdůvodněním. „Stavět vlastní“ jen tehdy, když hotové řešení prokazatelně nesplní požadavky vlastníka (bezpečnost, předplatné místo API, mobil, čeština, Notion), nebo když je přechod dražší než vlastní stavba.
3. Zadání stavby bez verdiktu je neplatné.
4. Velikost průzkumu odpovídá velikosti stavby. Etapa 4 je nová část systému, proto plný audit.

**Verdikt oblasti má jen tři hodnoty** (bod 2). V tabulce kandidátů (§5) má každý kandidát vlastní **stav kandidáta**: `vybrán`, `vzor` nebo `odmítnut`. `odmítnut` (dřív „NEPŘEVZÍT“) je jen stav kandidáta uvnitř oblasti, nikdy verdikt oblasti. Každá oblast má vždy uvedený tříhodnotový verdikt a vítěznou alternativu.

Navíc z DR-025: instalace nového nástroje, nový tok dat nebo placený nástroj = vizuální karta vlastníkovi. V tomto dokumentu se nic neinstaluje a nic nezapíná.

## 3. Požadavky, licence a reprodukovatelnost

### 3.1 Požadavky etapy 4

- R1 Bez nové služby, frameworku, závislosti a nákladu.
- R2 Běh na Macu pod launchd, na předplatném (`claude -p`, `codex exec`), bez veřejného endpointu (Mac za NAT).
- R3 Napojení na stávající lease, CAS a fence (`Store`), journal efektů (`EffectJournal`), `goBlocker` a TARS-GUARD. Nic se neobchází.
- R4 Nejistota = HOLD, nic se nemaže, každý GO je `provenance: observed` (DR-039).
- R5 Notion je místo podání a důkazu (P09, DR-024).

### 3.2 Licence (G-07)

- Licence **nikde není jediný důvod** odmítnutí. U každého odmítnutého kandidáta je hlavní důvod architektonický (R1–R5). Licence je jen doplňková poznámka.
- Rozlišujeme dvě úrovně:
  - **deklarace**: co uvádí `package.json`, npm registry nebo GitHub API (`license.spdx_id`). Je to tvrzení autora, ne právní ověření.
  - **soubor**: text souboru LICENSE v repu. Ani ten není právní posudek pro konkrétní použití.
- Právní ověření (zda licence dovoluje konkrétní interní použití) **neproběhlo** a pro tento verdikt není potřeba, protože se nic nepřebírá jako závislost. Kdyby se kandidát měl převzít, právní ověření je samostatný krok s kartou vlastníkovi.
- Příklady: Inngest (soubor: SSPL 1.0 s odloženou konverzí na Apache 2.0 podle stáří kódu), pm2 (soubor: odkaz na AGPL-3.0), amux (soubor: MIT + Commons Clause). AGPL ani SSPL samy o sobě interní použití nezakazují. Odmítnutí stojí na R1/R3.

### 3.3 Reprodukovatelnost (G-08)

Rozhodující kandidáti (vítěz oblasti nebo nejbližší odmítnutý hotový kandidát). Ověřeno 5. 11. 2026 kolem 01:30 CET. GitHub „push“ je jen signál aktivity, ne kvality údržby.

| Kandidát | Verze / commit SHA | Datum commitu | Jak ověřeno |
| --- | --- | --- | --- |
| Claude Code (nainstalovaný) | `2.1.317` | — | `claude --version` |
| Codex CLI (nainstalovaný) | `codex-cli 0.166.0` | — | `codex --version`; `codex exec --help` (v1) |
| Claude Code headless docs (`--bare`, `system/api_retry`, SIGTERM) | stránka bez verze; obsah citovaný v §5 a §8 | čteno 5. 11. 2026 | WebFetch `code.claude.com/docs/en/headless` |
| Agent SDK overview (autentizace) | stránka bez verze | čteno 5. 11. 2026 | WebFetch `code.claude.com/docs/en/agent-sdk/overview` |
| `mixpeek/amux` (nejbližší hotový dispatcher) | `e50521b13a38fdb35086284890a5d6896927dabf` | 2026-11-04 | `gh api repos/mixpeek/amux/commits/HEAD`, `/contents/LICENSE` |
| `OrchestratorInc/agent-orchestrator` | `6430fe3b6a97582c8e129eb6149aa565c046615b` | 2026-11-04 | `gh api …/commits/HEAD` |
| `terryso/claude-auto-resume` (nejbližší parser resetu) | `b7f2484959ec6814030e4e47a4c303b456ab5214` (skript `VERSION="1.5.0"`) | 2026-05-09 | `gh api …/commits/HEAD`, `/contents/claude-auto-resume.sh` |
| `wong2/claude-plugins` plugin `resumer` | `1654cb3654088d76f8b53ae7a8b03cbdf04628f9` | 2026-03-20 | `gh api …/commits/HEAD`, `/git/trees/HEAD` |
| `workflow` (Vercel Workflow SDK) | npm `5.4.0` | modified 2026-11-04 | `npm view workflow` |
| `@visulima/workflow` | npm `4.0.0` | modified 2026-10-15 | `npm view @visulima/workflow` (deps `xstate`, `croner`) |
| `@lomatina/queue-lite` | npm `0.1.0` | 2026-06-01 | v1 (`npm view`) |
| Inngest / Trigger.dev / Temporal | release v1.49.0 / v4.8.3 / v1.32.2 | 23. 10. / 30. 10. / 2. 11. 2026 | v1 (`gh api …/releases/latest`) |
| launchd | macOS `launchd.plist(5)` | — | man stránka (v1) |

U ostatních odmítnutých kandidátů stačí název, registr a datum v matici §4.

## 4. Matice průzkumu (G-04)

Prohledáno 5. 11. 2026 mezi 00:45 a 01:45 CET, jen čtení. Nic se neinstalovalo. „Lokální“ = katalogy na tomto Macu (`~/.claude/plugins/marketplaces/*`, `~/.claude/skills`, `~/.claude/agents`, `.claude/agents` a `.claude/skills` v repu, seznam skillů nabízených v session Claude Code). „Cloud“ = veřejné registry.

| Kategorie | Prohledané registry / katalogy | Dotaz | Nejbližší kandidát | Stav | Důvod vyřazení / výběru |
| --- | --- | --- | --- | --- | --- |
| Inbox (Notion jako fronta podání) | GitHub (`gh search repos`), npm (`npm search`), MCP registry (`registry.modelcontextprotocol.io/v0/servers?search=notion`, 30 záznamů), lokální pluginy (3 marketplace), web | `notion agent inbox`, `notion poller`, `notion` | `keng1304/claude-codex-bridge` (MIT, 11 hvězd, push 2026-05-06): Claude + Codex „glued by Notion“; MCP `com.notion/mcp` 1.0.1 (oficiální) | odmítnut | Bridge: bez lease, fence, journalu a GO receiptů (R3), 6 měsíců bez změny. Žádný MCP server v registru nemá polling, claim ani frontu (jen čtení a zápis stránek). MCP běží v session modelu, ne v ticku pod lease. Vítěz: Notion REST dotaz (už v repu) |
| Lidská schvalovací brána (GO) | MCP registry (`search=queue`), GitHub | `queue`, `approval` | `io.github.Opafex/mcp-approval-queue` 0.2.0, `com.textforagents/hosted-approval-queue-for-agents` 1.0.0 | odmítnut | Nový kanál GO mimo Notion porušuje P20/R5 a DR-039 (GO = pozorovaná hodnota selectu v panelu). Hostovaná varianta = nový tok dat (R1) |
| Fronta / claim | npm, GitHub (`sqlite job queue lease`, bez výsledku), v1 kandidáti | `queue lease`, `sqlite queue` | `@inharness-ai/sqlite-queue` 0.1.0 | vzor | Lease a at-least-once jako vzor. Nepřipojí se na `Store` fence a `EffectJournal` (R3), nová závislost (R1) |
| Durable execution (vestavná knihovna) | npm (`durable workflow file journal`), v1 | — | `workflow` 5.4.0 (Vercel), `@visulima/workflow` 4.0.0 (pluggable store), `@dbos-inc/dbos-sdk` 5.4.0 (Postgres) | vzor | Vlastní model kroků a úložiště místo `Store`/`EffectJournal` (R3). DBOS potřebuje Postgres (R1). Vzor: replay z journalu, idempotentní kroky |
| Durable execution (server) | GitHub (v1) | — | Temporal, Trigger.dev, Inngest | vzor | Server + DB (R1). Vzory beze změny proti v1 |
| Dispatcher agentů (celý orchestrátor) | GitHub (`claude-code orchestrator`, top 10 podle hvězd), npm, web | — | `mixpeek/amux` (Rust + SQLite, task board, usage-limit recovery, mobilní aplikace), `OrchestratorInc/agent-orchestrator` (Apache-2.0, 14 100 hvězd), `slopus/happy`, `oh-my-claudecode` | odmítnut | Vlastní fronta, stav a mobil místo Notion panelu a P20 GO (R5, R4). Nový démon a síťový povrch (Tailscale/web dashboard) (R1). Nenapojí se na lease, fence, journal, `goBlocker` a TARS-GUARD bez přepisu (R3). Srovnání nákladů §8 |
| Reset / usage limit (parser) | GitHub (`claude usage-limit`, top 10), npm (`claude usage limit reset`), skilly a pluginy (web, `wong2/claude-plugins`), lokální pluginy | — | `terryso/claude-auto-resume` (MIT, 819 hvězd), plugin `resumer` (bez licence), `tokenmaxxing` 1.194.0 (npm) | vzor (auto-resume), odmítnut (ostatní) | Auto-resume: tři doložené tvary hlášek jako fixture (§8.2), ale čeká uvnitř procesu, při minulém čase hádá „zítra“, spouští `--dangerously-skip-permissions`. `resumer`: pro interaktivní session přes channel/MCP server. `tokenmaxxing`: přepínání více účtů, mimo zadání a mimo pravidla předplatného |
| Watchdog / supervize procesu | GitHub (v1), lokální macOS | — | launchd, pm2, supervisord | launchd vybrán | Beze změny proti v1 |
| Smyčka agenta | lokální plugin `ralph-loop` (claude-plugins-official), Claude Code `/loop` | — | `ralph-loop` | odmítnut | Interaktivní smyčka „while true“ se stejným promptem. Bez lease, claimu a HOLD (R3, R4) |
| Hooky / guard | lokální plugin `hookify`, `security-guidance` | — | `hookify` | odmítnut | TARS-GUARD a hooky už existují (PR #100). Žádná nová funkce pro etapu 4 |
| Headless běh modelu | Claude Code docs, Agent SDK docs, Codex CLI | — | `claude --bare -p`, Agent SDK | odmítnut | §5 řádky D3, D4 |
| Skilly | lokální `~/.claude/skills` (2), repo `.claude/skills` (1), seznam skillů v session, web (skill indexy) | `notion queue dispatcher resume` | žádný skill s frontou nebo claimem | — | Skilly jsou instrukce pro model, ne trvalý proces pod lease. Pro dispatcher nepoužitelné |

**Lokální vs. cloud:** lokální katalogy (pluginy, skilly, agenti) nemají kandidáta pro frontu, claim ani dispatcher. Cloudové registry (MCP, GitHub, npm) mají kandidáty jen pro dílčí části. Každý z nich obchází alespoň jeden z R1, R3 nebo R5.

## 5. Verdikty

Verdikt oblasti: **PŘEVZÍT / PŘEVZÍT VZORY / STAVĚT VLASTNÍ**. Stav kandidáta: `vybrán`, `vzor`, `odmítnut`.

### Oblast I — inbox. Verdikt: **PŘEVZÍT** (Notion REST)

| # | Kandidát | Stav | Zdůvodnění |
| --- | --- | --- | --- |
| I1 | Notion REST `POST /v1/data_sources/{id}/query` (už v repu, `findRowByOrderId`) | vybrán | R2 (polling bez endpointu), R5. Stránkování ověřeno v kroku 0 |
| I2 | Notion webhooks `page.properties_updated` | vzor | Potřebuje veřejný endpoint (R2). Doručení bez pořadí, max. 8 pokusů během ~24 h. Vzor: událost jen jako signál, stav vždy z API |
| I3 | Notion komentáře (`created_by`) | vzor | Mimo etapu 4, pro Q1-B |
| I4 | MCP servery pro Notion (oficiální a komunitní) | odmítnut | Žádný nemá polling ani claim. Běží v session modelu, ne v ticku pod lease (R3) |

### Oblast F — fronta a claim. Verdikt: **STAVĚT VLASTNÍ** (protokol prepare/commit nad `Store` a `EffectJournal`)

| # | Kandidát | Stav | Zdůvodnění |
| --- | --- | --- | --- |
| F1 | `@lomatina/queue-lite` 0.1.0 | odmítnut | Nezralost (jediné vydání, 5 měsíců bez změny) a R3 |
| F2 | `@inharness-ai/sqlite-queue`, `@zbil/liteque` | vzor | Lease a at-least-once jako vzor. Nová závislost (R1), bez napojení na fence a journal (R3) |
| F3 | Vlastní protokol nad `Store` a `EffectJournal` | vybrán | Jediná varianta, která splní R3 bez přepisu jádra. Náklady §8.1 |

### Oblast E — durable execution. Verdikt: **PŘEVZÍT VZORY**

| # | Kandidát | Stav | Zdůvodnění |
| --- | --- | --- | --- |
| E1 | Inngest | vzor | Durable steps a idempotency keys. Server (R1). Licence jen poznámka (§3.2) |
| E2 | Trigger.dev | vzor | Checkpoint a pokračování kroku. Self-host s Postgres a Redis (R1) |
| E3 | Temporal | vzor | Deterministický replay z historie. Server + DB (R1) |
| E4 | `workflow` (Vercel) 5.4.0, `@visulima/workflow` 4.0.0 | vzor | Vestavné knihovny, ale vlastní model kroků a úložiště místo `Store`/`EffectJournal` (R3), nová závislost (R1) |
| E5 | `@dbos-inc/dbos-sdk` 5.4.0 | odmítnut | Potřebuje Postgres (R1) |

### Oblast W — watchdog a ukončení procesu. Verdikt: **PŘEVZÍT** (launchd + Node + vestavné funkce Claude Code a Codexu)

| # | Kandidát | Stav | Zdůvodnění |
| --- | --- | --- | --- |
| W1 | launchd `StartCalendarInterval`, `AbandonProcessGroup`, `ExitTimeOut` | vybrán | Ověřeno v man stránce. Řeší zmeškaný běh po spánku a zbylé procesy |
| W2 | launchd `WatchPaths` / `QueueDirectories` | odmítnut | Man stránka: „highly race-prone“. Ztracená událost bez HOLD (R4) |
| W3 | pm2, supervisord | odmítnut | Další démon (R1), launchd úlohu už plní. Licence jen poznámka (§3.2) |
| W4 | Node `spawn({ detached: true })` + `process.kill(-pgid)` | vybrán | Ukončí celou skupinu. Povinný guard: `pid` musí být kladné celé číslo (nodejs/node#65052) |
| W5 | Claude Code `CLAUDE_CODE_RETRY_WATCHDOG=1` se stropy `…_MAX_WAIT_MS` a `…_MAX_USAGE_LIMIT_WAIT_MS` | vybrán **pro PR 4c** | **PŘEVZÍT pro PR 4c po PR 1, s limity a testy podle v6.1; PR 0 nic nezapíná.** TARS nad watchdogem drží vlastní tvrdý limit procesu s ukončením potomků (W4), při doloženém resetu uloží `PAUSED` + čas, ukončí běh a uvolní lease přes fence. Testy na simulovaných chybách bez čerpání kvóty: `PAUSED`, doložený reset, ukončení podřízeného procesu, jediný platný claim po restartu. Viz §6 |
| W6 | Claude Code `-p`: SIGTERM ukončí strom procesů Bash, `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`, `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | vybrán | Headless docs (čteno 5. 11. 2026): „On SIGTERM, Claude Code terminates the process tree of any Bash command that is still running“, exit 143. Zbytkové riziko: vnuk se `setsid` |
| W7 | Codex `exec --json`, `codex exec resume` | vybrán | Lokálně ověřeno (`codex-cli 0.166.0`). Tvar JSONL ověří fixture test PR 4a |
| W8 | plugin `ralph-loop` | odmítnut | Interaktivní smyčka bez lease a HOLD (R3, R4) |

### Oblast C — konec běhu (completion event). Verdikt: **PŘEVZÍT** (exit kód a výstup `-p`)

| # | Kandidát | Stav | Zdůvodnění |
| --- | --- | --- | --- |
| C1 | exit kód + `result` zpráva `stream-json` / `json` | vybrán | Docs: exit 0 / nenulový, poslední řádek streamu je `result` |
| C2 | hook `SessionEnd` | odmítnut | Async práce v hooku se při ukončení zabije (#41577 → #24206) |

### Oblast R — reset limitu. Verdikt: **STAVĚT VLASTNÍ** (malý parser nad ověřenými tvary), se vzory

| # | Kandidát | Stav | Zdůvodnění |
| --- | --- | --- | --- |
| R1 | `stream-json` `system/api_retry` (`error: rate_limit`) | vybrán jako **doklad třídy limitu** | Strukturovaný signál. **Nenese čas resetu** (§8.2) |
| R2 | `Intl` (Node) pro Europe/Prague, gap/fold | vybrán | Bez závislosti |
| R3 | `terryso/claude-auto-resume` 1.5.0 | vzor | Tři doložené tvary hlášek jako fixture. Kód se nepřebírá: čeká uvnitř procesu a drží lease, při minulém čase hádá „zítra“ (R4), jen angličtina, bez Codexu (§8.2) |
| R4 | plugin `resumer` | odmítnut | Pro interaktivní session přes channel/MCP server, ne pro `-p` pod lease (R3). Bez licence v repu (jen poznámka) |
| R5 | parser `parseReset(text, received_at, defaultTz)` (PR 1, #105) | vybrán | Parsuje jen ověřené tvary, jinak `nedoloženo` → `PAUSED` s `pauseMinutes` / HOLD. Nikdy nehádá datum |

### Oblast D — dispatcher a headless běh. Verdikt: **STAVĚT VLASTNÍ** (tenký dispatcher fable/dev nad inboxem a claimem)

| # | Kandidát | Stav | Zdůvodnění |
| --- | --- | --- | --- |
| D1 | `mixpeek/amux`, `OrchestratorInc/agent-orchestrator`, `slopus/happy` | odmítnut | Vlastní fronta, stav a mobil místo Notion panelu a P20 (R5, R4), nový démon a síťový povrch (R1), bez napojení na lease, journal a guard (R3). Náklady §8.1 |
| D2 | Claude Code cloud sessions | odmítnut | Mimo Mac, lease, journal a TARS-GUARD (R2, R3) |
| D3 | **`claude --bare -p`** | odmítnut | Docs (čteno 5. 11. 2026): `--bare` přeskakuje „hooks, skills, custom commands, subagents, installed plugins, MCP servers, auto memory, and CLAUDE.md“. „Hooks still don't run in bare mode when you pass them with `--settings`“. „bare mode doesn't use your subscription login“, „never reads OAuth credentials or the system keychain“, potřebuje `ANTHROPIC_API_KEY`. Pro TARS: vypne TARS-GUARD a hooky (R3) a vyžaduje API klíč místo předplatného (R2). **Pojistka §7** |
| D4 | **Claude Agent SDK** (TypeScript / Python) | odmítnut | Docs (čteno 5. 11. 2026): „Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods“. Přechod = API klíč a jiný model účtování (R2) a přestavba hranice dítěte, kterou dnes drží `claude -p` + TARS-GUARD (R3). Vzor: `interrupt()` a `canUseTool` jako inspirace |
| D5 | Dispatcher fable/dev nad inboxem | vybrán | Musí sedět na claim, revalidaci a allowlist efektů (v6 §5, §3.3, §6.4) |

### Oblast N — N03 hranice zápisu. Verdikt: **PŘEVZÍT** (git `GIT_CONFIG_COUNT/KEY/VALUE`, `GH_CONFIG_DIR`)

Beze změny proti v1. Patří do PR 4b.

## 6. Watchdog podle v6.1 (G-02)

- **PR 0 nic nezapíná.** Žádná změna prostředí dítěte, plistu ani nastavení.
- **PR 4c (po mergi PR 1):** zapnutí `CLAUDE_CODE_RETRY_WATCHDOG=1` se stropy `CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS` a `CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS` (přesné názvy proměnných ověří PR 4c proti changelogu nainstalované verze), třída B (provozní nastavení), karta a GO vlastníka.
- Nad watchdogem TARS drží vlastní tvrdý limit procesu (W4). Při doloženém resetu uloží `PAUSED` a čas, ukončí běh a uvolní lease přes fence. Dítě nikdy nečeká na reset s drženým lease.
- **Zdroje reset signálů při změně verze:** PR 4c zapíše do evidence `claude --version` a `codex --version`. Fixture testy tvarů (`system/api_retry`, hlášky limitu, Codex JSONL) jsou svázané s verzí. Jiná verze na Macu, než pro kterou fixture prošly = tvar „neověřený“ → `nedoloženo` → `PAUSED` s `pauseMinutes`, nikdy odhad.

## 7. Pojistka proti obejití hooků (G-05)

- Docs uvádí: „`--bare` is the recommended mode for scripted and SDK calls, and will become the default for `-p` in a future release.“ Pozdější verze Claude Code tedy může vypnout hooky v `-p` bez změny na straně TARS.
- Pravidlo pro PR 4a/4c (doporučení, ne stavba v PR 0): TARS nikdy nespouští `--bare` ani Agent SDK. Před přijetím výsledku dítěte ověří, že běh načetl hooky projektu (např. událost `hook_started`/`hook_response` hooku `SessionStart`, nebo pole `system/init`). Chybí-li důkaz = HOLD, výsledek se nepřijme.
- Statický test (PR 4a): diff nesmí přidat `--bare`, `@anthropic-ai/claude-agent-sdk` ani `ANTHROPIC_API_KEY` do prostředí dítěte.

## 8. Srovnání nákladů (G-06)

Orientační odhad Claude Code, ne měření. Person-hours = práce stavitele a kontroly, bez čekání na vlastníka.

### 8.1 Fronta, claim a dispatcher

| Položka | A: tenký vlastní adaptér + stávající `Store`/`EffectJournal` | B: nejlepší hotový kandidát (`mixpeek/amux`) + integrace, migrace, provoz |
| --- | --- | --- |
| Stavba | PR 3 inbox + ACK + receipty ~15–25 h. PR 5 claim, revalidace, dispatcher, zámky ~30–45 h | Instalace a průzkum kódu (Rust) ~8–12 h. Most Notion ↔ task board ~10–16 h. Přenos GO receiptů, revalidace a allowlistu efektů do cizího modelu ~30–50 h, plně jen přepisem cizího jádra |
| Migrace | žádná (nová pole volitelná, `runs/inbox/` přidané) | Dvojí stav: SQLite amux + `runs/` TARS. Reconcile mezi nimi ~10–15 h, nový zdroj nesouladu |
| Testy obnovy a bezpečnosti | crash injection 5 hranic, 9 testů odvolání, N10 testy ~20–30 h (plánováno ve v6) | Stejné testy + testy cizího démona (restart, souběh s lease, síťový povrch) ~25–40 h. Testy nad cizím kódem jsou křehčí při aktualizaci |
| Provoz | 0 nových procesů. launchd jako dnes | Nový démon, aktualizace, Tailscale / web dashboard = nový síťový povrch a tok dat (karta DR-025). ~1–3 h měsíčně |
| Bezpečnost | Zůstává TARS-GUARD, P20, `goBlocker`, fence | Cizí proces spouští agenty. Hooky a guard by se musely ověřit pro jeho způsob spuštění. Mobilní aplikace = druhý kanál schvalování proti P20 |
| Licence (poznámka) | — | MIT + Commons Clause (soubor), interní použití podle textu volné. Právně neověřeno |
| **Součet (orientačně)** | **~65–100 h, 0 h/měsíc provozu navíc** | **~85–135 h + 1–3 h/měsíc, a stejně neprojde R3 a P20** |

Závěr: B je dražší a navíc nesplní R3/R5. A je levnější a nemění bezpečnostní hranici. Verdikt STAVĚT VLASTNÍ pro F a D platí.

### 8.2 Parser resetu: proč nestačí jen `stream-json`

- `system/api_retry` (docs, čteno 5. 11. 2026) má pole `attempt`, `max_retries`, `retry_delay_ms`, `error_status`, `error` (`rate_limit` …). **Nemá čas resetu kvóty.** `retry_delay_ms` je zpoždění dalšího pokusu, ne konec limitu předplatného.
- Hláška o limitu předplatného přichází jako text, ne jako strukturované pole. Doložené tvary (fixture `terryso/claude-auto-resume`, commit `b7f2484…`):
  1. `Claude AI usage limit reached|<epoch>`
  2. `5-hour limit reached ∙ resets 3am`
  3. `You've hit your limit · resets 2am (Europe/Paris)`
- Codex `exec --json` má vlastní JSONL, tvar limitu není doložený (ověří PR 4a fixture).
- České tvary (výstup TARS a GPT v prohlížeči) nejsou zdrojem CLI. Parser je přijme jen tehdy, když je doloží fixture.
- Pravidlo: parsovat **jen ověřené tvary** s časovou zónou podle v6 §10.3. Čas bez data, který už minul, se **nehádá** na „zítra“ (to dělá `claude-auto-resume`). Výsledek = `nedoloženo` → `PAUSED` s `pauseMinutes`, nebo HOLD. Neznámý tvar = `nedoloženo`.
- Náklad: parser a testy ~4–8 h (PR 1, #105, 31 testů). Převzetí hotového skriptu by stejně vyžadovalo přepis kvůli R4 a R3.

## 9. Závěr brány

- **Verdikty oblastí:** I PŘEVZÍT, F STAVĚT VLASTNÍ, E PŘEVZÍT VZORY, W PŘEVZÍT (W5 až v PR 4c), C PŘEVZÍT, R STAVĚT VLASTNÍ, D STAVĚT VLASTNÍ, N PŘEVZÍT.
- **Žádná nová služba, framework, závislost ani náklad.** Nic se neinstaluje a nic nezapíná.
- **Brána není uzavřená:** G-01 čeká na rozhodnutí vlastníka (výjimka nebo role Zbrojíře). Do té doby HOLD pro PR 3, PR 4c a PR 5.
- **Otevřené:** tvar JSONL limitu Codexu (PR 4a), názvy proměnných watchdogu proti nainstalované verzi (PR 4c), důkaz načtení hooků v `-p` (§7).

## Zdroje

- DR-027, DR-025, DR-024: Decision Register (mimo repo)
- Návrh etapy 4 v6 §12 a dodatek v6.1 (mimo repo)
- Claude Code headless: https://code.claude.com/docs/en/headless
- Agent SDK: https://code.claude.com/docs/en/agent-sdk/overview
- launchd.plist(5): https://keith.github.io/xcode-man-pages/launchd.plist.5.html
- SessionEnd: https://github.com/anthropics/claude-code/issues/41577
- Node: https://github.com/nodejs/node/issues/65052
- Notion webhooks: https://developers.notion.com/reference/webhooks-events-delivery
- MCP registry: https://registry.modelcontextprotocol.io/v0/servers?search=notion , https://registry.modelcontextprotocol.io/v0/servers?search=queue
- GitHub: https://github.com/mixpeek/amux , https://github.com/OrchestratorInc/agent-orchestrator , https://github.com/terryso/claude-auto-resume , https://github.com/wong2/claude-plugins , https://github.com/keng1304/claude-codex-bridge , https://github.com/inngest/inngest , https://github.com/triggerdotdev/trigger.dev , https://github.com/temporalio/temporal , https://github.com/Unitech/pm2 , https://github.com/Supervisor/supervisor , https://github.com/lolmatina/queue-lite
- npm: https://www.npmjs.com/package/workflow , https://www.npmjs.com/package/@visulima/workflow , https://www.npmjs.com/package/@dbos-inc/dbos-sdk , https://www.npmjs.com/package/tokenmaxxing , https://www.npmjs.com/package/@inharness-ai/sqlite-queue , https://www.npmjs.com/package/@zbil/liteque , https://www.npmjs.com/package/@lomatina/queue-lite
