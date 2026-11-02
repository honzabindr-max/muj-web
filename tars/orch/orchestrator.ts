// Deterministic driver. One tick = guard → lock → resume/advance one order step by step.
// "Kód hlídá, LLM rozhoduje": every gate, limit and record lives here, not in a prompt.
import fs from "node:fs";

import type { AdapterResult, TextAdapter } from "./adapters";
import type { CardRegistry } from "./cards";
import { briefMarkdown, type DepartmentRunner, type DeptContext, type StepOutcome } from "./departments";
import { adapterPreflight, type LadderEnv, type PreflightResult } from "./ladder";
import type { GuardResult } from "./guard";
import type { NotionClient } from "./notion";
import { panelRow, type PanelIndex, type PanelSink } from "./panel";
import { missingSources, sourcesBlock, type LoadedSource, type SourceLoader } from "./sources";
import { scanSecrets } from "./secret-scan";
import { isActionable, transition, type OrderEvent } from "./state-machine";
import type { Store } from "./store";
import { BriefError, buildBriefCheckPrompt, buildSupervisorPrompt, HANDOFF_PAGE_ID, parseBrief, reservedDecisionHits, type DeptAvailability } from "./supervisor";
import { parseVerdict } from "./departments";
import type { Department, LogEntry, Order } from "./types";

export interface OrchestratorDeps {
  store: Store;
  supervisor: TextAdapter;
  /** GPT checker of the supervisor's brief (karta supervizor.md, bod 6). Must differ in family. */
  briefChecker: TextAdapter;
  departments: Partial<Record<Department, DepartmentRunner>>;
  cards: CardRegistry;
  ladder: LadderEnv;
  notion: NotionClient;
  guard: () => GuardResult;
  draftParentId: string;
  repoRoot: string;
  capsulePath: string;
  /** Notion control panel (TARS — Zakázky). Optional; failures never stop an order. */
  panel?: { sink: PanelSink; index: PanelIndex };
  /** Canonical source loader (karta §2a bod 2). Without it, sources are UNKNOWN. */
  sources?: SourceLoader;
  mission?: string;
  now?: () => Date;
  pauseMinutes?: number;
  maxStepsPerTick?: number;
}

export type TickResult =
  | { status: "guard_alarm"; summary: string }
  | { status: "no_supervisor_card"; problems: string[] }
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

export function assertFamilies(depts: Partial<Record<string, DepartmentRunner>>): void {
  for (const [k, d] of Object.entries(depts)) {
    if (!d) continue;
    if (d.creatorFamily === d.checkerFamily) {
      throw new Error(`department ${k}: creator and checker are both ${d.creatorFamily} (tvůrce ≠ kontrolor)`);
    }
  }
}

