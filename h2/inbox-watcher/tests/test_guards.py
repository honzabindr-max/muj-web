"""Hard bans enforced by the client surface itself, tested against HTTP mocks."""

import httpx
import pytest

from h2iw import config
from h2iw.gcal import GCalClient, event_id_for
from h2iw.todoist import NotInInboxError, TodoistClient, TodoistError


def test_gcal_client_has_no_mutating_methods_for_existing_events():
    public = {m for m in dir(GCalClient) if not m.startswith("_")}
    assert public == {"calendar_id_by_name", "insert_event"}


def test_todoist_client_surface_has_no_delete():
    public = {m for m in dir(TodoistClient) if not m.startswith("_")}
    assert public == {"inbox_id", "project_id_by_name", "list_inbox", "get_task", "update_task",
                      "move_task", "close_task", "add_reminder", "add_comment"}


def test_event_id_uses_base32hex_alphabet():
    eid = event_id_for("6hc925WcvFQ34pp6", "EVENT")
    assert set(eid) <= set("0123456789abcdefghijklmnopqrstuv") and len(eid) >= 5


def _todoist(handler) -> TodoistClient:
    return TodoistClient("tok", http=httpx.Client(transport=httpx.MockTransport(handler)))


def _projects_or(task_project, posts):
    def handler(req: httpx.Request):
        if req.url.path == "/api/v1/projects":
            return httpx.Response(200, json={"results": [
                {"id": "INBOX", "inbox_project": True},
                {"id": config.H2_PROJECT_ID, "inbox_project": False}], "next_cursor": None})
        if req.method == "GET" and req.url.path.startswith("/api/v1/tasks/"):
            return httpx.Response(200, json={"id": "t", "project_id": task_project,
                                             "checked": False})
        posts.append(req.url.path)
        return httpx.Response(200, json={})
    return handler


@pytest.mark.parametrize("op", ["close", "update", "move", "comment", "reminder"])
def test_writes_refused_outside_inbox(op):
    posts = []
    c = _todoist(_projects_or(config.H2_PROJECT_ID, posts))
    with pytest.raises(NotInInboxError):
        {"close": lambda: c.close_task("t"),
         "update": lambda: c.update_task("t", {"content": "x"}),
         "move": lambda: c.move_task("t", config.H2_PROJECT_ID),
         "comment": lambda: c.add_comment("t", "x"),
         "reminder": lambda: c.add_reminder("t")}[op]()
    assert posts == []


def test_close_allowed_in_inbox():
    posts = []
    c = _todoist(_projects_or("INBOX", posts))
    c.close_task("t")
    assert posts == ["/api/v1/tasks/t/close"]


def test_update_rejects_forbidden_fields():
    c = _todoist(_projects_or("INBOX", []))
    with pytest.raises(TodoistError):
        c.update_task("t", {"priority": 4})
    with pytest.raises(TodoistError):
        c.update_task("t", {"project_id": "x"})


def test_list_inbox_paginates_and_fails_loudly_on_shape():
    pages = {None: {"results": [{"id": "1"}], "next_cursor": "c2"},
             "c2": {"results": [{"id": "2"}], "next_cursor": None}}

    def handler(req):
        if req.url.path == "/api/v1/projects":
            return httpx.Response(200, json={"results": [{"id": "I", "inbox_project": True}]})
        return httpx.Response(200, json=pages[req.url.params.get("cursor")])

    assert [t["id"] for t in _todoist(handler).list_inbox()] == ["1", "2"]

    def bad(req):
        if req.url.path == "/api/v1/projects":
            return httpx.Response(200, json={"results": [{"id": "I", "inbox_project": True}]})
        return httpx.Response(200, json={"items": []})

    with pytest.raises(TodoistError):
        _todoist(bad).list_inbox()


def test_gcal_409_is_idempotent_success():
    def handler(req):
        if req.url.host == "oauth2.googleapis.com":
            return httpx.Response(200, json={"access_token": "a"})
        return httpx.Response(409, json={})

    g = GCalClient("i", "s", "r", http=httpx.Client(transport=httpx.MockTransport(handler)))
    assert g.insert_event("cal", {"id": "abc12"}) == "exists"


def test_telegram_only_to_owner(monkeypatch):
    from h2iw.telegram import TelegramClient

    sent = []

    def handler(req):
        import json
        sent.append(json.loads(req.content))
        return httpx.Response(200, json={"ok": True})

    TelegramClient("tok", http=httpx.Client(transport=httpx.MockTransport(handler))).send("hi")
    assert sent[0]["chat_id"] == 6034875251


def test_missing_secrets_report_names_only():
    with pytest.raises(config.ConfigError) as e:
        config.load_secrets({"TODOIST_API_TOKEN": "secret-value"})
    assert "secret-value" not in str(e.value)
    assert "ANTHROPIC_API_KEY" in str(e.value)


