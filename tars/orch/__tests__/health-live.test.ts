// Etapa 5, PR 2a: real heartbeat (tick lease, tick end, wake gate), offline / no heartbeat, system blockers,
// manual interventions from the log, effect gate HOLD and the compact phone form. Read only: the collector never
// writes, creates or locks anything (mtime check).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  auditHealth,
  collectSnapshot,
  formatHealth,
  formatHealthCompact,
} from "../audit-health";
import {
  collectGate,
  collectIdle,
  collectLease,
  manualFromLog,
  projectLive,
} from "../health-live";

const now = Date.parse("2026-11-06T00:00:00Z");
const ago = (min: number) => new Date(now - min * 60_000).toISOString();
const ROOT = path.resolve(__dirname, "..", "..", "..");
const TSX = path.join(ROOT, "node_modules", "tsx", "dist", "loader.mjs");

/** A snapshot with everything measured and nothing wrong: the base for single-signal changes. */
function healthy(over: Record<string, unknown> = {}, liveOver = {}) {
  return {
    observed_at: ago(0),
    runs_readable: true,
    orders: [],
    unreadable_orders: [],
    log: {
      readable: true,
      mtime: ago(5),
      ticks: [ago(65), ago(35), ago(5)],
      ticks_alarm: 0,
      guards: [
        { ts: ago(65), result: "OK" },
        { ts: ago(35), result: "OK" },
        { ts: ago(5), result: "OK" },
      ],
      bad_lines: 0,
      bad_lines_in_window: 0,
      bad_lines_after_last_guard: 0,
      manual: [],
    },
    live: {
      lease: { present: false },
      idle: {
        present: true,
        readable: true,
        at: ago(4),
        tick_status: "waiting_review",
        idle_reason: "WAITING_REVIEW",
        detail: "zakázka wo-1 čeká na kontrolu",
        pending: [],
        limit_hold: false,
        dispatch_mode: "hold",
      },
      gate: { present: false },
      dispatch: {
        present: true,
        readable: true,
        mode: "hold",
        observed_at: ago(5),
        hold_file: false,
      },
      ...liveOver,
    },
    ...over,
  };
}

describe("health-live: tick lease (runs/.lock)", () => {
  const lease = (l: Record<string, unknown>) =>
    auditHealth(
      healthy({}, { lease: { present: true, readable: true, pid: 42, ...l } }),
      now,
    ).liveness;

  it("žádný zámek = NONE; živý držitel s čerstvým heartbeatem = TICK_RUNNING a ověřená živost procesu", () => {
    expect(auditHealth(healthy(), now).liveness.lease.status).toBe("NONE");
    const r = auditHealth(
      healthy(
        {},
        {
          lease: {
            present: true,
            readable: true,
            pid: 42,
            acquired_at: ago(17),
            heartbeat_at: ago(0.5),
            holder: "alive",
          },
        },
      ),
      now,
    );
    expect(r.liveness.status).toBe("TICK_RUNNING");
    expect(r.liveness.lease.runningMs).toBe(17 * 60_000);
    expect(r.processLiveness).toBe("VERIFIED_TICK_RUNNING");
  });

  it("živý držitel, heartbeat starší než 5 min = TICK_STALLED a POZOR", () => {
    const r = auditHealth(
      healthy(
        {},
        {
          lease: {
            present: true,
            readable: true,
            pid: 42,
            heartbeat_at: ago(12),
            holder: "alive",
          },
        },
      ),
      now,
    );
    expect(r.liveness.lease.status).toBe("HEARTBEAT_STALE");
    expect(r.liveness.status).toBe("TICK_STALLED");
    expect(r.overall).toBe("ATTENTION");
    expect(r.processLiveness).toBe("NOT_VERIFIED");
  });

  it("mrtvý držitel = DEAD_HOLDER, systémová blokace a POZOR", () => {
    const r = auditHealth(
      healthy(
        {},
        {
          lease: {
            present: true,
            readable: true,
            pid: 42,
            heartbeat_at: ago(1),
            holder: "dead",
          },
        },
      ),
      now,
    );
    expect(r.liveness.lease.status).toBe("DEAD_HOLDER");
    expect(r.system.blockers.join(" ")).toMatch(/prokazatelně neběží/);
    expect(r.overall).toBe("ATTENTION");
  });

  it("nečitelný zámek, neověřený nebo neznámý držitel = UNKNOWN (nikdy běží ani neběží)", () => {
    for (const l of [
      { readable: false },
      { holder: "not_checked", heartbeat_at: ago(0) },
      { holder: "unknown", heartbeat_at: ago(0) },
      { holder: "alive" }, // bez času heartbeatu
      { holder: "alive", heartbeat_at: "2026-11-07T00:00:00Z" }, // budoucí čas
    ]) {
      const r = auditHealth(
        healthy(
          {},
          { lease: { present: true, readable: true, pid: 42, ...l } },
        ),
        now,
      );
      expect(r.liveness.lease.status).toBe("UNKNOWN");
      expect(r.overall).toBe("UNKNOWN");
    }
    expect(lease({ holder: "not_checked" }).lease.reason).toMatch(/neověřen/);
  });

  it("dlouhý tick: starý guard heartbeat při běžícím ticku není nález", () => {
    const r = auditHealth(
      healthy(
        {
          log: {
            ...healthy().log,
            ticks: [ago(95)],
            guards: [{ ts: ago(95), result: "OK" }],
          },
        },
        {
          lease: {
            present: true,
            readable: true,
            pid: 42,
            acquired_at: ago(95),
            heartbeat_at: ago(0.5),
            holder: "alive",
          },
          idle: { ...healthy().live.idle, at: ago(100) },
        },
      ),
      now,
    );
    expect(r.heartbeat.status).toBe("STALE");
    expect(r.liveness.status).toBe("TICK_RUNNING");
    expect(r.overall).toBe("NO_FINDINGS");
  });
});

