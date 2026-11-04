// DR-039, etapa 3 — fixes after Codex review kolo 1 (PR #97): each test reproduces one reported scenario.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  bodyCarriesMarker,
  EffectJournal,
  effectMarker,
  operationId,
  titleCarriesMarker,
  titleWithMarker,
} from "../effects";
import { NotionRestApi, NotionRestError, RestNotion } from "../notion";
import { OwnerPing } from "../owner-ping";
import { PanelIndex, type PanelRow, type PanelSink } from "../panel";
import { Store } from "../store";
import {
  FileNotion,
  makeOrch,
  ORDER_ID,
  PARENT,
  seedDelivered,
} from "./effects-fixture";

const DELIVER_OP = operationId(ORDER_ID, "deliver", 0);
const ROW_OP = operationId(ORDER_ID, "panel-row", 0);

let dir: string;
let store: Store;
let notion: FileNotion;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-rev1-"));
  store = new Store(dir);
  notion = new FileNotion(path.join(dir, "notion.jsonl"));
});
const journal = () => new EffectJournal(dir);

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

/** In-memory panel: rows by page id, counts creates and lookups. */
class Sink implements PanelSink {
  rows = new Map<string, PanelRow>();
  creates = 0;
  lookups = 0;
  async upsert(row: PanelRow, existing?: string): Promise<string> {
    const id = existing ?? `row-${this.creates + 1}`;
    if (!existing) this.creates++;
    this.rows.set(id, row);
    return id;
  }
  async findRowByOrderId(orderId: string): Promise<string | undefined> {
    this.lookups++;
    return [...this.rows.entries()].find(
      ([, r]) => r["ID zakázky"] === orderId,
    )?.[0];
  }
}

describe("nález 1 [high]: dirty row without a page id, crash between the create and panel.index.set", () => {
  it("journaled create (PREPARED, row saved, no receipt, no index id) → the next tick looks the row up by order id: one row, receipt recovered", async () => {
    waiting();
    const sink = new Sink();
    const index = new PanelIndex(dir);
    // state left by the crash: PREPARED in the journal, the row exists in Notion, the index knows nothing but „dirty“
    journal().prepare(ROW_OP);
    await sink.upsert({
      "ID zakázky": ORDER_ID,
      Stav: "WAITING_OWNER",
    } as PanelRow);
    index.markDirty(ORDER_ID);
    expect(index.isUncertain(ORDER_ID)).toBe(false);

    await makeOrch(store, notion, { panel: { sink, index } }).tick();
    expect(sink.creates).toBe(1);
    expect(sink.rows.size).toBe(1);
    expect(sink.lookups).toBeGreaterThan(0);
    expect(index.get(ORDER_ID)).toBe("row-1");
    expect(index.isDirty(ORDER_ID)).toBe(false);
    expect(journal().get(ROW_OP)).toMatchObject({
      state: "EFFECT_DONE",
      recovered: true,
      receipt: { url: "https://www.notion.so/row-1" },
    });
  });

  it("the exact review scenario (row created by a catch-up, no journal record, no uncertain mark) still finds the row: no second create", async () => {
    waiting();
    const sink = new Sink();
    const index = new PanelIndex(dir);
    await sink.upsert({
      "ID zakázky": ORDER_ID,
      Stav: "WAITING_OWNER",
    } as PanelRow);
    index.markDirty(ORDER_ID);
    const o = makeOrch(store, notion, { panel: { sink, index } });
    await o.tick();
    await o.tick();
    expect(sink.creates).toBe(1);
    expect(index.get(ORDER_ID)).toBe("row-1");
  });

  it("every create is journaled PREPARED before the write and EFFECT_DONE with the page id after it", async () => {
    waiting();
    const sink = new Sink();
    const seen: Array<string | undefined> = [];
    const real = sink.upsert.bind(sink);
    sink.upsert = async (row, existing) => {
      if (!existing) seen.push(journal().get(ROW_OP)?.state);
      return real(row, existing);
    };
    const o = makeOrch(store, notion, {
      panel: { sink, index: new PanelIndex(dir) },
    });
    await o.resyncPanel(ORDER_ID);
    expect(seen).toEqual(["PREPARED"]);
    expect(journal().get(ROW_OP)).toMatchObject({
      state: "EFFECT_DONE",
      receipt: { url: "https://www.notion.so/row-1" },
    });
  });

  it("a crash after the receipt, before panel.index.set: the receipt is reused, no lookup, no create", async () => {
    waiting();
    const sink = new Sink();
    sink.rows.set("0123456789abcdef0123456789abcdef", {
      "ID zakázky": ORDER_ID,
    } as PanelRow);
    sink.creates = 1;
    journal().prepare(ROW_OP);
    journal().done(ROW_OP, {
      url: "https://www.notion.so/0123456789abcdef0123456789abcdef",
    });
    const index = new PanelIndex(dir);
    index.markDirty(ORDER_ID);
    await makeOrch(store, notion, { panel: { sink, index } }).tick();
    expect(sink.lookups).toBe(0);
    expect(sink.creates).toBe(1);
    expect(index.get(ORDER_ID)).toBe("0123456789abcdef0123456789abcdef");
    expect(sink.rows.get("0123456789abcdef0123456789abcdef")!.Stav).toBe(
      "WAITING_OWNER",
    );
  });

  it("a lookup error never leads to a create; the row stays dirty for the next tick", async () => {
    waiting();
    const sink = new Sink();
    sink.findRowByOrderId = async () => {
      throw new NotionRestError(429, "rate_limited");
    };
    const index = new PanelIndex(dir);
    index.markDirty(ORDER_ID);
    await makeOrch(store, notion, { panel: { sink, index } }).tick();
    expect(sink.creates).toBe(0);
    expect(index.isDirty(ORDER_ID)).toBe(true);
  });
});

