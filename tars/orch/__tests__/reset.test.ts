// Etapa 4, PR 1: parser času resetu (§10.3), LIMIT_RE a api_retry, napojení na resume_after (Q4-A), Q4-B,
// trvalé zápisy Store.save / Store.writeFile (§0 bod 4) a re-entry test z §14 řádku PR 1.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isApiRetryRateLimit,
  looksLikeLimit,
  type AdapterResult,
  type TextAdapter,
} from "../adapters";
import { CardRegistry } from "../cards";
import { CopyDepartment } from "../departments";
import { NotImplementedDesktop } from "../desktop";
import type { NotionClient } from "../notion";
import {
  LIMIT_WARNING_FILE,
  Orchestrator,
  RESET_MARGIN_MS,
} from "../orchestrator";
import { limitWarning, parseReset } from "../reset";
import { Store } from "../store";
import type { ModelFamily, Order } from "../types";

const PRAGUE = "Europe/Prague";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

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

describe("parseReset (§10.3)", () => {
  it("relativní čas se počítá od received_at, ne od teď", () => {
    const text =
      "You've hit your usage limit. Try again in 2 hours 13 minutes.";
    const r = ok(parseReset(text, "2026-11-04T10:00:00.000Z", PRAGUE));
    expect(r.source).toBe("relative");
    expect(r.at_utc).toBe("2026-11-04T12:13:00.000Z");
    expect(r.at_local).toBe("2026-11-04T13:13:00+01:00");
    expect(r.raw_zone).toBeNull();
    expect(r.evidence_hash).toBe(sha(text));
    // jiný received_at = jiný reset: hodiny procesu se nepoužijí
    expect(
      ok(parseReset(text, "2026-11-04T11:00:00.000Z", PRAGUE)).at_utc,
    ).toBe("2026-11-04T13:13:00.000Z");
  });

  it("relativní zkratky (4h 12m, 90 seconds, 3 days)", () => {
    expect(
      ok(parseReset("resets in 4h 12m", "2026-11-04T10:00:00Z", PRAGUE)).at_utc,
    ).toBe("2026-11-04T14:12:00.000Z");
    expect(
      ok(
        parseReset(
          "Please try again in 90 seconds",
          "2026-11-04T10:00:00Z",
          PRAGUE,
        ),
      ).at_utc,
    ).toBe("2026-11-04T10:01:30.000Z");
    expect(
      ok(
        parseReset(
          "weekly limit, try again in 3 days",
          "2026-11-04T10:00:00Z",
          PRAGUE,
        ),
      ).at_utc,
    ).toBe("2026-11-07T10:00:00.000Z");
  });

  it("relativní bez čísla = nedoloženo", () => {
    nedolozeno(
      parseReset("try again in a few minutes", "2026-11-04T10:00:00Z", PRAGUE),
    );
  });

  it("ISO s offsetem zachová offset", () => {
    const r = ok(
      parseReset(
        "Limit reached, resets at 2026-11-04T17:30:00+01:00",
        "2026-11-04T10:00:00Z",
        PRAGUE,
      ),
    );
    expect(r.source).toBe("iso");
    expect(r.at_utc).toBe("2026-11-04T16:30:00.000Z");
    expect(r.at_local).toBe("2026-11-04T17:30:00+01:00");
    expect(r.raw_zone).toBe("+01:00");
  });

  it("ISO se Z a JSON pole resetsAt", () => {
    const r = ok(
      parseReset(
        '{"error":"rate_limit","resetsAt":"2026-11-04T16:00:00Z"}',
        "2026-11-04T10:00:00Z",
        PRAGUE,
      ),
    );
    expect(r.at_utc).toBe("2026-11-04T16:00:00.000Z");
    expect(r.at_local).toBe("2026-11-04T16:00:00Z");
  });

  it("epoch z hlášky „limit reached|<epoch>“", () => {
    const epoch = Date.parse("2026-11-04T15:00:00Z") / 1000;
    const r = ok(
      parseReset(
        `Claude AI usage limit reached|${epoch}`,
        "2026-11-04T10:00:00Z",
        PRAGUE,
      ),
    );
    expect(r.source).toBe("epoch");
    expect(r.at_utc).toBe("2026-11-04T15:00:00.000Z");
    expect(r.raw_zone).toBe("UTC");
  });

  it("čas dne s IANA zónou v závorce: nejbližší výskyt po received_at", () => {
    const r = ok(
      parseReset(
        "5-hour limit reached ∙ resets 3pm (Europe/Prague)",
        "2026-11-04T10:00:00Z",
        PRAGUE,
      ),
    );
    expect(r.source).toBe("clock");
    expect(r.at_utc).toBe("2026-11-04T14:00:00.000Z");
    expect(r.at_local).toBe("2026-11-04T15:00:00+01:00");
    expect(r.raw_zone).toBe("Europe/Prague");
    // po 15:00 místního času → zítra
    expect(
      ok(
        parseReset(
          "resets 3pm (Europe/Prague)",
          "2026-11-04T15:00:00Z",
          PRAGUE,
        ),
      ).at_utc,
    ).toBe("2026-11-05T14:00:00.000Z");
  });

  it("čas dne v jiné IANA zóně a ve výchozí zóně", () => {
    expect(
      ok(
        parseReset(
          "resets 9am (America/New_York)",
          "2026-11-04T10:00:00Z",
          PRAGUE,
        ),
      ).at_utc,
    ).toBe("2026-11-04T14:00:00.000Z");
    expect(
      ok(parseReset("try again at 5:13 PM.", "2026-11-04T10:00:00Z", PRAGUE))
        .at_local,
    ).toBe("2026-11-04T17:13:00+01:00");
    expect(
      ok(parseReset("try again at 17:13", "2026-11-04T10:00:00Z", PRAGUE))
        .at_utc,
    ).toBe("2026-11-04T16:13:00.000Z");
  });

  it("neznámá IANA zóna = nedoloženo", () => {
    nedolozeno(
      parseReset("resets 3pm (Mars/Olympus)", "2026-11-04T10:00:00Z", PRAGUE),
    );
  });

  it("UTC a GMT", () => {
    expect(
      ok(parseReset("resets at 15:00 UTC", "2026-11-04T10:00:00Z", PRAGUE))
        .at_utc,
    ).toBe("2026-11-04T15:00:00.000Z");
    expect(
      ok(parseReset("resets at 3pm GMT", "2026-11-04T10:00:00Z", PRAGUE))
        .at_local,
    ).toBe("2026-11-04T15:00:00Z");
  });

  it("CET/CEST jen při shodě se skutečným offsetem Europe/Prague", () => {
    // listopad: Praha +01:00 → CET platí, CEST ne
    expect(
      ok(parseReset("resets at 15:00 CET", "2026-11-04T10:00:00Z", PRAGUE))
        .at_local,
    ).toBe("2026-11-04T15:00:00+01:00");
    nedolozeno(
      parseReset("resets at 15:00 CEST", "2026-11-04T10:00:00Z", PRAGUE),
    );
    // červenec: Praha +02:00 → CEST platí, CET ne
    expect(
      ok(parseReset("resets at 15:00 CEST", "2026-07-01T10:00:00Z", PRAGUE))
        .at_utc,
    ).toBe("2026-07-01T13:00:00.000Z");
    nedolozeno(
      parseReset("resets at 15:00 CET", "2026-07-01T10:00:00Z", PRAGUE),
    );
  });

  it("DST gap 2026-03-29 Europe/Prague (02:00–02:59 neexistuje) bez offsetu = nedoloženo", () => {
    const r = nedolozeno(
      parseReset("resets at 2:30am", "2026-03-29T00:10:00Z", PRAGUE),
    );
    expect(r.reason).toMatch(/DST gap/);
    nedolozeno(
      parseReset("resets Mar 29 at 02:30", "2026-03-28T20:00:00Z", PRAGUE),
    );
    // těsně za mezerou je čas jednoznačný: 03:30 CEST
    expect(
      ok(parseReset("resets at 3:30am", "2026-03-29T00:10:00Z", PRAGUE)).at_utc,
    ).toBe("2026-03-29T01:30:00.000Z");
    // s offsetem v textu je okamžik doložený
    expect(
      ok(
        parseReset(
          "resets at 2026-03-29T03:30:00+02:00",
          "2026-03-29T00:10:00Z",
          PRAGUE,
        ),
      ).at_utc,
    ).toBe("2026-03-29T01:30:00.000Z");
  });

  it("DST fold 2026-10-25 Europe/Prague (02:00–02:59 dvakrát) bez offsetu = nedoloženo", () => {
    const r = nedolozeno(
      parseReset("resets at 2:30am", "2026-10-24T23:00:00Z", PRAGUE),
    );
    expect(r.reason).toMatch(/DST fold/);
    nedolozeno(
      parseReset("resets at 2026-10-25 02:30", "2026-10-24T20:00:00Z", PRAGUE),
    );
    // s offsetem jsou oba výskyty rozlišené
    expect(
      ok(
        parseReset(
          "resets at 2026-10-25T02:30:00+02:00",
          "2026-10-24T20:00:00Z",
          PRAGUE,
        ),
      ).at_utc,
    ).toBe("2026-10-25T00:30:00.000Z");
    expect(
      ok(
        parseReset(
          "resets at 2026-10-25T02:30:00+01:00",
          "2026-10-24T20:00:00Z",
          PRAGUE,
        ),
      ).at_utc,
    ).toBe("2026-10-25T01:30:00.000Z");
    // CEST/CET v foldu: zkratka určí, který výskyt, a musí sedět se skutečným offsetem
    expect(
      ok(parseReset("resets at 02:30 CEST", "2026-10-24T23:00:00Z", PRAGUE))
        .at_utc,
    ).toBe("2026-10-25T00:30:00.000Z");
    expect(
      ok(parseReset("resets at 02:30 CET", "2026-10-24T23:00:00Z", PRAGUE))
        .at_utc,
    ).toBe("2026-10-25T01:30:00.000Z");
  });

  it("12h čas bez AM/PM = nedoloženo", () => {
    expect(
      nedolozeno(parseReset("resets at 5:00", "2026-11-04T10:00:00Z", PRAGUE))
        .reason,
    ).toMatch(/12h/);
    nedolozeno(
      parseReset("try again at 12:30", "2026-11-04T10:00:00Z", PRAGUE),
    );
    nedolozeno(parseReset("resets at 5", "2026-11-04T10:00:00Z", PRAGUE));
    // jednoznačný 24h zápis projde
    ok(parseReset("resets at 05:00", "2026-11-04T10:00:00Z", PRAGUE));
    ok(parseReset("resets at 00:30", "2026-11-04T10:00:00Z", PRAGUE));
  });

  it("výsledek dál než 7 dní = nedoloženo", () => {
    expect(
      nedolozeno(
        parseReset("try again in 8 days", "2026-11-04T10:00:00Z", PRAGUE),
      ).reason,
    ).toMatch(/7 dní/);
    nedolozeno(
      parseReset(
        "resets at 2026-11-20T10:00:00Z",
        "2026-11-04T10:00:00Z",
        PRAGUE,
      ),
    );
    nedolozeno(
      parseReset("resets Nov 30 at 3pm", "2026-11-04T10:00:00Z", PRAGUE),
    );
    // přesně 7 dní ještě platí
    ok(parseReset("try again in 7 days", "2026-11-04T10:00:00Z", PRAGUE));
  });

  it("reset v minulosti, bez času, nebo neplatný received_at = nedoloženo", () => {
    nedolozeno(
      parseReset(
        "resets at 2026-11-04T09:00:00Z",
        "2026-11-04T10:00:00Z",
        PRAGUE,
      ),
    );
    nedolozeno(
      parseReset(
        "You've hit your usage limit.",
        "2026-11-04T10:00:00Z",
        PRAGUE,
      ),
    );
    nedolozeno(parseReset("try again in 2 hours", "není čas", PRAGUE));
  });

  it("system/api_retry je jen doklad třídy limitu, ne čas resetu", () => {
    const line = JSON.stringify({
      type: "system",
      subtype: "api_retry",
      attempt: 1,
      retry_delay_ms: 30000,
      error: "rate_limit",
      message: "resets at 2026-11-04T16:00:00Z",
    });
    expect(isApiRetryRateLimit(line)).toBe(true);
    expect(looksLikeLimit(line)).toBe(true);
    nedolozeno(parseReset(line, "2026-11-04T10:00:00Z", PRAGUE));
    expect(
      isApiRetryRateLimit(
        JSON.stringify({
          type: "system",
          subtype: "api_retry",
          error: "overloaded",
        }),
      ),
    ).toBe(false);
  });

  it("evidence_hash je otisk vstupního textu i u nedoloženo", () => {
    const t = "resets at 5:00";
    expect(parseReset(t, "2026-11-04T10:00:00Z", PRAGUE).evidence_hash).toBe(
      sha(t),
    );
  });
});

