// Owner gate (DR-024, TARS-ORCH-001 §5) — gate file: changes are class B once on main (merge-policy GATE_FILES).
// Decides WHEN the owner is needed, builds the merge decision card, and serializes every owner-side mutation
// (GO / ALT / REJECT, supersede, abort) under one exclusive per-order lock.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { DepartmentRunner } from "./departments";
import type { DecisionPackage } from "./konzilium";
import type { MergeResult } from "./merge-policy";
import { reservedDecisionHits } from "./supervisor";
import type { ModelFamily, Order } from "./types";

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
 * Exclusive lock runs/<id>/.owner.lock. Create is O_EXCL; stale recovery renames the stale file to a unique name
 * first (atomic: only one process wins the rename), then retries the exclusive create. Release only by the token owner.
 */
export function lockOrder(
  orderDir: string,
  staleMs = STALE_MS,
): (() => void) | undefined {
  fs.mkdirSync(orderDir, { recursive: true });
  const f = path.join(orderDir, ".owner.lock");
  const token = `${process.pid}-${crypto.randomBytes(8).toString("hex")}`;
  const tryCreate = () => {
    try {
      fs.writeFileSync(f, token, { flag: "wx" });
      return true;
    } catch {
      return false;
    }
  };
  if (!tryCreate()) {
    let stale = false;
    try {
      stale = Date.now() - fs.statSync(f).mtimeMs > staleMs;
    } catch {
      stale = true; // vanished meanwhile
    }
    if (!stale) return undefined;
    try {
      fs.renameSync(f, `${f}.stale-${token}`);
      fs.rmSync(`${f}.stale-${token}`, { force: true });
    } catch {
      /* another process recovered it first */
    }
    if (!tryCreate()) return undefined;
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