describe("nález 2 [high]: a title that only quotes another order's marker is never a hit", () => {
  const A = effectMarker("wo-a/deliver/r0");
  const B = effectMarker("wo-b/deliver/r0");

  it("titleCarriesMarker: exact token at the end only", () => {
    expect(
      titleCarriesMarker(titleWithMarker("DRAFT — x", "wo-a/deliver/r0"), A),
    ).toBe(true);
    expect(titleCarriesMarker(`DRAFT — cituje ${A} (wo-b) ${B}`, A)).toBe(
      false,
    );
    expect(titleCarriesMarker(`DRAFT — cituje ${A} (wo-b) ${B}`, B)).toBe(true);
    expect(titleCarriesMarker(`DRAFT — ${A} na konci něco`, A)).toBe(false);
    expect(titleCarriesMarker(`DRAFT x${A}`, A)).toBe(false); // tail of a longer token
    expect(titleCarriesMarker(`${A}  `, A)).toBe(true);
    expect(
      titleCarriesMarker(
        titleWithMarker("T", "wo-a/deliver/r10"),
        effectMarker("wo-a/deliver/r1"),
      ),
    ).toBe(false);
  });

  it("bodyCarriesMarker: the last `Operace TARS:` line, exact", () => {
    const own = `brief cituje ${A}\n\n---\nVytvořeno …\nOperace TARS: \`${B}\`\n**DRAFT**`;
    expect(bodyCarriesMarker(own, B)).toBe(true);
    expect(bodyCarriesMarker(own, A)).toBe(false);
    const quotedLine = `brief:\nOperace TARS: \`${A}\`\n---\nOperace TARS: \`${B}\`\n**DRAFT**`;
    expect(bodyCarriesMarker(quotedLine, A)).toBe(false);
    expect(bodyCarriesMarker(quotedLine, B)).toBe(true);
    expect(bodyCarriesMarker(`x ${A} y`, A)).toBe(false);
    expect(bodyCarriesMarker(`Operace TARS: \`${A}\`\r\n`, A)).toBe(true);
  });

  it("recovery of A after a crash before its create does NOT accept B's DRAFT that quotes A's marker: A writes its own page", async () => {
    seedDelivered(store);
    const b = notion.add(
      PARENT,
      `DRAFT — cituje ${effectMarker(DELIVER_OP)} (wo-b) ${effectMarker("wo-b/deliver/r0")}`,
    );
    journal().prepare(DELIVER_OP);
    const r = await makeOrch(store, notion).step(store.load(ORDER_ID));
    expect(notion.creates).toBe(1);
    expect(r.delivered_url).not.toBe(`https://www.notion.so/${b.id}`);
    expect(r.delivered_url).toBe(
      `https://www.notion.so/${notion.pages()[1].id}`,
    );
    expect(notion.pages()[1].title.endsWith(effectMarker(DELIVER_OP))).toBe(
      true,
    );
    expect(journal().get(DELIVER_OP)).toMatchObject({
      state: "EFFECT_DONE",
      attempts: 2,
    });
    expect(journal().get(DELIVER_OP)!.recovered).toBeUndefined();
  });

  it("RestNotion.findChildPagesByMarker skips a child page that only quotes the marker; two exact hits → HOLD", async () => {
    const id1 = "11111111-2222-3333-4444-555555555555";
    const id2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const child = (id: string, title: string) => ({
      object: "block",
      id,
      type: "child_page",
      child_page: { title },
    });
    const mk = (results: unknown[]) =>
      new RestNotion(
        new NotionRestApi("ntn_" + "t".repeat(40), (async () => ({
          ok: true,
          status: 200,
          json: async () => ({ results, has_more: false }),
        })) as never),
      );
    expect(
      await mk([child(id1, `DRAFT — cituje ${A} ${B}`)]).findChildPagesByMarker(
        "p",
        A,
      ),
    ).toEqual([]);
    expect(
      await mk([child(id1, `DRAFT — cituje ${A} ${B}`)]).findChildPagesByMarker(
        "p",
        B,
      ),
    ).toEqual([
      { url: "https://www.notion.so/11111111222233334444555555555555" },
    ]);
    const two = await mk([
      child(id1, `x ${A}`),
      child(id2, `y ${A}`),
    ]).findChildPagesByMarker("p", A);
    expect(two).toHaveLength(2); // lookupNotionMarker reports > 1 hit as uncertain (HOLD)
  });
});

