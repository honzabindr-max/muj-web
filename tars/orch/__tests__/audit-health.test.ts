// Etapa 5 (P0-a): read-only health projection. The first nine cases are the checks of the original patch
// (audit-health.check.ts, Astra), adapted to the v2 projection; the rest cover HOLD, WAITING_REVIEW, tick gaps,
// missing data, the CLI and the no-write guarantee.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  auditHealth,
  collectSnapshot,
  formatHealth,
  parseLaunchd,
} from "../audit-health";

const now = Date.parse("2026-11-03T21:00:00Z");
const stamp = "2026-11-03T20:59:00Z";
const ROOT = path.resolve(__dirname, "..", "..", "..");
const TSX = path.join(ROOT, "node_modules", "tsx", "dist", "loader.mjs");

describe("audit-health: původní checky patche (přizpůsobené)", () => {
  it("missing observations remain unknown", () => {
    const x = auditHealth({}, now);
    expect(x.snapshotStatus).toBe("UNKNOWN");
    expect(x.inputStatus).toBe("INCOMPLETE");
    expect(x.goToAckMs).toBe(null);
    expect(x.overall).toBe("UNKNOWN");
  });

  it("recent snapshot is not proof of live process", () => {
    const x = auditHealth(
      { observed_at: stamp, orders: [], lock: { exists: true } },
      now,
    );
    expect(x.snapshotStatus).toBe("RECENT_SNAPSHOT");
    expect(x.processLiveness).toBe("NOT_VERIFIED");
  });

  it("stale and future clocks never report fresh", () => {
    expect(
      auditHealth({ observed_at: "2026-11-02T00:00:00Z" }, now).snapshotStatus,
    ).toBe("STALE");
    expect(
      auditHealth({ observed_at: "2026-11-04T00:00:00Z" }, now).snapshotStatus,
    ).toBe("UNKNOWN");
  });

  it("owner wait is not runnable work", () => {
    const x = auditHealth(
      { orders: [{ id: "wo-1", state: "WAITING_OWNER" }] },
      now,
    );
    expect(x.waitingOwner).toBe(1);
    expect(x.duePause).toBe(0);
    expect(x.blocked.map((b) => b.kind)).toEqual(["WAITING_OWNER"]);
  });

  it("pause deadlines separate due, future and missing", () => {
    const x = auditHealth(
      {
        orders: [
          { id: "wo-a", state: "PAUSED", resume_after: stamp },
          { id: "wo-b", state: "PAUSED", resume_after: "2026-11-04T00:00:00Z" },
          { id: "wo-c", state: "PAUSED" },
        ],
      },
      now,
    );
    expect(x.duePause).toBe(1);
    expect(x.pauseResetUnknown).toBe(1);
    const c = x.blocked.find((b) => b.id === "wo-c")!;
    expect(c.resumeAfter).toBe(null);
    expect(c.reason).toMatch(/bez doloženého resetu/);
    expect(x.blocked.find((b) => b.id === "wo-a")!.resumeDue).toBe(true);
    expect(x.blocked.find((b) => b.id === "wo-b")!.resumeDue).toBe(false);
  });

  it("malformed orders cannot silently appear healthy", () => {
    const x = auditHealth({ orders: [null, { state: "bogus" }] }, now);
    expect(x.inputStatus).toBe("INCOMPLETE");
    expect(x.counts.INVALID).toBe(2);
    expect(x.overall).toBe("UNKNOWN");
  });

  it("no mutation and no arbitrary content in report", () => {
    const input = Object.freeze({
      observed_at: stamp,
      orders: Object.freeze([
        Object.freeze({
          id: "wo-1",
          state: "FAILED",
          privateNote: "CANARY_DO_NOT_ECHO",
        }),
      ]),
      privateNote: "CANARY_DO_NOT_ECHO",
      log: { result: "CANARY_DO_NOT_ECHO" },
    });
    const out = JSON.stringify(auditHealth(input, now));
    expect(out).not.toContain("CANARY");
    expect(input.orders.length).toBe(1);
  });

  it("browser success must carry fresh timestamp", () => {
    expect(auditHealth({ browser: { ok: true } }, now).browserStatus).toBe(
      "UNKNOWN",
    );
    expect(
      auditHealth({ browser: { ok: true, checked_at: stamp } }, now)
        .browserStatus,
    ).toBe("RECENT_OK_OBSERVATION");
  });

  it("invalid thresholds and clocks are rejected", () => {
    expect(() => auditHealth({}, NaN)).toThrow();
    expect(() => auditHealth({}, now, 0)).toThrow();
    expect(() => auditHealth({}, now, 3_600_000, 0)).toThrow();
  });
});

const tick = (iso: string) => iso;
const fullSnap = (extra: Record<string, unknown> = {}) => ({
  observed_at: stamp,
  runs_readable: true,
  orders: [],
  unreadable_orders: [],
  log: {
    readable: true,
    mtime: stamp,
    ticks: [tick("2026-11-03T20:50:00Z")],
    last_guard: { ts: "2026-11-03T20:50:00Z", result: "OK" },
    bad_lines: 0,
  },
  ...extra,
});