export class Orchestrator {
  private now: () => Date;
  private panelQueue: Promise<void> = Promise.resolve();
  private ctx: DeptContext;
  constructor(private d: OrchestratorDeps) {
    assertFamilies(d.departments);
    if (d.briefChecker.family === d.supervisor.family) throw new Error("brief checker must be another model family than the supervisor");
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
    this.syncPanel(next);
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

  /**
   * Rewrites the order's panel row from state.json. Serialized; errors are logged, never thrown.
   * Every sync writes the full current row, so a missed update is caught up by the next one.
   */
  private syncPanel(o: Order): void {
    const panel = this.d.panel;
    if (!panel) return;
    const dept = o.brief ? this.d.departments[o.brief.department] : undefined;
    const row = panelRow(o, dept?.creatorModel() ?? "—", dept?.checkerModel() ?? "—");
    this.panelQueue = this.panelQueue.then(async () => {
      const t0 = Date.now();
      try {
        const id = await panel.sink.upsert(row, panel.index.get(o.id));
        panel.index.set(o.id, id);
        this.log({ order: o.id, kind: "info", role: "transport", result: `panel ${o.state}`, duration_ms: Date.now() - t0 });
      } catch (e) {
        this.log({ order: o.id, kind: "error", role: "transport", result: "panel sync failed", reason: (e as Error).message.slice(0, 300), duration_ms: Date.now() - t0 });
      }
    });
  }

  private async loadSources(keys: string[]): Promise<LoadedSource[]> {
    if (this.d.sources) return this.d.sources.loadAll(keys);
    return keys.map((key) => ({ key, title: key, ok: false, reason: "zavaděč zdrojů není nakonfigurován" }));
  }

  /** Writes the creator card's sources to runs/<id>/sources/ (+ status) for the departments. */
  private async stageSources(o: Order): Promise<void> {
    const keys = this.d.cards.creatorFor(o.brief!.department).card?.sources ?? [];
    const loaded = await this.loadSources(keys);
    for (const s of loaded) if (s.ok) this.d.store.writeFile(o.id, `sources/${s.key}.md`, s.text!);
    this.d.store.writeFile(o.id, "sources.json", JSON.stringify(loaded.map(({ key, title, ok, reason }) => ({ key, title, ok, reason })), null, 2));
  }

  /** Waits for pending panel writes (end of tick, tests). */
  flushPanel(): Promise<void> {
    return this.panelQueue;
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
    this.syncPanel(order);
    this.log({ order: id, kind: "info", role: "orchestrator", result: "order created" });
    return order;
  }

  /**
   * §2a + §2b gate for a department: creator card valid, card matches the runner
   * (families, card role), checker of another family, adapter rules of the card's rung met.
   */
  preflight(dept: Department): PreflightResult & { maxFix?: number; cardRole?: string } {
    const runner = this.d.departments[dept];
    if (!runner) return { ok: false, reasons: [`oddělení ${dept} není v tomto běhu zapojeno`] };
    const c = this.d.cards.creatorFor(dept);
    if (!c.ok || !c.card) return { ok: false, reasons: c.problems };
    const reasons: string[] = [];
    if (c.card.role !== runner.cardRole) reasons.push(`karta ${c.card.role} ≠ runner ${runner.cardRole}`);
    if (c.card.family !== runner.creatorFamily) reasons.push(`karta říká tvůrce ${c.card.family}, runner ${runner.creatorFamily}`);
    if (c.card.checker_family !== runner.checkerFamily) reasons.push(`karta říká kontrolor ${c.card.checker_family}, runner ${runner.checkerFamily}`);
    if (runner.creatorFamily === runner.checkerFamily) reasons.push("tvůrce ≠ kontrolor porušeno");
    const ladder = adapterPreflight(c.card, this.d.ladder);
    reasons.push(...ladder.reasons);
    return { ok: reasons.length === 0, reasons, maxFix: c.card.max_fix_rounds, cardRole: c.card.role };
  }

  availability(): DeptAvailability[] {
    return (["copy", "dev", "vizual"] as const).map((d) => {
      const p = this.preflight(d);
      return { department: d, card: p.cardRole ?? "—", available: p.ok, reasons: p.reasons };
    });
  }

  async tick(): Promise<TickResult> {
    const sc = this.d.cards.check("supervizor");
    if (!sc.ok) return { status: "no_supervisor_card", problems: sc.problems };
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
      await this.flushPanel();
      this.d.store.releaseLock();
    }
  }

