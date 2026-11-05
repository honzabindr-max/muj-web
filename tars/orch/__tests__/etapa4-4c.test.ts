// Etapa 4, PR 4c (dodatek v6.1 řádek #2, DR-027 v2.1 §6, §7, §8.2, NAVRH-v6 §5, §7, §10; třída B): retry watchdog
// Claude Code v prostředí dítěte se stropy pod tvrdým limitem procesu TARS, PAUSED při doloženém resetu, ukončení
// skupiny po tvrdém limitu, jediný platný claim po restartu a automatické pokračování po resetu přes skutečnou bránu
// wake-gate.sh. Bez čerpání kvóty: `claude` je falešný skript na PATH, výstupy jsou fixture svázané s verzí 2.1.317.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CLAUDE_HARD_LIMIT_MS,
  ClaudeCli,
  childEnv,
  parseClaudeStdout,
  type AdapterResult,
  type RunOpts,
  type TextAdapter,
} from "../adapters";
import { AttemptJournal, type ProcInfo, type ProcessProbe } from "../attempts";
import { CopyDepartment, type DepartmentRunner } from "../departments";
import { LimitGuard } from "../limit-guard";
import { Orchestrator } from "../orchestrator";
import { Store } from "../store";
import type { Order } from "../types";
import { parseNextWake, writeGateOutcome } from "../wake";
import {
  parseClaudeVersion,
  resetClaudeVersionCache,
  WATCHDOG_ENV_RE,
  WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS,
  WATCHDOG_MAX_WAIT_MS,
  WATCHDOG_VERIFIED_CLAUDE_VERSIONS,
  watchdogEnv,
} from "../watchdog";
import {
  DRAFT,
  effOrder,
  FileNotion,
  ORDER_ID,
  PARENT,
} from "./effects-fixture";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const GATE = path.join(__dirname, "..", "launchd", "wake-gate.sh");
const SH = process.env.TARS_TEST_SH ?? "/bin/sh";
const FIX = path.join(__dirname, "fixtures", "claude-2.1.317");
const fixture = (name: string, epoch?: number) =>
  fs
    .readFileSync(path.join(FIX, name), "utf8")
    .replace("__EPOCH__", String(epoch ?? ""));
const PASS = '```json\n{"verdict":"PASS","issues":[]}\n```';
const MIN = 60_000;

let dir: string;
let bin: string;
let fake: string;
let oldPath: string | undefined;
const saved: Record<string, string | undefined> = {};
const cleanup: Array<() => void> = [];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-4c-"));
  bin = fs.mkdtempSync(path.join(os.tmpdir(), "tars-4c-bin-"));
  fake = path.join(bin, "claude.d");
  oldPath = process.env.PATH;
  process.env.PATH = `${bin}:${oldPath}`;
  resetClaudeVersionCache();
});
afterEach(() => {
  process.env.PATH = oldPath;
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
    delete saved[k];
  }
  while (cleanup.length) cleanup.pop()!();
  resetClaudeVersionCache();
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(bin, { recursive: true, force: true });
});

function setEnv(k: string, v: string): void {
  if (!(k in saved)) saved[k] = process.env[k];
  process.env[k] = v;
}

// ───────────────────────────── falešné CLI ─────────────────────────────

/** Jedno volání falešného `claude -p`: stdout + kód, nebo „visí“ (watchdog čeká) s vnukem ve skupině. */
type Call =
  | { stdout: string; code?: number; delayMs?: number }
  | { hang: string };

/**
 * Falešný `claude` na PATH. `--version` vypíše `version`. Každé další volání uloží argumenty, vybrané proměnné
 * prostředí a prompt (`call-<n>.*`) a provede n-tý krok ze `calls` (poslední se opakuje).
 */
