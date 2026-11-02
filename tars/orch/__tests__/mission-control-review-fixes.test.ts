// PR #80 – fixes of the independent GPT review: secrets, per-order locks, refresh failure, lock race.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { createRequire } from "node:module";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildFinal, buildRolePage } from "../mission-control/final";
import { makeQs, renderFinal, renderRole } from "../mission-control/final-render";
import { scenario } from "../mission-control/fixtures";
import { lockAt, parseCard, readLiveInput, readLock } from "../mission-control/live";
import { renderDocument, renderFocusFragment } from "../mission-control/render";
import { buildStory } from "../mission-control/story";
import { buildFocus, buildView } from "../mission-control/view";
import { handler, snapshot } from "../panel-server";
import { redactDeep, redactSecrets } from "../secret-scan";

// jsdom is already a devDependency (sam-byt tests); it ships without types, so a minimal local shape.
type Win = Window & typeof globalThis;
const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (html: string, opts: { url: string; runScripts: "dangerously"; beforeParse: (w: Win) => void }) => { window: Win };
};

const NOW = "2026-11-02T11:00:00.000Z";
const SECRET = "ghp_" + "Z".repeat(36);
const qs = makeQs(undefined);

afterEach(() => {
  vi.restoreAllMocks();
});

async function serve(root: string, cards?: string) {
  const srv = http.createServer(handler(root, cards));
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const port = (srv.address() as { port: number }).port;
  return { srv, get: (p: string) => fetch(`http://127.0.0.1:${port}${p}`) };
}

describe("P1: no secret from log.model or card metadata reaches the page", () => {
  it("models of the brief and check steps pass the secret filter", () => {
    for (const name of ["aktivita", "oprava", "paralel"] as const) {
      const input = scenario(name, NOW);
      input.log = input.log.map((e) => (e.kind === "call" ? { ...e, model: `model ${SECRET}` } : e));
      const f = buildFinal(input);
      const all = f.orders.flatMap((o) => o.steps.map((s) => s.who ?? ""));
      expect(all.join(" ")).not.toContain(SECRET);
      const html = renderFinal(f, qs) + f.roles.map((r) => renderRole(buildRolePage(input, r.id)!, f, qs)).join("");
      expect(html).not.toContain(SECRET);
      const id = input.orders.at(-1)!.id;
      expect(renderFocusFragment(buildFocus(input, id)!, buildView(input))).not.toContain(SECRET);
    }
  });

  it("card front matter is filtered by the parser and again by the role page", () => {
    const text = `---\nrole: copy-studio\ntitle: Copy ${SECRET}\nmodel: ${SECRET}\nadapter: x ${SECRET}\nrung: ${SECRET}\n---\n## 1. Mise role a model\n\nPíše ${SECRET}.\n\n## Postup\n\n1. token ${SECRET}\n`;
    const c = parseCard(text, "copy.md")!;
    expect(JSON.stringify(c)).not.toContain(SECRET);

    const input = scenario("paralel", NOW);
    // a card that bypassed the parser (e.g. another caller) is still filtered on render
    input.cardDocs!["copy-studio"] = { ...input.cardDocs!["copy-studio"], model: SECRET, adapter: SECRET, rung: SECRET, file: `x/${SECRET}.md` };
    const html = renderRole(buildRolePage(input, "copy-studio")!, buildFinal(input), qs);
    expect(html).not.toContain(SECRET);
  });

  it("server output guard: /api/state and /detail data are redacted, / too", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-sec-"));
    const input = scenario("aktivita", NOW);
    for (const o of input.orders) {
      fs.mkdirSync(path.join(dir, o.id));
      fs.writeFileSync(path.join(dir, o.id, "state.json"), JSON.stringify({ ...o, brief: { ...o.brief!, title: `T ${SECRET}` }, meta: { token: SECRET } }));
    }
    const log = input.log.map((e) => (e.kind === "call" ? { ...e, model: SECRET, reason: `leak ${SECRET}` } : e));
    fs.writeFileSync(path.join(dir, "log.jsonl"), log.map((e) => JSON.stringify(e)).join("\n") + "\n");
    expect(JSON.stringify(snapshot(dir))).not.toContain(SECRET);
    const { srv, get } = await serve(dir);
    const api = await (await get("/api/state")).text();
    expect(api).not.toContain(SECRET);
    expect(() => JSON.parse(api)).not.toThrow();
    expect(await (await get("/")).text()).not.toContain(SECRET);
    expect(await (await get(`/zakazka/${input.orders[1].id}`)).text()).not.toContain(SECRET);
    srv.close();
  });

  it("/detail escapes order state and numbers from data (no raw HTML from state.json)", async () => {
    const { srv, get } = await serve("/nonexistent-runs-xss");
    const page = await (await get("/detail")).text();
    expect(page).toContain("esc(cur.state)");
    expect(page).toContain("esc(o.state)");
    expect(page).not.toMatch(/'\+cur\.state\+'/);
    srv.close();
  });

  it("redaction helpers replace every match and keep JSON structure", () => {
    expect(redactSecrets(`a ${SECRET} b ${SECRET}`)).not.toContain("ghp_");
    const d = redactDeep({ a: [SECRET, { b: `x ${SECRET}` }], n: 3, t: true });
    expect(JSON.stringify(d)).not.toContain(SECRET);
    expect(d.n).toBe(3);
  });
});

