// Etapa 4 PR 2 (NAVRH-v6 §10.2, „Testy (PR 2 …)“): minutová brána wake-gate.sh jako skutečný /bin/sh nad dočasnou
// složkou, falešné hodiny (TARS_GATE_NOW). Plný tick je simulovaný: brána spustí falešný příkaz ticku, který jen
// zapíše start; test pak provede to, co dělá skutečný tick (lease přes Store, obnova zakázky, reconcileNextWake ve
// `finally` pod lease, výsledek do outcomes/ po `finally`). Cizí lease drží skutečný druhý proces (lease-child.ts).
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { transition } from "../state-machine";
import { Store } from "../store";
import type { Order } from "../types";
import {
  backoffS,
  formatNextWake,
  parseGateStart,
  parseNextWake,
  reconcileNextWake,
  writeGateOutcome,
} from "../wake";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const TSX = path.join(ROOT, "node_modules", "tsx", "dist", "loader.mjs");
const GATE = path.join(__dirname, "..", "launchd", "wake-gate.sh");
/** Shell brány: /bin/sh (macOS: bash v režimu sh, Linux CI: dash); TARS_TEST_SH=/bin/dash ověří dash i na macOS. */
const SH = process.env.TARS_TEST_SH ?? "/bin/sh";
const ID = "wo-wake-1";
/** T = čas resetu (epocha v sekundách, zarovnaná na minutu). */
const T = 1_800_000_000 - (1_800_000_000 % 60);
const M = 60;

let base: string;
let runs: string;
let tickLog: string;
let child: ChildProcess | undefined;
beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), "tars-wake-"));
  runs = path.join(base, "runs");
  fs.mkdirSync(runs);
  tickLog = path.join(base, "ticks.log");
});
afterEach(() => {
  child?.kill("SIGKILL");
  child = undefined;
});

const iso = (s: number) => new Date(s * 1000).toISOString();

interface GateRun {
  status: number | null;
  ticked: boolean;
  reason?: string;
  stdout: string;
}

/** Jedno spuštění skutečné brány v čase `now` (sekundy). */
function gate(now: number, env: Record<string, string> = {}): GateRun {
  const before = fs.existsSync(tickLog) ? fs.readFileSync(tickLog, "utf8") : "";
  const r = spawnSync(SH, [GATE], {
    encoding: "utf8",
    env: {
      NODE_ENV: "test",
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      HOME: base,
      TARS_RUNS_DIR: runs,
      TARS_GATE_NOW: String(now),
      TICKLOG: tickLog,
      TARS_GATE_TICK: `printf '%s\\n' "$TARS_GATE_START" >> "$TICKLOG"`,
      ...env,
    },
  });
  const after = fs.existsSync(tickLog) ? fs.readFileSync(tickLog, "utf8") : "";
  const ticked = after.length > before.length;
  const m = / tick reason=([abc])/.exec(r.stdout);
  return {
    status: r.status,
    ticked,
    reason: m?.[1],
    stdout: r.stdout + r.stderr,
  };
}

type Behavior = "ok" | "limit" | "fail" | "crash" | "guard_alarm";

/**
 * To, co po startu z brány udělá skutečný tick (cli.ts tick → Orchestrator.tick):
 *  guard_alarm → bez lease, výsledek guard_alarm; crash → proces spadne před `finally` i před výsledkem;
 *  jinak lease (Store), při `locked` výsledek locked; s lease obnova splatné zakázky, reconcileNextWake ve `finally`
 *  pod lease, výsledek ran po `finally`.
 */
