// DR-039, etapa 3 — effect journal: PREPARED before every external write, receipt after it, recovery after a crash
// by the marker in the created object, HOLD on any doubt, panel rows caught up after a failed write.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { artifactHash } from "../approval";
import {
  EffectJournal,
  effectMarker,
  operationId,
  titleWithMarker,
} from "../effects";
import { NotionRestApi, NotionRestError, RestNotion } from "../notion";
import { PanelIndex, type PanelRow, type PanelSink } from "../panel";
import { transition } from "../state-machine";
import { Store } from "../store";
import {
  FileNotion,
  makeOrch,
  ORDER_ID,
  PARENT,
  seedDelivered,
} from "./effects-fixture";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const TSX = path.join(ROOT, "node_modules", "tsx", "dist", "loader.mjs");
const DELIVER_OP = operationId(ORDER_ID, "deliver", 0);
const CARD_OP = operationId(ORDER_ID, "owner-card", 0);

let dir: string;
let store: Store;
let notion: FileNotion;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-eff-"));
  store = new Store(dir);
  notion = new FileNotion(path.join(dir, "notion.jsonl"));
});

/** Real SIGKILL of a child process inside the Notion write (`when` relative to storing the page). */
function crashChild(when: "before" | "after", titlePrefix: string) {
  const r = spawnSync(
    process.execPath,
    [
      "--import",
      TSX,
      path.join(__dirname, "effects-crash-child.ts"),
      dir,
      when,
      titlePrefix,
    ],
    { encoding: "utf8", timeout: 60_000 },
  );
  return r;
}

const journal = () => new EffectJournal(dir);

/** In-memory panel sink: one row per order id, counts creates; can fail the next N writes. */
class FakeSink implements PanelSink {
  rows = new Map<string, PanelRow>();
  creates = 0;
  failNext = 0;
  /** the failing write still saves the row (Notion answered 503 after committing) */
  commitOnFailure = false;
  async upsert(row: PanelRow, existing?: string): Promise<string> {
    const id = existing ?? `row-${row["ID zakázky"]}-${this.creates + 1}`;
    if (this.failNext > 0) {
      this.failNext--;
      if (this.commitOnFailure && !existing) {
        this.creates++;
        this.rows.set(id, row);
      }
      throw new NotionRestError(503, "service_unavailable");
    }
    if (!existing) this.creates++;
    this.rows.set(id, row);
    return id;
  }
  async findRowByOrderId(orderId: string): Promise<string | undefined> {
    const hits = [...this.rows.entries()].filter(
      ([, r]) => r["ID zakázky"] === orderId,
    );
    return hits[0]?.[0];
  }
}

describe("effect journal: operation_id, marker, durable record", () => {
  it("operation_id is deterministic (order + step + round); the marker survives a title cut at 2000 characters", () => {
    expect(operationId("wo-1", "deliver", 0)).toBe("wo-1/deliver/r0");
    expect(operationId("wo-1", "deliver", 0)).toBe(
      operationId("wo-1", "deliver", 0),
    );
    const t = titleWithMarker("x".repeat(5000), "wo-1/deliver/r0");
    expect(t.length).toBeLessThanOrEqual(2000);
    expect(t.endsWith(effectMarker("wo-1/deliver/r0"))).toBe(true);
    // r1 never matches r10 (closing bracket)
    expect(
      titleWithMarker("T", "wo-1/deliver/r10").includes(
        effectMarker("wo-1/deliver/r1"),
      ),
    ).toBe(false);
  });

  it("PREPARED → EFFECT_DONE keeps the operation_id; a retry counts attempts; DONE/UNKNOWN refuse a new PREPARED; bad ids are rejected", () => {
    const j = journal();
    j.prepare(DELIVER_OP);
    expect(j.get(DELIVER_OP)).toMatchObject({
      state: "PREPARED",
      attempts: 1,
      order: ORDER_ID,
      step: "deliver",
      round: 0,
    });
    j.prepare(DELIVER_OP);
    expect(j.get(DELIVER_OP)!.attempts).toBe(2);
    j.done(DELIVER_OP, { url: "https://www.notion.so/a" });
    expect(j.get(DELIVER_OP)).toMatchObject({
      state: "EFFECT_DONE",
      receipt: { url: "https://www.notion.so/a" },
      operation_id: DELIVER_OP,
    });
    expect(() => j.prepare(DELIVER_OP)).toThrow(/EFFECT_DONE/);
    expect(
      fs.existsSync(path.join(dir, ORDER_ID, "effects", "deliver-r0.json")),
    ).toBe(true);
    expect(
      fs
        .readdirSync(path.join(dir, ORDER_ID, "effects"))
        .filter((f) => f.endsWith(".tmp")),
    ).toEqual([]);
    expect(() => j.get("../x/deliver/r0")).toThrow(/neplatné/);
    expect(() => j.get("wo-1/deliver")).toThrow(/neplatné/);
  });
});

