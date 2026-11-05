// Etapa 4, PR 4a (NAVRH-v6 §6.2, §7, §8, §14): pokusy o krok, procesní reconciler, reconcile adaptérů, review
// receipt jako záznam, finální tělo fable a vícedílné review dev. Plus CI testy hranice 4a (§14, řádek 4a).
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runProcess, type TextAdapter } from "../adapters";
import { artifactHash } from "../approval";
import {
  AttemptJournal,
  currentAttempt,
  journalScope,
  killGroup,
  parsePsLine,
  psProbe,
  reconcileAttempt,
  RetryRefusedError,
  runInAttempt,
  settleGroup,
  sha256,
  type AttemptRecord,
  type ProcInfo,
  type ProcessProbe,
} from "../attempts";
import {
  CopyDepartment,
  DevDepartment,
  PushJournal,
  type DepartmentRunner,
} from "../departments";
import { Orchestrator } from "../orchestrator";
import {
  aggregateVerdict,
  coverageProblem,
  planDiffChunks,
  readReviewReceipt,
  type ReviewReceipt,
} from "../reviews";
import { transition } from "../state-machine";
import { pidExists, processStartTime, Store } from "../store";
import type { Order } from "../types";
import {
  DRAFT,
  effOrder,
  FileNotion,
  NOW,
  ORDER_ID,
  PARENT,
} from "./effects-fixture";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const UID = process.getuid!();

let dir: string;
let store: Store;
let notion: FileNotion;
const cleanup: Array<() => void> = [];
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-4a-"));
  store = new Store(dir);
  notion = new FileNotion(path.join(dir, "notion.jsonl"));
});
afterEach(() => {
  while (cleanup.length) cleanup.pop()!();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn: () => boolean, ms = 5000): Promise<void> {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) throw new Error("waitFor: timeout");
    await sleep(25);
  }
}

// ───────────────────────────── pomocníci ─────────────────────────────

class FakeAdapter implements TextAdapter {
  calls = 0;
  prompts: string[] = [];
  constructor(
    public family: "claude" | "gpt",
    public model: string,
    private reply: (prompt: string) => string,
    public name = "fake",
  ) {}
  async run(prompt: string) {
    this.calls++;
    this.prompts.push(prompt);
    return { ok: true, text: this.reply(prompt), limit: false, duration_ms: 0 };
  }
}

const PASS = '```json\n{"verdict":"PASS","issues":[]}\n```';
const FIX = (x: string) =>
  `\`\`\`json\n{"verdict":"FIX","issues":["${x}"]}\n\`\`\``;

function orch(
  department: DepartmentRunner,
  extra: Partial<ConstructorParameters<typeof Orchestrator>[0]> = {},
): Orchestrator {
  const noop = async () => ({
    ok: true,
    text: "",
    limit: false,
    duration_ms: 0,
  });
  const a = (family: "claude" | "gpt") => ({
    name: "fixture",
    model: `fixture-${family}`,
    family,
    run: noop,
  });
  return new Orchestrator({
    store,
    supervisor: a("claude"),
    briefChecker: a("gpt"),
    departments: { copy: department },
    cards: {
      check: () => ({ ok: true, problems: [] }),
      text: () => "",
    } as never,
    ladder: {} as never,
    notion,
    guard: () => ({ alarm: false, summary: "ok" }),
    draftParentId: PARENT,
    repoRoot: store.runsDir,
    capsulePath: path.join(store.runsDir, "none"),
    now: () => new Date(NOW),
    ...extra,
  });
}

function seed(state: Order["state"], patch: Partial<Order> = {}): Order {
  const o: Order = { ...effOrder(state), draft_file: undefined, ...patch };
  store.save(o);
  return store.load(ORDER_ID);
}

const J = () => new AttemptJournal(dir, () => NOW);

function proc(p: Partial<ProcInfo> & { pid: number }): ProcInfo {
  return {
    pgid: p.pid,
    uid: UID,
    lstart: "Wed Nov 4 12:00:00 2026",
    startMs: Date.parse("2026-11-04T11:00:00Z"),
    envHidden: false,
    ...p,
  };
}

/** Sonda s pevnými odpověďmi ps (sekvence; poslední se opakuje) a záznamem signálů. */
class FakeProbe implements ProcessProbe {
  kills: Array<{ pgid: number; sig: string }> = [];
  private i = 0;
  constructor(
    private seq: Array<ProcInfo[] | undefined>,
    public ownPgid: number | undefined = 7,
  ) {}
  list() {
    const r = this.seq[Math.min(this.i, this.seq.length - 1)];
    this.i++;
    return r;
  }
  kill(pgid: number, sig: NodeJS.Signals) {
    this.kills.push({ pgid, sig });
    return true;
  }
  async sleep() {}
}

function git(cwd: string, ...args: string[]) {
  const r = spawnSync(
    "git",
    [
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@t",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd, encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

/** Lokální bare repo jako origin + worktree zakázky (větev tars/<id>) s danými soubory v jednom commitu. */
function devRepo(files: Record<string, string>, id = ORDER_ID) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "tars-4a-git-"));
  const bare = path.join(base, "origin.git");
  git(base, "init", "-q", "--bare", "-b", "main", bare);
  const seedDir = path.join(base, "seed");
  git(base, "init", "-q", "-b", "main", seedDir);
  fs.writeFileSync(path.join(seedDir, "README.md"), "seed\n");
  git(seedDir, "add", "-A");
  git(seedDir, "commit", "-q", "-m", "seed");
  git(seedDir, "remote", "add", "origin", bare);
  git(seedDir, "push", "-q", "origin", "main");
  const wtRoot = path.join(base, "wt");
  fs.mkdirSync(wtRoot);
  const wt = path.join(wtRoot, id);
  git(base, "clone", "-q", bare, wt);
  git(wt, "checkout", "-q", "-b", `tars/${id}`);
  for (const [f, c] of Object.entries(files))
    fs.writeFileSync(path.join(wt, f), c);
  git(wt, "add", "-A");
  git(wt, "commit", "-q", "-m", "work");
  const old = process.env.TARS_WORKTREES;
  process.env.TARS_WORKTREES = wtRoot;
  cleanup.push(() => {
    if (old === undefined) delete process.env.TARS_WORKTREES;
    else process.env.TARS_WORKTREES = old;
  });
  return { base, bare, wt, head: git(wt, "rev-parse", "HEAD") };
}

/** Falešné `gh` a logující `git` na PATH (log volání). */
function fakeBin(ghScript = 'echo "$@" >> "$GH_LOG"; exit 1') {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "tars-4a-bin-"));
  const gitLog = path.join(bin, "git.log");
  const ghLog = path.join(bin, "gh.log");
  const realGit = spawnSync("sh", ["-c", "command -v git"], {
    encoding: "utf8",
  }).stdout.trim();
  fs.writeFileSync(
    path.join(bin, "git"),
    `#!/bin/sh\necho "$@" >> "${gitLog}"\nexec "${realGit}" "$@"\n`,
    { mode: 0o755 },
  );
  fs.writeFileSync(
    path.join(bin, "gh"),
    `#!/bin/sh\nGH_LOG="${ghLog}"\n${ghScript}\n`,
    { mode: 0o755 },
  );
  const old = process.env.PATH;
  process.env.PATH = `${bin}:${old}`;
  cleanup.push(() => {
    process.env.PATH = old;
  });
  const read = (f: string) =>
    fs.existsSync(f)
      ? fs.readFileSync(f, "utf8").split("\n").filter(Boolean)
      : [];
  return { git: () => read(gitLog), gh: () => read(ghLog) };
}

function devOrder(patch: Partial<Order> = {}): Order {
  const o = effOrder("CHECKING");
  return {
    ...o,
    brief: { ...o.brief!, department: "dev" },
    draft_file: "wt",
    meta: { chain_status: "PASS" },
    ...patch,
  };
}

function fakeChain(
  run: () => Promise<{
    ok: boolean;
    limit: boolean;
    text: string;
    status: string;
    error?: string;
    duration_ms: number;
  }>,
) {
  const c = {
    family: "claude" as const,
    name: "ai-chain",
    model: "fake-chain",
    runSh: "/nonexistent/run.sh",
    calls: 0,
    run: async () => (c.calls++, run()),
  };
  return c;
}

// ───────────────────────────── §7 journal pokusů ─────────────────────────────

