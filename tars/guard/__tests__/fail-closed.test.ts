// Fail-closed hooky a hranice zápisu (Radar 2026-11-03 #4).
// Selhání hooku bash-preflight / notion-owner-decision musí volání zablokovat, ne propustit.
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO = path.resolve(__dirname, "..", "..", "..");
const GUARD = path.join(REPO, "tars", "guard");
const PREFLIGHT = path.join(GUARD, "bash-preflight.sh");
const NOTION = path.join(GUARD, "notion-owner-decision.py");
// TARS_SETTINGS_FILE: jen pro ověření navrženého souboru před aplikací patche; výchozí je soubor v repu.
const SETTINGS =
  process.env.TARS_SETTINGS_FILE ?? path.join(REPO, ".claude", "settings.json");
const dir = mkdtempSync(path.join(tmpdir(), "failclosed-"));
const LOG = path.join(dir, "log.txt");
/** Prostředí potomka; záměrně i bez NODE_ENV (minimální PATH jako pod launchd). */
type Env = Record<string, string | undefined>;

const bashInput = (command: string) =>
  JSON.stringify({ tool_name: "Bash", tool_input: { command } });

function preflight(
  stdin: string,
  env: Env = { ...process.env },
  script = PREFLIGHT,
) {
  const r = spawnSync("/bin/bash", [script], {
    input: stdin,
    encoding: "utf8",
    env: { ...env, TARS_PREFLIGHT_LOG: LOG } as unknown as NodeJS.ProcessEnv,
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function decision(command: string) {
  const r = preflight(bashInput(command));
  expect(r.status).toBe(0);
  if (r.stdout.trim() === "") return { decision: "allow", reason: "" };
  const j = JSON.parse(r.stdout);
  return {
    decision: j.hookSpecificOutput.permissionDecision as string,
    reason: j.hookSpecificOutput.permissionDecisionReason as string,
  };
}

type Hook = {
  type: string;
  command: string;
  timeout?: number;
  onFailure?: string;
};
type Matcher = { matcher?: string; hooks: Hook[] };

function settings() {
  return JSON.parse(readFileSync(SETTINGS, "utf8")) as {
    permissions: Record<string, unknown>;
    hooks: Record<string, Matcher[]>;
  };
}

function preHook(name: string): Hook {
  const hook = settings()
    .hooks.PreToolUse.flatMap((m) => m.hooks)
    .find((h) => h.command.includes(name));
  if (!hook) throw new Error(`hook ${name} chybí v settings.json`);
  return hook;
}

/** Spustí příkaz hooku přesně jak stojí v settings.json (s dosazeným CLAUDE_PROJECT_DIR). */
function runConfigured(name: string, stdin: string, env: Env) {
  const r = spawnSync("/bin/bash", ["-c", preHook(name).command], {
    input: stdin,
    encoding: "utf8",
    env: {
      ...env,
      CLAUDE_PROJECT_DIR: REPO,
      TARS_PREFLIGHT_LOG: LOG,
    } as unknown as NodeJS.ProcessEnv,
  });
  return { status: r.status, stdout: r.stdout };
}

// onFailure, timeout a blockWritesOutsideWorkingDirectories hlídá fail-closed-settings.test.ts
// (přichází spolu se změnou .claude/settings.json).
describe("settings.json: zapojení hooků", () => {
  it("bash-preflight je zapojený na matcher Bash, notion-owner-decision na Notion MCP", () => {
    const pre = settings().hooks.PreToolUse;
    expect(
      pre
        .find((m) => m.matcher === "Bash")
        ?.hooks.some((h) => h.command.includes("bash-preflight.sh")),
    ).toBe(true);
    expect(
      pre
        .find((m) => m.matcher === "mcp__.*[Nn]otion.*")
        ?.hooks.some((h) => h.command.includes("notion-owner-decision.py")),
    ).toBe(true);
  });
});

describe("selhání hooku = blok", () => {
  it("bash-preflight bez python3: exit 2 (blokuje i bez onFailure)", () => {
    const r = preflight(bashInput("git status"), { PATH: "/nonexistent" });
    expect(r.status).toBe(2);
    expect(r.stdout.trim()).toBe("");
    expect(r.stderr).toMatch(/ZABLOKOVÁN \(fail-closed\)/);
  });

  it("bash-preflight bez skriptu .py: exit 2", () => {
    const lonely = mkdtempSync(path.join(tmpdir(), "preflight-lonely-"));
    const sh = path.join(lonely, "bash-preflight.sh");
    copyFileSync(PREFLIGHT, sh);
    const r = preflight(bashInput("git status"), { ...process.env }, sh);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/chybí .*bash-preflight\.py/);
  });

  it.each(["tohle neni json", "{", "[1, 2"])(
    "bash-preflight s chybným JSON vstupem %j: exit 2 bez obsahu vstupu",
    (stdin) => {
      const r = preflight(stdin);
      expect(r.status).toBe(2);
      expect(r.stderr).toMatch(/ZABLOKOVÁN \(fail-closed\)/);
      expect(r.stderr).not.toContain("neni json");
    },
  );

  it("notion-owner-decision s chybným JSON vstupem: exit 2", () => {
    const r = spawnSync("python3", ["-I", NOTION], {
      input: "{",
      encoding: "utf8",
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/ZABLOKOVÁNO \(fail-closed\)/);
  });

  const BAD_PAYLOADS: [string, string][] = [
    ["prázdný stdin", ""],
    ["jen bílé znaky", "  \n"],
    ["prázdný objekt {}", "{}"],
    ["pole []", "[]"],
    ["řetězec místo objektu", '"Bash"'],
    ["null", "null"],
  ];

  it.each([
    ...BAD_PAYLOADS,
    ["chybějící tool_input", JSON.stringify({ tool_name: "Bash" })],
    [
      "tool_input bez command",
      JSON.stringify({ tool_name: "Bash", tool_input: {} }),
    ],
    [
      "command není řetězec",
      JSON.stringify({ tool_name: "Bash", tool_input: { command: 1 } }),
    ],
    [
      "tool_name není řetězec",
      JSON.stringify({ tool_name: 1, tool_input: { command: "ls" } }),
    ],
  ])("bash-preflight s neúplným payloadem (%s): exit 2", (_n, stdin) => {
    const r = preflight(stdin);
    expect(r.status).toBe(2);
    expect(r.stdout.trim()).toBe("");
    expect(r.stderr).toMatch(
      /neplatný vstup hooku .*ZABLOKOVÁN \(fail-closed\)/,
    );
  });

  it.each([
    ...BAD_PAYLOADS,
    [
      "chybějící tool_input",
      JSON.stringify({
        tool_name: "mcp__claude_ai_Notion__notion-update-page",
      }),
    ],
    [
      "tool_input není objekt",
      JSON.stringify({
        tool_name: "mcp__claude_ai_Notion__notion-update-page",
        tool_input: "x",
      }),
    ],
    ["chybějící tool_name", JSON.stringify({ tool_input: {} })],
  ])("notion-owner-decision s neúplným payloadem (%s): exit 2", (_n, stdin) => {
    const r = spawnSync("python3", ["-I", NOTION], {
      input: stdin,
      encoding: "utf8",
    });
    expect(r.status).toBe(2);
    expect(r.stdout.trim()).toBe("");
    expect(r.stderr).toMatch(
      /neplatný vstup hooku .*ZABLOKOVÁNO \(fail-closed\)/,
    );
  });

  it("bash-preflight: prázdný příkaz v úplném payloadu nic nespouští, projde", () => {
    const r = preflight(bashInput("   "));
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("");
  });

  it.each(["bash-preflight.sh", "notion-owner-decision.py"])(
    "%s: nakonfigurovaný příkaz bez python3 na PATH skončí nenulově (s onFailure: block = blok)",
    (name) => {
      const stdin = name.startsWith("bash")
        ? bashInput("git status")
        : JSON.stringify({
            tool_name: "mcp__claude_ai_Notion__notion-update-page",
            tool_input: {},
          });
      const r = runConfigured(name, stdin, { PATH: "/nonexistent" });
      expect(r.status).not.toBe(0);
      expect(r.stdout.trim()).toBe("");
    },
  );

  it("timeout: hook doběhne hluboko pod limitem i u dlouhého příkazu; po limitu blokuje Claude Code (onFailure: block)", () => {
    const limitMs = 5000; // hluboko pod timeoutem hooku (30 s v settings.json)
    const long = "git status " + "'a b' ".repeat(5000);
    const t0 = Date.now();
    const r = preflight(bashInput(long));
    expect(r.status).toBe(0);
    expect(Date.now() - t0).toBeLessThan(limitMs);
  });
});

describe("P20: nejistý rozbor s cli.ts = deny, ostatní nejisté = allow", () => {
  it.each([
    [
      "cli.ts owner s nedovřenou uvozovkou",
      "npx tsx tars/orch/cli.ts owner wo-1 'GO",
    ],
    [
      "cli.ts s nedovřenou uvozovkou před podpříkazem",
      "npx tsx tars/orch/cli.ts 'own",
    ],
    [
      "cli.ts v nedovřených uvozovkách",
      'npx tsx "tars/orch/cli.ts owner wo-1 GO',
    ],
    [
      "tars/orch/cli bez přípony, nedovřené $(",
      "npx tsx tars/orch/cli $(echo own",
    ],
    ["cli.ts tick s nedovřenou uvozovkou", "npx tsx tars/orch/cli.ts tick 'x"],
    // vnořený nejistý rozbor (Parser.sub dřív Unsure spolkl)
    [
      "bash -c s nejistým vnitřkem a cli.ts",
      `bash -c "npx tsx tars/orch/cli.ts tick 'a"`,
    ],
    [
      "sh -c s nejistým vnitřkem a cli.ts",
      `sh -c "node tars/orch/cli.ts status \\"x"`,
    ],
    [
      "eval s nejistým vnitřkem a tars/orch/cli",
      `eval "npx tsx tars/orch/cli tick 'x"`,
    ],
    [
      "dvojí vnoření bash -c > eval s nejistým vnitřkem",
      `bash -c "eval \\"tars/orch/cli.ts tick 'x\\""`,
    ],
  ])("deny: %s", (_n, command) => {
    const d = decision(command);
    expect(d.decision).toBe("deny");
    expect(d.reason).toMatch(
      /Agent nikdy nezadává GO ani REJECT za vlastníka \(DR-039/,
    );
  });

  it("deny nepřebije ani allowlist", () => {
    const allow = path.join(dir, "all.allow");
    writeFileSync(allow, ".*\n");
    const r = preflight(bashInput("npx tsx tars/orch/cli.ts 'own"), {
      ...process.env,
      TARS_PREFLIGHT_ALLOW: allow,
    });
    expect(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision).toBe(
      "deny",
    );
  });

  it.each([
    ["git status", "git status"],
    ["npx vitest", "npx vitest run tars/guard"],
    ["npm test", "NODE_ENV=test npm test"],
    ["npx tsc", "npx tsc --noEmit"],
    [
      "review-launch.sh (allowlist)",
      "tars/orch/review-launch.sh /Users/janbindr/Projects/muj-web-guard /tmp/prompt.md /tmp/out.txt",
    ],
    ["cli.ts tick", "npx tsx tars/orch/cli.ts tick"],
    ["gh pr view", "gh pr view 96 --json title"],
    ["nejistý příkaz bez cli.ts zůstává allow", 'echo "abc'],
    ["nejistý grep bez cli.ts", "grep 'owner f"],
    ["bash -c s nejistým vnitřkem bez cli.ts", `bash -c "echo 'abc"`],
    [
      "bash -c s cli.ts tick bez nejistoty",
      `bash -c "npx tsx tars/orch/cli.ts tick"`,
    ],
  ])("allow: %s", (_n, command) => {
    expect(decision(command).decision).toBe("allow");
  });

  it("UNSURE_DENY_CLI se loguje bez příkazu", () => {
    decision("npx tsx tars/orch/cli.ts 'tajne-id-xyz");
    const log = readFileSync(LOG, "utf8");
    expect(log).toMatch(/UNSURE_DENY_CLI/);
    expect(log).not.toContain("tajne-id-xyz");
  });
});

describe("launchd copy tick (mimo Claude Code) není ovlivněn", () => {
  const plist = readFileSync(
    path.join(
      REPO,
      "tars",
      "orch",
      "launchd",
      "work.good-inventions.tars-orch.plist",
    ),
    "utf8",
  );

  it("plist spouští tick přímo přes zsh + npx tsx, ne přes Claude Code (hooky ani permissions se na něj nevztahují)", () => {
    expect(plist).toMatch(/npx tsx tars\/orch\/cli\.ts tick/);
    expect(plist).not.toMatch(/\bclaude\b/);
    expect(plist).not.toMatch(/bash-preflight|notion-owner-decision/);
  });

  it("hooky v prostředí jako pod launchd (PATH=/usr/bin:/bin, bez CLAUDE_PROJECT_DIR v env) propustí běžné volání", () => {
    const env = { PATH: "/usr/bin:/bin", HOME: process.env.HOME ?? "/tmp" };
    const b = runConfigured("bash-preflight.sh", bashInput("git status"), env);
    expect(b.status).toBe(0);
    expect(b.stdout.trim()).toBe("");
    const n = runConfigured(
      "notion-owner-decision.py",
      JSON.stringify({
        tool_name: "mcp__claude_ai_Notion__notion-create-pages",
        tool_input: { pages: [{ properties: { title: "KARTA" } }] },
      }),
      env,
    );
    expect(n.status).toBe(0);
    expect(n.stdout.trim()).toBe("");
  });
});