function fakeClaude(version: string, calls: Call[]): void {
  fs.mkdirSync(fake, { recursive: true });
  calls.forEach((c, i) => {
    const n = i + 1;
    if ("hang" in c) {
      fs.writeFileSync(path.join(fake, `step-${n}.stdout`), c.hang);
      fs.writeFileSync(path.join(fake, `step-${n}.mode`), "hang");
    } else {
      fs.writeFileSync(path.join(fake, `step-${n}.stdout`), c.stdout);
      fs.writeFileSync(
        path.join(fake, `step-${n}.mode`),
        `${c.code ?? 0} ${((c.delayMs ?? 0) / 1000).toFixed(2)}`,
      );
    }
  });
  const script = [
    "#!/bin/bash",
    `D="${fake}"`,
    `if [ "$1" = "--version" ]; then echo "${version}"; exit 0; fi`,
    'n=$(( $(cat "$D/count" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$D/count"',
    `s=$n; [ -f "$D/step-$s.mode" ] || s=${calls.length}`,
    'printf "%s\\n" "$@" > "$D/call-$n.args"',
    'env | grep -E "^(CLAUDE_CODE_|ANTHROPIC_|TARS_ATTEMPT_ID=)" | sort > "$D/call-$n.env"',
    'cat > "$D/call-$n.prompt"',
    'read -r mode delay < "$D/step-$s.mode"',
    'if [ "$mode" = "hang" ]; then',
    '  cat "$D/step-$s.stdout"',
    '  sleep 60 & echo $! > "$D/call-$n.grandchild"',
    "  wait",
    "  exit 0",
    "fi",
    '[ "$delay" != "0.00" ] && sleep "$delay"',
    'cat "$D/step-$s.stdout"',
    'exit "$mode"',
  ].join("\n");
  fs.writeFileSync(path.join(bin, "claude"), `${script}\n`, { mode: 0o755 });
}

const calls = () =>
  Number(
    fs.existsSync(path.join(fake, "count"))
      ? fs.readFileSync(path.join(fake, "count"), "utf8").trim()
      : 0,
  );
const childEnvOf = (n: number): Record<string, string> =>
  Object.fromEntries(
    fs
      .readFileSync(path.join(fake, `call-${n}.env`), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
const argsOf = (n: number) =>
  fs
    .readFileSync(path.join(fake, `call-${n}.args`), "utf8")
    .split("\n")
    .filter(Boolean);

const success = (text: string) =>
  `${JSON.stringify({ type: "system", subtype: "init", session_id: "fixture-4c" })}\n${JSON.stringify({ type: "result", subtype: "success", is_error: false, result: text, session_id: "fixture-4c" })}\n`;

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(fn: () => boolean, ms = 10_000): Promise<void> {
  const end = Date.now() + ms;
  while (!fn() && Date.now() < end) await new Promise((r) => setTimeout(r, 25));
}

// ───────────────────────────── orchestrátor ─────────────────────────────

class FakeProbe implements ProcessProbe {
  list(): ProcInfo[] {
    return [];
  }
  ownPgid = 7;
  kill() {
    return true;
  }
  async sleep() {}
}

class FakeChecker implements TextAdapter {
  name = "fake-checker";
  model = "fake-gpt";
  family = "gpt" as const;
  async run(): Promise<AdapterResult> {
    return { ok: true, text: PASS, limit: false, duration_ms: 0 };
  }
}

/** Skutečný ClaudeCli s kratším tvrdým limitem procesu (test ukončení skupiny bez 20 min čekání). */
class ShortClaude implements TextAdapter {
  family = "claude" as const;
  inner = new ClaudeCli("opus");
  name = this.inner.name;
  model = this.inner.model;
  constructor(private hardLimitMs?: number) {}
  run(prompt: string, opts: RunOpts): Promise<AdapterResult> {
    return this.inner.run(
      prompt,
      this.hardLimitMs ? { ...opts, timeoutMs: this.hardLimitMs } : opts,
    );
  }
}

function makeOrch(
  store: Store,
  department: DepartmentRunner,
  clock: () => number,
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
    notion: new FileNotion(path.join(dir, "notion.jsonl")),
    guard: () => ({ alarm: false, summary: "ok" }),
    draftParentId: PARENT,
    repoRoot: dir,
    capsulePath: path.join(dir, "none"),
    processProbe: new FakeProbe(),
    pauseMinutes: 45,
    now: () => new Date(clock()),
  });
}

function seedDoing(store: Store): void {
  const o: Order = { ...effOrder("DOING"), draft_file: undefined };
  expect(store.save(o)).toBe(true);
}

const attemptsOf = (step: string) =>
  new AttemptJournal(dir, () => new Date().toISOString())
    .list(ORDER_ID)
    .filter((a) => a.step === step);

