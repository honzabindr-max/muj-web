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
| Notion transport | `claude -p --model sonnet` + one Notion MCP tool (or REST if `NOTION_TOKEN` is set) | write content |

The code refuses to start when a department has creator and checker from the same model family.

## Lifecycle

`NEW → PLANNED → DOING → CHECKING → (FIXING ≤ 3) → DELIVERED → [KONZILIUM] → WAITING_OWNER → DONE`,
plus `PAUSED` (subscription limit, resumes on a later tick), `FAILED`, `UNKNOWN`, `SUPERSEDED` (replaced by a newer recipe, not a REJECT).

## Konzilium (TARS-ORCH-001 §2e, DR-024)

Every owner-bound output of a department with a Konzilium recipe (copy, Příprava rozhodnutí) passes `KONZILIUM` before `WAITING_OWNER` — one pass + incorporation, `konzilium.ts`:

1. **Advokát prvního principu** (Claude) — first-principle questions. Paid-offer copy always carries 3 recipe questions (product name, paid-layer name, purchase likelihood). Questions on Sponsor decisions / locked contracts (model flag + code regex) open **Příprava rozhodnutí** orders (`prep.ts`: Claude research with WebSearch/WebFetch only → GPT check → own Konzilium → own card). Max 3 per Konzilium, deduped by `decision_key`, no recursion.
2. **Rada odborníků** (cards in `specialists/mezi-vami/konzilium/`): Claude = prodejní psycholog, brand stratég, etický strážce; GPT = UX/UI, hlas zákazníka. Each returns PALEC / VÝHRADA / ÚPRAVA with target, reason and source.
3. **Creator** incorporates (table „Zapracování konzilia“); **judge of the other family than the creator** builds `runs/<id>/decision.json` (recommended version, max 1 alternative, verdicts, disputes, author). Code verifies every customer text is a verbatim quote from a draft (1 retry, then UNKNOWN).

Every card has Postup + Dosah; Dosah tools are enforced as `--allowedTools/--disallowedTools` (Claude) or `codex exec -s read-only`.

## Decision card (local panel)

`/rozhodnuti/<id>` (`decision-card.ts`): recommended version in the customer view (MEZI VÁMI tokens: plum, EB Garamond + Jost), the alternative next to it, thumbs and reasons of the council, buttons GO / alternativa / REJECT. The POST is the panel's only write: loopback peer, Host/Origin check, CSRF token (HMAC per process), then it spawns `cli.ts owner <id> GO|ALT|REJECT`. Notion keeps an archive card with the link.

## Merge policy (DR-024, `merge-policy.ts`)

Deterministic by changed paths. Class A (`tars/**` except guard, `docs/**`, `design/**`, `missions/**`, tests, root `*.md` except CLAUDE/AGENTS, `package.json` without dependency changes): TARS merges after green `test` + `janitor` and PASS review by the other model family (`gh pr ready` → `gh pr update-branch` when BEHIND → `gh pr merge --squash --delete-branch`). Class B (app/**, public/**, DB/migrations, `.claude/**`, hooks, guard, `.github/**`, lockfiles/dependencies, production config, unknown paths): visual card for the owner; after GO on the card TARS merges.

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
npx tsx tars/orch/cli.ts owner <order-id> GO|ALT|REJECT
npx tsx tars/orch/cli.ts supersede <order-id> --redo <reason>
npx tsx tars/orch/cli.ts merge <pr-number> [claude|gpt]   # DR-024: class A only, class B → card
npx vitest run tars
tars/orch/launchd/install.sh
```

## Specialist cards and adapter ladder

- Cards: `tars/orch/specialists/mezi-vami/*.md` (TARS-ORCH-001 §2a). No valid card → `PLANNED → UNKNOWN`, the specialist never runs.
- Every card names a checker of the other model family, including the supervisor (GPT checks the brief) and the gate (Claude checks the gate verdict form).
- Rungs (§2b): 1 CLI/API, 2 MCP, 3 browser (variant B: real Chrome with the TARS-agent profile, debugging port on 127.0.0.1 only for the job, Playwright over CDP — `cdp.ts`, `browser.ts`), 4 desktop (`desktop.ts`, interface only in v0).
- TARS-GUARD I8 (`guard/i8.sh`): debugging port only in the TARS-agent profile, only on 127.0.0.1, only during an order; no Google account in the profile. The orchestrator runs it with the hook; `guard/tars-guard.proposed.sh` is the hook with I8 wired in (owner installs).
- AI Chain gets the MEZI VÁMI sentinel through `runs/<order-id>/prompts/` (run.sh reads prompts from its cwd); run.sh is not edited.

## One-time owner step: TARS-agent browser profile

The orchestrator never logs in. The owner creates and logs in the profile once:

```
mkdir -p "$HOME/Library/Application Support/TARS-agent/chrome-profile" && open -na "Google Chrome" --args --user-data-dir="$HOME/Library/Application Support/TARS-agent/chrome-profile" https://claude.ai/login https://chatgpt.com/auth/login https://www.notion.so/login
```

Log in to Claude, ChatGPT and Notion only (no e-mail, bank, GitHub admin, no Chrome sync). Quit that Chrome window with Cmd+Q. Then:

```
cd ~/Projects/muj-web && npx tsx tars/orch/cli.ts browser-check
```

## Control panels

- Notion „TARS — Zakázky“ (https://app.notion.com/p/f12aa6d7804b4af0858db6b46167a3e5): one row per order, rewritten by the script on every transition (`panel.ts`). Values are computed from `state.json`; the MCP transport is verified against the computed payload. A failed write is logged and caught up by the next transition. View „Panel“ groups by Fronta: waiting for owner → running → done.
- Local live panel: `npm run tars:panel` → http://127.0.0.1:4747 (`panel-server.ts`); decision cards at `/rozhodnuti/<id>` (only write action, see above).
