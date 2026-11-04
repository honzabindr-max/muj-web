// DR-039, etapa 3 — fixes after Codex review kolo 2 (PR #97): each test reproduces one reported scenario.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { EffectJournal, operationId } from "../effects";
import { NotionRestError } from "../notion";
import {
  fetchedProperties,
  HybridPanelSink,
  McpPanelLookup,
  PANEL_DATA_SOURCE_ID,
  PanelIndex,
  PanelRowDuplicate,
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

let dir: string;
let store: Store;
let notion: FileNotion;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-rev2-"));
  store = new Store(dir);
  notion = new FileNotion(path.join(dir, "notion.jsonl"));
});

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

/** In-memory panel: rows by page id, counts creates. */
class Sink implements PanelSink {
  rows = new Map<string, PanelRow>();
  creates = 0;
  async upsert(row: PanelRow, existing?: string): Promise<string> {
    const id = existing ?? `row-${this.creates + 1}`;
    if (!existing) this.creates++;
    this.rows.set(id, row);
    return id;
  }
  async findRowByOrderId(orderId: string): Promise<string | undefined> {
    return [...this.rows.entries()].find(
      ([, r]) => r["ID zakázky"] === orderId,
    )?.[0];
  }
}

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};
const until = async (cond: () => boolean) => {
  for (let i = 0; i < 200 && !cond(); i++)
    await new Promise((r) => setTimeout(r, 1));
  expect(cond()).toBe(true);
};
/** The first step of every tick (`catchUpPanel`); the rest of a tick of a FAILED order would plan a new one. */
const catchUp = (o: unknown) =>
  (o as { catchUpPanel(): Promise<void> }).catchUpPanel();

describe("nález 1 [medium]: a late answer of an earlier-sent write never clears the dirty mark", () => {
  it("A sends WAITING_OWNER, B (REJECT) writes FAILED with a late answer, A overwrites and marks dirty, B's late answer arrives: dirty stays, the next tick writes FAILED", async () => {
    waiting();
    const sink = new Sink();
    const index = new PanelIndex(dir);
    const o = makeOrch(store, notion, { panel: { sink, index } });
    await o.resyncPanel(ORDER_ID); // row-1 exists, WAITING_OWNER
    index.markDirty(ORDER_ID); // an earlier update failed: the catch-up A runs
    const cli = makeOrch(store, notion, {
      panel: { sink, index: new PanelIndex(dir) },
    });

    const a = deferred(); // A's request reaches Notion when released
    const b = deferred(); // B's answer arrives when released (its write is applied at once)
    let aSent = false;
    let bSent = false;
    const real = sink.upsert.bind(sink);
    sink.upsert = async (row, existing) => {
      if (!aSent && row.Stav === "WAITING_OWNER") {
        aSent = true;
        await a.promise;
        return real(row, existing); // A overwrites the panel with the older state, then answers
      }
      if (!bSent && row.Stav === "FAILED") {
        bSent = true;
        const id = await real(row, existing); // B writes FAILED to the panel …
        await b.promise; // … but its answer is late
        return id;
      }
      return real(row, existing);
    };

    // Merge PR #99 + etapa 3: zápisy řádku jedné zakázky běží pod zámkem panelu `.panel.lock` (PR #99, kolo oprav 5).
    // B se proto nemůže odeslat, dokud A drží zámek: souběh „B zapíše dřív, odpoví pozdě“ už nenastane. Ověřuje se
    // serializace a stejný konec: řádek FAILED, značka dirty smazaná jen zápisem odeslaným po ní, jediný řádek.
    // 1) A sends WAITING_OWNER (holds the panel lock)
    const pA = catchUp(o);
    await until(() => aSent);
    // 2) the owner's REJECT (CLI): FAILED saved locally; B waits for the panel lock, nothing sent yet
    cli.owner(ORDER_ID, "REJECT");
    expect(store.load(ORDER_ID).state).toBe("FAILED");
    await new Promise((r) => setTimeout(r, 100));
    expect(bSent).toBe(false);
    expect(sink.rows.get("row-1")!.Stav).toBe("WAITING_OWNER");
    // 3) A lands WAITING_OWNER, sees the newer state.json and marks dirty
    a.resolve();
    await pA;
    expect(index.isDirty(ORDER_ID)).toBe(true);
    // 4) B gets the lock only now: sent after the mark, it writes FAILED and may clear it
    await until(() => bSent);
    expect(sink.rows.get("row-1")!.Stav).toBe("FAILED");
    b.resolve();
    await cli.flushPanel();
    expect(index.isDirty(ORDER_ID)).toBe(false);

    // next tick: nothing to catch up, the row stays FAILED, still one row
    await catchUp(o);
    expect(sink.rows.get("row-1")!.Stav).toBe("FAILED");
    expect(index.isDirty(ORDER_ID)).toBe(false);
    expect(sink.creates).toBe(1);
  });

  it("PanelIndex: the sequence follows send order; only a write sent after the mark may clear it", () => {
    const index = new PanelIndex(dir);
    const s1 = index.beginWrite("x");
    const s2 = index.beginWrite("x");
    expect(s2).toBe(s1 + 1);
    index.markDirty("x"); // marked after s1 and s2 were sent
    expect(index.clearDirty("x", s1)).toBe(false);
    expect(index.clearDirty("x", s2)).toBe(false);
    expect(index.isDirty("x")).toBe(true);
    const s3 = index.beginWrite("x");
    expect(index.clearDirty("x", s3)).toBe(true);
    expect(index.isDirty("x")).toBe(false);
    index.markDirty("y");
    expect(index.clearDirty("y")).toBe(true); // unconditional clear (order gone / HOLD)
    expect(index.dirtyOrders()).toEqual([]);
  });

  it("the plain case still works: one write after a failure clears the mark", async () => {
    waiting();
    const sink = new Sink();
    const index = new PanelIndex(dir);
    const o = makeOrch(store, notion, { panel: { sink, index } });
    index.markDirty(ORDER_ID);
    await catchUp(o);
    expect(index.isDirty(ORDER_ID)).toBe(false);
    expect(sink.creates).toBe(1);
  });
});

