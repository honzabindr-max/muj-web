// Etapa 4 PR 5 (NAVRH-v6 §3.3, §5, §6.1, §6.4, §6.5, §9, §14): claim prepare/commit a obnova, revalidace rozhodnutí,
// brána efektu, allowlist receiptů a efektů, dispatcher inboxu, legacy brána, soukromý cíl DRAFTu, zámky zdrojů.
// Bez sítě a bez kvóty: fake Notion (stránky), fake panel (řádky s rozhodnutím), fake čtení podání, žádný model.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AdapterResult, TextAdapter } from "../adapters";
import { artifactHash } from "../approval";
import { CardRegistry } from "../cards";
import { CopyDepartment, finalBodyRef } from "../departments";
import { NotImplementedDesktop } from "../desktop";
import { readDispatch } from "../dispatch";
import { EffectGate, gateFile, readGate } from "../effect-gate";
import { EffectJournal, operationId, titleWithMarker } from "../effects";
import { ackOp } from "../inbox/ack";
import {
  claimDir,
  claimView,
  woIdFor,
  type ClaimBoundary,
} from "../inbox/claim";
import { sha256Hex } from "../inbox/common";
import {
  decisionId,
  decisionsDir,
  writeDecisionReceipt,
  type ResultBinding,
  type ScopeBinding,
} from "../inbox/decision";
import { InboxDispatcher } from "../inbox/dispatcher";
import { eventFile, eventId, type InboxEvent } from "../inbox/event";
import { mergeVerdict, orderClass, requiredFor } from "../inbox/policy";
import {
  revalidateDecision,
  revokedFile,
  type CardRef,
} from "../inbox/revalidate";
import { scopeOp } from "../inbox/scope";
import { inboxStatusLines } from "../inbox/status";
import type { NotionClient } from "../notion";
import { Orchestrator, SecretScanningAdapter } from "../orchestrator";
import {
  OWNER_DECISION_PROPERTY,
  PanelIndex,
  type PanelRow,
  type PanelSink,
} from "../panel";
import { publishOnce, rooted } from "../publish";
import { ResourceLocks, resourceFile } from "../resource-lock";
import { Store } from "../store";
import type { ModelFamily, Order } from "../types";
import {
  FileNotion,
  makeOrch,
  ORDER_ID,
  seedDelivered,
} from "./effects-fixture";
import { TestLease } from "./inbox-world";
import {
  PRIVATE_PARENT,
  privateDispatchFile,
  privateTarget,
  reviewedMeta,
} from "./private-target";

const NOW = "2026-11-05T12:00:00.000Z";
const CARDS_DIR = path.join(__dirname, "..", "..", "..", ".claude", "agents");
const S_PAGE = "5".repeat(32);
const R_PAGE = "a".repeat(32);
const DRAFT = `# Draft\n\n${"Tichý, sebejistý text. ".repeat(30)}\n\n## Kontrola kritérií\n- ok`;
const PASS = '```json\n{"verdict":"PASS","issues":[]}\n```';

let dir: string;
let store: Store;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-e4pr5-"));
  store = new Store(dir);
});
/** Orchestrátory s panelem: jejich fronta zápisů řádků doběhne před smazáním runs/. */
const live: Orchestrator[] = [];
afterEach(async () => {
  await Promise.all(live.splice(0).map((o) => o.flushPanel()));
  fs.rmSync(dir, { recursive: true, force: true });
});

// ───────────────────────────── svět inboxu (fake) ─────────────────────────────

class MockAdapter implements TextAdapter {
  calls: string[] = [];
  name = "mock";
  constructor(
    public family: ModelFamily,
    public model: string,
    private reply: Partial<AdapterResult>,
  ) {}
  async run(prompt: string): Promise<AdapterResult> {
    this.calls.push(prompt);
    return { ok: true, text: "", limit: false, duration_ms: 1, ...this.reply };
  }
}

class MockNotion implements NotionClient {
  pages: Array<{ parent: string; title: string; md: string }> = [];
  creates = 0;
  async createPage(parent: string, title: string, md: string) {
    this.creates++;
    this.pages.push({ parent, title, md });
    return { url: `https://app.notion.com/p/mock${this.pages.length}` };
  }
  async readPage(url: string) {
    const n = Number(/mock(\d+)$/.exec(url)?.[1]);
    const p = this.pages[n - 1];
    if (!p) throw new Error("page not found");
    return p.md;
  }
  async findChildPagesByMarker(parent: string, marker: string) {
    return this.pages
      .map((p, i) => ({ p, url: `https://app.notion.com/p/mock${i + 1}` }))
      .filter((x) => x.p.parent === parent && x.p.title.endsWith(marker))
      .map((x) => ({ url: x.url }));
  }
}

function world() {
  let t = Date.parse(NOW);
  const now = () => new Date((t += 1000)).toISOString();
  const journal = new EffectJournal(dir, now);
  const rows = new Map<string, string | undefined>([[S_PAGE, "GO"]]);
  const w = {
    journal,
    now,
    rows,
    readFails: false,
    payloadOverride: undefined as string | undefined,
    type: "fable",
    ackCalls: [] as string[],
    rowReads: 0,
    scopeCardOverride: undefined as CardRef | undefined | null,
    crash: undefined as ClaimBoundary | undefined,
  };
  const seedEvent = (gen = 1, rid = "rq-1", page = R_PAGE): InboxEvent => {
    const id = eventId(page, rid, gen);
    const ev: InboxEvent = {
      v: 1,
      event_id: id,
      page_id: page,
      request_id: rid,
      generation: gen,
      supersedes: null,
      producer: "vlastník-ručně",
      created_by_id: "owner",
      payload_hash: sha256Hex(`payload|${rid}|${gen}`),
      observed_at: NOW,
      observed_fence: 1,
    };
    publishOnce(
      eventFile(dir, id),
      JSON.stringify(ev, null, 2) + "\n",
      rooted(dir, {}),
    );
    // ACK r0 je EFFECT_DONE s read-backem (úroveň NOTION_VISIBLE)
    journal.prepare(ackOp(id, 0), { subject: id });
    journal.done(ackOp(id, 0), { url: `https://www.notion.so/${page}` });
    return ev;
  };
  /** Scope karta S vydaná (journal PR 3) a pozorované GO vlastníka = scope receipt. */
  const scopeGo = (ev: InboxEvent, sPage = S_PAGE): string => {
    journal.prepare(scopeOp(ev.event_id), { subject: ev.event_id });
    journal.done(scopeOp(ev.event_id), {
      url: `https://www.notion.so/${sPage}`,
    });
    const binding: ScopeBinding = {
      request_id: ev.request_id,
      generation: ev.generation,
      event_id: ev.event_id,
      payload_hash: ev.payload_hash,
    };
    const card_url = `https://www.notion.so/${sPage}`;
    const id = decisionId("scope", binding, card_url, 0, "GO");
    writeDecisionReceipt(dir, {
      v: 2,
      receipt_kind: "scope",
      decision_id: id,
      binding,
      card_url,
      card_round: 0,
      value: "GO",
      source: {
        data_source_id: "panel",
        page_id: sPage,
        property: OWNER_DECISION_PROPERTY,
      },
      observed_at: NOW,
      observed_fence: 1,
      provenance: "observed",
      provenance_note: "DR-039: autor selectu neprokázán",
      source_request_page_id: ev.page_id,
    });
    return id;
  };
  const dispatcher = new InboxDispatcher({
    runsDir: dir,
    store,
    journal,
    readRow: async (p) => {
      w.rowReads++;
      if (w.readFails) throw new Error("notion 502");
      return { readable: true, value: rows.get(p) };
    },
    readPayload: async (ev) => ({
      payload_hash: w.payloadOverride ?? ev.payload_hash,
      type: w.type,
      title: "Mikrocopy formuláře",
      zadani: "Navrhnout texty chybových stavů",
    }),
    ack: async (_ev, s) => {
      w.ackCalls.push(s);
      return {
        ok: true,
        n: w.ackCalls.length,
        readback_sha256: "f".repeat(64),
      };
    },
    now,
    scopeCard: undefined,
    crashAt: (b) => {
      if (w.crash === b) {
        w.crash = undefined;
        throw new Error(`CRASH@${b}`);
      }
    },
  });
  // scopeCard override (card-round-changed): přes podtřídu dispatcheru by to bylo složitější; deps jsou mutovatelné
  (
    dispatcher as unknown as {
      d: { scopeCard?: (ev: InboxEvent) => CardRef | undefined };
    }
  ).d.scopeCard = (ev) =>
    w.scopeCardOverride === undefined
      ? journalCard(journal, ev)
      : (w.scopeCardOverride ?? undefined);
  return { ...w, w, seedEvent, scopeGo, dispatcher };
}