describe("crash recovery (real SIGKILL of a child process)", () => {
  it("crash BEFORE the write: PREPARED without a page → lookup says certainly absent → one new attempt with the same operation_id", async () => {
    seedDelivered(store);
    const child = crashChild("before", "DRAFT");
    expect(child.signal).toBe("SIGKILL");
    expect(notion.pages()).toHaveLength(0);
    expect(journal().get(DELIVER_OP)).toMatchObject({
      state: "PREPARED",
      attempts: 1,
    });

    const r = await makeOrch(store, notion).step(store.load(ORDER_ID));
    expect(notion.pages()).toHaveLength(1);
    expect(notion.pages()[0].title).toContain(effectMarker(DELIVER_OP));
    expect(journal().get(DELIVER_OP)).toMatchObject({
      state: "EFFECT_DONE",
      attempts: 2,
      operation_id: DELIVER_OP,
    });
    expect(r.state).toBe("DONE");
    expect(r.delivered_url).toBe(
      `https://www.notion.so/${notion.pages()[0].id}`,
    );
  }, 60_000);

  it("crash AFTER the write, before the receipt: the page is found by its marker, no second page, receipt recovered", async () => {
    seedDelivered(store);
    const child = crashChild("after", "DRAFT");
    expect(child.signal).toBe("SIGKILL");
    expect(notion.pages()).toHaveLength(1);
    expect(store.load(ORDER_ID).delivered_url).toBeUndefined();
    expect(journal().get(DELIVER_OP)).toMatchObject({ state: "PREPARED" });

    const r = await makeOrch(store, notion).step(store.load(ORDER_ID));
    // Etapa 4 PR 2: žádný druhý DRAFT; jediný nový zápis je karta vlastníka (viz níže).
    expect(notion.pages().map((p) => p.title.split(" — ")[0])).toEqual([
      "DRAFT",
      "KARTA GO/REJECT",
    ]);
    expect(notion.creates).toBe(1);
    expect(r.delivered_url).toBe(
      `https://www.notion.so/${notion.pages()[0].id}`,
    );
    // Etapa 4 PR 2 (readbackBlocker): obnovené doručení nemá otisk odeslaného obsahu, read-back nejde ověřit →
    // žádné DONE bez vlastníka, ale karta (GO vázané na otisk read-backu), nikdy druhá stránka DRAFTu.
    expect(r.state).toBe("WAITING_OWNER");
    expect(r.meta.delivered_hash).toBeUndefined();
    expect(r.owner_reasons?.some((x) => x.includes("READBACK_MISMATCH"))).toBe(
      true,
    );
    expect(r.meta.approved_hash).toBe(artifactHash(notion.pages()[0].md));
    expect(
      notion.pages().filter((p) => p.title.startsWith("DRAFT")),
    ).toHaveLength(1);
    expect(journal().get(DELIVER_OP)).toMatchObject({
      state: "EFFECT_DONE",
      recovered: true,
      attempts: 1,
    });
    expect(
      store.readLog(50).some((e) => e.result?.includes("nalezen právě jednou")),
    ).toBe(true);
  }, 60_000);

  it("crash after the owner CARD was written: the card is recovered, not duplicated; GO stays bound to the hash recorded at PREPARED", async () => {
    seedDelivered(store, ["cena"]);
    const child = crashChild("after", "KARTA");
    expect(child.signal).toBe("SIGKILL");
    const titles = () => notion.pages().map((p) => p.title.split(" — ")[0]);
    expect(titles()).toEqual(["DRAFT", "KARTA GO/REJECT"]);
    const prepared = journal().get(CARD_OP)!;
    expect(prepared.state).toBe("PREPARED");

    const r = await makeOrch(store, notion).step(store.load(ORDER_ID));
    expect(titles()).toEqual(["DRAFT", "KARTA GO/REJECT"]);
    expect(r.state).toBe("WAITING_OWNER");
    expect(r.owner_card_url).toBe(
      `https://www.notion.so/${notion.pages()[1].id}`,
    );
    expect(r.meta.approved_hash).toBe(prepared.content_hash);
    expect(r.meta.approved_hash).toBe(artifactHash(notion.pages()[0].md));
    expect(r.meta.artifact_hash).toBe(r.meta.approved_hash);
  }, 60_000);
});