describe("§7 journal pokusů", () => {
  const intent = (j: AttemptJournal, step = "create-r0") =>
    j.intent(ORDER_ID, step, {
      input_sha256: "x",
      deadline: "2026-11-04T13:00:00.000Z",
      decision_check: "legacy",
    });

  it("stav jde jen dopředu; FINISHED je konečný", () => {
    const j = J();
    const r = intent(j);
    expect(r.attempt_id).toBe(`${ORDER_ID}/create-r0/a1`);
    j.started(r.attempt_id, {
      pid: 123,
      pgid: 123,
      lstart: "x",
      cmd: "claude",
      at: NOW,
    });
    j.finished(r.attempt_id, { exit: 0, ok: true, output_sha256: "a" });
    expect(() =>
      j.started(r.attempt_id, {
        pid: 1,
        pgid: 1,
        lstart: "",
        cmd: "x",
        at: NOW,
      }),
    ).toThrow(/není povolen/);
    expect(() => j.abandoned(r.attempt_id, "x")).toThrow(/není povolen/);
  });

  it("§8: opakování bez záznamu reconcile = throw; reconcile UNKNOWN = throw; RETRY_SAFE pustí pokus a2", () => {
    const j = J();
    const r = intent(j);
    expect(() => intent(j)).toThrow(/INTENT, nový pokus zakázán/);
    j.abandoned(r.attempt_id, "test");
    expect(() => intent(j)).toThrow(RetryRefusedError);
    j.setReconcile(r.attempt_id, "RETRY_SAFE", "ok");
    expect(() => j.setReconcile(r.attempt_id, "RESUME", "znovu")).toThrow(
      /už má reconcile/,
    );
    const r2 = intent(j);
    expect(r2.attempt).toBe(2);
    j.abandoned(r2.attempt_id, "x");
    j.setReconcile(r2.attempt_id, "UNKNOWN", "nejasné");
    expect(() => intent(j)).toThrow(RetryRefusedError);
  });

  it("výstup pokusu: readOutput jen při shodě sha256 s FINISHED", () => {
    const j = J();
    const r = intent(j);
    const sha = j.writeOutput(r, '{"outcome":1}');
    const f = j.finished(r.attempt_id, {
      exit: 0,
      ok: true,
      output_sha256: sha,
    });
    expect(j.readOutput(f)).toBe('{"outcome":1}');
    fs.writeFileSync(path.join(dir, ORDER_ID, f.output_path), '{"outcome":2}');
    expect(j.readOutput(f)).toBeUndefined();
  });
});

// ───────────────────────────── §7 runProcess: skupina, env, kill ─────────────────────────────

describe("§7 runProcess: detached skupina, TARS_ATTEMPT_ID, kill -pgid", () => {
  it("dítě pod pokusem dostane TARS_ATTEMPT_ID a CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1, je vedoucí vlastní skupiny a STARTED nese pid/pgid/lstart", async () => {
    const j = J();
    const rec = j.intent(ORDER_ID, "create-r0", {
      input_sha256: "x",
      deadline: "2030-01-01T00:00:00.000Z",
      decision_check: "legacy",
    });
    const r = await runInAttempt(
      journalScope(j, rec.attempt_id, processStartTime),
      () =>
        runProcess(
          process.execPath,
          [
            "-e",
            "const {execSync}=require('child_process');console.log(JSON.stringify({a:process.env.TARS_ATTEMPT_ID,b:process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS,pg:execSync('ps -o pgid= -p '+process.pid).toString().trim(),pid:process.pid}))",
          ],
          "",
          dir,
          20_000,
        ),
    );
    const out = JSON.parse(r.stdout) as {
      a: string;
      b: string;
      pg: string;
      pid: number;
    };
    expect(out.a).toBe(rec.attempt_id);
    expect(out.b).toBe("1");
    expect(Number(out.pg)).toBe(out.pid); // pgid = pid
    const st = j.get(rec.attempt_id)!;
    expect(st.phase).toBe("STARTED");
    expect(st.started).toMatchObject({ pid: out.pid, pgid: out.pid });
    expect(st.started!.lstart).not.toBe("");
  });

  it("bez pokusu žádné TARS_ATTEMPT_ID", async () => {
    const r = await runProcess(
      process.execPath,
      ["-e", "console.log(process.env.TARS_ATTEMPT_ID ?? 'none')"],
      "",
      dir,
      20_000,
    );
    expect(r.stdout.trim()).toBe("none");
  });

  it("guard pid 0: killGroup nikdy nesignalizuje pid ≤ 1, undefined ani vlastní proces", () => {
    expect(killGroup(undefined, "SIGTERM")).toBe(false);
    expect(killGroup(0, "SIGTERM")).toBe(false);
    expect(killGroup(1, "SIGTERM")).toBe(false);
    expect(killGroup(-5, "SIGTERM")).toBe(false);
    expect(killGroup(Number.NaN, "SIGTERM")).toBe(false);
    expect(killGroup(process.pid, "SIGTERM")).toBe(false);
  });

  it("orphan test 6: timeout zabije celou skupinu, vnuk nepřežije", async () => {
    const pidFile = path.join(dir, "gpid");
    const r = await runProcess(
      "/bin/sh",
      ["-c", `sleep 30 & echo $! > ${pidFile}; wait`],
      "",
      dir,
      400,
    );
    expect(r.timedOut).toBe(true);
    const gpid = Number(fs.readFileSync(pidFile, "utf8").trim());
    await waitFor(() => pidExists(gpid) === false);
    expect(pidExists(gpid)).toBe(false);
  });

  it("FIX1 nález 1: vnuk ignorující SIGTERM přežije close rodiče → SIGKILL skupiny podle doloženého konce skupiny, výsledek až při prázdné skupině", async () => {
    const pidFile = path.join(dir, "gpid");
    const t0 = Date.now();
    const r = await runProcess(
      "/bin/sh",
      [
        "-c",
        `${process.execPath} -e "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)" >/dev/null 2>&1 & echo $! > ${pidFile}; sleep 30`,
      ],
      "",
      dir,
      1500,
    );
    const gpid = Number(fs.readFileSync(pidFile, "utf8").trim());
    cleanup.push(() => {
      try {
        process.kill(gpid, "SIGKILL");
      } catch {
        /* neběží */
      }
    });
    expect(r.timedOut).toBe(true);
    // close rodiče přišel hned po SIGTERM; výsledek ale čekal na SIGKILL vnuka (≥ 5 s po SIGTERM).
    expect(Date.now() - t0).toBeGreaterThan(5000);
    expect(r.groupEnded).toBe(true);
    expect(pidExists(gpid)).toBe(false);
  }, 30_000);

  it("FIX1 nález 1: pod pokusem nedoložený konec skupiny zapíše onSettled → unsettled (pokus nesmí do FINISHED)", async () => {
    const j = J();
    const rec = j.intent(ORDER_ID, "create-r0", {
      input_sha256: "x",
      deadline: "2030-01-01T00:00:00.000Z",
      decision_check: "legacy",
    });
    const scope = journalScope(j, rec.attempt_id, processStartTime);
    scope.onSettled!(4242, false, "člen bez identity");
    scope.onSettled!(4243, true, "skupina prázdná");
    expect(scope.unsettled).toEqual(["4242: člen bez identity"]);
  });

  it("FIX1 nález 1+2: settleGroup — prázdná skupina = konec; člen spuštěný po exit vedoucího (možná recyklace) se nesignalizuje; SIGTERM → SIGKILL → ověření", async () => {
    const exitAt = Date.parse("2026-11-05T10:00:10Z");
    const old = { pid: 9001, startMs: Date.parse("2026-11-05T10:00:00Z") };
    const late = { pid: 9002, startMs: Date.parse("2026-11-05T10:00:10Z") };
    const kills: string[] = [];
    const kill = (g: number, s: NodeJS.Signals) => (
      kills.push(`${s} -${g}`),
      true
    );
    const sleep = async () => {};
    expect(
      await settleGroup(77, exitAt, { list: () => [], kill, sleep }),
    ).toMatchObject({ ended: true });
    expect(kills).toEqual([]);

    const foreign = await settleGroup(77, exitAt, {
      list: () => [old, late],
      kill,
      sleep,
    });
    expect(foreign.ended).toBe(false);
    expect(foreign.note).toMatch(/bez doložené identity/);
    expect(kills).toEqual([]);

    expect(
      (await settleGroup(77, exitAt, { list: () => undefined, kill, sleep }))
        .ended,
    ).toBe(false);

    // člen ignoruje SIGTERM, SIGKILL ho ukončí
    let n = 0;
    const seq = await settleGroup(77, exitAt, {
      list: () => (kills.includes("SIGKILL -77") && n++ > 0 ? [] : [old]),
      kill,
      sleep,
      termWaitMs: 0,
      killWaitMs: 50,
    });
    expect(seq.ended).toBe(true);
    expect(kills).toEqual(["SIGTERM -77", "SIGKILL -77"]);

    // po SIGKILL stále běží → ended false
    kills.length = 0;
    const stuck = await settleGroup(77, exitAt, {
      list: () => [old],
      kill,
      sleep,
      termWaitMs: 0,
      killWaitMs: 0,
    });
    expect(stuck.ended).toBe(false);
    expect(stuck.note).toMatch(/po SIGKILL stále běží/);
  });
});