/** Jedno spuštění skutečné brány wake-gate.sh v čase `nowS` (sekundy); tick provede test sám (jako cli.ts). */
function gate(nowS: number): { ticked: boolean; reason?: string; out: string } {
  const log = path.join(dir, "gate-ticks.log");
  const before = fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "";
  const r = spawnSync(SH, [GATE], {
    encoding: "utf8",
    env: {
      PATH: oldPath ?? "/usr/bin:/bin",
      HOME: dir,
      TARS_RUNS_DIR: dir,
      TARS_GATE_NOW: String(nowS),
      TICKLOG: log,
      TARS_GATE_TICK: `printf '%s\\n' "$TARS_GATE_START" >> "$TICKLOG"`,
    } as unknown as NodeJS.ProcessEnv,
  });
  expect(r.status).toBe(0);
  const after = fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "";
  return {
    ticked: after.length > before.length,
    reason: / tick reason=([abc])/.exec(r.stdout)?.[1],
    out: r.stdout + r.stderr,
  };
}

const nextWake = () => {
  const f = path.join(dir, "next-wake");
  return fs.existsSync(f)
    ? parseNextWake(fs.readFileSync(f, "utf8"))
    : undefined;
};

// ───────────────────────────── 1. názvy a hodnoty ─────────────────────────────

