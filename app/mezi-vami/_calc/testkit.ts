// Pomůcky pro testy: mockovaný model (žádné volání API) a vzorové osoby.
import type { z } from "zod";
import type { AstroEstimate, PersonAstro } from "./astro";
import type { StructuredLlm, StructuredRequest } from "./llm";
import { emptyUsage, type Usage } from "./types";
import { emptyPerson, type Persons } from "../_lib/persons";

export const planetsA: PersonAstro["planets"] = [
  { body: "sun", sign: "Lev", degree: 10, retrograde: false, house: 5 },
  { body: "moon", sign: "Ryby", degree: 5, retrograde: false, house: 8 },
  { body: "mercury", sign: "Panna", degree: 20, retrograde: false, house: 6 },
  { body: "venus", sign: "Rak", degree: 15, retrograde: false, house: 4 },
  { body: "mars", sign: "Beran", degree: 25, retrograde: false, house: 9 },
  { body: "jupiter", sign: "Váhy", degree: 3, retrograde: false, house: 7 },
  { body: "saturn", sign: "Kozoroh", degree: 12, retrograde: true, house: 10 },
  { body: "uranus", sign: "Býk", degree: 1, retrograde: false, house: 11 },
  {
    body: "neptune",
    sign: "Kozoroh",
    degree: 20,
    retrograde: false,
    house: 10,
  },
  { body: "pluto", sign: "Štír", degree: 2, retrograde: false, house: 8 },
];
export const planetsB: PersonAstro["planets"] = [
  { body: "sun", sign: "Střelec", degree: 12, retrograde: false, house: 3 },
  { body: "moon", sign: "Rak", degree: 22, retrograde: false, house: 12 },
  { body: "mercury", sign: "Štír", degree: 28, retrograde: false, house: 2 },
  { body: "venus", sign: "Váhy", degree: 9, retrograde: false, house: 1 },
  { body: "mars", sign: "Lev", degree: 14, retrograde: false, house: 5 },
  {
    body: "jupiter",
    sign: "Blíženci",
    degree: 17,
    retrograde: false,
    house: 9,
  },
  { body: "saturn", sign: "Vodnář", degree: 2, retrograde: false, house: 4 },
  { body: "uranus", sign: "Kozoroh", degree: 4, retrograde: false, house: 3 },
  { body: "neptune", sign: "Kozoroh", degree: 16, retrograde: false, house: 3 },
  { body: "pluto", sign: "Štír", degree: 1, retrograde: false, house: 2 },
];

const person = (
  planets: PersonAstro["planets"],
  lat: number,
  lon: number,
): PersonAstro => ({
  coordinates: { lat, lon },
  timezone: {
    iana: "Europe/Prague",
    utc_offset_minutes: 60,
    utc_datetime: "1990-01-15T06:35:00Z",
  },
  time_resolution: "OK",
  planets: planets.map((p) => ({ ...p })),
  angles: { asc: { sign: "Rak", degree: 4 }, mc: { sign: "Ryby", degree: 9 } },
});

/** Odhad tak, jak ho vrací model; záměrně vrací i domy a úhly, i když čas není přesný (pojistka je v kódu). */
export const mockAstro = (): AstroEstimate => ({
  a: person(planetsA, 49.2, 16.6),
  b: person(planetsB, 49.2, 18.7),
  aspects: [],
});

export type MockOpts = {
  astro?: AstroEstimate | Error;
  /** přepíše tělo bloku v prvním pokusu (test přetečení) */
  firstBody?: (slot: string) => string | undefined;
  failTexts?: Error;
};

export function mockLlm(opts: MockOpts = {}) {
  const calls: { name: string; user: string }[] = [];
  const llm: StructuredLlm = {
    async call<T>(
      req: StructuredRequest<T>,
    ): Promise<{ data: T; usage: Usage }> {
      calls.push({ name: req.name, user: req.user });
      const usage: Usage = {
        ...emptyUsage(),
        inputTokens: 1000,
        outputTokens: 400,
        calls: 1,
        costUsd: 0.0003,
      };
      if (req.name === "astro") {
        if (opts.astro instanceof Error) throw opts.astro;
        return { data: (opts.astro ?? mockAstro()) as T, usage };
      }
      if (opts.failTexts) throw opts.failTexts;
      // texty: pro každý blok z promptu vrať text s id z jeho podkladů
      const blocks = req.user
        .split(/Blok (R[1-5])/)
        .slice(1)
        .reduce<{ slot: string; text: string }[]>((acc, cur, i, arr) => {
          if (i % 2 === 0) acc.push({ slot: cur, text: arr[i + 1] ?? "" });
          return acc;
        }, [])
        .map(({ slot, text }) => {
          const ids = [...text.matchAll(/id (ev_[0-9a-f]{12})/g)].map(
            (m) => m[1],
          );
          const first =
            req.name === "texts" ? opts.firstBody?.(slot) : undefined;
          return {
            slot,
            headline: "Téma mezi vámi",
            body:
              first ??
              "Ve vašem spojení se může objevovat společný motiv. Tento pohled popisuje dynamiku bez hodnocení.",
            theme_label: "Společný motiv",
            cited: ids.slice(0, 1),
          };
        });
      return { data: { blocks } as T, usage };
    },
  };
  return { llm, calls };
}

export type { z };

export function samplePersons(
  aMode: "exact" | "approx" | "unknown",
  bMode: "exact" | "approx" | "unknown",
): Persons {
  const a = emptyPerson(aMode);
  const b = emptyPerson(bMode);
  Object.assign(a, {
    den: "14",
    mesic: "5",
    rok: "1990",
    place: { name: "Brno", okres: "Brno-město", cc: "CZ" as const },
    placeText: "Brno",
    cas: aMode === "unknown" ? "" : "07:35",
  });
  Object.assign(b, {
    den: "23",
    mesic: "8",
    rok: "1988",
    place: { name: "Žilina", okres: "Žilina", cc: "SK" as const },
    placeText: "Žilina",
    cas: bMode === "unknown" ? "" : "19:10",
  });
  return { step: "B", a, b };
}
