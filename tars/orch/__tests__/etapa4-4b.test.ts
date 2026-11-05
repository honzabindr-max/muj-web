// Etapa 4, PR 4b (NAVRH-v6 §8.1, §8.2, §6.2.2 bod 6, §6.2.3, §14 řádek 4b; třída B): bezpečnostní hranice dítěte,
// snímky vzdálených zápisů, brána review receiptu před gh-push a gh-draft-pr. Plus bod 1: známé riziko z PR 4a
// (Codex PR 4a kolo 5, nálezy 1 a 2): varování limitu + ENOSPC nesmí po restartu ani po HOLD → UNKNOWN pustit novou
// zakázku. Žádná síť, žádný skutečný push na GitHub: origin je lokální bare repo, `gh` je falešné nebo bez přihlášení.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ClaudeCli,
  childEnv,
  noRemoteWriteEnv,
  PUSH_BLOCKED_URL,
  type TextAdapter,
} from "../adapters";
import {
  AttemptJournal,
  sha256,
  type ProcInfo,
  type ProcessProbe,
} from "../attempts";
import {
  CopyDepartment,
  DevDepartment,
  PushJournal,
  type DepartmentRunner,
  type DeptContext,
} from "../departments";
import {
  LIMIT_GUARD_DIR,
  LimitGuard,
  reportLimitWarning,
  runWithLimitSink,
  type LimitNote,
} from "../limit-guard";
import { Orchestrator } from "../orchestrator";
import {
  headsSha256,
  parseLsRemote,
  unjournaledWrites,
  type RemoteProbe,
  type RemoteSnapshot,
} from "../remote-snapshot";
import { reviewId, writeReviewReceipt } from "../reviews";
import { transition } from "../state-machine";
import { Store } from "../store";
import type { ModelFamily, Order } from "../types";
import {
  DRAFT,
  effOrder,
  FileNotion,
  NOW,
  ORDER_ID,
  PARENT,
} from "./effects-fixture";

const WARN6 = "Approaching usage limit · resets in 6 days";
const DAY = 86_400_000;
const UNTIL6 = Date.parse(NOW) + 6 * DAY + 60_000;

let dir: string;
let store: Store;
let notion: FileNotion;
const cleanup: Array<() => void> = [];
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-4b-"));
  store = new Store(dir);
  notion = new FileNotion(path.join(dir, "notion.jsonl"));
});
afterEach(() => {
  vi.restoreAllMocks();
  while (cleanup.length) cleanup.pop()!();
});

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

class FakeProbe implements ProcessProbe {
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
  kill() {
    return true;
  }
  async sleep() {}
}

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

const guardFor = (d: string) =>
  new LimitGuard(d, {
    now: () => new Date(NOW),
    untilOf: () => ({ until: NOW, reset_source: "test" }),
    pauseMs: 0,
  });

const guardFiles = (re: RegExp) => {
  const d = path.join(dir, LIMIT_GUARD_DIR);
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => re.test(f)) : [];
};
const pendingFiles = () => guardFiles(/\.pending\.json$/);
const warningFiles = () => guardFiles(/\.w-[0-9a-f]{16}\.json$/);

const enospc = () =>
  Object.assign(new Error("ENOSPC: no space left on device, write"), {
    code: "ENOSPC",
  });

/** Tvůrce copy, který vrátí doložené varování CLI o limitu (resets in 6 days). */
function warnCreator(): TextAdapter & { calls: number } {
  const a = {
    name: "fake",
    model: "c",
    family: "gpt" as const,
    calls: 0,
    run: async () => {
      a.calls++;
      return {
        ok: true,
        text: DRAFT,
        limit: false,
        duration_ms: 0,
        limit_warning: WARN6,
        limit_source: "claude",
        received_at: NOW,
      };
    },
  };
  return a;
}

function gitRaw(cwd: string, ...args: string[]): string {
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
    { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}
const git = (cwd: string, ...args: string[]) => gitRaw(cwd, ...args).trim();

/** Lokální bare repo jako origin + worktree zakázky (větev tars/<id>) s jedním commitem práce. */
function devRepo(files: Record<string, string>) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "tars-4b-git-"));
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
  const wt = path.join(wtRoot, ORDER_ID);
  git(base, "clone", "-q", bare, wt);
  git(wt, "checkout", "-q", "-b", `tars/${ORDER_ID}`);
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
  return { base, bare, seedDir, wt, head: git(wt, "rev-parse", "HEAD") };
}

/** Falešné `gh` a logující `git` na PATH. */
function fakeBin(ghScript = 'echo "$@" >> "$GH_LOG"; exit 1') {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "tars-4b-bin-"));
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
    {
      mode: 0o755,
    },
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

/** gh: `pr create` vrátí URL, `pr view` vrátí HEAD worktree, ostatní selže. Každé volání se zaloguje. */
const ghScript = (wt: string) =>
  `echo "$@" >> "$GH_LOG"\ncase "$1 $2" in\n  "pr create") echo https://github.com/o/r/pull/9 ;;\n  "pr view") git -C "${wt}" rev-parse HEAD ;;\n  *) exit 1 ;;\nesac`;

type ChainResult = {
  ok: boolean;
  limit: boolean;
  text: string;
  status: string;
  error?: string;
  duration_ms: number;
};
function fakeChain(run: () => Promise<ChainResult>) {
  const c = {
    family: "claude" as const,
    name: "ai-chain",
    model: "fake-chain",
    runSh: "/nonexistent/run.sh",
    calls: 0,
    envs: [] as Array<Record<string, string> | undefined>,
    run: async (
      _z: string,
      _wt: string,
      _cwd: string,
      _t?: number,
      env?: Record<string, string>,
    ) => {
      c.calls++;
      c.envs.push(env);
      return run();
    },
  };
  return c;
}
const okChain = () =>
  fakeChain(async () => ({
    ok: true,
    limit: false,
    text: "",
    status: "PASS",
    duration_ms: 0,
  }));

