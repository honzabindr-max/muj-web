# TARS-ORCH v0 — supervisor and departments

Spec: Notion TARS-ORCH-001 v0.1 (§3–§7), decisions DR-022 and DR-023.

## What it does

A deterministic script drives work orders for a mission (first mission: MEZI VÁMI).
Models only produce text:

| Role | Model | Never does |
| --- | --- | --- |
| Supervisor | `claude -p --model opus` + Notion fetch | create or check |
| Copy creator | `codex exec` (GPT) | check |
| Copy checker | `claude -p --model opus` | create |
| Dev creator | `~/Projects/ai-chain/run.sh` (Claude chain) | check |
| Dev checker | deterministic checks + `codex exec` review | create |
| Notion transport | Notion REST API with the token from the macOS Keychain; without it `claude -p --model sonnet` + one Notion MCP tool | write content |

The code refuses to start when a department has creator and checker from the same model family.

## Verdict from GPT: `codex exec --output-schema`

Every GPT checker (`CodexCli`, `supportsOutputSchema`) is called with `--output-schema` and must return exactly one JSON object
(`verdict.ts`):

```json
{"verdict": "PASS" | "FIX" | "BLOCK", "findings": [{"severity": "critical|high|medium|low|info", "file": "path or null", "line": 12, "text": "…"}]}
```

