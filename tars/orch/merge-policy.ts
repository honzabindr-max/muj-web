// Merge policy (DR-024): deterministic classification of a PR by its changed paths.
// Class A (TARS internals, docs, tests, non-production tools): TARS merges itself after green test + janitor
//   and a PASS review by ANOTHER model family. Class B (customer web, DB/migrations, .claude/**, hooks, guard,
//   workflows, package.json dependencies): visual card for the owner; after GO, TARS merges.
// Unknown paths are class B (safe default). The ruleset on main (PR, required test + janitor, no bypass) is unchanged.
import { spawnSync } from "node:child_process";

import type { TextAdapter } from "./adapters";
import type { ModelFamily } from "./types";

export type MergeClass = "A" | "B";

export interface Classification {
  cls: MergeClass;
  /** One line per path that decided class B (or why A). */
  reasons: string[];
}

const B_RULES: Array<[string, RegExp]> = [
  ["web pro zákazníky (app/**)", /^app\//],
  ["veřejný web (public/**)", /^public\//],
  ["komponenty a knihovny webu", /^(components|lib|hooks|styles|src)\//],
  ["DB / migrace", /^(supabase|migrations|db|prisma)\/|\.sql$/i],
  ["nastavení agentů (.claude/**)", /^\.claude\//],
  ["hooky", /(^|\/)(hooks?|\.husky)\/|(^|\/)[^/]*hook[^/]*\.(sh|py|ts|js)$/i],
  ["guard", /(^|\/)guard(\/|\.ts$|\.sh$)|tars-guard/i],
  ["workflowy (.github/**)", /^\.github\//],
  [
    "závislosti (lockfile)",
    /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/,
  ],
  [
    "konfigurace produkce",
    /^(next\.config|middleware|vercel|tailwind\.config|postcss\.config|tsconfig)\b/,
  ],
  ["instrukce agentů", /(^|\/)(CLAUDE|AGENTS)\.md$/],
  ["crawlery a skripty produkce", /^(scripts|crawler|python)\//],
  ["prostředí", /(^|\/)\.env/],
];

const A_RULES: RegExp[] = [
  /^tars\//,
  /^docs\//,
  /^design\//,
  /^missions\//,
  /(^|\/)__tests__\//,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /^(tests?|e2e)\//,
  /^[^/]+\.md$/,
];

/** package.json: class B only when a dependency section changed (scripts etc. are class A). */
export function packageJsonDepsChanged(
  before: string | undefined,
  after: string | undefined,
): boolean {
  if (before === undefined || after === undefined) return true;
  try {
    const a = JSON.parse(before) as Record<string, unknown>;
    const b = JSON.parse(after) as Record<string, unknown>;
    for (const k of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
      "overrides",
      "engines",
    ])
      if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null))
        return true;
    return false;
  } catch {
    return true;
  }
}

export function classifyPaths(
  paths: string[],
  pkg?: { before?: string; after?: string },
): Classification {
  const reasons: string[] = [];
  for (const p of paths) {
    if (p === "package.json") {
      if (packageJsonDepsChanged(pkg?.before, pkg?.after))
        reasons.push(`${p}: změna závislostí (nebo nelze ověřit)`);
      continue;
    }
    const b = B_RULES.find(([, re]) => re.test(p));
    if (b) {
      reasons.push(`${p}: ${b[0]}`);
      continue;
    }
    if (!A_RULES.some((re) => re.test(p)))
      reasons.push(`${p}: cesta mimo seznam třídy A (bezpečně B)`);
  }
  if (!paths.length)
    return {
      cls: "B",
      reasons: ["PR nemá žádné změněné soubory (nelze klasifikovat)"],
    };
  return reasons.length
    ? { cls: "B", reasons }
    : {
        cls: "A",
        reasons: [
          `všech ${paths.length} cest je ve třídě A (tars/**, docs/**, testy, nástroje mimo produkci)`,
        ],
      };
}

// ───────────────────────────── executor ─────────────────────────────

export type Exec = (
  cmd: string,
  args: string[],
  cwd: string,
) => { code: number; out: string };

export const realExec: Exec = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    timeout: 10 * 60_000,
  });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
};