describe("nález 2 [medium]: a new row while REST does not see the panel (404) and the MCP fallback works", () => {
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

  it("(a) REST 404, a new row (nothing PREPARED) → created exactly once through the MCP sink, the lagging MCP search is not asked (review kolo 3)", async () => {
    waiting();
    const mcp = new Sink();
    let lookups = 0;
    const sink = new HybridPanelSink(rest404, mcp, () => undefined, {
      find: async (id) => {
        lookups++;
        return mcp.findRowByOrderId(id);
      },
    });
    const index = new PanelIndex(dir);
    const o = makeOrch(store, notion, { panel: { sink, index } });
    await o.resyncPanel(ORDER_ID);
    expect(lookups).toBe(0);
    expect(mcp.creates).toBe(1);
    expect(index.get(ORDER_ID)).toBe("row-1");
    expect(index.isDirty(ORDER_ID)).toBe(false);
    await o.resyncPanel(ORDER_ID); // known page id: update, no lookup, no create
    await o.tick();
    expect(mcp.creates).toBe(1);
    expect(mcp.rows.size).toBe(1);
  });

  it("(b) REST 404 + PREPARED create + MCP lookup fails → no create, the row stays dirty (also on the next tick)", async () => {
    waiting();
    new EffectJournal(dir).prepare(operationId(ORDER_ID, "panel-row", 0)); // review kolo 3: only then is the lookup asked
    const mcp = new Sink();
    const sink = new HybridPanelSink(rest404, mcp, () => undefined, {
      find: async () => {
        throw new Error(
          "panel lookup (MCP): search result unreadable, cannot tell",
        );
      },
    });
    const index = new PanelIndex(dir);
    const o = makeOrch(store, notion, { panel: { sink, index } });
    await o.resyncPanel(ORDER_ID);
    expect(mcp.creates).toBe(0);
    expect(index.isDirty(ORDER_ID)).toBe(true);
    await catchUp(o);
    expect(mcp.creates).toBe(0);
    expect(index.isDirty(ORDER_ID)).toBe(true);
  });

  it("the MCP lookup finds the row created earlier → no second create, page id recovered", async () => {
    waiting();
    new EffectJournal(dir).prepare(operationId(ORDER_ID, "panel-row", 0)); // the earlier create of unclear outcome
    const mcp = new Sink();
    await mcp.upsert({
      "ID zakázky": ORDER_ID,
      Stav: "WAITING_OWNER",
    } as PanelRow);
    const sink = new HybridPanelSink(rest404, mcp, () => undefined, {
      find: (id) => mcp.findRowByOrderId(id),
    });
    const index = new PanelIndex(dir);
    index.markDirty(ORDER_ID);
    await catchUp(makeOrch(store, notion, { panel: { sink, index } }));
    expect(mcp.creates).toBe(1);
    expect(index.get(ORDER_ID)).toBe("row-1");
    expect(index.isDirty(ORDER_ID)).toBe(false);
  });

  it("HybridPanelSink: a REST error that is not fallback-eligible (400) or no MCP lookup → the REST error stands", async () => {
    const lookup = { find: async () => "y" };
    const bad: PanelSink = {
      upsert: async () => "x",
      findRowByOrderId: async () => {
        throw new NotionRestError(400, "validation_error");
      },
    };
    await expect(
      new HybridPanelSink(
        bad,
        new Sink(),
        () => undefined,
        lookup,
      ).findRowByOrderId("wo-1"),
    ).rejects.toBeInstanceOf(NotionRestError);
    await expect(
      new HybridPanelSink(
        rest404,
        new Sink(),
        () => undefined,
      ).findRowByOrderId("wo-1"),
    ).rejects.toBeInstanceOf(NotionRestError);
    const logs: string[] = [];
    expect(
      await new HybridPanelSink(
        rest404,
        new Sink(),
        (m) => logs.push(m),
        lookup,
      ).findRowByOrderId("wo-1"),
    ).toBe("y");
    expect(logs).toEqual([
      "Notion REST: notion REST 404 object_not_found, dohledávám řádek přes fallback",
    ]);
  });
});