function journalCard(j: EffectJournal, ev: InboxEvent): CardRef | undefined {
  const rec = j.get(scopeOp(ev.event_id));
  return rec?.state === "EFFECT_DONE"
    ? { url: `https://www.notion.so/${S_PAGE}`, round: 0 }
    : undefined;
}

const dispatchSha = () => sha256Hex("dispatch-v1");
const tickInput = (
  lease: TestLease,
  o: Partial<{ mode: "hold" | "run"; may: boolean }> = {},
) => ({
  lease,
  mode: o.mode ?? ("run" as const),
  may_start_new: o.may ?? true,
  dispatchSha256: dispatchSha(),
  allowedTypes: ["fable", "dev"] as const,
});

const claimFiles = (ev: InboxEvent) =>
  fs.existsSync(claimDir(dir, ev.event_id))
    ? fs
        .readdirSync(claimDir(dir, ev.event_id))
        .filter((f) => f.endsWith(".json"))
        .sort()
    : [];
const attemptsOf = (id: string) =>
  fs.existsSync(path.join(dir, id, "attempts"))
    ? fs.readdirSync(path.join(dir, id, "attempts"))
    : [];

// ───────────────────────────── §5 claim ─────────────────────────────

describe("§5 claim prepare/commit (dispatcher inboxu)", () => {
  it("pozitivní cesta: prepare → manifest (state v1, NEW) → commit → ACK CLAIMED; dispatcher pak zakázku pustí", async () => {
    const x = world();
    const ev = x.seedEvent();
    x.scopeGo(ev);
    const lease = new TestLease(5);
    const r = await x.dispatcher.tick(tickInput(lease));
    expect(r.claimed?.outcome).toEqual({
      kind: "claimed",
      wo_id: woIdFor(ev.event_id),
    });
    expect(claimFiles(ev)).toEqual([
      "claim.ack.json",
      "claim.commit.json",
      "claim.prepare.json",
    ]);
    const o = store.load(woIdFor(ev.event_id));
    expect(o).toMatchObject({ state: "NEW", version: 1, mission: "inbox" });
    expect(o.meta).toMatchObject({
      request_event_id: ev.event_id,
      payload_hash: ev.payload_hash,
      claim_fence: "5",
    });
    expect(o.brief).toMatchObject({ department: "copy", owner_decisions: [] });
    expect(x.w.ackCalls).toEqual(["CLAIMED"]);
    expect(x.dispatcher.runnable(o)).toMatchObject({ ok: true });
    expect(orderClass(o)).toBe("inbox");
    // druhý tick: žádný druhý claim, žádný druhý ACK
    await x.dispatcher.tick(tickInput(lease));
    expect(store.listOrders()).toHaveLength(1);
    expect(x.w.ackCalls).toEqual(["CLAIMED"]);
  });

  it("režim hold, první tick po hold → run, chybějící scope GO, typ mimo allowlist: 0 claim", async () => {
    const x = world();
    const ev = x.seedEvent();
    const lease = new TestLease(1);
    await x.dispatcher.tick(tickInput(lease)); // bez scope receiptu
    x.scopeGo(ev);
    await x.dispatcher.tick(tickInput(lease, { mode: "hold" }));
    await x.dispatcher.tick(tickInput(lease, { may: false }));
    await x.dispatcher.tick({ ...tickInput(lease), allowedTypes: ["dev"] });
    expect(fs.existsSync(claimDir(dir, ev.event_id))).toBe(false);
    expect(store.listOrders()).toHaveLength(0);
    expect(x.w.ackCalls).toEqual([]);
  });

  it.each(["mkdir", "prepare", "manifest", "commit", "ack"] as const)(
    "crash injection po %s: další tick = právě 1 claim, 1 zakázka, 0 kroků před commitem, žádný duplikát wo-r*",
    async (b) => {
      const x = world();
      const ev = x.seedEvent();
      x.scopeGo(ev);
      x.w.crash = b;
      await expect(
        x.dispatcher.tick(tickInput(new TestLease(3))),
      ).rejects.toThrow(`CRASH@${b}`);
      // před commitem nikdy runnable (0 spawn)
      const before = fs.existsSync(
        path.join(dir, woIdFor(ev.event_id), "state.json"),
      )
        ? x.dispatcher.runnable(store.load(woIdFor(ev.event_id)))
        : { ok: false };
      expect(before.ok).toBe(b === "ack");
      const r = await x.dispatcher.tick(tickInput(new TestLease(4)));
      const v = claimView({ runsDir: dir }, ev.event_id);
      expect(v.commit && v.ack && !v.terminal).toBeTruthy();
      expect(r.recovered.length + (r.claimed ? 1 : 0)).toBeGreaterThan(0);
      expect(store.listOrders().map((o) => o.id)).toEqual([
        woIdFor(ev.event_id),
      ]);
      expect(store.load(woIdFor(ev.event_id)).version).toBe(1);
      expect(x.w.ackCalls.filter((s) => s === "CLAIMED")).toHaveLength(1);
      expect(attemptsOf(woIdFor(ev.event_id))).toEqual([]);
    },
  );

  it("wo-r*/state.json bez prepare = HOLD UNKNOWN (nikdy dispatch), i s podvrženou meta.request_event_id", async () => {
    const x = world();
    const ev = x.seedEvent();
    const id = woIdFor(ev.event_id);
    store.save({
      id,
      mission: "x",
      state: "PLANNED",
      created_at: NOW,
      updated_at: NOW,
      fix_rounds: 0,
      manual_interventions: 0,
      history: [],
      meta: { request_event_id: ev.event_id },
      brief: {
        title: "t",
        department: "copy",
        milestone: "m",
        why: "w",
        goal: "g",
        inputs: [],
        acceptance: [],
        owner_decisions: [],
        sources: [],
      },
    });
    const r = await x.dispatcher.tick(tickInput(new TestLease(2)));
    expect(r.orphans).toEqual([id]);
    expect(x.dispatcher.runnable(store.load(id))).toMatchObject({
      ok: false,
      detail: expect.stringMatching(/UNKNOWN/),
    });
    // prefix wo-r bez meta.request_event_id = unknown
    expect(orderClass({ id: "wo-rabc", meta: {} })).toBe("unknown");
  });
});

