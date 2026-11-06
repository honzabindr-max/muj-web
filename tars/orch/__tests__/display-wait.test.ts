// Varianta B: kontrola GPT čekající na displej se neopakuje (žádný přechod ani zápis na panel), dokud displej spí.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import type { AdapterResult, TextAdapter } from "../adapters";
import { CardRegistry } from "../cards";
import { CopyDepartment } from "../departments";
import { NotImplementedDesktop } from "../desktop";
import { Orchestrator } from "../orchestrator";
import { PanelIndex, type PanelRow, type PanelSink } from "../panel";
import { Store } from "../store";
import type { ModelFamily } from "../types";
import { privateDraftDeps } from "./private-target";

const CARDS_DIR = path.join(__dirname, "..", "..", "..", ".claude", "agents");
const SLEEP =
  "čeká na kontrolu: displej spí (displej spí); pokus GPT v prohlížeči se neprovedl";
const OTHER =
  "čeká na kontrolu: text nebyl odeslán právě jednou po ověření obsahu pole (odesláno: 0)";
const BRIEF =
  "```json\n" +
  JSON.stringify({
    title: "Návrh mikrocopy formuláře",
    department: "copy",
    milestone: "3.1",
    why: "DALŠÍ KROK",
    goal: "Navrhnout texty chybových stavů",
    inputs: ["fakt A"],
    acceptance: ["kritérium 1"],
    owner_decisions: [],
    sources: [
      "handoff",
      "capsule",
      "buildos",
      "funnel",
      "ui_build_brief",
      "copy_handoff",
    ],
  }) +
  "\n```";

class Stub implements TextAdapter {
  calls = 0;
  name = "stub";
  constructor(
    public family: ModelFamily,
    public model: string,
    private reply: () => AdapterResult,
  ) {}
  async run(): Promise<AdapterResult> {
    this.calls++;
    return this.reply();
  }
}
class CountingSink implements PanelSink {
  writes = 0;
  async upsert(_row: PanelRow, existing?: string): Promise<string> {
    this.writes++;
    return existing ?? "row-1";
  }
}

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-displej-wait-"));
});

function setup(
  reason: string,
  displayAwake?: () => { awake: boolean; reason: string },
) {
  const store = new Store(dir);
  const sink = new CountingSink();
  const gpt = new Stub("gpt", "GPT-6", () => ({
    ok: false,
    text: "",
    limit: false,
    waitReview: true,
    error: reason,
    duration_ms: 1,
  }));
  const claude = new Stub("claude", "opus", () => ({
    ok: true,
    text: BRIEF,
    limit: false,
    duration_ms: 1,
  }));
  const orch = new Orchestrator({
    store,
    supervisor: claude,
    briefChecker: gpt,
    departments: { copy: new CopyDepartment(claude, gpt) },
    cards: new CardRegistry(CARDS_DIR),
    ladder: {
      hasCli: () => true,
      browserReady: () => ({ ok: false, reasons: ["x"] }),
      desktopReady: () => new NotImplementedDesktop().preflight(),
    },
    notion: {
      createPage: async () => ({ url: "https://app.notion.com/p/mock1" }),
      readPage: async () => "",
    },
    guard: () => ({ alarm: false, summary: "TARS-GUARD OK (8/8)" }),
    ...privateDraftDeps(dir),
    repoRoot: dir,
    capsulePath: path.join(dir, "capsule.md"),
    panel: { sink, index: new PanelIndex(dir) },
    displayAwake,
  });
  const retries = () =>
    store.readLog(500).filter((e) => e.event === "retry_review").length;
  return { store, orch, gpt, sink, retries };
}

