// State machine + orchestrator tests with mock adapters. No model is ever called.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import type { AdapterResult, TextAdapter } from "../adapters";
import { looksLikeLimit } from "../adapters";
import { CopyDepartment, copyDeterministicIssues, parseVerdict } from "../departments";
import { parseGuardOutput } from "../guard";
import type { NotionClient } from "../notion";
import { extractNotionUrl } from "../notion";
import { assertFamilies, Orchestrator, SecretScanningAdapter } from "../orchestrator";
import { scanSecrets } from "../secret-scan";
import { MAX_FIX_ROUNDS, transition, TransitionError } from "../state-machine";
import { Store } from "../store";
import { parseBrief, reservedDecisionHits } from "../supervisor";
import type { ModelFamily, Order } from "../types";

const NOW = "2026-11-02T12:00:00.000Z";

function blank(state: Order["state"] = "NEW"): Order {
  return { id: "wo-test", mission: "m", state, created_at: NOW, updated_at: NOW, fix_rounds: 0, manual_interventions: 0, history: [], meta: {} };
}

// ─── mocks ───
type Reply = Partial<AdapterResult> | ((prompt: string) => Partial<AdapterResult>);
class MockAdapter implements TextAdapter {
  calls: string[] = [];
  constructor(public family: ModelFamily, public model: string, private replies: Reply[]) {}
  name = "mock";
  async run(prompt: string): Promise<AdapterResult> {
    this.calls.push(prompt);
    const r = this.replies.length > 1 ? this.replies.shift()! : this.replies[0];
    const v = typeof r === "function" ? r(prompt) : r;
    return { ok: true, text: "", limit: false, duration_ms: 5, ...v };
  }
}
class MockNotion implements NotionClient {
  pages: Array<{ title: string; md: string }> = [];
  async createPage(_p: string, title: string, md: string) {
    this.pages.push({ title, md });
    return { url: `https://app.notion.com/p/mock${this.pages.length}` };
  }
}

const BRIEF = (extra: Record<string, unknown> = {}) =>
  "```json\n" +
  JSON.stringify({
    title: "Návrh mikrocopy formuláře",
    department: "copy",
    milestone: "3.1",
    why: "DALŠÍ KROK: paralelně běží 3.1",
    goal: "Navrhnout texty chybových stavů",
    inputs: ["fakt A"],
    acceptance: ["kritérium 1"],
    owner_decisions: [],
    ...extra,
  }) +
  "\n```";
const DRAFT = `# Draft\n\n${"Tichý, sebejistý text. ".repeat(30)}\n\n## Kontrola kritérií\n- ok`;
const PASS = "```json\n{\"verdict\":\"PASS\",\"issues\":[]}\n```";
const FIX = "```json\n{\"verdict\":\"FIX\",\"issues\":[\"zkrátit úvod\"]}\n```";
const BLOCK = "```json\n{\"verdict\":\"BLOCK\",\"issues\":[\"rozhoduje cenu\"]}\n```";

let dir: string;
let store: Store;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-orch-"));
  store = new Store(dir);
});

function orch(opts: { supervisor?: Reply[]; creator?: Reply[]; checker?: Reply[]; alarm?: boolean; now?: () => Date } = {}) {
  const supervisor = new MockAdapter("claude", "opus", opts.supervisor ?? [{ text: BRIEF() }]);
  const creator = new MockAdapter("gpt", "gpt", opts.creator ?? [{ text: DRAFT }]);
  const checker = new MockAdapter("claude", "opus", opts.checker ?? [{ text: PASS }]);
  const notion = new MockNotion();
  const copy = new CopyDepartment(new SecretScanningAdapter(creator), checker);
  const o = new Orchestrator({
    store,
    supervisor,
    departments: { copy, dev: copy },
    notion,
    guard: () => ({ alarm: Boolean(opts.alarm), summary: opts.alarm ? "TARS-GUARD ALARM" : "TARS-GUARD OK (7/7)" }),
    draftParentId: "parent",
    repoRoot: dir,
    capsulePath: path.join(dir, "capsule.md"),
    now: opts.now,
  });
  return { o, supervisor, creator, checker, notion };
}

