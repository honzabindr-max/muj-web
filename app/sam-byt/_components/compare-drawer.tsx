"use client";

import { formatMonthlyPriceRange, formatPricePerM2, priceCompletenessNote } from "@/sam-byt/data/price";
import { PET_CATEGORY_LABELS, petCategory } from "@/sam-byt/data/pets";
import type { Listing, ListingState } from "@/sam-byt/types";

import { ImageWithFallback } from "./image-with-fallback";

const ROWS: Array<{ label: string; render: (l: Listing, s: ListingState) => React.ReactNode }> = [
  { label: "Cena", render: (l) => `${formatMonthlyPriceRange(l)} — ${priceCompletenessNote(l)}` },
  { label: "Kč/m²", render: (l) => formatPricePerM2(l) },
  { label: "Plocha", render: (l) => (l.area_m2 != null ? `${l.area_m2} m²` : "Neuvedeno") },
  { label: "Pes", render: (l) => PET_CATEGORY_LABELS[petCategory(l)] },
  { label: "Balkón/lodžie", render: (l) => (l.display_balcony_status === "ano" ? "Ano" : "Ne") },
  { label: "Vybavení", render: (l) => l.display_furnished_status },
  { label: "Spotřebiče", render: (l) => (l.other_equipment.length ? l.other_equipment.join(", ") : "Neuvedeno") },
  { label: "Patro", render: (l) => l.floor ?? "Neuvedeno" },
  { label: "Výtah", render: (l) => (l.elevator === null ? "Neuvedeno" : l.elevator ? "Ano" : "Ne") },
  { label: "Sklep", render: (l) => l.cellar ?? "Neuvedeno" },
  { label: "Kauce", render: (l) => (l.deposit_czk != null ? `${l.deposit_czk.toLocaleString("cs-CZ")} Kč` : "Neznámé") },
  {
    label: "Provize RK",
    render: (l) => (l.agency_fee_czk != null ? `${l.agency_fee_czk.toLocaleString("cs-CZ")} Kč` : "Neznámé"),
  },
  { label: "Přínosy", render: (l) => l.benefits.join("; ") || "—" },
  { label: "Kompromisy", render: (l) => l.compromises.join("; ") || "—" },
  { label: "Rozhodnutí (Sam)", render: (_l, s) => s.decision },
];

export function CompareDrawer({
  listings,
  statesFor,
  onClose,
}: {
  listings: Listing[];
  statesFor: (id: string) => ListingState;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40 p-3 sm:items-center sm:justify-center">
      <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 p-3">
          <h2 className="text-lg font-bold text-zinc-950">Porovnání ({listings.length})</h2>
          <button onClick={onClose} className="rounded-full bg-zinc-100 px-3 py-1 text-sm">
            Zavřít
          </button>
        </div>
        <div className="overflow-auto p-3">
          <table className="min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-32" />
                {listings.map((l) => (
                  <th key={l.id} className="p-2 text-left align-top">
                    <ImageWithFallback
                      src={l.image_url_main}
                      alt={l.card_title}
                      fallbackHref={l.image_fallback_url ?? l.source_url}
                      className="h-24 w-32 rounded-lg object-cover"
                    />
                    <p className="mt-1 font-medium">{l.street ?? l.district}</p>
                    <p className="text-xs font-medium text-zinc-600">{l.district}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-t border-zinc-100">
                  <th className="p-2 text-left align-top text-xs font-medium text-zinc-600">{row.label}</th>
                  {listings.map((l) => (
                    <td key={l.id} className="p-2 align-top text-xs tabular-nums text-zinc-800">
                      {row.render(l, statesFor(l.id))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
