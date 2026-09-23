# H2 Inbox Watcher — runbook

Pilot tool for **H2 Planning OS v0.3** (Notion: *🗓️ H2 Planning OS v0.1 — 7denní pilot (pravidla)*).
Every minute it reads Todoist **Doručené**. If nothing is new it stops there (1 Todoist GET, no LLM).
Each new item is classified once by Claude Haiku 4.5, validated deterministically, then written to
Todoist / Google Calendar, and one Telegram summary is sent per run.
Decision record: `docs/h2/DECISIONS.md` DEC-009.

| What | Where |
|---|---|
| Code | `/opt/h2-inbox-watcher` (root-owned, copied from `muj-web/h2/inbox-watcher`) |
| Secrets | `/etc/h2-inbox-watcher/env` (root:root 600, read by systemd only) |
| State (SQLite) | `/var/lib/h2-inbox-watcher/state.db` (user `h2iw`, 700 dir) |
| Calendars | hlavní `honza.bindr@gmail.com` (povinnost), „H2 · Fokus", „H2 · Regenerace", „H2 · Lidé", „H2 · Domov", „H2 · Zážitky", „H2 · Info" — looked up by exact name; a missing one leaves the item in Doručené with „❓ chybí kalendář X" |
| Units | `h2-inbox-watcher.service` (oneshot), `h2-inbox-watcher.timer` (minutely) |
| Logs | journald: task ids + types only, never item text |

## Start / stop

```bash
ssh hz systemctl enable --now h2-inbox-watcher.timer
```
```bash
ssh hz systemctl disable --now h2-inbox-watcher.timer
```
Emergency stop is the second command. Nothing else has to be stopped: the service is oneshot.

## Status and logs

```bash
ssh hz 'systemctl list-timers h2-inbox-watcher.timer --no-pager; journalctl -u h2-inbox-watcher -n 50 --no-pager'
```
```bash
ssh hz H2IW_DB=/var/lib/h2-inbox-watcher/state.db /opt/h2-inbox-watcher/.venv/bin/python -m h2iw.status
```
Shows item counts per status, notes per subtype, the last 10 items (ids and types only), LLM calls and USD per day.

## Costs

Daily calls and USD are in the `h2iw.status` output above.
Hard caps (in `h2iw/config.py`): 200 LLM calls per day, 3 USD per calendar month (Europe/Prague).
When a cap is hit, new items stay in Doručené with status `SKIPPED_CAP` and Telegram says so once per day.

## Credential preflight (read-only)

```bash
ssh hz 'systemd-run --wait --pipe --quiet -p User=h2iw -p EnvironmentFile=/etc/h2-inbox-watcher/env -p Environment=H2IW_DB=/var/lib/h2-inbox-watcher/state.db -p StateDirectory=h2-inbox-watcher -p WorkingDirectory=/opt/h2-inbox-watcher /opt/h2-inbox-watcher/.venv/bin/python -m h2iw.preflight'
```
Checks Todoist, Google token + both H2 calendars, Telegram `getMe` and the Anthropic model. Prints OK/FAIL, never values.
HTTP client loggers (`httpx`, `httpx2` — used by anthropic SDK 1.x, `httpcore`, `anthropic`) are kept at WARNING: at INFO httpx would log the Telegram URL, which contains the bot token.

## Manual dry run (reads + classifies, writes nothing)

```bash
ssh hz 'systemd-run --wait --pipe --quiet -p User=h2iw -p EnvironmentFile=/etc/h2-inbox-watcher/env -p Environment=H2IW_DB=/var/lib/h2-inbox-watcher/state.db -p StateDirectory=h2-inbox-watcher -p WorkingDirectory=/opt/h2-inbox-watcher /opt/h2-inbox-watcher/.venv/bin/python -m h2iw.main --dry-run --process-existing'
```
Dry run prints item titles to the terminal (not to journald) and does cost LLM calls.

## First run

The first real run marks every item already in Doručené as `BASELINE` (ids only, no text, no LLM)
and processes only items added afterwards.