describe("audit-health: blokace", () => {
  it("HOLD: EFFECT_UNKNOWN v journalu efektů je vidět s důvodem a stářím", () => {
    const x = auditHealth(
      fullSnap({
        orders: [
          {
            id: "wo-h",
            state: "DELIVERED",
            manual_interventions: 0,
            effects: [
              {
                operation_id: "wo-h/deliver/r0",
                state: "EFFECT_DONE",
                has_receipt: true,
                updated_at: "2026-11-03T19:00:00Z",
              },
              {
                operation_id: "wo-h/owner-card/r0",
                state: "EFFECT_UNKNOWN",
                reason: "dohledání podle značky selhalo",
                updated_at: "2026-11-03T19:00:00Z",
              },
            ],
          },
        ],
      }),
      now,
    );
    const hold = x.blocked.filter((b) => b.kind === "HOLD");
    expect(hold).toHaveLength(1);
    expect(hold[0].reason).toMatch(
      /EFFECT_UNKNOWN wo-h\/owner-card\/r0: dohledání podle značky selhalo/,
    );
    expect(hold[0].ageMs).toBe(2 * 3600_000);
    expect(x.activeBlocks).toBe(1);
    expect(x.overall).toBe("ATTENTION");
  });

  it("HOLD: nečitelný journal efektů = stav zápisu UNKNOWN, ne čisto", () => {
    const x = auditHealth(
      fullSnap({
        orders: [
          {
            id: "wo-u",
            state: "DELIVERED",
            manual_interventions: 0,
            effects: [],
            effects_unreadable: 1,
          },
        ],
      }),
      now,
    );
    expect(x.blocked[0]).toMatchObject({ kind: "HOLD", ageMs: null });
    expect(x.blocked[0].reason).toMatch(/nečitelné/);
  });

  it("WAITING_REVIEW: důvod, druh kontroly a stáří od vstupu do stavu", () => {
    const x = auditHealth(
      fullSnap({
        orders: [
          {
            id: "wo-r",
            state: "WAITING_REVIEW",
            manual_interventions: 0,
            review_from: "CHECKING",
            review_reason: "timeout prohlížeče",
            updated_at: "2026-11-03T20:30:00Z",
            history: [
              {
                from: "DOING",
                to: "CHECKING",
                event: "x",
                at: "2026-11-03T19:00:00Z",
              },
              {
                from: "CHECKING",
                to: "WAITING_REVIEW",
                event: "review_unavailable",
                at: "2026-11-03T20:00:00Z",
              },
            ],
          },
        ],
      }),
      now,
    );
    expect(x.blocked).toHaveLength(1);
    expect(x.blocked[0].kind).toBe("WAITING_REVIEW");
    expect(x.blocked[0].reason).toBe(
      "kontrola (výstupu) neproběhla: timeout prohlížeče",
    );
    expect(x.blocked[0].since).toBe("2026-11-03T20:00:00Z");
    expect(x.blocked[0].ageMs).toBe(3600_000);
  });

  it("WAITING_REVIEW bez důvodu = UNKNOWN důvod", () => {
    const x = auditHealth(
      fullSnap({
        orders: [
          { id: "wo-r", state: "WAITING_REVIEW", manual_interventions: 0 },
        ],
      }),
      now,
    );
    expect(x.blocked[0].reason).toMatch(/UNKNOWN/);
    expect(x.blocked[0].ageMs).toBe(null);
  });

  it("FAILED a UNKNOWN nesou failure_reason; DONE se nehlásí", () => {
    const x = auditHealth(
      fullSnap({
        orders: [
          {
            id: "wo-a",
            state: "FAILED",
            failure_reason: "checker BLOCK",
            manual_interventions: 0,
          },
          { id: "wo-b", state: "UNKNOWN", manual_interventions: 0 },
          { id: "wo-c", state: "DONE", manual_interventions: 0 },
        ],
      }),
      now,
    );
    expect(x.blocked.map((b) => [b.id, b.kind, b.reason])).toEqual([
      ["wo-a", "FAILED", "checker BLOCK"],
      ["wo-b", "UNKNOWN", "důvod nezapsán (UNKNOWN)"],
    ]);
    expect(x.activeBlocks).toBe(0);
  });

  it("WAITING_OWNER: poslední řádek logu a stav panelu jsou v důvodu", () => {
    const x = auditHealth(
      fullSnap({
        orders: [
          {
            id: "wo-o",
            state: "WAITING_OWNER",
            manual_interventions: 0,
            last_log: {
              result: "GO nepřijato (Notion GO): chybí approved_hash",
            },
            panel: { row: true, uncertain: false, tainted: true, dirty: false },
          },
        ],
      }),
      now,
    );
    expect(x.blocked[0].reason).toMatch(/chybí approved_hash/);
    expect(x.blocked[0].panel).toBe("řádek v panelu (znehodnocený řádek)");
  });
});

