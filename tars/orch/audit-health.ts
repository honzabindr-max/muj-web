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
import { redactSecrets } from "./secret-scan";
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
/** Free text from state/log goes out shortened and redacted; unknown fields are never echoed. */
const text = (v: unknown, max = 200): string | undefined => {
  const s = str(v);
  return s
    ? redactSecrets(s.replace(/\s+/g, " ").trim()).slice(0, max)
    : undefined;
};

/** Default launchd StartInterval of work.good-inventions.tars-orch (plist). */
export const TICK_INTERVAL_S = 1800;
export const LAUNCHD_LABEL = "work.good-inventions.tars-orch";

/** Order states the projection knows: runtime STATES plus SUPERSEDED (written by hand into old orders). */
const KNOWN_STATES = new Set<string>([...STATES, "SUPERSEDED"]);

/** Order id pattern (wo-…): no path, no whitespace, no control characters, bounded length. */
const ORDER_ID_RE = /^wo-[A-Za-z0-9_-]{1,100}$/;
export const INVALID_ID = "<neplatné id>";
export const INVALID_STATE = "<neplatný stav>";
/** An id goes out only when it matches the order id pattern, and even then redacted. */
const orderId = (v: unknown): string =>
  typeof v === "string" && ORDER_ID_RE.test(v) ? redactSecrets(v) : INVALID_ID;

/** Effect journal states of the runtime (effects.ts EffectState). Anything else = unreadable journal record. */
const EFFECT_STATES = new Set<string>([
  "PREPARED",
  "EFFECT_DONE",
  "EFFECT_ABSENT",
  "EFFECT_UNKNOWN",
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
    /** every guard line (ts, result); the projection picks the newest one not in the future */
    guards?: { ts?: string; result?: string }[];
    /** positionally last guard line; used only when `guards` is absent */
    last_guard?: { ts?: string; result?: string };
    bad_lines?: number;
    /** unparsable lines at or after the first guard line (inside the measured tick window) */
    bad_lines_in_window?: number;
    /** unparsable lines after the positionally last guard line (a newer guard result may be among them) */
    bad_lines_after_last_guard?: number;
  };
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
        since: sinceAge === null ? null : (since ?? null),
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
        since: a === null ? null : at!,
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
        from: tickTimes[i - 1].s,
        to: tickTimes[i].s,
        durationMs: d,
      });
  }
  if (last && heartbeatAgeMs !== null && heartbeatAgeMs > gapMs)
    gaps.push({ from: last.s, to: null, durationMs: heartbeatAgeMs });

  // Guard: the newest guard line with the same time filter as the heartbeat (future entries ignored and reported).
  const guardLines = (
    Array.isArray(log.guards)
      ? log.guards
      : log.last_guard !== undefined
        ? [log.last_guard]
        : []
  ).map(obj);
  let lastGuard: Obj = {};
  let lastGuardT = -Infinity;
  let futureGuards = 0;
  for (const g of guardLines) {
    const t = time(g.ts);
    if (!Number.isFinite(t)) continue;
    if (t > now) {
      futureGuards++;
      continue;
    }
    if (t >= lastGuardT) {
      lastGuard = g;
      lastGuardT = t;
    }
  }
  const futureEntries = Math.max(futureTicks, futureGuards);

  // Log completeness: unparsable lines inside the tick window may hide a tick or a newer guard result.
  const badInWindow =
    typeof log.bad_lines_in_window === "number"
      ? log.bad_lines_in_window
      : typeof log.bad_lines === "number"
        ? log.bad_lines
        : null;
  const badAfterGuard =
    typeof log.bad_lines_after_last_guard === "number"
      ? log.bad_lines_after_last_guard
      : badInWindow;
  const logCompleteness =
    log.readable !== true
      ? "UNKNOWN"
      : badInWindow === 0
        ? "COMPLETE"
        : "UNKNOWN";
  const guardStatus =
    badAfterGuard === null || badAfterGuard > 0
      ? "UNKNOWN"
      : lastGuard.result === "OK" || lastGuard.result === "ALARM"
        ? (lastGuard.result as "OK" | "ALARM")
        : "UNKNOWN";

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
  // Never a PASS: at best "no findings" when everything was measured.
  const overall =
    !inputComplete ||
    heartbeatStatus === "UNKNOWN" ||
    logCompleteness !== "COMPLETE" ||
    guardStatus === "UNKNOWN"
      ? "UNKNOWN"
      : heartbeatStatus === "STALE" ||
          activeBlocks > 0 ||
          guardStatus === "ALARM"
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
    schema: "tars-audit-health/v2",
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
      lastTick: last?.s ?? null,
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
      at: str(lastGuard.ts) ?? null,
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
    },
    launchd: {
      status: launchdStatus,
      note: "konfigurace a čítač launchd, ne heartbeat",
      state: str(launchd.state) ?? null,
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
    // A snapshot, file mtime, launchd counter or an existing lock cannot establish current liveness.
    processLiveness: "NOT_VERIFIED",
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
        if (e.kind === "guard" && e.order === "-" && typeof e.ts === "string") {
          ticks.push(e.ts);
          if (e.result === "ALARM") alarms++;
          lastGuard = { ts: e.ts, result: e.result };
          guards.push(lastGuard);
          badAfterGuard = 0;
        } else if (e.kind === "guard" && e.order === "-") {
          // a guard line without a usable timestamp is as unusable as an unparsable line
          bad++;
          if (lastGuard) {
            badInWindow++;
            badAfterGuard++;
          }
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
      const effectFields = {
        effects,
        ...(effectsUnreadable ? { effects_unreadable: effectsUnreadable } : {}),
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
    `Guard při posledním ticku: ${r.guard.status}${r.guard.at ? ` (${local(r.guard.at)})` : ""}; ALARM v logu celkem: ${r.guard.alarms ?? "UNKNOWN"}${r.guard.futureEntries ? `; záznamy z budoucnosti ignorovány: ${r.guard.futureEntries}` : ""}`,
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
    `Živost procesu: NOT VERIFIED · cloud: NOT VERIFIED · GO→potvrzení: NOT INSTRUMENTED`,
  );
  L.push("");
  L.push("Projekce jen čte runs/ a launchd; nic nezapisuje.");
  return L.join("\n");
}
