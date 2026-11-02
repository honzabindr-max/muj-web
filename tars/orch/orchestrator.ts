// Deterministic driver. One tick = guard → lock → resume/advance one order step by step.
// "Kód hlídá, LLM rozhoduje": every gate, limit and record lives here, not in a prompt.
import fs from "node:fs";

import type { AdapterResult, TextAdapter } from "./adapters";
import { briefMarkdown, type DepartmentRunner, type DeptContext, type StepOutcome } from "./departments";
import type { GuardResult } from "./guard";
import type { NotionClient } from "./notion";
import { scanSecrets } from "./secret-scan";
import { isActionable, transition, type OrderEvent } from "./state-machine";
import type { Store } from "./store";
import { BriefError, buildSupervisorPrompt, parseBrief, reservedDecisionHits } from "./supervisor";
import type { Department, LogEntry, Order } from "./types";

export interface OrchestratorDeps {
  store: Store;
  supervisor: TextAdapter;
  departments: Record<Department, DepartmentRunner>;
  notion: NotionClient;
  guard: () => GuardResult;
  draftParentId: string;
  repoRoot: string;
  capsulePath: string;
  mission?: string;
  now?: () => Date;
  pauseMinutes?: number;
  maxStepsPerTick?: number;
}

export type TickResult =
  | { status: "guard_alarm"; summary: string }
  | { status: "locked" }
  | { status: "paused"; order: string; resume_after: string }
  | { status: "waiting_owner"; order: string }
  | { status: "advanced"; order: string; state: Order["state"] };

/** Wraps any adapter: output containing a secret is dropped, never stored (§6). */
export class SecretScanningAdapter implements TextAdapter {
  constructor(private inner: TextAdapter) {}
  get name() {
    return this.inner.name;
  }
  get model() {
    return this.inner.model;
  }
  get family() {
    return this.inner.family;
  }
  async run(prompt: string, opts: Parameters<TextAdapter["run"]>[1]): Promise<AdapterResult> {
    const r = await this.inner.run(prompt, opts);
    const s = scanSecrets(r.text);
    if (s.clean) return r;
    return { ...r, ok: false, text: "", error: `secret-scan: ${s.kinds.join(",")}` };
  }
}

export function assertFamilies(depts: Record<string, DepartmentRunner>): void {
  for (const [k, d] of Object.entries(depts)) {
    if (d.creatorFamily === d.checkerFamily) {
      throw new Error(`department ${k}: creator and checker are both ${d.creatorFamily} (tvůrce ≠ kontrolor)`);
    }
  }
}

export class Orchestrator {
  private now: () => Date;
  private ctx: DeptContext;
  constructor(private d: OrchestratorDeps) {
    assertFamilies(d.departments);
    this.now = d.now ?? (() => new Date());
    this.ctx = { store: d.store, notion: d.notion, draftParentId: d.draftParentId, repoRoot: d.repoRoot };
  }

  private iso() {
    return this.now().toISOString();
  }

  private log(e: Omit<LogEntry, "ts">) {
    this.d.store.log({ ts: this.iso(), ...e });
  }

  private apply(order: Order, ev: OrderEvent, extra: Partial<LogEntry> = {}): Order {
    const next = transition(order, ev, this.iso());
    this.d.store.save(next);
    this.log({
      order: order.id,
      kind: "transition",
      from: order.state,
      to: next.state,
      event: ev.type,
      fix_rounds: next.fix_rounds,
      manual_interventions: next.manual_interventions,
      ...extra,
    });
    return next;
  }

  newOrder(): Order {
    const t = this.now();
    const id = `wo-${t.toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-")}`;
    const order: Order = {
      id,
      mission: this.d.mission ?? "mezi-vami",
      state: "NEW",
      created_at: t.toISOString(),
      updated_at: t.toISOString(),
      fix_rounds: 0,
      manual_interventions: 0,
      history: [],
      meta: {},
    };
    this.d.store.save(order);
    this.log({ order: id, kind: "info", role: "orchestrator", result: "order created" });
    return order;
  }

