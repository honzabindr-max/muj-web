// Deterministická vrstva nad výpočtem poloh: z ekliptikálních délek (od CalcProvideru) odvodí
// znamení, nejistotu Měsíce podle přesnosti času a vazby (aspekty) mezi oběma osobami.
// Poskytovatel poloh (AI teď, ephemeris později) dodává jen délky — vše ostatní je tady.

import { z } from "zod";

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
export type Body = (typeof BODIES)[number];

export const BODY_CS: Record<Body, { name: string; glyph: string }> = {
  sun: { name: "Slunce", glyph: "☉" },
  moon: { name: "Měsíc", glyph: "☽" },
  mercury: { name: "Merkur", glyph: "☿" },
  venus: { name: "Venuše", glyph: "♀" },
  mars: { name: "Mars", glyph: "♂" },
  jupiter: { name: "Jupiter", glyph: "♃" },
  saturn: { name: "Saturn", glyph: "♄" },
  uranus: { name: "Uran", glyph: "♅" },
  neptune: { name: "Neptun", glyph: "♆" },
  pluto: { name: "Pluto", glyph: "♇" },
};

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
export type Sign = (typeof SIGNS)[number];

export type AspectType = "conj" | "sextile" | "square" | "trine" | "opposition";
export const ASPECTS: { type: AspectType; angle: number; orb: number; glyph: string; cs: string }[] = [
  { type: "conj", angle: 0, orb: 8, glyph: "☌", cs: "spojení" },
  { type: "sextile", angle: 60, orb: 4, glyph: "⚹", cs: "sextil" },
  { type: "square", angle: 90, orb: 6, glyph: "□", cs: "kvadratura" },
  { type: "trine", angle: 120, orb: 6, glyph: "△", cs: "trigon" },
  { type: "opposition", angle: 180, orb: 7, glyph: "☍", cs: "opozice" },
];

/* ---------- vstup ---------- */

export const TimeSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("exact"), cas: z.string().regex(/^\d{2}:\d{2}$/) }),
  z.object({
    mode: z.literal("approx"),
    cas: z.string().regex(/^\d{2}:\d{2}$/),
    plusMinusMin: z.union([z.literal(30), z.literal(60), z.literal(120)]),
  }),
  z.object({
    mode: z.literal("part"),
    part: z.enum(["noc", "rano", "odpoledne", "vecer"]),
  }),
  z.object({ mode: z.literal("unknown") }),
]);

export const PersonInputSchema = z.object({
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  misto: z.object({
    name: z.string().min(1).max(80),
    okres: z.string().max(80),
    cc: z.enum(["CZ", "SK"]),
  }),
  cas: TimeSchema,
  /** gramatický rod pro texty (reference_style); jméno se NEPOSÍLÁ */
  styl: z.enum(["neutral", "m", "f"]),
});
export type PersonInput = z.infer<typeof PersonInputSchema>;

export const CalcInputSchema = z.object({ a: PersonInputSchema, b: PersonInputSchema });
export type CalcInput = z.infer<typeof CalcInputSchema>;

/* ---------- čas → UT ---------- */

const PART_CENTER: Record<"noc" | "rano" | "odpoledne" | "vecer", [string, number]> = {
  noc: ["03:00", 180],
  rano: ["09:00", 180],
  odpoledne: ["15:00", 180],
  vecer: ["21:00", 180],
};

/** Referenční místní čas a nejistota ± minut (neznámý čas = poledne ±12 h). */
export function timeWindow(t: PersonInput["cas"]): { local: string; plusMinusMin: number; known: boolean } {
  switch (t.mode) {
    case "exact":
      return { local: t.cas, plusMinusMin: 0, known: true };
    case "approx":
      return { local: t.cas, plusMinusMin: t.plusMinusMin, known: true };
    case "part": {
      const [local, pm] = PART_CENTER[t.part];
      return { local, plusMinusMin: pm, known: false };
    }
    case "unknown":
      return { local: "12:00", plusMinusMin: 720, known: false };
  }
}

/** Posun místního času v Europe/Prague (= Bratislava) vůči UTC v minutách, pro dané datum a čas. */
function pragueOffsetMin(y: number, m: number, d: number, hh: number, mm: number): number {
  // iterativně: odhad UTC → zjistit offset Intl → upřesnit
  let guess = Date.UTC(y, m - 1, d, hh, mm) - 60 * 60_000;
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Prague",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(guess));
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const localAsUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
    const offset = (localAsUtc - guess) / 60_000;
    guess = Date.UTC(y, m - 1, d, hh, mm) - offset * 60_000;
  }
  const back = Date.UTC(y, m - 1, d, hh, mm) - guess;
  return back / 60_000;
}

