// ADP-K1-01: prompt z `updatedInput` brány nesmí zůstat v perzistenci sezení ani v debug logu Claude CLI ovladače.
// Falešné `claude` zapisuje to, co skutečné CLI 2.1.317 zapisuje i s --no-session-persistence (tool-results se stdout
// hooku > 10 000 znaků), a ClaudeCli to po pokusu musí smazat; cizí sezení zůstanou.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CLAUDE_DEBUG_ENV_OFF, ClaudeCli, claudeConfigHome, removeClaudeSessionArtifacts } from "../adapters";

let bin: string;
let cfg: string;
let cwd: string;
const saved: Record<string, string | undefined> = {};
const KEYS = ["PATH", "CLAUDE_CONFIG_DIR", "DEBUG", "DEBUG_SDK"];
const OTHER = "11111111-2222-4333-8444-555555555555";

function fakeClaude(tail = 'echo \'{"type":"result","result":"ok","is_error":false}\''): void {
  fs.writeFileSync(
    path.join(bin, "claude"),
    `#!/bin/bash
cat > /dev/null
sid=""
prev=""
for a in "$@"; do [ "$prev" = "--session-id" ] && sid="$a"; prev="$a"; done
if [ -n "$sid" ]; then
  printf '%s\\n' "$@" > "${bin}/args"
  printf 'DEBUG=[%s] DEBUG_SDK=[%s]\\n' "$DEBUG" "$DEBUG_SDK" > "${bin}/env"
  d="$CLAUDE_CONFIG_DIR/projects/-tmp-run-wo/$sid/tool-results"
  mkdir -p "$d"
  echo 'TAJNY_PROMPT' > "$d/hook-x-PreToolUse-stdout.txt"
  echo 'TAJNY_PROMPT' > "$CLAUDE_CONFIG_DIR/projects/-tmp-run-wo/$sid.jsonl"
fi
${tail}
`,
    { mode: 0o755 },
  );
}

const leftovers = () => {
  const out: string[] = [];
  const walk = (p: string) => {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const f = path.join(p, e.name);
      if (e.isDirectory()) walk(f);
      else if (fs.readFileSync(f, "utf8").includes("TAJNY_PROMPT")) out.push(path.relative(cfg, f));
    }
  };
  walk(cfg);
  return out;
};

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  bin = fs.mkdtempSync(path.join(os.tmpdir(), "fake-claude-sess-"));
  cfg = fs.mkdtempSync(path.join(os.tmpdir(), "claude-cfg-"));
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "claude-cwd-"));
  // cizí sezení v jiném klíči projektu: úklid na něj nesmí sáhnout
  fs.mkdirSync(path.join(cfg, "projects", "-jiny-projekt", OTHER, "tool-results"), { recursive: true });
  fs.writeFileSync(path.join(cfg, "projects", "-jiny-projekt", OTHER, "tool-results", "x.txt"), "cizí");
  fs.writeFileSync(path.join(cfg, "projects", "-jiny-projekt", `${OTHER}.jsonl`), "cizí");
  process.env.PATH = `${bin}:${saved.PATH}`;
  process.env.CLAUDE_CONFIG_DIR = cfg;
  process.env.DEBUG = "1"; // prostředí orchestrátoru se zapnutým debugem: dítě ho dostat nesmí
  process.env.DEBUG_SDK = "true";
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("ClaudeCli: žádná perzistence sezení ani debug log (ADP-K1-01)", () => {
  it("spouští s --no-session-persistence a vlastním --session-id, bez --debug; DEBUG/DEBUG_SDK prázdné i proti opts.env", async () => {
    fakeClaude();
    const r = await new ClaudeCli("sonnet").run("p", { cwd, env: { DEBUG: "1", DEBUG_SDK: "1" } });
    expect(r.ok).toBe(true);
    const args = fs.readFileSync(path.join(bin, "args"), "utf8").trim().split("\n");
    expect(args).toContain("--no-session-persistence");
    const sid = args[args.indexOf("--session-id") + 1];
    expect(sid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(args.some((a) => a === "-d" || a.startsWith("--debug"))).toBe(false);
    expect(fs.readFileSync(path.join(bin, "env"), "utf8").trim()).toBe("DEBUG=[] DEBUG_SDK=[]");
    expect(CLAUDE_DEBUG_ENV_OFF).toEqual({ DEBUG: "", DEBUG_SDK: "" });
  });

  it("po pokusu smaže složku sezení (tool-results se stdout hooku) i přepis; cizí sezení zůstane", async () => {
    fakeClaude();
    await new ClaudeCli("sonnet").run("p", { cwd });
    const sid = (() => {
      const a = fs.readFileSync(path.join(bin, "args"), "utf8").trim().split("\n");
      return a[a.indexOf("--session-id") + 1];
    })();
    expect(fs.existsSync(path.join(cfg, "projects", "-tmp-run-wo", sid))).toBe(false);
    expect(fs.existsSync(path.join(cfg, "projects", "-tmp-run-wo", `${sid}.jsonl`))).toBe(false);
    expect(leftovers()).toEqual([]);
    expect(fs.readFileSync(path.join(cfg, "projects", "-jiny-projekt", OTHER, "tool-results", "x.txt"), "utf8")).toBe("cizí");
    expect(fs.existsSync(path.join(cfg, "projects", "-jiny-projekt", `${OTHER}.jsonl`))).toBe(true);
  });

  it("úklid proběhne i po pádu CLI a po tvrdém limitu (timeout)", async () => {
    fakeClaude("exit 3");
    const a = await new ClaudeCli("sonnet").run("p", { cwd });
    expect(a.ok).toBe(false);
    expect(leftovers()).toEqual([]);
    fakeClaude("exec sleep 30");
    const b = await new ClaudeCli("sonnet").run("p", { cwd, timeoutMs: 1500 });
    expect(b.error).toBe("timeout");
    expect(leftovers()).toEqual([]);
  }, 20_000);

  it("removeClaudeSessionArtifacts: jen platné UUID, chybějící projects/ = nic, CLAUDE_CONFIG_DIR určuje domov", () => {
    expect(() => removeClaudeSessionArtifacts("../projects")).toThrow(/neplatné session id/);
    expect(removeClaudeSessionArtifacts(OTHER, path.join(cfg, "neexistuje"))).toEqual([]);
    expect(claudeConfigHome({ CLAUDE_CONFIG_DIR: "/x/y" })).toBe("/x/y");
    expect(claudeConfigHome({})).toBe(path.join(os.homedir(), ".claude"));
  });
});