// ───────────────────────────── §7 reconciler: 6 orphan testů ─────────────────────────────

describe("§7 reconciler", () => {
  const LST = "Wed Nov 4 12:00:00 2026";
  const startedRec = (
    j: AttemptJournal,
    deadline = "2026-11-04T13:00:00.000Z",
    pid = 4242,
  ): AttemptRecord => {
    const r = j.intent(ORDER_ID, "create-r0", {
      input_sha256: "x",
      deadline,
      decision_check: "legacy",
    });
    return j.started(r.attempt_id, {
      pid,
      pgid: pid,
      lstart: LST,
      cmd: "claude",
      at: NOW,
    });
  };
  const at = (iso: string) => ({
    now: new Date(iso),
    exitTimeoutMs: 0,
    uid: UID,
  });

  it("orphan test 1 (crash-before-spawn): INTENT bez STARTED, žádný proces → ABANDONED; skrytý env po INTENT → HOLD; ps selhal → HOLD", async () => {
    let j = J();
    let r = j.intent(ORDER_ID, "create-r0", {
      input_sha256: "x",
      deadline: "2026-11-04T13:00:00.000Z",
      decision_check: "legacy",
    });
    const old = proc({
      pid: 50,
      startMs: Date.parse("2026-11-04T10:00:00Z"),
      envHidden: true,
    });
    expect(
      (await reconcileAttempt(j, r, new FakeProbe([[old]]), at(NOW))).action,
    ).toBe("abandoned");
    expect(j.get(r.attempt_id)!.phase).toBe("ABANDONED");

    fs.rmSync(path.join(dir, ORDER_ID, "attempts"), { recursive: true });
    j = J();
    r = j.intent(ORDER_ID, "create-r0", {
      input_sha256: "x",
      deadline: "2026-11-04T13:00:00.000Z",
      decision_check: "legacy",
    });
    const fresh = proc({
      pid: 60,
      startMs: Date.parse(NOW) + 500,
      envHidden: true,
    });
    expect(
      (await reconcileAttempt(j, r, new FakeProbe([[fresh]]), at(NOW))).action,
    ).toBe("hold");
    expect(j.get(r.attempt_id)!.phase).toBe("HOLD");
    expect(
      (
        await reconcileAttempt(
          j,
          j.get(r.attempt_id)!,
          new FakeProbe([undefined]),
          at(NOW),
        )
      ).reason,
    ).toMatch(/ps selhal/);
  });

  it("orphan test 2 (crash-after-spawn-before-PID): skutečný proces s TARS_ATTEMPT_ID (env čitelný přes ps -E) → HOLD, nic se nezabíjí", async () => {
    const j = J();
    const r = j.intent(ORDER_ID, "create-r0", {
      input_sha256: "x",
      deadline: "2026-11-04T13:00:00.000Z",
      decision_check: "legacy",
    });
    const child = spawn(process.execPath, ["-e", "setTimeout(()=>{},30000)"], {
      env: { ...process.env, TARS_ATTEMPT_ID: r.attempt_id },
      stdio: "ignore",
      detached: true,
    });
    cleanup.push(() => killGroup(child.pid, "SIGKILL"));
    await waitFor(() =>
      (psProbe.list() ?? []).some(
        (p) => p.pid === child.pid && p.attemptId === r.attempt_id,
      ),
    );
    const res = await reconcileAttempt(j, r, psProbe, {
      now: new Date(),
      uid: UID,
    });
    expect(res.action).toBe("hold");
    expect(res.reason).toMatch(/TARS_ATTEMPT_ID/);
    expect(pidExists(child.pid!)).toBe(true);
  });

  /** Skutečný vedoucí `sh` (exec sleep) s vnukem node ve stejné skupině; pokus STARTED s lstart vedoucího. */
  async function realGroup(deadline: string) {
    const pidFile = path.join(dir, "gpid");
    const leader = spawn(
      "/bin/sh",
      [
        "-c",
        `${process.execPath} -e "setTimeout(()=>{},60000)" >/dev/null 2>&1 & echo $! > ${pidFile}; exec sleep 60`,
      ],
      { stdio: "ignore", detached: true },
    );
    cleanup.push(() => killGroup(leader.pid, "SIGKILL"));
    await waitFor(
      () =>
        fs.existsSync(pidFile) &&
        fs.readFileSync(pidFile, "utf8").trim().length > 0,
    );
    const gpid = Number(fs.readFileSync(pidFile, "utf8").trim());
    cleanup.push(() => {
      try {
        process.kill(gpid, "SIGKILL");
      } catch {
        /* už neběží */
      }
    });
    const j = J();
    const r = j.intent(ORDER_ID, "create-r0", {
      input_sha256: "x",
      deadline,
      decision_check: "legacy",
    });
    j.started(r.attempt_id, {
      pid: leader.pid!,
      pgid: leader.pid!,
      lstart: processStartTime(leader.pid!)!,
      cmd: "sh",
      at: NOW,
    });
    // Sonda vidí jen procesy tohoto testu: ostatní procesy stroje (souběžné testy, démoni) by jinak spadly do
    // „nevyloučitelných“ (nález 3) a test by neměřil kill sekvenci.
    const scoped: ProcessProbe = {
      list: () =>
        psProbe
          .list()
          ?.filter(
            (p) =>
              p.pid === leader.pid || p.pid === gpid || p.pgid === leader.pid,
          ),
      kill: (g, s) => psProbe.kill(g, s),
      sleep: (ms) => psProbe.sleep(ms),
      ownPgid: psProbe.ownPgid,
    };
    return { leader, gpid, j, r, scoped };
  }

  it("orphan test 3 (FIX1 nález 2): rodič zabit, vnuk žije ve skupině bez vedoucího → identita nedoložena → HOLD, nic se nesignalizuje (ani po deadline)", async () => {
    const { leader, gpid, j, r, scoped } = await realGroup(
      new Date(Date.now() + 3600_000).toISOString(),
    );
    const exited = new Promise((res) => leader.on("exit", res));
    process.kill(leader.pid!, "SIGKILL"); // rodič umře, vnuk zůstane ve skupině
    await exited;
    await waitFor(
      () => !(psProbe.list() ?? []).some((p) => p.pid === leader.pid),
    );
    expect(pidExists(gpid)).toBe(true);
    const sent: string[] = [];
    const watch: ProcessProbe = {
      ...scoped,
      kill: (g, s) => (sent.push(`${s} -${g}`), scoped.kill(g, s)),
    };
    const res = await reconcileAttempt(j, j.get(r.attempt_id)!, watch, {
      now: new Date(Date.now() + 2 * 3600_000),
      uid: UID,
      exitTimeoutMs: 300,
    });
    expect(res.action).toBe("hold");
    expect(res.reason).toMatch(/bez doložené identity/);
    expect(sent).toEqual([]);
    expect(pidExists(gpid)).toBe(true);
    expect(j.get(r.attempt_id)!.phase).toBe("HOLD");
  });

  it("orphan test 3b: vedoucí se shodným lstart žije s vnukem — před deadline čeká, po deadline SIGTERM -pgid a ABANDONED s důkazem", async () => {
    const { leader, gpid, j, r, scoped } = await realGroup(
      new Date(Date.now() + 3600_000).toISOString(),
    );
    const wait = await reconcileAttempt(j, j.get(r.attempt_id)!, scoped, {
      now: new Date(),
      uid: UID,
      exitTimeoutMs: 300,
    });
    expect(wait.action).toBe("waiting_background");
    const res = await reconcileAttempt(j, j.get(r.attempt_id)!, scoped, {
      now: new Date(Date.now() + 2 * 3600_000),
      uid: UID,
      exitTimeoutMs: 300,
    });
    expect(res.action).toBe("abandoned");
    await waitFor(() => pidExists(gpid) === false);
    await waitFor(() => pidExists(leader.pid!) === false);
    const rec = j.get(r.attempt_id)!;
    expect(rec.abandoned!.kill_evidence).toMatch(
      new RegExp(`SIGTERM -${leader.pid}: odesláno`),
    );
  });

  it("FIX1 nález 2: recyklovaný pgid bez lstart / bez vedoucího → HOLD, 0 signálů; vlastní skupina ani neznámá vlastní skupina se nesignalizují", async () => {
    const past = "2026-11-04T11:00:00.000Z"; // deadline uplynul
    // STARTED bez lstart, ve skupině 4242 běží vedoucí i člen (může to být cizí skupina po recyklaci ID)
    let j = J();
    let r = j.intent(ORDER_ID, "create-r0", {
      input_sha256: "x",
      deadline: past,
      decision_check: "legacy",
    });
    r = j.started(r.attempt_id, {
      pid: 4242,
      pgid: 4242,
      lstart: "",
      cmd: "claude",
      at: NOW,
    });
    let probe = new FakeProbe([
      [proc({ pid: 4242 }), proc({ pid: 4250, pgid: 4242 })],
    ]);
    let res = await reconcileAttempt(j, r, probe, at(NOW));
    expect(res.action).toBe("hold");
    expect(res.reason).toMatch(/bez doložené identity/);
    expect(probe.kills).toEqual([]);

    // lstart uložen, vedoucí chybí, členové s pgid 4242 běží (recyklované ID po odchodu nového vedoucího)
    fs.rmSync(path.join(dir, ORDER_ID, "attempts"), { recursive: true });
    j = J();
    r = startedRec(j, past);
    probe = new FakeProbe([
      [proc({ pid: 4250, pgid: 4242 }), proc({ pid: 4251, pgid: 4242 })],
    ]);
    res = await reconcileAttempt(j, r, probe, at(NOW));
    expect(res.action).toBe("hold");
    expect(probe.kills).toEqual([]);

    // skupina pokusu = vlastní skupina orchestrátoru → HOLD, 0 signálů
    fs.rmSync(path.join(dir, ORDER_ID, "attempts"), { recursive: true });
    j = J();
    r = startedRec(j, past);
    probe = new FakeProbe([[proc({ pid: 4242, lstart: LST })]], 4242);
    res = await reconcileAttempt(j, r, probe, at(NOW));
    expect(res.action).toBe("hold");
    expect(res.reason).toMatch(/vlastní skupina/);
    expect(probe.kills).toEqual([]);

    // vlastní skupinu nejde zjistit → HOLD, 0 signálů
    fs.rmSync(path.join(dir, ORDER_ID, "attempts"), { recursive: true });
    j = J();
    r = startedRec(j, past);
    probe = new FakeProbe([[proc({ pid: 4242, lstart: LST })]]);
    probe.ownPgid = undefined;
    res = await reconcileAttempt(j, r, probe, at(NOW));
    expect(res.action).toBe("hold");
    expect(probe.kills).toEqual([]);
  });

  it("FIX1 nález 2: produkční psProbe předává vlastní pgid; killGroup odmítne vlastní skupinu (ne jen process.pid)", () => {
    const own = Number(
      spawnSync("ps", ["-o", "pgid=", "-p", String(process.pid)], {
        encoding: "utf8",
      }).stdout.trim(),
    );
    expect(own).toBeGreaterThan(1);
    expect(psProbe.ownPgid).toBe(own);
    expect(killGroup(own, "SIGCONT")).toBe(false);
    expect(psProbe.kill(own, "SIGCONT")).toBe(false);
  });

  it("FIX1 nález 3: skupina pokusu skončila, ale po INTENT běží proces se skrytým env mimo skupinu (setsid potomek) → HOLD, ne ABANDONED", async () => {
    const j = J();
    const r = startedRec(j);
    const setsidChild = proc({
      pid: 5000,
      pgid: 5000,
      envHidden: true,
      startMs: Date.parse(NOW) + 2000,
    });
    let res = await reconcileAttempt(
      j,
      r,
      new FakeProbe([[setsidChild]]),
      at(NOW),
    );
    expect(res.action).toBe("hold");
    expect(res.reason).toMatch(/konec potomků nelze doložit/);
    expect(j.get(r.attempt_id)!.phase).toBe("HOLD");
    // Proces s čitelným env bez TARS_ATTEMPT_ID ani proces spuštěný před INTENT potomkem být nemůže → ABANDONED.
    res = await reconcileAttempt(
      j,
      j.get(r.attempt_id)!,
      new FakeProbe([
        [
          proc({
            pid: 5001,
            envHidden: false,
            startMs: Date.parse(NOW) + 2000,
          }),
          proc({
            pid: 5002,
            envHidden: true,
            startMs: Date.parse(NOW) - 3600_000,
          }),
        ],
      ]),
      at(NOW),
    );
    expect(res.action).toBe("abandoned");
  });

  it("FIX1 nález 3: skutečný potomek v nové session (detached = setsid) přežije konec skupiny → HOLD", async () => {
    const pidFile = path.join(dir, "spid");
    const j = J();
    const r = j.intent(ORDER_ID, "create-r0", {
      input_sha256: "x",
      deadline: "2030-01-01T00:00:00.000Z",
      decision_check: "legacy",
    });
    const leader = spawn(
      process.execPath,
      [
        "-e",
        `const c=require('child_process').spawn('/bin/sleep',['30'],{detached:true,stdio:'ignore'});require('fs').writeFileSync(${JSON.stringify(pidFile)},String(c.pid));c.unref()`,
      ],
      { stdio: "ignore", detached: true },
    );
    await new Promise((res) => leader.on("exit", res));
    const spid = Number(fs.readFileSync(pidFile, "utf8"));
    cleanup.push(() => killGroup(spid, "SIGKILL"));
    j.started(r.attempt_id, {
      pid: leader.pid!,
      pgid: leader.pid!,
      lstart: "Wed Nov 4 12:00:00 2026",
      cmd: "node",
      at: NOW,
    });
    const scoped: ProcessProbe = {
      list: () =>
        psProbe.list()?.filter((p) => p.pid === spid || p.pgid === leader.pid),
      kill: (g, s) => psProbe.kill(g, s),
      sleep: (ms) => psProbe.sleep(ms),
      ownPgid: psProbe.ownPgid,
    };
    const res = await reconcileAttempt(j, j.get(r.attempt_id)!, scoped, {
      now: new Date(),
      uid: UID,
    });
    expect(res.action).toBe("hold");
    expect(res.reason).toContain(String(spid));
    expect(pidExists(spid)).toBe(true);
  });

  it("orphan test 4: recyklovaný PID (jiný lstart) se nezabije, pokus ABANDONED", async () => {
    const j = J();
    const r = startedRec(j, "2026-11-04T11:00:00.000Z"); // deadline už uplynul
    const probe = new FakeProbe([
      [proc({ pid: 4242, lstart: "Thu Nov 5 09:00:00 2026" })],
    ]);
    const res = await reconcileAttempt(j, r, probe, at(NOW));
    expect(res.action).toBe("abandoned");
    expect(res.reason).toMatch(/recyklován/);
    expect(probe.kills).toEqual([]);
  });

  it("skupina žije, deadline neuplynul → waiting_background, žádný kill; po deadline SIGTERM, pak SIGKILL, stále běží → HOLD", async () => {
    const j = J();
    const r = startedRec(j);
    const alive = [
      proc({ pid: 4242, lstart: LST }),
      proc({ pid: 4243, pgid: 4242 }),
    ];
    const p1 = new FakeProbe([alive]);
    expect((await reconcileAttempt(j, r, p1, at(NOW))).action).toBe(
      "waiting_background",
    );
    expect(p1.kills).toEqual([]);
    const p2 = new FakeProbe([alive]);
    const res = await reconcileAttempt(
      j,
      r,
      p2,
      at("2026-11-04T14:00:00.000Z"),
    );
    expect(res.action).toBe("hold");
    expect(p2.kills).toEqual([
      { pgid: 4242, sig: "SIGTERM" },
      { pgid: 4242, sig: "SIGKILL" },
    ]);
  });

  it("orphan test 5 (pád po FINISHED): přechod neaplikován → RESUME z uloženého výstupu, 0 nových volání modelu", async () => {
    const creator = new FakeAdapter("gpt", "c", () => DRAFT);
    const checker = new FakeAdapter("claude", "k", () => PASS);
    const o = orch(new CopyDepartment(creator, checker));
    const before = seed("DOING");
    const after = await o.step(before);
    expect(after.state).toBe("CHECKING");
    expect(creator.calls).toBe(1);
    // Pád mezi FINISHED a uložením přechodu: stav je znovu DOING (zapsáno přes CAS nad aktuální verzí).
    const cur = store.load(ORDER_ID);
    expect(store.save({ ...before, version: cur.version })).toBe(true);
    const again = await o.step(store.load(ORDER_ID));
    expect(again.state).toBe("CHECKING");
    expect(creator.calls).toBe(1);
    const recs = J().list(ORDER_ID, "create-r0");
    expect(recs).toHaveLength(1);
    expect(recs[0].reconcile?.result).toBe("RESUME");
    expect(again.meta.final_body_file).toBe("final-body-r0.md");
  });

  it("FIX1 nález 1: orchestrátor — konec skupiny procesu kroku nedoložen → pokus HOLD (žádný FINISHED), přechod se neaplikuje", async () => {
    const creator = new FakeAdapter("gpt", "c", () => {
      currentAttempt()!.onSettled!(
        4242,
        false,
        "člen skupiny bez doložené identity",
      );
      return DRAFT;
    });
    const o = orch(
      new CopyDepartment(creator, new FakeAdapter("claude", "k", () => PASS)),
    );
    const r = await o.step(seed("DOING"));
    expect(r.state).not.toBe("CHECKING");
    const recs = J().list(ORDER_ID, "create-r0");
    expect(recs).toHaveLength(1);
    expect(recs[0].phase).toBe("HOLD");
    expect(recs[0].finished).toBeUndefined();
    expect(recs[0].hold!.reason).toMatch(/konec skupiny procesů nedoložen/);
  });

  it("FIX1 nález 1: vnitřní volání kontrolora s nedoloženým koncem skupiny → volání i krok HOLD, ne FINISHED", async () => {
    const creator = new FakeAdapter("gpt", "c", () => DRAFT);
    const checker = new FakeAdapter("claude", "k", () => {
      currentAttempt()!.onSettled!(4243, false, "po SIGKILL stále běží");
      return PASS;
    });
    const o = orch(new CopyDepartment(creator, checker));
    let ord = await o.step(seed("DOING"));
    expect(ord.state).toBe("CHECKING");
    ord = await o.step(ord);
    expect(ord.state).not.toBe("DELIVERED");
    const all = J().list(ORDER_ID);
    expect(all.find((x) => x.step === "check-r0-a1-c0")!.phase).toBe("HOLD");
    expect(all.find((x) => x.step === "check-r0")!.phase).toBe("HOLD");
  });

  it("FIX1 nález 4: draft se zapíše trvale (fsync souboru, rename, fsync adresáře) PŘED zápisem FINISHED; po pádu jde RESUME", async () => {
    const events: string[] = [];
    const realRename = fs.renameSync;
    const sRename = vi
      .spyOn(fs, "renameSync")
      .mockImplementation((src, dst) => {
        const name = path.basename(String(dst));
        let tag = name;
        if (name === "create-r0-a1.json")
          tag = `${name}:${(JSON.parse(fs.readFileSync(String(src), "utf8")) as AttemptRecord).phase}`;
        events.push(`rename ${tag}`);
        return realRename(src, dst);
      });
    const realFsync = fs.fsyncSync;
    const sFsync = vi.spyOn(fs, "fsyncSync").mockImplementation((fd) => {
      events.push("fsync");
      return realFsync(fd);
    });
    try {
      const creator = new FakeAdapter("gpt", "c", () => DRAFT);
      const o = orch(
        new CopyDepartment(creator, new FakeAdapter("claude", "k", () => PASS)),
      );
      const before = seed("DOING");
      expect((await o.step(before)).state).toBe("CHECKING");
      const d = events.indexOf("rename draft-v0.md");
      const fin = events.indexOf("rename create-r0-a1.json:FINISHED");
      expect(d).toBeGreaterThan(0);
      expect(events[d - 1]).toBe("fsync"); // fsync souboru před rename
      expect(events[d + 1]).toBe("fsync"); // fsync adresáře po rename
      expect(fin).toBeGreaterThan(d);
      // pád po FINISHED před uložením přechodu: draft je na disku se shodným sha256 → RESUME, 0 nových volání
      const cur = store.load(ORDER_ID);
      store.save({ ...before, version: cur.version });
      expect((await o.step(store.load(ORDER_ID))).state).toBe("CHECKING");
      expect(creator.calls).toBe(1);
      expect(J().list(ORDER_ID, "create-r0")[0].reconcile?.result).toBe(
        "RESUME",
      );
    } finally {
      sRename.mockRestore();
      sFsync.mockRestore();
    }
  });

  it("orchestrátor: osiřelý pokus běží na pozadí před deadline → žádný druhý pokus, stav beze změny", async () => {
    const creator = new FakeAdapter("gpt", "c", () => DRAFT);
    const j = J();
    startedRec(j, "2026-11-04T13:00:00.000Z");
    const o = orch(
      new CopyDepartment(creator, new FakeAdapter("claude", "k", () => PASS)),
      {
        processProbe: new FakeProbe([[proc({ pid: 4242, lstart: LST })]]),
      },
    );
    const r = await o.step(seed("DOING"));
    expect(r.state).toBe("DOING");
    expect(creator.calls).toBe(0);
    expect(J().list(ORDER_ID, "create-r0")).toHaveLength(1);
  });

  it("parsePsLine: lstart, pgid, env skrytý / čitelný, TARS_ATTEMPT_ID", () => {
    const vis = parsePsLine(
      `  901   900   501 Wed Nov  4 23:30:01 2026     node -e x TARS_ATTEMPT_ID=wo-1/create-r0/a1 PATH=/usr/bin HOME=/Users/x`,
    );
    expect(vis).toMatchObject({
      pid: 901,
      pgid: 900,
      uid: 501,
      lstart: "Wed Nov 4 23:30:01 2026",
      envHidden: false,
      attemptId: "wo-1/create-r0/a1",
    });
    const hid = parsePsLine(
      `  902   902   501 Wed Nov  4 23:30:02 2026     /bin/sleep 5`,
    );
    expect(hid).toMatchObject({ envHidden: true });
    expect(hid!.attemptId).toBeUndefined();
  });
});

