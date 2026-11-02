// CLI: npx tsx tars/orch/cli.ts tick | status | owner <order-id> GO|ALT|REJECT | supersede <id> [--redo] <reason> | merge <pr>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AiChain, ClaudeCli, CodexCli } from "./adapters";
import { BrowserAdapter } from "./browser";
import { CardRegistry } from "./cards";
import { CopyDepartment, DevDepartment, VizualDepartment, type DepartmentRunner } from "./departments";
import { NotImplementedDesktop } from "./desktop";
import { defaultHasCli, type PreflightResult } from "./ladder";
import { runGuardWithI8 } from "./guard";
import { makeNotion } from "./notion";
import { onlyEnabled, Orchestrator, SecretScanningAdapter } from "./orchestrator";
import { McpPanelSink, PanelIndex } from "./panel";
import { SourceLoader } from "./sources";
import { Konzilium } from "./konzilium";
import { MergeRunner, mergeRunnerFor, realExec } from "./merge-policy";
import { mergeConstraints } from "./owner-gate";
import { DecisionPrepDepartment } from "./prep";
import { Store } from "./store";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const runsDir = process.env.TARS_RUNS_DIR ?? path.join(repoRoot, "runs");
/** DRAFT pages + owner cards go under the MEZI VÁMI project page (sibling of HANDOFF). */
const draftParentId = process.env.TARS_DRAFT_PARENT ?? "3cf0ae49f50781c7a42cf5ea8fe8aae7";
const guardScript = process.env.TARS_GUARD ?? path.join(repoRoot, ".claude/hooks/tars-guard.sh");
const aiChain = process.env.TARS_AI_CHAIN ?? path.join(os.homedir(), "Projects/ai-chain/run.sh");

