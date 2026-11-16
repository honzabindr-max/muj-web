import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
import PlatbaD from "../_dc/PlatbaD";
import PlatbaM from "../_dc/PlatbaM";
import DoruceniD from "../_dc/DoruceniD";
import DoruceniM from "../_dc/DoruceniM";
import LandingD from "../_dc/LandingD";
import LandingM from "../_dc/LandingM";
import StartD from "../_dc/StartD";
import StartM from "../_dc/StartM";
import VypocetD from "../_dc/VypocetD";
import VypocetM from "../_dc/VypocetM";
import ObjednavkaD from "../_dc/ObjednavkaD";
import ObjednavkaM from "../_dc/ObjednavkaM";
import VzorekD from "../_dc/VzorekD";
import VzorekM from "../_dc/VzorekM";
import Stavy from "../_dc/Stavy";
import { OsobaD, OsobaM } from "../_parts/OsobaForm";
import VysledekD from "../_v/VysledekD";
import VysledekM from "../_v/VysledekM";
import Karta from "../_v/Karta";
import { ERROR_COPY, validateEmail } from "./persons";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (C: any, props?: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(C, { ...(props ?? {}), props: props ?? {} }));
const text = (h: string) =>
  h.replace(/<[^>]+>/g, " ").replace(/&nbsp;| /g, " ").replace(/\s+/g, " ");

const screens: Record<string, [unknown, Record<string, unknown>?]> = {
  LandingD: [LandingD],
  LandingM: [LandingM],
  StartD: [StartD],
  StartM: [StartM],
  OsobaD: [OsobaD],
  OsobaM: [OsobaM],
  VypocetD: [VypocetD],
  VypocetM: [VypocetM],
  VysledekD: [VysledekD, {}],
  VysledekM: [VysledekM, {}],
  "VysledekD s1": [VysledekD, { sampleState: "s1" }],
  "VysledekM s2": [VysledekM, { sampleState: "s2" }],
  ObjednavkaD: [ObjednavkaD],
  ObjednavkaM: [ObjednavkaM],
  PlatbaD: [PlatbaD],
  PlatbaM: [PlatbaM],
  DoruceniD: [DoruceniD],
  DoruceniM: [DoruceniM],
  VzorekD: [VzorekD],
  VzorekM: [VzorekM],
  Stavy: [Stavy],
  Karta: [Karta],
};

describe("Kolo 3 — chybové hlášky K-17a podle kódu chyby", () => {
  it("texty doslovně podle Copy Studia", () => {
    expect(ERROR_COPY.date).toEqual({
      incomplete: "Doplňte celé datum narození.",
      invalid: "Zadejte platné datum narození.",
      future: "Zadejte datum narození, které není v budoucnosti.",
      range: "Zadejte datum narození od roku 1900.",
    });
    expect(ERROR_COPY.place).toEqual({
      incomplete: "Zadejte místo narození a vyberte obec ze seznamu.",
      "not-from-list": "Vyberte obec ze seznamu míst v Česku a na Slovensku.",
    });
    expect(ERROR_COPY.time).toEqual({
      incomplete: "Doplňte čas narození v hodinách a minutách.",
      invalid: "Zadejte platný čas ve formátu HH:MM, například 14:30.",
    });
    expect(ERROR_COPY.email).toEqual({
      empty: "Doplňte e-mail pro doručení analýzy.",
      invalid: "Zadejte platnou e-mailovou adresu, například jmeno@domena.cz.",
    });
    expect(ERROR_COPY.placeNoResult).toBe(
      "Obec nenalezena; zkuste název obce v ČR nebo SR bez městské části.",
    );
  });
  it("e-mail: prázdný / neplatný formát / platný", () => {
    expect(validateEmail("")).toBe("empty");
    expect(validateEmail("   ")).toBe("empty");
    for (const bad of ["abc", "a@b", "a@b.", "@b.cz", "a b@c.cz", "a@@b.cz"])
      expect(validateEmail(bad), bad).toBe("invalid");
    for (const ok of ["jmeno@domena.cz", "a.b+c@sub.domena.sk"])
      expect(validateEmail(ok), ok).toBeNull();
  });
  it("žádné „[chybí copy“ ve zdroji ani v renderovaném výstupu", () => {
    const root = path.resolve(__dirname, "..");
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(d, e.name)) : /\.(tsx?|css)$/.test(e.name) && !/\.test\./.test(e.name) ? [path.join(d, e.name)] : [],
      );
    for (const f of walk(root)) expect(fs.readFileSync(f, "utf8"), f).not.toMatch(/chybí copy/i);
    for (const [name, [C, props]] of Object.entries(screens))
      expect(text(html(C, props)), name).not.toMatch(/chybí copy/i);
  });
  it("pokladna: pole e-mailu je připraveno na vlastní hlášku (bez nativní reportValidity)", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../_parts/PersonValues.tsx"), "utf8");
    expect(src).not.toContain("reportValidity");
    expect(src).toContain('aria-invalid');
    expect(src).toContain('aria-describedby');
  });
});