type Pr = { number: number; headRefName: string; url: string };

/** Sonda §8.2 nad lokálním bare repem (skutečné `git ls-remote`), PR a běhy z testu. */
function bareProbe(
  bare: string,
  extra: {
    prs?: () => Pr[];
    fail?: () => string | undefined;
  } = {},
): RemoteProbe & { calls: number } {
  const p = {
    calls: 0,
    snapshot(_repo: string, since: string): RemoteSnapshot {
      p.calls++;
      const why = extra.fail?.();
      if (why) return { ok: false, at: NOW, since, error: why };
      const heads = parseLsRemote(
        spawnSync("git", ["ls-remote", "--heads", bare], { encoding: "utf8" })
          .stdout,
      );
      return {
        ok: true,
        at: NOW,
        since,
        heads,
        heads_sha256: headsSha256(heads),
        prs: extra.prs?.() ?? [],
        runs: [],
      };
    },
  };
  return p;
}

const devCtx = (probe?: RemoteProbe): DeptContext => ({
  store,
  notion,
  draftParentId: PARENT,
  repoRoot: dir,
  attempts: J(),
  ...(probe ? { remoteProbe: probe } : {}),
});

// ───────────────────────────── bod 1: známé riziko z PR 4a ─────────────────────────────

describe("bod 1: varování limitu + ENOSPC (Codex PR 4a kolo 5)", () => {
  const supervisorSpy = () => {
    const run = vi.fn(async () => ({
      ok: true,
      text: "",
      limit: false,
      duration_ms: 0,
    }));
    return {
      run,
      adapter: { name: "s", model: "s", family: "claude" as const, run },
    };
  };
  const dept = (c: TextAdapter) =>
    new CopyDepartment(c, new FakeAdapter("claude", "k", () => PASS));

  it("nález 1: záznam varování, souhrn i journal selžou (ENOSPC) → sentinel zůstane; po restartu, po RETRY_SAFE ani po 30 dnech žádná nová zakázka ani krok, dokud vlastník neověří", async () => {
    const creator = warnCreator();
    const sup = supervisorSpy();
    const rec = vi
      .spyOn(LimitGuard.prototype, "record")
      .mockImplementation(() => {
        throw enospc();
      });
    const wr = vi.spyOn(store, "writeRunsFile").mockImplementation(() => {
      throw enospc();
    });
    const hold = vi
      .spyOn(AttemptJournal.prototype, "holdAttempt")
      .mockImplementation(() => {
        throw enospc();
      });
    const o = orch(dept(creator), {
      processProbe: new FakeProbe([[]]),
      supervisor: sup.adapter,
    });
    const s1 = await o.step(seed("DOING"));
    expect(s1.state).toBe("UNKNOWN");
    expect(creator.calls).toBe(1);
    expect(pendingFiles()).toHaveLength(1);
    expect(warningFiles()).toEqual([]);
    expect(store.readRunsFile("limit-warning.json")).toBeUndefined();
    // tentýž běh: globální HOLD (paměť i sentinel), žádná nová zakázka
    expect(await o.tick()).toMatchObject({ status: "limit_hold" });
    expect(sup.run).not.toHaveBeenCalled();

    // restart po uvolnění místa, o 30 dní později (žádné vypršení blokace)
    rec.mockRestore();
    wr.mockRestore();
    hold.mockRestore();
    const later = () => new Date(Date.parse(NOW) + 30 * DAY);
    const o2 = orch(dept(creator), {
      processProbe: new FakeProbe([[]]),
      supervisor: sup.adapter,
      now: later,
    });
    const t1 = await o2.tick();
    expect(t1).toMatchObject({ status: "limit_hold" });
    expect((t1 as { reason: string }).reason).toMatch(
      /varování limitu nešlo uložit nebo neověřeno/,
    );
    expect(sup.run).not.toHaveBeenCalled();
    // větev obnovy RETRY_SAFE (zakázka znovu rozpracovaná): krok se nespustí
    store.save({ ...store.load(ORDER_ID), state: "DOING" });
    expect(await o2.tick()).toMatchObject({ status: "limit_hold" });
    const s2 = await o2.step(store.load(ORDER_ID));
    expect(s2.state).toBe("DOING");
    expect(creator.calls).toBe(1);
    expect(sup.run).not.toHaveBeenCalled();

    // ruční ověření vlastníkem (cli.ts owner limit-hold OVERENO) → teprve teď další krok
    expect(guardFor(dir).verifyAll()).toBe(1);
    expect(pendingFiles()).toEqual([]);
    expect(guardFiles(/\.verified-.*\.json$/)).toHaveLength(1);
    const t3 = await o2.tick();
    expect(t3.status).not.toBe("limit_hold");
    expect(creator.calls).toBe(2);
  });

  it("nález 2: po restartu selže ps → reconciler HOLD → UNKNOWN; další ticky nezačnou novou zakázku (sentinel z pádu)", async () => {
    const creator = warnCreator();
    const sup = supervisorSpy();
    // Stav po pádu: proces vrátil varování, zápisy selhaly (ENOSPC), orchestrátor spadl. Na disku zůstal pokus STARTED
    // a sentinel, který vznikl před spawn.
    const j = J();
    const r = j.intent(ORDER_ID, "create-r0", {
      input_sha256: "x",
      deadline: "2026-11-04T13:00:00.000Z",
      decision_check: "t",
    });
    j.started(r.attempt_id, {
      pid: 4242,
      pgid: 4242,
      lstart: "x",
      cmd: "claude",
      at: NOW,
    });
    guardFor(dir).open(r.attempt_id);
    const ps = new FakeProbe([undefined]); // ps selhal
    const o = orch(dept(creator), {
      processProbe: ps,
      supervisor: sup.adapter,
    });
    const s = await o.step(seed("DOING"));
    expect(s.state).toBe("UNKNOWN");
    expect(J().get(r.attempt_id)!.phase).toBe("HOLD");
    expect(await o.tick()).toMatchObject({ status: "limit_hold" });
    const o2 = orch(dept(creator), {
      processProbe: ps,
      supervisor: sup.adapter,
    });
    expect(await o2.tick()).toMatchObject({ status: "limit_hold" });
    expect(sup.run).not.toHaveBeenCalled();
    expect(creator.calls).toBe(0);
  });

  it("varování se uloží jako první věc po návratu procesu (sink), dřív než oddělení zapíše draft; ENOSPC draftu ho neztratí", async () => {
    let seenInsideRun: string[] = [];
    const creator = {
      name: "fake",
      model: "c",
      family: "gpt" as const,
      calls: 0,
      run: async () => {
        creator.calls++;
        reportLimitWarning({
          source: "claude",
          text: WARN6,
          received_at: NOW,
          model: "c",
        });
        seenInsideRun = warningFiles();
        return {
          ok: true,
          text: DRAFT,
          limit: false,
          duration_ms: 0,
          limit_warning: WARN6,
          limit_source: "claude",
          received_at: NOW,
        };
      },
    };
    const realWrite = store.writeFile.bind(store);
    vi.spyOn(store, "writeFile").mockImplementation(
      (id: string, name: string, text: string) => {
        if (name === "draft-v0.md") throw enospc();
        return realWrite(id, name, text);
      },
    );
    const o = orch(dept(creator));
    await expect(o.step(seed("DOING"))).rejects.toThrow(/ENOSPC/);
    expect(seenInsideRun).toHaveLength(1); // záznam existoval ještě před návratem do oddělení
    expect(pendingFiles()).toEqual([]);
    const w = JSON.parse(
      fs.readFileSync(
        path.join(dir, LIMIT_GUARD_DIR, warningFiles()[0]),
        "utf8",
      ),
    ) as { until: string; source: string; excerpt: string; key: string };
    expect(w).toMatchObject({
      source: "claude",
      excerpt: WARN6,
      key: `${ORDER_ID}/create-r0/a1`,
    });
    expect(Date.parse(w.until)).toBe(UNTIL6);
    // doložené varování: blokace nové zakázky do resetu + 1 min (Q4-B), ne globální HOLD
    store.save({ ...store.load(ORDER_ID), state: "UNKNOWN" });
    expect(await o.tick()).toEqual({
      status: "limit_warning",
      until: new Date(UNTIL6).toISOString(),
    });
  });

  it("sentinel nejde vytvořit (disk plný už před voláním) → volání modelu neproběhne, HOLD", async () => {
    const creator = warnCreator();
    vi.spyOn(LimitGuard.prototype, "open").mockImplementation(() => {
      throw enospc();
    });
    const s = await orch(dept(creator)).step(seed("DOING"));
    expect(s.state).toBe("UNKNOWN");
    expect(creator.calls).toBe(0);
    expect(J().list(ORDER_ID, "create-r0")[0].hold?.reason).toMatch(
      /sentinel varování limitu nejde zapsat/,
    );
  });

  it("varování mimo hlídanou cestu a souhrn nejde zapsat → blokace v paměti hned, sentinel na disku při nejbližší možnosti (i pro další proces)", async () => {
    vi.spyOn(store, "holdsLease").mockReturnValue(true);
    const wr = vi.spyOn(store, "writeRunsFile").mockImplementation(() => {
      throw enospc();
    });
    const op = vi
      .spyOn(LimitGuard.prototype, "open")
      .mockImplementationOnce(() => {
        throw enospc();
      });
    const o = orch(dept(warnCreator()));
    (
      o as unknown as {
        noteLimitWarning(o: Order, r: object, role: string): void;
      }
    ).noteLimitWarning(
      seed("UNKNOWN"),
      {
        ok: true,
        limit_warnings: [{ source: "claude", text: WARN6, received_at: NOW }],
      },
      "creator",
    );
    expect(pendingFiles()).toEqual([]); // zápis sentinelu selhal, drží paměť
    wr.mockRestore();
    op.mockRestore();
    expect(await o.tick()).toMatchObject({ status: "limit_hold" });
    expect(pendingFiles()).toHaveLength(1); // nejbližší možnost: zapsáno
    expect(await orch(dept(warnCreator())).tick()).toMatchObject({
      status: "limit_hold",
    });
  });

  it.runIf(process.platform === "darwin")(
    "ClaudeCli předá varování do sinku hned po rozboru stderr, před návratem výsledku (skutečný proces)",
    async () => {
      const bin = fs.mkdtempSync(path.join(os.tmpdir(), "tars-4b-claude-"));
      fs.writeFileSync(
        path.join(bin, "claude"),
        `#!/bin/sh\ncat >/dev/null\necho '${WARN6}' >&2\necho '{"result":"hotovo","is_error":false}'\n`,
        { mode: 0o755 },
      );
      const old = process.env.PATH;
      process.env.PATH = `${bin}:${old}`;
      cleanup.push(() => {
        process.env.PATH = old;
      });
      const notes: LimitNote[] = [];
      const r = await runWithLimitSink(
        (n) => notes.push(n),
        () => new ClaudeCli("opus").run("prompt", { cwd: bin }),
      );
      expect(r.ok).toBe(true);
      expect(notes).toHaveLength(1);
      expect(notes[0]).toMatchObject({
        source: "claude",
        model: "opus",
        received_at: r.received_at,
      });
      expect(notes[0].text).toBe(r.limit_warning);
    },
  );
});

