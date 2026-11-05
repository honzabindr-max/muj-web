// Deterministic driver. One tick = guard → lock → resume/advance one order step by step.
// "Kód hlídá, LLM rozhoduje": every gate, limit and record lives here, not in a prompt.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { AdapterResult, TextAdapter } from "./adapters";
import { parseReset } from "./reset";
import { artifactHash, goBlocker, readbackBlocker } from "./approval";
import { observeMode, readDispatch, type ModeObservation } from "./dispatch";
import { reconcileNextWake } from "./wake";
import {
  AttemptJournal,
  GroupNotEndedError,
  isTerminalAttempt,
  journalScope,
  LIMIT_WARNING_LOST,
  psProbe,
  reconcileAll,
  runInAttempt,
  sha256,
  type ProcessProbe,
} from "./attempts";
import type { CardRegistry } from "./cards";
import {
  briefMarkdown,
  finalBodyProblem,
  finalBodyRef,
  type DepartmentRunner,
  type DeptContext,
  type StepKind,
  type StepOutcome,
  warningsOf,
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
  type EffectRecord,
} from "./effects";
import { isUncertainOutcome, NotionRestError, pageIdFromUrl } from "./notion";
import { waitingOwnerTransitions, type OwnerPing } from "./owner-ping";
import {
  panelRow,
  PanelRowDuplicate,
  PanelRowUnclear,
  supersededRow,
  type IndexSetResult,
  type OwnerRow,
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
import { redactDeep, scanSecrets } from "./secret-scan";
import {
  isActionable,
  isTerminal,
  ownerEventFor,
  reissueRound,
  transition,
  TransitionError,
  type OrderEvent,
} from "./state-machine";
import {
  PanelLockHoldError,
  processStartTime,
  writeDurable,
  type PanelLease,
  type Store,
} from "./store";
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
import { GuardSession, LimitGuard, runWithLimitSink, setFallbackLimitSink, type LimitNote } from "./limit-guard";
import { gitHubRemoteProbe, type RemoteProbe } from "./remote-snapshot";
import type { Department, LogEntry, Order } from "./types";
import { DISPATCH_DEFAULTS, type DispatchRead } from "./dispatch";
import { reviewedGitOid } from "./departments";
import { leaseOfStore } from "./inbox/common";
import {
  decisionId,
  writeDecisionReceipt,
  type DecisionReceipt,
} from "./inbox/decision";
import type { InboxDispatcher } from "./inbox/dispatcher";
import {
  EffectGate,
  isTransient,
  type DraftTargetReader,
  type EffectCtx,
  type GateResult,
} from "./effect-gate";
import {
  EFFECT_PLAN,
  artifactKindOf,
  legacyStatus,
  orderClass,
} from "./inbox/policy";
import { OWNER_DECISION_PROPERTY, PANEL_DATA_SOURCE_ID } from "./panel";
import { ResourceLocks } from "./resource-lock";
import {
  OWNER_ORIGIN_UNVERIFIED,
  type OriginResult,
  type OwnerOrigin,
} from "./owner-origin";
import {
  heldResourceLocks,
  IdleRecorder,
  idleReasonOf,
  type IdleOverview,
  type PendingDecision,
} from "./idle";

/** Dodatek PR 5 (DR-033): „ID zakázky“ řádku orchestrátoru v panelu (není zakázka, `listOrders` ho nevidí). */
export const ORCHESTRATOR_ROW_ID = "tars-orchestrator";

/** Odkud zápis řádku zná jeho ID (opravný PR „panel“, kolo 2, bod 1). */
type RowSource = "index" | "receipt" | "lookup";

/** Výsledek kontroly řádku před zápisem (`Orchestrator.vetRow`). */
type RowVet =
  | {
      kind: "ok";
      /** řádek, jak byl přečten před zápisem */
      row: OwnerRow;
      /** odkaz karty řádku je prokazatelně aktuální: poslední zápis nesl aktuální kartu, nebo řádek je bez rozhodnutí */
      proven: boolean;
    }
  | { kind: "invalidated" }
  | { kind: "stop" };

/** Journal efektů: vyřazení řádku panelu a založení nového kola řádku (`<id>/row-invalidate/r<kolo>`). */
const ROW_INVALIDATE = "row-invalidate";

const normPage = (id: string) => id.replace(/-/g, "");

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
  /** Etapa 4 PR 1 (§10.3): IANA zóna pro čas resetu bez zóny v hlášce limitu (výchozí Europe/Prague). */
  resetTz?: string;
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
  /**
   * Etapa 4 PR 2 (§6.3, §14): cesta k `dispatch.json`. Tick ji pod lease přečte (fail-closed: chybí/nevalidní = hold)
   * a zaznamená pozorovaný režim (`runs/dispatch-mode.json`). Režim řídí jen novou práci dispatcheru inboxu (PR 3/5),
   * stávající zakázky supervizora ne. Bez cesty se nic nečte ani nezapisuje.
   */
  dispatchFile?: string;
  /** Etapa 4 PR 2 (§10.2 bod 3): `false` vypne životní cyklus `runs/next-wake` ve `finally` ticku (výchozí zapnuto). */
  nextWake?: boolean;
  /** Etapa 4 / PR 4a (§7): sonda procesů reconcileru (výchozí `ps`); testy ji podvrhnou. */
  processProbe?: ProcessProbe;
  /** Etapa 4 / PR 4a (§7): čekání po SIGTERM skupiny pokusu, než přijde SIGKILL (ExitTimeOut, výchozí 5 s). */
  attemptExitTimeoutMs?: number;
  /** Etapa 4 / PR 4b (§8.2): sonda snímků vzdálených zápisů (výchozí skutečný git/gh); testy ji podvrhnou. */
  remoteProbe?: RemoteProbe;
  /**
   * Etapa 4 PR 5 (§5, §7): dispatcher inboxu (obnova claimů, nový claim jen v režimu run, revalidace scope před každým
   * krokem). Bez něj se žádná zakázka `wo-r*` nespustí (HOLD): v tomto PR ho `cli.ts` nezapojuje.
   */
  inbox?: InboxDispatcher;
  /**
   * Etapa 4 PR 5 (§6.4 N14): REST čtení cílové stránky DRAFTu (`GET /v1/pages/{id}`, pole `public_url`) těsně před
   * POST. Bez něj každý notion-draft = HOLD `EFFECT_NOT_ALLOWED`.
   */
  draftTarget?: DraftTargetReader;
  /** Etapa 4 PR 5 (§6.1 `policy_revision`): git HEAD kódu tars/orch. */
  codeRevision?: string;
  /**
   * Dodatek PR 5 (P20): ověření původu rozhodnutí z panelu (`last_edited_by.id` řádku = ověřený vlastník). Bez něj se
   * žádné GO/REJECT z panelu nepřijme (HOLD `OWNER_ORIGIN_UNVERIFIED`).
   */
  ownerOrigin?: OwnerOrigin;
  /**
   * Dodatek PR 5 (DR-033): `true` = důvod nečinnosti se při změně zapíše i do řádku orchestrátoru v panelu (pole
   * „Poslední krok“). Bez toho jen `runs/idle/`.
   */
  orchestratorPanelRow?: boolean;
}

/** Etapa 4 / PR 4a: výsledek kroku modelu spuštěného jako pokus (§7, §8). */
type AttemptRun<T> =
  | { kind: "run"; r: T; resumed: boolean }
  | { kind: "hold"; reason: string }
  | { kind: "wait"; reason: string };

/** Uložený výstup pokusu: výsledek kroku + sha256 souboru draftu, který krok vytvořil (RESUME ho ověří). */
interface AttemptOutput<T> {
  outcome: T;
  draft_sha256?: string;
}

/** Q4-A (§10.2): rezerva po doloženém resetu limitu. */
export const RESET_MARGIN_MS = 60_000;
/** Q4-B: trvalý záznam doložených varování CLI o blížícím se limitu, po zdrojích (runs/, FIX1 nález 6). */
export const LIMIT_WARNING_FILE = "limit-warning.json";
/** FIX4: důvod HOLD pokusu, jehož doložené varování CLI o limitu nešlo trvale uložit (definice v attempts.ts). */
export { LIMIT_WARNING_LOST };

/** Blokace Q4-B jednoho zdroje (účet CLI) v runs/limit-warning.json; `until` = ISO konec blokace. */
type WarningRecord = { until: string } & Record<string, unknown>;

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
  /** Etapa 4 PR 1, Q4-B: doložené varování CLI o blížícím se limitu; nová zakázka nezačne do `until`. */
  | { status: "limit_warning"; until: string }
  /**
   * Etapa 4 PR 4b, bod 1: varování limitu neuloženo nebo neověřeno (nevyřešený sentinel runs/limit-guard/*.pending.json
   * nebo blokace v paměti). Globální HOLD bez vypršení: žádný krok modelu, žádné opakování, žádná nová zakázka do
   * ručního ověření vlastníkem (`cli.ts owner limit-hold OVERENO`).
   */
  | { status: "limit_hold"; reason: string }
  | { status: "waiting_review"; order: string; reason?: string }
  /** PR 5 FIX1 (5-K1-6): rozpracovaná zakázka wo-r* stojí, protože dispatch.json není v režimu run. */
  | { status: "dispatch_hold"; order: string }
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

/** PR 5 FIX1 (5-K1-4): revalidace brány uvnitř efektu neprošla; nic se nezapsalo (EFFECT_ABSENT), zakázka HOLD. */
class GateHoldError extends Error {
  constructor(public readonly res: Extract<GateResult, { ok: false }>) {
    super(`${res.code}: ${res.detail}`);
  }
}

/**
 * Nález 4: dřívější vytvoření řádku má nejasný výsledek a ochranná doba ještě neuplynula. Žádný POST, žádný HOLD:
 * značka dirty zůstane a další tick dohledá znovu.
 */
class PanelRowGuardWait extends Error {}

/**
 * Kolo 3, bod 2: REST vytvoření řádku čistě odmítl a záznam transportu MCP do journalu se nepodařil (zámek `.state.lock`
 * nezískán, fence neplatí). MCP se proto vůbec nezavolá: žádné vytvoření neproběhlo, výsledek je prokazatelně bez efektu.
 */
class McpCreateNotSent extends Error {}

