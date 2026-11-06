// Etapa 5, PR 2a: the rest of observability on top of the P0-a health projection (audit-health.ts). Read only.
//
// New signals, each from a local file that an existing writer already produces (nothing new is written anywhere):
//   lease     runs/.lock            tick lease of the running tick (pid, start, heartbeat_at refreshed every 60 s)
//   tickEnd   runs/idle/status.json the record every finished tick writes (DR-033), i.e. the end of a tick
//   gate      runs/wake/gate.log    the minute wake gate (etapa 4 PR 2): every tick it starts, every skip and error
//   system    runs/idle/status.json overview + runs/dispatch-mode.json + runs/HOLD: system-level blockers
//   manual    runs/log.jsonl        manual interventions visible in the log (abort, CLI owner, reissue, gpt-retry,
//                                   overwritten state) and ticks started outside the wake gate
// From these the projection derives `liveness`: a running tick, a tick whose heartbeat stopped, recent activity, or
// OFFLINE (no heartbeat from any source for more than two tick intervals: Mac asleep, offline or scheduler stopped —
// these are not distinguishable from the Mac itself). No source at all = UNKNOWN, never OK.
//
// The holder of the lease is judged by `holderStatus` (store.ts: `kill -0` + `ps -o lstart`, both read only); the
// age of a heartbeat alone is never a proof that a process runs or is dead.
import fs from "node:fs";
import path from "node:path";

import { redactSecretsUnbounded } from "./secret-scan";
import { holderStatus, type HolderStatus, type TickLease } from "./store";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;
const time = (v: unknown): number =>
  typeof v === "string" ? Date.parse(v) : NaN;
const age = (v: unknown, now: number): number | null => {
  const n = time(v);
  return Number.isFinite(n) && n <= now ? now - n : null;
};
const text = (v: unknown, max = 200): string | undefined => {
  const s = str(v);
  return s
    ? redactSecretsUnbounded(s.replace(/\s+/g, " ").trim()).slice(0, max)
    : undefined;
};
const iso = (ms: number): string => new Date(ms).toISOString();
const ORDER_ID_RE = /^wo-[A-Za-z0-9_-]{1,100}$/;
const orderId = (v: unknown): string =>
  typeof v === "string" && ORDER_ID_RE.test(v)
    ? redactSecretsUnbounded(v)
    : "<neplatné id>";

/** The lease heartbeat is refreshed every 60 s (Store.acquireLock); older than this while the holder runs = stalled. */
export const LEASE_HEARTBEAT_STALE_MS = 5 * 60_000;
/** A guard line younger than this may belong to a tick that has not yet taken the lease (no "unfinished" verdict). */
export const UNFINISHED_GRACE_MS = 60_000;
/** A tick counts as started by the wake gate when its guard line follows a gate start line within this window. */
export const GATE_TICK_WINDOW_MS = 5 * 60_000;

// ---------------------------------------------------------------------------------------------------------------
// Snapshot parts (input of the pure projection). Absent key = not measured; `present: false` = measured, no file.
// ---------------------------------------------------------------------------------------------------------------

export interface LeaseSnapshot {
  present: boolean;
  readable?: boolean;
  pid?: number;
  acquired_at?: string;
  heartbeat_at?: string;
  /** holderStatus of the lease; "not_checked" = the collector did not probe the process */
  holder?: HolderStatus | "not_checked";
}

export interface IdleSnapshot {
  present: boolean;
  readable?: boolean;
  at?: string;
  tick_status?: string;
  idle_reason?: string | null;
  detail?: string;
  pending?: { order?: string; value?: string; code?: string }[];
  limit_hold?: boolean;
  dispatch_mode?: string;
}

export interface GateSnapshot {
  /** false = runs/wake does not exist (the wake gate is not installed or never ran) */
  present: boolean;
  readable?: boolean;
  /** epoch ms of the last line of gate.log (in write order) */
  last_line_at?: number;
  /** epoch ms of "tick reason=…" lines (a tick started by the gate) */
  starts?: number[];
  /** epoch ms of "tick end rc=…" lines */
  ends?: number[];
  /** "chyba:" lines (gate could not start a tick) */
  errors?: number;
  /** unparsable lines */
  bad_lines?: number;
}

export interface DispatchSnapshot {
  present: boolean;
  readable?: boolean;
  mode?: string;
  observed_at?: string;
  /** runs/HOLD exists (global hold overriding dispatch.json) */
  hold_file?: boolean;
}