function simTick(now: number, behavior: Behavior): void {
  const gs = String(now);
  if (behavior === "guard_alarm") {
    writeGateOutcome(runs, gs, "guard_alarm", new Date(now * 1000));
    return;
  }
  if (behavior === "crash") return;
  const s = new Store(runs);
  if (!s.acquireLock()) {
    writeGateOutcome(runs, gs, "locked", new Date(now * 1000));
    return;
  }
  try {
    let o = s.load(ID);
    if (
      o.state === "PAUSED" &&
      Date.parse(o.resume_after!) <= now * 1000 &&
      behavior !== "fail" // fail: chyba kroku pod lease ještě před změnou stavu
    ) {
      o = transition(o, { type: "resume" }, iso(now));
      expect(s.save(o)).toBe(true);
      o =
        behavior === "limit"
          ? transition(
              o,
              { type: "limit", resume_after: iso(now + 60 * M) },
              iso(now),
            )
          : transition(o, { type: "created" }, iso(now));
      expect(s.save(o)).toBe(true);
    }
  } finally {
    reconcileNextWake(runs, s.listOrders(), new Date(now * 1000), s.fence);
    s.releaseLock();
  }
  writeGateOutcome(runs, gs, "ran", new Date(now * 1000));
}

/** Zakázka v PAUSED s obnovou v `resumeAt` a předchozí plný tick v `prevTick` (zapsal next-wake, last-gate-start). */
function seed(resumeAt: number, prevTick: number): void {
  const o: Order = {
    id: ID,
    mission: "m",
    state: "PAUSED",
    paused_from: "DOING",
    resume_after: iso(resumeAt),
    created_at: iso(prevTick),
    updated_at: iso(prevTick),
    fix_rounds: 0,
    manual_interventions: 0,
    history: [],
    meta: {},
  };
  expect(new Store(runs).save(o)).toBe(true);
  const g = gate(prevTick); // bez last-gate-start → pojistka (b)
  expect(g.ticked).toBe(true);
  simTick(prevTick, "ok");
  expect(
    parseNextWake(fs.readFileSync(path.join(runs, "next-wake"), "utf8")),
  ).toMatchObject({
    epoch: resumeAt,
    order_id: ID,
    attempt: 0,
  });
}

/** Minutová brána od..do (včetně); vrací starty plných ticků s důvodem. */
function minutes(
  from: number,
  to: number,
  behavior: Behavior | ((now: number) => Behavior),
): Array<{ at: number; reason: string }> {
  const out: Array<{ at: number; reason: string }> = [];
  for (let now = from; now <= to; now += M) {
    const g = gate(now);
    expect(g.status).toBe(0);
    if (!g.ticked) continue;
    out.push({ at: (now - T) / M, reason: g.reason ?? "?" });
    simTick(now, typeof behavior === "function" ? behavior(now) : behavior);
  }
  return out;
}

const ls = (sub: string) =>
  fs.existsSync(path.join(runs, sub))
    ? fs.readdirSync(path.join(runs, sub))
    : [];
const resumeCount = () =>
  new Store(runs).load(ID).history.filter((h) => h.event === "resume").length;

/** Otisk všech souborů v runs/ mimo knihovnu brány (outcomes, last-gate-start, gate.log, gate-locks) a soubory lease-child. */
function snapshot(): string {
  const skip = (rel: string) =>
    /^wake\/(outcomes|gate-locks)(\/|$)/.test(rel) ||
    /^wake\/(last-gate-start|gate\.log)$/.test(rel) ||
    /^(ready|go|res|end|rel)-/.test(rel) ||
    rel === ".state.lock" ||
    rel === ".lock"; // lease cizího běhu (heartbeat)
  const acc: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const rel = path.relative(runs, p);
      if (skip(rel)) continue;
      if (e.isDirectory()) walk(p);
      else
        acc.push(
          `${rel} ${createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`,
        );
    }
  };
  walk(runs);
  return acc.sort().join("\n");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFile(f: string): Promise<string> {
  const t0 = Date.now();
  while (!fs.existsSync(f)) {
    if (Date.now() - t0 > 30_000) throw new Error(`timeout ${f}`);
    await sleep(10);
  }
  return fs.readFileSync(f, "utf8");
}
/** Skutečný druhý proces, který drží lease ticku (vzor state-ownership.test.ts). */
async function holdLease(): Promise<void> {
  child = spawn(
    process.execPath,
    ["--import", TSX, path.join(__dirname, "lease-child.ts"), runs, "1", "L"],
    { stdio: "ignore" },
  );
  await waitFile(path.join(runs, "ready-L"));
  fs.writeFileSync(path.join(runs, "go-0"), "");
  expect(await waitFile(path.join(runs, "res-0-L"))).toBe("1");
}
async function releaseLease(): Promise<void> {
  fs.writeFileSync(path.join(runs, "end-0"), "");
  await waitFile(path.join(runs, "rel-0-L"));
}

