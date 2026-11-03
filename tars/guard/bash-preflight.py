#!/usr/bin/env python3
"""TARS bash-preflight (DR-036, pravidlo P04) - logika PreToolUse hooku pro nástroj Bash.

Zamítne příkazy, které v Claude Code vyvolají ruční schvalování "Allow once":
  - heredoc (<<), ale ne here-string (<<<)
  - řetězení && || ; a nový řádek mimo uvozovky
  - přesměrování do souboru (> >> &>) mimo /dev/null, /dev/stderr, /dev/stdout a dup fd (2>&1, >&2)
  - tee, sed -i, perl -i

Roury | jsou povolené. Parser respektuje '...' a "...", prochází také $(...), `...`
a argument "-c" shellů (bash -c '...'), aby se kontrola nedala obejít.
Když si parser není jistý (nedovřená uvozovka apod.), příkaz POVOLÍ a zaloguje to.
Chyba hooku nikdy neblokuje práci: skončí exit 1 (nezablokující chyba) s hláškou na stderr.

Vstup: JSON na stdin (tool_input.command). Výstup při zamítnutí: JSON
hookSpecificOutput.permissionDecision = "deny" + důvod česky, exit 0.
Výjimky: tars/guard/bash-preflight.allow (regexy na celé příkazy, re.fullmatch).
Log (bez celých příkazů): /tmp/tars-bash-preflight.log, přepsatelné TARS_PREFLIGHT_LOG.
"""

import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))

REASONS = {
    "heredoc": "Heredoc (<<) vyvolá ruční schvalování. Soubor zapiš nástrojem Write/Edit a spusť ho samostatným příkazem.",
    "chain": "Řetězení příkazů (&&, ||, ; nebo nový řádek) vyvolá ruční schvalování. Rozděl příkaz na samostatná volání nástroje Bash.",
    "redirect": "Přesměrování výstupu do souboru (> nebo >>) vyvolá ruční schvalování. Soubor zapiš nástrojem Write/Edit; zahodit výstup lze přes > /dev/null.",
    "tee": "tee zapisuje do souboru a vyvolá ruční schvalování. Soubor zapiš nástrojem Write/Edit.",
    "inplace": "Úprava souboru na místě (sed -i / perl -i) vyvolá ruční schvalování. Soubor uprav nástrojem Edit.",
}

WRAPPERS = {"sudo", "env", "command", "nohup", "time", "exec", "xargs", "nice", "stdbuf", "builtin", "timeout"}
SHELLS = {"sh", "bash", "zsh", "dash"}
OK_TARGETS = {"/dev/null", "/dev/stderr", "/dev/stdout"}
META = set(" \t\n;&|<>()")
ENV_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")
FD_DUP_RE = re.compile(r"\d+-?|-")
SED_I_RE = re.compile(r"^-[nEsurz]*i")
PERL_I_RE = re.compile(r"^-[0-9adflnpsStTuUwWxX]*i")


class Unsure(Exception):
    pass


def log(event, detail=""):
    path = os.environ.get("TARS_PREFLIGHT_LOG", "/tmp/tars-bash-preflight.log")
    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write("%s %s %s\n" % (time.strftime("%Y-%m-%dT%H:%M:%S%z"), event, detail))
    except Exception:
        pass