describe("audit-health: heartbeat a mezery v tickách", () => {
  it("mezera delší než 2 intervaly je v seznamu; kratší ne", () => {
    const x = auditHealth(
      fullSnap({
        log: {
          readable: true,
          ticks: [
            "2026-11-03T12:00:00Z",
            "2026-11-03T12:30:00Z",
            "2026-11-03T13:29:00Z", // 59 min: not a gap
            "2026-11-03T16:00:00Z", // 2 h 31 min: gap (Mac asleep)
            "2026-11-03T20:50:00Z", // 4 h 50 min: gap
          ],
          last_guard: { ts: "2026-11-03T20:50:00Z", result: "OK" },
        },
      }),
      now,
    );
    expect(x.gaps.status).toBe("MEASURED");
    expect(x.gaps.list).toEqual([
      {
        from: "2026-11-03T13:29:00Z",
        to: "2026-11-03T16:00:00Z",
        durationMs: 151 * 60_000,
      },
      {
        from: "2026-11-03T16:00:00Z",
        to: "2026-11-03T20:50:00Z",
        durationMs: 290 * 60_000,
      },
    ]);
    expect(x.heartbeat).toMatchObject({
      status: "RECENT_TICK",
      lastTick: "2026-11-03T20:50:00Z",
      ageMs: 10 * 60_000,
    });
  });

  it("heartbeat je z logu: starý poslední tick = STALE a otevřená mezera, i když launchd hlásí interval", () => {
    const x = auditHealth(
      fullSnap({
        log: {
          readable: true,
          ticks: ["2026-11-03T17:00:00Z"],
          last_guard: { ts: "2026-11-03T17:00:00Z", result: "OK" },
          bad_lines: 0,
        },
        launchd: {
          readable: true,
          state: "not running",
          runs: 59,
          last_exit_code: 0,
          interval_s: 1800,
        },
      }),
      now,
    );
    expect(x.heartbeat.status).toBe("STALE");
    expect(x.gaps.list.at(-1)).toEqual({
      from: "2026-11-03T17:00:00Z",
      to: null,
      durationMs: 4 * 3600_000,
    });
    expect(x.launchd).toMatchObject({
      status: "READ",
      runs: 59,
      intervalS: 1800,
    });
    expect(x.overall).toBe("ATTENTION");
  });

  it("budoucí tick se nepočítá jako čerstvý", () => {
    const x = auditHealth(
      fullSnap({ log: { readable: true, ticks: ["2026-11-04T08:00:00Z"] } }),
      now,
    );
    expect(x.heartbeat.status).toBe("UNKNOWN");
    expect(x.heartbeat.futureTicksIgnored).toBe(1);
  });
});

describe("audit-health: chybějící data", () => {
  it("bez logu: heartbeat UNKNOWN, mezery NOT_MEASURED, nikdy NO_FINDINGS", () => {
    const x = auditHealth(fullSnap({ log: undefined }), now);
    expect(x.heartbeat.status).toBe("UNKNOWN");
    expect(x.gaps.status).toBe("NOT_MEASURED");
    expect(x.guard.status).toBe("UNKNOWN");
    expect(x.overall).toBe("UNKNOWN");
    expect(formatHealth(x)).toMatch(
      /Heartbeat \(poslední skutečný tick z logu\): UNKNOWN/,
    );
    expect(formatHealth(x)).toMatch(/NOT MEASURED/);
  });

  it("chybějící manual_interventions = UNKNOWN, ne 0", () => {
    const x = auditHealth(
      fullSnap({ orders: [{ id: "a", state: "DONE" }] }),
      now,
    );
    expect(x.manualInterventions.status).toBe("UNKNOWN");
    expect(x.inputStatus).toBe("INCOMPLETE");
    expect(x.overall).toBe("UNKNOWN");
  });

  it("launchd neměřen = NOT_MEASURED, nečitelný = UNKNOWN", () => {
    expect(auditHealth(fullSnap(), now).launchd.status).toBe("NOT_MEASURED");
    expect(
      auditHealth(fullSnap({ launchd: { readable: false } }), now).launchd
        .status,
    ).toBe("UNKNOWN");
  });

  it("vše změřeno a nic nečeká = NO_FINDINGS (nikdy PASS)", () => {
    const x = auditHealth(
      fullSnap({
        orders: [{ id: "wo-a", state: "DONE", manual_interventions: 2 }],
      }),
      now,
    );
    expect(x.overall).toBe("NO_FINDINGS");
    expect(x.manualInterventions).toMatchObject({
      status: "MEASURED",
      total: 2,
      byOrder: [{ id: "wo-a", count: 2 }],
    });
    expect(JSON.stringify(x)).not.toMatch(/"PASS"/);
  });

  it("parseLaunchd čte stav, čítač, exit a interval; prázdný výstup = nečitelné", () => {
    const out =
      "\tstate = not running\n\truns = 59\n\tlast exit code = 0\n\trun interval = 1800 seconds\n";
    expect(parseLaunchd(out)).toEqual({
      readable: true,
      state: "not running",
      runs: 59,
      last_exit_code: 0,
      interval_s: 1800,
    });
    expect(parseLaunchd(undefined)).toEqual({ readable: false });
  });
});

