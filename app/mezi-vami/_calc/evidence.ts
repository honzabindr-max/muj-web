// Krok 4: Evidence Map. Čistě deterministický kód (žádné LLM): pro stejný astro vstup vždy stejný výstup.
// Každá vazba mezi osobami má evidence id odvozené z obsahu vazby (hash), ne z pořadí ani náhody.

import { createHash } from "node:crypto";
import {
  SIGNS,
  type AspectType,
  type AstroEstimate,
  type Body,
  type PersonAstro,
  type Sign,
} from "./astro";
import type { TimeMode } from "./types";

export type Theme =
  | "EMOTIONAL_BASE"
  | "COMMUNICATION"
  | "ATTRACTION"
  | "DRIVE_PRACTICAL"
  | "CORE_IDENTITY"
  | "GROWTH_TRUST"
  | "DEEP_CHANGE";
export type Polarity = "support" | "tension" | "neutral";
export type EvidenceKind = "ASPECT" | "ELEMENT" | "MODALITY" | "ANGLE_ELEMENT";

export type Evidence = {
  id: string; // ev_xxxxxxxxxxxx (platné OpaqueRef)
  kind: EvidenceKind;
  theme: Theme;
  polarity: Polarity;
  /** 0–1, jen pro řazení */
  strength: number;
  /** Věcný popis vazby česky; jediný zdroj faktů pro psaní textů. */
  fact: string;
  /** Krátký label opory pro zákazníka (≤ 180 znaků). */
  label: string;
};

export type EvidenceMap = {
  cohort: string;
  items: Evidence[];
};

export const BODY_CS: Record<Body, string> = {
  sun: "Slunce",
  moon: "Měsíc",
  mercury: "Merkur",
  venus: "Venuše",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uran",
  neptune: "Neptun",
  pluto: "Pluto",
};
const ASPECT_CS: Record<AspectType, string> = {
  conjunction: "spojení",
  sextile: "sextil",
  square: "kvadratura",
  trine: "trigon",
  opposition: "opozice",
};
const ASPECT_ANGLE: Record<AspectType, number> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
};
const ASPECT_POLARITY: Record<AspectType, Polarity> = {
  conjunction: "neutral",
  sextile: "support",
  trine: "support",
  square: "tension",
  opposition: "tension",
};
const ASPECT_WEIGHT: Record<AspectType, number> = {
  conjunction: 1,
  opposition: 0.95,
  square: 0.9,
  trine: 0.85,
  sextile: 0.7,
};
const BODY_WEIGHT: Record<Body, number> = {
  sun: 1,
  moon: 1,
  venus: 0.9,
  mars: 0.9,
  mercury: 0.8,
  jupiter: 0.6,
  saturn: 0.6,
  uranus: 0.35,
  neptune: 0.35,
  pluto: 0.35,
};
/** Téma určuje osobnější těleso z dvojice (pořadí = priorita). */
const THEME_OF: [Body, Theme][] = [
  ["moon", "EMOTIONAL_BASE"],
  ["mercury", "COMMUNICATION"],
  ["venus", "ATTRACTION"],
  ["mars", "DRIVE_PRACTICAL"],
  ["sun", "CORE_IDENTITY"],
  ["jupiter", "GROWTH_TRUST"],
  ["saturn", "GROWTH_TRUST"],
  ["uranus", "DEEP_CHANGE"],
  ["neptune", "DEEP_CHANGE"],
  ["pluto", "DEEP_CHANGE"],
];

export const THEME_CS: Record<Theme, string> = {
  EMOTIONAL_BASE: "citové zázemí",
  COMMUNICATION: "komunikace a vzájemné čtení situací",
  ATTRACTION: "přitažlivost a projevování náklonnosti",
  DRIVE_PRACTICAL: "tempo, iniciativa a každodenní fungování",
  CORE_IDENTITY: "základní povaha a to, jak se vidíte",
  GROWTH_TRUST: "důvěra, jistota a společný růst",
  DEEP_CHANGE: "hlubší proměny a opakující se motivy",
};

const ELEMENT = ["oheň", "země", "vzduch", "voda"] as const; // index = signIdx % 4
const MODALITY = ["cardinal", "fixed", "mutable"] as const; // index = signIdx % 3