  /** Common handling of a model step outcome: limit → PAUSED, error → FAILED. */
  private bad(order: Order, r: StepOutcome, role: LogEntry["role"]): Order | undefined {
    if (r.ok) return undefined;
    if (r.ui_unknown) {
      // §2b: UI failure after 2 attempts → UNKNOWN + owner card, never blind retry.
      void this.d.notion
        .createPage(this.d.draftParentId, `KARTA UNKNOWN — ${order.brief?.title ?? order.id} (${order.id})`, `## Co\nAdaptér prohlížeče selhal po 2 pokusech.\n\n## Důkaz\n- ${r.error}\n- screenshoty: runs/${order.id}/shots-*\n\n## Rozhodnutí\nZkontroluj UI a zakázku zopakuj nebo zahoď.`)
        .catch(() => undefined);
      return this.apply(order, { type: "unknown", reason: `${role}: ${r.error}` }, { role, model: r.model });
    }
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
        const avail = this.availability();
        this.d.store.writeFile(order.id, "availability.json", JSON.stringify(avail, null, 2));
        let handoff = "";
        if (this.d.notion.fetchPage) {
          try {
            handoff = await this.d.notion.fetchPage(HANDOFF_PAGE_ID);
            this.d.store.writeFile(order.id, "handoff-snapshot.md", handoff);
          } catch (e) {
            return this.bad(order, { ok: false, error: `HANDOFF fetch: ${(e as Error).message}`, limit: Boolean((e as { limit?: boolean }).limit) }, "transport")!;
          }
        }
        const card = this.d.cards.text("supervizor");
        // §2a bod 2: supervisor reads its own sources + required sources of every available department.
        const requiredByDept: Record<string, string[]> = {};
        for (const a of avail.filter((x) => x.available)) requiredByDept[a.department] = this.d.cards.creatorFor(a.department as Department).card?.sources ?? [];
        const supKeys = this.d.cards.check("supervizor").card?.sources ?? [];
        const allKeys = [...new Set([...supKeys, ...Object.values(requiredByDept).flat()])].filter((k) => k !== "handoff" && k !== "capsule");
        const loaded: LoadedSource[] = await this.loadSources(allKeys);
        this.d.store.writeFile(order.id, "sources-status.json", JSON.stringify(loaded.map(({ key, ok, reason }) => ({ key, ok, reason })), null, 2));
        const supSources = sourcesBlock(loaded);
        let lastErr = "";
        let issues: string[] = [];
        for (let attempt = 0; attempt < 2; attempt++) {
          const prompt = buildSupervisorPrompt(capsule, this.d.store.readLog(200), open, avail, card, handoff, issues, supSources, requiredByDept);
          const r = await this.d.supervisor.run(prompt, { cwd: this.d.store.orderDir(order.id) });
          this.log({ order: order.id, kind: "call", role: "supervisor", model: this.d.supervisor.model, family: this.d.supervisor.family, duration_ms: r.duration_ms, result: r.ok ? "ok" : "error", reason: r.error });
          if (!r.ok) return this.bad(order, { ok: false, limit: r.limit, error: r.error, model: this.d.supervisor.model }, "supervisor")!;
          let brief;
          try {
            brief = parseBrief(r.text);
          } catch (e) {
            if (!(e instanceof BriefError)) throw e;
            lastErr = e.message;
            continue;
          }
          // Deterministic: every required source of the creator card must be referenced (else FIX).
          const required = requiredByDept[brief.department] ?? this.d.cards.creatorFor(brief.department).card?.sources ?? [];
          const missing = missingSources(required, brief.sources);
          if (missing.length) {
            issues = missing.map((k) => `zadání neuvádí povinný zdroj karty: ${k}`);
            lastErr = `brief check FIX (deterministic): ${issues.join("; ")}`;
            this.log({ order: order.id, kind: "call", role: "checker", model: "deterministic", family: "none", result: "FIX", reason: issues.join(" | ") });
            continue;
          }
          const deptSources = sourcesBlock(loaded.filter((l) => required.includes(l.key)));
          // Supervisor card, bod 6: the brief is checked by a model of the other family.
          const c = await this.d.briefChecker.run(buildBriefCheckPrompt(brief, handoff, card, capsule, required, deptSources), { cwd: this.d.store.orderDir(order.id) });
          const v = c.ok ? parseVerdict(c.text) : undefined;
          this.log({ order: order.id, kind: "call", role: "checker", model: this.d.briefChecker.model, family: this.d.briefChecker.family, duration_ms: c.duration_ms, result: v?.verdict ?? "error", reason: c.error ?? v?.issues.join(" | ").slice(0, 500) });
          if (!c.ok) return this.bad(order, { ok: false, limit: c.limit, error: c.error, model: this.d.briefChecker.model }, "checker")!;
          this.d.store.writeFile(order.id, `brief-check-a${attempt}.md`, c.text);
          if (v?.verdict === "PASS") {
            this.d.store.writeFile(order.id, "brief.md", briefMarkdown(brief));
            return this.apply({ ...order, brief }, { type: "planned" }, { role: "supervisor", model: this.d.supervisor.model, duration_ms: r.duration_ms, result: `${brief.department}: ${brief.title}` });
          }
          issues = v?.issues ?? ["verdikt kontrolora nečitelný"];
          lastErr = `brief check ${v?.verdict ?? "unparseable"}: ${issues.join("; ")}`;
        }
        return this.apply(order, { type: "unknown", reason: `supervisor brief invalid: ${lastErr}` }, { role: "supervisor" });
      }
      case "PLANNED": {
        // Never start a specialist without a card or with unmet §2b adapter rules.
        const p = this.preflight(order.brief!.department);
        const o = { ...order, max_fix_rounds: p.maxFix, card_role: p.cardRole };
        if (p.ok) await this.stageSources(o);
        return this.apply(o, { type: "start", preflight: { ok: p.ok, reasons: p.reasons } }, { role: "orchestrator", result: p.ok ? dept?.name : "preflight FAIL", reason: p.reasons.join("; ") || undefined });
      }
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
        return this.apply({ ...order, draft_file: r.draft_file ?? order.draft_file, meta: { ...order.meta, ...((r as { meta?: Record<string, string> }).meta ?? {}) } }, { type: "revised" }, { role: "creator", model: r.model, family: dept!.creatorFamily, duration_ms: r.duration_ms });
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

  /** Manual abort by a human — counted as a manual intervention. */
  abort(id: string, reason: string): Order {
    const o = this.d.store.load(id);
    const counted = { ...o, manual_interventions: o.manual_interventions + 1 };
    return this.apply(counted, { type: "fail", reason: `manual abort: ${reason}` }, { role: "orchestrator", result: "manual abort" });
  }

  /** Owner gate (§5). Logged as an owner decision, not as a manual intervention before DELIVERED. */
  owner(id: string, decision: "GO" | "REJECT"): Order {
    const o = this.d.store.load(id);
    return this.apply(o, { type: "owner", decision }, { role: "orchestrator", result: `owner ${decision}` });
  }
}

/** Keeps only the listed departments (empty list = all). Unwired ones show as unavailable to the supervisor. */
export function onlyEnabled<T>(enabled: string[], all: Partial<Record<Department, T>>): Partial<Record<Department, T>> {
  if (!enabled.length) return all;
  return Object.fromEntries(Object.entries(all).filter(([k]) => enabled.includes(k))) as Partial<Record<Department, T>>;
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
