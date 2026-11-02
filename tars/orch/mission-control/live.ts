// Reads the real, documented data for Mission Control. Read-only: never writes into runs/.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { scanSecrets } from "../secret-scan";
import { STATES, type LogEntry, type Order } from "../types";
import { safe, type CardDoc, type LockInfo, type McInput } from "./view";

/** wo-* = orchestrator orders, dev-* = TARS development runs written by the dispatch bridge. */
export const ORDER_RE = /^(?:wo|dev)-[0-9A-Za-z-]+$/;

// SUPERSEDED comes from the dispatch bridge (run 3); the panel reads it, the orchestrator never sets it.
const STATE_SET = new Set<string>([...STATES, "SUPERSEDED"]);
const isStr = (x: unknown): x is string => typeof x === "string";
const isCount = (x: unknown) => Number.isInteger(x) && (x as number) >= 0;
const isTime = (x: unknown) => isStr(x) && Number.isFinite(Date.parse(x));

/**
 * state.json → Order only when the fields the panel computes with have the documented shape
 * (id = directory, known state, ISO times, history of transitions, non-negative counters).
 * Anything else is „unreadable“: the panel must say it cannot verify, never guess or drop silently.
 */
export function validOrder(raw: unknown, dir: string): raw is Order {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  const optStr = (k: string) => o[k] === undefined || isStr(o[k]);
  return (
    o.id === dir &&
    STATE_SET.has(o.state as string) &&
    isStr(o.mission) &&
    isTime(o.created_at) &&
    isTime(o.updated_at) &&
    isCount(o.fix_rounds) &&
    isCount(o.manual_interventions) &&
    (o.max_fix_rounds === undefined || isCount(o.max_fix_rounds)) &&
    (o.paused_from === undefined || STATE_SET.has(o.paused_from as string)) &&
    ["delivered_url", "owner_card_url", "failure_reason", "card_role", "resume_after", "draft_file"].every(optStr) &&
    (o.brief === undefined || (typeof o.brief === "object" && o.brief !== null && !Array.isArray(o.brief))) &&
    Array.isArray(o.history) &&
    o.history.every(
      (h) => h && typeof h === "object" && STATE_SET.has((h as Record<string, unknown>).from as string) && STATE_SET.has((h as Record<string, unknown>).to as string) && isStr((h as Record<string, unknown>).event) && isTime((h as Record<string, unknown>).at),
    )
  );
}

/** Orders with a valid state.json, plus ids of order directories whose state.json cannot be used. */
export function readOrdersChecked(runsDir: string): { orders: Order[]; unreadable: string[] } {
  const orders: Order[] = [];
  const unreadable: string[] = [];
  if (!fs.existsSync(runsDir)) return { orders, unreadable };
  for (const d of fs.readdirSync(runsDir).sort()) {
    if (!ORDER_RE.test(d)) continue;
    let text: string;
    try {
      text = fs.readFileSync(path.join(runsDir, d, "state.json"), "utf8");
    } catch (e) {
      // no state.json yet (the orchestrator creates the directory first) = no order yet
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") unreadable.push(d);
      continue;
    }
    try {
      const raw: unknown = JSON.parse(text);
      if (validOrder(raw, d)) orders.push(raw);
      else unreadable.push(d);
    } catch {
      unreadable.push(d); // state.json is written atomically (tmp + rename): broken = really broken
    }
  }
  return { orders, unreadable };
}

export function readOrders(runsDir: string): Order[] {
  return readOrdersChecked(runsDir).orders;
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
      const e = JSON.parse(l) as LogEntry;
      if (e && typeof e === "object" && isTime(e.ts) && isStr(e.order) && isStr(e.kind)) out.push(e);
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
  // a multi-line secret (PEM body) is caught only on the whole section, not line by line
  const lines = (name: string) => {
    const sec = cardSection(text, name);
    if (!sec) return undefined;
    return scanSecrets(sec.join("\n")).clean ? sec.map((l) => safe(l, 600)) : ["[skryto: text obsahoval citlivý údaj]"];
  };
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
  const { orders, unreadable } = readOrdersChecked(runsDir);
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
    ...(unreadable.length ? { unreadable } : {}),
  };
}
