// Etapa 4 PR 3 — scope karta: N-08 (mapa v5 §3.7 T1–T15), N-09/N-10/V7 jednoprocesové části (v6 T10, T16, T17, T25),
// vazba S ↔ R a původ (mapa v4 §3.5 testy 1–16, v5 test 17), ověření po POST (v4 §3.6), receipt rozhodnutí (v6 §3.2).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotionRestError } from "../notion";
import { nodePublishFs, publishOnce, type PublishFs } from "../publish";
import { canonicalJson, sha256Hex } from "../inbox/common";
import {
  checkReceipt,
  decisionId,
  observeScopeDecision,
  readOwnerDecision,
  writeDecisionReceipt,
  type DecisionReceipt,
} from "../inbox/decision";
import type { InboxEvent } from "../inbox/event";
import { checkScopeAuthor } from "../inbox/identity";
import {
  buildScopeBody,
  bodyTitle,
  scopeLedgerFile,
  scopeOp,
  scopeTick,
  type BodyBuilder,
  type ScopeLedger,
} from "../inbox/scope";
import {
  BOT,
  INBOX_DS,
  OTHER_BOT,
  OWNER,
  PANEL_DS,
  PANEL_SCHEMA,
  inboxProps,
} from "./inbox-fake";
import { makeWorld } from "./inbox-world";

// víceprocesové a fsync testy: pod plnou zátěží celé sady nestačí výchozích 5 s
vi.setConfig({ testTimeout: 60_000 });

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "inbox-scope-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

type W = ReturnType<typeof makeWorld>;

/** Verze B: jiná výchozí hodnota mimo titulek a jiné pořadí klíčů (mapa v5 §3.7). */
const builderB: BodyBuilder = (inp) => {
  const a = buildScopeBody(inp) as {
    parent: unknown;
    properties: Record<string, unknown>;
  };
  const props = Object.fromEntries(Object.entries(a.properties).reverse());
  return {
    properties: { ...props, "Kde běží": { select: { name: "Mac-B" } } },
    parent: a.parent,
  };
};
const spy = (b: BodyBuilder) => {
  const f = Object.assign(
    (inp: Parameters<BodyBuilder>[0]) => (f.calls++, b(inp)),
    { calls: 0 },
  );
  return f;
};

const ledgerOf = (ev: InboxEvent): ScopeLedger =>
  JSON.parse(
    fs.readFileSync(scopeLedgerFile(dir, ev.event_id), "utf8"),
  ) as ScopeLedger;

function craftLedger(
  w: W,
  ev: InboxEvent,
  o: Partial<ScopeLedger> & { bodyObj?: Record<string, unknown> } = {},
): ScopeLedger {
  const nonce = o.nonce ?? "1".repeat(32);
  const bodyObj =
    o.bodyObj ??
    buildScopeBody({
      event: ev,
      panelDataSourceId: PANEL_DS,
      requestTitle: "Napsat test",
      nonce,
    });
  const body = canonicalJson(bodyObj);
  const L: ScopeLedger = {
    ledger_version: 1,
    event_id: ev.event_id,
    nonce,
    title: bodyTitle(bodyObj)!,
    body,
    body_sha256: sha256Hex(Buffer.from(body, "utf8")),
    body_bytes: Buffer.byteLength(body),
    api_version: w.http.apiVersion,
    method: "POST",
    path: "/v1/pages",
    target_data_source_id: PANEL_DS,
    code_version: "A",
    prepared_at: "2026-11-05T09:00:00.000Z",
    fence: 1,
    ...o,
  };
  delete (L as { bodyObj?: unknown }).bodyObj;
  return L;
}
const publishLedger = (ev: InboxEvent, L: unknown) =>
  expect(
    publishOnce(
      scopeLedgerFile(dir, ev.event_id),
      typeof L === "string" ? L : JSON.stringify(L, null, 2) + "\n",
    ),
  ).toBe("CREATED");

const crashAt = (p: string) => (x: string) => {
  if (x === p) throw new Error(`crash ${x}`);
};

/** Řádek panelu jako kopie existující S (jiný autor), volitelně s úpravou. */
function copyCard(
  w: W,
  srcId: string,
  createdBy: string,
  patch: Record<string, unknown> = {},
) {
  const s = w.fake.row(srcId);
  return w.fake.addRow(
    PANEL_DS,
    { ...JSON.parse(JSON.stringify(s.props)), ...patch } as never,
    createdBy,
  );
}