const cardsDir = path.join(here, "specialists/mezi-vami");
const browserStatusFile = path.join(runsDir, "browser-status.json");
const BROWSER_STATUS_TTL_MS = 6 * 60 * 60 * 1000;
/** Run scope: TARS_DEPARTMENTS=copy wires only the copy department (comma list; empty = all). */
const enabledDepartments = (process.env.TARS_DEPARTMENTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
// Příprava rozhodnutí belongs to the copy department's recipe (copy + research), so TARS_DEPARTMENTS=copy enables it.
if (enabledDepartments.includes("copy") && !enabledDepartments.includes("prep")) enabledDepartments.push("prep");

/** Rung 3 readiness is cached by `browser-check` / start of tick (login check is async). */
function browserReady(): PreflightResult {
  if (!fs.existsSync(browserStatusFile)) return { ok: false, reasons: ["přihlášení profilu TARS-agent neověřeno (spusť browser-check)"] };
  const st = JSON.parse(fs.readFileSync(browserStatusFile, "utf8")) as PreflightResult & { checked_at: string };
  if (Date.now() - new Date(st.checked_at).getTime() > BROWSER_STATUS_TTL_MS) return { ok: false, reasons: ["ověření profilu TARS-agent je starší než 6 h"] };
  return { ok: st.ok, reasons: st.reasons };
}

async function refreshBrowserStatus(): Promise<PreflightResult> {
  const b = new BrowserAdapter();
  let r: PreflightResult;
  // The debugging port may only exist while TARS holds the run lock (I8).
  const lockStore = new Store(runsDir);
  if (!lockStore.acquireLock()) return { ok: false, reasons: ["běží jiná zakázka (lock)"] };
  try {
    r = await b.loginCheck("https://claude.ai/new", runsDir);
  } catch (e) {
    r = { ok: false, reasons: [`login check selhal: ${(e as Error).message.split("\n")[0]}`] };
  } finally {
    lockStore.releaseLock();
  }
  fs.mkdirSync(runsDir, { recursive: true });
  fs.writeFileSync(browserStatusFile, JSON.stringify({ ...r, checked_at: new Date().toISOString() }, null, 2));
  return r;
}

function build(): Orchestrator {
  const store = new Store(runsDir);
  const wrap = <T extends ConstructorParameters<typeof SecretScanningAdapter>[0]>(a: T) => new SecretScanningAdapter(a);
  const opus = wrap(new ClaudeCli("opus"));
  const sonnet = wrap(new ClaudeCli("sonnet"));
  const codex = wrap(new CodexCli());
  const cards = new CardRegistry(cardsDir);
  const cardText = (role: string) => (cards.check(role).ok ? cards.text(role) : "");
  const desktop = new NotImplementedDesktop();
  const notion = makeNotion(sonnet, runsDir);
  const sources = new SourceLoader(notion, repoRoot, path.join(runsDir, "sources-cache"));
  return new Orchestrator({
    konzilium: new Konzilium({ cards: new CardRegistry(path.join(cardsDir, "konzilium")), adapters: { claude: opus, gpt: codex }, loadSources: (k) => sources.loadAll(k), now: () => new Date() }),
    merge: new MergeRunner({ exec: realExec, cwd: repoRoot, reviewer: codex, guard: () => runGuardWithI8(guardScript, path.join(here, "guard/i8.sh"), repoRoot) }),
    cards,
    ladder: { browserReady, desktopReady: () => desktop.preflight(), hasCli: defaultHasCli },
    store,
    supervisor: opus,
    briefChecker: codex, // karta supervizor.md bod 6: GPT kontroluje zadání
    departments: onlyEnabled<DepartmentRunner>(enabledDepartments, {
      copy: new CopyDepartment(codex, opus, cardText("copy-studio")), // GPT creates, Claude checks
      dev: new DevDepartment(new AiChain(aiChain), codex, path.join(cardsDir, "ai-chain-mezi-vami/invariant-sentinel.md")), // Claude chain creates, GPT reviews
      prep: new DecisionPrepDepartment(opus, codex, cardText("reserse-rozhodnuti")), // Claude researches (WebSearch only), GPT checks
      vizual: new VizualDepartment(new BrowserAdapter(), codex, cardText("vizual"), cardText("brana"), sonnet), // Claude Design creates, GPT gate checks
    }),
    notion,
    sources,
    guard: () => runGuardWithI8(guardScript, path.join(here, "guard/i8.sh"), repoRoot),
    draftParentId,
    repoRoot,
    capsulePath: path.join(repoRoot, "missions/mezi-vami/capsule.md"),
    panel: process.env.TARS_PANEL === "0" ? undefined : { sink: new McpPanelSink(runsDir), index: new PanelIndex(runsDir) },
  });
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const store = new Store(runsDir);
  switch (cmd) {
    case "tick": {
      // Rung 3 login check opens Chrome — only when the vizual department is in scope.
      if (!enabledDepartments.length || enabledDepartments.includes("vizual")) await refreshBrowserStatus();
      const r = await build().tick();
      console.log(JSON.stringify(r));
      process.exitCode = r.status === "guard_alarm" ? 2 : 0;
      return;
    }
    case "status":
      for (const o of store.listOrders())
        console.log(`${o.id}  ${o.state.padEnd(13)} fixes=${o.fix_rounds}  ${o.brief?.title ?? ""}  ${o.delivered_url ?? ""}`);
      return;
    case "browser-check": {
      console.log(JSON.stringify(await refreshBrowserStatus()));
      return;
    }
    case "cards": {
      const o = build();
      for (const role of ["supervizor", "copy-studio", "reserse-rozhodnuti", "vizual", "vyvojar", "brana"]) {
        const c = new CardRegistry(cardsDir).check(role);
        console.log(`${role.padEnd(12)} ${c.ok ? "OK" : `FAIL: ${c.problems.join("; ")}`}`);
      }
      const kc = new CardRegistry(path.join(cardsDir, "konzilium"));
      for (const role of ["advokat", "prodejni-psycholog", "ux-ui", "brand-strateg", "hlas-zakaznika", "eticky-strazce", "soudce"]) {
        const c = kc.check(role);
        console.log(`konzilium/${role.padEnd(20)} ${c.ok ? `OK (${c.card!.family})` : `FAIL: ${c.problems.join("; ")}`}`);
      }
      console.log(JSON.stringify(o.availability(), null, 2));
      return;
    }
    case "abort": {
      const [id, ...reason] = args;
      if (!id || !reason.length) throw new Error("usage: abort <order-id> <reason>");
      const orch = build();
      const o = orch.abort(id, reason.join(" "));
      await orch.flushPanel();
      console.log(`${o.id} → ${o.state}`);
      return;
    }
    case "panel-sync": {
      const [id] = args;
      if (!id) throw new Error("usage: panel-sync <order-id>");
      await build().resyncPanel(id);
      const last = store.readLog(50).filter((e) => e.order === id && e.role === "transport").at(-1);
      console.log(`${id} panel: ${last?.result ?? "?"} ${last?.reason ?? ""}`.trim());
      process.exitCode = last?.kind === "error" ? 1 : 0;
      return;
    }
    case "owner": {
      const [id, decision, ...rest] = args;
      if (!id || (decision !== "GO" && decision !== "ALT" && decision !== "REJECT")) throw new Error("usage: owner <order-id> GO|ALT|REJECT [--rev <sha256 decision.json>]");
      const ri = rest.indexOf("--rev");
      const orch = build();
      const o = await orch.owner(id, decision, process.env.TARS_OWNER_VIA ?? "cli", ri >= 0 ? rest[ri + 1] : undefined);
      await orch.flushPanel();
      console.log(`${o.id} → ${o.state}`);
      return;
    }
    case "supersede": {
      const [id, ...rest] = args;
      const redo = rest.includes("--redo");
      const reason = rest.filter((x) => x !== "--redo").join(" ");
      if (!id || !reason) throw new Error("usage: supersede <order-id> [--redo] <reason>");
      const orch = build();
      const o = orch.supersede(id, reason, redo);
      await orch.flushPanel();
      console.log(`${o.id} → ${o.state}${redo ? " (redo)" : ""}`);
      return;
    }
    case "merge": {
      // DR-024 for any PR: class A → TARS merges after green CI + PASS review by GPT; class B → refuses (owner card).
      const [pr, fam, ...rest] = args;
      const ci = rest.indexOf("--context-file");
      const reviewContext = ci >= 0 ? fs.readFileSync(rest[ci + 1], "utf8") : undefined;
      // Author family must be stated explicitly (no default): the reviewer is always the OTHER family.
      if (!pr || (fam !== "claude" && fam !== "gpt")) throw new Error("usage: merge <pr-number> <author-family claude|gpt>");
      const author = fam;
      const guard = () => runGuardWithI8(guardScript, path.join(here, "guard/i8.sh"), repoRoot);
      const cons = mergeConstraints(new Store(runsDir), pr);
      if (cons.refuse) throw new Error(cons.refuse);
      const runner = mergeRunnerFor(author, { exec: realExec, cwd: repoRoot, adapters: { claude: new SecretScanningAdapter(new ClaudeCli("opus")), gpt: new SecretScanningAdapter(new CodexCli()) }, guard, reviewContext });
      const r = await runner.run(pr, author, { waitMs: 25 * 60_000, forceOwner: cons.forceOwner });
      // Review text is evidence: stored locally (gitignored runs/), issues printed.
      const review = "review" in r ? r.review : undefined; // kept also after a successful merge
      if (review) {
        const f = path.join(runsDir, `merge-pr-${pr}`, `review-${new Date().toISOString().replace(/[:.]/g, "")}.md`);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, review);
        console.log(`review: ${f}`);
      }
      if (r.status === "owner" || r.status === "blocked") {
        // DR-024 class B / blocked → visual card for the owner (GO on the card makes TARS merge).
        const url = JSON.parse(realExec("gh", ["pr", "view", pr, "--json", "url"], repoRoot).out).url as string;
        const orch = build();
        const card = orch.openMergeCard(pr, url, author, r);
        await orch.flushPanel();
        console.log(`karta: ${process.env.TARS_PANEL_URL ?? "http://127.0.0.1:4747"}/rozhodnuti/${card.id}`);
      }
      console.log(JSON.stringify({ ...r, review: undefined }, null, 2));
      process.exitCode = r.status === "merged" ? 0 : 3;
      return;
    }
    default:
      console.log("usage: cli.ts tick | status | cards | browser-check | abort <id> <reason> | owner <id> GO|ALT|REJECT | supersede <id> [--redo] <reason> | merge <pr> [author-family] | panel-sync <id>");
      process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`tars-orch: ${(e as Error).message}`);
  process.exitCode = 1;
});
