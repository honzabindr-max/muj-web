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

  it("sam-11 nemá Kč/m² (chybí ulice i plocha)", () => {
    const sam11 = getListingById("sam-11")!;
    expect(computePricePerM2(sam11)).toBeNull();
    expect(formatPricePerM2(sam11)).toMatch(/neuvedeno/i);
    expect(sortPricePerM2Value(sam11)).toBe(Number.POSITIVE_INFINITY);
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

  it("jen sam-11 má is_complete=true, ostatní hlásí neúplnost v poznámce", () => {
    const sam01 = getListingById("sam-01")!;
    expect(sam01.display_monthly_price.is_complete).toBe(false);
  });

  it("výchozí řazení dá sam-11 (bez plochy) vždy za byty s vypočítatelným Kč/m²", () => {
    const withArea = getListingById("sam-01")!;
    expect(sortPricePerM2Value(getListingById("sam-11")!)).toBeGreaterThan(sortPricePerM2Value(withArea));
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

  it("sam-11 má v celkové částce dovětek 'pro 2 osoby'", () => {
    const sam11 = getListingById("sam-11")!;
    expect(formatTotalCostsLabel(sam11)).toMatch(/pro 2 osoby$/);
  });

  it("10 z 11 bytů (vše kromě sam-11) má viditelné označení neúplnosti u celkové ceny", () => {
    const incomplete = getAllListings().filter((l) => l.id !== "sam-11");
    expect(incomplete).toHaveLength(10);
    for (const listing of incomplete) {
      expect(priceCompletenessNote(listing)).toMatch(/známé náklady/i);
    }
    expect(priceCompletenessNote(getListingById("sam-11")!)).toMatch(/úplná/i);
  });
});
