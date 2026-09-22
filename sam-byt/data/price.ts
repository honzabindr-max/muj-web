import type { Listing } from "@/sam-byt/types";

const czk = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });

export function formatCzk(value: number): string {
  return `${czk.format(Math.round(value))} Kč`;
}

/**
 * Známé měsíční náklady jako rozsah (min===max u úplných/bodových cen).
 * Zdroj je vždy display_monthly_price — NIKDY known_monthly_total_czk ani
 * price_per_m2_czk, viz zadání bod 5 (u sam-05 jsou ty starší pole
 * zavádějící, zůstávají v datech jen pro dohledatelnost).
 */
export function formatMonthlyPriceRange(listing: Listing): string {
  const { known_min_czk, known_max_czk } = listing.display_monthly_price;
  if (known_min_czk === known_max_czk) {
    return formatCzk(known_min_czk);
  }
  return `${czk.format(known_min_czk)}–${czk.format(known_max_czk)} Kč`;
}

/** "známé náklady; další platby k ověření" pro všechny kromě sam-11. */
export function priceCompletenessNote(listing: Listing): string {
  if (listing.display_monthly_price.is_complete) {
    return "Úplná známá cena.";
  }
  return "Známé náklady; další platby k ověření.";
}

/**
 * Kč/m² pro řazení a zobrazení. Pokud zdroj dodává rozsah přímo
 * (price_per_m2_from/to_czk, např. sam-05), použije se ten. Jinak se
 * dopočítá ze známé ceny a plochy. Bez plochy vrací null (sam-11) — nikdy
 * se nedomýšlí.
 */
export function computePricePerM2(listing: Listing): { fromCzk: number; toCzk: number } | null {
  const { price_per_m2_from_czk, price_per_m2_to_czk, known_min_czk, known_max_czk } = listing.display_monthly_price;
  if (price_per_m2_from_czk != null && price_per_m2_to_czk != null) {
    return { fromCzk: price_per_m2_from_czk, toCzk: price_per_m2_to_czk };
  }
  if (listing.area_m2 == null || listing.area_m2 <= 0) {
    return null;
  }
  return {
    fromCzk: known_min_czk / listing.area_m2,
    toCzk: known_max_czk / listing.area_m2,
  };
}

export function formatPricePerM2(listing: Listing): string {
  const value = computePricePerM2(listing);
  if (!value) return "Neuvedeno (chybí plocha)";
  if (Math.round(value.fromCzk) === Math.round(value.toCzk)) {
    return `${czk.format(Math.round(value.fromCzk))} Kč/m²`;
  }
  return `${czk.format(Math.round(value.fromCzk))}–${czk.format(Math.round(value.toCzk))} Kč/m²`;
}

/**
 * Řadicí hodnota pro výchozí řazení "Kč/m² ↑". Byty bez plochy (sam-11)
 * jdou vždy až na konec — Infinity, ne 0/null, aby sort byl deterministický.
 */
export function sortPricePerM2Value(listing: Listing): number {
  const value = computePricePerM2(listing);
  if (!value) return Number.POSITIVE_INFINITY;
  return (value.fromCzk + value.toCzk) / 2;
}