// ───────────────────────────── §5 negativní testy odvolání ─────────────────────────────

describe("§5 odvolání mezi pádem a dalším tickem (N01)", () => {
  type Row = {
    name: string;
    crash: ClaimBoundary;
    change: (x: ReturnType<typeof world>, ev: InboxEvent) => void;
    end: "hold" | "revoked" | "none";
    revoked: boolean;
  };
  const rows: Row[] = [
    {
      name: "revoke-between-PREPARE-and-COMMIT (GO → REJECT)",
      crash: "prepare",
      change: (x) => x.rows.set(S_PAGE, "REJECT"),
      end: "hold",
      revoked: true,
    },
    {
      name: "revoke-after-MANIFEST (GO → prázdné)",
      crash: "manifest",
      change: (x) => x.rows.set(S_PAGE, undefined),
      end: "hold",
      revoked: true,
    },
    {
      name: "revoke-after-COMMIT-before-ACK (GO → REJECT, commit zůstane)",
      crash: "commit",
      change: (x) => x.rows.set(S_PAGE, "REJECT"),
      end: "revoked",
      revoked: true,
    },
    {
      name: "card-round-changed (kolo karty +1)",
      crash: "prepare",
      change: (x) =>
        (x.w.scopeCardOverride = {
          url: `https://www.notion.so/${S_PAGE}`,
          round: 1,
        }),
      end: "hold",
      revoked: true,
    },
    {
      name: "request-superseded (nové kolo generation + 1)",
      crash: "prepare",
      change: (x) => x.seedEvent(2),
      end: "hold",
      revoked: true,
    },
    {
      name: "REST-unreadable (čtení selže → HOLD, 0 zápisů)",
      crash: "prepare",
      change: (x) => (x.w.readFails = true),
      end: "none",
      revoked: false,
    },
  ];
  it.each(rows)("$name", async (row) => {
    const x = world();
    const ev = x.seedEvent();
    x.scopeGo(ev);
    x.w.crash = row.crash;
    await expect(
      x.dispatcher.tick(tickInput(new TestLease(3))),
    ).rejects.toThrow("CRASH");
    const hadCommit = claimFiles(ev).includes("claim.commit.json");
    const filesBefore = claimFiles(ev);
    row.change(x, ev);
    await x.dispatcher.tick(tickInput(new TestLease(4)));
    const files = claimFiles(ev);
    // 0 commit (kde ještě nebyl), 0 ACK CLAIMED
    expect(files.includes("claim.commit.json")).toBe(hadCommit);
    expect(x.w.ackCalls.includes("CLAIMED")).toBe(false);
    if (row.end === "none") expect(files).toEqual(filesBefore);
    else expect(files).toContain(`claim.${row.end}.json`);
    const scopeId = claimView({ runsDir: dir }, ev.event_id).prepare!
      .scope_decision_id;
    expect(fs.existsSync(revokedFile(dir, scopeId))).toBe(row.revoked);
    if (row.end === "revoked") expect(x.w.ackCalls).toContain("HOLD(REVOKED)");
    // 0 spawn: zakázka nikdy runnable
    const id = woIdFor(ev.event_id);
    if (fs.existsSync(path.join(dir, id, "state.json")))
      expect(x.dispatcher.runnable(store.load(id)).ok).toBe(false);
    expect(attemptsOf(id)).toEqual([]);
  });

  it("payload-hash-changed (podání upraveno po prepare, MUTATED) → claim.hold.json, 0 commit, 0 ACK CLAIMED", async () => {
    const x = world();
    const ev = x.seedEvent();
    x.scopeGo(ev);
    x.w.crash = "prepare";
    await expect(
      x.dispatcher.tick(tickInput(new TestLease(3))),
    ).rejects.toThrow("CRASH");
    x.w.payloadOverride = sha256Hex("jiné podání");
    await x.dispatcher.tick(tickInput(new TestLease(4)));
    expect(claimFiles(ev)).toEqual(["claim.hold.json", "claim.prepare.json"]);
    expect(
      fs.readFileSync(
        path.join(claimDir(dir, ev.event_id), "claim.hold.json"),
        "utf8",
      ),
    ).toMatch(/MUTATED/);
    expect(x.w.ackCalls).toEqual([]);
  });

  it("revoke-after-ACK-before-dispatch: commit + ACK CLAIMED, pak REJECT → revalidace před krokem = claim.revoked.json, ACK HOLD(REVOKED), 0 spawn", async () => {
    const x = world();
    const ev = x.seedEvent();
    x.scopeGo(ev);
    const lease = new TestLease(3);
    await x.dispatcher.tick(tickInput(lease));
    x.rows.set(S_PAGE, "REJECT");
    const o = store.load(woIdFor(ev.event_id));
    const s = await x.dispatcher.checkScope(lease, o);
    expect(s).toMatchObject({ ok: false, code: "REVOKED_OBSERVED" });
    expect(claimFiles(ev)).toContain("claim.revoked.json");
    expect(x.w.ackCalls).toEqual(["CLAIMED", "HOLD(REVOKED)"]);
    expect(x.dispatcher.runnable(store.load(o.id)).ok).toBe(false);
    expect(attemptsOf(o.id)).toEqual([]);
  });
});

// ───────────────────────────── §3.3 revalidace, §6.5 test 19 ─────────────────────────────

