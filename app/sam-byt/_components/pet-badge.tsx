import { petCategory, PET_CATEGORY_LABELS } from "@/sam-byt/data/pets";
import type { Listing } from "@/sam-byt/types";

const STYLES: Record<string, string> = {
  po_dohode: "bg-amber-100 text-amber-900",
  neuvedeno: "bg-zinc-100 text-zinc-700",
  schvaleno: "bg-emerald-100 text-emerald-900",
  zakazano: "bg-red-100 text-red-900",
};

export function PetBadge({ listing }: { listing: Listing }) {
  const category = petCategory(listing);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[category]}`}>
      🐾 {PET_CATEGORY_LABELS[category]}
    </span>
  );
}
