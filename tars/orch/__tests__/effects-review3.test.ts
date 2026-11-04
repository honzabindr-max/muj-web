// DR-039, etapa 3 — fixes after Codex review kolo 3 (PR #97): each test reproduces one reported scenario.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { EffectJournal, operationId } from "../effects";
import { NotionRestError } from "../notion";
import {
  HybridPanelSink,
  PanelIndex,
  PanelRowUnclear,
  type PanelRow,
  type PanelSink,
} from "../panel";
import { Store } from "../store";
import {
  FileNotion,
  makeOrch,
  ORDER_ID,
  seedDelivered,
} from "./effects-fixture";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const TSX = path.join(ROOT, "node_modules", "tsx", "dist", "loader.mjs");
const ROW_OP = operationId(ORDER_ID, "panel-row", 0);

let dir: string;
let store: Store;
let notion: FileNotion;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-rev3-"));
  store = new Store(dir);
  notion = new FileNotion(path.join(dir, "notion.jsonl"));
});

/** A child process doing `count` beginWrite calls on `orderId` (optionally one markDirty in the middle). */
function indexChild(
  orderId: string,
  count: number,
  startAt: number,
  mark = "",
): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const p = spawn(
      process.execPath,
      [
        "--import",
        TSX,
        path.join(__dirname, "panel-index-child.ts"),
        dir,
        orderId,
        String(count),
        String(startAt),
        mark,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) =>
      code === 0
        ? resolve(JSON.parse(out) as number[])
        : reject(new Error(`child exit ${code}: ${err}`)),
    );
  });
}