describe("McpPanelLookup: the code decides from the transported tool calls, never the model", () => {
  const PAGE = "40c0ae49f50781478d39cb7afe452e59";
  const PAGE_DASHED = "40c0ae49-f507-8147-8d39-cb7afe452e59";
  const COLLECTION = `collection://${PANEL_DATA_SOURCE_ID}`;
  const searchInput = (q: string) => ({
    query: q,
    data_source_url: COLLECTION,
    page_size: 25,
  });
  const fetchText = (orderId: string, ds = COLLECTION) =>
    JSON.stringify({
      metadata: { type: "page" },
      text: `<page url="x">\n<ancestor-path>\n<parent-data-source url="${ds}" name="TARS — Zakázky"/>\n</ancestor-path>\n<properties>\n${JSON.stringify({ "ID zakázky": orderId, Stav: "DOING" })}\n</properties>\n</page>`,
    });
  type Call = { name: string; input: unknown; text: string };
  const stream = (calls: Call[]) =>
    calls
      .flatMap((c, i) => [
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", id: `t${i}`, name: c.name, input: c.input },
            ],
          },
        }),
        JSON.stringify({
          type: "user",
          message: {
            content: [
              {
                type: "tool_result",
                tool_use_id: `t${i}`,
                content: [{ type: "text", text: c.text }],
              },
            ],
          },
        }),
      ])
      .join("\n");
  async function withFakeClaude<T>(
    calls: Call[],
    fn: () => Promise<T>,
  ): Promise<T> {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), "fake-claude-lookup-"));
    fs.writeFileSync(path.join(bin, "out.jsonl"), stream(calls) + "\n");
    fs.writeFileSync(
      path.join(bin, "claude"),
      `#!/bin/bash\ncat > /dev/null\ncat "${path.join(bin, "out.jsonl")}"\n`,
      { mode: 0o755 },
    );
    const old = process.env.PATH;
    process.env.PATH = `${bin}:${old}`;
    try {
      return await fn();
    } finally {
      process.env.PATH = old;
    }
  }
  const SEARCH = "mcp__claude_ai_Notion__notion-search";
  const FETCH = "mcp__claude_ai_Notion__notion-fetch";
  const hit = (orderId: string) => ({
    id: PAGE_DASHED,
    title: `Nová zakázka ${orderId}`,
    parent_data_source_url: COLLECTION,
  });

  it("search + fetch with an exact „ID zakázky“ → the page id", async () => {
    const r = await withFakeClaude(
      [
        {
          name: SEARCH,
          input: searchInput("wo-1"),
          text: JSON.stringify({
            results: [hit("wo-1")],
            type: "workspace_search",
          }),
        },
        { name: FETCH, input: { id: PAGE_DASHED }, text: fetchText("wo-1") },
      ],
      () => new McpPanelLookup(dir).find("wo-1"),
    );
    expect(r).toBe(PAGE);
  });

  it("empty, complete search result → nothing found (undefined; HybridPanelSink never reads it as absence, review kolo 3)", async () => {
    const r = await withFakeClaude(
      [
        {
          name: SEARCH,
          input: searchInput("wo-1"),
          text: JSON.stringify({ results: [], type: "workspace_search" }),
        },
      ],
      () => new McpPanelLookup(dir).find("wo-1"),
    );
    expect(r).toBeUndefined();
  });

  it("a candidate whose „ID zakázky“ only contains the id (wo-10 for wo-1) is not a hit", async () => {
    const r = await withFakeClaude(
      [
        {
          name: SEARCH,
          input: searchInput("wo-1"),
          text: JSON.stringify({ results: [hit("wo-10")] }),
        },
        { name: FETCH, input: { id: PAGE_DASHED }, text: fetchText("wo-10") },
      ],
      () => new McpPanelLookup(dir).find("wo-1"),
    );
    expect(r).toBeUndefined();
  });

  it("anything unclear throws (never „does not exist“): no search, changed input, unreadable result, unfetched candidate, full page", async () => {
    const cases: Call[][] = [
      [],
      [
        {
          name: SEARCH,
          input: { query: "wo-1" },
          text: JSON.stringify({ results: [] }),
        },
      ],
      [
        {
          name: SEARCH,
          input: searchInput("wo-1"),
          text: "Error: unauthorized",
        },
      ],
      [
        {
          name: SEARCH,
          input: searchInput("wo-1"),
          text: JSON.stringify({ results: [hit("wo-1")] }),
        },
      ],
      [
        {
          name: SEARCH,
          input: searchInput("wo-1"),
          text: JSON.stringify({ results: [hit("wo-1")] }),
        },
        {
          name: FETCH,
          input: { id: PAGE_DASHED },
          text: "page without properties",
        },
      ],
      [
        {
          name: SEARCH,
          input: searchInput("wo-1"),
          text: JSON.stringify({
            results: Array.from({ length: 25 }, () => hit("wo-x")),
          }),
        },
      ],
      [
        {
          name: SEARCH,
          input: searchInput("wo-1"),
          text: JSON.stringify({ results: [] }),
        },
        {
          name: SEARCH,
          input: searchInput("wo-1"),
          text: JSON.stringify({ results: [] }),
        },
      ],
    ];
    for (const calls of cases) {
      await expect(
        withFakeClaude(calls, () => new McpPanelLookup(dir).find("wo-1")),
      ).rejects.toThrow();
    }
  }, 30_000); // seven fake claude processes

  it("opravný PR „panel“, kolo 2: two rows of the order with `unique` → PanelRowDuplicate (never the first one); without it the first", async () => {
    const PAGE2_DASHED = "40c0ae49-f507-8147-8d39-cb7afe452e5a";
    const calls: Call[] = [
      {
        name: SEARCH,
        input: searchInput("wo-1"),
        text: JSON.stringify({
          results: [hit("wo-1"), { ...hit("wo-1"), id: PAGE2_DASHED }],
        }),
      },
      { name: FETCH, input: { id: PAGE_DASHED }, text: fetchText("wo-1") },
      { name: FETCH, input: { id: PAGE2_DASHED }, text: fetchText("wo-1") },
    ];
    await expect(
      withFakeClaude(calls, () =>
        new McpPanelLookup(dir).find("wo-1", { unique: true }),
      ),
    ).rejects.toBeInstanceOf(PanelRowDuplicate);
    expect(
      await withFakeClaude(calls, () => new McpPanelLookup(dir).find("wo-1")),
    ).toBe(PAGE);
  });

  it("fetchedProperties reads the connector's JSON answer and bare markdown", () => {
    expect(fetchedProperties(fetchText("wo-1"))).toMatchObject({
      "ID zakázky": "wo-1",
    });
    expect(
      fetchedProperties(`<properties>\n{"ID zakázky":"wo-2"}\n</properties>`),
    ).toEqual({ "ID zakázky": "wo-2" });
    expect(fetchedProperties("nothing")).toBeUndefined();
  });
});