describe("§3.3 revalidateDecision a záměna druhů (test 19)", () => {
  function resultReceipt(approved: string, page = "6".repeat(32)): string {
    const binding: ResultBinding = {
      order_id: "wo-x",
      artifact_kind: "content",
      approved_hash: approved,
    };
    const card_url = "https://app.notion.com/p/card";
    const id = decisionId("result", binding, card_url, 0, "GO");
    writeDecisionReceipt(dir, {
      v: 2,
      receipt_kind: "result",
      decision_id: id,
      binding,
      card_url,
      card_round: 0,
      value: "GO",
      source: {
        data_source_id: "panel",
        page_id: page,
        property: OWNER_DECISION_PROPERTY,
      },
      observed_at: NOW,
      observed_fence: 1,
      provenance: "observed",
      provenance_note: "x",
    });
    return id;
  }
  const ctx = (value: string | undefined, lease = new TestLease(2)) => ({
    runsDir: dir,
    lease,
    readRow: async () => ({ readable: true, value }),
    now: () => NOW,
  });
  const H = "a".repeat(64);
  const resultExpect = (approved: string | undefined) => ({
    kind: "result" as const,
    order_id: "wo-x",
    approvedHash: approved,
    artifactHash: approved,
    currentCard: { url: "https://app.notion.com/p/card", round: 0 },
    rowTainted: false,
    rowSuperseded: false,
  });

  it("scope receipt předložený místo result (a naopak) = RECEIPT_KIND; nic se nezapíše", async () => {
    const x = world();
    const ev = x.seedEvent();
    const scopeId = x.scopeGo(ev);
    expect(
      await revalidateDecision(ctx("GO"), scopeId, resultExpect(H)),
    ).toMatchObject({ ok: false, code: "RECEIPT_KIND" });
    const rid = resultReceipt(H);
    expect(
      await revalidateDecision(ctx("GO"), rid, {
        kind: "scope",
        eventPayloadHash: ev.payload_hash,
        requestStatus: "OK",
        currentCard: { url: "u", round: 0 },
        rowTainted: false,
        rowSuperseded: false,
      }),
    ).toMatchObject({ ok: false, code: "RECEIPT_KIND" });
    expect(fs.existsSync(path.join(decisionsDir(dir), scopeId))).toBe(false);
  });

  it("result receipt s approved_hash ≠ aktuální meta.approved_hash (nový commit po kartě) = HOLD + REVOKED_OBSERVED; OK jen při shodě", async () => {
    const rid = resultReceipt(H);
    const ok = await revalidateDecision(ctx("GO"), rid, resultExpect(H));
    expect(ok).toMatchObject({ ok: true });
    const bad = await revalidateDecision(
      ctx("GO"),
      rid,
      resultExpect("b".repeat(64)),
    );
    expect(bad).toMatchObject({ ok: false, code: "REVOKED_OBSERVED" });
    expect(fs.existsSync(revokedFile(dir, rid))).toBe(true);
    // REVOKED_OBSERVED se nikdy neruší: ani shoda už neprojde
    expect(
      await revalidateDecision(ctx("GO"), rid, resultExpect(H)),
    ).toMatchObject({ ok: false, code: "REVOKED_OBSERVED" });
    const checks = fs
      .readdirSync(path.join(decisionsDir(dir), rid))
      .filter((f) => /^check-.*\.json$/.test(f));
    expect(checks).toHaveLength(3);
  });

  it("bez lease nic, nečitelný řádek = DECISION_UNREADABLE bez zápisu", async () => {
    const rid = resultReceipt(H);
    const l = new TestLease(2);
    l.ok = false;
    expect(
      await revalidateDecision(ctx("GO", l), rid, resultExpect(H)),
    ).toMatchObject({ ok: false, code: "LEASE_LOST" });
    const r = await revalidateDecision(
      {
        runsDir: dir,
        lease: new TestLease(2),
        readRow: async () => {
          throw new Error("502");
        },
        now: () => NOW,
      },
      rid,
      resultExpect(H),
    );
    expect(r).toMatchObject({ ok: false, code: "DECISION_UNREADABLE" });
    expect(fs.existsSync(path.join(decisionsDir(dir), rid))).toBe(false);
  });
});

// ───────────────────────────── §6.4 allowlist, merge (testy 21c, 22–24) ─────────────────────────────

describe("§6.4 allowlist efektů a merge podle DR-024", () => {
  it("test 21 (část): gh-push u fable = EFFECT_NOT_ALLOWED; test 24: merge z inbox dispatch = EFFECT_NOT_ALLOWED", () => {
    expect(requiredFor("gh-push", "inbox", "copy", false)).toMatchObject({
      allowed: false,
      code: "EFFECT_NOT_ALLOWED",
    });
    expect(requiredFor("notion-draft", "inbox", "dev", true)).toMatchObject({
      allowed: false,
    });
    expect(requiredFor("merge", "inbox", "dev", true)).toMatchObject({
      allowed: false,
      code: "EFFECT_NOT_ALLOWED",
    });
    expect(
      mergeVerdict({
        prClass: "A",
        ciGreen: true,
        reviewPass: true,
        reviewedHead: "1".repeat(40),
        headNow: "1".repeat(40),
        fromInbox: true,
      }),
    ).toMatchObject({ allow: false, code: "EFFECT_NOT_ALLOWED" });
    expect(requiredFor("notion-draft", "unknown", "copy", false)).toMatchObject(
      { allowed: false, code: "UNKNOWN" },
    );
    // druhy receiptů podle tabulky
    expect(requiredFor("notion-draft", "inbox", "copy", false)).toEqual({
      allowed: true,
      required: ["scope", "review"],
    });
    expect(requiredFor("done", "inbox", "copy", true)).toEqual({
      allowed: true,
      required: ["scope", "review", "result"],
    });
    expect(requiredFor("done", "inbox", "dev", false)).toMatchObject({
      allowed: false,
    });
    expect(requiredFor("done", "legacy", "copy", true)).toEqual({
      allowed: true,
      required: ["review", "result"],
    });
    expect(requiredFor("gh-push", "legacy", "dev", true)).toEqual({
      allowed: true,
      required: ["review"],
    });
  });

  const X = "1".repeat(40);
  const Y = "2".repeat(40);
  const base = { ciGreen: true, reviewPass: true, reviewedHead: X, headNow: X };
  it("test 22: třída A, zelené CI, PASS nad HEAD, bez result GO → merge povolen", () => {
    expect(mergeVerdict({ ...base, prClass: "A" })).toEqual({ allow: true });
  });
  it("test 23: třída B / neurčená bez GO → RESULT_GO_MISSING; GO k X a nový commit Y → HOLD; výjimka DR-034 bez GO → HOLD", () => {
    expect(mergeVerdict({ ...base, prClass: "B" })).toMatchObject({
      allow: false,
      code: "RESULT_GO_MISSING",
    });
    expect(mergeVerdict({ ...base, prClass: undefined })).toMatchObject({
      allow: false,
      code: "RESULT_GO_MISSING",
    });
    expect(
      mergeVerdict({
        ...base,
        prClass: "B",
        resultGo: { ok: true, approvedHash: artifactHash(X) },
      }),
    ).toEqual({ allow: true });
    expect(
      mergeVerdict({
        ...base,
        prClass: "B",
        headNow: Y,
        reviewedHead: Y,
        resultGo: { ok: true, approvedHash: artifactHash(X) },
      }),
    ).toMatchObject({ allow: false, code: "RESULT_GO_MISSING" });
    expect(
      mergeVerdict({ ...base, prClass: "A", dr034Exception: true }),
    ).toMatchObject({ allow: false });
    expect(
      mergeVerdict({
        ...base,
        prClass: "B",
        reviewedHead: X,
        headNow: Y,
        resultGo: { ok: true, approvedHash: artifactHash(Y) },
      }),
    ).toMatchObject({ allow: false, code: "REVIEW_MISMATCH" });
  });
});

// ───────────────────────────── §6.4 N14 soukromý cíl (test 26) ─────────────────────────────

