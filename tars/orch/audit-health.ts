// Etapa 5 (P0-a): read-only health projection of TARS. No runtime authority.
//
// Two layers:
//   collectSnapshot(runsDir) — reads ONLY local files (runs/<id>/state.json, runs/<id>/effects/*.json, runs/log.jsonl,
//                              runs/panel-index.json, runs/browser-status.json) and the launchd job description
//                              (`launchctl print`, read-only). It never creates, writes, renames or locks anything.
//   auditHealth(snapshot, now) — pure projection of that snapshot. No I/O, no model, no network.
//
// Imports: only types and pure functions (redactSecrets). Nothing from the orchestrator runtime (Store, Orchestrator,
// Notion, panel sinks), so the projection cannot take a lock, write a state or touch the panel.
// Missing data is reported as UNKNOWN / NOT_MEASURED, never as a pass.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { EffectRecord } from "./effects";
import {
  collectLive,
  manualFromLog,
  manualLineOf,
  projectLive,
  type HolderProbe,
  type LiveSnapshot,
  type ManualLine,
} from "./health-live";
import { redactSecrets, redactSecretsUnbounded } from "./secret-scan";
import { STATES, type LogEntry, type Order } from "./types";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;
const time = (v: unknown): number =>
  typeof v === "string" ? Date.parse(v) : NaN;
/** Age of a timestamp; null when missing, unparsable or in the future (a future clock never counts as fresh). */
const age = (v: unknown, now: number): number | null => {
  const n = time(v);
  return Number.isFinite(n) && n <= now ? now - n : null;
};
/** Free text from state/log goes out shortened and redacted; unknown fields are never echoed.
 *  Redaction without word boundaries: a token glued to other characters (e.g. "x_ghp_…") is still hidden. */
const text = (v: unknown, max = 200): string | undefined => {
  const s = str(v);
  return s
    ? redactSecretsUnbounded(s.replace(/\s+/g, " ").trim()).slice(0, max)
    : undefined;
};
/** A raw string from data (timestamps of log lines) goes out only redacted; null stays null. */
const safe = (v: string | null): string | null =>
  v === null ? null : redactSecretsUnbounded(v);

/** Default launchd StartInterval of work.good-inventions.tars-orch (plist). */
export const TICK_INTERVAL_S = 1800;
export const LAUNCHD_LABEL = "work.good-inventions.tars-orch";

/** Order states the projection knows: runtime STATES plus SUPERSEDED (written by hand into old orders). */
const KNOWN_STATES = new Set<string>([...STATES, "SUPERSEDED"]);

/** Order id pattern (wo-…): no path, no whitespace, no control characters, bounded length. */
const ORDER_ID_RE = /^wo-[A-Za-z0-9_-]{1,100}$/;
export const INVALID_ID = "<neplatné id>";
export const INVALID_STATE = "<neplatný stav>";
/** An id goes out only when it matches the order id pattern, and even then redacted (without word boundaries:
 *  "wo-copy_ghp_…" passes the pattern, and "_" before the token would defeat a \b-anchored pattern). */
const orderId = (v: unknown): string =>
  typeof v === "string" && ORDER_ID_RE.test(v)
    ? redactSecretsUnbounded(v)
    : INVALID_ID;

/** Effect journal states of the runtime (effects.ts EffectState). Anything else = unreadable journal record. */
const EFFECT_STATES = new Set<string>([
  "PREPARED",
  "EFFECT_DONE",
  "EFFECT_ABSENT",
  "EFFECT_UNKNOWN",
]);

/** Effect gate states of the runtime (effect-gate.ts GateState). Anything else = unreadable gate record. */
const GATE_STATES = new Set<string>([
  "READY",
  "EFFECT_PREPARED",
  "VERIFYING",
  "DONE",
  "HOLD",
]);

/** Blocking states shown with reason and age. HOLD comes from the effect journal, not from the order state. */
export type BlockKind =
  | "WAITING_OWNER"
  | "WAITING_REVIEW"
  | "HOLD"
  | "PAUSED"
  | "UNKNOWN"
  | "FAILED";

// ---------------------------------------------------------------------------------------------------------------
// Snapshot (input of the pure projection). Every field is optional: absence = not measured.
// ---------------------------------------------------------------------------------------------------------------

export interface SnapshotEffect {
  operation_id?: string;
  state?: string;
  reason?: string;
  updated_at?: string;
  /** EFFECT_DONE only: the record carries a receipt with a URL (the URL itself is not copied). */
  has_receipt?: boolean;
}

export interface SnapshotOrder extends Partial<
  Pick<
    Order,
    | "id"
    | "state"
    | "updated_at"
    | "history"
    | "resume_after"
    | "paused_from"
    | "review_from"
    | "review_reason"
    | "failure_reason"
    | "owner_reasons"
    | "manual_interventions"
    | "meta"
  >
> {
  effects?: SnapshotEffect[];
  /** effects/ exists but a record could not be read: HOLD state of the order is UNKNOWN. */
  effects_unreadable?: number;
  /** effect gate records runs/<wo>/gate/*.json (etapa 4 PR 5): only the state, the HOLD code and the last time */
  gates?: { state?: string; hold?: string; at?: string }[];
  /** gate/ exists but a record could not be read */
  gates_unreadable?: number;
  /** runs/wo-… exists but has no state.json: the order is incomplete, its state UNKNOWN */
  missing_state?: boolean;
  /** last log line of this order (result), for the reason of a block */
  last_log?: { ts?: string; result?: string };
  panel?: {
    row: boolean;
    uncertain: boolean;
    tainted: boolean;
    dirty: boolean;
  };
}