describe("wake.ts: next-wake a výsledky", () => {
  it("backoff 1, 2, 5, 10, 30 min, dál 30; formát next-wake má epoch jako první klíč", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(backoffS)).toEqual([
      60, 120, 300, 600, 1800, 1800, 1800,
    ]);
    const s = formatNextWake({
      epoch: 5,
      order_id: "wo-x",
      state_version: 1,
      resume_after: iso(5),
      written_fence: 3,
      attempt: 0,
    });
    expect(s.startsWith('{"epoch":5,')).toBe(true);
    expect(parseNextWake(s)).toMatchObject({ epoch: 5, order_id: "wo-x" });
    for (const bad of [
      "",
      "{",
      '{"epoch":"5"}',
      '{"epoch":1,"order_id":"x","state_version":0,"resume_after":"z","written_fence":null,"attempt":0}',
    ])
      expect(parseNextWake(bad)).toBeUndefined();
  });

  it("výsledek pro bránu: zapíše se jednou (existuje = nic), jen pro epochu; první řádek ran|locked|guard_alarm", () => {
    expect(parseGateStart("123")).toBe("123");
    for (const bad of [undefined, "", "12a", "../x", "1".repeat(13)])
      expect(parseGateStart(bad)).toBeUndefined();
    expect(writeGateOutcome(runs, "../x", "locked")).toBe(false);
    expect(writeGateOutcome(runs, "100", "locked")).toBe(true);
    expect(writeGateOutcome(runs, "100", "advanced")).toBe(false);
    expect(
      fs
        .readFileSync(path.join(runs, "wake/outcomes/100"), "utf8")
        .split("\n")[0],
    ).toBe("locked");
    writeGateOutcome(runs, "101", "waiting_owner");
    writeGateOutcome(runs, "102", "guard_alarm");
    expect(
      fs
        .readFileSync(path.join(runs, "wake/outcomes/101"), "utf8")
        .split("\n")[0],
    ).toBe("ran");
    expect(
      fs
        .readFileSync(path.join(runs, "wake/outcomes/102"), "utf8")
        .split("\n")[0],
    ).toBe("guard_alarm");
  });

  it("nečitelný next-wake: brána ho nebere (jen pojistka b), tick pod lease ho zkonzumuje s důvodem invalid a odvodí znovu", () => {
    seed(T + M, T - 10 * M);
    fs.writeFileSync(path.join(runs, "next-wake"), "{rozbité");
    expect(gate(T + 2 * M).ticked).toBe(false); // (a) neplatí, (b) ještě ne
    const g = gate(T + 20 * M);
    expect(g).toMatchObject({ ticked: true, reason: "b" });
    simTick(T + 20 * M, "ok");
    expect(ls("wake/consumed").some((f) => f.endsWith("-invalid.json"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(runs, "next-wake"))).toBe(false); // obnova proběhla, nic nečeká
    expect(resumeCount()).toBe(1);
  });

  it("orphan: next-wake bez zakázky se zkonzumuje s důvodem orphan", () => {
    fs.writeFileSync(
      path.join(runs, "next-wake"),
      formatNextWake({
        epoch: T,
        order_id: "wo-nikdo",
        state_version: 0,
        resume_after: iso(T),
        written_fence: null,
        attempt: 0,
      }),
    );
    const r = reconcileNextWake(runs, [], new Date((T + M) * 1000), 1);
    expect(r).toMatchObject({ action: "consumed", reason: "orphan" });
    const [f] = ls("wake/consumed");
    expect(
      JSON.parse(fs.readFileSync(path.join(runs, "wake/consumed", f), "utf8")),
    ).toMatchObject({
      order_id: "wo-nikdo",
      reason: "orphan",
      consumed_fence: 1,
    });
  });
});