describe("recovery decisions without a child process", () => {
  it("a receipt already in the journal (crash after the receipt, before state.json) is reused: no lookup, no write", async () => {
    seedDelivered(store);
    const page = notion.add(PARENT, titleWithMarker("DRAFT — x", DELIVER_OP));
    journal().prepare(DELIVER_OP);
    // Receipt nese otisk odeslaného obsahu (runEffect ho zapisuje s receiptem): read-back sedí → DONE.
    journal().done(
      DELIVER_OP,
      { url: `https://www.notion.so/${page.id}` },
      { content_hash: artifactHash(page.md) },
    );
    const find = vi.spyOn(notion, "findChildPagesByMarker");
    const r = await makeOrch(store, notion).step(store.load(ORDER_ID));
    expect(find).not.toHaveBeenCalled();
    expect(notion.creates).toBe(0);
    expect(r.delivered_url).toBe(`https://www.notion.so/${page.id}`);
    expect(r.state).toBe("DONE");
    expect(JSON.parse(r.meta.readback!)).toMatchObject({
      url: r.delivered_url,
      hash: artifactHash(page.md),
    });
  });

  it("etapa 4 PR 2: receipt bez otisku odeslaného obsahu → read-back nejde ověřit → karta vlastníka, ne DONE", async () => {
    seedDelivered(store);
    const page = notion.add(PARENT, titleWithMarker("DRAFT — x", DELIVER_OP));
    journal().prepare(DELIVER_OP);
    journal().done(DELIVER_OP, { url: `https://www.notion.so/${page.id}` });
    const r = await makeOrch(store, notion).step(store.load(ORDER_ID));
    expect(r.state).toBe("WAITING_OWNER");
    expect(r.owner_reasons?.join(" ")).toMatch(/READBACK_MISMATCH/);
    expect(r.meta.readback).toBeUndefined();
  });

  it("etapa 4 PR 2: read-back se liší od odeslaného obsahu → žádné DONE, karta s otiskem toho, co je na stránce", async () => {
    seedDelivered(store);
    const page = notion.add(
      PARENT,
      titleWithMarker("DRAFT — x", DELIVER_OP),
      "na stránce",
    );
    journal().prepare(DELIVER_OP);
    journal().done(
      DELIVER_OP,
      { url: `https://www.notion.so/${page.id}` },
      { content_hash: artifactHash("odesláno") },
    );
    const r = await makeOrch(store, notion).step(store.load(ORDER_ID));
    expect(r.state).toBe("WAITING_OWNER");
    expect(r.meta.approved_hash).toBe(artifactHash("na stránce"));
    expect(r.owner_reasons?.join(" ")).toMatch(/neshoduje s odeslaným obsahem/);
  });

  it("two copies with the marker → EFFECT_UNKNOWN / HOLD: order UNKNOWN, reason in the log and in the panel row, no write", async () => {
    seedDelivered(store);
    notion.add(PARENT, titleWithMarker("DRAFT — a", DELIVER_OP));
    notion.add(PARENT, titleWithMarker("DRAFT — b", DELIVER_OP));
    journal().prepare(DELIVER_OP);
    const sink = new FakeSink();
    const o = makeOrch(store, notion, {
      panel: { sink, index: new PanelIndex(dir) },
    });
    const r = await o.step(store.load(ORDER_ID));
    await o.flushPanel();
    expect(r.state).toBe("UNKNOWN");
    expect(r.failure_reason).toMatch(
      /^EFFECT_UNKNOWN \(wo-eff\/deliver\/r0\): nalezeno 2 objektů/,
    );
    expect(notion.creates).toBe(0);
    expect(journal().get(DELIVER_OP)).toMatchObject({
      state: "EFFECT_UNKNOWN",
    });
    expect(
      store
        .readLog(50)
        .some(
          (e) =>
            e.kind === "error" &&
            e.result === `EFFECT_UNKNOWN / HOLD: ${DELIVER_OP}`,
        ),
    ).toBe(true);
    const row = [...sink.rows.values()][0];
    expect(row.Stav).toBe("UNKNOWN");
    expect(row["Poslední krok"]).toMatch(/EFFECT_UNKNOWN/);
    // a later step stays held: still no write
    expect((await o.step(store.load(ORDER_ID))).state).toBe("UNKNOWN");
    expect(notion.creates).toBe(0);
  });

  it("lookup error → HOLD, no write", async () => {
    seedDelivered(store);
    journal().prepare(DELIVER_OP);
    notion.opts.findFails = true;
    const r = await makeOrch(store, notion).step(store.load(ORDER_ID));
    expect(r.state).toBe("UNKNOWN");
    expect(r.failure_reason).toMatch(/dohledání podle značky selhalo/);
    expect(notion.creates).toBe(0);
  });

  it("no lookup available (Notion without REST, a department without findEffect) → HOLD, never a blind retry", async () => {
    seedDelivered(store);
    journal().prepare(DELIVER_OP);
    const noLookup = {
      createPage: notion.createPage.bind(notion),
      readPage: notion.readPage.bind(notion),
    };
    const r = await makeOrch(store, noLookup).step(store.load(ORDER_ID));
    expect(r.state).toBe("UNKNOWN");
    expect(r.failure_reason).toMatch(/není k dispozici/);
    expect(notion.creates).toBe(0);

    // a department without findEffect
    const s2 = new Store(fs.mkdtempSync(path.join(os.tmpdir(), "tars-eff2-")));
    seedDelivered(s2);
    new EffectJournal(s2.runsDir).prepare(DELIVER_OP);
    let delivers = 0;
    const dept = {
      name: "fixture",
      creatorFamily: "gpt",
      checkerFamily: "claude",
      cardRole: "fixture",
      alwaysOwner: false,
      creatorModel: () => "c",
      checkerModel: () => "k",
      create: async () => ({ ok: true }),
      check: async () => ({ ok: true, verdict: "PASS" }),
      revise: async () => ({ ok: true }),
      deliver: async () => (
        delivers++,
        { ok: true, url: "https://example.invalid/x" }
      ),
    } as never;
    const r2 = await makeOrch(s2, notion, { department: dept }).step(
      s2.load(ORDER_ID),
    );
    expect(r2.state).toBe("UNKNOWN");
    expect(r2.failure_reason).toMatch(/neumí dohledat/);
    expect(delivers).toBe(0);
  });

  it("retry keeps the operation_id: a write that failed with an unclear error stays PREPARED, the next attempt looks it up first, then writes once with the same marker", async () => {
    seedDelivered(store);
    let fail = true;
    notion.opts.failCreate = () =>
      fail
        ? Object.assign(new Error("usage limit reached"), { limit: true })
        : undefined;
    const o = makeOrch(store, notion);
    const paused = await o.step(store.load(ORDER_ID));
    expect(paused.state).toBe("PAUSED");
    expect(journal().get(DELIVER_OP)).toMatchObject({
      state: "PREPARED",
      attempts: 1,
      reason: expect.stringMatching(/usage limit/),
    });

    fail = false;
    const find = vi.spyOn(notion, "findChildPagesByMarker");
    // a tick resumes PAUSED → DELIVERED; the same stored transition here:
    const s = store.load(ORDER_ID);
    expect(s.state).toBe("PAUSED");
    store.save(transition(s, { type: "resume" }, s.updated_at));
    const r = await o.step(store.load(ORDER_ID));
    expect(find).toHaveBeenCalled();
    expect(r.state).toBe("DONE");
    expect(notion.pages()).toHaveLength(1);
    expect(notion.pages()[0].title).toContain(effectMarker(DELIVER_OP));
    expect(journal().get(DELIVER_OP)).toMatchObject({
      state: "EFFECT_DONE",
      attempts: 2,
      operation_id: DELIVER_OP,
    });
  });

  it("a clean refusal (REST 4xx, nothing written) is EFFECT_ABSENT: a later attempt needs no lookup", async () => {
    seedDelivered(store);
    notion.opts.failCreate = () => new NotionRestError(400, "validation_error");
    const r = await makeOrch(store, notion).step(store.load(ORDER_ID));
    expect(r.state).toBe("FAILED");
    expect(journal().get(DELIVER_OP)).toMatchObject({ state: "EFFECT_ABSENT" });
  });
});

