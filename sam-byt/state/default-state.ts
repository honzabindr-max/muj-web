import type { ListingId, ListingState, Username } from "@/sam-byt/types";

/** Stav bytu, se kterým uživatel ještě vůbec neinteragoval (žádný DB řádek). */
export function defaultState(userId: string, username: Username, listingId: ListingId): ListingState {
  return {
    userId,
    username,
    listingId,
    favorite: false,
    decision: "unreviewed",
    notes: "",
    ratingPrice: null,
    ratingPet: null,
    ratingLocation: null,
    ratingBalcony: null,
    ratingFurnishing: null,
    version: 0,
    updatedAt: new Date(0).toISOString(),
  };
}
