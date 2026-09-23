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
    assert public == {"inbox_id", "list_inbox", "get_task", "update_task", "move_task",
                      "close_task", "add_comment"}


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


@pytest.mark.parametrize("op", ["close", "update", "move", "comment"])
def test_writes_refused_outside_inbox(op):
    posts = []
    c = _todoist(_projects_or(config.H2_PROJECT_ID, posts))
    with pytest.raises(NotInInboxError):
        {"close": lambda: c.close_task("t"),
         "update": lambda: c.update_task("t", {"content": "x"}),
         "move": lambda: c.move_task("t", config.H2_PROJECT_ID),
         "comment": lambda: c.add_comment("t", "x")}[op]()
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
