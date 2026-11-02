// Owner gate (DR-024, TARS-ORCH-001 §5) — gate file: changes are class B once on main (merge-policy GATE_FILES).
// Decides WHEN the owner is needed, builds the merge decision card, and serializes every owner-side mutation
// (GO / ALT / REJECT, supersede, abort) under one exclusive per-order lock.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { DepartmentRunner } from "./departments";
import { readPackage, writePackage, type DecisionPackage } from "./konzilium";
import type { MergeResult, MergeRunner } from "./merge-policy";
import type { OrderEvent } from "./state-machine";
import type { Store } from "./store";
import { reservedDecisionHits } from "./supervisor";
import type { LogEntry, ModelFamily, Order, OwnerChoice } from "./types";

export interface OwnerGateDecision {
  /** Sponsor-reserved decisions found in the brief (model list + code regex). */
  sponsorReasons: string[];
  /** Dev PRs always go through the merge policy (Sponsor reasons force class B). */
  viaMerge: boolean;
  reasons: string[];
  ownerNeeded: boolean;
}

export function ownerGate(
  o: Order,
  dept: Pick<DepartmentRunner, "alwaysOwner">,
  hasMergeRunner: boolean,
): OwnerGateDecision {
  const b = o.brief!;
  const sponsorReasons = [
    ...b.owner_decisions,
    ...reservedDecisionHits(`${b.title}\n${b.goal}`).map(
      (k) => `zadání se dotýká: ${k}`,
    ),
  ];
  const viaMerge =
    b.department === "dev" && hasMergeRunner && Boolean(o.delivered_url);
  const reasons = [
    ...(dept.alwaysOwner && b.department === "dev"
      ? ["výstup je PR do main — merge po GO vlastníka (DR-024 třída B)"]
      : []),
    ...sponsorReasons,
  ];
  const ownerNeeded =
    reasons.length > 0 || (dept.alwaysOwner && b.department !== "dev");
  return { sponsorReasons, viaMerge, reasons, ownerNeeded };
}

/** Visual card for a PR the policy did not self-merge (class B or blocked). Blocked = GO is not offered. */
export function mergeDecisionPackage(
  o: { id: string; title: string; milestone: string; pr_url: string },
  r: Exclude<MergeResult, { status: "merged" } | { status: "pending" }>,
  creator: { role: string; model: string; family: ModelFamily | "none" },
  authorFamily: ModelFamily,
  now: string,
): DecisionPackage {
  const reasons =
    r.status === "owner"
      ? r.reasons
      : [`automatický merge zastaven: ${r.reason}`];
  return {
    version: 1,
    order: o.id,
    kind: "merge",
    title: o.title,
    milestone: o.milestone,
    created_at: now,
    recommended: {
      label:
        r.status === "owner" ? "Mergnout (třída B)" : "Nemergovat, opravit",
      summary: reasons.join("; "),
      blocks: [
        { kind: "headline", text: o.title },
        { kind: "list", text: reasons.join("\n") },
        {
          kind: "cta",
          text:
            r.status === "owner"
              ? "GO = TARS provede squash merge"
              : "REJECT = vrátit k opravě",
        },
      ],
    },
    alternative: null,
    reasons: r.log,
    disputes: r.status === "blocked" ? [r.reason] : [],
    experts: [],
    advocate: [],
    author: {
      role: "Merge politika DR-024 (deterministický kód) + review jiné rodiny",
      model: "merge-policy.ts",
      family: "none",
    },
    creator,
    sponsor_reserved: [],
    honest_note:
      "Merge třídy B dělá TARS až po GO vlastníka a jen pro obsah, který vlastník viděl (vazba na diff). Ruleset main (PR, test + janitor) platí dál.",
    drafts: {},
    prep_orders: [],
    merge: {
      pr: o.pr_url,
      cls: r.status === "owner" ? r.cls : "B",
      reasons,
      files: [],
      review: r.review?.slice(0, 4000),
      binding: r.status === "owner" ? r.binding : undefined,
      blocked: r.status === "blocked",
      author_family: authorFamily,
    },
  };
}

// ───────────────────────────── exclusive per-order lock ─────────────────────────────

const STALE_MS = 60 * 60 * 1000;

/**
 * Exclusive lock runs/<id>/.owner.lock (O_EXCL create). Stale recovery runs under a second O_EXCL mutex
 * `.owner.lock.recover`; the holder RE-CHECKS staleness of the current lock before replacing it, so a lock that
 * another process just recovered (fresh mtime) is never removed. Release only by the token holder.
 */