describe("PR 4c: watchdog env (ověřené názvy, stropy pod tvrdým limitem)", () => {
  it("evidence obsahuje claude/codex --version a všechny tři názvy; každá ověřená verze má složku fixture", () => {
    const ev = fs.readFileSync(
      path.join(ROOT, "tars/orch/evidence/pr4c-versions.md"),
      "utf8",
    );
    for (const name of [
      "CLAUDE_CODE_RETRY_WATCHDOG",
      "CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS",
      "CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS",
    ])
      expect(ev).toContain(`\`${name}\``);
    expect(ev).toMatch(/`claude --version` \| `\d+\.\d+\.\d+ \(Claude Code\)`/);
    expect(ev).toMatch(/`codex --version` \| `codex-cli \d+\.\d+\.\d+`/);
    expect(WATCHDOG_VERIFIED_CLAUDE_VERSIONS.length).toBeGreaterThan(0);
    for (const v of WATCHDOG_VERIFIED_CLAUDE_VERSIONS) {
      expect(ev).toContain(`**${v}**`);
      const f = path.join(__dirname, "fixtures", `claude-${v}`, "VERSION");
      expect(parseClaudeVersion(fs.readFileSync(f, "utf8"))).toBe(v);
    }
  });

  it("stropy jsou kratší než tvrdý limit procesu; MAX_USAGE_LIMIT_WAIT_MS je nejmenší platná hodnota (CLI: min 1)", () => {
    expect(WATCHDOG_MAX_WAIT_MS).toBeLessThan(CLAUDE_HARD_LIMIT_MS);
    expect(WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS).toBe(1);
    const v = WATCHDOG_VERIFIED_CLAUDE_VERSIONS[0];
    expect(watchdogEnv(v, CLAUDE_HARD_LIMIT_MS).env).toEqual({
      CLAUDE_CODE_RETRY_WATCHDOG: "1",
      CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS: String(WATCHDOG_MAX_WAIT_MS),
      CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS: "1",
    });
    for (const hard of [
      1,
      2,
      1000,
      60_000,
      9 * MIN,
      CLAUDE_HARD_LIMIT_MS,
      90 * MIN,
    ]) {
      const e = watchdogEnv(v, hard).env;
      if (!e.CLAUDE_CODE_RETRY_WATCHDOG) continue;
      expect(Number(e.CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS)).toBeLessThan(
        hard,
      );
      expect(
        Number(e.CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS),
      ).toBeLessThan(hard);
      expect(
        Number(e.CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS),
      ).toBeGreaterThanOrEqual(1);
    }
    expect(watchdogEnv(v, 1).env).toEqual({}); // strop by nebyl kratší než limit: watchdog vypnut
  });

  it("jiná nebo nezjištěná verze CLI = watchdog NEZAPNUT (fail-closed)", () => {
    expect(watchdogEnv("2.1.999", CLAUDE_HARD_LIMIT_MS).env).toEqual({});
    expect(watchdogEnv(undefined, CLAUDE_HARD_LIMIT_MS).env).toEqual({});
    expect(watchdogEnv("2.1.999", CLAUDE_HARD_LIMIT_MS).note).toMatch(
      /není ověřená/,
    );
    expect(parseClaudeVersion("2.1.317 (Claude Code)\n")).toBe("2.1.317");
    expect(parseClaudeVersion("claude 2.1.317")).toBeUndefined();
    expect(parseClaudeVersion('{"result":"ok"}')).toBeUndefined();
  });

  it("childEnv nikdy nepředá zděděný watchdog (ani dítěti Codex / AI Chain)", () => {
    setEnv("CLAUDE_CODE_RETRY_WATCHDOG", "1");
    setEnv("CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS", "999999999");
    const e = childEnv();
    expect(Object.keys(e).filter((k) => WATCHDOG_ENV_RE.test(k))).toEqual([]);
  });

  it("ClaudeCli, ověřená verze: dítě má watchdog se stropy pod svým tvrdým limitem; zděděné ani volajícím podané hodnoty neprojdou; žádný ANTHROPIC_API_KEY ani --bare", async () => {
    setEnv("CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS", "999999999");
    setEnv("ANTHROPIC_API_KEY", "test-dummy-not-a-key");
    fakeClaude("2.1.317 (Claude Code)", [{ stdout: success("hotovo") }]);
    const r = await new ClaudeCli("sonnet").run("p", {
      cwd: dir,
      timeoutMs: 8 * MIN,
      env: {
        CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS: "86400000",
        TARS_RUNS_DIR: dir,
      },
    });
    expect(r.ok).toBe(true);
    expect(r.text).toBe("hotovo");
    expect(r.cli_version).toBe("2.1.317");
    const env = childEnvOf(1);
    expect(env.CLAUDE_CODE_RETRY_WATCHDOG).toBe("1");
    expect(env.CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS).toBe(String(4 * MIN)); // ½ z 8 min
    expect(env.CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS).toBe("1");
    expect(env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS).toBe("1");
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    const args = argsOf(1);
    expect(args).not.toContain("--bare");
    expect(args).toEqual(
      expect.arrayContaining([
        "-p",
        "--output-format",
        "stream-json",
        "--verbose",
      ]),
    );
  });

  it("ClaudeCli, jiná verze CLI: žádná proměnná watchdogu (ani zděděná), limit s epochou → limit_text chybí, reset_unverified", async () => {
    setEnv("CLAUDE_CODE_RETRY_WATCHDOG", "1");
    const epoch = Math.floor(Date.now() / 1000) + 3600;
    fakeClaude("2.1.999 (Claude Code)", [
      { stdout: fixture("result-limit-epoch.jsonl", epoch), code: 1 },
    ]);
    const r = await new ClaudeCli("sonnet").run("p", { cwd: dir });
    expect(
      Object.keys(childEnvOf(1)).filter((k) => WATCHDOG_ENV_RE.test(k)),
    ).toEqual([]);
    expect(r.limit).toBe(true);
    expect(r.limit_text).toBeUndefined();
    expect(r.reset_unverified).toMatch(/2\.1\.999 není ověřená/);
  });

  it("parseClaudeStdout: poslední událost result je obálka; starý tvar json projde; stream bez result = bez obálky", () => {
    const s = `${fixture("api-retry-rate-limit.jsonl")}${success("x")}`;
    expect(parseClaudeStdout(s)).toEqual({
      envelope: expect.objectContaining({ result: "x", is_error: false }),
      stream: true,
    });
    expect(parseClaudeStdout('{"result":"ok","is_error":false}')).toEqual({
      envelope: { result: "ok", is_error: false },
      stream: false,
    });
    expect(parseClaudeStdout(fixture("api-retry-rate-limit.jsonl"))).toEqual({
      envelope: undefined,
      stream: true,
    });
    expect(parseClaudeStdout("rate limit — try again")).toEqual({
      stream: false,
    });
  });
});

// ───────────────────────────── 2. tvrdý limit procesu ─────────────────────────────

