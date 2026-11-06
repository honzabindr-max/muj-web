#!/usr/bin/env node
// TARS-SELF-BUILD-001 M0-02 — read-only local context capsule.
// No network, model calls, filesystem writes, process execution beyond read-only git queries,
// credential reads, approvals, dispatch, or merge.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readGit(...args) {
  return execFileSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 5_000,
    maxBuffer: 1024 * 1024,
  }).trim();
}

function build() {
  const sourcePath = resolve(repoRoot, "docs/tars/self-build/SOURCES.json");
  const sources = JSON.parse(readFileSync(sourcePath, "utf8"));
  if (
    sources.project_id !== "TARS-SELF-BUILD-001" ||
    sources.protocol_version !== "0.1" ||
    sources.repository !== "honzabindr-max/muj-web" ||
    !/^https:\/\/app\.notion\.com\/p\/[a-f0-9]{32}$/.test(sources.project_page_url)
  ) {
    throw new Error("INVALID_SOURCES");
  }

  const head = readGit("rev-parse", "--verify", "HEAD");
  if (!/^[a-f0-9]{40}$/.test(head)) throw new Error("INVALID_GIT_HEAD");
  const branch = readGit("branch", "--show-current") || null;
  const trackedDirty = readGit("status", "--porcelain", "--untracked-files=no").length > 0;

  return {
    schema: "tars-self-build.context.v0.1",
    generated_at: new Date().toISOString(),
    project_id: sources.project_id,
    context_is_authoritative: false,
    sources: {
      project_page: sources.project_page_url,
      decision_register: sources.decision_register_url,
      owner_rules: sources.owner_rules_url,
      architecture_snapshot: sources.architecture_snapshot_url,
      historical_audit: sources.astra_historical_audit_url,
      repository: sources.repository,
    },
    local_git_observation: {
      status: "OBSERVED_LOCAL_ONLY",
      head_sha: head,
      branch,
      tracked_worktree_dirty: trackedDirty,
    },
    externally_unverified: {
      current_project_milestone: "UNKNOWN",
      current_decisions: "UNKNOWN",
      current_owner_approval: "UNKNOWN",
      live_runtime_status: "UNKNOWN",
      inbox_mode: "UNKNOWN",
      open_pull_requests_and_ci: "UNKNOWN",
    },
    permission: {
      go_or_reject: "NOT_GRANTED",
      merge: "NOT_GRANTED",
      dispatch_or_runtime_mutation: "NOT_GRANTED",
      production_write: "NOT_GRANTED",
    },
    next_safe_action: "Read current Notion project and Decision Register; independently verify GitHub and runtime state before proposing one scoped action.",
  };
}

try {
  process.stdout.write(JSON.stringify(build(), null, 2) + "\n");
} catch {
  process.stderr.write("TARS CONTEXT HOLD: missing or invalid local evidence; no capsule emitted.\n");
  process.exitCode = 2;
}
