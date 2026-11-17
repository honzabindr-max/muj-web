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

import { checkV2, normalizeV2, parseStoredOutput, SOFT, WriterOutputV2Schema } from "./writer";
describe("writer-v2: kontrola, dorovnání a zobrazení", () => {
  const d = derive(INPUT, LA, LB);
  const [a0, a1, a2, a3, a4] = d.aspects;
  const text =
    "Třeba když {B1} vysloví nápad u snídaně: {A1} už v duchu balí, zatímco {B1} teprve zkouší, jak věta zní nahlas. Pro {A4} je to start, pro {B4} jen první náčrt. Vzniká z toho tempo, které oba baví, dokud si nevšimnou, že každý myslí jiný den. Zkuste se zeptat: „Je to plán, nebo nápad?“";
  const tema = (ids: string[], nadpis: string) => ({
    aspectIds: ids,
    nadpis,
    text,
    schvalne: "",
    dukazy: ids.map((id) => ({ aspectId: id, text: "Kde {A1} jde rovnou do věci, tam {B1} nejdřív zkouší, jak věc zní." })),
  });
  const rows = [0, 1, 2, 3].map((i) => ({
    a: "člověk vlastních pravidel",
    b: "člověk dálky",
    ton: ["ladite", "plynete", "ladite", "trete"][i] as "ladite" | "trete" | "plynete",
    veta: "Když {A1} rozjede nápad, {B1} k němu přidá směr.",
  }));
  const good: WriterOutput = {
    mainTheme: { title: "Plán, nebo nápad?", line: "Co jeden řekne nahlas, druhý už bere jako domluvu.", aspectIds: [a2.id, a3.id] },
    rows: rows.map((r, i) => ({ ...r, ton: ["sun", "moon", "venus", "mars"].map(() => r.ton)[i] })),
    zaverVeta: "",
    temata: [tema([a2.id, a3.id], "Věta, která pro každého znamená něco jiného"), tema([a0.id], "Tempo"), tema([a1.id, a4.id], "Klid")],
    otazky: [{ otazka: "Kdy se z jedné poznámky stane spor o celý den?", kapitola: 5, tema: 1 }],
  };

  it("schéma přijme 3 karty a 0 otázek", () => {
    const p = WriterOutputV2Schema.parse({ ...good, otazky: [] });
    expect(p.temata.length).toBe(3);
    expect(p.otazky).toEqual([]);
  });

  it("kontrola hlídá vazby hlavního tématu, důkazy, kapitoly a planety v textu", () => {
    const bad: WriterOutput = {
      ...good,
      mainTheme: { ...good.mainTheme, title: "Venuše a Mars se potkávají nečekaně", aspectIds: [a0.id] },
      temata: [{ ...good.temata[0], dukazy: good.temata[0].dukazy.slice(0, 1) }, good.temata[1], good.temata[1]],
      otazky: [{ otazka: "Proč?", kapitola: 12, tema: 7 }],
    };
    const e = checkV2(bad, d).join(" | ");
    expect(e).toMatch(/temata\[0\]\.aspectIds: musí obsahovat/);
    expect(e).toMatch(/temata\[0\]\.dukazy/);
    expect(e).toMatch(/stejná sada vazeb/);
    expect(e).toMatch(/mainTheme\.title: obsahuje název planety/);
    expect(e).toMatch(/kapitola: 12/);
    expect(e).toMatch(/tema: 7/);
  });

  it("mírně přetažená délka je měkká chyba (bez dalšího pokusu)", () => {
    const e = checkV2({ ...good, mainTheme: { ...good.mainTheme, title: "Plán, nebo jen nápad? To uvidíme." } }, d);
    expect(e.some((x) => x.startsWith(SOFT) && x.includes("mainTheme.title"))).toBe(true);
  });

  it("dorovnání vyřadí otázku bez návaznosti a sjednotí hlavní téma s první kartou", () => {
    const { output, fixes } = normalizeV2(
      { ...good, mainTheme: { ...good.mainTheme, aspectIds: [a0.id] }, otazky: [{ otazka: "Kdy?", kapitola: 99, tema: 1 }] },
      d,
    );
    expect(output.otazky).toEqual([]);
    expect(output.mainTheme.aspectIds).toEqual(output.temata[0].aspectIds);
    expect(fixes.join(" ")).toMatch(/otazky\[0\]/);
  });

  it("view: hero = hlavní téma, box ukáže obě vazby kontrastu, otázky 0 → sekce prázdná", () => {
    const v = buildView("00000000-0000-0000-0000-000000000000", INPUT, d, { ...good, otazky: [] });
    const sp = (x: string) => x.replace(/\u00a0/g, " ");
    expect(sp(v.pair.mainTheme.title)).toBe("Plán, nebo nápad?");
    expect(v.kdoJeKdo.zaver.astro.split(" · ").length).toBe(2);
    expect(sp(v.kdoJeKdo.zaver.odkaz)).toContain("Plán, nebo nápad?");
    expect(v.otevrene.polozky).toEqual([]);
    const v1q = buildView("00000000-0000-0000-0000-000000000000", INPUT, d, good);
    expect(v1q.otevrene.polozky.length).toBe(1);
    expect(v1q.otevrene.lead).toMatch(/Tuhle otázku/);
  });

  it("uložené výstupy obou verzí jdou načíst", () => {
    expect(parseStoredOutput("writer-v2", good).mainTheme.aspectIds).toEqual([a2.id, a3.id]);
    expect(() => parseStoredOutput("writer-v1", { ...good, otazky: [] })).toThrow();
  });
});

import { caseErrors } from "./writer";
describe("writer-v2: pád po předložce", () => {
  it("najde „u {A3}“ a „U {B3}“, nechá správné tvary", () => {
    expect(caseErrors("se u {A3} ani u {B3} nic nehromadí").length).toBe(2);
    expect(caseErrors("U {B3} se potkává")).toHaveLength(1);
    expect(caseErrors("Vedle {B2} je {A1} odvážnější. S {A7} se {B1} nenudí. Pro {A4} je to výzva.")).toEqual([]);
  });
});

describe("writer-v2: interní slovník", () => {
  it("otázka s „z druhé karty“ neprojde", () => {
    const d = derive(INPUT, LA, LB);
    const errs = checkV2(
      {
        mainTheme: { title: "Plán.", line: "Krátká věta.", aspectIds: [d.aspects[0].id] },
        rows: [],
        zaverVeta: "",
        temata: [],
        otazky: [{ otazka: "Jak se projeví rozjezd z druhé karty?", kapitola: 6, tema: 1 }],
      },
      d,
    );
    expect(errs.join(" ")).toMatch(/interní slovo/);
  });
});

import { openaiSchema } from "../llm";
describe("openaiSchema", () => {
  it("vynechá délky, enum a strukturu nechá", () => {
    const s = openaiSchema({
      type: "object",
      required: ["a"],
      additionalProperties: false,
      properties: { a: { type: "string", maxLength: 5 }, b: { type: "integer", enum: [1, 2] }, c: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } } },
    }) as Record<string, any>;
    expect(s.properties.a).toEqual({ type: "string" });
    expect(s.properties.b.enum).toEqual([1, 2]);
    expect(s.properties.c.minItems).toBe(1);
    expect(s.properties.c.items).toEqual({ type: "string" });
    expect(s.additionalProperties).toBe(false);
  });
});