export interface HealthSnapshot {
  observed_at?: string;
  /** false = runs directory does not exist or cannot be listed */
  runs_readable?: boolean;
  orders?: unknown[];
  /** state.json files that exist but could not be parsed */
  unreadable_orders?: string[];
  log?: {
    readable?: boolean;
    mtime?: string;
    /** timestamps of guard lines (order "-"): the first thing every real tick writes */
    ticks?: string[];
    ticks_alarm?: number;
    /** every guard line (ts, result) in write order; the projection picks the last one not in the future */
    guards?: { ts?: string; result?: string }[];
    /** positionally last guard line; used only when `guards` is absent */
    last_guard?: { ts?: string; result?: string };
    bad_lines?: number;
    /** unparsable lines at or after the first guard line (inside the measured tick window) */
    bad_lines_in_window?: number;
    /** unparsable lines after the positionally last guard line (a newer guard result may be among them) */
    bad_lines_after_last_guard?: number;
    /** lines relevant for manual interventions (transitions, owner decisions, gpt-retry), bounded fields */
    manual?: ManualLine[];
  };
  /** PR 2a: tick lease, tick end record, wake gate, dispatch mode (health-live.ts) */
  live?: LiveSnapshot;
  launchd?: {
    readable?: boolean;
    state?: string;
    runs?: number;
    last_exit_code?: number;
    interval_s?: number;
  };
  panel_index?: { readable?: boolean; rows?: number };
  browser?: { ok?: unknown; checked_at?: unknown };
}

// ---------------------------------------------------------------------------------------------------------------
// Pure projection
// ---------------------------------------------------------------------------------------------------------------

export interface BlockedOrder {
  id: string;
  kind: BlockKind;
  /** order state (for HOLD the state of the order that has an EFFECT_UNKNOWN operation) */
  state: string;
  reason: string;
  /** since when the order is in this situation; null = UNKNOWN */
  since: string | null;
  ageMs: number | null;
  /** PAUSED only: documented reset (resume_after) and whether it is already due */
  resumeAfter?: string | null;
  resumeDue?: boolean | null;
  panel?: string;
}

export interface TickGap {
  from: string;
  /** null = the gap still lasts (no tick since `from`) */
  to: string | null;
  durationMs: number;
}