describe("§6.4 N14: DRAFT jen do ověřené soukromé stránky (test 26)", () => {
  function legacyReviewed(): Order {
    const o = seedDelivered(store);
    return store.load(o.id);
  }
  const gate = (
    dispatchFile: string,
    draftTarget?: (
      id: string,
    ) => Promise<{ complete: boolean; public_url: string | null | undefined }>,
  ) =>
    new EffectGate({
      runsDir: dir,
      lease: () => undefined,
      dispatch: () => readDispatch(dispatchFile, dir),
      codeRevision: "t",
      draftTarget,
      now: () => NOW,
    });
  const ctx = (o: Order, parent = PRIVATE_PARENT) => ({
    effects: ["notion-draft" as const],
    step: "deliver",
    dept: "copy" as const,
    creatorFamily: "gpt" as const,
    ownerNeeded: false,
    draftParentId: parent,
    artifact: { kind: "content" as const, hash: finalBodyRef(o)!.sha256 },
  });

  it.each([
    ["(a) rodič mimo private_draft_parents", "b".repeat(32), privateTarget],
    [
      "(b) public_url ≠ null",
      PRIVATE_PARENT,
      async () => ({ complete: true, public_url: "https://x.notion.site/p" }),
    ],
    [
      "(c) GET rodiče selže",
      PRIVATE_PARENT,
      async () => {
        throw new Error("502");
      },
    ],
    [
      "(d) neúplná odpověď",
      PRIVATE_PARENT,
      async () => ({ complete: false, public_url: undefined }),
    ],
  ] as const)(
    "%s → HOLD EFFECT_NOT_ALLOWED, brána HOLD, journal bez PREPARED",
    async (_n, parent, target) => {
      const o = legacyReviewed();
      const r = await gate(
        privateDispatchFile(dir),
        target as never,
      ).beforeEffect(o, ctx(o, parent));
      expect(r).toMatchObject({ ok: false, code: "EFFECT_NOT_ALLOWED" });
      expect(readGate(gateFile(dir, o.id, "deliver", 0))?.state).toBe("HOLD");
      expect(
        new EffectJournal(dir).get(operationId(o.id, "deliver", 0)),
      ).toBeUndefined();
    },
  );

  it("orchestrátor: veřejný cíl → 0 POST, zakázka HOLD (UNKNOWN), journal bez PREPARED", async () => {
    seedDelivered(store);
    const notion = new FileNotion(path.join(dir, "notion.jsonl"));
    const o = makeOrch(store, notion);
    (
      o as unknown as { gate: { env: { draftTarget: unknown } } }
    ).gate.env.draftTarget = async () => ({
      complete: true,
      public_url: "https://x.notion.site",
    });
    const after = await o.step(store.load(ORDER_ID));
    expect(after.state).toBe("UNKNOWN");
    expect(after.failure_reason).toMatch(/EFFECT_NOT_ALLOWED/);
    expect(notion.creates).toBe(0);
    expect(
      new EffectJournal(dir).get(operationId(ORDER_ID, "deliver", 0)),
    ).toBeUndefined();
  });

  it("statický test: kód TARS nevolá žádný endpoint, který mění sdílení nebo publikaci stránky", () => {
    const root = path.join(__dirname, "..");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        if (f.name === "__tests__" || f.name === "node_modules") continue;
        const p = path.join(d, f.name);
        if (f.isDirectory()) walk(p);
        else if (/\.(ts|mts|py|sh)$/.test(f.name)) files.push(p);
      }
    };
    walk(root);
    for (const f of files) {
      const s = fs.readFileSync(f, "utf8");
      expect(s, f).not.toMatch(
        /\/permissions|\/share\b|"public_url"\s*:|public_url:\s*["'`]|publish_to_web|\/v1\/pages\/[^"'`]*\/(share|publish)/,
      );
    }
  });
});

describe("dispatch.json: inbox_types (allowlist typů podání, §5 krok 1)", () => {
  it("výchozí žádný typ (fail-closed), jen fable/dev bez opakování; jinak celý soubor neplatný = hold", async () => {
    const { parseDispatch } = await import("../dispatch");
    expect(parseDispatch('{"v":1,"mode":"run"}')).toMatchObject({
      ok: true,
      config: { inbox_types: [] },
    });
    expect(
      parseDispatch('{"v":1,"mode":"run","inbox_types":["fable"]}'),
    ).toMatchObject({ ok: true, config: { inbox_types: ["fable"] } });
    expect(
      parseDispatch('{"v":1,"mode":"run","inbox_types":["vizual"]}'),
    ).toMatchObject({ ok: false });
    expect(
      parseDispatch('{"v":1,"mode":"run","inbox_types":["dev","dev"]}'),
    ).toMatchObject({ ok: false });
    // repo dispatch.json zůstává hold
    const repo = readDispatch(path.join(__dirname, "..", "dispatch.json"), dir);
    expect(repo.config.mode).toBe("hold");
    expect(repo.invalid).toBeUndefined();
  });
});

// ───────────────────────────── §9 zámky zdrojů ─────────────────────────────

describe("§9 zámky konfliktních zdrojů", () => {
  it("obsazený živým držitelem = HELD; prokazatelně mrtvý držitel = převzetí; nečitelný zámek = UNKNOWN; cizí zámek se neuvolní", () => {
    const L = new ResourceLocks(dir);
    const a = L.acquire("notion-effect:p", 1);
    expect(a.ok).toBe(true);
    expect(L.acquire("notion-effect:p", 2)).toMatchObject({
      ok: false,
      reason: "HELD",
    });
    if (a.ok) a.release();
    expect(L.acquire("notion-effect:p", 3).ok).toBe(true);
    // mrtvý držitel (PID neexistuje)
    const f = resourceFile(dir, "repo-git");
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(
      f,
      JSON.stringify({
        resource: "repo-git",
        token: "dead",
        fence: 1,
        pid: 2 ** 22 + 12345,
        started: "x",
        acquired_at: NOW,
      }),
    );
    const dead = new ResourceLocks(dir, {
      pidExists: () => false,
      processStartTime: () => "me",
    });
    expect(dead.acquire("repo-git", 4).ok).toBe(true);
    // nečitelný zámek
    const g = resourceFile(dir, "browser-profile:TARS-agent");
    fs.writeFileSync(g, "{rozbité");
    expect(L.acquire("browser-profile:TARS-agent", 5)).toMatchObject({
      ok: false,
      reason: "UNKNOWN",
    });
    // cizí zámek se release nesmaže
    const other = {
      resource: "browser-profile:TARS-agent",
      token: "jiný",
      fence: 1,
      pid: 1,
      started: "x",
      acquired_at: NOW,
    };
    L.release(other);
    expect(fs.existsSync(g)).toBe(true);
  });

  it("orchestrátor: zdroj efektu drží jiný běh → 0 POST, zakázka zůstává DELIVERED (žádný HOLD, další tick znovu)", async () => {
    seedDelivered(store);
    const L = new ResourceLocks(dir);
    const held = L.acquire(`notion-effect:${PRIVATE_PARENT}`, 9);
    expect(held.ok).toBe(true);
    const notion = new FileNotion(path.join(dir, "notion.jsonl"));
    const after = await makeOrch(store, notion).step(store.load(ORDER_ID));
    expect(after.state).toBe("DELIVERED");
    expect(notion.creates).toBe(0);
    if (held.ok) held.release();
  });
});

