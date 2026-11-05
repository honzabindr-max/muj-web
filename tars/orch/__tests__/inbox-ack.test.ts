// Etapa 4 PR 3 — identita producenta (v6.2 resolver, mapa v4 §5 testy 1–4), událost (v6 §2.1, mapa v2 §2.2) a ACK
// „Přijetí TARS“ (mapa v4 §2.3 testy 1–6, tabulka replay, v5 ACK_LEDGER_CORRUPT, v6 T22, N-12 pro PATCH).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EffectJournal, operationId } from "../effects";
import { NotionRestError, OwnerDecisionWriteError } from "../notion";
import { nodePublishFs, publishOnce, type PublishFs } from "../publish";
import {
  EMPTY_TEXT_SHA256,
  ackLedgerFile,
  ackOp,
  ackStep,
  ackText,
  ackTransitionAllowed,
  assertAckPatchAllowlist,
  type AckLedger,
} from "../inbox/ack";
import { InboxHold, event8, sha256Hex } from "../inbox/common";
import {
  eventFile,
  eventId,
  isSuperseded,
  pageBindingFile,
  readEvent,
  readPageBinding,
  writeAckDurable,
} from "../inbox/event";
import { checkTrustedMap } from "../inbox/identity";
import { intentFile } from "../inbox/send-intent";
import { BOT, INBOX_DS, OTHER_BOT, OWNER } from "./inbox-fake";
import { makeWorld } from "./inbox-world";

// víceprocesové a fsync testy: pod plnou zátěží celé sady nestačí výchozích 5 s
vi.setConfig({ testTimeout: 60_000 });

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "inbox-ack-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

async function holdCode(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (e) {
    if (e instanceof InboxHold) return e.code;
    throw e;
  }
}

const ROOT = path.resolve(__dirname, "..");
const orchSources = (): string[] => [
  ...fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.join(ROOT, f)),
  ...fs
    .readdirSync(path.join(ROOT, "inbox"))
    .map((f) => path.join(ROOT, "inbox", f)),
];

describe("identita producenta (v6.2 resolver, mapa v4 §5)", () => {
  it("1: statický grep — v tars/orch se typ autora z page objectu nikdy nečte", () => {
    const needle = new RegExp(["created_by", "\\??\\.", "type"].join(""));
    for (const f of orchSources())
      expect(fs.readFileSync(f, "utf8"), f).not.toMatch(needle);
  });

  it("2: ID mimo důvěryhodnou mapu → INVALID_IDENTITY, 0 událostí", async () => {
    const w = makeWorld(dir);
    const r = w.addRequest({}, OTHER_BOT);
    expect(await holdCode(w.observe(r.id))).toBe("INVALID_IDENTITY");
    expect(fs.existsSync(path.join(dir, "inbox", "events"))).toBe(false);
  });

  it("3: resolver timeout → INVALID_IDENTITY, 0 ACK", async () => {
    const w = makeWorld(dir);
    const r = w.addRequest();
    w.fake.usersDown = true;
    expect(await holdCode(w.observe(r.id))).toBe("INVALID_IDENTITY");
    expect(w.fake.patches()).toHaveLength(0);
  });

  it("4: Producent = tars s ID vlastníka → PRODUCER_MISMATCH; fable s ID TARS → PRODUCER_MISMATCH", async () => {
    const w = makeWorld(dir);
    expect(
      await holdCode(w.observe(w.addRequest({ producent: "tars" }, OWNER).id)),
    ).toBe("PRODUCER_MISMATCH");
    expect(
      await holdCode(
        w.observe(
          w.addRequest({ request_id: "rq-b", producent: "fable" }, BOT).id,
        ),
      ),
    ).toBe("PRODUCER_MISMATCH");
    expect(
      (
        await w.observe(
          w.addRequest({ request_id: "rq-c", producent: "tars" }, BOT).id,
        )
      ).kind,
    ).toBe("new");
  });

  it("chybí Producent, chybí autor, typ resolveru nesedí na mapu, mapa chybí → INVALID_IDENTITY", async () => {
    const w = makeWorld(dir);
    expect(
      await holdCode(w.observe(w.addRequest({ producent: null }).id)),
    ).toBe("INVALID_IDENTITY");
    expect(
      await holdCode(
        w.observe(
          Object.assign(w.addRequest({ request_id: "rq-b" }), {
            created_by: undefined,
          }).id,
        ),
      ),
    ).toBe("INVALID_IDENTITY");
    w.fake.users.set(OWNER, "bot");
    expect(
      await holdCode(w.observe(w.addRequest({ request_id: "rq-c" }).id)),
    ).toBe("INVALID_IDENTITY");
    expect(() => checkTrustedMap(undefined)).toThrow(/INVALID_IDENTITY/);
    expect(() => checkTrustedMap({ tars_bot_id: BOT, owner_id: BOT })).toThrow(
      /INVALID_IDENTITY/,
    );
  });
});

