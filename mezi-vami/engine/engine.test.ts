import { describe, expect, it } from "vitest";
import { derive, signOf, toUt, type CalcInput, type Longitudes } from "./astro";
import { buildView } from "./view";
import { WriterOutputSchema, checkWriterOutput, type WriterOutput } from "./writer";
import { fillNames, FALLBACK_FORMS } from "@/app/mezi-vami/_lib/names";

const INPUT: CalcInput = {
  a: { datum: "1983-02-18", misto: { name: "Brno", okres: "Brno-město", cc: "CZ" }, cas: { mode: "exact", cas: "08:31" }, styl: "m" },
  b: { datum: "1976-12-01", misto: { name: "Zlín", okres: "Zlín", cc: "CZ" }, cas: { mode: "exact", cas: "07:30" }, styl: "f" },
};

// orientační délky (Slunce Vodnář / Střelec) — test logiky, ne přesnosti
const LA: Longitudes = { sun: 329.2, moon: 100.5, mercury: 305, venus: 355, mars: 350, jupiter: 247, saturn: 211, uranus: 247.5, neptune: 268, pluto: 208 };
const LB: Longitudes = { sun: 249.3, moon: 18, mercury: 235, venus: 225, mars: 248, jupiter: 51, saturn: 133, uranus: 222, neptune: 253, pluto: 192 };

describe("čas → UT (Europe/Prague, historický posun)", () => {
  it("Honzík 18. 2. 1983 8:31 SEČ → 07:31 UT", () => {
    expect(toUt(INPUT.a).ut).toBe("1983-02-18T07:31:00.000Z");
  });
  it("Markétka 1. 12. 1976 7:30 → 06:30 UT", () => {
    expect(toUt(INPUT.b).ut).toBe("1976-12-01T06:30:00.000Z");
  });
  it("letní čas 1. 7. 1990 12:00 → 10:00 UT", () => {
    expect(toUt({ ...INPUT.a, datum: "1990-07-01", cas: { mode: "exact", cas: "12:00" } }).ut).toBe(
      "1990-07-01T10:00:00.000Z",
    );
  });
  it("neznámý čas = poledne ±12 h", () => {
    const u = toUt({ ...INPUT.a, cas: { mode: "unknown" } });
    expect(u.plusMinusMin).toBe(720);
    expect(u.known).toBe(false);
  });
});

