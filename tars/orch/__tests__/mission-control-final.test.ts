// Mission Control V2-A final: recipes (§2c), parallel orders (§2d), role page — mock data only.
import http from "node:http";

import { describe, expect, it } from "vitest";

import { buildFinal, buildRolePage, stepsOf } from "../mission-control/final";
import { makeQs, renderFinal, renderRole } from "../mission-control/final-render";
import { scenario } from "../mission-control/fixtures";
import { cardSection, parseCard } from "../mission-control/live";
import { classifyCalls } from "../mission-control/view";
import { handler } from "../panel-server";

const NOW = "2026-11-02T11:00:00.000Z";
const qs = makeQs("paralel");

describe("recipe flow (§2c)", () => {
  it("steps follow the recipe order, not a fixed six", () => {
    const input = scenario("paralel", NOW);
    const p1 = input.orders.find((o) => o.id === "wo-demo-p1")!;
    const steps = stepsOf(p1, classifyCalls(input.orders, input.log), {});
    expect(steps.map((s) => s.label)).toEqual(["Vedoucí", "Zadání", "Rešeršér", "Strážce hlasu", "Copywriter", "Kontrolor", "Doručení"]);
    expect(steps.find((s) => s.status === "current")?.label).toBe("Kontrolor");
    expect(steps.find((s) => s.label === "Kontrolor")?.returns).toBe(1);
    const p2 = input.orders.find((o) => o.id === "wo-demo-p2")!;
    const s2 = stepsOf(p2, classifyCalls(input.orders, input.log), {});
    expect(s2.map((s) => s.stepName)).toEqual(["Plán zakázky", "Kontrola zadání", "Architekt", "Implementace", "Testy a CI", "Code review", "PR draft", "Rozhodnutí vlastníka"]);
    expect(s2.find((s) => s.status === "current")?.stepName).toBe("Implementace");
  });

  it("without a recipe the v0 department flow is used", () => {
    const input = scenario("aktivita", NOW);
    const steps = stepsOf(input.orders[1], classifyCalls(input.orders, input.log), {});
    expect(steps.map((s) => s.label)).toEqual(["Vedoucí", "Zadání", "Copywriter", "Kontrolor", "Doručení"]);
  });
});

describe("parallel orders (§2d)", () => {
  it("focus = closest to owner decision or delivery; others are compact rows", () => {
    const f = buildFinal(scenario("paralel", NOW));
    expect(f.focus?.id).toBe("wo-demo-p1"); // CHECKING beats DOING and NEW
    expect(f.running.map((o) => o.id)).toEqual(["wo-demo-p2", "wo-demo-p3"]);
    expect(f.status).toBe("working");
    const html = renderFinal(f, qs);
    expect(html).toContain("Současně běží");
    expect(html).toContain("focus=wo-demo-p2");
  });

  it("?focus switches the main area", () => {
    const f = buildFinal(scenario("paralel", NOW), "wo-demo-p2");
    expect(f.focus?.id).toBe("wo-demo-p2");
    expect(f.focus?.headline.title).toBe("Vývojář implementuje změnu");
    expect(f.running.map((o) => o.id)).toContain("wo-demo-p1");
  });

  it("team shows which order each role works on", () => {
    const f = buildFinal(scenario("paralel", NOW));
    const role = (id: string) => f.roles.find((r) => r.id === id)!;
    expect(role("kontrolor")).toMatchObject({ status: "checking" });
    expect(role("kontrolor").works[0].order).toBe("wo-demo-p1");
    expect(role("vyvojar").works[0].order).toBe("wo-demo-p2");
    expect(role("supervizor").works[0].order).toBe("wo-demo-p3");
    expect(role("ci").status).toBe("waiting");
    expect(f.roles.map((r) => r.id)).not.toContain("pr"); // a delivery step is not a team member
  });

  it("per-order lock: a dead lock makes only that order unverified", () => {
    const input = scenario("paralel", NOW);
    input.orderLocks!["wo-demo-p2"] = { present: true, alive: false };
    const f = buildFinal(input);
    expect(f.orders.find((o) => o.id === "wo-demo-p2")?.verified).toBe(false);
    expect(f.orders.find((o) => o.id === "wo-demo-p1")?.verified).toBe(true);
    expect(f.roles.find((r) => r.id === "vyvojar")?.status).toBe("unknown");
  });
});

describe("role page", () => {
  it("Postup from the card, Dosah missing → „Zatím nedefinováno“", () => {
    const input = scenario("paralel", NOW);
    const p = buildRolePage(input, "copy-studio")!;
    const html = renderRole(p, buildFinal(input), qs);
    expect(html).toContain("Navrhnout 3 směry");
    expect(html).toContain("Zatím nedefinováno");
    expect(p.history.length).toBeGreaterThan(0);
    expect(buildRolePage(input, "../etc")).toBeUndefined();
    expect(buildRolePage(input, "neexistuje")).toBeUndefined();
  });

  it("card parser reads Postup and Dosah sections only when present", () => {
    const text = "---\nrole: x\ntitle: X\nmodel: m\n---\n## 1. Mise role a model\n\nDělá X. Více.\n\n## Postup\n\n1. A\n2. B\n\n## Dosah\n\n- čte: `a`\n\n## 3. Jiné\n\nnic";
    const c = parseCard(text, "x.md")!;
    expect(c.mission).toBe("Dělá X.");
    expect(c.postup).toEqual(["1. A", "2. B"]);
    expect(c.dosah).toEqual(["- čte: `a`"]);
    expect(cardSection("## 1. Mise\n\ntext", "Postup")).toBeUndefined();
  });

  it("no secrets on the main or role page", () => {
    const SECRET = "ghp_" + "C".repeat(36);
    const input = scenario("paralel", NOW);
    input.orders[1] = { ...input.orders[1], brief: { ...input.orders[1].brief!, title: SECRET } };
    input.cardDocs!["copy-studio"].postup = [`token ${SECRET}`];
    const f = buildFinal(input);
    expect(renderFinal(f, qs)).not.toContain(SECRET);
    expect(renderRole(buildRolePage(input, "copy-studio")!, f, qs)).not.toContain("CCCCCCCCCCCCCCCCCCCC");
  });
});

describe("routes", () => {
  it("serves final A, role page, demo=paralel, P0 at /p0", async () => {
    const srv = http.createServer(handler("/nonexistent-runs"));
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    const port = (srv.address() as { port: number }).port;
    const get = (p: string) => fetch(`http://127.0.0.1:${port}${p}`);
    const par = await (await get("/?demo=paralel")).text();
    expect(par).toContain("Ukázková data");
    expect(par).toContain("Současně běží");
    expect((await get("/role/kontrolor?demo=paralel")).status).toBe(200);
    expect((await get("/role/..%2Fx")).status).toBe(404);
    expect(await (await get("/?demo=paralel&_frag=1")).text()).not.toContain("<!doctype");
    expect((await get("/p0")).status).toBe(200);
    srv.close();
  });
});
