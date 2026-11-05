// Krok 5 (DR-029): Notion REST s tokenem z macOS Klíčenky. Nic nevolá skutečný Notion ani Klíčenku:
// fetch i `security` jsou mocky.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AdapterResult, TextAdapter } from "../adapters";
import {
  assertNoSecret,
  checkRestAccess,
  HybridNotion,
  makeNotionStack,
  McpNotion,
  NO_TOKEN_MESSAGE,
  NOTION_API_VERSION,
  NotionRestApi,
  NotionRestError,
  RestNotion,
  SecretLeakError,
} from "../notion";
import { KEYCHAIN_ARGS, readNotionToken } from "../notion-token";
import { childEnv, NOTION_QUERY_TOOLS_DENIED } from "../adapters";
import { HybridPanelSink, McpPanelSink, panelRow, PANEL_DATA_SOURCE_ID, rowToRestProperties, RestPanelSink, type PanelRow, type PanelSink } from "../panel";
import { clearKnownSecrets, redactDeep, redactSecrets, scanSecrets } from "../secret-scan";
import { Store } from "../store";
import type { Order } from "../types";

// Fake token shaped like a real one; built at runtime so no scanner flags this file.
const TOKEN = ["ntn", "_", "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3"].join("");
const ODD_TOKEN = "zcela-jiny-format-tokenu-bez-prefixu-1234567890";
const NOW = "2026-11-02T12:00:00.000Z";
const order = (state: Order["state"] = "DOING"): Order => ({ id: "wo-t", mission: "m", state, created_at: NOW, updated_at: NOW, fix_rounds: 0, manual_interventions: 0, history: [], meta: {} });

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}
type Responder = (c: Call) => { status: number; json?: unknown } | Error;
function mockFetch(responder: Responder) {
  const calls: Call[] = [];
  const fn = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
    const c = { url, method: init.method, headers: init.headers, body: init.body };
    calls.push(c);
    const r = responder(c);
    if (r instanceof Error) throw r;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.json ?? {} };
  };
  return { calls, fn };
}

class StubTransport implements TextAdapter {
  name = "stub";
  model = "sonnet";
  family = "claude" as const;
  prompts: string[] = [];
  async run(prompt: string): Promise<AdapterResult> {
    this.prompts.push(prompt);
    return { ok: true, text: "https://app.notion.com/p/viamcp", limit: false, duration_ms: 1 };
  }
}

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-notion-"));
  clearKnownSecrets();
});
afterEach(() => {
  clearKnownSecrets();
  delete process.env.NOTION_TOKEN;
});

describe("token z macOS Klíčenky", () => {
  it("čte přesně `security find-generic-password -s tars-notion -a tars -w` bez shellu", () => {
    const seen: Array<{ file: string; args: readonly string[] }> = [];
    const t = readNotionToken({ platform: "darwin", run: (file, args) => (seen.push({ file, args }), `${TOKEN}\n`) });
    expect(t).toBe(TOKEN);
    expect(seen).toEqual([{ file: "security", args: ["find-generic-password", "-s", "tars-notion", "-a", "tars", "-w"] }]);
    expect(KEYCHAIN_ARGS.join(" ")).not.toContain(TOKEN);
  });

  it("token chybí (položka nenalezena, zamčená Klíčenka, nedarwin, divná hodnota) → undefined, bez výjimky", () => {
    const boom = () => {
      throw new Error("security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.");
    };
    expect(readNotionToken({ platform: "darwin", run: boom })).toBeUndefined();
    expect(readNotionToken({ platform: "linux", run: () => TOKEN })).toBeUndefined();
    expect(readNotionToken({ platform: "darwin", run: () => "\n" })).toBeUndefined();
    expect(readNotionToken({ platform: "darwin", run: () => "kratke" })).toBeUndefined();
    expect(readNotionToken({ platform: "darwin", run: () => "obsahuje mezeru a je dlouhy dost" })).toBeUndefined();
  });

  it("NOTION_TOKEN z prostředí se nepoužije (nikdy z .env)", () => {
    process.env.NOTION_TOKEN = TOKEN;
    expect(readNotionToken({ platform: "darwin", run: () => { throw new Error("none"); } })).toBeUndefined();
    const { fn } = mockFetch(() => ({ status: 200 }));
    const logs: string[] = [];
    const stack = makeNotionStack(new StubTransport(), dir, { token: undefined, log: (m) => logs.push(m), fetchImpl: fn });
    expect(stack.mode).toBe("fallback");
    expect(stack.rest).toBeUndefined();
  });

  it("načtený token se zaregistruje do secret-scanu", () => {
    readNotionToken({ platform: "darwin", run: () => ODD_TOKEN });
    expect(scanSecrets(`x ${ODD_TOKEN} y`)).toEqual({ clean: false, kinds: ["loaded_credential"] });
  });
});