describe("nález 3 [medium]: comment saved, answer undecodable → never sent twice", () => {
  it("OwnerPing: HTTP 200 with an undecodable body, any non-REST error → uncertain (not failed)", async () => {
    const api = (err: unknown) => ({
      request: async () => {
        throw err;
      },
    });
    expect(
      (
        await new OwnerPing(
          api(new NotionRestError(200, "bad_response")) as never,
        ).send("p", "T")
      ).outcome,
    ).toBe("uncertain");
    expect(
      (
        await new OwnerPing(
          api(new SyntaxError("Unexpected token")) as never,
        ).send("p", "T")
      ).outcome,
    ).toBe("uncertain");
    expect(
      (
        await new OwnerPing(
          api(new NotionRestError(408, "timeout")) as never,
        ).send("p", "T")
      ).outcome,
    ).toBe("uncertain");
    // a clean refusal still is „failed“ (nothing saved, retried later)
    expect(
      (
        await new OwnerPing(
          api(new NotionRestError(400, "validation_error")) as never,
        ).send("p", "T")
      ).outcome,
    ).toBe("failed");
    expect(
      (
        await new OwnerPing(
          api(new NotionRestError(403, "restricted")) as never,
        ).send("p", "T")
      ).outcome,
    ).toBe("no_permission");
  });

  it("real OwnerPing + journal: Notion stores the comment, the 200 answer cannot be decoded → EFFECT_UNKNOWN, later syncs and ticks send nothing", async () => {
    waiting();
    const comments: unknown[] = [];
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        comments.push(1); // saved by Notion …
        throw new SyntaxError("Unexpected end of JSON input"); // … the answer is unreadable
      },
    });
    const ping = new OwnerPing(
      new NotionRestApi("ntn_" + "t".repeat(40), fetchImpl as never),
    );
    const o = makeOrch(store, notion, {
      panel: { sink: new Sink(), index: new PanelIndex(dir) },
      ownerPing: ping,
    });
    await o.resyncPanel(ORDER_ID);
    await o.resyncPanel(ORDER_ID);
    await o.tick();
    await o.tick();
    expect(comments).toHaveLength(1);
    const op = operationId(ORDER_ID, "owner-ping", 1);
    expect(journal().get(op)).toMatchObject({
      state: "EFFECT_UNKNOWN",
      attempts: 1,
    });
    expect(store.load(ORDER_ID).meta.owner_ping).toBe("1");
    expect(
      store
        .readLog(200)
        .some(
          (e) => e.kind === "error" && e.result === `EFFECT_UNKNOWN: ${op}`,
        ),
    ).toBe(true);
  });

  it("an outcome the orchestrator does not know is EFFECT_UNKNOWN, never EFFECT_ABSENT", async () => {
    waiting();
    const send = vi.fn(async () => ({ outcome: "weird" as never }));
    const o = makeOrch(store, notion, {
      panel: { sink: new Sink(), index: new PanelIndex(dir) },
      ownerPing: { send },
    });
    await o.resyncPanel(ORDER_ID);
    await o.resyncPanel(ORDER_ID);
    expect(send).toHaveBeenCalledTimes(1);
    expect(journal().get(operationId(ORDER_ID, "owner-ping", 1))).toMatchObject(
      { state: "EFFECT_UNKNOWN" },
    );
  });
});