  async tick(): Promise<TickResult> {
    const g = this.d.guard();
    this.log({ order: "-", kind: "guard", result: g.alarm ? "ALARM" : "OK", reason: g.summary });
    if (g.alarm) return { status: "guard_alarm", summary: g.summary };
    if (!this.d.store.acquireLock()) return { status: "locked" };
    try {
      const orders = this.d.store.listOrders();
      let order = orders.find((o) => isActionable(o.state));
      if (!order) {
        const waiting = orders.find((o) => o.state === "WAITING_OWNER");
        // WIP limit 1: no new order while the owner has an undecided card.
        if (waiting) return { status: "waiting_owner", order: waiting.id };
        order = this.newOrder();
      }
      if (order.state === "PAUSED") {
        if (order.resume_after && new Date(order.resume_after) > this.now())
          return { status: "paused", order: order.id, resume_after: order.resume_after };
        order = this.apply(order, { type: "resume" }, { role: "orchestrator" });
      }
      const max = this.d.maxStepsPerTick ?? 20;
      for (let i = 0; i < max && isActionable(order.state) && order.state !== "PAUSED"; i++) {
        // Re-check guard before anything leaves the machine.
        if (order.state === "DELIVERED" && this.d.guard().alarm) return { status: "guard_alarm", summary: "ALARM before delivery" };
        order = await this.step(order);
      }
      if (order.state === "PAUSED") return { status: "paused", order: order.id, resume_after: order.resume_after! };
      if (order.state === "WAITING_OWNER") return { status: "waiting_owner", order: order.id };
      return { status: "advanced", order: order.id, state: order.state };
    } finally {
      this.d.store.releaseLock();
    }
  }

  /** Common handling of a model step outcome: limit → PAUSED, error → FAILED. */
  private bad(order: Order, r: StepOutcome, role: LogEntry["role"]): Order | undefined {
    if (r.ok) return undefined;
    if (r.limit) {
      const resume = new Date(this.now().getTime() + (this.d.pauseMinutes ?? 60) * 60_000).toISOString();
      return this.apply(order, { type: "limit", resume_after: resume }, { role, model: r.model, reason: r.error });
    }
    this.log({ order: order.id, kind: "error", role, model: r.model, reason: r.error, duration_ms: r.duration_ms });
    return this.apply(order, { type: "fail", reason: `${role}: ${r.error ?? "unknown error"}` }, { role, model: r.model });
  }