describe("fallback bez tokenu", () => {
  it("do logu přesně „Notion REST: token chybí, používám fallback“ a funguje cesta přes claude -p", async () => {
    const logs: string[] = [];
    const t = new StubTransport();
    const stack = makeNotionStack(t, dir, { log: (m) => logs.push(m) });
    expect(logs).toEqual(["Notion REST: token chybí, používám fallback"]);
    expect(NO_TOKEN_MESSAGE).toBe("Notion REST: token chybí, používám fallback");
    expect(stack.mode).toBe("fallback");
    expect(stack.notion).toBeInstanceOf(McpNotion);
    const page = await stack.notion.createPage("parent", "Titulek", "# Obsah");
    expect(page.url).toBe("https://app.notion.com/p/viamcp");
    expect(t.prompts[0]).toContain("notion-create-pages");
  });
});

describe("zápis stránek přes REST", () => {
  it("POST /v1/pages s Bearer v hlavičce, verzí API a markdownem; token jen v Authorization", async () => {
    const f = mockFetch(() => ({ status: 200, json: { url: "https://www.notion.so/abc" } }));
    const stack = makeNotionStack(new StubTransport(), dir, { token: TOKEN, fetchImpl: f.fn });
    expect(stack.mode).toBe("rest");
    const page = await stack.notion.createPage("parent-id", "DRAFT — Test", "## Nadpis\n\n- bod");
    expect(page.url).toBe("https://www.notion.so/abc");
    expect(f.calls).toHaveLength(1);
    const c = f.calls[0];
    expect(c.url).toBe("https://api.notion.com/v1/pages");
    expect(c.method).toBe("POST");
    expect(c.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(c.headers["Notion-Version"]).toBe(NOTION_API_VERSION);
    const body = JSON.parse(c.body!);
    expect(body.parent).toEqual({ type: "page_id", page_id: "parent-id" });
    expect(body.markdown).toBe("## Nadpis\n\n- bod");
    expect(body.properties.title.title[0].text.content).toBe("DRAFT — Test");
    expect(c.body).not.toContain(TOKEN);
  });

  it("stránka mimo sdílení integrace (404/403) a odmítnutí před zápisem (401, 429) → jen ten jeden zápis jde přes fallback", async () => {
    for (const status of [404, 403, 401, 429]) {
      const f = mockFetch(() => ({ status, json: { code: "object_not_found" } }));
      const t = new StubTransport();
      const logs: string[] = [];
      const stack = makeNotionStack(t, dir, { token: TOKEN, fetchImpl: f.fn, log: (m) => logs.push(m) });
      const page = await stack.notion.createPage("p", "T", "x");
      expect(page.url).toBe("https://app.notion.com/p/viamcp");
      expect(f.calls).toHaveLength(1);
      expect(logs).toEqual([`Notion REST: notion REST ${status} object_not_found, používám fallback`]);
      await stack.notion.createPage("p", "T2", "x");
      // 404/403: další zápis zkusí REST znovu; 401 (špatný token) a 429 (limit sdílený s workspace) REST do konce běhu vypnou
      expect(f.calls).toHaveLength(status === 401 || status === 429 ? 1 : 2);
    }
  });

  it("nejasný výsledek vytvoření (5xx, síť, rozbité tělo) se naslepo neopakuje přes MCP, aby nevznikl duplikát", async () => {
    for (const r of [{ status: 502, json: { code: "service_unavailable" } }, { status: 500 }, new Error(`reset ${TOKEN}`)]) {
      const f = mockFetch(() => r);
      const t = new StubTransport();
      const stack = makeNotionStack(t, dir, { token: TOKEN, fetchImpl: f.fn });
      await expect(stack.notion.createPage("p", "T", "x")).rejects.toBeInstanceOf(NotionRestError);
      expect(t.prompts).toHaveLength(0);
    }
    const bad = { ok: true, status: 200, json: async () => { throw new Error(`Unexpected token ${TOKEN}`); } };
    const err = await new NotionRestApi(TOKEN, (async () => bad) as never).request("GET", "/v1/pages/x").catch((e: unknown) => e);
    expect((err as Error).message).toBe("notion REST 200 bad_response");
  });

  it("503 po uložení stránky (committed_resource_id) = stránka existuje, nevzniká druhá", async () => {
    const f = mockFetch(() => ({ status: 503, json: { code: "service_unavailable", additional_data: { committed_resource_id: "11111111-2222-3333-4444-555555555555" } } }));
    const t = new StubTransport();
    const stack = makeNotionStack(t, dir, { token: TOKEN, fetchImpl: f.fn });
    expect((await stack.notion.createPage("p", "T", "x")).url).toBe("https://www.notion.so/11111111222233334444555555555555");
    expect(t.prompts).toHaveLength(0);
    const sink = new RestPanelSink(new NotionRestApi(TOKEN, f.fn));
    expect(await sink.upsert(panelRow(order(), "a", "b"))).toBe("11111111222233334444555555555555");
  });

  it("chyba zadání (400) fallback nespustí", async () => {
    const f = mockFetch(() => ({ status: 400, json: { code: "validation_error" } }));
    const t = new StubTransport();
    const stack = makeNotionStack(t, dir, { token: TOKEN, fetchImpl: f.fn });
    await expect(stack.notion.createPage("p", "T", "x")).rejects.toThrow("notion REST 400 validation_error");
    expect(t.prompts).toHaveLength(0);
  });

  it("čtení (HANDOFF, zdroje) zůstává na MCP", async () => {
    const f = mockFetch(() => ({ status: 200 }));
    const stack = makeNotionStack(new StubTransport(), dir, { token: TOKEN, fetchImpl: f.fn });
    expect(stack.notion).toBeInstanceOf(HybridNotion);
    expect(typeof stack.notion.fetchPage).toBe("function");
    expect(new RestNotion(new NotionRestApi(TOKEN, f.fn))).not.toHaveProperty("fetchPage");
  });
});

describe("řádek panelu přes REST", () => {
  const row = (o = order()) => panelRow({ ...o, brief: { title: "Zakázka", department: "copy", milestone: "3.1", why: "w", goal: "g", inputs: [], acceptance: [], owner_decisions: [], sources: [] }, owner_card_url: "https://app.notion.com/p/karta" }, "gpt", "opus");

  it("nový řádek: parent data_source_id, typované vlastnosti, nikdy „Rozhodnutí vlastníka“", async () => {
    const f = mockFetch(() => ({ status: 200, json: { id: "11111111-2222-3333-4444-555555555555" } }));
    const sink = new RestPanelSink(new NotionRestApi(TOKEN, f.fn));
    const id = await sink.upsert(row());
    expect(id).toBe("11111111222233334444555555555555");
    const b = JSON.parse(f.calls[0].body!);
    expect(f.calls[0].method).toBe("POST");
    expect(b.parent).toEqual({ type: "data_source_id", data_source_id: PANEL_DATA_SOURCE_ID });
    expect(b.properties["Kde běží"]).toEqual({ select: { name: "Mac" } });
    expect(b.properties["Karta rozhodnutí"]).toEqual({ url: "https://app.notion.com/p/karta" });
    expect(b.properties["Proč tento model"].rich_text[0].text.content).toContain("gpt");
    expect(b.properties.Stav).toEqual({ select: { name: "DOING" } });
    expect(b.properties["Čeká na vlastníka"]).toEqual({ checkbox: false });
    expect(b.properties["Poslední změna"]).toEqual({ date: { start: NOW } });
    expect(b.properties.Zakázka.title[0].text.content).toBe("Zakázka");
    expect(Object.keys(b.properties)).not.toContain("Rozhodnutí vlastníka");
    expect(f.calls[0].body).not.toContain("Rozhodnutí vlastníka");
  });

  it("aktualizace řádku: PATCH jen vlastností orchestrátoru; pole vlastníka se nepřepíše", async () => {
    const f = mockFetch(() => ({ status: 200, json: {} }));
    const sink = new RestPanelSink(new NotionRestApi(TOKEN, f.fn));
    const r = row(order("WAITING_OWNER"));
    expect(await sink.upsert(r, "pageid")).toBe("pageid");
    expect(f.calls[0].method).toBe("PATCH");
    expect(f.calls[0].url).toBe("https://api.notion.com/v1/pages/pageid");
    const props = Object.keys(JSON.parse(f.calls[0].body!).properties).sort();
    expect(props).toEqual(Object.keys(rowToRestProperties(r)).sort());
    expect(props).not.toContain("Rozhodnutí vlastníka");
    expect(props).toHaveLength(18);
  });

  it("čtení rozhodnutí: GET stránky, hodnota selectu; prázdné a smazané řádky = nic", async () => {
    const pages: Record<string, unknown> = {
      a: { properties: { "Rozhodnutí vlastníka": { select: { name: "GO B" } } } },
      b: { properties: { "Rozhodnutí vlastníka": { select: null } } },
      c: { in_trash: true, properties: { "Rozhodnutí vlastníka": { select: { name: "GO" } } } },
    };
    const f = mockFetch((c) => ({ status: 200, json: pages[c.url.split("/").pop()!] }));
    const sink = new RestPanelSink(new NotionRestApi(TOKEN, f.fn));
    expect(await sink.readOwnerDecision("a")).toBe("GO B");
    expect(await sink.readOwnerDecision("b")).toBeUndefined();
    expect(await sink.readOwnerDecision("c")).toBeUndefined();
    expect(f.calls.every((c) => c.method === "GET" && c.body === undefined)).toBe(true);
  });

  it("HybridPanelSink: odmítnutí před zápisem (404/401/429) jde přes MCP; update řádku i po 5xx/síti, vytvoření řádku po 5xx ne", async () => {
    for (const status of [404, 401, 429]) {
      const f = mockFetch(() => ({ status, json: { code: "object_not_found" } }));
      const written: PanelRow[] = [];
      const mcp: PanelSink = { upsert: async (r) => (written.push(r), "mcpid"), readOwnerDecision: async () => "GO" };
      const logs: string[] = [];
      const sink = new HybridPanelSink(new RestPanelSink(new NotionRestApi(TOKEN, f.fn)), mcp, (m) => logs.push(m));
      expect(await sink.upsert(row())).toBe("mcpid");
      expect(written).toHaveLength(1);
      expect(logs.length).toBeGreaterThan(0);
    }
    for (const r of [{ status: 502 }, new Error("ECONNRESET")]) {
      const f = mockFetch(() => r);
      const written: PanelRow[] = [];
      const mcp: PanelSink = { upsert: async (x) => (written.push(x), "mcpid") };
      const sink = new HybridPanelSink(new RestPanelSink(new NotionRestApi(TOKEN, f.fn)), mcp, () => undefined);
      expect(await sink.upsert(row(), "known-page")).toBe("mcpid"); // PATCH celého řádku je bezpečné opakovat
      await expect(sink.upsert(row())).rejects.toBeInstanceOf(NotionRestError); // POST nového řádku nejistého výsledku ne
      expect(written).toHaveLength(1);
    }
  });

  it("řádek s tokenem jde vymazaný i do fallbacku (MCP sink dostane kopii bez tokenu)", async () => {
    const f = mockFetch(() => ({ status: 404, json: { code: "object_not_found" } }));
    const seen: PanelRow[] = [];
    const mcp: PanelSink = { upsert: async (r) => (seen.push(r), "mcpid") };
    const sink = new HybridPanelSink(new RestPanelSink(new NotionRestApi(TOKEN, f.fn)), mcp, () => undefined);
    const r = row();
    r["Poslední krok"] = `Zastaveno: ${TOKEN}`;
    await sink.upsert(r);
    expect(JSON.stringify(seen)).not.toContain(TOKEN);
    expect(JSON.stringify(seen)).toContain("[skryto: citlivý údaj]");
  });

  it("McpPanelSink.upsert nevloží token do promptu pro claude -p", async () => {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), "fake-claude-"));
    const sink = path.join(bin, "stdin.txt");
    fs.writeFileSync(path.join(bin, "claude"), `#!/bin/bash\ncat >> "${sink}"\nprintf '%s\\n' "$@" >> "${sink}"\necho '{}'\n`, { mode: 0o755 });
    const old = process.env.PATH;
    process.env.PATH = `${bin}:${old}`;
    try {
      readNotionToken({ platform: "darwin", run: () => TOKEN });
      const r = row();
      r["Poslední krok"] = `selhalo ${TOKEN}`;
      await new McpPanelSink(dir).upsert(r).catch(() => undefined);
    } finally {
      process.env.PATH = old;
    }
    const seen = fs.readFileSync(sink, "utf8");
    expect(seen).toContain("notion-create-pages");
    expect(seen).not.toContain(TOKEN);
    expect(seen).toContain(NOTION_QUERY_TOOLS_DENIED); // SQL/rows nástroje Notionu jsou zakázané
  });

  it("Notion: zapsaný řádek obsahuje jen sloupce, které schéma „TARS — Zakázky“ zná", () => {
    const known = new Set(["Zakázka", "ID zakázky", "Mise", "Oddělení", "Stav", "Fronta", "Tvůrce (model)", "Kontrolor (model)", "Kolo oprav", "Poslední krok", "Start", "Poslední změna", "Ruční zásahy", "Odkaz na výstup", "Čeká na vlastníka", "Kde běží", "Proč tento model", "Karta rozhodnutí"]);
    expect(Object.keys(rowToRestProperties(row())).every((k) => known.has(k))).toBe(true);
  });
});

