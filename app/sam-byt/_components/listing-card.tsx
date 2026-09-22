import Link from "next/link";

import { formatPricePerM2, formatRent, formatTotalCostsLabel, priceCompletenessNote } from "@/sam-byt/data/price";
import type { Listing, ListingState } from "@/sam-byt/types";
import type { StatePatchInput } from "@/app/sam-byt/_lib/use-sam-byt-state";

import { DecisionControls } from "./decision-controls";
import { ImageWithFallback } from "./image-with-fallback";
import { PetBadge } from "./pet-badge";

export function ListingCard({
  listing,
  state,
  onMutate,
  onToggleCompare,
  compareChecked,
  compareDisabled,
}: {
  listing: Listing;
  state: ListingState;
  onMutate: (listingId: Listing["id"], patch: StatePatchInput) => Promise<"ok" | "conflict" | "error">;
  onToggleCompare: (id: Listing["id"]) => void;
  compareChecked: boolean;
  compareDisabled: boolean;
}) {
  const mainCompromise = listing.compromises[0];

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <Link href={`/sam-byt/byt/${listing.id}`} className="block">
        <ImageWithFallback
          src={listing.image_url_main}
          alt={listing.card_title}
          fallbackHref={listing.image_fallback_url ?? listing.source_url}
          className="h-48 w-full object-cover"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={`/sam-byt/byt/${listing.id}`} className="text-xl font-bold leading-tight text-zinc-950 hover:underline">
              {listing.street ? `${listing.street}` : listing.district}
            </Link>
            <p className="text-sm font-medium text-zinc-600">
              {listing.district} · {listing.disposition} · {listing.area_m2 != null ? `${listing.area_m2} m²` : "Plocha neuvedena"}
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-1 text-xs font-medium text-zinc-600">
            <input
              type="checkbox"
              checked={compareChecked}
              disabled={compareDisabled && !compareChecked}
              onChange={() => onToggleCompare(listing.id)}
            />
            Porovnat
          </label>
        </div>

        <div>
          <p className="text-2xl font-bold tabular-nums text-zinc-950">{formatRent(listing)}</p>
          <p className="text-sm font-medium tabular-nums text-zinc-700">{formatTotalCostsLabel(listing)}</p>
          <p className="text-xs font-medium text-amber-800">{priceCompletenessNote(listing)}</p>
          <p className="mt-1 text-sm font-medium tabular-nums text-zinc-600">{formatPricePerM2(listing)}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <PetBadge listing={listing} />
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800">
            {listing.display_balcony_status === "ano" ? "Balkón/lodžie" : "Bez balkónu"}
          </span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800">
            {listing.display_furnished_status}
          </span>
        </div>

        {listing.benefits.length > 0 && (
          <ul className="list-inside list-disc text-sm font-medium text-emerald-900">
            {listing.benefits.slice(0, 3).map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
        {mainCompromise && <p className="text-xs font-medium text-amber-900">⚠ {mainCompromise}</p>}

        <a
          href={listing.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-blue-800 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Zobrazit inzerát ↗
        </a>

        <div className="mt-auto pt-2">
          <DecisionControls listingId={listing.id} state={state} onMutate={onMutate} compact />
        </div>
      </div>
    </div>
  );
}