describe("událost podání (v6 §2.1)", () => {
  it("event_id deterministický, zápis jen jednou se značkou trvanlivosti, opakované pozorování = seen", async () => {
    const w = makeWorld(dir);
    const r = w.addRequest();
    const a = await w.observe(r.id);
    expect(a.kind).toBe("new");
    expect(a.event.event_id).toBe(eventId(r.id, "rq-20261105-test", 1));
    const bytes = fs.readFileSync(eventFile(dir, a.event.event_id));
    expect(fs.existsSync(`${eventFile(dir, a.event.event_id)}.durable`)).toBe(
      true,
    );
    const b = await w.observe(r.id);
    expect(b).toEqual({ kind: "seen", event: a.event });
    expect(
      fs.readFileSync(eventFile(dir, a.event.event_id)).equals(bytes),
    ).toBe(true);
  });

  it("změna Zadání → MUTATED; změna Přijetí TARS payload_hash nemění (mimo whitelist)", async () => {
    const w = makeWorld(dir);
    const r = w.addRequest();
    await w.observe(r.id);
    r.props["Přijetí TARS"] = ["cokoli"];
    expect((await w.observe(r.id)).kind).toBe("seen");
    r.props["Zadání"] = ["jiné zadání"];
    expect(await holdCode(w.observe(r.id))).toBe("MUTATED");
  });

  it("FIX1 nález 3: změna request_id (i se zadáním) nebo generation na už pozorovaném řádku → MUTATED, žádná nová událost ani ACK, vazba beze změny", async () => {
    const w = makeWorld(dir);
    const r = w.addRequest();
    const a = await w.observe(r.id);
    expect((await ackStep(w.ackCtx(a.event), "ACKED")).kind).toBe("done");
    const pid = r.id.replace(/-/g, "").toLowerCase();
    const bindingBytes = fs.readFileSync(pageBindingFile(dir, pid));
    expect(readPageBinding(dir, pid)).toMatchObject({
      request_id: "rq-20261105-test",
      generation: 1,
      event_id: a.event.event_id,
    });
    const events = () =>
      fs
        .readdirSync(path.join(dir, "inbox", "events"))
        .filter((f) => f.endsWith(".json"));
    const patches = w.fake.patches().length;

    r.props.request_id = ["rq-jine"];
    r.props["Zadání"] = ["jiné zadání"];
    expect(await holdCode(w.observe(r.id))).toBe("MUTATED");
    r.props["Zadání"] = ["test, nic nedělat"];
    expect(await holdCode(w.observe(r.id))).toBe("MUTATED"); // i beze změny zadání
    r.props.request_id = ["rq-20261105-test"];
    r.props.generation = 2;
    expect(await holdCode(w.observe(r.id))).toBe("MUTATED");

    expect(events()).toEqual([`${a.event.event_id}.json`]);
    expect(w.fake.patches()).toHaveLength(patches);
    expect(
      fs.readFileSync(pageBindingFile(dir, pid)).equals(bindingBytes),
    ).toBe(true);
    // původní identita → opět seen
    r.props.generation = 1;
    expect(await w.observe(r.id)).toEqual({ kind: "seen", event: a.event });
  });

  it("FIX1 nález 3: vazbu řádku založil jiný proces s jinou identitou (CONFLICT) → MUTATED, událost nevznikne", async () => {
    const w = makeWorld(dir);
    const r = w.addRequest();
    const pid = r.id.replace(/-/g, "").toLowerCase();
    publishOnce(
      pageBindingFile(dir, pid),
      JSON.stringify({
        v: 1,
        page_id: pid,
        request_id: "rq-cizi",
        generation: 1,
        event_id: eventId(pid, "rq-cizi", 1),
      }),
    );
    expect(await holdCode(w.observe(r.id))).toBe("MUTATED");
    expect(fs.existsSync(path.join(dir, "inbox", "events"))).toBe(false);
  });

  it("dva řádky se stejným request_id#generation → oba DUPLICATE, 0 událostí", async () => {
    const w = makeWorld(dir);
    const a = w.addRequest();
    const b = w.addRequest();
    expect(await holdCode(w.observe(a.id))).toBe("DUPLICATE");
    expect(await holdCode(w.observe(b.id))).toBe("DUPLICATE");
    expect(fs.existsSync(path.join(dir, "inbox", "events"))).toBe(false);
  });

  it("chybí request_id, generation 0 nebo chybí → INVALID_IDENTITY", async () => {
    const w = makeWorld(dir);
    expect(await holdCode(w.observe(w.addRequest({ request_id: "" }).id))).toBe(
      "INVALID_IDENTITY",
    );
    expect(
      await holdCode(
        w.observe(w.addRequest({ request_id: "rq-g0", generation: 0 }).id),
      ),
    ).toBe("INVALID_IDENTITY");
    expect(
      await holdCode(
        w.observe(w.addRequest({ request_id: "rq-gn", generation: null }).id),
      ),
    ).toBe("INVALID_IDENTITY");
  });

  it("SUPERSEDED určuje jen vyšší generace téhož request_id", () => {
    const g1 = { request_id: "rq-x", generation: 1 };
    expect(isSuperseded(g1, [g1, { request_id: "rq-x", generation: 3 }])).toBe(
      true,
    );
    expect(isSuperseded(g1, [g1, { request_id: "rq-y", generation: 9 }])).toBe(
      false,
    );
  });

  it("ack_durable jen jednou; re-entry „revert a znovu nasadit“: stejné event_id, 0 nových ACK", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    const h1 = writeAckDurable(dir, ev, w.now());
    expect(writeAckDurable(dir, ev, w.now())).toBe(h1);
    const again = await w.observe(ev.page_id);
    expect(again.event.event_id).toBe(ev.event_id);
    expect(await ackStep(w.ackCtx(ev), "ACKED")).toEqual({
      kind: "noop",
      n: 0,
    });
    expect(w.fake.patches()).toHaveLength(0);
    expect(readEvent(dir, ev.event_id)).toEqual(ev);
  });
});

