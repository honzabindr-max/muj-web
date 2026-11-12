// Krok 1+2 (deterministický): vstup z OsobaForm → osoby podle ui_data_contract_v1.
// Souřadnice, pásmo a UTC odhaduje v prototypu LLM (astro.ts); tady se jen ověří vstup,
// normalizuje čas (přesně / přibližně / nevím) a sestaví okno lokálního času bez přetečení do jiného dne.

import placesFile from "../_data/places.json";
import {
  APPROX_LABELS,
  PART_INFO,
  normalizeTime,
  personErrors,
  type Person,
  type Persons,
} from "../_lib/persons";
import {
  PipelineError,
  type ContractPerson,
  type NormalizedPerson,
  type Slot,
  type TimeMode,
} from "./types";

type PlacesFile = { p: [string, string, "CZ" | "SK"][] };

let placeSet: Set<string> | null = null;
function placeKey(name: string, okres: string, cc: string) {
  return `${name}|${okres}|${cc}`;
}
function knownPlace(name: string, okres: string, cc: string): boolean {
  if (!placeSet) {
    placeSet = new Set(
      (placesFile as unknown as PlacesFile).p.map(([n, o, c]) =>
        placeKey(n, o, c),
      ),
    );
  }
  return placeSet.has(placeKey(name, okres, cc));
}

const PART_TO_DAYPART = {
  noc: "NOC",
  rano: "RANO",
  odpoledne: "ODPOLEDNE",
  vecer: "VECER",
} as const;

const STYLE = {
  neutral: "neutral",
  m: "masculine",
  f: "feminine",
} as const;

export const MODE_MAP: Record<Person["mode"], TimeMode> = {
  exact: "EXACT",
  approx: "APPROXIMATE",
  unknown: "UNKNOWN",
};

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const fromMin = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/** Okno ±N minut kolem středu, oříznuté na hranice dne (nikdy nepřeteče do sousedního dne). */
export function clampedWindow(center: string, windowMinutes: number): string {
  const c = toMin(center);
  const from = Math.max(0, c - windowMinutes);
  const to = Math.min(24 * 60 - 1, c + windowMinutes);
  return `${fromMin(from)}-${fromMin(to)}`;
}

function normalizePerson(p: Person, slot: Slot, today: Date): NormalizedPerson {
  const errs = personErrors(p, today);
  if (errs.date || errs.place || errs.time) {
    throw new PipelineError(
      { type: "INVALID_INPUT", detail: `${slot}` },
      "neplatný vstup",
    );
  }
  const place = p.place;
  if (!place || (place.cc !== "CZ" && place.cc !== "SK")) {
    throw new PipelineError({ type: "INVALID_INPUT", detail: `${slot}:place` });
  }
  if (!knownPlace(place.name, place.okres, place.cc)) {
    throw new PipelineError({ type: "INVALID_INPUT", detail: `${slot}:place` });
  }

  const person: ContractPerson = {
    slot,
    ui_label: slot === "A" ? "První osoba" : "Druhá osoba",
    birth_date: `${p.rok}-${p.mesic.padStart(2, "0")}-${p.den.padStart(2, "0")}`,
    birth_place: {
      display_name: place.name.slice(0, 120),
      country_code: place.cc,
      supported: true,
    },
    time_mode: MODE_MAP[p.mode],
    reference_style: STYLE[p.styl],
    presented_as_exact: p.mode === "exact",
  };

  let localWindow: string | null = null;
  if (p.mode === "exact") {
    person.exact_time = normalizeTime(p.cas) ?? undefined;
    localWindow = `${person.exact_time}-${person.exact_time}`;
  } else if (p.mode === "approx") {
    if (p.approx === "part") {
      const info = PART_INFO[p.part];
      const interval = info.range.replace("–", "-");
      person.approximate = {
        kind: "DAYPART",
        daypart: PART_TO_DAYPART[p.part],
        daypart_interval_local: interval,
        cross_day_spill: false,
      };
      localWindow = interval;
    } else {
      const center = normalizeTime(p.cas)!;
      const w = Number(p.approx) as 30 | 60 | 120;
      person.approximate = {
        kind: "CENTERED_WINDOW",
        center_time: center,
        window_minutes: w,
        cross_day_spill: false,
      };
      localWindow = clampedWindow(center, w);
    }
  }
  return { person, okres: place.okres, localWindow };
}

/** Ověří a normalizuje obě osoby. Vyhazuje PipelineError(INVALID_INPUT). */
export function normalizeInput(
  persons: Persons,
  today: Date = new Date(),
): [NormalizedPerson, NormalizedPerson] {
  return [
    normalizePerson(persons.a, "A", today),
    normalizePerson(persons.b, "B", today),
  ];
}

/** Popisek přibližného času pro prompt (bez osobních údajů mimo to, co už je ve vstupu). */
export function approxLabel(p: Person): string | null {
  return p.mode === "approx" && p.approx !== "part"
    ? APPROX_LABELS[p.approx]
    : null;
}