describe("health-live: offline / žádný heartbeat", () => {
  it("všechny zdroje starší než 2 intervaly = OFFLINE a POZOR", () => {
    const r = auditHealth(
      healthy(
        {
          log: {
            ...healthy().log,
            ticks: [ago(200)],
            guards: [{ ts: ago(200), result: "OK" }],
          },
        },
        {
          idle: { ...healthy().live.idle, at: ago(199) },
          gate: {
            present: true,
            readable: true,
            last_line_at: now - 190 * 60_000,
            starts: [],
            ends: [],
            errors: 0,
          },
        },
      ),
      now,
    );
    expect(r.liveness.status).toBe("OFFLINE");
    expect(r.liveness.ageMs).toBe(190 * 60_000);
    expect(r.liveness.lastSignalSource).toMatch(/brána/);
    expect(r.liveness.reason).toMatch(
      /Mac spí, je offline, nebo plánovač stojí/,
    );
    expect(r.overall).toBe("ATTENTION");
  });

  it("žádný heartbeat z žádného zdroje = UNKNOWN, nikdy OK", () => {
    const r = auditHealth(
      healthy(
        { log: { ...healthy().log, ticks: [], guards: [] } },
        {
          idle: { present: false },
          gate: { present: false },
          lease: { present: false },
        },
      ),
      now,
    );
    expect(r.liveness.status).toBe("UNKNOWN");
    expect(r.liveness.lastSignalAt).toBe(null);
    expect(r.overall).toBe("UNKNOWN");
    expect(formatHealth(r)).toMatch(/Živost .*: UNKNOWN — žádný heartbeat/);
  });

  it("zdroj z budoucnosti se ignoruje (budoucí hodiny nejsou čerstvý heartbeat)", () => {
    const r = auditHealth(
      healthy(
        {
          log: {
            ...healthy().log,
            ticks: [ago(200)],
            guards: [{ ts: ago(200), result: "OK" }],
          },
        },
        {
          idle: { ...healthy().live.idle, at: "2026-11-07T00:00:00Z" },
          gate: {
            present: true,
            readable: true,
            last_line_at: now + 3600_000,
            starts: [],
            ends: [],
            errors: 0,
          },
        },
      ),
      now,
    );
    expect(r.liveness.status).toBe("OFFLINE");
    expect(r.liveness.tickEnd.status).toBe("UNKNOWN");
    expect(r.overall).toBe("UNKNOWN");
  });

  it("čerstvý konec ticku = RECENT; bez nálezů jen když je vše změřeno", () => {
    const r = auditHealth(healthy(), now);
    expect(r.liveness.status).toBe("RECENT");
    expect(r.liveness.tickEnd).toMatchObject({
      status: "RECENT",
      tickStatus: "waiting_review",
    });
    expect(r.overall).toBe("NO_FINDINGS");
  });
});