describe("PR 4c: tvrdý limit procesu nad watchdogem (W4)", () => {
  it("watchdog čeká (system/api_retry) déle než tvrdý limit → TARS ukončí celou skupinu (-pgid), vnuk nepřežije; limit doložen třídou, čas nedoložen", async () => {
    fakeClaude("2.1.317 (Claude Code)", [
      { hang: fixture("api-retry-rate-limit.jsonl") },
    ]);
    const t0 = Date.now();
    const r = await new ClaudeCli("opus").run("p", {
      cwd: dir,
      timeoutMs: 1500,
    });
    expect(Date.now() - t0).toBeLessThan(15_000);
    expect(r.error).toBe("timeout");
    expect(r.ok).toBe(false);
    expect(r.limit).toBe(true); // doklad třídy limitu = system/api_retry rate_limit
    expect(r.limit_text).toBeUndefined(); // api_retry nikdy není čas resetu
    const gc = Number(
      fs.readFileSync(path.join(fake, "call-1.grandchild"), "utf8").trim(),
    );
    expect(gc).toBeGreaterThan(1);
    await waitFor(() => !pidAlive(gc));
    expect(pidAlive(gc)).toBe(false);
    // strop watchdogu dítěte je kratší než tvrdý limit
    expect(
      Number(childEnvOf(1).CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS),
    ).toBeLessThan(1500);
  }, 30_000);
});

// ───────────────────────────── 3. orchestrátor: PAUSED ─────────────────────────────

describe("PR 4c: PAUSED, čas resetu a uvolnění lease", () => {
  it("doložený reset (ověřená verze, obálka is_error s epochou) → PAUSED + resume_after = reset + 1 min, lease uvolněn, next-wake na obnovu", async () => {
    const clock = Date.now();
    const epoch = Math.floor(clock / 1000) + 10 * 60;
    fakeClaude("2.1.317 (Claude Code)", [
      { stdout: fixture("result-limit-epoch.jsonl", epoch), code: 1 },
    ]);
    const store = new Store(dir);
    seedDoing(store);
    const t = await makeOrch(
      store,
      new CopyDepartment(new ShortClaude(), new FakeChecker()),
      () => clock,
    ).tick();
    const resume = new Date(epoch * 1000 + MIN).toISOString();
    expect(t).toEqual({
      status: "paused",
      order: ORDER_ID,
      resume_after: resume,
    });
    const o = store.load(ORDER_ID);
    expect(o.state).toBe("PAUSED");
    expect(o.paused_from).toBe("DOING");
    expect(o.meta).toMatchObject({
      reset_source: "epoch",
      reset_at_utc: new Date(epoch * 1000).toISOString(),
    });
    expect(calls()).toBe(1);
    // lease uvolněn (soubor zámku pryč, instance ho nedrží), next-wake míří na obnovu
    expect(store.holdsLease()).toBe(false);
    expect(fs.existsSync(path.join(dir, ".lock"))).toBe(false);
    expect(nextWake()).toMatchObject({
      order_id: ORDER_ID,
      epoch: Math.ceil(Date.parse(resume) / 1000),
    });
    const a = attemptsOf("create-r0");
    expect(a).toHaveLength(1);
    expect(a[0].phase).toBe("FINISHED");
    expect(a[0].finished?.ok).toBe(false);
  }, 30_000);

  it("ukončení podřízeného procesu po tvrdém limitu → PAUSED s pauseMinutes (nedoloženo), vnuk mrtvý, pokus FINISHED (ne HOLD), lease uvolněn", async () => {
    const clock = Date.now();
    fakeClaude("2.1.317 (Claude Code)", [
      { hang: fixture("api-retry-rate-limit.jsonl") },
    ]);
    const store = new Store(dir);
    seedDoing(store);
    const t = await makeOrch(
      store,
      new CopyDepartment(new ShortClaude(1500), new FakeChecker()),
      () => clock,
    ).tick();
    expect(t).toMatchObject({
      status: "paused",
      order: ORDER_ID,
      resume_after: new Date(clock + 45 * MIN).toISOString(),
    });
    const o = store.load(ORDER_ID);
    expect(o.meta.reset_source).toBe("nedoloženo");
    const gc = Number(
      fs.readFileSync(path.join(fake, "call-1.grandchild"), "utf8").trim(),
    );
    await waitFor(() => !pidAlive(gc));
    expect(pidAlive(gc)).toBe(false);
    const a = attemptsOf("create-r0");
    expect(a.map((x) => x.phase)).toEqual(["FINISHED"]);
    expect(store.holdsLease()).toBe(false);
    expect(fs.existsSync(path.join(dir, ".lock"))).toBe(false);
  }, 30_000);

  it("nedoložený tvar hlášky (ověřená verze) → PAUSED s pauseMinutes, reset_source nedoloženo, nikdy odhad", async () => {
    const clock = Date.now();
    fakeClaude("2.1.317 (Claude Code)", [
      { stdout: fixture("result-limit-unknown.jsonl"), code: 1 },
    ]);
    const store = new Store(dir);
    seedDoing(store);
    const t = await makeOrch(
      store,
      new CopyDepartment(new ShortClaude(), new FakeChecker()),
      () => clock,
    ).tick();
    expect(t).toEqual({
      status: "paused",
      order: ORDER_ID,
      resume_after: new Date(clock + 45 * MIN).toISOString(),
    });
    const o = store.load(ORDER_ID);
    expect(o.meta.reset_source).toBe("nedoloženo");
    expect(o.meta.reset_at_utc).toBeUndefined();
  }, 30_000);

  it("jiná verze CLI než fixture → i hláška doloženého tvaru je nedoloženo → PAUSED s pauseMinutes", async () => {
    const clock = Date.now();
    const epoch = Math.floor(clock / 1000) + 10 * 60;
    fakeClaude("2.1.318 (Claude Code)", [
      { stdout: fixture("result-limit-epoch.jsonl", epoch), code: 1 },
    ]);
    const store = new Store(dir);
    seedDoing(store);
    const t = await makeOrch(
      store,
      new CopyDepartment(new ShortClaude(), new FakeChecker()),
      () => clock,
    ).tick();
    expect(t).toEqual({
      status: "paused",
      order: ORDER_ID,
      resume_after: new Date(clock + 45 * MIN).toISOString(),
    });
    const o = store.load(ORDER_ID);
    expect(o.meta.reset_source).toBe("nedoloženo");
    expect(o.meta.reset_reason).toMatch(/2\.1\.318 není ověřená/);
    expect(o.meta.reset_at_utc).toBeUndefined();
  }, 30_000);
});

