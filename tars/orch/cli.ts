// CLI: npx tsx tars/orch/cli.ts tick | status | notion-check | owner <order-id> GO|'GO A'|'GO B'|REJECT | konzilium <vstup.json>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AiChain, ClaudeCli, CodexCli } from "./adapters";
import { CardRegistry } from "./cards";
import { CopyDepartment, DevDepartment, VizualDepartment, type DepartmentRunner } from "./departments";
import { NotImplementedDesktop } from "./desktop";
import { defaultHasCli, type PreflightResult } from "./ladder";
import { McpBrowser } from "./mcp-browser";
import { runGuardWithI8 } from "./guard";
import { codexConfigModel, exitCodeFor, runKonzilium } from "./konzilium-lite";
import { checkRestAccess, makeNotionStack, NotionRestApi, NO_TOKEN_MESSAGE, RestNotion } from "./notion";
import { readNotionToken } from "./notion-token";
import { onlyEnabled, Orchestrator, SecretScanningAdapter } from "./orchestrator";
import { OwnerPing, ownerUserIdFromEnv } from "./owner-ping";
import { HybridPanelSink, McpPanelSink, PanelIndex, RestPanelSink } from "./panel";
import { SourceLoader } from "./sources";
import { ownerEventFor } from "./state-machine";
import { Store } from "./store";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const runsDir = process.env.TARS_RUNS_DIR ?? path.join(repoRoot, "runs");
/** DRAFT pages + owner cards go under the MEZI VÁMI project page (sibling of HANDOFF). */
const draftParentId = process.env.TARS_DRAFT_PARENT ?? "3cf0ae49f50781c7a42cf5ea8fe8aae7";
/** Karty Konzilia Lite (výchozí: stejné místo jako karty orchestrátoru). */
const konziliumParentId = process.env.TARS_KONZILIUM_PARENT ?? draftParentId;
const guardScript = process.env.TARS_GUARD ?? path.join(repoRoot, ".claude/hooks/tars-guard.sh");
const aiChain = process.env.TARS_AI_CHAIN ?? path.join(os.homedir(), "Projects/ai-chain/run.sh");