describe("health-live: konec ticku (runs/idle)", () => {
  it("chybějící záznam = MISSING (informace, ne nález); nečitelný = UNKNOWN", () => {
    const m = auditHealth(healthy({}, { idle: { present: false } }), now);
    expect(m.liveness.tickEnd.status).toBe("MISSING");
    expect(m.liveness.unfinishedTick).toBe(null);
    // 5b-K1-1: missing idle/status.json = limitHold unknown, never a healthy NO_FINDINGS
    expect(m.system.completeness).toBe("UNKNOWN");
    expect(m.system.limitHold).toBe(null);
    expect(m.overall).toBe("UNKNOWN");
    const u = auditHealth(
      healthy({}, { idle: { present: true, readable: false } }),
      now,
    );
    expect(u.liveness.tickEnd.status).toBe("UNKNOWN");
    expect(u.overall).toBe("UNKNOWN");
  });

  it("nečitelný dispatch-mode.json se nenahradí starším režimem z idle = UNKNOWN", () => {
    const r = auditHealth(
      healthy(
        {},
        {
          idle: { ...healthy().live.idle, dispatch_mode: "run" },
          dispatch: { present: true, readable: false, hold_file: false },
        },
      ),
      now,
    );
    expect(r.system.dispatchMode).toBe("unknown");
    expect(r.system.completeness).toBe("UNKNOWN");
    expect(r.overall).toBe("UNKNOWN");
  });

  it.each([{}, { mode: "x" }, { mode: 1 }])(
    "čitelný dispatch-mode.json s neplatným režimem %j = UNKNOWN",
    (file) => {
      const r = auditHealth(
        healthy(
          {},
          {
            dispatch: {
              present: true,
              readable: true,
              hold_file: false,
              ...file,
            },
          },
        ),
        now,
      );
      expect(r.system.dispatchMode).toBe("unknown");
      expect(r.system.completeness).toBe("UNKNOWN");
      expect(r.overall).toBe("UNKNOWN");
    },
  );

  it("log s časem plus tokenem v ts nevrátí původní text (jen normalizované ISO)", () => {
    const m = manualFromLog(
      [
        {
          ts: "Nov 5 2026 10:00:00 UTC (token=ghp_SYNTHETIC123)",
          order: "o1",
          kind: "transition",
          result: "manual abort",
        },
      ],
      true,
      null,
    );
    expect(m.since).toBe(new Date("2026-11-05T10:00:00Z").toISOString());
    expect(JSON.stringify(m)).not.toMatch(/ghp_SYNTHETIC123|token/);
  });

  it("tick začal (guard OK), neběží a nezapsal konec = nedokončený tick, blokace", () => {
    const r = auditHealth(
      healthy({}, { idle: { ...healthy().live.idle, at: ago(40) } }),
      now,
    );
    expect(r.liveness.unfinishedTick).toBe(true);
    expect(r.system.blockers.join(" ")).toMatch(/bez záznamu konce/);
    expect(r.overall).toBe("ATTENTION");
  });

  it("ALARM tick, běžící tick a čerstvý guard (do 60 s) nejsou nedokončený tick", () => {
    const alarm = healthy(
      {
        log: {
          ...healthy().log,
          guards: [
            ...healthy().log.guards.slice(0, 2),
            { ts: ago(5), result: "ALARM" },
          ],
        },
      },
      { idle: { ...healthy().live.idle, at: ago(40) } },
    );
    expect(auditHealth(alarm, now).liveness.unfinishedTick).toBe(false);
    const running = healthy(
      {},
      {
        idle: { ...healthy().live.idle, at: ago(40) },
        lease: {
          present: true,
          readable: true,
          pid: 1,
          heartbeat_at: ago(0),
          holder: "alive",
        },
      },
    );
    expect(auditHealth(running, now).liveness.unfinishedTick).toBe(null);
    const fresh = healthy(
      {
        log: {
          ...healthy().log,
          ticks: [ago(0.5)],
          guards: [{ ts: ago(0.5), result: "OK" }],
        },
      },
      { idle: { ...healthy().live.idle, at: ago(40) } },
    );
    expect(auditHealth(fresh, now).liveness.unfinishedTick).toBe(false);
  });
});

