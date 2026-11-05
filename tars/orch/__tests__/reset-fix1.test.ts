// Etapa 4 PR 1, FIX1 (Codex kolo 1): testy na všech 7 nálezů review-out-1.
// 1 čas resetu jen ze strukturované obálky CLI · 2 varování Q4-B s ověřitelným původem · 3 nerozpoznaný zbytek = nedoloženo
// 4 krátký zápis ve writeDurable · 5 fsync rodiče nového adresáře · 6 blokace Q4-B po zdrojích · 7 varování z gateMeta.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { privateDraftDeps } from "./private-target";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AiChain,
  ClaudeCli,
  CodexCli,
  type AdapterResult,
  type TextAdapter,
} from "../adapters";
import { CardRegistry } from "../cards";
import {
  CopyDepartment,
  VizualDepartment,
  type BrowserRunner,
  type DeptContext,
} from "../departments";
import { NotImplementedDesktop } from "../desktop";
import type { NotionClient } from "../notion";
import { LIMIT_WARNING_FILE, Orchestrator } from "../orchestrator";
import { limitWarning, parseReset } from "../reset";
import { Store, writeDurable } from "../store";
import { parseBrief } from "../supervisor";
import type { ModelFamily, Order } from "../types";

const PRAGUE = "Europe/Prague";
const RECEIVED = "2026-11-04T10:00:00.000Z";
const WARN6 = "Approaching usage limit · resets in 6 days";

function ok(r: ReturnType<typeof parseReset>) {
  if (!r.ok)
    throw new Error(`čekal jsem doložený reset, dostal jsem: ${r.reason}`);
  return r;
}
function nedolozeno(r: ReturnType<typeof parseReset>) {
  if (r.ok)
    throw new Error(
      `čekal jsem nedoloženo, dostal jsem ${r.at_utc} (${r.matched})`,
    );
  expect(r.source).toBe("nedoloženo");
  return r;
}

let dir: string;
let bin: string;
let oldPath: string | undefined;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-fix1-"));
  bin = fs.mkdtempSync(path.join(os.tmpdir(), "tars-fix1-bin-"));
  oldPath = process.env.PATH;
  process.env.PATH = `${bin}:${oldPath}`;
});
afterEach(() => {
  process.env.PATH = oldPath;
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(bin, { recursive: true, force: true });
});

/**
 * Falešné CLI na PATH. Uloží prompt ze stdin, volitelně ho vypíše na stderr (přepis promptu jako `codex exec`),
 * pak vypíše daný stderr/stdout a skončí kódem. U `codex` zapíše `lastMessage` do souboru za `-o`.
 */
function fakeCli(
  name: "claude" | "codex",
  o: {
    stdout?: string;
    stderr?: string;
    code?: number;
    echoPrompt?: boolean;
    lastMessage?: string;
  },
) {
  const d = path.join(bin, `${name}.d`);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "stdout"), o.stdout ?? "");
  fs.writeFileSync(path.join(d, "stderr"), o.stderr ?? "");
  fs.writeFileSync(path.join(d, "last"), o.lastMessage ?? "");
  const script = [
    "#!/bin/bash",
    `D="${d}"`,
    'out=""; while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift;; esac; shift; done',
    'cat > "$D/prompt"',
    o.echoPrompt
      ? 'printf "user\\n" >&2; cat "$D/prompt" >&2; printf "\\n" >&2'
      : "",
    'cat "$D/stderr" >&2',
    'cat "$D/stdout"',
    '[ -n "$out" ] && [ -s "$D/last" ] && cp "$D/last" "$out"',
    `exit ${o.code ?? 0}`,
  ].join("\n");
  fs.writeFileSync(path.join(bin, name), script + "\n", { mode: 0o755 });
}