  async step(order: Order): Promise<Order> {
    const dept = order.brief ? this.d.departments[order.brief.department] : undefined;
    switch (order.state) {
      case "NEW": {
        const capsule = fs.existsSync(this.d.capsulePath) ? fs.readFileSync(this.d.capsulePath, "utf8") : "(kufřík chybí)";
        const open = this.d.store
          .listOrders()
          .filter((o) => o.id !== order.id && o.brief)
          .map((o) => `${o.id} [${o.state}] ${o.brief!.title}`);
        const prompt = buildSupervisorPrompt(capsule, this.d.store.readLog(200), open);
        let lastErr = "";
        for (let attempt = 0; attempt < 2; attempt++) {
          const r = await this.d.supervisor.run(prompt, {
            cwd: this.d.store.orderDir(order.id),
            allowedTools: ["mcp__claude_ai_Notion__notion-fetch"],
          });
          const out: StepOutcome = { ok: r.ok, limit: r.limit, error: r.error, model: this.d.supervisor.model, duration_ms: r.duration_ms };
          this.log({ order: order.id, kind: "call", role: "supervisor", model: this.d.supervisor.model, family: this.d.supervisor.family, duration_ms: r.duration_ms, result: r.ok ? "ok" : "error", reason: r.error });
          if (!r.ok) return this.bad(order, out, "supervisor")!;
          try {
            const brief = parseBrief(r.text);
            this.d.store.writeFile(order.id, "brief.md", briefMarkdown(brief));
            return this.apply({ ...order, brief }, { type: "planned" }, { role: "supervisor", model: this.d.supervisor.model, duration_ms: r.duration_ms, result: `${brief.department}: ${brief.title}` });
          } catch (e) {
            if (!(e instanceof BriefError)) throw e;
            lastErr = e.message;
          }
        }
        return this.apply(order, { type: "unknown", reason: `supervisor brief invalid: ${lastErr}` }, { role: "supervisor" });
      }
      case "PLANNED":
        return this.apply(order, { type: "start" }, { role: "orchestrator", result: dept!.name });
      case "DOING": {
        const r = await dept!.create(order, this.ctx);
        this.log({ order: order.id, kind: "call", role: "creator", model: r.model, family: dept!.creatorFamily, duration_ms: r.duration_ms, result: r.ok ? "ok" : "error", reason: r.error });
        const b = this.bad(order, r, "creator");
        if (b) return b;
        return this.apply({ ...order, draft_file: r.draft_file, meta: { ...order.meta, ...(r.meta ?? {}) } }, { type: "created" }, { role: "creator", model: r.model, family: dept!.creatorFamily, duration_ms: r.duration_ms });
      }
      case "CHECKING": {
        const r = await dept!.check(order, this.ctx);
        this.log({ order: order.id, kind: "call", role: "checker", model: r.model, family: r.deterministic ? "none" : dept!.checkerFamily, duration_ms: r.duration_ms, result: r.verdict ?? (r.ok ? "ok" : "error"), reason: r.error ?? r.issues?.join(" | ").slice(0, 500) });
        const b = this.bad(order, r, "checker");
        if (b) return b;
        return this.apply(order, { type: "verdict", verdict: r.verdict!, issues: r.issues }, { role: "checker", model: r.model, family: r.deterministic ? "none" : dept!.checkerFamily, duration_ms: r.duration_ms, result: r.verdict });
      }
      case "FIXING": {
        const r = await dept!.revise(order, this.ctx);
        this.log({ order: order.id, kind: "call", role: "creator", model: r.model, family: dept!.creatorFamily, duration_ms: r.duration_ms, result: r.ok ? "ok" : "error", reason: r.error });
        const b = this.bad(order, r, "creator");
        if (b) return b;
        return this.apply({ ...order, draft_file: r.draft_file ?? order.draft_file }, { type: "revised" }, { role: "creator", model: r.model, family: dept!.creatorFamily, duration_ms: r.duration_ms });
      }
      case "DELIVERED": {
        let o = order;
        if (!o.delivered_url) {
          let r;
          try {
            r = await dept!.deliver(o, this.ctx);
          } catch (e) {
            r = { ok: false, error: (e as Error).message, limit: Boolean((e as { limit?: boolean }).limit), model: "deliver" };
          }
          this.log({ order: o.id, kind: "call", role: "transport", model: r.model, duration_ms: r.duration_ms, result: r.ok ? r.url : "error", reason: r.error });
          const b = this.bad(o, r, "transport");
          if (b) return b;
          o = { ...o, delivered_url: r.url };
          this.d.store.save(o);
        }
        const reasons = [
          ...(dept!.alwaysOwner ? ["výstup je PR do main — merge dělá vlastník (DR-022)"] : []),
          ...o.brief!.owner_decisions,
          ...reservedDecisionHits(`${o.brief!.title}\n${o.brief!.goal}`).map((k) => `zadání se dotýká: ${k}`),
        ];
        const ownerNeeded = reasons.length > 0;
        if (ownerNeeded && !o.owner_card_url) {
          try {
            const card = await this.d.notion.createPage(this.d.draftParentId, `KARTA GO/REJECT — ${o.brief!.title} (${o.id})`, ownerCard(o, reasons, dept!));
            o = { ...o, owner_card_url: card.url, owner_reasons: reasons };
            this.d.store.save(o);
          } catch (e) {
            return this.bad(o, { ok: false, error: (e as Error).message, limit: Boolean((e as { limit?: boolean }).limit) }, "transport")!;
          }
        }
        return this.apply(o, { type: "delivered", owner_needed: ownerNeeded }, { role: "orchestrator", result: o.delivered_url });
      }
      default:
        return order;
    }
  }

  /** Owner gate (§5). Logged as an owner decision, not as a manual intervention before DELIVERED. */
  owner(id: string, decision: "GO" | "REJECT"): Order {
    const o = this.d.store.load(id);
    return this.apply(o, { type: "owner", decision }, { role: "orchestrator", result: `owner ${decision}` });
  }
}

export function ownerCard(o: Order, reasons: string[], dept: DepartmentRunner): string {
  return [
    `## Co`,
    `${o.brief!.title} — milník ${o.brief!.milestone}, oddělení ${dept.name}.`,
    "",
    `## Důkaz`,
    `- Výstup (DRAFT): ${o.delivered_url}`,
    `- Tvůrce: ${dept.creatorModel()} · Kontrolor: ${dept.checkerModel()} · kol oprav: ${o.fix_rounds}`,
    `- Stav běhu: runs/${o.id}/state.json, záznam runs/log.jsonl (lokálně u orchestrátoru)`,
    "",
    `## Proč čeká na vlastníka`,
    ...reasons.map((r) => `- ${r}`),
    "",
    `## Rozhodnutí`,
    `- **GO** — přijímám výstup jako podklad; další krok podle HANDOFF.`,
    `- **REJECT** — výstup zahodit; důvod napiš do komentáře.`,
    "",
    "Zápis rozhodnutí do orchestrátoru:",
    "```",
    `cd ~/Projects/muj-web && npx tsx tars/orch/cli.ts owner ${o.id} GO`,
    "```",
  ].join("\n");
}
