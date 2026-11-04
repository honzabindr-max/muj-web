// bash-preflight (DR-036, P04): PreToolUse hook zamítá příkazy, které vyvolávají ruční "Allow once".
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(__dirname, "..", "bash-preflight.sh");
const dir = mkdtempSync(path.join(tmpdir(), "preflight-"));
const LOG = path.join(dir, "log.txt");

function run(stdin: string, env: Record<string, string> = {}) {
  const r = spawnSync("bash", [SCRIPT], {
    input: stdin,
    encoding: "utf8",
    env: { ...process.env, TARS_PREFLIGHT_LOG: LOG, ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function decide(command: string) {
  const r = run(JSON.stringify({ tool_name: "Bash", tool_input: { command } }));
  expect(r.status).toBe(0);
  if (r.stdout.trim() === "") return { decision: "allow" as const, reason: "" };
  const j = JSON.parse(r.stdout);
  expect(j.hookSpecificOutput.hookEventName).toBe("PreToolUse");
  return { decision: j.hookSpecificOutput.permissionDecision as string, reason: j.hookSpecificOutput.permissionDecisionReason as string };
}

const DENY: Array<[string, string, RegExp]> = [
  ["heredoc s řetězením (reálný případ)", "mkdir -p /tmp/t && cd /tmp/t && cat > test.js <<'EOF'", /Heredoc/],
  ["sed -i s && (reálný případ)", "sed -i 's/a/b/' f.ts && npx vitest", /Řetězení/],
  ["heredoc samotný", "cat <<EOF", /Heredoc/],
  ["heredoc s pomlčkou", "cat <<-EOF", /Heredoc/],
  ["&&", "a && b", /Řetězení/],
  ["||", "a || b", /Řetězení/],
  ["středník", "a; b", /Řetězení/],
  ["nový řádek", "ls\nls", /Řetězení/],
  ["přesměrování >", "echo hi > f.txt", /Přesměrování/],
  ["přesměrování >>", "echo hi >> f.txt", /Přesměrování/],
  ["přesměrování bez mezery", "echo hi>f.txt", /Přesměrování/],
  ["stderr do souboru", "cmd 2> err.log", /Přesměrování/],
  ["&> do souboru", "cmd &> out.log", /Přesměrování/],
  ["cíl přes proměnnou", 'echo hi > "$F"', /Přesměrování/],
  ["tee v rouře", "echo hi | tee f.txt", /tee/],
  ["sed -i.bak", "sed -i.bak s/a/b/ f", /sed -i/],
  ["sed -ni", "sed -ni 1p f", /sed -i/],
  ["sed --in-place", "sed --in-place s/a/b/ f", /sed -i/],
  ["perl -pi -e", "perl -pi -e 's/a/b/' f", /perl -i/],
  ["env proměnná před sed -i", "FOO=1 sed -i s/a/b/ f", /sed -i/],
  ["wrapper xargs sed -i", "ls | xargs sed -i s/a/b/", /sed -i/],
  ["řetězení uvnitř $(...)", "echo $(date; ls)", /Řetězení/],
  ["řetězení uvnitř uvozovek s $(...)", 'echo "$(a && b)"', /Řetězení/],
  ["řetězení v zpětných apostrofech", "echo `a; b`", /Řetězení/],
  ["bash -c s řetězením", "bash -c 'a && b'", /Řetězení/],
  ["sh -c se zápisem do souboru", "sh -c 'echo x > f'", /Přesměrování/],
  ["zápis do souboru uvnitř $(...)", "echo $(echo x > f)", /Přesměrování/],
  ["heredoc s nedovřenou uvozovkou v těle neprojde", "cat <<EOF\nit's", /Heredoc/],
  ["bash -ce (sdružené přepínače)", "bash -ce 'echo x > f'", /Přesměrování/],
  ["bash --command", "bash --command 'echo x > f'", /Přesměrování/],
  ["env -u s hodnotou přepínače", "env -u FOO sed -i s/a/b/ f", /sed -i/],
  ["sudo -u s hodnotou přepínače", "sudo -u root tee f", /tee/],
  ["xargs -I {}", "xargs -I {} tee f", /tee/],
  ["find -exec sed -i", "find . -type f -exec sed -i s/a/b/ {} \\;", /sed -i/],
  ["find -exec env sed -i", "find . -name '*.txt' -exec env LC_ALL=C sed -i '' 's/old/new/g' {} +", /sed -i/],
  ["xargs -0 env sed -i", "find . -name '*.txt' -print0 | xargs -0 env LC_ALL=C sed -i '' 's/old/new/g'", /sed -i/],
  ["xargs --null env sed -i", "find . -name '*.txt' -print0 | xargs --null env LC_ALL=C sed -i '' 's/old/new/g'", /sed -i/],
  ["příkaz v aritmetice", "echo $(( $(echo 1 > f) + 1 ))", /Přesměrování/],
  [">&1foo je soubor, ne dup fd", "echo x >&1foo", /Přesměrování/],
  [">&'f' je soubor", "echo x >&'f'", /Přesměrování/],
  ["ANSI-C $'tee'", "$'tee' f", /tee/],
  ["vnořené zpětné apostrofy", "echo `echo \\`tee f\\``", /tee/],
  ["eval s ANSI-C escape", "eval $'echo x \\x3e f'", /Přesměrování/],
  ["vnořené eval", "eval \"eval \\\"eval 'echo x > f'\\\"\"", /Přesměrování/],
  ["locale quoting $\"tee\"", '$"tee" f', /tee/],
  ["sed -li", "sed -li '' s/a/b/ f", /sed -i/],
  ["eval -- payload", "eval -- 'tee f'", /tee/],
  ["negace ! před tee", "echo $(! tee f)", /tee/],
  ["timeout 5 tee", "timeout 5 tee f", /tee/],
  ["nice -n 5 sed -i", "nice -n 5 sed -i s/a/b/ f", /sed -i/],
];

const ALLOW: Array<[string, string]> = [
  ["git -C status", "git -C /x status --short"],
  ["gh pr checks", "gh pr checks 91 -R o/r"],
  ["grep se středníkem v uvozovkách", 'grep -n "a;b" f'],
  ["grep s && v apostrofech", "grep 'a && b' f"],
  ["roura", "ls | head"],
  ["více rour", "cat f | grep x | wc -l"],
  ["stderr do /dev/null", "cat f 2>/dev/null"],
  ["stdout i stderr do /dev/null", "cmd > /dev/null 2>&1"],
  ["&> /dev/null", "cmd &> /dev/null"],
  [">&2", "echo err >&2"],
  ["1>&2", "echo err 1>&2"],
  ["python3 -c", 'python3 -c "print(1)"'],
  ["npm ci", "npm ci --include=dev"],
  ["sleep", "sleep 120"],
  ["here-string <<<", 'cat <<< "hi"'],
  ["> uvnitř uvozovek", 'echo "a > b"'],
  ["; v commit zprávě", 'git commit -m "feat: a; b && c"'],
  ["víceřádková zpráva v uvozovkách", 'git commit -m "řádek 1\nřádek 2"'],
  ["escapovaný středník (find -exec)", "find . -name x -exec ls {} \\;"],
  ["sed bez -i", "sed -n '1,5p' f"],
  ["sed s textem -i v argumentu", "sed -e 's/-i/x/' f"],
  ["perl bez -i", "perl -e 'print 1'"],
  ["perl -Mstrict (obsahuje i)", "perl -Mstrict -e 'print 1'"],
  ["slovo tee jako argument", "grep tee file"],
  ["aritmetika s <<", "echo $((1 << 2))"],
  ["process substitution", "diff <(ls a) <(ls b)"],
  ["nedovřená uvozovka (parser si není jistý)", 'echo "abc'],
  ["prázdný příkaz", "   "],
  ["pozadí přes &", "sleep 5 &"],
  ["2>& 1 s mezerou", "echo x 2>& 1"],
  ["&>/dev/null uprostřed příkazu", "grep &>/dev/null tee file"],
  ["find -name tee", "find . -name tee"],
  ["find -exec grep tee", "find . -name '*.py' -exec grep -l tee {} +"],
  ["xargs -0 grep tee", "find . -name '*.py' -print0 | xargs -0 grep -n tee"],
  ["env -u FOO grep tee", "env -u FOO grep tee file"],
  ["command -v tee", "command -v tee"],
  ["sed -- -input.txt", "sed -n 1p -- -input.txt"],
  ["komentář se středníkem", "git status # ; comment"],
  ["komentář s $(tee f)", "git status # $(tee f)"],
  ["komentář s >", "cat f 2>/dev/null # > log"],
  ["# uprostřed slova není komentář, ale ani řetězení", "gh pr view 5 --json title#x"],
  ["allowlist: review-launch.sh", "tars/orch/review-launch.sh /Users/janbindr/Projects/muj-web-guard /tmp/prompt.md /tmp/out.txt"],
];

// DR-039: agent nikdy nezadává GO ani REJECT za vlastníka, ani přes `cli.ts owner`.
const OWNER_DENY: Array<[string, string]> = [
  ["npx tsx", "npx tsx tars/orch/cli.ts owner wo-1 GO"],
  ["cd && npx tsx (návod ze staré karty)", "cd ~/Projects/muj-web && npx tsx tars/orch/cli.ts owner wo-1 GO"],
  ["node --import tsx", "node --import tsx tars/orch/cli.ts owner wo-1 REJECT"],
  ["tsx přímo", "tsx tars/orch/cli.ts owner wo-1 GO"],
  ["npm exec tsx --", "npm exec tsx -- tars/orch/cli.ts owner wo-1 GO"],
  ["npm exec -- tsx", "npm exec -- tsx tars/orch/cli.ts owner wo-1 GO"],
  ["absolutní cesty", "/Users/janbindr/Projects/muj-web/node_modules/.bin/tsx /Users/janbindr/Projects/muj-web/tars/orch/cli.ts owner wo-1 GO"],
  ["relativní ./cli.ts", "npx tsx ./cli.ts owner wo-1 GO"],
  ["uvozovky", "npx tsx \"tars/orch/cli.ts\" 'owner' wo-1 'GO A'"],
  ["slepené uvozovky", 'npx tsx tars/orch/cli.ts "ow"ner wo-1 GO'],
  ["escape uvnitř slova", "npx tsx tars/orch/cli.ts ow\\ner wo-1 GO"],
  ["ANSI-C $'...'", "npx tsx tars/orch/cli.ts $'\\x6fwner' wo-1 GO"],
  ["proměnná před příkazem", "TARS_PANEL=0 npx tsx tars/orch/cli.ts owner wo-1 GO"],
  ["env", "env TARS_PANEL=0 npx tsx tars/orch/cli.ts owner wo-1 GO"],
  ["env -i s přepínači", "env -i PATH=/usr/bin npx tsx tars/orch/cli.ts owner wo-1 GO"],
  ["timeout", "timeout 60 npx tsx tars/orch/cli.ts owner wo-1 GO"],
  ["přepínač před podpříkazem", "npx tsx tars/orch/cli.ts --verbose owner wo-1 GO"],
  ["bash -c", "bash -c 'npx tsx tars/orch/cli.ts owner wo-1 GO'"],
  ["sh -c s cd", 'sh -c "cd /x && npx tsx tars/orch/cli.ts owner wo-1 GO"'],
  ["eval", "eval 'npx tsx tars/orch/cli.ts owner wo-1 GO'"],
  ["$(...)", "echo $(npx tsx tars/orch/cli.ts owner wo-1 GO)"],
  ["zpětné apostrofy", "echo `npx tsx tars/orch/cli.ts owner wo-1 GO`"],
  ["podpříkaz z proměnné", "npx tsx tars/orch/cli.ts $CMD wo-1 GO"],
  ["podpříkaz z $(...)", "npx tsx tars/orch/cli.ts $(echo owner) wo-1 GO"],
  ["podpříkaz přes xargs", "echo owner wo-1 GO | xargs npx tsx tars/orch/cli.ts"],
  ["node -e s execSync", "node -e \"require('child_process').execSync('npx tsx tars/orch/cli.ts owner wo-1 GO')\""],
  ["python3 -c se subprocess", "python3 -c \"import subprocess; subprocess.run(['npx','tsx','tars/orch/cli.ts','owner','wo-1','GO'])\""],
  ["nedovřená uvozovka (parser si není jistý)", "npx tsx tars/orch/cli.ts owner wo-1 'GO"],
  // Kolo oprav 1 (GPT review): surový text se kontroluje vždy, i když parser příkaz nepozná.
  ["printf | bash", "printf '%s\\n' 'npx tsx tars/orch/cli.ts owner wo-1 GO' | bash"],
  ["echo | sh", "echo 'npx tsx tars/orch/cli.ts owner wo-1 GO' | sh"],
  ["eval s $(...)", "eval \"$(echo 'npx tsx tars/orch/cli.ts owner wo-1 GO')\""],
  ["xargs s celým příkazem v textu", "echo 'tars/orch/cli.ts owner wo-1 GO' | xargs npx tsx"],
  ["bash -c s proměnnou", "C='npx tsx tars/orch/cli.ts owner wo-1 GO'; bash -c \"$C\""],
  ["bash -c $'...' s escape", "bash -c $'npx tsx tars/orch/cli.ts \\x6fwner wo-1 GO'"],
  ["heredoc do bash", "bash <<EOF\nnpx tsx tars/orch/cli.ts owner wo-1 GO\nEOF"],
  ["tars/orch/cli bez přípony", "printf 'npx tsx tars/orch/cli owner wo-1 GO' | sh"],
  ["přepínač před owner v textu", "echo 'tars/orch/cli.ts --verbose owner wo-1 GO' | bash"],
];

const OWNER_ALLOW: Array<[string, string]> = [
  ["cli.ts tick", "npx tsx tars/orch/cli.ts tick"],
  ["cli.ts status", "npx tsx tars/orch/cli.ts status"],
  ["cli.ts konzilium", "npx tsx tars/orch/cli.ts konzilium vstup.json"],
  ["grep owner cli.ts", "grep owner cli.ts"],
  ["grep -n owner tars/orch/cli.ts", "grep -n owner tars/orch/cli.ts"],
  ["git log cli.ts", "git log --oneline -- tars/orch/cli.ts"],
  ["commit zpráva zmiňuje owner a cli.ts", 'git commit -m "docs: owner v cli.ts jen pro vlastníka"'],
  ["cat cli.ts", "cat tars/orch/cli.ts"],
  ["rg owner v cli.ts", "rg -n 'owner' tars/orch/cli.ts"],
  ["echo cli.ts tick | bash", "echo 'npx tsx tars/orch/cli.ts tick' | bash"],
  ["printf cli.ts status | sh", "printf 'npx tsx tars/orch/cli.ts status' | sh"],
];

describe("bash-preflight: cli.ts owner (DR-039)", () => {
  it.each(OWNER_DENY)("zamítnout: %s", (_name, command) => {
    const d = decide(command);
    expect(d.decision).toBe("deny");
    expect(d.reason).toBe("Agent nikdy nezadává GO ani REJECT za vlastníka (DR-039)");
  });

  it.each(OWNER_ALLOW)("povolit: %s", (_name, command) => {
    expect(decide(command).decision).toBe("allow");
  });

  it("allowlist owner blok nepřebije", () => {
    const allow = path.join(dir, "all.allow");
    writeFileSync(allow, ".*\n");
    const r = run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "npx tsx tars/orch/cli.ts owner wo-1 GO" } }), { TARS_PREFLIGHT_ALLOW: allow });
    expect(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
    const ok = run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "a && b" } }), { TARS_PREFLIGHT_ALLOW: allow });
    expect(ok.stdout.trim()).toBe(""); // allowlist dál funguje pro P04
  });

  it("zamítnutí owner se loguje bez celého příkazu", () => {
    decide("npx tsx tars/orch/cli.ts owner wo-tajne-id GO");
    const log = readFileSync(LOG, "utf8");
    expect(log).toMatch(/DENY_OWNER/);
    expect(log).not.toContain("wo-tajne-id");
  });

  it("bez python3 hook zablokuje (fail-closed, exit 2)", () => {
    const r = spawnSync("/bin/bash", [SCRIPT], {
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "npx tsx tars/orch/cli.ts owner wo-1 GO" } }),
      encoding: "utf8",
      env: { PATH: "/nonexistent", TARS_PREFLIGHT_LOG: LOG } as unknown as NodeJS.ProcessEnv,
    });
    expect(r.status).toBe(2);
    expect(r.stdout.trim()).toBe("");
  });
});