describe("ACK „Přijetí TARS“ (mapa v4 §2.3)", () => {
  async function observed(w: ReturnType<typeof makeWorld>) {
    return (await w.observe(w.addRequest().id)).event;
  }
  const writeLedger = (
    ev: { event_id: string },
    n: number,
    text: string,
    prev = EMPTY_TEXT_SHA256,
    state = "ACKED",
    decided_at = "2026-11-05T09:00:00.000Z",
  ) => {
    const L: AckLedger = {
      ledger_version: 1,
      event_id: ev.event_id,
      n,
      state: state as AckLedger["state"],
      text,
      text_sha256: sha256Hex(text),
      prev_text_sha256: prev,
      decided_at,
      fence: 1,
    };
    expect(
      publishOnce(
        ackLedgerFile(dir, ev.event_id, n),
        JSON.stringify(L, null, 2) + "\n",
      ),
    ).toBe("CREATED");
    return L;
  };

  it("test 1: klíč inbox-<e8>/ack/r0 projde journalem; klíče …/ack/acked a …/scope-card odmítne; v kódu nejsou", () => {
    const j = new EffectJournal(dir);
    expect(() =>
      j.prepare(operationId("inbox-3f2a9c1b", "ack", 0), { subject: "x" }),
    ).not.toThrow();
    expect(() => j.prepare("inbox-3f2a9c1b/ack/acked")).toThrow(
      /neplatné operation_id/,
    );
    expect(() => j.prepare("inbox-3f2a9c1b/scope-card")).toThrow(
      /neplatné operation_id/,
    );
    const src = fs
      .readdirSync(path.join(ROOT, "inbox"))
      .map((f) => fs.readFileSync(path.join(ROOT, "inbox", f), "utf8"))
      .join("\n");
    expect(src).not.toMatch(/\/ack\/(acked|claimed|hold)\b/);
  });

  it("šťastná cesta: ledger → záměr → prepare → PATCH jen Přijetí TARS → read-back → done", async () => {
    const w = makeWorld(dir);
    const ev = await observed(w);
    const out = await ackStep(w.ackCtx(ev), "ACKED");
    expect(out).toMatchObject({ kind: "done", n: 0, recovered: false });
    const p = w.fake.patches();
    expect(p).toHaveLength(1);
    expect(Object.keys(JSON.parse(p[0].body!.toString()).properties)).toEqual([
      "Přijetí TARS",
    ]);
    expect(w.fake.row(ev.page_id).props["Přijetí TARS"]).toEqual([
      (out as { text: string }).text,
    ]);
    expect(ackText("ACKED", ev.event_id, "2026-11-05T10:00:09.000Z")).toBe(
      `ACKED · ${event8(ev.event_id)} · 2026-11-05T10:00Z`,
    );
    expect(w.journal.get(ackOp(ev.event_id, 0))).toMatchObject({
      state: "EFFECT_DONE",
      subject: ev.event_id,
      attempts: 1,
    });
    expect(fs.existsSync(intentFile(dir, ackOp(ev.event_id, 0), 1))).toBe(true);
    expect((out as { text: string }).text).toMatch(
      new RegExp(
        `^ACKED · ${event8(ev.event_id)} · \\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\dZ$`,
      ),
    );
  });

  it("test 2 tabulka: ledger ano, journal chybí → 1 PATCH s textem ledgeru", async () => {
    const w = makeWorld(dir);
    const ev = await observed(w);
    writeLedger(ev, 0, "ACKED · starý formát");
    const out = await ackStep(w.ackCtx(ev), "ACKED");
    expect(out).toMatchObject({ kind: "done", text: "ACKED · starý formát" });
    expect(w.fake.patches()).toHaveLength(1);
  });

  it("test 2 tabulka: PREPARED bez ledgeru → ACK_LEDGER_MISSING, 0 PATCH", async () => {
    const w = makeWorld(dir);
    const ev = await observed(w);
    w.journal.prepare(ackOp(ev.event_id, 0), {
      content_hash: sha256Hex("x"),
      subject: ev.event_id,
    });
    expect(await ackStep(w.ackCtx(ev), "ACKED")).toMatchObject({
      kind: "hold",
      code: "ACK_LEDGER_MISSING",
    });
    expect(w.fake.patches()).toHaveLength(0);
  });

  it("test 2 tabulka: PREPARED + read-back = text → done(recovered); = předchozí → EFFECT_UNKNOWN; jiný → ACK_MISMATCH; vše 0 PATCH", async () => {
    for (const [rb, expected] of [
      ["T", "done"],
      ["", "EFFECT_UNKNOWN"],
      ["cizí", "ACK_MISMATCH"],
    ] as const) {
      const sub = fs.mkdtempSync(path.join(dir, "t-"));
      const w = makeWorld(sub);
      const ev = (await w.observe(w.addRequest().id)).event;
      const L: AckLedger = {
        ledger_version: 1,
        event_id: ev.event_id,
        n: 0,
        state: "ACKED",
        text: "T",
        text_sha256: sha256Hex("T"),
        prev_text_sha256: EMPTY_TEXT_SHA256,
        decided_at: "x",
        fence: 1,
      };
      publishOnce(ackLedgerFile(sub, ev.event_id, 0), JSON.stringify(L));
      w.journal.prepare(ackOp(ev.event_id, 0), {
        content_hash: L.text_sha256,
        subject: ev.event_id,
      });
      w.fake.row(ev.page_id).props["Přijetí TARS"] = rb ? [rb] : [];
      const out = await ackStep(w.ackCtx(ev), "ACKED");
      if (expected === "done")
        expect(out).toMatchObject({ kind: "done", recovered: true });
      else expect(out).toMatchObject({ kind: "hold", code: expected });
      expect(w.fake.patches()).toHaveLength(0);
      if (expected === "EFFECT_UNKNOWN")
        expect(w.journal.get(ackOp(ev.event_id, 0))?.state).toBe(
          "EFFECT_UNKNOWN",
        );
    }
  });

  it("test 2 tabulka: EFFECT_DONE + read-back = text → r1 (1 PATCH); jiný text → ACK_MISMATCH (0); EFFECT_UNKNOWN → HOLD (0); read-back selže → ACK_UNREADABLE (0)", async () => {
    const w = makeWorld(dir);
    const ev = await observed(w);
    await ackStep(w.ackCtx(ev), "ACKED");
    w.fake.log.length = 0;
    expect(await ackStep(w.ackCtx(ev), "ACKED")).toEqual({
      kind: "noop",
      n: 0,
    });
    const saved = w.fake.row(ev.page_id).props["Přijetí TARS"];
    w.fake.row(ev.page_id).props["Přijetí TARS"] = ["vlastník přepsal"];
    expect(await ackStep(w.ackCtx(ev), "CLAIMED")).toMatchObject({
      kind: "hold",
      code: "ACK_MISMATCH",
    });
    expect(w.fake.patches()).toHaveLength(0);
    w.fake.row(ev.page_id).props["Přijetí TARS"] = saved;
    w.fake.onProp = (_p, id) => {
      if (id === "ack") throw new Error("timeout");
    };
    expect(await ackStep(w.ackCtx(ev), "CLAIMED")).toMatchObject({
      kind: "hold",
      code: "ACK_UNREADABLE",
    });
    w.fake.onProp = undefined;
    expect(await ackStep(w.ackCtx(ev), "CLAIMED")).toMatchObject({
      kind: "done",
      n: 1,
    });
    expect(w.fake.patches()).toHaveLength(1);
    w.journal.prepare(ackOp(ev.event_id, 2), {
      content_hash: "0".repeat(64),
      subject: ev.event_id,
    });
    w.journal.unknown(ackOp(ev.event_id, 2), "x");
    expect(await ackStep(w.ackCtx(ev), "HOLD(REVOKED)")).toMatchObject({
      kind: "hold",
    });
    expect(w.fake.patches()).toHaveLength(1);
  });

  it("test 2 tabulka: EFFECT_ABSENT → R3, nový PATCH se stejným operation_id a stejným textem", async () => {
    const w = makeWorld(dir);
    const ev = await observed(w);
    let fail = true;
    w.fake.onPatch = () => {
      if (fail) {
        fail = false;
        throw new NotionRestError(429, "rate_limited");
      }
    };
    expect(await ackStep(w.ackCtx(ev), "ACKED")).toMatchObject({
      kind: "hold",
      code: "EFFECT_RETRY",
    });
    expect(w.journal.get(ackOp(ev.event_id, 0))?.state).toBe("EFFECT_ABSENT");
    const out = await ackStep(w.ackCtx(ev), "ACKED");
    expect(out).toMatchObject({ kind: "done", n: 0 });
    const [a, b] = w.fake.patches();
    expect(a.body!.equals(b.body!)).toBe(true);
    expect(w.journal.get(ackOp(ev.event_id, 0))?.attempts).toBe(2);
  });

  it("FIX1 nález 2: r0 hotové, PATCH r1 → 429 (EFFECT_ABSENT), vlastník mezitím upraví Přijetí TARS → retry ACK_MISMATCH, 0 dalších PATCH, text vlastníka zůstane", async () => {
    const w = makeWorld(dir);
    const r = w.addRequest();
    const ev = (await w.observe(r.id)).event;
    expect((await ackStep(w.ackCtx(ev), "ACKED")).kind).toBe("done");
    let reject = true;
    w.fake.onPatch = () => {
      if (reject) throw new NotionRestError(429, "rate_limited");
    };
    expect(await ackStep(w.ackCtx(ev), "CLAIMED")).toMatchObject({
      kind: "hold",
      code: "EFFECT_RETRY",
    });
    expect(w.journal.get(ackOp(ev.event_id, 1))?.state).toBe("EFFECT_ABSENT");
    reject = false;
    r.props["Přijetí TARS"] = ["vlastník: počkej"];
    const before = w.fake.patches().length;
    expect(await ackStep(w.ackCtx(ev), "CLAIMED")).toMatchObject({
      kind: "hold",
      code: "ACK_MISMATCH",
    });
    expect(w.fake.patches()).toHaveLength(before);
    expect(r.props["Přijetí TARS"]).toEqual(["vlastník: počkej"]);
    expect(w.journal.get(ackOp(ev.event_id, 1))?.state).toBe("EFFECT_ABSENT");
    // bez zásahu vlastníka (pole = text r0) retry projde jako dřív
    const r0 = JSON.parse(
      fs.readFileSync(ackLedgerFile(dir, ev.event_id, 0), "utf8"),
    ) as AckLedger;
    r.props["Přijetí TARS"] = [r0.text];
    expect(await ackStep(w.ackCtx(ev), "CLAIMED")).toMatchObject({
      kind: "done",
      n: 1,
    });
  });

  it("FIX1 nález 2: r0 EFFECT_ABSENT, vlastník vyplní prázdné Přijetí TARS → ACK_MISMATCH, 0 PATCH navíc", async () => {
    const w = makeWorld(dir);
    const r = w.addRequest();
    const ev = (await w.observe(r.id)).event;
    let reject = true;
    w.fake.onPatch = () => {
      if (reject) throw new NotionRestError(429, "rate_limited");
    };
    expect(await ackStep(w.ackCtx(ev), "ACKED")).toMatchObject({
      code: "EFFECT_RETRY",
    });
    reject = false;
    r.props["Přijetí TARS"] = ["ručně"];
    expect(await ackStep(w.ackCtx(ev), "ACKED")).toMatchObject({
      kind: "hold",
      code: "ACK_MISMATCH",
    });
    expect(w.fake.patches()).toHaveLength(1);
    expect(r.props["Přijetí TARS"]).toEqual(["ručně"]);
  });

  it("FIX1 nález 2: ledger r0 bez journalu (pád před prepare), vlastník mezitím vyplní Přijetí TARS → ACK_MISMATCH, 0 PATCH", async () => {
    const w = makeWorld(dir);
    const r = w.addRequest();
    const ev = (await w.observe(r.id)).event;
    await ackStep(
      w.ackCtx(ev, {
        point: (p) => {
          if (p === "ledger-published") throw new Error("pád");
        },
      }),
      "ACKED",
    ).catch(() => undefined);
    expect(fs.existsSync(ackLedgerFile(dir, ev.event_id, 0))).toBe(true);
    r.props["Přijetí TARS"] = ["ručně"];
    expect(await ackStep(w.ackCtx(ev), "ACKED")).toMatchObject({
      kind: "hold",
      code: "ACK_MISMATCH",
    });
    expect(w.fake.patches()).toHaveLength(0);
  });

  it("test 3: crash injection (ledger|prepare|PATCH|done) → na r<n> nejvýš 1 úspěšný PATCH, r1 nikdy před EFFECT_DONE r0", async () => {
    for (const at of [
      "ledger-published",
      "prepared",
      "patched",
      "lease-before-done",
    ] as const) {
      const sub = fs.mkdtempSync(path.join(dir, "c-"));
      const w = makeWorld(sub);
      const ev = (await w.observe(w.addRequest().id)).event;
      const ctx = w.ackCtx(ev, {
        point: (p) => {
          if (p === at) throw new Error(`crash ${p}`);
          if (at === "lease-before-done" && p === "patched") w.lease.ok = false;
        },
      });
      await ackStep(ctx, "ACKED").catch(() => undefined); // pád v bodě `at`
      w.lease.ok = true;
      await ackStep(w.ackCtx(ev), "ACKED"); // restart: re-entry podle tabulky
      const r1 = await ackStep(w.ackCtx(ev), "CLAIMED");
      const s0 = w.journal.get(ackOp(ev.event_id, 0))?.state;
      if (s0 !== "EFFECT_DONE") {
        expect(r1.kind).toBe("hold");
        expect(fs.existsSync(ackLedgerFile(sub, ev.event_id, 1))).toBe(false);
      }
      const ok = w.fake
        .patches()
        .filter((p) =>
          JSON.parse(p.body!.toString()).properties[
            "Přijetí TARS"
          ].rich_text[0].text.content.startsWith("ACKED"),
        );
      expect(ok.length, at).toBeLessThanOrEqual(1);
    }
  });

  it("test 4: starý r0 PREPARED + nová verze: read-back = starý text → done(recovered), prázdný → EFFECT_UNKNOWN; r1 nevznikne; 0 PATCH", async () => {
    for (const rb of ["ACKED · 3f2a9c1b", ""]) {
      const sub = fs.mkdtempSync(path.join(dir, "o-"));
      const w = makeWorld(sub);
      const ev = (await w.observe(w.addRequest().id)).event;
      const L: AckLedger = {
        ledger_version: 1,
        event_id: ev.event_id,
        n: 0,
        state: "ACKED",
        text: "ACKED · 3f2a9c1b",
        text_sha256: sha256Hex("ACKED · 3f2a9c1b"),
        prev_text_sha256: EMPTY_TEXT_SHA256,
        decided_at: "x",
        fence: 1,
      };
      publishOnce(ackLedgerFile(sub, ev.event_id, 0), JSON.stringify(L));
      w.journal.prepare(ackOp(ev.event_id, 0), {
        content_hash: L.text_sha256,
        subject: ev.event_id,
      });
      w.fake.row(ev.page_id).props["Přijetí TARS"] = rb ? [rb] : [];
      const out = await ackStep(w.ackCtx(ev), "CLAIMED");
      expect(w.fake.patches()).toHaveLength(0);
      expect(fs.existsSync(ackLedgerFile(sub, ev.event_id, 1))).toBe(false);
      expect(out.kind).toBe(rb ? "done" : "hold");
      expect(
        fs
          .readdirSync(path.dirname(ackLedgerFile(sub, ev.event_id, 0)))
          .filter((f) => /^r\d+\.json$/.test(f)),
      ).toEqual(["r0.json"]);
    }
  });

  it("test 5: EVENT8_COLLISION — journal klíče patří jiné události se stejným <e8>, 0 zápisů", async () => {
    const w = makeWorld(dir);
    const ev = await observed(w);
    const other = `${ev.event_id.slice(0, 8)}${"f".repeat(24)}`;
    w.journal.prepare(ackOp(ev.event_id, 0), {
      content_hash: "0".repeat(64),
      subject: other,
    });
    expect(await ackStep(w.ackCtx(ev), "ACKED")).toMatchObject({
      kind: "hold",
      code: "EVENT8_COLLISION",
    });
    expect(w.fake.patches()).toHaveLength(0);
  });

  it("test 6: pád mezi stavy — r0 EFFECT_DONE, ledger r1 se starým textem → PATCH se starým textem", async () => {
    const w = makeWorld(dir);
    const ev = await observed(w);
    const r0 = await ackStep(w.ackCtx(ev), "ACKED");
    writeLedger(
      ev,
      1,
      "CLAIMED · starý text",
      sha256Hex((r0 as { text: string }).text),
      "CLAIMED",
    );
    w.fake.log.length = 0;
    expect(await ackStep(w.ackCtx(ev), "CLAIMED")).toMatchObject({
      kind: "done",
      n: 1,
      text: "CLAIMED · starý text",
    });
    expect(w.fake.patches()).toHaveLength(1);
  });

  it("v5: poškozený ACK ledger r0 + journal PREPARED → ACK_LEDGER_CORRUPT, 0 PATCH, nikdy nový text", async () => {
    for (const bad of [
      "{nečitelné",
      JSON.stringify({
        ledger_version: 1,
        n: 0,
        state: "ACKED",
        text_sha256: "0".repeat(64),
      }),
      JSON.stringify({
        ledger_version: 1,
        event_id: "",
        n: 0,
        state: "ACKED",
        text: "A",
        text_sha256: sha256Hex("B"),
        prev_text_sha256: EMPTY_TEXT_SHA256,
        decided_at: "x",
        fence: 1,
      }),
    ]) {
      const sub = fs.mkdtempSync(path.join(dir, "k-"));
      const w = makeWorld(sub);
      const ev = (await w.observe(w.addRequest().id)).event;
      publishOnce(
        ackLedgerFile(sub, ev.event_id, 0),
        bad.replace('"event_id":""', `"event_id":"${ev.event_id}"`),
      );
      w.journal.prepare(ackOp(ev.event_id, 0), {
        content_hash: "0".repeat(64),
        subject: ev.event_id,
      });
      expect(await ackStep(w.ackCtx(ev), "ACKED")).toMatchObject({
        kind: "hold",
        code: "ACK_LEDGER_CORRUPT",
      });
      expect(w.fake.patches()).toHaveLength(0);
    }
  });

  it("T22: existující r1, druhý zapisovatel s jiným decided_at (obejde kontrolu existence) → CONFLICT, ACK_LEDGER_CONFLICT, 0 PATCH, soubor beze změny", async () => {
    const w = makeWorld(dir);
    const ev = await observed(w);
    const r0 = await ackStep(w.ackCtx(ev), "ACKED");
    writeLedger(
      ev,
      1,
      "CLAIMED · první",
      sha256Hex((r0 as { text: string }).text),
      "CLAIMED",
      "2026-11-05T09:59:00.000Z",
    );
    const f = ackLedgerFile(dir, ev.event_id, 1);
    const before = fs.readFileSync(f);
    const ino = fs.statSync(f).ino;
    const blind: PublishFs = {
      ...nodePublishFs,
      existsSync: (p) => (p === f ? false : fs.existsSync(p)),
    };
    w.fake.log.length = 0;
    expect(
      await ackStep(w.ackCtx(ev, { publish: { fs: blind } }), "CLAIMED"),
    ).toMatchObject({ kind: "hold", code: "ACK_LEDGER_CONFLICT" });
    expect(w.fake.patches()).toHaveLength(0);
    expect(fs.readFileSync(f).equals(before)).toBe(true);
    expect(fs.statSync(f).ino).toBe(ino);
  });

  it("N-12 (PATCH): cizí nevyřešený záměr odeslání → SEND_INTENT_FOREIGN, 0 PATCH, 0 prepare", async () => {
    const w = makeWorld(dir);
    const ev = await observed(w);
    const op = ackOp(ev.event_id, 0);
    publishOnce(
      intentFile(dir, op, 1),
      JSON.stringify({
        v: 1,
        operation_id: op,
        attempt: 1,
        fence: 7,
        lease_token: "cizí",
        content_hash: "x",
        pid: 1,
        created_at: "x",
      }),
    );
    expect(await ackStep(w.ackCtx(ev), "ACKED")).toMatchObject({
      kind: "hold",
      code: "SEND_INTENT_FOREIGN",
    });
    expect(w.fake.patches()).toHaveLength(0);
    expect(w.journal.get(op)).toBeUndefined();
  });

  it("allowlist Inboxu: PATCH s jiným klíčem = výjimka před odesláním; P20 guard; ztráta lease = 0 PATCH; režim hold = 0 zápisů", async () => {
    expect(() =>
      assertAckPatchAllowlist({
        properties: { "Přijetí TARS": {}, Zadání: {} },
      }),
    ).toThrow(/smí měnit jen/);
    expect(() => assertAckPatchAllowlist({ properties: { Stav: {} } })).toThrow(
      /smí měnit jen/,
    );
    const w = makeWorld(dir);
    await expect(
      w.http.send({
        method: "PATCH",
        path: "/v1/pages/x",
        body: Buffer.from(
          JSON.stringify({
            properties: { "Rozhodnutí vlastníka": { select: { name: "GO" } } },
          }),
        ),
      }),
    ).rejects.toBeInstanceOf(OwnerDecisionWriteError);
    expect(w.fake.log).toHaveLength(0);
    const ev = await observed(w);
    w.lease.ok = false;
    expect(await ackStep(w.ackCtx(ev), "ACKED")).toMatchObject({
      kind: "hold",
      code: "LEASE_LOST",
    });
    w.lease.ok = true;
    expect(
      await ackStep(w.ackCtx(ev, { mode: "hold" }), "ACKED"),
    ).toMatchObject({ kind: "hold", code: "MODE_HOLD" });
    expect(fs.existsSync(ackLedgerFile(dir, ev.event_id, 0))).toBe(false);
    expect(w.fake.patches()).toHaveLength(0);
  });

  it("monotónní přechody ACK (v6 §4)", () => {
    expect(ackTransitionAllowed(undefined, "ACKED")).toBe(true);
    expect(ackTransitionAllowed(undefined, "CLAIMED")).toBe(false);
    expect(ackTransitionAllowed("ACKED", "CLAIMED")).toBe(true);
    expect(ackTransitionAllowed("CLAIMED", "HOLD(REVOKED)")).toBe(true);
    expect(ackTransitionAllowed("CLAIMED", "SUPERSEDED")).toBe(false);
    expect(ackTransitionAllowed("SUPERSEDED", "CLAIMED")).toBe(false);
    void INBOX_DS;
  });
});