describe("panel projection: dirty rows are caught up on the next tick, never duplicated", () => {
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

  it("a failed create whose row Notion still saved: dirty + uncertain → next tick finds the row by order id and updates it (one row)", async () => {
    waiting();
    const sink = new FakeSink();
    sink.failNext = 1;
    sink.commitOnFailure = true;
    const index = new PanelIndex(dir);
    const o = makeOrch(store, notion, { panel: { sink, index } });
    await o.resyncPanel(ORDER_ID);
    expect(index.isDirty(ORDER_ID)).toBe(true);
    expect(sink.creates).toBe(1);

    const t = await o.tick();
    expect(t.status).toBe("waiting_owner");
    expect(index.isDirty(ORDER_ID)).toBe(false);
    expect(sink.creates).toBe(1);
    expect(sink.rows.size).toBe(1);
    expect([...sink.rows.values()][0].Stav).toBe("WAITING_OWNER");
    expect(
      store
        .readLog(80)
        .some((e) => e.result === "panel: dorovnávám řádek po chybě zápisu"),
    ).toBe(true);
  });

  it("a create of unknown outcome on a sink that cannot look rows up is NOT marked dirty: the tick never creates a second row", async () => {
    waiting();
    const sink = new FakeSink();
    (sink as { findRowByOrderId?: unknown }).findRowByOrderId = undefined;
    sink.failNext = 1;
    sink.commitOnFailure = true;
    const index = new PanelIndex(dir);
    const o = makeOrch(store, notion, { panel: { sink, index } });
    await o.resyncPanel(ORDER_ID);
    expect(sink.creates).toBe(1);
    expect(index.isDirty(ORDER_ID)).toBe(false);
    await o.tick();
    await o.tick();
    expect(sink.creates).toBe(1);
    expect(sink.rows.size).toBe(1);
  });

  it("an existing dirty mark is dropped when the catch-up create ends unclear on a sink without lookup: no second row later", async () => {
    waiting();
    const sink = new FakeSink();
    (sink as { findRowByOrderId?: unknown }).findRowByOrderId = undefined;
    const real = sink.upsert.bind(sink);
    const answers: Array<"refuse" | "commit503"> = ["refuse", "commit503"];
    sink.upsert = async (row, existing) => {
      const a = answers.shift();
      if (a === "refuse") throw new NotionRestError(400, "validation_error");
      if (a === "commit503") {
        await real(row, existing); // Notion saved the row …
        throw new NotionRestError(503, "service_unavailable"); // … but the answer was lost
      }
      return real(row, existing);
    };
    const index = new PanelIndex(dir);
    const o = makeOrch(store, notion, { panel: { sink, index } });
    await o.resyncPanel(ORDER_ID);
    expect(index.isDirty(ORDER_ID)).toBe(true);
    await o.tick(); // catch-up: create committed, answer lost
    expect(sink.creates).toBe(1);
    expect(index.isDirty(ORDER_ID)).toBe(false);
    await o.tick();
    await o.tick();
    expect(sink.creates).toBe(1);
    expect(sink.rows.size).toBe(1);
  });

  it("a cleanly refused create (4xx, nothing written) is dirty and the next tick creates the row once", async () => {
    waiting();
    const sink = new FakeSink();
    const real = sink.upsert.bind(sink);
    let refuse = true;
    sink.upsert = async (row, existing) => {
      if (refuse) {
        refuse = false;
        throw new NotionRestError(400, "validation_error");
      }
      return real(row, existing);
    };
    const index = new PanelIndex(dir);
    const o = makeOrch(store, notion, { panel: { sink, index } });
    await o.resyncPanel(ORDER_ID);
    expect(index.isDirty(ORDER_ID)).toBe(true);
    expect(sink.creates).toBe(0);
    await o.tick();
    await o.tick();
    expect(sink.creates).toBe(1);
    expect(index.isDirty(ORDER_ID)).toBe(false);
  });

  it("a failed update of a known row: the next tick rewrites the same row from state.json; a second failure keeps the mark", async () => {
    waiting();
    const sink = new FakeSink();
    const index = new PanelIndex(dir);
    const o = makeOrch(store, notion, { panel: { sink, index } });
    await o.resyncPanel(ORDER_ID);
    expect(sink.creates).toBe(1);
    // state moves on, the row update fails twice
    const s = store.load(ORDER_ID);
    store.save({ ...s, owner_card_url: "https://www.notion.so/card" });
    sink.failNext = 2;
    await o.resyncPanel(ORDER_ID);
    expect(index.isDirty(ORDER_ID)).toBe(true);
    await o.tick();
    expect(index.isDirty(ORDER_ID)).toBe(true);
    await o.tick();
    expect(index.isDirty(ORDER_ID)).toBe(false);
    expect(sink.creates).toBe(1);
    expect(sink.rows.size).toBe(1);
    expect([...sink.rows.values()][0]["Karta rozhodnutí"]).toBe(
      "https://www.notion.so/card",
    );
  });
});

