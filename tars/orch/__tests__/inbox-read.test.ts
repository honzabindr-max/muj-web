// Etapa 4 PR 3 — úplné čtení Inboxu/panelu (mapa v4 §8.1, testy 1–9) a úplnost hashovaných vlastností (§8.2, 1–11).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotionRestError } from "../notion";
import { InboxHold } from "../inbox/common";
import {
  PayloadIncomplete,
  ScanIncomplete,
  readInboxPayload,
  readSchema,
  readTextProperty,
  scanDataSource,
} from "../inbox/read";
import { scopeOp } from "../inbox/scope";
import { INBOX_DS, inboxProps } from "./inbox-fake";
import { makeWorld } from "./inbox-world";

// víceprocesové a fsync testy: pod plnou zátěží celé sady nestačí výchozích 5 s
vi.setConfig({ testTimeout: 60_000 });

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "inbox-read-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

async function scanSign(
  w: ReturnType<typeof makeWorld>,
  opts = {},
): Promise<string> {
  try {
    await scanDataSource(w.http, INBOX_DS, opts);
    return "complete";
  } catch (e) {
    if (e instanceof ScanIncomplete) return e.sign;
    throw e;
  }
}

describe("§8.1 známky neúplného čtení (S1–S8)", () => {
  it("1: has_more=false + request_status incomplete na první stránce → S1", async () => {
    const w = makeWorld(dir);
    w.addRequest();
    w.fake.onQuery = (_ds, _p, r) => ({
      ...r,
      request_status: { type: "incomplete" },
    });
    expect(await scanSign(w)).toBe("S1");
  });

  it("2: incomplete na třetí stránce ze tří → S1", async () => {
    const w = makeWorld(dir);
    for (let i = 0; i < 5; i++) w.addRequest({ request_id: `rq-${i}` });
    w.fake.onQuery = (_ds, p, r) =>
      p === 2 ? { ...r, request_status: { type: "incomplete" } } : undefined;
    expect(await scanSign(w, { pageSize: 2 })).toBe("S1");
  });

  it("3: neznámý request_status → S2", async () => {
    const w = makeWorld(dir);
    w.addRequest();
    w.fake.onQuery = (_ds, _p, r) => ({
      ...r,
      request_status: { type: "neco_noveho" },
    });
    expect(await scanSign(w)).toBe("S2");
  });

  it("4: 21 stránek s has_more=true → S3", async () => {
    const w = makeWorld(dir);
    for (let i = 0; i < 25; i++) w.addRequest({ request_id: `rq-${i}` });
    expect(await scanSign(w, { pageSize: 1 })).toBe("S3");
  });

  it("5: 429 → S4; 5xx, 408 a síť → S5; deadline ticku → S5", async () => {
    const w = makeWorld(dir);
    w.addRequest();
    for (const [st, sign] of [
      [429, "S4"],
      [503, "S5"],
      [408, "S5"],
      [0, "S5"],
    ] as const) {
      w.fake.onQuery = () => {
        throw new NotionRestError(st, "x");
      };
      expect(await scanSign(w)).toBe(sign);
    }
    w.fake.onQuery = undefined;
    expect(await scanSign(w, { deadline: () => true })).toBe("S5");
  });

  it("6: has_more bez next_cursor → S6; opakovaný kurzor → S6; next_cursor při has_more=false → S6", async () => {
    const w = makeWorld(dir);
    for (let i = 0; i < 4; i++) w.addRequest({ request_id: `rq-${i}` });
    w.fake.onQuery = (_ds, _p, r) => ({
      ...r,
      has_more: true,
      next_cursor: null,
    });
    expect(await scanSign(w, { pageSize: 2 })).toBe("S6");
    w.fake.onQuery = (_ds, _p, r) => ({
      ...r,
      has_more: true,
      next_cursor: "2",
    });
    expect(await scanSign(w, { pageSize: 2 })).toBe("S6");
    w.fake.onQuery = (_ds, _p, r) => ({
      ...r,
      has_more: false,
      next_cursor: "x",
    });
    expect(await scanSign(w, { pageSize: 10 })).toBe("S6");
  });

  it("7: chybí results, object ≠ list, víc výsledků než page_size → S7", async () => {
    const w = makeWorld(dir);
    w.addRequest();
    w.addRequest({ request_id: "rq-2" });
    w.fake.onQuery = (_ds, _p, r) => ({ ...r, results: undefined });
    expect(await scanSign(w)).toBe("S7");
    w.fake.onQuery = (_ds, _p, r) => ({ ...r, object: "page" });
    expect(await scanSign(w)).toBe("S7");
    w.fake.onQuery = (_ds, _p, r) => ({
      ...r,
      results: [...(r.results as unknown[]), ...(r.results as unknown[])],
    });
    expect(await scanSign(w, { pageSize: 2 })).toBe("S7");
  });

  it("S8: stejné page_id dvakrát v jednom průchodu", async () => {
    const w = makeWorld(dir);
    w.addRequest();
    w.addRequest({ request_id: "rq-2" });
    w.addRequest({ request_id: "rq-3" });
    w.fake.onQuery = (_ds, p, r) =>
      p === 1
        ? { ...r, results: [w.fake.pageObject(w.fake.rows[0])] }
        : undefined;
    expect(await scanSign(w, { pageSize: 2 })).toBe("S8");
  });

  it("8: kontrolní — 2 stránky, poslední has_more=false, bez request_status → úplné", async () => {
    const w = makeWorld(dir);
    for (let i = 0; i < 3; i++) w.addRequest({ request_id: `rq-${i}` });
    const s = await scanDataSource(w.http, INBOX_DS, { pageSize: 2 });
    expect(s.rows).toHaveLength(3);
  });

  it("9: neúplné čtení při journalu scope-card PREPARED → jen INBOX_SCAN_INCOMPLETE, žádná adopce ani SCOPE_CARD_UNKNOWN", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    w.journal.prepare(scopeOp(ev.event_id), {
      content_hash: "0".repeat(64),
      subject: ev.event_id,
    });
    w.fake.onQuery = (_ds, _p, r) => ({
      ...r,
      request_status: { type: "incomplete" },
    });
    const { scopeTick } = await import("../inbox/scope");
    const out = await scopeTick(w.scopeCtx(ev));
    expect(out).toMatchObject({ kind: "hold", code: "INBOX_SCAN_INCOMPLETE" });
    expect(w.fake.posts()).toHaveLength(0);
    expect(w.journal.get(scopeOp(ev.event_id))?.state).toBe("PREPARED");
  });
});