describe("health-live: brána probuzení (runs/wake)", () => {
  it("bez runs/wake = NOT_INSTALLED a ticky mimo bránu NEMĚŘENO", () => {
    const r = auditHealth(healthy(), now);
    expect(r.liveness.gate.status).toBe("NOT_INSTALLED");
    expect(r.manualInterventions.fromLog.outsideGateTicks).toBe(null);
  });

  it("ticky bez startu brány po její instalaci se počítají jako mimo bránu (ruční cli tick)", () => {
    const starts = [now - 65 * 60_000 - 5000, now - 5 * 60_000 - 8000];
    const r = auditHealth(
      healthy(
        {},
        {
          gate: {
            present: true,
            readable: true,
            last_line_at: starts[1],
            starts,
            ends: [starts[0] + 60_000],
            errors: 0,
          },
        },
      ),
      now,
    );
    expect(r.liveness.gate.status).toBe("RECENT");
    expect(r.liveness.gate.starts).toBe(2);
    expect(r.manualInterventions.fromLog.outsideGateTicks).toBe(1); // tick před 35 min
  });

  it("stará brána = STALE; nečitelná = UNKNOWN; bez záznamu = NO_RECORD", () => {
    const g = (gate: Record<string, unknown>) =>
      auditHealth(healthy({}, { gate }), now).liveness.gate.status;
    expect(
      g({
        present: true,
        readable: true,
        last_line_at: now - 3 * 3600_000,
        starts: [],
        ends: [],
      }),
    ).toBe("STALE");
    expect(g({ present: true, readable: false })).toBe("UNKNOWN");
    expect(g({ present: true, readable: true, starts: [], ends: [] })).toBe(
      "NO_RECORD",
    );
  });
});

