// Dosah enforcement (TARS-ORCH-001 §2c, gate file — changes are class B once on main, see merge-policy GATE_FILES).
// What a role may touch is enforced here as CLI flags and environment, never by a prompt.
import type { RunOpts } from "./adapters";

/** Built-in Claude Code tools. A card's Dosah allows a subset; the rest is disallowed explicitly. */
export const CLAUDE_BUILTIN_TOOLS = ["Bash", "Edit", "Write", "MultiEdit", "NotebookEdit", "Read", "Glob", "Grep", "WebSearch", "WebFetch", "Task", "Agent", "TodoWrite"];

/** Dosah → CLI flags: allowed tools from the card, every other built-in tool disallowed. */
export function dosahToolOpts(allowed: string[]): Pick<RunOpts, "allowedTools" | "disallowedTools" | "noMcp" | "tools"> {
  const allow = allowed.filter((t) => CLAUDE_BUILTIN_TOOLS.includes(t));
  // MCP servers are never part of a Konzilium/research Dosah → none are loaded.
  // `--tools` is the hard limit of what exists in the session; the disallow list stays as defence in depth.
  return { tools: allow, allowedTools: allow, disallowedTools: CLAUDE_BUILTIN_TOOLS.filter((t) => !allow.includes(t)), noMcp: true };
}

/** CLI arguments for the Claude adapter (exported for tests: the exact flags are the enforcement). */
export function claudeArgs(model: string, opts: Omit<RunOpts, "cwd">): string[] {
  const args = ["-p", "--model", model, "--output-format", "json"];
  if (opts.tools) args.push("--tools", opts.tools.join(","));
  if (opts.allowedTools?.length) args.push("--allowedTools", opts.allowedTools.join(","));
  if (opts.disallowedTools?.length) args.push("--disallowedTools", opts.disallowedTools.join(","));
  if (opts.noMcp) args.push("--strict-mcp-config");
  return args;
}

/** API-key variables are stripped so no CLI silently falls back to paid API billing (paid API = 0 without owner GO). */
const STRIP_ENV = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY", "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX"];

export function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const k of STRIP_ENV) delete env[k];
  return env;
}
