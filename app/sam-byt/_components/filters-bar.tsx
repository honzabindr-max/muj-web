"use client";

import { petCategory, PET_CATEGORY_LABELS } from "@/sam-byt/data/pets";
import { DECISIONS, type Decision, type Listing, type PetCategory } from "@/sam-byt/types";

import { emptyFilters, type Filters, type SortKey } from "@/app/sam-byt/_lib/filters";

const DECISION_LABELS: Record<Decision, string> = {
  unreviewed: "Nerozhodnuto",
  favorite: "Favorit",
  maybe: "Možná",
  want_viewing: "Chci na prohlídku",
  reject: "Nechci",
};

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function FiltersBar({
  listings,
  filters,
  setFilters,
  sortKey,
  setSortKey,
  resultCount,
}: {
  listings: Listing[];
  filters: Filters;
  setFilters: (f: Filters) => void;
  sortKey: SortKey;
  setSortKey: (k: SortKey) => void;
  resultCount: number;
}) {
  const districts = Array.from(new Set(listings.map((l) => l.district))).sort();
  const furnishingOptions = Array.from(new Set(listings.map((l) => l.manual_review.furnishing_for_filter)));

  const petCounts = new Map<PetCategory, number>();
  for (const l of listings) {
    const c = petCategory(l);
    petCounts.set(c, (petCounts.get(c) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-700">{resultCount} z {listings.length} bytů</span>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-600" htmlFor="sam-byt-sort">
            Řadit:
          </label>
          <select
            id="sam-byt-sort"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-lg border border-zinc-200 px-2 py-1 text-sm"
          >
            <option value="price_per_m2_asc">Kč/m² ↑</option>
            <option value="known_cost_asc">Známé náklady ↑</option>
            <option value="known_cost_desc">Známé náklady ↓</option>
            <option value="area_desc">Plocha ↓</option>
            <option value="district">Čtvrť</option>
          </select>
          <button
            type="button"
            onClick={() => setFilters(emptyFilters())}
            className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600"
          >
            Reset filtrů
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {districts.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setFilters({ ...filters, districts: toggleInSet(filters.districts, d) })}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              filters.districts.has(d) ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {d.replace("Brno-", "")}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          Do (známé náklady) Kč
          <input
            type="number"
            min={0}
            step={500}
            value={filters.maxKnownCostCzk ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, maxKnownCostCzk: e.target.value === "" ? null : Number(e.target.value) })
            }
            className="w-24 rounded-lg border border-zinc-200 px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          Min. plocha m²
          <input
            type="number"
            min={0}
            value={filters.minAreaM2 ?? ""}
            onChange={(e) => setFilters({ ...filters, minAreaM2: e.target.value === "" ? null : Number(e.target.value) })}
            className="w-20 rounded-lg border border-zinc-200 px-2 py-1"
          />
        </label>
        <select
          value={filters.balcony}
          onChange={(e) => setFilters({ ...filters, balcony: e.target.value as Filters["balcony"] })}
          className="rounded-lg border border-zinc-200 px-2 py-1 text-xs"
        >
          <option value="any">Balkón: nezáleží</option>
          <option value="yes">Jen s balkónem/lodžií</option>
          <option value="no">Jen bez balkónu</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={filters.favoritesOnly}
            onChange={(e) => setFilters({ ...filters, favoritesOnly: e.target.checked })}
          />
          Jen favoriti
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {furnishingOptions.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilters({ ...filters, furnishing: toggleInSet(filters.furnishing, f) })}
            className={`rounded-full px-2.5 py-1 text-xs ${
              filters.furnishing.has(f) ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(PET_CATEGORY_LABELS) as PetCategory[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilters({ ...filters, pet: toggleInSet(filters.pet, c) })}
            className={`rounded-full px-2.5 py-1 text-xs ${
              filters.pet.has(c) ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {PET_CATEGORY_LABELS[c]} ({petCounts.get(c) ?? 0})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {DECISIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setFilters({ ...filters, decisions: toggleInSet(filters.decisions, d) })}
            className={`rounded-full px-2.5 py-1 text-xs ${
              filters.decisions.has(d) ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {DECISION_LABELS[d]}
          </button>
        ))}
      </div>
    </div>
  );
}