describe("wake-gate.sh (skutečný /bin/sh, falešné hodiny)", () => {
  it("60 min po obnově: reset T, obnova T+1 (a), pak 60 spuštění brány: právě 1 tick z (a), nejvýš 2 z (b); next-wake zkonzumovaný", () => {
    seed(T + M, T - 10 * M);
    const first = minutes(T + M, T + M, "ok");
    expect(first).toEqual([{ at: 1, reason: "a" }]);
    expect(resumeCount()).toBe(1);
    expect(fs.existsSync(path.join(runs, "next-wake"))).toBe(false);
    expect(ls("wake/consumed")).toHaveLength(1);
    const c = JSON.parse(
      fs.readFileSync(
        path.join(runs, "wake/consumed", ls("wake/consumed")[0]),
        "utf8",
      ),
    );
    expect(c).toMatchObject({
      order_id: ID,
      reason: "taken_over",
      new_state: "CHECKING",
      consumed_at: iso(T + M),
    });
    const rest = minutes(T + 2 * M, T + 61 * M, "ok");
    expect(rest.filter((t) => t.reason === "a")).toHaveLength(0);
    expect(rest.filter((t) => t.reason === "c")).toHaveLength(0);
    expect(rest.filter((t) => t.reason === "b").length).toBeLessThanOrEqual(2);
    expect(resumeCount()).toBe(1);
    // DR-040: zpoždění probuzení v logu brány
    expect(fs.readFileSync(path.join(runs, "wake/gate.log"), "utf8")).toMatch(
      /tick reason=a next_wake=\d+ wake_late_by_s=0/,
    );
  });

  it("neúspěšná obnova (znovu limit): nový next-wake v budoucnu, za 60 min plných ticků ≤ počet kroků backoffu + 2", () => {
    seed(T + M, T - 10 * M);
    const ticks = minutes(T + M, T + 61 * M, "limit");
    expect(ticks[0]).toEqual({ at: 1, reason: "a" });
    expect(ticks.length).toBeLessThanOrEqual(5 + 2);
    const nw = parseNextWake(
      fs.readFileSync(path.join(runs, "next-wake"), "utf8"),
    )!;
    expect(nw.epoch).toBeGreaterThan(T + 61 * M); // v budoucnu
    expect(new Store(runs).load(ID).state).toBe("PAUSED");
  });

  it("neúspěch pod lease bez změny stavu: přeplánování s backoffem (attempt roste), ≤ počet kroků backoffu + 2", () => {
    seed(T + M, T - 10 * M);
    const ticks = minutes(T + M, T + 61 * M, "fail");
    expect(ticks.map((t) => t.at)).toEqual([1, 2, 4, 9, 19, 49]);
    expect(ticks.length).toBeLessThanOrEqual(5 + 2);
    expect(resumeCount()).toBe(0);
    const nw = parseNextWake(
      fs.readFileSync(path.join(runs, "next-wake"), "utf8"),
    )!;
    expect(nw.attempt).toBe(6);
    expect(ls("wake/superseded")).toHaveLength(6);
  });

  it("pád ticku před finally: zastaralý next-wake → za 60 min nejvýš 1 tick z (a) a 2 z (b)", () => {
    seed(T + M, T - 10 * M);
    const ticks = minutes(T + M, T + 61 * M, "crash");
    expect(ticks.filter((t) => t.reason === "a")).toHaveLength(1);
    expect(ticks.filter((t) => t.reason === "b").length).toBeLessThanOrEqual(2);
    expect(ticks.filter((t) => t.reason === "c")).toHaveLength(0);
    expect(fs.existsSync(path.join(runs, "next-wake"))).toBe(true);
  });

  it("N09: cizí lease v T+1, uvolnění v T+2 → (c) v T+2, obnova do T+2, 0 duplicit, pak jen (b)", async () => {
    seed(T, T - 10 * M);
    await holdLease(); // T+0,5
    const t1 = minutes(T + M, T + M, "ok");
    expect(t1).toEqual([{ at: 1, reason: "a" }]);
    expect(
      fs
        .readFileSync(path.join(runs, `wake/outcomes/${T + M}`), "utf8")
        .split("\n")[0],
    ).toBe("locked");
    expect(
      parseNextWake(fs.readFileSync(path.join(runs, "next-wake"), "utf8")),
    ).toMatchObject({ epoch: T, attempt: 0 });
    await releaseLease(); // T+2 (před spuštěním brány)
    const t2 = minutes(T + 2 * M, T + 2 * M, "ok");
    expect(t2).toEqual([{ at: 2, reason: "c" }]);
    expect(resumeCount()).toBe(1);
    expect(fs.existsSync(path.join(runs, "next-wake"))).toBe(false);
    expect(ls("wake/consumed")).toHaveLength(1);
    const rest = minutes(T + 3 * M, T + 60 * M, "ok");
    expect(rest.filter((t) => t.reason === "c")).toHaveLength(0);
    expect(rest.filter((t) => t.reason === "a")).toHaveLength(0);
    expect(rest.length).toBeLessThanOrEqual(2);
    expect(resumeCount()).toBe(1); // 0 duplicit: jedna obnova, jeden přechod
    expect(new Store(runs).load(ID).history.map((h) => h.event)).toEqual([
      "resume",
      "created",
    ]);
  }, 60_000);

  it("N09: lease drží jiný běh 60 min → ticky v T+1, T+2, T+4, T+9, T+19, T+49, žádná minutová smyčka, 0 zápisů mimo outcomes/ a last-gate-start", async () => {
    seed(T, T - 10 * M);
    await holdLease();
    const before = snapshot();
    const ticks = minutes(T + M, T + 60 * M, "ok");
    expect(ticks.map((t) => t.at)).toEqual([1, 2, 4, 9, 19, 49]);
    expect(ticks.map((t) => t.reason)).toEqual(["a", "c", "c", "c", "c", "c"]);
    expect(ticks.length).toBeLessThanOrEqual(6);
    expect(snapshot()).toBe(before);
    expect(resumeCount()).toBe(0);
    await releaseLease();
  }, 60_000);

  it("N09: guard ALARM trvale → stejný orakl jako lease 60 min", () => {
    seed(T, T - 10 * M);
    const before = snapshot();
    const ticks = minutes(T + M, T + 60 * M, "guard_alarm");
    expect(ticks.map((t) => t.at)).toEqual([1, 2, 4, 9, 19, 49]);
    expect(snapshot()).toBe(before);
    expect(
      fs
        .readFileSync(path.join(runs, `wake/outcomes/${T + 49 * M}`), "utf8")
        .split("\n")[0],
    ).toBe("guard_alarm");
  });

  it("dvě brány naráz: druhá při živém zámku skončí bez ticku; mrtvý PID → zámek do stale-locks/, brána pokračuje", async () => {
    // skutečný souběh: brána A drží zámek během pomalého ticku
    const a = spawn(SH, [GATE], {
      env: {
        NODE_ENV: "test",
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        HOME: base,
        TARS_RUNS_DIR: runs,
        TARS_GATE_NOW: String(T),
        TICKLOG: tickLog,
        TARS_GATE_TICK: `printf '%s\\n' "$TARS_GATE_START" >> "$TICKLOG"; sleep 2`,
      },
      stdio: "ignore",
    });
    await waitFile(tickLog);
    expect(fs.existsSync(path.join(runs, "wake/gate.lock.d"))).toBe(true);
    const b = gate(T + 40 * M); // (b) by jinak platilo
    expect(b.ticked).toBe(false);
    expect(b.stdout).toMatch(/zámek drží jiná brána/);
    await new Promise((r) => (a as ChildProcess).on("exit", r));
    expect(fs.readFileSync(tickLog, "utf8").trim().split("\n")).toEqual([
      String(T),
    ]);
    expect(fs.existsSync(path.join(runs, "wake/gate.lock.d"))).toBe(false);
    expect(ls(`wake/gate-locks/${Math.floor(T / 86400)}`)).toHaveLength(1);

    // mrtvý PID v zámku
    const dead = spawnSync("/bin/sh", ["-c", "echo $$"], {
      encoding: "utf8",
    }).stdout.trim();
    fs.mkdirSync(path.join(runs, "wake/gate.lock.d"));
    fs.writeFileSync(path.join(runs, "wake/gate.lock.d/pid"), `${dead} ${T}\n`);
    const c = gate(T + 40 * M);
    expect(c.ticked).toBe(true);
    expect(ls("wake/stale-locks")).toHaveLength(1);

    // živý PID (tento proces) → bez ticku, zámek zůstane
    fs.mkdirSync(path.join(runs, "wake/gate.lock.d"));
    fs.writeFileSync(
      path.join(runs, "wake/gate.lock.d/pid"),
      `${process.pid} ${T + 40 * M}\n`,
    );
    expect(gate(T + 80 * M).ticked).toBe(false);
    expect(fs.existsSync(path.join(runs, "wake/gate.lock.d"))).toBe(true);
    // ochrana před recyklací PID: živý PID se zámkem starším než TARS_GATE_LOCK_MAX_S = zastaralý
    expect(gate(T + 80 * M, { TARS_GATE_LOCK_MAX_S: "600" }).ticked).toBe(true);
    expect(ls("wake/stale-locks")).toHaveLength(2);

    // zámek bez PID: první spuštění čeká (držitel může být mezi mkdir a zápisem PID), druhé ho prohlásí za zastaralý
    fs.mkdirSync(path.join(runs, "wake/gate.lock.d"));
    expect(gate(T + 200 * M).ticked).toBe(false);
    expect(gate(T + 201 * M).ticked).toBe(true);
    expect(ls("wake/stale-locks")).toHaveLength(3);
  }, 30_000);

  it("bez TARS_GATE_TICK se tick nespustí a last-gate-start se nezapíše; neplatné hodiny = chyba", () => {
    const r = gate(T, { TARS_GATE_TICK: "" });
    expect(r.status).toBe(1);
    expect(r.ticked).toBe(false);
    expect(fs.existsSync(path.join(runs, "wake/last-gate-start"))).toBe(false);
    expect(gate(0, { TARS_GATE_NOW: "zítra" }).status).toBe(1);
  });

  it("brána next-wake nikdy nezapisuje a nic nemaže", () => {
    seed(T + 5 * M, T - 10 * M);
    const nw = fs.readFileSync(path.join(runs, "next-wake"), "utf8");
    for (let now = T - 9 * M; now <= T + 4 * M; now += M) gate(now);
    expect(fs.readFileSync(path.join(runs, "next-wake"), "utf8")).toBe(nw);
    const src = fs
      .readFileSync(GATE, "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .join("\n");
    expect(src).not.toMatch(/\brm\b|\brmdir\b|\bnode\b|\bnpx\b/);
    expect(src).not.toMatch(/>\s*"\$RUNS\/next-wake"/);
  });
});
