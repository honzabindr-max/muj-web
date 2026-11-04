#!/usr/bin/env python3
"""TARS notion-owner-decision (DR-039) - PreToolUse hook pro nástroje Notion MCP (matcher mcp__.*[Nn]otion.*).

Zamítne volání, jehož vstup nastavuje vlastnost „Rozhodnutí vlastníka“: klíč s tímto názvem kdekoli ve vstupu
(i uvnitř řetězce s JSON objektem), bez ohledu na diakritiku, velikost písmen a mezery. Rozhodnutí GO / REJECT
zadává jen vlastník v přehledu „TARS — Zakázky“; agent ho nikdy nezadává za něj.

Text stránek se nekontroluje (karta smí o poli psát), jen klíče vlastností. Čtecí nástroje (fetch, search,
query, get, list ...) projdou vždy. Je to obrana ve vrstvách, ne důkaz identity. Fail-closed (Radar 2026-11-03 #4):
při chybě nebo nečitelném vstupu (i prázdný stdin, payload, který není objekt, chybějící tool_name
nebo tool_input) hook volání zablokuje (exit 2); v .claude/settings.json má navíc
onFailure: "block", takže blokuje i chybějící python3, timeout a neočekávaný exit kód.

Vstup: JSON na stdin (tool_name, tool_input). Výstup při zamítnutí: JSON hookSpecificOutput.permissionDecision
= "deny" + důvod česky, exit 0.
"""

import json
import re
import sys
import unicodedata

REASON = "Agent nikdy nezadává GO ani REJECT za vlastníka (DR-039): vlastnost „Rozhodnutí vlastníka“ nastavuje jen vlastník."
TARGET = "rozhodnuti vlastnika"
READ_ONLY_RE = re.compile(
    r"(fetch|search|query|get|list|view|download|wait|read)", re.I
)


def fold(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join(s.split()).lower()


def sets_owner_decision(value, depth=0):
    if depth > 30:
        return False
    if isinstance(value, dict):
        return any(
            fold(str(k)) == TARGET or sets_owner_decision(v, depth + 1)
            for k, v in value.items()
        )
    if isinstance(value, list):
        return any(sets_owner_decision(v, depth + 1) for v in value)
    if isinstance(value, str):
        t = value.strip()
        if t[:1] in ("{", "[") and fold(t).find(TARGET) >= 0:
            try:
                return sets_owner_decision(json.loads(t), depth + 1)
            except ValueError:
                return False
    return False


def bad_input(what):
    """Fail-closed: chybějící nebo neúplný payload PreToolUse = exit 2 (blok), nikdy 0."""
    sys.stderr.write(
        "notion-owner-decision: neplatný vstup hooku (%s), volání bylo ZABLOKOVÁNO (fail-closed).\n"
        % what
    )
    return 2


def main():
    raw = sys.stdin.read()
    if not raw.strip():
        return bad_input("prázdný stdin")
    data = json.loads(raw)
    if not isinstance(data, dict):
        return bad_input("vstup není JSON objekt")
    name = data.get("tool_name")
    if not isinstance(name, str) or not name:
        return bad_input("chybí tool_name")
    if not isinstance(data.get("tool_input"), dict):
        return bad_input("chybí tool_input")
    if "notion" not in name.lower():
        return 0
    action = name.rsplit("__", 1)[-1]
    if READ_ONLY_RE.search(action):
        return 0
    if not sets_owner_decision(data.get("tool_input")):
        return 0
    out = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": REASON,
        }
    }
    sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (
        Exception
    ) as e:  # fail-closed: chyba hooku = exit 2, Claude Code volání zablokuje
        sys.stderr.write(
            "notion-owner-decision: chyba hooku (%s), volání bylo ZABLOKOVÁNO (fail-closed).\n"
            % type(e).__name__
        )
        sys.exit(2)
