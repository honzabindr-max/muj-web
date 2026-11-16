// Uložený výpočet + texty → DnaView pro stránku V. Deterministické části (znamení, vazby,
// odchylky, poznámky k času) skládá kód, texty dodal pisatel. Jména zůstávají jako značky {A1}….

import {
  KARTA,
  KDO_JE_KDO,
  NABIDKA,
  OTEVRENE,
  PAIR,
  type VazbaTyp,
  type NitTyp,
  type NoteTon,
} from "@/app/mezi-vami/_data/fixtures";
import { nbsp } from "@/app/mezi-vami/_lib/nbsp";
import type { DnaView } from "@/app/mezi-vami/_v/view-data";
import { ASPECTS, BODY_CS, aspectSentence, fmtDeg, rowTone, type AspectType, type CalcInput, type Derived, type Sign } from "./astro";
import { CHAPTERS, ROW_BODIES, type WriterOutput } from "./writer";

const SIGN_LOC: Record<Sign, string> = {
  Beran: "v Beranu",
  Býk: "v Býku",
  Blíženci: "v Blížencích",
  Rak: "v Raku",
  Lev: "ve Lvu",
  Panna: "v Panně",
  Váhy: "ve Vahách",
  Štír: "ve Štíru",
  Střelec: "ve Střelci",
  Kozoroh: "v Kozorohu",
  Vodnář: "ve Vodnáři",
  Ryby: "v Rybách",
};

const TON: Record<NoteTon, { nit: NitTyp; verdikt: string }> = {
  ladite: { nit: "touch", verdikt: "Ladíte." },
  trete: { nit: "cross", verdikt: "Třete se." },
  plynete: { nit: "merge", verdikt: "Plynete." },
};

const VAZBA_TYP: Record<AspectType, VazbaTyp> = {
  conj: "conj",
  sextile: "sextile",
  square: "square",
  trine: "trine",
  opposition: "square",
};

function mist(n: number) {
  if (n === 1) return "1 místo, kde se potkáváte";
  if (n >= 2 && n <= 4) return `${n} místa, kde se potkáváte`;
  return `${n} míst, kde se potkáváte`;
}

function timeLabel(c: CalcInput["a"]["cas"]): string {
  switch (c.mode) {
    case "exact":
      return "přesně";
    case "approx":
      return `přibližně (±${c.plusMinusMin === 60 ? "1 h" : c.plusMinusMin === 120 ? "2 h" : "30 min"})`;
    case "part":
      return "jen část dne";
    case "unknown":
      return "neznámý";
  }
}

function deepNb<T>(v: T): T {
  if (typeof v === "string") return nbsp(v) as T;
  if (Array.isArray(v)) return v.map(deepNb) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepNb(x)])) as T;
  return v;
}