// ─────────────── Nález 1: čas resetu jen ze strukturované obálky CLI ───────────────
describe("FIX1 nález 1: zdroj času resetu je oddělený od textu modelu", () => {
  it("claude: skutečné 429 bez času, citace „try again in 1 minute“ v odpovědi modelu → limit, ale žádný limit_text", async () => {
    fakeCli("claude", {
      stdout: JSON.stringify({
        is_error: false,
        result: "Uživatel cituje: Try again in 1 minute.",
      }),
      stderr: "API Error: 429 Too Many Requests\n",
      code: 1,
    });
    const r = await new ClaudeCli("sonnet").run("p", { cwd: dir });
    expect(r.limit).toBe(true);
    expect(r.limit_text).toBeUndefined();
    expect(r.limit_source).toBe("claude");
  });

  it("claude: stdout, který není JSON obálka (text modelu), nikdy není zdroj času", async () => {
    fakeCli("claude", {
      stdout: "rate limit — try again in 1 minute",
      code: 1,
    });
    const r = await new ClaudeCli("sonnet").run("p", { cwd: dir });
    expect(r.limit).toBe(true);
    expect(r.limit_text).toBeUndefined();
  });

  it("claude: stderr s „try again in 1 minute“ při obálce bez času → limit_text jen z obálky, reset nedoloženo", async () => {
    fakeCli("claude", {
      stdout: JSON.stringify({
        is_error: true,
        result: "API Error: 429 rate_limit_error",
      }),
      stderr: "try again in 1 minute\n",
      code: 1,
    });
    const r = await new ClaudeCli("sonnet").run("p", { cwd: dir });
    expect(r.limit).toBe(true);
    expect(r.limit_text).toBe("API Error: 429 rate_limit_error");
    nedolozeno(parseReset(r.limit_text!, r.received_at!, PRAGUE));
  });

  it("claude: chybová obálka CLI (is_error) s časem → doložený reset (pozitivní případ)", async () => {
    const epoch = Math.floor(Date.now() / 1000) + 3600;
    fakeCli("claude", {
      stdout: JSON.stringify({
        is_error: true,
        result: `Claude AI usage limit reached|${epoch}`,
      }),
      code: 1,
    });
    const r = await new ClaudeCli("sonnet").run("p", { cwd: dir });
    expect(r.limit).toBe(true);
    const p = ok(parseReset(r.limit_text!, r.received_at!, PRAGUE));
    expect(p.source).toBe("epoch");
    expect(p.at_utc).toBe(new Date(epoch * 1000).toISOString());
  });

  it("codex: stderr (přepis promptu i průběh modelu) nikdy není zdroj času → limit bez limit_text", async () => {
    fakeCli("codex", {
      stderr: "ERROR: You've hit your usage limit. Try again in 1 minute.\n",
      code: 1,
      echoPrompt: true,
    });
    const r = await new CodexCli().run("cituji: try again in 1 minute", {
      cwd: dir,
    });
    expect(r.limit).toBe(true);
    expect(r.limit_text).toBeUndefined();
    expect(r.limit_source).toBe("codex");
  });

  it("ai-chain: výstup run.sh (modely, prompty) nikdy není zdroj času", async () => {
    const runSh = path.join(bin, "run.sh");
    fs.writeFileSync(
      runSh,
      "#!/bin/bash\necho 'usage limit reached, try again in 1 minute'\nexit 1\n",
      { mode: 0o755 },
    );
    const r = await new AiChain(runSh).run("zadani.md", dir, dir, 10_000);
    expect(r.limit).toBe(true);
    expect(r.limit_text).toBeUndefined();
  });
});