// ─── state machine ───
describe("state machine", () => {
  it("happy path NEW → DONE", () => {
    let o = blank();
    for (const ev of [{ type: "planned" }, { type: "start" }, { type: "created" }, { type: "verdict", verdict: "PASS" }, { type: "delivered", owner_needed: false }] as const)
      o = transition(o, ev, NOW);
    expect(o.state).toBe("DONE");
    expect(o.history.map((h) => h.to)).toEqual(["PLANNED", "DOING", "CHECKING", "DELIVERED", "DONE"]);
  });

  it("owner gate: DELIVERED → WAITING_OWNER → DONE / FAILED", () => {
    const d = transition(blank("DELIVERED"), { type: "delivered", owner_needed: true }, NOW);
    expect(d.state).toBe("WAITING_OWNER");
    expect(transition(d, { type: "owner", decision: "GO" }, NOW).state).toBe("DONE");
    expect(transition(d, { type: "owner", decision: "REJECT" }, NOW).state).toBe("FAILED");
  });

  it(`FIXING at most ${MAX_FIX_ROUNDS} rounds, then FAILED`, () => {
    let o = blank("CHECKING");
    for (let i = 0; i < MAX_FIX_ROUNDS; i++) {
      o = transition(o, { type: "verdict", verdict: "FIX", issues: ["x"] }, NOW);
      expect(o.state).toBe("FIXING");
      o = transition(o, { type: "revised" }, NOW);
    }
    o = transition(o, { type: "verdict", verdict: "FIX", issues: ["x"] }, NOW);
    expect(o.state).toBe("FAILED");
    expect(o.fix_rounds).toBe(MAX_FIX_ROUNDS);
  });

  it("BLOCK → FAILED with reason", () => {
    const o = transition(blank("CHECKING"), { type: "verdict", verdict: "BLOCK", issues: ["cena"] }, NOW);
    expect(o.state).toBe("FAILED");
    expect(o.failure_reason).toContain("cena");
  });

  it("PAUSED remembers and resumes the interrupted state", () => {
    const p = transition(blank("CHECKING"), { type: "limit", resume_after: NOW }, NOW);
    expect(p.state).toBe("PAUSED");
    const r = transition(p, { type: "resume" }, NOW);
    expect(r.state).toBe("CHECKING");
    expect(r.paused_from).toBeUndefined();
  });

  it("rejects illegal transitions and never mutates input", () => {
    const o = blank("NEW");
    expect(() => transition(o, { type: "created" }, NOW)).toThrow(TransitionError);
    expect(() => transition(blank("DONE"), { type: "limit", resume_after: NOW }, NOW)).toThrow(TransitionError);
    expect(() => transition(blank("WAITING_OWNER"), { type: "fail", reason: "x" }, NOW)).toThrow(TransitionError);
    transition(o, { type: "planned" }, NOW);
    expect(o.state).toBe("NEW");
  });

  it("UNKNOWN is terminal", () => {
    const u = transition(blank("NEW"), { type: "unknown", reason: "?" }, NOW);
    expect(() => transition(u, { type: "resume" }, NOW)).toThrow(TransitionError);
  });
});

