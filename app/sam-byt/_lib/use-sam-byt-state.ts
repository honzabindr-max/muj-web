"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Decision, ListingId, ListingState } from "@/sam-byt/types";

export interface StateBundle {
  own: Record<string, ListingState>;
  sam?: Record<string, ListingState>;
  listingIds: ListingId[];
}

export interface StatePatchInput {
  favorite?: boolean;
  decision?: Decision;
  notes?: string;
  ratingPrice?: number | null;
  ratingPet?: number | null;
  ratingLocation?: number | null;
  ratingBalcony?: number | null;
  ratingFurnishing?: number | null;
}

export type MutateStatus = "idle" | "saving" | "saved" | "error";

const POLL_MS = 15000;

export function useSamBytState() {
  const [data, setData] = useState<StateBundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const dataRef = useRef<StateBundle | null>(null);
  dataRef.current = data;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/sam-byt/state", { cache: "no-store" });
      if (!res.ok) throw new Error("fetch_failed");
      const json = (await res.json()) as StateBundle;
      setData(json);
      setLoadError(null);
    } catch {
      setLoadError("Nepodařilo se načíst stav ze serveru. Zkontroluj připojení a zkus to znovu.");
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    function onFocus() {
      refresh();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  /**
   * Zapisuje mutaci se server-side optimistic concurrency. Při konfliktu
   * (409) UI NEPŘEDSTÍRÁ úspěch — vrátí "conflict" a stav se přenačte ze
   * serveru, aby uživatel viděl aktuální hodnotu místo tiše ztracené změny.
   */
  const mutate = useCallback(
    async (listingId: ListingId, patch: StatePatchInput): Promise<"ok" | "conflict" | "error"> => {
      const existing = dataRef.current?.own[listingId];
      const expectedVersion = existing?.version ?? 0;

      try {
        const res = await fetch(`/api/sam-byt/state/${listingId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...patch, expectedVersion }),
        });
        if (res.status === 409) {
          await refresh();
          return "conflict";
        }
        if (!res.ok) return "error";
        const json = (await res.json()) as { state: ListingState };
        setData((prev) => {
          if (!prev) return prev;
          return { ...prev, own: { ...prev.own, [listingId]: json.state } };
        });
        return "ok";
      } catch {
        return "error";
      }
    },
    [refresh],
  );

  return { data, loadError, refresh, mutate };
}