// ───────────────────────────── §8 reconcile adaptérů + CI 4a (1) ─────────────────────────────

describe("§8 reconcile adaptérů", () => {
  it("CI 4a (1): retry dev kroku = throw, orchestrátor HOLD, 0 nových volání AI Chain, 0 push, 0 gh", async () => {
    const { wt } = devRepo({ "a.txt": "a\n" });
    const bins = fakeBin();
    const chain = fakeChain(async () => ({
      ok: false,
      limit: true,
      text: "",
      status: "UNKNOWN",
      error: "usage limit reached",
      duration_ms: 0,
    }));
    const dev = new DevDepartment(
      chain as never,
      new FakeAdapter("gpt", "codex", () => PASS),
    );
    expect(() =>
      dev.reconcileRetry(
        "create",
        devOrder(),
        {} as never,
        { attempt_id: "x" } as never,
      ),
    ).toThrow(RetryRefusedError);
    expect(() =>
      dev.reconcileRetry(
        "revise",
        devOrder(),
        {} as never,
        { attempt_id: "x" } as never,
      ),
    ).toThrow(RetryRefusedError);
    expect(
      dev.reconcileRetry(
        "check",
        devOrder(),
        {} as never,
        { attempt_id: "x" } as never,
      ).result,
    ).toBe("RETRY_SAFE");
    const o = orch(dev);
    const paused = await o.step(seed("DOING"));
    expect(paused.state).toBe("PAUSED");
    expect(chain.calls).toBe(1);
    // Limit uplynul: zakázka se vrací do DOING (stejně jako tick) a krok by se opakoval.
    const cur = store.load(ORDER_ID);
    store.save(transition(cur, { type: "resume" }, NOW));
    const held = await o.step(store.load(ORDER_ID));
    expect(held.state).toBe("UNKNOWN");
    expect(held.failure_reason ?? JSON.stringify(held.history)).toBeDefined();
    expect(fs.readFileSync(path.join(dir, "log.jsonl"), "utf8")).toMatch(
      /opakování kroku odmítnuto: retry dev kroku create/,
    );
    expect(chain.calls).toBe(1);
    expect(bins.git().filter((l) => /\bpush\b/.test(l))).toEqual([]);
    expect(bins.gh()).toEqual([]);
    expect(fs.existsSync(path.join(dir, ORDER_ID, "push"))).toBe(false);
    const recs = J().list(ORDER_ID, "create-r0");
    expect(recs).toHaveLength(1);
    expect(recs[0].reconcile).toBeUndefined(); // odmítnuto, žádný záznam = žádný další pokus
    expect(fs.existsSync(wt)).toBe(true);
  });

  it("copy create: soubor bez FINISHED se přejmenuje na orphan-a<n>.md (nic se nemaže) → RETRY_SAFE → pokus a2", async () => {
    const creator = new FakeAdapter("gpt", "c", () => DRAFT);
    const o = orch(
      new CopyDepartment(creator, new FakeAdapter("claude", "k", () => PASS)),
      { processProbe: new FakeProbe([[]]) },
    );
    const j = J();
    const r = j.intent(ORDER_ID, "create-r0", {
      input_sha256: "x",
      deadline: "2026-11-04T13:00:00.000Z",
      decision_check: "legacy",
    });
    j.started(r.attempt_id, {
      pid: 4242,
      pgid: 4242,
      lstart: "x",
      cmd: "claude",
      at: NOW,
    });
    store.writeFile(
      ORDER_ID,
      "draft-v0.md",
      "napůl zapsaný výstup osiřelého dítěte",
    );
    const next = await o.step(seed("DOING"));
    expect(next.state).toBe("CHECKING");
    expect(store.readFile(ORDER_ID, "orphan-a1.md")).toBe(
      "napůl zapsaný výstup osiřelého dítěte",
    );
    expect(store.readFile(ORDER_ID, "draft-v0.md")).toBe(DRAFT);
    const recs = J().list(ORDER_ID, "create-r0");
    expect(recs.map((x) => [x.phase, x.reconcile?.result])).toEqual([
      ["ABANDONED", "RETRY_SAFE"],
      ["FINISHED", undefined],
    ]);
  });

  it("oddělení bez reconcile před opakováním → UNKNOWN, HOLD, 0 volání", async () => {
    const creator = new FakeAdapter("gpt", "c", () => DRAFT);
    const copy = new CopyDepartment(
      creator,
      new FakeAdapter("claude", "k", () => PASS),
    );
    const bare: DepartmentRunner = Object.assign(
      Object.create(Object.getPrototypeOf(copy)),
      copy,
      { reconcileRetry: undefined },
    );
    const j = J();
    const r = j.intent(ORDER_ID, "create-r0", {
      input_sha256: "x",
      deadline: "2026-11-04T13:00:00.000Z",
      decision_check: "legacy",
    });
    j.abandoned(r.attempt_id, "test");
    const next = await orch(bare).step(seed("DOING"));
    expect(next.state).toBe("UNKNOWN");
    expect(creator.calls).toBe(0);
    expect(J().get(r.attempt_id)!.reconcile?.result).toBe("UNKNOWN");
  });

  it("dev deliver: push beze změny, journal <wo>/push/r<n> s receiptem z git ls-remote; druhý deliver → reconcile RESUME", async () => {
    const { bare, head } = devRepo({ "a.txt": "a\n" });
    const bins = fakeBin(
      'echo "$@" >> "$GH_LOG"; echo https://github.com/o/r/pull/9',
    );
    const dev = new DevDepartment(
      fakeChain(async () => ({
        ok: true,
        limit: false,
        text: "",
        status: "PASS",
        duration_ms: 0,
      })) as never,
      new FakeAdapter("gpt", "codex", () => PASS),
    );
    const ctx = { store, notion, draftParentId: PARENT, repoRoot: dir };
    const o = devOrder({ state: "DELIVERED" });
    const r1 = await dev.deliver(o, ctx);
    expect(r1).toMatchObject({
      ok: true,
      url: "https://github.com/o/r/pull/9",
      content: head,
    });
    expect(git(bare, "rev-parse", `refs/heads/tars/${ORDER_ID}`)).toBe(head);
    await dev.deliver(o, ctx);
    const recs = new PushJournal(dir).list(ORDER_ID, 0);
    expect(
      recs.map((x) => [x.state, x.reconcile.result, x.receipt?.git_oid]),
    ).toEqual([
      ["EFFECT_DONE", "RETRY_SAFE", head],
      ["EFFECT_DONE", "RESUME", head],
    ]);
    expect(recs[0].operation_id).toBe(`${ORDER_ID}/push/r0`);
    // Volání push zůstalo stejné a jedno na doručení.
    expect(bins.git().filter((l) => /^push /.test(l))).toEqual([
      `push -q -u origin tars/${ORDER_ID}`,
      `push -q -u origin tars/${ORDER_ID}`,
    ]);
    expect(bins.gh().filter((l) => /^pr create/.test(l))).toHaveLength(2);
  });
});

