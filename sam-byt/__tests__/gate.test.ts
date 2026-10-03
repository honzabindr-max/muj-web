import { describe, expect, it } from "vitest";

import { getAllListings, getListingById, isValidListingId } from "../data/listings";

describe("integritní brána a identity 13 aktivních bytů (zadání bod 0.2, 0.4, 6)", () => {
  const listings = getAllListings();

  it("má právě 13 jedinečných aktivních sam-XX bytů", () => {
    expect(listings).toHaveLength(13);
    expect(new Set(listings.map((l) => l.id)).size).toBe(13);
  });

  it("součet rent_czk je 263 100", () => {
    expect(listings.reduce((s, l) => s + l.rent_czk, 0)).toBe(263_100);
  });

  it("součet display_monthly_price.known_min_czk je 314 562", () => {
    expect(listings.reduce((s, l) => s + l.display_monthly_price.known_min_czk, 0)).toBe(314_562);
  });

  it("celkem 49 obrázků napříč image_urls", () => {
    expect(listings.reduce((s, l) => s + l.image_urls.length, 0)).toBe(49);
  });

  it("is_complete=true má sam-09 (po cenové korekci) a sam-13", () => {
    const complete = listings.filter((l) => l.display_monthly_price.is_complete);
    expect(complete.map((l) => l.id)).toEqual(["sam-09", "sam-13"]);
  });

  it("area_m2 v pořadí aktivního katalogu odpovídá zadání", () => {
    expect(listings.map((l) => l.area_m2)).toEqual([75, 55, 61, 60, 60, 56, 58, 58, 50, 53.9, 74, 60, 62]);
  });

  it("rozlišuje dvě Vondrákovy (sam-06 60 m², sam-10 50 m²) jako samostatné byty", () => {
    const vondrakova = listings.filter((l) => l.street === "Vondrákova");
    expect(vondrakova).toHaveLength(2);
    expect(vondrakova.map((l) => l.id).sort()).toEqual(["sam-06", "sam-10"]);
    expect(vondrakova.map((l) => l.area_m2).sort()).toEqual([50, 60]);
  });

  it("rozlišuje dvě Jasanové (nájem 22 500 vs 22 800) jako samostatné byty", () => {
    const jasanova = listings.filter((l) => l.street === "Jasanová");
    expect(jasanova).toHaveLength(2);
    expect(jasanova.map((l) => l.rent_czk).sort()).toEqual([22_500, 22_800]);
  });

  it("archivovaná původní Opálkova 68 m² není v aktivním katalogu a nová Opálkova má sam-15", () => {
    const opalkova = listings.filter((l) => l.street === "Opálkova");
    expect(opalkova).toHaveLength(1);
    expect(opalkova[0]!.id).toBe("sam-15");
    expect(opalkova[0]!.area_m2).toBe(62);
    expect(listings.some((l) => l.id === "sam-02")).toBe(false);
  });

  it("původní smazaný Bazoš sam-11 není v aktivním katalogu", () => {
    expect(listings.some((l) => l.id === "sam-11")).toBe(false);
  });

  it("přidává Žabovřesky jako aktivní lokalitu", () => {
    expect(new Set(listings.map((l) => l.district))).toContain("Brno-Žabovřesky");
  });

  it("Habřinova (sam-05) je 60 m², Sreality 1636249676 — vyřazená 777/2 (59 m², Real Brno) v datech není", () => {
    const habrinova = listings.filter((l) => l.street === "Habřinova");
    expect(habrinova).toHaveLength(1);
    expect(habrinova[0]!.id).toBe("sam-05");
    expect(habrinova[0]!.area_m2).toBe(60);
    expect(habrinova[0]!.source_url).toContain("1636249676");
    // Vyřazená Habřinova 777/2 (59 m²) v datech není — jiná plocha než zachovaná sam-05 (60 m²).
    expect(listings.some((l) => l.street === "Habřinova" && l.area_m2 === 59)).toBe(false);
  });

  it("sam-10 má Sreality i Bazoš na tentýž byt v alternative_urls", () => {
    const sam10 = getListingById("sam-10")!;
    expect(sam10.alternative_urls.length).toBeGreaterThan(0);
  });

  it("žádný byt netvrdí konkrétního australského ovčáka výslovně schváleného", () => {
    expect(listings.every((l) => l.australian_shepherd_explicitly_approved === false)).toBe(true);
  });

  it("sam-06 je jediný s dohodou o zvířatech (po dohodě, ne povoleno)", () => {
    const withPets = listings.filter((l) => l.pets_status !== "neuvedeno");
    expect(withPets.map((l) => l.id)).toEqual(["sam-06"]);
    expect(withPets[0]!.pets_status).not.toMatch(/povoleno$/i);
  });

  it("nové byty mohou mít jiné dispozice než 2+1", () => {
    expect(listings.find((l) => l.id === "sam-12")!.disposition).toBe("2+kk");
    expect(listings.find((l) => l.id === "sam-13")!.disposition).toBe("3+1");
  });

  it("isValidListingId odmítá neznámé ID", () => {
    expect(isValidListingId("sam-01")).toBe(true);
    expect(isValidListingId("sam-12")).toBe(true);
    expect(isValidListingId("sam-02")).toBe(false);
    expect(isValidListingId("sam-777")).toBe(false);
  });

  it("žádná z 13 hlavních fotografií nebyla dnes živě ověřená (image_url_main_validated_live=false)", () => {
    expect(listings.every((l) => l.image_url_main_validated_live === false)).toBe(true);
  });

  it("obrázky žijí jen na povolených CSP doménách nebo jako lokální placeholder", () => {
    const allowed = new Set(["d18-a.sdn.cz", "api.bezrealitky.cz", "t.rmcl.cz", "www.bazos.cz"]);
    for (const listing of listings) {
      for (const url of listing.image_urls) {
        if (url.startsWith("/")) {
          expect(url).toBe("/sam-byt-placeholder.svg");
        } else {
          expect(allowed.has(new URL(url).host)).toBe(true);
        }
      }
    }
  });
});