describe("LIMIT_RE a varování (Q4-B)", () => {
  it("LIMIT_RE pozná „try again at/in“", () => {
    expect(looksLikeLimit("You've hit your limit. Try again at 5:13 PM.")).toBe(
      true,
    );
    expect(looksLikeLimit("try again in 2 hours")).toBe(true);
    expect(looksLikeLimit("all good")).toBe(false);
  });

  it("varování o blížícím se limitu se pozná, limit sám ne", () => {
    expect(
      limitWarning(
        "⚠ Heads up, you've used over 90% of your 5h limit. Run /status.",
      ),
    ).toMatch(/90%/);
    expect(limitWarning("Approaching usage limit · resets at 3pm")).toMatch(
      /Approaching/,
    );
    expect(limitWarning("hotovo")).toBeUndefined();
  });
});

// ─── orchestrátor: mocky jako v orch.test.ts ───
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

let dir: string;
let store: Store;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-reset-"));
  store = new Store(dir);
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

function orch(opts: {
  now: () => Date;
  supervisor?: Reply[];
  creator?: Reply[];
  checker?: Reply[];
}) {
  const supervisor = new MockAdapter(
    "claude",
    "opus",
    opts.supervisor ?? [{ text: BRIEF }],
  );
  const creator = new MockAdapter(
    "claude",
    "opus",
    opts.creator ?? [{ text: DRAFT }],
  );
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
    draftParentId: "parent",
    repoRoot: dir,
    capsulePath: path.join(dir, "capsule.md"),
    now: opts.now,
    panelCreateGuardMs: 0,
  });
  return { o, supervisor, creator, checker };
}