// ───────────────────────────── §6.2.1 fable: finální tělo (N07) ─────────────────────────────

describe("§6.2.1 finální tělo a review receipt (N07)", () => {
  const between = (p: string) =>
    p.slice(
      p.indexOf("<<<DRAFT\n") + "<<<DRAFT\n".length,
      p.indexOf("\nDRAFT>>>"),
    );

  async function toDelivered() {
    const creator = new FakeAdapter("gpt", "c", () => DRAFT);
    const checker = new FakeAdapter("claude", "kontrolor-1", () => PASS);
    const o = orch(new CopyDepartment(creator, checker));
    let ord = await o.step(seed("DOING"));
    expect(ord.state).toBe("CHECKING");
    ord = await o.step(ord);
    expect(ord.state).toBe("DELIVERED");
    return { o, ord, checker };
  }

  it("test 6: pozitivní pilot do DONE — prompt = celé finální tělo, receipt = otisk těla = delivered_hash = read-back, 1 stránka", async () => {
    const { o, ord, checker } = await toDelivered();
    const body = store.readFile(ORDER_ID, "final-body-r0.md");
    expect(body.startsWith("**DRAFT — není schváleno.**")).toBe(true);
    expect(body.endsWith(DRAFT)).toBe(true);
    const shown = between(checker.prompts[0]);
    expect(shown).toBe(body);
    expect(artifactHash(shown)).toBe(ord.meta.final_body_sha256);
    const rc = readReviewReceipt(store.orderDir(ORDER_ID), {
      review_id: ord.meta.review_receipt_id,
      sha256: ord.meta.review_receipt_sha256,
    })!;
    expect(rc).toMatchObject({
      verdict: "PASS",
      reviewed_artifact_kind: "content",
      reviewed_artifact_hash: ord.meta.final_body_sha256,
      reviewer_family: "claude",
      reviewer_model: "kontrolor-1",
    });
    expect(rc.reviewed_body_file).toEqual({
      file: "final-body-r0.md",
      sha256: sha256(body),
    });
    expect(rc.invocation_id).toMatch(
      new RegExp(`^${ORDER_ID}/check-r0-a1-c0/a1$`),
    );
    const inv = J().get(rc.invocation_id!)!;
    expect(inv.phase).toBe("FINISHED");
    expect(inv.finished!.output_sha256).toBe(rc.output_sha256);
    const done = await o.step(ord);
    expect(done.state).toBe("DONE");
    const pages = notion.pages();
    expect(pages).toHaveLength(1);
    expect(pages[0].md).toBe(body);
    expect(done.meta.delivered_hash).toBe(ord.meta.final_body_sha256);
    expect(artifactHash(await notion.readPage(done.delivered_url!))).toBe(
      rc.reviewed_artifact_hash,
    );
  });

  it("test 7: změna vstupu hlavičky po PASS (model kontrolora) → deliver hlavičku nesestaví znovu, odejde soubor beze změny", async () => {
    const { o, ord, checker } = await toDelivered();
    const body = store.readFile(ORDER_ID, "final-body-r0.md");
    checker.model = "kontrolor-2";
    const done = await o.step(ord);
    expect(done.state).toBe("DONE");
    expect(notion.pages()[0].md).toBe(body);
    expect(notion.pages()[0].md).not.toContain("kontrolor-2");
  });

  it("test 8: přepsaný soubor finálního těla po PASS → HOLD BODY_MISMATCH, 0 stránek", async () => {
    const { o, ord } = await toDelivered();
    fs.writeFileSync(
      path.join(dir, ORDER_ID, "final-body-r0.md"),
      "# podvržený text\n" + DRAFT,
    );
    const held = await o.step(ord);
    expect(held.state).toBe("UNKNOWN");
    expect(JSON.stringify(held)).toMatch(/BODY_MISMATCH/);
    expect(notion.pages()).toHaveLength(0);
    expect(notion.creates).toBe(0);
  });

  it("FIX1 nález 5 (TOCTOU): soubor vyměněn mezi ověřením a odesláním → odejde přesně ověřený buffer, soubor se čte jednou", async () => {
    const { ord } = await toDelivered();
    const body = store.readFile(ORDER_ID, "final-body-r0.md");
    const f = path.join(dir, ORDER_ID, "final-body-r0.md");
    let reads = 0;
    const swapping = Object.create(store) as Store;
    swapping.readFile = (id: string, name: string) => {
      const t = store.readFile(id, name);
      if (name === "final-body-r0.md" && ++reads === 1)
        fs.writeFileSync(f, "# podvržený text po ověření\n" + DRAFT);
      return t;
    };
    const dept = new CopyDepartment(
      new FakeAdapter("gpt", "c", () => DRAFT),
      new FakeAdapter("claude", "k", () => PASS),
    );
    const out = await dept.deliver(ord, {
      store: swapping,
      notion,
      draftParentId: PARENT,
    } as never);
    expect(out.ok).toBe(true);
    expect(reads).toBe(1);
    expect(out.content).toBe(body);
    expect(notion.pages()).toHaveLength(1);
    expect(notion.pages()[0].md).toBe(body);
    expect(notion.pages()[0].md).not.toContain("podvržený");
  });

  it("receipt platí jen přes odkaz ze stavu: podvržený soubor v reviews/ ani špatný sha256 se nepřijmou", async () => {
    const { ord } = await toDelivered();
    const od = store.orderDir(ORDER_ID);
    const fake = {
      ...readReviewReceipt(od, {
        review_id: ord.meta.review_receipt_id,
        sha256: ord.meta.review_receipt_sha256,
      })!,
      review_id: "f".repeat(64),
    };
    fs.writeFileSync(
      path.join(od, "reviews", `${"f".repeat(64)}.json`),
      JSON.stringify(fake),
    );
    expect(
      readReviewReceipt(od, {
        review_id: "f".repeat(64),
        sha256: sha256("jiné"),
      }),
    ).toBeUndefined();
    expect(
      readReviewReceipt(od, {
        review_id: ord.meta.review_receipt_id,
        sha256: "0".repeat(64),
      }),
    ).toBeUndefined();
  });

  it("revize: nové kolo = nový soubor final-body-r1.md, starý se nepřepisuje", async () => {
    let n = 0;
    const creator = new FakeAdapter("gpt", "c", () =>
      n++ === 0 ? DRAFT : `${DRAFT}\n\n## Oprava\nDoplněno.`,
    );
    let checks = 0;
    const checker = new FakeAdapter("claude", "k", (): string =>
      ++checks === 1 ? FIX("zkrátit") : PASS,
    );
    const o = orch(new CopyDepartment(creator, checker));
    let ord = await o.step(seed("DOING"));
    ord = await o.step(ord);
    expect(ord.state).toBe("FIXING");
    const r0 = store.readFile(ORDER_ID, "final-body-r0.md");
    ord = await o.step(ord);
    expect(ord.meta.final_body_file).toBe("final-body-r1.md");
    expect(store.readFile(ORDER_ID, "final-body-r0.md")).toBe(r0);
    expect(store.readFile(ORDER_ID, "final-body-r1.md")).toContain(
      "Kol oprav: 1",
    );
  });

  it.todo(
    "test 9: nesouhlasný render Notionu → HOLD READBACK_MISMATCH (vyžaduje readbackBlocker PR 2 / bránu PR 5, mimo rozsah 4a)",
  );
});