export function auditHealth(
  input: unknown,
  now: number,
  staleMs = 3_600_000,
  intervalS = TICK_INTERVAL_S,
) {
  if (!Number.isFinite(now) || !Number.isFinite(staleMs) || staleMs <= 0)
    throw new Error("invalid clock or threshold");
  if (!Number.isFinite(intervalS) || intervalS <= 0)
    throw new Error("invalid tick interval");
  const s = obj(input);
  const observedAgeMs = age(s.observed_at, now);
  const snapshotStatus =
    observedAgeMs === null
      ? "UNKNOWN"
      : observedAgeMs > staleMs
        ? "STALE"
        : "RECENT_SNAPSHOT";
  const log = obj(s.log),
    browser = obj(s.browser),
    launchd = obj(s.launchd),
    panelIndex = obj(s.panel_index);
  const logAgeMs = age(log.mtime, now);
  const browserAgeMs = age(browser.checked_at, now);

  // --- orders ---
  const orders = Array.isArray(s.orders) ? s.orders : [];
  const unreadable = Array.isArray(s.unreadable_orders)
    ? s.unreadable_orders.length
    : 0;
  const counts: Record<string, number> = {};
  let waitingOwner = 0,
    duePause = 0,
    pauseResetUnknown = 0,
    malformedOrders = 0,
    missingState = 0,
    manualTotal = 0,
    manualUnknown = 0;
  const manualByOrder: { id: string; count: number }[] = [];
  const blocked: BlockedOrder[] = [];
  for (const value of orders) {
    const order = obj(value) as SnapshotOrder & Obj;
    const state =
      order.missing_state === true
        ? "MISSING_STATE"
        : typeof order.state === "string" && KNOWN_STATES.has(order.state)
          ? order.state
          : "INVALID";
    counts[state] = (counts[state] ?? 0) + 1;
    if (state === "INVALID") malformedOrders++;
    if (state === "MISSING_STATE") missingState++;
    if (state === "WAITING_OWNER") waitingOwner++;
    const id = orderId(order.id);
    const mi = order.manual_interventions;
    if (typeof mi === "number" && Number.isInteger(mi) && mi >= 0) {
      manualTotal += mi;
      if (mi > 0) manualByOrder.push({ id, count: mi });
    } else if (state !== "INVALID") manualUnknown++;

    const since = enteredAt(order, state);
    const sinceAge = age(since, now);
    const panel = panelText(order.panel);
    const lastLog = text(obj(order.last_log).result, 160);
    const push = (
      kind: BlockKind,
      reason: string,
      extra: Partial<BlockedOrder> = {},
    ) =>
      blocked.push({
        id,
        kind,
        state,
        reason,
        since: sinceAge === null ? null : safe(since ?? null),
        ageMs: sinceAge,
        ...(panel ? { panel } : {}),
        ...extra,
      });

    if (state === "MISSING_STATE") {
      push(
        "UNKNOWN",
        "adresář zakázky bez state.json (missing_state): stav zakázky UNKNOWN",
      );
    } else if (state === "PAUSED") {
      const reset = time(order.resume_after);
      if (!Number.isFinite(reset)) pauseResetUnknown++;
      else if (reset <= now) duePause++;
      // paused_from is an order state: only a known state goes out (redacted), anything else is replaced.
      const pausedFrom =
        order.paused_from === undefined
          ? "?"
          : typeof order.paused_from === "string" &&
              KNOWN_STATES.has(order.paused_from)
            ? redactSecrets(order.paused_from)
            : INVALID_STATE;
      const resetText = text(order.resume_after, 40);
      push(
        "PAUSED",
        Number.isFinite(reset)
          ? `pauza z ${pausedFrom}; reset ${resetText}${reset <= now ? " (už měl proběhnout)" : ""}`
          : "pauza bez doloženého resetu (resume_after chybí): UNKNOWN",
        {
          resumeAfter: Number.isFinite(reset) ? resetText! : null,
          resumeDue: Number.isFinite(reset) ? reset <= now : null,
        },
      );
    } else if (state === "WAITING_OWNER") {
      const reasons = Array.isArray(order.owner_reasons)
        ? order.owner_reasons.map((r) => text(r, 120)).filter(Boolean)
        : [];
      const go = str(obj(order.meta).owner_go)
        ? "GO zapsáno, čeká na read-back v ticku"
        : "čeká na rozhodnutí vlastníka";
      push(
        "WAITING_OWNER",
        [go, ...reasons, lastLog ? `poslední log: ${lastLog}` : ""]
          .filter(Boolean)
          .join("; "),
      );
    } else if (state === "WAITING_REVIEW") {
      push(
        "WAITING_REVIEW",
        `kontrola (${str(order.review_from) === "NEW" ? "zadání" : str(order.review_from) === "CHECKING" ? "výstupu" : "?"}) neproběhla: ${text(order.review_reason) ?? "důvod nezapsán (UNKNOWN)"}`,
      );
    } else if (state === "UNKNOWN" || state === "FAILED") {
      push(state, text(order.failure_reason) ?? "důvod nezapsán (UNKNOWN)");
    }

    // HOLD: an external write of this order whose outcome is not known (effect journal, etapa 3).
    // Runtime parity (orchestrator.ts runEffect): EFFECT_UNKNOWN and EFFECT_DONE without a receipt are both HOLD.
    // A record whose state is not a known journal state counts as unreadable (HOLD), never as "nothing pending".
    const effects = Array.isArray(order.effects) ? order.effects : [];
    let invalidEffects = 0;
    for (const e of effects.map(obj)) {
      if (typeof e.state !== "string" || !EFFECT_STATES.has(e.state)) {
        invalidEffects++;
        continue;
      }
      const doneNoReceipt = e.state === "EFFECT_DONE" && e.has_receipt !== true;
      if (e.state !== "EFFECT_UNKNOWN" && !doneNoReceipt) continue;
      const at = str(e.updated_at);
      const a = age(at, now);
      blocked.push({
        id,
        kind: "HOLD",
        state,
        reason: doneNoReceipt
          ? `EFFECT_DONE bez receiptu ${text(e.operation_id, 80) ?? "?"}: výsledek zápisu nelze doložit`
          : `EFFECT_UNKNOWN ${text(e.operation_id, 80) ?? "?"}: ${text(e.reason) ?? "důvod nezapsán"}`,
        since: a === null ? null : safe(at!),
        ageMs: a,
        ...(panel ? { panel } : {}),
      });
    }
    const unreadableEffects =
      (typeof order.effects_unreadable === "number" &&
      order.effects_unreadable > 0
        ? order.effects_unreadable
        : 0) + invalidEffects;
    if (unreadableEffects > 0)
      blocked.push({
        id,
        kind: "HOLD",
        state,
        reason: `journal efektů: ${unreadableEffects} záznam(y) nečitelné nebo neplatné, stav zápisu UNKNOWN`,
        since: null,
        ageMs: null,
      });

    // PR 2a: effect gate (etapa 4 PR 5) in HOLD, or an unreadable gate record (state of the gate UNKNOWN = HOLD).
    const gates = Array.isArray(order.gates) ? order.gates.map(obj) : [];
    let invalidGates = 0;
    for (const g of gates) {
      if (typeof g.state !== "string" || !GATE_STATES.has(g.state)) {
        invalidGates++;
        continue;
      }
      if (g.state !== "HOLD") continue;
      const at = str(g.at);
      const a = age(at, now);
      blocked.push({
        id,
        kind: "HOLD",
        state,
        reason: `brána efektu HOLD: ${text(g.hold, 160) ?? "důvod nezapsán"}`,
        since: a === null ? null : safe(at!),
        ageMs: a,
        ...(panel ? { panel } : {}),
      });
    }
    const unreadableGates =
      (typeof order.gates_unreadable === "number" && order.gates_unreadable > 0
        ? order.gates_unreadable
        : 0) + invalidGates;
    if (unreadableGates > 0)
      blocked.push({
        id,
        kind: "HOLD",
        state,
        reason: `brána efektu: ${unreadableGates} záznam(y) nečitelné nebo neplatné, stav brány UNKNOWN`,
        since: null,
        ageMs: null,
      });
  }
  // Newest first; unknown age last.
  blocked.sort((a, b) => (a.ageMs ?? Infinity) - (b.ageMs ?? Infinity));

  // --- heartbeat and gaps (from log, never from the launchd configuration) ---
  const intervalMs = intervalS * 1000;
  const gapMs = 2 * intervalMs;
  const tickTimes = (Array.isArray(log.ticks) ? log.ticks : [])
    .map((t) => ({ t: time(t), s: t as string }))
    .filter((x) => Number.isFinite(x.t) && x.t <= now)
    .sort((a, b) => a.t - b.t);
  const futureTicks =
    (Array.isArray(log.ticks) ? log.ticks.length : 0) - tickTimes.length;
  const last = tickTimes.at(-1);
  const heartbeatAgeMs = last ? now - last.t : null;
  const heartbeatStatus =
    log.readable !== true || heartbeatAgeMs === null
      ? "UNKNOWN"
      : heartbeatAgeMs > gapMs
        ? "STALE"
        : "RECENT_TICK";
  const gaps: TickGap[] = [];
  for (let i = 1; i < tickTimes.length; i++) {
    const d = tickTimes[i].t - tickTimes[i - 1].t;
    if (d > gapMs)
      gaps.push({
        from: safe(tickTimes[i - 1].s)!,
        to: safe(tickTimes[i].s),
        durationMs: d,
      });
  }
  if (last && heartbeatAgeMs !== null && heartbeatAgeMs > gapMs)
    gaps.push({ from: safe(last.s)!, to: null, durationMs: heartbeatAgeMs });

  // Guard: the last guard line in write order among those not in the future (future entries ignored and reported).
  // Write order, not the highest timestamp: after the clock was set back, a later ALARM carries an older time.
  // Times that go backwards in write order mean the clock moved: the guard result is then UNKNOWN.
  // A guard line without a parsable time is a corrupted line of the tick window (never silently skipped).
  const guardLines = (
    Array.isArray(log.guards)
      ? log.guards
      : log.last_guard !== undefined
        ? [log.last_guard]
        : []
  ).map(obj);
  let lastGuard: Obj = {};
  let prevGuardT = -Infinity;
  let futureGuards = 0,
    invalidGuards = 0,
    invalidAfterGuard = 0,
    clockBack = false;
  for (const g of guardLines) {
    const t = time(g.ts);
    if (!Number.isFinite(t)) {
      invalidGuards++;
      invalidAfterGuard++;
      continue;
    }
    if (t > now) {
      futureGuards++;
      continue;
    }
    if (t < prevGuardT) clockBack = true;
    prevGuardT = t;
    lastGuard = g;
    invalidAfterGuard = 0;
  }
  const futureEntries = Math.max(futureTicks, futureGuards);

  // Log completeness: unparsable lines inside the tick window may hide a tick or a newer guard result.
  // Guard lines with an unparsable time in the snapshot count as corrupted lines on top of the collector counters.
  const badInWindowRaw =
    typeof log.bad_lines_in_window === "number"
      ? log.bad_lines_in_window
      : typeof log.bad_lines === "number"
        ? log.bad_lines
        : null;
  const badInWindow =
    badInWindowRaw === null ? null : badInWindowRaw + invalidGuards;
  const badAfterGuardRaw =
    typeof log.bad_lines_after_last_guard === "number"
      ? log.bad_lines_after_last_guard
      : badInWindowRaw;
  const badAfterGuard =
    badAfterGuardRaw === null ? null : badAfterGuardRaw + invalidAfterGuard;
  const logCompleteness =
    log.readable !== true
      ? "UNKNOWN"
      : badInWindow === 0
        ? "COMPLETE"
        : "UNKNOWN";
  const guardReason =
    badAfterGuard === null
      ? "počet poškozených řádků logu neměřen"
      : badAfterGuard > 0
        ? "za posledním guardem jsou poškozené řádky (novější výsledek může být mezi nimi)"
        : clockBack
          ? "časy guardů jdou v pořadí zápisu zpět (posun hodin), poslední výsledek nelze časově doložit"
          : lastGuard.result === "OK" || lastGuard.result === "ALARM"
            ? null
            : "žádný použitelný guard záznam";
  const guardStatus =
    guardReason === null ? (lastGuard.result as "OK" | "ALARM") : "UNKNOWN";

  const launchdStatus =
    launchd.readable === true
      ? "READ"
      : launchd.readable === false
        ? "UNKNOWN"
        : "NOT_MEASURED";

  const inputComplete =
    s.runs_readable === true &&
    Array.isArray(s.orders) &&
    malformedOrders === 0 &&
    missingState === 0 &&
    unreadable === 0 &&
    manualUnknown === 0;

  const activeBlocks = blocked.filter((b) =>
    ["WAITING_OWNER", "WAITING_REVIEW", "HOLD", "PAUSED"].includes(b.kind),
  ).length;

  // PR 2a: live signals (lease, tick end, wake gate, system blockers) and manual interventions from the log.
  const live = projectLive(s.live, {
    now,
    intervalS,
    tickTimes: tickTimes.map((x) => x.t),
    lastGuardResult: guardStatus,
  });
  const lv = live.liveness;
  const manualLog = manualFromLog(
    log.manual,
    log.readable === true && Array.isArray(log.manual),
    live.outsideGateTicks,
  );
  // A measured source that cannot be read leaves the state UNKNOWN; a source not measured at all does not.
  const liveUnknown =
    lv.lease.status === "UNKNOWN" ||
    lv.tickEnd.status === "UNKNOWN" ||
    lv.gate.status === "UNKNOWN";
  // A stale start-of-tick heartbeat is no finding while a tick provably runs (a long tick, e.g. the dev chain).
  const heartbeatStale =
    heartbeatStatus === "STALE" && lv.status !== "TICK_RUNNING";

  // Never a PASS: at best "no findings" when everything was measured.
  const overall =
    !inputComplete ||
    heartbeatStatus === "UNKNOWN" ||
    logCompleteness !== "COMPLETE" ||
    guardStatus === "UNKNOWN" ||
    lv.status === "UNKNOWN" ||
    liveUnknown
      ? "UNKNOWN"
      : heartbeatStale ||
          activeBlocks > 0 ||
          guardStatus === "ALARM" ||
          lv.status === "OFFLINE" ||
          lv.status === "TICK_STALLED" ||
          live.system.blockers.length > 0
        ? "ATTENTION"
        : "NO_FINDINGS";
  // The manual-intervention counter is only measured when every order was read and valid.
  const manualMeasured =
    Array.isArray(s.orders) &&
    manualUnknown === 0 &&
    unreadable === 0 &&
    malformedOrders === 0 &&
    missingState === 0;

  return {
    schema: "tars-audit-health/v3",
    overall,
    snapshotStatus,
    observedAgeMs,
    inputStatus: inputComplete ? "VALID_ORDER_LIST" : "INCOMPLETE",
    orderCount: orders.length,
    unreadableOrders: unreadable,
    missingStateOrders: missingState,
    malformedOrders,
    counts,
    waitingOwner,
    duePause,
    pauseResetUnknown,
    blocked,
    activeBlocks,
    heartbeat: {
      status: heartbeatStatus,
      source: 'runs/log.jsonl (záznam guard, order "-")',
      lastTick: safe(last?.s ?? null),
      ageMs: heartbeatAgeMs,
      intervalS,
      ticksInLog: tickTimes.length,
      futureTicksIgnored: futureTicks,
    },
    gaps: {
      status:
        log.readable === true && tickTimes.length > 0
          ? "MEASURED"
          : "NOT_MEASURED",
      thresholdMs: gapMs,
      list: gaps,
    },
    guard: {
      status: guardStatus,
      at: safe(str(lastGuard.ts) ?? null),
      /** why the guard is UNKNOWN; null when the result is known */
      reason: guardReason,
      alarms: typeof log.ticks_alarm === "number" ? log.ticks_alarm : null,
      futureEntries,
    },
    logCompleteness: {
      status: logCompleteness,
      badLinesInWindow: badInWindow,
      badLinesAfterLastGuard: badAfterGuard,
    },
    manualInterventions: {
      status: manualMeasured ? "MEASURED" : "UNKNOWN",
      total: manualTotal,
      byOrder: manualByOrder,
      ordersWithoutField: manualUnknown,
      /** PR 2a: interventions visible in the log (abort, CLI owner, reissue, gpt-retry, overwritten state, manual ticks) */
      fromLog: manualLog,
    },
    /** PR 2a: real heartbeat from every local source and the offline verdict (health-live.ts) */
    liveness: lv,
    /** PR 2a: system-level blockers (global HOLD, limit HOLD, decisions not taken, dead lease holder, unfinished tick) */
    system: live.system,
    launchd: {
      status: launchdStatus,
      note: "konfigurace a čítač launchd, ne heartbeat",
      state: text(launchd.state, 60) ?? null,
      runs: typeof launchd.runs === "number" ? launchd.runs : null,
      lastExitCode:
        typeof launchd.last_exit_code === "number"
          ? launchd.last_exit_code
          : null,
      intervalS:
        typeof launchd.interval_s === "number" ? launchd.interval_s : null,
    },
    panelIndex: {
      status:
        panelIndex.readable === true
          ? "READ"
          : panelIndex.readable === false
            ? "UNKNOWN"
            : "NOT_MEASURED",
      rows: typeof panelIndex.rows === "number" ? panelIndex.rows : null,
    },
    logAgeMs,
    logStatus:
      logAgeMs === null
        ? "UNKNOWN"
        : logAgeMs > staleMs
          ? "STALE"
          : "RECENT_ACTIVITY",
    browserAgeMs,
    browserStatus:
      browser.ok === false
        ? "FAILED_OBSERVATION"
        : browser.ok === true &&
            browserAgeMs !== null &&
            browserAgeMs <= staleMs
          ? "RECENT_OK_OBSERVATION"
          : "UNKNOWN",
    // A snapshot, file mtime, launchd counter or an existing lock cannot establish current liveness. Only a lease whose
    // holder was proven alive (kill -0 + same start time) with a fresh heartbeat shows a running tick process.
    processLiveness:
      lv.status === "TICK_RUNNING" ? "VERIFIED_TICK_RUNNING" : "NOT_VERIFIED",
    cloudLiveness: "NOT_VERIFIED",
    goToAckMs: null,
    goToAckStatus: "NOT_INSTRUMENTED",
    effectsPerformed: 0,
  };
}