// ─────────────── Nález 2: varování Q4-B jen s ověřitelným původem ───────────────
describe("FIX1 nález 2: varování musí mít ověřitelný původ", () => {
  it("limitWarning: citace uvnitř věty ani řádek obsažený v promptu/textu modelu nejsou varování", () => {
    expect(limitWarning(`model napsal: ${WARN6}`)).toBeUndefined();
    expect(limitWarning(WARN6, [`Posuď:\n${WARN6}\nkonec`])).toBeUndefined();
    expect(
      limitWarning(WARN6, [`odpověď modelu obsahuje ${WARN6}.`]),
    ).toBeUndefined();
    expect(limitWarning(`${"x".repeat(301)} ${WARN6}`)).toBeUndefined();
    // pozitivní: hláška CLI na začátku řádku, mimo prompt i text modelu
    expect(limitWarning(`\u001b[33m⚠ ${WARN6}\u001b[0m`, ["jiný prompt"])).toBe(
      `⚠ ${WARN6}`,
    );
    expect(limitWarning(`Warning: ${WARN6}`)).toBe(`Warning: ${WARN6}`);
  });

  it("claude: citace varování uvnitř přepisu promptu na stderr → žádné varování", async () => {
    fakeCli("claude", {
      stdout: JSON.stringify({ is_error: false, result: "hotovo" }),
      echoPrompt: true,
    });
    const r = await new ClaudeCli("sonnet").run(
      `Zkontroluj tento log:\n${WARN6}\nkonec logu`,
      { cwd: dir },
    );
    expect(r.ok).toBe(true);
    expect(r.limit_warning).toBeUndefined();
  });

  it("claude: řádek, který je v odpovědi modelu, se nebere ani ze stderr", async () => {
    fakeCli("claude", {
      stdout: JSON.stringify({ is_error: false, result: `Shrnutí:\n${WARN6}` }),
      stderr: `${WARN6}\n`,
    });
    const r = await new ClaudeCli("sonnet").run("p", { cwd: dir });
    expect(r.limit_warning).toBeUndefined();
  });

  it("claude: skutečná hláška CLI na stderr (mimo prompt a text modelu) → varování se zdrojem claude", async () => {
    fakeCli("claude", {
      stdout: JSON.stringify({ is_error: false, result: "hotovo" }),
      stderr: `${WARN6}\n`,
    });
    const r = await new ClaudeCli("sonnet").run("p", { cwd: dir });
    expect(r.limit_warning).toBe(WARN6);
    expect(r.limit_source).toBe("claude");
  });

  it("codex exec: stderr s promptem i průběhem modelu → varování se nebere nikdy (ani na začátku řádku)", async () => {
    fakeCli("codex", {
      stderr: `${WARN6}\n`,
      echoPrompt: true,
      lastMessage: "hotovo",
    });
    const r = await new CodexCli().run(`Citace:\n${WARN6}`, { cwd: dir });
    expect(r.ok).toBe(true);
    expect(r.limit_warning).toBeUndefined();
  });
});

