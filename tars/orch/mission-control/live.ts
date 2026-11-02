// Reads the real, documented data for Mission Control. Read-only: never writes into runs/.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { LogEntry, Order } from "../types";
import { safe, type CardDoc, type LockInfo, type McInput } from "./view";

const ORDER_RE = /^wo-[0-9A-Za-z-]+$/;

export function readOrders(runsDir: string): Order[] {
  if (!fs.existsSync(runsDir)) return [];
  const out: Order[] = [];
  for (const d of fs.readdirSync(runsDir).sort()) {
    if (!ORDER_RE.test(d)) continue;
    const f = path.join(runsDir, d, "state.json");
    try {
      out.push(JSON.parse(fs.readFileSync(f, "utf8")) as Order);
    } catch {
      // missing, half-written or broken file: skip, the next refresh will retry
    }
  }
  return out;
}

export function readLog(runsDir: string): LogEntry[] {
  let text: string;
  try {
    text = fs.readFileSync(path.join(runsDir, "log.jsonl"), "utf8");
  } catch {
    return []; // missing (or removed meanwhile): no documented events
  }
  const out: LogEntry[] = [];
  for (const l of text.split("\n")) {
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
  return lockAt(path.join(runsDir, ".lock")) ?? { present: false, alive: false };
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

/** Lines of a section whose heading starts with `name` (any level ≥ 2, optional numbering). */
export function cardSection(text: string, name: string): string[] | undefined {
  const lines = text.split("\n");
  const re = new RegExp(`^#{2,4}\\s*(\\d+[a-z]?\\.\\s*)?${name}\\b`, "i");
  const start = lines.findIndex((l) => re.test(l.trim()));
  if (start < 0) return undefined;
  const level = /^#+/.exec(lines[start].trim())![0].length;
  const out: string[] = [];
  for (const l of lines.slice(start + 1)) {
    const h = /^(#+)\s/.exec(l.trim());
    if (h && h[1].length <= level) break;
    if (l.trim()) out.push(l.trim());
  }
  return out.length ? out : undefined;
}

export function parseCard(text: string, file: string): CardDoc | undefined {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1];
  if (!fm) return undefined;
  const get = (k: string) => new RegExp(`^${k}:\\s*(.+)$`, "m").exec(fm)?.[1]?.trim();
  const role = get("role");
  if (!role) return undefined;
  const sec = /## 1\. Mise role a model\s*\n+([^\n]+)/.exec(text)?.[1];
  // Card text is data: every field passes the secret filter before it can reach a page.
  const meta = (k: string, max = 120) => safe(get(k), max) || undefined;
  const lines = (name: string) => cardSection(text, name)?.map((l) => safe(l, 600));
  return {
    role: safe(role, 60),
    title: meta("title", 160) ?? safe(role, 60),
    model: meta("model"),
    family: meta("family"),
    adapter: meta("adapter"),
    rung: meta("rung"),
    file: safe(file, 200),
    mission: sec ? safe((/^(.+?[.!?])(\s|$)/.exec(sec)?.[1] ?? sec).replace(/`/g, ""), 400) : undefined,
    postup: lines("Postup"),
    dosah: lines("Dosah"),
  };
}

export function readCardDocs(cardsDir: string): Record<string, CardDoc> {
  const out: Record<string, CardDoc> = {};
  if (!fs.existsSync(cardsDir)) return out;
  for (const f of fs.readdirSync(cardsDir).sort()) {
    if (!f.endsWith(".md") || f.startsWith("_") || f.startsWith("REVIEW")) continue;
    const c = parseCard(fs.readFileSync(path.join(cardsDir, f), "utf8"), path.relative(path.resolve(cardsDir, "../../../.."), path.join(cardsDir, f)));
    if (c) out[c.role] = c;
  }
  return out;
}

/**
 * Lock file with a PID → is that process alive? undefined = no lock file.
 * The orchestrator may delete the lock at any moment (between stat and read), so every
 * filesystem step is guarded: a vanished lock is „no lock“, an unreadable one is present but
 * not proven alive. Never throws.
 */
export function lockAt(f: string): LockInfo | undefined {
  let mtime: string;
  let text: string;
  try {
    mtime = fs.statSync(f).mtime.toISOString();
    text = fs.readFileSync(f, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    return { present: true, alive: false };
  }
  const pid = Number(text.trim());
  let alive = false;
  if (Number.isInteger(pid) && pid > 0) {
    try {
      process.kill(pid, 0); // signal 0 = existence check only
      alive = true;
    } catch (e) {
      alive = (e as NodeJS.ErrnoException).code === "EPERM";
    }
  }
  return { present: true, alive, mtime };
}

function listFiles(orderDir: string): string[] {
  const out: string[] = [];
  try {
    for (const e of fs.readdirSync(orderDir, { withFileTypes: true })) {
      if (e.isFile()) out.push(e.name);
      else if (e.isDirectory() && e.name.startsWith("shots-"))
        for (const f of fs.readdirSync(path.join(orderDir, e.name)).sort()) out.push(`${e.name}/${f}`);
    }
  } catch {
    // directory removed while reading: show what was listed
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
  const orderLocks: Record<string, LockInfo> = {};
  for (const o of orders) {
    const l = lockAt(path.join(runsDir, o.id, ".lock"));
    if (l) orderLocks[o.id] = l;
  }
  return {
    orders,
    orderLocks,
    cardDocs: readCardDocs(cardsDir),
    log: readLog(runsDir),
    lock: readLock(runsDir),
    cards: readCards(cardsDir),
    files,
    scheduler: process.platform === "darwin" ? fs.existsSync(plist) : undefined,
    now,
  };
}