describe("health-live: systémové blokace", () => {
  it("nepřevzaté rozhodnutí vlastníka je blokace; neznámé hodnoty se nahradí", () => {
    const r = auditHealth(
      healthy(
        {},
        {
          idle: {
            ...healthy().live.idle,
            idle_reason: "OWNER_DECISION_NOT_TAKEN",
            pending: [
              { order: "wo-1", value: "GO", code: "OWNER_ORIGIN_UNVERIFIED" },
              {
                order: "../etc",
                value: "CANARY_DO_NOT_ECHO",
                code: "lower case CANARY",
              },
            ],
          },
        },
      ),
      now,
    );
    expect(r.system.idleReason).toBe("OWNER_DECISION_NOT_TAKEN");
    expect(r.system.pendingDecisions).toEqual([
      { order: "wo-1", value: "GO", code: "OWNER_ORIGIN_UNVERIFIED" },
      { order: "<neplatné id>", value: "?", code: "UNKNOWN" },
    ]);
    expect(r.overall).toBe("ATTENTION");
    expect(JSON.stringify(r)).not.toContain("CANARY");
  });

  it("runs/HOLD a HOLD limitu jsou blokace; neznámý režim dispatcheru = unknown", () => {
    const r = auditHealth(
      healthy(
        {},
        {
          idle: { ...healthy().live.idle, limit_hold: true },
          dispatch: {
            present: true,
            readable: true,
            mode: "turbo",
            hold_file: true,
          },
        },
      ),
      now,
    );
    expect(r.system.blockers).toHaveLength(2);
    expect(r.system.dispatchMode).toBe("unknown");
    expect(r.system.holdFile).toBe(true);
    // invalid mode = incomplete system data: UNKNOWN wins over ATTENTION, blockers stay listed
    expect(r.system.completeness).toBe("UNKNOWN");
    expect(r.overall).toBe("UNKNOWN");
  });

  it("neměřený systém = NOT_MEASURED, chybějící údaje UNKNOWN (null), ne „ne“", () => {
    const s = projectLive({}, { now, intervalS: 1800, tickTimes: [] }).system;
    expect(s.status).toBe("NOT_MEASURED");
    expect(s.limitHold).toBe(null);
    expect(s.holdFile).toBe(null);
    expect(s.dispatchMode).toBe(null);
  });

  it("brána efektu v HOLD a nečitelný záznam brány jsou blokace zakázky", () => {
    const r = auditHealth(
      healthy({
        orders: [
          {
            id: "wo-r1",
            state: "DELIVERED",
            manual_interventions: 0,
            gates: [
              {
                state: "HOLD",
                hold: "EFFECT_NOT_ALLOWED: rodič není soukromý",
                at: ago(10),
              },
              { state: "DONE", at: ago(20) },
            ],
            gates_unreadable: 1,
          },
        ],
      }),
      now,
    );
    expect(r.blocked.map((b) => b.reason)).toEqual([
      "brána efektu HOLD: EFFECT_NOT_ALLOWED: rodič není soukromý",
      "brána efektu: 1 záznam(y) nečitelné nebo neplatné, stav brány UNKNOWN",
    ]);
    expect(r.activeBlocks).toBe(2);
  });
});

describe("health-live: ruční zásahy z logu", () => {
  const L = [
    {
      ts: "2026-11-02T10:00:00Z",
      order: "wo-1",
      kind: "transition",
      from: "NEW",
      to: "DOING",
      event: "start",
      result: "x",
    },
    {
      ts: "2026-11-02T10:05:00Z",
      order: "wo-1",
      kind: "transition",
      from: "DOING",
      to: "FAILED",
      event: "fail",
      result: "manual abort",
    },
    {
      ts: "2026-11-02T11:00:00Z",
      order: "wo-1",
      kind: "transition",
      from: "DELIVERED",
      to: "WAITING_OWNER",
      event: "delivered",
      result: "CANARY_DO_NOT_ECHO",
    },
    {
      ts: "2026-11-02T12:00:00Z",
      order: "wo-2",
      kind: "transition",
      from: "WAITING_OWNER",
      to: "DELIVERED",
      event: "reissue",
      result: "karta znovuvydána",
    },
    {
      ts: "2026-11-02T12:10:00Z",
      order: "wo-2",
      kind: "info",
      result: "owner GO (owner GO) přijato, čeká na read-back",
    },
    {
      ts: "2026-11-02T12:20:00Z",
      order: "wo-3",
      kind: "info",
      result: "owner GO (Notion GO) přijato, čeká na read-back",
    },
    {
      ts: "2026-11-02T12:30:00Z",
      order: "wo-3",
      kind: "transition",
      from: "WAITING_OWNER",
      to: "FAILED",
      event: "owner",
      result: "owner REJECT (owner REJECT)",
    },
    {
      ts: "2026-11-02T12:40:00Z",
      order: "wo-4",
      kind: "info",
      event: "gpt-retry",
      result: "gpt-retry povolen: …",
    },
    {
      ts: "2026-11-02T12:41:00Z",
      order: "wo-4",
      kind: "error",
      event: "gpt-retry",
      result: "gpt-retry odmítnut",
    },
  ];

  it("abort, owner přes CLI (ne z Notionu), znovuvydání, povolený gpt-retry a přepsaný stav", () => {
    const m = manualFromLog(L, true, 2);
    expect(m).toMatchObject({
      status: "MEASURED",
      abort: 1,
      ownerCli: 2,
      reissue: 1,
      gptRetry: 1,
      overwrittenState: 1, // FAILED → (další přechod z DELIVERED)
      total: 6,
      outsideGateTicks: 2,
      since: "2026-11-02T10:00:00.000Z",
    });
    expect(m.byOrder[0]).toEqual({ id: "wo-1", count: 2 });
    expect(JSON.stringify(m)).not.toContain("CANARY");
  });

  it("nečitelný log = UNKNOWN a celkový počet null (ne 0)", () => {
    const m = manualFromLog(undefined, false, null);
    expect(m.status).toBe("UNKNOWN");
    expect(m.total).toBe(null);
    const r = auditHealth({ ...healthy(), log: { readable: false } }, now);
    expect(r.manualInterventions.fromLog.status).toBe("UNKNOWN");
    expect(formatHealth(r)).toMatch(/Ruční zásahy v logu: UNKNOWN/);
  });
});

