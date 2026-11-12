// Krok 3: astro odhad za rozhraním AstroEstimator. Jediná implementace v prototypu = LLM odhad.
// Rozhraní je záměrně úzké: vstup = normalizované osoby, výstup = AstroEstimate. Další kroky
// (Evidence Map, texty, sestavení výsledku) na implementaci nezávisí.

import { z } from "zod";
import type { StructuredLlm } from "./llm";
import {
  PipelineError,
  emptyUsage,
  type NormalizedPerson,
  type Usage,
} from "./types";

export const SIGNS = [
  "Beran",
  "Býk",
  "Blíženci",
  "Rak",
  "Lev",
  "Panna",
  "Váhy",
  "Štír",
  "Střelec",
  "Kozoroh",
  "Vodnář",
  "Ryby",
] as const;
export const BODIES = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
] as const;
export const ASPECTS = [
  "conjunction",
  "sextile",
  "square",
  "trine",
  "opposition",
] as const;

export type Sign = (typeof SIGNS)[number];
export type Body = (typeof BODIES)[number];
export type AspectType = (typeof ASPECTS)[number];

const Placement = z.object({
  body: z.enum(BODIES),
  sign: z.enum(SIGNS),
  /** stupeň ve znamení 0–29.99 */
  degree: z.number(),
  retrograde: z.boolean(),
  /** dům 1–12; jen při přesném čase, jinak null */
  house: z.number().nullable(),
});

const Angle = z.object({ sign: z.enum(SIGNS), degree: z.number() });

export const PersonAstroSchema = z.object({
  coordinates: z.object({ lat: z.number(), lon: z.number() }),
  timezone: z.object({
    iana: z.enum(["Europe/Prague", "Europe/Bratislava"]),
    utc_offset_minutes: z.number(),
    /** UTC čas narození ISO 8601; null pokud čas není znám */
    utc_datetime: z.string().nullable(),
  }),
  /** Nejasný historický případ (neexistující/dvojznačný lokální čas, neznámý offset) se nehádá. */
  time_resolution: z.enum([
    "OK",
    "NONEXISTENT_EXACT_LOCAL_TIME",
    "AMBIGUOUS_EXACT_LOCAL_TIME",
    "UNRESOLVED_HISTORICAL_OFFSET",
  ]),
  planets: z.array(Placement),
  /** Ascendent a MC jen při přesném čase, jinak null */
  angles: z.object({ asc: Angle, mc: Angle }).nullable(),
});

export const AstroEstimateSchema = z.object({
  a: PersonAstroSchema,
  b: PersonAstroSchema,
  /** aspekty mezi planetami první (a) a druhé (b) osoby */
  aspects: z.array(
    z.object({
      a_body: z.enum(BODIES),
      b_body: z.enum(BODIES),
      aspect: z.enum(ASPECTS),
      orb: z.number(),
    }),
  ),
});

export type PersonAstro = z.infer<typeof PersonAstroSchema>;
export type AstroEstimate = z.infer<typeof AstroEstimateSchema>;

export interface AstroEstimator {
  readonly provider: string;
  estimate(
    persons: [NormalizedPerson, NormalizedPerson],
    deadline: number,
  ): Promise<{ astro: AstroEstimate; usage: Usage }>;
}

const SYSTEM = `Jsi astrologický kalkulátor pro prototyp. Z data, času, obce, okresu a státu narození si nejlepším odhadem odvoď souřadnice obce, časové pásmo, UTC čas a polohy planet. Pracuješ pro dvě osoby (a, b). Nejde o přesný výpočet efemerid, jde o co nejlepší odhad.

Pravidla:
- Souřadnice: odhadni lat/lon dané obce (stupně, desetinně).
- Časové pásmo: Europe/Prague pro ČR, Europe/Bratislava pro SR. utc_offset_minutes je offset platný v daný den a místě (zimní/letní čas, historická pravidla). utc_datetime je lokální čas minus offset (ISO 8601 s Z). Je-li čas neznámý, je null a polohy počítej pro poledne lokálního času.
- Přibližný čas: použij střed intervalu, ale utc_datetime dej null a house/angles vynech.
- time_resolution: "OK", pokud je lokální čas jednoznačný. Neexistuje-li exact lokální čas (přeskok na letní čas) nebo je dvojznačný (přechod zpět), nebo si historickým offsetem nejsi jistý, nastav příslušnou hodnotu a nehádej offset.
- planets: právě těchto 10 těles: sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto. Znamení česky (Beran, Býk, Blíženci, Rak, Lev, Panna, Váhy, Štír, Střelec, Kozoroh, Vodnář, Ryby), stupeň 0–29.99 ve znamení, retrograde true/false.
- Domy (house 1–12) a angles (asc, mc) jen u osoby s přesným časem narození. U přibližného a neznámého času musí být house = null a angles = null.
- aspects: aspekty mezi planetou osoby a a planetou osoby b: conjunction (0°), sextile (60°), square (90°), trine (120°), opposition (180°), orb v stupních do 6°. Vypiš nejvýznamnější, nejvýše 14.
Odpověz pouze strukturovaným JSON podle schématu.`;

