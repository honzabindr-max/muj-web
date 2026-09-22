"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { defaultState } from "@/sam-byt/state/default-state";
import type { Listing, ListingId, Username } from "@/sam-byt/types";

import { applyFilters, emptyFilters, sortListings, type Filters, type SortKey } from "@/app/sam-byt/_lib/filters";
import { useSamBytState } from "@/app/sam-byt/_lib/use-sam-byt-state";

import { CompareDrawer } from "./compare-drawer";
import { FiltersBar } from "./filters-bar";
import { ListingCard } from "./listing-card";
import { SamuvVyber } from "./samuv-vyber";

const MAX_COMPARE = 4;

export function AppShell({
  listings,
  username,
  displayName,
}: {
  listings: Listing[];
  username: Username;
  displayName: string;
}) {
  const router = useRouter();
  const { data, loadError, mutate } = useSamBytState();
  const [filters, setFilters] = useState<Filters>(emptyFilters());
  const [sortKey, setSortKey] = useState<SortKey>("price_per_m2_asc");
  const [compareIds, setCompareIds] = useState<ListingId[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const stateFor = useMemo(() => {
    return (listingId: string) => data?.own[listingId] ?? defaultState("", username, listingId as ListingId);
  }, [data, username]);

  const filtered = useMemo(() => applyFilters(listings, filters, stateFor), [listings, filters, stateFor]);
  const sorted = useMemo(() => sortListings(filtered, sortKey), [filtered, sortKey]);

  function toggleCompare(id: ListingId) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }

  async function logout() {
    await fetch("/api/sam-byt/auth/logout", { method: "POST" });
    router.refresh();
  }

  const compareListings = listings.filter((l) => compareIds.includes(l.id));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-950">SAM-BYT</h1>
          <p className="text-sm font-medium text-zinc-600">Přihlášen: {displayName}</p>
        </div>
        <div className="flex items-center gap-2">
          {compareIds.length >= 2 && (
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              className="rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
            >
              Porovnat ({compareIds.length})
            </button>
          )}
          <button type="button" onClick={logout} className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm">
            Odhlásit
          </button>
        </div>
      </header>

      {loadError && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
      )}

      <FiltersBar
        listings={listings}
        filters={filters}
        setFilters={setFilters}
        sortKey={sortKey}
        setSortKey={setSortKey}
        resultCount={sorted.length}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            state={stateFor(listing.id)}
            onMutate={mutate}
            onToggleCompare={toggleCompare}
            compareChecked={compareIds.includes(listing.id)}
            compareDisabled={compareIds.length >= MAX_COMPARE}
          />
        ))}
      </div>

      {username === "honzik" && data?.sam && <SamuvVyber listings={listings} samState={data.sam} />}

      {compareOpen && compareListings.length >= 2 && (
        <CompareDrawer listings={compareListings} statesFor={stateFor} onClose={() => setCompareOpen(false)} />
      )}
    </div>
  );
}
