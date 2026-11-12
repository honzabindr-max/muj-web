import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LlmAstroEstimator, sanitizeAstro } from "./astro";
import { validateContractDoc, semanticCheck } from "./contract";
import { buildEvidenceMap, evidenceMapHash, planSlots } from "./evidence";
import { RATE_COOKIE, handleCalc } from "./handler";
import { clampedWindow, normalizeInput } from "./input";
import { runPipeline } from "./pipeline";
import { mockAstro, mockLlm, samplePersons } from "./testkit";
import { PipelineError } from "./types";
import { BUDGET } from "./writer";

const ROOT = path.resolve(__dirname, "../../..");
const FIX = path.join(ROOT, "contracts/fixtures");
const readFix = (n: string) =>
  JSON.parse(readFileSync(path.join(FIX, `${n}.json`), "utf8"));

function deps(opts?: Parameters<typeof mockLlm>[0]) {
  const m = mockLlm(opts);
  return {
    m,
    deps: {
      llm: m.llm,
      estimator: new LlmAstroEstimator(m.llm),
      newId: () => "an_0123456789ab",
    },
  };
}

const pythonOk = spawnSync("python3", ["-c", "import jsonschema"]).status === 0;

describe("normalizace času a místa (krok 1+2)", () => {
  it("přesný čas: zimní i letní datum projdou beze změny (offset řeší estimátor)", () => {
    for (const [d, m] of [
      ["15", "1"],
      ["15", "7"],
    ]) {
      const p = samplePersons("exact", "exact");
      p.a.den = d;
      p.a.mesic = m;
      const [a] = normalizeInput(p);
      expect(a.person.time_mode).toBe("EXACT");
      expect(a.person.exact_time).toBe("07:35");
      expect(a.person.presented_as_exact).toBe(true);
      expect(a.person.birth_place).toEqual({
        display_name: "Brno",
        country_code: "CZ",
        supported: true,
      });
    }
  });

  it("přibližný čas: okno se nikdy nepřelije do jiného dne", () => {
    expect(clampedWindow("00:30", 60)).toBe("00:00-01:30");
    expect(clampedWindow("23:45", 120)).toBe("21:45-23:59");
    expect(clampedWindow("12:00", 30)).toBe("11:30-12:30");
    const p = samplePersons("approx", "approx");
    p.a.approx = "120";
    p.a.cas = "23:45";
    p.b.approx = "part";
    p.b.part = "noc";
    const [a, b] = normalizeInput(p);
    expect(a.person.approximate).toEqual({
      kind: "CENTERED_WINDOW",
      center_time: "23:45",
      window_minutes: 120,
      cross_day_spill: false,
    });
    expect(a.localWindow).toBe("21:45-23:59");
    expect(a.person.presented_as_exact).toBe(false);
    expect(b.person.approximate).toMatchObject({
      kind: "DAYPART",
      daypart: "NOC",
      daypart_interval_local: "00:00-05:59",
    });
  });

  it("nevím: bez času, bez approximate", () => {
    const [a] = normalizeInput(samplePersons("unknown", "unknown"));
    expect(a.person.time_mode).toBe("UNKNOWN");
    expect(a.person.exact_time).toBeUndefined();
    expect(a.person.approximate).toBeUndefined();
    expect(a.person.presented_as_exact).toBe(false);
  });

  it("neplatné datum a místo mimo číselník = INVALID_INPUT", () => {
    const p = samplePersons("exact", "exact");
    p.a.mesic = "2";
    p.a.den = "30";
    expect(() => normalizeInput(p)).toThrow(PipelineError);
    const q = samplePersons("exact", "exact");
    q.b.place = { name: "Vídeň", okres: "Vídeň", cc: "CZ" };
    q.b.placeText = "Vídeň";
    expect(() => normalizeInput(q)).toThrow(PipelineError);
  });

  it("nejasný historický čas = TIME_INPUT_RESOLUTION_REQUIRED, offset se nehádá", () => {
    const n = normalizeInput(samplePersons("exact", "unknown"));
    const astro = mockAstro();
    astro.a.time_resolution = "AMBIGUOUS_EXACT_LOCAL_TIME";
    try {
      sanitizeAstro(astro, n);
      expect.unreachable();
    } catch (e) {
      expect((e as PipelineError).kind).toMatchObject({
        type: "TIRR",
        slot: "A",
        reason: "AMBIGUOUS_EXACT_LOCAL_TIME",
      });
    }
    // u neznámého času se tento stav neuplatní
    const astro2 = mockAstro();
    astro2.b.time_resolution = "UNRESOLVED_HISTORICAL_OFFSET";
    expect(() => sanitizeAstro(astro2, n)).not.toThrow();
  });
});

