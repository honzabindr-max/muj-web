// Mission Control: the view is generated from mock data only (fixtures), never from real runs.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { scenario, SCENARIOS } from "../mission-control/fixtures";
import { readCards, readLiveInput } from "../mission-control/live";
import { renderDocument, renderFocusFragment, renderMainFragment } from "../mission-control/render";
import { buildFocus, buildView, humanProblem, safe, type McInput } from "../mission-control/view";
import { handler } from "../panel-server";

const NOW = "2026-11-02T11:00:00.000Z";
const view = (n: (typeof SCENARIOS)[number]) => buildView(scenario(n, NOW));
const html = (n: (typeof SCENARIOS)[number]) => renderMainFragment(view(n));

describe("mission control view from mock data", () => {
  it("activity: working only with a live lock, creator works, checker waits", () => {
    const v = view("aktivita");
    expect(v.status).toBe("working");
    expect(v.current?.state).toBe("DOING");
    expect(v.current?.verified).toBe(true);
    expect(v.current?.flow.map((s) => s.status)).toEqual(["done", "done", "current", "future", "future"]);
    const byKey = Object.fromEntries(v.team.map((m) => [m.key, m]));
    expect(byKey.copywriter.status).toBe("working");
    expect(byKey.kontrolor.status).toBe("waiting");
    expect(byKey.designer.status).toBe("idle");
    expect(v.workingCount).toBe(1);
    expect(v.decisions).toHaveLength(0);
    expect(html("aktivita")).toContain("Tým pokračuje samostatně.");
  });

  it("activity without a live process is never shown as working", () => {
    const input = scenario("aktivita", NOW);
    const v = buildView({ ...input, lock: { present: true, alive: false } });
    expect(v.status).toBe("unknown");
    expect(v.statusLabel).toBe("Nelze ověřit");
    expect(v.workingCount).toBe(0);
    expect(v.team.find((m) => m.key === "copywriter")?.status).toBe("unknown");
    expect(renderMainFragment(v)).not.toContain("flowing");
  });

  it("waiting: owner desk shows the decision with its GO card", () => {
    const v = view("cekani");
    expect(v.status).toBe("waiting");
    expect(v.decisionsCount).toBe(1);
    expect(v.decisions[0].links.map((l) => l.label)).toContain("GO karta v Notionu");
    expect(v.current?.flow.at(-1)).toMatchObject({ key: "owner", status: "current" });
    expect(v.deliveries).toHaveLength(1);
    expect(v.deliveries[0].checker).toContain("PASS");
  });

  it("error: problem names the step, the cause and the consequence", () => {
    const v = view("chyba");
    expect(v.status).toBe("problem");
    expect(v.current?.state).toBe("UNKNOWN");
    const err = v.current!.flow.find((s) => s.status === "error");
    expect(err?.label).toBe("Designér");
    expect(v.current?.flow.filter((s) => s.status === "skipped").map((s) => s.label)).toEqual(["Brána", "Doručení"]);
    expect(v.current?.problem?.what).toMatch(/^Prohlížeč nedokončil krok tvůrce/);
    expect(v.current?.problem?.consequence).toContain("Neber to jako úspěch");
    expect(html("chyba")).not.toMatch(/Hotovo|úspěšně/);
  });

  it("completion: all steps done, delivered today", () => {
    const v = view("dokonceni");
    expect(v.current?.state).toBe("DONE");
    expect(v.current?.flow.every((s) => s.status === "done")).toBe(true);
    expect(v.today.delivered).toBe(1);
    expect(v.deliveries[0].status).toBe("Hotovo");
  });

  it("empty: honest empty screen", () => {
    const v = view("prazdno");
    expect(v.current).toBeUndefined();
    expect(v.status).toBe("waiting");
    expect(html("prazdno")).toContain("Zatím žádná zakázka.");
  });

  it("demo views always carry the label, real views never", () => {
    for (const n of SCENARIOS) expect(html(n)).toContain("Ukázková data");
    const real: McInput = { ...scenario("aktivita", NOW), demo: false };
    expect(renderMainFragment(buildView(real))).not.toContain("Ukázková data");
  });

  it("focus mode: chronology, handoffs and verdicts", () => {
    const f = buildFocus(scenario("cekani", NOW), "wo-demo-1000")!;
    expect(f.chronology.length).toBeGreaterThan(5);
    expect(f.handoffs.map((h) => `${h.from}→${h.to}`)).toContain("Copywriter→Kontrolor");
    expect(f.verdicts.map((x) => x.result)).toEqual(["PASS", "PASS"]);
    expect(renderFocusFragment(f, view("cekani"))).toContain("Celá chronologie");
    expect(buildFocus(scenario("cekani", NOW), "wo-nope")).toBeUndefined();
  });
});