class Parser:
    def __init__(self, s, level=0):
        self.s = s
        self.level = level
        self.found = []

    def add(self, code):
        if code not in self.found:
            self.found.append(code)

    def run(self):
        self.parse(0, None)
        return self.found

    # --- hlavní skener (mimo uvozovky) ---
    def parse(self, i, closer):
        s = self.s
        n = len(s)
        words = []
        cur = []
        inword = False
        depth = 0

        def endword():
            nonlocal cur, inword
            if inword:
                words.append("".join(cur))
            cur = []
            inword = False

        def endseg():
            endword()
            self.check(words)
            del words[:]

        while i < n:
            c = s[i]
            if c == "\\":
                if i + 1 >= n:
                    i += 1
                    continue
                nx = s[i + 1]
                if nx != "\n":
                    cur.append(nx)
                    inword = True
                i += 2
                continue
            if c == "'":
                j = s.find("'", i + 1)
                if j < 0:
                    raise Unsure("nedovřená '")
                cur.append(s[i + 1:j])
                inword = True
                i = j + 1
                continue
            if c == '"':
                i = self.dq(i + 1, cur)
                inword = True
                continue
            if c == "`":
                if closer == "`":
                    endseg()
                    return i + 1
                i = self.parse(i + 1, "`")
                cur.append("x")
                inword = True
                continue
            if c == "$":
                if s.startswith("$((", i):
                    i = self.skip_arith(i + 3)
                    cur.append("0")
                elif s.startswith("$(", i):
                    i = self.parse(i + 2, ")")
                    cur.append("x")
                else:
                    cur.append(c)
                    i += 1
                inword = True
                continue
            if c in " \t":
                endword()
                i += 1
                continue
            if c == "\n" or c == ";":
                endseg()
                self.add("chain")
                i += 1
                continue
            if c == "(":
                endseg()
                depth += 1
                i += 1
                continue
            if c == ")":
                endseg()
                if depth > 0:
                    depth -= 1
                elif closer == ")":
                    return i + 1
                i += 1
                continue
            if c == "|":
                endseg()
                if s.startswith("||", i):
                    self.add("chain")
                    i += 2
                elif s.startswith("|&", i):
                    i += 2
                else:
                    i += 1
                continue
            if c == "&":
                endseg()
                if s.startswith("&&", i):
                    self.add("chain")
                    i += 2
                elif s.startswith("&>", i):
                    i = self.redirect(i + 1)
                else:
                    i += 1
                continue
            if c == "<":
                endword()
                if s.startswith("<<<", i):
                    i += 3
                elif s.startswith("<<", i):
                    self.add("heredoc")
                    i += 2
                else:
                    i += 1
                continue
            if c == ">":
                if inword and "".join(cur).isdigit():
                    cur = []
                    inword = False
                else:
                    endword()
                i = self.redirect(i)
                continue
            cur.append(c)
            inword = True
            i += 1
        endseg()
        if closer:
            raise Unsure("nedovřené " + closer)
        return n

    def dq(self, i, cur):
        s = self.s
        n = len(s)
        while i < n:
            c = s[i]
            if c == '"':
                return i + 1
            if c == "\\":
                if i + 1 < n:
                    cur.append(s[i + 1])
                i += 2
                continue
            if c == "`":
                i = self.parse(i + 1, "`")
                cur.append("x")
                continue
            if s.startswith("$((", i):
                i = self.skip_arith(i + 3)
                cur.append("0")
                continue
            if s.startswith("$(", i):
                i = self.parse(i + 2, ")")
                cur.append("x")
                continue
            cur.append(c)
            i += 1
        raise Unsure('nedovřená "')

    def skip_arith(self, i):
        s = self.s
        depth = 2
        while i < len(s):
            if s[i] == "(":
                depth += 1
            elif s[i] == ")":
                depth -= 1
                if depth == 0:
                    return i + 1
            i += 1
        raise Unsure("nedovřená aritmetika")

    def redirect(self, i):
        """s[i] == '>'. Vrací index za přesměrováním."""
        s = self.s
        n = len(s)
        j = i + 1
        if j < n and s[j] == ">":
            j += 1
        if j < n and s[j] == "|":
            j += 1
        if j < n and s[j] == "&":
            m = FD_DUP_RE.match(s, j + 1)
            if m:
                return m.end()
            j += 1
        elif j < n and s[j] == "(":
            return j
        while j < n and s[j] in " \t":
            j += 1
        target, j = self.read_target(j)
        if target is not None and target not in OK_TARGETS:
            self.add("redirect")
        return j

    def read_target(self, j):
        s = self.s
        n = len(s)
        out = []
        dyn = False
        seen = False
        while j < n and s[j] not in META:
            c = s[j]
            seen = True
            if c == "\\" and j + 1 < n:
                out.append(s[j + 1])
                j += 2
            elif c in "'\"":
                k = s.find(c, j + 1)
                if k < 0:
                    raise Unsure("nedovřená uvozovka v cíli přesměrování")
                chunk = s[j + 1:k]
                if c == '"' and ("$" in chunk or "`" in chunk):
                    dyn = True
                out.append(chunk)
                j = k + 1
            else:
                if c == "$" or c == "`":
                    dyn = True
                out.append(c)
                j += 1
        if not seen:
            return None, j
        return ("\0dyn" if dyn else "".join(out)), j

    # --- kontrola jednoho jednoduchého příkazu (slova bez uvozovek) ---
    def check(self, words):
        idx = 0
        n = len(words)
        while idx < n:
            w = words[idx]
            if ENV_RE.match(w):
                idx += 1
                continue
            b = os.path.basename(w)
            if b in WRAPPERS:
                idx += 1
                while idx < n and (words[idx].startswith("-") or ENV_RE.match(words[idx])):
                    idx += 1
                if b == "timeout" and idx < n and re.match(r"^[0-9.]+[smhd]?$", words[idx]):
                    idx += 1
                continue
            break
        else:
            return
        cmd = os.path.basename(words[idx])
        rest = words[idx + 1:]
        if cmd == "tee":
            self.add("tee")
        elif cmd == "sed":
            if any(SED_I_RE.match(a) or a.startswith("--in-place") for a in rest):
                self.add("inplace")
        elif cmd == "perl":
            if any(PERL_I_RE.match(a) for a in rest):
                self.add("inplace")
        elif cmd in SHELLS:
            for k, a in enumerate(rest):
                if re.fullmatch(r"-[a-zA-Z]*c", a) and k + 1 < len(rest):
                    self.sub(rest[k + 1])
                    break
        elif cmd == "eval":
            self.sub(" ".join(rest))

    def sub(self, payload):
        if self.level >= 3:
            return
        p = Parser(payload, self.level + 1)
        try:
            p.run()
        except Unsure:
            pass
        for code in p.found:
            self.add(code)