describe("nález 1 [medium]: read-modify-write of panel-index.json from two processes", () => {
  it("two processes updating the index at the same time: no update overwritten by an older snapshot", async () => {
    const N = 150;
    const startAt = Date.now() + 2500; // both children loaded (tsx) before the common start
    const [a, b, c] = await Promise.all([
      indexChild(ORDER_ID, N, startAt), // the same order from two processes …
      indexChild(ORDER_ID, N, startAt),
      indexChild("wo-other", N, startAt, "markDirty"), // … and another order, with a dirty mark, in a third one
    ]);
    const index = new PanelIndex(dir);
    // Every sequence number was handed out exactly once (a lost update would repeat one).
    const all = [...a, ...b].sort((x, y) => x - y);
    expect(all).toEqual(Array.from({ length: 2 * N }, (_, i) => i + 1));
    expect(c).toEqual(Array.from({ length: N }, (_, i) => i + 1));
    // The dirty mark set by the third process survived the other two processes' rewrites.
    expect(index.isDirty("wo-other")).toBe(true);
    expect(index.clearDirty("wo-other", Math.floor(N / 2) + 1)).toBe(false); // sent before the mark
    expect(index.clearDirty("wo-other", N)).toBe(true); // a write sent after it
    // Written atomically: no temporary file left behind, the file is whole JSON.
    expect(fs.readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([]);
    expect(() =>
      JSON.parse(fs.readFileSync(path.join(dir, "panel-index.json"), "utf8")),
    ).not.toThrow();
  }, 60_000);

  it("the index waits for the state lock: an update while another holder has .state.lock is applied after it", () => {
    const holder = new Store(dir);
    const index = new PanelIndex(dir); // its own Store: a different holder, like another process
    let inside = false;
    holder.withStateLock(() => {
      inside = true;
      expect(() => new PanelIndex(dir, new Store(dir)).beginWrite("x")).toThrow(
        /\.state\.lock/,
      ); // busy → HOLD after the wait (never a write without the lock)
    }, 5000);
    expect(inside).toBe(true);
    expect(index.beginWrite("x")).toBe(1); // the refused attempt wrote nothing
  }, 20_000);
});

/** REST integration without the panel shared: every request is 404. */
const rest404: PanelSink = {
  upsert: async () => {
    throw new NotionRestError(404, "object_not_found");
  },
  findRowByOrderId: async () => {
    throw new NotionRestError(404, "object_not_found");
  },
  readOwnerDecision: async () => {
    throw new NotionRestError(404, "object_not_found");
  },
};

/** In-memory MCP panel: rows by page id, counts creates. */
class McpSink implements PanelSink {
  rows = new Map<string, PanelRow>();
  creates = 0;
  async upsert(row: PanelRow, existing?: string): Promise<string> {
    const id = existing ?? `row-${this.creates + 1}`;
    if (!existing) this.creates++;
    this.rows.set(id, row);
    return id;
  }
}

function waiting() {
  seedDelivered(store);
  const s = store.load(ORDER_ID);
  store.save({
    ...s,
    state: "WAITING_OWNER",
    history: [
      {
        from: "DELIVERED",
        to: "WAITING_OWNER",
        event: "delivered",
        at: s.updated_at,
      },
    ],
  });
}

/** Hybrid sink over REST 404; the MCP search answers from `index` (a lagging search: `visible` rows only). */
function hybrid(mcp: McpSink, visible: () => string[]) {
  const counter = { lookups: 0 };
  const sink = new HybridPanelSink(rest404, mcp, () => undefined, {
    find: async (orderId) => {
      counter.lookups++;
      const ids = visible().filter(
        (id) => mcp.rows.get(id)?.["ID zakázky"] === orderId,
      );
      return ids.length === 1 ? ids[0] : undefined;
    },
  });
  return { sink, counter };
}

const logHas = (s: string) =>
  store
    .readLog(300)
    .some(
      (e) =>
        (typeof e.result === "string" && e.result.includes(s)) ||
        (typeof e.reason === "string" && e.reason.includes(s)),
    );

describe("nález 2 [high]: an empty MCP search is never „the row does not exist“", () => {
  it("case 1: a new row, nothing PREPARED in the journal → created without a lookup (REST 404)", async () => {
    waiting();
    const mcp = new McpSink();
    const { sink, counter } = hybrid(mcp, () => [...mcp.rows.keys()]);
    const index = new PanelIndex(dir, store);
    const o = makeOrch(store, notion, { panel: { sink, index } });
    await o.resyncPanel(ORDER_ID);
    expect(counter.lookups).toBe(0); // the lagging search is not asked at all
    expect(mcp.creates).toBe(1);
    expect(index.get(ORDER_ID)).toBe("row-1");
    expect(new EffectJournal(dir).get(ROW_OP)?.state).toBe("EFFECT_DONE");
    await o.resyncPanel(ORDER_ID); // known page id: update only
    expect(mcp.creates).toBe(1);
  });

  it("case 2: crash between the MCP create and the receipt, REST 404, search not indexed yet (results: []) → EFFECT_UNKNOWN / HOLD, no second create", async () => {
    waiting();
    const mcp = new McpSink();
    // The crashed process: PREPARED, then the row really was created through MCP, then the process died.
    new EffectJournal(dir).prepare(ROW_OP);
    await mcp.upsert({
      "ID zakázky": ORDER_ID,
      Stav: "WAITING_OWNER",
    } as PanelRow);
    const { sink, counter } = hybrid(mcp, () => []); // the search index does not show it yet
    const index = new PanelIndex(dir, store);
    index.markDirty(ORDER_ID);
    const o = makeOrch(store, notion, { panel: { sink, index } });
    await (o as unknown as { catchUpPanel(): Promise<void> }).catchUpPanel();
    expect(counter.lookups).toBe(1);
    expect(mcp.creates).toBe(1); // only the crashed one
    expect(new EffectJournal(dir).get(ROW_OP)?.state).toBe("EFFECT_UNKNOWN");
    expect(logHas("řádek panelu nejasný, ruční kontrola")).toBe(true);
    expect(logHas("EFFECT_UNKNOWN / HOLD")).toBe(true);
    // Later transitions look again, still never create.
    await o.resyncPanel(ORDER_ID);
    await o.resyncPanel(ORDER_ID);
    expect(mcp.creates).toBe(1);
    expect(index.get(ORDER_ID)).toBeUndefined();
  });

  it("case 3: PREPARED without a receipt, the MCP search finds exactly 1 row with the same id → receipt, no second create", async () => {
    waiting();
    const mcp = new McpSink();
    new EffectJournal(dir).prepare(ROW_OP);
    await mcp.upsert({
      "ID zakázky": ORDER_ID,
      Stav: "WAITING_OWNER",
    } as PanelRow);
    const { sink } = hybrid(mcp, () => [...mcp.rows.keys()]);
    const index = new PanelIndex(dir, store);
    index.markDirty(ORDER_ID);
    const o = makeOrch(store, notion, { panel: { sink, index } });
    await (o as unknown as { catchUpPanel(): Promise<void> }).catchUpPanel();
    expect(mcp.creates).toBe(1);
    const rec = new EffectJournal(dir).get(ROW_OP);
    expect(rec?.state).toBe("EFFECT_DONE");
    expect(rec?.receipt?.url).toContain("row-1");
    expect(index.get(ORDER_ID)).toBe("row-1");
    expect(index.isDirty(ORDER_ID)).toBe(false);
  });

  it("case 2 after the index caught up: the next transition finds the row and recovers the receipt", async () => {
    waiting();
    const mcp = new McpSink();
    new EffectJournal(dir).prepare(ROW_OP);
    await mcp.upsert({
      "ID zakázky": ORDER_ID,
      Stav: "WAITING_OWNER",
    } as PanelRow);
    let indexed = false;
    const { sink } = hybrid(mcp, () => (indexed ? [...mcp.rows.keys()] : []));
    const index = new PanelIndex(dir, store);
    const o = makeOrch(store, notion, { panel: { sink, index } });
    await o.resyncPanel(ORDER_ID);
    expect(new EffectJournal(dir).get(ROW_OP)?.state).toBe("EFFECT_UNKNOWN");
    indexed = true;
    await o.resyncPanel(ORDER_ID);
    expect(new EffectJournal(dir).get(ROW_OP)?.state).toBe("EFFECT_DONE");
    expect(index.get(ORDER_ID)).toBe("row-1");
    expect(mcp.creates).toBe(1);
  });

  it("HybridPanelSink: an empty MCP search throws PanelRowUnclear; consistentOnly never asks the search", async () => {
    let asked = 0;
    const sink = new HybridPanelSink(rest404, new McpSink(), () => undefined, {
      find: async () => {
        asked++;
        return undefined;
      },
    });
    await expect(sink.findRowByOrderId("wo-1")).rejects.toBeInstanceOf(
      PanelRowUnclear,
    );
    expect(asked).toBe(1);
    await expect(
      sink.findRowByOrderId("wo-1", { consistentOnly: true }),
    ).rejects.toBeInstanceOf(PanelRowUnclear);
    expect(asked).toBe(1);
    // A consistent REST answer „no row“ stays a real absence.
    const restEmpty: PanelSink = {
      upsert: async () => "x",
      findRowByOrderId: async () => undefined,
    };
    expect(
      await new HybridPanelSink(restEmpty, new McpSink(), () => undefined, {
        find: async () => "y",
      }).findRowByOrderId("wo-1"),
    ).toBeUndefined();
  });
});
