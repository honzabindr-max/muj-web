// Etapa 4 PR 4b (NAVRH-v6 §8.1, obrana do hloubky): bash-preflight při nastaveném TARS_ATTEMPT_ID (dítě kroku TARS)
// zamítne vzdálený zápis na GitHub (git push, gh pr, gh workflow run, gh api se zápisem), i v textu node -e / bash -c.
// Bez TARS_ATTEMPT_ID se chování hooku nemění.
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(__dirname, "..", "bash-preflight.sh");
const LOG = path.join(
  mkdtempSync(path.join(tmpdir(), "preflight-4b-")),
  "log.txt",
);

function decide(command: string, attempt?: string) {
  const env: Record<string, string | undefined> = {
    ...process.env,
    TARS_PREFLIGHT_LOG: LOG,
  };
  delete env.TARS_ATTEMPT_ID;
  if (attempt !== undefined) env.TARS_ATTEMPT_ID = attempt;
  const r = spawnSync("bash", [SCRIPT], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf8",
    env: env as NodeJS.ProcessEnv,
  });
  expect(r.status).toBe(0);
  if (r.stdout.trim() === "") return { decision: "allow", reason: "" };
  const j = JSON.parse(r.stdout);
  return {
    decision: j.hookSpecificOutput.permissionDecision as string,
    reason: j.hookSpecificOutput.permissionDecisionReason as string,
  };
}

const ATTEMPT = "wo-r1/create-r0/a1";

const REMOTE: Array<[string, string]> = [
  ["git push", "git push origin HEAD:refs/heads/tars/probe-1"],
  ["git -C push", "git -C /tmp/wt push"],
  [
    "git -c credential.helper= push",
    "git -c credential.helper= push origin main",
  ],
  ["absolutní cesta", "/usr/bin/git push"],
  ["env před příkazem", "env GIT_TERMINAL_PROMPT=0 git push"],
  ["proměnná před příkazem", "GIT_DIR=x git push"],
  ["uvozovky v názvu", "g''it push"],
  ["xargs", "echo x | xargs git push"],
  ["bash -c", "bash -c 'git push origin main'"],
  ["printf | bash", "printf 'git push' | bash"],
  ["gh pr create", "gh pr create --draft --title x --body y"],
  ["gh pr view (každé gh pr)", "gh pr view 1"],
  ["gh -R pr", "gh -R o/r pr list"],
  ["gh workflow run", "gh workflow run crawl.yml"],
  ["gh api -X POST", "gh api -X POST repos/o/r/issues"],
  ["gh api --method=PATCH", "gh api --method=PATCH repos/o/r"],
  ["gh api -XDELETE", "gh api -XDELETE repos/o/r/git/refs/heads/x"],
  ["gh api s poli (POST)", "gh api repos/o/r/issues -f title=x"],
  ["gh api --input", "gh api repos/o/r/issues --input body.json"],
  [
    "node -e execSync",
    `node -e "require('child_process').execSync('git push origin HEAD')"`,
  ],
  [
    "node -e execFileSync pole",
    `node -e "require('child_process').execFileSync('git', ['push', 'origin', 'HEAD'])"`,
  ],
  [
    "python -c subprocess",
    `python3 -c "import subprocess; subprocess.run(['gh','pr','create'])"`,
  ],
  [
    "node -e gh api POST",
    `node -e "require('child_process').execSync('gh api -X POST repos/o/r/issues')"`,
  ],
];

const ALLOWED_IN_ATTEMPT: Array<[string, string]> = [
  ["git status", "git status"],
  ["git commit se slovem push ve zprávě", "git commit -m 'push fix'"],
  ["git log", "git log --oneline"],
  ["git diff", "git diff origin/main..HEAD"],
  ["gh api GET", "gh api repos/o/r/pulls"],
  ["gh api -X GET s poli", "gh api -X GET repos/o/r/pulls -f per_page=1"],
  ["gh run list", "gh run list"],
  ["vitest", "npx vitest run tars"],
  ["grep push", "grep -rn push src"],
];

describe("bash-preflight: TARS_ATTEMPT_ID zamítne vzdálený zápis (PR 4b, §8.1)", () => {
  for (const [name, cmd] of REMOTE)
    it(`pokus TARS: ${name} → deny`, () => {
      const d = decide(cmd, ATTEMPT);
      expect(d.decision).toBe("deny");
      expect(d.reason).toMatch(/TARS_ATTEMPT_ID.*nesmí zapisovat na GitHub/);
    });

  for (const [name, cmd] of ALLOWED_IN_ATTEMPT)
    it(`pokus TARS: ${name} → allow`, () => {
      expect(decide(cmd, ATTEMPT).decision).toBe("allow");
    });

  it("bez TARS_ATTEMPT_ID (nebo s prázdnou hodnotou) se nic nemění: git push i gh pr create projdou", () => {
    expect(decide("git push origin main").decision).toBe("allow");
    expect(decide("gh pr create --draft --title x --body y").decision).toBe(
      "allow",
    );
    expect(decide("git push origin main", "  ").decision).toBe("allow");
  });

  it("DR-039 má dál přednost: cli.ts owner v pokusu je zamítnuté jako owner, ne jako remote", () => {
    const d = decide("npx tsx tars/orch/cli.ts owner wo-1 GO", ATTEMPT);
    expect(d.decision).toBe("deny");
    expect(d.reason).toMatch(/DR-039/);
  });

  it("P04 dál platí i v pokusu (řetězení), remote pravidlo ho nepřebije", () => {
    const d = decide("git status && git log", ATTEMPT);
    expect(d.decision).toBe("deny");
    expect(d.reason).toMatch(/Řetězení/);
  });

  it("řetězení s git push v pokusu = deny s důvodem remote (před P04)", () => {
    const d = decide("git add -A && git push", ATTEMPT);
    expect(d.decision).toBe("deny");
    expect(d.reason).toMatch(/nesmí zapisovat na GitHub/);
  });
});