export interface PrInfo {
  number: number;
  headRefName: string;
  baseRefName: string;
  isDraft: boolean;
  mergeStateStatus: string;
  state: string;
  files: string[];
  headRefOid: string;
}

export const REQUIRED_CHECKS = ["test", "janitor"];

export type MergeResult =
  | { status: "merged"; cls: "A" | "B"; log: string[] }
  | { status: "pending"; reason: string; log: string[] }
  | {
      status: "owner";
      cls: "B";
      reasons: string[];
      review?: string;
      log: string[];
    }
  | { status: "blocked"; reason: string; review?: string; log: string[] };

export interface MergeDeps {
  exec: Exec;
  cwd: string;
  /** Reviewer of ANOTHER model family than the PR author. */
  reviewer: TextAdapter;
  sleep?: (ms: number) => Promise<void>;
}

export function parseChecks(out: string): {
  pass: boolean;
  pending: string[];
  failed: string[];
} {
  let rows: Array<{ name: string; bucket?: string; state?: string }> = [];
  try {
    rows = JSON.parse(out) as typeof rows;
  } catch {
    return {
      pass: false,
      pending: [],
      failed: ["gh pr checks: nečitelný výstup"],
    };
  }
  const pending: string[] = [];
  const failed: string[] = [];
  for (const name of REQUIRED_CHECKS) {
    const r = rows.find((x) => x.name === name);
    const b = (r?.bucket ?? r?.state ?? "").toLowerCase();
    if (!r || b === "pending" || b === "queued" || b === "in_progress")
      pending.push(name);
    else if (b !== "pass" && b !== "success") failed.push(`${name}=${b}`);
  }
  return { pass: !pending.length && !failed.length, pending, failed };
}

export class MergeRunner {
  constructor(private d: MergeDeps) {}

  private gh(args: string[]) {
    return this.d.exec("gh", args, this.d.cwd);
  }

  info(pr: number | string): PrInfo {
    const r = this.gh([
      "pr",
      "view",
      String(pr),
      "--json",
      "number,headRefName,baseRefName,isDraft,mergeStateStatus,state,files,headRefOid",
    ]);
    if (r.code !== 0) throw new Error(`gh pr view: ${r.out.slice(0, 200)}`);
    const j = JSON.parse(r.out) as Omit<PrInfo, "files"> & {
      files: Array<{ path: string }>;
    };
    return { ...j, files: j.files.map((f) => f.path) };
  }

  classify(info: PrInfo): Classification {
    let pkg: { before?: string; after?: string } | undefined;
    if (info.files.includes("package.json")) {
      this.d.exec(
        "git",
        ["fetch", "-q", "origin", info.baseRefName, info.headRefName],
        this.d.cwd,
      );
      const b = this.d.exec(
        "git",
        ["show", `origin/${info.baseRefName}:package.json`],
        this.d.cwd,
      );
      const a = this.d.exec(
        "git",
        ["show", `${info.headRefOid}:package.json`],
        this.d.cwd,
      );
      pkg = {
        before: b.code === 0 ? b.out : undefined,
        after: a.code === 0 ? a.out : undefined,
      };
    }
    return classifyPaths(info.files, pkg);
  }

  /** Review by another model family than the author; PASS required for any merge. */
  async review(
    pr: number | string,
    authorFamily: ModelFamily,
  ): Promise<{ verdict: "PASS" | "FIX" | "BLOCK" | "UNKNOWN"; text: string }> {
    if (this.d.reviewer.family === authorFamily)
      throw new Error(
        "review musí udělat jiná rodina modelů než autor PR (DR-024)",
      );
    const diff = this.gh(["pr", "diff", String(pr)]);
    if (diff.code !== 0)
      return { verdict: "UNKNOWN", text: diff.out.slice(0, 300) };
    const r = await this.d.reviewer.run(
      `Jsi CODE REVIEWER (jiná rodina modelů než autor). Neměň soubory, nepoužívej zápis.
Posuď diff PR: správnost, bezpečnost (žádná tajemství, žádný merge/deploy/DB zápis/dispatch v kódu bez brány), rozsah, testy.
<<<DIFF
${diff.out.slice(0, 180_000)}
DIFF>>>
Vrať POUZE JSON v bloku \`\`\`json: {"verdict":"PASS"|"FIX"|"BLOCK","issues":["…"]}`,
      { cwd: this.d.cwd },
    );
    const m =
      /```json\s*([\s\S]*?)```/.exec(r.text) ??
      /(\{[\s\S]*"verdict"[\s\S]*\})/.exec(r.text);
    try {
      const v = (JSON.parse(m?.[1] ?? "") as { verdict?: string }).verdict;
      if (v === "PASS" || v === "FIX" || v === "BLOCK")
        return { verdict: v, text: r.text };
    } catch {
      /* fallthrough */
    }
    return { verdict: "UNKNOWN", text: r.text || r.error || "" };
  }