// ─────────────── Nález 3: nerozpoznaný zbytek za časem = nedoloženo ───────────────
describe("FIX1 nález 3: nerozpoznaný suffix (zóna, datum, rok) = nedoloženo", () => {
  it("neznámá zóna za časem: „resets at 3pm PST“ / „(PST)“ / ISO s PST → nedoloženo", () => {
    nedolozeno(parseReset("resets at 3pm PST", RECEIVED, PRAGUE));
    nedolozeno(parseReset("resets at 3pm (PST)", RECEIVED, PRAGUE));
    nedolozeno(parseReset("resets at 3pm PT.", RECEIVED, PRAGUE));
    nedolozeno(
      parseReset("try again at 2026-11-04T15:00 PST", RECEIVED, PRAGUE),
    );
    nedolozeno(parseReset("resets at 15:00 UTC+1", RECEIVED, PRAGUE));
  });

  it("datum za časem se neignoruje: budoucí > 7 dní, minulé i bez roku → nedoloženo", () => {
    nedolozeno(
      parseReset("resets at 15:00 CET on Nov 20, 2026", RECEIVED, PRAGUE),
    );
    nedolozeno(
      parseReset("resets at 15:00 CET on Nov 1, 2026", RECEIVED, PRAGUE),
    );
    nedolozeno(parseReset("resets at 15:00, Nov 20", RECEIVED, PRAGUE));
    nedolozeno(parseReset("resets at 15:00 CET 2026", RECEIVED, PRAGUE));
    nedolozeno(parseReset("resets at 3pm. Nov 20", RECEIVED, PRAGUE));
    nedolozeno(parseReset("try again in 2 hours 30", RECEIVED, PRAGUE));
  });

  it("datum před časem se zpracuje správně: do 7 dní ok, > 7 dní a minulost nedoloženo", () => {
    const r = ok(
      parseReset("resets Nov 6, 2026 at 15:00 CET", RECEIVED, PRAGUE),
    );
    expect(r.at_utc).toBe("2026-11-06T14:00:00.000Z");
    nedolozeno(
      parseReset("resets Nov 20, 2026 at 15:00 CET", RECEIVED, PRAGUE),
    );
    nedolozeno(parseReset("resets Nov 1, 2026 at 15:00 CET", RECEIVED, PRAGUE));
  });

  it("pozitivní: konec věty, oddělovač, závorka se zónou, spojka a konec JSON pole zůstávají doložené", () => {
    expect(ok(parseReset("resets at 3pm.", RECEIVED, PRAGUE)).at_utc).toBe(
      "2026-11-04T14:00:00.000Z",
    );
    expect(
      ok(parseReset("resets at 3pm (Europe/Prague)", RECEIVED, PRAGUE)).at_utc,
    ).toBe("2026-11-04T14:00:00.000Z");
    expect(
      ok(parseReset("Try again at 5:13 PM or upgrade.", RECEIVED, PRAGUE))
        .at_utc,
    ).toBe("2026-11-04T16:13:00.000Z");
    expect(
      ok(parseReset("limit · resets 3pm · /upgrade", RECEIVED, PRAGUE)).at_utc,
    ).toBe("2026-11-04T14:00:00.000Z");
    expect(
      ok(parseReset('{"resetsAt":"2026-11-04T16:00:00Z"}', RECEIVED, PRAGUE))
        .at_utc,
    ).toBe("2026-11-04T16:00:00.000Z");
    expect(
      ok(parseReset("try again in 20 minutes, please", RECEIVED, PRAGUE))
        .at_utc,
    ).toBe("2026-11-04T10:20:00.000Z");
  });
});

// ─────────────── Nález 4 a 5: trvalost ───────────────
describe("FIX1 nález 4: writeDurable zapíše všechny bajty, krátký zápis = chyba bez rename", () => {
  it("částečné zápisy se dopíšou ve smyčce, obsah je úplný", () => {
    const f = path.join(dir, "state.json");
    const real = fs.writeSync.bind(fs) as (
      fd: number,
      b: Buffer,
      o: number,
      l: number,
    ) => number;
    const content = JSON.stringify({
      text: "příliš žluťoučký kůň ".repeat(50),
    });
    const spy = vi
      .spyOn(fs, "writeSync")
      .mockImplementation(((fd: number, b: Buffer, o: number, l: number) =>
        real(fd, b, o, Math.min(l, 7))) as typeof fs.writeSync);
    writeDurable(f, content);
    expect(spy.mock.calls.length).toBeGreaterThan(1);
    expect(fs.readFileSync(f, "utf8")).toBe(content);
  });

  it("zápis, který nepostoupí (0 B), je chyba: původní soubor beze změny, žádný tmp, žádný rename", () => {
    const f = path.join(dir, "state.json");
    fs.writeFileSync(f, '{"v":1}\n');
    const real = fs.writeSync.bind(fs) as (
      fd: number,
      b: Buffer,
      o: number,
      l: number,
    ) => number;
    let first = true;
    vi.spyOn(fs, "writeSync").mockImplementation(((
      fd: number,
      b: Buffer,
      o: number,
      l: number,
    ) => {
      if (first) {
        first = false;
        return real(fd, b, o, Math.min(l, 3));
      }
      return 0;
    }) as typeof fs.writeSync);
    const rename = vi.spyOn(fs, "renameSync");
    expect(() => writeDurable(f, '{"v":2,"dlouhy":"obsah"}\n')).toThrow(
      /krátký zápis 3\//,
    );
    expect(rename).not.toHaveBeenCalled();
    expect(fs.readFileSync(f, "utf8")).toBe('{"v":1}\n');
    expect(fs.readdirSync(dir).filter((x) => x.endsWith(".tmp"))).toEqual([]);
  });

  it("Store.save při krátkém zápisu vyhodí chybu a stav zůstane čitelný v původní verzi", () => {
    const store = new Store(dir);
    const o: Order = {
      id: "wo-short",
      mission: "m",
      state: "NEW",
      created_at: "x",
      updated_at: "x",
      fix_rounds: 0,
      manual_interventions: 0,
      history: [],
      meta: {},
    };
    expect(store.save(o)).toBe(true);
    vi.spyOn(fs, "writeSync").mockImplementation(
      (() => 0) as unknown as typeof fs.writeSync,
    );
    expect(() => store.save({ ...o, state: "PLANNED" })).toThrow(
      /krátký zápis/,
    );
    vi.restoreAllMocks();
    expect(store.load("wo-short")).toMatchObject({ state: "NEW", version: 1 });
  });
});