// ───────────────────────────── §8.1 hranice práv dítěte (N03 testy 1–2) ─────────────────────────────

const hasGh =
  spawnSync("sh", ["-c", "command -v gh"], { encoding: "utf8" }).status === 0;

describe("§8.1 noRemoteWriteEnv (N03)", () => {
  it("childEnv: žádný token GitHubu ani GIT_CONFIG_*/GH_CONFIG_DIR orchestrátoru se do dítěte nedědí", () => {
    const keys = [
      "GH_TOKEN",
      "GITHUB_TOKEN",
      "GH_ENTERPRISE_TOKEN",
      "GIT_CONFIG_COUNT",
      "GIT_CONFIG_KEY_0",
      "GIT_CONFIG_VALUE_0",
      "GH_CONFIG_DIR",
    ];
    const old = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    cleanup.push(() => {
      for (const k of keys) {
        if (old[k] === undefined) delete process.env[k];
        else process.env[k] = old[k];
      }
    });
    for (const k of keys) process.env[k] = "tajne-x";
    const env = childEnv();
    for (const k of keys) expect(env[k]).toBeUndefined();
  });

  it("noRemoteWriteEnv: prázdná složka gh 0700, vynulované credential helpery, push na neexistující cíl", () => {
    const d = path.join(dir, "attempts", "create-r0-a1.gh-empty");
    const env = noRemoteWriteEnv(d);
    expect(fs.statSync(d).mode & 0o777).toBe(0o700);
    expect(fs.readdirSync(d)).toEqual([]);
    expect(env).toMatchObject({
      GH_CONFIG_DIR: d,
      GIT_CONFIG_COUNT: "3",
      GIT_CONFIG_KEY_0: "credential.helper",
      GIT_CONFIG_VALUE_0: "",
      GIT_CONFIG_KEY_1: "credential.https://github.com.helper",
      GIT_CONFIG_VALUE_1: "",
      GIT_CONFIG_KEY_2: "remote.origin.pushurl",
      GIT_CONFIG_VALUE_2: PUSH_BLOCKED_URL,
      GIT_TERMINAL_PROMPT: "0",
      GIT_ASKPASS: "/usr/bin/false",
      SSH_ASKPASS: "/usr/bin/false",
    });
  });

  it("N03 test 1: push z dítěte s noRemoteWriteEnv selže přímo i přes node -e; bare repo beze změny (kontrola: bez hranice push projde)", () => {
    const { bare, wt } = devRepo({ "a.txt": "a\n" });
    const nonce = `${process.pid}-${Date.now()}`;
    const env = {
      ...childEnv(),
      ...noRemoteWriteEnv(path.join(dir, "gh-empty")),
    };
    const refs = () => git(bare, "for-each-ref", "--format=%(refname)");
    const before = refs();
    const direct = spawnSync(
      "git",
      ["push", "origin", `HEAD:refs/heads/tars/probe-${nonce}`],
      { cwd: wt, env, encoding: "utf8" },
    );
    expect(direct.status).not.toBe(0);
    const viaNode = spawnSync(
      process.execPath,
      [
        "-e",
        `require('child_process').execSync('git push origin HEAD:refs/heads/tars/probe-node-${nonce}', {stdio: 'pipe'})`,
      ],
      { cwd: wt, env, encoding: "utf8" },
    );
    expect(viaNode.status).not.toBe(0);
    expect(refs()).toBe(before);
    expect(
      git(bare, "ls-remote", "--heads", bare, `refs/heads/tars/probe-${nonce}`),
    ).toBe("");
    // kontrola fixture: stejný push bez hranice §8.1 projde (test měří hranici, ne rozbité repo)
    const control = spawnSync(
      "git",
      ["push", "-q", "origin", `HEAD:refs/heads/tars/control-${nonce}`],
      { cwd: wt, env: childEnv(), encoding: "utf8" },
    );
    expect(control.status).toBe(0);
    expect(refs()).toContain(`refs/heads/tars/control-${nonce}`);
  });

  it("git credential fill pod noRemoteWriteEnv nevydá žádné heslo (osxkeychain ani gh helper)", () => {
    const env = {
      ...childEnv(),
      ...noRemoteWriteEnv(path.join(dir, "gh-empty")),
      HOME: dir,
    };
    const r = spawnSync("git", ["credential", "fill"], {
      input: "protocol=https\nhost=github.com\n\n",
      env,
      encoding: "utf8",
      timeout: 20_000,
    });
    expect(r.status).not.toBe(0);
    expect(`${r.stdout}${r.stderr}`).not.toMatch(/password=/);
  });

  it.runIf(process.platform === "darwin")(
    "macOS: systémový credential.helper (osxkeychain) je pod noRemoteWriteEnv vynulovaný (poslední hodnota seznamu je prázdná)",
    () => {
      const env = {
        ...childEnv(),
        ...noRemoteWriteEnv(path.join(dir, "gh-empty")),
      };
      const r = spawnSync("git", ["config", "--get-all", "credential.helper"], {
        env,
        encoding: "utf8",
      });
      const vals = r.stdout.split("\n").slice(0, -1);
      expect(vals.at(-1)).toBe("");
    },
  );

  it.runIf(hasGh)(
    "N03 test 2: gh s prázdným GH_CONFIG_DIR není přihlášené; gh pr create selže",
    () => {
      const { wt } = devRepo({ "a.txt": "a\n" });
      const env = {
        ...childEnv(),
        ...noRemoteWriteEnv(path.join(dir, "gh-empty")),
      };
      const st = spawnSync("gh", ["auth", "status"], {
        cwd: wt,
        env,
        encoding: "utf8",
        timeout: 30_000,
      });
      expect(st.status).not.toBe(0);
      expect(`${st.stdout}${st.stderr}`).toMatch(
        /not logged in|gh auth login/i,
      );
      const pr = spawnSync(
        "gh",
        ["pr", "create", "--draft", "--title", "x", "--body", "y"],
        { cwd: wt, env, encoding: "utf8", timeout: 30_000 },
      );
      expect(pr.status).not.toBe(0);
    },
  );

  it("dev create předá AI Chain prostředí noRemoteWriteEnv (složka gh-empty pokusu)", async () => {
    const { bare } = devRepo({ "a.txt": "a\n" });
    const chain = okChain();
    const dev = new DevDepartment(
      chain as never,
      new FakeAdapter("gpt", "codex", () => PASS),
    );
    const s = await orch(dev, { remoteProbe: bareProbe(bare) }).step(
      seed("DOING"),
    );
    expect(s.state).toBe("CHECKING");
    expect(chain.calls).toBe(1);
    const env = chain.envs[0]!;
    expect(env.GH_CONFIG_DIR).toBe(
      path.join(dir, ORDER_ID, "attempts", "create-r0-a1.gh-empty"),
    );
    expect(env.GIT_CONFIG_VALUE_2).toBe(PUSH_BLOCKED_URL);
    expect(fs.statSync(env.GH_CONFIG_DIR).mode & 0o777).toBe(0o700);
  });
});