/** Řádek panelu shodný s tělem ledgeru, ale založený jiným autorem (S′ v §3.5 testech 8–11, 17). */
function cardFromLedger(
  w: W,
  L: ScopeLedger,
  createdBy: string,
  titleTransform: (t: string) => string = (t) => t,
) {
  const body = JSON.parse(L.body) as {
    properties: Record<string, Record<string, unknown>>;
  };
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body.properties)) {
    if (Array.isArray(v.title))
      props[k] = [
        titleTransform(
          (v.title as Array<{ text: { content: string } }>)[0].text.content,
        ),
      ];
    else if (Array.isArray(v.rich_text))
      props[k] = (v.rich_text as Array<{ text: { content: string } }>).map(
        (s) => s.text.content,
      );
    else if ("url" in v) props[k] = v.url;
    else if ("select" in v) props[k] = (v.select as { name: string }).name;
    else if ("checkbox" in v) props[k] = v.checkbox;
  }
  return w.fake.addRow(PANEL_DS, props as never, createdBy);
}

describe("N-08: scope ledger se zmrazeným tělem (mapa v5 §3.7 T1–T15)", () => {
  it("T14: šťastná cesta s B — 1 ledger, 1 prepare, 1 POST, bajty = ledger.body, skutečná metoda/cesta/Notion-Version = ledger, done", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    const out = await scopeTick(w.scopeCtx(ev, { buildBody: builderB }));
    expect(out).toMatchObject({ kind: "done", recovered: false });
    const L = ledgerOf(ev);
    const [p] = w.fake.posts();
    expect(w.fake.posts()).toHaveLength(1);
    expect(p.body!.equals(Buffer.from(L.body, "utf8"))).toBe(true);
    expect([p.method, p.path, p.apiVersion]).toEqual([
      L.method,
      L.path,
      L.api_version,
    ]);
    expect(w.journal.get(scopeOp(ev.event_id))).toMatchObject({
      state: "EFFECT_DONE",
      attempts: 1,
      content_hash: L.body_sha256,
      subject: ev.event_id,
    });
    expect((out as { provenance: unknown }).provenance).toEqual({
      created_by_id: BOT,
      nonce: L.nonce,
    });
  });

  it("T1: A zapíše ledger, pád před prepare; restart s B → 1 POST s bajty A, sestavení B 0×", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    await expect(
      scopeTick(w.scopeCtx(ev, { point: crashAt("ledger-published") })),
    ).rejects.toThrow(/crash/);
    const L = ledgerOf(ev);
    const B = spy(builderB);
    expect(await scopeTick(w.scopeCtx(ev, { buildBody: B }))).toMatchObject({
      kind: "done",
    });
    expect(B.calls).toBe(0);
    expect(w.fake.posts().map((p) => p.body!.toString())).toEqual([L.body]);
    expect(w.journal.get(scopeOp(ev.event_id))?.content_hash).toBe(
      sha256Hex(Buffer.from(L.body)),
    );
  });

  it("T2: A ledger + prepare, pád před POST; restart s B → SCOPE_CARD_UNKNOWN, 0 POST, ledger beze změny", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    await expect(
      scopeTick(w.scopeCtx(ev, { point: crashAt("prepared") })),
    ).rejects.toThrow(/crash/);
    const before = fs.readFileSync(scopeLedgerFile(dir, ev.event_id));
    expect(
      await scopeTick(w.scopeCtx(ev, { buildBody: builderB })),
    ).toMatchObject({ kind: "hold", code: "SCOPE_CARD_UNKNOWN" });
    expect(w.fake.posts()).toHaveLength(0);
    expect(
      fs.readFileSync(scopeLedgerFile(dir, ev.event_id)).equals(before),
    ).toBe(true);
  });

  it("T3 + T15: POST čistě odmítnut (429/403) → EFFECT_ABSENT, 0 MCP; další tick s B → 1 POST se stejnými bajty", async () => {
    for (const st of [429, 403]) {
      const sub = fs.mkdtempSync(path.join(dir, `s${st}-`));
      const w = makeWorld(sub);
      const { ev } = await w.ready();
      let n = 0;
      w.fake.onPost = () => {
        if (n++ === 0) throw new NotionRestError(st, "x");
      };
      expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
        kind: "hold",
        code: "EFFECT_RETRY",
      });
      expect(w.journal.get(scopeOp(ev.event_id))?.state).toBe("EFFECT_ABSENT");
      const B = spy(builderB);
      expect(await scopeTick(w.scopeCtx(ev, { buildBody: B }))).toMatchObject({
        kind: "done",
      });
      const [a, b] = w.fake.posts();
      expect(a.body!.equals(b.body!)).toBe(true);
      expect(sha256Hex(b.body!)).toBe(
        w.journal.get(scopeOp(ev.event_id))?.content_hash,
      );
      expect(B.calls).toBe(0);
      expect(w.fake.log.every((l) => l.path.startsWith("/v1/"))).toBe(true);
    }
  });

  it("T4: uložené tělo odmítnuto validation_error → SCOPE_BODY_REJECTED, další 3 ticky 0 POST, 0 sestavení B", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    w.fake.onPost = () => {
      throw new NotionRestError(400, "validation_error");
    };
    expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
      kind: "hold",
      code: "SCOPE_BODY_REJECTED",
    });
    const B = spy(builderB);
    for (let i = 0; i < 3; i++)
      expect(await scopeTick(w.scopeCtx(ev, { buildBody: B }))).toMatchObject({
        kind: "hold",
        code: "SCOPE_BODY_REJECTED",
      });
    expect(w.fake.posts()).toHaveLength(1);
    expect(B.calls).toBe(0);
  });

  it("T5–T9: poškozený ledger → HOLD s kódem V1–V5, 0 HTTP zápisů, ledger beze změny", async () => {
    const cases: Array<
      [string, (w: W, ev: InboxEvent) => unknown, string, boolean]
    > = [
      [
        "T5 změněný bajt těla",
        (w, ev) => ({
          ...craftLedger(w, ev),
          body: craftLedger(w, ev).body.replace("Napsat", "Napsal"),
        }),
        "SCOPE_BODY_CORRUPT",
        false,
      ],
      [
        "T6 ledger bez body + PREPARED",
        (w, ev) => {
          const L: Partial<ScopeLedger> = craftLedger(w, ev);
          delete L.body;
          return L;
        },
        "SCOPE_BODY_MISSING",
        true,
      ],
      [
        "T7 zkrácený JSON",
        (w, ev) => JSON.stringify(craftLedger(w, ev)).slice(0, 80),
        "SCOPE_BODY_CORRUPT",
        false,
      ],
      [
        "T8 titulek ≠ title",
        (w, ev) => ({ ...craftLedger(w, ev), title: "jiný" }),
        "SCOPE_BODY_CORRUPT",
        false,
      ],
      [
        "T8 nonce ≠ nonce",
        (w, ev) => ({ ...craftLedger(w, ev), nonce: "2".repeat(32) }),
        "SCOPE_BODY_CORRUPT",
        false,
      ],
      [
        "T9 journal content_hash ≠ body_sha256",
        (w, ev) => craftLedger(w, ev),
        "SCOPE_LEDGER_CONFLICT",
        true,
      ],
    ];
    for (const [name, make, code, prepared] of cases) {
      const sub = fs.mkdtempSync(path.join(dir, "v-"));
      const w = makeWorld(sub);
      const { ev } = await w.ready();
      const L = make(w, ev);
      const f = scopeLedgerFile(sub, ev.event_id);
      publishOnce(f, typeof L === "string" ? L : JSON.stringify(L));
      if (prepared)
        w.journal.prepare(scopeOp(ev.event_id), {
          content_hash: "f".repeat(64),
          subject: ev.event_id,
        });
      const before = fs.readFileSync(f);
      expect(await scopeTick(w.scopeCtx(ev)), name).toMatchObject({
        kind: "hold",
        code,
      });
      expect(w.fake.posts(), name).toHaveLength(0);
      expect(fs.readFileSync(f).equals(before), name).toBe(true);
    }
  });

  it("T10 (v6): ledger existuje, nový tick s B obejde kontrolu existence → publishOnce CONFLICT, SCOPE_LEDGER_CONFLICT, soubor i inode beze změny, 0 HTTP", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    await expect(
      scopeTick(w.scopeCtx(ev, { point: crashAt("ledger-published") })),
    ).rejects.toThrow();
    const f = scopeLedgerFile(dir, ev.event_id);
    const before = fs.readFileSync(f);
    const ino = fs.statSync(f).ino;
    const blind: PublishFs = {
      ...nodePublishFs,
      existsSync: (p) => (p === f ? false : fs.existsSync(p)),
    };
    expect(
      await scopeTick(
        w.scopeCtx(ev, { buildBody: builderB, publish: { fs: blind } }),
      ),
    ).toMatchObject({ kind: "hold", code: "SCOPE_LEDGER_CONFLICT" });
    expect(fs.readFileSync(f).equals(before)).toBe(true);
    expect(fs.statSync(f).ino).toBe(ino);
    expect(w.fake.posts()).toHaveLength(0);
  });

  it("T11: 5 restartů střídavě A/B, každý POST čistě odmítnut → všechny POST bajtově = ledger.body, ledger beze změny, nejvýš 1 EFFECT_DONE", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    let refuse = 5;
    w.fake.onPost = () => {
      if (refuse-- > 0) throw new NotionRestError(429, "rate_limited");
    };
    await scopeTick(w.scopeCtx(ev));
    const before = fs.readFileSync(scopeLedgerFile(dir, ev.event_id));
    for (let i = 0; i < 5; i++)
      await scopeTick(
        w.scopeCtx(ev, { buildBody: i % 2 ? buildScopeBody : builderB }),
      );
    const L = ledgerOf(ev);
    expect(w.fake.posts()).toHaveLength(6);
    expect(w.fake.posts().every((p) => p.body!.toString() === L.body)).toBe(
      true,
    );
    expect(
      fs.readFileSync(scopeLedgerFile(dir, ev.event_id)).equals(before),
    ).toBe(true);
    expect(
      w.journal
        .list(`inbox-${ev.event_id.slice(0, 8)}`)
        .filter((r) => r.state === "EFFECT_DONE" && r.step === "scope-card"),
    ).toHaveLength(1);
  });

  it("T13 + T25 (statické): tělo jen z ověřeného ledgeru; sestavení jen v cestě „ledger chybí“; žádný log body/nonce; writeDurable ani MCP v cestě ledgerů", () => {
    const read = (f: string) =>
      fs.readFileSync(path.join(__dirname, "..", "inbox", f), "utf8");
    const scope = read("scope.ts");
    expect(scope.match(/\(ctx\.buildBody \?\? buildScopeBody\)/g)).toHaveLength(
      1,
    );
    expect(scope).toMatch(/body:\s*V\.bytes/);
    for (const f of fs.readdirSync(path.join(__dirname, "..", "inbox"))) {
      const s = read(f);
      expect(s, f).not.toMatch(/console\.|\.log\(/);
      expect(s, f).not.toMatch(/writeDurable\s*\(|import[^;]*\bwriteDurable\b/);
      expect(s, f).not.toMatch(
        /McpNotion|HybridNotion|claude -p|isFallbackEligible/,
      );
    }
  });

  it("T16 (N-10): ledger s api_version X, journal EFFECT_ABSENT, restart s pinem Y → SCOPE_CONTEXT_MISMATCH, 0 POST, 0 sestavení; varianty cíl/metoda/cesta", async () => {
    const variants: Array<
      [
        string,
        (w: W, ev: InboxEvent) => Partial<ScopeLedger>,
        string | undefined,
        string | undefined,
      ]
    > = [
      ["pin Notion-Version", () => ({}), "2099-01-01", undefined],
      [
        "target_data_source_id",
        () => ({
          target_data_source_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        }),
        undefined,
        undefined,
      ],
      ["metoda", () => ({ method: "PATCH" as never }), undefined, undefined],
      ["cesta", () => ({ path: "/v1/blocks" as never }), undefined, undefined],
    ];
    for (const [name, mut, pin] of variants) {
      const sub = fs.mkdtempSync(path.join(dir, "c-"));
      const w = makeWorld(sub);
      const { ev } = await w.ready();
      const L = craftLedger(w, ev, mut(w, ev));
      publishOnce(scopeLedgerFile(sub, ev.event_id), JSON.stringify(L));
      w.journal.prepare(scopeOp(ev.event_id), {
        content_hash: L.body_sha256,
        subject: ev.event_id,
      });
      w.journal.absent(scopeOp(ev.event_id), "429");
      const B = spy(builderB);
      const http = pin ? w.fake.client(pin) : w.http;
      expect(
        await scopeTick(w.scopeCtx(ev, { http, buildBody: B })),
        name,
      ).toMatchObject({ kind: "hold", code: "SCOPE_CONTEXT_MISMATCH" });
      expect(w.fake.posts(), name).toHaveLength(0);
      expect(B.calls).toBe(0);
    }
  });

  it("T17 (V7): restart s jiným ID panelu → HOLD, 0 POST; chybný builder (špatné ID zakázky) bez ledgeru → SEMANTIC_MISMATCH, ledger nevznikne, 0 prepare, 0 HTTP", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    await expect(
      scopeTick(w.scopeCtx(ev, { point: crashAt("ledger-published") })),
    ).rejects.toThrow();
    const PANEL2 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    w.fake.schemas[PANEL2] = PANEL_SCHEMA;
    const out = await scopeTick(
      w.scopeCtx(ev, { panel: { data_source_id: PANEL2 } }),
    );
    expect(out.kind).toBe("hold");
    expect([
      "SCOPE_CONTEXT_MISMATCH",
      "SCOPE_BODY_SEMANTIC_MISMATCH",
    ]).toContain((out as { code: string }).code);
    expect(w.fake.posts()).toHaveLength(0);

    const sub = fs.mkdtempSync(path.join(dir, "b-"));
    const w2 = makeWorld(sub);
    const r2 = await w2.ready();
    const bad: BodyBuilder = (inp) => {
      const b = buildScopeBody(inp) as { properties: Record<string, unknown> };
      return {
        ...b,
        properties: {
          ...b.properties,
          "ID zakázky": {
            rich_text: [{ type: "text", text: { content: "rq:jiná#1" } }],
          },
        },
      };
    };
    expect(
      await scopeTick(w2.scopeCtx(r2.ev, { buildBody: bad })),
    ).toMatchObject({ kind: "hold", code: "SCOPE_BODY_SEMANTIC_MISMATCH" });
    expect(fs.existsSync(scopeLedgerFile(sub, r2.ev.event_id))).toBe(false);
    expect(w2.journal.get(scopeOp(r2.ev.event_id))).toBeUndefined();
    expect(w2.fake.posts()).toHaveLength(0);
  });

  it("T25: link vrátí EPERM → LEDGER_PUBLISH_UNSUPPORTED, cíl nevznikne, 0 HTTP, žádná záložní cesta", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    const eperm: PublishFs = {
      ...nodePublishFs,
      linkSync: () => {
        throw Object.assign(new Error("EPERM"), { code: "EPERM" });
      },
    };
    expect(
      await scopeTick(w.scopeCtx(ev, { publish: { fs: eperm } })),
    ).toMatchObject({ kind: "hold", code: "LEDGER_PUBLISH_UNSUPPORTED" });
    expect(fs.existsSync(scopeLedgerFile(dir, ev.event_id))).toBe(false);
    expect(
      fs.readdirSync(path.dirname(scopeLedgerFile(dir, ev.event_id))),
    ).toEqual([]);
    expect(w.fake.posts()).toHaveLength(0);
  });

  it("režim hold: jen čtení a příprava v paměti — 0 ledger, 0 journal, 0 POST; s existujícím ledgerem MODE_HOLD", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    const out = await scopeTick(w.scopeCtx(ev, { mode: "hold" }));
    expect(out).toMatchObject({ kind: "prepared-only" });
    expect(fs.existsSync(scopeLedgerFile(dir, ev.event_id))).toBe(false);
    expect(w.journal.get(scopeOp(ev.event_id))).toBeUndefined();
    publishLedger(ev, craftLedger(w, ev));
    expect(await scopeTick(w.scopeCtx(ev, { mode: "hold" }))).toMatchObject({
      kind: "hold",
      code: "MODE_HOLD",
    });
    expect(w.fake.posts()).toHaveLength(0);
  });

  it("předpoklady: ACK r0 není EFFECT_DONE → ACK_NOT_DONE; ztráta lease před publikací → LEASE_LOST, 0 ledger", async () => {
    const w = makeWorld(dir);
    const ev = (await w.observe(w.addRequest().id)).event;
    expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
      kind: "hold",
      code: "ACK_NOT_DONE",
    });
    const w2 = makeWorld(fs.mkdtempSync(path.join(dir, "l-")));
    const r = await w2.ready();
    w2.lease.ok = false;
    expect(await scopeTick(w2.scopeCtx(r.ev))).toMatchObject({
      kind: "hold",
      code: "LEASE_LOST",
    });
    expect(fs.existsSync(scopeLedgerFile(w2.dir, r.ev.event_id))).toBe(false);
  });
});

