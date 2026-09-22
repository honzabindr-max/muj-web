import { computePricePerM2, sortPricePerM2Value } from "@/sam-byt/data/price";
import { petCategory } from "@/sam-byt/data/pets";
import type { Decision, Listing, ListingState, PetCategory } from "@/sam-byt/types";

export type BalconyFilter = "any" | "yes" | "no";
export type SortKey = "price_per_m2_asc" | "known_cost_asc" | "known_cost_desc" | "area_desc" | "district";

export interface Filters {
  districts: Set<string>;
  maxKnownCostCzk: number | null;
  minAreaM2: number | null;
  balcony: BalconyFilter;
  furnishing: Set<string>;
  pet: Set<PetCategory>;
  decisions: Set<Decision>;
  favoritesOnly: boolean;
}

export function emptyFilters(): Filters {
  return {
    districts: new Set(),
    maxKnownCostCzk: null,
    minAreaM2: null,
    balcony: "any",
    furnishing: new Set(),
    pet: new Set(),
    decisions: new Set(),
    favoritesOnly: false,
  };
}

export function applyFilters(listings: Listing[], filters: Filters, stateFor: (id: string) => ListingState): Listing[] {
  return listings.filter((listing) => {
    if (filters.districts.size > 0 && !filters.districts.has(listing.district)) return false;
    if (filters.maxKnownCostCzk != null && listing.display_monthly_price.known_min_czk > filters.maxKnownCostCzk) {
      return false;
    }
    if (filters.minAreaM2 != null) {
      if (listing.area_m2 == null || listing.area_m2 < filters.minAreaM2) return false;
    }
    if (filters.balcony === "yes" && listing.display_balcony_status !== "ano") return false;
    if (filters.balcony === "no" && listing.display_balcony_status === "ano") return false;
    if (filters.furnishing.size > 0 && !filters.furnishing.has(listing.manual_review.furnishing_for_filter)) {
      return false;
    }
    if (filters.pet.size > 0 && !filters.pet.has(petCategory(listing))) return false;
    const state = stateFor(listing.id);
    if (filters.decisions.size > 0 && !filters.decisions.has(state.decision)) return false;
    if (filters.favoritesOnly && !state.favorite) return false;
    return true;
  });
}

export function sortListings(listings: Listing[], sortKey: SortKey): Listing[] {
  const copy = [...listings];
  switch (sortKey) {
    case "price_per_m2_asc":
      return copy.sort((a, b) => sortPricePerM2Value(a) - sortPricePerM2Value(b));
    case "known_cost_asc":
      return copy.sort((a, b) => a.display_monthly_price.known_min_czk - b.display_monthly_price.known_min_czk);
    case "known_cost_desc":
      return copy.sort((a, b) => b.display_monthly_price.known_min_czk - a.display_monthly_price.known_min_czk);
    case "area_desc":
      return copy.sort((a, b) => (b.area_m2 ?? -1) - (a.area_m2 ?? -1));
    case "district":
      return copy.sort((a, b) => a.district.localeCompare(b.district, "cs"));
    default:
      return copy;
  }
}

export { computePricePerM2 };
