// Reads the real, documented data for Mission Control. Read-only: never writes into runs/.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { LogEntry, Order } from "../types";
import type { LockInfo, McInput } from "./view";

const ORDER_RE = /^wo-[0-9A-Za-z-]+$/;

function readOrders(runsDir: string): Order[] {
  if (!fs.existsSync(runsDir)) return [];
  const out: Order[] = [];
  for (const d of fs.readdirSync(runsDir).sort()) {
    if (!ORDER_RE.test(d)) continue;
    const f = path.join(runsDir, d, "state.json");
    if (!fs.existsSync(f)) continue;
    try {
      out.push(JSON.parse(fs.readFileSync(f, "utf8")) as Order);
    } catch {
      // half-written or broken file: skip, the next refresh will retry
    }
  }
  return out;
}

function readLog(runsDir: string): LogEntry[] {
  const f = path.join(runsDir, "log.jsonl");
  if (!fs.existsSync(f)) return [];
  const out: LogEntry[] = [];
  for (const l of fs.readFileSync(f, "utf8").split("\n")) {
    if (!l.trim()) continue;
    try {
      out.push(JSON.parse(l) as LogEntry);
    } catch {
      // partial last line while the orchestrator appends
    }
  }
  return out;
}

export function readLock(runsDir: string): LockInfo {
  const f = path.join(runsDir, ".lock");
  if (!fs.existsSync(f)) return { present: false, alive: false };
  const st = fs.statSync(f);
  const pid = Number(fs.readFileSync(f, "utf8").trim());
  let alive = false;
  if (Number.isInteger(pid) && pid > 0) {
    try {
      process.kill(pid, 0); // signal 0 = existence check only
      alive = true;
    } catch (e) {
      alive = (e as NodeJS.ErrnoException).code === "EPERM";
    }
  }
  return { present: true, alive, mtime: st.mtime.toISOString() };
}

/** First sentence of section „## 1. Mise role a model“ of each card. */
export function readCards(cardsDir: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(cardsDir)) return out;
  for (const f of fs.readdirSync(cardsDir)) {
    if (!f.endsWith(".md") || f.startsWith("_") || f.startsWith("REVIEW")) continue;
    const text = fs.readFileSync(path.join(cardsDir, f), "utf8");
    const role = /^role:\s*(.+)$/m.exec(text)?.[1]?.trim();
    const sec = /## 1\. Mise role a model\s*\n+([^\n]+)/.exec(text)?.[1];
    if (role && sec) out[role] = (/^(.+?[.!?])(\s|$)/.exec(sec)?.[1] ?? sec).replace(/`/g, "");
  }
  return out;
}

function listFiles(orderDir: string): string[] {
  if (!fs.existsSync(orderDir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(orderDir, { withFileTypes: true })) {
    if (e.isFile()) out.push(e.name);
    else if (e.isDirectory() && e.name.startsWith("shots-"))
      for (const f of fs.readdirSync(path.join(orderDir, e.name)).sort()) out.push(`${e.name}/${f}`);
  }
  return out.sort();
}

export function readLiveInput(runsDir: string, cardsDir: string, now = new Date().toISOString()): McInput {
  if (!fs.existsSync(runsDir))
    return { orders: [], log: [], lock: { present: false, alive: false }, cards: readCards(cardsDir), files: {}, now, unavailable: "složka runs neexistuje" };
  const orders = readOrders(runsDir);
  const files: Record<string, string[]> = {};
  for (const o of orders) files[o.id] = listFiles(path.join(runsDir, o.id));
  const plist = path.join(os.homedir(), "Library/LaunchAgents/work.good-inventions.tars-orch.plist");
  return {
    orders,
    log: readLog(runsDir),
    lock: readLock(runsDir),
    cards: readCards(cardsDir),
    files,
    scheduler: process.platform === "darwin" ? fs.existsSync(plist) : undefined,
    now,
  };
}