describe("bash-preflight: zamítnout", () => {
  it.each(DENY)("%s", (_name, command, re) => {
    const d = decide(command);
    expect(d.decision).toBe("deny");
    expect(d.reason).toMatch(re);
  });
});

describe("bash-preflight: povolit", () => {
  it.each(ALLOW)("%s", (_name, command) => {
    expect(decide(command).decision).toBe("allow");
  });
});

describe("bash-preflight: okrajové chování", () => {
  it("tabulka má aspoň 25 případů", () => {
    expect(DENY.length + ALLOW.length).toBeGreaterThanOrEqual(25);
  });

  it("allowlist nepropustí řetězení přilepené k povolenému skriptu", () => {
    expect(decide("tars/orch/review-launch.sh /wt /p /o; rm -rf /x").decision).toBe("deny");
    expect(decide("tars/orch/review-launch.sh /wt /p /o && ls").decision).toBe("deny");
    expect(decide("tars/orch/review-launch.sh /wt /p /o > /tmp/x").decision).toBe("deny");
  });

  it("jiný nástroj než Bash se nekontroluje", () => {
    const r = run(JSON.stringify({ tool_name: "Read", tool_input: { command: "a && b" } }));
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("");
  });

  it("neplatný JSON na vstupu blokuje (fail-closed, exit 2) a hlásí chybu", () => {
    const r = run("tohle neni json");
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/ZABLOKOVÁN \(fail-closed\)/);
  });

  it("špatný regex v allowlistu hook nerozbije", () => {
    const allow = path.join(dir, "bad.allow");
    writeFileSync(allow, "([\n");
    const r = run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls" } }), { TARS_PREFLIGHT_ALLOW: allow });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("");
  });

  it("zamítnutí i nejistota se logují bez celých příkazů", () => {
    decide("a && b");
    decide('echo "abc');
    const log = readFileSync(LOG, "utf8");
    expect(log).toMatch(/DENY chain/);
    expect(log).toMatch(/UNSURE_ALLOW/);
  });
});