describe("health-live: kompaktní přehled pro telefon", () => {
  it("nese vlastní čas, stav a živost; nejvýš 600 znaků", () => {
    const off = auditHealth(
      healthy(
        {
          log: {
            ...healthy().log,
            ticks: [ago(300)],
            guards: [{ ts: ago(300), result: "OK" }],
          },
        },
        { idle: { ...healthy().live.idle, at: ago(299) } },
      ),
      now,
    );
    const c = formatHealthCompact(off, now);
    expect(c).toMatch(/^TARS POZOR · stav k /);
    expect(c).toMatch(/živost OFFLINE \(heartbeat před 4 h 59 min\)/);
    expect(c.length).toBeLessThanOrEqual(600);
    expect(formatHealthCompact(auditHealth({}, now), now)).toMatch(
      /^TARS UNKNOWN .*živost UNKNOWN.*ruční zásahy UNKNOWN.*režim UNKNOWN/,
    );
  });
});

// ---- sběr z disku ----

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "health-live-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function mtimes(root: string): Record<string, bigint> {
  const out: Record<string, bigint> = {};
  const walk = (p: string) => {
    out[p] = fs.statSync(p, { bigint: true }).mtimeNs;
    if (fs.statSync(p).isDirectory())
      for (const c of fs.readdirSync(p)) walk(path.join(p, c));
  };
  walk(root);
  return out;
}

function writeLive(runs: string): void {
  fs.mkdirSync(path.join(runs, "idle"), { recursive: true });
  fs.mkdirSync(path.join(runs, "wake"), { recursive: true });
  fs.mkdirSync(path.join(runs, "wo-r1", "gate"), { recursive: true });
  fs.writeFileSync(
    path.join(runs, ".lock"),
    JSON.stringify({
      token: "t",
      fence: 3,
      pid: 4242,
      started: "x",
      acquired_at: ago(3),
      heartbeat_at: ago(0.5),
    }),
  );
  fs.writeFileSync(
    path.join(runs, "idle", "status.json"),
    JSON.stringify({
      v: 1,
      at: ago(30),
      tick_status: "waiting_owner",
      idle_reason: "OWNER_DECISION_NOT_TAKEN",
      detail: "wo-r1: GO nepřijato",
      overview: {
        runnable: [],
        waiting_owner: ["wo-r1"],
        resource_locks: 0,
        limit_hold: false,
        dispatch_mode: "hold",
        pending_decisions: [
          {
            order: "wo-r1",
            value: "GO",
            code: "OWNER_ORIGIN_UNVERIFIED",
            detail: "x",
          },
        ],
      },
    }),
  );
  const e = (min: number) => Math.floor((now - min * 60_000) / 1000);
  fs.writeFileSync(
    path.join(runs, "wake", "gate.log"),
    [
      `${e(34)} tick reason=b claim=0/0`,
      `${e(31)} tick end rc=0`,
      `${e(4)} tick reason=a next_wake=1 wake_late_by_s=3 claim=1/0`,
      `${e(4)} chyba: TARS_GATE_TICK není nastavený, tick nespuštěn`,
      "nesmysl",
    ].join("\n") + "\n",
  );
  fs.writeFileSync(
    path.join(runs, "dispatch-mode.json"),
    JSON.stringify({ mode: "hold", observed_at: ago(3) }),
  );
  fs.writeFileSync(path.join(runs, "HOLD"), "");
  fs.writeFileSync(
    path.join(runs, "wo-r1", "state.json"),
    JSON.stringify({
      id: "wo-r1",
      state: "WAITING_OWNER",
      manual_interventions: 0,
      history: [],
      meta: {},
    }),
  );
  fs.writeFileSync(
    path.join(runs, "wo-r1", "gate", "deliver-r0.json"),
    JSON.stringify({
      v: 1,
      state: "HOLD",
      hold: "SCOPE_REVOKED: x",
      history: [{ state: "HOLD", at: ago(20) }],
    }),
  );
  fs.writeFileSync(path.join(runs, "wo-r1", "gate", "card-r0.json"), "{broken");
  fs.writeFileSync(
    path.join(runs, "log.jsonl"),
    [
      { ts: ago(33), order: "-", kind: "guard", result: "OK" },
      { ts: ago(3), order: "-", kind: "guard", result: "OK" },
      {
        ts: ago(2),
        order: "wo-r1",
        kind: "transition",
        from: "NEW",
        to: "FAILED",
        event: "fail",
        result: "manual abort",
      },
    ]
      .map((x) => JSON.stringify(x))
      .join("\n") + "\n",
  );
}

