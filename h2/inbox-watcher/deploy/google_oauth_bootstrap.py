"""One-time Google OAuth (installed-app / loopback flow) on the owner's Mac.

Standard library only; runs on the macOS system python3 (3.9+), no venv needed.

Client ID + secret are read from the VPS env file over ssh (never printed);
if that fails, they are asked for with hidden input. The refresh token is
written to stdout ONLY when stdout is a pipe, so it goes straight back to the
VPS without ever appearing on screen:

    python3 deploy/google_oauth_bootstrap.py | ssh hz /opt/h2-inbox-watcher/deploy/set-secret.sh GOOGLE_REFRESH_TOKEN

    python3 deploy/google_oauth_bootstrap.py --self-test   # no browser, no token, nothing sent
"""

from __future__ import annotations

import getpass
import http.server
import json
import secrets
import subprocess
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
]
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
VPS_HOST = "hz"
VPS_ENV = "/etc/h2-inbox-watcher/env"


def say(msg: str) -> None:
    # stderr reaches the terminal even when stdout is piped to ssh.
    print(msg, file=sys.stderr, flush=True)


def client_from_vps():
    """Returns (client_id, client_secret) or None. Values are never printed."""
    try:
        r = subprocess.run(
            ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", VPS_HOST,
             f"grep -E '^GOOGLE_CLIENT_(ID|SECRET)=' {VPS_ENV}"],
            stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if r.returncode != 0:
        return None
    values = {}
    for line in r.stdout.splitlines():
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip()
    cid, secret = values.get("GOOGLE_CLIENT_ID"), values.get("GOOGLE_CLIENT_SECRET")
    if not cid or not secret:
        return None
    return cid, secret


def get_client():
    creds = client_from_vps()
    if creds:
        say(f"Client ID a secret načteny z VPS ({VPS_HOST}:{VPS_ENV}), nezobrazeny.")
        return creds
    say("Client ID/secret na VPS nenalezeny — zadej je ručně (vstup se nezobrazí).")
    # getpass reads from /dev/tty by itself, so piping stdout does not break it.
    cid = getpass.getpass("Google OAuth client ID (Desktop): ").strip()
    secret = getpass.getpass("Google OAuth client secret: ").strip()
    return cid, secret


def make_server(state: str, result: dict) -> http.server.HTTPServer:
    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            if q.get("state", [""])[0] != state:
                self.send_response(400)
                self.end_headers()
                return
            result["code"] = q.get("code", [""])[0]
            result["error"] = q.get("error", [""])[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write("Hotovo, okno můžeš zavřít.".encode())

        def log_message(self, *args):
            pass

    return http.server.HTTPServer(("127.0.0.1", 0), Handler)


def auth_url(client_id: str, redirect_uri: str, state: str) -> str:
    return AUTH_URL + "?" + urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
        "login_hint": "honza.bindr@gmail.com",
    })


def wait_for_code(server: http.server.HTTPServer, result: dict, timeout: float) -> None:
    def serve():
        # Ignore stray requests (favicon, wrong state) until the real redirect arrives.
        while "code" not in result:
            server.handle_request()

    t = threading.Thread(target=serve, daemon=True)
    t.start()
    t.join(timeout=timeout)
    server.server_close()


def self_test() -> int:
    """Exercises everything except the browser and the token exchange."""
    creds = client_from_vps()
    say(f"VPS client credentials: {'OK' if creds else 'NENALEZENY'}")
    if creds and not creds[0].endswith(".apps.googleusercontent.com"):
        say("VAROVÁNÍ: client ID nemá tvar *.apps.googleusercontent.com")
    state = secrets.token_urlsafe(16)
    result: dict = {}
    server = make_server(state, result)
    redirect_uri = f"http://127.0.0.1:{server.server_port}"
    url = auth_url(creds[0] if creds else "x", redirect_uri, state)
    assert "calendar.events" in url and "calendarlist.readonly" in url
    assert "auth%2Fcalendar+" not in url and not url.endswith("auth%2Fcalendar")

    def fake_browser():
        for s in ("wrong-state", state):
            q = urllib.parse.urlencode({"state": s, "code": "TEST-CODE"})
            try:
                urllib.request.urlopen(f"{redirect_uri}/?{q}", timeout=5).read()
            except Exception:
                pass

    threading.Thread(target=fake_browser, daemon=True).start()
    wait_for_code(server, result, timeout=10)
    ok = result.get("code") == "TEST-CODE"
    say(f"loopback redirect + state check: {'OK' if ok else 'FAIL'}")
    say("self-test: nic nebylo odesláno Googlu ani na VPS.")
    return 0 if ok and creds else 1


def main() -> int:
    if "--self-test" in sys.argv:
        return self_test()
    if sys.stdout.isatty():
        say("Refresh token se do terminálu nevypisuje. Pošli výstup rourou do set-secret.sh "
            "(viz návod na začátku souboru).")
        return 2
    client_id, client_secret = get_client()
    state = secrets.token_urlsafe(16)
    result: dict = {}
    server = make_server(state, result)
    redirect_uri = f"http://127.0.0.1:{server.server_port}"
    say("Otevírám prohlížeč pro souhlas Google (účet honza.bindr@gmail.com)…")
    webbrowser.open(auth_url(client_id, redirect_uri, state))
    wait_for_code(server, result, timeout=300)
    if not result.get("code"):
        say(f"Souhlas se nepodařil: {result.get('error') or 'timeout 5 min'}")
        return 1

    body = urllib.parse.urlencode({
        "code": result["code"],
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(TOKEN_URL, data=body), timeout=30) as r:
            tokens = json.loads(r.read())
    except urllib.error.HTTPError as e:
        kind = "unknown"
        try:
            kind = json.loads(e.read()).get("error", "unknown")
        except Exception:
            pass
        say(f"Výměna kódu za token selhala: HTTP {e.code} {kind}")
        return 1
    refresh = tokens.get("refresh_token")
    if not refresh:
        say("Google nevrátil refresh token.")
        return 1
    missing = set(SCOPES) - set(tokens.get("scope", "").split())
    if missing:
        say(f"Chybí oprávnění: {sorted(missing)}")
        return 1
    sys.stdout.write(refresh + "\n")
    sys.stdout.flush()
    say("Refresh token odeslán na VPS (nezobrazen).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