`BLOCK` (needs the owner) stays from the earlier text protocol; the Vizuál gate uses its four Build OS P1.6 verdicts with the same `findings`.
Parsing is strict (`parseStructuredVerdict`): prose, fenced JSON, extra keys, a FIX without findings or a PASS with critical/high findings are all
**not** a PASS. They become `FIX` with the issue „Nelze ověřit: …“ (`unverifiable`). Claude checkers keep the ```` ```json ```` protocol.
The family rule (`assertFamilies`, brief checker ≠ supervisor family) is unchanged and independent of the output format.

## Codex plugin and review gate (interactive work only)

The official plugin `openai/codex-plugin-cc` is installed at user level (`/plugin marketplace add openai/codex-plugin-cc`,
`/plugin install codex@openai-codex`, `/codex:setup`). Its review gate (Stop hook) is a per-workspace switch stored by the plugin
outside the repo (`/codex:setup --enable-review-gate` run inside the repo; default off everywhere else), so it cannot be set in
`.claude/settings.json`. The automat's own `claude -p` calls pass inline `--settings` that disables the plugin (`ORCH_CLAUDE_SETTINGS`),
because they run inside this repo and would otherwise trigger a GPT review per call. The gate runs locally only, never in CI of the public repo.

## Lifecycle

`NEW → PLANNED → DOING → CHECKING → (FIXING ≤ 3) → DELIVERED → WAITING_OWNER → DONE`,
plus `PAUSED` (subscription limit, resumes on a later tick), `WAITING_REVIEW` („čeká na kontrolu“, P16 v2), `FAILED`, `UNKNOWN`.

### Kontroly mimo kód přes GPT v prohlížeči (P16 v3)

Pravidlo vlastníka (P16 v3, 4. 11. 9:53): kontrolu zadání supervizora, kontrolu copy, vizuální bránu a oponenta
Konzilia Lite dělá GPT v prohlížeči (`chatgpt-web.ts`, `ChatGptWebChecker`, rodina `gpt`) v běžném režimu Chat
(čerpá paušál ChatGPT, ne limit Work): chatgpt.com → přepínač „Chat | Work“ = Chat (když Chat není, `UNKNOWN
chat-nedostupny`; Work nikdy, ani jako fallback; žádný projekt) → GPT-6 (záložní GPT-5.6 Sol) → intenzita Vysoká
(záložní nejvyšší stupeň posuvníku; skutečný model ze stránky se zapíše do `runs/<zakázka>/check-gptweb-*.md` a do
logu; stránka s Work nebo modelem Work = `WAITING_REVIEW` „běží v režimu Work místo Chat“) → jedno odeslání promptu →
čekání na koncovou značku → odpověď se čte ze
stránky jako data a v kódu se ověří podle JSON schématu. Žádný nový prohlížečový kód: `McpBrowser` + `mcp-gate.ts`
(host allowlist, one submit, vkládaný text musí sedět na sha256 promptu). Nikdy se nepřihlašuje.
Kontrola kódu (oddělení dev) zůstává Codex. Tvůrce copy je kvůli tomu Claude Opus (kontroluje jiná rodina).

Nepřihlášený profil, selhání prohlížeče, limit, timeout nebo odpověď mimo schéma = `waitReview`: zakázka přejde do
`WAITING_REVIEW` se stejným artefaktem (`review_hash` = sha256 zadání v `meta.pending_brief`, nebo draftu). Další tick
to zkusí znovu nejvýš jednou; změněný artefakt = `UNKNOWN`. Bez skutečné odpovědi nikdy PASS.
Živý neškodný test: `npx tsx tars/orch/cli.ts gpt-smoke` (prompt `GPT_SMOKE_PROMPT` „Kontrola spojení TARS. Napiš
slovo OK.“; dřívější „Odpověz jen slovem OK.“ vylučoval koncovou značku). Profil TARS-agent musí být přihlášený do
ChatGPT (běžný účet); přihlašuje se jen vlastník. Výběr „Vybrat model ChatGPT“ ovladač otevírá nejvýš 3× (vždy nový
snapshot a ref, Escape pro jiný popover); stav se pořád počítá jen z otevřeného výběru ve čtení.

- State: `runs/<order-id>/state.json` (atomic write). Episodic log: `runs/log.jsonl`. Both are gitignored.
- One owner of the state (DR-039, etapa 2): every state carries a monotonic `version`; `Store.save` writes only over
  the version it read (compare-and-set under the short `runs/.state.lock`). Older output — a late worker after
  `abort`, a second process that read earlier — is refused and logged („zastaralý zápis stavu odmítnut“), the newer
  state stays and the step stops.
- Tick lock `runs/.lock` is a lease: token, fence (monotonic, `runs/.fence`), PID, process start time (`ps -o lstart`),
  heartbeat. It is taken over only when the holder provably does not run (PID gone, or another start time), never by
  age; anything uncertain = HOLD (tick ends `locked`). Only the holder's own token releases it. Saves under the lease
  are fenced (lock still ours, stored fence not newer); a tick that lost the lease stops before the next step.
- The short `runs/.state.lock` follows the same rule (kolo oprav 1): it carries token, PID and process start time, is
  created atomically with its full content, and is taken over only when the holder provably does not run — never by
  age, so a process paused in the middle of a save keeps it. Busy or uncertain = wait, then HOLD (the operation throws
  „zámek .state.lock, HOLD“ and is retried later). Takers exclude each other with `runs/.state.lock.takeover`.
- `runs/.fence` is written atomically (unique tmp + fsync + rename + fsync of the directory). A missing or damaged
  counter is never read as 0: the next fence is max(readable counter, current lock, every `fence` in
  `runs/*/state.json`) + 1. If the counter is damaged and some `state.json` is unreadable too, the tick is HOLD
  („tick lock HOLD: fence nelze bezpečně určit“ in `runs/log.jsonl`).

### Vedlejší účinky: journal a obnova po pádu (DR-039, etapa 3)

- Každý externí zápis zakázky — DRAFT stránka (`deliver` copy/vizual), PR (`deliver` dev), karta GO/REJECT, karta
  UNKNOWN, komentář s upozorněním na iPhone — má záznam v `runs/<id>/effects/<krok>-r<kolo>.json` (`effects.ts`),
  zapsaný trvale jako `.fence` (tmp + fsync + rename + fsync adresáře). Pořadí: `PREPARED` → zápis → receipt
  (`EFFECT_DONE`, URL objektu). `operation_id` = `<zakázka>/<krok>/r<kolo>` (kolo oprav, u komentáře číslo přechodu
  do `WAITING_OWNER`); opakovaný pokus má stejné id a jen zvýší `attempts`.
- Vytvářený objekt nese značku `[op:<operation_id>]`: u Notion stránek na konci titulku (tělo stránky, na které stojí
  read-back hash, se nemění; řádek panelu titulek stránky nezobrazuje), u PR v těle.
- Tick, který najde `PREPARED` bez receiptu (proces spadl mezi zápisem a uložením výsledku), nevolá znovu naslepo:
  dohledá značku — Notion přes REST výpis potomků rodičovské stránky (`GET /v1/blocks/{parent}/children`, celý, ne
  vyhledávání, které čerstvé stránky nevidí), PR přes `gh pr list --head tars/<id> --state all`. Právě jeden nález →
  receipt se doplní a zakázka pokračuje. S jistotou nic → nový pokus se stejným `operation_id`. Cokoli nejasného
  (chyba hledání, víc kopií, nalezený objekt v koši, neúplný výpis, dohledání není k dispozici — bez tokenu nebo
  oddělení bez `findEffect`) → `EFFECT_UNKNOWN` / HOLD: zakázka `UNKNOWN` s důvodem „EFFECT_UNKNOWN (…)“ v logu i
  v panelu (Poslední krok) a žádný další zápis. Receipt už v journalu (pád po receiptu, před `state.json`) se použije
  bez dohledání. Zápis, který skončil chybou s nejasným výsledkem, zůstává `PREPARED` (příště se nejdřív dohledává);
  čisté odmítnutí (REST 4xx kromě 408, secret-scan) je `EFFECT_ABSENT` a smí se opakovat.
- Komentář s upozorněním nejde dohledat podle značky: pokus bez receiptu se neopakuje (`EFFECT_UNKNOWN`,
  `meta.owner_ping` se označí), stejně jako dosud nejasný výsledek.
- Panel: selhaný zápis řádku označí zakázku `dirty:` v `runs/panel-index.json`; další tick řádek přepíše ze
  `state.json` (stejné ID zakázky → stejný řádek; po nejasném vytvoření se řádek nejdřív dohledá podle „ID zakázky“).
- Nouzový postup u `EFFECT_UNKNOWN`: v Notionu (pod rodičovskou stránkou DRAFTů) nebo na GitHubu vyhledej značku
  z důvodu v panelu. Zakázka zůstává `UNKNOWN`; rozhodnutí, zda ji zopakovat, je na vlastníkovi.

### Nouzový postup: zámek visí (HOLD)

Známé riziko, záměrně neopraveno: zámek starého formátu (jen PID, z doby před etapou 2), zámek bez čitelného času
startu, nebo živý, ale zaseknutý držitel = HOLD. TARS ho sám nikdy neodstraní. Postup pro vlastníka / Fable:

1. Zjisti, kdo zámek drží: `cat runs/.lock runs/.state.lock runs/.state.lock.takeover` (chybějící soubor = ten zámek
   nevisí). Zámek nese `pid` a `started`.
2. Ověř, že tick neběží: `launchctl print gui/$(id -u)/work.good-inventions.tars-orch | grep -E 'state|pid'` nesmí
   ukazovat `state = running`, a `pgrep -fl 'tars/orch/cli.ts'` nesmí vrátit nic (ani `owner`, `abort`, `tick`).
3. Porovnej držitele: `ps -o pid=,lstart= -p <pid ze zámku>`. Smazat je bezpečné jen když proces neexistuje, nebo
   má jiný čas startu než `started` v zámku. Když proces běží a je to `cli.ts`, nemaž — počkej, nebo ho nejdřív
   řádně ukonči (`kill <pid>`, ne `-9`) a opakuj krok 2.
4. Teprve pak odstraň jen ten jeden visící soubor (`runs/.lock`, `runs/.state.lock` nebo `runs/.state.lock.takeover`).
   `runs/.fence` ani `state.json` nemaž nikdy.
5. HOLD kvůli fence: oprav nebo obnov nečitelný `runs/<id>/state.json` (hláška v logu říká který), nebo zapiš do
   `runs/.fence` číslo vyšší než každé `fence` ve `runs/*/state.json`. Další tick pokračuje.
- `cli.ts tick` requires an explicit `TARS_DEPARTMENTS` (e.g. `copy`; all = `copy,dev,vizual`); without it, or with
  an unknown name, it refuses to run (N3). The launchd plist sets `copy`.
- `WAITING_OWNER` when the output is a PR into main, or the order touches a Sponsor-reserved decision
  (LOCK, price, brand, payments, legal, CTE). A GO/REJECT card is created in Notion.
- WIP limit 1: no new order starts while a card waits for the owner.

### Znovuvydání karty (`cli.ts reissue <order-id>`)

Zakázka, která dostala kartu ještě před DR-039 (ve `WAITING_OWNER`, bez `meta.approved_hash`), GO nikdy nepřijme
(„chybí approved_hash“). `npx tsx tars/orch/cli.ts reissue <order-id>` ji pod stavovým zámkem a CAS vrátí do
`DELIVERED`: smaže starou kartu (`owner_card_url`) i všechna `owner_*` pole v `meta`, zvýší kolo karty
`meta.reissue_round` (uloží i `meta.reissued_at`) a zapíše „karta znovuvydána“ do `runs/log.jsonl`. Jiný stav nebo karta
s otiskem = odmítnuto (exit 1). Staré GO se nikdy nepřebírá.

Každé kolo karty má **vlastní řádek panelu** (starý řádek se nepřepisuje):
- Ve stejném zámku `PanelIndex.retire` vyřadí dosavadní řádek (`superseded:<id>` v `runs/panel-index.json`) a index
  patří novému kolu (`round:<id>`), zatím bez řádku. Index na vyřazený řádek už nikdy neukáže: `PanelIndex.set` odmítne
  vyřazený řádek i zápis staršího kola, takže pozastavený `cli.ts panel-sync` ani opožděný REST PATCH staré karty
  (po MCP fallbacku) nemůže index vrátit; jejich zápis skončí jen ve starém řádku.
- Další tick projde standardní cestou: read-back DRAFTu → nová karta s `approved_hash`/`artifact_hash`. Teprve s ní
  vznikne nový řádek (karta je v něm od prvního zápisu, „Rozhodnutí vlastníka“ prázdné). Vytvoření jde přes stejný
  journal efektů etapy 3 jako řádek kola 0: operace `<id>/panel-row/r<n>` (n = kolo karty) v `runs/<id>/effects/`
  (PREPARED před zápisem, EFFECT_DONE s receiptem po něm; pokus bez odpovědi se nejdřív dohledá podle „ID zakázky“ a
  odkazu na aktuální kartu, vyřazené řádky se vynechají; MCP hledání to ověřit neumí, takže tam = HOLD). Karta
  znovuvydaného kola je v journalu samostatný efekt `<id>/owner-card-k<n>/r<fix>`, receipt staré karty se nepřevezme.
- Potom se starý řádek označí Stav `SUPERSEDED`, Fronta „3 · Hotové“, Čeká na vlastníka = ne, Poslední krok
  „karta znovuvydána → nový řádek <id>“, bez odkazu na kartu. Selhání se zkusí znovu při dalším zápisu.
- Všechny zápisy (tick, `panel-sync`, oprava karty) cílí na row id, které index drží pro kolo uloženého stavu.

**Zámek panelu zakázky** (kolo oprav 5): všechno, co čte nebo zapisuje řádek panelu, jeho index nebo journal efektu
(zápis v ticku, `cli.ts panel-sync`, `reissue`, vytvoření nového řádku, oprava karty, poll rozhodnutí, opakované
upozornění), běží pod `runs/<id>/.panel.lock`. Zámek se drží i přes síťový zápis; pravidla jako lease etapy 2: token +
PID + čas startu, monotónní fence `runs/<id>/.panel-fence`, převzetí jen po prokázaném konci držitele, nikdy podle
stáří; čekání nejdéle `panelLockWaitMs` (30 s), pak HOLD („zámek .panel.lock, HOLD“ v logu, nic se nezapíše). Kolo karty,
row id i odkaz karty se čtou až pod zámkem těsně před zápisem; před každým zápisem se ověří fence (neplatný fence = zápis
se neodešle). PREPARED, POST, receipt i zápis do indexu nového řádku proběhnou pod jedním zámkem, takže souběžný proces
PREPARED bez receiptu neuvidí, dokud POST běží. Po převzetí zámku: nejdřív dohledání, jistě nenalezeno = nový pokus se
stejným operation_id, chyba dohledání = HOLD. `PanelIndex.set` pro stejné kolo nepřepíše existující řádek jiným ID
(„panel HOLD: index kola … už drží jiný řádek“ v logu). Každý zápis řádku se zaznamená (`written:<id>`: řádek, kolo,
karta, fence). Visící zámek: stejný postup jako u `.state.lock` výš (zjistit PID z `.panel.lock`; jen když proces
prokazatelně neběží a TARS ho sám nepřevzal, smazat `runs/<id>/.panel.lock`).

Rozhodnutí se čte **jen** z řádku aktuálního kola a přijme se, když je řádek spolehlivě přečtený (ne koš, sloupec
existuje), jeho odkaz „Karta rozhodnutí“ je přesně aktuální karta s otiskem a poslední zápis pod zámkem panelu šel do
tohoto řádku, v tomto kole, s touto kartou. Když řádek ukazuje jinou kartu (zapsal ji tam kdokoli mimo zámek) nebo
záznam posledního zápisu nesedí, řádek se znehodnotí (`tainted:<id>`), odkaz se přepíše a rozhodnutí z něj se už nikdy
nepřijme (HOLD; vlastník rozhodne přes `cli.ts owner`). Rozhodnutí na řádku SUPERSEDED se ignoruje navždy. Orchestrátor
do pole „Rozhodnutí vlastníka“ nikdy nezapisuje (P20).
`reissue` není rozhodnutí vlastníka, bash-preflight ho nebrání; `cli.ts owner` zůstává pro agenta blokované.

## Safety

- TARS-GUARD runs at the start of every tick and again before delivery. ALARM = stop.
- Every model output passes a secret scan. A hit drops the output; it is never stored or sent.
- API-key environment variables are removed from child processes, so the CLIs stay on subscriptions.
- No merge, deploy, DB write, workflow dispatch or purchase anywhere in the code.

## Commands

```
npx tsx tars/orch/cli.ts tick
npx tsx tars/orch/cli.ts status
npx tsx tars/orch/cli.ts browser-check   # login check of the TARS-agent profile (Playwright MCP), dir runs/shots-browser-check
npx tsx tars/orch/cli.ts browser-smoke   # about:blank in the TARS-agent profile through Playwright MCP, dir runs/shots-browser-smoke
npx tsx tars/orch/cli.ts gpt-retry <id> fable|vlastnik <proč>   # one new GPT check attempt after a burned one (never automatic)
npx tsx tars/orch/cli.ts konzilium <vstup.json>   # Konzilium Lite, viz níže
npx tsx tars/orch/cli.ts reissue <order-id>       # znovuvydání karty bez otisku, viz Lifecycle
npx vitest run tars
tars/orch/launchd/install.sh             # StartInterval 1800 s (dnešní varianta, zároveň backward cesta z etapy 4 PR 2)
tars/orch/launchd/install.sh wake-gate   # minutová brána wake-gate.sh (etapa 4 PR 2, Q5-A) — instalovat jen s kartou a GO vlastníka
```

## Etapa 4 PR 2: probuzení, dispatch.json, read-back (NAVRH-v6 §10.2, §6.1, §6.3)

- **`launchd/wake-gate.sh`** (čistý `/bin/sh`, bez node, modelu a guardu) běží každou minutu z
  `work.good-inventions.tars-orch.wake-gate.plist` (`StartCalendarInterval`, po probuzení Macu doběhne jednou). Plný tick
  (`TARS_GATE_TICK`) spustí jen při (a) platném `runs/next-wake` bez ticku od jeho platnosti, (c) re-entry po `locked` /
  `guard_alarm` s backoffem 1, 2, 5, 10, 30 min (nejvýš 5×), nebo (b) pojistce 30 min. Zámek brány `runs/wake/gate.lock.d`,
  záznamy `runs/wake/` (`last-gate-start`, `outcomes/`, `gate.log` s `wake_late_by_s`, `gate-locks/<den>/`, `stale-locks/`).
- **`runs/next-wake`** zapisuje jen tick pod lease ve `finally` (`wake.ts`, `reconcileNextWake`): doložené převzetí →
  `runs/wake/consumed/`, neúspěch pod lease → nový soubor s backoffem a starý do `runs/wake/superseded/`. Nic se nemaže.
  `cli.ts tick` s `TARS_GATE_START` zapíše jednou `runs/wake/outcomes/<epoch>` (`ran` | `locked` | `guard_alarm`).
- **Obě plist varianty mají stejný Label** (`work.good-inventions.tars-orch`): instalace jedné nahradí druhou. Návrat
  (backward) = `tars/orch/launchd/install.sh` bez argumentu; `runs/wake/` a `runs/next-wake` zůstanou a stará varianta je
  ignoruje. Tick zapisuje `runs/next-wake` v obou variantách (bez brány ho nikdo nečte).
- **`dispatch.json`** (`v`, `mode`, `max_chunks`, `private_draft_parents`), výchozí `mode: "hold"`. Čtení fail-closed:
  chybí / nevalidní / neznámý klíč = `hold`; `runs/HOLD` přebije soubor. `mode` řídí jen novou práci dispatcheru inboxu
  (PR 3/5), ne zakázky supervizora. Tick pod lease zaznamená režim do `runs/dispatch-mode.json`; první tick po přechodu
  `hold → run` má `may_start_new = false` (jen rozpracované).
- **`readbackBlocker`** (`approval.ts`, vynucuje ho stavový automat): `delivered` s `owner_needed = false` → `DONE` jen s
  čerstvým read-backem stejné URL, jehož otisk se rovná `delivered_hash`. Selhané čtení = zůstává `DELIVERED`. Jiný otisk
  nebo chybějící `delivered_hash` (např. doručení obnovené po pádu) = žádné `DONE`, zakázka jde na kartu vlastníka
  (`READBACK_MISMATCH`, GO vázané na otisk read-backu).
- **GPT v prohlížeči jen při probuzeném displeji** (`display.ts`, zjištění 5. 11.): `osascript -l JavaScript` →
  `CGDisplayIsAsleep` (jen čtení, bez sudo). Spící displej nebo jakákoli nejistota = pokus se neprovede (žádný Chrome,
  žádný zápis do deníku pokusů), zakázka čeká ve `WAITING_REVIEW` s důvodem „displej spí“.

## Konzilium Lite (`konzilium-lite.ts`, místo PR #86)

Jen před podstatným rozhodnutím (`kind`: nabidka | ux | znacka | cena | architektura | bezpecnost). Claude (Opus, bez nástrojů)
navrhne jednu verzi + nejvýš 1 alternativu, GPT (`codex exec --output-schema`, read-only, izolovaně: `CODEX_ISOLATION_ARGS` = bez config.toml a jeho MCP,
pluginů, apps, hooků, shellu a webu; model z config.toml přes `-m`) ji oponuje (zákazník, obor,
bezpečnost, první princip). Normálně 2 volání, s jednou opravou nejvýš 4. Výstupy, kartu (card-data v1) a řádek panelu
(WAITING_OWNER) zapisuje jen skript, přes Notion REST (bez tokenu se nic nespustí). Rodina modelu je z konfigurace adaptéru.
Secret-scan všech vstupů i výstupů (i po rozbalení escapů, %XX a &#…;), nález nebo chyba scanu = STOP; zakódovaný obsah
(\ooo, \xXX, \uXXXX, %XX, &#…;) ve vstupních polích nebo v dekódované odpovědi modelu = STOP. GPT na limitu = PENDING,
neověřitelný posudek = PAUSED. Záznam běhu: `runs/konzilium/<run-id>/run.json` + kanonický JSON každé odpovědi (surový
výstup a chybová hláška modelu se neukládají, jen jejich sha256). Exit: 0 WAITING_OWNER, 1 FAILED, 2 STOP, 3 PENDING/PAUSED.

Vstup (JSON, jiné klíče se odmítnou):

```
{"title": "…", "kind": "cena", "question": "Co vlastník rozhoduje?", "context": "důkazový balíček",
 "criteria": ["…"], "first_principles": ["max 2 otázky"], "sources": ["volitelné"], "draft_url": "volitelný odkaz na Notion"}