describe("FIX1 nález 5: nový adresář zakázky se zapíše trvale i v rodiči runs/", () => {
  function dirFsyncs(fn: () => void): string[] {
    const opened = new Map<number, string>();
    const realOpen = fs.openSync.bind(fs) as (
      p: fs.PathLike,
      f?: fs.OpenMode,
    ) => number;
    vi.spyOn(fs, "openSync").mockImplementation(((
      p: fs.PathLike,
      f?: fs.OpenMode,
    ) => {
      const fd = realOpen(p, f);
      if (f === "r") opened.set(fd, path.resolve(String(p)));
      return fd;
    }) as typeof fs.openSync);
    const synced: string[] = [];
    const realFsync = fs.fsyncSync.bind(fs);
    vi.spyOn(fs, "fsyncSync").mockImplementation((fd: number) => {
      if (opened.has(fd)) synced.push(opened.get(fd)!);
      realFsync(fd);
    });
    fn();
    vi.restoreAllMocks();
    return synced;
  }

  it("první save nové zakázky: fsync runs/ (položka adresáře) i adresáře zakázky; další save už runs/ ne", () => {
    const store = new Store(dir);
    const runs = path.resolve(dir);
    const o: Order = {
      id: "wo-new",
      mission: "m",
      state: "NEW",
      created_at: "x",
      updated_at: "x",
      fix_rounds: 0,
      manual_interventions: 0,
      history: [],
      meta: {},
    };
    const first = dirFsyncs(() => expect(store.save(o)).toBe(true));
    expect(first).toContain(runs);
    expect(first).toContain(path.join(runs, "wo-new"));
    const again = dirFsyncs(() => expect(store.save(o)).toBe(true));
    expect(again).not.toContain(runs);
    expect(again).toContain(path.join(runs, "wo-new"));
  });

  it("vnořený nový adresář (writeFile do podadresáře, nový runs/ ve Store) fsyncne každého rodiče", () => {
    const nested = path.join(dir, "a", "runs");
    const s = dirFsyncs(() => new Store(nested));
    expect(s).toEqual([path.resolve(dir, "a"), path.resolve(dir)]);
    const store = new Store(nested);
    const w = dirFsyncs(() => store.writeFile("wo-x", "shots/x.md", "obsah"));
    expect(w).toEqual(
      expect.arrayContaining([
        path.resolve(nested),
        path.resolve(nested, "wo-x"),
        path.resolve(nested, "wo-x", "shots"),
      ]),
    );
  });
});

// ─────────────── Nález 6 a 7: orchestrátor a oddělení ───────────────
type Reply = Partial<AdapterResult>;
class MockAdapter implements TextAdapter {
  calls: string[] = [];
  name = "mock";
  constructor(
    public family: ModelFamily,
    public model: string,
    private replies: Reply[],
  ) {}
  async run(prompt: string): Promise<AdapterResult> {
    this.calls.push(prompt);
    const r = this.replies.length > 1 ? this.replies.shift()! : this.replies[0];
    return { ok: true, text: "", limit: false, duration_ms: 5, ...r };
  }
}
class MockNotion implements NotionClient {
  pages: Array<{ title: string; md: string }> = [];
  async createPage(_p: string, title: string, md: string) {
    this.pages.push({ title, md });
    return { url: `https://app.notion.com/p/mock${this.pages.length}` };
  }
  async readPage(url: string) {
    return this.pages[Number(/mock(\d+)$/.exec(url)?.[1]) - 1].md;
  }
}
class MockBrowser implements BrowserRunner {
  async run() {
    return {
      reads: ["návrh"],
      screenshots: [],
      finalUrl: "https://claude.ai/design/p/mock",
    };
  }
}

