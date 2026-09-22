import rawListings from "@/data/sam-byt/listings.json";
import type { Listing, ListingId } from "@/sam-byt/types";

const EXPECTED_IDS: ListingId[] = [
  "sam-01",
  "sam-02",
  "sam-03",
  "sam-04",
  "sam-05",
  "sam-06",
  "sam-07",
  "sam-08",
  "sam-09",
  "sam-10",
  "sam-11",
];
const EXPECTED_RENT_SUM = 218_500;
const EXPECTED_KNOWN_MIN_SUM = 266_452;
const EXPECTED_IMAGE_COUNT = 54;
const EXPECTED_COMPLETE_ID: ListingId = "sam-11";
const EXPECTED_AREAS: Array<number | null> = [75, 68, 55, 61, 60, 60, 56, 58, 58, 50, null];

/**
 * Integritní brána z bodu 0.2 zadání, znovu vyhodnocená při každém
 * importu tohoto modulu (server startup / build) — pokud se
 * data/sam-byt/listings.json někdy nahradí poškozenou verzí, aplikace
 * to nahlásí místo tichého pokračování s vadnými daty.
 */
function validateGate(items: Listing[]): void {
  const errors: string[] = [];

  if (items.length !== 11) {
    errors.push(`count=${items.length} expected 11`);
  }
  const ids = items.map((it) => it.id);
  if (JSON.stringify(ids) !== JSON.stringify(EXPECTED_IDS)) {
    errors.push(`ids mismatch: ${JSON.stringify(ids)}`);
  }

  const rentSum = items.reduce((sum, it) => sum + (it.rent_czk ?? 0), 0);
  if (rentSum !== EXPECTED_RENT_SUM) {
    errors.push(`rent_czk sum=${rentSum} expected ${EXPECTED_RENT_SUM}`);
  }

  const knownMinSum = items.reduce((sum, it) => sum + (it.display_monthly_price?.known_min_czk ?? 0), 0);
  if (knownMinSum !== EXPECTED_KNOWN_MIN_SUM) {
    errors.push(`known_min_czk sum=${knownMinSum} expected ${EXPECTED_KNOWN_MIN_SUM}`);
  }

  const imageCount = items.reduce((sum, it) => sum + (it.image_urls?.length ?? 0), 0);
  if (imageCount !== EXPECTED_IMAGE_COUNT) {
    errors.push(`image_urls total=${imageCount} expected ${EXPECTED_IMAGE_COUNT}`);
  }

  const completeIds = items.filter((it) => it.display_monthly_price?.is_complete === true).map((it) => it.id);
  if (completeIds.length !== 1 || completeIds[0] !== EXPECTED_COMPLETE_ID) {
    errors.push(`is_complete=true for ${JSON.stringify(completeIds)}, expected only [${EXPECTED_COMPLETE_ID}]`);
  }

  const areas = items.map((it) => it.area_m2);
  if (JSON.stringify(areas) !== JSON.stringify(EXPECTED_AREAS)) {
    errors.push(`area_m2 order=${JSON.stringify(areas)} expected ${JSON.stringify(EXPECTED_AREAS)}`);
  }

  if (errors.length > 0) {
    throw new Error(`sam-byt integritní brána selhala:\n - ${errors.join("\n - ")}`);
  }
}

const listings = rawListings as unknown as Listing[];
validateGate(listings);

export function getAllListings(): Listing[] {
  return listings;
}

export function getListingById(id: string): Listing | undefined {
  return listings.find((it) => it.id === id);
}

export function isValidListingId(id: string): id is ListingId {
  return listings.some((it) => it.id === id);
}
