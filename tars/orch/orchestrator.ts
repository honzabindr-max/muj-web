// Deterministic driver. One tick = guard → lock → resume/advance one order step by step.
// "Kód hlídá, LLM rozhoduje": every gate, limit and record lives here, not in a prompt.
import fs from "node:fs";

import type { AdapterResult, TextAdapter } from "./adapters";
import { artifactHash, goBlocker } from "./approval";
import type { CardRegistry } from "./cards";
import {
  briefMarkdown,
  type DepartmentRunner,
  type DeptContext,
  type StepOutcome,
} from "./departments";
import {
  adapterPreflight,
  type LadderEnv,
  type PreflightResult,
} from "./ladder";
import type { GuardResult } from "./guard";
import type { NotionClient } from "./notion";
import { buildCardData, cardDataSection } from "./card-data";
import {
  EffectJournal,
  effectSurelyAbsent,
  effectTag,
  lookupNotionMarker,
  operationId,
  titleWithMarker,
  type EffectLookup,
} from "./effects";
import { isUncertainOutcome, NotionRestError, pageIdFromUrl } from "./notion";
import { waitingOwnerTransitions, type OwnerPing } from "./owner-ping";
import {
  panelRow,
  PanelRowDuplicate,
  PanelRowUnclear,
  supersededRow,
  type IndexSetResult,
  type PanelIndex,
  type PanelRow,
  type PanelSink,
} from "./panel";
import {
  missingSources,
  sourcesBlock,
  type LoadedSource,
  type SourceLoader,
} from "./sources";
import { scanSecrets } from "./secret-scan";
import {
  isActionable,
  isTerminal,
  ownerEventFor,
  reissueRound,
  transition,
  TransitionError,
  type OrderEvent,
} from "./state-machine";
import { PanelLockHoldError, type PanelLease, type Store } from "./store";
import {
  acceptableCheckNotes,
  BriefError,
  buildBriefCheckPrompt,
  buildSupervisorPrompt,
  HANDOFF_PAGE_ID,
  parseBrief,
  reservedDecisionHits,
  type DeptAvailability,
} from "./supervisor";
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
  /** How long a panel write, reissue or decision poll waits for the order's panel lock (default 30000 ms), then HOLD. */
  panelLockWaitMs?: number;
  /**
   * Opravný PR „panel“, nález 4: ochranná doba po vytvoření řádku s nejasným výsledkem (timeout, síťová chyba). Do jejího
   * uplynutí (od posledního záznamu operace v journalu) se pro stejnou operaci nepošle další POST, i když konzistentní
   * dohledání řádek ještě nevidí (server může POST pořád zpracovávat). Výchozí 10 minut.
   */
  panelCreateGuardMs?: number;
  /** Nález 2: s jakým odstupem `catchUpPanel` znovu dohledává řádek zakázky v HOLD (výchozí 10 minut). */
  panelHoldRetryMs?: number;
}

/** Výchozí ochranná doba po nejasném POST nového řádku (nález 4). */
export const PANEL_CREATE_GUARD_MS = 10 * 60_000;
/** Výchozí odstup dalšího dohledání řádku v HOLD (nález 2). */
export const PANEL_HOLD_RETRY_MS = 10 * 60_000;

export type TickResult =
  | { status: "guard_alarm"; summary: string }
  | { status: "no_supervisor_card"; problems: string[] }
  | { status: "locked" }
  | { status: "paused"; order: string; resume_after: string }
  | { status: "waiting_owner"; order: string }
  | { status: "waiting_review"; order: string; reason?: string }
  | { status: "advanced"; order: string; state: Order["state"] };

/** Etapa 3: outcome of one journaled external write (`runEffect`). */
type EffectRun =
  | { kind: "done"; url: string; content_hash?: string; recovered: boolean }
  | { kind: "hold"; op: string; reason: string }
  | { kind: "failed"; error: unknown }
  | { kind: "stale" };

/** A delivery that returned ok:false; carries the outcome for `bad()` and whether it certainly wrote nothing. */
class DeliverFailure extends Error {
  constructor(
    public readonly outcome: StepOutcome,
    public readonly effect_absent: boolean,
  ) {
    super(outcome.error ?? "deliver failed");
  }
}

/** Review kolo 1: the order's row may exist (create of unclear outcome) and cannot be looked up: no write at all. */
class PanelRowHold extends Error {}

/**
 * Nález 4: dřívější vytvoření řádku má nejasný výsledek a ochranná doba ještě neuplynula. Žádný POST, žádný HOLD:
 * značka dirty zůstane a další tick dohledá znovu.
 */
class PanelRowGuardWait extends Error {}

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
  async run(
    prompt: string,
    opts: Parameters<TextAdapter["run"]>[1],
  ): Promise<AdapterResult> {
    const r = await this.inner.run(prompt, opts);
    const s = scanSecrets(r.text);
    if (s.clean) return r;
    return {
      ...r,
      ok: false,
      text: "",
      error: `secret-scan: ${s.kinds.join(",")}`,
    };
  }
}

export function assertFamilies(
  depts: Partial<Record<string, DepartmentRunner>>,
): void {
  for (const [k, d] of Object.entries(depts)) {
    if (!d) continue;
    if (d.creatorFamily === d.checkerFamily) {
      throw new Error(
        `department ${k}: creator and checker are both ${d.creatorFamily} (tvůrce ≠ kontrolor)`,
      );
    }
  }
}