// ───────────────────────────── 4. automatické pokračování a claim ─────────────────────────────

describe("PR 4c: automatické pokračování po resetu (wake-gate PR 2), jediný platný claim po restartu", () => {
  it("PAUSED → brána před resetem nic nespustí → po resetu (a) → nový proces (restart) převezme lease s vyšším fence, krok pokračuje 1× bez duplikátu; souběžný tick dostane locked", async () => {
    const t0 = Date.now();
    const t0s = Math.floor(t0 / 1000);
    const epoch = t0s + 10 * 60;
    fakeClaude("2.1.317 (Claude Code)", [
      { stdout: fixture("result-limit-epoch.jsonl", epoch), code: 1 },
      { stdout: success(DRAFT), delayMs: 1500 },
    ]);
    // tick 1 (proces A): brána bez historie → pojistka (b); limit → PAUSED, lease uvolněn
    expect(gate(t0s).ticked).toBe(true);
    const storeA = new Store(dir);
    seedDoing(storeA);
    const orchA = makeOrch(
      storeA,
      new CopyDepartment(new ShortClaude(), new FakeChecker()),
      () => t0,
    );
    const p1 = await orchA.tick();
    writeGateOutcome(dir, String(t0s), "ran", new Date(t0));
    expect(p1).toMatchObject({ status: "paused" });
    const resumeAt = Date.parse((p1 as { resume_after: string }).resume_after);
    const wake = nextWake()!;
    expect(wake.epoch).toBe(Math.ceil(resumeAt / 1000));

    // před resetem: brána každou minutu, žádný plný tick (ani (a), ani pojistka (b) do 30 min)
    for (let s = t0s + 60; s < wake.epoch; s += 60)
      expect(gate(s).ticked).toBe(false);
    expect(calls()).toBe(1);

    // po resetu: brána (a) bez ručního zásahu; „restart“ = nová instance Store + Orchestrator (proces B)
    const g = gate(wake.epoch);
    expect(g).toMatchObject({ ticked: true, reason: "a" });
    const storeB = new Store(dir);
    const orchB = makeOrch(
      storeB,
      new CopyDepartment(new ShortClaude(), new FakeChecker()),
      () => resumeAt + 1000,
    );
    const pB = orchB.tick();
    await waitFor(() => calls() >= 2); // B drží lease a dítě běží
    expect(calls()).toBe(2);
    // souběžný tick (proces C) během běhu B: jediný platný claim = B
    const storeC = new Store(dir);
    expect(
      await makeOrch(
        storeC,
        new CopyDepartment(new ShortClaude(), new FakeChecker()),
        () => resumeAt + 2000,
      ).tick(),
    ).toEqual({ status: "locked" });
    const leaseB = JSON.parse(
      fs.readFileSync(path.join(dir, ".lock"), "utf8"),
    ) as { fence: number };
    const tB = await pB;
    writeGateOutcome(dir, String(wake.epoch), "ran", new Date(resumeAt + 1000));
    expect(tB.status).not.toBe("paused");
    expect(storeA.holdsLease()).toBe(false);
    expect(wake.written_fence).not.toBeNull();
    expect(leaseB.fence).toBeGreaterThan(wake.written_fence as number);

    // krok bez duplikátu: create přesně 2 pokusy (limit, pak úspěch), žádný třetí; dítě voláno 2×
    const create = attemptsOf("create-r0");
    expect(create.map((a) => [a.phase, a.finished?.ok])).toEqual([
      ["FINISHED", false],
      ["FINISHED", true],
    ]);
    expect(create[0].reconcile?.result).toBe("RETRY_SAFE");
    const o = storeB.load(ORDER_ID);
    expect(o.state).not.toBe("PAUSED");
    expect(o.history.filter((h) => h.event === "resume")).toHaveLength(1);
    expect(o.history.filter((h) => h.event === "limit")).toHaveLength(1);
    // next-wake zkonzumován pod lease B (consumed_fence > written_fence), v kořeni runs/ už neplatí pro tuto obnovu
    const consumed = fs.readdirSync(path.join(dir, "wake", "consumed"));
    expect(consumed).toHaveLength(1);
    const rec = JSON.parse(
      fs.readFileSync(path.join(dir, "wake", "consumed", consumed[0]), "utf8"),
    ) as { consumed_fence: number; written_fence: number };
    expect(rec.consumed_fence).toBeGreaterThan(rec.written_fence);
    expect(nextWake()?.epoch === wake.epoch).toBe(false);

    // další brány a ticky: žádné nové volání kroku create
    const before = calls();
    for (let s = wake.epoch + 60; s <= wake.epoch + 5 * 60; s += 60)
      if (gate(s).ticked)
        await makeOrch(
          new Store(dir),
          new CopyDepartment(new ShortClaude(), new FakeChecker()),
          () => s * 1000,
        ).tick();
    expect(calls()).toBe(before);
    expect(attemptsOf("create-r0")).toHaveLength(2);
  }, 60_000);

  it("výjimka: limit-hold z PR 4b (nevyřešený sentinel) se po resetu NEuvolní sám — brána tick spustí, ale krok neběží, dokud vlastník neověří", async () => {
    const t0 = Date.now();
    const t0s = Math.floor(t0 / 1000);
    const epoch = t0s + 10 * 60;
    fakeClaude("2.1.317 (Claude Code)", [
      { stdout: fixture("result-limit-epoch.jsonl", epoch), code: 1 },
      { stdout: success(DRAFT) },
    ]);
    const store = new Store(dir);
    seedDoing(store);
    expect(gate(t0s).ticked).toBe(true);
    const p1 = await makeOrch(
      store,
      new CopyDepartment(new ShortClaude(), new FakeChecker()),
      () => t0,
    ).tick();
    expect(p1).toMatchObject({ status: "paused" });
    const resumeAt = Date.parse((p1 as { resume_after: string }).resume_after);
    const wake = nextWake()!;
    // ztracené varování (PR 4b bod 1): sentinel bez vypršení
    const guard = new LimitGuard(dir, {
      now: () => new Date(t0),
      untilOf: () => ({
        until: new Date(t0).toISOString(),
        reset_source: "test",
      }),
    });
    guard.open("hold/test-4c");
    expect(guard.pending()).toHaveLength(1);

    expect(gate(wake.epoch)).toMatchObject({ ticked: true, reason: "a" });
    const t = await makeOrch(
      new Store(dir),
      new CopyDepartment(new ShortClaude(), new FakeChecker()),
      () => resumeAt + 1000,
    ).tick();
    expect(t).toMatchObject({ status: "limit_hold" });
    expect(calls()).toBe(1);
    expect(new Store(dir).load(ORDER_ID).state).toBe("PAUSED");
    // ani o 30 dní později
    const later = await makeOrch(
      new Store(dir),
      new CopyDepartment(new ShortClaude(), new FakeChecker()),
      () => resumeAt + 30 * 86_400_000,
    ).tick();
    expect(later).toMatchObject({ status: "limit_hold" });
    expect(calls()).toBe(1);

    // ruční ověření vlastníkem (cli.ts owner limit-hold OVERENO) → teprve teď pokračování
    expect(guard.verifyAll()).toBe(1);
    const t2 = await makeOrch(
      new Store(dir),
      new CopyDepartment(new ShortClaude(), new FakeChecker()),
      () => resumeAt + 2000,
    ).tick();
    expect(t2.status).not.toBe("limit_hold");
    expect(calls()).toBe(2);
    expect(new Store(dir).load(ORDER_ID).state).not.toBe("PAUSED");
  }, 60_000);
});