export type HealthReport = ReturnType<typeof auditHealth>;

/** When did the order enter its current state: last history record into it, else updated_at. */
function enteredAt(order: Obj, state: string): string | undefined {
  const h = Array.isArray(order.history) ? order.history.map(obj) : [];
  for (let i = h.length - 1; i >= 0; i--)
    if (h[i].to === state && str(h[i].at)) return str(h[i].at);
  return str(order.updated_at);
}

function panelText(p: unknown): string | undefined {
  if (p === undefined) return undefined;
  const x = obj(p);
  const flags = [
    x.uncertain === true ? "nejasný zápis" : "",
    x.tainted === true ? "znehodnocený řádek" : "",
    x.dirty === true ? "čeká na dorovnání" : "",
  ].filter(Boolean);
  return `${x.row === true ? "řádek v panelu" : "bez řádku v panelu"}${flags.length ? ` (${flags.join(", ")})` : ""}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Read-only collector. Only readFileSync / readdirSync / statSync / existsSync and `launchctl print`.
// ---------------------------------------------------------------------------------------------------------------

export interface CollectOptions {
  now?: () => Date;
  /** Text of `launchctl print`; undefined = could not be read. `null` = do not measure (tests, other machine). */
  launchd?: (() => string | undefined) | null;
  /** Lease holder probe (health-live.ts); `null` = do not probe. Default: holderStatus (kill -0, ps, read only). */
  probe?: HolderProbe | null;
}

/** Effect gate records of one order (state, HOLD code, time of the last history entry). */
function readGates(gateDir: string): {
  gates: { state?: string; hold?: string; at?: string }[];
  gatesUnreadable: number;
} {
  const gates: { state?: string; hold?: string; at?: string }[] = [];
  let gatesUnreadable = 0;
  if (!fs.existsSync(gateDir)) return { gates, gatesUnreadable };
  let files: string[] = [];
  try {
    files = fs
      .readdirSync(gateDir)
      .filter((x) => x.endsWith(".json"))
      .sort();
  } catch {
    gatesUnreadable++;
  }
  for (const gf of files) {
    const r = readJson(path.join(gateDir, gf));
    const g = r.ok ? obj(r.value) : undefined;
    if (!g || typeof g.state !== "string" || !GATE_STATES.has(g.state)) {
      gatesUnreadable++;
      continue;
    }
    const h = Array.isArray(g.history) ? g.history.map(obj) : [];
    gates.push({ state: g.state, hold: str(g.hold), at: str(h.at(-1)?.at) });
  }
  return { gates, gatesUnreadable };
}

export function readLaunchd(label = LAUNCHD_LABEL): string | undefined {
  if (typeof process.getuid !== "function") return undefined;
  const r = spawnSync(
    "launchctl",
    ["print", `gui/${process.getuid()}/${label}`],
    {
      encoding: "utf8",
      timeout: 5000,
    },
  );
  return r.status === 0 && typeof r.stdout === "string" ? r.stdout : undefined;
}

export function parseLaunchd(
  out: string | undefined,
): HealthSnapshot["launchd"] {
  if (!out) return { readable: false };
  const num = (re: RegExp) => {
    const m = out.match(re);
    return m ? Number(m[1]) : undefined;
  };
  return {
    readable: true,
    state: out.match(/^\s*state = (.+)$/m)?.[1]?.trim(),
    runs: num(/^\s*runs = (\d+)$/m),
    last_exit_code: num(/^\s*last exit code = (-?\d+)/m),
    interval_s: num(/^\s*run interval = (\d+) seconds$/m),
  };
}

function readJson(file: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return { ok: false };
  }
}

/** Effect journal of one order. A record with an unknown state counts as unreadable (HOLD), like a broken file. */
function readEffects(effDir: string): {
  effects: SnapshotEffect[];
  effectsUnreadable: number;
} {
  const effects: SnapshotEffect[] = [];
  let effectsUnreadable = 0;
  if (!fs.existsSync(effDir)) return { effects, effectsUnreadable };
  let files: string[] = [];
  try {
    files = fs
      .readdirSync(effDir)
      .filter((x) => x.endsWith(".json"))
      .sort();
  } catch {
    effectsUnreadable++;
  }
  for (const ef of files) {
    const er = readJson(path.join(effDir, ef));
    const rec = er.ok ? (obj(er.value) as Partial<EffectRecord>) : undefined;
    if (
      !rec ||
      typeof rec.state !== "string" ||
      !EFFECT_STATES.has(rec.state)
    ) {
      effectsUnreadable++;
      continue;
    }
    effects.push({
      operation_id: rec.operation_id,
      state: rec.state,
      reason: rec.reason,
      updated_at: rec.updated_at,
      has_receipt: str(obj(rec.receipt).url) !== undefined,
    });
  }
  return { effects, effectsUnreadable };
}

export function collectSnapshot(
  runsDir: string,
  opts: CollectOptions = {},
): HealthSnapshot {
  const now = (opts.now ?? (() => new Date()))();
  const snap: HealthSnapshot = { observed_at: now.toISOString() };

  let entries: string[] | undefined;
  try {
    entries = fs.readdirSync(runsDir);
    snap.runs_readable = true;
  } catch {
    snap.runs_readable = false;
  }

  // log.jsonl: guard lines = ticks; last line per order = reason context.
  const lastLogByOrder = new Map<string, { ts?: string; result?: string }>();
  const logFile = path.join(runsDir, "log.jsonl");
  if (entries) {
    try {
      const st = fs.statSync(logFile);
      const lines = fs
        .readFileSync(logFile, "utf8")
        .split("\n")
        .filter(Boolean);
      const ticks: string[] = [];
      const manual: ManualLine[] = [];
      const guards: { ts?: string; result?: string }[] = [];
      let alarms = 0,
        bad = 0,
        badInWindow = 0,
        badAfterGuard = 0;
      let lastGuard: { ts?: string; result?: string } | undefined;
      for (const line of lines) {
        let e: Partial<LogEntry>;
        try {
          e = obj(JSON.parse(line)) as Partial<LogEntry>;
        } catch {
          bad++;
          if (lastGuard) {
            badInWindow++;
            badAfterGuard++;
          }
          continue;
        }
        const m = manualLineOf(e as Obj);
        if (m) manual.push(m);
        if (
          e.kind === "guard" &&
          e.order === "-" &&
          Number.isFinite(time(e.ts))
        ) {
          const ts = e.ts as string; // time() is finite only for a string
          ticks.push(ts);
          if (e.result === "ALARM") alarms++;
          lastGuard = { ts, result: e.result };
          guards.push(lastGuard);
          badAfterGuard = 0;
        } else if (e.kind === "guard" && e.order === "-") {
          // A guard line without a parsable timestamp (missing, "broken") is a corrupted line of the tick window,
          // even before the first valid guard: it is itself a guard line and may carry the newest result (ALARM).
          bad++;
          badInWindow++;
          badAfterGuard++;
        } else if (
          typeof e.order === "string" &&
          e.order !== "-" &&
          typeof e.result === "string"
        )
          lastLogByOrder.set(e.order, { ts: e.ts, result: e.result });
      }
      snap.log = {
        readable: true,
        mtime: st.mtime.toISOString(),
        ticks,
        ticks_alarm: alarms,
        guards,
        last_guard: lastGuard,
        bad_lines: bad,
        bad_lines_in_window: badInWindow,
        bad_lines_after_last_guard: badAfterGuard,
        manual,
      };
    } catch {
      snap.log = { readable: false };
    }
  }

  // panel-index.json (read only; the runtime PanelIndex class would take the state lock, so it is not used here).
  let panel: Record<string, unknown> | undefined;
  if (entries) {
    const f = path.join(runsDir, "panel-index.json");
    if (fs.existsSync(f)) {
      const r = readJson(f);
      panel = r.ok ? obj(r.value) : undefined;
      snap.panel_index = r.ok
        ? {
            readable: true,
            rows: Object.keys(panel!).filter((k) => k.startsWith("wo-")).length,
          }
        : { readable: false };
    } else snap.panel_index = { readable: false };
  }

  // orders
  if (entries) {
    const orders: unknown[] = [];
    const unreadable: string[] = [];
    for (const d of entries.filter((x) => x.startsWith("wo-")).sort()) {
      const f = path.join(runsDir, d, "state.json");
      const { effects, effectsUnreadable } = readEffects(
        path.join(runsDir, d, "effects"),
      );
      const { gates, gatesUnreadable } = readGates(
        path.join(runsDir, d, "gate"),
      );
      const effectFields = {
        effects,
        ...(effectsUnreadable ? { effects_unreadable: effectsUnreadable } : {}),
        ...(gates.length ? { gates } : {}),
        ...(gatesUnreadable ? { gates_unreadable: gatesUnreadable } : {}),
      };
      if (!fs.existsSync(f)) {
        // An order directory without state.json (interrupted first save, lost state) is an incomplete order,
        // never silently skipped; its effect journal is still read.
        orders.push({ id: d, missing_state: true, ...effectFields });
        continue;
      }
      const r = readJson(f);
      if (!r.ok) {
        unreadable.push(d);
        continue;
      }
      const o = obj(r.value);
      orders.push({
        id: str(o.id) ?? d,
        state: o.state,
        updated_at: o.updated_at,
        history: o.history,
        resume_after: o.resume_after,
        paused_from: o.paused_from,
        review_from: o.review_from,
        review_reason: o.review_reason,
        failure_reason: o.failure_reason,
        owner_reasons: o.owner_reasons,
        manual_interventions: o.manual_interventions,
        meta: { ...(str(obj(o.meta).owner_go) ? { owner_go: "1" } : {}) },
        ...effectFields,
        last_log: lastLogByOrder.get(d),
        ...(panel
          ? {
              panel: {
                row: typeof panel[d] === "string",
                uncertain: `uncertain:${d}` in panel,
                tainted: `tainted:${d}` in panel,
                dirty: `dirty:${d}` in panel,
              },
            }
          : {}),
      }); // raw values: auditHealth validates every field itself
    }
    snap.orders = orders;
    snap.unreadable_orders = unreadable;
  }

  // browser-status.json (written by browser-check; here only read)
  if (entries) {
    const r = readJson(path.join(runsDir, "browser-status.json"));
    if (r.ok) {
      const b = obj(r.value);
      snap.browser = { ok: b.ok, checked_at: b.checked_at };
    }
  }

  if (entries) snap.live = collectLive(runsDir, { probe: opts.probe });

  if (opts.launchd !== null)
    snap.launchd = parseLaunchd((opts.launchd ?? readLaunchd)());
  return snap;
}

// ---------------------------------------------------------------------------------------------------------------
// Human-readable output (Czech)
// ---------------------------------------------------------------------------------------------------------------

const KIND_LABEL: Record<BlockKind, string> = {
  WAITING_OWNER: "čeká na vlastníka",
  WAITING_REVIEW: "čeká na kontrolu GPT",
  HOLD: "HOLD (nejasný zápis)",
  PAUSED: "pozastaveno",
  UNKNOWN: "UNKNOWN",
  FAILED: "FAILED",
};

export function formatDuration(ms: number | null): string {
  if (ms === null) return "UNKNOWN";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

const local = (iso: string | null): string => {
  if (!iso) return "UNKNOWN";
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleString("cs-CZ", {
        timeZone: "Europe/Prague",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "UNKNOWN";
};

export function formatHealth(r: HealthReport): string {
  const L: string[] = [];
  const overall: Record<string, string> = {
    UNKNOWN: "UNKNOWN (chybí data, viz níže)",
    ATTENTION: "POZOR (něco čeká nebo stojí)",
    NO_FINDINGS: "bez nálezů (není to PASS, jen nic neviditelného nečeká)",
  };
  L.push(`TARS health — stav: ${overall[r.overall] ?? r.overall}`);
  L.push("");
  const hb = r.heartbeat;
  L.push(
    `Heartbeat (poslední skutečný tick z logu): ${hb.status === "UNKNOWN" ? "UNKNOWN" : `${local(hb.lastTick)}, před ${formatDuration(hb.ageMs)}`}${hb.status === "STALE" ? " — STOJÍ (déle než 2 intervaly)" : ""}`,
  );
  L.push(
    `Guard při posledním ticku: ${r.guard.status}${r.guard.at ? ` (${local(r.guard.at)})` : ""}${r.guard.reason ? ` — ${r.guard.reason}` : ""}; ALARM v logu celkem: ${r.guard.alarms ?? "UNKNOWN"}${r.guard.futureEntries ? `; záznamy z budoucnosti ignorovány: ${r.guard.futureEntries}` : ""}`,
  );
  const lc = r.logCompleteness;
  L.push(
    `Úplnost logu: ${lc.status === "COMPLETE" ? "úplný" : `UNKNOWN${lc.badLinesInWindow ? ` (${lc.badLinesInWindow} neplatných řádků v okně ticků)` : ""}`}`,
  );
  const ld = r.launchd;
  L.push(
    `launchd (jen konfigurace, ne důkaz běhu): ${ld.status === "READ" ? `stav ${ld.state ?? "?"}, interval ${ld.intervalS ?? "?"} s, spuštění ${ld.runs ?? "?"}, poslední exit ${ld.lastExitCode ?? "?"}` : ld.status === "NOT_MEASURED" ? "NOT MEASURED" : "UNKNOWN (nelze přečíst)"}`,
  );
  L.push("");
  const lv = r.liveness;
  L.push(
    `Živost (nejnovější heartbeat ze všech zdrojů): ${LIVENESS_LABEL[lv.status] ?? lv.status} — ${lv.reason}${lv.lastSignalSource ? ` · zdroj: ${lv.lastSignalSource}, ${local(lv.lastSignalAt)}, před ${formatDuration(lv.ageMs)}` : ""}`,
  );
  const ls = lv.lease;
  L.push(
    `  Tick lease (runs/.lock): ${ls.status}${ls.pid !== null ? `, pid ${ls.pid}` : ""}${ls.acquiredAt ? `, od ${local(ls.acquiredAt)} (${formatDuration(ls.runningMs)})` : ""}${ls.heartbeatAt ? `, heartbeat před ${formatDuration(ls.heartbeatAgeMs)}` : ""} — ${ls.reason}`,
  );
  const te = lv.tickEnd;
  L.push(
    `  Konec ticku (runs/idle): ${te.status === "MISSING" ? "MISSING (záznam neexistuje: starší verze, nebo tick nikdy nedoběhl)" : te.status === "NOT_MEASURED" ? "NOT MEASURED" : `${te.status}${te.at ? `, ${local(te.at)}, před ${formatDuration(te.ageMs)}` : ""}${te.tickStatus ? `, výsledek ${te.tickStatus}` : ""}`}`,
  );
  const gt = lv.gate;
  L.push(
    `  Brána probuzení (runs/wake): ${gt.status === "NOT_INSTALLED" ? "není nainstalovaná (runs/wake neexistuje)" : gt.status === "NOT_MEASURED" ? "NOT MEASURED" : `${gt.status}${gt.lastLineAt ? `, poslední záznam ${local(gt.lastLineAt)} (před ${formatDuration(gt.ageMs)})` : ""}, startů ticku ${gt.starts}${gt.errors ? `, chyb ${gt.errors}` : ""}`}`,
  );
  if (lv.unfinishedTick === true)
    L.push("  Poslední tick skončil bez záznamu konce.");
  const sy = r.system;
  L.push(
    `Systém: ${sy.status === "NOT_MEASURED" ? "NOT MEASURED" : `nečinnost ${sy.idleReason === null ? (sy.tickStatus ? "žádná (tick pracoval)" : `UNKNOWN${lv.tickEnd.status === "MISSING" ? " (runs/idle chybí)" : ""}`) : sy.idleReason}${sy.idleDetail ? ` (${sy.idleDetail})` : ""} · režim dispatcheru ${sy.dispatchMode ?? "UNKNOWN"} · HOLD limitu ${yesNo(sy.limitHold)} · runs/HOLD ${yesNo(sy.holdFile)} · nepřevzatá rozhodnutí ${sy.pendingDecisions.length}`}`,
  );
  L.push(
    `Systémové blokace: ${sy.blockers.length === 0 ? (sy.status === "NOT_MEASURED" ? "NOT MEASURED" : "žádné") : sy.blockers.length}`,
  );
  for (const b of sy.blockers) L.push(`  - ${b}`);
  L.push("");
  L.push(
    `Výpadky ticků (delší než ${formatDuration(r.gaps.thresholdMs)}): ${r.gaps.status === "NOT_MEASURED" ? "NOT MEASURED" : r.gaps.list.length === 0 ? "žádné" : r.gaps.list.length}`,
  );
  for (const g of r.gaps.list)
    L.push(
      `  - ${local(g.from)} → ${g.to ? local(g.to) : "dosud (trvá)"}: ${formatDuration(g.durationMs)}`,
    );
  L.push("");
  L.push(`Blokace (${r.blocked.length}, z toho aktivních ${r.activeBlocks}):`);
  if (r.blocked.length === 0)
    L.push(
      r.inputStatus === "INCOMPLETE"
        ? "  UNKNOWN (zakázky nešlo přečíst celé)"
        : "  žádné",
    );
  for (const b of r.blocked)
    L.push(
      `  - ${b.id} · ${KIND_LABEL[b.kind]} · ${b.ageMs === null ? "stáří UNKNOWN" : `${formatDuration(b.ageMs)} (od ${local(b.since)})`}${b.panel ? ` · ${b.panel}` : ""}\n      ${b.reason}`,
    );
  L.push("");
  const mi = r.manualInterventions;
  L.push(
    `Ruční zásahy: ${mi.status === "UNKNOWN" ? `UNKNOWN (${mi.ordersWithoutField} zakázek bez údaje, ${r.unreadableOrders + r.malformedOrders + r.missingStateOrders} nečitelných nebo neúplných; známých ${mi.total})` : mi.total}${mi.byOrder.length ? ` (${mi.byOrder.map((x) => `${x.id}: ${x.count}`).join(", ")})` : ""}`,
  );
  const ml = mi.fromLog;
  L.push(
    `Ruční zásahy v logu${ml.since ? ` (od ${local(ml.since)})` : ""}: ${ml.status === "UNKNOWN" ? "UNKNOWN (log nečitelný)" : `celkem ${ml.total} · abort ${ml.abort} · owner přes CLI ${ml.ownerCli} · znovuvydání karty ${ml.reissue} · gpt-retry ${ml.gptRetry} · přepsaný stav ${ml.overwrittenState}`} · ticky mimo bránu ${ml.outsideGateTicks ?? "NOT MEASURED"}`,
  );
  L.push(
    `Zakázky: ${r.orderCount}${r.unreadableOrders ? `, nečitelné ${r.unreadableOrders}` : ""}${r.missingStateOrders ? `, bez state.json ${r.missingStateOrders}` : ""} · ${
      Object.entries(r.counts)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ") || "žádné"
    }`,
  );
  L.push(
    `Panel index: ${r.panelIndex.status === "READ" ? `${r.panelIndex.rows} řádků` : r.panelIndex.status === "NOT_MEASURED" ? "NOT MEASURED" : "UNKNOWN"}`,
  );
  L.push(`Prohlížeč (browser-status): ${r.browserStatus}`);
  L.push(
    `Živost procesu: ${r.processLiveness === "VERIFIED_TICK_RUNNING" ? "tick běží (ověřeno)" : "NOT VERIFIED"} · cloud: NOT VERIFIED · GO→potvrzení: NOT INSTRUMENTED`,
  );
  L.push("");
  L.push("Projekce jen čte runs/ a launchd; nic nezapisuje.");
  return L.join("\n");
}

const LIVENESS_LABEL: Record<string, string> = {
  TICK_RUNNING: "TICK BĚŽÍ",
  TICK_STALLED: "TICK STOJÍ",
  RECENT: "ŽIJE",
  OFFLINE: "OFFLINE",
  UNKNOWN: "UNKNOWN",
};

const yesNo = (v: boolean | null): string =>
  v === null ? "UNKNOWN" : v ? "ano" : "ne";

/**
 * PR 2a: compact one-paragraph form (≤ 600 characters) for a phone. It carries its own time ("stav k"), so a reader
 * who sees an old text knows it is old: the Mac cannot report its own outage, the age of this text is the signal.
 * Only formats; nothing writes it anywhere (wiring into the panel row is PR 2b, class B).
 */
export function formatHealthCompact(r: HealthReport, now: number): string {
  const overall: Record<string, string> = {
    UNKNOWN: "UNKNOWN",
    ATTENTION: "POZOR",
    NO_FINDINGS: "bez nálezů",
  };
  const lv = r.liveness;
  const parts = [
    `TARS ${overall[r.overall] ?? r.overall} · stav k ${local(new Date(now).toISOString())}`,
    `živost ${LIVENESS_LABEL[lv.status] ?? lv.status}${lv.ageMs !== null ? ` (heartbeat před ${formatDuration(lv.ageMs)})` : ""}`,
    `aktivní blokace ${r.activeBlocks}`,
    `systémové blokace ${r.system.blockers.length}`,
    `ruční zásahy ${r.manualInterventions.fromLog.total ?? "UNKNOWN"}`,
    `režim ${r.system.dispatchMode ?? "UNKNOWN"}`,
  ];
  return parts.join(" · ").slice(0, 600);
}
