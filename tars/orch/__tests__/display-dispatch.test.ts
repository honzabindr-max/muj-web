// Etapa 4 PR 2: sonda displeje před GPT v prohlížeči (zjištění 5. 11.) a dispatch.json (mode, fail-closed hold).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import type { TextAdapter } from "../adapters";
import {
  blockingAttempt,
  ChatGptWebChecker,
  readJournal,
  type WebBrowser,
} from "../chatgpt-web";
import { DisplayAsleepError, McpBrowser } from "../mcp-browser";
import {
  DISPATCH_DEFAULTS,
  observeMode,
  parseDispatch,
  readDispatch,
} from "../dispatch";
import { parseDisplayProbe, probeDisplay } from "../display";
import { REVIEW_SCHEMA } from "../verdict";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-e4pr2-"));
});

describe("sonda displeje (display.ts)", () => {
  it("probuzený je jen {main > 0, asleep 0}; cokoli jiného = spí (fail-closed)", () => {
    expect(parseDisplayProbe('{"main":1,"asleep":0}')).toEqual({
      awake: true,
      reason: "displej vzhůru",
    });
    expect(parseDisplayProbe('{"main":1,"asleep":false}').awake).toBe(true);
    expect(parseDisplayProbe('{"main":1,"asleep":1}')).toEqual({
      awake: false,
      reason: "displej spí",
    });
    expect(parseDisplayProbe('{"main":0,"asleep":0}').awake).toBe(false);
    expect(parseDisplayProbe('{"asleep":0}').awake).toBe(false);
    expect(parseDisplayProbe('{"main":1}').awake).toBe(false);
    expect(parseDisplayProbe('{"main":1,"asleep":"0"}').awake).toBe(false);
    expect(parseDisplayProbe("").awake).toBe(false);
    expect(parseDisplayProbe("garbage").awake).toBe(false);
  });

  it("mimo macOS (CI Linux) = spí bez spuštění čehokoli; chyba osascript = spí", () => {
    let runs = 0;
    const run = () => {
      runs++;
      return '{"main":1,"asleep":0}';
    };
    expect(probeDisplay({ platform: "linux", run })).toEqual({
      awake: false,
      reason: "sonda displeje: není macOS",
    });
    expect(runs).toBe(0);
    expect(
      probeDisplay({
        platform: "darwin",
        run: () => {
          throw new Error("timeout");
        },
      }),
    ).toEqual({ awake: false, reason: "sonda displeje: osascript selhal" });
    let args: string[] = [];
    expect(
      probeDisplay({
        platform: "darwin",
        run: (cmd, a) => {
          args = [cmd, ...a];
          return '{"main":2,"asleep":0}\n';
        },
      }).awake,
    ).toBe(true);
    expect(args.slice(0, 3)).toEqual([
      "/usr/bin/osascript",
      "-l",
      "JavaScript",
    ]);
    expect(args[4]).toMatch(/CGDisplayIsAsleep/);
  });

  it.runIf(process.platform === "darwin")(
    "macOS: skutečná sonda je jen čtení a vrátí stav (hodnota závisí na displeji)",
    () => {
      const s = probeDisplay();
      expect(typeof s.awake).toBe("boolean");
      expect(s.reason.length).toBeGreaterThan(0);
    },
  );

  it("GPT v prohlížeči při spícím displeji: žádný běh prohlížeče, žádný zápis do deníku, WAITING_REVIEW s důvodem „displej spí“", async () => {
    let browserRuns = 0;
    const browser: WebBrowser = {
      async run() {
        browserRuns++;
        throw new Error("prohlížeč se nesmí spustit");
      },
    } as unknown as WebBrowser;
    let probes = 0;
    const c = new ChatGptWebChecker(browser, {
      displayAwake: () => {
        probes++;
        return { awake: false, reason: "displej spí" };
      },
    });
    const r = await c.run("Posuď zadání.", {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(r).toMatchObject({ ok: false, waitReview: true, limit: false });
    expect(r.error).toMatch(/displej spí/);
    expect(browserRuns).toBe(0);
    expect(probes).toBe(1);
    // žádný deník pokusů (nic odesláno, nic spáleno), jen diagnostický záznam check-gptweb-*.md
    const files = fs.readdirSync(dir);
    expect(files.filter((f) => !f.startsWith("check-gptweb-"))).toEqual([]);
    expect(c.lastRecord).toMatchObject({
      status: "WAITING_REVIEW",
      submits: 0,
    });

    // výjimka ze sondy = spí (fail-closed)
    const c2 = new ChatGptWebChecker(browser, {
      displayAwake: () => {
        throw new Error("x");
      },
    });
    const r2 = await c2.run("Posuď zadání.", {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(r2.waitReview).toBe(true);
    expect(r2.error).toMatch(/displej spí/);
    expect(browserRuns).toBe(0);
  });

  it("FIX2 nález 2: první sonda vzhůru, druhá (McpBrowser.run) spí nebo selže → submitted:false, pokus nespálený, WAITING_REVIEW „displej spí“, další běh posílá bez gpt-retry", async () => {
    for (const second of ["asleep", "throws"] as const) {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "tars-e4pr2-fix2-"));
      let driverRuns = 0;
      const driver = {
        async run() {
          driverRuns++;
          throw new Error("ovladač se nesmí spustit");
        },
      } as unknown as TextAdapter;
      let probes = 0;
      const probe = () => {
        probes++;
        if (probes === 1) return { awake: true, reason: "displej vzhůru" };
        if (second === "throws") throw new Error("osascript");
        return { awake: false, reason: "displej spí" };
      };
      const mb = new McpBrowser(driver, {
        script: path.join(cwd, "nesmi-bezet.sh"), // neexistuje: start Chrome by selhal jinou chybou
        gate: "/repo/gate.ts",
        profileDir: cwd,
        displayAwake: probe,
      });
      const c = new ChatGptWebChecker(mb, { displayAwake: probe });
      const r = await c.run("Posuď zadání.", {
        cwd,
        outputSchema: REVIEW_SCHEMA,
      });
      expect(probes).toBe(2);
      expect(driverRuns).toBe(0);
      // pokus prokazatelně neodeslaný: v deníku nezůstal (ani sending, ani burned), nic neblokuje
      const j = readJournal(cwd)!;
      expect(j.some((e) => e.state === "burned")).toBe(false);
      expect(j.some((e) => e.state === "sending")).toBe(false);
      expect(blockingAttempt(j)).toBeUndefined();
      expect(r).toMatchObject({ ok: false, waitReview: true, limit: false });
      expect(r.error).toMatch(/displej spí/);
      expect(r.error).toMatch(/nic neodesláno/);
      expect(c.lastRecord).toMatchObject({
        status: "WAITING_REVIEW",
        submits: 0,
      });

      // po probuzení: další běh dojde až k prohlížeči (žádné „spálený, jen gpt-retry“)
      let sends = 0;
      const browser2: WebBrowser = {
        async run(
          _steps: unknown,
          _shots: string,
          onSent?: (s: { submitted: boolean | "unknown" }) => void,
        ) {
          sends++;
          onSent?.({ submitted: false });
          throw new Error("konec testu");
        },
      } as unknown as WebBrowser;
      const c2 = new ChatGptWebChecker(browser2, {
        displayAwake: () => ({ awake: true, reason: "displej vzhůru" }),
      });
      const r2 = await c2.run("Posuď zadání.", {
        cwd,
        outputSchema: REVIEW_SCHEMA,
      });
      expect(sends).toBe(1);
      expect(r2.error).not.toMatch(/spálený|gpt-retry/);
    }
  });

  it("FIX2 nález 2: McpBrowser.run při odmítnutí sondou hlásí onSent submitted:false a nic nespustí", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "tars-e4pr2-fix2-"));
    let driverRuns = 0;
    const driver = {
      async run() {
        driverRuns++;
        throw new Error("ovladač se nesmí spustit");
      },
    } as unknown as TextAdapter;
    const mb = new McpBrowser(driver, {
      script: path.join(cwd, "nesmi-bezet.sh"),
      gate: "/repo/gate.ts",
      profileDir: cwd,
      displayAwake: () => ({ awake: false, reason: "displej spí" }),
    });
    const sent: unknown[] = [];
    const shots = path.join(cwd, "shots");
    await expect(
      mb.run([{ kind: "goto", url: "about:blank" }], shots, (s) =>
        sent.push(s),
      ),
    ).rejects.toBeInstanceOf(DisplayAsleepError);
    expect(sent).toEqual([{ submitted: false }]);
    expect(driverRuns).toBe(0);
    expect(fs.existsSync(shots)).toBe(false);
  });
});