// ─── orchestrator with mock adapters ───
describe("orchestrator (mock adapters)", () => {
  it("runs one order NEW → DONE with 0 manual interventions and logs every transition", async () => {
    const { o, notion } = orch();
    const r = await o.tick();
    expect(r).toMatchObject({ status: "advanced", state: "DONE" });
    const [order] = store.listOrders();
    expect(order.manual_interventions).toBe(0);
    expect(order.delivered_url).toBe("https://app.notion.com/p/mock1");
    expect(notion.pages[0].title).toMatch(/^DRAFT — /);
    const tr = store.readLog(100).filter((e) => e.kind === "transition").map((e) => e.to);
    expect(tr).toEqual(["PLANNED", "DOING", "CHECKING", "DELIVERED", "DONE"]);
  });

  it("owner-reserved decision → WAITING_OWNER with GO/REJECT card, then WIP limit", async () => {
    const { o, notion, supervisor } = orch({ supervisor: [{ text: BRIEF({ owner_decisions: ["cena"] }) }] });
    expect((await o.tick()).status).toBe("waiting_owner");
    expect(notion.pages.map((p) => p.title.split(" — ")[0])).toEqual(["DRAFT", "KARTA GO/REJECT"]);
    expect(notion.pages[1].md).toContain("GO");
    expect((await o.tick()).status).toBe("waiting_owner"); // no new order while card is open
    expect(supervisor.calls).toHaveLength(1);
    const [w] = store.listOrders();
    expect(o.owner(w.id, "GO").state).toBe("DONE");
  });

  it("FIX twice then PASS → creator revises with checker issues", async () => {
    const { o, creator } = orch({ checker: [{ text: FIX }, { text: FIX }, { text: PASS }] });
    expect(await o.tick()).toMatchObject({ state: "DONE" });
    expect(store.listOrders()[0].fix_rounds).toBe(2);
    expect(creator.calls).toHaveLength(3);
    expect(creator.calls[1]).toContain("zkrátit úvod");
  });

  it("FIX forever → FAILED after 3 rounds", async () => {
    const { o } = orch({ checker: [{ text: FIX }] });
    expect(await o.tick()).toMatchObject({ state: "FAILED" });
    expect(store.listOrders()[0].fix_rounds).toBe(3);
  });

  it("checker BLOCK → FAILED, nothing delivered", async () => {
    const { o, notion } = orch({ checker: [{ text: BLOCK }] });
    expect(await o.tick()).toMatchObject({ state: "FAILED" });
    expect(notion.pages).toHaveLength(0);
  });

  it("subscription limit → PAUSED, waits, then resumes and finishes", async () => {
    let t = new Date(NOW).getTime();
    const { o } = orch({ now: () => new Date(t), creator: [{ ok: false, limit: true, error: "usage limit" }, { text: DRAFT }] });
    const r1 = await o.tick();
    expect(r1.status).toBe("paused");
    expect(store.listOrders()[0].paused_from).toBe("DOING");
    t += 10 * 60_000;
    expect((await o.tick()).status).toBe("paused"); // too early
    t += 60 * 60_000;
    expect(await o.tick()).toMatchObject({ state: "DONE" });
  });

  it("TARS-GUARD ALARM stops before any model call", async () => {
    const { o, supervisor } = orch({ alarm: true });
    expect((await o.tick()).status).toBe("guard_alarm");
    expect(supervisor.calls).toHaveLength(0);
    expect(store.listOrders()).toHaveLength(0);
  });

  it("secret in creator output is dropped, never stored → FAILED", async () => {
    const leak = DRAFT + "\nghp_" + "a".repeat(36);
    const { o, notion } = orch({ creator: [{ text: leak }] });
    expect(await o.tick()).toMatchObject({ state: "FAILED" });
    expect(notion.pages).toHaveLength(0);
    const files = fs.readdirSync(path.join(dir, store.listOrders()[0].id));
    expect(files).not.toContain("draft-v0.md");
    expect(fs.readFileSync(path.join(dir, "log.jsonl"), "utf8")).not.toContain("ghp_");
  });

  it("invalid supervisor brief twice → UNKNOWN", async () => {
    const { o } = orch({ supervisor: [{ text: "nevím" }] });
    expect(await o.tick()).toMatchObject({ state: "UNKNOWN" });
  });

  it("deterministic check failure skips the model checker", async () => {
    const { o, checker } = orch({ creator: [{ text: "# krátké" }, { text: DRAFT }] });
    expect(await o.tick()).toMatchObject({ state: "DONE" });
    expect(checker.calls).toHaveLength(1);
  });

  it("refuses departments where creator and checker share a family", () => {
    const a = new MockAdapter("claude", "x", [{}]);
    expect(() => assertFamilies({ copy: new CopyDepartment(a, a) })).toThrow(/tvůrce ≠ kontrolor/);
  });
});

// ─── parsers and scanners ───
describe("parsers", () => {
  it("parseBrief validates department and required fields", () => {
    expect(parseBrief(BRIEF()).department).toBe("copy");
    expect(() => parseBrief(BRIEF({ department: "marketing" }))).toThrow();
    expect(() => parseBrief(BRIEF({ acceptance: [] }))).toThrow();
  });
  it("parseVerdict requires issues for FIX/BLOCK", () => {
    expect(parseVerdict(PASS)?.verdict).toBe("PASS");
    expect(parseVerdict("```json\n{\"verdict\":\"FIX\",\"issues\":[]}\n```")).toBeUndefined();
    expect(parseVerdict("hmm")).toBeUndefined();
  });
  it("secret scan names kinds only", () => {
    expect(scanSecrets("ok text").clean).toBe(true);
    expect(scanSecrets("x ghp_" + "b".repeat(36)).kinds).toEqual(["github_token"]);
    expect(scanSecrets("postgres://u:" + "p".repeat(8) + "@h/db").clean).toBe(false);
  });
  it("limit detection", () => {
    expect(looksLikeLimit("Claude usage limit reached. Resets at 3pm")).toBe(true);
    expect(looksLikeLimit("syntax error")).toBe(false);
  });
  it("guard parsing", () => {
    expect(parseGuardOutput("TARS-GUARD OK (7/7): I1").alarm).toBe(false);
    expect(parseGuardOutput("TARS-GUARD ALARM – x").alarm).toBe(true);
    expect(parseGuardOutput("").alarm).toBe(true);
  });
  it("reserved decisions and helpers", () => {
    expect(reservedDecisionHits("Nová cena 2 490 Kč")).toContain("cena");
    expect(reservedDecisionHits("Mikrocopy chybových stavů formuláře")).toEqual([]);
    expect(copyDeterministicIssues("# x")).toHaveLength(1);
    expect(extractNotionUrl("hotovo: https://app.notion.com/p/abc123 .")).toBe("https://app.notion.com/p/abc123");
  });
});