// ---- collector against a real runs/ tree on disk ----

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-health-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function writeRuns(runs: string): void {
  const order = (id: string, o: Record<string, unknown>) => {
    fs.mkdirSync(path.join(runs, id), { recursive: true });
    fs.writeFileSync(
      path.join(runs, id, "state.json"),
      JSON.stringify({
        id,
        manual_interventions: 0,
        history: [],
        meta: {},
        ...o,
      }),
    );
  };
  fs.mkdirSync(runs, { recursive: true });
  order("wo-1", { state: "WAITING_OWNER", updated_at: "2026-11-03T20:00:00Z" });
  order("wo-2", {
    state: "WAITING_REVIEW",
    review_from: "NEW",
    review_reason: "limit GPT",
    updated_at: "2026-11-03T20:30:00Z",
  });
  order("wo-3", {
    state: "DELIVERED",
    updated_at: "2026-11-03T19:00:00Z",
    manual_interventions: 1,
  });
  fs.mkdirSync(path.join(runs, "wo-3", "effects"));
  fs.writeFileSync(
    path.join(runs, "wo-3", "effects", "deliver-r0.json"),
    JSON.stringify({
      operation_id: "wo-3/deliver/r0",
      state: "EFFECT_UNKNOWN",
      reason: "PR nejde dohledat",
      updated_at: "2026-11-03T19:30:00Z",
    }),
  );
  fs.writeFileSync(
    path.join(runs, "log.jsonl"),
    [
      {
        ts: "2026-11-03T15:00:00Z",
        order: "-",
        kind: "guard",
        result: "OK",
        reason: "SECRET_GUARD_TEXT",
      },
      { ts: "2026-11-03T20:30:00Z", order: "-", kind: "guard", result: "OK" },
      {
        ts: "2026-11-03T20:31:00Z",
        order: "wo-1",
        kind: "info",
        role: "orchestrator",
        result: "GO nepřijato",
      },
    ]
      .map((e) => JSON.stringify(e))
      .join("\n") + "\nnot json\n",
  );
  fs.writeFileSync(
    path.join(runs, "panel-index.json"),
    JSON.stringify({ "wo-1": "abc", "uncertain:wo-3": "1" }),
  );
}

/** mtime (ns) of every file and directory under `root`, root included. */
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

describe("audit-health: sběr z runs/ (jen čtení)", () => {
  it("collectSnapshot + auditHealth: blokace, HOLD, mezera, ruční zásahy, panel", () => {
    const runs = path.join(dir, "runs");
    writeRuns(runs);
    const snap = collectSnapshot(runs, {
      now: () => new Date(now),
      launchd: null,
    });
    const x = auditHealth(snap, now);
    expect(x.blocked.map((b) => [b.id, b.kind])).toEqual([
      ["wo-2", "WAITING_REVIEW"],
      ["wo-1", "WAITING_OWNER"],
      ["wo-3", "HOLD"],
    ]);
    expect(x.blocked[1].reason).toMatch(/GO nepřijato/);
    expect(x.blocked[1].panel).toBe("řádek v panelu");
    expect(x.blocked[2].panel).toBe("bez řádku v panelu (nejasný zápis)");
    expect(x.gaps.list).toEqual([
      {
        from: "2026-11-03T15:00:00Z",
        to: "2026-11-03T20:30:00Z",
        durationMs: 5.5 * 3600_000,
      },
    ]);
    expect(x.manualInterventions).toMatchObject({
      status: "MEASURED",
      total: 1,
    });
    expect(x.launchd.status).toBe("NOT_MEASURED");
    expect(JSON.stringify(x)).not.toContain("SECRET_GUARD_TEXT");
  });

  it("projekce nikdy nezapíše soubor: mtime runs/ a všech souborů před a po je stejný", () => {
    const runs = path.join(dir, "runs");
    writeRuns(runs);
    const before = mtimes(runs);
    const names = fs.readdirSync(runs).sort();
    auditHealth(
      collectSnapshot(runs, {
        now: () => new Date(now),
        launchd: () => undefined,
      }),
      now,
    );
    expect(mtimes(runs)).toEqual(before);
    expect(fs.readdirSync(runs).sort()).toEqual(names);
  });

  it("chybějící runs/: vše UNKNOWN a adresář se nevytvoří", () => {
    const runs = path.join(dir, "missing");
    const x = auditHealth(collectSnapshot(runs, { launchd: null }), Date.now());
    expect(fs.existsSync(runs)).toBe(false);
    expect(x.overall).toBe("UNKNOWN");
    expect(x.inputStatus).toBe("INCOMPLETE");
    expect(x.heartbeat.status).toBe("UNKNOWN");
  });

  it("nečitelný state.json je v unreadableOrders a stav je INCOMPLETE", () => {
    const runs = path.join(dir, "runs");
    fs.mkdirSync(path.join(runs, "wo-x"), { recursive: true });
    fs.writeFileSync(path.join(runs, "wo-x", "state.json"), "{broken");
    const x = auditHealth(collectSnapshot(runs, { launchd: null }), Date.now());
    expect(x.unreadableOrders).toBe(1);
    expect(x.inputStatus).toBe("INCOMPLETE");
  });
});

