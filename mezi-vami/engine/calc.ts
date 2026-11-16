// Výpočetní engine: CalcProvider dodá ekliptikální délky deseti těles pro okamžik narození.
// Teď: AiCalcProvider (jazykový model, výchozí Codex přes OpenAI). Později: EphemerisCalcProvider
// (Swiss Ephemeris / hostovaný provider po CZ/SK Golden gate) — stačí přepnout
// MEZI_VAMI_CALC_PROVIDER=ephemeris, zbytek pipeline (astro.ts, writer, DB, UI) se nemění.

import { BODIES, LongitudesSchema, toUt, type CalcInput, type Longitudes, type PersonInput } from "./astro";
import { generateJsonWithCode, generateStructured, type Usage } from "../llm";

export type CalcOutput = {
  a: Longitudes;
  b: Longitudes;
  provider: string;
  model: string;
  usage: Usage | null;
};

export interface CalcProvider {
  readonly name: string;
  compute(input: CalcInput): Promise<CalcOutput>;
}

// Rozhodnutí sponzora 16. 11. 2026: uvažující modely (Opus, Codex) výpočet nestihly do 5 min →
// rychlejší model; přesnost je dočasná, nahradí ji ephemeris. Codex zůstává volitelný přes env.
export const DEFAULT_CALC_MODEL = "anthropic:claude-sonnet-5-5";

const LON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...BODIES],
  properties: Object.fromEntries(BODIES.map((b) => [b, { type: "number" }])),
};

const OUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["a", "b"],
  properties: { a: LON_SCHEMA, b: LON_SCHEMA },
};

const CODE_SYSTEM = `You compute planetary positions by WRITING AND RUNNING Python code (use the code
execution tool; numpy is available, no internet, do not pip install).
Implement standard low-precision algorithms: Sun and planets from JPL "Approximate Positions of the
Planets" Keplerian elements (table 1800–2050, incl. Pluto) → heliocentric → geocentric; Moon from
Meeus ch. 47 with at least the 30 largest longitude terms; convert to apparent TROPICAL ecliptic
longitude of date (apply precession from J2000 to date). Work quickly: one script, run it once,
check that the Sun longitude is plausible, fix only if clearly wrong.
FINAL ANSWER: only one JSON object, no prose:
{"a":{"sun":..,"moon":..,"mercury":..,"venus":..,"mars":..,"jupiter":..,"saturn":..,"uranus":..,"neptune":..,"pluto":..},"b":{...}}
(degrees 0–360, two decimals).`;

const SYSTEM = `You are a precise astronomical calculator. For each moment (UT) compute the apparent
geocentric TROPICAL ecliptic longitude (degrees 0–360, of date) of: Sun, Moon, Mercury, Venus,
Mars, Jupiter, Saturn, Uranus, Neptune, Pluto. Work it out carefully with standard algorithms
(e.g. VSOP87 / ELP-2000 / Meeus) — compute, do not guess from memory. Moon must be accurate to
~0.5°, others to ~0.2°. Return only the numbers in the required JSON.`;

function moment(label: string, p: PersonInput): string {
  const u = toUt(p);
  return `${label}: ${u.ut} (UT); birthplace ${p.misto.name}, ${p.misto.okres}, ${p.misto.cc}.`;
}

/** Přibližná délka Slunce (Meeus, ±0,01°) pro kontrolu výstupu AI. */
export function approxSunLongitude(utIso: string): number {
  const jd = Date.parse(utIso) / 86_400_000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = 280.46 + 0.9856474 * n;
  const g = ((357.528 + 0.9856003 * n) * Math.PI) / 180;
  return (((L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) % 360) + 360) % 360;
}