/** One log line relevant for manual interventions. Only matched, never echoed. */
export interface ManualLine {
  ts?: string;
  order?: string;
  kind?: string;
  from?: string;
  to?: string;
  event?: string;
  result?: string;
}

export interface LiveSnapshot {
  lease?: LeaseSnapshot;
  idle?: IdleSnapshot;
  gate?: GateSnapshot;
  dispatch?: DispatchSnapshot;
}

// ---------------------------------------------------------------------------------------------------------------
// Read-only collector
// ---------------------------------------------------------------------------------------------------------------

export type HolderProbe = (lease: Partial<TickLease>) => HolderStatus;

export interface LiveCollectOptions {
  /** Judge the lease holder; `null` = do not probe (tests, another machine). Default: holderStatus (kill -0, ps). */
  probe?: HolderProbe | null;
}

function readJson(file: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return { ok: false };
  }
}

/** Measured absence (ENOENT) vs unreadable (anything else). */
function presence(file: string): "present" | "absent" | "unreadable" {
  try {
    fs.statSync(file);
    return "present";
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "ENOENT"
      ? "absent"
      : "unreadable";
  }
}

export function collectLease(
  runsDir: string,
  opts: LiveCollectOptions = {},
): LeaseSnapshot {
  const f = path.join(runsDir, ".lock");
  const p = presence(f);
  if (p === "absent") return { present: false };
  if (p === "unreadable") return { present: true, readable: false };
  const r = readJson(f);
  if (!r.ok) return { present: true, readable: false };
  const l = obj(r.value);
  const pid = Number(l.pid);
  const probe = opts.probe === undefined ? holderStatus : opts.probe;
  let holder: LeaseSnapshot["holder"] = "not_checked";
  if (probe) {
    try {
      holder = probe(l as Partial<TickLease>);
    } catch {
      holder = "unknown";
    }
  }
  return {
    present: true,
    readable: true,
    ...(Number.isInteger(pid) && pid > 0 ? { pid } : {}),
    acquired_at: str(l.acquired_at),
    heartbeat_at: str(l.heartbeat_at),
    holder,
  };
}

export function collectIdle(runsDir: string): IdleSnapshot {
  const f = path.join(runsDir, "idle", "status.json");
  const p = presence(f);
  if (p === "absent") return { present: false };
  const r = p === "present" ? readJson(f) : { ok: false as const };
  if (!r.ok) return { present: true, readable: false };
  const s = obj(r.value);
  const ov = obj(s.overview);
  return {
    present: true,
    readable: true,
    at: str(s.at),
    tick_status: str(s.tick_status),
    idle_reason:
      s.idle_reason === null ? null : (str(s.idle_reason) ?? undefined),
    detail: str(s.detail),
    pending: Array.isArray(ov.pending_decisions)
      ? ov.pending_decisions.map((x) => {
          const d = obj(x);
          return {
            order: str(d.order),
            value: str(d.value),
            code: str(d.code),
          };
        })
      : undefined,
    limit_hold: typeof ov.limit_hold === "boolean" ? ov.limit_hold : undefined,
    dispatch_mode: str(ov.dispatch_mode),
  };
}

const GATE_LINE_RE = /^(\d{1,12}) (.*)$/;

export function collectGate(runsDir: string): GateSnapshot {
  const w = path.join(runsDir, "wake");
  const pw = presence(w);
  if (pw === "absent") return { present: false };
  if (pw === "unreadable") return { present: true, readable: false };
  const f = path.join(w, "gate.log");
  const pf = presence(f);
  if (pf === "absent")
    return { present: true, readable: true, starts: [], ends: [], errors: 0 };
  let lines: string[];
  try {
    lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
  } catch {
    return { present: true, readable: false };
  }
  const starts: number[] = [];
  const ends: number[] = [];
  let errors = 0,
    bad = 0,
    last: number | undefined;
  for (const line of lines) {
    const m = line.match(GATE_LINE_RE);
    if (!m) {
      bad++;
      continue;
    }
    const at = Number(m[1]) * 1000;
    last = at;
    const msg = m[2];
    if (msg.startsWith("tick reason=")) starts.push(at);
    else if (msg.startsWith("tick end rc=")) ends.push(at);
    else if (msg.startsWith("chyba:")) errors++;
  }
  return {
    present: true,
    readable: true,
    ...(last !== undefined ? { last_line_at: last } : {}),
    starts,
    ends,
    errors,
    bad_lines: bad,
  };
}

