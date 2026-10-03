import type { Listing, PetCategory } from "@/sam-byt/types";

const FORBIDDEN_PATTERN = /zakázán|nepovolen|bez zvířat|bez psů/i;
const AGREED_PATTERN = /dohod/i;

/**
 * Čtyři stavy z bodu 2.1: Povoleno / Po dohodě / Nutno ověřit / Zakázáno.
 * Žádný z aktivních bytů dnes nemá
 * australian_shepherd_explicitly_approved=true, filtr ale musí kategorii
 * umět zobrazit, kdyby přibyla.
 */
export function petCategory(listing: Listing): PetCategory {
  if (listing.australian_shepherd_explicitly_approved) return "schvaleno";
  const status = listing.pets_status ?? "";
  if (FORBIDDEN_PATTERN.test(status)) return "zakazano";
  if (!status || status.trim().toLowerCase() === "neuvedeno") return "neuvedeno";
  if (AGREED_PATTERN.test(status)) return "po_dohode";
  return "po_dohode";
}

export const PET_CATEGORY_LABELS: Record<PetCategory, string> = {
  po_dohode: "Po dohodě",
  neuvedeno: "Nutno ověřit",
  schvaleno: "Povoleno",
  zakazano: "Zakázáno",
};
