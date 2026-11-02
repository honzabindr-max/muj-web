#!/usr/bin/env python3
"""
Hook: konzilium-guard (DR-029 krok 3, PreToolUse ve frontmatteru subagentů konzilium-*)

Každá role Konzilia smí zapsat jen svůj jediný výstupní soubor ve složce `.../konzilium/`.
Transportní agent smí zapsat jen vstupní soubor `.in-<8 hex>.txt` a spustit jen most
`npx tsx tars/orch/konzilium-bridge.ts <příkaz> …`. Nikdo z nich nesmí číst ani psát klíče
Konzilia (`konzilium-keys`) a záznamy o původu (`*.meta.json`). Blokuje se exit kódem 2.

Zápis i příkazy mostu (`--out`) jsou vázané na jediný aktivní běh: ten, který naposledy připravil most
(`konzilium-keys/active.json` = složka a ID běhu; `run.json` v cílové složce musí nést stejné ID).

Použití: python3 konzilium-guard.py <profil>   (vstup hooku = JSON na stdin)
"""
import json
import os
import re
import shlex
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
FORBIDDEN_RE = re.compile(r"konzilium-keys|\.meta\.json", re.IGNORECASE)


def canonical(p):
    """Absolute, user-expanded, symlinks resolved (macOS file system is case-insensitive → compare case-insensitively)."""
    try:
        return os.path.realpath(os.path.expanduser(p))
    except (OSError, ValueError):
        return p


def same(a, b):
    """Path equality; macOS file systems are case-insensitive."""
    return a.casefold() == b.casefold() if sys.platform == "darwin" else a == b


def bound_to_active(real_kdir):
    """True when real_kdir is the konzilium/ folder of the active run and its run.json carries the active run ID."""
    keys = os.environ.get("TARS_KONZILIUM_KEYS") or os.path.join(os.path.expanduser("~"), ".tars", "konzilium-keys")
    try:
        with open(os.path.join(keys, "active.json"), encoding="utf-8") as f:
            active = json.load(f)
        with open(os.path.join(real_kdir, "run.json"), encoding="utf-8") as f:
            run_id = json.load(f).get("run_id")
    except (OSError, ValueError, AttributeError):
        return False
    return bool(run_id) and run_id == active.get("run_id") and same(real_kdir, canonical(str(active.get("kdir") or "")))


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

    if FORBIDDEN_RE.search(target) or FORBIDDEN_RE.search(canonical(target) if target else "") or FORBIDDEN_RE.search(command):
        deny(profile, tool, target or command, "klíče a záznamy o původu Konzilia jsou nedotknutelné")

    if tool in WRITE_TOOLS:
        path = os.path.abspath(os.path.expanduser(target))
        name = os.path.basename(path)
        kdir = os.path.dirname(path)
        if os.path.islink(path) or os.path.islink(kdir):
            deny(profile, tool, target, "zápis přes symlink je zakázaný")
        real_kdir = canonical(kdir)
        if tool != "Write" or os.path.basename(real_kdir) != "konzilium" or not any(re.fullmatch(p, name) for p in OUTPUTS[profile]):
            deny(profile, tool, target, f"role {profile} smí zapsat jen svůj výstup v konzilium/ ({', '.join(OUTPUTS[profile])})")
        # Bound to a live run: the role output goes into a run prepared by the bridge (run.json), never into a
        # finished run (decision.json next to konzilium/), and never over an existing file.
        if os.path.exists(path):
            deny(profile, tool, target, "výstup už existuje, přepis je zakázaný")
        if os.path.exists(os.path.join(os.path.dirname(real_kdir), "decision.json")):
            deny(profile, tool, target, "běh je uzavřený (decision.json), zápis je zakázaný")
        # Roles write only into the active run; the transport also into a fresh folder (input file of prep).
        if (profile != "transport" or os.path.exists(os.path.join(real_kdir, "run.json"))) and not bound_to_active(real_kdir):
            deny(profile, tool, target, "složka není aktivní běh Konzilia (jiný nebo nepřipravený běh)")
        log(profile, tool, "allow", target)
        sys.exit(0)

    if tool == "Bash":
        if profile != "transport" or not BRIDGE_RE.match(command.strip()):
            deny(profile, tool, command, "povolený je jen příkaz mostu npx tsx tars/orch/konzilium-bridge.ts")
        try:
            args = shlex.split(command.strip())
        except ValueError:
            deny(profile, tool, command, "nečitelný příkaz mostu")
        # prep creates the run (the bridge refuses a folder with outputs); every other command only on the active run
        if args[3] != "prep":
            outs = [args[i + 1] for i, a in enumerate(args[:-1]) if a == "--out"]
            if len(outs) != 1 or not bound_to_active(os.path.join(canonical(outs[0]), "konzilium")):
                deny(profile, tool, command, "--out musí být složka aktivního běhu Konzilia")
        log(profile, tool, "allow", command.split(" ")[3] if len(command.split(" ")) > 3 else command)
        sys.exit(0)

    # Read, Grep, Glob, StructuredOutput, …: povoleno (tools ve frontmatteru je stejně omezují).
    sys.exit(0)


if __name__ == "__main__":
    main()