describe("nález 4 [medium]: a late catch-up write of an older state never wins over a concurrent REJECT", () => {
  /** The first step of every tick (`catchUpPanel`); the rest of a tick of a FAILED order would plan a new one. */
  const catchUp = (o: unknown) =>
    (o as { catchUpPanel(): Promise<void> }).catchUpPanel();
  it("catch-up writes WAITING_OWNER while the owner's REJECT (CLI) writes FAILED: dirty stays, the next tick writes FAILED", async () => {
    waiting();
    const sink = new Sink();
    const index = new PanelIndex(dir);
    const o = makeOrch(store, notion, { panel: { sink, index } });
    await o.resyncPanel(ORDER_ID); // row-1 exists, WAITING_OWNER
    index.markDirty(ORDER_ID); // an earlier update failed

    // the CLI process: its own Orchestrator over the same runs dir and the same panel
    const cli = makeOrch(store, notion, {
      panel: { sink, index: new PanelIndex(dir) },
    });
    const real = sink.upsert.bind(sink);
    let injected = false;
    sink.upsert = async (row, existing) => {
      if (!injected && row.Stav === "WAITING_OWNER") {
        injected = true;
        // while the catch-up write is in flight, the owner rejects; the CLI's row write is queued.
        // Merge PR #99 + etapa 3: it waits for the order's panel lock (`.panel.lock`) held by this write, so it can no
        // longer land first and be overwritten by the late older snapshot.
        cli.owner(ORDER_ID, "REJECT");
        await new Promise((r) => setTimeout(r, 100));
        expect(sink.rows.get("row-1")!.Stav).toBe("WAITING_OWNER"); // the CLI sent nothing yet
      }
      return real(row, existing);
    };

    await catchUp(o);
    expect(injected).toBe(true);
    expect(store.load(ORDER_ID).state).toBe("FAILED");
    expect(index.isDirty(ORDER_ID)).toBe(true); // the late write of the older snapshot keeps the mark
    await cli.flushPanel(); // the CLI's write runs after the lock is released: FAILED, sent after the mark
    expect(sink.rows.get("row-1")!.Stav).toBe("FAILED");
    expect(index.isDirty(ORDER_ID)).toBe(false);

    await catchUp(o); // next tick: nothing older wins
    expect(sink.rows.get("row-1")!.Stav).toBe("FAILED");
    expect(index.isDirty(ORDER_ID)).toBe(false);
    expect(sink.creates).toBe(1);
  });

  it("catch-up writes the state current when the write starts (not the one seen when it was queued)", async () => {
    waiting();
    const sink = new Sink();
    const index = new PanelIndex(dir);
    const o = makeOrch(store, notion, { panel: { sink, index } });
    await o.resyncPanel(ORDER_ID);
    index.markDirty(ORDER_ID);
    const p = catchUp(o);
    // state changes after the tick queued the catch-up, before the queued write runs
    makeOrch(store, notion).owner(ORDER_ID, "REJECT");
    await p;
    expect(sink.rows.get("row-1")!.Stav).toBe("FAILED");
    expect(index.isDirty(ORDER_ID)).toBe(false);
  });
});
