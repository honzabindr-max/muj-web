import { describe, expect, it } from "vitest";

import { getAllListings, getListingById } from "../data/listings";
import {
  computePricePerM2,
  formatMonthlyPriceRange,
  formatPricePerM2,
  formatRent,
  formatTotalCostsLabel,
  priceCompletenessNote,
  sortPricePerM2Value,
} from "../data/price";

describe("cenová logika (zadání bod 5)", () => {
  it("sam-05 má rozmezí 24 400–24 900 Kč a 407–415 Kč/m² (ne 20 900 / 348 Kč/m²)", () => {
    const sam05 = getListingById("sam-05")!;
    expect(formatMonthlyPriceRange(sam05).replace(/ /g, " ")).toBe("24 400–24 900 Kč");
    const perM2 = computePricePerM2(sam05)!;
    expect(Math.round(perM2.fromCzk)).toBe(407);
    expect(Math.round(perM2.toCzk)).toBe(415);
  });

  it("sam-13 má kompletní známou cenu 27 062 Kč a vypočítané Kč/m²", () => {
    const sam13 = getListingById("sam-13")!;
    expect(sam13.display_monthly_price.is_complete).toBe(true);
    expect(formatMonthlyPriceRange(sam13).replace(/ /g, " ")).toBe("27 062 Kč");
    expect(Math.round(computePricePerM2(sam13)!.fromCzk)).toBe(366);
    expect(formatPricePerM2(sam13)).toMatch(/366/);
  });

  it("sam-06 má 26 000 Kč známých měsíčních nákladů", () => {
    const sam06 = getListingById("sam-06")!;
    expect(sam06.display_monthly_price.known_min_czk).toBe(26_000);
    expect(sam06.display_monthly_price.known_max_czk).toBe(26_000);
  });

  it("sam-04 má rozpor v ploše zaznamenaný (61 m² užitná vs 56 m² čistá)", () => {
    const sam04 = getListingById("sam-04")!;
    expect(sam04.area_m2).toBe(61);
    expect(sam04.discrepancies.some((d) => /56/.test(d))).toBe(true);
  });

  it("sam-07 má rozpor v provizi zaznamenaný (21 900 vs 26 499)", () => {
    const sam07 = getListingById("sam-07")!;
    expect(sam07.discrepancies.some((d) => /21\s*900/.test(d) && /26\s*499/.test(d))).toBe(true);
  });

  it("sam-09 (po cenové korekci) a sam-13 mají is_complete=true, ostatní hlásí neúplnost v poznámce", () => {
    const sam01 = getListingById("sam-01")!;
    expect(sam01.display_monthly_price.is_complete).toBe(false);
    expect(getAllListings().filter((l) => l.display_monthly_price.is_complete).map((l) => l.id)).toEqual([
      "sam-09",
      "sam-13",
    ]);
  });

  it("sam-09 má kompletní známou cenu 27 100 Kč po korekci nájmu na 22 500 Kč", () => {
    const sam09 = getListingById("sam-09")!;
    expect(sam09.rent_czk).toBe(22_500);
    expect(sam09.services_czk).toBe(4_600);
    expect(sam09.display_monthly_price.is_complete).toBe(true);
    expect(formatMonthlyPriceRange(sam09).replace(/ /g, " ")).toBe("27 100 Kč");
  });

  it("výchozí řazení umí spočítat Kč/m² u všech aktivních bytů", () => {
    expect(getAllListings().every((listing) => Number.isFinite(sortPricePerM2Value(listing)))).toBe(true);
  });

  it("velké číslo na kartě je nájem (rent_czk), ne celkové náklady", () => {
    const sam01 = getListingById("sam-01")!;
    expect(formatRent(sam01).replace(/ /g, " ")).toBe("19 000 Kč");
  });

  it("malé číslo je 'celkem X Kč vč. záloh', u sam-05 jako rozsah", () => {
    const sam05 = getListingById("sam-05")!;
    const label = formatTotalCostsLabel(sam05).replace(/ /g, " ");
    expect(label).toBe("celkem 24 400–24 900 Kč vč. záloh");
  });

  it("11 z 13 bytů (vše kromě sam-09 a sam-13) má viditelné označení neúplnosti u celkové ceny", () => {
    const incomplete = getAllListings().filter((l) => l.id !== "sam-13" && l.id !== "sam-09");
    expect(incomplete).toHaveLength(11);
    for (const listing of incomplete) {
      expect(priceCompletenessNote(listing)).toMatch(/známé náklady/i);
    }
    expect(priceCompletenessNote(getListingById("sam-13")!)).toMatch(/úplná/i);
    expect(priceCompletenessNote(getListingById("sam-09")!)).toMatch(/úplná/i);
  });
});