describe("vazba S ↔ R a původ (mapa v4 §3.5, v5 test 17)", () => {
  it("1: cizí S se stejným ID zakázky, Karta na jiný řádek, journal nic → FOREIGN_SCOPE_CARD, 0 POST", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    w.fake.addRow(
      PANEL_DS,
      {
        Zakázka: ["cizí"],
        "ID zakázky": [`rq:${ev.request_id}#1`],
        "Karta rozhodnutí": "https://www.notion.so/" + "9".repeat(32),
      } as never,
      OWNER,
    );
    expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
      kind: "hold",
      code: "FOREIGN_SCOPE_CARD",
    });
    expect(w.fake.posts()).toHaveLength(0);
  });

  it("4: ruční S vlastníka bez značek se shodným ID zakázky → FOREIGN_SCOPE_CARD", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    w.fake.addRow(
      PANEL_DS,
      {
        Zakázka: ["ruční"],
        "ID zakázky": [`rq:${ev.request_id}#1`],
        "Karta rozhodnutí": `https://www.notion.so/${ev.page_id}`,
      } as never,
      OWNER,
    );
    expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
      kind: "hold",
      code: "FOREIGN_SCOPE_CARD",
    });
  });

  it("3: dvojí podání R1 a R2 se stejným request_id#generation → DUPLICATE, 0 POST", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    w.fake.addRow(INBOX_DS, inboxProps({}), OWNER);
    expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
      kind: "hold",
      code: "DUPLICATE",
    });
    expect(w.fake.posts()).toHaveLength(0);
  });

  it("7 + 12: pád po POST, jediná S s plnou vazbou → adopce done(recovered), 1 S, 0 druhých POST, provenance", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    await expect(
      scopeTick(w.scopeCtx(ev, { point: crashAt("posted") })),
    ).rejects.toThrow();
    const out = await scopeTick(w.scopeCtx(ev));
    expect(out).toMatchObject({
      kind: "done",
      recovered: true,
      provenance: { created_by_id: BOT, nonce: ledgerOf(ev).nonce },
    });
    expect(w.fake.posts()).toHaveLength(1);
    expect(w.fake.rows.filter((r) => r.ds === PANEL_DS)).toHaveLength(1);
  });

  async function preparedWithLedger(w: W) {
    const { ev } = await w.ready();
    await expect(
      scopeTick(w.scopeCtx(ev, { point: crashAt("prepared") })),
    ).rejects.toThrow();
    return { ev, L: ledgerOf(ev) };
  }

  it("2: PREPARED, jediná S′ se shodným ID, ale [ev:] jiné události → SCOPE_BINDING_MISMATCH, 0 adopce", async () => {
    const w = makeWorld(dir);
    const { ev, L } = await preparedWithLedger(w);
    cardFromLedger(w, L, BOT, (t) =>
      t
        .replace(`[ev:${ev.event_id}]`, `[ev:${"e".repeat(32)}]`)
        .replace(/\[op:[^\]]+\]/, "[op:inbox-eeeeeeee/scope-card/r0]"),
    );
    expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
      kind: "hold",
      code: "SCOPE_BINDING_MISMATCH",
    });
    expect(w.journal.get(scopeOp(ev.event_id))?.state).toBe("PREPARED");
  });

  it("8: protipříklad kola 3 — S′ vlastníka s identickými B1–B7, bez [nx] → SCOPE_PROVENANCE_UNPROVEN, 0 adopcí, 0 POST", async () => {
    const w = makeWorld(dir);
    const { ev, L } = await preparedWithLedger(w);
    cardFromLedger(w, L, OWNER, (t) => t.replace(/ \[nx:[0-9a-f]+\]/, ""));
    expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
      kind: "hold",
      code: "SCOPE_PROVENANCE_UNPROVEN",
    });
    expect(w.fake.posts()).toHaveLength(0);
  });

  it("9: totéž s uhodnutým nonce → SCOPE_PROVENANCE_UNPROVEN", async () => {
    const w = makeWorld(dir);
    const { ev, L } = await preparedWithLedger(w);
    cardFromLedger(w, L, OWNER, (t) =>
      t.replace(/\[nx:[0-9a-f]+\]/, `[nx:${"7".repeat(32)}]`),
    );
    expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
      kind: "hold",
      code: "SCOPE_PROVENANCE_UNPROVEN",
    });
  });

  it("10: kopie po úspěšném POST (i s [nx:N]) → 2 kandidáti, DUPLICATE_SCOPE_CARD, 0 adopcí", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    await expect(
      scopeTick(w.scopeCtx(ev, { point: crashAt("posted") })),
    ).rejects.toThrow();
    copyCard(w, w.fake.rows.find((r) => r.ds === PANEL_DS)!.id, OWNER);
    expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
      kind: "hold",
      code: "DUPLICATE_SCOPE_CARD",
    });
    expect(w.journal.get(scopeOp(ev.event_id))?.state).toBe("PREPARED");
  });

  it("11: řádek založený tokenem TARS, ale [nx:M] ≠ N → SCOPE_PROVENANCE_UNPROVEN", async () => {
    const w = makeWorld(dir);
    const { ev, L } = await preparedWithLedger(w);
    cardFromLedger(w, L, BOT, (t) =>
      t.replace(/\[nx:[0-9a-f]+\]/, `[nx:${"8".repeat(32)}]`),
    );
    expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
      kind: "hold",
      code: "SCOPE_PROVENANCE_UNPROVEN",
    });
  });

  it("13: resolver nedostupný nebo mapa chybí → INVALID_IDENTITY, 0 adopcí", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    await expect(
      scopeTick(w.scopeCtx(ev, { point: crashAt("posted") })),
    ).rejects.toThrow();
    w.fake.usersDown = true;
    expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
      kind: "hold",
      code: "INVALID_IDENTITY",
    });
    w.fake.usersDown = false;
    expect(
      await scopeTick(w.scopeCtx(ev, { trusted: undefined })),
    ).toMatchObject({ kind: "hold", code: "INVALID_IDENTITY" });
    expect(w.journal.get(scopeOp(ev.event_id))?.state).toBe("PREPARED");
  });

  it("14: PREPARED bez ledgeru, panel se správně vypadající S → SCOPE_LEDGER_MISSING, 0 nový nonce", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    const L = craftLedger(w, ev);
    cardFromLedger(w, L, BOT);
    w.journal.prepare(scopeOp(ev.event_id), {
      content_hash: L.body_sha256,
      subject: ev.event_id,
    });
    expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
      kind: "hold",
      code: "SCOPE_LEDGER_MISSING",
    });
    expect(fs.existsSync(scopeLedgerFile(dir, ev.event_id))).toBe(false);
  });

  it("6: neúplné čtení panelu v ticku adopce → INBOX_SCAN_INCOMPLETE, 0 adopce", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    await expect(
      scopeTick(w.scopeCtx(ev, { point: crashAt("posted") })),
    ).rejects.toThrow();
    w.fake.onQuery = (ds, _p, r) =>
      ds === PANEL_DS
        ? { ...r, request_status: { type: "incomplete" } }
        : undefined;
    expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
      kind: "hold",
      code: "INBOX_SCAN_INCOMPLETE",
    });
    expect(w.journal.get(scopeOp(ev.event_id))?.state).toBe("PREPARED");
  });

  it("17 (v5): cizí autor se správně opsaným nonce jako jediný kandidát → UNPROVEN; jiná integrace → UNPROVEN; autor chybí → INVALID_IDENTITY", async () => {
    for (const [author, code] of [
      [OWNER, "SCOPE_PROVENANCE_UNPROVEN"],
      [OTHER_BOT, "SCOPE_PROVENANCE_UNPROVEN"],
      [undefined, "INVALID_IDENTITY"],
    ] as const) {
      const sub = fs.mkdtempSync(path.join(dir, "p-"));
      const w = makeWorld(sub);
      const { ev } = await w.ready();
      await expect(
        scopeTick(w.scopeCtx(ev, { point: crashAt("posted") })),
      ).rejects.toThrow();
      const orig = w.fake.rows.find((r) => r.ds === PANEL_DS)!;
      const copy = copyCard(w, orig.id, OWNER);
      w.fake.rows = w.fake.rows.filter((r) => r !== orig); // správná S v koši: fake ji nevrací
      copy.created_by = author;
      expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
        kind: "hold",
        code,
      });
      expect(w.fake.posts()).toHaveLength(1);
    }
  });

  it("16: o původu nerozhoduje ID zakázky ani název (B8 jen z autora, B9 jen z [nx])", async () => {
    const w = makeWorld(dir);
    const trusted = { tars_bot_id: BOT, owner_id: OWNER };
    for (const card of [
      { created_by: { id: OWNER } },
      { created_by: { id: OWNER }, id_zakazky: "rq:x#1", title: "TARS" },
    ]) {
      await expect(checkScopeAuthor(w.http, card, trusted)).rejects.toThrow(
        /SCOPE_PROVENANCE_UNPROVEN/,
      );
    }
    await expect(
      checkScopeAuthor(w.http, { created_by: { id: BOT } }, trusted),
    ).resolves.toBe(BOT);
  });
});