describe("dispatch.json (mode, fail-closed hold)", () => {
  const file = () => path.join(dir, "dispatch.json");
  const runs = () => path.join(dir, "runs");

  it("soubor v repu je platný a výchozí mode je hold", () => {
    const repoFile = path.join(__dirname, "..", "dispatch.json");
    const r = readDispatch(repoFile, runs());
    expect(r.invalid).toBeUndefined();
    expect(r.config).toEqual(DISPATCH_DEFAULTS);
    expect(r.config.mode).toBe("hold");
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("chybí / není JSON / neznámý klíč / neplatná hodnota → hold s důvodem", () => {
    expect(readDispatch(file(), runs())).toMatchObject({
      config: { mode: "hold" },
      invalid: "dispatch.json chybí",
    });
    for (const [text, why] of [
      ["{", /JSON/],
      ["[]", /objekt/],
      ['{"v":1,"mode":"run","extra":1}', /neznámý klíč/],
      ['{"v":2,"mode":"run"}', /v musí být 1/],
      ['{"v":1,"mode":"RUN"}', /mode/],
      ['{"v":1}', /mode/],
      ['{"v":1,"mode":"run","max_chunks":0}', /max_chunks/],
      ['{"v":1,"mode":"run","max_chunks":2.5}', /max_chunks/],
      [
        '{"v":1,"mode":"run","private_draft_parents":["x"]}',
        /private_draft_parents/,
      ],
    ] as const) {
      fs.writeFileSync(file(), text);
      const r = readDispatch(file(), runs());
      expect(r.config.mode).toBe("hold");
      expect(r.invalid).toMatch(why);
    }
    expect(parseDispatch('{"v":1,"mode":"run"}')).toEqual({
      ok: true,
      config: { ...DISPATCH_DEFAULTS, mode: "run" },
    });
  });

  it("run platí jen z platného souboru; runs/HOLD ho přebije", () => {
    fs.writeFileSync(
      file(),
      '{"v":1,"mode":"run","private_draft_parents":["' + "a".repeat(32) + '"]}',
    );
    expect(readDispatch(file(), runs()).config).toMatchObject({
      mode: "run",
      private_draft_parents: ["a".repeat(32)],
    });
    fs.mkdirSync(runs(), { recursive: true });
    fs.writeFileSync(path.join(runs(), "HOLD"), "");
    expect(readDispatch(file(), runs())).toMatchObject({
      config: { mode: "hold" },
      hold_file: true,
    });
  });

  it("re-entry hold → run: první tick v run nesmí začít nic nového, až další; zpět na hold = hned ne", () => {
    const t = (m: number) => new Date(Date.UTC(2026, 10, 5, 8, m));
    expect(observeMode(runs(), "hold", t(0))).toMatchObject({
      mode: "hold",
      may_start_new: false,
      changed: true,
    });
    expect(observeMode(runs(), "hold", t(1))).toMatchObject({
      may_start_new: false,
      changed: false,
    });
    expect(observeMode(runs(), "run", t(2), "r1")).toMatchObject({
      mode: "run",
      may_start_new: false,
      changed: true,
      previous: "hold",
    });
    expect(observeMode(runs(), "run", t(3), "r1")).toMatchObject({
      may_start_new: true,
      changed: false,
    });
    const rec = JSON.parse(
      fs.readFileSync(path.join(runs(), "dispatch-mode.json"), "utf8"),
    );
    expect(rec).toMatchObject({ mode: "run", run_since: t(2).toISOString() });
    expect(observeMode(runs(), "hold", t(4))).toMatchObject({
      may_start_new: false,
      changed: true,
      previous: "run",
    });
    expect(observeMode(runs(), "run", t(5), "r1").may_start_new).toBe(false);
    // bez otisku run nikdy nepokračuje
    expect(observeMode(runs(), "run", t(6)).may_start_new).toBe(false);
    expect(observeMode(runs(), "run", t(7)).may_start_new).toBe(false);
  });

  it("FIX1: run → hold → run mezi ticky (přepis dispatch.json) = první tick po návratu nic nového nezačne", () => {
    const t = (m: number) => new Date(Date.UTC(2026, 10, 5, 9, m));
    const RUN = '{"v":1,"mode":"run"}';
    fs.writeFileSync(file(), RUN);
    const obs = (m: number) => {
      const r = readDispatch(file(), runs());
      return observeMode(runs(), r.config.mode, t(m), r.revision);
    };
    expect(obs(0).may_start_new).toBe(false); // první run
    expect(obs(1).may_start_new).toBe(true); // stejný zápis = pokračuje
    // mezi ticky: hold a zpět na stejný obsah (jiný zápis souboru)
    fs.writeFileSync(file(), '{"v":1,"mode":"hold"}');
    fs.rmSync(file());
    fs.writeFileSync(file(), RUN);
    const r = readDispatch(file(), runs());
    expect(r.revision).toMatch(/^[0-9a-f]{64}:/);
    expect(obs(2)).toMatchObject({ mode: "run", may_start_new: false });
    expect(obs(3).may_start_new).toBe(true);
  });

  it("nečitelný záznam předchozího režimu = jako hold (první run nic nového nezačne)", () => {
    fs.mkdirSync(runs(), { recursive: true });
    fs.writeFileSync(path.join(runs(), "dispatch-mode.json"), "{rozbité");
    expect(observeMode(runs(), "run", new Date()).may_start_new).toBe(false);
  });
});
