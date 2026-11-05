// DR-039, etapa 2 — one owner of the state: version/CAS saves, tick lease with fence, N3 (explicit tick scope).
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { Orchestrator, tickScopeError } from "../orchestrator";
import { transition } from "../state-machine";
import {
  holderStatus,
  parseLease,
  processStartTime,
  Store,
  type TickLease,
} from "../store";
import type { Order } from "../types";

const NOW = "2026-11-04T10:00:00.000Z";
const ROOT = path.resolve(__dirname, "..", "..", "..");
const TSX = path.join(ROOT, "node_modules", "tsx", "dist", "loader.mjs");

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-own-"));
});

function order(state: Order["state"] = "DOING"): Order {
  return {
    id: "wo-own",
    mission: "m",
    state,
    created_at: NOW,
    updated_at: NOW,
    fix_rounds: 0,
    manual_interventions: 0,
    history: [],
    meta: {},
    brief: {
      title: "T",
      department: "copy",
      milestone: "3.1",
      why: "w",
      goal: "g",
      inputs: [],
      acceptance: [],
      owner_decisions: [],
      sources: [],
    },
  };
}

type Dept = { create?: () => Promise<unknown>; check?: () => Promise<unknown> };
function make(store: Store, dept: Dept = {}) {
  const calls = { create: 0, check: 0 };
  const noop = async () => ({
    ok: true,
    text: "",
    limit: false,
    duration_ms: 0,
  });
  const d = {
    name: "fixture",
    creatorFamily: "gpt",
    checkerFamily: "claude",
    cardRole: "fixture",
    alwaysOwner: false,
    creatorModel: () => "c",
    checkerModel: () => "k",
    create: async () => {
      calls.create++;
      return dept.create ? dept.create() : { ok: true, draft_file: "draft.md" };
    },
    check: async () => {
      calls.check++;
      return dept.check ? dept.check() : { ok: true, verdict: "PASS" };
    },
    revise: noop,
    deliver: async () => ({ ok: true, url: "https://example.invalid/x" }),
  };
  const o = new Orchestrator({
    store,
    supervisor: { name: "s", model: "s", family: "claude", run: noop },
    briefChecker: { name: "b", model: "b", family: "gpt", run: noop },
    departments: { copy: d },
    cards: { check: () => ({ ok: true, problems: [] }), text: () => "" },
    ladder: {},
    notion: {
      createPage: async () => ({ url: "https://example.invalid/card" }),
    },
    guard: () => ({ alarm: false, summary: "ok" }),
    draftParentId: "p",
    repoRoot: dir,
    capsulePath: path.join(dir, "none"),
    now: () => new Date(NOW),
    maxStepsPerTick: 1,
  } as never);
  return { o, calls };
}

const refusals = (s: Store) =>
  s
    .readLog(200)
    .filter((e) => e.result?.startsWith("zastaralý zápis stavu odmítnut"));

function deadPid(): number {
  const r = spawnSync(
    process.execPath,
    ["-e", "process.stdout.write(String(process.pid))"],
    { encoding: "utf8" },
  );
  return Number(r.stdout);
}

function foreignLease(extra: Partial<TickLease> = {}): TickLease {
  return {
    token: "foreign",
    fence: 1000,
    pid: process.pid,
    started: processStartTime(process.pid)!,
    acquired_at: NOW,
    heartbeat_at: NOW,
    ...extra,
  };
}

