// Mission Control „Na pozadí“: orders of other missions (dev-* from the dispatch bridge), live count
// across missions, SUPERSEDED orders. Mock data only.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildFinal } from "../mission-control/final";
import { CSS_FINAL, makeQs, renderFinal } from "../mission-control/final-render";
import { scenario } from "../mission-control/fixtures";
import { readLiveInput } from "../mission-control/live";
import { renderMainFragment } from "../mission-control/render";
import { buildFocus, buildView, type McInput } from "../mission-control/view";
import { handler } from "../panel-server";
import type { Order, OrderState } from "../types";

const NOW = "2026-11-02T13:40:00.000Z";
const qs = makeQs(undefined);
const SECRET = "ghp_" + "K".repeat(36);

function dev(id: string, state: string, opts: { created?: string; updated?: string; lastStep?: string; from?: OrderState; meta?: Record<string, string> } = {}): Order {
  const created = opts.created ?? "2026-11-02T12:03:49.578Z";
  const updated = opts.updated ?? "2026-11-02T13:35:31.249Z";
  return {
    id,
    mission: "Vývoj TARS",
    state: state as OrderState,
    created_at: created,
    updated_at: updated,
    brief: { title: `Vývojový běh ${id}`, department: "tars-vyvoj", milestone: "—", why: "Vývoj TARS na pozadí.", goal: "Doručit změnu.", inputs: [], acceptance: [], owner_decisions: [], sources: [] },
    fix_rounds: 0,
    manual_interventions: 0,
    owner_needed: false,
    history: [
      { from: "NEW", to: "DOING", event: "dispatch started", at: created },
      ...(state !== "DOING" ? [{ from: opts.from ?? ("DOING" as OrderState), to: state as OrderState, event: "dispatch ended", at: updated }] : []),
    ],
    meta: { source: "dispatch-bridge", run: id, ...(opts.lastStep ? { last_step: opts.lastStep } : {}), ...opts.meta },
    ...({ recipe: { id: "fable-claude-gpt-merge", version: "1", steps: [{ role: "fable", label: "Fable zadání", kind: "create" }, { role: "claude-code", label: "Claude Code", kind: "create" }, { role: "kontrola-gpt", label: "Kontrola GPT", kind: "check" }, { role: "merge", label: "Merge", kind: "deliver" }] }, recipe_step: 1 } as object),
  } as unknown as Order;
}

/** Main mission (scenario) + background orders; per-order locks given explicitly. */
function withBackground(base: McInput, orders: Order[], locks: Record<string, boolean>): McInput {
  return {
    ...base,
    now: NOW,
    demo: false,
    orders: [...base.orders, ...orders],
    orderLocks: { ...(base.orderLocks ?? {}), ...Object.fromEntries(Object.entries(locks).map(([id, alive]) => [id, { present: true, alive }])) },
  };
}

