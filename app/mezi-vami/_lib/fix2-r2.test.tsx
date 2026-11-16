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
import { OsobaD, OsobaM } from "../_parts/OsobaForm";
import VysledekD from "../_v/VysledekD";
import VysledekM from "../_v/VysledekM";
import { SAMPLE_BADGE_TEXT } from "./SampleBadge";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (C: any, props?: Record<string, unknown>) => renderToStaticMarkup(createElement(C, { ...(props ?? {}), props: props ?? {} }));
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;| /g, " ").replace(/\s+/g, " ");

describe("Kolo 2/1 — štítek „Ukázkový obsah · prototyp“ v hlavičce všech obrazovek", () => {
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
    ObjednavkaD: [ObjednavkaD],
    ObjednavkaM: [ObjednavkaM],
    PlatbaD: [PlatbaD],
    PlatbaM: [PlatbaM],
    DoruceniD: [DoruceniD],
    DoruceniM: [DoruceniM],
    VzorekD: [VzorekD],
    VzorekM: [VzorekM],
  };
  for (const [name, [C, props]] of Object.entries(screens)) {
    it(`${name}: štítek je uvnitř <header>`, () => {
      const h = html(C, props);
      const header = /<header[\s\S]*?<\/header>/.exec(h)?.[0] ?? "";
      expect(header).toContain("data-sample-badge");
      expect(text(header)).toContain(SAMPLE_BADGE_TEXT);
    });
  }
  it("text štítku je z plátna", () => {
    expect(SAMPLE_BADGE_TEXT).toBe("Ukázkový obsah · prototyp");
  });
});

describe("Kolo 3 — zarovnání štítku na mobilu s osou loga", () => {
  it("levé logo (landing, výsledek) → štítek vlevo, ostatní centrovaně", () => {
    for (const [C, start] of [[LandingM, true], [VysledekM, true], [PlatbaM, false], [DoruceniM, false], [StartM, false]] as const) {
      const h = html(C, {});
      const wrap = /<div style="[^"]*"><p data-sample-badge/.exec(h)?.[0] ?? "";
      expect(wrap).toContain(start ? "justify-content:flex-start" : "justify-content:center");
    }
  });
});

describe("Kolo 2/2 — věty o podpoře jen s funkčním cílem podpory", () => {
  const SUPPORT = /podpor/i;
  const platba = ["Čeká na potvrzení", "Nepodařilo se ověřit", "Zrušeno", "Neúspěšná platba"];
  const doruceni = ["Platba potvrzena", "Analýza se připravuje", "Analýza připravená", "Odkaz vypršel"];

  for (const C of [PlatbaD, PlatbaM]) {
    for (const stav of platba) {
      it(`${C.name} „${stav}“: bez podpory žádná zmínka o podpoře`, () => {
        const t = text(html(C, { stav, podpora: false }));
        expect(t).not.toMatch(SUPPORT);
        expect(t).not.toContain("částka stržena");
      });
    }
    it(`${C.name}: bez podpory zůstane první věta helperu, s podporou obě`, () => {
      expect(text(html(C, { stav: "Nepodařilo se ověřit", podpora: false }))).toContain("Než stav ověříme, platbu prosím nezadávejte znovu.");
      const on = text(html(C, { stav: "Nepodařilo se ověřit", podpora: true }));
      expect(on).toContain("Než stav ověříme, platbu prosím nezadávejte znovu. Pokud vám byla částka stržena, kontaktujte podporu.");
      expect(on).toContain("Kontaktovat podporu");
    });
  }
  for (const C of [DoruceniD, DoruceniM]) {
    for (const stav of doruceni) {
      it(`${C.name} „${stav}“: bez podpory žádná zmínka o podpoře ani novém odkazu`, () => {
        const t = text(html(C, { stav, podpora: false }));
        expect(t).not.toMatch(SUPPORT);
        expect(t).not.toContain("nový odkaz");
        expect(t).not.toContain("Uveďte číslo objednávky");
      });
    }
    it(`${C.name}: bez podpory zbyde „Odkaz platí 30 dní.“, s podporou celé znění`, () => {
      expect(text(html(C, { stav: "Analýza připravená", podpora: false }))).toContain("Odkaz platí 30 dní.");
      const on = text(html(C, { stav: "Analýza připravená", podpora: true }));
      expect(on).toContain("Odkaz platí 30 dní. O nový odkaz můžete požádat podporu po dobu uchování analýzy.");
      const exp = text(html(C, { stav: "Odkaz vypršel", podpora: true }));
      expect(exp).toContain("O nový odkaz můžete požádat podporu. Vystavit jej lze po dobu uchování analýzy.");
    });
  }
});