```

## Specialist cards and adapter ladder

- Cards: `.claude/agents/**/*.md` (TARS-ORCH-001 §2a, DR-029 krok 2): Claude roles are Claude Code subagents, GPT roles (`gpt/`, no `name`) run through codex only; see `.claude/agents/README.md`. No valid card → `PLANNED → UNKNOWN`, the specialist never runs.
- Every card names a checker of the other model family, including the supervisor (GPT checks the brief) and the gate (Claude checks the gate verdict form).
- Rungs (§2b): 1 CLI/API, 2 MCP, 3 browser (variant B, DR-029 krok 6: real Chrome with the TARS-agent profile, debugging port on 127.0.0.1 only for the job, driven by Playwright MCP `@playwright/mcp@0.0.84 --cdp-endpoint` through `claude -p --strict-mcp-config` — `mcp-browser.ts`; Chrome and MCP are started only by `guard/tars-browser.sh`, every MCP tool call passes the `mcp-gate.ts` hook), 4 desktop (`desktop.ts`, interface only in v0).
- TARS-GUARD I8 (`guard/i8.sh`): debugging port only in the TARS-agent profile, only on 127.0.0.1, only during an order; no Google account in the profile; Playwright MCP never with `--extension`, a foreign `--user-data-dir` or a non-loopback `--cdp-endpoint`. The orchestrator runs it with the hook; `guard/tars-guard.proposed.sh` is the hook with I8 wired in (owner installs).
- AI Chain gets the MEZI VÁMI sentinel (`.claude/agents/invariant-sentinel.md`, frontmatter stripped) through `runs/<order-id>/prompts/` (run.sh reads prompts from its cwd); run.sh is not edited.

## One-time owner step: TARS-agent browser profile

The orchestrator never logs in. The owner creates and logs in the profile once:

```
mkdir -p "$HOME/Library/Application Support/TARS-agent/chrome-profile" && open -na "Google Chrome" --args --user-data-dir="$HOME/Library/Application Support/TARS-agent/chrome-profile" https://claude.ai/login https://chatgpt.com/auth/login https://www.notion.so/login
```

Log in to Claude, ChatGPT and Notion only (no e-mail, bank, GitHub admin, no Chrome sync). Quit that Chrome window with Cmd+Q. The first run downloads the pinned MCP package (`npx -y @playwright/mcp@0.0.84`; no browser download, it only attaches to Chrome). Then:

```
cd ~/Projects/muj-web && npx tsx tars/orch/cli.ts browser-check
```

## Notion zápis přes REST (DR-029 krok 5)

- Zápis stránek (DRAFT, karty GO/REJECT) a řádků panelu „TARS — Zakázky“ jde přímo na Notion REST API (`notion.ts`, `panel.ts`), bez Sonnetu. Token je jen v macOS Klíčence (`security find-generic-password -s tars-notion -a tars -w`, bez shellu). Nikdy z `.env` ani prostředí, nikdy v argumentu příkazu, v logu ani v Notionu.
- Když token v Klíčence není: log `Notion REST: token chybí, používám fallback` a funguje dosavadní cesta přes `claude -p` s Notion MCP. Stejně se chová jednotlivý zápis, který Notion odmítl dřív, než cokoli uložil (404/403 = stránka není sdílena s integrací, 401, 429). 401 a 429 vypnou REST do konce běhu pro zapisovač stránek i panel společně (jeden klient). Nejasný výsledek (5xx, síť) se u vytvoření stránky nebo řádku naslepo neopakuje přes MCP, aby nevznikl duplikát; u řádku panelu se zakázka označí v `panel-index.json` a příští synchronizace nejdřív dohledá řádek podle „ID zakázky“ (REST dotaz s filtrem, nikdy SQL/rows) a teprve potom případně vytvoří nový; 503 s `committed_resource_id` se bere jako uloženo. Aktualizace řádku a čtení se po 5xx/síti opakují přes fallback. Chyba zadání (400) fallback nespouští. Každé volání `claude -p` (i supervizor a kontroloři) má zakázané SQL/rows nástroje Notionu (`--disallowedTools`).
- Integrace TARS je sdílena se stránkou „TARS META OS — Bootstrap“ a jejími podstránkami a od 3. 11. 2026 08:56 i se stránkou MEZI VÁMI (V3 Deep Dive). REST read-back DRAFTu pod MEZI VÁMI byl ověřen živě 4. 11. 2026 00:37 (HTTP 200). Čtení HANDOFF a zdrojů zůstává přes MCP. Stránka, kterou integrace nevidí, jde při zápisu fallbackem přes MCP; takový DRAFT nemá REST read-back, a proto k němu karta GO/REJECT nevznikne (viz níže).
- Řádek panelu: nově „Kde běží“ (orchestrátor na Macu = Mac), „Proč tento model“, „Karta rozhodnutí“. Pole **„Rozhodnutí vlastníka“ orchestrátor nikdy nezapisuje**. Když u zakázky ve `WAITING_OWNER` vlastník vybere GO, GO A, GO B nebo REJECT, tick hodnotu přečte (REJECT → `FAILED`; volba A/B se uloží do `meta.owner_option`). Prázdná nebo neznámá hodnota se ignoruje. Rozhodnutí se čte **jen přes REST**: bez tokenu (fallback `claude -p`) se nepřebírá vůbec a do logu se jednou zapíše „čeká na token“. Rozhodnutí zadává vlastník v přehledu; agent ho nikdy nezadává za něj (DR-039, hooky `tars/guard/bash-preflight.py` a `tars/guard/notion-owner-decision.py`). Převzetí z Notionu a `abort` sdílejí krátký zámek `.state.lock`, takže REJECT nelze přepsat.
- GO vázané na obsah (DR-039): při doručení se uloží `meta.delivered_hash` = sha256 DRAFTu tak, jak ho orchestrátor odeslal (jen pro záznam, ke schválení se nepoužívá). Těsně před zápisem karty orchestrátor udělá read-back DRAFTu (`GET /v1/pages/{id}/markdown`, u PR `gh pr view --json headRefOid`) a otisk přesně přečteného obsahu (to, co vlastník na stránce uvidí) uloží jako `meta.approved_hash` i `meta.artifact_hash`. Karta vznikne až po úspěšném read-backu; když selže (chyba, bez tokenu, fallback přes MCP, stránka není sdílena s integrací), karta nevznikne, zakázka zůstane `DELIVERED` s důvodem „karta nevydána: read-back DRAFTu selhal“ a příští tick to zkusí znovu. Žádná karta bez otisku. GO se přijme jen při `artifact_hash === approved_hash`, zapíše se do `meta.owner_go` a zakázka **zůstává `WAITING_OWNER`**. `DONE` nastane až po čerstvém read-backu se shodou s `approved_hash` (jiný otisk, ani dřívější `rendered_hash`, neplatí); výsledek je v `meta.readback` (url, hash, verified_at). Bez read-backu zakázka čeká s důvodem „čeká na read-back“. Jiný obsah: zakázka zůstane `WAITING_OWNER` s důvodem „obsah se po vydání karty změnil“, GO se zruší a `artifact_hash` se přepíše, takže stejné GO už neprojde (zbývá REJECT). Stavový automat podmínku kontroluje sám (`approval.ts`, `goBlocker`).
- Známá rizika (DR-039): (1) Zakázka, která byla ve `WAITING_OWNER` už před tímto pravidlem a nemá `approved_hash`, po merge vyžaduje znovuvydání karty a nové GO; staré GO se nikdy nepřebírá. (2) Konzilium Lite je výjimka bez hash a read-back brány; z jeho `WAITING_OWNER` se nevyvozuje žádný schválený efekt. (3) `bash-preflight` kontroluje `cli.ts owner` i v surovém textu příkazu (uvozovky, heredoc, echo/printf, `bash -c`, `eval`, `xargs`), ale zakódované nebo obfuskované varianty (base64, skládání řetězců za běhu, vlastní skript volající `orch.owner()`) jsou mimo dosah textového hooku; ty řeší pravidlo P20 (rozhodnutí vlastníka DR-039). Hook je obrana ve vrstvách.
- Secret-scan: token se po načtení registruje a hledá se i přesná hodnota. Obsah stránky s tokenem se neodešle (žádná cesta), řádek panelu a každý záznam `log.jsonl` jde přes vymazání, chybové zprávy REST nesou jen status a kód.
- Kontrola nastavení: `npx tsx tars/orch/cli.ts notion-check` (vypíše jen OK nebo důvod, token nikdy).

### Jednorázové založení integrace (vlastník, iPhone nebo Mac, asi 2 minuty)

1. **Založ integraci.** Otevři https://www.notion.so/profile/integrations (v prohlížeči na iPhonu nebo Macu), klepni na „Nová integrace“, typ „Interní“ (Internal), název `TARS`, vyber svůj workspace a ulož. Na záložce „Capabilities / Oprávnění“ zaškrtni **Read content**, **Update content** a **Insert content** (TARS zakládá nové stránky a řádky, bez „Insert“ vrací Notion 403). „User information“ nech vypnuté. Na záložce „Configuration“ klepni na „Show“ a „Copy“ u „Internal Integration Secret“. Token nikam nevkládej ani nikomu neposílej.
2. **Sdílej jen jednu stránku.** Otevři stránku „TARS META OS — Bootstrap“, klepni na ••• vpravo nahoře, „Connections / Připojení“ (v aplikaci na iPhonu „Add connections“), vyber `TARS` a potvrď. Žádnou jinou stránku ani databázi s integrací nesdílej (podstránky Bootstrapu, včetně „TARS — Zakázky“, ji zdědí).
3. **Ulož token do Klíčenky.** Na Macu otevři Terminál a spusť (bez hodnoty, macOS se na ni sám zeptá a nezůstane v historii shellu):
   ```
   security add-generic-password -s tars-notion -a tars -w
   ```
   Na „password data for new item:“ vlož zkopírovaný token (z iPhonu přes univerzální schránku) a potvrď Enter, na „retype password:“ ho vlož znovu. Ověř: `cd ~/Projects/muj-web && npx tsx tars/orch/cli.ts notion-check` musí vypsat „Notion REST: token platný, stránka TARS META OS — Bootstrap je integraci sdílena“. Změna tokenu později: stejný příkaz s `-U` (`security add-generic-password -U -s tars-notion -a tars -w`).

### Upozornění na iPhone při WAITING_OWNER (plán B, krok 4b)

Pro vlastníka: v nastavení integrace TARS (https://www.notion.so/profile/integrations, záložka Capabilities) zapni „Insert comments“, jinak TARS komentář se zmínkou neodešle a jen to zaloguje („Integrace TARS nemá oprávnění Insert comments“).

Technicky: při přechodu do `WAITING_OWNER` zapíše integrace přes `POST /v1/comments` na řádek zakázky komentář se zmínkou vlastníka (`owner-ping.ts`), Notion pošle push u zmínky od někoho jiného než vlastníka. Jeden komentář na jeden přechod (značka `meta.owner_ping` ve stavu zakázky), bez tokenu se nic neposílá, text prochází secret-scanem, žádné SQL ani rows dotazy. ID uživatele je výchozí hodnota v kódu, přepíše se `TARS_OWNER_NOTION_USER_ID`.

Hlášky v logu podle odpovědi Notionu (tělo odpovědi se nikdy nelogí, jen známý kód):

- 403 → „Integrace TARS nemá oprávnění Insert comments“
- 404 „Could not find user … read user information“ → „Integrace TARS nemá oprávnění Read user information (bez e-mailů)“
- jiná 404 → „Integrace TARS nevidí stránku zakázky, zkontroluj sdílení stránky TARS META OS — Bootstrap“

Když komentář neodešel kvůli oprávnění nebo sdílení (`no_permission`, `failed`), každý další běžný tick to u zakázky ve `WAITING_OWNER` zkusí znovu, nejvýš jednou za tick, a po opravě nastavení komentář odejde sám. Nejasný výsledek (síť, 5xx, `uncertain`) se naslepo neopakuje.

Další tick (launchd, každých 30 min) už píše přes REST. Bez tokenu nebo při chybě se nic nerozbije, zápis jde fallbackem.

## Control panels

- Notion „TARS — Zakázky“ (https://app.notion.com/p/f12aa6d7804b4af0858db6b46167a3e5): one row per order, rewritten by the script on every transition (`panel.ts`). Values are computed from `state.json`; the REST payload is a fixed whitelist of columns and the MCP fallback transport is verified against the computed payload. A failed write is logged and caught up by the next transition. View „Panel“ groups by Fronta: waiting for owner → running → done.
- Lokální panel Mission Control (`npm run tars:panel`) je odstraněn (DR-028, krok 7 převodu DR-029). Přehled běhu je na iPhonu: https://claude.ai/artifact/DvYFryA3HCPTUrnNCv74Sj; stav zakázek drží Notion „TARS — Zakázky“ výše.
