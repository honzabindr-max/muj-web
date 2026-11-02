// CLI: npx tsx tars/orch/cli.ts tick | status | owner <order-id> GO|REJECT
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AiChain, ClaudeCli, CodexCli } from "./adapters";
import { CopyDepartment, DevDepartment } from "./departments";
import { runGuard } from "./guard";
import { makeNotion } from "./notion";
import { Orchestrator, SecretScanningAdapter } from "./orchestrator";
import { Store } from "./store";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const runsDir = process.env.TARS_RUNS_DIR ?? path.join(repoRoot, "runs");
/** DRAFT pages + owner cards go under the MEZI VÁMI project page (sibling of HANDOFF). */
const draftParentId = process.env.TARS_DRAFT_PARENT ?? "3cf0ae49f50781c7a42cf5ea8fe8aae7";
const guardScript = process.env.TARS_GUARD ?? path.join(repoRoot, ".claude/hooks/tars-guard.sh");
const aiChain = process.env.TARS_AI_CHAIN ?? path.join(os.homedir(), "Projects/ai-chain/run.sh");

function build(): Orchestrator {
  const store = new Store(runsDir);
  const wrap = <T extends ConstructorParameters<typeof SecretScanningAdapter>[0]>(a: T) => new SecretScanningAdapter(a);
  const opus = wrap(new ClaudeCli("opus"));
  const sonnet = wrap(new ClaudeCli("sonnet"));
  const codex = wrap(new CodexCli());
  return new Orchestrator({
    store,
    supervisor: opus,
    departments: {
      copy: new CopyDepartment(codex, opus), // GPT creates, Claude checks
      dev: new DevDepartment(new AiChain(aiChain), codex), // Claude chain creates, GPT reviews
    },
    notion: makeNotion(sonnet, runsDir),
    guard: () => runGuard(guardScript, repoRoot),
    draftParentId,
    repoRoot,
    capsulePath: path.join(repoRoot, "missions/mezi-vami/capsule.md"),
  });
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const store = new Store(runsDir);
  switch (cmd) {
    case "tick": {
      const r = await build().tick();
      console.log(JSON.stringify(r));
      process.exitCode = r.status === "guard_alarm" ? 2 : 0;
      return;
    }
    case "status":
      for (const o of store.listOrders())
        console.log(`${o.id}  ${o.state.padEnd(13)} fixes=${o.fix_rounds}  ${o.brief?.title ?? ""}  ${o.delivered_url ?? ""}`);
      return;
    case "owner": {
      const [id, decision] = args;
      if (!id || (decision !== "GO" && decision !== "REJECT")) throw new Error("usage: owner <order-id> GO|REJECT");
      const o = build().owner(id, decision);
      console.log(`${o.id} → ${o.state}`);
      return;
    }
    default:
      console.log("usage: cli.ts tick | status | owner <order-id> GO|REJECT");
      process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`tars-orch: ${(e as Error).message}`);
  process.exitCode = 1;
});