describe("§3.6 ověření po POST: závod se scanem (fake s injekcí)", () => {
  const cases: Array<[string, (w: W, ev: InboxEvent) => void, string]> = [
    [
      "(a) cizí S′ se shodnými značkami",
      (w, ev) =>
        w.fake.addRow(
          PANEL_DS,
          {
            Zakázka: [`x [op:${scopeOp(ev.event_id)}] [ev:${ev.event_id}]`],
            "ID zakázky": [`rq:${ev.request_id}#1`],
          } as never,
          OWNER,
        ),
      "DUPLICATE_SCOPE_CARD",
    ],
    [
      "(b) změna Zadání v R",
      (w, ev) => (w.fake.row(ev.page_id).props["Zadání"] = ["změněno"]),
      "MUTATED",
    ],
    [
      "(c) druhý řádek R2 se stejným request_id#generation",
      (w) => w.fake.addRow(INBOX_DS, inboxProps({}), OWNER),
      "DUPLICATE",
    ],
  ];
  for (const [name, inject, code] of cases) {
    it(`${name} → 1 POST, pak HOLD ${code}, 0 receipt (journal zůstává PREPARED)`, async () => {
      const w = makeWorld(dir);
      const { ev } = await w.ready();
      w.fake.onPost = () => inject(w, ev);
      expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
        kind: "hold",
        code,
      });
      expect(w.fake.posts()).toHaveLength(1);
      expect(w.journal.get(scopeOp(ev.event_id))?.state).toBe("PREPARED");
    });
  }
});

