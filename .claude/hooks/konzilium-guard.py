#!/usr/bin/env python3
"""
Hook: konzilium-guard (DR-029 krok 3, PreToolUse ve frontmatteru subagentů konzilium-*)

Každá role Konzilia smí zapsat jen svůj jediný výstupní soubor ve složce `.../konzilium/`.
Transportní agent smí zapsat jen vstupní soubor `.in-<8 hex>.txt` a spustit jen most
`npx tsx tars/orch/konzilium-bridge.ts <příkaz> …`. Nikdo z nich nesmí číst ani psát klíče
Konzilia (`konzilium-keys`) a záznamy o původu (`*.meta.json`). Blokuje se exit kódem 2.

Použití: python3 konzilium-guard.py <profil>   (vstup hooku = JSON na stdin)
"""
import json
import os
import re
import sys
import time

OUTPUTS = {
    "advokat": [r"advokat\.json"],
    "prodejni-psycholog": [r"prodejni-psycholog\.json"],
    "brand-strateg": [r"brand-strateg\.json"],
    "eticky-strazce": [r"eticky-strazce\.json"],
    "soudce": [r"soudce-a[01]\.json"],
    "tvurce": [r"draft-konzilium\.md"],
    "kontrolor": [r"zapracovani-kontrola\.json"],
    "transport": [r"\.in-[0-9a-f]{8}\.txt"],
}
WRITE_TOOLS = {"Write", "Edit", "MultiEdit", "NotebookEdit"}
BRIDGE_RE = re.compile(r"^npx tsx tars/orch/konzilium-bridge\.ts [a-z-]+( [^\n;&|<>`$\\]*)?$")
FORBIDDEN_RE = re.compile(r"konzilium-keys|\.meta\.json")


def log(profile, tool, decision, target):
    try:
        d = os.environ.get("TARS_KONZILIUM_LOG_DIR") or os.path.join(os.path.expanduser("~"), ".tars")
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "konzilium-guard.log"), "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())} {profile} {tool} {decision} {os.path.basename(target)[:80]}\n")
    except OSError:
        pass


def deny(profile, tool, target, why):
    log(profile, tool, "deny", target)
    print(f"konzilium-guard: {why}", file=sys.stderr)
    sys.exit(2)


def main():
    profile = sys.argv[1] if len(sys.argv) > 1 else ""
    if profile not in OUTPUTS:
        deny(profile or "?", "?", "", "neznámý profil role, nástroj blokován")
    try:
        data = json.load(sys.stdin)
    except (ValueError, OSError):
        deny(profile, "?", "", "nečitelný vstup hooku, nástroj blokován")
    tool = str(data.get("tool_name") or "")
    inp = data.get("tool_input") or {}
    target = str(inp.get("file_path") or inp.get("notebook_path") or inp.get("path") or inp.get("pattern") or "")
    command = str(inp.get("command") or "")

    if FORBIDDEN_RE.search(target) or FORBIDDEN_RE.search(command):
        deny(profile, tool, target or command, "klíče a záznamy o původu Konzilia jsou nedotknutelné")

    if tool in WRITE_TOOLS:
        path = os.path.abspath(target)
        parent = os.path.basename(os.path.dirname(path))
        name = os.path.basename(path)
        if tool != "Write" or parent != "konzilium" or not any(re.fullmatch(p, name) for p in OUTPUTS[profile]):
            deny(profile, tool, target, f"role {profile} smí zapsat jen svůj výstup v konzilium/ ({', '.join(OUTPUTS[profile])})")
        if os.path.islink(path) or os.path.islink(os.path.dirname(path)):
            deny(profile, tool, target, "zápis přes symlink je zakázaný")
        log(profile, tool, "allow", target)
        sys.exit(0)

    if tool == "Bash":
        if profile != "transport" or not BRIDGE_RE.match(command.strip()):
            deny(profile, tool, command, "povolený je jen příkaz mostu npx tsx tars/orch/konzilium-bridge.ts")
        log(profile, tool, "allow", command.split(" ")[3] if len(command.split(" ")) > 3 else command)
        sys.exit(0)

    # Read, Grep, Glob, StructuredOutput, …: povoleno (tools ve frontmatteru je stejně omezují).
    sys.exit(0)


if __name__ == "__main__":
    main()