const angDiff = (x: number, y: number) => {
  const d = Math.abs((((x - y) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
};

/** Zahodí zjevně nesmyslný výstup (Slunce mimo o > 2°, všechny hodnoty stejné). */
export function sanityCheck(input: CalcInput, a: Longitudes, b: Longitudes): void {
  for (const [k, lon] of [["a", a], ["b", b]] as const) {
    const sun = approxSunLongitude(toUt(input[k]).ut);
    if (angDiff(lon.sun, sun) > 2)
      throw new Error(`Výpočet ${k}: Slunce ${lon.sun.toFixed(1)}° neodpovídá ${sun.toFixed(1)}°.`);
    if (new Set(Object.values(lon).map((x) => x.toFixed(1))).size < 6)
      throw new Error(`Výpočet ${k}: podezřele mnoho stejných hodnot.`);
  }
}

export class AiCalcProvider implements CalcProvider {
  readonly name = "ai";
  constructor(
    private readonly model: string,
    /** "code" = model počítá spuštěným Pythonem (jen Anthropic); "direct" = odpověď bez nástrojů */
    private readonly mode: "code" | "direct" = "direct",
  ) {}

  async compute(input: CalcInput): Promise<CalcOutput> {
    const user = [moment("a", input.a), moment("b", input.b)].join("\n");
    if (this.mode === "code") {
      const r = await generateJsonWithCode({
        model: this.model,
        system: CODE_SYSTEM,
        user,
        maxOutputTokens: 16000,
        timeoutMs: 270_000,
      });
      const d = r.data as { a: unknown; b: unknown };
      const a = LongitudesSchema.parse(d.a);
      const b = LongitudesSchema.parse(d.b);
      sanityCheck(input, a, b);
      return { a, b, provider: "ai-code", model: r.model, usage: r.usage };
    }
    let lastErr: unknown;
    for (let attempt = 0; attempt < 1; attempt++) {
      try {
        const r = await generateStructured({
          model: this.model,
          system: SYSTEM,
          user,
          schema: OUT_SCHEMA,
          schemaName: "planet_longitudes",
          maxOutputTokens: 16000,
          timeoutMs: 120_000,
        });
        const d = r.data as { a: unknown; b: unknown };
        const a = LongitudesSchema.parse(d.a);
        const b = LongitudesSchema.parse(d.b);
        sanityCheck(input, a, b);
        return {
          a,
          b,
          provider: this.name,
          model: r.model,
          usage: r.usage,
        };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }
}

/** Místo pro deterministický výpočet (ephemeris). Zatím záměrně nedostupné. */
export class EphemerisCalcProvider implements CalcProvider {
  readonly name = "ephemeris";
  async compute(): Promise<CalcOutput> {
    throw new Error("Ephemeris provider zatím není zapojený (MEZI_VAMI_CALC_PROVIDER=ai).");
  }
}

/** Záloha při chybě hlavního modelu nebo chybějícím klíči. */
export const FALLBACK_CALC_MODEL = "anthropic:claude-sonnet-5-5";

const hasKey = (env: Record<string, string | undefined>, provider: string) =>
  provider === "openai"
    ? !!(env.MEZI_VAMI_OPENAI_API_KEY || env.OPENAI_API_KEY)
    : provider === "anthropic"
      ? !!(env.MEZI_VAMI_ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY || env.H2_ANTHROPIC_API_KEY)
      : true;

/** Když hlavní model selže (např. neznámé ID modelu), zkusí zálohu; do DB se zapíše skutečný model. */
export class FallbackCalcProvider implements CalcProvider {
  readonly name = "ai";
  constructor(
    private readonly primary: CalcProvider,
    private readonly fallback: CalcProvider,
  ) {}
  async compute(input: CalcInput): Promise<CalcOutput> {
    try {
      return await this.primary.compute(input);
    } catch (e) {
      console.error("[mezi-vami/calc] hlavní model selhal, záloha:", e instanceof Error ? e.message : e);
      return this.fallback.compute(input);
    }
  }
}

export function getCalcProvider(env: Record<string, string | undefined> = process.env): CalcProvider {
  if ((env.MEZI_VAMI_CALC_PROVIDER ?? "ai") === "ephemeris") return new EphemerisCalcProvider();
  const wanted = env.MEZI_VAMI_CALC_MODEL || DEFAULT_CALC_MODEL;
  const backup = env.MEZI_VAMI_CALC_FALLBACK_MODEL || FALLBACK_CALC_MODEL;
  const ok = (spec: string) => hasKey(env, spec.split(":")[0]);
  // výchozí: model počítá Pythonem (rozhodnutí sponzora 16. 11. 2026), jen u Anthropic
  const modeFor = (spec: string): "code" | "direct" =>
    (env.MEZI_VAMI_CALC_MODE ?? "code") === "code" && spec.startsWith("anthropic:") ? "code" : "direct";
  const make = (spec: string) => new AiCalcProvider(spec, modeFor(spec));
  if (ok(wanted) && ok(backup) && wanted !== backup) return new FallbackCalcProvider(make(wanted), make(backup));
  return make(ok(wanted) ? wanted : backup);
}