describe("odvozený výpočet", () => {
  const d = derive(INPUT, LA, LB);
  it("znamení Slunce", () => {
    expect(signOf(LA.sun)).toBe("Vodnář");
    expect(signOf(LB.sun)).toBe("Střelec");
  });
  it("vazby seřazené podle váhy, bez generačních dvojic pomalých planet", () => {
    expect(d.aspects.length).toBeGreaterThan(3);
    for (let i = 1; i < d.aspects.length; i++) expect(d.aspects[i - 1].weight).toBeGreaterThanOrEqual(d.aspects[i].weight);
    expect(d.aspects.find((a) => a.a === "neptune" && a.b === "pluto")).toBeUndefined();
  });
  it("Měsíc u neznámého času má více možných znamení", () => {
    const u = derive({ ...INPUT, b: { ...INPUT.b, cas: { mode: "unknown" } } }, LA, { ...LB, moon: 29 });
    expect(u.b.positions.find((p) => p.body === "moon")!.possibleSigns.length).toBeGreaterThan(1);
  });

  const top = d.aspects;
  const w: WriterOutput = {
    mainTheme: { title: "Navzájem se roztáčíte", line: "Co jeden vysloví, druhý už balí." },
    rows: [0, 1, 2, 3].map(() => ({ a: "člověk vlastních pravidel", b: "člověk dálky", ton: "ladite" as const, veta: "{A1} rozjede, {B1} dá směr." })),
    zaverVeta: "",
    temata: [0, 1, 2, 3, 4].map((i) => ({
      aspectIds: [top[i].id],
      nadpis: `Téma ${i}`,
      text: "Když {B1} vysloví nápad, {A1} už hledá klíčky. Vedle {B2} je {A1} odvážnější, než by byl sám. A funguje to i obráceně, což je v praxi docela vidět.",
      schvalne: "Schválně: kdo řekl „tak jdeme“?",
      dukazy: [{ aspectId: top[i].id, text: "Kde {A1} povzbuzuje, doplňuje se s tím, kým je {B1}." }],
    })),
    otazky: [1, 2, 3, 4, 5].map((k) => ({ otazka: "Kdo z vás táhne a kdy to druhého unaví?", kapitola: k })),
  };

  it("kontrola výstupu pisatele projde a hlídá značky i hlavní vazbu", () => {
    expect(checkWriterOutput(w, d)).toEqual([]);
    const bad = { ...w, temata: [{ ...w.temata[1] }, ...w.temata.slice(1)] };
    expect(checkWriterOutput(bad, d).join(" ")).toMatch(/hlavní vazba/);
    // méně témat: kontrola si řekne o opravu, schéma 3–4 témata ale přijme
    const short = { ...w, temata: w.temata.slice(0, 4) };
    expect(checkWriterOutput(short, d).join(" ")).toMatch(/přesně 5/);
    expect(WriterOutputSchema.parse(short).temata.length).toBe(4);
    expect(() => WriterOutputSchema.parse({ ...w, temata: w.temata.slice(0, 2) })).toThrow();
    // nadbytečné vazby v tématu se oříznou, neplatný tón výsledek neshodí
    const extra = {
      ...w,
      temata: w.temata.map((t) => ({ ...t, aspectIds: [...t.aspectIds, "x", "y"] })),
      rows: w.rows.map((r) => ({ ...r, ton: "nevim" })),
    };
    const p = WriterOutputSchema.parse(extra);
    expect(p.temata[0].aspectIds.length).toBe(2);
    expect(p.rows[0].ton).toBe("plynete");
  });

  it("view: jména jen jako značky, poznámka k času, 7 vazeb, karta bez [DOMÉNA]", () => {
    const v = buildView("00000000-0000-0000-0000-000000000000", INPUT, d, w);
    expect(v.pair.title).toBe("{A1} & {B1}");
    expect(v.pair.timeNote).toMatch(/přesně/);
    expect(v.nabidka.timeNote).toBe("");
    expect(v.vazby.length).toBeLessThanOrEqual(7);
    expect(v.vazby[0].strong).toBe(true);
    expect(v.kdoJeKdo.rows[0].a.znameni).toBe("Vodnář");
    expect(v.kdoJeKdo.rows[0].b.znameni).toBe("Střelec");
    expect(v.karta.paticka).not.toMatch(/DOMÉNA/);
    expect(JSON.stringify(v)).not.toMatch(/Honzík|Markétka/);
    // hlavní téma v hlavičce = téma 01, na které míří odkaz
    expect(v.pair.mainTheme.title.replace(/\.$/, "")).toBe(v.temata[0].nadpis.replace(/\.$/, ""));
    expect(v.kdoJeKdo.zaver.odkaz).toContain(v.temata[0].nadpis.replace(/\.$/, ""));
  });

  it("dosazení jmen: pády a velké písmeno na začátku věty", () => {
    const forms = {
      a: ["Honzík", "Honzíka", "Honzíkovi", "Honzíka", "Honzíku", "Honzíkovi", "Honzíkem"],
      b: ["Markétka", "Markétky", "Markétce", "Markétku", "Markétko", "Markétce", "Markétkou"],
    };
    expect(fillNames("Vedle {B2} je {A1} odvážnější.", forms)).toBe("Vedle Markétky je Honzík odvážnější.");
    expect(fillNames("{A1} & {B1}", FALLBACK_FORMS)).toBe("První osoba & Druhá osoba");
    expect(fillNames("Když {B1} mluví", FALLBACK_FORMS)).toBe("Když druhá osoba mluví");
  });
});

import { approxSunLongitude, sanityCheck } from "./calc";
describe("pojistka výpočtu AI", () => {
  it("přibližné Slunce sedí s referencí (astronomy-engine: 329,08° / 249,20°)", () => {
    expect(Math.abs(approxSunLongitude("1983-02-18T07:31:00Z") - 329.08)).toBeLessThan(0.1);
    expect(Math.abs(approxSunLongitude("1976-12-01T06:30:00Z") - 249.2)).toBeLessThan(0.1);
  });
  it("zahodí nuly i špatné Slunce, projde rozumný výstup", () => {
    const zero = Object.fromEntries(Object.keys(LA).map((k) => [k, 0])) as Longitudes;
    expect(() => sanityCheck(INPUT, zero, zero)).toThrow();
    expect(() => sanityCheck(INPUT, LA, LB)).not.toThrow();
  });
});

import { aspectSentence } from "./astro";
describe("věta hlavní vazby", () => {
  it("skládá se přesně podle vazby", () => {
    expect(aspectSentence({ id: "x", a: "mars", b: "sun", type: "conj", orb: 1, weight: 1, uncertain: false })).toBe(
      "Jak jde {A1} do věcí, splývá s tím, kým je {B1}.",
    );
    expect(aspectSentence({ id: "y", a: "venus", b: "mercury", type: "square", orb: 2, weight: 1, uncertain: false })).toBe(
      "Jak miluje {A1}, se tře s tím, jak mluví {B1}.",
    );
  });
});