describe("owner ping (comment) under the journal", () => {
  it("an attempt without a receipt (crash while sending) is never sent again; the ping is marked as done-unknown", async () => {
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
    const op = operationId(ORDER_ID, "owner-ping", 1);
    journal().prepare(op);
    const send = vi.fn(async () => ({ outcome: "sent" as const }));
    const o = makeOrch(store, notion, {
      panel: { sink: new FakeSink(), index: new PanelIndex(dir) },
      ownerPing: { send },
    });
    await o.resyncPanel(ORDER_ID);
    expect(send).not.toHaveBeenCalled();
    expect(store.load(ORDER_ID).meta.owner_ping).toBe("1");
    expect(journal().get(op)).toMatchObject({ state: "EFFECT_UNKNOWN" });
  });

  it("a normal ping is journaled: PREPARED → EFFECT_DONE; a refused one is EFFECT_ABSENT and retried", async () => {
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
    const op = operationId(ORDER_ID, "owner-ping", 1);
    const outcomes: Array<"no_permission" | "sent"> = ["no_permission", "sent"];
    const send = vi.fn(async () => ({ outcome: outcomes.shift()! }));
    const o = makeOrch(store, notion, {
      panel: { sink: new FakeSink(), index: new PanelIndex(dir) },
      ownerPing: { send },
    });
    await o.resyncPanel(ORDER_ID);
    expect(journal().get(op)).toMatchObject({ state: "EFFECT_ABSENT" });
    await o.resyncPanel(ORDER_ID);
    expect(send).toHaveBeenCalledTimes(2);
    expect(journal().get(op)).toMatchObject({
      state: "EFFECT_DONE",
      attempts: 2,
    });
  });
});

