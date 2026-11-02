// Short-term memory runs/<order-id>/state.json, episodic memory runs/log.jsonl (§4).
import fs from "node:fs";
import path from "node:path";

import { redactDeep } from "./secret-scan";
import type { LogEntry, Order } from "./types";

export class Store {
  constructor(public readonly runsDir: string) {
    fs.mkdirSync(runsDir, { recursive: true });
  }

  orderDir(id: string): string {
    const d = path.join(this.runsDir, id);
    fs.mkdirSync(d, { recursive: true });
    return d;
  }

  save(order: Order): void {
    const file = path.join(this.orderDir(order.id), "state.json");
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(redactDeep(order), null, 2) + "\n"); // state.json never keeps a token either
    fs.renameSync(tmp, file); // atomic replace: a crash never leaves half a state
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
   * Short lock around one synchronous read-modify-write of an order's state (owner decision from Notion in a tick,
   * `cli owner`, `abort`). Separate from the tick lock, which is held for a whole tick: with it a manual REJECT can
   * never be overwritten by a decision the tick read earlier. Waits up to `waitMs`, then throws.
   */
  withStateLock<T>(fn: () => T, waitMs = 5000, staleMs = 30_000): T {
    const f = path.join(this.runsDir, ".state.lock");
    const t0 = Date.now();
    for (;;) {
      try {
        fs.writeFileSync(f, String(process.pid), { flag: "wx" });
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
    try {
      return fn();
    } finally {
      fs.rmSync(f, { force: true });
    }
  }

  /** Single-runner lock (launchd may fire while a long tick still runs). */
  acquireLock(staleMs = 3 * 60 * 60 * 1000): boolean {
    const f = path.join(this.runsDir, ".lock");
    try {
      fs.writeFileSync(f, String(process.pid), { flag: "wx" });
      return true;
    } catch {
      const age = Date.now() - fs.statSync(f).mtimeMs;
      if (age > staleMs) {
        fs.writeFileSync(f, String(process.pid));
        return true;
      }
      return false;
    }
  }

  releaseLock(): void {
    fs.rmSync(path.join(this.runsDir, ".lock"), { force: true });
  }
}