/** ISO UT čas narození (referenční bod okna) pro danou osobu. */
export function toUt(p: PersonInput): { ut: string; offsetMin: number; plusMinusMin: number; known: boolean } {
  const [y, m, d] = p.datum.split("-").map(Number);
  const w = timeWindow(p.cas);
  const [hh, mm] = w.local.split(":").map(Number);
  const offsetMin = pragueOffsetMin(y, m, d, hh, mm);
  const ut = new Date(Date.UTC(y, m - 1, d, hh, mm) - offsetMin * 60_000).toISOString();
  return { ut, offsetMin, plusMinusMin: w.plusMinusMin, known: w.known };
}

/* ---------- polohy → znamení, nejistota ---------- */

export const LongitudesSchema = z.object(
  Object.fromEntries(BODIES.map((b) => [b, z.number().min(0).max(360)])) as Record<Body, z.ZodNumber>,
);
export type Longitudes = z.infer<typeof LongitudesSchema>;

/** Přibližná denní rychlost (°/den) pro odhad rozsahu při nejistém čase. */
const SPEED: Record<Body, number> = {
  sun: 1, moon: 13.2, mercury: 1.6, venus: 1.2, mars: 0.8, jupiter: 0.25,
  saturn: 0.13, uranus: 0.06, neptune: 0.04, pluto: 0.04,
};

export const norm = (x: number) => ((x % 360) + 360) % 360;
export const signOf = (lon: number): Sign => SIGNS[Math.floor(norm(lon) / 30)];
export const degInSign = (lon: number) => norm(lon) % 30;

export type Position = {
  body: Body;
  lon: number;
  sign: Sign;
  deg: number;
  /** znamení, která jsou v rámci nejistoty času možná (1 = jisté) */
  possibleSigns: Sign[];
};

export function positions(lon: Longitudes, plusMinusMin: number): Position[] {
  return BODIES.map((body) => {
    const l = norm(lon[body]);
    const spread = (SPEED[body] * plusMinusMin) / (24 * 60);
    const from = signOf(l - spread);
    const to = signOf(l + spread);
    const possibleSigns = from === to ? [signOf(l)] : Array.from(new Set([from, signOf(l), to]));
    return { body, lon: l, sign: signOf(l), deg: degInSign(l), possibleSigns };
  });
}

/* ---------- vazby mezi osobami ---------- */

export type Aspect = {
  id: string;
  a: Body;
  b: Body;
  type: AspectType;
  orb: number;
  /** váha pro řazení: osobní planety a těsný orb výš */
  weight: number;
  /** vazba je nejistá kvůli času (Měsíc u nepřesného času) */
  uncertain: boolean;
};

const PERSONAL = new Set<Body>(["sun", "moon", "mercury", "venus", "mars"]);
const SLOW = new Set<Body>(["uranus", "neptune", "pluto"]);

export function synastry(pa: Position[], pb: Position[], pmA: number, pmB: number): Aspect[] {
  const out: Aspect[] = [];
  for (const x of pa) {
    for (const y of pb) {
      // generační dvojice pomalých planet (všichni stejného věku je mají stejně) vynechat
      if (SLOW.has(x.body) && SLOW.has(y.body)) continue;
      const diff = Math.abs(norm(x.lon - y.lon));
      const sep = diff > 180 ? 360 - diff : diff;
      for (const asp of ASPECTS) {
        const orb = Math.abs(sep - asp.angle);
        if (orb > asp.orb) continue;
        const personal = (PERSONAL.has(x.body) ? 1 : 0) + (PERSONAL.has(y.body) ? 1 : 0);
        const uncertain =
          (x.body === "moon" && pmA >= 120) || (y.body === "moon" && pmB >= 120);
        const weight = personal * 2 + (1 - orb / asp.orb) * 2 - (uncertain ? 2 : 0);
        out.push({ id: `${x.body}-${asp.type}-${y.body}`, a: x.body, b: y.body, type: asp.type, orb, weight, uncertain });
      }
    }
  }
  return out.sort((p, q) => q.weight - p.weight);
}

export const fmtDeg = (x: number) => `${x.toFixed(1).replace(".", ",")}°`;