describe("kontrola GPT čekající na displej (varianta B)", () => {
  it("spící displej + „displej spí“: za 5 ticků 0 přechodů, 0 zápisů na panel, 0 volání kontroly, jeden logOnce", async () => {
    const t = setup(SLEEP, () => ({ awake: false, reason: "displej spí" }));
    expect(await t.orch.tick()).toMatchObject({ status: "waiting_review" });
    const log0 = t.store.readLog(500).length;
    const writes0 = t.sink.writes;
    for (let i = 0; i < 5; i++)
      expect(await t.orch.tick()).toMatchObject({ status: "waiting_display" });
    const added = t.store.readLog(500).slice(log0);
    expect(added.filter((e) => e.kind === "transition")).toHaveLength(0);
    expect(
      added.filter((e) => e.result === "čeká na displej: displej spí"),
    ).toHaveLength(1);
    expect(t.sink.writes).toBe(writes0);
    expect(t.gpt.calls).toBe(1);
    expect(t.retries()).toBe(0);
    expect(t.store.listOrders()[0].state).toBe("WAITING_REVIEW");
  });

  it("probuzený displej: právě jeden retry_review v ticku", async () => {
    let awake = false;
    const t = setup(SLEEP, () => ({ awake, reason: "x" }));
    await t.orch.tick();
    awake = true;
    expect(await t.orch.tick()).toMatchObject({ status: "waiting_review" });
    expect(t.retries()).toBe(1);
    expect(t.gpt.calls).toBe(2);
  });

  it("chyba sondy = dál čeká (fail-closed), nic se nespouští", async () => {
    const t = setup(SLEEP, () => {
      throw new Error("osascript timeout");
    });
    await t.orch.tick();
    expect(await t.orch.tick()).toMatchObject({ status: "waiting_display" });
    expect(t.retries()).toBe(0);
    expect(t.gpt.calls).toBe(1);
  });

  it("spí → porucha sondy → spí: tick nese aktuální důvod a log zachytí každou změnu příčiny", async () => {
    let state: { awake: boolean; reason: string } = {
      awake: false,
      reason: "displej spí",
    };
    const t = setup(SLEEP, () => state);
    await t.orch.tick();
    const log0 = t.store.readLog(500).length;
    expect(await t.orch.tick()).toMatchObject({
      status: "waiting_display",
      reason: "displej spí",
    });
    state = { awake: false, reason: "sonda displeje: osascript selhal" };
    expect(await t.orch.tick()).toMatchObject({
      status: "waiting_display",
      reason: "sonda selhala: sonda displeje: osascript selhal",
    });
    expect(await t.orch.tick()).toMatchObject({ status: "waiting_display" });
    state = { awake: false, reason: "displej spí" };
    await t.orch.tick();
    const waits = t.store
      .readLog(500)
      .slice(log0)
      .filter((e) => e.result?.startsWith("čeká na displej"))
      .map((e) => e.result);
    expect(waits).toEqual([
      "čeká na displej: displej spí",
      "čeká na displej: sonda selhala: sonda displeje: osascript selhal",
      "čeká na displej: displej spí",
    ]);
    expect(t.retries()).toBe(0);
  });

  it("výjimka sondy: obecná zpráva bez detailů výjimky, retry zablokovaný, po probuzení jeden retry", async () => {
    let boom = true;
    const t = setup(SLEEP, () => {
      if (boom) throw new Error("tajná cesta /Users/x osascript timeout");
      return { awake: true, reason: "x" };
    });
    await t.orch.tick();
    const r = await t.orch.tick();
    expect(r).toMatchObject({
      status: "waiting_display",
      reason: "sonda selhala: výjimka sondy",
    });
    expect(JSON.stringify(t.store.readLog(500))).not.toContain("tajná cesta");
    expect(t.retries()).toBe(0);
    boom = false;
    expect(await t.orch.tick()).toMatchObject({ status: "waiting_review" });
    expect(t.retries()).toBe(1);
  });

  it("jiný důvod čekání: beze změny, retry jednou za tick i při spící sondě", async () => {
    const t = setup(OTHER, () => ({ awake: false, reason: "displej spí" }));
    await t.orch.tick();
    expect(await t.orch.tick()).toMatchObject({ status: "waiting_review" });
    expect(t.retries()).toBe(1);
    expect(t.gpt.calls).toBe(2);
  });
});