describe("napojení resume_after (Q4-A, §10.3)", () => {
  it("doložený reset → resume_after = reset + 1 min a meta.reset_* s dokladem", async () => {
    const t0 = Date.parse("2026-11-04T10:00:00Z");
    let t = t0;
    const text = "You've hit your usage limit. Try again in 20 minutes.";
    const { o } = orch({
      now: () => new Date(t),
      creator: [
        {
          ok: false,
          limit: true,
          error: "exit 1: limit",
          limit_text: text,
          received_at: "2026-11-04T10:00:00.000Z",
        },
        { text: DRAFT },
      ],
    });
    expect((await o.tick()).status).toBe("paused");
    const p = store.listOrders()[0];
    expect(p.resume_after).toBe(
      new Date(t0 + 20 * 60_000 + RESET_MARGIN_MS).toISOString(),
    );
    expect(p.meta.reset_source).toBe("relative");
    expect(p.meta.reset_at_utc).toBe("2026-11-04T10:20:00.000Z");
    expect(p.meta.reset_evidence).toBe(sha(text));
    t = t0 + 20 * 60_000; // reset nastal, ale rezerva 1 min ještě ne
    expect((await o.tick()).status).toBe("paused");
    t = t0 + 21 * 60_000;
    expect(await o.tick()).toMatchObject({ status: "advanced", state: "DONE" });
  });

  it("nedoloženo → dnešní pauseMinutes a meta.reset_source = nedoloženo", async () => {
    const t0 = Date.parse("2026-11-04T10:00:00Z");
    const { o } = orch({
      now: () => new Date(t0),
      creator: [{ ok: false, limit: true, error: "usage limit" }],
    });
    expect((await o.tick()).status).toBe("paused");
    const p = store.listOrders()[0];
    expect(p.resume_after).toBe(new Date(t0 + 60 * 60_000).toISOString());
    expect(p.meta.reset_source).toBe("nedoloženo");
    expect(p.meta.reset_at_utc).toBeUndefined();
  });
});

