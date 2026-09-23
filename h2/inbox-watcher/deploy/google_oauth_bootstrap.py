"""One-time Google OAuth (installed-app / loopback flow) on the owner's Mac.

Prints the refresh token to stdout ONLY when stdout is a pipe, so it can go
straight to the VPS without ever appearing on screen:

    python3 deploy/google_oauth_bootstrap.py | ssh hz /opt/h2-inbox-watcher/deploy/set-secret.sh GOOGLE_REFRESH_TOKEN

Asks for the Desktop OAuth client id + secret (hidden input). Standard library only.
"""

from __future__ import annotations

import getpass
import http.server
import json
import secrets
import sys
import threading
import urllib.parse
import urllib.request
import webbrowser

SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
]
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"


def main() -> int:
    if sys.stdout.isatty():
        print("Refusing to print a refresh token to the terminal. Pipe stdout into set-secret.sh "
              "(see the docstring).", file=sys.stderr)
        return 2
    tty = open("/dev/tty", "r+")
    client_id = getpass.getpass("Google OAuth client ID (Desktop): ", stream=tty).strip()
    client_secret = getpass.getpass("Google OAuth client secret: ", stream=tty).strip()
    state = secrets.token_urlsafe(16)
    result: dict = {}

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

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    redirect_uri = f"http://127.0.0.1:{server.server_port}"
    url = AUTH_URL + "?" + urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
        "login_hint": "honza.bindr@gmail.com",
    })
    print("Otevírám prohlížeč pro souhlas Google…", file=tty, flush=True)
    webbrowser.open(url)
    t = threading.Thread(target=server.handle_request)
    t.start()
    t.join(timeout=300)
    server.server_close()
    if not result.get("code"):
        print(f"Souhlas se nepodařil: {result.get('error') or 'timeout'}", file=tty)
        return 1

    body = urllib.parse.urlencode({
        "code": result["code"],
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }).encode()
    with urllib.request.urlopen(urllib.request.Request(TOKEN_URL, data=body)) as r:
        tokens = json.loads(r.read())
    refresh = tokens.get("refresh_token")
    if not refresh:
        print("Google nevrátil refresh token.", file=tty)
        return 1
    granted = set(tokens.get("scope", "").split())
    missing = set(SCOPES) - granted
    if missing:
        print(f"Chybí oprávnění: {sorted(missing)}", file=tty)
        return 1
    sys.stdout.write(refresh + "\n")
    print("Refresh token odeslán do VPS (nezobrazen).", file=tty)
    return 0


if __name__ == "__main__":
    sys.exit(main())
