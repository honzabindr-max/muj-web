// Short-term memory runs/<order-id>/state.json, episodic memory runs/log.jsonl (§4).
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { redactDeep } from "./secret-scan";
import type { LogEntry, Order } from "./types";

/**
 * Content of runs/.lock (DR-039, etapa 2). `token` identifies one grant, `fence` is a monotonic number (runs/.fence)
 * that every state saved under the grant carries; `pid` + `started` (ps -o lstart) prove whether the holder still runs.
 */
export interface TickLease {
  token: string;
  fence: number;
  pid: number;
  /** Start time of the holder process (`ps -o lstart=`), so a reused PID is never taken for the holder. */
  started: string;
  acquired_at: string;
  heartbeat_at: string;
}

export type HolderStatus = "alive" | "dead" | "unknown";

/** Start time of a running process (`ps -o lstart=`); undefined when ps fails or the PID does not exist. */
export function processStartTime(pid: number): string | undefined {
  if (!Number.isInteger(pid) || pid <= 0) return undefined;
  const r = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8", timeout: 5000 });
  if (r.status !== 0 || typeof r.stdout !== "string") return undefined;
  const s = r.stdout.trim().replace(/\s+/g, " ");
  return s || undefined;
}

/** true = the PID exists (also without permission to signal it), false = it does not, undefined = cannot tell. */
export function pidExists(pid: number): boolean | undefined {
  if (!Number.isInteger(pid) || pid <= 0) return undefined;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return false;
    if (code === "EPERM") return true;
    return undefined;
  }
}

/**
 * Is the holder of a lock still running? Only a proof counts: the PID does not exist, or it exists with another start
 * time (PID reused) → "dead". Anything we cannot prove (unreadable lock, old format without start time, ps failed)
 * → "unknown", which the caller treats as HOLD. The age of the lock or of its heartbeat is never a proof.
 */
export function holderStatus(lease: Partial<TickLease> | undefined, probe = { pidExists, processStartTime }): HolderStatus {
  const pid = Number(lease?.pid);
  if (!Number.isInteger(pid) || pid <= 0) return "unknown";
  const exists = probe.pidExists(pid);
  if (exists === false) return "dead";
  if (exists !== true) return "unknown";
  if (!lease?.started) return "unknown";
  const started = probe.processStartTime(pid);
  if (!started) return "unknown";
  return started === lease.started ? "alive" : "dead";
}

/** Parses runs/.lock: JSON lease, or the old format (only a PID). Undefined = unreadable. */
export function parseLease(text: string): Partial<TickLease> | undefined {
  const t = text.trim();
  if (/^\d+$/.test(t)) return { pid: Number(t) }; // lock written before etapa 2: PID only, no start time
  try {
    const v = JSON.parse(t) as Partial<TickLease>;
    return v && typeof v === "object" ? v : undefined;
  } catch {
    return undefined;
  }
}

export class Store {
  /** Tick lease held by this instance (set by acquireLock, cleared by releaseLock). Saves through it are fenced. */
  private lease: TickLease | undefined;
  private heartbeatTimer: NodeJS.Timeout | undefined;
  private stateLockDepth = 0;
  /** Start time of this process, read once (ps). */
  private static ownStart: string | undefined;

  constructor(public readonly runsDir: string) {
    fs.mkdirSync(runsDir, { recursive: true });
  }

  orderDir(id: string): string {
    const d = path.join(this.runsDir, id);
    fs.mkdirSync(d, { recursive: true });
    return d;
  }

