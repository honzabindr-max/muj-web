#!/usr/bin/env python3
"""TARS bash-preflight (DR-036, pravidlo P04) - logika PreToolUse hooku pro nástroj Bash.

Zamítne příkazy, které v Claude Code vyvolají ruční schvalování "Allow once":
  - heredoc (<<), ale ne here-string (<<<)
  - řetězení && || ; a nový řádek mimo uvozovky
  - přesměrování do souboru (> >> &>) mimo /dev/null, /dev/stderr, /dev/stdout a dup fd (2>&1, >&2)
  - tee, sed -i, perl -i

Roury | jsou povolené. Parser respektuje '...' a "...", prochází také $(...), `...`
a argument "-c" shellů (bash -c '...'), aby se kontrola nedala obejít.
Když si parser není jistý (nedovřená uvozovka apod.), příkaz POVOLÍ a zaloguje to (UNSURE_ALLOW), aby se
nerozbila běžná práce. Výjimka (P20): nejistý příkaz, který obsahuje cli.ts nebo tars/orch/cli, se ZAMÍTNE
(UNSURE_DENY_CLI), protože u něj nejde vyloučit podpříkaz owner.
Chyba hooku je fail-closed: neplatný JSON nebo pád skriptu skončí exit 2 (blokující) s hláškou na stderr.

DR-039: navíc zamítne každé spuštění tars/orch/cli.ts s podpříkazem `owner` (npx tsx, node --import,
tsx, npm exec, cesta relativní i absolutní, uvozovky, proměnné před příkazem, env, bash -c, $(...)),
i když by ho povolil allowlist. Podpříkaz, který nejde určit (proměnná, $(...), xargs), se bere jako owner.
Vedle parseru se VŽDY kontroluje surový text celého příkazu (OWNER_RAW_RE): cli.ts následované tokenem owner
kdekoli, i v uvozovkách, heredoc, argumentu echo/printf (printf '...' | bash), bash -c, eval, xargs.
Mimo dosah textového hooku: zakódované/obfuskované varianty (base64, skládání řetězců za běhu, vlastní skript
volající orch.owner()) - ty řeší pravidlo P20 (rozhodnutí vlastníka DR-039).
Je to obrana ve vrstvách, ne důkaz identity. Při chybě hook blokuje (fail-closed, exit 2; v settings.json
navíc onFailure: "block" pro timeout a neočekávaný exit kód).

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

OWNER_REASON = "Agent nikdy nezadává GO ani REJECT za vlastníka (DR-039)"
# P20: nejistý rozbor + cli.ts / tars/orch/cli = nejde vyloučit podpříkaz owner -> deny.
UNSURE_CLI_REASON = OWNER_REASON + ": příkaz s cli.ts nejde bezpečně rozebrat (P20). Napiš ho bez nedovřených uvozovek."
UNSURE_CLI_RE = re.compile(r"cli\.[cm]?[jt]s\b|tars/orch/cli\b")
# Zástupná hodnota za $(...) a `...` (obsah se kontroluje zvlášť); pro podpříkaz cli.ts znamená "nejde určit".
SUB = "\x00sub"
CLI_NAMES = {"cli.ts", "cli.js", "cli.mjs", "cli.cjs"}
RUNNERS = {"npx", "tsx", "node", "npm", "pnpm", "pnpx", "yarn", "bun", "bunx", "deno", "ts-node", "vite-node"}
# Interprety, které spouštějí kód z argumentu (node -e, python -c ...): jejich argument se prohledá jako text.
EVAL_RUNNERS = {"node", "python", "python3", "perl", "ruby", "deno", "bun", "osascript", "php"}
# Textový vzor nad celým surovým příkazem (i obsah uvozovek, heredoc, echo/printf, bash -c, eval, xargs):
# cli.ts / tars/orch/cli, volitelně přepínače, pak token owner. `grep owner cli.ts` ani `cli.ts tick` nezachytí.
OWNER_RAW_RE = re.compile(r"(?:cli\.[cm]?[jt]s|tars/orch/cli\b)(?:\W{1,6}-[\w-]+)*\W{0,6}owner\b")

NOVALUE_OPTS = {"-0", "--null", "--no-run-if-empty", "--verbose", "--interactive", "--open-tty"}
WRAPPERS = {"sudo", "env", "command", "nohup", "time", "exec", "xargs", "nice", "stdbuf", "builtin", "timeout"}
SHELLS = {"sh", "bash", "zsh", "dash"}
OK_TARGETS = {"/dev/null", "/dev/stderr", "/dev/stdout"}
META = set(" \t\n;&|<>()")
ENV_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")
FD_DUP_RE = re.compile(r"(?:\d+-?|-)(?=[\s;&|<>()]|$)")
SHELL_C_RE = re.compile(r"^-[a-zA-Z]*c[a-zA-Z]*$|^--command$")
SED_I_RE = re.compile(r"^-[nEsurzl]*i")
PERL_I_RE = re.compile(r"^-[0-9adflnpsStTuUwWxX]*i")


class Unsure(Exception):
    pass


def undeterminable(word):
    """Slovo, jehož hodnotu hook nezná: $(...)/`...` nebo neexpandovaná proměnná."""
    return SUB in word or "$" in word


def owner_hit(ws):
    """DR-039: jednoduchý příkaz (bez přiřazení na začátku) spouští cli.ts s podpříkazem owner?

    cli.ts musí být spuštěné: buď je to samo první slovo, nebo před ním stojí spouštěč (npx, tsx, node, npm ...),
    obal (env, timeout ...) nebo shell. Podpříkaz = první slovo za cli.ts, které není přepínač. `grep owner cli.ts`
    tedy projde, `cli.ts tick` / `cli.ts status` také. Neznámý podpříkaz ($X, $(...), xargs bez argumentu) = owner.
    """
    if not ws:
        return False
    heads = {os.path.basename(w) for w in ws}
    head = os.path.basename(ws[0])
    if head in EVAL_RUNNERS and any(OWNER_RAW_RE.search(w) for w in ws[1:]):
        return True
    for i, w in enumerate(ws):
        if os.path.basename(w) not in CLI_NAMES:
            continue
        before = {os.path.basename(x) for x in ws[:i]}
        if i > 0 and not (before & (RUNNERS | WRAPPERS | SHELLS)):
            continue
        j = i + 1
        while j < len(ws) and ws[j].startswith("-") and not undeterminable(ws[j]):
            j += 1
        if j >= len(ws):
            if "xargs" in heads:
                return True
            continue
        if ws[j] == "owner" or undeterminable(ws[j]):
            return True
    return False


def ansi_c(raw):
    """Obsah $'...' (ANSI-C quoting) -> text; při chybě vrátí původní text."""
    try:
        return raw.encode("latin-1", "backslashreplace").decode("unicode_escape")
    except Exception:
        return raw


def owner_raw(cmd):
    """DR-039: vzor owner kdekoli v surovém textu, i po dekódování ANSI-C escape ($'\\x6fwner')."""
    return bool(OWNER_RAW_RE.search(cmd) or OWNER_RAW_RE.search(ansi_c(cmd)))


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
                if closer == "`" and s.startswith("\\`", i):
                    i = self.parse(i + 2, "\\`")
                    cur.append(SUB)
                    inword = True
                    continue
                if closer == "\\`" and s.startswith("\\`", i):
                    endseg()
                    return i + 2
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
                cur.append(SUB)
                inword = True
                continue
            if c == "$":
                if s.startswith("$((", i):
                    i = self.skip_arith(i + 3)
                    cur.append("0")
                elif s.startswith("$(", i):
                    i = self.parse(i + 2, ")")
                    cur.append(SUB)
                elif s.startswith('$"', i):
                    i += 1
                    continue
                elif s.startswith("$'", i):
                    j = i + 2
                    while j < n and s[j] != "'":
                        j += 2 if s[j] == "\\" else 1
                    if j >= n:
                        raise Unsure("nedovřená $'")
                    cur.append(ansi_c(s[i + 2:j]))
                    i = j + 1
                else:
                    cur.append(c)
                    i += 1
                inword = True
                continue
            if c == "#" and not inword:
                j = s.find("\n", i)
                i = n if j < 0 else j
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
                if s.startswith("&>", i):
                    endword()
                    i = self.redirect(i + 1)
                    continue
                endseg()
                if s.startswith("&&", i):
                    self.add("chain")
                    i += 2
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
                cur.append(SUB)
                continue
            if s.startswith("$((", i):
                i = self.skip_arith(i + 3)
                cur.append("0")
                continue
            if s.startswith("$(", i):
                i = self.parse(i + 2, ")")
                cur.append(SUB)
                continue
            cur.append(c)
            i += 1
        raise Unsure('nedovřená "')

    def skip_arith(self, i):
        s = self.s
        depth = 2
        while i < len(s):
            if s.startswith("$(", i) and not s.startswith("$((", i):
                i = self.parse(i + 2, ")")
                continue
            if s[i] == "`":
                i = self.parse(i + 1, "`")
                continue
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
            k = j + 1
            while k < n and s[k] in " \t":
                k += 1
            m = FD_DUP_RE.match(s, k)
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
        while idx < n and ENV_RE.match(words[idx]):
            idx += 1
        while idx < n and words[idx] == "!":
            idx += 1
        if idx >= n:
            return
        if owner_hit(words[idx:]):
            self.add("owner")
        first = os.path.basename(words[idx])
        if first == "find":
            for k in range(idx + 1, n):
                if words[k] in ("-exec", "-execdir", "-ok", "-okdir") and k + 1 < n:
                    self.check(words[k + 1:])
            return
        if first == "command" and idx + 1 < n and words[idx + 1] in ("-v", "-V"):
            return
        if first in WRAPPERS:
            # wrapper (env -u X, sudo -u u, xargs -I {}, nice -n 5 ...): hodnoty přepínačů neznáme.
            # Vnořený příkaz je první slovo, které není přepínač, přiřazení ani číslo; slovo hned za
            # přepínačem může být jeho hodnota, proto se zkusí i další.
            k = idx + 1
            after_opt = False
            while k < n:
                w = words[k]
                if w.startswith("-"):
                    # přepínače bez hodnoty (xargs -0 apod.) nepřisuzují hodnotu následujícímu slovu
                    after_opt = w not in NOVALUE_OPTS
                    k += 1
                    continue
                if ENV_RE.match(w) or re.match(r"^[0-9.]+[smhd]?$", w):
                    k += 1
                    continue
                self.check(words[k:])
                if not after_opt:
                    break
                after_opt = False
                k += 1
            return
        self.apply(words[idx:])

    def apply(self, ws):
        cmd = os.path.basename(ws[0])
        rest = ws[1:]
        if "--" in rest:
            opts = rest[:rest.index("--")]
        else:
            opts = rest
        if cmd == "tee":
            self.add("tee")
        elif cmd == "sed":
            if any(SED_I_RE.match(a) or a.startswith("--in-place") for a in opts):
                self.add("inplace")
        elif cmd == "perl":
            if any(PERL_I_RE.match(a) for a in opts):
                self.add("inplace")
        elif cmd in SHELLS:
            for k, a in enumerate(rest):
                if SHELL_C_RE.match(a) and k + 1 < len(rest):
                    self.sub(rest[k + 1])
                    break
        elif cmd == "eval":
            while rest and rest[0].startswith("-"):
                rest = rest[1:]
            self.sub(" ".join(rest))

    def sub(self, payload):
        if self.level >= 10:
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
    parser = Parser(cmd)
    unsure = None
    try:
        parser.run()
    except Unsure as e:
        unsure = e
    # DR-039 platí před allowlistem: žádná výjimka nepovolí agentovi zadat rozhodnutí vlastníka.
    # Textový vzor se kontroluje VŽDY nad surovým textem, bez ohledu na to, zda parser příkaz poznal
    # (printf '...cli.ts owner...' | bash, echo | sh, xargs, bash -c "$C"). Zakódované varianty (base64,
    # skládání řetězců za běhu, vlastní skript volající orch.owner()) jsou mimo dosah hooku; řeší je P20.
    if "owner" in parser.found or owner_raw(cmd):
        log("DENY_OWNER")
        return deny(OWNER_REASON)
    # P20: nejistý příkaz s cli.ts se zamítne i před allowlistem; ostatní nejisté zůstávají allow (níže).
    if unsure is not None and UNSURE_CLI_RE.search(cmd):
        log("UNSURE_DENY_CLI", str(unsure))
        return deny(UNSURE_CLI_REASON)
    for pat in load_allow():
        if pat.fullmatch(cmd):
            log("ALLOWLIST", cmd[:40])
            return 0
    if unsure is not None and not parser.found:
        log("UNSURE_ALLOW", "%s | %s" % (unsure, cmd[:40]))
        return 0
    if not parser.found:
        return 0
    log("DENY", "%s | %s" % (",".join(parser.found), cmd[:40]))
    return deny("P04 (DR-036): " + " ".join(REASONS[c] for c in parser.found))


def deny(reason):
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
    except Exception as e:  # fail-closed: chyba hooku (i neplatný JSON) = exit 2, Claude Code volání zablokuje
        log("HOOK_ERROR", type(e).__name__)
        sys.stderr.write("bash-preflight: chyba hooku (%s), příkaz byl ZABLOKOVÁN (fail-closed).\n" % type(e).__name__)
        sys.exit(2)