// ───────────────────────────── orchestrátor + inbox: testy 14, 16, 17, 21 ─────────────────────────────

function inboxOrch(
  x: ReturnType<typeof world>,
  opts: { maxSteps?: number; checkerFamily?: ModelFamily } = {},
) {
  const dispatchFile = privateDispatchFile(dir, {
    mode: "run",
    inbox_types: ["fable"],
  });
  // režim run platí od minulého ticku pod stejným zápisem souboru → may_start_new
  const rd = readDispatch(dispatchFile, dir);
  fs.writeFileSync(
    path.join(dir, "dispatch-mode.json"),
    JSON.stringify({
      mode: "run",
      observed_at: NOW,
      run_since: NOW,
      revision: rd.revision,
    }),
  );
  const creator = new MockAdapter("claude", "opus", { text: DRAFT });
  const checker = new MockAdapter(opts.checkerFamily ?? "gpt", "gpt-web", {
    text: PASS,
  });
  const notion = new MockNotion();
  const o = new Orchestrator({
    store,
    supervisor: new MockAdapter("claude", "opus", {
      ok: false,
      error: "supervizor v testu nemá běžet",
    }),
    briefChecker: new MockAdapter("gpt", "gpt-brief", { text: PASS }),
    departments: {
      copy: new CopyDepartment(new SecretScanningAdapter(creator), checker),
    },
    cards: new CardRegistry(CARDS_DIR),
    ladder: {
      hasCli: () => true,
      browserReady: () => ({ ok: false, reasons: ["x"] }),
      desktopReady: () => new NotImplementedDesktop().preflight(),
    },
    notion,
    guard: () => ({ alarm: false, summary: "TARS-GUARD OK" }),
    draftParentId: PRIVATE_PARENT,
    draftTarget: privateTarget,
    dispatchFile,
    repoRoot: dir,
    capsulePath: path.join(dir, "capsule.md"),
    now: () => new Date(NOW),
    maxStepsPerTick: opts.maxSteps,
    inbox: x.dispatcher,
    nextWake: false,
  });
  return { o, notion, creator, checker };
}

const receiptsIn = () =>
  fs
    .readdirSync(decisionsDir(dir))
    .filter((f) => /^[0-9a-f]{64}\.json$/.test(f));

describe("§6.5 N10: inbox zakázka wo-r* přes orchestrátor (fake Notion, fake panel)", () => {
  it("test 14 (Q9-A): scope GO nad X → claim → final-body Y → PASS nad Y → revalidace → DRAFT → read-back = Y → DONE; 1 POST, 1 receipt, bez approved_hash", async () => {
    const x = world();
    const ev = x.seedEvent();
    x.scopeGo(ev);
    const { o, notion, checker } = inboxOrch(x);
    const r = await o.tick();
    const id = woIdFor(ev.event_id);
    expect(r).toMatchObject({ status: "advanced", order: id, state: "DONE" });
    const done = store.load(id);
    expect(notion.creates).toBe(1);
    expect(notion.pages[0].parent).toBe(PRIVATE_PARENT);
    // prompt kontrolora obsahuje celé finální tělo; Y ≠ X
    const fb = finalBodyRef(done)!;
    expect(fb.sha256).not.toBe(ev.payload_hash);
    expect(checker.calls[0]).toContain(
      fs.readFileSync(path.join(dir, id, fb.file), "utf8"),
    );
    expect(done.meta.approved_hash).toBeUndefined();
    expect(done.meta.result_decision_id).toBeUndefined();
    expect(receiptsIn()).toHaveLength(1);
    const g = readGate(gateFile(dir, id, "deliver", 0))!;
    expect(g.state).toBe("DONE");
    expect(g.fields).toMatchObject({
      artifact_hash: fb.sha256,
      required_receipts: ["review", "scope"],
      approved_payload_hash: ev.payload_hash,
      effect_type: ["notion-draft"],
    });
    expect(g.readback_value).toBe(fb.sha256);
    expect(artifactHash(notion.pages[0].md)).toBe(fb.sha256);
    // revalidace scope před každým krokem i před efektem a DONE
    const checks = fs
      .readdirSync(path.join(decisionsDir(dir), done.meta.scope_decision_id))
      .filter((f) => f.startsWith("check-"));
    expect(checks.length).toBeGreaterThanOrEqual(5);
    expect(fs.existsSync(revokedFile(dir, done.meta.scope_decision_id))).toBe(
      false,
    );
  });

  it("test 16: REJECT scope po PASS a před efektem → 0 POST, REVOKED_OBSERVED, brána HOLD, claim.revoked + ACK HOLD(REVOKED)", async () => {
    const x = world();
    const ev = x.seedEvent();
    x.scopeGo(ev);
    const { o, notion } = inboxOrch(x, { maxSteps: 3 });
    await o.tick();
    const id = woIdFor(ev.event_id);
    expect(store.load(id).state).toBe("DELIVERED");
    x.rows.set(S_PAGE, "REJECT");
    await o.tick();
    const after = store.load(id);
    expect(after.state).toBe("UNKNOWN");
    expect(notion.creates).toBe(0);
    expect(fs.existsSync(revokedFile(dir, after.meta.scope_decision_id))).toBe(
      true,
    );
    expect(readGate(gateFile(dir, id, "deliver", 0))?.state).toBe("HOLD");
    expect(
      new EffectJournal(dir).get(operationId(id, "deliver", 0)),
    ).toBeUndefined();
    expect(claimFiles(ev)).toContain("claim.revoked.json");
    expect(x.w.ackCalls).toEqual(["CLAIMED", "HOLD(REVOKED)"]);
  });

  it("test 17: po PASS přibude podání generation + 1 (SUPERSEDED) → 0 POST, HOLD, ACK staršího kola HOLD(REVOKED)", async () => {
    const x = world();
    const ev = x.seedEvent();
    x.scopeGo(ev);
    const { o, notion } = inboxOrch(x, { maxSteps: 3 });
    await o.tick();
    x.seedEvent(2);
    await o.tick();
    expect(store.load(woIdFor(ev.event_id)).state).toBe("UNKNOWN");
    expect(notion.creates).toBe(0);
    expect(x.w.ackCalls).toEqual(["CLAIMED", "HOLD(REVOKED)"]);
  });

  it("revalidace před krokem (INTENT): REJECT po claimu → 0 volání modelu, claim.revoked", async () => {
    const x = world();
    const ev = x.seedEvent();
    x.scopeGo(ev);
    await x.dispatcher.tick(tickInput(new TestLease(1)));
    x.rows.set(S_PAGE, "REJECT");
    const { o, creator, checker, notion } = inboxOrch(x);
    await o.tick();
    expect(creator.calls).toHaveLength(0);
    expect(checker.calls).toHaveLength(0);
    expect(notion.creates).toBe(0);
    expect(store.load(woIdFor(ev.event_id)).state).toBe("UNKNOWN");
    expect(claimFiles(ev)).toContain("claim.revoked.json");
  });

  it("nečitelné rozhodnutí před efektem = žádný efekt a žádný HOLD; další tick doručí", async () => {
    const x = world();
    const ev = x.seedEvent();
    x.scopeGo(ev);
    const { o, notion } = inboxOrch(x, { maxSteps: 3 });
    await o.tick();
    x.w.readFails = true;
    await o.tick();
    const id = woIdFor(ev.event_id);
    expect(store.load(id).state).toBe("DELIVERED");
    expect(notion.creates).toBe(0);
    x.w.readFails = false;
    await o.tick();
    expect(store.load(id).state).toBe("DONE");
    expect(notion.creates).toBe(1);
  });

  it("test 21: pád po EFFECT_DONE DRAFTu → nový tick převezme receipt (0 nový POST); opakovaný tick po DONE = 0 efekt", async () => {
    const x = world();
    const ev = x.seedEvent();
    x.scopeGo(ev);
    const { o, notion } = inboxOrch(x, { maxSteps: 3 });
    await o.tick();
    const id = woIdFor(ev.event_id);
    const d = store.load(id);
    // efekt proběhl a jeho receipt je v journalu, ale state.json se neuložil (pád)
    const body = fs.readFileSync(
      path.join(dir, id, finalBodyRef(d)!.file),
      "utf8",
    );
    const op = operationId(id, "deliver", 0);
    const page = await notion.createPage(
      PRIVATE_PARENT,
      titleWithMarker("DRAFT", op),
      body,
    );
    const j = new EffectJournal(dir);
    j.prepare(op, { content_hash: artifactHash(body) });
    j.done(op, page, { content_hash: artifactHash(body) });
    await o.tick();
    expect(store.load(id).state).toBe("DONE");
    expect(notion.creates).toBe(1);
    expect(new EffectJournal(dir).get(op)).toMatchObject({
      state: "EFFECT_DONE",
      attempts: 1,
    });
    await o.tick();
    expect(notion.creates).toBe(1);
  });

  it("review receipt kontrolorem stejné rodiny jako tvůrce → HOLD REVIEW_MISMATCH, 0 POST", async () => {
    const x = world();
    const ev = x.seedEvent();
    x.scopeGo(ev);
    // CopyDepartment odmítne stejnou rodinu už v konstruktoru orchestrátoru (assertFamilies); brána to hlídá i nad receiptem
    const { o, notion } = inboxOrch(x, { maxSteps: 3 });
    await o.tick();
    const id = woIdFor(ev.event_id);
    const d = store.load(id);
    const body = fs.readFileSync(
      path.join(dir, id, finalBodyRef(d)!.file),
      "utf8",
    );
    const meta = reviewedMeta(store, { id, fix_rounds: 0 }, body, "claude");
    store.save({ ...d, meta: { ...d.meta, ...meta } });
    await o.tick();
    expect(store.load(id)).toMatchObject({
      state: "UNKNOWN",
      failure_reason: expect.stringMatching(/REVIEW_MISMATCH/),
    });
    expect(notion.creates).toBe(0);
  });
});