/** Kolo 3, bod 1: meta pole s rozhodnutím vlastníka; po vyřazení řádku se do nového kola nepřenášejí. */
const OWNER_DECISION_META = ["owner_go", "owner_go_source", "owner_option"];

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
  /** Dodatek PR 5 (DR-033): rozhodnutí vyplněná v panelu, která tento tick nepřevzal. */
  private pendingDecisions: PendingDecision[] = [];
  /** Dodatek PR 5 (DR-033): přehled ze začátku ticku. */
  private tickOverview: IdleOverview | undefined;
  private readonly idle: IdleRecorder;
  private ctx: DeptContext;
  /** Etapa 3: durable PREPARED / receipt of every external write (runs/<id>/effects/). */
  private effects: EffectJournal;
  /**
   * Etapa 4 PR 2: režim dispatcheru pozorovaný posledním tickem pod lease. `may_start_new` smí použít jen dispatcher
   * inboxu (PR 3/5); první tick po přechodu hold → run nezačne nic nového, jen pokračuje v rozpracovaném.
   */
  lastDispatch: ModeObservation | undefined;
  /** Etapa 4 / PR 4a (§7): pokusy o krok (runs/<id>/attempts/). */
  private attempts: AttemptJournal;
  private probe: ProcessProbe;
  /** Pokus kroku ještě běží na pozadí (reconciler: waiting_background): tick nespouští další krok. */
  private attemptWaiting = false;
  /** PR 4b, bod 1: sentinely a malé create-only záznamy varování (runs/limit-guard/). */
  private limitGuard: LimitGuard;
  /** PR 4b, bod 1: varování neuloženo v tomto běhu (blokace v paměti, bez vypršení; na disku drží sentinel). */
  private limitHoldMem?: string;
  /** PR 4b, bod 1: blokace v paměti bez sentinelu na disku (zápis selhal): zkusí se zapsat při nejbližší možnosti. */
  private limitHoldMarkerPending = false;
  /** Varování uložená v runs/limit-guard v tomto běhu (source|text): selhání velkého limit-warning.json je pak jen log. */
  private guardSaved = new Set<string>();
  /** Etapa 4 PR 5 (§6.1, §6.4): brána každého vratného efektu a přechodu do DONE. */
  private gate: EffectGate;
  /** Etapa 4 PR 5 (§9): zámky konfliktních zdrojů (runs/resources/). */
  private locks: ResourceLocks;
  /** Etapa 4 PR 5: brána nebo zdroj v tomto ticku nečitelné/obsazené: žádný další krok (další tick znovu). */
  private gateWaiting = false;
  constructor(private d: OrchestratorDeps) {
    assertFamilies(d.departments);
    if (d.briefChecker.family === d.supervisor.family)
      throw new Error(
        "brief checker must be another model family than the supervisor",
      );
    this.now = d.now ?? (() => new Date());
    this.attempts = new AttemptJournal(d.store.runsDir, () => this.iso());
    this.probe = d.processProbe ?? psProbe;
    this.limitGuard = new LimitGuard(d.store.runsDir, {
      now: () => this.now(),
      untilOf: (n, received) => {
        const p = parseReset(n.text, received, this.d.resetTz ?? "Europe/Prague");
        return p.ok
          ? { until: new Date(Date.parse(p.at_utc) + RESET_MARGIN_MS).toISOString(), reset_source: p.source }
          : {
              until: new Date(Date.parse(received) + (this.d.pauseMinutes ?? 60) * 60_000).toISOString(),
              reset_source: "nedoloženo",
            };
      },
    });
    // FIX1 (PR 4b) nález 6: varování z volání mimo hlídaný úsek se uloží; nejde-li to, blokace (nic se nezahodí).
    setFallbackLimitSink((n) => {
      try {
        this.limitGuard.record(`mimo-usek/${this.iso()}/${process.pid}`, n);
        this.guardSaved.add(`${n.source}|${n.text}`);
      } catch (e) {
        this.raiseLimitHold(`varování mimo hlídaný úsek (${n.source}): ${String((e as Error)?.message ?? e).slice(0, 200)}`, false);
      }
    });
    this.ctx = {
      store: d.store,
      notion: d.notion,
      draftParentId: d.draftParentId,
      repoRoot: d.repoRoot,
      attempts: this.attempts,
      remoteProbe: d.remoteProbe ?? gitHubRemoteProbe,
    };
    this.effects = new EffectJournal(d.store.runsDir, () => this.iso());
    // Merge PR #99 + etapa 3: index pod stejným (re-entrantním) stavovým zámkem jako fence zámku panelu.
    d.panel?.index.bindStore(d.store);
    this.locks = new ResourceLocks(d.store.runsDir);
    this.idle = new IdleRecorder(d.store.runsDir);
    this.gate = new EffectGate({
      runsDir: d.store.runsDir,
      lease: () => (d.store.holdsLease() ? leaseOfStore(d.store) : undefined),
      dispatch: () => this.readDispatchNow(),
      codeRevision: d.codeRevision ?? "unknown",
      inbox: d.inbox,
      readResultRow: (pageId) => this.readDecisionRow(pageId),
      rowFlags: (orderId, pageId) => {
        const idx = this.d.panel?.index;
        const n = normPage(pageId);
        return {
          tainted: Boolean(idx?.tainted(orderId).includes(n)),
          superseded: Boolean(idx?.superseded(orderId).includes(n)),
        };
      },
      draftTarget: d.draftTarget,
      now: () => this.iso(),
    });
  }

  /** Etapa 4 PR 5: aktuální `dispatch.json` (fail-closed: bez cesty = výchozí hold a prázdné allowlisty). */
  private readDispatchNow(): DispatchRead {
    if (!this.d.dispatchFile)
      return {
        config: { ...DISPATCH_DEFAULTS },
        hold_file: false,
        invalid: "dispatch.json není nastaven",
      };
    return readDispatch(this.d.dispatchFile, this.d.store.runsDir);
  }

  /** Etapa 4 PR 5 (§3.3): REST čtení řádku panelu s rozhodnutím pro revalidaci result receiptu. */
  private async readDecisionRow(
    pageId: string,
  ): Promise<{ readable: boolean; value?: string }> {
    const sink = this.d.panel?.sink;
    if (sink?.readOwnerRow) {
      const row = await sink.readOwnerRow(pageId);
      return { readable: row.readable !== false, value: row.decision };
    }
    if (sink?.readOwnerDecision)
      return { readable: true, value: await sink.readOwnerDecision(pageId) };
    throw new Error("REST čtení řádku panelu není k dispozici");
  }

  /** Dnešní `owner_needed` (orchestrator.ts DELIVERED): alwaysOwner, owner_decisions, reservedDecisionHits. */
  private ownerNeededOf(o: Order, dept: DepartmentRunner): boolean {
    return (
      dept.alwaysOwner ||
      (o.brief?.owner_decisions.length ?? 0) > 0 ||
      reservedDecisionHits(`${o.brief?.title ?? ""}\n${o.brief?.goal ?? ""}`)
        .length > 0
    );
  }

  /**
   * Oddělení podle toho, CO runner skutečně dělá (§6.4 plán efektů): runner s bránou push (PR 4b) dělá gh-push a
   * gh-draft-pr, ať je v briefu zapsán pod jakýmkoli klíčem. Jinak oddělení z briefu.
   */
  private effectDept(o: Order, dept?: DepartmentRunner): Department {
    const r = dept ?? (o.brief ? this.d.departments[o.brief.department] : undefined);
    return r?.effectGate ? "dev" : o.brief!.department;
  }

  /** Identita artefaktu podle druhu (§6.1): content = otisk finálního těla, git = zkontrolovaný OID. */
  private artifactOf(o: Order, dept?: DepartmentRunner): EffectCtx["artifact"] {
    return artifactKindOf(this.effectDept(o, dept)) === "git"
      ? { kind: "git", oid: reviewedGitOid(o, this.ctx) }
      : { kind: "content", hash: finalBodyRef(o)?.sha256 };
  }

  private gateCtx(
    o: Order,
    dept: DepartmentRunner,
    effects: EffectCtx["effects"],
    ownerNeeded = this.ownerNeededOf(o, dept),
  ): Omit<EffectCtx, "step" | "draftParentId"> {
    return {
      effects,
      dept: this.effectDept(o, dept),
      creatorFamily: dept.creatorFamily,
      ownerNeeded,
      artifact: this.artifactOf(o, dept),
    };
  }

  /**
   * Etapa 4 PR 5: výsledek brány, který nepustil efekt ani přechod. Nečitelné rozhodnutí / ztráta lease = zakázka
   * zůstává, tick končí (další tick znovu, nikdy efekt). Ostatní = HOLD (UNKNOWN) s důvodem a migrační cestou.
   */
  private gateBlocked(o: Order, r: Extract<GateResult, { ok: false }>): Order {
    if (isTransient(r.code)) {
      this.gateWaiting = true;
      this.logOnce({
        order: o.id,
        kind: "info",
        role: "orchestrator",
        result: `brána: ${r.code}, další tick znovu`,
        reason: r.detail.slice(0, 300),
      });
      return this.current(o.id);
    }
    const reason = `${r.code}: ${r.detail}${r.path ? ` — cesta: ${r.path}` : ""}`;
    return this.attemptBlocked(o, { kind: "hold", reason });
  }

  /**
   * Etapa 4 PR 5 (§3.2 result): pozorované GO z řádku panelu → result receipt (jen z REST čtení, nikdy automaticky).
   * Vazba na `meta.approved_hash`, kartu a kolo karty. Vrací `decision_id`, nebo undefined (nejde zapsat = GO nepřijato).
   */
  private recordResultReceipt(o: Order, pageId: string): string | undefined {
    const dept = o.brief ? this.effectDept(o) : undefined;
    const approved = o.meta.approved_hash;
    const lease = leaseOfStore(this.d.store);
    if (!dept || !approved || !o.owner_card_url || !lease) return undefined;
    let round: number;
    try {
      round = reissueRound(o);
    } catch {
      return undefined;
    }
    const binding = {
      order_id: o.id,
      artifact_kind: artifactKindOf(dept),
      approved_hash: approved,
    };
    const id = decisionId("result", binding, o.owner_card_url, round, "GO");
    const r: DecisionReceipt = {
      v: 2,
      receipt_kind: "result",
      decision_id: id,
      binding,
      card_url: o.owner_card_url,
      card_round: round,
      value: "GO",
      source: {
        data_source_id: PANEL_DATA_SOURCE_ID,
        page_id: normPage(pageId),
        property: OWNER_DECISION_PROPERTY,
      },
      observed_at: this.iso(),
      observed_fence: lease.fence,
      provenance: "observed",
      provenance_note: "DR-039: autor selectu neprokázán",
    };
    try {
      writeDecisionReceipt(this.d.store.runsDir, r);
      return id;
    } catch (e) {
      // Stejné pozorování už zapsané dřív (jiný čas) = CONFLICT: platí původní receipt se stejným decision_id.
      if (/RECEIPT_CONFLICT/.test(String((e as Error)?.message))) return id;
      this.log({
        order: o.id,
        kind: "error",
        role: "orchestrator",
        result: "result receipt nejde zapsat, GO nepřijato",
        reason: String((e as Error)?.message ?? e).slice(0, 300),
      });
      return undefined;
    }
  }

  /**
   * Etapa 4 PR 5 (§5, §7, Q3-A): obnova claimů inboxu a nejvýš jeden nový claim (jen v režimu run). Bez dispatcheru
   * nic. Chyba nic nezastaví (HOLD v logu).
   */
  private async dispatchInbox(): Promise<void> {
    const inbox = this.d.inbox;
    const lease = leaseOfStore(this.d.store);
    if (!inbox || !lease) return;
    const r = this.readDispatchNow();
    try {
      const res = await inbox.tick({
        lease,
        mode: this.lastDispatch?.mode ?? "hold",
        may_start_new: this.lastDispatch?.may_start_new ?? false,
        dispatchSha256: r.invalid ? undefined : r.sha256,
        allowedTypes: r.config.inbox_types,
      });
      for (const x of [...res.recovered, ...(res.claimed ? [res.claimed] : [])])
        if (x.outcome.kind === "hold" || x.outcome.kind === "claimed")
          this.logOnce({
            order: "-",
            kind: x.outcome.kind === "hold" ? "error" : "info",
            role: "orchestrator",
            result: `inbox claim ${x.event_id.slice(0, 8)}: ${x.outcome.kind === "hold" ? `HOLD ${x.outcome.code}` : `CLAIMED ${x.outcome.wo_id}`}`,
            reason:
              x.outcome.kind === "hold"
                ? x.outcome.detail.slice(0, 300)
                : undefined,
          });
      for (const id of res.orphans)
        this.logOnce({
          order: id,
          kind: "error",
          role: "orchestrator",
          result: "HOLD UNKNOWN: wo-r bez claim.prepare, nikdy dispatch",
        });
    } catch (e) {
      this.log({
        order: "-",
        kind: "error",
        role: "orchestrator",
        result: "inbox dispatch selhal (HOLD)",
        reason: String((e as Error)?.message ?? e).slice(0, 300),
      });
    }
  }

  /** PR 5 FIX1 (5-K1-6): rozpracovaná inbox zakázka, která by jinak mohla běžet, ale dispatch.json není v režimu run. */
  private dispatchHeld(all: Order[]): Order | undefined {
    if (this.lastDispatch?.mode === "run" || !this.d.inbox) return undefined;
    const inbox = this.d.inbox;
    return all.find(
      (o) => isActionable(o.state) && orderClass(o) === "inbox" && inbox.runnable(o).ok,
    );
  }

  /**
   * Etapa 4 PR 5: smí tick zakázku posunout? Legacy ano. `wo-r` bez události = HOLD UNKNOWN. Inbox jen s commitem,
   * ACK CLAIMED, bez odvolání, a jen když žádná jiná zakázka nečeká na vlastníka ani neběží (Q3-A, WIP 1).
   */
  private mayAdvance(o: Order, all: Order[]): boolean {
    const cls = orderClass(o);
    if (cls === "legacy") return true;
    if (cls === "unknown" || !this.d.inbox) return false;
    if (!this.d.inbox.runnable(o).ok) return false;
    // PR 5 FIX1 (5-K1-6): `mode: "hold"` zastaví i rozpracovaný claim (s commitem a ACK) před dalším krokem a efektem.
    if (this.lastDispatch?.mode !== "run") return false;
    return !all.some(
      (x) =>
        x.id !== o.id &&
        (x.state === "WAITING_OWNER" ||
          (isActionable(x.state) && x.state !== "NEW")),
    );
  }

  /** Etapa 4 PR 5: rozpracované zakázky `wo-r`, které nesmí běžet natrvalo (bez události, odvolaný claim) → HOLD. */
  private holdForeignInbox(orders: Order[]): void {
    for (const o of orders) {
      if (!isActionable(o.state)) continue;
      const cls = orderClass(o);
      if (cls === "legacy") continue;
      if (cls === "unknown") {
        this.apply(
          o,
          {
            type: "unknown",
            reason:
              "HOLD UNKNOWN: zakázka wo-r bez platné meta.request_event_id",
          },
          { role: "orchestrator", result: "HOLD UNKNOWN (wo-r bez události)" },
        );
        continue;
      }
      if (!this.d.inbox) {
        this.logOnce({
          order: o.id,
          kind: "info",
          role: "orchestrator",
          result:
            "wo-r čeká: dispatcher inboxu není zapojený (HOLD, nic se nespustí)",
        });
        continue;
      }
      const r = this.d.inbox.runnable(o);
      if (!r.ok && /^claim (revoked|hold|aborted)|^UNKNOWN/.test(r.detail))
        this.apply(
          o,
          {
            type: "unknown",
            reason: `HOLD(REVOKED): ${r.detail}`.slice(0, 500),
          },
          { role: "orchestrator", result: "HOLD (claim)" },
        );
    }
  }

  /**
   * Etapa 4 PR 5 (§7 INTENT): před každým krokem zakázky `wo-r*` čerstvá revalidace scope receiptu. NEW → PLANNED
   * (událost „claimed“) jen s commitem claimu a OK revalidací. Vrací zakázku a zda pokračovat.
   */
  private async inboxBeforeStep(
    o: Order,
  ): Promise<{ go: boolean; order: Order }> {
    const lease = leaseOfStore(this.d.store);
    if (!this.d.inbox || !lease) return { go: false, order: o };
    const s = await this.d.inbox.checkScope(lease, o);
    if (!s.ok)
      return {
        go: false,
        order: this.gateBlocked(o, {
          ok: false,
          code: s.code as never,
          detail: s.detail,
        }),
      };
    if (o.state === "NEW") {
      const planned = this.apply(
        o,
        { type: "planned" },
        {
          role: "orchestrator",
          result: "claimed: commit claimu + scope GO revalidováno",
        },
      );
      return { go: planned.state === "PLANNED", order: planned };
    }
    return { go: true, order: o };
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
    const snap = this.fenced(lease, () => {
      // Kolo 2, bod 2: nedokončené vyřazení řádku (pád uprostřed) se dokončí dřív, než se řádek hledá nebo zapisuje.
      this.finishInvalidations(snapshot.id);
      return {
        latest: this.tryLoad(snapshot.id),
        indexRound: panel.index.round(snapshot.id),
      };
    });
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
      // Kolo 2, bod 1: odkud je ID řádku. Index, receipt z journalu i dohledání podle „ID zakázky“ pak projdou STEJNOU
      // kontrolou karty a rozhodnutí (`vetRow`); žádná cesta ji neobejde.
      let source: RowSource = "index";
      if (!existing) {
        const found = await this.resolvePanelRow(
          o.id,
          op,
          lease,
          reissued ? { round, card } : { round: 0 },
        );
        if (found) {
          existing = found.id;
          source = found.source;
        }
      }
      // Opravný PR „panel“, nález 3 + kolo 2, bod 1: řádek znovuvydané zakázky ve WAITING_OWNER s kartou se před PATCH
      // přečte. Jiná karta v řádku, znehodnocený řádek, nebo rozhodnutí v řádku, jehož odkaz karty nebyl od vydání
      // aktuální karty prokazatelně aktuální (receipt, dohledání, chybějící záznam zápisu) → řádek se vyřadí a zakázka
      // dostane nový řádek (`invalidateRow`). PATCH tedy nikdy neopraví odkaz v řádku, kde mohlo vzniknout rozhodnutí
      // nad jinou kartou.
      const vetted =
        existing &&
        reissued &&
        card &&
        o.state === "WAITING_OWNER" &&
        panel.sink.readOwnerRow
          ? await this.vetRow(o.id, round, card, existing, source, lease)
          : undefined;
      if (vetted?.kind === "invalidated")
        return await this.writePanel(
          this.d.store.load(o.id),
          { fresh: true },
          lease,
          t0,
        );
      if (vetted?.kind === "stop") {
        panel.index.markDirty(o.id);
        return;
      }
      // Řádek z receiptu nebo z dohledání: do indexu (bez záznamu zápisu; ten vznikne až po ověřeném PATCH níže).
      if (
        existing &&
        source !== "index" &&
        this.setIndex(lease, o.id, existing, round, undefined) !== "ok"
      )
        return;
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
        // Kolo 2, bod 3: vytvoření přes MCP fallback se v journalu označí dřív, než odejde (obnova pak bez
        // konzistentního REST dohledání končí HOLD, nikdy dalším POST).
        // Kolo 3, bod 2: nejde-li záznam zapsat (zámek, fence), MCP se nezavolá a chyba nese „nic neodešlo“
        // (`McpCreateNotSent` → EFFECT_ABSENT níže), nikdy nejistý výsledek.
        id = await panel.sink.upsert(row, undefined, {
          beforeMcpCreate: () => {
            try {
              this.fenced(lease, () => this.effects.markTransport(op, "mcp"));
            } catch (err) {
              // Kolo 4: důkaz „pokus nic neodeslal“ trvale na disk (bez `.state.lock`), aby ho převzala i další
              // instance (nový `panel-sync`), když ani EFFECT_ABSENT níže nezíská zámek.
              try {
                const attempts = this.effects.get(op)?.attempts;
                if (attempts !== undefined)
                  this.effects.recordNotSent(op, attempts);
              } catch {
                /* bez trvalého důkazu zůstane PREPARED: nejhůř HOLD, nikdy dvojí vytvoření */
              }
              throw new McpCreateNotSent(
                `REST vytvoření odmítl a záznam transportu MCP do journalu se nepodařil (${String((err as Error)?.message ?? err).slice(0, 200)}); MCP vytvoření neodešlo`,
              );
            }
          },
        });
      } else if (vetted?.kind === "ok") {
        ({ id, seq } = await this.vettedPatch(
          o.id,
          round,
          card!,
          row,
          existing,
          vetted,
          lease,
        ));
        const after = await this.recheckAfterPatch(
          o.id,
          round,
          card!,
          existing,
          vetted.row,
          lease,
        );
        if (after === "invalidated")
          return await this.writePanel(
            this.d.store.load(o.id),
            { fresh: true },
            lease,
            t0,
          );
        if (after === "stop") {
          panel.index.markDirty(o.id);
          return;
        }
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
      // Kolo 3, bod 2: MCP vytvoření neodešlo (REST čistě odmítl, záznam transportu se nezapsal) = jistě bez efektu.
      const notSent = e instanceof McpCreateNotSent;
      const unsure = !notSent && isUncertainOutcome(e);
      try {
        // PR #99: journal a značky jen s platným fence (jinak je zapíše až platný držitel zámku panelu).
        this.fenced(lease, () => {
          if (creating) {
            // Clean refusal → certainly no row; anything else may have created one: stays PREPARED, looked up first next time.
            // A stale fence (PanelLockHoldError) sent nothing, but the record stays PREPARED: the next attempt looks up first.
            if (unsure || e instanceof PanelLockHoldError)
              this.effects.note(op, (e as Error).message ?? String(e));
            else {
              this.effects.absent(op, (e as Error).message ?? String(e));
              this.effects.clearNotSent(op);
            }
          }
          // Only a sink that can look rows up may mark (otherwise the mark could never be resolved and would block the panel).
          if (creating && panel.sink.findRowByOrderId && unsure)
            panel.index.markUncertain(o.id);
        });
      } catch {
        /* fence neplatí nebo journal nezapisovatelný (u `notSent` doplní EFFECT_ABSENT další zápis z `.not-sent`) */
      }
      try {
        // Etapa 3: the row is behind state.json; the next tick rewrites it (`catchUpPanel`), not only the next transition.
        // Never after a create of unknown outcome that cannot be looked up (sink without findRowByOrderId): the row may
        // exist, so the operation stays PREPARED and every later sync of this order is a HOLD (`resolvePanelRow`).
        if (!creating || !unsure || panel.sink.findRowByOrderId)
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
   * Opravný PR „panel“, kolo 2, bod 1: jedna kontrola řádku znovuvydané zakázky ve WAITING_OWNER před zápisem, pro
   * každou cestu k ID řádku (index, receipt z journalu, dohledání). Řádek se přečte (REST) a vyřadí (`invalidateRow`:
   * znehodnotit, nové kolo řádku, starý SUPERSEDED), když:
   *  - je znehodnocený, nebo ukazuje jinou kartu než aktuální kartu s otiskem,
   *  - nese rozhodnutí, ale jeho odkaz karty nebyl od vydání aktuální karty prokazatelně aktuální. Prokázané je to jen
   *    záznamem posledního zápisu pod zámkem panelu do tohoto řádku, v tomto kole, s aktuální kartou (`lastWrite`), a ten
   *    má jen řádek z indexu. Řádek z receiptu nebo z dohledání s rozhodnutím se tedy vždy vyřadí.
   * Selhání čtení vyhodí výjimku: nic se nezapíše, řádek zůstane dirty.
   */
  private async vetRow(
    id: string,
    round: number,
    card: string,
    pageId: string,
    source: RowSource,
    lease: PanelLease,
  ): Promise<RowVet> {
    const panel = this.d.panel!;
    const seen = await panel.sink.readOwnerRow!(pageId);
    const norm = normPage(pageId);
    const { last, tainted } = this.fenced(lease, () => ({
      last: source === "index" ? panel.index.lastWrite(id) : undefined,
      tainted: panel.index.tainted(id).includes(norm),
    }));
    const lastOk =
      last !== undefined &&
      last.row === norm &&
      last.round === round &&
      last.card === card;
    const why = tainted
      ? "řádek je znehodnocený"
      : seen.readable === true && seen.card !== card
        ? `řádek ukazuje jinou kartu (${String(seen.card ?? "nic").slice(0, 80)})`
        : seen.decision && !lastOk
          ? `rozhodnutí ${seen.decision} v řádku, jehož odkaz karty nebyl od vydání aktuální karty prokazatelně aktuální (řádek z ${source === "index" ? "indexu bez záznamu zápisu aktuální karty" : source === "receipt" ? "receiptu journalu" : "dohledání"})`
          : undefined;
    if (!why)
      return {
        kind: "ok",
        row: seen,
        proven: seen.readable === true && (lastOk || !seen.decision),
      };
    const moved = this.fenced(lease, () =>
      this.invalidateRow(id, round, pageId, `před zápisem: ${why}`),
    );
    return moved ? { kind: "invalidated" } : { kind: "stop" };
  }

  /**
   * PATCH prověřeného řádku (kolo 2, bod 1). Před odesláním se záznam posledního zápisu nastaví na „zápis běží, karta
   * neprokázaná“ (`card: null`): pád nebo nejasný výsledek PATCH tak nikdy nenechá platit starý důkaz přes okno, ve
   * kterém mohl PATCH přepsat cizí kartu. Čisté odmítnutí (nic se nezapsalo) vrátí důkaz z kontroly před zápisem.
   */
  private async vettedPatch(
    id: string,
    round: number,
    card: string,
    row: PanelRow,
    pageId: string,
    vetted: Extract<RowVet, { kind: "ok" }>,
    lease: PanelLease,
  ): Promise<{ id: string; seq: number }> {
    const panel = this.d.panel!;
    const seq = this.fenced(lease, () => {
      const s = panel.index.beginWrite(id);
      panel.index.recordWrite(id, {
        row: pageId,
        round,
        card: null,
        fence: lease.fence,
      });
      return s;
    });
    try {
      return { id: await this.writeRow(lease, row, pageId), seq };
    } catch (e) {
      if (vetted.proven && !isUncertainOutcome(e))
        try {
          this.fenced(lease, () =>
            panel.index.recordWrite(id, {
              row: pageId,
              round,
              card,
              fence: lease.fence,
            }),
          );
        } catch {
          /* záznam zůstane „neprokázaný“: poll čeká, další zápis prověří znovu */
        }
      throw e;
    }
  }

  /**
   * Kolo 2, bod 1 (okno mezi čtením a PATCH): po PATCH se řádek přečte znovu. Ukazuje-li jinou kartu (cizí zápis po
   * PATCH), nebo se rozhodnutí změnilo proti čtení před zápisem (mohlo vzniknout nad cizí kartou, kterou PATCH právě
   * přepsal), řádek se vyřadí. Teprve pak smí volající zaznamenat zápis s aktuální kartou. Selhání čtení vyhodí výjimku
   * (záznam zápisu zůstane „neprokázaný“).
   */
  private async recheckAfterPatch(
    id: string,
    round: number,
    card: string,
    pageId: string,
    before: OwnerRow,
    lease: PanelLease,
  ): Promise<"ok" | "invalidated" | "stop"> {
    const after = await this.d.panel!.sink.readOwnerRow!(pageId);
    const why =
      after.readable === true && after.card !== card
        ? `po zápisu řádek ukazuje jinou kartu (${String(after.card ?? "nic").slice(0, 80)})`
        : after.decision && after.decision !== before.decision
          ? `rozhodnutí ${after.decision} vzniklo v okně zápisu řádku (před zápisem ${before.decision ?? "prázdné"}); nad jakou kartou, nelze prokázat`
          : undefined;
    if (!why) return "ok";
    const moved = this.fenced(lease, () =>
      this.invalidateRow(id, round, pageId, why),
    );
    return moved ? "invalidated" : "stop";
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
      x.meta.checker_model ?? dept?.checkerModel() ?? "—",
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
  ): Promise<{ id: string; source: "receipt" | "lookup" } | undefined> {
    const panel = this.d.panel!;
    let prev = this.effects.get(op);
    // Kolo 3, bod 2 + kolo 4: trvale doloženo (`.not-sent`, i z jiné instance / procesu), že pokus nic nevytvořil (MCP
    // neodešlo), jen EFFECT_ABSENT nešlo zapsat. Doplní se teď, s platným fence a jen pro tentýž pokus (stejné
    // `attempts`, bez záznamu transportu MCP); jinak je důkaz zastaralý a smaže se bez účinku.
    const proven = this.effects.notSentAttempt(op);
    if (proven !== undefined) {
      prev = this.fenced(lease, () => {
        const cur = this.effects.get(op);
        const r =
          cur?.state === "PREPARED" && !cur.transport && cur.attempts === proven
            ? this.effects.absent(
                op,
                "REST vytvoření odmítl a MCP vytvoření neodešlo (záznam transportu se nezapsal); doplněno později",
              )
            : cur;
        this.effects.clearNotSent(op);
        return r;
      });
    }
    if (prev?.state === "EFFECT_DONE" && prev.receipt) {
      const id = pageIdFromUrl(prev.receipt.url);
      // Kolo 2, bod 1: karta řádku z receiptu nečtena; volající ho prověří stejně jako řádek z indexu (`vetRow`).
      if (id) return { id, source: "receipt" };
    }
    if (panel.sink.findRowByOrderId) {
      // Review kolo 3: nothing of unclear outcome was ever sent for this row (no PREPARED / UNKNOWN, no uncertain mark):
      // only the consistent query is asked; when it cannot answer, the row is created. Otherwise a lookup that cannot
      // prove absence (`PanelRowUnclear`: REST unavailable and the lagging MCP search found nothing) is a HOLD.
      const newRow =
        (!prev || prev.state === "EFFECT_ABSENT") &&
        !panel.index.isUncertain(orderId);
      // Kolo 2, bod 3: vytvoření řádku odešlo přes MCP fallback a jeho výsledek není znám. Platí jen konzistentní REST
      // dohledání; když REST odpovědět nemůže, HOLD s logem (nikdy MCP hledání se zpožděným indexem, nikdy další POST).
      const viaMcp =
        prev?.transport === "mcp" &&
        (prev.state === "PREPARED" || prev.state === "EFFECT_UNKNOWN");
      // Kolo 2: vyřazené i znehodnocené řádky se nikdy nevezmou (ani po pádu uprostřed vyřazení).
      const exclude =
        sel.round > 0
          ? this.fenced(lease, () => [
              ...new Set([
                ...panel.index.superseded(orderId),
                ...panel.index.tainted(orderId),
              ]),
            ])
          : undefined;
      let found: string | undefined;
      try {
        found = await panel.sink.findRowByOrderId(orderId, {
          consistentOnly: newRow || viaMcp,
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
        if (viaMcp)
          this.log({
            order: orderId,
            kind: "error",
            role: "transport",
            result: `panel HOLD: vytvoření řádku odešlo přes MCP fallback s nejasným výsledkem a konzistentní REST dohledání není k dispozici; další POST se neposílá (${op})`,
            reason: e.message.slice(0, 300),
          });
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
        // Kolo 2, bod 1: dohledání s `card` ukazuje jen stav v okamžiku dotazu, ne historii řádku; volající ho prověří
        // stejně jako řádek z indexu (`vetRow`).
        return { id: found, source: "lookup" };
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
    this.attemptWaiting = false;
    this.gateWaiting = false;
    this.pendingDecisions = [];
    this.tickOverview = undefined;
    let result: TickResult | undefined;
    try {
      result = await this.tickSteps();
      return result;
    } finally {
      // Dodatek PR 5 (DR-033): důvod nečinnosti a přehled ticku, pod tick lease (jen záznam, nic nespouští).
      if (result) await this.reportIdle(result);
      // PR 4b, bod 1: blokace jen v paměti se při nejbližší možnosti zapíše i na disk (sentinel bez vypršení).
      this.flushLimitHoldMarker();
      await this.flushPanel();
      this.tickPingKeys = undefined;
      this.reconcileWake();
      this.d.store.releaseLock();
    }
  }

  /** Kroky ticku pod tick lease (dřív tělo `tick`); výsledek pak zapíše `reportIdle`. */
  private async tickSteps(): Promise<TickResult> {
    this.observeDispatch();
    // Dodatek PR 5 (DR-033): read-only přehled na začátku ticku (nevyřízená rozhodnutí doplní čtení panelu níže).
    this.tickOverview = this.idleOverview();
    // Etapa 4 / PR 4a (§7): reconciler na začátku ticku, pod lease.
    await this.reconcileAttempts();
    // PR 5 FIX1 (5-K1-2): rozhodnutí vlastníka se čte dřív, než TARS zapíše do řádků (dorovnání dirty řádků). Zápis
    // TARS by změnil `last_edited_by` řádku na integraci a platné GO by se odmítlo jako OWNER_ORIGIN_UNVERIFIED.
    await this.pollOwnerDecisions();
    await this.catchUpPanel();
    await this.retryOwnerPings();
    // Etapa 4 PR 5 (§5): obnova claimů inboxu před jakýmkoli novým claimem; nový claim jen v režimu run.
    await this.dispatchInbox();
    // PR 4b, bod 1: nevyřešené „varování neuloženo / neověřeno“ = globální HOLD (jen čtení a obnova výše). Žádný krok
    // modelu, žádné opakování (RETRY_SAFE), žádná nová zakázka; platí i po restartu a po HOLD → UNKNOWN.
    const held = this.limitHoldReason();
    if (held) {
      this.log({ order: "-", kind: "error", role: "orchestrator", result: "HOLD (varování limitu)", reason: held });
      return { status: "limit_hold", reason: held };
    }
    // Etapa 4 PR 5: `wo-r` bez události nebo s odvolaným claimem → HOLD; `wo-r*` běží jen s commitem a ACK CLAIMED.
    this.holdForeignInbox(this.d.store.listOrders());
    const orders = this.d.store.listOrders();
    let order = orders.find(
      (o) => isActionable(o.state) && this.mayAdvance(o, orders),
    );
    if (!order) {
      const waiting = orders.find((o) => o.state === "WAITING_OWNER");
      // WIP limit 1: no new order while the owner has an undecided card.
      if (waiting) return { status: "waiting_owner", order: waiting.id };
      // PR 5 FIX1 (5-K1-6): rozpracovaný claim stojí v režimu hold; tick nezačne nic jiného (ani novou zakázku).
      const stopped = this.dispatchHeld(orders);
      if (stopped) {
        this.logOnce({
          order: stopped.id,
          kind: "info",
          role: "orchestrator",
          result: "wo-r čeká: dispatch.json mode hold, žádný krok ani efekt",
        });
        return { status: "dispatch_hold", order: stopped.id };
      }
      // Q4-B: po doloženém varování CLI o blížícím se limitu nezačínat novou zakázku (rozpracovaná pokračuje výše).
      const warn = this.activeLimitWarning();
      if (warn) return { status: "limit_warning", until: warn };
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
      // Etapa 4 PR 5 (§7 INTENT): zakázka wo-r* – čerstvá revalidace scope GO před každým krokem modelu.
      if (
        orderClass(order) !== "legacy" &&
        ["NEW", "PLANNED", "DOING", "CHECKING", "FIXING"].includes(
          order.state,
        )
      ) {
        const g = await this.inboxBeforeStep(order);
        order = g.order;
        if (!g.go || this.gateWaiting) break;
      }
      order = await this.step(order);
      // PR 4a: pokus kroku běží na pozadí (osiřelé dítě před deadline): žádný druhý pokus, tick končí.
      if (this.attemptWaiting) break;
      // PR 5: brána nebo zdroj nečitelné/obsazené: žádný další krok v tomto ticku.
      if (this.gateWaiting) break;
      // PR 4b, bod 1: varování v tomto ticku neuloženo → žádný další krok.
      const h = this.limitHoldReason();
      if (h) return { status: "limit_hold", reason: h };
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
  }

  /**
   * Dodatek PR 5 (DR-033): read-only přehled ticku. Připravená práce (isActionable + mayAdvance, tedy s ohledem na
   * frontu max 1 a claim `wo-r*`), čekání na vlastníka, obsazené zámky zdrojů (§9), globální HOLD limitu, režim
   * dispatcheru. Nic nezapisuje ani nespouští.
   */
  private idleOverview(): IdleOverview {
    const orders = this.d.store.listOrders();
    let limitHold = false;
    try {
      limitHold =
        Boolean(this.limitHoldMem) || this.limitGuard.pending().length > 0;
    } catch {
      limitHold = true; // nečitelné = HOLD (fail-closed)
    }
    const disp = this.readDispatchNow();
    return {
      runnable: orders
        .filter((o) => isActionable(o.state) && this.mayAdvance(o, orders))
        .map((o) => o.id),
      waiting_owner: orders
        .filter((o) => o.state === "WAITING_OWNER")
        .map((o) => o.id),
      resource_locks: heldResourceLocks(this.d.store.runsDir),
      limit_hold: limitHold,
      dispatch_mode: disp.invalid ? "unknown" : disp.config.mode,
      pending_decisions: [],
    };
  }

  /**
   * Dodatek PR 5 (DR-033): po ticku (pod tick lease) zapíše `runs/idle/status.json` s `idle_reason` a časem, při změně
   * důvodu i řádek historie a (je-li zapnuto) pole „Poslední krok“ řádku orchestrátoru v panelu. Chyba zápisu se jen
   * zaloguje, tick nikdy neshodí. Nic nespouští (v režimu hold ani v run).
   */
  private async reportIdle(r: TickResult): Promise<void> {
    try {
      const overview: IdleOverview = {
        ...(this.tickOverview ?? this.idleOverview()),
        pending_decisions: [...this.pendingDecisions],
      };
      const { reason, detail } = idleReasonOf(r, overview);
      const at = this.iso();
      const changed = this.idle.record({
        v: 1,
        at,
        tick_status: r.status,
        idle_reason: reason,
        detail: detail.slice(0, 1000),
        overview,
      });
      if (!changed) return;
      if (reason)
        this.log({
          order: "-",
          kind: "info",
          role: "orchestrator",
          result: `nečinnost: ${reason}`,
          reason: detail.slice(0, 500),
        });
      await this.writeOrchestratorRow(
        reason ? `${at} · ${reason}: ${detail}` : `${at} · pracuje: ${detail}`,
        at,
      );
    } catch (e) {
      this.log({
        order: "-",
        kind: "error",
        role: "orchestrator",
        result: "záznam nečinnosti (runs/idle) se nepodařil",
        reason: String((e as Error)?.message ?? e).slice(0, 300),
      });
    }
  }

  /**
   * Dodatek PR 5 (DR-033): řádek orchestrátoru v panelu („ID zakázky“ = `tars-orchestrator`), pole „Poslední krok“.
   * Vytvoření jako efekt `tars-orchestrator/panel-row/r0` (PREPARED → POST → receipt). Nejasný výsledek dřívějšího
   * vytvoření = jen konzistentní dohledání, nikdy druhý POST naslepo. „Rozhodnutí vlastníka“ se nezapisuje (P20) a
   * z tohoto řádku se nikdy nečte.
   */
  private async writeOrchestratorRow(step: string, at: string): Promise<void> {
    const panel = this.d.panel;
    if (!panel || !this.d.orchestratorPanelRow) return;
    const op = operationId(ORCHESTRATOR_ROW_ID, "panel-row", 0);
    const row: PanelRow = {
      Zakázka: "TARS — orchestrátor",
      "ID zakázky": ORCHESTRATOR_ROW_ID,
      Mise: this.d.mission ?? "—",
      Oddělení: "—",
      Stav: "—",
      Fronta: "2 · Běží",
      "Tvůrce (model)": "—",
      "Kontrolor (model)": "—",
      "Kolo oprav": 0,
      "Poslední krok": step.slice(0, 2000),
      "date:Start:start": at,
      "date:Start:is_datetime": 1,
      "date:Poslední změna:start": at,
      "date:Poslední změna:is_datetime": 1,
      "Ruční zásahy": 0,
      "Odkaz na výstup": null,
      "Čeká na vlastníka": "__NO__",
      "Kde běží": "Mac",
      "Proč tento model":
        "Řádek orchestrátoru: důvod nečinnosti ticku (DR-033), ne zakázka.",
      "Karta rozhodnutí": null,
    };
    const fail = (result: string, e?: unknown) =>
      this.log({
        order: "-",
        kind: "error",
        role: "transport",
        result,
        ...(e
          ? { reason: String((e as Error)?.message ?? e).slice(0, 300) }
          : {}),
      });
    const rec = this.effects.get(op);
    let page =
      rec?.state === "EFFECT_DONE"
        ? pageIdFromUrl(rec.receipt?.url ?? "")
        : undefined;
    if (!page && rec && rec.state !== "EFFECT_ABSENT") {
      let found: string | undefined;
      try {
        found = await panel.sink.findRowByOrderId?.(ORCHESTRATOR_ROW_ID, {
          consistentOnly: true,
          unique: true,
        });
      } catch (e) {
        return fail(
          "řádek orchestrátoru: nejasné vytvoření, dohledání selhalo (HOLD, žádný další POST)",
          e,
        );
      }
      if (!found)
        return fail(
          "řádek orchestrátoru: nejasné vytvoření a řádek nedohledán (HOLD, žádný další POST)",
        );
      this.effects.done(
        op,
        { url: `https://www.notion.so/${found}` },
        { recovered: true },
      );
      page = found;
    }
    if (page) {
      try {
        await panel.sink.upsert(row, page);
      } catch (e) {
        fail("řádek orchestrátoru: zápis Poslední krok selhal", e);
      }
      return;
    }
    this.effects.prepare(op);
    try {
      const id = await panel.sink.upsert(row, undefined);
      this.effects.done(op, { url: `https://www.notion.so/${id}` });
    } catch (e) {
      if (effectSurelyAbsent(e))
        this.effects.absent(op, String((e as Error)?.message ?? e));
      fail("řádek orchestrátoru: vytvoření selhalo", e);
    }
  }

  /**
   * Dodatek PR 5 (P20): původ rozhodnutí z panelu. Přijme se jen zápis, jehož řádek má `last_edited_by` = ověřený
   * vlastník (`ownerOrigin`). Jinak HOLD `OWNER_ORIGIN_UNVERIFIED`: nic se nepřijme, zakázka čeká dál, záznam do
   * přehledu ticku. Vlastník může rozhodnutí v panelu zadat znovu (nový zápis).
   */
  private async ownerOriginOk(
    o: Order,
    value: string,
    editor: string | undefined,
  ): Promise<boolean> {
    const v = await this.verifyOrigin(editor);
    if (v.ok) return true;
    this.holdOrigin(o, value, v);
    return false;
  }

  private async verifyOrigin(
    editor: string | undefined,
  ): Promise<OriginResult> {
    if (!this.d.ownerOrigin)
      return {
        ok: false,
        code: OWNER_ORIGIN_UNVERIFIED,
        detail: "ověření původu rozhodnutí není nastaveno",
      };
    try {
      return await this.d.ownerOrigin.verify(editor);
    } catch {
      return {
        ok: false,
        code: OWNER_ORIGIN_UNVERIFIED,
        detail: "ověření původu selhalo",
      };
    }
  }

  /** HOLD OWNER_ORIGIN_UNVERIFIED: nic se nepřijme, záznam do přehledu ticku a jednou do logu. */
  private holdOrigin(
    o: Order,
    value: string,
    v: OriginResult | undefined,
  ): void {
    const detail = v && !v.ok ? v.detail : "původ rozhodnutí neověřen";
    this.pendingDecisions.push({
      order: o.id,
      value,
      code: OWNER_ORIGIN_UNVERIFIED,
      detail,
    });
    this.logOnce({
      order: o.id,
      kind: "error",
      role: "orchestrator",
      result: `HOLD ${OWNER_ORIGIN_UNVERIFIED}: Notion ${value} nepřijato`,
      reason: detail,
    });
  }

  /** Dodatek PR 5 (DR-033): latence převzetí rozhodnutí (zápis vlastníka → převzetí) do runs/idle a do logu. */
  private noteDecisionTaken(
    o: Order,
    value: string,
    ownerWrittenAt: string | undefined,
  ): void {
    try {
      const taken = this.iso();
      const ms = this.idle.goLatency({
        order: o.id,
        value,
        owner_written_at: ownerWrittenAt,
        taken_at: taken,
      });
      this.log({
        order: o.id,
        kind: "info",
        role: "orchestrator",
        result: `rozhodnutí Notion ${value} převzato`,
        reason:
          ms === undefined
            ? "latence neznámá (čas zápisu vlastníka chybí)"
            : `latence převzetí ${Math.round(ms / 1000)} s`,
      });
    } catch {
      /* záznam latence je informativní */
    }
  }

  /** PR 4b, bod 1: důvod globálního HOLD z varování limitu (paměť nebo nevyřešený sentinel na disku), jinak undefined. */
  private limitHoldReason(): string | undefined {
    this.flushLimitHoldMarker();
    let pending: ReturnType<LimitGuard["pending"]>;
    try {
      // FIX1 (PR 4b) nález 7: pokus v HOLD „varování neuloženo“ bez jakékoli stopy v runs/limit-guard (sentinel
      // smazán ručně nebo ztracen) = sentinel se obnoví a blokace platí dál, dokud ji vlastník neověří.
      const missing = this.limitHoldsWithoutSentinel();
      for (const id of missing)
        try {
          this.limitGuard.restore(id);
        } catch {
          // obnova nejde zapsat: blokuje důvod níže (journal), ne obejití
        }
      const still = missing.filter((id) => !this.limitGuard.knows(id));
      if (still.length)
        return `${LIMIT_WARNING_LOST}: sentinel pokusu chybí a nejde obnovit (${still.slice(0, 3).join(", ")}); do ručního ověření žádný krok ani nová zakázka`.slice(0, 500);
      pending = this.limitGuard.pending();
    } catch (e) {
      return `runs/limit-guard nebo journal pokusů nejde přečíst (fail-closed): ${String((e as Error)?.message ?? e).slice(0, 200)}`;
    }
    if (pending.length)
      return `${LIMIT_WARNING_LOST} nebo neověřeno: ${pending.length} nevyřešený sentinel (${pending
        .slice(0, 3)
        .map((p) => p.key)
        .join(", ")}); do ručního ověření vlastníkem žádný krok ani nová zakázka`.slice(0, 500);
    if (this.limitHoldMem) return this.limitHoldMem;
    return undefined;
  }

  /**
   * FIX1 (PR 4b) nález 7: ID pokusů s trvalým důvodem HOLD LIMIT_WARNING_LOST (i po HOLD → ABANDONED reconcilerem),
   * o kterých runs/limit-guard nic neví (ani nevyřešený, ani ověřený sentinel).
   */
  private limitHoldsWithoutSentinel(): string[] {
    const out: string[] = [];
    for (const o of this.d.store.listOrders())
      for (const a of this.attempts.list(o.id))
        if (
          a.hold &&
          [a.hold.limit_reason ?? "", a.hold.reason, ...(a.hold.previous ?? [])].some((x) =>
            x.startsWith(LIMIT_WARNING_LOST),
          ) &&
          !this.limitGuard.knows(a.attempt_id)
        )
          out.push(a.attempt_id);
    return out;
  }

  /** PR 4b, bod 1: varování neuloženo → blokace v paměti hned, sentinel na disku hned, jinak při nejbližší možnosti. */
  private raiseLimitHold(reason: string, sentinelOnDisk: boolean): void {
    this.limitHoldMem ??= `${LIMIT_WARNING_LOST}: ${reason}`.slice(0, 500);
    if (!sentinelOnDisk) this.limitHoldMarkerPending = true;
    this.flushLimitHoldMarker();
    this.log({ order: "-", kind: "error", role: "orchestrator", result: "HOLD (varování limitu neuloženo)", reason: reason.slice(0, 300) });
  }

  private flushLimitHoldMarker(): void {
    if (!this.limitHoldMarkerPending) return;
    try {
      this.limitGuard.open(`hold/${this.iso()}/${process.pid}`);
      this.limitHoldMarkerPending = false;
    } catch {
      // disk pořád nejde: blokace drží paměť a zkusí se znovu
    }
  }

  /**
   * PR 4b, bod 1: hlídané volání modelu. Sentinel PŘED voláním (throw = volání neproběhne), varování adaptéru jdou do
   * sinku hned po návratu procesu, na konci se uloží i varování z výsledku (`notesOf`). Neuloženo = sentinel zůstane
   * a blokace platí i v paměti; vrací `lost` s důvodem.
   */
  private async guarded<T>(
    key: string,
    fn: () => Promise<T>,
    notesOf: (v: T) => LimitNote[],
  ): Promise<{ v: T; lost?: string }> {
    const s = new GuardSession(this.limitGuard, key);
    this.limitGuard.open(key);
    let v: T;
    try {
      v = await runWithLimitSink(s.sink, fn);
    } catch (e) {
      this.closeGuard(s, []);
      throw e;
    }
    const lost = this.closeGuard(s, notesOf(v));
    return lost ? { v, lost } : { v };
  }

  private closeGuard(s: GuardSession, notes: LimitNote[]): string | undefined {
    const all = [...notes];
    const ok = s.finish(all);
    if (ok) {
      for (const n of all) this.guardSaved.add(`${n.source}|${n.text}`);
      return undefined;
    }
    const why = `${s.key}: ${s.lost.join("; ")}`;
    this.raiseLimitHold(why, true);
    return why;
  }

  /**
   * Etapa 4 PR 2 (§6.3): pod lease přečte `dispatch.json` (fail-closed) a zaznamená režim. Chyba nic nezastaví:
   * platí `hold` a `may_start_new = false`.
   */
  private observeDispatch(): void {
    if (!this.d.dispatchFile) return;
    const r = readDispatch(this.d.dispatchFile, this.d.store.runsDir);
    try {
      this.lastDispatch = observeMode(
        this.d.store.runsDir,
        r.config.mode,
        this.now(),
        r.revision,
      );
    } catch (e) {
      this.lastDispatch = {
        mode: "hold",
        may_start_new: false,
        changed: false,
      };
      this.safeLog({
        order: "-",
        kind: "error",
        role: "orchestrator",
        result: "dispatch: režim nejde zaznamenat, platí hold",
        reason: String((e as Error)?.message ?? e).slice(0, 200),
      });
      return;
    }
    if (this.lastDispatch.changed || r.invalid)
      this.safeLog({
        order: "-",
        kind: "info",
        role: "orchestrator",
        result: `dispatch: mode ${this.lastDispatch.mode}${this.lastDispatch.previous ? ` (předtím ${this.lastDispatch.previous})` : ""}`,
        reason: r.invalid ?? (r.hold_file ? "runs/HOLD existuje" : undefined),
      });
  }

  /**
   * Etapa 4 PR 2 (§10.2 bod 3): zkonzumování / přeplánování `runs/next-wake` na konci ticku, jen dokud tento běh drží
   * lease (tick bez lease `next-wake` nemění, bod 4). Chyba se jen zaloguje: brána má pojistku 30 min.
   */
  private reconcileWake(): void {
    if (this.d.nextWake === false) return;
    try {
      if (!this.d.store.holdsLease()) return;
      const r = reconcileNextWake(
        this.d.store.runsDir,
        this.d.store.listOrders(),
        this.now(),
        this.d.store.fence,
      );
      if (r.action !== "none" && r.action !== "kept")
        this.safeLog({
          order: r.next?.order_id ?? "-",
          kind: "info",
          role: "orchestrator",
          result: `next-wake: ${r.action}${r.next ? ` epoch ${r.next.epoch} (attempt ${r.next.attempt})` : ""}`,
          reason: r.reason,
        });
    } catch (e) {
      this.safeLog({
        order: "-",
        kind: "error",
        role: "orchestrator",
        result: "next-wake: zápis selhal (brána spoléhá na pojistku 30 min)",
        reason: String((e as Error)?.message ?? e).slice(0, 200),
      });
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
    // Etapa 4 PR 5 (§3.3): receipt a jeho revalidace jen pod tick lease. Mimo tick si ho čtení vezme samo (a zase
    // uvolní); obsazený lease = nic se nečte ani nepřijme.
    const own = !this.d.store.holdsLease() && this.d.store.acquireLock();
    if (!own && !this.d.store.holdsLease()) {
      this.log({
        order: "-",
        kind: "info",
        role: "orchestrator",
        result:
          "rozhodnutí vlastníka nečteno: tick lease nejde získat (drží ho jiný běh nebo je obsazený stavový zámek)",
      });
      return;
    }
    try {
      await this.readNotionDecisions();
      await this.verifyApprovals();
    } finally {
      if (own) this.d.store.releaseLock();
    }
  }

  /**
   * Etapa 4 PR 5 (§3.3, §6.4): brána přechodu GO → DONE. Result GO se čerstvě revaliduje (receipt z řádku panelu), u
   * wo-r* navíc scope GO, u všech review receipt. Legacy GO zadané vlastníkem přes `cli.ts owner` (hook P20) result
   * receipt nemá: platí jako dnes (goBlocker + read-back), s review receiptem; wo-r* takové GO nepřijme.
   */
  private async doneGate(o: Order): Promise<GateResult> {
    const dept = o.brief ? this.d.departments[o.brief.department] : undefined;
    if (!dept)
      return {
        ok: false,
        code: "EFFECT_NOT_ALLOWED",
        detail: "zakázka bez oddělení",
      };
    const cliGo =
      orderClass(o) === "legacy" &&
      !o.meta.result_decision_id &&
      (o.meta.owner_go_source ?? "").startsWith("owner ");
    return this.gate.beforeTransition(
      o,
      this.gateCtx(o, dept, ["done"], !cliGo),
    );
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
    for (const listed of waitingOrders) {
      try {
        // Kolo 2, bod 2: nedokončené vyřazení řádku (pád uprostřed) se dokončí dřív, než se určí kolo a řádek.
        await this.panelLock(listed.id, async (lease) =>
          this.fenced(lease, () => this.finishInvalidations(listed.id)),
        );
        const waiting = this.d.store.load(listed.id);
        if (waiting.state !== "WAITING_OWNER") continue;
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
          // Dodatek PR 5 (P20): s hodnotou i autor posledního zápisu řádku (REST `readOwnerRow`); bez něj HOLD níže.
          const seen: OwnerRow = panel.sink.readOwnerRow
            ? await panel.sink.readOwnerRow(pageId)
            : { decision: await panel.sink.readOwnerDecision!(pageId) };
          const value = seen.decision;
          const ev = ownerEventFor(value);
          if (!ev) return;
          if (!(await this.ownerOriginOk(waiting, value!, seen.last_edited_by)))
            return;
          // The read took a while and `cli owner` may have decided meanwhile: read-check-write the stored state under the state lock.
          const taken = this.fenced(lease, () => {
            const fresh = this.d.store.load(waiting.id);
            if (
              fresh.state !== "WAITING_OWNER" ||
              reissueRound(fresh) !== round ||
              panel.index.current(fresh.id, round) !== pageId
            )
              return false;
            this.acceptOwner(fresh, ev, `Notion ${value}`, pageId);
            return true;
          });
          if (taken)
            this.noteDecisionTaken(waiting, value!, seen.last_edited_time);
        });
        if (resync) await this.resyncPanel(waiting.id);
      } catch (e) {
        this.log({
          order: listed.id,
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
    // Dodatek PR 5 (P20): původ rozhodnutí se ověří před zámkem stavu (resolver je asynchronní), použije se níže.
    const origin = ownerEventFor(row.decision)
      ? await this.verifyOrigin(row.last_edited_by)
      : undefined;
    let resync = false;
    let taken = false;
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
      if (!origin?.ok) return this.holdOrigin(fresh, value, origin);
      this.acceptOwner(fresh, ev, `Notion ${value}`, pageId);
      taken = true;
    });
    if (taken)
      this.noteDecisionTaken(waiting, row.decision!, row.last_edited_time);
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
    // Kolo 2, bod 1: i řádek mimo index (receipt, dohledání); index ale nesmí v tomto kole držet JINÝ řádek.
    const cur = panel.index.current(id, round);
    if (cur && normPage(cur) !== normPage(pageId)) return false;
    // Kolo 2, bod 2: záměr (který řádek, které kolo) durable v journalu PŘED změnou stavu a indexu. Pád kdekoli potom
    // dokončí `finishInvalidations` při dalším vstupu (zápis řádku, poll), takže zakázka nezůstane bez platného řádku
    // ani se dvěma.
    const op = operationId(id, ROW_INVALIDATE, round);
    const prev = this.effects.get(op);
    if (prev?.state === "EFFECT_DONE" || prev?.state === "EFFECT_UNKNOWN")
      return false;
    this.effects.prepare(op, { subject: normPage(pageId) });
    this.log({
      order: id,
      kind: "error",
      role: "orchestrator",
      result: `řádek panelu ${pageId} je neplatný pro rozhodnutí (HOLD); zakázka dostane nový řádek kola ${round + 1}, starý se označí SUPERSEDED`,
      reason: reason.slice(0, 300),
    });
    return this.completeInvalidation(this.effects.get(op)!);
  }

  /**
   * Kolo 2, bod 2 (pod `.state.lock` s platným fence): dokončí vyřazení řádku podle záznamu v journalu. Idempotentní, každý
   * krok se dá zopakovat: znehodnotit řádek, zvýšit kolo řádku ve state.json (jen je-li zakázka pořád ve WAITING_OWNER
   * v kole záznamu), vyřadit řádek v indexu (`retire` i pro řádek mimo index), receipt. Vrátí true, když zakázka má
   * nové kolo řádku (další zápis vytvoří nový řádek).
   */
  private completeInvalidation(rec: EffectRecord): boolean {
    const panel = this.d.panel!;
    const { order: id, round, operation_id: op } = rec;
    const page = rec.subject;
    if (!page) {
      this.effects.unknown(op, "záznam vyřazení řádku nenese řádek");
      return false;
    }
    panel.index.taint(id, page);
    let o = this.d.store.load(id);
    if (reissueRound(o) === round) {
      if (o.state !== "WAITING_OWNER") {
        this.effects.absent(
          op,
          `zakázka mezitím ve stavu ${o.state}; řádek znehodnocen, nové kolo řádku nevzniklo`,
        );
        return false;
      }
      const at = this.iso();
      // Kolo 3, bod 1: rozhodnutí vlastníka uložené z vyřazeného řádku nebo kola (`owner_go`, jeho zdroj, volba A/B) se
      // do nového kola nepřenáší. Platí jen rozhodnutí z nového řádku aktuální karty; jinak by úspěšný read-back převedl
      // zakázku do DONE podle GO, které vlastník mezitím v řádku změnil (např. na REJECT).
      const droppedGo = o.meta.owner_go;
      const keep = Object.fromEntries(
        Object.entries(o.meta).filter(
          ([k]) => !OWNER_DECISION_META.includes(k),
        ),
      );
      const next: Order = {
        ...o,
        updated_at: at,
        meta: {
          ...keep,
          reissue_round: String(round + 1),
          row_invalidated_at: at,
        },
      };
      if (!this.persist(next)) return false; // zůstává PREPARED: dokončí další vstup
      if (droppedGo)
        this.log({
          order: id,
          kind: "info",
          role: "orchestrator",
          result: `uložené GO (${o.meta.owner_go_source ?? "?"}) z vyřazeného řádku zrušeno; platí jen rozhodnutí z nového řádku kola ${round + 1}`,
        });
      o = next;
    } else if (reissueRound(o) < round) {
      this.effects.unknown(
        op,
        `kolo řádku ve stavu (${reissueRound(o)}) je starší než kolo záznamu`,
      );
      return false;
    }
    panel.index.retire(id, round + 1, page);
    this.effects.done(op, { url: `https://www.notion.so/${page}` });
    return true;
  }

  /** Kolo 2, bod 2 (pod `.state.lock` s platným fence): dokončí každé vyřazení řádku, které po pádu zůstalo PREPARED. */
  private finishInvalidations(id: string): void {
    if (!this.d.panel) return;
    for (const r of this.effects.list(id))
      if (r.step === ROW_INVALIDATE && r.state === "PREPARED") {
        const done = this.completeInvalidation(r);
        this.log({
          order: id,
          kind: "info",
          role: "orchestrator",
          result: `dokončeno vyřazení řádku panelu ${r.subject ?? "?"} podle journalu (${r.operation_id})${done ? `, nové kolo řádku ${r.round + 1}` : ""}`,
        });
      }
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
    rowPageId?: string,
  ): Order {
    if (ev.decision === "REJECT")
      return this.apply(o, ev, {
        role: "orchestrator",
        result: `owner REJECT (${source})`,
      });
    if (o.meta.owner_go) {
      // Etapa 4 PR 5: GO přijaté před PR 5 bez result receiptu dostane receipt z tohoto (nového) pozorování řádku.
      if (!rowPageId || o.meta.result_decision_id) return o; // already recorded, waits for the read-back
      const id = this.recordResultReceipt(o, rowPageId);
      if (!id) return o;
      const upd: Order = {
        ...o,
        updated_at: this.iso(),
        meta: { ...o.meta, result_decision_id: id },
      };
      return this.persist(upd) ? upd : this.current(o.id);
    }
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
    // Etapa 4 PR 5 (§3.2 result): GO z řádku panelu = result receipt z tohoto REST čtení (nikdy bez pozorování).
    // Zakázka wo-r* přijme GO jen tak (cli.ts owner pro ni neplatí).
    const resultId = rowPageId
      ? this.recordResultReceipt(o, rowPageId)
      : undefined;
    if (rowPageId && !resultId) return o;
    if (!rowPageId && orderClass(o) !== "legacy") {
      this.logOnce({
        order: o.id,
        kind: "info",
        role: "orchestrator",
        result: `GO nepřijato (${source}): zakázka wo-r přijme GO jen z karty výsledku na panelu (RESULT_GO_MISSING)`,
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
        ...(resultId ? { result_decision_id: resultId } : {}),
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
        // Etapa 4 PR 5: GO → DONE jen po čerstvé revalidaci (result GO; wo-r* i scope GO) a s review receiptem.
        let gated: string | undefined;
        if (hash === w.meta.approved_hash) {
          const dg = await this.doneGate(w);
          if (!dg.ok) {
            this.logOnce({
              order: w.id,
              kind: isTransient(dg.code) ? "info" : "error",
              role: "orchestrator",
              result: `GO → DONE zadrženo: ${dg.code}`,
              reason:
                `${dg.detail}${dg.path ? ` — cesta: ${dg.path}` : ""}`.slice(
                  0,
                  300,
                ),
            });
            continue;
          }
          gated = w.meta.result_decision_id ?? "";
        }
        this.d.store.withStateLock(() => {
          const fresh = this.d.store.load(w.id);
          if (
            fresh.state !== "WAITING_OWNER" ||
            fresh.meta.owner_go !== w.meta.owner_go ||
            fresh.delivered_url !== w.delivered_url ||
            (gated !== undefined &&
              (fresh.meta.result_decision_id ?? "") !== gated)
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
        e instanceof GateHoldError ||
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

  /** Etapa 4 / PR 4a (§7): reconciler všech neukončených pokusů (začátek ticku, pod lease). Chyba se jen zaloguje. */
  private async reconcileAttempts(): Promise<void> {
    try {
      const ids = this.d.store
        .listOrders()
        .map((o) => o.id)
        .filter((id) =>
          this.attempts.list(id).some((r) => !isTerminalAttempt(r)),
        );
      if (!ids.length) return;
      const res = await reconcileAll(this.attempts, ids, this.probe, {
        now: this.now(),
        exitTimeoutMs: this.d.attemptExitTimeoutMs,
      });
      for (const x of res)
        this.log({
          order: x.attempt_id.split("/")[0],
          kind: x.action === "hold" ? "error" : "info",
          role: "orchestrator",
          result: `reconciler: ${x.action}`,
          reason: `${x.attempt_id}: ${x.reason}`,
        });
    } catch (e) {
      this.log({
        order: "-",
        kind: "error",
        role: "orchestrator",
        result: "reconciler selhal",
        reason: String((e as Error)?.message ?? e).slice(0, 300),
      });
    }
  }

  /**
   * Etapa 4 / PR 4a (§7, §8): krok modelu jako pokus. INTENT před spawn, STARTED po spawn (runProcess v kontextu
   * pokusu), FINISHED až po trvalém uložení výstupu; teprve potom volající aplikuje přechod. Opakování kroku:
   * předchozí neukončený pokus projde reconcilerem; FINISHED s výstupem se shodným sha256 = RESUME (bez nového volání
   * modelu); jinak rozhodne reconcile adaptéru (RETRY_SAFE, nebo throw/UNKNOWN = HOLD, žádné volání).
   */
  private async attemptStep<T extends StepOutcome & { draft_file?: string }>(
    order: Order,
    dept: DepartmentRunner,
    kind: StepKind,
    run: () => Promise<T>,
  ): Promise<AttemptRun<T>> {
    const J = this.attempts;
    const step = `${kind}-r${order.fix_rounds}`;
    let prev = J.latest(order.id, step);
    if (prev && !isTerminalAttempt(prev)) {
      const res = await reconcileAll(J, [order.id], this.probe, {
        now: this.now(),
        exitTimeoutMs: this.d.attemptExitTimeoutMs,
      });
      const mine = res.find((x) => x.attempt_id === prev!.attempt_id);
      prev = J.get(prev.attempt_id)!;
      if (!isTerminalAttempt(prev)) {
        if (mine?.action === "waiting_background")
          return { kind: "wait", reason: `${prev.attempt_id}: ${mine.reason}` };
        return {
          kind: "hold",
          reason: `pokus ${prev.attempt_id}: ${mine?.reason ?? prev.hold?.reason ?? prev.phase}`,
        };
      }
    }
    if (prev?.phase === "FINISHED" && prev.finished?.ok) {
      // FIX1 (PR 4b) nález 2: pokus se snímkem před smí RESUME jen s uloženým snímkem po a bez problému §8.2
      // (EXTERNAL_UNJOURNALED). Chybí snímek po (pád mezi FINISHED a snímkem, starší záznam) = HOLD, žádné doplnění.
      if (prev.remote_before) {
        const remote = !prev.remote_after
          ? "UNKNOWN (§8.2): FINISHED bez snímku po, nežurnálovaný zápis dítěte nejde vyloučit"
          : dept.remoteProblem
            ? dept.remoteProblem(order, this.ctx, prev)
            : "UNKNOWN (§8.2): oddělení neumí vyhodnotit snímky";
        if (remote) {
          if (!prev.reconcile) J.setReconcile(prev.attempt_id, "UNKNOWN", remote);
          return { kind: "hold", reason: `pokus ${prev.attempt_id}: ${remote}` };
        }
      }
      // FINISHED, přechod neaplikován (krok je pořád na řadě): výstup se shodným sha256 → použít bez volání modelu.
      const resumed = this.resumeOutput<T>(order, prev);
      if (!prev.reconcile)
        J.setReconcile(
          prev.attempt_id,
          resumed ? "RESUME" : "UNKNOWN",
          resumed
            ? "výstup FINISHED se shodným sha256"
            : "výstup FINISHED chybí, nebo nesedí sha256 (výstupu nebo draftu)",
        );
      if (!resumed)
        return {
          kind: "hold",
          reason: `pokus ${prev.attempt_id}: výstup FINISHED nejde použít (UNKNOWN)`,
        };
      return { kind: "run", r: resumed, resumed: true };
    }
    if (prev && !prev.reconcile) {
      // FIX4: bez doloženého stavu varování limitu žádné RETRY_SAFE; zakázka zůstane rozpracovaná (žádná nová).
      const limitWhy = this.limitStateBeforeRetry(order, kind, prev);
      if (limitWhy)
        return {
          kind: "wait",
          reason: `pokus ${prev.attempt_id}: ${limitWhy}`,
        };
      let d: { result: "RESUME" | "RETRY_SAFE" | "UNKNOWN"; reason: string };
      try {
        d = dept.reconcileRetry
          ? dept.reconcileRetry(kind, order, this.ctx, prev)
          : {
              result: "UNKNOWN",
              reason: `oddělení ${dept.name} nemá reconcile před opakováním (§8)`,
            };
      } catch (e) {
        // Fail-closed: opakování odmítnuto (dev do PR 4b). Žádné volání, žádný účinek; záznam reconcile zůstane chybět.
        return {
          kind: "hold",
          reason: `opakování kroku odmítnuto: ${String((e as Error)?.message ?? e).slice(0, 300)}`,
        };
      }
      if (d.result === "RESUME")
        d = {
          result: "UNKNOWN",
          reason: `RESUME bez výstupu FINISHED: ${d.reason}`,
        };
      J.setReconcile(prev.attempt_id, d.result, d.reason);
      if (d.result !== "RETRY_SAFE")
        return {
          kind: "hold",
          reason: `reconcile ${prev.attempt_id} = ${d.result}: ${d.reason}`,
        };
    }
    // PR 4b, bod 1: nevyřešené „varování neuloženo“ nepustí žádný nový pokus (ani RETRY_SAFE).
    const held = this.limitHoldReason();
    if (held) return { kind: "wait", reason: held };
    // PR 4b (§8.2): snímek vzdálených zápisů PŘED INTENT (dev create/revise). Nejde pořídit = HOLD, žádné volání.
    const since = this.iso();
    const remote_before = dept.remoteSnapshot?.(kind, order, this.ctx, since);
    if (remote_before && !remote_before.ok)
      return { kind: "hold", reason: `§8.2 snímek vzdálených zápisů před pokusem nejde pořídit: ${remote_before.error}` };
    const deadlineMs = dept.attemptDeadlineMs?.(kind) ?? 40 * 60_000;
    const rec = J.intent(order.id, step, {
      ...(remote_before ? { remote_before } : {}),
      input_sha256: sha256(
        JSON.stringify({
          step,
          version: order.version ?? 0,
          brief: order.brief,
          draft_file: order.draft_file,
          last_issues: order.last_issues,
        }),
      ),
      deadline: new Date(this.now().getTime() + deadlineMs).toISOString(),
      decision_check:
        "legacy wo-* bez scope receiptu (revalidace rozhodnutí přijde s PR 5, §3.3)",
      ...(order.fence !== undefined ? { fence: order.fence } : {}),
    });
    let r: T;
    const scope = journalScope(J, rec.attempt_id, processStartTime);
    // PR 4b, bod 1: sentinel PŘED spawn (malý create-only zápis). Nejde zapsat = volání modelu neproběhne.
    const guard = new GuardSession(this.limitGuard, rec.attempt_id);
    try {
      this.limitGuard.open(rec.attempt_id);
    } catch (e) {
      const why = `sentinel varování limitu nejde zapsat, volání neproběhlo: ${String((e as Error)?.message ?? e).slice(0, 300)}`;
      try {
        J.holdAttempt(rec.attempt_id, why);
      } catch {
        // INTENT bez STARTED: reconciler doloží, že nic neběží
      }
      return { kind: "hold", reason: `pokus ${rec.attempt_id}: ${why}` };
    }
    // Varování neuloženo: sentinel zůstal na disku, blokace i v paměti; pokus do HOLD (jde-li ho zapsat).
    const holdLost = (lost: string): AttemptRun<T> => {
      try {
        J.holdAttempt(rec.attempt_id, `${LIMIT_WARNING_LOST}: ${lost}`);
      } catch {
        // ani záznam pokusu nejde zapsat: rozhoduje sentinel (globální HOLD do ručního ověření)
      }
      return { kind: "hold", reason: `pokus ${rec.attempt_id}: ${LIMIT_WARNING_LOST}` };
    };
    // PR 4b (§8.2): snímek po konci dítěte (jen když existuje snímek před). Problém = důvod HOLD.
    const remoteAfter = (): string | undefined => {
      if (!remote_before || !dept.remoteSnapshot) return undefined;
      try {
        const after = dept.remoteSnapshot(kind, order, this.ctx, since);
        const cur = after ? J.setRemoteAfter(rec.attempt_id, after) : J.get(rec.attempt_id)!;
        return dept.remoteProblem ? dept.remoteProblem(order, this.ctx, cur) : "UNKNOWN (§8.2): oddělení neumí vyhodnotit snímky";
      } catch (e) {
        return `UNKNOWN (§8.2): snímek po pokusu nejde uložit: ${String((e as Error)?.message ?? e).slice(0, 300)}`;
      }
    };
    // FIX1 nález 1: konec skupiny některého procesu kroku (nebo vnitřního volání) nedoložen → HOLD, ne FINISHED.
    const holdUnsettled = (why: string): AttemptRun<T> => {
      J.holdAttempt(rec.attempt_id, why);
      return { kind: "hold", reason: `pokus ${rec.attempt_id}: ${why}` };
    };
    try {
      r = await runInAttempt(scope, () => runWithLimitSink(guard.sink, run));
    } catch (e) {
      // Varování z adaptérů už prošla sinkem hned po návratu procesu; tady se jen rozhodne o sentinelu.
      const lost = this.closeGuard(guard, []);
      if (lost) return holdLost(lost);
      if (e instanceof GroupNotEndedError || scope.unsettled?.length)
        return holdUnsettled(
          e instanceof GroupNotEndedError
            ? String(e.message).slice(0, 400)
            : `konec skupiny procesů nedoložen: ${scope.unsettled!.join("; ")}`,
        );
      const sha = J.writeOutput(
        rec,
        JSON.stringify({ error: String((e as Error)?.message ?? e) }),
      );
      // FIX1 (PR 4b) nález 2: snímek po i tady PŘED FINISHED; problém §8.2 = pokus do HOLD.
      const remote = remoteAfter();
      if (remote) return holdUnsettled(remote);
      J.finished(rec.attempt_id, { exit: null, ok: false, output_sha256: sha });
      throw e;
    }
    // PR 4b, bod 1: PRVNÍ věc po návratu procesu: varování výsledku (malé create-only záznamy), před draftem i journalem.
    const lost = this.closeGuard(guard, r.limit_warnings ?? []);
    if (lost) return holdLost(lost);
    if (scope.unsettled?.length)
      return holdUnsettled(
        `konec skupiny procesů nedoložen: ${scope.unsettled.join("; ")}`,
      );
    const out: AttemptOutput<T> = { outcome: r };
    if (r.ok && r.draft_file && r.draft_file !== "wt") {
      // FIX1 nález 4: draft (skutečný výstup kroku) se uloží trvale PŘED FINISHED: celé bajty + fsync souboru +
      // atomický rename + fsync adresáře (writeDurable z PR 1). Bez toho by pád OS po FINISHED mohl draft ztratit.
      // FIX2 nález 2: jakákoli chyba čtení, trvalého zápisu nebo hashe = pokus FINISHED ok:false a throw, nikdy
      // FINISHED ok:true bez trvalého draftu a jeho draft_sha256 (žádné potlačení chyby).
      // PR 4b: varování jsou v té chvíli už uložená (runs/limit-guard), tato cesta je neztratí.
      try {
        const text = this.d.store.readFile(order.id, r.draft_file);
        writeDurable(
          path.join(this.d.store.orderDir(order.id), r.draft_file),
          text,
        );
        out.draft_sha256 = sha256(text);
      } catch (e) {
        const why = `draft ${r.draft_file} nejde přečíst nebo uložit trvale: ${String((e as Error)?.message ?? e).slice(0, 300)}`;
        J.finished(rec.attempt_id, { exit: null, ok: false, output_sha256: J.writeOutput(rec, JSON.stringify({ error: why })) });
        throw new Error(why);
      }
    }
    const sha = J.writeOutput(rec, JSON.stringify(out));
    // FIX1 (PR 4b) nález 2: snímek po se uloží PŘED FINISHED. Problém §8.2 = pokus do HOLD (nikdy FINISHED ok:true,
    // ze kterého by po restartu šlo RESUME); pád mezi snímkem a FINISHED nechá pokus neukončený = reconciler.
    const remote = remoteAfter();
    if (remote) return holdUnsettled(remote);
    J.finished(rec.attempt_id, { exit: r.ok ? 0 : 1, ok: r.ok, output_sha256: sha });
    return { kind: "run", r, resumed: false };
  }

  /**
   * FIX4: před opakováním kroku (reconcile RETRY_SAFE) musí být stav varování limitu z předchozího pokusu doložen.
   * FINISHED: varování z uloženého výsledku se zapíší znovu (zápis mohl po FINISHED selhat). Pokus bez FINISHED
   * (ABANDONED, i z HOLD LIMIT_WARNING_LOST): varování mohlo přijít a ztratit se → zapíše se nedoložená blokace
   * na `pauseMinutes` (fail-closed). Zápis selže → důvod čekat (bez RETRY_SAFE; zakázka zůstane rozpracovaná).
   */
  private limitStateBeforeRetry(
    order: Order,
    kind: StepKind,
    prev: ReturnType<AttemptJournal["get"]> & object,
  ): string | undefined {
    const role = kind === "check" ? "checker" : "creator";
    let r: StepOutcome | undefined;
    if (prev.phase === "FINISHED") {
      try {
        const o = JSON.parse(
          this.attempts.readOutput(prev) ?? "null",
        ) as AttemptOutput<StepOutcome> | null;
        r = o?.outcome?.limit_warnings?.length ? o.outcome : undefined;
      } catch {
        r = undefined;
      }
    } else {
      r = {
        ok: false,
        limit_warnings: [
          {
            source: "neověřeno",
            text: `pokus ${prev.attempt_id} skončil bez FINISHED: varování limitu neověřeno`,
            received_at: this.iso(),
          },
        ],
      };
    }
    if (!r) return undefined;
    try {
      this.writeLimitWarning(order, r, role);
      return undefined;
    } catch (e) {
      return `${LIMIT_WARNING_LOST}, opakování odloženo: ${String((e as Error)?.message ?? e).slice(0, 300)}`;
    }
  }

  /** RESUME: výstup FINISHED se shodným sha256 a (u draftu) soubor draftu se stejným obsahem. Jinak undefined. */
  private resumeOutput<T extends { draft_file?: string }>(
    order: Order,
    rec: ReturnType<AttemptJournal["get"]> & object,
  ): T | undefined {
    const text = this.attempts.readOutput(rec);
    if (!text) return undefined;
    try {
      const o = JSON.parse(text) as AttemptOutput<T>;
      if (!o || typeof o !== "object" || !o.outcome) return undefined;
      const f = o.outcome.draft_file;
      if (f && f !== "wt") {
        if (!o.draft_sha256) return undefined;
        if (sha256(this.d.store.readFile(order.id, f)) !== o.draft_sha256)
          return undefined;
      }
      return o.outcome;
    } catch {
      return undefined;
    }
  }

  /** Pokus nejde spustit: běží na pozadí (tick končí, stav beze změny), nebo HOLD (UNKNOWN s důvodem). */
  private attemptBlocked(
    order: Order,
    a: { kind: "hold" | "wait"; reason: string },
  ): Order {
    if (a.kind === "wait") {
      this.attemptWaiting = true;
      this.log({
        order: order.id,
        kind: "info",
        role: "orchestrator",
        result: "waiting_background",
        reason: a.reason,
      });
      return order;
    }
    return this.apply(
      order,
      { type: "unknown", reason: `HOLD: ${a.reason}`.slice(0, 500) },
      { role: "orchestrator", result: "HOLD (pokus)", reason: a.reason },
    );
  }

  /**
   * Etapa 4 / PR 4a (§6.2.1): hned po create/revise, před kontrolou, jedno neměnné finální tělo
   * `final-body-r<n>.md` (writeDurable, zapíše se jen jednou). Do stavu jde jeho otisk (artifactHash).
   */
  private finalBodyMeta(
    o: Order,
    dept: DepartmentRunner,
  ): { meta?: Record<string, string>; hold?: string } {
    if (!dept.finalBody || !o.draft_file) return {};
    const body = dept.finalBody(o, this.ctx);
    const file = `final-body-r${o.fix_rounds}.md`;
    const p = path.join(this.d.store.orderDir(o.id), file);
    if (fs.existsSync(p)) {
      if (fs.readFileSync(p, "utf8") !== body)
        return {
          hold: `BODY_MISMATCH: ${file} už existuje s jiným obsahem (nepřepisuje se)`,
        };
    } else writeDurable(p, body);
    return {
      meta: { final_body_file: file, final_body_sha256: artifactHash(body) },
    };
  }

  /** Common handling of a model step outcome: review unavailable → WAITING_REVIEW, limit → PAUSED, error → FAILED. */
  private bad(
    order: Order,
    r: StepOutcome,
    role: LogEntry["role"],
  ): Order | undefined {
    this.noteLimitWarning(order, r, role);
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
      const { resume_after, meta } = this.resumeAfterLimit(r);
      // Údaje o resetu z dřívější pauzy se nepřenášejí: platí jen doklad z této hlášky.
      const kept = Object.fromEntries(
        Object.entries(order.meta).filter(([k]) => !k.startsWith("reset_")),
      );
      return this.apply(
        { ...order, meta: { ...kept, ...meta } },
        { type: "limit", resume_after },
        {
          role,
          model: r.model,
          reason: r.error,
          result: `reset: ${meta.reset_source}`,
        },
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

  /**
   * Etapa 4 PR 1 (§10.2 Q4-A, §10.3): `resume_after` po limitu. Doložený reset z hlášky → reset + 1 min.
   * Nedoloženo → dnešní `pauseMinutes` od teď a `meta.reset_source = "nedoloženo"`.
   */
  private resumeAfterLimit(r: StepOutcome): {
    resume_after: string;
    meta: Record<string, string>;
  } {
    const now = this.now();
    // PR 4c (DR-027 §6): neověřená verze CLI = tvar hlášky neověřený → nedoloženo, nikdy odhad.
    if (r.reset_unverified)
      return {
        resume_after: new Date(now.getTime() + (this.d.pauseMinutes ?? 60) * 60_000).toISOString(),
        meta: { reset_source: "nedoloženo", reset_reason: r.reset_unverified.slice(0, 200) },
      };
    // FIX1 nález 1: čas resetu jen z hlášky strukturované obálky CLI (limit_text), nikdy z `error` (text modelu/stdout).
    const text = r.limit_text ?? "";
    const p = parseReset(
      text,
      r.received_at ?? now.toISOString(),
      this.d.resetTz ?? "Europe/Prague",
    );
    if (p.ok) {
      const resume = new Date(Date.parse(p.at_utc) + RESET_MARGIN_MS);
      if (resume > now)
        return {
          resume_after: resume.toISOString(),
          meta: {
            reset_source: p.source,
            reset_at_utc: p.at_utc,
            reset_at_local: p.at_local,
            ...(p.raw_zone ? { reset_raw_zone: p.raw_zone } : {}),
            reset_evidence: p.evidence_hash,
          },
        };
    }
    return {
      resume_after: new Date(
        now.getTime() + (this.d.pauseMinutes ?? 60) * 60_000,
      ).toISOString(),
      meta: {
        reset_source: "nedoloženo",
        reset_reason: (p.ok ? "reset + 1 min už uplynul" : p.reason).slice(
          0,
          200,
        ),
        reset_evidence: p.evidence_hash,
      },
    };
  }

  /**
   * Q4-B: doložená varování CLI o blížícím se limitu se zapíší trvale do runs/limit-warning.json (jen pod lease ticku).
   * Každé platí do doloženého resetu z varování + 1 min, jinak `pauseMinutes` od přijetí. FIX1 nález 6: záznam vede
   * blokace po zdrojích (claude / codex / …). Nevypršenou blokaci zdroje nové varování jiného zdroje nepřepíše a
   * varování téhož zdroje ji nezkrátí: platí nejpozdější `until` každého zdroje. Tick do nejpozdějšího `until` ze všech
   * zdrojů nezačne novou zakázku; rozpracovaná zakázka pokračuje.
   */
  private noteLimitWarning(
    order: Order,
    r: StepOutcome,
    role: LogEntry["role"],
  ): void {
    try {
      this.writeLimitWarning(order, r, role);
    } catch (e) {
      // PR 4b, bod 1: autorita jsou malé záznamy runs/limit-guard. Varování uložená tam = selhání souhrnu je jen log.
      // Varování bez záznamu (volání mimo hlídanou cestu) = globální HOLD v paměti a sentinel při nejbližší možnosti.
      const why = `limit-warning.json nejde zapsat: ${String((e as Error)?.message ?? e).slice(0, 300)}`;
      const notes = r.limit_warnings ?? [];
      if (notes.every((n) => this.guardSaved.has(`${n.source}|${n.text}`)))
        this.log({ order: order.id, kind: "error", role, result: "souhrn varování neuložen (záznamy v runs/limit-guard platí)", reason: why });
      else this.raiseLimitHold(`${order.id}: ${why}`, false);
    }
  }

  private writeLimitWarning(
    order: Order,
    r: StepOutcome,
    role: LogEntry["role"],
  ): void {
    const notes = r.limit_warnings ?? [];
    if (!notes.length) return;
    if (!this.d.store.holdsLease()) return;
    const now = this.now();
    const sources = this.liveWarningSources(now.getTime());
    for (const n of notes) {
      const received = n.received_at ?? now.toISOString();
      const p = parseReset(n.text, received, this.d.resetTz ?? "Europe/Prague");
      const until = p.ok
        ? new Date(Date.parse(p.at_utc) + RESET_MARGIN_MS)
        : new Date(Date.parse(received) + (this.d.pauseMinutes ?? 60) * 60_000);
      const rec: WarningRecord = {
        observed_at: now.toISOString(),
        received_at: received,
        order: order.id,
        role,
        model: n.model ?? r.model,
        source: n.source,
        until: until.toISOString(),
        reset_source: p.ok ? p.source : "nedoloženo",
        evidence_hash: createHash("sha256").update(n.text).digest("hex"),
        excerpt: n.text.slice(0, 300),
      };
      const prev = sources[n.source];
      if (!prev || Date.parse(prev.until) < until.getTime())
        sources[n.source] = rec;
      this.log({
        order: order.id,
        kind: "info",
        role,
        model: n.model ?? r.model,
        result: `varování CLI (${n.source}) o blížícím se limitu, nová zakázka nezačne do ${sources[n.source].until}`,
        reason: rec.excerpt as string,
      });
    }
    const latest = Math.max(
      ...Object.values(sources).map((s) => Date.parse(s.until)),
    );
    this.d.store.writeRunsFile(
      LIMIT_WARNING_FILE,
      JSON.stringify(
        redactDeep({ v: 2, until: new Date(latest).toISOString(), sources }),
        null,
        2,
      ) + "\n",
    );
  }

  /**
   * Nevypršené blokace Q4-B po zdrojích z runs/limit-warning.json. Starý formát (jeden záznam s `until`) = zdroj
   * "legacy". Nečitelný soubor nebo položka platí `pauseMinutes` od zápisu souboru (fail-closed, ne trvale).
   */
  private liveWarningSources(nowMs: number): Record<string, WarningRecord> {
    const f = this.d.store.readRunsFile(LIMIT_WARNING_FILE);
    if (!f) return {};
    const fallback = f.mtimeMs + (this.d.pauseMinutes ?? 60) * 60_000;
    const unreadable = (): WarningRecord => ({
      until: new Date(fallback).toISOString(),
      reset_source: "nedoloženo",
      reason: "nečitelný záznam varování",
    });
    let j: unknown;
    try {
      j = JSON.parse(f.text);
    } catch {
      j = undefined;
    }
    if (!j || typeof j !== "object")
      return fallback > nowMs ? { nečitelný: unreadable() } : {};
    const o = j as { sources?: unknown };
    const raw =
      o.sources && typeof o.sources === "object"
        ? (o.sources as Record<string, unknown>)
        : { legacy: j };
    const out: Record<string, WarningRecord> = {};
    for (const [k, v] of Object.entries(raw)) {
      const u = Date.parse(String((v as { until?: unknown })?.until ?? ""));
      if (!Number.isFinite(u)) {
        if (fallback > nowMs) out[k] = unreadable();
      } else if (u > nowMs) out[k] = v as WarningRecord;
    }
    return out;
  }

  /**
   * Q4-B: ISO nejpozdějšího `until` platných blokací ze všech zdrojů, jinak undefined. PR 4b: i z malých záznamů
   * runs/limit-guard (uložených hned po návratu procesu, nezávisle na limit-warning.json).
   */
  private activeLimitWarning(): string | undefined {
    const nowMs = this.now().getTime();
    const live = [
      ...Object.values(this.liveWarningSources(nowMs)),
      ...Object.values(this.limitGuard.live(nowMs)),
    ];
    if (!live.length) return undefined;
    return new Date(
      Math.max(...live.map((s) => Date.parse(s.until))),
    ).toISOString();
  }

  async step(order: Order): Promise<Order> {
    const dept = order.brief
      ? this.d.departments[order.brief.department]
      : undefined;
    // Etapa 4 PR 5: zakázka wo-r* nikdy nespustí supervizora; NEW → PLANNED jen přes claim (inboxBeforeStep).
    if (orderClass(order) !== "legacy" && order.state === "NEW") return order;
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
            // PR 4b, bod 1: hlídané volání (sentinel před, varování hned po návratu procesu).
            const sg = await this.guarded(
              `${order.id}/supervisor/a${attempt}/${this.now().getTime()}`,
              () =>
                this.d.supervisor.run(prompt, {
                  cwd: this.d.store.orderDir(order.id),
                }),
              (x) => warningsOf(x, this.d.supervisor.model),
            );
            if (sg.lost) return order;
            const r = sg.v;
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
            const supOutcome: StepOutcome = {
              ok: r.ok,
              limit: r.limit,
              error: r.error,
              model: this.d.supervisor.model,
              received_at: r.received_at,
              limit_text: r.limit_text,
              reset_unverified: r.reset_unverified,
              limit_warnings: warningsOf(r, this.d.supervisor.model),
            };
            if (!r.ok) return this.bad(order, supOutcome, "supervisor")!;
            this.noteLimitWarning(order, supOutcome, "supervisor");
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
          const cg = await this.guarded(
            `${order.id}/brief-check/a${attempt}/${this.now().getTime()}`,
            () =>
              callChecker(
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
              ),
            (x) => warningsOf(x.r, this.d.briefChecker.model),
          );
          if (cg.lost) return order;
          const { r: c, v, findings: cFindings } = cg.v;
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
          const chkOutcome: StepOutcome = {
            ok: c.ok,
            limit: c.limit,
            error: c.error,
            model: this.d.briefChecker.model,
            received_at: c.received_at,
            limit_text: c.limit_text,
            reset_unverified: c.reset_unverified,
            limit_warnings: warningsOf(c, this.d.briefChecker.model),
          };
          if (!c.ok) return this.bad(order, chkOutcome, "checker")!;
          this.noteLimitWarning(order, chkOutcome, "checker");
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
        const a = await this.attemptStep(order, dept!, "create", () =>
          dept!.create(order, this.ctx),
        );
        if (a.kind !== "run") return this.attemptBlocked(order, a);
        const r = a.r;
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
        // FIX1 (PR 4b) nález 3: hranici dítěte nejde zaručit (konfigurace gitu) = HOLD, ne chyba tvůrce.
        if (r.hold) return this.attemptBlocked(order, { kind: "hold", reason: r.hold });
        const b = this.bad(order, r, "creator");
        if (b) return b;
        const created = {
          ...order,
          draft_file: r.draft_file,
          meta: { ...order.meta, ...(r.meta ?? {}) },
        };
        const fb = this.finalBodyMeta(created, dept!);
        if (fb.hold)
          return this.attemptBlocked(order, { kind: "hold", reason: fb.hold });
        return this.apply(
          { ...created, meta: { ...created.meta, ...(fb.meta ?? {}) } },
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
        const a = await this.attemptStep(order, dept!, "check", () =>
          dept!.check(order, this.ctx),
        );
        if (a.kind !== "run") return this.attemptBlocked(order, a);
        const r = a.r;
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
        // PR 4a: DIFF_TOO_LARGE, BODY_MISMATCH, nečitelná báze → HOLD, nikdy PASS ani tiché selhání.
        if (r.hold)
          return this.attemptBlocked(order, { kind: "hold", reason: r.hold });
        const b = this.bad(order, r, "checker");
        if (b) return b;
        // §6.2.3: platí jen receipt, na který odkazuje state.json (zápis přes Store.save s CAS).
        const receipted = r.review_receipt
          ? {
              ...order,
              meta: {
                ...order.meta,
                review_receipt_id: r.review_receipt.review_id,
                review_receipt_sha256: r.review_receipt.sha256,
              },
            }
          : order;
        // Dodatek PR 5 (DR-030): model kontroly tohoto kroku (Codex s intenzitou) i do pole „Kontrolor (model)“.
        const checked =
          !r.deterministic && r.model && r.model !== dept!.checkerModel()
            ? {
                ...receipted,
                meta: { ...receipted.meta, checker_model: r.model },
              }
            : receipted;
        return this.apply(
          checked,
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
        const a = await this.attemptStep(order, dept!, "revise", () =>
          dept!.revise(order, this.ctx),
        );
        if (a.kind !== "run") return this.attemptBlocked(order, a);
        const r = a.r;
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
        // FIX1 (PR 4b) nález 3: hranici dítěte nejde zaručit (konfigurace gitu) = HOLD, ne chyba tvůrce.
        if (r.hold) return this.attemptBlocked(order, { kind: "hold", reason: r.hold });
        const b = this.bad(order, r, "creator");
        if (b) return b;
        const revised = {
          ...order,
          draft_file: r.draft_file ?? order.draft_file,
          meta: {
            ...order.meta,
            ...((r as { meta?: Record<string, string> }).meta ?? {}),
          },
        };
        const fb = this.finalBodyMeta(revised, dept!);
        if (fb.hold)
          return this.attemptBlocked(order, { kind: "hold", reason: fb.hold });
        return this.apply(
          { ...revised, meta: { ...revised.meta, ...(fb.meta ?? {}) } },
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
          // Etapa 4 / PR 4a (§6.2.1 bod 5): finální tělo se odešle jen tehdy, když jeho soubor sedí se stavem a s receiptem
          // PASS nad přesně tímto tělem. Jinak HOLD (BODY_MISMATCH) a žádný zápis do Notionu.
          if (finalBodyRef(o)) {
            const problem = finalBodyProblem(o, this.d.store);
            if (problem)
              return this.attemptBlocked(o, { kind: "hold", reason: problem });
          }
          // Etapa 4 / PR 4b (§6.2.3, §6.2.2 bod 6, třída B): brána review receiptu a pokrytí diffu před gh-push a
          // gh-draft-pr. Jakýkoli nesoulad = HOLD, 0 push, 0 PR (journal efektu se vůbec nezaloží).
          if (dept!.effectGate) {
            const gate = dept!.effectGate(o, this.ctx);
            if (gate)
              return this.attemptBlocked(o, { kind: "hold", reason: gate });
          }
          // Etapa 4 PR 5 (§6.1, §6.4, N13, N14): brána efektu těsně před EffectJournal.prepare: allowlist podle třídy
          // zakázky, review receipt nad tímto artefaktem, čerstvá revalidace vyžadovaných receiptů (wo-r*: scope GO),
          // legacy brána a u notion-draft soukromý cíl (`public_url === null`). Nesoulad = HOLD, 0 efekt.
          const effCtx: EffectCtx = {
            ...this.gateCtx(o, dept!, [...EFFECT_PLAN[this.effectDept(o, dept)]]),
            step: "deliver",
            draftParentId: this.d.draftParentId,
          };
          const gateRes = await this.gate.beforeEffect(o, effCtx);
          if (!gateRes.ok) return this.gateBlocked(o, gateRes);
          // §9: konfliktní zdroj efektu (rodičovská stránka DRAFTu / repo-git); obsazený nebo nejistý = žádný efekt teď.
          const resource =
            this.effectDept(o, dept) === "dev"
              ? "repo-git"
              : `notion-effect:${normPage(this.d.draftParentId)}`;
          const lock = this.locks.acquire(resource, this.d.store.fence ?? 0);
          if (!lock.ok) {
            this.gateWaiting = true;
            this.logOnce({
              order: o.id,
              kind: "info",
              role: "orchestrator",
              result: `zdroj ${resource} ${lock.reason === "HELD" ? "drží jiný proces" : "nejde ověřit"}, efekt se nespouští`,
            });
            return this.current(o.id);
          }
          // Etapa 3: the delivery is journaled (PREPARED → write → receipt); after a crash it is looked up by its marker.
          const del = o;
          let run: EffectRun;
          try {
            run = await this.runEffect(
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
                  // PR 5 FIX1 (5-K1-3): oddělení s víc kroky (push, draft PR) revaliduje bránu před každým z nich.
                  const recheck = async (): Promise<string | undefined> => {
                    const g = await this.gate.recheck(del, effCtx);
                    return g.ok ? undefined : `${g.code}: ${g.detail}`;
                  };
                  r = await dept!.deliver(del, { ...this.ctx, recheck }, effectTag(op));
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
                  throw new DeliverFailure(
                    r,
                    absent || Boolean(r.effect_absent),
                  );
                // DR-039: the hash of the artifact exactly as sent is stored in the same write as its URL.
                return {
                  url: r.url!,
                  content_hash:
                    r.content !== undefined
                      ? artifactHash(r.content)
                      : undefined,
                };
              },
            );
          } finally {
            lock.release();
          }
          if (run.kind === "done") this.gate.afterEffect(o, "deliver", run.url);
          if (run.kind === "stale") return this.current(o.id);
          if (run.kind === "hold") return this.hold(o, run.op, run.reason);
          if (run.kind === "failed") {
            const e = run.error;
            // PR 4b: brána uvnitř deliver (před push nebo před draft PR) = HOLD, ne FAIL.
            if (e instanceof DeliverFailure && e.outcome.hold)
              return this.attemptBlocked(o, { kind: "hold", reason: e.outcome.hold });
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
            ? [
                "výstup je PR do main — merge dělá TARS po GO vlastníka na kartě (DR-024)",
              ]
            : []),
          ...o.brief!.owner_decisions,
          ...reservedDecisionHits(`${o.brief!.title}\n${o.brief!.goal}`).map(
            (k) => `zadání se dotýká: ${k}`,
          ),
        ];
        let ownerNeeded = reasons.length > 0;
        let readbackMeta: Record<string, string> | undefined;
        if (!ownerNeeded) {
          // Etapa 4 PR 2 (NAVRH-v6 §6.1, `readbackBlocker`): DONE bez vlastníka jen po čerstvém read-backu, jehož otisk
          // se rovná otisku odeslaného obsahu (`delivered_hash`). Selhané čtení = zůstává DELIVERED, další tick zkusí
          // znovu. Jiný otisk nebo chybějící `delivered_hash` (např. doručení obnovené po pádu) = nikdy DONE a nikdy
          // „skoro shoda“: zakázka jde na kartu vlastníka (GO vázané na otisk read-backu, DR-039), ne do tichého DONE.
          let seen: string;
          try {
            seen = artifactHash(await this.readArtifact(o));
          } catch (e) {
            this.logOnce({
              order: o.id,
              kind: "info",
              role: "transport",
              result: "DONE odloženo: read-back doručeného obsahu selhal",
              reason: String((e as Error)?.message ?? e).slice(0, 200),
            });
            return this.current(o.id);
          }
          const rb = JSON.stringify({
            url: o.delivered_url,
            hash: seen,
            verified_at: this.iso(),
          });
          const blocker = readbackBlocker({
            ...o,
            meta: { ...o.meta, readback: rb },
          });
          // Etapa 4 PR 5 (§6.2.1 bod 7): u wo-r* neshoda read-backu = HOLD READBACK_MISMATCH, nikdy karta ani DONE.
          if (blocker && orderClass(o) !== "legacy")
            return this.gateBlocked(o, {
              ok: false,
              code: "READBACK_MISMATCH",
              detail: blocker,
            });
          if (!blocker) {
            // §6.1: read-back proti identitě artefaktu brány (content: otisk finálního těla); záznam brány DONE / HOLD.
            const v = this.gate.verify(o, "deliver", seen);
            if (!v.ok && orderClass(o) !== "legacy")
              return this.gateBlocked(o, v);
            // §6.4: DONE bez vlastníka (Q9-A) jen se čerstvou revalidací scope (wo-r*) a review receiptem (oba druhy).
            const t = await this.gate.beforeTransition(
              o,
              this.gateCtx(o, dept!, ["done"], false),
            );
            if (!t.ok) return this.gateBlocked(o, t);
          }
          if (blocker) {
            this.log({
              order: o.id,
              kind: "error",
              role: "orchestrator",
              result:
                "READBACK_MISMATCH: DONE bez vlastníka zamítnuto, přijetí rozhodne vlastník na kartě",
              reason: blocker,
            });
            reasons.push(
              `read-back nesedí s odeslaným obsahem (${blocker}) — DONE bez vlastníka zamítnuto (READBACK_MISMATCH)`,
            );
            ownerNeeded = true;
          } else readbackMeta = { readback: rb };
        }
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
          // Etapa 4 PR 5 (§6.4 karta výsledku): wo-r* jen se čerstvou revalidací scope GO a s review receiptem; legacy
          // s review receiptem. U wo-r* (content) musí read-back sedět s finálním tělem, jinak HOLD (§6.2.1 bod 7).
          if (
            orderClass(o) !== "legacy" &&
            artifactKindOf(this.effectDept(o, dept)) === "content"
          ) {
            const v = this.gate.verify(o, "deliver", seen);
            if (!v.ok) return this.gateBlocked(o, v);
          }
          const cardGate = await this.gate.beforeTransition(
            o,
            this.gateCtx(o, dept!, ["owner-card"], true),
          );
          if (!cardGate.ok) return this.gateBlocked(o, cardGate);
          const gateOrder = o;
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
              // PR 5 FIX1 (5-K1-4): čekání na model (data karty) může trvat minuty: GO se revaliduje těsně před POST.
              const again = await this.gate.beforeTransition(
                gateOrder,
                this.gateCtx(gateOrder, dept!, ["owner-card"], true),
              );
              if (!again.ok) throw new GateHoldError(again);
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
            if (e instanceof GateHoldError) return this.gateBlocked(gateOrder, e.res);
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
        // Read-back ověřený výše (jen cesta bez vlastníka): zapíše se ve stejném zápisu jako přechod do DONE.
        if (readbackMeta) o = { ...o, meta: { ...o.meta, ...readbackMeta } };
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
      // FIX1 (PR 4b) nález 6: volání modelu karty jako hlídané volání (sentinel před, varování hned do sinku).
      // Sentinel nejde zapsat = throw = sekce vynechána, volání neproběhne.
      const { v: data } = await this.guarded(
        `${o.id}/card-data/${this.now().getTime()}`,
        () =>
          buildCardData(o, draft, o.delivered_url, {
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
          }),
        () => [],
      );
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

  /**
   * Manual abort by a human — counted as a manual intervention. PR 5 FIX1 (5-K1-5): z WAITING_OWNER jen migrační
   * cesta legacy zakázky, kterou brána drží v HOLD `LEGACY_GATE` (bez review receiptu nebo finálního těla); HOLD se
   * zapíše do logu. Jinak o zakázce ve WAITING_OWNER rozhoduje jen vlastník (`owner GO|REJECT`).
   */
  abort(id: string, reason: string): Order {
    return this.d.store.withStateLock(() => {
      const o = this.d.store.load(id);
      let legacyGate = false;
      if (o.state === "WAITING_OWNER") {
        const ls =
          orderClass(o) === "legacy" && o.brief
            ? legacyStatus(o, this.effectDept(o))
            : undefined;
        if (ls?.state !== "HOLD")
          throw new TransitionError(
            `abort z WAITING_OWNER jen pro legacy zakázku v HOLD LEGACY_GATE; o zakázce ${id} rozhoduje vlastník (owner GO|REJECT)`,
          );
        this.log({
          order: id,
          kind: "error",
          role: "orchestrator",
          result: "HOLD LEGACY_GATE: migrační abort z WAITING_OWNER",
          reason: ls.detail,
        });
        legacyGate = true;
      }
      const counted = {
        ...o,
        manual_interventions: o.manual_interventions + 1,
      };
      return this.apply(
        counted,
        {
          type: "fail",
          reason: `manual abort: ${reason}`,
          ...(legacyGate ? { legacy_gate: true } : {}),
        },
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