def load_allow():
    path = os.environ.get("TARS_PREFLIGHT_ALLOW", os.path.join(HERE, "bash-preflight.allow"))
    patterns = []
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.rstrip("\n")
                if not line.strip() or line.lstrip().startswith("#"):
                    continue
                try:
                    patterns.append(re.compile(line))
                except re.error:
                    log("ALLOW_BAD_REGEX", line[:60])
    except FileNotFoundError:
        pass
    return patterns


def main():
    data = json.loads(sys.stdin.read() or "{}")
    if data.get("tool_name") not in (None, "Bash"):
        return 0
    cmd = (data.get("tool_input") or {}).get("command")
    if not isinstance(cmd, str) or not cmd.strip():
        return 0
    cmd = cmd.strip()
    for pat in load_allow():
        if pat.fullmatch(cmd):
            log("ALLOWLIST", cmd[:40])
            return 0
    parser = Parser(cmd)
    try:
        parser.run()
    except Unsure as e:
        if not parser.found:
            log("UNSURE_ALLOW", "%s | %s" % (e, cmd[:40]))
            return 0
    if not parser.found:
        return 0
    log("DENY", "%s | %s" % (",".join(parser.found), cmd[:40]))
    reason = "P04 (DR-036): " + " ".join(REASONS[c] for c in parser.found)
    out = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }
    sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # chyba hooku nesmí zablokovat práci: exit 1 = nezablokující chyba
        log("HOOK_ERROR", repr(e)[:200])
        sys.stderr.write("bash-preflight: chyba hooku (%r), příkaz NEBYL zablokován.\n" % (e,))
        sys.exit(1)
