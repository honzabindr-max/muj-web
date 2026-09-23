"""One watcher run (systemd oneshot, every minute).

Empty Inbox / nothing new  ->  exactly one Todoist list call, no LLM, no
Telegram, return. Logs carry task ids and types only, never item text.
"""

from __future__ import annotations

import argparse
import fcntl
import json
import logging
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable

from . import config, render
from .apply import Applier
from .classify import ClassifyResult
from .store import Store, utcnow
from .todoist import NotInInboxError
from .validate import Invalid, validate

log = logging.getLogger("h2iw")

Classifier = Callable[[str, str, datetime], ClassifyResult]

APPLY_GIVE_UP_ATTEMPTS = 10


@dataclass
class Report:
    lines: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    llm_calls: int = 0
    baseline: int = 0
    sensitive_written: bool = False


class Runner:
    def __init__(self, store: Store, todoist, applier: Applier, classifier: Classifier,
                 dry_run: bool = False):
        self.store = store
        self.todoist = todoist
        self.applier = applier
        self.classifier = classifier
        self.dry = dry_run

    # --- helpers ----------------------------------------------------------
    def _status(self, tid: str, status: str, error: str | None = None) -> None:
        if not self.dry:
            self.store.set_status(tid, status, error)

    def _unknown(self, task: dict, reason: str, report: Report) -> None:
        tid = task["id"]
        log.info("item %s -> UNKNOWN", tid)
        if not self.dry:
            try:
                self.applier.mark_unknown(tid, reason)
            except NotInInboxError:
                self._status(tid, "GONE")
                return
            self._status(tid, "UNKNOWN_MARKED", reason)
        short = (task.get("content") or "").strip().replace("\n", " ")[:60]
        report.lines.append(f"❓ {short} — {reason} (zůstává v Doručených)")

    def _prefilter(self, task: dict) -> str | None:
        content = (task.get("content") or "").strip()
        if not content:
            return "prázdná položka"
        if task.get("parent_id"):
            return "podúkol — třídím jen samostatné položky"
        if (task.get("due") or {}).get("is_recurring"):
            return "opakovaný úkol — nechávám na ruční zařazení"
        if len(content) + len(task.get("description") or "") > 2000:
            return "příliš dlouhý text"
        return None

    def _caps_ok(self, now: datetime) -> bool:
        return (
            self.store.llm_calls_today(now) < config.DAILY_LLM_CALL_CAP
            and self.store.llm_cost_this_month(now) < config.MONTHLY_USD_CAP
        )

    # --- main -------------------------------------------------------------
    def run_once(self, now: datetime, process_existing: bool = False) -> Report:
        report = Report()
        inbox = self.todoist.list_inbox()
        by_id = {t["id"]: t for t in inbox}

        if self.store.get_meta("baseline_done") is None and not process_existing:
            if not self.dry:
                for t in inbox:
                    # Baseline keeps ids only: no LLM, no raw text for old items.
                    self.store.insert_raw({"id": t["id"], "added_at": t.get("added_at")},
                                          status="BASELINE")
                self.store.set_meta("baseline_done", now.isoformat())
            report.baseline = len(inbox)
            log.info("baseline: %d existing inbox items marked, not processed", len(inbox))
            return report

        known = self.store.known_ids()
        resumable = self.store.resumable_ids()

        for tid in resumable - by_id.keys():
            # Left the Inbox outside our control, or our last step (close/move)
            # succeeded but the process died before recording it.
            any_step = any(
                self.store.step_done(tid, s)
                for s in ("todoist_update", "gcal_insert", "todoist_comment", "note_insert",
                      "command_insert")
            )
            self._status(tid, "APPLIED" if any_step else "GONE")

        work = [t for t in inbox if t["id"] not in known or t["id"] in resumable]
        if not work:
            return report  # the common case: no LLM, no Telegram

        if not self.dry:
            self.store.purge_raw_text(now)
        for task in work:
            try:
                self._process(task, now, report)
            except Exception as e:  # one bad item must not block the rest
                log.error("item %s failed: %s", task["id"], type(e).__name__)
                report.errors.append(f"{task['id']}: {type(e).__name__}")
        if report.sensitive_written:
            self.store.purge_file_remnants()
        return report

    def _process(self, task: dict, now: datetime, report: Report) -> None:
        tid = task["id"]
        if not self.dry and self.store.get(tid) is None:
            self.store.insert_raw(task)  # raw input persisted before anything else
        row = self.store.get(tid)

        if row is not None and row["classification_json"]:
            data = json.loads(row["classification_json"])
        else:
            reason = self._prefilter(task)
            if reason:
                self._unknown(task, reason, report)
                return
            if not self._caps_ok(now):
                log.warning("item %s skipped: LLM cap reached (calls_today=%d, month_usd=%.4f)",
                            tid, self.store.llm_calls_today(now),
                            self.store.llm_cost_this_month(now))
                self._status(tid, "SKIPPED_CAP")
                if self.store.get_meta("cap_notice_day") != now.astimezone(config.TZ).date().isoformat():
                    if not self.dry:
                        self.store.set_meta("cap_notice_day",
                                            now.astimezone(config.TZ).date().isoformat())
                    report.lines.append("⛔ denní/měsíční strop LLM dosažen — nové položky čekají")
                return
            attempts = self.store.bump_attempts(tid) if not self.dry else 1
            try:
                res = self.classifier(task.get("content") or "", task.get("description") or "", now)
            except Exception as e:
                log.warning("item %s classify error: %s", tid, type(e).__name__)
                if attempts >= config.MAX_CLASSIFY_ATTEMPTS:
                    self._unknown(task, "klasifikace opakovaně selhala", report)
                else:
                    self._status(tid, "FAILED_RETRYABLE", type(e).__name__)
                    report.errors.append(f"{tid}: classify {type(e).__name__}")
                return
            self.store.record_llm_call(tid, config.MODEL, res.in_tokens, res.out_tokens)
            report.llm_calls += 1
            if res.data is None:
                self._unknown(task, f"model nevrátil platný výstup ({res.error})", report)
                return
            data = res.data
            if not self.dry:
                self.store.set_classification(tid, data)

        source = f"{task.get('content') or ''}\n{task.get('description') or ''}"
        v = validate(data, now, source)
        if isinstance(v, Invalid):
            self._unknown(task, v.reason, report)
            return
        log.info("item %s -> %s", tid, v.type)
        line = (render.command_line(task.get("content") or "") if v.type == "COMMAND"
                else render.summary_line(v))
        if self.dry:
            report.lines.append("[dry-run] " + line)
            return
        try:
            self.applier.apply(v, task)
        except NotInInboxError:
            self._status(tid, "GONE")
            return
        except Exception as e:
            attempts = self.store.bump_attempts(tid)
            log.error("item %s apply error: %s", tid, type(e).__name__)
            if attempts >= APPLY_GIVE_UP_ATTEMPTS:
                self._unknown(task, "zápis opakovaně selhal", report)
            else:
                self._status(tid, "CLASSIFIED", type(e).__name__)
                report.errors.append(f"{tid}: apply {type(e).__name__}")
            return
        self._status(tid, "APPLIED")
        if v.type in ("NOTE", "COMMAND"):
            report.sensitive_written = True
        report.lines.append(line)