export function collectDispatch(runsDir: string): DispatchSnapshot {
  const f = path.join(runsDir, "dispatch-mode.json");
  const hold = presence(path.join(runsDir, "HOLD"));
  const hold_file = hold === "unreadable" ? undefined : hold === "present";
  const p = presence(f);
  if (p === "absent") return { present: false, hold_file };
  const r = p === "present" ? readJson(f) : { ok: false as const };
  if (!r.ok) return { present: true, readable: false, hold_file };
  const d = obj(r.value);
  return {
    present: true,
    readable: true,
    mode: str(d.mode),
    observed_at: str(d.observed_at),
    hold_file,
  };
}

export function collectLive(
  runsDir: string,
  opts: LiveCollectOptions = {},
): LiveSnapshot {
  return {
    lease: collectLease(runsDir, opts),
    idle: collectIdle(runsDir),
    gate: collectGate(runsDir),
    dispatch: collectDispatch(runsDir),
  };
}

/** Is this parsed log line relevant for manual interventions? (collector keeps only these, with bounded fields) */
export function manualLineOf(e: Obj): ManualLine | undefined {
  const order = str(e.order);
  if (!order || order === "-") return undefined;
  const result = str(e.result);
  const relevant =
    e.kind === "transition" ||
    e.event === "gpt-retry" ||
    (result !== undefined && /^owner (GO|REJECT)\b/.test(result));
  if (!relevant) return undefined;
  return {
    ts: str(e.ts),
    order,
    kind: str(e.kind),
    from: str(e.from),
    to: str(e.to),
    event: str(e.event),
    result: result?.slice(0, 120),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Pure projection
// ---------------------------------------------------------------------------------------------------------------

export type LeaseStatus =
  | "NONE"
  | "RUNNING"
  | "HEARTBEAT_STALE"
  | "DEAD_HOLDER"
  | "UNKNOWN"
  | "NOT_MEASURED";

export type LivenessStatus =
  | "TICK_RUNNING"
  | "TICK_STALLED"
  | "RECENT"
  | "OFFLINE"
  | "UNKNOWN";

export interface LiveContext {
  now: number;
  intervalS: number;
  /** guard tick times (ms, not in the future, ascending) from the existing heartbeat */
  tickTimes: number[];
  /** result of the last guard line, if known */
  lastGuardResult?: string;
}

const KNOWN_DECISIONS = new Set(["GO", "GO A", "GO B", "REJECT"]);
const CODE_RE = /^[A-Z][A-Z0-9_]{0,59}$/;
const KNOWN_IDLE = new Set([
  "WAITING_OWNER",
  "OWNER_DECISION_NOT_TAKEN",
  "WAITING_REVIEW",
  "PAUSED",
  "LIMIT_HOLD",
  "LIMIT_WARNING",
  "QUEUE_FULL",
]);
const KNOWN_MODES = new Set(["hold", "run", "unknown"]);
const TICK_STATUS_RE = /^[a-z_]{1,40}$/;

export function projectLive(input: unknown, ctx: LiveContext) {
  const { now } = ctx;
  const gapMs = 2 * ctx.intervalS * 1000;
  const s = obj(input);

  // --- lease (running tick) ---
  const lease = s.lease === undefined ? undefined : obj(s.lease);
  const leaseHbAge = lease ? age(lease.heartbeat_at, now) : null;
  const leaseAcqAge = lease ? age(lease.acquired_at, now) : null;
  const leaseStatus: LeaseStatus = !lease
    ? "NOT_MEASURED"
    : lease.present !== true
      ? "NONE"
      : lease.readable !== true
        ? "UNKNOWN"
        : lease.holder === "dead"
          ? "DEAD_HOLDER"
          : lease.holder !== "alive"
            ? "UNKNOWN"
            : leaseHbAge === null
              ? "UNKNOWN"
              : leaseHbAge > LEASE_HEARTBEAT_STALE_MS
                ? "HEARTBEAT_STALE"
                : "RUNNING";
  const leaseReason: Record<LeaseStatus, string> = {
    NONE: "žádný tick neběží (runs/.lock neexistuje)",
    RUNNING: "tick běží: držitel žije, heartbeat čerstvý",
    HEARTBEAT_STALE: `tick běží, ale heartbeat stojí déle než ${LEASE_HEARTBEAT_STALE_MS / 60_000} min (dlouhé synchronní volání, nebo zaseknutí)`,
    DEAD_HOLDER:
      "zámek ticku drží proces, který prokazatelně neběží (další tick ho převezme)",
    UNKNOWN:
      lease && lease.present === true && lease.readable !== true
        ? "runs/.lock nejde přečíst: zda tick běží, je UNKNOWN"
        : lease?.holder === "not_checked"
          ? "držitel zámku neověřen (proces se nezkoumal): UNKNOWN"
          : "držitele zámku nebo čas heartbeatu nelze doložit: UNKNOWN",
    NOT_MEASURED: "neměřeno",
  };

  // --- tick end (runs/idle/status.json) ---
  const idle = s.idle === undefined ? undefined : obj(s.idle);
  const idleAge = idle ? age(idle.at, now) : null;
  const tickEndStatus = !idle
    ? "NOT_MEASURED"
    : idle.present !== true
      ? "MISSING"
      : idle.readable !== true || idleAge === null
        ? "UNKNOWN"
        : idleAge > gapMs
          ? "STALE"
          : "RECENT";
  const tickStatus =
    idle &&
    typeof idle.tick_status === "string" &&
    TICK_STATUS_RE.test(idle.tick_status)
      ? idle.tick_status
      : null;

  // --- wake gate ---
  const gate = s.gate === undefined ? undefined : obj(s.gate);
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v <= now ? v : undefined;
  const gateLast = gate ? num(gate.last_line_at) : undefined;
  const gateStarts = (gate && Array.isArray(gate.starts) ? gate.starts : [])
    .map(num)
    .filter((x): x is number => x !== undefined)
    .sort((a, b) => a - b);
  const gateEnds = (gate && Array.isArray(gate.ends) ? gate.ends : [])
    .map(num)
    .filter((x): x is number => x !== undefined)
    .sort((a, b) => a - b);
  const gateStatus = !gate
    ? "NOT_MEASURED"
    : gate.present !== true
      ? "NOT_INSTALLED"
      : gate.readable !== true
        ? "UNKNOWN"
        : gateLast === undefined
          ? "NO_RECORD"
          : now - gateLast > gapMs
            ? "STALE"
            : "RECENT";

  // --- liveness: newest heartbeat from any source ---
  const signals: { at: number; source: string }[] = [];
  const lastTick = ctx.tickTimes.at(-1);
  if (lastTick !== undefined)
    signals.push({ at: lastTick, source: "začátek ticku (guard v logu)" });
  if (idle && idleAge !== null && idle.readable === true)
    signals.push({ at: now - idleAge, source: "konec ticku (runs/idle)" });
  if (gateLast !== undefined && gate?.readable === true)
    signals.push({ at: gateLast, source: "brána probuzení (runs/wake)" });
  if (lease && lease.readable === true && leaseHbAge !== null)
    signals.push({
      at: now - leaseHbAge,
      source: "heartbeat ticku (runs/.lock)",
    });
  signals.sort((a, b) => a.at - b.at);
  const newest = signals.at(-1);
  const signalAge = newest ? now - newest.at : null;
  const liveness: LivenessStatus =
    leaseStatus === "RUNNING"
      ? "TICK_RUNNING"
      : leaseStatus === "HEARTBEAT_STALE"
        ? "TICK_STALLED"
        : signalAge === null
          ? "UNKNOWN"
          : signalAge > gapMs
            ? "OFFLINE"
            : "RECENT";
  const livenessReason: Record<LivenessStatus, string> = {
    TICK_RUNNING: "tick právě běží (držitel zámku žije, heartbeat čerstvý)",
    TICK_STALLED: leaseReason.HEARTBEAT_STALE,
    RECENT: "poslední heartbeat je mladší než 2 intervaly ticku",
    OFFLINE:
      "žádný heartbeat z žádného zdroje déle než 2 intervaly: Mac spí, je offline, nebo plánovač stojí (nerozlišeno)",
    UNKNOWN:
      "žádný heartbeat z žádného zdroje: offline, nebo TARS nikdy neběžel (nelze rozlišit), není to OK",
  };

  // --- tick without a recorded end ---
  // Only when the end record exists at all (newer code), no tick runs now and the last guard line was OK
  // (an ALARM tick and a "locked" tick never write an end record by design).
  const unfinishedTick =
    !idle ||
    idle.present !== true ||
    idle.readable !== true ||
    !lease ||
    lease.present === true ||
    lastTick === undefined ||
    idleAge === null
      ? null
      : ctx.lastGuardResult === "OK" &&
        now - lastTick >= UNFINISHED_GRACE_MS &&
        now - idleAge < lastTick;

  // --- system-level blockers ---
  const pendingRaw = idle && Array.isArray(idle.pending) ? idle.pending : [];
  const pendingDecisions = pendingRaw.map(obj).map((p) => ({
    order: orderId(p.order),
    value:
      typeof p.value === "string" && KNOWN_DECISIONS.has(p.value)
        ? p.value
        : "?",
    code:
      typeof p.code === "string" && CODE_RE.test(p.code) ? p.code : "UNKNOWN",
  }));
  const idleReason =
    idle && typeof idle.idle_reason === "string"
      ? KNOWN_IDLE.has(idle.idle_reason)
        ? idle.idle_reason
        : "UNKNOWN"
      : idle && idle.idle_reason === null
        ? null
        : undefined;
  const dispatch = s.dispatch === undefined ? undefined : obj(s.dispatch);
  // A dispatch-mode.json that exists but cannot be read must not be replaced by the older mode from idle/status.json.
  const dispatchBroken =
    dispatch !== undefined &&
    dispatch.present === true &&
    dispatch.readable !== true;
  const modeRaw = dispatchBroken
    ? undefined
    : dispatch && dispatch.readable === true
      ? dispatch.mode
      : idle?.dispatch_mode;
  const dispatchMode =
    typeof modeRaw === "string" && KNOWN_MODES.has(modeRaw)
      ? modeRaw
      : dispatch || idle
        ? "unknown"
        : null;
  const holdFile =
    dispatch && typeof dispatch.hold_file === "boolean"
      ? dispatch.hold_file
      : null;
  const limitHold =
    idle && typeof idle.limit_hold === "boolean" ? idle.limit_hold : null;
  // System completeness: a measured source (snapshot has it) that is missing or unreadable leaves the state UNKNOWN.
  const systemGaps: string[] = [];
  if (idle !== undefined) {
    if (idle.present !== true)
      systemGaps.push("runs/idle/status.json chybí: HOLD limitu je neznámý");
    else if (idle.readable !== true)
      systemGaps.push("runs/idle/status.json nejde přečíst");
    else if (limitHold === null)
      systemGaps.push("runs/idle/status.json neuvádí limit_hold");
  }
  if (dispatchBroken)
    systemGaps.push("runs/dispatch-mode.json nejde přečíst: režim je neznámý");
  // Readable source, but mode missing or not hold/run (e.g. `{}`): still an unknown system value.
  else if (dispatchMode === "unknown")
    systemGaps.push("režim dispatche chybí nebo není hold/run: režim je neznámý");
  // Readable idle/status.json whose idle_reason is not a known value must not pass as a healthy state.
  if (idle && idle.readable === true && idleReason === "UNKNOWN")
    systemGaps.push("runs/idle/status.json: neznámý idle_reason");
  if (dispatch !== undefined && dispatch.hold_file === undefined)
    systemGaps.push("existenci runs/HOLD nejde ověřit");
  const blockers: string[] = [];
  if (holdFile === true)
    blockers.push(
      "runs/HOLD existuje: globální HOLD, dispatcher nic nového nezačne",
    );
  if (limitHold === true)
    blockers.push(
      "HOLD limitu předplatného: nová práce nezačne (runs/limit-guard)",
    );
  if (pendingDecisions.length)
    blockers.push(
      `nepřevzatá rozhodnutí vlastníka: ${pendingDecisions.map((p) => `${p.order} ${p.value} (${p.code})`).join(", ")}`,
    );
  if (leaseStatus === "DEAD_HOLDER") blockers.push(leaseReason.DEAD_HOLDER);
  if (unfinishedTick === true)
    blockers.push(
      "poslední tick skončil bez záznamu konce (pád, ukončení procesu, nebo chyba zápisu runs/idle)",
    );

  return {
    liveness: {
      status: liveness,
      reason: livenessReason[liveness],
      lastSignalAt: newest ? iso(newest.at) : null,
      lastSignalSource: newest?.source ?? null,
      ageMs: signalAge,
      thresholdMs: gapMs,
      lease: {
        status: leaseStatus,
        reason: leaseReason[leaseStatus],
        pid:
          lease && typeof lease.pid === "number" && Number.isInteger(lease.pid)
            ? lease.pid
            : null,
        acquiredAt: leaseAcqAge === null ? null : iso(now - leaseAcqAge),
        runningMs: leaseAcqAge,
        heartbeatAt: leaseHbAge === null ? null : iso(now - leaseHbAge),
        heartbeatAgeMs: leaseHbAge,
      },
      tickEnd: {
        status: tickEndStatus,
        at: idleAge === null ? null : iso(now - idleAge),
        ageMs: idleAge,
        tickStatus,
      },
      gate: {
        status: gateStatus,
        lastLineAt: gateLast === undefined ? null : iso(gateLast),
        ageMs: gateLast === undefined ? null : now - gateLast,
        lastStartAt: gateStarts.length ? iso(gateStarts.at(-1)!) : null,
        lastEndAt: gateEnds.length ? iso(gateEnds.at(-1)!) : null,
        starts: gateStarts.length,
        errors: gate && typeof gate.errors === "number" ? gate.errors : null,
      },
      unfinishedTick,
    },
    system: {
      status: !idle && !dispatch ? "NOT_MEASURED" : "MEASURED",
      /** UNKNOWN = a measured system source is missing or unreadable (never reported as a healthy state) */
      completeness:
        !idle && !dispatch
          ? "NOT_MEASURED"
          : systemGaps.length
            ? "UNKNOWN"
            : "COMPLETE",
      gaps: systemGaps,
      idleReason: idleReason === undefined ? null : idleReason,
      idleDetail: idle ? (text(idle.detail, 300) ?? null) : null,
      tickStatus,
      pendingDecisions,
      limitHold,
      dispatchMode,
      holdFile,
      blockers,
    },
    /** ticks after the first gate start that no gate start precedes within the window (manual `cli.ts tick`) */
    outsideGateTicks:
      gateStatus === "NOT_MEASURED" ||
      gateStatus === "NOT_INSTALLED" ||
      gateStatus === "UNKNOWN" ||
      !gateStarts.length
        ? null
        : ctx.tickTimes.filter(
            (t) =>
              t >= gateStarts[0] &&
              !gateStarts.some((g) => g <= t && t - g <= GATE_TICK_WINDOW_MS),
          ).length,
  };
}

export type LiveReport = ReturnType<typeof projectLive>;

/**
 * Manual interventions visible in the log (30-day measurement of fable-audit-mezer): manual abort, owner decision
 * through `cli.ts owner` (source "owner …", not "Notion …"), card reissue, granted gpt-retry, and an overwritten state
 * (a transition whose `from` differs from the previous `to` of the same order: a hand edit of state.json or a lost
 * update). Raw `result` text is only matched, never returned.
 */
export function manualFromLog(
  lines: unknown,
  readable: boolean,
  outsideGateTicks: number | null,
) {
  const L = (Array.isArray(lines) ? lines : []).map(obj);
  const counts = {
    abort: 0,
    ownerCli: 0,
    reissue: 0,
    gptRetry: 0,
    overwrittenState: 0,
  };
  const byOrder = new Map<string, number>();
  const bump = (o: unknown, k: keyof typeof counts) => {
    counts[k]++;
    const id = orderId(o);
    byOrder.set(id, (byOrder.get(id) ?? 0) + 1);
  };
  const lastTo = new Map<string, string>();
  // Time from the log is returned only as a normalized ISO string, never as the original text.
  let sinceMs: number | null = null;
  for (const e of L) {
    const result = typeof e.result === "string" ? e.result : "";
    if (typeof e.ts === "string") {
      const ms = Date.parse(e.ts);
      if (Number.isFinite(ms) && (sinceMs === null || ms < sinceMs))
        sinceMs = ms;
    }
    if (e.kind === "transition") {
      if (result === "manual abort") bump(e.order, "abort");
      if (e.event === "reissue") bump(e.order, "reissue");
      const o = typeof e.order === "string" ? e.order : "";
      const prev = lastTo.get(o);
      if (prev !== undefined && typeof e.from === "string" && e.from !== prev)
        bump(e.order, "overwrittenState");
      if (typeof e.to === "string") lastTo.set(o, e.to);
    }
    if (/^owner (GO|REJECT)\b[^(]*\(owner /.test(result))
      bump(e.order, "ownerCli");
    if (e.event === "gpt-retry" && e.kind === "info") bump(e.order, "gptRetry");
  }
  return {
    status: readable ? "MEASURED" : "UNKNOWN",
    source: "runs/log.jsonl",
    since:
      readable && sinceMs !== null ? new Date(sinceMs).toISOString() : null,
    ...counts,
    total: readable ? Object.values(counts).reduce((a, b) => a + b, 0) : null,
    outsideGateTicks,
    byOrder: [...byOrder.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)),
  };
}
