// Mission Control V2 previews: human headlines, FIX loops, key events, adaptive team — mock data only.
import http from "node:http";

import { describe, expect, it } from "vitest";

import { scenario } from "../mission-control/fixtures";
import { renderPreviewA, renderPreviewB } from "../mission-control/preview";
import { buildStory, headline } from "../mission-control/story";
import { classifyCalls } from "../mission-control/view";
import type { Order, OrderState } from "../types";
import { handler } from "../panel-server";

const NOW = "2026-11-02T11:00:00.000Z";

function withState(state: OrderState, extra: Partial<Order> = {}) {
  const input = scenario("aktivita", NOW);
  const o = { ...input.orders[1], state, ...extra };
  return headline(o, classifyCalls(input.orders, input.log), true);
}

describe("headline is composed by code from state + role", () => {
  it("templates per state", () => {
    expect(withState("DOING").title).toBe("Copywriter píše texty");
    expect(withState("FIXING", { fix_rounds: 1 })).toMatchObject({ title: "Copywriter upravuje texty po kontrole", subtitle: "Zapracovává připomínky z prvního kola. Následně proběhne opakovaná kontrola." });
    expect(withState("CHECKING").title).toBe("Kontrolor kontroluje texty");
    expect(withState("CHECKING", { fix_rounds: 2 }).title).toBe("Kontrolor znovu kontroluje texty");
    expect(withState("DELIVERED").title).toBe("Výstup prošel kontrolou");
    expect(withState("WAITING_OWNER").title).toBe("Výstup čeká na tvoje rozhodnutí");
    expect(withState("FAILED", { failure_reason: "checker BLOCK: chybí zdroj" }).title).toBe("Zakázka se zastavila");
    expect(withState("UNKNOWN", { failure_reason: "creator: UI_UNKNOWN: timeout" }).subtitle).toContain("Neber to jako úspěch");
    const vizual = withState("DOING", { brief: { ...scenario("aktivita", NOW).orders[1].brief!, department: "vizual" } });
    expect(vizual.title).toBe("Designér navrhuje vizuál");
  });

  it("technical title and id stay secondary; dead lock is never live", () => {
    const input = scenario("aktivita", NOW);
    const h = headline(input.orders[1], classifyCalls(input.orders, input.log), false);
    expect(h.title).toBe("Stav nelze ověřit");
    expect(h.live).toBe(false);
    expect(h.technical).toContain("COPY_SYSTEM_V1");
    expect(h.id).toBe("wo-demo-1000");
  });
});

describe("story", () => {
  it("FIX loop is visible on the checker step and in events", () => {
    const s = buildStory(scenario("oprava", NOW));
    expect(s.headline?.title).toBe("Copywriter upravuje texty po kontrole");
    expect(s.flow.find((x) => x.key === "checker")?.returns).toBe(1);
    expect(s.events.some((e) => e.kind === "verdict-fix")).toBe(true);
    expect(renderPreviewA(s)).toContain("1× vráceno");
    expect(renderPreviewB(s)).toContain("1× vráceno");
  });

  it("adaptive team: active first, next second, the rest calm", () => {
    const s = buildStory(scenario("aktivita", NOW));
    expect(s.primary?.key).toBe("copywriter");
    expect(s.secondary?.key).toBe("kontrolor");
    expect(s.others.map((m) => m.key)).not.toContain("copywriter");
    expect(s.others).toHaveLength(5);
  });

  it("idle state has no primary, events are not a raw log", () => {
    const s = buildStory(scenario("chyba", NOW));
    expect(s.primary).toBeUndefined();
    expect(s.events.map((e) => e.text)).not.toContain("Tvůrce spuštěn");
    // the BLOCK verdict already explains the stop of the earlier order — no duplicate
    expect(s.events.filter((e) => e.order === "wo-demo-0900" && e.kind === "problem")).toHaveLength(0);
  });

  it("phase key changes only with a real phase change", () => {
    const a = buildStory(scenario("aktivita", NOW)).phaseKey;
    expect(buildStory(scenario("aktivita", "2026-11-02T11:00:03.000Z")).phaseKey).toBe(a);
    expect(buildStory(scenario("oprava", NOW)).phaseKey).not.toBe(a);
  });

  it("no secrets, demo label only in demo", () => {
    const SECRET = "ghp_" + "B".repeat(36);
    const input = scenario("aktivita", NOW);
    input.orders[1] = { ...input.orders[1], brief: { ...input.orders[1].brief!, title: SECRET } };
    const s = buildStory(input);
    for (const html of [renderPreviewA(s), renderPreviewB(s)]) {
      expect(html).not.toContain(SECRET);
      expect(html).toContain("Ukázková data");
    }
    const real = buildStory({ ...scenario("aktivita", NOW), demo: false });
    expect(renderPreviewA(real)).not.toContain("Ukázková data");
  });

  it("preview routes serve A and B, production / unchanged", async () => {
    const srv = http.createServer(handler("/nonexistent-runs"));
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    const port = (srv.address() as { port: number }).port;
    const get = (p: string) => fetch(`http://127.0.0.1:${port}${p}`).then((r) => r.text());
    expect(await get("/preview/a?demo=1&scenario=oprava")).toContain("Mission Control");
    expect(await get("/preview/b?demo=1&scenario=oprava")).toContain("Command Center");
    expect(await get("/fragment?demo=1&preview=b")).toContain("Tvoje rozhodnutí");
    expect(await get("/")).toContain("TARS / Mission Control");
    srv.close();
  });
});