describe("version / CAS (Store.save)", () => {
  it("every save stores a monotonic version; load returns it", () => {
    const s = new Store(dir);
    const o = order();
    expect(s.save(o)).toBe(true);
    expect(s.load(o.id).version).toBe(1);
    expect(s.save({ ...s.load(o.id), updated_at: "x" })).toBe(true);
    expect(s.load(o.id).version).toBe(2);
    expect(o.version).toBe(1); // the object saved first keeps the version it was written with
  });

  it("stale-output-preserves-newer-state: output based on an older version is refused and logged, the newer state stays", () => {
    const s = new Store(dir);
    s.save(order("DOING"));
    const old = s.load("wo-own");
    make(s).o.abort("wo-own", "test cancel");
    expect(s.save(transition(old, { type: "created" }, NOW))).toBe(false);
    expect(s.load("wo-own").state).toBe("FAILED");
    expect(refusals(s)).toHaveLength(1);
    expect(refusals(s)[0].reason).toMatch(/verze 1 ≠ uložená 2/);
  });

  it("two Store instances: the one that read earlier loses, never overwrites", () => {
    const a = new Store(dir);
    const b = new Store(dir);
    a.save(order("DOING"));
    const ra = a.load("wo-own");
    const rb = b.load("wo-own");
    expect(a.save({ ...ra, failure_reason: "a" })).toBe(true);
    expect(b.save({ ...rb, failure_reason: "b" })).toBe(false);
    expect(a.load("wo-own").failure_reason).toBe("a");
    expect(b.load("wo-own").version).toBe(2);
  });

  it("a state file from before etapa 2 (no version) is accepted once and gets version 1", () => {
    const s = new Store(dir);
    fs.mkdirSync(path.join(dir, "wo-own"));
    fs.writeFileSync(
      path.join(dir, "wo-own", "state.json"),
      JSON.stringify(order("WAITING_OWNER")),
    );
    const legacy = s.load("wo-own");
    expect(legacy.version).toBeUndefined();
    expect(s.save({ ...legacy, updated_at: "y" })).toBe(true);
    expect(s.load("wo-own").version).toBe(1);
    expect(s.save({ ...legacy, updated_at: "z" })).toBe(false); // the same legacy read again is stale now
  });

  it("abort during a step: the late completion is refused, no further step runs, the order stays FAILED", async () => {
    const s = new Store(dir);
    s.save(order("DOING"));
    const cli = new Store(dir); // `cli abort` in another process
    const { o, calls } = make(s, {
      create: async () => {
        make(cli).o.abort("wo-own", "owner cancelled");
        // FIX2 (4a nález 2): draft musí existovat, jinak je krok FINISHED ok:false ještě před CAS.
        fs.writeFileSync(path.join(dir, "wo-own", "late.md"), "draft\n");
        return { ok: true, draft_file: "late.md" };
      },
    });
    const r = await o.step(s.load("wo-own"));
    expect(r.state).toBe("FAILED");
    const disk = s.load("wo-own");
    expect(disk.state).toBe("FAILED");
    expect(disk.draft_file).toBeUndefined();
    expect(disk.failure_reason).toMatch(/owner cancelled/);
    expect(calls.check).toBe(0);
    expect(refusals(s)).toHaveLength(1);
    expect(
      s
        .readLog(200)
        .filter((e) => e.kind === "transition" && e.to === "CHECKING"),
    ).toHaveLength(0);
  });

  it("late completion inside a tick: tick ends with the newer state, lock released", async () => {
    const s = new Store(dir);
    s.save(order("DOING"));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { o, calls } = make(s, {
      create: async () => {
        await gate; // the worker hangs; meanwhile the owner aborts
        // FIX2 (4a nález 2): draft musí existovat, jinak je krok FINISHED ok:false ještě před CAS.
        fs.writeFileSync(path.join(dir, "wo-own", "late.md"), "draft\n");
        return { ok: true, draft_file: "late.md" };
      },
    });
    const running = o.tick();
    await new Promise((r) => setTimeout(r, 20));
    make(new Store(dir)).o.abort("wo-own", "abort během kroku");
    release();
    const r = await running;
    expect(r).toEqual({ status: "advanced", order: "wo-own", state: "FAILED" });
    expect(s.load("wo-own").state).toBe("FAILED");
    expect(calls.check).toBe(0);
    expect(fs.existsSync(path.join(dir, ".lock"))).toBe(false);
  });
});

