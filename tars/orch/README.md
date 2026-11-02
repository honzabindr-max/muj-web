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
