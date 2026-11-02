// Short-term memory runs/<order-id>/state.json, episodic memory runs/log.jsonl (§4).
import fs from "node:fs";
import path from "node:path";

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
    fs.writeFileSync(tmp, JSON.stringify(order, null, 2) + "\n");
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

  log(entry: LogEntry): void {
    fs.appendFileSync(
      path.join(this.runsDir, "log.jsonl"),
      JSON.stringify(entry) + "\n",
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

  /** state.json or undefined (no throw). */
  tryLoad(id: string): Order | undefined {
    const f = path.join(this.runsDir, id, "state.json");
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as Order) : undefined;
  }

  releaseLock(): void {
    fs.rmSync(path.join(this.runsDir, ".lock"), { force: true });
  }
}
