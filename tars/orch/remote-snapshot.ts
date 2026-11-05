// Etapa 4, PR 4b (NAVRH-v6 §8.2, vrstva 2, třída B): evidence a reconcile vzdálených zápisů dev kroku.
//
// Orchestrátor (ne dítě) ve vlastním prostředí pořídí snímek PŘED INTENT a PO konci dítěte (FINISHED nebo ABANDONED):
//   - heads: `git ls-remote --heads origin` (všechny větve) + sha256 seznamu,
//   - prs:   `gh pr list --state all --author @me --search "created:>=<INTENT_at>"` (neúplný výsledek = chyba),
//   - runs:  `gh run list --event workflow_dispatch --created ">=<INTENT_at>"` (neúplný výsledek = chyba).
// Nová, změněná nebo smazaná větev, nový PR nebo nový běh workflow bez receiptu v journalu = EXTERNAL_UNJOURNALED
// → UNKNOWN/HOLD, rozhodne vlastník. Snímek, který nejde pořídit, není nikdy „nic se nestalo“.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

export const SNAPSHOT_LIMIT = 200;

export interface RemoteHeads {
  [ref: string]: string;
}

export type RemoteSnapshot =
  | {
      ok: true;
      at: string;
      since: string;
      heads: RemoteHeads;
      heads_sha256: string;
      prs: Array<{ number: number; headRefName: string; url: string }>;
      runs: Array<{ databaseId: number; workflowName: string }>;
      /** HEAD worktree zakázky v okamžiku snímku (lokální stav, ne vzdálený); null = worktree neexistuje */
      worktree_head?: string | null;
    }
  | { ok: false; at: string; since: string; error: string };

export interface RemoteProbe {
  /** `repoDir` = repo s remote `origin` (orchestrátor, ne worktree dítěte); `since` = ISO okamžik INTENT. */
  snapshot(repoDir: string, since: string): RemoteSnapshot;
}

function sha(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function headsSha256(h: RemoteHeads): string {
  return sha(
    Object.keys(h)
      .sort()
      .map((k) => `${h[k]}\t${k}`)
      .join("\n"),
  );
}

/** Výstup `git ls-remote --heads` → mapa ref → OID. Nečitelný řádek = throw (neúplné ≠ nic). */
export function parseLsRemote(out: string): RemoteHeads {
  const heads: RemoteHeads = {};
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const m = /^([0-9a-f]{40})\t(refs\/heads\/\S+)$/.exec(line.trim());
    if (!m) throw new Error(`ls-remote: nečitelný řádek ${line.slice(0, 80)}`);
    heads[m[2]] = m[1];
  }
  return heads;
}

/**
 * Výchozí sonda: skutečný `git` a `gh` v prostředí orchestrátoru (process.env, ne childEnv). Jakákoli chyba, timeout,
 * nečitelná odpověď nebo výsledek na hranici limitu = { ok: false }.
 */
export const gitHubRemoteProbe: RemoteProbe = {
  snapshot(repoDir, since) {
    const at = new Date().toISOString();
    const fail = (error: string): RemoteSnapshot => ({
      ok: false,
      at,
      since,
      error: error.slice(0, 300),
    });
    const o = { cwd: repoDir, encoding: "utf8" as const, timeout: 60_000 };
    const ls = spawnSync("git", ["ls-remote", "--heads", "origin"], o);
    if (ls.status !== 0) return fail(`git ls-remote selhal (${ls.status})`);
    let heads: RemoteHeads;
    try {
      heads = parseLsRemote(ls.stdout ?? "");
    } catch (e) {
      return fail(String((e as Error).message));
    }
    const day = since.slice(0, 10);
    const lim = String(SNAPSHOT_LIMIT);
    // Jen čtení (list). Obě volání pinuje statický test hranice (etapa4-4a.test.ts, CI 4a (2)).
    const pr = spawnSync(
      "gh",
      [
        "pr",
        "list",
        "--state",
        "all",
        "--author",
        "@me",
        "--search",
        `created:>=${day}`,
        "--limit",
        lim,
        "--json",
        "number,headRefName,url",
      ],
      o,
    );
    if (pr.status !== 0) return fail(`gh pr list selhal (${pr.status})`);
    const rl = spawnSync(
      "gh",
      [
        "run",
        "list",
        "--event",
        "workflow_dispatch",
        "--created",
        `>=${day}`,
        "--limit",
        lim,
        "--json",
        "databaseId,workflowName",
      ],
      o,
    );
    if (rl.status !== 0) return fail(`gh run list selhal (${rl.status})`);
    let prs: unknown;
    let runs: unknown;
    try {
      prs = JSON.parse(pr.stdout ?? "");
      runs = JSON.parse(rl.stdout ?? "");
    } catch {
      return fail("gh: nečitelná odpověď");
    }
    if (!Array.isArray(prs) || !Array.isArray(runs))
      return fail("gh: odpověď není seznam");
    if (prs.length >= SNAPSHOT_LIMIT || runs.length >= SNAPSHOT_LIMIT)
      return fail("gh: neúplný výsledek (limit)");
    return {
      ok: true,
      at,
      since,
      heads,
      heads_sha256: headsSha256(heads),
      prs: prs as Array<{ number: number; headRefName: string; url: string }>,
      runs: runs as Array<{ databaseId: number; workflowName: string }>,
    };
  },
};

/** Co journal zakázky vysvětluje: receipt push (větev + OID) a doručené PR (URL). */
export interface JournaledWrites {
  pushes: Array<{ ref: string; oid: string }>;
  pr_urls: string[];
}

/**
 * §8.2: zápisy mezi snímky, které journal nevysvětluje. Prázdný seznam = nic nového. Snímek bez `ok` nebo chybějící
 * snímek = throw (volající z toho udělá UNKNOWN/HOLD, nikdy RETRY_SAFE).
 */
export function unjournaledWrites(
  before: RemoteSnapshot | undefined,
  after: RemoteSnapshot | undefined,
  j: JournaledWrites,
): string[] {
  if (!before || !after)
    throw new Error("chybí dvojice snímků vzdálených zápisů (§8.2)");
  if (!before.ok)
    throw new Error(`snímek před pokusem nejde použít: ${before.error}`);
  if (!after.ok)
    throw new Error(`snímek po pokusu nejde použít: ${after.error}`);
  const out: string[] = [];
  const refs = new Set([
    ...Object.keys(before.heads),
    ...Object.keys(after.heads),
  ]);
  for (const ref of [...refs].sort()) {
    const b = before.heads[ref];
    const a = after.heads[ref];
    if (a === b) continue;
    if (a && j.pushes.some((p) => p.ref === ref && p.oid === a)) continue;
    out.push(
      !b
        ? `nová větev ${ref} ${a}`
        : !a
          ? `smazaná větev ${ref}`
          : `změněná větev ${ref} ${b}→${a}`,
    );
  }
  const prBefore = new Set(before.prs.map((p) => p.number));
  for (const p of after.prs)
    if (!prBefore.has(p.number) && !j.pr_urls.includes(p.url))
      out.push(`nový PR #${p.number} (${p.headRefName})`);
  const runBefore = new Set(before.runs.map((r) => r.databaseId));
  for (const r of after.runs)
    if (!runBefore.has(r.databaseId))
      out.push(
        `nový běh workflow_dispatch ${r.databaseId} (${r.workflowName})`,
      );
  return out;
}