describe("Copy provoz beze změny: DELIVERED → karta → GO → DONE", () => {
  it("markers sit only in the page titles; the card hash is the read-back of the DRAFT body; GO reaches DONE after read-back", async () => {
    seedDelivered(store, ["cena"]);
    const o = makeOrch(store, notion);
    const w = await o.step(store.load(ORDER_ID));
    expect(w.state).toBe("WAITING_OWNER");
    const [draft, card] = notion.pages();
    expect(draft.title).toBe(
      `DRAFT — Mikrocopy formuláře (${ORDER_ID}) ${effectMarker(DELIVER_OP)}`,
    );
    expect(card.title).toBe(
      `KARTA GO/REJECT — Mikrocopy formuláře (${ORDER_ID}) ${effectMarker(CARD_OP)}`,
    );
    expect(draft.md).not.toContain("[op:");
    expect(card.md).not.toContain("[op:");
    expect(w.meta.approved_hash).toBe(artifactHash(draft.md));
    expect(w.meta.delivered_hash).toBe(artifactHash(draft.md));
    expect(
      journal()
        .list(ORDER_ID)
        .map((r) => [r.step, r.state]),
    ).toEqual([
      ["deliver", "EFFECT_DONE"],
      ["owner-card", "EFFECT_DONE"],
    ]);
    expect(o.owner(ORDER_ID, "GO").state).toBe("WAITING_OWNER");
    await o.pollOwnerDecisions();
    expect(store.load(ORDER_ID).state).toBe("DONE");
    expect(notion.pages()).toHaveLength(2);
  });
});