// ───────────────────────────── §6.2.2 dev: pokrytí celého diffu (N08) ─────────────────────────────

describe("§6.2.2 vícedílné review dev (N08)", () => {
  it("planDiffChunks: souvislé pokrytí po souborech, velký soubor po huncích, přes limit / přes MAX_CHUNKS = DIFF_TOO_LARGE", () => {
    const file = (name: string, hunks: string[]) =>
      `diff --git a/${name} b/${name}\n--- a/${name}\n+++ b/${name}\n${hunks.map((h, i) => `@@ -${i},1 +${i},1 @@\n${h}\n`).join("")}`;
    const diff =
      file("a.ts", ["+" + "a".repeat(50)]) +
      file("b.ts", ["+" + "b".repeat(50), "+" + "c".repeat(50)]);
    const p = planDiffChunks(diff, 120, 4);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.chunks[0].start).toBe(0);
    expect(p.chunks.at(-1)!.end).toBe(diff.length);
    for (let i = 1; i < p.chunks.length; i++)
      expect(p.chunks[i].start).toBe(p.chunks[i - 1].end);
    expect(p.chunks.map((c) => c.text).join("")).toBe(diff);
    expect(p.chunks.every((c) => c.text.length <= 120)).toBe(true);
    expect(
      planDiffChunks(file("x.ts", ["+" + "x".repeat(500)]), 120, 4),
    ).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/DIFF_TOO_LARGE: hunk/),
    });
    expect(planDiffChunks(diff, 120, 1)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/DIFF_TOO_LARGE: \d+ částí > MAX_CHUNKS 1/),
    });
  });

  it("agregace: PASS jen když všechny části PASS; BLOCK > FIX; nečitelná část = chyba", () => {
    expect(aggregateVerdict(["PASS", "PASS"])).toBe("PASS");
    expect(aggregateVerdict(["PASS", "FIX"])).toBe("FIX");
    expect(aggregateVerdict(["FIX", "BLOCK"])).toBe("BLOCK");
    expect(aggregateVerdict(["PASS", undefined])).toBeUndefined();
    expect(aggregateVerdict([])).toBeUndefined();
  });

  it("test 10: kritická změna za znakem 150 000 → 2 části, část 2 nese značku, celkem FIX, 0 PASS, 0 push, 0 PR", async () => {
    const big =
      Array.from(
        { length: 2200 }, // jeden hunk ~138 000 znaků (< CHUNK_LIMIT), b.txt ~34 000 → značka za znakem 150 000
        (_, i) => `řádek ${i} ${"x".repeat(50)}`,
      ).join("\n") + "\n";
    const tail =
      Array.from({ length: 500 }, (_, i) => `ok ${i} ${"y".repeat(60)}`).join(
        "\n",
      ) + "\nCRITICAL-PROBE\n";
    const { bare } = devRepo({ "a.txt": big, "b.txt": tail });
    const bins = fakeBin();
    const reviewer = new FakeAdapter("gpt", "codex", (p) =>
      p.includes("CRITICAL-PROBE") ? FIX("kritická změna") : PASS,
    );
    const dev = new DevDepartment(
      fakeChain(async () => ({
        ok: true,
        limit: false,
        text: "",
        status: "PASS",
        duration_ms: 0,
      })) as never,
      reviewer,
    );
    const r = await dev.check(devOrder(), {
      store,
      notion,
      draftParentId: PARENT,
      repoRoot: dir,
    });
    expect(reviewer.calls).toBe(2);
    const marker = reviewer.prompts.map((p) => p.includes("CRITICAL-PROBE"));
    expect(marker).toEqual([false, true]);
    expect(r.verdict).toBe("FIX");
    expect(r.issues).toEqual(["část 2/2: kritická změna"]);
    const rc = readReviewReceipt(
      store.orderDir(ORDER_ID),
      r.review_receipt!,
    )! as ReviewReceipt;
    expect(rc.full_diff_chars).toBeGreaterThan(150_000);
    expect(rc.chunks![1].start).toBeLessThanOrEqual(150_000);
    expect(rc.chunks!.map((c) => c.verdict)).toEqual(["PASS", "FIX"]);
    expect(rc).toMatchObject({
      verdict: "FIX",
      coverage: "full",
      reviewed_artifact_kind: "git",
    });
    const diff =
      git(
        path.join(process.env.TARS_WORKTREES!, ORDER_ID),
        "diff",
        `${rc.reviewed_base_oid}..${rc.reviewed_git_commit_oid}`,
      ) + "\n";
    expect(coverageProblem(rc, diff)).toBeUndefined();
    // Mezera v pokrytí (podvržený receipt s jednou částí) je poznat; bránu z toho dělá až PR 4b.
    expect(
      coverageProblem({ ...rc, chunks: rc.chunks!.slice(0, 1) }, diff),
    ).toMatch(/poslední část/);
    expect(git(bare, "for-each-ref", "--format=%(refname)")).toBe(
      "refs/heads/main",
    );
    expect(bins.git().filter((l) => /\bpush\b/.test(l))).toEqual([]);
    expect(bins.gh()).toEqual([]);
  });

  it("test 12: hunk delší než limit, nebo víc než MAX_CHUNKS částí → HOLD DIFF_TOO_LARGE, 0 volání kontrolora", async () => {
    devRepo({
      "a.txt": "a".repeat(5000) + "\n",
      "b.txt": "b\n",
      "c.txt": "c\n",
    });
    const reviewer = new FakeAdapter("gpt", "codex", () => PASS);
    const chain = fakeChain(async () => ({
      ok: true,
      limit: false,
      text: "",
      status: "PASS",
      duration_ms: 0,
    }));
    const ctx = { store, notion, draftParentId: PARENT, repoRoot: dir };
    const r1 = await new DevDepartment(chain as never, reviewer, undefined, {
      chunkLimit: 1000,
      maxChunks: 4,
    }).check(devOrder(), ctx);
    expect(r1).toMatchObject({
      ok: false,
      hold: expect.stringMatching(/^DIFF_TOO_LARGE: hunk v a\.txt/),
    });
    const r2 = await new DevDepartment(chain as never, reviewer, undefined, {
      chunkLimit: 5300,
      maxChunks: 1,
    }).check(devOrder(), ctx);
    expect(r2).toMatchObject({
      ok: false,
      hold: expect.stringMatching(/^DIFF_TOO_LARGE: 2 částí > MAX_CHUNKS 1/),
    });
    expect(reviewer.calls).toBe(0);
    // V orchestrátoru je to HOLD (UNKNOWN), ne FIX ani PASS.
    const o = orch(
      new DevDepartment(chain as never, reviewer, undefined, {
        chunkLimit: 1000,
        maxChunks: 4,
      }),
    );
    seed("CHECKING", {
      brief: { ...effOrder().brief!, department: "copy" },
      draft_file: "wt",
      meta: { chain_status: "PASS" },
    });
    const held = await o.step(store.load(ORDER_ID));
    expect(held.state).toBe("UNKNOWN");
    expect(reviewer.calls).toBe(0);
  });

  it("malý diff: jedna část, receipt git s HEAD, bází a úplným pokrytím; reference ve stavu po verdiktu", async () => {
    const { head } = devRepo({ "a.txt": "a\n" });
    const reviewer = new FakeAdapter("gpt", "codex", () => PASS);
    const o = orch(
      new DevDepartment(
        fakeChain(async () => ({
          ok: true,
          limit: false,
          text: "",
          status: "PASS",
          duration_ms: 0,
        })) as never,
        reviewer,
      ),
    );
    seed("CHECKING", { draft_file: "wt", meta: { chain_status: "PASS" } });
    const next = await o.step(store.load(ORDER_ID));
    expect(next.state).toBe("DELIVERED");
    const rc = readReviewReceipt(store.orderDir(ORDER_ID), {
      review_id: next.meta.review_receipt_id,
      sha256: next.meta.review_receipt_sha256,
    })!;
    expect(rc).toMatchObject({
      verdict: "PASS",
      reviewed_git_commit_oid: head,
      coverage: "full",
      reviewer_family: "gpt",
    });
    expect(rc.chunks).toHaveLength(1);
    expect(J().get(rc.chunks![0].invocation_id!)!.phase).toBe("FINISHED");
  });
});