const cardsDir = path.resolve(here, "../../.claude/agents");
const browserStatusFile = path.join(runsDir, "browser-status.json");
const BROWSER_STATUS_TTL_MS = 6 * 60 * 60 * 1000;
/** Run scope: TARS_DEPARTMENTS=copy wires only the copy department (comma list; empty = all). */
const enabledDepartments = (process.env.TARS_DEPARTMENTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** Rung 3 readiness is cached by `browser-check` / start of tick (login check is async). */
function browserReady(): PreflightResult {
  if (!fs.existsSync(browserStatusFile)) return { ok: false, reasons: ["přihlášení profilu TARS-agent neověřeno (spusť browser-check)"] };
  const st = JSON.parse(fs.readFileSync(browserStatusFile, "utf8")) as PreflightResult & { checked_at: string };
  if (Date.now() - new Date(st.checked_at).getTime() > BROWSER_STATUS_TTL_MS) return { ok: false, reasons: ["ověření profilu TARS-agent je starší než 6 h"] };
  return { ok: st.ok, reasons: st.reasons };
}

/** Rung 3 = Playwright MCP driven by Claude (sonnet), Chrome TARS-agent started and closed by guard/tars-browser.sh. */
const makeBrowser = () => new McpBrowser(new SecretScanningAdapter(new ClaudeCli("sonnet")), { runsDir });

async function refreshBrowserStatus(): Promise<PreflightResult> {
  const b = makeBrowser();
  let r: PreflightResult;
  // The debugging port may only exist while TARS holds the run lock (I8).
  const lockStore = new Store(runsDir);
  if (!lockStore.acquireLock()) return { ok: false, reasons: ["běží jiná zakázka (lock)"] };
  try {
    r = await b.loginCheck("https://claude.ai/new", path.join(runsDir, "browser-check"));
  } catch (e) {
    r = { ok: false, reasons: [`login check selhal: ${(e as Error).message.split("\n")[0]}`] };
  } finally {
    lockStore.releaseLock();
  }
  fs.mkdirSync(runsDir, { recursive: true });
  fs.writeFileSync(browserStatusFile, JSON.stringify({ ...r, checked_at: new Date().toISOString() }, null, 2));
  return r;
}

/**
 * Transport notices: always on stderr (launchd log); in runs/log.jsonl only when the message differs from the last
 * one written, so a missing token does not flood the log the supervisor reads on every tick.
 */
function logNotionMode(store: Store, message: string): void {
  console.error(message);
  const last = store.readLog(30).filter((e) => e.role === "transport" && e.kind === "info" && /^Notion REST:/.test(e.result ?? "")).at(-1);
  if (last?.result === message) return;
  store.log({ ts: new Date().toISOString(), order: "-", kind: "info", role: "transport", result: message });
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
  const stack = makeNotionStack(sonnet, runsDir, { token: readNotionToken(), log: (m) => logNotionMode(store, m) });
  const notion = stack.notion;
  const mcpSink = new McpPanelSink(runsDir);
  const panelSink = stack.rest ? new HybridPanelSink(new RestPanelSink(stack.rest), mcpSink, (m) => logNotionMode(store, m)) : mcpSink;
  return new Orchestrator({
    cards,
    ladder: { browserReady, desktopReady: () => desktop.preflight(), hasCli: defaultHasCli },
    store,
    supervisor: opus,
    briefChecker: codex, // karta supervizor.md bod 6: GPT kontroluje zadání
    departments: onlyEnabled<DepartmentRunner>(enabledDepartments, {
      copy: new CopyDepartment(codex, opus, cardText("copy-studio")), // GPT creates, Claude checks
      dev: new DevDepartment(new AiChain(aiChain), codex, path.join(cardsDir, "invariant-sentinel.md")), // Claude chain creates, GPT reviews
      vizual: new VizualDepartment(makeBrowser(), codex, cardText("vizual"), cardText("brana"), sonnet), // Claude Design creates, GPT gate checks
    }),
    notion,
    cardAdapter: sonnet, // data vizuální karty rozhodnutí (card-data.ts)
    sources: new SourceLoader(notion, repoRoot, path.join(runsDir, "sources-cache")),
    guard: () => runGuardWithI8(guardScript, path.join(here, "guard/i8.sh"), repoRoot, runsDir),
    draftParentId,
    repoRoot,
    capsulePath: path.join(repoRoot, "missions/mezi-vami/capsule.md"),
    panel: process.env.TARS_PANEL === "0" ? undefined : { sink: panelSink, index: new PanelIndex(runsDir) },
    ownerPing: new OwnerPing(stack.rest, { userId: ownerUserIdFromEnv() }), // bez tokenu (stack.rest) jen zaloguje
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
    case "notion-check": {
      const token = readNotionToken();
      if (!token) {
        console.log(NO_TOKEN_MESSAGE);
        process.exitCode = 1;
        return;
      }
      const r = await checkRestAccess(new NotionRestApi(token));
      console.log(r.detail);
      process.exitCode = r.ok ? 0 : 1;
      return;
    }
    case "browser-smoke": {
      // Opens about:blank in the TARS-agent profile through Playwright MCP (Chrome and lock handled like a real order).
      const lock = new Store(runsDir);
      if (!lock.acquireLock()) throw new Error("běží jiná zakázka (lock)");
      try {
        const r = await makeBrowser().run([{ kind: "goto", url: "about:blank" }, { kind: "read" }], path.join(runsDir, "browser-smoke"));
        console.log(JSON.stringify({ ok: r.finalUrl === "about:blank", finalUrl: r.finalUrl, screenshots: r.screenshots.length, reads: r.reads.length }));
      } finally {
        lock.releaseLock();
      }
      return;
    }
    case "cards": {
      const o = build();
      for (const role of ["supervizor", "copy-studio", "vizual", "vyvojar", "brana"]) {
        const c = new CardRegistry(cardsDir).check(role);
        console.log(`${role.padEnd(12)} ${c.ok ? "OK" : `FAIL: ${c.problems.join("; ")}`}`);
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
    case "konzilium": {
      // Konzilium Lite (konzilium-lite.ts): Claude navrhne, GPT oponuje, kartu a řádek panelu zapíše jen skript přes REST.
      const [file] = args;
      if (!file) throw new Error("usage: konzilium <vstupní soubor.json>");
      const token = readNotionToken();
      if (!token) {
        // Bez tokenu by kartu přenášel model (claude -p): Konzilium Lite to nedovolí a nic nespustí.
        console.log("Konzilium Lite zapisuje jen přes Notion REST; token chybí, nic nespuštěno.");
        process.exitCode = 1;
        return;
      }
      const api = new NotionRestApi(token);
      const r = await runKonzilium(path.resolve(file), {
        creator: new ClaudeCli("opus"),
        // Izolovaný codex nečte config.toml, model z něj se proto předá přes -m.
        checker: new CodexCli(codexConfigModel(path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "config.toml")) ?? "codex-default"),
        runsDir,
        notion: new RestNotion(api),
        panel: new RestPanelSink(api),
        cardParentId: konziliumParentId,
      });
      console.log(JSON.stringify(r));
      process.exitCode = exitCodeFor(r.status);
      return;
    }
    case "owner": {
      const [id, decision] = args;
      const ev = ownerEventFor(decision);
      if (!id || !ev) throw new Error("usage: owner <order-id> GO|'GO A'|'GO B'|REJECT");
      const orch = build();
      const o = orch.owner(id, ev.decision, ev.option);
      await orch.flushPanel();
      console.log(`${o.id} → ${o.state}`);
      return;
    }
    default:
      console.log("usage: cli.ts tick | status | cards | browser-check | abort <id> <reason> | owner <id> GO|'GO A'|'GO B'|REJECT | notion-check | panel-sync <id> | konzilium <vstup.json>");
      process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`tars-orch: ${(e as Error).message}`);
  process.exitCode = 1;
});
