import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/tars-self-build-context.mjs", import.meta.url));

function capsule() {
  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    timeout: 10_000,
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as Record<string, any>;
}

describe("TARS SELF-BUILD M0: read-only context capsule", () => {
  it("contains verifiable local git evidence and exact project entrypoint", () => {
    const out = capsule();
    expect(out.project_id).toBe("TARS-SELF-BUILD-001");
    expect(out.sources.project_page).toBe(
      "https://app.notion.com/p/4100ae49f50781e792c1c8cf4e79b743",
    );
    expect(out.local_git_observation.status).toBe("OBSERVED_LOCAL_ONLY");
    expect(out.local_git_observation.head_sha).toMatch(/^[a-f0-9]{40}$/);
    expect(typeof out.local_git_observation.tracked_worktree_dirty).toBe("boolean");
  });

  it("does not invent current project state, owner approval, or runtime evidence", () => {
    const out = capsule();
    expect(out.context_is_authoritative).toBe(false);
    expect(Object.values(out.externally_unverified).every((value) => value === "UNKNOWN")).toBe(true);
    expect(Object.values(out.permission).every((value) => value === "NOT_GRANTED")).toBe(true);
    expect(out.next_safe_action).toContain("independently verify");
  });
});