// ───────────────────────────── CI 4a (2): statický test hranic ─────────────────────────────

/** Git blob OID souboru (stejné jako `git ls-files -s`), bez gitu: funguje i v mělkém checkoutu CI. */
function blobOid(file: string): string {
  const b = fs.readFileSync(file);
  return createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b]))
    .digest("hex");
}

function walk(d: string): string[] {
  return fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
    );
}

describe("CI 4a (2): statická hranice třídy A", () => {
  // Otisky z main @ c965265. Změna kteréhokoli z těchto souborů je třída B (DR-024): aktualizace otisků patří do PR
  // třídy B s GO vlastníka (např. PR 4b), nikdy do PR třídy A.
  const PINNED: Record<string, string> = {
    ".claude/settings.json": "e6cfbd7921b657d969f3dc68118dd69477853c3c",
    ".claude/hooks/block-redundant-reads.py":
      "9e859127843a1eb557a8c7877304a351dac8a0b0",
    ".claude/hooks/evidence-completeness.py":
      "a40e019dcc04c45f5b5b02284f62df24b94a4dde",
    ".claude/hooks/format-javascript-files.sh":
      "ab748bbd381e60a0eb6ddaa836c494549ac25bbe",
    ".claude/hooks/format-python-files.sh":
      "0d9597e1f51525abbf69dffd3b367c2d055151db",
    ".claude/hooks/mission-capsule-start.sh":
      "9545d406f7b67ebdccb7d85a0b1ad6cdc6806a9f",
    ".claude/hooks/secret-scan.py": "14f9686904c06585c7b3b38049c6d5c1ceb823b5",
    ".claude/hooks/tars-guard.sh": "2e632862a1c28b6f00467e745212444c148820ba",
    "tars/guard/README.md": "a2a4bf7ff694f7677ccbf421fcc251004cf21b38",
    "tars/guard/__tests__/bash-preflight.test.ts":
      "9be559c932705f7bc65ea9acda8df5b6c8c95d69",
    "tars/guard/__tests__/fail-closed-settings.test.ts":
      "17cda99b5b669a07856fd280889bba9e869d5555",
    "tars/guard/__tests__/fail-closed.test.ts":
      "c135aa6f84ea3d57d914b320f6ff64a537468095",
    "tars/guard/__tests__/notion-owner-decision.test.ts":
      "d9b423cf438b15211752707c82c295b66703648e",
    "tars/guard/bash-preflight.allow":
      "d781df9f951f522ddab578d967d16347639f47ec",
    "tars/guard/bash-preflight.py": "da8f7e9950d21e5aed42bbd9f6567c1255c6d91b",
    "tars/guard/bash-preflight.sh": "4e3875a6249b02075ecc43241d6273dc98e1f11d",
    "tars/guard/notion-owner-decision.py":
      "85c67e1ab956b0c6966227b83a44daf941b54e11",
  };

  it(".claude/settings.json, tars/guard/ a .claude/hooks/ beze změny (žádný soubor navíc ani méně)", () => {
    const present = [
      ".claude/settings.json",
      ...walk(path.join(ROOT, ".claude/hooks")),
      ...walk(path.join(ROOT, "tars/guard")),
    ]
      .map((f) => path.relative(ROOT, path.resolve(ROOT, f)))
      .filter((f) => !f.includes("__pycache__"))
      .sort();
    expect(present).toEqual(Object.keys(PINNED).sort());
    for (const [f, oid] of Object.entries(PINNED))
      expect([f, blobOid(path.join(ROOT, f))]).toEqual([f, oid]);
  });

  it("STRIP_ENV beze změny (credentials dítěte mění jen PR 4b)", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "tars/orch/adapters.ts"),
      "utf8",
    );
    const m = /const STRIP_ENV = \[([\s\S]*?)\];/.exec(src)!;
    expect(m[1].match(/"[^"]+"/g)).toEqual([
      '"NOTION_TOKEN"',
      '"ANTHROPIC_API_KEY"',
      '"ANTHROPIC_AUTH_TOKEN"',
      '"OPENAI_API_KEY"',
      '"CLAUDE_CODE_USE_BEDROCK"',
      '"CLAUDE_CODE_USE_VERTEX"',
    ]);
  });

  it("žádné nové ani změněné volání git push, gh pr, gh workflow, gh api v kódu TARS", () => {
    const files = walk(path.join(ROOT, "tars")).filter(
      (f) =>
        /\.(ts|js|mjs|cjs|sh|py)$/.test(f) &&
        !f.includes(`${path.sep}__tests__${path.sep}`),
    );
    const hits: string[] = [];
    for (const f of files) {
      for (const line of fs.readFileSync(f, "utf8").split("\n")) {
        const l = line.trim();
        if (l.startsWith("//") || l.startsWith("*") || l.startsWith("#"))
          continue;
        // JS/TS: spuštění `gh` (spawn*, execFile*, runProcess), argument "push" (git(…, ["push", …])), exec řetězce.
        // Shell/Python: příkaz `gh pr|workflow|api` nebo `git push`.
        const js = /\.(ts|js|mjs|cjs)$/.test(f);
        const call = js
          ? /\b(spawn|spawnSync|execFile|execFileSync|runProcess)\(\s*["'`]gh["'`]/.test(
              l,
            ) ||
            /\[\s*["'`]push["'`]/.test(l) ||
            /\b(execSync|execFileSync)\(|child_process["'`]?\)?\.exec\(/.test(l)
          : /\bgh\s+(pr|workflow|api)\b|\bgit\s+push\b/.test(l);
        if (call) hits.push(`${path.relative(ROOT, f)}: ${l}`);
      }
    }
    // Stav na main @ c965265: tři čtení/zápisy přes `gh pr`, jeden `git push` v DevDepartment.deliver a dvě čtení
    // `gh api` v návrhu guardu. PR 4a nic nepřidává ani nemění.
    expect(hits.sort()).toEqual(
      [
        'tars/orch/departments.ts: const push = git(wt, ["push", "-q", "-u", "origin", branch]);',
        'tars/orch/departments.ts: const r = spawnSync("gh", ["pr", "create", "--draft", "--base", "main", "--head", branch, "--title", `feat(tars): ${order.brief!.title}`, "--body", body], {',
        'tars/orch/departments.ts: const r = spawnSync("gh", ["pr", "list", "--head", branch, "--state", "all", "--limit", "50", "--json", "url,body"], { encoding: "utf8", timeout: 60_000 });',
        'tars/orch/departments.ts: const r = spawnSync("gh", ["pr", "view", order.delivered_url, "--json", "headRefOid", "--jq", ".headRefOid"], { encoding: "utf8", timeout: 60_000 });',
        'tars/orch/guard/tars-guard.proposed.sh: pr=$(gh api "repos/$slug/branches/main/protection" 2>&1)',
        'tars/orch/guard/tars-guard.proposed.sh: rules=$(gh api "repos/$slug/rules/branches/main" --jq \'[.[].type]|join(",")\' 2>/dev/null); rc=$?',
        // obecný execFileSync (čtení tokenu Notion, main), ne gh ani git
        'tars/orch/notion-token.ts: execFileSync(file, [...args], { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "ignore"] });',
      ].sort(),
    );
  });
});
