// Deterministic driver. One tick = guard → lock → resume/advance one order step by step.
// "Kód hlídá, LLM rozhoduje": every gate, limit and record lives here, not in a prompt.
import crypto from "node:crypto";
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
import { BriefError, buildBriefCheckPrompt, buildSupervisorPrompt, HANDOFF_PAGE_ID, parseBrief, type DeptAvailability } from "./supervisor";
import { parseVerdict } from "./departments";
import { archiveMarkdown, readPackage, writePackage, type AdvocateQuestion, type DecisionPackage, type Konzilium } from "./konzilium";
import type { MergeResult, MergeRunner } from "./merge-policy";
import { executeOwnerDecision, mergeConstraints, mergeDecisionPackage, ownerGate, withOrderLockSync } from "./owner-gate";
import { prepBrief } from "./prep";
import type { Department, LogEntry, Order, OwnerChoice } from "./types";

/** Base URL of the local panel; decision cards live at <base>/rozhodnuti/<id>. */
export const PANEL_URL = process.env.TARS_PANEL_URL ?? "http://127.0.0.1:4747";
export const decisionCardUrl = (id: string) => `${PANEL_URL}/rozhodnuti/${id}`;
/** Max "Příprava rozhodnutí" orders one Konzilium may open (WIP stays bounded). */
export const MAX_PREP_PER_KONZILIUM = 3;

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
  /** Konzilium (§2e). Without it, owner-bound orders go straight to WAITING_OWNER (old behaviour). */
  konzilium?: Konzilium;
  /** DR-024 merge policy for PRs (class A self-merge, class B owner card). */
  merge?: MergeRunner;
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

