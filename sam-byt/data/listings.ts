import rawArchive from "@/data/sam-byt/archive.json";
import rawListings from "@/data/sam-byt/listings.json";
import type { ArchivedListing, Listing, ListingId } from "@/sam-byt/types";

const EXPECTED_IDS: ListingId[] = [
  "sam-01",
  "sam-03",
  "sam-04",
  "sam-05",
  "sam-06",
  "sam-07",
  "sam-08",
  "sam-09",
  "sam-10",
  "sam-12",
  "sam-13",
  "sam-14",
  "sam-15",
];
const EXPECTED_RENT_SUM = 263_100;
const EXPECTED_KNOWN_MIN_SUM = 314_562;
const EXPECTED_IMAGE_COUNT = 49;
const EXPECTED_COMPLETE_IDS: ListingId[] = ["sam-09", "sam-13"];
const EXPECTED_AREAS: Array<number | null> = [75, 55, 61, 60, 60, 56, 58, 58, 50, 53.9, 74, 60, 62];

/**
 * Integritní brána z bodu 0.2 zadání, znovu vyhodnocená při každém
 * importu tohoto modulu (server startup / build) — pokud se
 * data/sam-byt/listings.json někdy nahradí poškozenou verzí, aplikace
 * to nahlásí místo tichého pokračování s vadnými daty.
 */
function validateGate(items: Listing[]): void {
  const errors: string[] = [];

  if (items.length !== 13) {
    errors.push(`count=${items.length} expected 13`);
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
  if (JSON.stringify(completeIds) !== JSON.stringify(EXPECTED_COMPLETE_IDS)) {
    errors.push(`is_complete=true for ${JSON.stringify(completeIds)}, expected ${JSON.stringify(EXPECTED_COMPLETE_IDS)}`);
  }

  const areas = items.map((it) => it.area_m2);
  if (JSON.stringify(areas) !== JSON.stringify(EXPECTED_AREAS)) {
    errors.push(`area_m2 order=${JSON.stringify(areas)} expected ${JSON.stringify(EXPECTED_AREAS)}`);
  }

  if (errors.length > 0) {
    throw new Error(`sam-byt integritní brána selhala:\n - ${errors.join("\n - ")}`);
  }
}

const EXPECTED_ARCHIVED_IDS: ListingId[] = ["sam-02", "sam-11"];

/**
 * Archivované byty (sam-02, sam-11) nejsou součástí aktivního katalogu ani
 * jeho integritní brány — žijí v samostatném souboru, aby se při výměně
 * data/sam-byt/listings.json nemohly omylem smísit s aktivními 13 byty.
 */
function validateArchiveGate(items: ArchivedListing[]): void {
  const ids = items.map((it) => it.id);
  if (JSON.stringify(ids) !== JSON.stringify(EXPECTED_ARCHIVED_IDS)) {
    throw new Error(`sam-byt archiv gate selhala: ids=${JSON.stringify(ids)} expected ${JSON.stringify(EXPECTED_ARCHIVED_IDS)}`);
  }
}

const listings = rawListings as unknown as Listing[];
validateGate(listings);

const archivedListings = rawArchive as unknown as ArchivedListing[];
validateArchiveGate(archivedListings);

export function getAllListings(): Listing[] {
  return listings;
}

export function getArchivedListings(): ArchivedListing[] {
  return archivedListings;
}

export function getListingById(id: string): Listing | undefined {
  return listings.find((it) => it.id === id);
}

export function isValidListingId(id: string): id is ListingId {
  return listings.some((it) => it.id === id);
}