describe("health-live: sběr z runs/ (jen čtení)", () => {
  it("lease, konec ticku, brána, režim, runs/HOLD, brána efektu a ruční zásah z disku", () => {
    const runs = path.join(dir, "runs");
    writeLive(runs);
    const seen: unknown[] = [];
    const snap = collectSnapshot(runs, {
      now: () => new Date(now),
      launchd: null,
      probe: (l) => {
        seen.push(l.pid);
        return "alive";
      },
    });
    const r = auditHealth(snap, now);
    expect(seen).toEqual([4242]);
    expect(r.liveness.status).toBe("TICK_RUNNING");
    expect(r.liveness.tickEnd.tickStatus).toBe("waiting_owner");
    expect(r.liveness.gate).toMatchObject({
      status: "RECENT",
      starts: 2,
      errors: 1,
    });
    expect(r.system.holdFile).toBe(true);
    expect(r.system.pendingDecisions).toHaveLength(1);
    expect(r.manualInterventions.fromLog).toMatchObject({
      abort: 1,
      outsideGateTicks: 0,
    });
    expect(
      r.blocked.filter((b) => b.kind === "HOLD").map((b) => b.reason),
    ).toEqual([
      "brána efektu HOLD: SCOPE_REVOKED: x",
      "brána efektu: 1 záznam(y) nečitelné nebo neplatné, stav brány UNKNOWN",
    ]);
    expect(r.schema).toBe("tars-audit-health/v4");
  });

  it("sběr nic nezapíše ani nevytvoří (mtime všech souborů a adresářů stejný)", () => {
    const runs = path.join(dir, "runs");
    writeLive(runs);
    const before = mtimes(runs);
    auditHealth(
      collectSnapshot(runs, {
        now: () => new Date(now),
        launchd: null,
        probe: () => "dead",
      }),
      now,
    );
    expect(mtimes(runs)).toEqual(before);
  });

  it("chybějící soubory = změřená nepřítomnost; runs/idle ani runs/wake se nevytvoří", () => {
    const runs = path.join(dir, "runs");
    fs.mkdirSync(runs);
    expect(collectLease(runs, { probe: null })).toEqual({ present: false });
    expect(collectIdle(runs)).toEqual({ present: false });
    expect(collectGate(runs)).toEqual({ present: false });
    expect(fs.readdirSync(runs)).toEqual([]);
    const r = auditHealth(
      collectSnapshot(runs, { launchd: null, probe: null }),
      now,
    );
    expect(r.liveness.lease.status).toBe("NONE");
    expect(r.liveness.status).toBe("UNKNOWN"); // žádný heartbeat z žádného zdroje
    expect(r.overall).toBe("UNKNOWN");
  });

  it("nečitelný zámek a stav nečinnosti = UNKNOWN; sonda se bez čitelného zámku nevolá", () => {
    const runs = path.join(dir, "runs");
    fs.mkdirSync(path.join(runs, "idle"), { recursive: true });
    fs.writeFileSync(path.join(runs, ".lock"), "{broken");
    fs.writeFileSync(path.join(runs, "idle", "status.json"), "{broken");
    let called = false;
    const l = collectLease(runs, { probe: () => ((called = true), "alive") });
    expect(l).toEqual({ present: true, readable: false });
    expect(called).toBe(false);
    expect(collectIdle(runs)).toEqual({ present: true, readable: false });
  });

  describe("idle_reason: chybějící klíč vs. neplatná hodnota", () => {
    const withIdleReason = (patch: Record<string, unknown>) => {
      const runs = path.join(dir, "runs");
      fs.mkdirSync(path.join(runs, "idle"), { recursive: true });
      fs.writeFileSync(
        path.join(runs, "idle", "status.json"),
        JSON.stringify({
          v: 1,
          at: new Date(now).toISOString(),
          tick_status: "waiting_review",
          detail: "x",
          overview: { limit_hold: false, dispatch_mode: "run" },
          ...patch,
        }),
      );
      const idle = collectIdle(runs);
      return {
        idle,
        report: auditHealth(
          healthy({}, { idle: { ...healthy().live.idle, ...idle } }),
          now,
        ),
      };
    };

    it.each([
      ["prázdný řetězec", ""],
      ["číslo", 1],
      ["objekt", {}],
    ])("neplatná hodnota (%s) → UNKNOWN, ne NO_FINDINGS", (_n, bad) => {
      const { idle, report } = withIdleReason({ idle_reason: bad });
      expect(idle.idle_reason).toBe(typeof bad === "string" ? bad : "");
      expect(report.system.idleReason).toBe("UNKNOWN");
      expect(report.system.completeness).toBe("UNKNOWN");
      expect(report.overall).toBe("UNKNOWN");
    });

    it("null bez tick_status → UNKNOWN", () => {
      const { report } = withIdleReason({
        idle_reason: null,
        tick_status: undefined,
      });
      expect(report.system.completeness).toBe("UNKNOWN");
      expect(report.overall).toBe("UNKNOWN");
    });

    it("platná hodnota a null s tick_status zůstávají beze změny", () => {
      const ok = withIdleReason({ idle_reason: "WAITING_REVIEW" });
      expect(ok.idle.idle_reason).toBe("WAITING_REVIEW");
      expect(ok.report.system.idleReason).toBe("WAITING_REVIEW");
      const worked = withIdleReason({ idle_reason: null });
      expect(worked.idle.idle_reason).toBeNull();
      expect(worked.report.system.idleReason).toBeNull();
    });

    it("chybějící klíč zůstává undefined (beze změny)", () => {
      const { idle } = withIdleReason({});
      expect(idle.idle_reason).toBeUndefined();
    });
  });

  it("selhání sondy držitele = unknown (ne běží)", () => {
    const runs = path.join(dir, "runs");
    writeLive(runs);
    const l = collectLease(runs, {
      probe: () => {
        throw new Error("ps selhal");
      },
    });
    expect(l.holder).toBe("unknown");
  });
});

describe("cli.ts health --compact", () => {
  it("vypíše jeden kompaktní řádek a nic v runs/ nezmění", () => {
    const runs = path.join(dir, "runs");
    writeLive(runs);
    const before = mtimes(runs);
    const r = spawnSync(
      process.execPath,
      [
        "--import",
        TSX,
        path.join(ROOT, "tars", "orch", "cli.ts"),
        "health",
        "--compact",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, TARS_RUNS_DIR: runs, TARS_HEALTH_LAUNCHD: "0" },
        timeout: 60_000,
      },
    );
    expect(r.status).toBe(0);
    expect(r.stdout.trim().split("\n")).toHaveLength(1);
    expect(r.stdout).toMatch(/^TARS (POZOR|UNKNOWN) · stav k .* · živost /);
    expect(mtimes(runs)).toEqual(before);
  }, 60_000);
});