export function lockOrder(orderDir: string, staleMs = STALE_MS): (() => void) | undefined {
  fs.mkdirSync(orderDir, { recursive: true });
  const f = path.join(orderDir, ".owner.lock");
  const rec = `${f}.recover`;
  const token = `${process.pid}-${crypto.randomBytes(8).toString("hex")}`;
  const create = (file: string) => {
    try {
      fs.writeFileSync(file, token, { flag: "wx" });
      return true;
    } catch {
      return false;
    }
  };
  const isStale = () => {
    try {
      return Date.now() - fs.statSync(f).mtimeMs > staleMs;
    } catch {
      return true; // vanished
    }
  };
  if (!create(f)) {
    if (!isStale()) return undefined;
    // Recovery mutex; itself stale only after a crash inside the few lines below (then 10× staleMs).
    if (!create(rec)) {
      try {
        if (Date.now() - fs.statSync(rec).mtimeMs < staleMs * 10) return undefined;
        fs.rmSync(rec, { force: true });
      } catch {
        /* gone */
      }
      if (!create(rec)) return undefined;
    }
    try {
      if (!isStale()) return undefined; // someone else recovered meanwhile → their lock is valid
      fs.rmSync(f, { force: true });
      if (!create(f)) return undefined;
    } finally {
      fs.rmSync(rec, { force: true });
    }
  }
  return () => {
    try {
      if (fs.readFileSync(f, "utf8") === token) fs.rmSync(f, { force: true });
    } catch {
      /* already gone */
    }
  };
}

export async function withOrderLock<T>(
  orderDir: string,
  id: string,
  fn: () => Promise<T> | T,
): Promise<T> {
  const release = lockOrder(orderDir);
  if (!release) throw new Error(`o zakázce ${id} se právě rozhoduje jinde`);
  try {
    return await fn();
  } finally {
    release();
  }
}

export function withOrderLockSync<T>(
  orderDir: string,
  id: string,
  fn: () => T,
): T {
  const release = lockOrder(orderDir);
  if (!release) throw new Error(`o zakázce ${id} se právě rozhoduje jinde`);
  try {
    return fn();
  } finally {
    release();
  }
}

// ───────────────────────────── owner decision ─────────────────────────────

export interface OwnerDecisionDeps {
  store: Store;
  merge?: MergeRunner;
  iso: () => string;
  log: (e: Omit<LogEntry, "ts">) => void;
  apply: (o: Order, ev: OrderEvent, extra?: Partial<LogEntry>) => Order;
}

/**
 * GO / ALT / REJECT under the exclusive per-order lock (state re-read under it). GO on a merge card merges ONLY the
 * diff bound on the card, with the stored author family; a failed or blocked merge keeps WAITING_OWNER.
 */
export async function executeOwnerDecision(d: OwnerDecisionDeps, id: string, decision: OwnerChoice, via: string): Promise<Order> {
  const dir = d.store.orderDir(id);
  return withOrderLock(dir, id, async () => {
    let o = d.store.load(id);
    if (o.state !== "WAITING_OWNER") throw new Error(`zakázka ${id} je ${o.state}, nečeká na vlastníka`);
    const pkg = readPackage(dir);
    if (decision === "ALT" && !pkg?.alternative) throw new Error("rozhodovací balíček nemá alternativu");
    if (decision === "GO" && pkg?.kind === "merge") {
      if (pkg.merge?.blocked || o.meta.merge_blocked === "1") throw new Error("automatický merge byl zablokován — GO nejde, jen REJECT (oprava novou zakázkou)");
      const fam = pkg.merge?.author_family ?? (o.meta.merge_author_family as ModelFamily | undefined);
      if (!d.merge || !o.meta.merge_pr || !fam) throw new Error("merge runner nebo rodina autora PR chybí");
      const r = await d.merge.run(o.meta.merge_pr, fam, { ownerGo: true, binding: pkg.merge?.binding, waitMs: 25 * 60_000, reviewText: pkg.merge?.review });
      d.log({ order: id, kind: "info", role: "merge", result: r.status, reason: r.log.join(" | ").slice(0, 500) });
      if (r.status !== "merged") throw new Error(`merge po GO neproběhl: ${"reason" in r ? r.reason : r.status}`);
      o = { ...o, meta: { ...o.meta, merged: "1" } };
    }
    if (pkg) writePackage(dir, { ...pkg, owner_decision: { choice: decision, at: d.iso(), via } });
    const label = pkg ? ` (${decision === "ALT" ? pkg.alternative?.label : decision === "GO" ? pkg.recommended.label : "REJECT"})` : "";
    return d.apply(o, { type: "owner", decision }, { role: "orchestrator", result: `owner ${decision}${label}` });
  });
}

/**
 * Owner consent persists across entry points: any recorded order about this PR that waits for the owner, or that
 * carries Sponsor-reserved reasons, forbids a self-merge from `cli.ts merge` (forceOwner / refuse).
 */
export function mergeConstraints(store: Store, pr: string): { refuse?: string; forceOwner: string[] } {
  const about = store.listOrders().filter((o) => o.meta.merge_pr === pr || new RegExp(`/pull/${pr}$`).test(o.delivered_url ?? ""));
  const waiting = about.find((o) => o.state === "WAITING_OWNER");
  if (waiting) return { refuse: `PR #${pr} už čeká na vlastníka (karta ${waiting.id})`, forceOwner: [] };
  const forced = about.flatMap((o) => [...(o.brief?.owner_decisions ?? []), ...(o.owner_reasons ?? []).filter((r) => !/^automatický merge zastaven/.test(r))]);
  return { forceOwner: [...new Set(forced)] };
}