const signIdx = (s: Sign) => SIGNS.indexOf(s);
const longitude = (sign: Sign, degree: number) => signIdx(sign) * 30 + degree;
const hash12 = (s: string) =>
  createHash("sha256").update(s).digest("hex").slice(0, 12);
const r1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => String(r1(n)).replace(".", ",");

function themeOf(a: Body, b: Body): Theme {
  for (const [body, theme] of THEME_OF)
    if (a === body || b === body) return theme;
  return "DEEP_CHANGE";
}

function separation(l1: number, l2: number): number {
  const d = Math.abs(l1 - l2) % 360;
  return d > 180 ? 360 - d : d;
}

export function canonicalCohort(a: TimeMode, b: TimeMode): string {
  const rank = { EXACT: 0, APPROXIMATE: 1, UNKNOWN: 2 } as const;
  const ch = { EXACT: "E", APPROXIMATE: "A", UNKNOWN: "U" } as const;
  const [x, y] = [a, b].sort((m, n) => rank[m] - rank[n]);
  return ch[x] + ch[y];
}

function planet(p: PersonAstro, body: Body) {
  return p.planets.find((x) => x.body === body);
}

const ASPECT_ORB_MAX = 6;
const LLM_ASPECT_ORB_MAX = 8;

const SIGN_LINK_PAIRS: [Body, Body][] = [
  ["sun", "sun"],
  ["moon", "moon"],
  ["venus", "venus"],
  ["mars", "mars"],
  ["mercury", "mercury"],
  ["sun", "moon"],
  ["moon", "sun"],
  ["venus", "mars"],
  ["mars", "venus"],
];