  checks(pr: number | string) {
    const r = this.gh([
      "pr",
      "checks",
      String(pr),
      "--json",
      "name,bucket,state",
    ]);
    return parseChecks(r.out);
  }

  /**
   * DR-024 flow. Class A: green checks + PASS review → ready → update-branch when behind → wait checks → squash merge.
   * Class B: never merged here unless ownerGo = true (the owner said GO on the visual card).
   */
  async run(
    pr: number | string,
    authorFamily: ModelFamily,
    opts: { ownerGo?: boolean; waitMs?: number; reviewText?: string } = {},
  ): Promise<MergeResult> {
    const log: string[] = [];
    const info = this.info(pr);
    if (info.state === "MERGED")
      return {
        status: "merged",
        cls: this.classify(info).cls,
        log: ["PR už je mergnutý"],
      };
    const c = this.classify(info);
    log.push(`třída ${c.cls}: ${c.reasons.join("; ")}`);
    const ch = this.checks(pr);
    if (ch.failed.length)
      return {
        status: "blocked",
        reason: `CI selhalo: ${ch.failed.join(", ")}`,
        log,
      };
    if (ch.pending.length && !opts.waitMs)
      return {
        status: "pending",
        reason: `CI běží: ${ch.pending.join(", ")}`,
        log,
      };
    let reviewText = opts.reviewText;
    if (!reviewText) {
      const rv = await this.review(pr, authorFamily);
      log.push(
        `review ${this.d.reviewer.name} (${this.d.reviewer.family}): ${rv.verdict}`,
      );
      if (rv.verdict !== "PASS")
        return {
          status: "blocked",
          reason: `review ${rv.verdict}`,
          review: rv.text,
          log,
        };
      reviewText = rv.text;
    }
    if (c.cls === "B" && !opts.ownerGo)
      return {
        status: "owner",
        cls: "B",
        reasons: c.reasons,
        review: reviewText,
        log,
      };
    if (info.isDraft) {
      const r = this.gh(["pr", "ready", String(pr)]);
      log.push(`gh pr ready: ${r.code === 0 ? "ok" : r.out.slice(0, 120)}`);
    }
    if (info.mergeStateStatus === "BEHIND") {
      const r = this.gh(["pr", "update-branch", String(pr)]);
      log.push(
        `gh pr update-branch: ${r.code === 0 ? "ok" : r.out.slice(0, 120)}`,
      );
      if (r.code !== 0)
        return { status: "blocked", reason: "update-branch selhal", log };
    }
    // Wait for required checks on the (possibly updated) head.
    const deadline = Date.now() + (opts.waitMs ?? 0);
    const sleep =
      this.d.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    for (;;) {
      const now = this.checks(pr);
      if (now.failed.length)
        return {
          status: "blocked",
          reason: `CI selhalo: ${now.failed.join(", ")}`,
          log,
        };
      if (now.pass) break;
      if (Date.now() > deadline)
        return {
          status: "pending",
          reason: `CI běží: ${now.pending.join(", ")}`,
          log,
        };
      await sleep(30_000);
    }
    const m = this.gh([
      "pr",
      "merge",
      String(pr),
      "--squash",
      "--delete-branch",
    ]);
    log.push(`gh pr merge --squash --delete-branch: exit ${m.code}`);
    // --delete-branch may fail locally (branch checked out in a worktree) after the remote merge succeeded.
    const after = this.info(pr);
    if (after.state === "MERGED") return { status: "merged", cls: c.cls, log };
    return {
      status: "blocked",
      reason: `merge selhal: ${m.out.slice(0, 200)}`,
      log,
    };
  }
}