// ───────────────────────────── legacy wo-* (test 25), result GO (18, 20, 27) ─────────────────────────────

class MockPanel implements PanelSink {
  rows: Array<{ row: PanelRow; page?: string }> = [];
  /** postupné hodnoty „Rozhodnutí vlastníka“ (poslední se opakuje) */
  decisions: Array<string | undefined> = [undefined];
  reads = 0;
  async readOwnerDecision() {
    this.reads++;
    return this.decisions.length > 1
      ? this.decisions.shift()
      : this.decisions[0];
  }
  async findRowByOrderId() {
    return this.rows.some((r) => !r.page) ? "page1" : undefined;
  }
  async upsert(row: PanelRow, page?: string) {
    this.rows.push({ row, page });
    return page ?? "page1";
  }
}

function legacyWaiting(ownerDecisions = ["cena"]) {
  seedDelivered(store, ownerDecisions);
  const notion = new FileNotion(path.join(dir, "notion.jsonl"));
  const panel = new MockPanel();
  const o = makeOrch(store, notion, {
    panel: { sink: panel, index: new PanelIndex(dir) },
  });
  live.push(o);
  return { o, notion, panel };
}

describe("N13 legacy wo-* a result GO (testy 18, 20, 25, 27)", () => {
  it("test 25 (a)(b) + 18: legacy wo-* ve WAITING_OWNER bez scope receiptu: bez result GO 0 DONE; po GO na kartě → result receipt → revalidace → DONE, žádný SCOPE_GO_MISSING", async () => {
    const { o, panel } = legacyWaiting();
    await o.step(store.load(ORDER_ID));
    expect(store.load(ORDER_ID).state).toBe("WAITING_OWNER");
    await o.pollOwnerDecisions();
    expect(store.load(ORDER_ID).state).toBe("WAITING_OWNER");
    panel.decisions = ["GO"];
    await o.pollOwnerDecisions();
    const done = store.load(ORDER_ID);
    expect(done.state).toBe("DONE");
    const rc = receiptsIn();
    expect(rc).toHaveLength(1);
    const r = JSON.parse(
      fs.readFileSync(path.join(decisionsDir(dir), rc[0]), "utf8"),
    );
    expect(r).toMatchObject({
      receipt_kind: "result",
      value: "GO",
      binding: { order_id: ORDER_ID, approved_hash: done.meta.approved_hash },
    });
    expect(done.meta.result_decision_id).toBe(r.decision_id);
    expect(
      store
        .readLog(500)
        .some((e) => /SCOPE_GO_MISSING/.test(`${e.result} ${e.reason}`)),
    ).toBe(false);
  });

  it("test 27 (a): GO pozorováno, před DONE se změní na prázdné → revalidace = REVOKED_OBSERVED, 0 DONE, receipt zůstane", async () => {
    const { o, panel } = legacyWaiting();
    await o.step(store.load(ORDER_ID));
    panel.decisions = ["GO", undefined];
    await o.pollOwnerDecisions();
    const w = store.load(ORDER_ID);
    expect(w.state).toBe("WAITING_OWNER");
    expect(fs.existsSync(revokedFile(dir, w.meta.result_decision_id))).toBe(
      true,
    );
    expect(receiptsIn()).toHaveLength(1);
    expect(
      store
        .readLog(500)
        .some((e) =>
          /GO → DONE zadrženo: REVOKED_OBSERVED/.test(e.result ?? ""),
        ),
    ).toBe(true);
  });

  it("test 27 (c): meta.approved_hash přepsaný po kartě (H' ≠ H) → 0 DONE", async () => {
    const { o, panel } = legacyWaiting();
    await o.step(store.load(ORDER_ID));
    const w = store.load(ORDER_ID);
    store.save({
      ...w,
      meta: {
        ...w.meta,
        approved_hash: "e".repeat(64),
        artifact_hash: "e".repeat(64),
      },
    });
    panel.decisions = ["GO"];
    await o.pollOwnerDecisions();
    await o.pollOwnerDecisions();
    expect(store.load(ORDER_ID).state).toBe("WAITING_OWNER");
  });

  it("test 25 (c): legacy ve WAITING_OWNER bez review receiptu → GO nic neodemkne (LEGACY_GATE), cli.ts status vypíše migrační cestu", async () => {
    const { o, panel } = legacyWaiting();
    await o.step(store.load(ORDER_ID));
    const w = store.load(ORDER_ID);
    const meta = { ...w.meta };
    delete meta.review_receipt_id;
    delete meta.review_receipt_sha256;
    store.save({ ...w, meta });
    panel.decisions = ["GO"];
    await o.pollOwnerDecisions();
    expect(store.load(ORDER_ID).state).toBe("WAITING_OWNER");
    expect(
      store
        .readLog(500)
        .some(
          (e) =>
            /GO → DONE zadrženo: LEGACY_GATE/.test(e.result ?? "") &&
            /cesta:/.test(e.reason ?? ""),
        ),
    ).toBe(true);
    const lines = inboxStatusLines(
      dir,
      store.listOrders(),
      readDispatch(privateDispatchFile(dir), dir),
    );
    expect(
      lines.some(
        (l) =>
          l.startsWith(`LEGACY ${ORDER_ID}`) &&
          /HOLD LEGACY_GATE/.test(l) &&
          /cesta:/.test(l),
      ),
    ).toBe(true);
  });

  it("test 25: wo-r* bez scope receiptu = SCOPE_GO_MISSING; cli.ts owner GO pro wo-r* se nepřijme", async () => {
    const x = world();
    const ev = x.seedEvent();
    const id = woIdFor(ev.event_id);
    const o: Order = {
      id,
      mission: "inbox",
      state: "WAITING_OWNER",
      created_at: NOW,
      updated_at: NOW,
      fix_rounds: 0,
      manual_interventions: 0,
      history: [],
      meta: {
        request_event_id: ev.event_id,
        approved_hash: "a".repeat(64),
        artifact_hash: "a".repeat(64),
      },
      owner_card_url: "https://app.notion.com/p/card",
      brief: {
        title: "t",
        department: "copy",
        milestone: "inbox",
        why: "w",
        goal: "g",
        inputs: [],
        acceptance: [],
        owner_decisions: [],
        sources: [],
      },
    };
    store.save(o);
    expect(
      await x.dispatcher.checkScope(new TestLease(1), store.load(id)),
    ).toMatchObject({ ok: false, code: "SCOPE_GO_MISSING" });
    const { o: orch } = legacyWaiting();
    orch.owner(id, "GO");
    expect(store.load(id).meta.owner_go).toBeUndefined();
  });

  it("test 20 (statický): approved_hash se v orchestrátoru přiřazuje jen při vydání karty výsledku; receipt rozhodnutí zapisuje jen pozorování", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "..", "orchestrator.ts"),
      "utf8",
    );
    const assigns = src
      .split("\n")
      .filter((l) => /approved_hash:\s*[a-z]/.test(l) && !/^\s*\/\//.test(l));
    // 1) binding result receiptu (kopie meta.approved_hash, ne zápis do stavu), 2) + 3) vydání karty výsledku
    expect(assigns.map((l) => l.trim()).sort()).toEqual(
      [
        "approved_hash: approved,",
        "meta: { ...o.meta, approved_hash: seen, artifact_hash: seen },",
        "meta: { ...o.meta, approved_hash: approved, artifact_hash: seen },",
      ].sort(),
    );
    // obě přiřazení do stavu leží v bloku vydání karty výsledku (DELIVERED, ownerNeeded && !owner_card_url)
    const card = src.indexOf("if (ownerNeeded && !o.owner_card_url) {");
    const cardEnd = src.indexOf("// Read-back ověřený výše", card);
    for (const l of assigns.filter((x) => x.includes("meta: {"))) {
      const at = src.indexOf(l);
      expect(at > card && at < cardEnd).toBe(true);
    }
    // writeDecisionReceipt volá jen pozorování scope (decision.ts) a pozorování result GO z řádku panelu (recordResultReceipt)
    const root = path.join(__dirname, "..");
    const callers: string[] = [];
    const walk = (d: string) => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        if (f.name === "__tests__") continue;
        const p = path.join(d, f.name);
        if (f.isDirectory()) walk(p);
        else if (
          f.name.endsWith(".ts") &&
          /writeDecisionReceipt\(/.test(fs.readFileSync(p, "utf8"))
        )
          callers.push(path.relative(root, p));
      }
    };
    walk(root);
    expect(callers.sort()).toEqual(["inbox/decision.ts", "orchestrator.ts"]);
    expect((src.match(/writeDecisionReceipt\(/g) ?? []).length).toBe(1);
    expect(src).toMatch(
      /private recordResultReceipt\(o: Order, pageId: string\)/,
    );
  });

  it("test 20: pozorování bez GO nevytvoří receipt (počet receiptů = počet pozorování GO)", async () => {
    const { o, panel } = legacyWaiting();
    await o.step(store.load(ORDER_ID));
    panel.decisions = [undefined];
    await o.pollOwnerDecisions();
    await o.pollOwnerDecisions();
    expect(fs.existsSync(decisionsDir(dir)) ? receiptsIn() : []).toEqual([]);
  });
});