const CARDS_DIR = path.join(__dirname, "..", "..", "..", ".claude", "agents");
const BRIEF =
  "```json\n" +
  JSON.stringify({
    title: "Návrh mikrocopy formuláře",
    department: "copy",
    milestone: "3.1",
    why: "DALŠÍ KROK: paralelně běží 3.1",
    goal: "Navrhnout texty chybových stavů",
    inputs: ["fakt A"],
    acceptance: ["kritérium 1"],
    owner_decisions: [],
    sources: [
      "handoff",
      "capsule",
      "buildos",
      "funnel",
      "ui_build_brief",
      "copy_handoff",
    ],
  }) +
  "\n```";
const DRAFT = `# Draft\n\n${"Tichý, sebejistý text. ".repeat(30)}\n\n## Kontrola kritérií\n- ok`;
const PASS = '```json\n{"verdict":"PASS","issues":[]}\n```';

function orch(
  store: Store,
  opts: {
    now: () => Date;
    creator?: Reply[];
    checker?: Reply[];
    creatorAdapter?: TextAdapter;
  },
) {
  const supervisor = new MockAdapter("claude", "opus", [{ text: BRIEF }]);
  const creator =
    opts.creatorAdapter ??
    new MockAdapter("claude", "opus", opts.creator ?? [{ text: DRAFT }]);
  const checker = new MockAdapter(
    "gpt",
    "gpt-web",
    opts.checker ?? [{ text: PASS }],
  );
  const o = new Orchestrator({
    store,
    supervisor,
    briefChecker: new MockAdapter("gpt", "gpt-brief", [{ text: PASS }]),
    departments: { copy: new CopyDepartment(creator, checker) },
    cards: new CardRegistry(CARDS_DIR),
    ladder: {
      hasCli: () => true,
      browserReady: () => ({
        ok: false,
        reasons: ["profil TARS-agent není přihlášen"],
      }),
      desktopReady: () => new NotImplementedDesktop().preflight(),
    },
    notion: new MockNotion(),
    guard: () => ({ alarm: false, summary: "TARS-GUARD OK (7/7)" }),
    ...privateDraftDeps(store.runsDir), // etapa 4 PR 5 (N14): ověřený soukromý cíl DRAFTu
    repoRoot: store.runsDir,
    capsulePath: path.join(store.runsDir, "capsule.md"),
    now: opts.now,
    panelCreateGuardMs: 0,
  });
  return { o, supervisor };
}

describe("FIX1 nález 1 (orchestrátor): bez limit_text se čas resetu nebere z error", () => {
  it("limit s „try again in 1 minute“ jen v error (text modelu) → nedoloženo, pauseMinutes", async () => {
    const store = new Store(dir);
    const t0 = Date.parse(RECEIVED);
    const { o } = orch(store, {
      now: () => new Date(t0),
      creator: [
        {
          ok: false,
          limit: true,
          error: "exit 1: model: try again in 1 minute",
          received_at: RECEIVED,
        },
      ],
    });
    expect((await o.tick()).status).toBe("paused");
    const p = store.listOrders()[0];
    expect(p.resume_after).toBe(new Date(t0 + 60 * 60_000).toISOString());
    expect(p.meta.reset_source).toBe("nedoloženo");
  });
});