// ---- Codex review kolo 1 (PR #103): nálezy 1-6 ----

describe("audit-health: review kolo 1", () => {
  const TOKEN = "ghp_" + "A1b2C3d4".repeat(5); // built at runtime: no literal token in the repo

  it("1: id a paused_from mimo vzor se nahradí, platné id projde redactSecrets; žádné podvržené řádky", () => {
    const x = auditHealth(
      fullSnap({
        orders: [
          {
            id: "wo-1\n  - wo-podvrh · čeká",
            state: "WAITING_OWNER",
            manual_interventions: 0,
          },
          { id: `wo-${TOKEN}`, state: "FAILED", manual_interventions: 0 },
          {
            id: "../etc",
            state: "PAUSED",
            paused_from: `DOING\n${TOKEN}`,
            resume_after: stamp,
            manual_interventions: 0,
          },
          {
            id: "wo-p",
            state: "PAUSED",
            paused_from: "DOING",
            resume_after: stamp,
            manual_interventions: 0,
          },
        ],
      }),
      now,
    );
    const ids = x.blocked.map((b) => b.id);
    expect(ids.filter((i) => i === "<neplatné id>")).toHaveLength(2);
    expect(ids).toContain("wo-p");
    const out = JSON.stringify(x) + formatHealth(x);
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain("wo-podvrh");
    expect(out).not.toContain("../etc");
    expect(x.blocked.find((b) => b.id === "wo-p")!.reason).toMatch(
      /^pauza z DOING;/,
    );
    expect(out).toContain("pauza z <neplatný stav>");
    // every block line of the text output starts with "  - " and the reason line with 6 spaces: no injected line
    const lines = formatHealth(x).split("\n");
    const start = lines.findIndex((l) => l.startsWith("Blokace"));
    const blockLines = lines.slice(start + 1, start + 1 + 2 * x.blocked.length);
    blockLines.forEach((l, i) =>
      expect(l.startsWith(i % 2 === 0 ? "  - " : "      ")).toBe(true),
    );
  });

  it("2: adresář wo-* bez state.json = neúplná zakázka, effects/ se čtou, výsledek INCOMPLETE", () => {
    const runs = path.join(dir, "runs");
    fs.mkdirSync(path.join(runs, "wo-lost", "effects"), { recursive: true });
    fs.writeFileSync(
      path.join(runs, "wo-lost", "effects", "deliver-r0.json"),
      JSON.stringify({
        operation_id: "wo-lost/deliver/r0",
        state: "EFFECT_UNKNOWN",
        reason: "přerušeno",
        updated_at: "2026-11-03T20:00:00Z",
      }),
    );
    fs.writeFileSync(
      path.join(runs, "log.jsonl"),
      JSON.stringify({
        ts: "2026-11-03T20:50:00Z",
        order: "-",
        kind: "guard",
        result: "OK",
      }) + "\n",
    );
    const snap = collectSnapshot(runs, {
      now: () => new Date(now),
      launchd: null,
    });
    expect(snap.orders).toHaveLength(1);
    const x = auditHealth(snap, now);
    expect(x.missingStateOrders).toBe(1);
    expect(x.inputStatus).toBe("INCOMPLETE");
    expect(x.overall).toBe("UNKNOWN");
    expect(x.counts.MISSING_STATE).toBe(1);
    expect(x.blocked.map((b) => [b.id, b.kind])).toEqual(
      expect.arrayContaining([
        ["wo-lost", "UNKNOWN"],
        ["wo-lost", "HOLD"],
      ]),
    );
    expect(formatHealth(x)).toMatch(/bez state\.json 1/);
  });

  it("3: nečitelné nebo neplatné zakázky = ruční zásahy UNKNOWN, ne MEASURED 0", () => {
    const unread = auditHealth(
      fullSnap({ orders: [], unreadable_orders: ["wo-x"] }),
      now,
    );
    expect(unread.manualInterventions.status).toBe("UNKNOWN");
    expect(formatHealth(unread)).toMatch(/Ruční zásahy: UNKNOWN/);
    const malformed = auditHealth(
      fullSnap({
        orders: [{ id: "wo-m", state: "bogus", manual_interventions: 0 }],
      }),
      now,
    );
    expect(malformed.manualInterventions.status).toBe("UNKNOWN");
    const missing = auditHealth(
      fullSnap({ orders: [{ id: "wo-l", missing_state: true }] }),
      now,
    );
    expect(missing.manualInterventions.status).toBe("UNKNOWN");
    expect(auditHealth(fullSnap(), now).manualInterventions.status).toBe(
      "MEASURED",
    );
  });

  it("4: neplatný řádek logu za posledním guardem = úplnost UNKNOWN, guard UNKNOWN, nikdy NO_FINDINGS", () => {
    const runs = path.join(dir, "runs");
    fs.mkdirSync(runs, { recursive: true });
    const guard = (ts: string, result: string) =>
      JSON.stringify({ ts, order: "-", kind: "guard", result });
    // garbage before the first guard is outside the tick window
    fs.writeFileSync(
      path.join(runs, "log.jsonl"),
      ["old garbage", guard("2026-11-03T20:50:00Z", "OK")].join("\n") + "\n",
    );
    const clean = auditHealth(
      collectSnapshot(runs, { now: () => new Date(now), launchd: null }),
      now,
    );
    expect(clean.logCompleteness.status).toBe("COMPLETE");
    expect(clean.overall).toBe("NO_FINDINGS");
    // a corrupted (perhaps ALARM) line after a fresh OK
    fs.writeFileSync(
      path.join(runs, "log.jsonl"),
      [
        guard("2026-11-03T20:50:00Z", "OK"),
        '{"ts":"2026-11-03T20:55:00Z","order":"-","kind":"guard","result":"ALA',
      ].join("\n") + "\n",
    );
    const x = auditHealth(
      collectSnapshot(runs, { now: () => new Date(now), launchd: null }),
      now,
    );
    expect(x.logCompleteness).toMatchObject({
      status: "UNKNOWN",
      badLinesInWindow: 1,
      badLinesAfterLastGuard: 1,
    });
    expect(x.guard.status).toBe("UNKNOWN");
    expect(x.overall).not.toBe("NO_FINDINGS");
    expect(formatHealth(x)).toMatch(
      /Úplnost logu: UNKNOWN \(1 neplatných řádků/,
    );
    // bad line between two guards: guard is known, but completeness still UNKNOWN
    const y = auditHealth(
      fullSnap({
        log: {
          readable: true,
          ticks: ["2026-11-03T20:50:00Z"],
          last_guard: { ts: "2026-11-03T20:50:00Z", result: "OK" },
          bad_lines: 1,
          bad_lines_in_window: 1,
          bad_lines_after_last_guard: 0,
        },
      }),
      now,
    );
    expect(y.guard.status).toBe("OK");
    expect(y.overall).toBe("UNKNOWN");
    // pure projection: no bad-line counter = completeness not measured
    expect(
      auditHealth(
        fullSnap({
          log: {
            readable: true,
            ticks: ["2026-11-03T20:50:00Z"],
            last_guard: { ts: "2026-11-03T20:50:00Z", result: "OK" },
          },
        }),
        now,
      ).overall,
    ).toBe("UNKNOWN");
  });

  it("5: guard používá stejný časový filtr jako heartbeat; budoucí záznamy se ignorují a hlásí", () => {
    const runs = path.join(dir, "runs");
    fs.mkdirSync(runs, { recursive: true });
    const nowNoon = Date.parse("2026-11-03T12:00:00Z");
    fs.writeFileSync(
      path.join(runs, "log.jsonl"),
      [
        {
          ts: "2026-11-03T11:50:00Z",
          order: "-",
          kind: "guard",
          result: "ALARM",
        },
        { ts: "2026-11-03T12:30:00Z", order: "-", kind: "guard", result: "OK" },
      ]
        .map((e) => JSON.stringify(e))
        .join("\n") + "\n",
    );
    const x = auditHealth(
      collectSnapshot(runs, { now: () => new Date(nowNoon), launchd: null }),
      nowNoon,
    );
    expect(x.heartbeat.lastTick).toBe("2026-11-03T11:50:00Z");
    expect(x.guard).toMatchObject({
      status: "ALARM",
      at: "2026-11-03T11:50:00Z",
      futureEntries: 1,
    });
    expect(x.overall).toBe("ATTENTION");
    expect(formatHealth(x)).toMatch(/záznamy z budoucnosti ignorovány: 1/);
  });

  it("6: journal efektů se validuje; neznámý stav = effects_unreadable (HOLD), EFFECT_DONE bez receiptu = HOLD", () => {
    const runs = path.join(dir, "runs");
    fs.mkdirSync(path.join(runs, "wo-e", "effects"), { recursive: true });
    fs.writeFileSync(
      path.join(runs, "wo-e", "state.json"),
      JSON.stringify({
        id: "wo-e",
        state: "DONE",
        manual_interventions: 0,
        history: [],
        meta: {},
      }),
    );
    const eff = (name: string, rec: unknown) =>
      fs.writeFileSync(
        path.join(runs, "wo-e", "effects", name),
        JSON.stringify(rec),
      );
    eff("a.json", {});
    eff("b.json", { operation_id: "wo-e/x/r0", state: "WEIRD" });
    eff("c.json", {
      operation_id: "wo-e/deliver/r0",
      state: "EFFECT_DONE",
      updated_at: "2026-11-03T20:00:00Z",
    });
    eff("d.json", {
      operation_id: "wo-e/owner-card/r0",
      state: "EFFECT_DONE",
      receipt: { url: "https://example.invalid/x" },
      updated_at: "2026-11-03T20:00:00Z",
    });
    fs.writeFileSync(
      path.join(runs, "log.jsonl"),
      JSON.stringify({
        ts: "2026-11-03T20:50:00Z",
        order: "-",
        kind: "guard",
        result: "OK",
      }) + "\n",
    );
    const snap = collectSnapshot(runs, {
      now: () => new Date(now),
      launchd: null,
    });
    const o = (
      snap.orders as {
        effects_unreadable?: number;
        effects: { has_receipt?: boolean }[];
      }[]
    )[0];
    expect(o.effects_unreadable).toBe(2);
    expect(o.effects.map((e) => e.has_receipt)).toEqual([false, true]);
    const x = auditHealth(snap, now);
    const holds = x.blocked
      .filter((b) => b.kind === "HOLD")
      .map((b) => b.reason);
    expect(holds).toHaveLength(2);
    expect(
      holds.some((r) => /EFFECT_DONE bez receiptu wo-e\/deliver\/r0/.test(r)),
    ).toBe(true);
    expect(
      holds.some((r) => /2 záznam\(y\) nečitelné nebo neplatné/.test(r)),
    ).toBe(true);
    expect(JSON.stringify(x)).not.toContain("example.invalid");
    expect(x.overall).toBe("ATTENTION");
    // pure projection validates too: a record without a known state is never ignored
    const p = auditHealth(
      fullSnap({
        orders: [
          { id: "wo-q", state: "DONE", manual_interventions: 0, effects: [{}] },
        ],
      }),
      now,
    );
    expect(p.blocked).toMatchObject([
      { id: "wo-q", kind: "HOLD", ageMs: null },
    ]);
    expect(p.overall).not.toBe("NO_FINDINGS");
  });
});

// ---- Codex review kolo 2 (PR #103): nálezy 1-3 ----

describe("audit-health: review kolo 2", () => {
  const TOKEN = "ghp_" + "Z9y8X7w6".repeat(5); // built at runtime: no literal token in the repo
  const guardLine = (ts: string, result: string) =>
    JSON.stringify({ ts, order: "-", kind: "guard", result });
  const writeLog = (runs: string, lines: string[]) => {
    fs.mkdirSync(runs, { recursive: true });
    fs.writeFileSync(path.join(runs, "log.jsonl"), lines.join("\n") + "\n");
  };

  it("1: token za podtržítkem v id (wo-copy_ghp_…) se nikdy neobjeví v blocked.id, byOrder ani v textu", () => {
    const runs = path.join(dir, "runs");
    const id = `wo-copy_${TOKEN}`;
    fs.mkdirSync(path.join(runs, id), { recursive: true });
    fs.writeFileSync(
      path.join(runs, id, "state.json"),
      JSON.stringify({
        id,
        state: "WAITING_OWNER",
        manual_interventions: 2,
        owner_reasons: [`viz větev x_${TOKEN}`],
        history: [],
        meta: {},
        updated_at: "2026-11-03T20:00:00Z",
      }),
    );
    writeLog(runs, [guardLine("2026-11-03T20:50:00Z", "OK")]);
    const x = auditHealth(
      collectSnapshot(runs, { now: () => new Date(now), launchd: null }),
      now,
    );
    expect(x.blocked).toHaveLength(1);
    expect(x.blocked[0].kind).toBe("WAITING_OWNER");
    expect(x.manualInterventions.byOrder).toHaveLength(1);
    const out = JSON.stringify(x) + formatHealth(x);
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain(TOKEN.slice(4)); // not even the token body without its prefix
    expect(x.blocked[0].id).toMatch(/^wo-copy_\[skryto: citlivý údaj\]$/);
    expect(x.manualInterventions.byOrder[0].id).toBe(x.blocked[0].id);
  });

  it('2: guard s neplatným ts ("broken") po čerstvém OK = poškozený řádek okna, nikdy NO_FINDINGS', () => {
    const runs = path.join(dir, "runs");
    writeLog(runs, [
      guardLine("2026-11-03T20:50:00Z", "OK"),
      guardLine("broken", "ALARM"),
    ]);
    const x = auditHealth(
      collectSnapshot(runs, { now: () => new Date(now), launchd: null }),
      now,
    );
    expect(x.logCompleteness).toMatchObject({
      status: "UNKNOWN",
      badLinesInWindow: 1,
      badLinesAfterLastGuard: 1,
    });
    expect(x.guard.status).toBe("UNKNOWN");
    expect(x.overall).toBe("UNKNOWN");
    // a broken guard line is in the window even before the first valid guard
    writeLog(runs, [
      guardLine("broken", "ALARM"),
      guardLine("2026-11-03T20:50:00Z", "OK"),
    ]);
    const y = auditHealth(
      collectSnapshot(runs, { now: () => new Date(now), launchd: null }),
      now,
    );
    expect(y.logCompleteness.status).toBe("UNKNOWN");
    expect(y.overall).not.toBe("NO_FINDINGS");
    // pure projection: an invalid ts in the snapshot guard list is counted too, never skipped
    const p = auditHealth(
      fullSnap({
        log: {
          readable: true,
          mtime: stamp,
          ticks: ["2026-11-03T20:50:00Z"],
          guards: [
            { ts: "2026-11-03T20:50:00Z", result: "OK" },
            { ts: "broken", result: "ALARM" },
          ],
          bad_lines: 0,
          bad_lines_in_window: 0,
          bad_lines_after_last_guard: 0,
        },
      }),
      now,
    );
    expect(p.guard.status).toBe("UNKNOWN");
    expect(p.logCompleteness.status).toBe("UNKNOWN");
    expect(p.overall).toBe("UNKNOWN");
  });

  it("3: poslední guard podle pořadí zápisu; posun hodin zpět = guard UNKNOWN s důvodem, ne NO_FINDINGS", () => {
    const runs = path.join(dir, "runs");
    const nowNoon = Date.parse("2026-11-03T12:00:00Z");
    const run = () =>
      auditHealth(
        collectSnapshot(runs, { now: () => new Date(nowNoon), launchd: null }),
        nowNoon,
      );
    // review scenario: OK 11:50, then (clock set back) ALARM 11:40
    writeLog(runs, [
      guardLine("2026-11-03T11:50:00Z", "OK"),
      guardLine("2026-11-03T11:40:00Z", "ALARM"),
    ]);
    const x = run();
    expect(x.guard.status).toBe("UNKNOWN");
    expect(x.guard.reason).toMatch(/posun hodin/);
    expect(x.guard.at).toBe("2026-11-03T11:40:00Z");
    expect(x.overall).not.toBe("NO_FINDINGS");
    expect(formatHealth(x)).toMatch(
      /Guard při posledním ticku: UNKNOWN.*posun hodin/,
    );
    // round 1 scenario: ALARM 11:50, OK 12:30 from the future → ALARM, future reported
    writeLog(runs, [
      guardLine("2026-11-03T11:50:00Z", "ALARM"),
      guardLine("2026-11-03T12:30:00Z", "OK"),
    ]);
    const y = run();
    expect(y.guard).toMatchObject({
      status: "ALARM",
      at: "2026-11-03T11:50:00Z",
      futureEntries: 1,
      reason: null,
    });
    expect(y.overall).toBe("ATTENTION");
    // monotonic write order: the last line wins
    writeLog(runs, [
      guardLine("2026-11-03T11:20:00Z", "ALARM"),
      guardLine("2026-11-03T11:50:00Z", "OK"),
    ]);
    expect(run().guard).toMatchObject({ status: "OK", reason: null });
  });
});

describe("cli.ts health", () => {
  const cli = (args: string[], runs: string) =>
    spawnSync(
      process.execPath,
      [
        "--import",
        TSX,
        path.join(ROOT, "tars", "orch", "cli.ts"),
        "health",
        ...args,
      ],
      {
        encoding: "utf8",
        env: { ...process.env, TARS_RUNS_DIR: runs, TARS_HEALTH_LAUNCHD: "0" },
        timeout: 60_000,
      },
    );

  it("--json vypíše strojový JSON a nic v runs/ nezmění", () => {
    const runs = path.join(dir, "runs");
    writeRuns(runs);
    const before = mtimes(runs);
    const r = cli(["--json"], runs);
    expect(r.status).toBe(0);
    const j = JSON.parse(r.stdout);
    expect(j.schema).toBe("tars-audit-health/v3");
    expect(j.blocked.map((b: { kind: string }) => b.kind)).toContain("HOLD");
    expect(mtimes(runs)).toEqual(before);
  }, 60_000);

  it("bez přepínače česky čitelný přehled; chybějící runs/ se nevytvoří", () => {
    const runs = path.join(dir, "nic");
    const r = cli([], runs);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^TARS health — stav: UNKNOWN/);
    expect(r.stdout).toMatch(
      /Heartbeat \(poslední skutečný tick z logu\): UNKNOWN/,
    );
    expect(fs.existsSync(runs)).toBe(false);
  }, 60_000);
});