// ───────────────────────────── §8.2 snímky vzdálených zápisů (N03 test 3) ─────────────────────────────

describe("§8.2 snímky vzdálených zápisů a EXTERNAL_UNJOURNALED", () => {
  it("N03 test 3: dítě s vypnutou vrstvou 1 pushne do bare repa → EXTERNAL_UNJOURNALED, HOLD, 0 retry, 0 PR", async () => {
    const { bare, wt } = devRepo({ "a.txt": "a\n" });
    const bins = fakeBin();
    const chain = fakeChain(async () => {
      // vrstva 1 vypnutá: dítě pushne vlastním prostředím
      git(wt, "push", "-q", "origin", "HEAD:refs/heads/rogue");
      return {
        ok: true,
        limit: false,
        text: "",
        status: "PASS",
        duration_ms: 0,
      };
    });
    const dev = new DevDepartment(
      chain as never,
      new FakeAdapter("gpt", "codex", () => PASS),
    );
    const o = orch(dev, { remoteProbe: bareProbe(bare) });
    const s = await o.step(seed("DOING"));
    expect(s.state).toBe("UNKNOWN");
    expect(fs.readFileSync(path.join(dir, "log.jsonl"), "utf8")).toMatch(
      /EXTERNAL_UNJOURNALED: nová větev refs\/heads\/rogue/,
    );
    const a = J().list(ORDER_ID, "create-r0");
    expect(a).toHaveLength(1);
    expect(a[0].remote_before?.ok).toBe(true);
    expect(
      a[0].remote_after?.ok && a[0].remote_after.heads["refs/heads/rogue"],
    ).toBeTruthy();
    // žádné opakování, žádný push zakázky, žádný PR
    expect(await o.step(store.load(ORDER_ID))).toMatchObject({
      state: "UNKNOWN",
    });
    expect(chain.calls).toBe(1);
    expect(bins.gh()).toEqual([]);
    expect(
      git(bare, "for-each-ref", "--format=%(refname)").split("\n").sort(),
    ).toEqual(["refs/heads/main", "refs/heads/rogue"]);
  });

  it("reconcile před retry: pokus ABANDONED po pádu, snímek po se pořídí teď; nežurnálovaná větev → UNKNOWN, 0 volání", async () => {
    const { bare, wt } = devRepo({ "a.txt": "a\n" });
    const probe = bareProbe(bare);
    const j = J();
    const r = j.intent(ORDER_ID, "create-r0", {
      input_sha256: "x",
      deadline: NOW,
      decision_check: "t",
      remote_before: probe.snapshot(dir, NOW),
    });
    git(wt, "push", "-q", "origin", "HEAD:refs/heads/tars/jiny");
    j.abandoned(r.attempt_id, "pád");
    const chain = okChain();
    const dev = new DevDepartment(
      chain as never,
      new FakeAdapter("gpt", "codex", () => PASS),
    );
    const s = await orch(dev, { remoteProbe: probe }).step(seed("DOING"));
    expect(s.state).toBe("UNKNOWN");
    expect(chain.calls).toBe(0);
    const rec = J().get(r.attempt_id)!;
    expect(rec.reconcile?.result).toBe("UNKNOWN");
    expect(rec.reconcile?.reason).toMatch(
      /EXTERNAL_UNJOURNALED: nová větev refs\/heads\/tars\/jiny/,
    );
    expect(rec.remote_after?.ok).toBe(true);
  });

  it("limit uprostřed create (PAUSED), nic vzdáleně nového, worktree čistý → po resume RETRY_SAFE a nové volání AI Chain", async () => {
    const { bare } = devRepo({ "a.txt": "a\n" });
    let n = 0;
    const chain = fakeChain(async () =>
      ++n === 1
        ? {
            ok: false,
            limit: true,
            text: "",
            status: "UNKNOWN",
            error: "usage limit reached",
            duration_ms: 0,
          }
        : { ok: true, limit: false, text: "", status: "PASS", duration_ms: 0 },
    );
    const dev = new DevDepartment(
      chain as never,
      new FakeAdapter("gpt", "codex", () => PASS),
    );
    const o = orch(dev, { remoteProbe: bareProbe(bare) });
    expect((await o.step(seed("DOING"))).state).toBe("PAUSED");
    store.save(transition(store.load(ORDER_ID), { type: "resume" }, NOW));
    const s = await o.step(store.load(ORDER_ID));
    expect(s.state).toBe("CHECKING");
    expect(chain.calls).toBe(2);
    expect(J().list(ORDER_ID, "create-r0")[0].reconcile).toMatchObject({
      result: "RETRY_SAFE",
    });
  });

  it("snímek před pokusem nejde pořídit → HOLD, 0 volání; neúplný snímek se nikdy nebere jako „nic se nestalo“", async () => {
    const { bare } = devRepo({ "a.txt": "a\n" });
    const chain = okChain();
    const dev = new DevDepartment(
      chain as never,
      new FakeAdapter("gpt", "codex", () => PASS),
    );
    const s = await orch(dev, {
      remoteProbe: bareProbe(bare, {
        fail: () => "gh: neúplný výsledek (limit)",
      }),
    }).step(seed("DOING"));
    expect(s.state).toBe("UNKNOWN");
    expect(chain.calls).toBe(0);
    expect(() =>
      unjournaledWrites(
        {
          ok: true,
          at: NOW,
          since: NOW,
          heads: {},
          heads_sha256: headsSha256({}),
          prs: [],
          runs: [],
        },
        { ok: false, at: NOW, since: NOW, error: "síť" },
        { pushes: [], pr_urls: [] },
      ),
    ).toThrow(/snímek po pokusu nejde použít/);
    expect(() =>
      unjournaledWrites(undefined, undefined, { pushes: [], pr_urls: [] }),
    ).toThrow(/chybí dvojice snímků/);
  });

  it("unjournaledWrites: push s receiptem v journalu je vysvětlený; nový PR a nový běh workflow_dispatch ne", () => {
    const snap = (
      heads: Record<string, string>,
      prs: Pr[] = [],
      runs: Array<{ databaseId: number; workflowName: string }> = [],
    ): RemoteSnapshot => ({
      ok: true,
      at: NOW,
      since: NOW,
      heads,
      heads_sha256: headsSha256(heads),
      prs,
      runs,
    });
    const A = "a".repeat(40);
    const B = "b".repeat(40);
    const before = snap({ "refs/heads/main": A });
    const after = snap(
      { "refs/heads/main": A, [`refs/heads/tars/${ORDER_ID}`]: B },
      [
        {
          number: 9,
          headRefName: `tars/${ORDER_ID}`,
          url: "https://github.com/o/r/pull/9",
        },
      ],
      [{ databaseId: 77, workflowName: "Auto Crawl" }],
    );
    expect(
      unjournaledWrites(before, after, {
        pushes: [{ ref: `refs/heads/tars/${ORDER_ID}`, oid: B }],
        pr_urls: ["https://github.com/o/r/pull/9"],
      }),
    ).toEqual(["nový běh workflow_dispatch 77 (Auto Crawl)"]);
    expect(
      unjournaledWrites(before, after, { pushes: [], pr_urls: [] }),
    ).toEqual([
      `nová větev refs/heads/tars/${ORDER_ID} ${B}`,
      `nový PR #9 (tars/${ORDER_ID})`,
      "nový běh workflow_dispatch 77 (Auto Crawl)",
    ]);
    expect(
      unjournaledWrites(after, before, { pushes: [], pr_urls: [] }),
    ).toEqual([`smazaná větev refs/heads/tars/${ORDER_ID}`]);
  });
});