describe("P2: a dead per-order lock is never overridden by a live global lock", () => {
  const deadOrder = () => {
    const input = scenario("aktivita", NOW); // global runs/.lock is alive
    const id = input.orders.at(-1)!.id;
    input.orderLocks = { [id]: { present: true, alive: false } };
    return { input, id };
  };

  it("focus detail does not claim the work runs", () => {
    const { input, id } = deadOrder();
    const f = buildFocus(input, id)!;
    expect(f.order.verified).toBe(false);
    expect(f.order.tone).toBe("unknown");
  });

  it("P0 main view, team and story agree", () => {
    const { input } = deadOrder();
    const v = buildView(input);
    expect(v.status).toBe("unknown");
    expect(v.team.some((m) => m.status === "working" || m.status === "checking")).toBe(false);
    expect(v.next.blocker).toMatch(/Orchestrátor neběží/);
    const s = buildStory(input);
    expect(s.headline?.live).toBeFalsy();
  });

  it("a live per-order lock still proves work", () => {
    const { input, id } = deadOrder();
    input.orderLocks![id] = { present: true, alive: true };
    expect(buildFocus(input, id)!.order.verified).toBe(true);
    expect(buildView(input).status).toBe("working");
  });
});

describe("P2: lock removed between existence check and read never crashes", () => {
  it("lockAt/readLock: vanished lock = no lock, unreadable = present but unproven", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-lock-"));
    const f = path.join(dir, ".lock");
    expect(lockAt(f)).toBeUndefined();
    fs.writeFileSync(f, String(process.pid));
    expect(readLock(dir)).toMatchObject({ present: true, alive: true });

    const enoent = Object.assign(new Error("gone"), { code: "ENOENT" });
    vi.spyOn(fs, "readFileSync").mockImplementationOnce(() => {
      throw enoent; // the orchestrator deleted the lock after stat
    });
    expect(readLock(dir)).toEqual({ present: false, alive: false });

    vi.spyOn(fs, "readFileSync").mockImplementationOnce(() => {
      throw Object.assign(new Error("denied"), { code: "EACCES" });
    });
    expect(readLock(dir)).toEqual({ present: true, alive: false });
  });

  it("readLiveInput survives a vanished order lock", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-lock2-"));
    const o = scenario("aktivita", NOW).orders[1];
    fs.mkdirSync(path.join(dir, o.id));
    fs.writeFileSync(path.join(dir, o.id, "state.json"), JSON.stringify(o));
    fs.writeFileSync(path.join(dir, o.id, ".lock"), "999999");
    const real = fs.statSync;
    vi.spyOn(fs, "statSync").mockImplementation(((p: fs.PathLike, opts?: fs.StatSyncOptions) => {
      if (String(p).endsWith(".lock")) throw Object.assign(new Error("gone"), { code: "ENOENT" });
      return real(p, opts);
    }) as typeof fs.statSync);
    const live = readLiveInput(dir, "/nonexistent-cards", NOW);
    expect(live.orderLocks?.[o.id]).toBeUndefined();
  });

  it("an exception inside a request answers 500 and the server keeps running", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-500-"));
    const { srv, get } = await serve(dir);
    const spy = vi.spyOn(fs, "readdirSync").mockImplementation(() => {
      throw Object.assign(new Error("boom"), { code: "EIO" });
    });
    const r = await get("/");
    expect(r.status).toBe(500);
    expect(await r.text()).toContain("nelze ověřit");
    spy.mockRestore();
    expect((await get("/")).status).toBe(200);
    srv.close();
  });

  it("snapshot never creates a missing runs directory", () => {
    const dir = path.join(os.tmpdir(), `mc-missing-${process.pid}-${Date.now()}`);
    const s = snapshot(dir);
    expect(fs.existsSync(dir)).toBe(false);
    expect(s.orders).toEqual([]);
  });
});