describe("Q4-B: po doloženém varování nezačínat novou zakázku", () => {
  it("varování → zakázka dojde do konce, další tick novou nezačne, po resetu + 1 min ano", async () => {
    const t0 = Date.parse("2026-11-04T10:00:00Z");
    let t = t0;
    const warn =
      "Heads up, you've used over 90% of your 5h limit · resets 3pm (Europe/Prague)";
    const { o, supervisor } = orch({
      now: () => new Date(t),
      creator: [
        {
          text: DRAFT,
          limit_warning: warn,
          received_at: "2026-11-04T10:00:00.000Z",
        },
      ],
    });
    // rozpracovaná zakázka pokračuje i po varování až do DONE
    expect(await o.tick()).toMatchObject({ status: "advanced", state: "DONE" });
    const rec = JSON.parse(
      fs.readFileSync(path.join(dir, LIMIT_WARNING_FILE), "utf8"),
    );
    expect(rec.until).toBe("2026-11-04T14:01:00.000Z");
    // FIX1 nález 6: záznam po zdrojích; mock bez limit_source → zdroj = model tvůrce
    const [src] = Object.values(rec.sources) as Array<Record<string, string>>;
    expect(src.until).toBe("2026-11-04T14:01:00.000Z");
    expect(src.evidence_hash).toBe(sha(warn));
    expect(src.reset_source).toBe("clock");
    const calls = supervisor.calls.length;
    t = t0 + 60 * 60_000;
    expect(await o.tick()).toEqual({
      status: "limit_warning",
      until: "2026-11-04T14:01:00.000Z",
    });
    expect(store.listOrders()).toHaveLength(1); // žádná nová zakázka
    expect(supervisor.calls).toHaveLength(calls); // žádné volání modelu
    t = Date.parse("2026-11-04T14:01:00Z") + 1;
    expect((await o.tick()).status).toBe("advanced");
    expect(store.listOrders()).toHaveLength(2);
  });

  it("bez varování se nic nemění (žádný soubor, nová zakázka vzniká)", async () => {
    const { o } = orch({ now: () => new Date("2026-11-04T10:00:00Z") });
    expect(await o.tick()).toMatchObject({ state: "DONE" });
    expect(fs.existsSync(path.join(dir, LIMIT_WARNING_FILE))).toBe(false);
  });

  it("nečitelný záznam varování platí pauseMinutes od zápisu (fail-closed, ne trvale)", async () => {
    fs.writeFileSync(path.join(dir, LIMIT_WARNING_FILE), "{rozbité");
    const mtime = fs.statSync(path.join(dir, LIMIT_WARNING_FILE)).mtimeMs;
    let t = mtime + 10 * 60_000;
    const { o } = orch({ now: () => new Date(t) });
    expect((await o.tick()).status).toBe("limit_warning");
    t = mtime + 61 * 60_000;
    expect((await o.tick()).status).toBe("advanced");
  });
});