  /**
   * Compare-and-set save (DR-039, etapa 2). `order.version` is the version the caller read; the write succeeds only
   * when state.json still has exactly that version, and stores version + 1 (also back into `order`, so a caller that
   * keeps working with the same object stays current). Older output — a late worker after an abort, a second Store
   * that read earlier — is refused and logged, the newer state stays. While this instance holds the tick lease the
   * save is also fenced: the lock must still carry our token and the stored state must not carry a newer fence.
   * Runs under the short `.state.lock`. Returns false when refused; never throws for a refusal.
   */
  save(order: Order): boolean {
    return this.withStateLock(() => {
      const file = path.join(this.orderDir(order.id), "state.json");
      const disk = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Order) : undefined;
      const expected = order.version ?? 0;
      const current = disk ? (disk.version ?? 0) : 0;
      if (expected !== current) return this.refuse(order, `verze ${expected} ≠ uložená ${current} (${disk?.state ?? "?"})`);
      let fence = disk?.fence;
      if (this.lease) {
        const held = this.readLease();
        if (held?.token !== this.lease.token) return this.refuse(order, "fence: tick lock už nedrží tento běh");
        if ((disk?.fence ?? 0) > this.lease.fence) return this.refuse(order, `fence ${this.lease.fence} < uložený ${disk?.fence}`);
        fence = this.lease.fence;
      }
      const next: Order = { ...order, version: current + 1, ...(fence !== undefined ? { fence } : {}) };
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(redactDeep(next), null, 2) + "\n"); // state.json never keeps a token either
      fs.renameSync(tmp, file); // atomic replace: a crash never leaves half a state
      order.version = next.version;
      if (fence !== undefined) order.fence = fence;
      return true;
    });
  }

  private refuse(order: Order, reason: string): false {
    this.log({ ts: new Date().toISOString(), order: order.id, kind: "error", role: "orchestrator", result: `zastaralý zápis stavu odmítnut (${order.state})`, reason });
    return false;
  }

  load(id: string): Order {
    return JSON.parse(
      fs.readFileSync(path.join(this.runsDir, id, "state.json"), "utf8"),
    ) as Order;
  }

  listOrders(): Order[] {
    if (!fs.existsSync(this.runsDir)) return [];
    return fs
      .readdirSync(this.runsDir)
      .filter(
        (d) =>
          d.startsWith("wo-") &&
          fs.existsSync(path.join(this.runsDir, d, "state.json")),
      )
      .sort()
      .map((d) => this.load(d));
  }

  /** Every string in a log entry passes the secret redaction: a token never reaches log.jsonl. */
  log(entry: LogEntry): void {
    fs.appendFileSync(
      path.join(this.runsDir, "log.jsonl"),
      JSON.stringify(redactDeep(entry)) + "\n",
    );
  }

  readLog(limit = 50): LogEntry[] {
    const f = path.join(this.runsDir, "log.jsonl");
    if (!fs.existsSync(f)) return [];
    const lines = fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean);
    return lines.slice(-limit).map((l) => JSON.parse(l) as LogEntry);
  }

  writeFile(id: string, name: string, content: string): string {
    const p = path.join(this.orderDir(id), name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
    return p;
  }

  readFile(id: string, name: string): string {
    return fs.readFileSync(path.join(this.runsDir, id, name), "utf8");
  }

  /**
   * Short lock around one synchronous read-modify-write of an order's state (every `save`, owner decision from Notion
   * in a tick, `cli owner`, `abort`, the tick lease). Separate from the tick lock, which is held for a whole tick.
   * Re-entrant within one Store instance (a save inside `withStateLock` does not wait for itself). Released only
   * while it still carries our token. Waits up to `waitMs`, then throws.
   */
  withStateLock<T>(fn: () => T, waitMs = 5000, staleMs = 30_000): T {
    if (this.stateLockDepth > 0) {
      this.stateLockDepth++;
      try {
        return fn();
      } finally {
        this.stateLockDepth--;
      }
    }
    const f = path.join(this.runsDir, ".state.lock");
    const mine = `${process.pid} ${randomUUID()}`;
    const t0 = Date.now();
    for (;;) {
      try {
        fs.writeFileSync(f, mine, { flag: "wx" });
        break;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; // EACCES, ENOSPC, ...: not a collision, never wait on it
      }
      // Somebody holds it. Whatever happens below, the timeout is checked on every pass.
      try {
        if (Date.now() - fs.statSync(f).mtimeMs > staleMs) fs.rmSync(f, { force: true });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; // vanished meanwhile: just try again
      }
      if (Date.now() - t0 >= waitMs) throw new Error("stav zakázky právě mění jiný proces (zámek .state.lock), zkus to za chvíli");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
    this.stateLockDepth = 1;
    try {
      return fn();
    } finally {
      this.stateLockDepth = 0;
      try {
        if (fs.readFileSync(f, "utf8") === mine) fs.rmSync(f, { force: true }); // never remove a lock somebody else took over
      } catch {
        /* already gone */
      }
    }
  }

  private lockFile(): string {
    return path.join(this.runsDir, ".lock");
  }

  /** Current tick lease on disk (undefined when there is no lock or it is unreadable). */
  readLease(): Partial<TickLease> | undefined {
    try {
      return parseLease(fs.readFileSync(this.lockFile(), "utf8"));
    } catch {
      return undefined;
    }
  }

  /** The fence of the lease this instance holds (passed to the steps through this Store). */
  get fence(): number | undefined {
    return this.lease?.fence;
  }

  /** Does the lock on disk still carry this instance's token? */
  holdsLease(): boolean {
    return Boolean(this.lease) && this.readLease()?.token === this.lease!.token;
  }

  private static ownStartTime(): string | undefined {
    Store.ownStart ??= processStartTime(process.pid);
    return Store.ownStart;
  }

  private writeLease(lease: TickLease, exclusive: boolean): void {
    const f = this.lockFile();
    const tmp = `${f}.${process.pid}.${lease.token}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(lease) + "\n");
    try {
      if (exclusive) fs.linkSync(tmp, f); // atomic create with full content; EEXIST when somebody was faster
      else fs.renameSync(tmp, f);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }

  private nextFence(): number {
    const f = path.join(this.runsDir, ".fence");
    const last = fs.existsSync(f) ? Number(fs.readFileSync(f, "utf8").trim()) || 0 : 0;
    const prev = Number(this.readLease()?.fence) || 0;
    const n = Math.max(last, prev) + 1;
    fs.writeFileSync(f, `${n}\n`);
    return n;
  }

  /**
   * Single-runner tick lock (launchd may fire while a long tick still runs) as a lease with a fence token.
   * Free → granted. Held → taken over only when the holder provably does not run (PID gone, or the PID now belongs to
   * a process with another start time); never by age. Anything uncertain → HOLD (false, the tick ends „locked“).
   * The whole decision runs under `.state.lock`, so two processes never both win.
   */
  acquireLock(heartbeatMs = 60_000): boolean {
    if (this.lease) return false; // one grant per instance; release first
    const started = Store.ownStartTime();
    if (!started) return false; // without our own start time nobody could ever prove us dead: HOLD
    let granted: TickLease | undefined;
    try {
      granted = this.withStateLock(() => {
        const exists = fs.existsSync(this.lockFile());
        const current = exists ? this.readLease() : undefined;
        if (exists) {
          const status = holderStatus(current);
          if (status !== "dead") return undefined;
          this.log({ ts: new Date().toISOString(), order: "-", kind: "info", role: "orchestrator", result: "tick lock převzat: držitel prokazatelně neběží", reason: `pid ${current?.pid}` });
        }
        const at = new Date().toISOString();
        const lease: TickLease = { token: randomUUID(), fence: this.nextFence(), pid: process.pid, started, acquired_at: at, heartbeat_at: at };
        this.writeLease(lease, !exists); // takeover replaces the dead holder's lock, a free lock is created exclusively
        return lease;
      }, 2000);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") return false;
      if (/\.state\.lock/.test((e as Error).message)) return false; // short lock busy: HOLD, the next tick tries again
      throw e;
    }
    if (!granted) return false;
    this.lease = granted;
    this.heartbeatTimer = setInterval(() => this.heartbeat(), heartbeatMs);
    this.heartbeatTimer.unref();
    return true;
  }

  /** Refreshes `heartbeat_at` of our lease (informative: liveness is proven by PID + start time, not by the heartbeat). */
  heartbeat(): boolean {
    if (!this.lease) return false;
    try {
      return this.withStateLock(() => {
        if (this.readLease()?.token !== this.lease?.token) return false;
        this.lease = { ...this.lease!, heartbeat_at: new Date().toISOString() };
        this.writeLease(this.lease, false);
        return true;
      }, 1000);
    } catch {
      return false;
    }
  }

  /** Releases the tick lock only while it carries our token: an old holder never deletes a newer lock. */
  releaseLock(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
    const lease = this.lease;
    this.lease = undefined;
    if (!lease) return;
    const removeIfMine = () => {
      if (this.readLease()?.token === lease.token) fs.rmSync(this.lockFile(), { force: true });
    };
    try {
      this.withStateLock(removeIfMine, 2000);
    } catch {
      removeIfMine(); // short lock busy: compare and remove anyway, never leave our own lock behind
    }
  }
}