export class Orchestrator {
  private now: () => Date;
  private panelQueue: Promise<void> = Promise.resolve();
  /** Přechody, na které už v právě běžícím ticku odešel pokus o komentář (jen během ticku). */
  private tickPingKeys: Set<string> | undefined;
  private ctx: DeptContext;
  /** Etapa 3: durable PREPARED / receipt of every external write (runs/<id>/effects/). */
  private effects: EffectJournal;
  constructor(private d: OrchestratorDeps) {
    assertFamilies(d.departments);
    if (d.briefChecker.family === d.supervisor.family)
      throw new Error(
        "brief checker must be another model family than the supervisor",
      );
    this.now = d.now ?? (() => new Date());
    this.ctx = {
      store: d.store,
      notion: d.notion,
      draftParentId: d.draftParentId,
      repoRoot: d.repoRoot,
    };
    this.effects = new EffectJournal(d.store.runsDir, () => this.iso());
    // Merge PR #99 + etapa 3: index pod stejným (re-entrantním) stavovým zámkem jako fence zámku panelu.
    d.panel?.index.bindStore(d.store);
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

  private apply(
    order: Order,
    ev: OrderEvent,
    extra: Partial<LogEntry> = {},
  ): Order {
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
   *
   * PR #99, kolo oprav 5: runs under the order's panel lock (`Store.withPanelLock`), shared with `cli.ts panel-sync`,
   * reissue and the decision poll. Card round, row id and card link are read only under that lock, right before the
   * write; every write is fenced (`Store.assertPanelLease`), a write whose fence is no longer valid is not sent.
   * Merge s etapou 3: jeden mechanismus vytvoření řádku pro kolo 0 i pro každé kolo znovuvydané karty — journal efektů
   * (`<order>/panel-row/r<kolo karty>`, `resolvePanelRow`), index pod stavovým zámkem, dirty a sekvence zápisů.
   *
   * Review kolo 1:
   * - Creating the row is a journaled effect (`<order>/panel-row/r0`: PREPARED → create → receipt). A row without a known
   *   page id is ALWAYS looked up by „ID zakázky“ first (`resolvePanelRow`), so a crash between the create and
   *   `panel.index.set` never yields a second row. Without a lookup, an earlier create of unclear outcome is a HOLD.
   * - `fresh` (catch-up, panel-sync) writes the state current when the write starts, not the one seen when it was queued.
   *   After the write the version is compared again: if state.json moved on meanwhile (e.g. the owner's REJECT from the
   *   CLI), the row may hold an older state, so the dirty mark stays and the next tick rewrites the newer one.
   */
  private syncPanel(snapshot: Order, opts: { fresh?: boolean } = {}): void {
    const panel = this.d.panel;
    if (!panel) return;
    this.panelQueue = this.panelQueue.then(async () => {
      const t0 = Date.now();
      try {
        await this.panelLock(snapshot.id, (lease) =>
          this.writePanel(snapshot, opts, lease, t0),
        );
      } catch (e) {
        // Zámek panelu nezískán (HOLD) nebo chyba před zápisem: řádek je za state.json, dorovná ho další tick (etapa 3).
        try {
          panel.index.markDirty(snapshot.id);
        } catch {
          /* index nezapisovatelný: řádek dorovná další přechod */
        }
        this.log({
          order: snapshot.id,
          kind: "error",
          role: "transport",
          result: "panel sync failed",
          reason: (e as Error).message.slice(0, 300),
          duration_ms: Date.now() - t0,
        });
      }
    });
  }

  /**
   * Jeden zápis řádku pod zámkem panelu zakázky (`syncPanel`). Kolo 0 (zakázka nikdy znovuvydaná) i každé kolo karty
   * po znovuvydání (PR #99) jdou stejnou cestou etapy 3: row id z indexu (u znovuvydané jen řádek aktuálního kola,
   * `PanelIndex.current`), jinak `resolvePanelRow` (receipt z journalu, dohledání podle „ID zakázky“, HOLD), vytvoření
   * jako efekt `<id>/panel-row/r<kolo karty>` (PREPARED → POST → receipt), sekvence zápisu a dirty. Znovuvydaná
   * zakázka navíc: nový řádek vznikne až s novou kartou s otiskem (nebo v koncovém stavu), každý zápis se zaznamená
   * (`recordWrite`), vyřazené řádky se označí SUPERSEDED. „Rozhodnutí vlastníka“ se nikdy nezapisuje (P20).
   */
  private async writePanel(
    snapshot: Order,
    opts: { fresh?: boolean },
    lease: PanelLease,
    t0: number,
  ): Promise<void> {
    const panel = this.d.panel!;
    // Kolo karty až pod zámkem panelu, těsně před zápisem (ne snímek z doby, kdy byl zápis zařazen).
    const snap = this.fenced(lease, () => ({
      latest: this.tryLoad(snapshot.id),
      indexRound: panel.index.round(snapshot.id),
    }));
    const reissued =
      reissueRound(snap.latest ?? snapshot) > 0 || snap.indexRound > 0;
    // Znovuvydaná zakázka píše vždy aktuální stav; kolo 0 jako dřív (snímek přechodu, `fresh` = aktuální stav).
    const o = (reissued || opts.fresh) && snap.latest ? snap.latest : snapshot;
    const round = reissued ? reissueRound(o) : 0;
    const row = this.rowOf(o);
    const card =
      o.owner_card_url && o.meta.approved_hash ? o.owner_card_url : undefined;
    const op = operationId(o.id, "panel-row", round);
    let creating = false;
    try {
      let existing = reissued
        ? this.fenced(lease, () => panel.index.current(o.id, round))
        : panel.index.get(o.id);
      if (!existing && reissued && !card && !isTerminal(o.state)) {
        this.logOnce({
          order: o.id,
          kind: "info",
          role: "transport",
          result:
            "panel: nový řádek po znovuvydání vznikne až s novou kartou s otiskem",
        });
        panel.index.clearDirty(o.id);
        return;
      }
      // Opravný PR „panel“, nález 3: řádek z indexu se u znovuvydané zakázky ve WAITING_OWNER před PATCH přečte. Ukazuje-li
      // jinou kartu než aktuální (ruční nebo opožděný zápis), PATCH by odkaz opravil a ponechal rozhodnutí vybrané nad
      // starou kartou. Takový řádek je neplatný pro rozhodnutí: nové kolo řádku, starý SUPERSEDED (`invalidateRow`).
      if (
        existing &&
        reissued &&
        card &&
        o.state === "WAITING_OWNER" &&
        panel.sink.readOwnerRow
      ) {
        const seen = await panel.sink.readOwnerRow(existing);
        if (seen.readable === true && seen.card !== card) {
          const stale = existing;
          const moved = this.fenced(lease, () =>
            this.invalidateRow(
              o.id,
              round,
              stale,
              `před zápisem řádek ukazuje jinou kartu (${String(seen.card ?? "nic").slice(0, 80)})`,
            ),
          );
          if (moved)
            return await this.writePanel(
              this.d.store.load(o.id),
              { fresh: true },
              lease,
              t0,
            );
        }
      }
      if (!existing) {
        const found = await this.resolvePanelRow(
          o.id,
          op,
          lease,
          reissued ? { round, card } : { round: 0 },
        );
        existing = found?.id;
        // Oprava po review sloučení: dohledaný řádek nikdy nezapíše `lastWrite.card = null` před následným PATCH.
        // - Řádek dohledaný podle odkazu na aktuální kartu (čtením ověřeno, že ji nese): zápis se zaznamená rovnou
        //   s touto kartou, takže selhání následného PATCH (např. 409) na přijetí rozhodnutí nic nemění.
        // - Jinak (receipt z journalu, kolo 0): jen index, záznam zápisu až po úspěšném PATCH níže. Při chybě zůstane
        //   řádek dirty a poll čeká (netaintuje), další úspěšná synchronizace záznam doplní.
        if (
          found &&
          this.setIndex(lease, o.id, found.id, round, found.card) !== "ok"
        )
          return;
      }
      // Review kolo 2: send order of this write; a late answer of an older or concurrent write never clears dirty.
      let seq: number;
      let id: string;
      if (!existing) {
        // durable BEFORE the create: a crash after it is found by the lookup above.
        // Opravný PR „panel“, nález 1: sekvence zápisu, poslední kontrola fence a PREPARED v JEDNOM kroku pod
        // `.state.lock`, hned za ním POST bez dalšího zámku. Nezíská-li se zámek (timeout 5 s) nebo neplatí fence, PREPARED
        // nevznikne a `creating` zůstane false: prokazatelně nic neodešlo, další tick řádek normálně vytvoří (žádný HOLD).
        seq = this.fenced(lease, () => {
          const s = panel.index.beginWrite(o.id);
          this.effects.prepare(op);
          return s;
        });
        creating = true;
        id = await panel.sink.upsert(row);
      } else {
        seq = panel.index.beginWrite(o.id);
        id = await this.writeRow(lease, row, existing);
      }
      if (creating)
        this.fenced(lease, () =>
          this.effects.done(op, { url: `https://www.notion.so/${id}` }),
        );
      if (
        this.setIndex(lease, o.id, id, round, row["Karta rozhodnutí"]) !== "ok"
      )
        return;
      if (reissued) await this.markSupersededRows(o, id, lease);
      if (this.panelRowStale(o)) {
        panel.index.markDirty(o.id);
        this.log({
          order: o.id,
          kind: "info",
          role: "transport",
          result: `panel ${o.state} (stav se mezitím změnil, dorovnám v příštím ticku)`,
          duration_ms: Date.now() - t0,
        });
      } else if (!panel.index.clearDirty(o.id, seq)) {
        this.log({
          order: o.id,
          kind: "info",
          role: "transport",
          result: `panel ${o.state} (řádek byl označen k dorovnání až po odeslání tohoto zápisu, značka zůstává)`,
          duration_ms: Date.now() - t0,
        });
      } else {
        this.log({
          order: o.id,
          kind: "info",
          role: "transport",
          result: `panel ${o.state}${reissued && creating ? " (nový řádek po znovuvydání karty)" : ""}`,
          duration_ms: Date.now() - t0,
        });
      }
      await this.pingOwner(o, id);
    } catch (e) {
      if (e instanceof PanelRowGuardWait) {
        // Nález 4: ochranná doba po nejasném POST; žádný druhý POST, značka zůstává, další tick dohledá znovu.
        try {
          panel.index.markDirty(o.id);
        } catch {
          /* ignore */
        }
        this.logOnce({
          order: o.id,
          kind: "info",
          role: "transport",
          result: `panel: čekám na ochrannou dobu po nejasném vytvoření řádku, druhý POST se neposílá (${op})`,
          reason: e.message.slice(0, 300),
        });
        return;
      }
      if (e instanceof PanelRowHold) {
        // Opravný PR „panel“, nález 2: HOLD značku pro pozdější dorovnání nemaže. S dohledáním (REST/MCP) ji `catchUpPanel`
        // s odstupem zkusí znovu: jakmile index MCP řádek zpřístupní (nebo REST potvrdí neexistenci), řádek se dorovná.
        // Bez dohledání (sink bez findRowByOrderId) by žádné další kolo nic nevyřešilo: značka se smaže jako dřív.
        try {
          if (panel.sink.findRowByOrderId)
            panel.index.markHold(o.id, this.now().getTime());
          else panel.index.clearDirty(o.id);
        } catch {
          /* ignore */
        }
        this.logOnce({
          order: o.id,
          kind: "error",
          role: "transport",
          result: `EFFECT_UNKNOWN / HOLD: ${op}`,
          reason: e.message.slice(0, 300),
        });
        return;
      }
      try {
        // PR #99: journal a značky jen s platným fence (jinak je zapíše až platný držitel zámku panelu).
        this.fenced(lease, () => {
          if (creating) {
            // Clean refusal → certainly no row; anything else may have created one: stays PREPARED, looked up first next time.
            // A stale fence (PanelLockHoldError) sent nothing, but the record stays PREPARED: the next attempt looks up first.
            if (isUncertainOutcome(e) || e instanceof PanelLockHoldError)
              this.effects.note(op, (e as Error).message ?? String(e));
            else this.effects.absent(op, (e as Error).message ?? String(e));
          }
          // Only a sink that can look rows up may mark (otherwise the mark could never be resolved and would block the panel).
          if (creating && panel.sink.findRowByOrderId && isUncertainOutcome(e))
            panel.index.markUncertain(o.id);
        });
      } catch {
        /* fence neplatí nebo journal nezapisovatelný */
      }
      try {
        // Etapa 3: the row is behind state.json; the next tick rewrites it (`catchUpPanel`), not only the next transition.
        // Never after a create of unknown outcome that cannot be looked up (sink without findRowByOrderId): the row may
        // exist, so the operation stays PREPARED and every later sync of this order is a HOLD (`resolvePanelRow`).
        if (!creating || !isUncertainOutcome(e) || panel.sink.findRowByOrderId)
          panel.index.markDirty(o.id);
        else panel.index.clearDirty(o.id);
      } catch {
        /* the index or the journal is unwritable: the next transition still rewrites the row */
      }
      this.log({
        order: o.id,
        kind: "error",
        role: "transport",
        result: "panel sync failed",
        reason: (e as Error).message.slice(0, 300),
        duration_ms: Date.now() - t0,
      });
    }
  }

  private panelLock<T>(
    id: string,
    fn: (lease: PanelLease) => Promise<T>,
  ): Promise<T> {
    return this.d.store.withPanelLock(
      id,
      fn,
      this.d.panelLockWaitMs,
      this.d.stateLockWaitMs,
    );
  }

  /** Under `.state.lock`: fence check of our panel lease, then `fn` (index / journal read-modify-write). */
  private fenced<T>(lease: PanelLease, fn: () => T): T {
    return this.d.store.withStateLock(() => {
      this.d.store.assertPanelLease(lease);
      return fn();
    }, this.d.stateLockWaitMs);
  }

  /** Every row write: fence check right before the request leaves; a stale fence throws and nothing is sent. */
  private async writeRow(
    lease: PanelLease,
    row: PanelRow,
    page?: string,
  ): Promise<string> {
    this.fenced(lease, () => undefined);
    return this.d.panel!.sink.upsert(row, page);
  }

  /**
   * Index set + record of the write in one fenced step; anything but "ok" is logged (conflict = HOLD).
   * `card` undefined = index only, no record of a write (the row's card is not known yet, e.g. a row recovered from the
   * journal receipt before its PATCH): an older record is never replaced by a guess.
   */
  private setIndex(
    lease: PanelLease,
    id: string,
    pageId: string,
    round: number,
    card: string | null | undefined,
  ): IndexSetResult {
    const panel = this.d.panel!;
    const r = this.fenced(lease, () => {
      const res = panel.index.set(id, pageId, round);
      if (res === "ok" && card !== undefined)
        panel.index.recordWrite(id, {
          row: pageId,
          round,
          card,
          fence: lease.fence,
        });
      return res;
    });
    if (r === "conflict")
      this.log({
        order: id,
        kind: "error",
        role: "transport",
        result: `panel HOLD: index kola ${round} už drží jiný řádek, řádek ${pageId} ho nenahradí`,
        reason: `v indexu ${this.fenced(lease, () => panel.index.get(id)) ?? "?"}`,
      });
    else if (r === "stale")
      this.log({
        order: id,
        kind: "info",
        role: "transport",
        result:
          "panel: zápis doběhl do řádku vyřazeného znovuvydáním karty, index se nemění",
      });
    return r;
  }

  private rowOf(x: Order): PanelRow {
    const dept = x.brief ? this.d.departments[x.brief.department] : undefined;
    return panelRow(
      x,
      dept?.creatorModel() ?? "—",
      dept?.checkerModel() ?? "—",
    );
  }

  /** Vyřazené řádky označí SUPERSEDED s odkazem na nový řádek. Selhání se zaloguje a zkusí se při dalším zápisu. */
  private async markSupersededRows(
    o: Order,
    newRowId: string,
    lease: PanelLease,
  ): Promise<void> {
    const panel = this.d.panel!;
    const todo = this.fenced(lease, () => {
      const done = panel.index.supersededMarked(o.id);
      return panel.index.superseded(o.id).filter((x) => !done.includes(x));
    });
    for (const old of todo) {
      try {
        const dept = o.brief
          ? this.d.departments[o.brief.department]
          : undefined;
        await this.writeRow(
          lease,
          supersededRow(
            o,
            dept?.creatorModel() ?? "—",
            dept?.checkerModel() ?? "—",
            newRowId,
          ),
          old,
        );
        this.fenced(lease, () => panel.index.markSuperseded(o.id, old));
        this.log({
          order: o.id,
          kind: "info",
          role: "transport",
          result: `panel: starý řádek ${old} označen SUPERSEDED → nový řádek ${newRowId}`,
        });
      } catch (e) {
        this.log({
          order: o.id,
          kind: "error",
          role: "transport",
          result:
            "panel: označení starého řádku SUPERSEDED selhalo, zkusí se znovu",
          reason: (e as Error).message.slice(0, 300),
        });
      }
    }
  }

  /** True when state.json holds a newer version than the one the row was written from (or the order is gone: false). */
  private panelRowStale(written: Order): boolean {
    try {
      return (
        (this.d.store.load(written.id).version ?? 0) !== (written.version ?? 0)
      );
    } catch {
      return false;
    }
  }

  /**
   * Review kolo 1: the page id of an order's row when the index does not know it. Never answers „no row“ unless that is
   * certain: a receipt in the journal is reused; otherwise the row is looked up by „ID zakázky“ (the sink's chain, review kolo 2: REST query, then the MCP lookup when REST cannot answer; an error
   * throws, so nothing is created). Without a lookup, a create of unclear outcome (PREPARED / UNKNOWN in the journal, or
   * the old uncertain mark) throws `PanelRowHold`: never a second create without a lookup.
   *
   * Merge PR #99 + etapa 3: stejná cesta pro každé kolo karty (`sel.round`, operace `<id>/panel-row/r<kolo>`). U
   * znovuvydané zakázky dohledání vynechá řádky vyřazené znovuvydáním a (s kartou) vezme jen řádek s odkazem na aktuální
   * kartu; přes MCP to ověřit nejde, takže tam platí jen „nic dřív neodešlo“ (vytvořit) nebo HOLD. Zápis do indexu dělá
   * volající (`setIndex`, s kolem karty). Journal se mění jen s platným fence zámku panelu.
   */
  private async resolvePanelRow(
    orderId: string,
    op: string,
    lease: PanelLease,
    sel: { round: number; card?: string },
  ): Promise<{ id: string; card: string | undefined } | undefined> {
    const panel = this.d.panel!;
    const prev = this.effects.get(op);
    if (prev?.state === "EFFECT_DONE" && prev.receipt) {
      const id = pageIdFromUrl(prev.receipt.url);
      if (id) return { id, card: undefined }; // karta řádku nečtena
    }
    if (panel.sink.findRowByOrderId) {
      // Review kolo 3: nothing of unclear outcome was ever sent for this row (no PREPARED / UNKNOWN, no uncertain mark):
      // only the consistent query is asked; when it cannot answer, the row is created. Otherwise a lookup that cannot
      // prove absence (`PanelRowUnclear`: REST unavailable and the lagging MCP search found nothing) is a HOLD.
      const newRow =
        (!prev || prev.state === "EFFECT_ABSENT") &&
        !panel.index.isUncertain(orderId);
      const exclude =
        sel.round > 0
          ? this.fenced(lease, () => panel.index.superseded(orderId))
          : undefined;
      let found: string | undefined;
      try {
        found = await panel.sink.findRowByOrderId(orderId, {
          consistentOnly: newRow,
          // Nález 4: dva řádky stejné zakázky a kola = konflikt (HOLD), nikdy „vezmi první“.
          unique: true,
          ...(exclude ? { exclude } : {}),
          ...(sel.round > 0 && sel.card !== undefined
            ? { card: sel.card }
            : {}),
        });
      } catch (e) {
        if (e instanceof PanelRowDuplicate) {
          this.log({
            order: orderId,
            kind: "error",
            role: "transport",
            result: `panel HOLD: dva řádky stejného kola ${sel.round} (${e.rows.join(", ")}), žádný se nepoužije, konflikt řeší Fable (${op})`,
          });
          throw new PanelRowHold(
            `dva řádky stejného kola ${sel.round}: ${e.rows.join(", ")}, konflikt řeší Fable (${op})`,
          );
        }
        if (!(e instanceof PanelRowUnclear)) throw e;
        if (newRow) return undefined; // nothing sent before: create it
        if (prev?.state === "PREPARED")
          this.fenced(lease, () => this.effects.unknown(op, e.message));
        throw new PanelRowHold(
          `řádek panelu nejasný, ruční kontrola: ${e.message} (${op})`,
        );
      }
      if (found) {
        if (prev && prev.state !== "EFFECT_DONE")
          this.fenced(lease, () =>
            this.effects.done(
              op,
              { url: `https://www.notion.so/${found}` },
              { recovered: true },
            ),
          );
        if (prev)
          this.log({
            order: orderId,
            kind: "info",
            role: "transport",
            result: `panel: řádek nalezen podle ID zakázky, druhý se nevytváří (${op})`,
          });
        // Dohledání s `card` vrací jen řádek, jehož odkaz „Karta rozhodnutí“ je tato karta (REST čtení; přes MCP to
        // ověřit nejde a dohledání s `card` tam končí `PanelRowUnclear`): karta řádku je tím ověřená.
        return {
          id: found,
          card: sel.round > 0 && sel.card !== undefined ? sel.card : undefined,
        };
      }
      // Opravný PR „panel“, nález 4: konzistentní dotaz řádek nevidí, ale dřívější POST má nejasný výsledek (timeout,
      // síťová chyba) a server ho může pořád zpracovávat. Neexistence platí až po ochranné době od posledního záznamu
      // operace; do té doby žádný další POST (`PanelRowGuardWait`, značka dirty zůstává).
      if (!newRow) {
        const guardMs = this.d.panelCreateGuardMs ?? PANEL_CREATE_GUARD_MS;
        const since = prev ? Date.parse(prev.updated_at) : NaN;
        const left = Number.isFinite(since)
          ? since + guardMs - this.now().getTime()
          : 0;
        if (left > 0)
          throw new PanelRowGuardWait(
            `konzistentní dohledání řádek zatím nevidí, POST z ${prev!.updated_at} mohl ještě doběhnout; další pokus nejdřív za ${Math.ceil(left / 1000)} s (${op})`,
          );
      }
      this.fenced(lease, () => {
        if (prev && prev.state !== "EFFECT_ABSENT")
          this.effects.absent(
            op,
            "dohledání podle ID zakázky: řádek neexistuje",
          );
        if (panel.index.isUncertain(orderId))
          panel.index.clearUncertain(orderId);
      });
      return undefined;
    }
    if (
      prev?.state === "PREPARED" ||
      prev?.state === "EFFECT_UNKNOWN" ||
      panel.index.isUncertain(orderId)
    ) {
      if (prev?.state === "PREPARED")
        this.fenced(lease, () =>
          this.effects.unknown(
            op,
            "vytvoření řádku má nejasný výsledek a nejde dohledat (sink bez dohledání)",
          ),
        );
      throw new PanelRowHold(
        `dřívější vytvoření řádku má nejasný výsledek a nejde dohledat podle ID zakázky, nové vytvoření zakázáno (${op})`,
      );
    }
    return undefined;
  }

  /**
   * Etapa 3: rows whose last write failed („dirty“) are rewritten from the current state.json at the start of a tick.
   * Idempotent by order id: the row's page id comes from the index (or the lookup by „ID zakázky“ after an uncertain
   * create), so catching up never adds a second row. A failure leaves the mark for the next tick.
   */
  private catchUpPanel(): Promise<void> {
    const panel = this.d.panel;
    if (!panel) return Promise.resolve();
    let dirty: string[];
    try {
      dirty = panel.index.dirtyOrders();
    } catch (e) {
      this.log({
        order: "-",
        kind: "error",
        role: "transport",
        result: "panel: seznam nedorovnaných řádků nečitelný",
        reason: (e as Error).message.slice(0, 300),
      });
      return Promise.resolve();
    }
    const retryMs = this.d.panelHoldRetryMs ?? PANEL_HOLD_RETRY_MS;
    for (const id of dirty) {
      let o: Order;
      try {
        o = this.d.store.load(id);
      } catch {
        panel.index.clearDirty(id); // the order no longer exists locally: nothing to project
        continue;
      }
      // Opravný PR „panel“, nález 2: zakázka v HOLD panelu zůstává mezi dirty; dohledá se znovu až s odstupem.
      let heldAt: number | undefined;
      try {
        heldAt = panel.index.heldAt(id);
      } catch {
        heldAt = undefined;
      }
      if (heldAt !== undefined && this.now().getTime() - heldAt < retryMs)
        continue;
      this.log({
        order: id,
        kind: "info",
        role: "transport",
        result: "panel: dorovnávám řádek po chybě zápisu",
      });
      this.syncPanel(o, { fresh: true }); // review kolo 1: the state current at the write, re-checked after it
    }
    return this.flushPanel();
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
      if (
        current.state !== "WAITING_OWNER" ||
        waitingOwnerTransitions(current) !== n ||
        current.meta.owner_ping === String(n)
      )
        return;
      // V jednom ticku se na jeden přechod posílá nejvýš jednou (zápis řádku a opakování po selhání se nesčítají).
      const key = `${o.id}:${n}`;
      if (this.tickPingKeys?.has(key)) return;
      this.tickPingKeys?.add(key);
      const title = current.brief?.title ?? `Nová zakázka ${current.id}`;
      const markPinged = () =>
        this.d.store.withStateLock(() => {
          const fresh = this.d.store.load(o.id);
          if (
            fresh.state !== "WAITING_OWNER" ||
            waitingOwnerTransitions(fresh) !== n
          )
            return;
          this.d.store.save({
            ...fresh,
            meta: { ...fresh.meta, owner_ping: String(n) },
          });
        }, this.d.stateLockWaitMs);
      // Etapa 3: the comment is journaled like every external write. An attempt without a receipt (the process died
      // while sending) is never repeated: a comment cannot be looked up by marker, so its outcome stays unknown.
      const op = operationId(o.id, "owner-ping", n);
      const prev = this.effects.get(op);
      if (prev && prev.state !== "EFFECT_ABSENT") {
        if (prev.state === "PREPARED") {
          this.effects.unknown(
            op,
            "komentář odeslán bez potvrzení (pád během odesílání), neopakuje se",
          );
          this.log({
            order: o.id,
            kind: "error",
            role: "transport",
            result: `EFFECT_UNKNOWN: ${op}`,
            reason:
              "upozornění na iPhone: výsledek dřívějšího pokusu neznámý, neopakuje se",
          });
        }
        markPinged();
        return;
      }
      this.effects.prepare(op);
      const t0 = Date.now();
      const r = await ping.send(pageId, title);
      const base = {
        order: o.id,
        role: "transport" as const,
        duration_ms: Date.now() - t0,
      };
      // Review kolo 1: EFFECT_ABSENT (resent by a later tick) only for outcomes that certainly wrote nothing; any other
      // outcome — „uncertain“ or one this code does not know — is EFFECT_UNKNOWN and the comment is never sent again.
      const absent =
        r.outcome === "no_token" ||
        r.outcome === "no_permission" ||
        r.outcome === "secret" ||
        r.outcome === "failed";
      if (r.outcome === "sent")
        this.effects.done(op, { url: `https://www.notion.so/${pageId}` });
      else if (absent) this.effects.absent(op, r.detail ?? r.outcome);
      else this.effects.unknown(op, r.detail ?? "výsledek nejasný");
      if (!absent) markPinged();
      if (r.outcome === "sent")
        this.log({
          ...base,
          kind: "info",
          result: "upozornění na iPhone: komentář se zmínkou odeslán",
        });
      else if (!absent)
        this.log({
          ...base,
          kind: "error",
          result: `EFFECT_UNKNOWN: ${op}`,
          reason:
            r.detail ?? "upozornění na iPhone: výsledek nejasný, neopakuje se",
        });
      else if (r.outcome === "failed")
        this.logOnce({
          order: o.id,
          kind: "error",
          role: "transport",
          result: r.detail ?? "upozornění na iPhone selhalo",
        });
      // opakuje se každý tick, hláška se nezdvojuje
      else
        this.logOnce({
          order: o.id,
          kind: "info",
          role: "transport",
          result: r.detail ?? `upozornění na iPhone: ${r.outcome}`,
        });
    } catch (e) {
      this.log({
        order: o.id,
        kind: "error",
        role: "transport",
        result: "upozornění na iPhone selhalo",
        reason: (e as Error).message.slice(0, 300),
      });
    }
  }

  private tryLoad(id: string): Order | undefined {
    try {
      return this.d.store.load(id);
    } catch {
      return undefined;
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
        for (const w of this.d.store
          .listOrders()
          .filter((x) => x.state === "WAITING_OWNER")) {
          // Row id jen pod zámkem panelu zakázky (PR #99, kolo oprav 5): jen řádek aktuálního kola karty.
          await this.panelLock(w.id, async (lease) => {
            const pageId = this.fenced(lease, () =>
              panel.index.current(w.id, reissueRound(this.d.store.load(w.id))),
            );
            if (pageId) await this.pingOwner(w, pageId);
          });
        }
      } catch (e) {
        this.log({
          order: "-",
          kind: "error",
          role: "transport",
          result: "opakování upozornění na iPhone selhalo",
          reason: (e as Error).message.slice(0, 300),
        });
      }
    });
    return this.panelQueue;
  }

  private async loadSources(keys: string[]): Promise<LoadedSource[]> {
    if (this.d.sources) return this.d.sources.loadAll(keys);
    return keys.map((key) => ({
      key,
      title: key,
      ok: false,
      reason: "zavaděč zdrojů není nakonfigurován",
    }));
  }

  /** Writes the creator card's sources to runs/<id>/sources/ (+ status) for the departments. */
  private async stageSources(o: Order): Promise<void> {
    const keys =
      this.d.cards.creatorFor(o.brief!.department).card?.sources ?? [];
    const loaded = await this.loadSources(keys);
    for (const s of loaded)
      if (s.ok) this.d.store.writeFile(o.id, `sources/${s.key}.md`, s.text!);
    this.d.store.writeFile(
      o.id,
      "sources.json",
      JSON.stringify(
        loaded.map(({ key, title, ok, reason }) => ({
          key,
          title,
          ok,
          reason,
        })),
        null,
        2,
      ),
    );
  }

  /** Waits for pending panel writes (end of tick, tests). */
  /** Rewrites the panel row of one order from its state.json (idempotent, no transition). */
  resyncPanel(id: string): Promise<void> {
    this.syncPanel(this.d.store.load(id), { fresh: true });
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
    this.log({
      order: id,
      kind: "info",
      role: "orchestrator",
      result: "order created",
    });
    return order;
  }

  /**
   * §2a + §2b gate for a department: creator card valid, card matches the runner
   * (families, card role), checker of another family, adapter rules of the card's rung met.
   */
  preflight(
    dept: Department,
  ): PreflightResult & { maxFix?: number; cardRole?: string } {
    const runner = this.d.departments[dept];
    if (!runner)
      return {
        ok: false,
        reasons: [`oddělení ${dept} není v tomto běhu zapojeno`],
      };
    const c = this.d.cards.creatorFor(dept);
    if (!c.ok || !c.card) return { ok: false, reasons: c.problems };
    const reasons: string[] = [];
    if (c.card.role !== runner.cardRole)
      reasons.push(`karta ${c.card.role} ≠ runner ${runner.cardRole}`);
    if (c.card.family !== runner.creatorFamily)
      reasons.push(
        `karta říká tvůrce ${c.card.family}, runner ${runner.creatorFamily}`,
      );
    if (c.card.checker_family !== runner.checkerFamily)
      reasons.push(
        `karta říká kontrolor ${c.card.checker_family}, runner ${runner.checkerFamily}`,
      );
    if (runner.creatorFamily === runner.checkerFamily)
      reasons.push("tvůrce ≠ kontrolor porušeno");
    const ladder = adapterPreflight(c.card, this.d.ladder);
    reasons.push(...ladder.reasons);
    return {
      ok: reasons.length === 0,
      reasons,
      maxFix: c.card.max_fix_rounds,
      cardRole: c.card.role,
    };
  }

  availability(): DeptAvailability[] {
    return (["copy", "dev", "vizual"] as const).map((d) => {
      const p = this.preflight(d);
      return {
        department: d,
        card: p.cardRole ?? "—",
        available: p.ok,
        reasons: p.reasons,
      };
    });
  }

  async tick(): Promise<TickResult> {
    const sc = this.d.cards.check("supervizor");
    if (!sc.ok) return { status: "no_supervisor_card", problems: sc.problems };
    const g = this.d.guard();
    this.log({
      order: "-",
      kind: "guard",
      result: g.alarm ? "ALARM" : "OK",
      reason: g.summary,
    });
    if (g.alarm) return { status: "guard_alarm", summary: g.summary };
    if (!this.d.store.acquireLock()) return { status: "locked" };
    this.tickPingKeys = new Set();
    try {
      await this.catchUpPanel();
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
          return {
            status: "paused",
            order: order.id,
            resume_after: order.resume_after,
          };
        order = this.apply(order, { type: "resume" }, { role: "orchestrator" });
      }
      // P16 v2: a waiting review is retried at most once per tick, on exactly the artifact that waits.
      if (order.state === "WAITING_REVIEW") order = this.retryReview(order);
      const max = this.d.maxStepsPerTick ?? 20;
      for (
        let i = 0;
        i < max &&
        isActionable(order.state) &&
        order.state !== "PAUSED" &&
        order.state !== "WAITING_REVIEW";
        i++
      ) {
        // DR-039, etapa 2: the next step (model call, delivery) starts only while the tick lease is still ours.
        if (!this.d.store.holdsLease()) {
          this.log({
            order: order.id,
            kind: "error",
            role: "orchestrator",
            result: "tick lock už nedrží tento běh, krok nespuštěn",
          });
          return { status: "locked" };
        }
        // Re-check guard before anything leaves the machine.
        if (order.state === "DELIVERED" && this.d.guard().alarm)
          return { status: "guard_alarm", summary: "ALARM before delivery" };
        order = await this.step(order);
      }
      if (order.state === "PAUSED")
        return {
          status: "paused",
          order: order.id,
          resume_after: order.resume_after!,
        };
      if (order.state === "WAITING_OWNER")
        return { status: "waiting_owner", order: order.id };
      if (order.state === "WAITING_REVIEW")
        return {
          status: "waiting_review",
          order: order.id,
          reason: order.review_reason,
        };
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
    const waitingOrders = this.d.store
      .listOrders()
      .filter((x) => x.state === "WAITING_OWNER");
    if (!panel.sink.readOwnerDecision) {
      // Only the REST API may deliver the owner's decision; the claude -p fallback never does.
      for (const w of waitingOrders)
        this.logOnce({
          order: w.id,
          kind: "info",
          role: "transport",
          result: "rozhodnutí vlastníka z Notionu čeká na token (Notion REST)",
        });
      return;
    }
    for (const waiting of waitingOrders) {
      try {
        // Jen řádek aktuálního kola karty (po znovuvydání nový řádek; vyřazený řádek se nikdy nečte).
        const round = reissueRound(waiting);
        // Every earlier write of this row failed (or its outcome is unknown): sync it now, otherwise the tap could never be read.
        if (!panel.index.current(waiting.id, round))
          await this.resyncPanel(waiting.id);
        let resync = false;
        // Kolo oprav 5: row id, čtení řádku i přijetí rozhodnutí pod zámkem panelu zakázky (žádný souběžný zápis řádku).
        await this.panelLock(waiting.id, async (lease) => {
          const pageId = this.fenced(lease, () =>
            panel.index.current(waiting.id, round),
          );
          if (!pageId) return;
          if (round > 0) {
            resync = await this.readReissuedDecision(
              waiting,
              round,
              pageId,
              lease,
            );
            return;
          }
          const value = await panel.sink.readOwnerDecision!(pageId);
          const ev = ownerEventFor(value);
          if (!ev) return;
          // The read took a while and `cli owner` may have decided meanwhile: read-check-write the stored state under the state lock.
          this.fenced(lease, () => {
            const fresh = this.d.store.load(waiting.id);
            if (
              fresh.state !== "WAITING_OWNER" ||
              reissueRound(fresh) !== round ||
              panel.index.current(fresh.id, round) !== pageId
            )
              return;
            this.acceptOwner(fresh, ev, `Notion ${value}`);
          });
        });
        if (resync) await this.resyncPanel(waiting.id);
      } catch (e) {
        this.log({
          order: waiting.id,
          kind: "error",
          role: "transport",
          result: "owner decision read failed",
          reason: (e as Error).message.slice(0, 300),
        });
      }
    }
  }

  /**
   * Rozhodnutí z panelu u znovuvydané zakázky (PR #99, kola oprav 4–5). Běží pod zámkem panelu zakázky. Čte se jen
   * řádek kola karty `round`, který drží index (nový řádek vznikl s prázdným rozhodnutím a s novou kartou). Přijme se
   * jen, když:
   *  - zakázka je pořád ve WAITING_OWNER ve stejném kole a index pořád ukazuje na tento řádek (vyřazený řádek nikdy),
   *  - existuje nová karta s otiskem (`approved_hash`),
   *  - poslední zápis řádku pod zámkem panelu (`PanelIndex.lastWrite`) šel do tohoto řádku, v tomto kole, s aktuální kartou,
   *  - řádek je spolehlivě přečtený a jeho odkaz „Karta rozhodnutí“ je přesně aktuální karta.
   * Rozhodnutí na řádku, který ukazuje jinou kartu, než jakou do něj naposledy zapsal držitel zámku (zapsal ji tam
   * kdokoli jiný), se nepřijme ani později: řádek se znehodnotí (`PanelIndex.taint`, HOLD), přepíše se aktuální kartou
   * a rozhodnutí musí přijít jinou cestou (`cli.ts owner`). Vrátí true, když se má řádek přepsat (po uvolnění zámku).
   * Orchestrátor do pole „Rozhodnutí vlastníka“ nikdy nezapisuje (P20).
   */
  private async readReissuedDecision(
    waiting: Order,
    round: number,
    pageId: string,
    lease: PanelLease,
  ): Promise<boolean> {
    const panel = this.d.panel!;
    if (!panel.sink.readOwnerRow) {
      this.logOnce({
        order: waiting.id,
        kind: "info",
        role: "transport",
        result:
          "rozhodnutí po znovuvydání karty čeká na REST čtení řádku (readOwnerRow)",
      });
      return false;
    }
    const row = await panel.sink.readOwnerRow(pageId);
    let resync = false;
    this.fenced(lease, () => {
      const fresh = this.d.store.load(waiting.id);
      if (fresh.state !== "WAITING_OWNER" || reissueRound(fresh) !== round)
        return;
      if (panel.index.current(fresh.id, round) !== pageId) return; // řádek mezitím přestal být aktuální
      const card =
        fresh.owner_card_url && fresh.meta.approved_hash
          ? fresh.owner_card_url
          : undefined;
      const cardDiffers =
        row.readable === true && card !== undefined && row.card !== card;
      const value = row.decision ?? "";
      const ev = ownerEventFor(value || undefined);
      if (cardDiffers) {
        // Opravný PR „panel“, nález 3: řádek ukazuje jinou kartu. Pouhá oprava odkazu by zachovala rozhodnutí vybrané
        // nad starou kartou (teď, nebo v okně do opravy) a další poll by ho přijal. Proto i bez rozhodnutí: řádek je
        // neplatný pro rozhodnutí, zakázka dostane nové kolo řádku (nový řádek s prázdným rozhodnutím), starý SUPERSEDED.
        resync = true;
        this.invalidateRow(
          fresh.id,
          round,
          pageId,
          `odkaz „Karta rozhodnutí“ v řádku není aktuální karta s otiskem (v řádku ${String(row.card ?? "nic").slice(0, 80)}${ev ? `, Notion ${value}` : ""})`,
        );
        if (ev)
          this.logOnce({
            order: fresh.id,
            kind: "info",
            role: "orchestrator",
            result: `${ev.decision} nepřijato (Notion ${value}): čeká na rozhodnutí na nové kartě`,
            reason:
              "řádek panelu ukazoval jinou kartu; rozhodnout se musí na novém řádku aktuální karty",
          });
        return;
      }
      if (!ev) return;
      const wait = (reason: string) =>
        this.logOnce({
          order: fresh.id,
          kind: "info",
          role: "orchestrator",
          result: `${ev.decision} nepřijato (Notion ${value}): čeká na rozhodnutí na nové kartě`,
          reason,
        });
      if (!card) return wait("nová karta s otiskem ještě není vydaná");
      const norm = pageId.replace(/-/g, "");
      if (panel.index.tainted(fresh.id).includes(norm))
        return this.logOnce({
          order: fresh.id,
          kind: "error",
          role: "orchestrator",
          result: `${ev.decision} nepřijato (Notion ${value}): řádek panelu je znehodnocený (HOLD)`,
          reason:
            "do řádku po vydání karty zapsal jinou kartu někdo jiný; rozhodnutí z něj se nepřijme, vlastník rozhodne přes cli.ts owner",
        });
      if (row.readable !== true)
        return wait(
          "řádek panelu nejde spolehlivě přečíst (koš, chybějící sloupec)",
        );
      const last = panel.index.lastWrite(fresh.id);
      const lastOk =
        last !== undefined &&
        last.row === norm &&
        last.round === round &&
        last.card === card;
      // Oprava po review sloučení: `tainted` jen s důkazem, že řádek nesl JINOU kartu (čtení řádku, nebo záznam
      // posledního zápisu do tohoto řádku v tomto kole s jinou kartou). Chybějící záznam, záznam jiného řádku nebo bez
      // karty (dohledaný řádek, jehož PATCH selhal) důkaz není: nepřijmout, řádek dorovnat a po úspěšném zápisu přijmout.
      const otherCardWritten =
        last !== undefined &&
        last.row === norm &&
        last.round === round &&
        typeof last.card === "string" &&
        last.card !== card;
      if (!cardDiffers && !otherCardWritten && !lastOk) {
        resync = true;
        return wait(
          "záznam posledního zápisu řádku pod zámkem panelu nenese aktuální kartu; řádek se dorovná, rozhodnutí se přijme po úspěšném zápisu",
        );
      }
      if (!lastOk) {
        // Vlastník mohl rozhodovat nad jinou kartou, než jakou do řádku naposledy zapsal držitel zámku: nikdy nepřijmout.
        // Nález 3: stejně jako u jiné karty v řádku nové kolo řádku (nový řádek, starý SUPERSEDED).
        this.log({
          order: fresh.id,
          kind: "error",
          role: "orchestrator",
          result:
            "poslední zápis řádku pod zámkem panelu nenesl aktuální kartu; rozhodnutí z řádku se nepřijme (HOLD)",
          reason: `v řádku ${String(row.card ?? "nic").slice(0, 80)}; poslední zápis ${last ? `${last.row} kolo ${last.round} fence ${last.fence}` : "žádný"}`,
        });
        this.invalidateRow(
          fresh.id,
          round,
          pageId,
          "poslední zápis řádku pod zámkem panelu nenesl aktuální kartu",
        );
        resync = true;
        return wait(
          "řádek panelu ukazoval jinou kartu; rozhodnout se musí na aktuální kartě",
        );
      }
      this.acceptOwner(fresh, ev, `Notion ${value}`);
    });
    return resync;
  }

  /**
   * Opravný PR „panel“, nález 3 (volat pod `.state.lock` s platným fence zámku panelu). Řádek `pageId` je neplatný pro
   * rozhodnutí: znehodnotí se (`taint`, jeho rozhodnutí se nikdy nepřijme) a zakázka ve WAITING_OWNER dostane nové kolo
   * řádku stejným mechanismem jako znovuvydání karty: `meta.reissue_round` + 1 (karta s otiskem zůstává), index vyřadí
   * řádek (`retire`), další zápis vytvoří nový řádek s prázdným rozhodnutím a starý označí SUPERSEDED. „Rozhodnutí
   * vlastníka“ se nezapisuje (P20). Vrací true, když nové kolo vzniklo.
   */
  private invalidateRow(
    id: string,
    round: number,
    pageId: string,
    reason: string,
  ): boolean {
    const panel = this.d.panel!;
    panel.index.taint(id, pageId);
    const fresh = this.d.store.load(id);
    if (fresh.state !== "WAITING_OWNER" || reissueRound(fresh) !== round)
      return false;
    const cur = panel.index.current(id, round);
    if (!cur || cur.replace(/-/g, "") !== pageId.replace(/-/g, ""))
      return false;
    const at = this.iso();
    const next: Order = {
      ...fresh,
      updated_at: at,
      meta: {
        ...fresh.meta,
        reissue_round: String(round + 1),
        row_invalidated_at: at,
      },
    };
    if (!this.persist(next)) return false;
    panel.index.retire(id, round + 1);
    this.log({
      order: id,
      kind: "error",
      role: "orchestrator",
      result: `řádek panelu ${pageId} je neplatný pro rozhodnutí (HOLD); zakázka dostane nový řádek kola ${round + 1}, starý se označí SUPERSEDED`,
      reason: reason.slice(0, 300),
    });
    return true;
  }

  /**
   * DR-039, one entry point for every owner decision (Notion panel and `owner()`); call under the state lock.
   * REJECT → FAILED at once. GO is bound to the delivered artifact: it is accepted only when the card carries
   * `meta.approved_hash` and `meta.artifact_hash === meta.approved_hash`; then it is recorded in `meta.owner_go`
   * and the order STAYS in WAITING_OWNER until `verifyApprovals` reads the target back. A stale GO is logged, nothing else.
   */
  private acceptOwner(
    o: Order,
    ev: Extract<OrderEvent, { type: "owner" }>,
    source: string,
  ): Order {
    if (ev.decision === "REJECT")
      return this.apply(o, ev, {
        role: "orchestrator",
        result: `owner REJECT (${source})`,
      });
    if (o.meta.owner_go) return o; // already recorded, waits for the read-back
    const why = !o.meta.approved_hash
      ? "chybí approved_hash (karta bez otisku artefaktu)"
      : o.meta.artifact_hash !== o.meta.approved_hash
        ? "artifact_hash ≠ approved_hash (GO patří k jinému obsahu)"
        : undefined;
    if (why) {
      this.logOnce({
        order: o.id,
        kind: "info",
        role: "orchestrator",
        result: `GO nepřijato (${source}): ${why}`,
      });
      return o;
    }
    const at = this.iso();
    const next: Order = {
      ...o,
      updated_at: at,
      meta: {
        ...o.meta,
        owner_go: at,
        owner_go_source: source,
        ...(ev.option ? { owner_option: ev.option } : {}),
      },
    };
    if (!this.persist(next)) return this.current(o.id);
    this.syncPanel(next);
    this.log({
      order: o.id,
      kind: "info",
      role: "orchestrator",
      result: `owner GO (${source}) přijato, čeká na read-back`,
    });
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
    for (const w of this.d.store
      .listOrders()
      .filter((x) => x.state === "WAITING_OWNER" && x.meta.owner_go)) {
      try {
        if (!w.delivered_url) {
          this.logOnce({
            order: w.id,
            kind: "info",
            role: "orchestrator",
            result: "čeká na read-back",
            reason: "chybí delivered_url",
          });
          continue;
        }
        let hash: string;
        try {
          hash = artifactHash(await this.readArtifact(w));
        } catch (e) {
          this.logOnce({
            order: w.id,
            kind: "info",
            role: "transport",
            result: "čeká na read-back",
            reason: String((e as Error)?.message ?? e).slice(0, 200),
          });
          continue;
        }
        this.d.store.withStateLock(() => {
          const fresh = this.d.store.load(w.id);
          if (
            fresh.state !== "WAITING_OWNER" ||
            fresh.meta.owner_go !== w.meta.owner_go ||
            fresh.delivered_url !== w.delivered_url
          )
            return;
          const matched = hash === fresh.meta.approved_hash;
          const meta: Record<string, string> = {
            ...fresh.meta,
            readback: JSON.stringify({
              url: fresh.delivered_url,
              hash,
              verified_at: this.iso(),
            }),
            artifact_hash: matched ? fresh.meta.approved_hash! : hash,
          };
          if (!matched) {
            delete meta.owner_go;
            delete meta.owner_go_source;
            const held: Order = { ...fresh, updated_at: this.iso(), meta };
            if (!this.persist(held)) return;
            this.syncPanel(held);
            this.log({
              order: w.id,
              kind: "error",
              role: "orchestrator",
              result: "obsah se po vydání karty změnil, GO zrušeno",
              reason: `hash ${hash.slice(0, 12)} ≠ ${String(fresh.meta.approved_hash).slice(0, 12)}`,
            });
            return;
          }
          const verified: Order = { ...fresh, meta };
          const blocker = goBlocker(verified);
          if (blocker) {
            if (!this.persist(verified)) return;
            this.logOnce({
              order: w.id,
              kind: "info",
              role: "orchestrator",
              result: "čeká na read-back",
              reason: blocker,
            });
            return;
          }
          const option =
            fresh.meta.owner_option === "A" || fresh.meta.owner_option === "B"
              ? fresh.meta.owner_option
              : undefined;
          this.apply(
            verified,
            { type: "owner", decision: "GO", option },
            {
              role: "orchestrator",
              result: `owner GO (${fresh.meta.owner_go_source ?? "?"}) + read-back OK`,
            },
          );
        }, this.d.stateLockWaitMs);
      } catch (e) {
        this.log({
          order: w.id,
          kind: "error",
          role: "orchestrator",
          result: "read-back selhal",
          reason: (e as Error).message.slice(0, 300),
        });
      }
    }
  }

  /** Writes an info line unless the same one is already among the latest log entries (the log is read by the supervisor). */
  private logOnce(e: Omit<LogEntry, "ts">): void {
    if (
      this.d.store
        .readLog(40)
        .some((x) => x.order === e.order && x.result === e.result)
    )
      return;
    this.log(e);
  }

  /**
   * Etapa 3: one external write under the effect journal. Order of events: a receipt already in the journal is reused
   * (the crash hit after the write and its receipt, before state.json); PREPARED without a receipt → `lookup` by marker
   * first: found once → receipt recovered, certainly absent → a new attempt with the same operation_id, anything else →
   * EFFECT_UNKNOWN (hold, no write). Then durable PREPARED, the write (`call`), the receipt (EFFECT_DONE). A failed write
   * stays PREPARED (looked up before any retry) unless it certainly wrote nothing (EFFECT_ABSENT).
   */
  private async runEffect(
    o: Order,
    step: string,
    lookup: (op: string) => Promise<EffectLookup>,
    call: (op: string) => Promise<{ url: string; content_hash?: string }>,
    opts: { content_hash?: string } = {},
  ): Promise<EffectRun> {
    const op = operationId(o.id, step, o.fix_rounds);
    const prev = this.effects.get(op);
    if (prev?.state === "EFFECT_DONE" && prev.receipt) {
      this.log({
        order: o.id,
        kind: "info",
        role: "orchestrator",
        result: `obnova účinku ${op}: receipt z journalu, nový zápis se nespouští`,
        reason: prev.receipt.url,
      });
      return {
        kind: "done",
        url: prev.receipt.url,
        content_hash: prev.content_hash,
        recovered: true,
      };
    }
    if (prev?.state === "EFFECT_UNKNOWN" || prev?.state === "EFFECT_DONE")
      return {
        kind: "hold",
        op,
        reason: prev.reason ?? "výsledek dřívějšího zápisu je neznámý",
      };
    if (prev?.state === "PREPARED") {
      this.log({
        order: o.id,
        kind: "info",
        role: "orchestrator",
        result: `obnova účinku ${op}: PREPARED bez receiptu, dohledávám podle značky`,
      });
      let l: EffectLookup;
      try {
        l = await lookup(op);
      } catch (e) {
        l = {
          status: "uncertain",
          reason: `dohledání selhalo: ${String((e as Error)?.message ?? e).slice(0, 200)}`,
        };
      }
      if (l.status === "found") {
        this.effects.done(op, { url: l.url }, { recovered: true });
        this.log({
          order: o.id,
          kind: "info",
          role: "orchestrator",
          result: `obnova účinku ${op}: nalezen právě jednou, receipt doplněn`,
          reason: l.url,
        });
        return {
          kind: "done",
          url: l.url,
          content_hash: prev.content_hash,
          recovered: true,
        };
      }
      if (l.status === "uncertain") {
        this.effects.unknown(op, l.reason);
        return { kind: "hold", op, reason: l.reason };
      }
      this.log({
        order: o.id,
        kind: "info",
        role: "orchestrator",
        result: `obnova účinku ${op}: s jistotou neproběhl, nový pokus se stejným operation_id`,
      });
    }
    // Etapa 2: a tick that lost its lease starts no external write.
    if (this.d.store.fence !== undefined && !this.d.store.holdsLease()) {
      this.log({
        order: o.id,
        kind: "error",
        role: "orchestrator",
        result: `zápis ${op} nespuštěn: tick lock už nedrží tento běh`,
      });
      return { kind: "stale" };
    }
    this.effects.prepare(op, { content_hash: opts.content_hash });
    let res: { url: string; content_hash?: string };
    try {
      res = await call(op);
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (
        (e instanceof DeliverFailure && e.effect_absent) ||
        (!(e instanceof DeliverFailure) && effectSurelyAbsent(e))
      )
        this.effects.absent(op, msg);
      else this.effects.note(op, msg);
      return { kind: "failed", error: e };
    }
    const content_hash = res.content_hash ?? opts.content_hash;
    this.effects.done(op, { url: res.url }, { content_hash });
    return { kind: "done", url: res.url, content_hash, recovered: false };
  }

  /** Etapa 3: the outcome of an external write cannot be established → UNKNOWN with the reason (log + panel), no write. */
  private hold(o: Order, op: string, reason: string): Order {
    this.log({
      order: o.id,
      kind: "error",
      role: "orchestrator",
      result: `EFFECT_UNKNOWN / HOLD: ${op}`,
      reason,
    });
    return this.apply(
      o,
      { type: "unknown", reason: `EFFECT_UNKNOWN (${op}): ${reason}` },
      { role: "orchestrator", result: "EFFECT_UNKNOWN / HOLD" },
    );
  }

  /** §2b UNKNOWN card, best effort and journaled: written at most once per order and round, never retried. */
  private unknownCard(order: Order, error: string | undefined): void {
    const op = operationId(order.id, "unknown-card", order.fix_rounds);
    try {
      if (this.effects.get(op)) return;
      this.effects.prepare(op);
    } catch {
      return; // without a durable PREPARED there is no write
    }
    const title = titleWithMarker(
      `KARTA UNKNOWN — ${order.brief?.title ?? order.id} (${order.id})`,
      op,
    );
    void this.d.notion
      .createPage(
        this.d.draftParentId,
        title,
        `## Co\nAdaptér prohlížeče selhal po 2 pokusech.\n\n## Důkaz\n- ${error}\n- screenshoty: runs/${order.id}/shots-*\n\n## Rozhodnutí\nZkontroluj UI a zakázku zopakuj nebo zahoď.`,
      )
      .then(
        (p) => this.effects.done(op, { url: p.url }),
        (e) =>
          effectSurelyAbsent(e)
            ? this.effects.absent(op, String((e as Error)?.message ?? e))
            : this.effects.note(op, String((e as Error)?.message ?? e)),
      )
      .catch(() => undefined);
  }

  /**
   * P16 v2: the artifact a review is about. NEW = the brief waiting for its check (meta.pending_brief), CHECKING = the
   * current draft. Its sha256 is stored with WAITING_REVIEW and must be the same when the review is retried.
   */
  private reviewArtifact(o: Order, from: Order["state"]): string {
    if (from === "NEW") return o.meta.pending_brief ?? "";
    return o.draft_file ? this.d.store.readFile(o.id, o.draft_file) : "";
  }

  private waitForReview(
    order: Order,
    reason: string,
    role: LogEntry["role"],
    model?: string,
  ): Order {
    const hash = artifactHash(this.reviewArtifact(order, order.state));
    return this.apply(
      order,
      { type: "wait_review", reason, hash },
      { role, model, result: "čeká na kontrolu", reason },
    );
  }

  /** Back to the review step, unless the artifact changed while waiting (then UNKNOWN: GPT would check something else). */
  private retryReview(order: Order): Order {
    const from = order.review_from;
    if (!from)
      return this.apply(
        order,
        { type: "unknown", reason: "WAITING_REVIEW bez review_from" },
        { role: "orchestrator" },
      );
    let now: string;
    try {
      now = artifactHash(this.reviewArtifact(order, from));
    } catch (e) {
      return this.apply(
        order,
        {
          type: "unknown",
          reason: `artefakt čekající na kontrolu nejde přečíst: ${(e as Error).message}`,
        },
        { role: "orchestrator" },
      );
    }
    if (order.review_hash && now !== order.review_hash)
      return this.apply(
        order,
        {
          type: "unknown",
          reason:
            "artefakt se během čekání na kontrolu změnil (hash ≠ review_hash)",
        },
        { role: "orchestrator" },
      );
    return this.apply(
      order,
      { type: "retry_review" },
      { role: "orchestrator", result: "znovu kontrola GPT v prohlížeči" },
    );
  }

  /** Common handling of a model step outcome: review unavailable → WAITING_REVIEW, limit → PAUSED, error → FAILED. */
  private bad(
    order: Order,
    r: StepOutcome,
    role: LogEntry["role"],
  ): Order | undefined {
    if (r.ok) return undefined;
    if (r.waiting_review && role === "checker" && order.state === "CHECKING")
      return this.waitForReview(
        order,
        r.error ?? "kontrola neproběhla",
        role,
        r.model,
      );
    if (r.ui_unknown) {
      // §2b: UI failure after 2 attempts → UNKNOWN + owner card, never blind retry.
      this.unknownCard(order, r.error);
      return this.apply(
        order,
        { type: "unknown", reason: `${role}: ${r.error}` },
        { role, model: r.model },
      );
    }
    if (r.limit) {
      const resume = new Date(
        this.now().getTime() + (this.d.pauseMinutes ?? 60) * 60_000,
      ).toISOString();
      return this.apply(
        order,
        { type: "limit", resume_after: resume },
        { role, model: r.model, reason: r.error },
      );
    }
    this.log({
      order: order.id,
      kind: "error",
      role,
      model: r.model,
      reason: r.error,
      duration_ms: r.duration_ms,
    });
    return this.apply(
      order,
      { type: "fail", reason: `${role}: ${r.error ?? "unknown error"}` },
      { role, model: r.model },
    );
  }

  async step(order: Order): Promise<Order> {
    const dept = order.brief
      ? this.d.departments[order.brief.department]
      : undefined;
    switch (order.state) {
      case "NEW": {
        const capsule = fs.existsSync(this.d.capsulePath)
          ? fs.readFileSync(this.d.capsulePath, "utf8")
          : "(kufřík chybí)";
        const open = this.d.store
          .listOrders()
          .filter((o) => o.id !== order.id && o.brief)
          .map((o) => `${o.id} [${o.state}] ${o.brief!.title}`);
        const avail = this.availability();
        this.d.store.writeFile(
          order.id,
          "availability.json",
          JSON.stringify(avail, null, 2),
        );
        let handoff = "";
        if (this.d.notion.fetchPage) {
          try {
            handoff = await this.d.notion.fetchPage(HANDOFF_PAGE_ID);
            this.d.store.writeFile(order.id, "handoff-snapshot.md", handoff);
          } catch (e) {
            return this.bad(
              order,
              {
                ok: false,
                error: `HANDOFF fetch: ${(e as Error).message}`,
                limit: Boolean((e as { limit?: boolean }).limit),
              },
              "transport",
            )!;
          }
        }
        const card = this.d.cards.text("supervizor");
        // §2a bod 2: supervisor reads its own sources + required sources of every available department.
        const requiredByDept: Record<string, string[]> = {};
        for (const a of avail.filter((x) => x.available))
          requiredByDept[a.department] =
            this.d.cards.creatorFor(a.department as Department).card?.sources ??
            [];
        const supKeys = this.d.cards.check("supervizor").card?.sources ?? [];
        const allKeys = [
          ...new Set([...supKeys, ...Object.values(requiredByDept).flat()]),
        ].filter((k) => k !== "handoff" && k !== "capsule");
        const loaded: LoadedSource[] = await this.loadSources(allKeys);
        this.d.store.writeFile(
          order.id,
          "sources-status.json",
          JSON.stringify(
            loaded.map(({ key, ok, reason }) => ({ key, ok, reason })),
            null,
            2,
          ),
        );
        const supSources = sourcesBlock(loaded);
        let lastErr = "";
        let issues: string[] = [];
        // P16 v2: a brief that waited for its check (WAITING_REVIEW) is checked again as it was, not rewritten.
        const pending = order.meta.pending_brief;
        for (let attempt = 0; attempt < 2; attempt++) {
          let brief: ReturnType<typeof parseBrief> | undefined;
          let supMs: number | undefined;
          if (attempt === 0 && pending) {
            try {
              brief = parseBrief(pending);
            } catch {
              brief = undefined; // damaged pending brief: the supervisor writes a new one
            }
          }
          if (!brief) {
            const prompt = buildSupervisorPrompt(
              capsule,
              this.d.store.readLog(200),
              open,
              avail,
              card,
              handoff,
              issues,
              supSources,
              requiredByDept,
            );
            const r = await this.d.supervisor.run(prompt, {
              cwd: this.d.store.orderDir(order.id),
            });
            this.log({
              order: order.id,
              kind: "call",
              role: "supervisor",
              model: this.d.supervisor.model,
              family: this.d.supervisor.family,
              duration_ms: r.duration_ms,
              result: r.ok ? "ok" : "error",
              reason: r.error,
            });
            if (!r.ok)
              return this.bad(
                order,
                {
                  ok: false,
                  limit: r.limit,
                  error: r.error,
                  model: this.d.supervisor.model,
                },
                "supervisor",
              )!;
            supMs = r.duration_ms;
            try {
              brief = parseBrief(r.text);
            } catch (e) {
              if (!(e instanceof BriefError)) throw e;
              lastErr = e.message;
              continue;
            }
          }
          // Deterministic: every required source of the creator card must be referenced (else FIX).
          const required =
            requiredByDept[brief.department] ??
            this.d.cards.creatorFor(brief.department).card?.sources ??
            [];
          const missing = missingSources(required, brief.sources);
          if (missing.length) {
            issues = missing.map(
              (k) => `zadání neuvádí povinný zdroj karty: ${k}`,
            );
            lastErr = `brief check FIX (deterministic): ${issues.join("; ")}`;
            this.log({
              order: order.id,
              kind: "call",
              role: "checker",
              model: "deterministic",
              family: "none",
              result: "FIX",
              reason: issues.join(" | "),
            });
            continue;
          }
          const deptSources = sourcesBlock(
            loaded.filter((l) => required.includes(l.key)),
          );
          // Supervisor card, bod 6: the brief is checked by a model of the other family.
          const {
            r: c,
            v,
            findings: cFindings,
          } = await callChecker(
            this.d.briefChecker,
            buildBriefCheckPrompt(
              brief,
              handoff,
              card,
              capsule,
              required,
              deptSources,
              Boolean(this.d.briefChecker.supportsOutputSchema),
            ),
            this.d.store.orderDir(order.id),
          );
          this.log({
            order: order.id,
            kind: "call",
            role: "checker",
            model: this.d.briefChecker.model,
            family: this.d.briefChecker.family,
            duration_ms: c.duration_ms,
            result: v?.verdict ?? "error",
            reason: c.error ?? v?.issues.join(" | ").slice(0, 500),
          });
          if (!c.ok && c.waitReview) {
            // The brief is kept as it is (same hash); the next tick checks exactly this brief again.
            const held = {
              ...order,
              meta: { ...order.meta, pending_brief: JSON.stringify(brief) },
            };
            return this.waitForReview(
              held,
              c.error ?? "kontrola zadání neproběhla",
              "checker",
              this.d.briefChecker.model,
            );
          }
          if (!c.ok)
            return this.bad(
              order,
              {
                ok: false,
                limit: c.limit,
                error: c.error,
                model: this.d.briefChecker.model,
              },
              "checker",
            )!;
          this.d.store.writeFile(
            order.id,
            `brief-check-a${attempt}.md`,
            c.text,
          );
          const { pending_brief: _done, ...meta } = order.meta;
          void _done;
          if (v?.verdict === "PASS") {
            this.d.store.writeFile(order.id, "brief.md", briefMarkdown(brief));
            return this.apply(
              { ...order, meta, brief },
              { type: "planned" },
              {
                role: "supervisor",
                model: this.d.supervisor.model,
                duration_ms: supMs,
                result: `${brief.department}: ${brief.title}`,
              },
            );
          }
          // DR-031 b. 2: poslední pokus s FIX jen medium/low/info = známá rizika, zadání se přijme s výhradami.
          const notes =
            attempt === 1 && this.d.briefChecker.supportsOutputSchema
              ? acceptableCheckNotes(v?.verdict, cFindings)
              : undefined;
          if (notes) {
            const accepted = { ...brief, check_notes: notes };
            this.d.store.writeFile(
              order.id,
              "brief.md",
              briefMarkdown(accepted),
            );
            return this.apply(
              { ...order, meta, brief: accepted },
              { type: "planned" },
              {
                role: "supervisor",
                model: this.d.supervisor.model,
                duration_ms: supMs,
                result: `PASS s výhradami (DR-031): ${brief.department}: ${brief.title}`,
                reason: notes.join(" | ").slice(0, 500),
              },
            );
          }
          issues = v?.issues ?? ["verdikt kontrolora nečitelný"];
          lastErr = `brief check ${v?.verdict ?? "unparseable"}: ${issues.join("; ")}`;
          if (pending) order = { ...order, meta };
        }
        return this.apply(
          order,
          { type: "unknown", reason: `supervisor brief invalid: ${lastErr}` },
          { role: "supervisor" },
        );
      }
      case "PLANNED": {
        // Never start a specialist without a card or with unmet §2b adapter rules.
        const p = this.preflight(order.brief!.department);
        const o = { ...order, max_fix_rounds: p.maxFix, card_role: p.cardRole };
        if (p.ok) await this.stageSources(o);
        return this.apply(
          o,
          { type: "start", preflight: { ok: p.ok, reasons: p.reasons } },
          {
            role: "orchestrator",
            result: p.ok ? dept?.name : "preflight FAIL",
            reason: p.reasons.join("; ") || undefined,
          },
        );
      }
      case "DOING": {
        const r = await dept!.create(order, this.ctx);
        this.log({
          order: order.id,
          kind: "call",
          role: "creator",
          model: r.model,
          family: dept!.creatorFamily,
          duration_ms: r.duration_ms,
          result: r.ok ? "ok" : "error",
          reason: r.error,
        });
        const b = this.bad(order, r, "creator");
        if (b) return b;
        return this.apply(
          {
            ...order,
            draft_file: r.draft_file,
            meta: { ...order.meta, ...(r.meta ?? {}) },
          },
          { type: "created" },
          {
            role: "creator",
            model: r.model,
            family: dept!.creatorFamily,
            duration_ms: r.duration_ms,
          },
        );
      }
      case "CHECKING": {
        const r = await dept!.check(order, this.ctx);
        this.log({
          order: order.id,
          kind: "call",
          role: "checker",
          model: r.model,
          family: r.deterministic ? "none" : dept!.checkerFamily,
          duration_ms: r.duration_ms,
          result: r.verdict ?? (r.ok ? "ok" : "error"),
          reason: r.error ?? r.issues?.join(" | ").slice(0, 500),
        });
        const b = this.bad(order, r, "checker");
        if (b) return b;
        return this.apply(
          order,
          { type: "verdict", verdict: r.verdict!, issues: r.issues },
          {
            role: "checker",
            model: r.model,
            family: r.deterministic ? "none" : dept!.checkerFamily,
            duration_ms: r.duration_ms,
            result: r.verdict,
          },
        );
      }
      case "FIXING": {
        const r = await dept!.revise(order, this.ctx);
        this.log({
          order: order.id,
          kind: "call",
          role: "creator",
          model: r.model,
          family: dept!.creatorFamily,
          duration_ms: r.duration_ms,
          result: r.ok ? "ok" : "error",
          reason: r.error,
        });
        const b = this.bad(order, r, "creator");
        if (b) return b;
        return this.apply(
          {
            ...order,
            draft_file: r.draft_file ?? order.draft_file,
            meta: {
              ...order.meta,
              ...((r as { meta?: Record<string, string> }).meta ?? {}),
            },
          },
          { type: "revised" },
          {
            role: "creator",
            model: r.model,
            family: dept!.creatorFamily,
            duration_ms: r.duration_ms,
          },
        );
      }
      case "DELIVERED": {
        let o = order;
        if (!o.delivered_url) {
          // Etapa 3: the delivery is journaled (PREPARED → write → receipt); after a crash it is looked up by its marker.
          const del = o;
          const run = await this.runEffect(
            del,
            "deliver",
            (op) =>
              dept!.findEffect
                ? dept!.findEffect(del, this.ctx, op)
                : Promise.resolve({
                    status: "uncertain" as const,
                    reason: `oddělení ${dept!.name} neumí dohledat doručení podle značky`,
                  }),
            async (op) => {
              let r: Awaited<ReturnType<DepartmentRunner["deliver"]>>;
              let absent = false;
              try {
                r = await dept!.deliver(del, this.ctx, effectTag(op));
              } catch (e) {
                absent = effectSurelyAbsent(e);
                r = {
                  ok: false,
                  error: (e as Error).message,
                  limit: Boolean((e as { limit?: boolean }).limit),
                  model: "deliver",
                };
              }
              this.log({
                order: del.id,
                kind: "call",
                role: "transport",
                model: r.model,
                duration_ms: r.duration_ms,
                result: r.ok ? r.url : "error",
                reason: r.error,
              });
              if (r.ok && !r.url)
                r = { ...r, ok: false, error: "doručení bez URL" };
              if (!r.ok)
                throw new DeliverFailure(r, absent || Boolean(r.effect_absent));
              // DR-039: the hash of the artifact exactly as sent is stored in the same write as its URL.
              return {
                url: r.url!,
                content_hash:
                  r.content !== undefined ? artifactHash(r.content) : undefined,
              };
            },
          );
          if (run.kind === "stale") return this.current(o.id);
          if (run.kind === "hold") return this.hold(o, run.op, run.reason);
          if (run.kind === "failed") {
            const e = run.error;
            const r: StepOutcome =
              e instanceof DeliverFailure
                ? e.outcome
                : {
                    ok: false,
                    error: String((e as Error)?.message ?? e),
                    limit: Boolean((e as { limit?: boolean }).limit),
                    model: "deliver",
                  };
            return this.bad(o, r, "transport")!;
          }
          o = {
            ...o,
            delivered_url: run.url,
            meta: run.content_hash
              ? { ...o.meta, delivered_hash: run.content_hash }
              : o.meta,
          };
          if (!this.persist(o)) return this.current(o.id);
        }
        const reasons = [
          ...(dept!.alwaysOwner
            ? ["výstup je PR do main — merge dělá vlastník (DR-022)"]
            : []),
          ...o.brief!.owner_decisions,
          ...reservedDecisionHits(`${o.brief!.title}\n${o.brief!.goal}`).map(
            (k) => `zadání se dotýká: ${k}`,
          ),
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
            this.logOnce({
              order: o.id,
              kind: "info",
              role: "transport",
              result: "karta nevydána: read-back DRAFTu selhal",
              reason: String((e as Error)?.message ?? e).slice(0, 200),
            });
            return this.current(o.id); // etapa 2: the stored state (it may have moved on during the read)
          }
          o = {
            ...o,
            meta: { ...o.meta, approved_hash: seen, artifact_hash: seen },
          };
          const cardOrder = o;
          const cardTitle = `KARTA GO/REJECT — ${o.brief!.title} (${o.id})`;
          // Etapa 3: the card is journaled like the delivery; the marker sits in the page title (the body, which the
          // read-back hash covers, and the panel row stay unchanged). The PREPARED record keeps the hash the card shows.
          // Merge PR #99 + etapa 3: karta znovuvydaného kola je jiný efekt než karta kola 0 (`owner-card-k<kolo>`), takže
          // receipt staré karty z journalu se nikdy nepřevezme za novou kartu s otiskem.
          const cardRound = reissueRound(cardOrder);
          const run = await this.runEffect(
            cardOrder,
            cardRound > 0 ? `owner-card-k${cardRound}` : "owner-card",
            (op) => lookupNotionMarker(this.d.notion, this.d.draftParentId, op),
            async (op) => {
              const title = titleWithMarker(cardTitle, op);
              const text = ownerCard(cardOrder, reasons, dept!);
              const dataSection = await this.cardDataSection(cardOrder);
              let card;
              try {
                card = await this.d.notion.createPage(
                  this.d.draftParentId,
                  title,
                  text + dataSection,
                );
              } catch (e) {
                // Čisté odmítnutí (REST 4xx, nic se nezapsalo) kvůli sekci s daty karty: stránka vznikne bez ní.
                if (
                  !dataSection ||
                  !(e instanceof NotionRestError) ||
                  e.status < 400 ||
                  e.status >= 500 ||
                  e.status === 408 ||
                  e.status === 429
                )
                  throw e;
                this.safeLog({
                  order: cardOrder.id,
                  kind: "info",
                  role: "orchestrator",
                  result: "card-data: Notion zápis odmítnut, karta bez dat",
                  reason: `notion REST ${e.status} ${e.code}`,
                });
                card = await this.d.notion.createPage(
                  this.d.draftParentId,
                  title,
                  text,
                );
              }
              return { url: card.url };
            },
            { content_hash: seen },
          );
          if (run.kind === "stale") return this.current(o.id);
          if (run.kind === "hold") return this.hold(o, run.op, run.reason);
          if (run.kind === "failed") {
            const e = run.error;
            return this.bad(
              o,
              {
                ok: false,
                error: String((e as Error)?.message ?? e),
                limit: Boolean((e as { limit?: boolean }).limit),
              },
              "transport",
            )!;
          }
          // A recovered card shows the hash recorded when it was prepared; GO is bound to that one. If the DRAFT changed
          // since, artifact_hash ≠ approved_hash and the GO on that card is refused (acceptOwner), never silently accepted.
          const approved = run.recovered ? (run.content_hash ?? seen) : seen;
          if (approved !== seen)
            this.log({
              order: o.id,
              kind: "error",
              role: "orchestrator",
              result:
                "obnovená karta ukazuje jiný otisk než aktuální DRAFT, GO nebude přijato",
              reason: `${approved.slice(0, 12)} ≠ ${seen.slice(0, 12)}`,
            });
          // DR-039: approved_hash/artifact_hash from the read-back above are saved in the same write as the card URL.
          // Etapa 2: a refused save (newer state on disk) stops here, nothing follows from an outdated order.
          o = {
            ...o,
            owner_card_url: run.url,
            owner_reasons: reasons,
            meta: { ...o.meta, approved_hash: approved, artifact_hash: seen },
          };
          if (!this.persist(o)) return this.current(o.id);
        }
        return this.apply(
          o,
          { type: "delivered", owner_needed: ownerNeeded },
          { role: "orchestrator", result: o.delivered_url },
        );
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
        onFallback: (reason) =>
          this.safeLog({
            order: o.id,
            kind: "info",
            role: "orchestrator",
            result: "card-data: záložní objekt",
            reason,
          }),
      });
      return cardDataSection(data);
    } catch (e) {
      this.safeLog({
        order: o.id,
        kind: "error",
        role: "orchestrator",
        result: "card-data: sekce vynechána",
        reason: String((e as Error)?.message ?? e).slice(0, 200),
      });
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
      const counted = {
        ...o,
        manual_interventions: o.manual_interventions + 1,
      };
      return this.apply(
        counted,
        { type: "fail", reason: `manual abort: ${reason}` },
        { role: "orchestrator", result: "manual abort" },
      );
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
      if (o.state !== "WAITING_OWNER")
        throw new TransitionError(`illegal transition: ${o.state} --owner-->`);
      return this.acceptOwner(
        o,
        { type: "owner", decision, option },
        `owner ${decision}${option ? ` ${option}` : ""}`,
      );
    }, this.d.stateLockWaitMs);
  }

  /**
   * Znovuvydání karty (`cli.ts reissue`). Není to rozhodnutí vlastníka: jen zakázka ve WAITING_OWNER, jejíž karta nemá
   * `meta.approved_hash` (stará verze před DR-039), se pod stavovým zámkem a CAS vrátí do DELIVERED. Přechod smaže
   * starou kartu a owner-pole a zvýší `meta.reissue_round`. Ve stejném zámku index panelu vyřadí dosavadní řádek
   * (`PanelIndex.retire`): starý řádek se už nikdy nečte ani nepřepisuje daty nové karty. Další tick vydá standardní
   * cestou (read-back DRAFTu) novou kartu s otiskem a s ní nový řádek s prázdným rozhodnutím; starý řádek dostane
   * Stav SUPERSEDED. „Rozhodnutí vlastníka“ orchestrátor nikdy nezapisuje (P20).
   */
  async reissue(id: string): Promise<Order> {
    const refusal = (o: Order) =>
      o.state !== "WAITING_OWNER"
        ? `znovuvydání odmítnuto: zakázka ${id} je ve stavu ${o.state}, ne WAITING_OWNER`
        : o.meta.approved_hash
          ? `znovuvydání odmítnuto: karta zakázky ${id} už má otisk (approved_hash)`
          : undefined;
    // Kolo oprav 5: pod zámkem panelu zakázky, takže žádný zápis řádku nemůže běžet mezi kontrolou kola a zápisem.
    return this.panelLock(id, async (lease) =>
      this.fenced(lease, () => {
        const o = this.d.store.load(id);
        const why = refusal(o);
        if (why) throw new TransitionError(why);
        const next = this.apply(
          o,
          { type: "reissue" },
          { role: "orchestrator", result: "karta znovuvydána" },
        );
        if (next.state !== "DELIVERED")
          throw new TransitionError(
            `znovuvydání odmítnuto: stav zakázky ${id} se mezitím změnil`,
          );
        // Zápis řádku zařazený v `apply` poběží až po tomto zámku, tedy už s vyřazeným starým řádkem.
        this.d.panel?.index.retire(id, reissueRound(next));
        this.log({
          order: id,
          kind: "info",
          role: "orchestrator",
          result: "karta znovuvydána",
          reason:
            "stará karta bez otisku; nová karta s otiskem v příštím ticku, GO musí přijít znovu",
        });
        return next;
      }),
    );
  }
}