def test_http_client_loggers_cannot_leak_urls():
    import logging

    from h2iw.main import quiet_http_loggers

    quiet_http_loggers()
    for name in ("httpx", "httpx2", "httpcore", "anthropic"):
        assert not logging.getLogger(name).isEnabledFor(logging.INFO)


def test_crypto_envelope_matches_h2_layout_and_rejects_bad_keys():
    import base64

    from h2iw.crypto import CryptoError, Key, decrypt, encrypt, load_key

    k = Key("h2iw", bytes(32))
    blob = encrypt(k, "ahoj")
    assert len(blob) == 12 + 16 + len("ahoj".encode())
    assert decrypt(k, blob) == "ahoj"
    with pytest.raises(CryptoError):
        decrypt(Key("h2iw", bytes([1]) * 32), blob)
    with pytest.raises(CryptoError):
        load_key({"H2IW_ENCRYPTION_KEY": base64.b64encode(bytes(16)).decode()})
    assert load_key({"H2_ENCRYPTION_KEY_V1": base64.b64encode(bytes(32)).decode()}).key_id == "h2-v1"
    with pytest.raises(CryptoError) as e:
        load_key({})
    assert "H2IW_ENCRYPTION_KEY" in str(e.value)


def test_reminder_body_is_relative_zero_push():
    import json as _json
    bodies = []

    def handler(req):
        if req.url.path == "/api/v1/projects":
            return httpx.Response(200, json={"results": [{"id": "INBOX", "inbox_project": True}]})
        if req.method == "GET":
            return httpx.Response(200, json={"id": "t", "project_id": "INBOX", "checked": False})
        bodies.append((req.url.path, _json.loads(req.content)))
        return httpx.Response(200, json={"id": "r1"})

    _todoist(handler).add_reminder("t")
    assert bodies == [("/api/v1/reminders", {"task_id": "t", "type": "relative",
                                             "minute_offset": 0, "service": "push"})]


def test_cost_formula_uses_cache_and_batch_multipliers():
    from h2iw import config as c
    assert abs(c.cost_usd(1_000_000, 0) - 1.0) < 1e-9
    assert abs(c.cost_usd(0, 0, cache_write=1_000_000) - 1.25) < 1e-9
    assert abs(c.cost_usd(0, 0, cache_read=1_000_000) - 0.10) < 1e-9
    assert abs(c.cost_usd(0, 1_000_000) - 5.0) < 1e-9
    assert abs(c.cost_usd(1_000_000, 1_000_000, batch=True) - 3.0) < 1e-9


def test_system_prompt_is_cacheable_and_shared_with_eval():
    from datetime import datetime
    from h2iw.classify import SYSTEM_PROMPT, request_params
    p = request_params("x", "", datetime(2026, 9, 23, 10, 0))
    assert p["system"] == [{"type": "text", "text": SYSTEM_PROMPT,
                            "cache_control": {"type": "ephemeral"}}]
    # nothing volatile (date, item) may sit in the cached prefix
    assert "2026-09-23" not in SYSTEM_PROMPT and "x" not in p["system"][0]["text"][-5:]


def test_old_ledger_gets_cache_columns(tmp_path):
    import sqlite3
    from h2iw.store import Store
    db = tmp_path / "old.db"
    c = sqlite3.connect(db)
    c.execute("create table llm_calls (id integer primary key autoincrement, task_id text not null,"
              " at text not null, model text not null, in_tokens integer not null,"
              " out_tokens integer not null, cost_usd real not null)")
    c.execute("insert into llm_calls(task_id, at, model, in_tokens, out_tokens, cost_usd)"
              " values('t','2026-09-23T10:00:00+00:00','m',10,1,0.1)")
    c.commit(); c.close()
    s = Store(str(db))
    s.record_llm_call("u", "m", 100, 10, cache_write=0, cache_read=4000)
    rows = s.conn.execute("select cache_read_tokens, cost_usd from llm_calls order by id").fetchall()
    assert rows[0][0] == 0 and rows[1][0] == 4000
    assert abs(rows[1][1] - (100 + 4000 * 0.1 + 10 * 5) / 1e6) < 1e-12


def test_status_works_on_pre_cache_ledger(tmp_path, monkeypatch, capsys):
    import sqlite3
    from h2iw import status
    db = tmp_path / "s.db"
    c = sqlite3.connect(db)
    c.executescript("create table items (task_id text, status text, classification_json text,"
                    " updated_at text); create table notes (subtype text);"
                    " create table meta (key text, value text);"
                    " create table llm_calls (at text, in_tokens int, out_tokens int, cost_usd real);"
                    " insert into llm_calls values ('2026-09-23T10:00:00+00:00', 10, 1, 0.1);")
    c.commit(); c.close()
    monkeypatch.setenv("H2IW_DB", str(db))
    assert status.main() == 0
    assert "cw 0" in capsys.readouterr().out