describe("FIX1 nález 6: blokace Q4-B po zdrojích, platí nejpozdější until každého zdroje", () => {
  it("varování claude (reset za 3 dny) nepřepíše pozdější varování codex bez času (fallback 60 min)", async () => {
    const store = new Store(dir);
    const t0 = Date.parse(RECEIVED);
    let t = t0;
    const claudeUntil = new Date(t0 + 3 * 86_400_000 + 60_000).toISOString();
    const { o, supervisor } = orch(store, {
      now: () => new Date(t),
      creator: [
        {
          text: DRAFT,
          limit_warning:
            "Heads up, you've used over 90% of your weekly limit · resets in 3 days",
          limit_source: "claude",
          received_at: RECEIVED,
        },
      ],
      checker: [
        {
          text: PASS,
          limit_warning: "Approaching usage limit",
          limit_source: "codex",
          received_at: RECEIVED,
        },
      ],
    });
    expect(await o.tick()).toMatchObject({ status: "advanced", state: "DONE" });
    const rec = JSON.parse(
      fs.readFileSync(path.join(dir, LIMIT_WARNING_FILE), "utf8"),
    );
    expect(rec.sources.claude.until).toBe(claudeUntil);
    expect(rec.sources.codex.until).toBe(
      new Date(t0 + 60 * 60_000).toISOString(),
    );
    expect(rec.until).toBe(claudeUntil);
    const calls = supervisor.calls.length;
    t = t0 + 2 * 3600_000; // codex fallback vypršel, claude platí dál
    expect(await o.tick()).toEqual({
      status: "limit_warning",
      until: claudeUntil,
    });
    expect(store.listOrders()).toHaveLength(1);
    expect(supervisor.calls).toHaveLength(calls);
  });

  it("starý formát souboru (jeden záznam s until) dál blokuje jako zdroj legacy", async () => {
    const store = new Store(dir);
    const t0 = Date.parse(RECEIVED);
    const legacy = new Date(t0 + 2 * 86_400_000).toISOString();
    fs.writeFileSync(
      path.join(dir, LIMIT_WARNING_FILE),
      JSON.stringify({ until: legacy }),
    );
    let t = t0;
    const { o } = orch(store, { now: () => new Date(t) });
    expect(await o.tick()).toEqual({ status: "limit_warning", until: legacy });
    t = Date.parse(legacy) + 1;
    expect(await o.tick()).toMatchObject({ status: "advanced", state: "DONE" });
  });

  it("merge: nevypršená blokace téhož zdroje se kratším varováním nezkrátí a legacy záznam se přenese", async () => {
    const store = new Store(dir);
    const t0 = Date.parse(RECEIVED);
    const far = new Date(t0 + 5 * 86_400_000).toISOString();
    const legacy = new Date(t0 + 2 * 86_400_000).toISOString();
    // Zakázka vznikne bez blokace; blokace jiného běhu se objeví až během tvorby draftu.
    class Planting extends MockAdapter {
      async run(prompt: string): Promise<AdapterResult> {
        fs.writeFileSync(
          path.join(dir, LIMIT_WARNING_FILE),
          JSON.stringify({
            v: 2,
            until: far,
            sources: { claude: { until: far }, legacy: { until: legacy } },
          }),
        );
        return super.run(prompt);
      }
    }
    const planting = new Planting("claude", "opus", [
      {
        text: DRAFT,
        limit_warning: "Approaching usage limit",
        limit_source: "claude",
        received_at: RECEIVED,
      },
    ]);
    const { o } = orch(store, {
      now: () => new Date(t0),
      creatorAdapter: planting,
    });
    expect(await o.tick()).toMatchObject({ status: "advanced", state: "DONE" });
    const rec = JSON.parse(
      fs.readFileSync(path.join(dir, LIMIT_WARNING_FILE), "utf8"),
    );
    expect(rec.sources.claude.until).toBe(far); // kratší fallback 60 min blokaci nezkrátil
    expect(rec.sources.legacy.until).toBe(legacy);
    expect(rec.until).toBe(far);
  });
});