// ───────────────────────────── cli.ts status ─────────────────────────────

describe("§14 cli.ts status: nedokončené claimy, wo-r*, brány, legacy", () => {
  it("vypíše claim bez commitu, revoked, wo-r bez prepare a bránu mimo DONE", async () => {
    const x = world();
    // ev2: hotový claim, pak odvolání (claim.revoked.json); orchestrátor by zakázku dal do HOLD (UNKNOWN)
    const ev2 = x.seedEvent(1, "rq-2", "b".repeat(32));
    x.scopeGo(ev2);
    await x.dispatcher.tick(tickInput(new TestLease(2)));
    x.rows.set(S_PAGE, "REJECT");
    const o2 = store.load(woIdFor(ev2.event_id));
    await x.dispatcher.checkScope(new TestLease(3), o2);
    store.save({ ...o2, state: "UNKNOWN" });
    x.rows.set(S_PAGE, "GO");
    // ev: pád po mkdir = složka claimu bez prepare
    const ev = x.seedEvent();
    x.scopeGo(ev);
    x.w.crash = "mkdir";
    await expect(
      x.dispatcher.tick(tickInput(new TestLease(4))),
    ).rejects.toThrow("CRASH");
    store.save({
      id: "wo-rffffffffffff",
      mission: "x",
      state: "PLANNED",
      created_at: NOW,
      updated_at: NOW,
      fix_rounds: 0,
      manual_interventions: 0,
      history: [],
      meta: {},
    });
    const lines = inboxStatusLines(
      dir,
      store.listOrders(),
      readDispatch(privateDispatchFile(dir), dir),
    );
    const text = lines.join("\n");
    expect(text).toMatch(/^DISPATCH: mode=hold/m);
    expect(text).toMatch(
      new RegExp(`CLAIM ${ev.event_id.slice(0, 8)} .*(BEZ COMMITU|HOLD)`),
    );
    expect(text).toMatch(
      new RegExp(`CLAIM ${ev2.event_id.slice(0, 8)} +REVOKED`),
    );
    expect(text).toMatch(/WO-R wo-rffffffffffff +HOLD UNKNOWN/);
    expect(text).toMatch(
      /WO-R wo-rffffffffffff +PLANNED +HOLD UNKNOWN \(bez události\)/,
    );
  });
});
