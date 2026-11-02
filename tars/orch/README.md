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
plus `PAUSED` (subscription limit, resumes on a later tick), `FAILED`, `UNKNOWN`.

- State: `runs/<order-id>/state.json` (atomic write). Episodic log: `runs/log.jsonl`. Both are gitignored.
- `WAITING_OWNER` when the output is a PR into main, or the order touches a Sponsor-reserved decision
  (LOCK, price, brand, payments, legal, CTE). A GO/REJECT card is created in Notion.
- WIP limit 1: no new order starts while a card waits for the owner.

## Safety

- TARS-GUARD runs at the start of every tick and again before delivery. ALARM = stop.
- Every model output passes a secret scan. A hit drops the output; it is never stored or sent.
- API-key environment variables are removed from child processes, so the CLIs stay on subscriptions.
- No merge, deploy, DB write, workflow dispatch or purchase anywhere in the code.

## Commands

```
npx tsx tars/orch/cli.ts tick
npx tsx tars/orch/cli.ts status
npx tsx tars/orch/cli.ts owner <order-id> GO
npx vitest run tars
tars/orch/launchd/install.sh
```

## Specialist cards and adapter ladder

- Cards: `.claude/agents/**/*.md` (TARS-ORCH-001 §2a, DR-029 krok 2): Claude roles are Claude Code subagents, GPT roles (`gpt/`, no `name`) run through codex only; see `.claude/agents/README.md`. No valid card → `PLANNED → UNKNOWN`, the specialist never runs.
- Every card names a checker of the other model family, including the supervisor (GPT checks the brief) and the gate (Claude checks the gate verdict form).
- Rungs (§2b): 1 CLI/API, 2 MCP, 3 browser (variant B: real Chrome with the TARS-agent profile, debugging port on 127.0.0.1 only for the job, Playwright over CDP — `cdp.ts`, `browser.ts`), 4 desktop (`desktop.ts`, interface only in v0).
- TARS-GUARD I8 (`guard/i8.sh`): debugging port only in the TARS-agent profile, only on 127.0.0.1, only during an order; no Google account in the profile. The orchestrator runs it with the hook; `guard/tars-guard.proposed.sh` is the hook with I8 wired in (owner installs).
- AI Chain gets the MEZI VÁMI sentinel (`.claude/agents/invariant-sentinel.md`, frontmatter stripped) through `runs/<order-id>/prompts/` (run.sh reads prompts from its cwd); run.sh is not edited.

## One-time owner step: TARS-agent browser profile

The orchestrator never logs in. The owner creates and logs in the profile once:

```
mkdir -p "$HOME/Library/Application Support/TARS-agent/chrome-profile" && open -na "Google Chrome" --args --user-data-dir="$HOME/Library/Application Support/TARS-agent/chrome-profile" https://claude.ai/login https://chatgpt.com/auth/login https://www.notion.so/login
```

Log in to Claude, ChatGPT and Notion only (no e-mail, bank, GitHub admin, no Chrome sync). Quit that Chrome window with Cmd+Q. Then:

```
cd ~/Projects/muj-web && npx tsx tars/orch/cli.ts browser-check
```

## Notion zápis přes REST (DR-029 krok 5)

- Zápis stránek (DRAFT, karty GO/REJECT) a řádků panelu „TARS — Zakázky“ jde přímo na Notion REST API (`notion.ts`, `panel.ts`), bez Sonnetu. Token je jen v macOS Klíčence (`security find-generic-password -s tars-notion -a tars -w`, bez shellu). Nikdy z `.env` ani prostředí, nikdy v argumentu příkazu, v logu ani v Notionu.
- Když token v Klíčence není: log `Notion REST: token chybí, používám fallback` a funguje dosavadní cesta přes `claude -p` s Notion MCP. Stejně se chová jednotlivý zápis, který REST odmítne (404/403 = stránka není sdílena s integrací, 401, 429, 5xx, síť). Chyba zadání (400) fallback nespouští.
- Integrace je sdílena jen se stránkou „TARS META OS — Bootstrap“ a jejími podstránkami. Čtení HANDOFF a zdrojů zůstává přes MCP; stránky mimo Bootstrap (například rodičovská stránka MEZI VÁMI) REST nevidí a jdou fallbackem.
- Řádek panelu: nově „Kde běží“ (orchestrátor na Macu = Mac), „Proč tento model“, „Karta rozhodnutí“. Pole **„Rozhodnutí vlastníka“ orchestrátor nikdy nezapisuje**. Když u zakázky ve `WAITING_OWNER` vlastník vybere GO, GO A, GO B nebo REJECT, tick hodnotu přečte a provede přechod (GO / GO A / GO B → `DONE`, volba A/B se uloží do `meta.owner_option`; REJECT → `FAILED`). Prázdná nebo neznámá hodnota se ignoruje.
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

Další tick (launchd, každých 30 min) už píše přes REST. Bez tokenu nebo při chybě se nic nerozbije, zápis jde fallbackem.

## Control panels

- Notion „TARS — Zakázky“ (https://app.notion.com/p/f12aa6d7804b4af0858db6b46167a3e5): one row per order, rewritten by the script on every transition (`panel.ts`). Values are computed from `state.json`; the REST payload is a fixed whitelist of columns and the MCP fallback transport is verified against the computed payload. A failed write is logged and caught up by the next transition. View „Panel“ groups by Fronta: waiting for owner → running → done.
- Local live panel — **TARS Mission Control**: `npm run tars:panel` → http://127.0.0.1:4747 (read-only, refresh 3 s, `panel-server.ts` + `mission-control/`).
  - `/` owner view — V2-A final (`mission-control/final.ts`, `final-render.ts`): main area = the order closest to the owner's decision or delivery, other running orders (max 3, §2d) as live rows (`?focus=<id>` switches), flow drawn from the order's recipe (§2c), FIX loops, team shows who works on which order.
  - `/role/<id>` role page: description, Postup and Dosah from the card (else „Zatím nedefinováno“), current work, history from the log.
  - Optional data contract read by the dashboard (nothing breaks without it): `state.json` `recipe: { id, version?, steps: [{ role, label?, kind?: create|check|deliver|owner }] }` + `recipe_step`; per-order lock `runs/<id>/.lock` (PID); log entry `card` = role id of the specialist that made the call.
  - `/p0` the P0 owner view; `/preview/a`, `/preview/b` the V2 compositions.
  - `/zakazka/<id>` Focus Mode: full chronology, handoffs, verdicts, artifacts.
  - `/detail` technical panel (the former live panel: raw timeline, verdict reasons, screenshots).
  - `?demo=1&scenario=aktivita|oprava|cekani|chyba|dokonceni|prazdno|paralel` (or `?demo=paralel`) mock data from `mission-control/fixtures.ts`, always labelled „Ukázková data“.
  - Truth rules: status comes only from `state.json`, `log.jsonl` and `runs/.lock` (live PID). An active order without a live orchestrator process is shown as „Nelze ověřit“, never as working. Text from data passes the secret scan before it is rendered.
  - Different runs dir: `TARS_RUNS_DIR=/path/to/runs npm run tars:panel`.