describe("no secrets in HTML", () => {
  const SECRET = "ghp_" + "A".repeat(36);
  it("secret-like text from data never reaches the page", () => {
    const input = scenario("chyba", NOW);
    input.orders[1] = { ...input.orders[1], failure_reason: `creator: token ${SECRET}`, brief: { ...input.orders[1].brief!, title: `Title ${SECRET}` } };
    input.log.push({ ts: NOW, order: "wo-demo-1000", kind: "call", role: "checker", model: "m", result: "BLOCK", reason: `leak ${SECRET}` });
    const v = buildView(input);
    const page = renderDocument("t", renderMainFragment(v), "/fragment") + renderFocusFragment(buildFocus(input, "wo-demo-1000")!, v);
    expect(page).not.toContain(SECRET);
    expect(page).toContain("[skryto: text obsahoval citlivý údaj]");
    expect(safe(`x ${SECRET}`)).toBe("[skryto: text obsahoval citlivý údaj]");
  });

  it("html is escaped and unsafe URLs are dropped", () => {
    const input = scenario("cekani", NOW);
    input.orders[1] = { ...input.orders[1], delivered_url: "javascript:alert(1)", brief: { ...input.orders[1].brief!, title: "<script>x</script>" } };
    const out = renderMainFragment(buildView(input));
    expect(out).not.toContain("<script>x");
    expect(out).not.toContain("javascript:");
  });

  it("failure reasons are worded deterministically", () => {
    expect(humanProblem("manual abort: přerušeno: test")).toBe("Ručně přerušeno: test");
    expect(humanProblem("fix limit 3 exhausted")).toBe("Vyčerpán limit 3 kol oprav.");
    expect(humanProblem(undefined)).toBe("Důvod nebyl zaznamenán.");
  });
});

describe("live reader and server", () => {
  it("reads runs read-only, cards, and serves /, /zakazka, /detail, demo", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-"));
    const input = scenario("aktivita", NOW);
    for (const o of input.orders) {
      fs.mkdirSync(path.join(dir, o.id));
      fs.writeFileSync(path.join(dir, o.id, "state.json"), JSON.stringify(o));
    }
    fs.writeFileSync(path.join(dir, "log.jsonl"), input.log.map((e) => JSON.stringify(e)).join("\n") + "\n{broken");
    fs.writeFileSync(path.join(dir, ".lock"), String(process.pid));
    const before = fs.readdirSync(dir).sort();
    const live = readLiveInput(dir, path.resolve(__dirname, "../specialists/mezi-vami"), NOW);
    expect(live.orders).toHaveLength(2);
    expect(live.lock.alive).toBe(true);
    expect(live.cards.supervizor).toMatch(/^Řídí práci na misi/);
    expect(readCards("/nonexistent")).toEqual({});

    const srv = http.createServer(handler(dir));
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    const port = (srv.address() as { port: number }).port;
    const get = (p: string) => fetch(`http://127.0.0.1:${port}${p}`);
    const main = await (await get("/")).text();
    expect(main).toContain("Mission Control");
    expect(main).not.toContain("Ukázková data");
    expect((await get("/zakazka/wo-demo-1000")).status).toBe(200);
    expect((await get("/zakazka/wo-nope")).status).toBe(404);
    expect(await (await get("/detail")).text()).toContain("technický detail");
    expect(await (await get("/?demo=1&scenario=chyba")).text()).toContain("Ukázková data");
    expect((await get("/fragment")).status).toBe(200);
    srv.close();
    expect(fs.readdirSync(dir).sort()).toEqual(before);
  });
});
