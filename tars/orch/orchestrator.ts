// Deterministic driver. One tick = guard → lock → resume/advance one order step by step.
// "Kód hlídá, LLM rozhoduje": every gate, limit and record lives here, not in a prompt.
import fs from "node:fs";

import type { AdapterResult, TextAdapter } from "./adapters";
import { artifactHash, goBlocker } from "./approval";
import type { CardRegistry } from "./cards";
import { briefMarkdown, type DepartmentRunner, type DeptContext, type StepOutcome } from "./departments";
import { adapterPreflight, type LadderEnv, type PreflightResult } from "./ladder";
import type { GuardResult } from "./guard";
import type { NotionClient } from "./notion";
import { buildCardData, cardDataSection } from "./card-data";
import { isUncertainOutcome, NotionRestError } from "./notion";
import { waitingOwnerTransitions, type OwnerPing } from "./owner-ping";
import { panelRow, type PanelIndex, type PanelSink } from "./panel";
import { missingSources, sourcesBlock, type LoadedSource, type SourceLoader } from "./sources";
import { scanSecrets } from "./secret-scan";
import { isActionable, ownerEventFor, transition, TransitionError, type OrderEvent } from "./state-machine";
import type { Store } from "./store";
import { acceptableCheckNotes, BriefError, buildBriefCheckPrompt, buildSupervisorPrompt, HANDOFF_PAGE_ID, parseBrief, reservedDecisionHits, type DeptAvailability } from "./supervisor";
import { callChecker } from "./departments";
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
  /** Plán B push na iPhone: komentář se zmínkou vlastníka na řádku zakázky při přechodu do WAITING_OWNER. Optional; failures never stop an order. */
  ownerPing?: OwnerPing;
  /** Claude adaptér (sonnet) pro data vizuální karty. Bez něj se do karty vloží záložní objekt z briefu. */
  cardAdapter?: TextAdapter;
  /** Canonical source loader (karta §2a bod 2). Without it, sources are UNKNOWN. */
  sources?: SourceLoader;
  mission?: string;
  now?: () => Date;
  pauseMinutes?: number;
  maxStepsPerTick?: number;
  /** How long `owner`/`abort`/the Notion decision wait for the short state lock (default 5000 ms). */
  stateLockWaitMs?: number;
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
  get supportsOutputSchema() {
    return this.inner.supportsOutputSchema;
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
  /** Přechody, na které už v právě běžícím ticku odešel pokus o komentář (jen během ticku). */
  private tickPingKeys: Set<string> | undefined;
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

  /**
   * DR-039, etapa 2: a save the Store refused (newer version on disk, e.g. an abort while this step waited for a model;
   * or the tick lease is no longer ours) is never retried and nothing else follows from it: the newer stored state is
   * returned instead, the Store has already logged the refusal.
   */
  private persist(o: Order): Order | undefined {
    if (this.d.store.save(o)) return o;
    return undefined;
  }

  private current(id: string): Order {
    return this.d.store.load(id);
  }

  private apply(order: Order, ev: OrderEvent, extra: Partial<LogEntry> = {}): Order {
    const next = transition(order, ev, this.iso());
    if (!this.persist(next)) return this.current(order.id);
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
      let creating = false;
      try {
        let existing = panel.index.get(o.id);
        if (!existing && panel.index.isUncertain(o.id)) {
          // An earlier create may have been saved without us seeing the answer: look the row up by order id (REST filter,
          // never SQL/rows) before creating again. If the lookup fails we do not create; the next sync tries again.
          if (!panel.sink.findRowByOrderId) throw new Error("výsledek dřívějšího vytvoření řádku je nejasný, čekám na REST kvůli dohledání");
          existing = await panel.sink.findRowByOrderId(o.id);
          if (existing) panel.index.set(o.id, existing);
          else panel.index.clearUncertain(o.id);
        }
        creating = !existing;
        const id = await panel.sink.upsert(row, existing);
        panel.index.set(o.id, id);
        this.log({ order: o.id, kind: "info", role: "transport", result: `panel ${o.state}`, duration_ms: Date.now() - t0 });
        await this.pingOwner(o, id);
      } catch (e) {
        // Only a sink that can look rows up may mark (otherwise the mark could never be resolved and would block the panel).
        if (creating && panel.sink.findRowByOrderId && isUncertainOutcome(e)) panel.index.markUncertain(o.id);
        this.log({ order: o.id, kind: "error", role: "transport", result: "panel sync failed", reason: (e as Error).message.slice(0, 300), duration_ms: Date.now() - t0 });
      }
    });
  }

  /**
   * Plán B upozornění: jeden komentář se zmínkou vlastníka na jeden přechod do WAITING_OWNER. Idempotence je ve stavu
   * zakázky: `meta.owner_ping` drží číslo přechodu, na který komentář odešel (nebo jeho výsledek je nejasný a nesmí se
   * opakovat naslepo). Chyba 403 (chybí „Insert comments“), chybějící token ani jiná chyba zakázku nezastaví a nezapíše
   * značku, takže další zápis řádku nebo běžný tick (`retryOwnerPings`, nejvýš jednou za tick) to zkusí znovu. Nikdy nevyhazuje chybu.
   */
  private async pingOwner(o: Order, pageId: string): Promise<void> {
    const ping = this.d.ownerPing;
    if (!ping || o.state !== "WAITING_OWNER") return;
    try {
      const n = waitingOwnerTransitions(o);
      const current = this.d.store.load(o.id);
      if (current.state !== "WAITING_OWNER" || waitingOwnerTransitions(current) !== n || current.meta.owner_ping === String(n)) return;
      // V jednom ticku se na jeden přechod posílá nejvýš jednou (zápis řádku a opakování po selhání se nesčítají).
      const key = `${o.id}:${n}`;
      if (this.tickPingKeys?.has(key)) return;
      this.tickPingKeys?.add(key);
      const title = current.brief?.title ?? `Nová zakázka ${current.id}`;
      const t0 = Date.now();
      const r = await ping.send(pageId, title);
      const base = { order: o.id, role: "transport" as const, duration_ms: Date.now() - t0 };
      if (r.outcome === "sent" || r.outcome === "uncertain") {
        this.d.store.withStateLock(() => {
          const fresh = this.d.store.load(o.id);
          if (fresh.state !== "WAITING_OWNER" || waitingOwnerTransitions(fresh) !== n) return;
          this.d.store.save({ ...fresh, meta: { ...fresh.meta, owner_ping: String(n) } });
        }, this.d.stateLockWaitMs);
      }
      if (r.outcome === "sent") this.log({ ...base, kind: "info", result: "upozornění na iPhone: komentář se zmínkou odeslán" });
      else if (r.outcome === "uncertain") this.log({ ...base, kind: "error", result: r.detail ?? "upozornění na iPhone: výsledek nejasný" });
      else if (r.outcome === "failed") this.logOnce({ order: o.id, kind: "error", role: "transport", result: r.detail ?? "upozornění na iPhone selhalo" }); // opakuje se každý tick, hláška se nezdvojuje
      else this.logOnce({ order: o.id, kind: "info", role: "transport", result: r.detail ?? `upozornění na iPhone: ${r.outcome}` });
    } catch (e) {
      this.log({ order: o.id, kind: "error", role: "transport", result: "upozornění na iPhone selhalo", reason: (e as Error).message.slice(0, 300) });
    }
  }

  /**
   * Běžný tick zkusí znovu upozornění u zakázek ve WAITING_OWNER, kterým komentář neodešel (chybělo oprávnění, stránka
   * nebyla sdílena, jiné odmítnutí). Značku `meta.owner_ping` má jen odeslaný nebo nejasný (`uncertain`) pokus, takže
   * nejasný výsledek se naslepo neopakuje. Nejvýš jeden pokus na zakázku a přechod za tick; běží ve frontě panelu.
   */
  private retryOwnerPings(): Promise<void> {
    const panel = this.d.panel;
    if (!panel || !this.d.ownerPing) return Promise.resolve();
    this.panelQueue = this.panelQueue.then(async () => {
      try {
        for (const w of this.d.store.listOrders().filter((x) => x.state === "WAITING_OWNER")) {
          const pageId = panel.index.get(w.id);
          if (pageId) await this.pingOwner(w, pageId);
        }
      } catch (e) {
        this.log({ order: "-", kind: "error", role: "transport", result: "opakování upozornění na iPhone selhalo", reason: (e as Error).message.slice(0, 300) });
      }
    });
    return this.panelQueue;
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
    this.tickPingKeys = new Set();
    try {
      await this.pollOwnerDecisions();
      await this.retryOwnerPings();
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
        // DR-039, etapa 2: the next step (model call, delivery) starts only while the tick lease is still ours.
        if (!this.d.store.holdsLease()) {
          this.log({ order: order.id, kind: "error", role: "orchestrator", result: "tick lock už nedrží tento běh, krok nespuštěn" });
          return { status: "locked" };
        }
        // Re-check guard before anything leaves the machine.
        if (order.state === "DELIVERED" && this.d.guard().alarm) return { status: "guard_alarm", summary: "ALARM before delivery" };
        order = await this.step(order);
      }
      if (order.state === "PAUSED") return { status: "paused", order: order.id, resume_after: order.resume_after! };
      if (order.state === "WAITING_OWNER") return { status: "waiting_owner", order: order.id };
      return { status: "advanced", order: order.id, state: order.state };
    } finally {
      await this.flushPanel();
      this.tickPingKeys = undefined;
      this.d.store.releaseLock();
    }
  }

  /**
   * Owner gate through the Notion panel: for every order in WAITING_OWNER the owner may have filled the
   * select „Rozhodnutí vlastníka“ (GO | GO A | GO B | REJECT) on the iPhone. The orchestrator only READS it
   * (never writes that property). REJECT runs the `owner` transition; GO is only recorded (DR-039, `acceptOwner`)
   * and reaches DONE in `verifyApprovals` after a fresh read-back. Unknown/empty values are ignored;
   * a failed read is logged and retried on the next tick.
   */
  async pollOwnerDecisions(): Promise<void> {
    await this.readNotionDecisions();
    await this.verifyApprovals();
  }

  private async readNotionDecisions(): Promise<void> {
    const panel = this.d.panel;
    if (!panel) return;
    const waitingOrders = this.d.store.listOrders().filter((x) => x.state === "WAITING_OWNER");
    if (!panel.sink.readOwnerDecision) {
      // Only the REST API may deliver the owner's decision; the claude -p fallback never does.
      for (const w of waitingOrders) this.logOnce({ order: w.id, kind: "info", role: "transport", result: "rozhodnutí vlastníka z Notionu čeká na token (Notion REST)" });
      return;
    }
    for (const waiting of waitingOrders) {
      try {
        let pageId = panel.index.get(waiting.id);
        if (!pageId) {
          // Every earlier write of this row failed (or its outcome is unknown): sync it now, otherwise the tap could never be read.
          await this.resyncPanel(waiting.id);
          pageId = panel.index.get(waiting.id);
          if (!pageId) continue;
        }
        const value = await panel.sink.readOwnerDecision(pageId);
        const ev = ownerEventFor(value);
        if (!ev) continue;
        // The read took a while and `cli owner` may have decided meanwhile: read-check-write the stored state under the state lock.
        this.d.store.withStateLock(() => {
          const fresh = this.d.store.load(waiting.id);
          if (fresh.state !== "WAITING_OWNER") return;
          this.acceptOwner(fresh, ev, `Notion ${value}`);
        }, this.d.stateLockWaitMs);
      } catch (e) {
        this.log({ order: waiting.id, kind: "error", role: "transport", result: "owner decision read failed", reason: (e as Error).message.slice(0, 300) });
      }
    }
  }

  /**
   * DR-039, one entry point for every owner decision (Notion panel and `owner()`); call under the state lock.
   * REJECT → FAILED at once. GO is bound to the delivered artifact: it is accepted only when the card carries
   * `meta.approved_hash` and `meta.artifact_hash === meta.approved_hash`; then it is recorded in `meta.owner_go`
   * and the order STAYS in WAITING_OWNER until `verifyApprovals` reads the target back. A stale GO is logged, nothing else.
   */
  private acceptOwner(o: Order, ev: Extract<OrderEvent, { type: "owner" }>, source: string): Order {
    if (ev.decision === "REJECT") return this.apply(o, ev, { role: "orchestrator", result: `owner REJECT (${source})` });
    if (o.meta.owner_go) return o; // already recorded, waits for the read-back
    const why = !o.meta.approved_hash
      ? "chybí approved_hash (karta bez otisku artefaktu)"
      : o.meta.artifact_hash !== o.meta.approved_hash
        ? "artifact_hash ≠ approved_hash (GO patří k jinému obsahu)"
        : undefined;
    if (why) {
      this.logOnce({ order: o.id, kind: "info", role: "orchestrator", result: `GO nepřijato (${source}): ${why}` });
      return o;
    }
    const at = this.iso();
    const next: Order = { ...o, updated_at: at, meta: { ...o.meta, owner_go: at, owner_go_source: source, ...(ev.option ? { owner_option: ev.option } : {}) } };
    if (!this.persist(next)) return this.current(o.id);
    this.syncPanel(next);
    this.log({ order: o.id, kind: "info", role: "orchestrator", result: `owner GO (${source}) přijato, čeká na read-back` });
    return next;
  }

  /** Current content of the delivered artifact: the department's own read-back (PR head) or the Notion page (REST). */
  private async readArtifact(o: Order): Promise<string> {
    const dept = o.brief ? this.d.departments[o.brief.department] : undefined;
    if (dept?.readback) return dept.readback(o, this.ctx);
    if (this.d.notion.readPage) return this.d.notion.readPage(o.delivered_url!);
    throw new Error("read-back není k dispozici (Notion REST bez tokenu)");
  }

  /**
   * DR-039: GO → DONE only after a fresh read-back. For every WAITING_OWNER order with a recorded GO, read the target
   * at `delivered_url`, store `meta.readback` {url, hash, verified_at} and run the `owner` GO transition only when the
   * hash equals `approved_hash` (the state machine re-checks it in `goBlocker`). No read-back, an error or an unclear
   * answer: the order stays WAITING_OWNER („čeká na read-back“) and the next tick tries again. A different hash: the
   * order stays WAITING_OWNER with „obsah se po vydání karty změnil“, the GO is dropped and `artifact_hash` set to the
   * hash found, so the same GO can never be accepted again for that content.
   */
  async verifyApprovals(): Promise<void> {
    for (const w of this.d.store.listOrders().filter((x) => x.state === "WAITING_OWNER" && x.meta.owner_go)) {
      try {
        if (!w.delivered_url) {
          this.logOnce({ order: w.id, kind: "info", role: "orchestrator", result: "čeká na read-back", reason: "chybí delivered_url" });
          continue;
        }
        let hash: string;
        try {
          hash = artifactHash(await this.readArtifact(w));
        } catch (e) {
          this.logOnce({ order: w.id, kind: "info", role: "transport", result: "čeká na read-back", reason: String((e as Error)?.message ?? e).slice(0, 200) });
          continue;
        }
        this.d.store.withStateLock(() => {
          const fresh = this.d.store.load(w.id);
          if (fresh.state !== "WAITING_OWNER" || fresh.meta.owner_go !== w.meta.owner_go || fresh.delivered_url !== w.delivered_url) return;
          const matched = hash === fresh.meta.approved_hash;
          const meta: Record<string, string> = {
            ...fresh.meta,
            readback: JSON.stringify({ url: fresh.delivered_url, hash, verified_at: this.iso() }),
            artifact_hash: matched ? fresh.meta.approved_hash! : hash,
          };
          if (!matched) {
            delete meta.owner_go;
            delete meta.owner_go_source;
            const held: Order = { ...fresh, updated_at: this.iso(), meta };
            if (!this.persist(held)) return;
            this.syncPanel(held);
            this.log({ order: w.id, kind: "error", role: "orchestrator", result: "obsah se po vydání karty změnil, GO zrušeno", reason: `hash ${hash.slice(0, 12)} ≠ ${String(fresh.meta.approved_hash).slice(0, 12)}` });
            return;
          }
          const verified: Order = { ...fresh, meta };
          const blocker = goBlocker(verified);
          if (blocker) {
            if (!this.persist(verified)) return;
            this.logOnce({ order: w.id, kind: "info", role: "orchestrator", result: "čeká na read-back", reason: blocker });
            return;
          }
          const option = fresh.meta.owner_option === "A" || fresh.meta.owner_option === "B" ? fresh.meta.owner_option : undefined;
          this.apply(verified, { type: "owner", decision: "GO", option }, { role: "orchestrator", result: `owner GO (${fresh.meta.owner_go_source ?? "?"}) + read-back OK` });
        }, this.d.stateLockWaitMs);
      } catch (e) {
        this.log({ order: w.id, kind: "error", role: "orchestrator", result: "read-back selhal", reason: (e as Error).message.slice(0, 300) });
      }
    }
  }

  /** Writes an info line unless the same one is already among the latest log entries (the log is read by the supervisor). */
  private logOnce(e: Omit<LogEntry, "ts">): void {
    if (this.d.store.readLog(40).some((x) => x.order === e.order && x.result === e.result)) return;
    this.log(e);
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
          const { r: c, v, findings: cFindings } = await callChecker(this.d.briefChecker, buildBriefCheckPrompt(brief, handoff, card, capsule, required, deptSources, Boolean(this.d.briefChecker.supportsOutputSchema)), this.d.store.orderDir(order.id));
          this.log({ order: order.id, kind: "call", role: "checker", model: this.d.briefChecker.model, family: this.d.briefChecker.family, duration_ms: c.duration_ms, result: v?.verdict ?? "error", reason: c.error ?? v?.issues.join(" | ").slice(0, 500) });
          if (!c.ok) return this.bad(order, { ok: false, limit: c.limit, error: c.error, model: this.d.briefChecker.model }, "checker")!;
          this.d.store.writeFile(order.id, `brief-check-a${attempt}.md`, c.text);
          if (v?.verdict === "PASS") {
            this.d.store.writeFile(order.id, "brief.md", briefMarkdown(brief));
            return this.apply({ ...order, brief }, { type: "planned" }, { role: "supervisor", model: this.d.supervisor.model, duration_ms: r.duration_ms, result: `${brief.department}: ${brief.title}` });
          }
          // DR-031 b. 2: poslední pokus s FIX jen medium/low/info = známá rizika, zadání se přijme s výhradami.
          const notes = attempt === 1 && this.d.briefChecker.supportsOutputSchema ? acceptableCheckNotes(v?.verdict, cFindings) : undefined;
          if (notes) {
            const accepted = { ...brief, check_notes: notes };
            this.d.store.writeFile(order.id, "brief.md", briefMarkdown(accepted));
            return this.apply({ ...order, brief: accepted }, { type: "planned" }, { role: "supervisor", model: this.d.supervisor.model, duration_ms: r.duration_ms, result: `PASS s výhradami (DR-031): ${brief.department}: ${brief.title}`, reason: notes.join(" | ").slice(0, 500) });
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
          // DR-039: the hash of the artifact exactly as sent is stored in the same write as its URL.
          const sent = r.content !== undefined ? artifactHash(r.content) : undefined;
          o = { ...o, delivered_url: r.url, meta: sent ? { ...o.meta, delivered_hash: sent } : o.meta };
          if (!this.persist(o)) return this.current(o.id);
        }
        const reasons = [
          ...(dept!.alwaysOwner ? ["výstup je PR do main — merge dělá vlastník (DR-022)"] : []),
          ...o.brief!.owner_decisions,
          ...reservedDecisionHits(`${o.brief!.title}\n${o.brief!.goal}`).map((k) => `zadání se dotýká: ${k}`),
        ];
        const ownerNeeded = reasons.length > 0;
        if (ownerNeeded && !o.owner_card_url) {
          // DR-039: no card without a fingerprint. Right before the card is written the DRAFT is read back; the hash of
          // exactly what was read (what the owner will see on the page) becomes approved_hash = artifact_hash. A failed
          // read-back (incl. MCP-only delivery without REST) leaves the order in DELIVERED with the reason and no card;
          // the next tick retries. It never reaches WAITING_OWNER with a card.
          let seen: string;
          try {
            seen = artifactHash(await this.readArtifact(o));
          } catch (e) {
            this.logOnce({ order: o.id, kind: "info", role: "transport", result: "karta nevydána: read-back DRAFTu selhal", reason: String((e as Error)?.message ?? e).slice(0, 200) });
            return this.current(o.id); // etapa 2: the stored state (it may have moved on during the read)
          }
          o = { ...o, meta: { ...o.meta, approved_hash: seen, artifact_hash: seen } };
          try {
            const cardTitle = `KARTA GO/REJECT — ${o.brief!.title} (${o.id})`;
            const text = ownerCard(o, reasons, dept!);
            const dataSection = await this.cardDataSection(o);
            let card;
            try {
              card = await this.d.notion.createPage(this.d.draftParentId, cardTitle, text + dataSection);
            } catch (e) {
              // Čisté odmítnutí (REST 4xx, nic se nezapsalo) kvůli sekci s daty karty: stránka vznikne bez ní.
              if (!dataSection || !(e instanceof NotionRestError) || e.status < 400 || e.status >= 500 || e.status === 408 || e.status === 429) throw e;
              this.safeLog({ order: o.id, kind: "info", role: "orchestrator", result: "card-data: Notion zápis odmítnut, karta bez dat", reason: `notion REST ${e.status} ${e.code}` });
              card = await this.d.notion.createPage(this.d.draftParentId, cardTitle, text);
            }
            // DR-039: approved_hash/artifact_hash from the read-back above are saved in the same write as the card URL.
            // Etapa 2: a refused save (newer state on disk) stops here, nothing follows from an outdated order.
            o = { ...o, owner_card_url: card.url, owner_reasons: reasons };
            if (!this.persist(o)) return this.current(o.id);
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

  /** Sekce „Data karty“ (markdown) pro KARTA stránku. Nikdy nevyhodí výjimku: při jakékoli chybě vrátí "" nebo záložní data. */
  private async cardDataSection(o: Order): Promise<string> {
    try {
      let draft = "";
      try {
        if (o.draft_file) draft = this.d.store.readFile(o.id, o.draft_file);
      } catch {
        /* draft nejde přečíst → záložní objekt */
      }
      const data = await buildCardData(o, draft, o.delivered_url, {
        adapter: this.d.cardAdapter,
        cwd: this.d.store.orderDir(o.id),
        onFallback: (reason) => this.safeLog({ order: o.id, kind: "info", role: "orchestrator", result: "card-data: záložní objekt", reason }),
      });
      return cardDataSection(data);
    } catch (e) {
      this.safeLog({ order: o.id, kind: "error", role: "orchestrator", result: "card-data: sekce vynechána", reason: String((e as Error)?.message ?? e).slice(0, 200) });
      return "";
    }
  }

  /** Diagnostický log karty: jeho selhání (plný disk, zámek …) nesmí shodit doručení zakázky. */
  private safeLog(e: Omit<LogEntry, "ts">): void {
    try {
      this.log(e);
    } catch {
      /* log je jen diagnostika */
    }
  }

  /** Manual abort by a human — counted as a manual intervention. */
  abort(id: string, reason: string): Order {
    return this.d.store.withStateLock(() => {
      const o = this.d.store.load(id);
      const counted = { ...o, manual_interventions: o.manual_interventions + 1 };
      return this.apply(counted, { type: "fail", reason: `manual abort: ${reason}` }, { role: "orchestrator", result: "manual abort" });
    }, this.d.stateLockWaitMs);
  }

  /**
   * Owner gate (§5). Logged as an owner decision, not as a manual intervention before DELIVERED.
   * DR-039: same rules as the Notion panel (`acceptOwner`): REJECT → FAILED; GO bound to the approved hash is only
   * recorded and the order stays WAITING_OWNER until the next tick's read-back (`verifyApprovals`).
   */
  owner(id: string, decision: "GO" | "REJECT", option?: "A" | "B"): Order {
    return this.d.store.withStateLock(() => {
      const o = this.d.store.load(id);
      if (o.state !== "WAITING_OWNER") throw new TransitionError(`illegal transition: ${o.state} --owner-->`);
      return this.acceptOwner(o, { type: "owner", decision, option }, `owner ${decision}${option ? ` ${option}` : ""}`);
    }, this.d.stateLockWaitMs);
  }
}

const KNOWN_DEPARTMENTS: readonly Department[] = ["copy", "dev", "vizual"];

/**
 * N3 (DR-039, etapa 2): `cli.ts tick` runs only with an explicit scope. Without TARS_DEPARTMENTS (or with an unknown
 * name) the tick is refused instead of silently wiring every department (dev opens PRs, vizual opens Chrome).
 * Returns the Czech reason to refuse, or undefined when the scope is valid.
 */
export function tickScopeError(raw: string | undefined): string | undefined {
  const list = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!list.length) return "tick odmítnut: chybí TARS_DEPARTMENTS. Rozsah běhu musí být výslovný, např. TARS_DEPARTMENTS=copy (launchd plist ho nastavuje); všechna oddělení = TARS_DEPARTMENTS=copy,dev,vizual.";
  const unknown = list.filter((d) => !KNOWN_DEPARTMENTS.includes(d as Department));
  if (unknown.length) return `tick odmítnut: neznámé oddělení v TARS_DEPARTMENTS: ${unknown.join(", ")} (povolené: ${KNOWN_DEPARTMENTS.join(", ")}).`;
  return undefined;
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
    ...(o.meta.approved_hash ? [`- Otisk výstupu (sha256): \`${o.meta.approved_hash.slice(0, 16)}\` — GO platí jen pro tento obsah.`] : []),
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
    "Rozhodnutí zadává vlastník v přehledu „TARS — Zakázky“: u této zakázky vyber v poli „Rozhodnutí vlastníka“ GO, GO A, GO B nebo REJECT. Orchestrátor hodnotu jen čte; GO dokončí až po kontrole, že stránka výstupu má stále schválený obsah.",
  ].join("\n");
}