// ───────────────────────────── §6.2.3 + §6.2.2 bod 6: brána push (N08 testy 11 a 13) ─────────────────────────────

describe("brána review receiptu před gh-push a gh-draft-pr", () => {
  /** Dev zakázka po skutečné kontrole v orchestrátoru (receipt s odkazem ze stavu) → DELIVERED. */
  async function checkedDev(files: Record<string, string>) {
    const repo = devRepo(files);
    const bins = fakeBin(ghScript(repo.wt));
    const reviewer = new FakeAdapter("gpt", "codex", () => PASS);
    const dev = new DevDepartment(okChain() as never, reviewer);
    const o = orch(dev, { remoteProbe: bareProbe(repo.bare) });
    const checked = await o.step(
      seed("CHECKING", { draft_file: "wt", meta: { chain_status: "PASS" } }),
    );
    expect(checked.state).toBe("DELIVERED");
    expect(checked.meta.review_receipt_id).toMatch(/^[0-9a-f]{64}$/);
    return { ...repo, bins, dev, o, reviewer };
  }
  const pushes = (bins: { git: () => string[] }) =>
    bins.git().filter((l) => /^push /.test(l));
  const prCreates = (bins: { gh: () => string[] }) =>
    bins.gh().filter((l) => /^pr create/.test(l));

  it("pozitivní cesta: PASS nad HEAD s úplným pokrytím → 1 push (receipt OID = HEAD), 1 draft PR", async () => {
    const x = await checkedDev({ "a.txt": "a\n" });
    const d = await x.o.step(store.load(ORDER_ID));
    expect(d.delivered_url).toBe("https://github.com/o/r/pull/9");
    expect(pushes(x.bins)).toEqual([`push -q -u origin tars/${ORDER_ID}`]);
    expect(prCreates(x.bins)).toHaveLength(1);
    expect(git(x.bare, "rev-parse", `refs/heads/tars/${ORDER_ID}`)).toBe(
      x.head,
    );
    expect(
      new PushJournal(dir)
        .list(ORDER_ID, 0)
        .map((r) => [r.state, r.receipt?.git_oid]),
    ).toEqual([["EFFECT_DONE", x.head]]);
    // druhé doručení stejného kola (např. po pádu): brána projde, journal push = RESUME (vzdálená větev už nese HEAD)
    const again = await x.dev.deliver(store.load(ORDER_ID), devCtx());
    expect(again).toMatchObject({ ok: true, content: x.head });
    expect(
      new PushJournal(dir)
        .list(ORDER_ID, 0)
        .map((r) => [r.state, r.reconcile.result]),
    ).toEqual([
      ["EFFECT_DONE", "RETRY_SAFE"],
      ["EFFECT_DONE", "RESUME"],
    ]);
  });

  it("CI 4b: bez review receiptu (zakázka z doby před 4a) → HOLD, 0 push, 0 PR", async () => {
    const { bare } = devRepo({ "a.txt": "a\n" });
    const bins = fakeBin();
    const dev = new DevDepartment(
      okChain() as never,
      new FakeAdapter("gpt", "codex", () => PASS),
    );
    const s = await orch(dev, { remoteProbe: bareProbe(bare) }).step(
      seed("DELIVERED", { draft_file: "wt", meta: { chain_status: "PASS" } }),
    );
    expect(s.state).toBe("UNKNOWN");
    expect(fs.readFileSync(path.join(dir, "log.jsonl"), "utf8")).toMatch(
      /REVIEW_MISMATCH: chybí platný review receipt/,
    );
    expect(pushes(bins)).toEqual([]);
    expect(bins.gh()).toEqual([]);
    expect(fs.existsSync(path.join(dir, ORDER_ID, "push"))).toBe(false);
    // ani přímé volání deliver (bez orchestrátoru) nic nepushne
    const r = await dev.deliver(store.load(ORDER_ID), devCtx());
    expect(r).toMatchObject({ ok: false, effect_absent: true });
    expect(r.hold).toMatch(/REVIEW_MISMATCH/);
    expect(pushes(bins)).toEqual([]);
  });

  it("test 2 (§6.2): PASS pro commit X, nový commit Y na větvi zakázky → HOLD REVIEW_MISMATCH, 0 push, 0 PR", async () => {
    const x = await checkedDev({ "a.txt": "a\n" });
    fs.writeFileSync(path.join(x.wt, "b.txt"), "po kontrole\n");
    git(x.wt, "add", "-A");
    git(x.wt, "commit", "-q", "-m", "po kontrole");
    const s = await x.o.step(store.load(ORDER_ID));
    expect(s.state).toBe("UNKNOWN");
    expect(fs.readFileSync(path.join(dir, "log.jsonl"), "utf8")).toMatch(
      /REVIEW_MISMATCH: zkontrolován/,
    );
    expect(pushes(x.bins)).toEqual([]);
    expect(prCreates(x.bins)).toEqual([]);
  });

  it("test 13: posun origin/main po kontrole → brána počítá z reviewed_base_oid, push a PR projdou", async () => {
    const x = await checkedDev({ "a.txt": "a\n" });
    fs.writeFileSync(path.join(x.seedDir, "jine.txt"), "nový commit na main\n");
    git(x.seedDir, "add", "-A");
    git(x.seedDir, "commit", "-q", "-m", "main posun");
    git(x.seedDir, "push", "-q", "origin", "main");
    git(x.wt, "fetch", "-q", "origin");
    expect(git(x.wt, "merge-base", "origin/main", "HEAD")).not.toBe(
      git(x.wt, "rev-parse", "origin/main"),
    );
    const d = await x.o.step(store.load(ORDER_ID));
    expect(d.delivered_url).toBe("https://github.com/o/r/pull/9");
    expect(pushes(x.bins)).toHaveLength(1);
    expect(prCreates(x.bins)).toHaveLength(1);
  });

  /** Podvržený receipt s konzistentními pokusy částí (FINISHED, otisky); rozsahy částí volí test. */
  function forge(
    wt: string,
    ranges: (diff: string) => Array<[number, number]>,
    family: ModelFamily = "gpt",
    attemptNo = 1,
  ) {
    const head = git(wt, "rev-parse", "HEAD");
    const base = git(wt, "merge-base", "origin/main", "HEAD");
    const diff = gitRaw(wt, "diff", `${base}..${head}`);
    const j = J();
    const chunks = ranges(diff).map(([start, end], index) => {
      const rec = j.intent(ORDER_ID, `check-r0-a${attemptNo}-c${index}`, {
        input_sha256: "x",
        deadline: NOW,
        decision_check: "t",
      });
      const out = j.writeOutput(rec, PASS);
      j.finished(rec.attempt_id, { exit: 0, ok: true, output_sha256: out });
      return {
        index,
        start,
        end,
        sha256: sha256(diff.slice(start, end)),
        invocation_id: rec.attempt_id,
        verdict: "PASS" as const,
        out,
      };
    });
    const ref = writeReviewReceipt(store.orderDir(ORDER_ID), {
      v: 1,
      review_id: reviewId(
        ORDER_ID,
        "check/r0",
        chunks.map((c) => c.invocation_id),
      ),
      order_id: ORDER_ID,
      step_id: "check/r0",
      invocation_id: chunks[0].invocation_id,
      reviewer_adapter: "podvrh",
      reviewer_family: family,
      reviewer_model: "podvrh",
      verdict: "PASS",
      reviewed_artifact_kind: "git",
      reviewed_git_commit_oid: head,
      reviewed_base_oid: base,
      full_diff_sha256: sha256(diff),
      full_diff_chars: diff.length,
      chunks: chunks.map((c) => ({
        index: c.index,
        start: c.start,
        end: c.end,
        sha256: c.sha256,
        invocation_id: c.invocation_id,
        verdict: c.verdict,
      })),
      coverage: "full",
      prompt_sha256: "p",
      output_sha256: sha256(chunks.map((c) => c.out).join("")),
      created_at: NOW,
    });
    const meta = {
      chain_status: "PASS",
      review_receipt_id: ref.review_id,
      review_receipt_sha256: ref.sha256,
    };
    // Stav se uloží jen u prvního podvrhu (další save stejné zakázky odmítne CAS); test pracuje s objektem v paměti.
    const o: Order =
      attemptNo === 1
        ? seed("DELIVERED", { draft_file: "wt", meta })
        : { ...store.load(ORDER_ID), meta };
    return { o, diff };
  }

  it("test 11: podvržený receipt s mezerou v pokrytí (část [0, 150 000], chybí zbytek do ~180 000) → HOLD REVIEW_COVERAGE, 0 push, 0 PR", async () => {
    const big =
      Array.from(
        { length: 2900 },
        (_, i) => `řádek ${i} ${"x".repeat(50)}`,
      ).join("\n") + "\n";
    const { bare, wt } = devRepo({ "a.txt": big });
    const bins = fakeBin(ghScript(wt));
    const { o, diff } = forge(wt, () => [[0, 150_000]]);
    expect(diff.length).toBeGreaterThan(170_000);
    const dev = new DevDepartment(
      okChain() as never,
      new FakeAdapter("gpt", "codex", () => PASS),
    );
    expect(dev.effectGate(o, devCtx())).toMatch(
      /^REVIEW_COVERAGE: poslední část nekončí na konci diffu/,
    );
    const s = await orch(dev, { remoteProbe: bareProbe(bare) }).step(o);
    expect(s.state).toBe("UNKNOWN");
    expect(pushes(bins)).toEqual([]);
    expect(prCreates(bins)).toEqual([]);
    expect(git(bare, "for-each-ref", "--format=%(refname)")).toBe(
      "refs/heads/main",
    );
    // stejný podvrh s úplným pokrytím bránou projde (test měří mezeru, ne podvrh jako takový)
    const full = forge(wt, (d) => [[0, d.length]], "gpt", 2);
    expect(dev.effectGate(full.o, devCtx())).toBeUndefined();
  });

  it("test 4 (§6.2): receipt s reviewer_family = creatorFamily → HOLD REVIEW_MISMATCH", () => {
    const { wt } = devRepo({ "a.txt": "a\n" });
    const { o } = forge(wt, (d) => [[0, d.length]], "claude");
    const dev = new DevDepartment(
      okChain() as never,
      new FakeAdapter("gpt", "codex", () => PASS),
    );
    expect(dev.effectGate(o, devCtx())).toBe(
      "REVIEW_MISMATCH: reviewer_family = creatorFamily",
    );
  });

  it("test 3 (§6.2): receipt v reviews/ bez odkazu ze stavu se ignoruje → HOLD", () => {
    const { wt } = devRepo({ "a.txt": "a\n" });
    const forged = forge(wt, (d) => [[0, d.length]]);
    // stejná zakázka, jen bez odkazu na receipt ve stavu
    const o = { ...forged.o, meta: { chain_status: "PASS" } };
    expect(
      fs.readdirSync(path.join(store.orderDir(ORDER_ID), "reviews")),
    ).toHaveLength(1);
    const dev = new DevDepartment(
      okChain() as never,
      new FakeAdapter("gpt", "codex", () => PASS),
    );
    expect(dev.effectGate(o, devCtx())).toMatch(
      /^REVIEW_MISMATCH: chybí platný review receipt/,
    );
  });

  it("část bez FINISHED nebo výstup části změněný po receiptu → HOLD REVIEW_MISMATCH", () => {
    const { wt } = devRepo({ "a.txt": "a\n" });
    const { o } = forge(wt, (d) => [[0, d.length]]);
    const dev = new DevDepartment(
      okChain() as never,
      new FakeAdapter("gpt", "codex", () => PASS),
    );
    expect(dev.effectGate(o, devCtx())).toBeUndefined();
    // pokus části bez kontextu journalu = nejde ověřit
    expect(dev.effectGate(o, { ...devCtx(), attempts: undefined })).toMatch(
      /bez journalu pokusů/,
    );
    // přepsaný výstup a FINISHED s jiným otiskem
    const f = path.join(dir, ORDER_ID, "attempts", "check-r0-a1-c0-a1.json");
    const rec = JSON.parse(fs.readFileSync(f, "utf8"));
    rec.finished.output_sha256 = "0".repeat(64);
    fs.writeFileSync(f, JSON.stringify(rec));
    expect(dev.effectGate(o, devCtx())).toBe(
      "REVIEW_MISMATCH: output_sha256 nesedí s výstupy částí",
    );
  });
});