## Encryption key

`H2IW_ENCRYPTION_KEY` (dedicated, preferred) or `H2_ENCRYPTION_KEY_V1` (H2 Buddy key v1): 32 bytes, base64. Each row records its `key_id`.
Generate a dedicated key on the VPS itself (the value never leaves the server):

```bash
ssh hz 'openssl rand -base64 32 | /opt/h2-inbox-watcher/deploy/set-secret.sh H2IW_ENCRYPTION_KEY'
```
There is no re-encryption tool yet: replacing the key makes existing rows unreadable. Keep a copy of the key in the password manager.

## Secret rotation

One key at a time; the next minutely run picks it up (no restart, the service is oneshot).

```bash
ssh -t hz /opt/h2-inbox-watcher/deploy/set-secret.sh TODOIST_API_TOKEN
```
Same command with `ANTHROPIC_API_KEY`, `H2_TELEGRAM_BOT_TOKEN`, `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET`.
After rotating, revoke the old value at its source (Todoist settings → Integrations, Anthropic Console,
BotFather `/revoke`, Google Cloud Console).

Google refresh token (from the owner's Mac, macOS system `python3` 3.9+, standard library only, no venv).
The script reads `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` from the VPS env file over ssh (never printed) and asks only if they are missing. `--self-test` checks everything except the browser and the token exchange.

```bash
python3 deploy/google_oauth_bootstrap.py | ssh hz /opt/h2-inbox-watcher/deploy/set-secret.sh GOOGLE_REFRESH_TOKEN
```
The OAuth consent screen must be **In production**; in *Testing* Google expires refresh tokens after 7 days.
Symptom of an expired/revoked token: journald shows `GCalError ... invalid_grant`, Telegram alert after 5 failed runs.

## Redeploy code

```bash
cd ~/Projects/muj-web/h2/inbox-watcher && rsync -a --delete --exclude .venv --exclude __pycache__ --exclude .pytest_cache ./ hz:/opt/h2-inbox-watcher/ && ssh hz /opt/h2-inbox-watcher/deploy/install.sh
```

## Failure behaviour

- Any failed run increments a counter; the 5th consecutive failure sends one Telegram alert.
- A crash between write steps resumes on the next run from the recorded step (no second LLM call,
  calendar events use deterministic ids so they are never duplicated).
- Items the model cannot classify stay in Doručené with a `❓ důvod` comment and are never retried.
- Raw item text is deleted from SQLite 30 days after it was first seen.
- NOTE items (ideas, journal, people) and COMMAND items are kept in the `notes` / `commands` tables permanently, AES-256-GCM encrypted (`h2iw/crypto.py`, same byte layout as H2 Buddy's envelope). Their plaintext copy in `items` is scrubbed right after the encrypted insert, and the DB file is checkpointed and vacuumed (`secure_delete=on`).
- COMMAND items (change requests „smaž…", „přesuň…", „odlož…" and status updates „hotovo…", „nedovolal jsem se…, čekám") are never executed. The item is moved unchanged and open to the Todoist project „H2 · Příkazy" for the Planner (chat with Claude); Telegram says „➡️ předáno Plánovači: …". A text that opens with a change/status verb but was not classified COMMAND stays in Doručené.

## Hard bans (enforced in code, covered by tests)

- Calendar client can only list calendars and insert events — no update/delete exists.
- Todoist writes re-check that the task is still an open Inbox task; nothing outside Doručené is touched.
- A new TASK/WAITING with an explicit time and a reminder request („připomeň mi…", „přidej připomenutí", „upozorni mě") gets a Todoist push reminder at due time (relative, 0 min). Without a time: date only, no reminder.
- An input with two or more separate actions/appointments is never partly applied: it stays in Doručené with „❓ více věcí najednou — rozdělit".
- `focus` / ⭐ is never assigned; deadlines only from an explicit „do …" in the item itself.
- No LLM call when nothing is new.