describe("Kolo 3 — ascendent, B-P0, rod, pomlčky", () => {
  it("výraz „ascendent“ není v žádném renderovaném textu ani ve fixtures", () => {
    for (const [name, [C, props]] of Object.entries(screens))
      expect(text(html(C, props)), name).not.toMatch(/ascendent/i);
    const fx = fs.readFileSync(path.resolve(__dirname, "../_data/fixtures.ts"), "utf8");
    expect(fx).not.toMatch(/ascendent/i);
  });
  it("COPY-14a / COPY-14b na výsledku", () => {
    const d = text(html(VysledekD, {}));
    expect(d).toContain(
      "Čas narození: Jana přibližně (±1 h), Tomáš přesně. Části výkladu, které bez přesného času nelze bezpečně určit, vynecháváme. Co nejde spočítat, nedopočítáváme.",
    );
    expect(d).toContain(
      "Čas narození Jany je přibližný. Části výkladu, které bez přesného času nelze bezpečně určit, vynecháváme i v Hloubkové analýze. Znáte přesný čas?",
    );
  });
  for (const [name, C] of [["VysledekD", VysledekD], ["VysledekM", VysledekM]] as const) {
    it(`${name}: blok B-P0 + K-13 je bezprostředně před tlačítkem „Objednat Hloubkovou analýzu“`, () => {
      const h = html(C, {});
      const t = text(h);
      const i = t.indexOf("Z čeho analýza vychází");
      const cta = t.indexOf("Objednat Hloubkovou analýzu");
      expect(i).toBeGreaterThan(-1);
      expect(cta).toBeGreaterThan(i);
      // mezi blokem a tlačítkem je jen text posledního odstavce (žádná cena ani jiný prvek)
      const between = t.slice(i, cta);
      expect(between).toMatch(/Zahrnujeme jen to, co lze pro danou dvojici z těchto údajů podložit\.\s*$/);
      expect(between).not.toMatch(/Kč/);
      expect(h.match(/<section aria-labelledby="zdroj-analyzy"[\s\S]*?<\/section>/)?.[0].match(/<p /g)).toHaveLength(4);
      expect(between).toContain(
        "Interpretace vycházejí z astrologického výpočtu podle data a místa narození obou lidí. Čas narození zohledňujeme podle toho, zda a jak přesně je známý.",
      );
      expect(between).toContain("Astrologická interpretace není vědeckým důkazem ani předpovědí.");
    });
  }
  it("/osoba: jediná volba rodu („Oslovovat“), starý rozbalovací blok je pryč", () => {
    for (const C of [OsobaD, OsobaM]) {
      const h = html(C);
      expect(h).not.toContain("Gramatická podoba textu");
      expect(h).not.toContain("<details");
      expect(h.match(/aria-label="Oslovovat"/g)).toHaveLength(1);
      expect(h).not.toMatch(/V mužském rodě|V ženském rodě/);
    }
  });
  it("/objednavka: gramatická podoba (D-06) zůstává", () => {
    for (const C of [ObjednavkaD, ObjednavkaM]) expect(text(html(C))).toContain("Gramatická podoba textu");
  });
  it("em dash „—“ není v textu žádné routy (pomlčka „–“ s mezerami)", () => {
    for (const [name, [C, props]] of Object.entries(screens)) {
      expect(text(html(C, props)), name).not.toContain("—");
      expect(html(C, props), name).not.toContain("—");
    }
    for (const f of ["layout.tsx", "vysledek/page.tsx", "start/page.tsx"])
      expect(fs.readFileSync(path.resolve(__dirname, "..", f), "utf8")).toMatch(f === "layout.tsx" ? /%s – MEZI VÁMI/ : /–/);
    const lay = fs.readFileSync(path.resolve(__dirname, "../layout.tsx"), "utf8");
    expect(lay).not.toContain("%s — MEZI");
  });
});