describe("secret-scan: token nesmí ven (log ani Notion)", () => {
  it("rozpozná formát ntn_/secret_ i přesnou načtenou hodnotu a umí ji vymazat", () => {
    expect(scanSecrets(`token ${TOKEN}`).kinds).toContain("notion_token");
    expect(scanSecrets(["secret", "_", "a".repeat(43)].join("")).kinds).toContain("notion_token");
    readNotionToken({ platform: "darwin", run: () => ODD_TOKEN });
    expect(scanSecrets(`Bearer ${ODD_TOKEN}`).clean).toBe(false);
    expect(redactSecrets(`a ${ODD_TOKEN} b ${TOKEN}`)).not.toMatch(/zcela-jiny|ntn_A1b2/);
    expect(JSON.stringify(redactDeep({ k: [`x ${ODD_TOKEN}`], [ODD_TOKEN]: 1 }))).not.toContain(ODD_TOKEN);
  });

  it("log.jsonl: token v jakémkoli poli záznamu se uloží vymazaný", () => {
    readNotionToken({ platform: "darwin", run: () => ODD_TOKEN });
    const store = new Store(dir);
    store.log({ ts: NOW, order: "wo-t", kind: "error", role: "transport", result: `fail ${TOKEN}`, reason: `Authorization: Bearer ${ODD_TOKEN}` });
    const raw = fs.readFileSync(path.join(dir, "log.jsonl"), "utf8");
    expect(raw).not.toContain(TOKEN);
    expect(raw).not.toContain(ODD_TOKEN);
    expect(raw).toContain("[skryto: citlivý údaj]");
  });

  it("obsah stránky s tokenem se do Notionu neodešle (ani REST, ani fallback), zápis skončí chybou", async () => {
    const f = mockFetch(() => ({ status: 200, json: { url: "u" } }));
    const t = new StubTransport();
    const stack = makeNotionStack(t, dir, { token: TOKEN, fetchImpl: f.fn });
    await expect(stack.notion.createPage("p", "T", `ukázka klíče ${TOKEN}`)).rejects.toBeInstanceOf(SecretLeakError);
    await expect(stack.notion.createPage("p", `T ${TOKEN}`, "x")).rejects.toBeInstanceOf(SecretLeakError);
    expect(f.calls).toHaveLength(0);
    expect(t.prompts).toHaveLength(0);
    const direct = new RestNotion(new NotionRestApi(TOKEN, f.fn));
    await expect(direct.createPage("p", "T", TOKEN)).rejects.toBeInstanceOf(SecretLeakError);
    expect(() => assertNoSecret("čistý text")).not.toThrow();
  });

  it("řádek panelu s tokenem se pošle vymazaný (REST)", async () => {
    const f = mockFetch(() => ({ status: 200, json: { id: "abc" } }));
    const sink = new RestPanelSink(new NotionRestApi(TOKEN, f.fn));
    const r = panelRow({ ...order(), failure_reason: `selhalo s ${TOKEN}` }, "gpt", "opus");
    r["Poslední krok"] = `Zastaveno: ${TOKEN}`;
    await sink.upsert(r);
    expect(f.calls[0].body).not.toContain(TOKEN);
    expect(f.calls[0].body).toContain("[skryto: citlivý údaj]");
  });

  it("chybové zprávy REST nenesou token ani tělo odpovědi, jen status a kód", async () => {
    const f = mockFetch(() => ({ status: 400, json: { code: `validation_error ${TOKEN}`, message: `Bearer ${TOKEN}` } }));
    const api = new NotionRestApi(TOKEN, f.fn);
    const e = await api.request("GET", "/v1/pages/x").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(NotionRestError);
    expect((e as Error).message).not.toContain(TOKEN);
    expect((e as Error).message).toBe("notion REST 400 error");
    expect(JSON.stringify(e)).not.toContain(TOKEN);
  });

  it("notion-check: výstup neobsahuje token (OK, 401, 404, síť)", async () => {
    for (const [status, text] of [[200, "token platný"], [401, "neplatný"], [404, "není integraci sdílena"]] as const) {
      const f = mockFetch(() => ({ status, json: { code: "x" } }));
      const r = await checkRestAccess(new NotionRestApi(TOKEN, f.fn));
      expect(r.detail).toContain(text);
      expect(r.detail).not.toContain(TOKEN);
      expect(r.ok).toBe(status === 200);
      expect(f.calls[0].url).toContain("/v1/pages/4070ae49f5078162bcbfd77800b421ec");
    }
    const net = mockFetch(() => new Error(TOKEN));
    expect((await checkRestAccess(new NotionRestApi(TOKEN, net.fn))).detail).not.toContain(TOKEN);
  });

  it("celý životní cyklus zakázky přes REST: v žádném odeslaném těle ani v logu není token", async () => {
    const f = mockFetch(() => ({ status: 200, json: { id: "pid", url: "https://www.notion.so/x" } }));
    const api = new NotionRestApi(TOKEN, f.fn);
    const sink = new RestPanelSink(api);
    const store = new Store(dir);
    let id: string | undefined;
    for (const st of ["NEW", "DOING", "WAITING_OWNER", "DONE"] as const) {
      id = await sink.upsert(panelRow(order(st), "gpt", "opus"), id);
      store.log({ ts: NOW, order: "wo-t", kind: "info", role: "transport", result: `panel ${st}` });
    }
    await new RestNotion(api).createPage("p", "KARTA", "## Co\n\nvýstup");
    expect(f.calls.length).toBe(5);
    for (const c of f.calls) expect(c.body ?? "").not.toContain(TOKEN);
    expect(fs.readFileSync(path.join(dir, "log.jsonl"), "utf8")).not.toContain(TOKEN);
  });
});