function describe(n: NormalizedPerson, label: string): string {
  const p = n.person;
  const time =
    p.time_mode === "EXACT"
      ? `přesný čas ${p.exact_time}`
      : p.time_mode === "APPROXIMATE"
        ? `přibližný čas, lokální okno ${n.localWindow}`
        : "čas neznámý";
  return `${label}: datum ${p.birth_date}, ${time}, obec ${p.birth_place.display_name}, okres ${n.okres}, stát ${p.birth_place.country_code}`;
}

/** Odhad polohy a astro dat modelem. Žádný ephemeris, žádný dataset souřadnic. */
export class LlmAstroEstimator implements AstroEstimator {
  readonly provider = "llm_estimate";
  constructor(private llm: StructuredLlm) {}

  async estimate(
    persons: [NormalizedPerson, NormalizedPerson],
    deadline: number,
  ) {
    const user = `${describe(persons[0], "a")}\n${describe(persons[1], "b")}`;
    const { data, usage } = await this.llm.call({
      name: "astro",
      system: SYSTEM,
      user,
      schema: AstroEstimateSchema,
      maxTokens: 5000,
      deadline,
    });
    return { astro: sanitizeAstro(data, persons), usage };
  }
}

const inRange = (n: number, lo: number, hi: number) =>
  Number.isFinite(n) && n >= lo && n <= hi;

/**
 * Deterministická pojistka nad výstupem estimátoru (platí pro každou implementaci):
 * - domy a ascendent jen u přesného času (ostatní se zahodí),
 * - TIME_INPUT_RESOLUTION_REQUIRED se nehádá,
 * - neplausibilní hodnoty = selhání odhadu (S-FAIL), ne tiché opravy.
 */
export function sanitizeAstro(
  raw: AstroEstimate,
  persons: [NormalizedPerson, NormalizedPerson],
): AstroEstimate {
  const out = structuredClone(raw);
  const slots = ["a", "b"] as const;
  slots.forEach((k, i) => {
    const np = persons[i];
    const pa = out[k];
    if (np.person.time_mode === "EXACT" && pa.time_resolution !== "OK") {
      throw new PipelineError({
        type: "TIRR",
        slot: np.person.slot,
        reason: pa.time_resolution as Exclude<
          PersonAstro["time_resolution"],
          "OK"
        >,
      });
    }
    pa.time_resolution = "OK";
    if (np.person.time_mode !== "EXACT") {
      pa.angles = null;
      for (const pl of pa.planets) pl.house = null;
    }
    if (np.person.time_mode === "UNKNOWN") pa.timezone.utc_datetime = null;
    if (
      !inRange(pa.coordinates.lat, 47, 52) ||
      !inRange(pa.coordinates.lon, 11, 25)
    ) {
      throw new PipelineError(
        { type: "FAIL", code: "CALCULATION_FAILED" },
        "souřadnice mimo ČR/SR",
      );
    }
    const seen = new Set<string>();
    for (const pl of pa.planets) {
      if (!inRange(pl.degree, 0, 30) || seen.has(pl.body)) {
        throw new PipelineError(
          { type: "FAIL", code: "CALCULATION_FAILED" },
          "neplatné polohy planet",
        );
      }
      seen.add(pl.body);
      if (pl.house !== null && !inRange(pl.house, 1, 12)) pl.house = null;
    }
    if (pa.planets.length < 7) {
      throw new PipelineError(
        { type: "FAIL", code: "CALCULATION_FAILED" },
        "málo planet",
      );
    }
  });
  return out;
}

/** Prázdné využití pro testy. */
export const noUsage = (): Usage => emptyUsage();