export class ConcurrentChangeError extends Error {}

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
    // Compare-and-swap: nobody else (supersede, abort, owner) changed the order since we loaded it.
    const disk = this.d.store.tryLoad(order.id);
    if (disk && (disk.state !== order.state || disk.updated_at !== order.updated_at))
      throw new ConcurrentChangeError(`zakázka ${order.id} se mezitím změnila (${order.state} → na disku ${disk.state}); přechod ${ev.type} zahozen`);
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
  /** Rewrites the panel row of one order from its state.json (idempotent, no transition). */
  resyncPanel(id: string): Promise<void> {
    this.syncPanel(this.d.store.load(id));
    return this.flushPanel();
  }

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
        const next = await this.step(order);
        if (next === order) break; // no progress this tick (e.g. CI still running) — next tick continues
        order = next;
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
        // Owner superseded an order to be redone with the new recipe → it has priority (deterministic hint).
        const redo = this.d.store.listOrders().find((o) => o.state === "SUPERSEDED" && o.meta.redo === "1" && !o.meta.redone_by && o.brief);
        if (redo)
          open.unshift(
            `PŘEDNOST (vlastník): zakázka ${redo.id} „${redo.brief!.title}“ je SUPERSEDED, ne REJECT — vlastník chce stejnou práci znovu novým receptem s Konziliem (§2e). Navrhni ji znovu (stejné oddělení, milník a rozsah; zlepši zadání podle záznamu). Původní cíl: ${redo.brief!.goal}`,
          );
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
            if (redo) this.d.store.save({ ...redo, meta: { ...redo.meta, redone_by: order.id } });
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
        // Owner gate (owner-gate.ts): every dev PR goes through the DR-024 merge policy; Sponsor-reserved
        // decisions force the owner card (never self-merge).
        const gate = ownerGate(o, dept!, Boolean(this.d.merge));
        if (gate.viaMerge) return this.mergeStep(o, dept!, gate.sponsorReasons);
        const { reasons, ownerNeeded } = gate;
        // §2e: every owner-bound output passes the Konzilium first (when the department has a recipe for it).
        if (ownerNeeded && dept!.konzilium && this.d.konzilium) {
          o = { ...o, owner_reasons: reasons };
          return this.apply(o, { type: "delivered", owner_needed: true, konzilium: true }, { role: "orchestrator", result: o.delivered_url });
        }
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
      case "KONZILIUM":
        return this.konziliumStep(order, dept!);
      default:
        return order;
    }
  }

  /** §2e: advocate + council + incorporation + judge → decision.json, prep orders, Notion archive → WAITING_OWNER. */
  private async konziliumStep(order: Order, dept: DepartmentRunner): Promise<Order> {
    const k = this.d.konzilium!;
    let pkg = readPackage(this.d.store.orderDir(order.id));
    if (!pkg) {
      const draft = this.d.store.readFile(order.id, order.draft_file!);
      const r = await k.run(order, this.d.store.orderDir(order.id), draft, dept.konzilium!, dept.konziliumCreator!(this.ctx), order.draft_file!, (e) =>
        this.log({ order: order.id, kind: "call", role: e.role, model: e.model, family: e.family, result: e.result, duration_ms: e.duration_ms, reason: e.reason }),
      );
      if (!r.ok) {
        if (r.limit) return this.bad(order, { ok: false, limit: true, error: r.error }, "judge")!;
        return this.apply(order, { type: r.unknown ? "unknown" : "fail", reason: r.error }, { role: "judge" });
      }
      pkg = r.pkg;
      // Prep orders only from first-level orders (no recursion from a Příprava rozhodnutí).
      if (order.brief!.department !== "prep") pkg = { ...pkg, ...this.openPrepOrders(order, pkg.advocate) };
      writePackage(this.d.store.orderDir(order.id), pkg);
    }
    let o: Order = { ...order, decision_file: "decision.json" };
    if (!pkg.notion_archive_url) {
      try {
        const card = await this.d.notion.createPage(this.d.draftParentId, `KARTA (archiv) — ${o.brief!.title} (${o.id})`, archiveMarkdown(pkg, decisionCardUrl(o.id)));
        pkg = { ...pkg, notion_archive_url: card.url };
        writePackage(this.d.store.orderDir(o.id), pkg);
        o = { ...o, owner_card_url: card.url };
      } catch (e) {
        // Archive is optional: the decision lives on the local card. Logged, caught up never blocks.
        this.log({ order: o.id, kind: "error", role: "transport", result: "notion archive failed", reason: (e as Error).message.slice(0, 300) });
      }
    }
    return this.apply(o, { type: "konzilium_done" }, { role: "judge", model: pkg.author.model, result: `decision.json · ${decisionCardUrl(o.id)}` });
  }

  /** Advokát questions on Sponsor decisions / locked contracts → "Příprava rozhodnutí" orders (deduped by decision_key). */
  private openPrepOrders(parent: Order, questions: AdvocateQuestion[]): Pick<DecisionPackage, "advocate" | "prep_orders"> {
    const existing = this.d.store.listOrders().filter((x) => x.decision_key && !["FAILED", "UNKNOWN", "SUPERSEDED"].includes(x.state));
    const prep: string[] = [];
    const advocate = questions.map((q) => {
      if (q.touches === "none" || prep.length >= MAX_PREP_PER_KONZILIUM) return q;
      const dup = existing.find((x) => x.decision_key === q.decision_key);
      if (dup) return { ...q, prep_order: dup.id };
      const t = this.now();
      const id = `wo-${t.toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-")}-p${prep.length + 1}`;
      const iso = t.toISOString();
      const o: Order = {
        id,
        mission: parent.mission,
        state: "PLANNED",
        created_at: iso,
        updated_at: iso,
        brief: prepBrief(q, parent),
        fix_rounds: 0,
        manual_interventions: 0,
        history: [{ from: "NEW", to: "PLANNED", event: "planned", at: iso }],
        meta: {},
        parent_order: parent.id,
        decision_key: q.decision_key,
      };
      this.d.store.save(o);
      this.d.store.writeFile(id, "brief.md", briefMarkdown(o.brief!));
      this.syncPanel(o);
      this.log({ order: id, kind: "transition", role: "supervisor", from: "NEW", to: "PLANNED", event: "planned", result: `Příprava rozhodnutí z Konzilia ${parent.id}: ${q.decision_key}` });
      prep.push(id);
      return { ...q, prep_order: id };
    });
    return { advocate, prep_orders: prep };
  }

  /** DR-024 for dev PRs: class A → TARS merges after green CI + PASS review of the other family; class B → owner card. */
  private async mergeStep(o: Order, dept: DepartmentRunner, sponsorReasons: string[] = []): Promise<Order> {
    const pr = /\/pull\/(\d+)/.exec(o.delivered_url!)?.[1];
    if (!pr) return this.apply(o, { type: "unknown", reason: `merge: nelze zjistit číslo PR z ${o.delivered_url}` }, { role: "merge" });
    let r;
    try {
      // Same persisted constraints as `cli.ts merge`: an open card or Sponsor reasons of any order about this PR.
      const cons = mergeConstraints(this.d.store, pr, o.id);
      if (cons.refuse) return this.apply(o, { type: "unknown", reason: `merge: ${cons.refuse}` }, { role: "merge" });
      r = await this.d.merge!.run(pr, dept.creatorFamily, { forceOwner: [...new Set([...sponsorReasons, ...cons.forceOwner])] });
    } catch (e) {
      return this.apply(o, { type: "unknown", reason: `merge: ${(e as Error).message}` }, { role: "merge" });
    }
    this.log({ order: o.id, kind: "info", role: "merge", result: r.status, reason: r.log.join(" | ").slice(0, 500) });
    if (r.status === "pending") return o; // CI still running: stay DELIVERED, next tick retries
    if (r.status === "merged") return this.apply({ ...o, meta: { ...o.meta, merged: "1", merge_class: r.cls } }, { type: "delivered", owner_needed: false }, { role: "merge", result: `merged (třída ${r.cls})` });
    // class B (or blocked) → visual card for the owner; GO on the card makes TARS merge.
    const pkg = mergeDecisionPackage({ id: o.id, title: o.brief!.title, milestone: o.brief!.milestone, pr_url: o.delivered_url! }, r, { role: dept.name, model: dept.creatorModel(), family: dept.creatorFamily }, dept.creatorFamily, this.iso());
    writePackage(this.d.store.orderDir(o.id), pkg);
    return this.apply({ ...o, decision_file: "decision.json", owner_reasons: pkg.merge!.reasons, meta: { ...o.meta, merge_pr: pr, merge_author_family: dept.creatorFamily, merge_blocked: r.status === "blocked" ? "1" : "" } }, { type: "delivered", owner_needed: true }, { role: "merge", result: decisionCardUrl(o.id) });
  }

  /** `cli.ts merge` on a class-B / blocked PR: opens a WAITING_OWNER order with the visual merge card. */
  openMergeCard(pr: string, prUrl: string, authorFamily: "claude" | "gpt", r: Exclude<MergeResult, { status: "merged" } | { status: "pending" }>): Order {
    const t = this.now();
    const iso = t.toISOString();
    const id = `wo-${iso.replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-")}-m${pr}-${crypto.randomBytes(2).toString("hex")}`;
    const title = `Merge PR #${pr} (DR-024 ${r.status === "owner" ? "třída B" : "zablokováno"})`;
    const pkg = mergeDecisionPackage({ id, title, milestone: "TARS", pr_url: prUrl }, r, { role: "autor PR", model: authorFamily, family: authorFamily }, authorFamily, iso);
    const o: Order = {
      id,
      mission: this.d.mission ?? "mezi-vami",
      state: "WAITING_OWNER",
      created_at: iso,
      updated_at: iso,
      brief: { title, department: "dev", milestone: "TARS", why: "DR-024 merge politika", goal: `Rozhodnout merge ${prUrl}`, inputs: [prUrl], acceptance: ["GO jen pro obsah s vazbou na diff"], owner_decisions: [], sources: ["handoff"] },
      fix_rounds: 0,
      manual_interventions: 0,
      history: [{ from: "DELIVERED", to: "WAITING_OWNER", event: "delivered", at: iso }],
      meta: { merge_pr: pr, merge_author_family: authorFamily, merge_blocked: r.status === "blocked" ? "1" : "" },
      delivered_url: prUrl,
      decision_file: "decision.json",
      owner_reasons: pkg.merge!.reasons,
    };
    this.d.store.save(o);
    writePackage(this.d.store.orderDir(id), pkg);
    this.syncPanel(o);
    this.log({ order: id, kind: "info", role: "merge", result: decisionCardUrl(id) });
    return o;
  }

  /** Manual abort by a human — counted as a manual intervention. Never during a running tick or decision. */
  abort(id: string, reason: string): Order {
    return this.ownerMutation(id, () => {
      const o = this.d.store.load(id);
      const counted = { ...o, manual_interventions: o.manual_interventions + 1 };
      return this.apply(counted, { type: "fail", reason: `manual abort: ${reason}` }, { role: "orchestrator", result: "manual abort" });
    });
  }

  /** supersede/abort: run lock (no tick in flight) + the owner gate's per-order lock (no decision in flight). */
  private ownerMutation<T>(id: string, fn: () => T): T {
    if (!this.d.store.acquireLock()) throw new Error("právě běží tick orchestrátoru — zkus to po jeho doběhnutí");
    try {
      return withOrderLockSync(this.d.store.orderDir(id), id, fn);
    } finally {
      this.d.store.releaseLock();
    }
  }

  /**
   * Owner gate (§5). Logged as an owner decision, not as a manual intervention before DELIVERED.
   * Same path for the CLI and the visual card (POST /rozhodnuti/<id> spawns `cli.ts owner`).
   * GO on a merge card (DR-024 class B) makes TARS merge — only the diff the owner saw; a failed merge keeps WAITING_OWNER.
   */
  async owner(id: string, decision: OwnerChoice, via = "cli", rev?: string): Promise<Order> {
    // The decision itself (lock, checks, merge after GO) lives in the gate module owner-gate.ts.
    return executeOwnerDecision(
      { store: this.d.store, merge: this.d.merge, iso: () => this.iso(), log: (e) => this.log(e), apply: (o, ev, extra) => this.apply(o, ev, extra) },
      id,
      decision,
      via,
      rev,
    );
  }

  /** Owner replaced the order by a newer recipe (not REJECT). Frees the WIP limit; `redo` = supervisor proposes it again. */
  supersede(id: string, reason: string, redo: boolean): Order {
    return this.ownerMutation(id, () => {
      const o = this.d.store.load(id);
      return this.apply({ ...o, meta: { ...o.meta, redo: redo ? "1" : "" } }, { type: "supersede", reason }, { role: "orchestrator", result: `superseded${redo ? " (redo)" : ""}` });
    });
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