describe("RestNotion.findChildPagesByMarker (fake REST)", () => {
  type Call = { url: string; method: string };
  function api(
    pages: Array<{
      results: unknown[];
      has_more: boolean;
      next_cursor?: string | null;
    }>,
  ) {
    const calls: Call[] = [];
    const fetchImpl = async (url: string, init: { method: string }) => {
      calls.push({ url, method: init.method });
      const p = pages.shift();
      return { ok: true, status: 200, json: async () => p };
    };
    return {
      notion: new RestNotion(
        new NotionRestApi("ntn_" + "t".repeat(40), fetchImpl as never),
      ),
      calls,
    };
  }
  const child = (
    id: string,
    title: string,
    extra: Record<string, unknown> = {},
  ) => ({
    object: "block",
    id,
    type: "child_page",
    child_page: { title },
    ...extra,
  });
  const ID1 = "11111111-2222-3333-4444-555555555555";
  const ID2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  it("reads every page of the children listing and returns only child pages carrying the marker", async () => {
    const { notion: n, calls } = api([
      {
        results: [
          child(ID2, "DRAFT — jiná [op:wo-x/deliver/r1]"),
          { object: "block", id: ID2, type: "paragraph" },
        ],
        has_more: true,
        next_cursor: "c1",
      },
      {
        results: [child(ID1, `DRAFT — t ${effectMarker("wo-x/deliver/r0")}`)],
        has_more: false,
        next_cursor: null,
      },
    ]);
    const hits = await n.findChildPagesByMarker(
      "parent-id",
      effectMarker("wo-x/deliver/r0"),
    );
    expect(hits).toEqual([
      { url: "https://www.notion.so/11111111222233334444555555555555" },
    ]);
    expect(calls.map((c) => c.method)).toEqual(["GET", "GET"]);
    expect(calls[0].url).toBe(
      "https://api.notion.com/v1/blocks/parentid/children?page_size=100",
    );
    expect(calls[1].url).toContain("start_cursor=c1");
  });

  it("has_more without a cursor or a malformed answer throws (never „not found“)", async () => {
    await expect(
      api([
        { results: [], has_more: true, next_cursor: null },
      ]).notion.findChildPagesByMarker("p", "[op:x]"),
    ).rejects.toThrow(/incomplete/);
    await expect(
      api([
        { results: "nope" as never, has_more: false },
      ]).notion.findChildPagesByMarker("p", "[op:x]"),
    ).rejects.toThrow(/bad_response/);
  });

  it("a trashed hit is reported as such (the lookup then holds)", async () => {
    const { notion: n } = api([
      {
        results: [child(ID1, "T [op:x]", { in_trash: true })],
        has_more: false,
      },
    ]);
    expect(await n.findChildPagesByMarker("p", "[op:x]")).toEqual([
      {
        url: "https://www.notion.so/11111111222233334444555555555555",
        in_trash: true,
      },
    ]);
  });
});