describe("„Na pozadí“ section", () => {
  const input = () =>
    withBackground(
      scenario("aktivita", NOW),
      [
        dev("dev-run3", "DOING", { lastStep: "Spouští příkaz v terminálu." }),
        dev("dev-run2", "DONE", { updated: "2026-11-02T11:00:00.000Z" }),
        dev("dev-run1", "FAILED", { created: "2026-11-01T08:00:00.000Z", updated: "2026-11-01T09:00:00.000Z" }), // yesterday
        dev("dev-run0", "SUPERSEDED", { updated: "2026-11-02T12:00:00.000Z", from: "WAITING_OWNER" }),
      ],
      { "dev-run3": true },
    );

  it("lists other missions active today or ended today, live first, with human last step", () => {
    const v = buildView(input());
    expect(v.current?.id.startsWith("wo-")).toBe(true); // main card stays on the main mission
    expect(v.background.map((b) => [b.id, b.statusLabel])).toEqual([
      ["dev-run3", "Pracuje"],
      ["dev-run0", "Nahrazeno"],
      ["dev-run2", "Hotovo"],
    ]);
    const live = v.background[0];
    expect(live).toMatchObject({ mission: "Vývoj TARS", lastStep: "Spouští příkaz v terminálu.", live: true, title: "Vývojový běh dev-run3" });
    expect(live.endedAt).toBeUndefined();
  });

  it("renders below the main card on / and /p0, live item animated, reduced motion respected", () => {
    const f = buildFinal(input());
    expect(f.focus?.id.startsWith("wo-")).toBe(true);
    expect(f.running.every((o) => o.id.startsWith("wo-"))).toBe(true);
    expect(f.roles.map((r) => r.id)).not.toContain("claude-code"); // background recipe roles are not the main team
    const html = renderFinal(f, qs);
    expect(html.indexOf("Na pozadí")).toBeGreaterThan(html.indexOf('class="stage'));
    expect(html).toMatch(/class="bgx-item st-working is-live"/);
    expect(html).toContain("Spouští příkaz v terminálu.");
    expect(html).toContain("focus=dev-run3");
    expect(CSS_FINAL).toMatch(/prefers-reduced-motion:reduce\)\{\.bgx-item\.is-live \.led\{animation:none\}/);
    const p0 = renderMainFragment(buildView(input()));
    expect(p0).toContain("Na pozadí");
    expect(p0).toContain("/zakazka/dev-run3");
  });

  it("empty state", () => {
    const html = renderFinal(buildFinal({ ...scenario("aktivita", NOW), demo: false }), qs);
    expect(html).toContain("Na pozadí nic neběží.");
  });

  it("failed today is „Selhalo“; active without its own live lock is „Nelze ověřit“ even with a live global lock", () => {
    const base = scenario("aktivita", NOW); // global lock alive
    const i = withBackground(base, [dev("dev-a", "DOING"), dev("dev-b", "FAILED", { updated: "2026-11-02T13:00:00.000Z" })], {});
    const v = buildView(i);
    const by = Object.fromEntries(v.background.map((b) => [b.id, b]));
    expect(by["dev-a"]).toMatchObject({ statusLabel: "Nelze ověřit", live: false });
    expect(by["dev-a"].lastStep).toMatch(/nelze ověřit/);
    expect(by["dev-b"].statusLabel).toBe("Selhalo");
    expect(renderFinal(buildFinal(i), qs)).not.toMatch(/class="bgx-item st-working/);
  });
});

describe("header „Pracuje“ counts live orders across missions", () => {
  it("main live + background live = 2", () => {
    const i = withBackground(scenario("aktivita", NOW), [dev("dev-run3", "DOING")], { "dev-run3": true });
    const v = buildView(i);
    expect(v.liveOrders).toBe(2);
    expect(renderFinal(buildFinal(i), qs)).toMatch(/<span>Pracuje<\/span><b data-live-count[^>]*>2 zakázky<\/b>/);
    expect(renderMainFragment(v)).toMatch(/data-live-count>2 zakázky</);
  });

  it("main mission idle, only background works → system „Pracuje“, 1 zakázka", () => {
    const i = withBackground(scenario("dokonceni", NOW), [dev("dev-run3", "DOING")], { "dev-run3": true });
    const v = buildView(i);
    expect(v.liveOrders).toBe(1);
    expect(v.status).toBe("working");
    const f = buildFinal(i);
    expect(f.statusLabel).toBe("Pracuje");
    expect(renderFinal(f, qs)).toContain("1 zakázka");
  });

  it("nothing proven live → 0 zakázek", () => {
    const i = withBackground(scenario("dokonceni", NOW), [dev("dev-run3", "DOING")], { "dev-run3": false });
    expect(buildView(i).liveOrders).toBe(0);
  });
});

describe("SUPERSEDED", () => {
  const sup = () => {
    const base = scenario("cekani", NOW);
    const waiting = base.orders.find((o) => o.state === "WAITING_OWNER")!;
    const replaced: Order = { ...waiting, state: "SUPERSEDED" as OrderState, history: [...waiting.history, { from: "WAITING_OWNER", to: "SUPERSEDED" as OrderState, event: "superseded", at: NOW }] };
    return { input: { ...base, demo: false, orders: base.orders.map((o) => (o === waiting ? replaced : o)) } as McInput, id: waiting.id };
  };

  it("is never in Owner Desk and never „čeká na tvoje GO“", () => {
    const { input, id } = sup();
    const v = buildView(input);
    expect(v.decisions.map((d) => d.order)).not.toContain(id);
    expect(v.decisionsCount).toBe(0);
    const f = buildFinal(input, id);
    expect(f.focus?.stateLabel).toBe("Nahrazeno");
    expect(f.focus?.headline.title).toBe("Nahrazeno");
    expect(f.focus?.steps.some((s) => s.status === "current")).toBe(false);
    const html = renderFinal(f, qs);
    expect(html).not.toMatch(/(?<!ne)čeká na tebe|Čeká na tvoje GO|(?<!ne)čeká na tvoje GO/);
    const focus = buildFocus(input, id)!;
    expect(focus.order.stateLabel).toBe("Nahrazeno");
    expect(focus.order.sentence).toMatch(/nahradila novější/);
  });

  it("a superseded background order is „Nahrazeno“", () => {
    const i = withBackground(scenario("aktivita", NOW), [dev("dev-run0", "SUPERSEDED", { from: "WAITING_OWNER" })], {});
    expect(buildView(i).background[0]).toMatchObject({ statusLabel: "Nahrazeno", status: "superseded" });
    expect(buildView(i).decisions).toHaveLength(0);
  });
});

describe("live runs directory with dev-* orders (read-only, no paths or secrets out)", () => {
  it("reads dev-* orders, serves them, hides local paths and secrets in HTML and JSON", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-bg-"));
    const main = scenario("aktivita", NOW).orders[1];
    const d = dev("dev-run3", "DOING", { lastStep: "Zapisuje /Users/janbindr/Projects/muj-web/tars/x.ts", meta: { worktree: "/Users/janbindr/Projects/muj-web-dev", note: `token ${SECRET}` } });
    for (const o of [main, d]) {
      fs.mkdirSync(path.join(dir, o.id));
      fs.writeFileSync(path.join(dir, o.id, "state.json"), JSON.stringify(o));
    }
    fs.writeFileSync(path.join(dir, "dev-run3", ".lock"), String(process.pid));
    fs.writeFileSync(path.join(dir, "log.jsonl"), JSON.stringify({ ts: NOW, order: "dev-run3", kind: "info", role: "orchestrator", result: "Čte /home/x/.ssh/id", reason: "Čte /home/x/.ssh/id" }) + "\n");
    const before = fs.readdirSync(dir).sort();

    const live = readLiveInput(dir, "/nonexistent-cards", NOW);
    expect(live.orders.map((o) => o.id).sort()).toEqual(["dev-run3", main.id].sort());
    expect(live.orderLocks?.["dev-run3"]?.alive).toBe(true);
    expect(live.unreadable).toBeUndefined();

    const srv = http.createServer(handler(dir, "/nonexistent-cards"));
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    const port = (srv.address() as { port: number }).port;
    const get = (p: string) => fetch(`http://127.0.0.1:${port}${p}`);
    const home = await (await get("/")).text();
    expect(home).toContain("Na pozadí");
    expect(home).toContain("Vývojový běh dev-run3");
    expect((await get("/zakazka/dev-run3")).status).toBe(200);
    for (const p of ["/", "/p0", "/zakazka/dev-run3", "/api/state", `/?focus=dev-run3`]) {
      const t = await (await get(p)).text();
      expect(t).not.toMatch(/\/Users\/|\/home\/x/);
      expect(t).not.toContain(SECRET);
    }
    const api = (await (await get("/api/state")).json()) as { orders: Array<{ id: string; meta: Record<string, string> }> };
    expect(api.orders.find((o) => o.id === "dev-run3")?.meta.worktree).toBe("[cesta skryta]");
    srv.close();
    expect(fs.readdirSync(dir).sort()).toEqual(before);
  });
});