describe("P2: refresh failure marks the system state, not a team member", () => {
  function page() {
    const f = buildFinal(scenario("paralel", NOW));
    const doc = renderDocument("t", renderFinal(f, qs), "/?_frag=1");
    let refresh: (() => Promise<void>) | undefined;
    let fetchImpl: () => Promise<unknown> = () => Promise.reject(new Error("down"));
    const dom = new JSDOM(doc, {
      url: "http://127.0.0.1:4747/",
      runScripts: "dangerously",
      beforeParse(w) {
        Object.assign(w, {
          matchMedia: () => ({ matches: false }),
          fetch: () => fetchImpl(),
          setInterval: (fn: () => Promise<void>, ms: number) => {
            if (ms === 3000) refresh = fn;
            return 0;
          },
        });
      },
    });
    return { dom, body: renderFinal(f, qs), run: () => refresh!(), setFetch: (f: () => Promise<unknown>) => (fetchImpl = f) };
  }

  it("on failure: status „Nelze ověřit“, no live marks, team pills keep their names", async () => {
    const { dom, run } = page();
    const d = dom.window.document;
    const pillsBefore = [...d.querySelectorAll(".pill .pn")].map((e) => e.textContent);
    expect(d.querySelectorAll(".st-working,.st-checking").length).toBeGreaterThan(0);
    expect(d.querySelector("[data-sys]")!.textContent).toBe("Pracuje");
    await run();
    const sys = d.querySelector("[data-sys]")!;
    expect(sys.textContent).toBe("Nelze ověřit");
    expect(sys.classList.contains("unknown")).toBe(true);
    expect(sys.classList.contains("live")).toBe(false);
    expect(d.body.classList.contains("offline")).toBe(true);
    expect(d.getElementById("offline")!.textContent).toMatch(/nelze ověřit/);
    expect(d.querySelectorAll(".st-working,.st-checking,.is-live,.pulse,.t-live,.t-check").length).toBe(0);
    expect(d.getElementById("app")!.textContent).not.toMatch(/Pracuje|Kontroluje/);
    expect([...d.querySelectorAll(".pill .pn")].map((e) => e.textContent)).toEqual(pillsBefore);
    expect(d.querySelector(".pill")!.textContent).not.toContain("Nedostupné");
  });

  it("after recovery the page is re-rendered from fresh data", async () => {
    const { dom, run, setFetch, body } = page();
    const d = dom.window.document;
    await run();
    setFetch(() => Promise.resolve({ ok: true, text: () => Promise.resolve(body) }));
    await run();
    expect(d.body.classList.contains("offline")).toBe(false);
    expect(d.querySelector("[data-sys]")!.textContent).toBe("Pracuje");
    expect(d.querySelectorAll(".st-working,.st-checking").length).toBeGreaterThan(0);
  });
});