export function buildEvidenceMap(
  astro: AstroEstimate,
  modes: [TimeMode, TimeMode],
): EvidenceMap {
  const cohort = canonicalCohort(modes[0], modes[1]);
  const byId = new Map<string, Evidence>();
  const add = (e: Evidence) => {
    if (!byId.has(e.id)) byId.set(e.id, e);
  };

  // 1) Aspekty mezi osobami: spočtené z odhadnutých poloh (stupeň + znamení),
  //    k nim aspekty nahlášené odhadem, pokud je poloha potvrzuje.
  const candidates = new Map<string, { a: Body; b: Body; t: AspectType }>();
  for (const pa of astro.a.planets) {
    for (const pb of astro.b.planets) {
      const sep = separation(
        longitude(pa.sign, pa.degree),
        longitude(pb.sign, pb.degree),
      );
      for (const t of Object.keys(ASPECT_ANGLE) as AspectType[]) {
        if (Math.abs(sep - ASPECT_ANGLE[t]) <= ASPECT_ORB_MAX) {
          candidates.set(`${pa.body}|${pb.body}|${t}`, {
            a: pa.body,
            b: pb.body,
            t,
          });
        }
      }
    }
  }
  for (const asp of astro.aspects) {
    const pa = planet(astro.a, asp.a_body);
    const pb = planet(astro.b, asp.b_body);
    if (!pa || !pb) continue;
    const sep = separation(
      longitude(pa.sign, pa.degree),
      longitude(pb.sign, pb.degree),
    );
    if (Math.abs(sep - ASPECT_ANGLE[asp.aspect]) <= LLM_ASPECT_ORB_MAX) {
      candidates.set(`${asp.a_body}|${asp.b_body}|${asp.aspect}`, {
        a: asp.a_body,
        b: asp.b_body,
        t: asp.aspect,
      });
    }
  }
  for (const c of candidates.values()) {
    const pa = planet(astro.a, c.a)!;
    const pb = planet(astro.b, c.b)!;
    const orb = Math.abs(
      separation(longitude(pa.sign, pa.degree), longitude(pb.sign, pb.degree)) -
        ASPECT_ANGLE[c.t],
    );
    const strength =
      ((BODY_WEIGHT[c.a] + BODY_WEIGHT[c.b]) / 2) *
      ASPECT_WEIGHT[c.t] *
      Math.max(0.2, 1 - orb / 9);
    add({
      id: `ev_${hash12(`ASPECT|${c.a}|${pa.sign}|${c.b}|${pb.sign}|${c.t}`)}`,
      kind: "ASPECT",
      theme: themeOf(c.a, c.b),
      polarity: ASPECT_POLARITY[c.t],
      strength: Math.round(strength * 1000) / 1000,
      fact: `${BODY_CS[c.a]} první osoby (${pa.sign}) a ${BODY_CS[c.b]} druhé osoby (${pb.sign}): ${ASPECT_CS[c.t]}, odchylka ${fmt(orb)}°.`,
      label: `${BODY_CS[c.a]} první osoby a ${BODY_CS[c.b]} druhé osoby: ${ASPECT_CS[c.t]}`,
    });
  }

  // 2) Shoda živlů a kvality znamení u vybraných dvojic těles.
  for (const [ba, bb] of SIGN_LINK_PAIRS) {
    const pa = planet(astro.a, ba);
    const pb = planet(astro.b, bb);
    if (!pa || !pb) continue;
    const ia = signIdx(pa.sign);
    const ib = signIdx(pb.sign);
    const w = (BODY_WEIGHT[ba] + BODY_WEIGHT[bb]) / 2;
    if (ia % 4 === ib % 4) {
      add({
        id: `ev_${hash12(`ELEMENT|${ba}|${pa.sign}|${bb}|${pb.sign}`)}`,
        kind: "ELEMENT",
        theme: themeOf(ba, bb),
        polarity: "support",
        strength: Math.round(w * 0.55 * 1000) / 1000,
        fact: `${BODY_CS[ba]} první osoby (${pa.sign}) a ${BODY_CS[bb]} druhé osoby (${pb.sign}) jsou ve znameních stejného živlu (${ELEMENT[ia % 4]}).`,
        label: `${BODY_CS[ba]} a ${BODY_CS[bb]} ve znameních stejného živlu`,
      });
    }
    if (ia % 3 === ib % 3 && ia % 4 !== ib % 4) {
      add({
        id: `ev_${hash12(`MODALITY|${ba}|${pa.sign}|${bb}|${pb.sign}`)}`,
        kind: "MODALITY",
        theme: themeOf(ba, bb),
        polarity: "neutral",
        strength: Math.round(w * 0.4 * 1000) / 1000,
        fact: `${BODY_CS[ba]} první osoby (${pa.sign}) a ${BODY_CS[bb]} druhé osoby (${pb.sign}) mají stejnou kvalitu znamení (${MODALITY[ia % 3]}).`,
        label: `${BODY_CS[ba]} a ${BODY_CS[bb]} se stejnou kvalitou znamení`,
      });
    }
  }

  // 3) Vrstvy závislé na přesném čase jen v kohortě EE (jinak nejsou do výkladu zahrnuty).
  if (cohort === "EE" && astro.a.angles && astro.b.angles) {
    const pairs: [string, Sign, string, Sign, string][] = [
      [
        "ascendent první osoby",
        astro.a.angles.asc.sign,
        "ascendent druhé osoby",
        astro.b.angles.asc.sign,
        "asc-asc",
      ],
    ];
    const sunA = planet(astro.a, "sun");
    const sunB = planet(astro.b, "sun");
    if (sunB)
      pairs.push([
        "ascendent první osoby",
        astro.a.angles.asc.sign,
        "Slunce druhé osoby",
        sunB.sign,
        "asca-sunb",
      ]);
    if (sunA)
      pairs.push([
        "ascendent druhé osoby",
        astro.b.angles.asc.sign,
        "Slunce první osoby",
        sunA.sign,
        "ascb-suna",
      ]);
    for (const [n1, s1, n2, s2, key] of pairs) {
      if (signIdx(s1) % 4 === signIdx(s2) % 4) {
        add({
          id: `ev_${hash12(`ANGLE|${key}|${s1}|${s2}`)}`,
          kind: "ANGLE_ELEMENT",
          theme: "CORE_IDENTITY",
          polarity: "support",
          strength: 0.5,
          fact: `${n1} (${s1}) a ${n2} (${s2}) jsou ve znameních stejného živlu.`,
          label: `${n1[0].toUpperCase()}${n1.slice(1)} a ${n2} ve stejném živlu`,
        });
      }
    }
  }

  const items = [...byId.values()].sort(
    (x, y) => y.strength - x.strength || (x.id < y.id ? -1 : 1),
  );
  return { cohort, items };
}

export function evidenceMapHash(map: EvidenceMap): string {
  return createHash("sha256").update(JSON.stringify(map)).digest("hex");
}

/* ---------- plán slotů (deterministický): která evidence patří do kterého bloku ---------- */