describe("trvalé zápisy (§0 bod 4)", () => {
  function order(): Order {
    return {
      id: "wo-dur",
      mission: "m",
      state: "NEW",
      created_at: "x",
      updated_at: "x",
      fix_rounds: 0,
      manual_interventions: 0,
      history: [],
      meta: {},
    };
  }

  it("Store.save: tmp + fsync souboru + rename + fsync adresáře, formát beze změny", () => {
    const fsync = vi.spyOn(fs, "fsyncSync");
    const rename = vi.spyOn(fs, "renameSync");
    const o = order();
    expect(store.save(o)).toBe(true);
    // soubor, adresář zakázky a (FIX1 nález 5) rodičovský runs/, protože adresář zakázky je nový
    expect(fsync).toHaveBeenCalledTimes(3);
    expect(rename).toHaveBeenCalledTimes(1);
    const [from, to] = rename.mock.calls[0] as [string, string];
    expect(to).toBe(path.join(dir, "wo-dur", "state.json"));
    expect(from).toMatch(/state\.json\..+\.tmp$/);
    // fsync souboru proběhl před rename (pořadí volání)
    // [0] = runs/ po vytvoření adresáře zakázky, [1] = soubor (před rename), [2] = adresář zakázky (po rename)
    expect(fsync.mock.invocationCallOrder[1]).toBeLessThan(
      rename.mock.invocationCallOrder[0],
    );
    expect(fsync.mock.invocationCallOrder[2]).toBeGreaterThan(
      rename.mock.invocationCallOrder[0],
    );
    const disk = fs.readFileSync(
      path.join(dir, "wo-dur", "state.json"),
      "utf8",
    );
    expect(disk.endsWith("}\n")).toBe(true);
    expect(JSON.parse(disk)).toMatchObject({ id: "wo-dur", version: 1 });
    expect(
      fs
        .readdirSync(path.join(dir, "wo-dur"))
        .filter((f) => f.endsWith(".tmp")),
    ).toEqual([]);
    // druhý save do existujícího adresáře: jen soubor + adresář
    fsync.mockClear();
    expect(store.save(o)).toBe(true);
    expect(fsync).toHaveBeenCalledTimes(2);
  });

  it("Store.save: když fsync selže, stav se nepřepíše a nezůstane tmp", () => {
    const o = order();
    expect(store.save(o)).toBe(true);
    vi.spyOn(fs, "fsyncSync").mockImplementationOnce(() => {
      throw Object.assign(new Error("EIO"), { code: "EIO" });
    });
    expect(() => store.save({ ...o, state: "PLANNED" })).toThrow(/EIO/);
    expect(store.load("wo-dur")).toMatchObject({ state: "NEW", version: 1 });
    expect(
      fs
        .readdirSync(path.join(dir, "wo-dur"))
        .filter((f) => f.endsWith(".tmp")),
    ).toEqual([]);
  });

  it("Store.writeFile (výstupy modelů): fsync + rename, obsah beze změny", () => {
    const fsync = vi.spyOn(fs, "fsyncSync");
    const p = store.writeFile("wo-dur", "check-r0.md", "verdikt");
    expect(fsync).toHaveBeenCalledTimes(3); // + rodičovský runs/ nového adresáře zakázky (FIX1 nález 5)
    fsync.mockClear();
    store.writeFile("wo-dur", "check-r1.md", "verdikt");
    expect(fsync).toHaveBeenCalledTimes(2);
    expect(fs.readFileSync(p, "utf8")).toBe("verdikt");
    store.writeFile("wo-dur", "check-r0.md", "přepsáno");
    expect(fs.readFileSync(p, "utf8")).toBe("přepsáno");
  });

  it("výstupy modelů v běhu zakázky jdou přes trvalý zápis", async () => {
    const fsync = vi.spyOn(fs, "fsyncSync");
    const { o } = orch({ now: () => new Date("2026-11-04T10:00:00Z") });
    expect(await o.tick()).toMatchObject({ state: "DONE" });
    const id = store.listOrders()[0].id;
    expect(fs.readFileSync(path.join(dir, id, "draft-v0.md"), "utf8")).toBe(
      DRAFT,
    );
    expect(fsync.mock.calls.length).toBeGreaterThan(0);
  });
});