export function buildView(id: string, input: CalcInput, d: Derived, w: WriterOutput): DnaView {
  const exactA = input.a.cas.mode === "exact";
  const exactB = input.b.cas.mode === "exact";
  const allExact = exactA && exactB;
  const top = d.aspects.slice(0, 7);
  const byId = new Map(d.aspects.map((a) => [a.id, a]));
  const astroOf = (aspId: string, withName = true) => {
    const a = byId.get(aspId);
    if (!a) return "";
    const def = ASPECTS.find((x) => x.type === a.type)!;
    const base = `${BODY_CS[a.a].name} ${def.glyph} ${BODY_CS[a.b].name}`;
    return withName ? `${base} · ${def.cs} · odchylka ${fmtDeg(a.orb)}` : `${base}, ${fmtDeg(a.orb)}`;
  };
  const posA = Object.fromEntries(d.a.positions.map((p) => [p.body, p]));
  const posB = Object.fromEntries(d.b.positions.map((p) => [p.body, p]));
  const signText = (p: { sign: Sign; possibleSigns: Sign[] }) =>
    p.possibleSigns.length > 1 ? p.possibleSigns.join(" / ") : p.sign;

  // writer-v2: hlavní téma si vybírá pisatel (mainTheme.aspectIds) a hero, karta 01 i box
  // „Tady se potkáváte nejvíc“ stojí na stejných vazbách. writer-v1: hlavní téma = nadpis karty 01
  // a box = nejsilnější vazba vstupu.
  const mainIds = (w.mainTheme.aspectIds ?? []).filter((x) => byId.has(x));
  const isV2 = mainIds.length > 0;
  const mainTitle = (isV2 ? w.mainTheme.title : w.temata[0]?.nadpis || w.mainTheme.title)
    .trim()
    .replace(/([^.?!…])$/, "$1.");
  const boxAspects = isV2 ? mainIds.map((x) => byId.get(x)!) : top.slice(0, 1);

  // poznámka k Měsíci: zůstává ve znamení i při nejistém času?
  let moonNote = "";
  for (const [k, ph] of [["a", "{A2}"], ["b", "{B2}"]] as const) {
    const pm = d[k].plusMinusMin;
    const moon = (k === "a" ? posA : posB).moon;
    if (pm > 0 && pm < 720 && moon && moon.possibleSigns.length === 1) {
      const w = pm === 60 ? "1 h" : pm === 120 ? "2 h" : `${pm} min`;
      moonNote = `Měsíc ${ph} zůstává ${SIGN_LOC[moon.sign]} i při nejistotě času ±${w}.`;
    }
  }

  const notExact = [!exactA ? "{A2}" : null, !exactB ? "{B2}" : null].filter(Boolean);
  const nabidkaTimeNote = notExact.length
    ? `Čas narození ${notExact.join(" i ")} ${notExact.length > 1 ? "není přesný" : "je přibližný nebo neznámý"}. Části výkladu, které bez přesného času nelze bezpečně určit, vynecháváme i v Hloubkové analýze. Znáte přesný čas?`
    : "";

  const view: DnaView = {
    id,
    pair: {
      ...PAIR,
      a: "{A1}",
      b: "{B1}",
      title: "{A1} & {B1}",
      nodesLabel: mist(top.length),
      timeNote: allExact
        ? "Čas narození: {A1} přesně, {B1} přesně. Co nejde spočítat, nedopočítáváme."
        : `Čas narození: {A1} ${timeLabel(input.a.cas)}, {B1} ${timeLabel(input.b.cas)}. Části výkladu, které bez přesného času nelze bezpečně určit, vynecháváme. Co nejde spočítat, nedopočítáváme.`,
      mainTheme: { title: mainTitle, line: w.mainTheme.line },
    },
    kdoJeKdo: {
      ...KDO_JE_KDO,
      rows: KDO_JE_KDO.rows.map((r, i) => {
        const body = ROW_BODIES[i];
        const row = { ...w.rows[i], ton: rowTone(d, body) };
        return {
          ...r,
          a: { text: row.a, znameni: signText(posA[body]) },
          b: { text: row.b, znameni: signText(posB[body]) },
          nit: TON[row.ton].nit,
          ton: row.ton,
          verdikt: TON[row.ton].verdikt,
          veta: row.veta,
        };
      }),
      zaver: {
        ...KDO_JE_KDO.zaver,
        // kontrast dvou vazeb: box ukáže obě, žádnou nevydává za vysvětlení celku
        veta: boxAspects.map((a) => aspectSentence(a)).join(" "),
        astro:
          boxAspects.length === 1
            ? astroOf(boxAspects[0].id)
            : boxAspects.map((a) => astroOf(a.id, false)).join(" · "),
        odkaz: `${mainTitle.replace(/\.$/, "")} ↓`,
        poznamka: moonNote,
      },
    },
    temata: w.temata.map((t, i) => ({
      id: `t0${i + 1}`,
      cislo: `0${i + 1}`,
      nadpis: t.nadpis,
      text: t.text,
      schvalne: t.schvalne || undefined,
      dukazy: t.dukazy.map((x) => ({ text: x.text, meta: astroOf(x.aspectId, false) })),
    })),
    otevrene: {
      ...OTEVRENE,
      // 1–3 personalizované otázky (první je hlavní); 0 = sekce se skryje a zůstane obecná pozvánka
      lead:
        w.otazky.length === 1
          ? "Vztahová DNA ukázala, co mezi vámi je. Tuhle otázku otevřela a rozvádí ji až Hloubková analýza."
          : OTEVRENE.lead,
      polozky: w.otazky.slice(0, 3).map((o, i) => ({
        cislo: `0${i + 1}`,
        otazka: o.otazka,
        kapitola: `V analýze: ${o.kapitola} · ${CHAPTERS[o.kapitola - 1]}`,
      })),
    },
    nabidka: { ...NABIDKA, timeNote: nabidkaTimeNote },
    karta: {
      ...KARTA,
      title: "{A1} & {B1}",
      tema: mainTitle,
      veta: w.mainTheme.line,
      jakMiluje: {
        ...KARTA.jakMiluje,
        a: { jmeno: "{A1}", text: w.rows[2].a },
        b: { jmeno: "{B1}", text: w.rows[2].b },
      },
      paticka: "Spočítejte si svou · good-inventions.work/mezi-vami",
    },
    vazby: top.map((a, i) => ({ typ: VAZBA_TYP[a.type], strong: i === 0 })),
  };
  return deepNb(view);
}