export type SlotName = "R1" | "R2" | "R3" | "R4" | "R5";
export type Realisation =
  | "CORE_SIGNATURE"
  | "PARADOX"
  | "SECOND_DISTINCTIVE_PATTERN"
  | "SUPPORTIVE_PATTERN"
  | "SALIENT_NEUTRAL_PATTERN"
  | "STRONG_MISMATCH"
  | "ASYMMETRY_OR_DIFFERENT_RHYTHM"
  | "OBSERVATIONAL_APPLICATION";

export type SlotPlan = {
  slot: SlotName;
  realisation: Realisation;
  evidence: Evidence[];
};

/**
 * R1 = nejsilnější vazba (+ nejvýše jedna další ze stejného tématu).
 * R2–R5 jen když je pro ně skutečná evidence; jinak slot vypadne (fallback žebříček: omit).
 * Žádná evidence se nepoužije dvakrát. Nic se nevymýšlí kvůli bohatšímu vzhledu.
 */
export function planSlots(map: EvidenceMap): SlotPlan[] {
  const pool = [...map.items];
  if (pool.length === 0) return [];
  const take = (pred: (e: Evidence) => boolean): Evidence | undefined => {
    const i = pool.findIndex(pred);
    return i < 0 ? undefined : pool.splice(i, 1)[0];
  };

  const plans: SlotPlan[] = [];
  const first = pool.shift()!;
  const r1Items = [first];
  const second = take((e) => e.theme === first.theme);
  if (second) r1Items.push(second);
  plans.push({ slot: "R1", realisation: "CORE_SIGNATURE", evidence: r1Items });
  const usedThemes = new Set<Theme>([first.theme]);
  const freshTheme = (e: Evidence) => !usedThemes.has(e.theme);
  const note = (e: Evidence) => usedThemes.add(e.theme);

  // R2: paradox (podpora i napětí ve stejném tématu), jinak druhý odlišující motiv
  const themes = [...new Set(pool.map((e) => e.theme))];
  let paradox: Evidence[] | null = null;
  for (const th of themes) {
    if (usedThemes.has(th)) continue;
    const sup = pool.find((e) => e.theme === th && e.polarity === "support");
    const ten = pool.find((e) => e.theme === th && e.polarity === "tension");
    if (sup && ten) {
      paradox = [sup, ten];
      break;
    }
  }
  if (paradox) {
    for (const e of paradox) pool.splice(pool.indexOf(e), 1);
    note(paradox[0]);
    plans.push({ slot: "R2", realisation: "PARADOX", evidence: paradox });
  } else {
    const e = take(freshTheme) ?? take(() => true);
    if (e) {
      note(e);
      plans.push({
        slot: "R2",
        realisation: "SECOND_DISTINCTIVE_PATTERN",
        evidence: [e],
      });
    }
  }

  // R3: podpůrná dynamika, jinak výrazný neutrální motiv
  const r3 =
    take((e) => e.polarity === "support" && freshTheme(e)) ??
    take((e) => e.polarity === "support") ??
    take(freshTheme) ??
    take(() => true);
  if (r3) {
    note(r3);
    plans.push({
      slot: "R3",
      realisation:
        r3.polarity === "support"
          ? "SUPPORTIVE_PATTERN"
          : "SALIENT_NEUTRAL_PATTERN",
      evidence: [r3],
    });
  }

  // R4: nesoulad / rozdílný rytmus, jinak výrazný motiv
  const r4 =
    take((e) => e.polarity === "tension" && freshTheme(e)) ??
    take((e) => e.polarity === "tension") ??
    take(freshTheme) ??
    take(() => true);
  if (r4) {
    note(r4);
    plans.push({
      slot: "R4",
      realisation:
        r4.polarity === "tension"
          ? r4.strength >= 0.6
            ? "STRONG_MISMATCH"
            : "ASYMMETRY_OR_DIFFERENT_RHYTHM"
          : "SALIENT_NEUTRAL_PATTERN",
      evidence: [r4],
    });
  }

  // R5: pozorování pro každodennost (nikdy příslib nápravy), z další nepoužité evidence
  const r5 = take(freshTheme) ?? take(() => true);
  if (r5) {
    plans.push({
      slot: "R5",
      realisation: "OBSERVATIONAL_APPLICATION",
      evidence: [r5],
    });
  }
  return plans;
}