async function payloadSign(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "complete";
  } catch (e) {
    if (e instanceof PayloadIncomplete) return e.sign;
    if (e instanceof InboxHold) return e.code;
    throw e;
  }
}

describe("§8.2 úplnost hashovaných vlastností (U1–U7, P1–P8)", () => {
  async function rowAndSchema(
    w: ReturnType<typeof makeWorld>,
    zadani: string[],
  ) {
    const r = w.fake.addRow(INBOX_DS, inboxProps({ zadani }));
    const scan = await scanDataSource(w.http, INBOX_DS);
    return {
      r,
      row: scan.rows.find((x) => x.id === r.id)!,
      schema: await readSchema(w.http, INBOX_DS),
    };
  }

  it("1: Zadání má 3 segmenty, page object nese jen první; hash ze všech 3; změna 3. segmentu → jiný hash", async () => {
    const w = makeWorld(dir);
    const { r, row, schema } = await rowAndSchema(w, ["a", "b", "c"]);
    expect((row.properties["Zadání"].rich_text as unknown[]).length).toBe(1);
    const h1 = (await readInboxPayload(w.http, row, schema)).payload_hash;
    r.props["Zadání"] = ["a", "b", "X"];
    const h2 = (await readInboxPayload(w.http, row, schema)).payload_hash;
    expect(h1).not.toBe(h2);
  });

  it("2: page_size=2, 5 segmentů na 3 stránkách → úplné; změna posledního → jiný hash", async () => {
    const w = makeWorld(dir);
    const { r } = await rowAndSchema(w, ["1", "2", "3", "4", "5"]);
    const t = await readTextProperty(w.http, r.id, "zad", "rich_text", {
      pageSize: 2,
    });
    expect(t.segments).toEqual(["1", "2", "3", "4", "5"]);
    r.props["Zadání"] = ["1", "2", "3", "4", "6"];
    expect(
      (
        await readTextProperty(w.http, r.id, "zad", "rich_text", {
          pageSize: 2,
        })
      ).segments.at(-1),
    ).toBe("6");
  });

  it("3: stejný text, jiné dělení na segmenty → jiný hash (U6, deterministicky)", async () => {
    const w = makeWorld(dir);
    const a = await rowAndSchema(w, ["ab", "c"]);
    const h1 = (await readInboxPayload(w.http, a.row, a.schema)).payload_hash;
    a.r.props["Zadání"] = ["a", "bc"];
    expect(
      (await readInboxPayload(w.http, a.row, a.schema)).payload_hash,
    ).not.toBe(h1);
  });

  it("4: has_more=true, next_cursor=null → P4 (PAYLOAD_INCOMPLETE)", async () => {
    const w = makeWorld(dir);
    const { r } = await rowAndSchema(w, ["a"]);
    w.fake.onProp = (_p, _id, _n, resp) => ({
      ...resp,
      has_more: true,
      next_cursor: null,
    });
    expect(
      await payloadSign(() =>
        readTextProperty(w.http, r.id, "zad", "rich_text"),
      ),
    ).toBe("P4");
    w.fake.onProp = (_p, _id, _n, resp) => ({
      ...resp,
      has_more: true,
      next_cursor: "0",
    });
    expect(
      await payloadSign(() =>
        readTextProperty(w.http, r.id, "zad", "rich_text", { pageSize: 1 }),
      ),
    ).toBe("P4");
  });

  it("5: 101 segmentů → P6; 20 001 znaků → P6; nikdy zkrácený hash", async () => {
    const w = makeWorld(dir);
    const { r, row, schema } = await rowAndSchema(
      w,
      Array.from({ length: 101 }, (_, i) => `s${i}`),
    );
    expect(await payloadSign(() => readInboxPayload(w.http, row, schema))).toBe(
      "P6",
    );
    r.props["Zadání"] = ["x".repeat(20_001)];
    expect(await payloadSign(() => readInboxPayload(w.http, row, schema))).toBe(
      "P6",
    );
  });

  it("6: Zadání chybí v page objectu → P1; typ změněn na select → P1", async () => {
    const w = makeWorld(dir);
    const { row, schema } = await rowAndSchema(w, ["a"]);
    const rest = { ...row.properties };
    delete rest["Zadání"];
    expect(
      await payloadSign(() =>
        readInboxPayload(w.http, { ...row, properties: rest }, schema),
      ),
    ).toBe("P1");
    expect(
      await payloadSign(() =>
        readInboxPayload(w.http, row, {
          ...schema,
          Zadání: { id: "zad", type: "select" },
        }),
      ),
    ).toBe("P1");
  });

  it("7: 429 nebo timeout na endpointu vlastnosti → P3", async () => {
    const w = makeWorld(dir);
    const { row, schema } = await rowAndSchema(w, ["a"]);
    for (const st of [429, 0]) {
      w.fake.onProp = () => {
        throw new NotionRestError(st, "x");
      };
      expect(
        await payloadSign(() => readInboxPayload(w.http, row, schema)),
      ).toBe("P3");
    }
    w.fake.onProp = undefined;
    expect(
      await payloadSign(() =>
        readInboxPayload(w.http, row, schema, { deadline: () => true }),
      ),
    ).toBe("P7");
  });

  it("8: výsledek s jiným type než vlastnost → P5; request_status ≠ complete → P8", async () => {
    const w = makeWorld(dir);
    const { r } = await rowAndSchema(w, ["a"]);
    w.fake.onProp = (_p, _id, _n, resp) => ({
      ...resp,
      results: [
        {
          object: "property_item",
          id: "zad",
          type: "title",
          title: { plain_text: "a" },
        },
      ],
    });
    expect(
      await payloadSign(() =>
        readTextProperty(w.http, r.id, "zad", "rich_text"),
      ),
    ).toBe("P5");
    w.fake.onProp = (_p, _id, _n, resp) => ({
      ...resp,
      request_status: { type: "incomplete" },
    });
    expect(
      await payloadSign(() =>
        readTextProperty(w.http, r.id, "zad", "rich_text"),
      ),
    ).toBe("P8");
  });

  it("11: statický test — hash jen z výstupu čtečky; v inbox/ se title/rich_text nečte z page objectu", () => {
    const src = fs
      .readdirSync(path.join(__dirname, "..", "inbox"))
      .map((f) =>
        fs.readFileSync(path.join(__dirname, "..", "inbox", f), "utf8"),
      )
      .join("\n");
    expect(src).not.toMatch(/properties\[[^\]]+\]\??\.(rich_text|title)\b/);
    expect(src).not.toMatch(
      /properties\.[A-Za-zá-ž_]+\??\.(rich_text|title)\b/,
    );
    const payloadFn = fs.readFileSync(
      path.join(__dirname, "..", "inbox", "read.ts"),
      "utf8",
    );
    expect(payloadFn).toMatch(
      /values\[name\]\s*=\s*\(\s*await readTextProperty\(/,
    );
    expect(payloadFn).toMatch(
      /payload_hash:\s*sha256Hex\(canonicalJson\(values\)\)/,
    );
  });
});