describe("receipt rozhodnutí (návrh v6 §3.2, mapa v2 §3.1 krok 7)", () => {
  async function doneCard(w: W) {
    const { ev } = await w.ready();
    expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({ kind: "done" });
    const S = w.fake.rows.find((r) => r.ds === PANEL_DS)!;
    w.fake.log.length = 0;
    const inp = () => ({
      http: w.http,
      runsDir: w.dir,
      event: ev,
      scopeRecord: w.journal.get(scopeOp(ev.event_id)),
      panel: w.panel,
      trusted: w.trusted,
      read: w.scopeCtx(ev).read,
      lease: w.lease,
      now: w.now,
    });
    return { ev, S, inp };
  }

  it("GO vlastníka na S → scope receipt v2 (binding, source.page_id = S, card_provenance), opakované pozorování = EXISTING; prázdná hodnota = žádný receipt", async () => {
    const w = makeWorld(dir);
    const { ev, S, inp } = await doneCard(w);
    expect(await observeScopeDecision(inp())).toEqual({ kind: "none" });
    S.props["Rozhodnutí vlastníka"] = "GO";
    const a = await observeScopeDecision(inp());
    expect(a).toMatchObject({
      kind: "receipt",
      write: "CREATED",
      receipt: {
        v: 2,
        receipt_kind: "scope",
        value: "GO",
        provenance: "observed",
        card_round: 0,
        source: { page_id: S.id, data_source_id: PANEL_DS },
        source_request_page_id: ev.page_id,
        binding: {
          request_id: ev.request_id,
          generation: 1,
          event_id: ev.event_id,
          payload_hash: ev.payload_hash,
        },
      },
    });
    expect((a as { receipt: DecisionReceipt }).receipt.card_provenance).toEqual(
      { created_by_id: BOT, nonce: ledgerOf(ev).nonce },
    );
    expect(await observeScopeDecision(inp())).toMatchObject({
      kind: "receipt",
      write: "EXISTING",
    });
    expect(
      w.fake.log.filter(
        (l) => l.method !== "GET" && !l.path.endsWith("/query"),
      ),
    ).toHaveLength(0);
  });

  it("5: vlastník smazal značku v titulku S, GO → SCOPE_BINDING_MISMATCH, 0 receipt", async () => {
    const w = makeWorld(dir);
    const { S, inp } = await doneCard(w);
    S.props["Zakázka"] = [
      (S.props["Zakázka"] as string[])[0].replace(/ \[ph:[0-9a-f]+\]/, ""),
    ];
    S.props["Rozhodnutí vlastníka"] = "GO";
    expect(await observeScopeDecision(inp())).toMatchObject({ kind: "hold" });
    expect(fs.existsSync(path.join(dir, "inbox", "decisions"))).toBe(false);
  });

  it("15: S nahrazena kopií (originál v koši, kopie vlastníka i s [nx:N]) → HOLD, 0 receipt", async () => {
    const w = makeWorld(dir);
    const { S, inp } = await doneCard(w);
    const copy = copyCard(w, S.id, OWNER, { "Rozhodnutí vlastníka": "GO" });
    w.fake.rows = w.fake.rows.filter((r) => r !== S);
    const rec = inp();
    rec.scopeRecord = {
      ...rec.scopeRecord!,
      receipt: { url: `https://www.notion.so/${copy.id}` },
    };
    expect((await observeScopeDecision(rec)).kind).toBe("hold");
    expect(fs.existsSync(path.join(dir, "inbox", "decisions"))).toBe(false);
  });

  it("druhy receiptu: míchání polí = RECEIPT_KIND; jiný obsah pod stejným decision_id = RECEIPT_CONFLICT; nečitelný řádek = DECISION_UNREADABLE", async () => {
    const binding = {
      order_id: "wo-r1",
      artifact_kind: "content" as const,
      approved_hash: "a".repeat(64),
    };
    const base: DecisionReceipt = {
      v: 2,
      receipt_kind: "result",
      decision_id: decisionId("result", binding, "https://x", 1, "GO"),
      binding,
      card_url: "https://x",
      card_round: 1,
      value: "GO",
      source: {
        data_source_id: PANEL_DS,
        page_id: "1".repeat(32),
        property: "Rozhodnutí vlastníka",
      },
      observed_at: "t",
      observed_fence: 1,
      provenance: "observed",
      provenance_note: "DR-039: autor selectu neprokázán",
    };
    expect(() => checkReceipt(base)).not.toThrow();
    expect(() => checkReceipt({ ...base, receipt_kind: "scope" })).toThrow(
      /RECEIPT_KIND/,
    );
    expect(() =>
      checkReceipt({
        ...base,
        binding: { ...binding, payload_hash: "b".repeat(64) } as never,
      }),
    ).toThrow(/RECEIPT_KIND/);
    expect(() =>
      checkReceipt({ ...base, receipt_kind: "jiný" as never }),
    ).toThrow(/RECEIPT_KIND/);
    expect(writeDecisionReceipt(dir, base)).toBe("CREATED");
    expect(writeDecisionReceipt(dir, base)).toBe("IDENTICAL");
    expect(() =>
      writeDecisionReceipt(dir, { ...base, observed_at: "jiný čas" }),
    ).toThrow(/RECEIPT_CONFLICT/);
    const w = makeWorld(fs.mkdtempSync(path.join(dir, "r-")));
    const row = w.fake.addRow(PANEL_DS, { Zakázka: ["x"] } as never, BOT);
    row.in_trash = true;
    await expect(readOwnerDecision(w.http, row.id)).rejects.toThrow(
      /DECISION_UNREADABLE/,
    );
  });
});
