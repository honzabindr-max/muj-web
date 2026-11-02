// Model adapters (§7): claude -p (opus|sonnet), codex exec, ai-chain run.sh.
// All run on subscriptions: API-key env vars are stripped so no CLI silently falls back
// to paid API billing (paid API calls = 0 without owner GO).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { ModelFamily } from "./types";

export interface RunOpts {
  cwd: string;
  timeoutMs?: number;
  /** claude only: exact tool allowlist (e.g. Notion MCP). Empty = no tools. */
  allowedTools?: string[];
}

export interface AdapterResult {
  ok: boolean;
  text: string;
  /** Subscription/usage limit detected → orchestrator PAUSEs instead of failing. */
  limit: boolean;
  error?: string;
  duration_ms: number;
}

export interface TextAdapter {
  name: string;
  model: string;
  family: ModelFamily;
  run(prompt: string, opts: RunOpts): Promise<AdapterResult>;
}

const LIMIT_RE =
  /(usage limit|rate[ _-]?limit|limit reached|hit your (usage )?limit|out of (credits|messages)|quota exceeded|too many requests|\b429\b|resets? at \d)/i;

export function looksLikeLimit(text: string): boolean {
  return LIMIT_RE.test(text);
}

const STRIP_ENV = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "OPENAI_API_KEY",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
];

export function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const k of STRIP_ENV) delete env[k];
  return env;
}

interface ProcResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  duration_ms: number;
}

export function runProcess(
  cmd: string,
  args: string[],
  input: string,
  cwd: string,
  timeoutMs: number,
  extraEnv: Record<string, string> = {},
): Promise<ProcResult> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const p = spawn(cmd, args, {
      cwd,
      env: { ...childEnv(), ...extraEnv },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      p.kill("SIGTERM");
      setTimeout(() => p.kill("SIGKILL"), 5000).unref();
    }, timeoutMs);
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    p.on("error", (e) => (stderr += String(e)));
    p.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut, duration_ms: Date.now() - t0 });
    });
    p.stdin.end(input);
  });
}

export class ClaudeCli implements TextAdapter {
  family: ModelFamily = "claude";
  name: string;
  constructor(public model: "opus" | "sonnet" | "haiku") {
    this.name = `claude -p --model ${model}`;
  }
  async run(prompt: string, opts: RunOpts): Promise<AdapterResult> {
    const args = ["-p", "--model", this.model, "--output-format", "json"];
    if (opts.allowedTools?.length)
      args.push("--allowedTools", opts.allowedTools.join(","));
    const r = await runProcess(
      "claude",
      args,
      prompt,
      opts.cwd,
      opts.timeoutMs ?? 20 * 60_000,
    );
    let text = "";
    let isError = r.code !== 0;
    try {
      const j = JSON.parse(r.stdout) as { result?: string; is_error?: boolean };
      text = j.result ?? "";
      isError = isError || Boolean(j.is_error);
    } catch {
      text = r.stdout;
      isError = true;
    }
    const limit = isError && looksLikeLimit(`${text}\n${r.stderr}`);
    return {
      ok: !isError && !r.timedOut && text.trim().length > 0,
      text,
      limit,
      error: r.timedOut
        ? "timeout"
        : isError
          ? `exit ${r.code}: ${(text || r.stderr).slice(0, 300)}`
          : undefined,
      duration_ms: r.duration_ms,
    };
  }
}

export class CodexCli implements TextAdapter {
  family: ModelFamily = "gpt";
  name = "codex exec";
  /** Model comes from ~/.codex/config.toml unless overridden. */
  constructor(public model = "codex-default") {}
  async run(prompt: string, opts: RunOpts): Promise<AdapterResult> {
    const out = path.join(
      opts.cwd,
      `.codex-last-${process.pid}-${Date.now()}.md`,
    );
    const args = [
      "exec",
      "--skip-git-repo-check",
      "-s",
      "read-only",
      "-o",
      out,
    ];
    if (this.model !== "codex-default") args.push("-m", this.model);
    args.push("-"); // prompt from stdin
    const r = await runProcess(
      "codex",
      args,
      prompt,
      opts.cwd,
      opts.timeoutMs ?? 30 * 60_000,
    );
    let text = "";
    if (fs.existsSync(out)) {
      text = fs.readFileSync(out, "utf8");
      fs.rmSync(out, { force: true });
    }
    const m = /^model: (.+)$/m.exec(r.stderr + r.stdout);
    if (m && this.model === "codex-default") this.model = m[1].trim();
    const failed = r.code !== 0 || r.timedOut || text.trim().length === 0;
    return {
      ok: !failed,
      text,
      limit: failed && looksLikeLimit(r.stderr + r.stdout),
      error: failed
        ? r.timedOut
          ? "timeout"
          : `exit ${r.code}: ${lastErrorLine(r.stderr + r.stdout)}`
        : undefined,
      duration_ms: r.duration_ms,
    };
  }
}

function lastErrorLine(s: string): string {
  const lines = s.split("\n").filter((l) => /error/i.test(l));
  return (lines.at(-1) ?? s.slice(-300)).slice(0, 300);
}

/** Department Vývoj creator: existing ~/Projects/ai-chain/run.sh (not modified, only called). */
export class AiChain {
  family: ModelFamily = "claude"; // architect + implementer + final are Claude
  name = "ai-chain run.sh";
  model: string;
  /** §2: implementation runs on Sonnet (run.sh IMPLEMENTER_MODEL, ai-chain PR #2). */
  constructor(
    public runSh: string,
    public implementerModel = "sonnet",
  ) {
    this.model = `ai-chain (Opus architekt → ${implementerModel} implementer)`;
  }
  /** cwd = order dir: ai-chain writes its runs/<ts>/ there. projectDir = git worktree. */
  async run(
    zadaniFile: string,
    projectDir: string,
    cwd: string,
    timeoutMs = 90 * 60_000,
  ): Promise<AdapterResult & { status: string }> {
    const r = await runProcess(
      "bash",
      [this.runSh, zadaniFile, projectDir],
      "",
      cwd,
      timeoutMs,
      { IMPLEMENTER_MODEL: this.implementerModel },
    );
    const final = latestFile(path.join(cwd, "runs"), "05-final.md");
    const text = final ? fs.readFileSync(final, "utf8") : "";
    const status = (/^STATUS:\s*(.+)$/m.exec(text)?.[1] ?? "UNKNOWN").trim();
    const failed = r.code !== 0 || r.timedOut || !final;
    return {
      ok: !failed,
      text,
      status,
      limit: failed && looksLikeLimit(r.stdout + r.stderr),
      error: failed ? (r.timedOut ? "timeout" : `exit ${r.code}`) : undefined,
      duration_ms: r.duration_ms,
    };
  }
}

function latestFile(runsDir: string, name: string): string | undefined {
  if (!fs.existsSync(runsDir)) return undefined;
  const dirs = fs
    .readdirSync(runsDir)
    .filter((d) => d !== "latest")
    .sort()
    .reverse();
  for (const d of dirs) {
    const f = path.join(runsDir, d, name);
    if (fs.existsSync(f)) return f;
  }
  return undefined;
}