describe("rozhodnutí vlastníka a dohledání řádku jen přes REST", () => {
  it("McpPanelSink rozhodnutí vůbec nečte a nehledá (nemá readOwnerDecision ani findRowByOrderId)", () => {
    const mcp = new McpPanelSink(dir);
    expect((mcp as unknown as PanelSink).readOwnerDecision).toBeUndefined();
    expect((mcp as unknown as PanelSink).findRowByOrderId).toBeUndefined();
  });

  it("HybridPanelSink: čtení rozhodnutí a hledání řádku při chybě REST skončí chybou, MCP se nevolá", async () => {
    for (const status of [404, 401, 429, 502]) {
      const f = mockFetch(() => ({ status, json: { code: "object_not_found" } }));
      const mcp = { upsert: async () => "x", readOwnerDecision: async () => "GO", findRowByOrderId: async () => "y" } as PanelSink;
      let touched = 0;
      for (const k of ["readOwnerDecision", "findRowByOrderId", "upsert"] as const) {
        const orig = mcp[k] as (...a: unknown[]) => Promise<string | undefined>;
        (mcp as unknown as Record<string, unknown>)[k] = async (...a: unknown[]) => (touched++, orig(...a));
      }
      const sink = new HybridPanelSink(new RestPanelSink(new NotionRestApi(TOKEN, f.fn)), mcp, () => undefined);
      await expect(sink.readOwnerDecision("p")).rejects.toBeInstanceOf(NotionRestError);
      await expect(sink.findRowByOrderId("wo-1")).rejects.toBeInstanceOf(NotionRestError);
      expect(touched).toBe(0);
    }
  });

  it("findRowByOrderId stránkuje podle has_more a kurzoru; nalezený řádek na další stránce se najde", async () => {
    const pages: Record<string, unknown> = {
      first: { results: [], has_more: true, next_cursor: "c2" },
      c2: { results: [{ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", in_trash: true }], has_more: true, next_cursor: "c3" },
      c3: { results: [{ id: "11111111-2222-3333-4444-555555555555" }], has_more: false, next_cursor: null },
    };
    const f = mockFetch((c) => ({ status: 200, json: pages[(JSON.parse(c.body!).start_cursor as string | undefined) ?? "first"] }));
    expect(await new RestPanelSink(new NotionRestApi(TOKEN, f.fn)).findRowByOrderId("wo-1")).toBe("11111111222233334444555555555555");
    expect(f.calls.map((c) => JSON.parse(c.body!).start_cursor)).toEqual([undefined, "c2", "c3"]);
  });

  it("findRowByOrderId: limit stránek, has_more bez kurzoru nebo chyba uprostřed = „nelze ověřit“, nikdy „neexistuje“", async () => {
    const endless = mockFetch(() => ({ status: 200, json: { results: [], has_more: true, next_cursor: "again" } }));
    await expect(new RestPanelSink(new NotionRestApi(TOKEN, endless.fn)).findRowByOrderId("wo-1")).rejects.toThrow(/nelze ověřit/);
    expect(endless.calls).toHaveLength(2); // etapa 4 PR 3: opakovaný kurzor (S6) se pozná hned, ne až na limitu stránek
    let k = 0;
    const endlessDistinct = mockFetch(() => ({ status: 200, json: { results: [], has_more: true, next_cursor: `c${++k}` } }));
    await expect(new RestPanelSink(new NotionRestApi(TOKEN, endlessDistinct.fn)).findRowByOrderId("wo-1")).rejects.toThrow(/nelze ověřit/);
    expect(endlessDistinct.calls).toHaveLength(5); // the page limit
    const noCursor = mockFetch(() => ({ status: 200, json: { results: [], has_more: true, next_cursor: null } }));
    await expect(new RestPanelSink(new NotionRestApi(TOKEN, noCursor.fn)).findRowByOrderId("wo-1")).rejects.toThrow(/nelze ověřit/);
    let n = 0;
    const failing = mockFetch(() => (++n === 1 ? { status: 200, json: { results: [], has_more: true, next_cursor: "c2" } } : { status: 502 }));
    await expect(new RestPanelSink(new NotionRestApi(TOKEN, failing.fn)).findRowByOrderId("wo-1")).rejects.toBeInstanceOf(NotionRestError);
    const complete = mockFetch(() => ({ status: 200, json: { results: [], has_more: false, next_cursor: null } }));
    expect(await new RestPanelSink(new NotionRestApi(TOKEN, complete.fn)).findRowByOrderId("wo-1")).toBeUndefined(); // only a fully read, empty result means „does not exist“
  });

  it("findRowByOrderId: REST dotaz na data source s filtrem „ID zakázky“, odpadlý (in_trash) řádek se ignoruje", async () => {
    const f = mockFetch(() => ({ status: 200, json: { results: [{ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", in_trash: true }, { id: "11111111-2222-3333-4444-555555555555" }], has_more: false, next_cursor: null } }));
    const sink = new RestPanelSink(new NotionRestApi(TOKEN, f.fn));
    expect(await sink.findRowByOrderId("wo-20261102-120000")).toBe("11111111222233334444555555555555");
    const c = f.calls[0];
    expect(c.method).toBe("POST");
    expect(c.url).toBe(`https://api.notion.com/v1/data_sources/${PANEL_DATA_SOURCE_ID}/query`);
    expect(JSON.parse(c.body!).filter).toEqual({ property: "ID zakázky", rich_text: { equals: "wo-20261102-120000" } });
    const none = mockFetch(() => ({ status: 200, json: { results: [], has_more: false, next_cursor: null } }));
    expect(await new RestPanelSink(new NotionRestApi(TOKEN, none.fn)).findRowByOrderId("wo-x")).toBeUndefined();
  });
});

describe("etapa 4 PR 3: findRowByOrderId a známky neúplného čtení (mapa inboxu v4 §8.1)", () => {
  it("S1/S2 request_status ≠ complete, S7 chybí has_more nebo results → „nelze ověřit“, nikdy „neexistuje“", async () => {
    for (const json of [
      { results: [], has_more: false, next_cursor: null, request_status: { type: "incomplete" } },
      { results: [], has_more: false, next_cursor: null, request_status: { type: "neco_noveho" } },
      { results: [] },
      { has_more: false, next_cursor: null },
    ]) {
      const f = mockFetch(() => ({ status: 200, json }));
      await expect(new RestPanelSink(new NotionRestApi(TOKEN, f.fn)).findRowByOrderId("wo-1")).rejects.toThrow(/nelze ověřit/);
    }
    const ok = mockFetch(() => ({ status: 200, json: { results: [], has_more: false, next_cursor: null, request_status: { type: "complete" } } }));
    expect(await new RestPanelSink(new NotionRestApi(TOKEN, ok.fn)).findRowByOrderId("wo-1")).toBeUndefined();
  });
});

describe("429 a 401 vypnou REST pro zapisovač stránek i panel společně", () => {
  it("429 u řádku panelu → další zápis stránky už REST nezkouší (a naopak)", async () => {
    for (const status of [429, 401]) {
      const f = mockFetch(() => ({ status, json: { code: "rate_limited" } }));
      const t = new StubTransport();
      const stack = makeNotionStack(t, dir, { token: TOKEN, fetchImpl: f.fn });
      const written: PanelRow[] = [];
      const panel = new HybridPanelSink(new RestPanelSink(stack.rest!), { upsert: async (r) => (written.push(r), "mcp") }, () => undefined);
      expect(await panel.upsert(panelRow(order(), "a", "b"), "known")).toBe("mcp"); // REST dostal 429/401
      expect(f.calls).toHaveLength(1);
      await stack.notion.createPage("p", "T", "x"); // jde rovnou fallbackem, žádný další požadavek na Notion
      await panel.upsert(panelRow(order(), "a", "b"), "known");
      expect(f.calls).toHaveLength(1);
      expect(t.prompts).toHaveLength(1);
      expect(written).toHaveLength(2);
    }
    const g = mockFetch(() => ({ status: 429 }));
    const stack = makeNotionStack(new StubTransport(), dir, { token: TOKEN, fetchImpl: g.fn });
    await stack.notion.createPage("p", "T", "x"); // 429 při zápisu stránky
    await expect(new RestPanelSink(stack.rest!).upsert(panelRow(order(), "a", "b"), "known")).rejects.toBeInstanceOf(NotionRestError);
    expect(g.calls).toHaveLength(1); // panel už nic neposlal
    expect(stack.rest!.paused).toBe(true);
  });
});

describe("ostatní ochrany tokenu", () => {
  it("MCP cesta bez tokenu také odmítne obsah s tokenem a podřízené procesy nedědí NOTION_TOKEN", async () => {
    readNotionToken({ platform: "darwin", run: () => TOKEN });
    const t = new StubTransport();
    await expect(new McpNotion(t, dir).createPage("p", "T", `klíč ${TOKEN}`)).rejects.toBeInstanceOf(SecretLeakError);
    expect(t.prompts).toHaveLength(0);
    process.env.NOTION_TOKEN = TOKEN;
    expect(childEnv().NOTION_TOKEN).toBeUndefined();
  });

  it("state.json i log.jsonl uloží token vymazaný", () => {
    readNotionToken({ platform: "darwin", run: () => TOKEN });
    const store = new Store(dir);
    store.save({ ...order(), failure_reason: `transport: ${TOKEN}` });
    expect(fs.readFileSync(path.join(dir, "wo-t", "state.json"), "utf8")).not.toContain(TOKEN);
  });
});