def quiet_http_loggers() -> None:
    """httpx logs full request URLs at INFO; the Telegram URL contains the bot
    token. Keep HTTP client loggers at WARNING so no secret reaches journald."""
    for name in ("httpx", "httpx2", "httpcore", "anthropic"):
        logging.getLogger(name).setLevel(logging.WARNING)


def format_summary(report: Report) -> str | None:
    if not report.lines:
        return None
    head = f"📥 H2 Doručené — {len(report.lines)} " + (
        "položka" if len(report.lines) == 1 else "položky" if len(report.lines) < 5 else "položek"
    )
    return "\n".join([head, *report.lines, "", "(automat — na tuhle zprávu neodpovídej)"])


def _build(dry_run: bool):
    import anthropic

    from .classify import classify
    from .gcal import GCalClient
    from .telegram import TelegramClient
    from .todoist import TodoistClient

    from .crypto import load_key

    secrets = config.load_secrets()
    store = Store(config.db_path(), load_key())
    todoist = TodoistClient(secrets.todoist_token)
    gcal = GCalClient(secrets.google_client_id, secrets.google_client_secret,
                      secrets.google_refresh_token)
    llm = anthropic.Anthropic(api_key=secrets.anthropic_key, max_retries=2, timeout=60)
    runner = Runner(store, todoist, Applier(store, todoist, gcal),
                    lambda text, desc, now: classify(llm, text, desc, now), dry_run=dry_run)
    return store, runner, TelegramClient(secrets.telegram_token)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="h2iw")
    p.add_argument("--dry-run", action="store_true",
                   help="read + classify, print, write nothing to Todoist/Calendar/Telegram")
    p.add_argument("--process-existing", action="store_true",
                   help="skip the first-run baseline and process items already in the Inbox")
    args = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s",
                        stream=sys.stderr)
    quiet_http_loggers()

    lock_path = config.db_path() + ".lock"
    os.makedirs(os.path.dirname(lock_path) or ".", exist_ok=True)
    with open(lock_path, "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            log.info("another run holds the lock, exiting")
            return 0

        store, runner, telegram = _build(args.dry_run)
        try:
            report = runner.run_once(utcnow(), process_existing=args.process_existing)
            failed = bool(report.errors)
            fail_reason = report.errors[0] if failed else ""
        except Exception as e:
            log.error("run failed: %s", type(e).__name__)
            report, failed, fail_reason = Report(), True, type(e).__name__

        if args.dry_run:
            for line in report.lines:
                print(line)
            print(f"llm_calls={report.llm_calls} errors={report.errors}")
            return 1 if failed else 0

        text = format_summary(report)
        if text:
            try:
                telegram.send(text)
            except Exception as e:
                log.error("telegram summary failed: %s", type(e).__name__)
                failed, fail_reason = True, f"telegram {type(e).__name__}"

        streak = int(store.get_meta("consecutive_failures") or 0)
        if failed:
            streak += 1
            store.set_meta("consecutive_failures", str(streak))
            if streak == config.FAILURE_ALERT_THRESHOLD:
                try:
                    telegram.send(f"⚠️ H2 Inbox Watcher selhal {streak}× po sobě ({fail_reason}). "
                                  "Detaily: journalctl -u h2-inbox-watcher")
                except Exception as e:
                    log.error("telegram alert failed: %s", type(e).__name__)
        elif streak:
            store.set_meta("consecutive_failures", "0")
        log.info("run done: llm_calls=%d lines=%d errors=%d baseline=%d",
                 report.llm_calls, len(report.lines), len(report.errors), report.baseline)
        return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