/** Odvozený výpočet uložený v DB a předávaný pisateli. */
export type Derived = {
  a: { positions: Position[]; ut: string; plusMinusMin: number; known: boolean; styl: PersonInput["styl"] };
  b: { positions: Position[]; ut: string; plusMinusMin: number; known: boolean; styl: PersonInput["styl"] };
  aspects: Aspect[];
};

export function derive(input: CalcInput, lonA: Longitudes, lonB: Longitudes): Derived {
  const ua = toUt(input.a);
  const ub = toUt(input.b);
  const pa = positions(lonA, ua.plusMinusMin);
  const pb = positions(lonB, ub.plusMinusMin);
  return {
    a: { positions: pa, ut: ua.ut, plusMinusMin: ua.plusMinusMin, known: ua.known, styl: input.a.styl },
    b: { positions: pb, ut: ub.ut, plusMinusMin: ub.plusMinusMin, known: ub.known, styl: input.b.styl },
    aspects: synastry(pa, pb, ua.plusMinusMin, ub.plusMinusMin),
  };
}

/* ---------- deterministické věty a tóny ---------- */

const ELEMENT: Record<Sign, "fire" | "earth" | "air" | "water"> = {
  Beran: "fire", Lev: "fire", Střelec: "fire",
  Býk: "earth", Panna: "earth", Kozoroh: "earth",
  Blíženci: "air", Váhy: "air", Vodnář: "air",
  Rak: "water", Štír: "water", Ryby: "water",
};

/** Tón řádku „Kdo je kdo“ pro dvojici stejných těles: podle vazby, jinak podle živlů. */
export function rowTone(d: Derived, body: Body): "ladite" | "trete" | "plynete" {
  const asp = d.aspects.find((x) => x.a === body && x.b === body);
  if (asp) {
    if (asp.type === "conj") return "plynete";
    if (asp.type === "trine" || asp.type === "sextile") return "ladite";
    return "trete";
  }
  const ea = ELEMENT[d.a.positions.find((p) => p.body === body)!.sign];
  const eb = ELEMENT[d.b.positions.find((p) => p.body === body)!.sign];
  if (ea === eb) return "plynete";
  const pair = new Set([ea, eb]);
  if ((pair.has("fire") && pair.has("air")) || (pair.has("earth") && pair.has("water"))) return "ladite";
  return "trete";
}

const PHRASE: Record<Body, (x: string) => string> = {
  sun: (x) => `kým je ${x}`,
  moon: (x) => `co k bezpečí potřebuje ${x}`,
  mercury: (x) => `jak mluví ${x}`,
  venus: (x) => `jak miluje ${x}`,
  mars: (x) => `jak jde ${x} do věcí`,
  jupiter: (x) => `kde ${x} povzbuzuje`,
  saturn: (x) => `čím drží ${x} stálost`,
  uranus: (x) => `kde ${x} potřebuje volnost`,
  neptune: (x) => `kde ${x} čte mezi řádky`,
  pluto: (x) => `co ${x} v sobě proměňuje`,
};
const VERB: Record<AspectType, string> = {
  conj: "splývá s tím",
  trine: "plyne s tím",
  sextile: "snadno se doplňuje s tím",
  square: "se tře s tím",
  opposition: "stojí naproti tomu",
};

/** „Jak jde {A1} do věcí, splývá s tím, kým je {B1}.“ — přesně podle vazby. */
export function aspectSentence(a: Aspect): string {
  const left = PHRASE[a.a]("{A1}");
  return `${left.charAt(0).toUpperCase()}${left.slice(1)}, ${VERB[a.type]}, ${PHRASE[a.b]("{B1}")}.`;
}

export const SIGN_KEYWORDS: Record<Sign, string> = {
  Beran: "odvaha, rychlý start, přímost, netrpělivost",
  Býk: "stálost, smysly, jistota, trpělivost",
  Blíženci: "zvědavost, řeč, pestrost, lehkost",
  Rak: "domov, péče, citlivost, potřeba blízkých",
  Lev: "srdce, velkorysost, potřeba být vidět",
  Panna: "pečlivost, služba, detail, praktičnost",
  Váhy: "harmonie, vztah, férovost, estetika",
  Štír: "hloubka, intenzita, všechno nebo nic",
  Střelec: "svoboda, dálka, smysl, optimismus",
  Kozoroh: "odpovědnost, cíl, vytrvalost, struktura",
  Vodnář: "vlastní pravidla, nezávislost, nápady, přátelství",
  Ryby: "vcítění, fantazie, splývání, něha",
};
