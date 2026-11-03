#!/usr/bin/env python3
"""TARS notion-owner-decision (DR-039) - PreToolUse hook pro nástroje Notion MCP (matcher mcp__.*[Nn]otion.*).

Zamítne volání, jehož vstup nastavuje vlastnost „Rozhodnutí vlastníka“: klíč s tímto názvem kdekoli ve vstupu
(i uvnitř řetězce s JSON objektem), bez ohledu na diakritiku, velikost písmen a mezery. Rozhodnutí GO / REJECT
zadává jen vlastník v přehledu „TARS — Zakázky“; agent ho nikdy nezadává za něj.

Text stránek se nekontroluje (karta smí o poli psát), jen klíče vlastností. Čtecí nástroje (fetch, search,
query, get, list ...) projdou vždy. Je to obrana ve vrstvách, ne důkaz identity: při chybě python3 nebo
nečitelném vstupu hook propustí (exit 1 = nezablokující chyba) a vlastnost nadále hlídá orchestrátor v kódu.

Vstup: JSON na stdin (tool_name, tool_input). Výstup při zamítnutí: JSON hookSpecificOutput.permissionDecision
= "deny" + důvod česky, exit 0.
"""

import json
import re
import sys
import unicodedata

REASON = "Agent nikdy nezadává GO ani REJECT za vlastníka (DR-039): vlastnost „Rozhodnutí vlastníka“ nastavuje jen vlastník."
TARGET = "rozhodnuti vlastnika"
READ_ONLY_RE = re.compile(r"(fetch|search|query|get|list|view|download|wait|read)", re.I)


def fold(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join(s.split()).lower()


def sets_owner_decision(value, depth=0):
    if depth > 30:
        return False
    if isinstance(value, dict):
        return any(fold(str(k)) == TARGET or sets_owner_decision(v, depth + 1) for k, v in value.items())
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


def main():
    data = json.loads(sys.stdin.read() or "{}")
    name = str(data.get("tool_name") or "")
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
    except Exception as e:  # chyba hooku nesmí zablokovat práci: exit 1 = nezablokující chyba
        sys.stderr.write("notion-owner-decision: chyba hooku (%r), volání NEBYLO zablokováno.\n" % (e,))
        sys.exit(1)