describe("DevDepartment.findEffect (fake gh on PATH)", () => {
  async function withGh(script: string, fn: () => Promise<void>) {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), "tars-gh-"));
    fs.writeFileSync(path.join(bin, "gh"), `#!/bin/sh\n${script}\n`, {
      mode: 0o755,
    });
    const old = process.env.PATH;
    process.env.PATH = `${bin}:${old}`;
    try {
      await fn();
    } finally {
      process.env.PATH = old;
    }
  }
  const dev = async () => {
    const { DevDepartment } = await import("../departments");
    const a = {
      name: "x",
      model: "x",
      family: "gpt" as const,
      run: async () => ({ ok: true, text: "", limit: false, duration_ms: 0 }),
    };
    return new DevDepartment(
      { ...a, family: "claude", runSh: "/none/run.sh" } as never,
      a,
    );
  };
  const ctx = () => ({ store, notion, draftParentId: PARENT, repoRoot: dir });
  const o = () => ({ id: ORDER_ID }) as never;
  const marker = effectMarker(DELIVER_OP);

  it("one PR of the order's branch with the marker → found; none → absent", async () => {
    await withGh(
      `printf '%s\\n' '[{"url":"https://github.com/o/r/pull/7","body":"x\\nOperace TARS: \`${marker}\`\\n**DRAFT**"},{"url":"https://github.com/o/r/pull/6","body":"bez značky"}]'`,
      async () => {
        expect(await (await dev()).findEffect(o(), ctx(), DELIVER_OP)).toEqual({
          status: "found",
          url: "https://github.com/o/r/pull/7",
        });
      },
    );
    await withGh(`echo '[]'`, async () => {
      expect(await (await dev()).findEffect(o(), ctx(), DELIVER_OP)).toEqual({
        status: "absent",
      });
    });
  });

  it("two PRs with the marker, a failing gh or an unreadable answer → uncertain", async () => {
    await withGh(
      `echo '[{"url":"https://github.com/o/r/pull/7","body":"Operace TARS: \`${marker}\`"},{"url":"https://github.com/o/r/pull/8","body":"Operace TARS: \`${marker}\`"}]'`,
      async () => {
        expect(
          (await (await dev()).findEffect(o(), ctx(), DELIVER_OP)).status,
        ).toBe("uncertain");
      },
    );
    await withGh("exit 1", async () => {
      expect(
        (await (await dev()).findEffect(o(), ctx(), DELIVER_OP)).status,
      ).toBe("uncertain");
    });
    await withGh("echo nope", async () => {
      expect(
        (await (await dev()).findEffect(o(), ctx(), DELIVER_OP)).status,
      ).toBe("uncertain");
    });
  });
});