const KNOWN_DEPARTMENTS: readonly Department[] = ["copy", "dev", "vizual"];

/**
 * N3 (DR-039, etapa 2): `cli.ts tick` runs only with an explicit scope. Without TARS_DEPARTMENTS (or with an unknown
 * name) the tick is refused instead of silently wiring every department (dev opens PRs, vizual opens Chrome).
 * Returns the Czech reason to refuse, or undefined when the scope is valid.
 */
export function tickScopeError(raw: string | undefined): string | undefined {
  const list = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.length)
    return "tick odmítnut: chybí TARS_DEPARTMENTS. Rozsah běhu musí být výslovný, např. TARS_DEPARTMENTS=copy (launchd plist ho nastavuje); všechna oddělení = TARS_DEPARTMENTS=copy,dev,vizual.";
  const unknown = list.filter(
    (d) => !KNOWN_DEPARTMENTS.includes(d as Department),
  );
  if (unknown.length)
    return `tick odmítnut: neznámé oddělení v TARS_DEPARTMENTS: ${unknown.join(", ")} (povolené: ${KNOWN_DEPARTMENTS.join(", ")}).`;
  return undefined;
}

/** Keeps only the listed departments (empty list = all). Unwired ones show as unavailable to the supervisor. */
export function onlyEnabled<T>(
  enabled: string[],
  all: Partial<Record<Department, T>>,
): Partial<Record<Department, T>> {
  if (!enabled.length) return all;
  return Object.fromEntries(
    Object.entries(all).filter(([k]) => enabled.includes(k)),
  ) as Partial<Record<Department, T>>;
}

export function ownerCard(
  o: Order,
  reasons: string[],
  dept: DepartmentRunner,
): string {
  return [
    `## Co`,
    `${o.brief!.title} — milník ${o.brief!.milestone}, oddělení ${dept.name}.`,
    "",
    `## Důkaz`,
    `- Výstup (DRAFT): ${o.delivered_url}`,
    ...(o.meta.approved_hash
      ? [
          `- Otisk výstupu (sha256): \`${o.meta.approved_hash.slice(0, 16)}\` — GO platí jen pro tento obsah.`,
        ]
      : []),
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
