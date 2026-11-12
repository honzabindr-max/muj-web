// Údaje obou osob: model, parsování a validace (čistá logika, bez Reactu).
// Chybové texty polí v COPY_SYSTEM_V1 DRAFT v3.2 neexistují (K-17a = UNKNOWN),
// proto validace vrací jen KÓD chyby; UI zobrazí „[chybí copy K-17a]“.

export type Mode = "exact" | "approx" | "unknown";
export type Approx = "30" | "60" | "120" | "part";
export type Part = "noc" | "rano" | "odpoledne" | "vecer";
export type Styl = "neutral" | "m" | "f";
export type Cc = "CZ" | "SK";

export type Place = { name: string; okres: string; cc: Cc };

export type Person = {
  den: string;
  mesic: string;
  rok: string;
  /** text v poli místa (psaný) */
  placeText: string;
  /** vybraná obec z číselníku; null = nevybráno */
  place: Place | null;
  mode: Mode;
  /** HH:MM (u přesného i přibližného času) */
  cas: string;
  approx: Approx;
  part: Part;
  styl: Styl;
};

export type Persons = { step: "A" | "B"; a: Person; b: Person };

export const COPY_MISSING_K17A = "[chybí copy K-17a]";

export const APPROX_LABELS: Record<Approx, string> = {
  "30": "±30 min",
  "60": "±1 h",
  "120": "±2 h",
  part: "Jen část dne",
};

export const PART_INFO: Record<Part, { label: string; range: string }> = {
  noc: { label: "Noc", range: "00:00–05:59" },
  rano: { label: "Ráno", range: "06:00–11:59" },
  odpoledne: { label: "Odpoledne", range: "12:00–17:59" },
  vecer: { label: "Večer", range: "18:00–23:59" },
};

export const emptyPerson = (mode: Mode): Person => ({
  den: "",
  mesic: "",
  rok: "",
  placeText: "",
  place: null,
  mode,
  cas: "",
  approx: "60",
  part: "rano",
  styl: "neutral",
});

// výchozí režim času jako v návrhu: první osoba „Vím přesně“, druhá „Nevím“
export const defaultPersons = (): Persons => ({
  step: "A",
  a: emptyPerson("exact"),
  b: emptyPerson("unknown"),
});

/* ---------- datum ---------- */

export type DateParts = { den: string; mesic: string; rok: string };

const pad2 = (s: string) => s.padStart(2, "0");

/** Rozparsuje vložený text: 14. 5. 1990 · 14.05.1990 · 14/5/1990 · 14-05-1990 · 1990-05-14. */
export function parseDateInput(raw: string): DateParts | null {
  const t = raw.trim().replace(/ /g, " ");
  const iso = /^(\d{4})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})$/.exec(t);
  if (iso) return { den: pad2(iso[3]), mesic: pad2(iso[2]), rok: iso[1] };
  const cz = /^(\d{1,2})\s*[./\-\s]\s*(\d{1,2})\s*[./\-\s]\s*(\d{4})\.?$/.exec(
    t,
  );
  if (cz) return { den: pad2(cz[1]), mesic: pad2(cz[2]), rok: cz[3] };
  return null;
}

export type DateError = "incomplete" | "invalid" | "future" | "range";

export const MIN_YEAR = 1900;

/**
 * Validace data narození. null = platné.
 * `today` se předává kvůli testovatelnosti (výchozí: dnešek).
 */
export function validateDate(
  p: DateParts,
  today: Date = new Date(),
): DateError | null {
  if (!p.den || !p.mesic || p.rok.length !== 4) return "incomplete";
  if (!/^\d+$/.test(p.den + p.mesic + p.rok)) return "invalid";
  const d = Number(p.den);
  const m = Number(p.mesic);
  const y = Number(p.rok);
  if (m < 1 || m > 12 || d < 1) return "invalid";
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  )
    return "invalid";
  if (y < MIN_YEAR) return "range";
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  if (dt.getTime() > todayUtc) return "future";
  return null;
}

/** „14. 5. 1990“ (bez úvodních nul). */
export function formatDate(p: DateParts): string {
  return `${Number(p.den)}. ${Number(p.mesic)}. ${p.rok}`;
}

/* ---------- čas ---------- */

export type TimeError = "incomplete" | "invalid";

/** Přijme 14:30, 1430, 7:05, 7.05 → „HH:MM“; jinak null. */
export function normalizeTime(raw: string): string | null {
  const t = raw.trim();
  const m =
    /^(\d{1,2})\s*[:.]\s*(\d{2})$/.exec(t) ?? /^(\d{2})(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${pad2(String(h))}:${m[2]}`;
}

export function validateTime(raw: string): TimeError | null {
  if (!raw.trim()) return "incomplete";
  return normalizeTime(raw) ? null : "invalid";
}

/* ---------- místo ---------- */

export const normalizeText = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-–—_.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type PlaceError = "incomplete" | "not-from-list";

export function validatePlace(
  p: Pick<Person, "place" | "placeText">,
): PlaceError | null {
  if (!p.placeText.trim()) return "incomplete";
  if (!p.place || p.place.name !== p.placeText) return "not-from-list";
  return null;
}

/* ---------- celá osoba ---------- */

export type PersonErrors = {
  date: DateError | null;
  place: PlaceError | null;
  time: TimeError | null;
};

export function personErrors(
  p: Person,
  today: Date = new Date(),
): PersonErrors {
  let time: TimeError | null = null;
  if (p.mode === "exact") time = validateTime(p.cas);
  else if (p.mode === "approx" && p.approx !== "part")
    time = validateTime(p.cas);
  return { date: validateDate(p, today), place: validatePlace(p), time };
}

export function isPersonComplete(p: Person, today: Date = new Date()): boolean {
  const e = personErrors(p, today);
  return !e.date && !e.place && !e.time;
}

/* ---------- zobrazení zadaných údajů ---------- */

/** Čas pro hodnotu „Čas narození“ (pokladna). */
export function formatTimeValue(p: Person): string {
  if (p.mode === "unknown") return "neznámý";
  if (p.mode === "exact") return normalizeTime(p.cas) ?? p.cas;
  if (p.approx === "part") {
    const i = PART_INFO[p.part];
    return `${i.label} ${i.range}`;
  }
  return `${normalizeTime(p.cas) ?? p.cas} · ${APPROX_LABELS[p.approx]}`;
}

/** Čas pro shrnutí výsledku („čas neznámý“, „čas 14:30“, …). */
export function formatTimeSummary(p: Person): string {
  if (p.mode === "unknown") return "čas neznámý";
  if (p.mode === "approx" && p.approx === "part") return formatTimeValue(p);
  return `čas ${formatTimeValue(p)}`;
}

/** Hodnoty pro shrnutí; null pokud osoba není kompletní (pak platí ukázka z návrhu). */
export function summaryOf(p: Person, today: Date = new Date()) {
  if (!isPersonComplete(p, today) || !p.place) return null;
  return {
    datum: formatDate(p),
    misto: p.place.name,
    cas: formatTimeValue(p),
    casSummary: formatTimeSummary(p),
  };
}
