import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/tars-self-build-context.mjs", import.meta.url));
const repoRoot = resolve(dirname(script), "..");
const sourcePath = join(repoRoot, "docs/tars/self-build/SOURCES.json");

function run(path = script) {
  return spawnSync(process.execPath, [path], {
    encoding: "utf8",
    timeout: 10_000,
  });
}
function capsule() {
  const result = run();
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

describe("TARS SELF-BUILD M0: read-only context capsule", () => {
  it("contains verifiable local git evidence and exact project entrypoint", () => {
    const out = capsule();
    expect(out.project_id).toBe("TARS-SELF-BUILD-001");
    expect((out.sources as Record<string, string>).project_page).toBe(
      "https://app.notion.com/p/4100ae49f50781e792c1c8cf4e79b743",
    );
    const localGit = out.local_git_observation as Record<string, unknown>;
    expect(localGit.status).toBe("OBSERVED_LOCAL_ONLY");
    expect(localGit.head_sha).toMatch(/^[a-f0-9]{40}$/);
    expect(typeof localGit.tracked_worktree_dirty).toBe("boolean");
  });

  it("does not invent current project state, owner approval, or runtime evidence", () => {
    const out = capsule();
    expect(out.context_is_authoritative).toBe(false);
    expect(Object.values(out.externally_unverified as Record<string, string>).every((value) => value === "UNKNOWN")).toBe(true);
    expect(Object.values(out.permission as Record<string, string>).every((value) => value === "NOT_GRANTED")).toBe(true);
    expect(out.next_safe_action).toContain("independently verify");
  });

  it("does not rewrite the local Git index", () => {
    const index = spawnSync("git", ["-C", repoRoot, "--no-optional-locks", "rev-parse", "--path-format=absolute", "--git-path", "index"], { encoding: "utf8" });
    expect(index.status).toBe(0);
    const indexPath = index.stdout.trim();
    const before = statSync(indexPath).mtimeMs;
    const output = run();
    expect(output.status, output.stderr).toBe(0);
    expect(statSync(indexPath).mtimeMs).toBe(before);
  });

  it("fails closed with no JSON capsule for missing or invalid source URLs", () => {
    const tmp = mkdtempSync(join(tmpdir(), "tars-self-build-test-"));
    try {
      const scriptsDir = join(tmp, "scripts");
      const sourcesDir = join(tmp, "docs", "tars", "self-build");
      mkdirSync(scriptsDir, { recursive: true });
      mkdirSync(sourcesDir, { recursive: true });
      const fixtureScript = join(scriptsDir, "tars-self-build-context.mjs");
      copyFileSync(script, fixtureScript);
      const fixtureSources = join(sourcesDir, "SOURCES.json");
      const valid = JSON.parse(readFileSync(sourcePath, "utf8")) as Record<string, string>;
      for (const invalidValue of ["https://example.com/other", undefined]) {
        const corrupted: Record<string, string | undefined> = { ...valid, decision_register_url: invalidValue };
        writeFileSync(fixtureSources, JSON.stringify(corrupted));
        const output = run(fixtureScript);
        expect(output.status).toBe(2);
        expect(output.stdout).toBe("");
        expect(output.stderr).toContain("INVALID_SOURCES");
      }
      writeFileSync(fixtureSources, "{malformed json");
      const malformed = run(fixtureScript);
      expect(malformed.status).toBe(2);
      expect(malformed.stdout).toBe("");
      expect(malformed.stderr).toContain("INVALID_SOURCES");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