// ───────────────────────────── 5. pojistka §7 ─────────────────────────────

describe("PR 4c: pojistka §7 (DR-027) — žádný --bare, Agent SDK ani ANTHROPIC_API_KEY pro dítě", () => {
  const walk = (d: string): string[] =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory())
        return e.name === "__tests__" || e.name === "node_modules"
          ? []
          : walk(p);
      return /\.(ts|js|mjs|cjs|sh|py|json|plist)$/.test(e.name) ? [p] : [];
    });

  it("kód TARS (mimo testy) nespouští --bare ani Agent SDK; ANTHROPIC_API_KEY jen v seznamu odstraněných proměnných", () => {
    const hits: string[] = [];
    for (const f of walk(path.join(ROOT, "tars"))) {
      const text = fs.readFileSync(f, "utf8");
      text.split("\n").forEach((l, i) => {
        const rel = `${path.relative(ROOT, f)}:${i + 1}`;
        if (/--bare\b/.test(l)) hits.push(`${rel} --bare`);
        if (/claude-agent-sdk|@anthropic-ai\/claude-code\b/.test(l))
          hits.push(`${rel} agent-sdk`);
        if (
          /ANTHROPIC_API_KEY/.test(l) &&
          !(
            rel.startsWith("tars/orch/adapters.ts:") &&
            /^\s*"ANTHROPIC_API_KEY",\s*$/.test(l)
          )
        )
          hits.push(`${rel} ANTHROPIC_API_KEY`);
      });
    }
    expect(hits).toEqual([]);
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
    ) as Record<string, Record<string, string> | undefined>;
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.optionalDependencies,
    };
    expect(Object.keys(deps).filter((k) => /claude-agent-sdk/.test(k))).toEqual(
      [],
    );
  });

  it("watchdog env nikdy neobsahuje API klíč ani přepínač mimo tři ověřené názvy", () => {
    const e = watchdogEnv(
      WATCHDOG_VERIFIED_CLAUDE_VERSIONS[0],
      CLAUDE_HARD_LIMIT_MS,
    ).env;
    expect(Object.keys(e).sort()).toEqual([
      "CLAUDE_CODE_RETRY_WATCHDOG",
      "CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS",
      "CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS",
    ]);
  });

  it("provozně nic nezapnuto: dispatch.json zůstává mode hold, PR nepřidává plist", () => {
    const d = JSON.parse(
      fs.readFileSync(path.join(ROOT, "tars/orch/dispatch.json"), "utf8"),
    ) as { mode?: string };
    expect(d.mode).toBe("hold");
    const plists = fs
      .readdirSync(path.join(ROOT, "tars/orch/launchd"))
      .filter((f) => f.endsWith(".plist"));
    for (const p of plists)
      expect(
        fs.readFileSync(path.join(ROOT, "tars/orch/launchd", p), "utf8"),
      ).not.toMatch(/RETRY_WATCHDOG/);
  });
});