describe("re-entry (§14 řádek PR 1)", () => {
  it("WAITING_REVIEW (checkpoint review_hash): další tick zkusí kontrolu znovu nad stejným artefaktem, bez nových polí", async () => {
    const t0 = Date.parse("2026-11-04T10:00:00Z");
    const { o, checker, creator } = orch({
      now: () => new Date(t0),
      checker: [
        { ok: false, waitReview: true, error: "čeká na kontrolu: timeout" },
        { text: PASS },
      ],
    });
    expect((await o.tick()).status).toBe("waiting_review");
    const w = store.listOrders()[0];
    expect(w.state).toBe("WAITING_REVIEW");
    expect(w.review_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(w.meta).filter((k) => k.startsWith("reset_"))).toEqual(
      [],
    );
    const draftsBefore = creator.calls.length;
    expect(await o.tick()).toMatchObject({ state: "DONE" });
    expect(checker.calls).toHaveLength(2);
    expect(checker.calls[1]).toBe(checker.calls[0]); // stejný artefakt, stejný prompt
    expect(creator.calls.length).toBe(draftsBefore); // žádný nový draft
  });

  it("zakázka čekající na kontrolu (checkpoint review_hash) se po nasazení chová stejně; nová pole jsou volitelná", async () => {
    // Stav zapsaný starým kódem: WAITING_REVIEW se shodným artefaktem, bez polí reset_*.
    const t0 = Date.parse("2026-11-04T10:00:00Z");
    const { o, creator } = orch({ now: () => new Date(t0) });
    expect(await o.tick()).toMatchObject({ state: "DONE" });
    const done = store.listOrders()[0];
    // Formát state.json zůstal čitelný pro starý kód: žádné nové povinné pole, meta je dál Record<string,string>.
    const raw = JSON.parse(
      fs.readFileSync(path.join(dir, done.id, "state.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(Object.keys(raw).sort()).toEqual(Object.keys(done).sort());
    for (const v of Object.values(raw.meta as Record<string, unknown>))
      expect(typeof v).toBe("string");
    // Starý PAUSED záznam bez meta.reset_* (napsaný před PR 1) se obnoví podle resume_after jako dřív.
    const old: Order = {
      id: "wo-20261104-090000",
      mission: "m",
      state: "PAUSED",
      paused_from: "DOING",
      resume_after: new Date(t0 - 1).toISOString(),
      created_at: "2026-11-04T09:00:00Z",
      updated_at: "2026-11-04T09:00:00Z",
      fix_rounds: 0,
      manual_interventions: 0,
      history: [],
      meta: {},
      brief: done.brief,
    };
    fs.mkdirSync(path.join(dir, old.id), { recursive: true });
    fs.writeFileSync(
      path.join(dir, old.id, "state.json"),
      JSON.stringify(old, null, 2),
    );
    const before = creator.calls.length;
    expect(await o.tick()).toMatchObject({ order: old.id, state: "DONE" });
    expect(creator.calls.length).toBe(before + 1);
    expect(store.load(old.id).meta.reset_source).toBeUndefined();
  });
});