describe("tick lease with fence", () => {
  it("expired-lease-live-owner: an old lock of a live holder is never taken over; the holder releases only its own", () => {
    const a = new Store(dir);
    const b = new Store(dir);
    expect(a.acquireLock()).toBe(true);
    expect(b.acquireLock()).toBe(false);
    const lock = path.join(dir, ".lock");
    fs.utimesSync(lock, new Date(0), new Date(0));
    const lease = JSON.parse(fs.readFileSync(lock, "utf8")) as TickLease;
    fs.writeFileSync(
      lock,
      JSON.stringify({
        ...lease,
        heartbeat_at: "2000-01-01T00:00:00.000Z",
        acquired_at: "2000-01-01T00:00:00.000Z",
      }),
    );
    expect(b.acquireLock()).toBe(false); // age and heartbeat are never a proof
    a.releaseLock();
    expect(fs.existsSync(lock)).toBe(false);
    expect(b.acquireLock()).toBe(true);
    b.releaseLock();
  });

  it("lock content: token, fence, PID, process start time, heartbeat; fence grows with every grant", () => {
    const a = new Store(dir);
    expect(a.acquireLock()).toBe(true);
    const l1 = parseLease(
      fs.readFileSync(path.join(dir, ".lock"), "utf8"),
    ) as TickLease;
    expect(l1.pid).toBe(process.pid);
    expect(l1.started).toBe(processStartTime(process.pid));
    expect(l1.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.fence).toBe(l1.fence);
    expect(a.heartbeat()).toBe(true);
    expect(
      (
        parseLease(
          fs.readFileSync(path.join(dir, ".lock"), "utf8"),
        ) as TickLease
      ).heartbeat_at >= l1.heartbeat_at,
    ).toBe(true);
    a.releaseLock();
    expect(a.acquireLock()).toBe(true);
    expect(a.fence).toBe(l1.fence + 1);
    a.releaseLock();
  });

  it("takeover only with proof: PID gone, or PID reused by a process with another start time", () => {
    const lock = path.join(dir, ".lock");
    fs.writeFileSync(
      lock,
      JSON.stringify(foreignLease({ pid: deadPid(), fence: 7 })),
    );
    const b = new Store(dir);
    expect(b.acquireLock()).toBe(true);
    expect(b.fence).toBe(8); // never below the dead holder's fence
    b.releaseLock();
    fs.writeFileSync(
      lock,
      JSON.stringify(foreignLease({ started: "Mon Jan  1 00:00:00 2001" })),
    );
    expect(b.acquireLock()).toBe(true);
    b.releaseLock();
    expect(
      new Store(dir)
        .readLog(50)
        .filter((e) => e.result?.startsWith("tick lock převzat")),
    ).toHaveLength(2);
  });

  it("uncertainty = HOLD: unreadable lock, old format with a live PID, missing start time, ps failure", () => {
    const lock = path.join(dir, ".lock");
    const b = new Store(dir);
    for (const content of [
      "",
      "{nope",
      String(process.pid),
      JSON.stringify({ token: "x", pid: process.pid }),
    ]) {
      fs.writeFileSync(lock, content);
      expect(b.acquireLock()).toBe(false);
    }
    fs.writeFileSync(lock, String(deadPid())); // old format, holder gone: provably dead
    expect(b.acquireLock()).toBe(true);
    b.releaseLock();
    const lease = { pid: 4242, started: "x" };
    expect(
      holderStatus(lease, {
        pidExists: () => undefined,
        processStartTime: () => "x",
      }),
    ).toBe("unknown");
    expect(
      holderStatus(lease, {
        pidExists: () => true,
        processStartTime: () => undefined,
      }),
    ).toBe("unknown");
    expect(
      holderStatus(lease, {
        pidExists: () => true,
        processStartTime: () => "x",
      }),
    ).toBe("alive");
    expect(
      holderStatus(lease, {
        pidExists: () => true,
        processStartTime: () => "y",
      }),
    ).toBe("dead");
    expect(
      holderStatus(lease, {
        pidExists: () => false,
        processStartTime: () => undefined,
      }),
    ).toBe("dead");
  });

  it("an old holder never deletes the newer lock", () => {
    const a = new Store(dir);
    expect(a.acquireLock()).toBe(true);
    const lock = path.join(dir, ".lock");
    fs.writeFileSync(lock, JSON.stringify(foreignLease())); // somebody else holds it now
    a.releaseLock();
    expect(JSON.parse(fs.readFileSync(lock, "utf8")).token).toBe("foreign");
    expect(a.heartbeat()).toBe(false);
  });

  it("fence: a save after the lease was lost, or over a state with a newer fence, is refused", () => {
    const a = new Store(dir);
    expect(a.acquireLock()).toBe(true);
    const o = order("DOING");
    expect(a.save(o)).toBe(true);
    expect(a.load(o.id).fence).toBe(a.fence);
    const lock = path.join(dir, ".lock");
    const mine = fs.readFileSync(lock, "utf8");
    fs.writeFileSync(lock, JSON.stringify(foreignLease()));
    expect(a.save({ ...a.load(o.id), failure_reason: "x" })).toBe(false);
    expect(refusals(a).at(-1)?.reason).toMatch(/fence: tick lock už nedrží/);
    fs.writeFileSync(lock, mine);
    const cur = a.load(o.id);
    fs.writeFileSync(
      path.join(dir, o.id, "state.json"),
      JSON.stringify({ ...cur, fence: (a.fence ?? 0) + 5 }),
    );
    expect(a.save({ ...a.load(o.id), failure_reason: "y" })).toBe(false);
    expect(refusals(a).at(-1)?.reason).toMatch(/fence \d+ < uložený/);
    a.releaseLock();
  });

  it("a tick whose lease was taken away stops before the next step and ends „locked“", async () => {
    const s = new Store(dir);
    const o0 = order("DOING");
    s.save(o0);
    const { o, calls } = make(s, {
      create: async () => {
        fs.writeFileSync(
          path.join(dir, ".lock"),
          JSON.stringify(foreignLease()),
        );
        // FIX2 (4a nález 2): draft musí existovat, jinak je krok FINISHED ok:false ještě před CAS.
        fs.writeFileSync(path.join(dir, "wo-own", "d.md"), "draft\n");
        return { ok: true, draft_file: "d.md" };
      },
    });
    (o as unknown as { d: { maxStepsPerTick: number } }).d.maxStepsPerTick = 5;
    const r = await o.tick();
    expect(r).toEqual({ status: "locked" });
    expect(s.load(o0.id).state).toBe("DOING");
    expect(calls.check).toBe(0);
    expect(
      JSON.parse(fs.readFileSync(path.join(dir, ".lock"), "utf8")).token,
    ).toBe("foreign"); // not deleted by the old holder
  });

  it("two real OS processes start at a barrier: exactly one grant in each of 20 rounds", async () => {
    const rounds = 20;
    const kids = ["a", "b"].map((id) =>
      spawn(
        process.execPath,
        [
          "--import",
          TSX,
          path.join(__dirname, "lease-child.ts"),
          dir,
          String(rounds),
          id,
        ],
        { stdio: ["ignore", "ignore", "pipe"] },
      ),
    );
    const exits = kids.map(
      (k) => new Promise<number | null>((r) => k.on("exit", (c) => r(c))),
    );
    const until = async (files: string[]) => {
      const t0 = Date.now();
      while (!files.every((f) => fs.existsSync(path.join(dir, f)))) {
        if (Date.now() - t0 > 60_000)
          throw new Error(`timeout waiting for ${files.join(",")}`);
        await new Promise((r) => setTimeout(r, 5));
      }
    };
    await until(["ready-a", "ready-b"]);
    const pids = ["a", "b"].map((id) =>
      Number(fs.readFileSync(path.join(dir, `ready-${id}`), "utf8")),
    );
    expect(pids[0]).not.toBe(pids[1]);
    const grants: number[] = [];
    for (let r = 0; r < rounds; r++) {
      fs.writeFileSync(path.join(dir, `go-${r}`), "");
      await until([`res-${r}-a`, `res-${r}-b`]);
      grants.push(
        ["a", "b"].filter(
          (id) =>
            fs.readFileSync(path.join(dir, `res-${r}-${id}`), "utf8") === "1",
        ).length,
      );
      fs.writeFileSync(path.join(dir, `end-${r}`), "");
      await until([`rel-${r}-a`, `rel-${r}-b`]);
    }
    expect(await Promise.all(exits)).toEqual([0, 0]);
    expect(grants).toEqual(Array(rounds).fill(1));
    expect(fs.existsSync(path.join(dir, ".lock"))).toBe(false);
  }, 120_000);
});