describe("FIX1 nález 7: varování z více adaptérů v jednom kroku se neztratí", () => {
  const order = (store: Store): Order => {
    store.writeFile("wo-v", "draft-v0.md", DRAFT);
    return {
      id: "wo-v",
      mission: "m",
      state: "CHECKING",
      created_at: "x",
      updated_at: "x",
      fix_rounds: 0,
      manual_interventions: 0,
      history: [],
      meta: {},
      brief: parseBrief(BRIEF),
      draft_file: "draft-v0.md",
    };
  };
  const ctx = (store: Store) =>
    ({
      store,
      notion: new MockNotion(),
      draftParentId: "p",
      repoRoot: dir,
    }) as unknown as DeptContext;

  it("Vizuál: PASS brány + PASS gateMeta s varováním CLI → varování gateMeta je ve výsledku", async () => {
    const store = new Store(dir);
    const gate = new MockAdapter("gpt", "gate", [{ text: PASS }]);
    const meta = new MockAdapter("claude", "sonnet", [
      {
        text: PASS,
        limit_warning: WARN6,
        limit_source: "claude",
        received_at: RECEIVED,
      },
    ]);
    const out = await new VizualDepartment(
      new MockBrowser(),
      gate,
      "",
      "",
      meta,
    ).check(order(store), ctx(store));
    expect(out.verdict).toBe("PASS");
    expect(out.limit_warnings).toEqual([
      {
        source: "claude",
        text: WARN6,
        received_at: RECEIVED,
        model: "meta sonnet",
      },
    ]);
  });

  it("Vizuál: varování brány i gateMeta se sloučí; meta neprošla → obě varování zůstanou", async () => {
    const store = new Store(dir);
    const gate = new MockAdapter("gpt", "gate", [
      {
        text: PASS,
        limit_warning: "Approaching usage limit",
        limit_source: "codex",
      },
    ]);
    const meta = new MockAdapter("claude", "sonnet", [
      {
        text: '```json\n{"verdict":"FIX","issues":["chybí odkaz"]}\n```',
        limit_warning: WARN6,
        limit_source: "claude",
      },
    ]);
    const out = await new VizualDepartment(
      new MockBrowser(),
      gate,
      "",
      "",
      meta,
    ).check(order(store), ctx(store));
    expect(out.ok).toBe(false);
    expect(out.limit_warnings?.map((w) => w.source).sort()).toEqual([
      "claude",
      "codex",
    ]);
    const failed = new MockAdapter("claude", "sonnet", [
      { ok: false, error: "exit 1" },
    ]);
    const gate2 = new MockAdapter("gpt", "gate", [
      {
        text: PASS,
        limit_warning: "Approaching usage limit",
        limit_source: "codex",
      },
    ]);
    const out2 = await new VizualDepartment(
      new MockBrowser(),
      gate2,
      "",
      "",
      failed,
    ).check(order(store), ctx(store));
    expect(out2.limit_warnings?.map((w) => w.source)).toEqual(["codex"]);
  });

  it("Copy: nečitelný verdikt kontrolora nezahodí jeho varování", async () => {
    const store = new Store(dir);
    const checker = new MockAdapter("claude", "opus", [
      { text: "bez JSON", limit_warning: WARN6, limit_source: "claude" },
    ]);
    const out = await new CopyDepartment(
      new MockAdapter("gpt", "gpt", [{}]),
      checker,
    ).check(order(store), ctx(store));
    expect(out.ok).toBe(false);
    expect(out.limit_warnings?.[0]?.text).toBe(WARN6);
  });

  it("orchestrátor: varování gateMeta zablokuje novou zakázku (konec Q4-B obejití)", async () => {
    const store = new Store(dir);
    const t0 = Date.parse(RECEIVED);
    const { o } = orch(store, {
      now: () => new Date(t0),
      checker: [
        {
          text: PASS,
          limit_warning: WARN6,
          limit_source: "claude",
          received_at: RECEIVED,
        },
      ],
    });
    expect(await o.tick()).toMatchObject({ state: "DONE" });
    expect(await o.tick()).toEqual({
      status: "limit_warning",
      until: new Date(t0 + 6 * 86_400_000 + 60_000).toISOString(),
    });
  });
});