describe("Evidence Map", () => {
  it("je deterministická pro stejný astro vstup (i při jiném pořadí polí)", () => {
    const a1 = mockAstro();
    const a2 = mockAstro();
    a2.a.planets.reverse();
    a2.b.planets.reverse();
    const m1 = buildEvidenceMap(a1, ["EXACT", "EXACT"]);
    const m2 = buildEvidenceMap(a2, ["EXACT", "EXACT"]);
    expect(m1.items.length).toBeGreaterThan(4);
    expect(JSON.stringify(m1)).toBe(JSON.stringify(m2));
    expect(evidenceMapHash(m1)).toBe(
      evidenceMapHash(buildEvidenceMap(a1, ["EXACT", "EXACT"])),
    );
    for (const e of m1.items) expect(e.id).toMatch(/^ev_[0-9a-f]{12}$/);
    expect(new Set(m1.items.map((e) => e.id)).size).toBe(m1.items.length);
  });

  it("vrstvy závislé na přesném čase jen v kohortě EE", () => {
    const ee = buildEvidenceMap(mockAstro(), ["EXACT", "EXACT"]);
    const eu = buildEvidenceMap(mockAstro(), ["EXACT", "UNKNOWN"]);
    expect(eu.items.some((e) => e.kind === "ANGLE_ELEMENT")).toBe(false);
    expect(eu.cohort).toBe("EU");
    expect(ee.cohort).toBe("EE");
  });

  it("plán slotů nepoužije evidenci dvakrát a R1 je vždy první", () => {
    const plans = planSlots(
      buildEvidenceMap(mockAstro(), ["UNKNOWN", "UNKNOWN"]),
    );
    expect(plans[0].slot).toBe("R1");
    const ids = plans.flatMap((p) => p.evidence.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("pipeline: validace FreeDnaResult schématem i semantickým validátorem", () => {
  const cases: [string, "exact" | "unknown", "exact" | "unknown", string][] = [
    ["exact × exact", "exact", "exact", "EE"],
    ["exact × unknown", "exact", "unknown", "EU"],
    ["unknown × unknown", "unknown", "unknown", "UU"],
  ];
  for (const [label, am, bm, cohort] of cases) {
    it(`${label}`, async () => {
      const { deps: d } = deps();
      const { document, revision } = await runPipeline(
        samplePersons(am, bm),
        d,
      );
      expect(validateContractDoc(document)).toEqual({ ok: true });
      expect(semanticCheck(document)).toEqual([]);
      const fd = document.view.free_dna;
      expect(fd.time_coverage_class).toBe(cohort);
      expect(fd.timed_layers).toBe(
        cohort === "EE" ? "AVAILABLE_STABLE" : "UNAVAILABLE_TIME_UNCERTAINTY",
      );
      if (cohort !== "EE") {
        const codes = fd.limitations.map((l) => l.code);
        expect(codes).toContain("TIMED_LAYERS_UNAVAILABLE");
        expect(codes).toContain("COMPOSITE_ANGLES_UNAVAILABLE");
        expect(
          fd.limitations.find((l) => l.code === "COMPOSITE_ANGLES_UNAVAILABLE")!
            .customer_text,
        ).toMatch(/Ascendent/);
      }
      // revize
      expect(revision).toMatchObject({
        provider: "llm_estimate",
        authoritative: false,
        revision: 1,
      });
      expect(revision.usage.calls).toBeGreaterThanOrEqual(2);
      expect(revision.module_versions.ui_data_contract).toBe("1.0.1");
      // evidence anchors patří revizi a svému insightu
      for (const i of [fd.r1, ...fd.optional_insights]) {
        expect(i.evidence_anchors.length).toBeGreaterThan(0);
        for (const a of i.evidence_anchors)
          expect(a.analysis_revision_ref).toBe(
            document.view.analysis.analysis_revision_ref,
          );
      }
      // Python validátor ze zadání dává stejný verdikt
      if (pythonOk) {
        const dir = mkTmp();
        const f = path.join(dir, "doc.json");
        writeFileSync(f, JSON.stringify(document));
        const r = spawnSync(
          "python3",
          [path.join(ROOT, "scripts/validate_fixture_semantics.py"), f],
          { encoding: "utf8" },
        );
        expect(r.stdout.trim()).toBe("OK");
      }
    });
  }

  it("neznámý čas: domy a ascendent se nedostanou do výsledku ani do evidence", async () => {
    const m = mockLlm();
    const est = new LlmAstroEstimator(m.llm);
    const n = normalizeInput(samplePersons("unknown", "unknown"));
    const { astro } = await est.estimate(n, Date.now() + 60_000);
    expect(astro.a.angles).toBeNull();
    expect(astro.a.planets.every((p) => p.house === null)).toBe(true);
    expect(astro.b.timezone.utc_datetime).toBeNull();
  });

  it("přetečení textu = přepis modelem, ne oříznutí", async () => {
    const long = "A".repeat(BUDGET.body + 40);
    const { m, deps: d } = deps({
      firstBody: (slot) => (slot === "R1" ? long : undefined),
    });
    const { document } = await runPipeline(samplePersons("exact", "exact"), d);
    expect(m.calls.some((c) => c.name === "texts_rewrite_1")).toBe(true);
    expect(document.view.free_dna.r1.body).not.toContain("AAAA");
    expect(document.view.free_dna.r1.body.length).toBeLessThanOrEqual(
      BUDGET.body,
    );
    expect(validateContractDoc(document)).toEqual({ ok: true });
  });
});

describe("kontrakt: fixtures a counter-fixtures", () => {
  const files = readdirSync(FIX).filter((f) => f.endsWith(".json"));
  it("máme 18 pozitivních a 20 counter fixtures podle FIXTURE_MATRIX_V1", () => {
    expect(files.filter((f) => f.startsWith("FX-")).length).toBe(18);
    expect(files.filter((f) => f.startsWith("CF-")).length).toBe(20);
  });
  for (const f of files) {
    const name = f.replace(/\.json$/, "");
    it(`${name} (TS validátor)`, () => {
      const r = validateContractDoc(readFix(name));
      expect(r.ok).toBe(name.startsWith("FX-"));
    });
  }
  it("TS port a Python validátor dávají stejný verdikt na všech fixtures", () => {
    if (!pythonOk) return;
    const r = spawnSync(
      "python3",
      [path.join(ROOT, "scripts/run_validation.py")],
      { encoding: "utf8" },
    );
    expect(r.stdout).toContain("POSITIVE_FIXTURES  18/18 PASS");
    expect(r.stdout).toContain("COUNTER_FIXTURES   20/20 PASS");
  });
  it("vlastní mutace: přetečení budgetu a nesedící kohorta jsou odmítnuty", async () => {
    const { deps: d } = deps();
    const { document } = await runPipeline(
      samplePersons("exact", "unknown"),
      d,
    );
    const over = structuredClone(document);
    over.view.free_dna.r1.headline = "X".repeat(71);
    expect(validateContractDoc(over)).toMatchObject({
      ok: false,
      layer: "semantic",
    });
    const bad = structuredClone(document);
    bad.view.free_dna.time_coverage_class = "EE";
    expect(validateContractDoc(bad).ok).toBe(false);
  });
});

function mkTmp() {
  return mkdtempSync(path.join(tmpdir(), "mv-"));
}

async function readStream(res: Response) {
  const text = await res.text();
  return text
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
}
const req = (body: unknown, cookie?: string) =>
  new Request("http://x/api/mezi-vami/vypocet", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

describe("API + E2E toku s mockovaným modelem", () => {
  it("osoby → kroky ve správném pořadí → výsledek (bez osobních údajů v logu)", async () => {
    const logs: string[] = [];
    const spies = [vi.spyOn(console, "log"), vi.spyOn(console, "error")].map(
      (s) =>
        s.mockImplementation((...a: unknown[]) => void logs.push(a.join(" "))),
    );
    const { deps: d } = deps();
    const res = await handleCalc(
      req({ persons: samplePersons("exact", "unknown") }),
      d,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain(`${RATE_COOKIE}=`);
    const ev = await readStream(res);
    spies.forEach((s) => s.mockRestore());
    const steps = ev
      .filter((e) => e.type === "step")
      .map((e) => `${e.id}:${e.status}`);
    expect(steps).toEqual([
      "input:start",
      "input:done",
      "astro:start",
      "astro:done",
      "evidence:start",
      "evidence:done",
      "texts:start",
      "texts:done",
      "validate:start",
      "validate:done",
    ]);
    const last = ev[ev.length - 1];
    expect(last.type).toBe("result");
    expect(validateContractDoc(last.document)).toEqual({ ok: true });
    expect(last.revision).toMatchObject({
      provider: "llm_estimate",
      authoritative: false,
    });
    const all = logs.join("\n");
    for (const secret of ["1990", "Brno", "Žilina", "07:35", "1988"])
      expect(all).not.toContain(secret);
  });

  it("chyba modelu = S-FAIL bez pádu (kontraktový pohled ANALYSIS_FAILED_RECOVERABLE)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps: d } = deps({
      astro: new PipelineError({ type: "FAIL", code: "PROVIDER_UNAVAILABLE" }),
    });
    const res = await handleCalc(
      req({ persons: samplePersons("exact", "exact") }),
      d,
    );
    const ev = await readStream(res);
    const last = ev[ev.length - 1];
    expect(last).toMatchObject({ type: "error", code: "FAIL" });
    expect(last.view.view.state).toBe("ANALYSIS_FAILED_RECOVERABLE");
    expect(last.view.view.failure).toMatchObject({
      recoverable: true,
      retry_action: "RETRY_CALCULATION",
    });
    expect(validateContractDoc(last.view)).toEqual({ ok: true });
    vi.restoreAllMocks();
  });

  it("neočekávaná chyba (ne PipelineError) = také S-FAIL, timeout = TIMEOUT", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const a = deps({ failTexts: new Error("boom") });
    const ev = await readStream(
      await handleCalc(
        req({ persons: samplePersons("exact", "exact") }),
        a.deps,
      ),
    );
    expect(ev[ev.length - 1].view.view.failure.failure_code).toBe(
      "CALCULATION_FAILED",
    );
    const b = deps({
      failTexts: new PipelineError({ type: "FAIL", code: "TIMEOUT" }),
    });
    const ev2 = await readStream(
      await handleCalc(
        req({ persons: samplePersons("exact", "exact") }),
        b.deps,
      ),
    );
    expect(ev2[ev2.length - 1].view.view.failure.failure_code).toBe("TIMEOUT");
    vi.restoreAllMocks();
  });

  it("TIME_INPUT_RESOLUTION_REQUIRED se vrací jako kontraktový pohled", async () => {
    const astro = mockAstro();
    astro.a.time_resolution = "NONEXISTENT_EXACT_LOCAL_TIME";
    const { deps: d } = deps({ astro });
    const ev = await readStream(
      await handleCalc(req({ persons: samplePersons("exact", "exact") }), d),
    );
    const last = ev[ev.length - 1];
    expect(last).toMatchObject({ type: "error", code: "TIRR" });
    expect(last.view.view).toMatchObject({
      state: "TIME_INPUT_RESOLUTION_REQUIRED",
      guessed_offset_used: false,
      slot: "A",
    });
  });

  it("max 1 výpočet za 30 s na session", async () => {
    const { deps: d } = deps();
    const now = () => 1_000_000;
    const ok = await handleCalc(
      req({ persons: samplePersons("exact", "exact") }),
      d,
      now,
    );
    await ok.text();
    const blocked = await handleCalc(
      req(
        { persons: samplePersons("exact", "exact") },
        `${RATE_COOKIE}=${now() - 10_000}`,
      ),
      d,
      now,
    );
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).retry_after_s).toBe(20);
    const later = await handleCalc(
      req(
        { persons: samplePersons("exact", "exact") },
        `${RATE_COOKIE}=${now() - 31_000}`,
      ),
      d,
      now,
    );
    expect(later.status).toBe(200);
    await later.text();
  });

  it("neplatný požadavek = 400, ne pád", async () => {
    const { deps: d } = deps();
    expect((await handleCalc(req({ nope: 1 }), d)).status).toBe(400);
  });
});