const until = async (files: string[], ms = 60_000) => {
  const t0 = Date.now();
  while (!files.every((f) => fs.existsSync(path.join(dir, f)))) {
    if (Date.now() - t0 > ms)
      throw new Error(`timeout waiting for ${files.join(",")}`);
    await new Promise((r) => setTimeout(r, 5));
  }
};
const child = (role: string) =>
  spawn(
    process.execPath,
    [
      "--import",
      TSX,
      path.join(__dirname, "state-lock-child.ts"),
      dir,
      role,
      "wo-own",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
const exited = (k: ReturnType<typeof spawn>) =>
  new Promise<number | null>((r) => k.on("exit", (c) => r(c)));

describe("short .state.lock: token + PID + start time, takeover only with proof (kolo oprav 1)", () => {
  it("two OS processes: A paused (SIGSTOP) mid-save with a lock aged past 30 s, B abort waits — B's state survives, A's late write is refused", async () => {
    const s = new Store(dir);
    const o = order("DOING");
    for (let i = 0; i < 5; i++)
      s.save(i === 0 ? o : { ...s.load(o.id), updated_at: `t${i}` });
    expect(s.load(o.id).version).toBe(5);
    const a = child("a");
    const aExit = exited(a);
    await until(["a-in"]);
    process.kill(a.pid!, "SIGSTOP"); // A really stops in the middle of its read–check–write
    const lock = path.join(dir, ".state.lock");
    const held = JSON.parse(fs.readFileSync(lock, "utf8"));
    expect(held.pid).toBe(a.pid);
    expect(held.started).toBe(processStartTime(a.pid!));
    const old = new Date(Date.now() - 10 * 60_000); // simulated: the lock is 10 minutes old (old code stole it after 30 s)
    fs.utimesSync(lock, old, old);
    const b = child("b");
    const bExit = exited(b);
    await until(["b-start"]);
    await new Promise((r) => setTimeout(r, 700)); // B polls the lock several times meanwhile
    expect(fs.existsSync(path.join(dir, "b-save"))).toBe(false); // B did not take over by age
    expect(JSON.parse(fs.readFileSync(lock, "utf8")).token).toBe(held.token);
    expect(s.load(o.id).version).toBe(5);
    process.kill(a.pid!, "SIGCONT");
    fs.writeFileSync(path.join(dir, "a-go"), "");
    expect(await Promise.all([aExit, bExit])).toEqual([0, 0]);
    const r = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");
    expect(r("a-save")).toBe("1"); // A finished its write while it held the lock (version 6)
    expect(r("b-save")).toBe("1"); // B's abort applied after it, on top of version 6
    expect(r("a-late")).toBe("0"); // A's late output based on version 5 is refused
    const disk = s.load(o.id);
    expect(disk.state).toBe("FAILED");
    expect(disk.failure_reason).toMatch(/manual abort: B/);
    expect(disk.version).toBe(7);
    expect(disk.draft_file).toBe("a.md");
    // A's late write lands before or after B's abort (both race for the lock once A leaves it): refused either way.
    expect(refusals(s).at(-1)?.reason).toMatch(/verze 5 ≠ uložená [67]/);
    expect(fs.existsSync(lock)).toBe(false);
  }, 120_000);

  it("a lock of a provably dead holder (PID gone, or PID reused with another start time) is taken over and logged", () => {
    const lock = path.join(dir, ".state.lock");
    const s = new Store(dir);
    for (const h of [
      {
        token: "dead1",
        pid: deadPid(),
        started: "Mon Jan  1 00:00:00 2001",
        acquired_at: NOW,
      },
      {
        token: "dead2",
        pid: process.pid,
        started: "Mon Jan  1 00:00:00 2001",
        acquired_at: NOW,
      },
    ]) {
      fs.writeFileSync(lock, JSON.stringify(h));
      expect(s.withStateLock(() => "took over", 2000)).toBe("took over");
      expect(fs.existsSync(lock)).toBe(false);
    }
    expect(
      s.readLog(50).filter((e) => e.result?.startsWith(".state.lock převzat")),
    ).toHaveLength(2);
    expect(
      fs.readdirSync(dir).filter((f) => f.startsWith(".state.lock")),
    ).toEqual([]);
  });

  it("HOLD: live holder (even with an ancient timestamp), unreadable / old-format lock, a takeover guard left behind", () => {
    const lock = path.join(dir, ".state.lock");
    const s = new Store(dir);
    const live = {
      token: "live",
      pid: process.pid,
      started: processStartTime(process.pid)!,
      acquired_at: "2000-01-01T00:00:00.000Z",
    };
    for (const content of [
      JSON.stringify(live),
      "",
      "{nope",
      `${deadPid()} 0c7e`,
      JSON.stringify({ pid: deadPid() }),
    ]) {
      fs.writeFileSync(lock, content);
      fs.utimesSync(lock, new Date(0), new Date(0));
      expect(() => s.withStateLock(() => 1, 120)).toThrow(/HOLD/);
      expect(fs.readFileSync(lock, "utf8")).toBe(content);
    }
    fs.writeFileSync(
      lock,
      JSON.stringify({
        token: "dead",
        pid: deadPid(),
        started: "x",
        acquired_at: NOW,
      }),
    );
    fs.writeFileSync(`${lock}.takeover`, "4242 crashed-taker");
    expect(() => s.withStateLock(() => 1, 120)).toThrow(/HOLD/);
    fs.rmSync(`${lock}.takeover`);
    expect(s.withStateLock(() => "ok", 2000)).toBe("ok");
  });
});

describe(".fence counter: atomic, never read as 0 (kolo oprav 1)", () => {
  const seed = (fence: number) => {
    fs.mkdirSync(path.join(dir, "wo-own"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "wo-own", "state.json"),
      JSON.stringify({ ...order("DOING"), version: 3, fence }),
    );
  };
  const fenceFile = () => path.join(dir, ".fence");

  for (const [name, damage] of [
    ["truncated", () => fs.writeFileSync(fenceFile(), "5")], // half of "500\n"? any shorter number is still below the stored fence
    ["empty", () => fs.writeFileSync(fenceFile(), "")],
    ["garbage", () => fs.writeFileSync(fenceFile(), "\u0000\u0000")],
    ["missing", () => fs.rmSync(fenceFile(), { force: true })],
  ] as const) {
    it(`${name} .fence with a stored state.fence=500 → new fence > 500, the order continues`, () => {
      seed(500);
      damage();
      const s = new Store(dir);
      expect(s.acquireLock()).toBe(true);
      expect(s.fence).toBe(501);
      expect(fs.readFileSync(fenceFile(), "utf8")).toBe("501\n");
      expect(s.save({ ...s.load("wo-own"), failure_reason: "pokračuje" })).toBe(
        true,
      );
      expect(s.load("wo-own").fence).toBe(501);
      s.releaseLock();
      expect(s.acquireLock()).toBe(true);
      expect(s.fence).toBe(502);
      s.releaseLock();
      expect(fs.readdirSync(dir).filter((f) => f.includes(".tmp"))).toEqual([]);
    });
  }

  it("damaged .fence and an unreadable state.json → HOLD with a clear reason, nothing written; a readable counter still works", () => {
    seed(500);
    fs.mkdirSync(path.join(dir, "wo-bad"));
    fs.writeFileSync(path.join(dir, "wo-bad", "state.json"), "{trunc");
    fs.writeFileSync(fenceFile(), "");
    const s = new Store(dir);
    expect(s.acquireLock()).toBe(false);
    expect(fs.existsSync(path.join(dir, ".lock"))).toBe(false);
    expect(fs.readFileSync(fenceFile(), "utf8")).toBe("");
    const hold = s
      .readLog(20)
      .find((e) => e.result === "tick lock HOLD: fence nelze bezpečně určit");
    expect(hold?.reason).toMatch(
      /runs\/\.fence chybí nebo je poškozený.*wo-bad/,
    );
    fs.writeFileSync(fenceFile(), "700\n");
    expect(s.acquireLock()).toBe(true);
    expect(s.fence).toBe(701);
    s.releaseLock();
  });

  it("the counter is written through a unique tmp + rename (no in-place write of .fence)", () => {
    const writes: string[] = [];
    const ow = fs.openSync;
    const spy = vi.spyOn(fs, "openSync").mockImplementation(((
      p: fs.PathLike,
      ...rest: unknown[]
    ) => {
      writes.push(String(p));
      return (ow as (...a: unknown[]) => number)(p, ...rest);
    }) as typeof fs.openSync);
    const s = new Store(dir);
    expect(s.acquireLock()).toBe(true);
    spy.mockRestore();
    s.releaseLock();
    expect(
      writes.some((p) => /\.fence\.\d+\.[0-9a-f-]{36}\.tmp$/.test(p)),
    ).toBe(true);
    expect(writes).not.toContain(fenceFile());
  });
});

describe("N3: tick only with an explicit TARS_DEPARTMENTS", () => {
  it("tickScopeError: empty or unknown scope refused with a Czech reason", () => {
    expect(tickScopeError(undefined)).toMatch(/chybí TARS_DEPARTMENTS/);
    expect(tickScopeError(" , ")).toMatch(/chybí TARS_DEPARTMENTS/);
    expect(tickScopeError("copy,foo")).toMatch(/neznámé oddělení.*foo/);
    expect(tickScopeError("copy")).toBeUndefined();
    expect(tickScopeError("copy, dev,vizual")).toBeUndefined();
  });

  it("cli.ts tick without TARS_DEPARTMENTS exits 1, starts nothing and takes no lock", () => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TARS_RUNS_DIR: dir,
      TARS_PANEL: "0",
      TARS_GUARD: "/nonexistent",
    };
    delete env.TARS_DEPARTMENTS;
    const r = spawnSync(
      process.execPath,
      ["--import", TSX, path.join(ROOT, "tars", "orch", "cli.ts"), "tick"],
      { encoding: "utf8", env, timeout: 60_000 },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/tick odmítnut: chybí TARS_DEPARTMENTS/);
    expect(r.stdout).toBe("");
    expect(fs.readdirSync(dir)).toEqual([]);
  }, 60_000);

  it("the launchd plist sets TARS_DEPARTMENTS=copy", () => {
    const plist = fs.readFileSync(
      path.join(
        ROOT,
        "tars",
        "orch",
        "launchd",
        "work.good-inventions.tars-orch.plist",
      ),
      "utf8",
    );
    expect(plist).toMatch(
      /<key>TARS_DEPARTMENTS<\/key>\s*<string>copy<\/string>/,
    );
    expect(plist).toMatch(/cli\.ts tick/);
  });
});
