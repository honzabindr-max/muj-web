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

/** Content of runs/.state.lock (DR-039, etapa 2, kolo oprav 1): who holds the short lock, provable like the lease. */
export interface StateLockHolder {
  token: string;
  pid: number;
  /** `ps -o lstart=` of the holder; "" when it could not be read (then the lock is never taken over: HOLD). */
  started: string;
  acquired_at: string;
}

/** The next fence cannot be determined safely (damaged counter and an unreadable state.json): HOLD. */
export class FenceHoldError extends Error {}

/** Obsah runs/<id>/.panel.lock (PR #99, kolo oprav 5): jedno udělení zámku panelu zakázky. */
export interface PanelLease {
  order: string;
  token: string;
  /** monotónní číslo udělení (runs/<id>/.panel-fence); každý zápis řádku se proti němu kontroluje */
  fence: number;
  pid: number;
  started: string;
  acquired_at: string;
  /** token předchozího držitele, když byl zámek převzat po jeho prokázaném konci */
  took_over?: string;
}

/** Zámek panelu zakázky drží živý (nebo neprokazatelný) držitel, nebo náš fence už neplatí: HOLD, nic se nezapíše. */
export class PanelLockHoldError extends Error {}

/** Atomic, durable replace of a small file: unique tmp + fsync + rename + fsync of the directory. */
export function writeDurable(file: string, content: string): void {
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    const fd = fs.openSync(tmp, "wx");
    try {
      fs.writeSync(fd, content);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, file);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  const dfd = fs.openSync(path.dirname(file), "r");
  try {
    fs.fsyncSync(dfd);
  } finally {
    fs.closeSync(dfd);
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
   * Re-entrant within one Store instance (a save inside `withStateLock` does not wait for itself).
   *
   * DR-039, etapa 2 (kolo oprav 1): `.state.lock` carries token + PID + process start time and is created atomically
   * with its full content (tmp + link). A held lock is taken over only when its holder provably does not run (PID
   * gone, or the PID belongs to a process with another start time) — never by age: a holder paused in the middle of
   * a save (SIGSTOP, sleep, swap) keeps it, so the CAS read–check–rename in `save` is never interleaved. Anything we
   * cannot prove (unreadable or old-format lock, ps failure) → wait, after `waitMs` throw (HOLD; the caller retries
   * later). Released only while it still carries our token.
   */
  withStateLock<T>(fn: () => T, waitMs = 5000): T {
    if (this.stateLockDepth > 0) {
      this.stateLockDepth++;
      try {
        return fn();
      } finally {
        this.stateLockDepth--;
      }
    }
    const f = path.join(this.runsDir, ".state.lock");
    const holder: StateLockHolder = { token: randomUUID(), pid: process.pid, started: Store.ownStartTime() ?? "", acquired_at: new Date().toISOString() };
    const mine = JSON.stringify(holder) + "\n";
    const tmp = `${f}.${process.pid}.${holder.token}.tmp`;
    fs.writeFileSync(tmp, mine); // EACCES, ENOSPC, ...: not a collision, thrown at once
    const t0 = Date.now();
    let probed: { token?: string; at: number } = { at: 0 };
    try {
      for (;;) {
        try {
          fs.linkSync(tmp, f); // atomic create with the full content; EEXIST while somebody holds it
          break;
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; // not a collision: never wait on it
        }
        // Somebody holds it. Whatever happens below, the timeout is checked on every pass.
        const current = this.readStateLock(f);
        if (current && (current.token !== probed.token || Date.now() - probed.at >= 250)) {
          probed = { token: current.token, at: Date.now() };
          if (holderStatus(current) === "dead" && this.takeOverStateLock(f, current)) continue;
        }
        if (Date.now() - t0 >= waitMs) throw new Error("stav zakázky právě mění jiný proces (zámek .state.lock, HOLD), zkus to za chvíli");
        if (current !== null) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50); // null = vanished: retry at once
      }
    } finally {
      fs.rmSync(tmp, { force: true });
    }
    this.stateLockDepth = 1;
    try {
      return fn();
    } finally {
      this.stateLockDepth = 0;
      try {
        if (fs.readFileSync(f, "utf8") === mine) fs.rmSync(f, { force: true }); // never remove a lock somebody else holds
      } catch {
        /* already gone */
      }
    }
  }

  /**
   * Zámek panelu zakázky (PR #99, kolo oprav 5): `runs/<id>/.panel.lock` serializuje všechno, co čte nebo zapisuje řádek
   * panelu, jeho index a journal efektu (tick, `cli.ts panel-sync`, reissue, poll rozhodnutí). Na rozdíl od krátkého
   * `.state.lock` se drží i přes síťový zápis (async). Stejná pravidla jako lease etapy 2: token + PID + čas startu,
   * monotónní fence (`runs/<id>/.panel-fence`), převzetí jen po prokázaném konci držitele (nikdy podle stáří), cokoli
   * neprokazatelného = čekat, po `waitMs` HOLD (PanelLockHoldError, nic se nezapíše). Získání, kontrola fence i uvolnění
   * běží pod `.state.lock`. Není re-entrantní: `fn` nesmí znovu žádat o zámek panelu téže zakázky.
   */
  async withPanelLock<T>(id: string, fn: (lease: PanelLease) => Promise<T>, waitMs = 30_000, stateLockWaitMs = 5000): Promise<T> {
    const t0 = Date.now();
    let lease: PanelLease | undefined;
    for (;;) {
      lease = this.withStateLock(() => this.tryPanelLease(id), stateLockWaitMs);
      if (lease) break;
      if (Date.now() - t0 >= waitMs) throw new PanelLockHoldError(`panel zakázky ${id} právě zapisuje jiný proces (zámek .panel.lock, HOLD), zkus to za chvíli`);
      await new Promise((r) => setTimeout(r, 25));
    }
    const mine = lease;
    try {
      return await fn(mine);
    } finally {
      try {
        this.withStateLock(() => {
          if (this.readPanelLease(id)?.token === mine.token) fs.rmSync(this.panelLockFile(id), { force: true });
        }, 2000);
      } catch {
        /* .state.lock zaneprázdněný: zámek panelu zůstane a převezme ho až další proces po prokázaném konci tohoto */
      }
    }
  }

  /**
   * Fence check před každým zápisem panelu (volat pod `.state.lock`): zámek panelu musí pořád nést náš token i fence a
   * čítač nesmí znát novější udělení. Jinak PanelLockHoldError a zápis se neprovede.
   */
  assertPanelLease(lease: PanelLease): void {
    const cur = this.readPanelLease(lease.order);
    if (cur?.token !== lease.token || cur.fence !== lease.fence || this.readPanelFence(lease.order) !== lease.fence)
      throw new PanelLockHoldError(`fence panelu ${lease.fence} už neplatí (zámek .panel.lock drží jiné udělení), zápis se neprovede`);
  }

  private panelLockFile(id: string): string {
    return path.join(this.orderDir(id), ".panel.lock");
  }

  /** undefined = žádný zámek; null = nečitelný zámek (nikdy důkaz: HOLD). */
  private readPanelLease(id: string): PanelLease | null | undefined {
    const f = this.panelLockFile(id);
    if (!fs.existsSync(f)) return undefined;
    try {
      const v = JSON.parse(fs.readFileSync(f, "utf8")) as PanelLease;
      return v && typeof v === "object" && typeof v.token === "string" && Number.isInteger(v.fence) ? v : null;
    } catch {
      return null;
    }
  }

  /** Čítač fence panelu zakázky; poškozený čítač = HOLD (nikdy 0). */
  private readPanelFence(id: string): number {
    const f = path.join(this.orderDir(id), ".panel-fence");
    if (!fs.existsSync(f)) return 0;
    const n = Number(fs.readFileSync(f, "utf8").trim());
    if (!Number.isInteger(n) || n < 0) throw new PanelLockHoldError(`čítač runs/${id}/.panel-fence je poškozený, fence panelu nelze bezpečně určit (HOLD)`);
    return n;
  }

  /** Pod `.state.lock`: volný zámek nebo prokazatelně skončený držitel → nové udělení s fence + 1; jinak undefined. */
  private tryPanelLease(id: string): PanelLease | undefined {
    const cur = this.readPanelLease(id);
    if (cur === null) return undefined; // nečitelný zámek: čekat (HOLD), nikdy převzít
    if (cur && holderStatus(cur) !== "dead") return undefined;
    const started = Store.ownStartTime();
    if (!started) return undefined; // bez vlastního času startu by nás nikdo nemohl prokázat skončené: HOLD
    const fence = Math.max(this.readPanelFence(id), cur?.fence ?? 0) + 1;
    writeDurable(path.join(this.orderDir(id), ".panel-fence"), `${fence}\n`);
    const lease: PanelLease = { order: id, token: randomUUID(), fence, pid: process.pid, started, acquired_at: new Date().toISOString(), ...(cur ? { took_over: cur.token } : {}) };
    writeDurable(this.panelLockFile(id), JSON.stringify(lease) + "\n");
    if (cur) this.log({ ts: lease.acquired_at, order: id, kind: "error", role: "transport", result: "zámek panelu převzat po skončeném procesu (journal: nejdřív dohledání, nejasný stav = HOLD)", reason: `pid ${cur.pid}, fence ${cur.fence} → ${fence}` });
    return lease;
  }

  /** Holder of `.state.lock`: null = the file vanished, undefined = unreadable / not this format (never a proof). */
  private readStateLock(f: string): StateLockHolder | null | undefined {
    let text: string;
    try {
      text = fs.readFileSync(f, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
    try {
      const v = JSON.parse(text) as Partial<StateLockHolder>;
      return v && typeof v.token === "string" && Number.isInteger(v.pid) ? (v as StateLockHolder) : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Removes the `.state.lock` of a provably dead holder. Takers exclude each other with `.state.lock.takeover`
   * (exclusive create), so the file renamed away is exactly the dead holder's (token re-checked under that guard; a
   * live process never replaces an existing lock and the dead holder never removes it). A taker that crashed and left
   * the guard behind → every further takeover waits (HOLD, README: nouzový postup); normal locking still works.
   */
  private takeOverStateLock(f: string, dead: StateLockHolder): boolean {
    const guard = `${f}.takeover`;
    const me = `${process.pid} ${randomUUID()}`;
    try {
      fs.writeFileSync(guard, me, { flag: "wx" });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") return false; // another taker (or a crashed one): wait
      throw e;
    }
    try {
      const again = this.readStateLock(f);
      if (!again || again.token !== dead.token || holderStatus(again) !== "dead") return false;
      const grave = `${f}.${randomUUID()}.dead`;
      fs.renameSync(f, grave);
      fs.rmSync(grave, { force: true });
      this.log({ ts: new Date().toISOString(), order: "-", kind: "info", role: "orchestrator", result: ".state.lock převzat: držitel prokazatelně neběží", reason: `pid ${dead.pid}` });
      return true;
    } finally {
      try {
        if (fs.readFileSync(guard, "utf8") === me) fs.rmSync(guard, { force: true });
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

  /**
   * Next fence number (DR-039, etapa 2, kolo oprav 1). A damaged counter is never read as 0: the result is
   * max(readable `.fence`, fence of the current lock, every fence stored in runs/<id>/state.json) + 1. When `.fence`
   * is missing/unreadable AND some state.json cannot be read, the maximum is unknown → FenceHoldError (HOLD).
   * Written atomically and durably (writeDurable).
   */
  private nextFence(): number {
    const f = path.join(this.runsDir, ".fence");
    let counter: number | undefined;
    try {
      const t = fs.readFileSync(f, "utf8").trim();
      if (/^\d+$/.test(t)) counter = Number(t);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    let stored = 0;
    const unreadable: string[] = [];
    for (const d of fs.readdirSync(this.runsDir)) {
      const sf = path.join(this.runsDir, d, "state.json");
      if (!fs.existsSync(sf)) continue;
      try {
        const v = Number((JSON.parse(fs.readFileSync(sf, "utf8")) as Order).fence ?? 0);
        if (Number.isFinite(v)) stored = Math.max(stored, v);
        else unreadable.push(d);
      } catch {
        unreadable.push(d);
      }
    }
    if (counter === undefined && unreadable.length)
      throw new FenceHoldError(`tick lock HOLD: čítač runs/.fence chybí nebo je poškozený a nejde přečíst ${unreadable.join(", ")}/state.json — nejvyšší fence nelze bezpečně určit (README: nouzový postup)`);
    const prev = Number(this.readLease()?.fence);
    const n = Math.max(counter ?? 0, Number.isFinite(prev) ? prev : 0, stored) + 1;
    writeDurable(f, `${n}\n`);
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
      if (e instanceof FenceHoldError) {
        this.log({ ts: new Date().toISOString(), order: "-", kind: "error", role: "orchestrator", result: "tick lock HOLD: fence nelze bezpečně určit", reason: e.message });
        return false;
      }
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
