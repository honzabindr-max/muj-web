"use client";

import { useEffect, useState } from "react";

import type { DecisionEvent, Listing, ListingState } from "@/sam-byt/types";

const DECISION_LABELS: Record<string, string> = {
  unreviewed: "Nerozhodnuto",
  favorite: "Favorit",
  maybe: "Možná",
  want_viewing: "Chci na prohlídku",
  reject: "Nechci",
};

export function SamuvVyber({ listings, samState }: { listings: Listing[]; samState: Record<string, ListingState> }) {
  const [events, setEvents] = useState<DecisionEvent[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || events) return;
    fetch("/api/sam-byt/events")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setEvents(json.events))
      .catch(() => setEvents([]));
  }, [open, events]);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-xl font-bold text-zinc-950">Samův výběr</h2>
      <ul className="mt-3 divide-y divide-zinc-100">
        {listings.map((l) => {
          const s = samState[l.id];
          return (
            <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>{l.street ?? l.district}</span>
              <span className="flex items-center gap-2">
                {s?.favorite && <span title="Favorit">♥</span>}
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs">
                  {DECISION_LABELS[s?.decision ?? "unreviewed"]}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {listings.some((l) => samState[l.id]?.notes) && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium text-zinc-600">Samovy poznámky</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {listings
              .filter((l) => samState[l.id]?.notes)
              .map((l) => (
                <li key={l.id}>
                  <strong>{l.street ?? l.district}:</strong> {samState[l.id]!.notes}
                </li>
              ))}
          </ul>
        </details>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700"
      >
        {open ? "Skrýt poslední změny" : "Zobrazit poslední změny"}
      </button>
      {open && (
        <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-auto text-xs text-zinc-600">
          {(events ?? []).length === 0 && <li>Zatím žádná historie.</li>}
          {(events ?? []).map((e) => (
            <li key={e.id}>
              {new Date(e.createdAt).toLocaleString("cs-CZ")} — <strong>{e.username}</strong> u {e.listingId}:{" "}
              {e.field} {e.oldValue ?? "—"} → {e.newValue ?? "—"}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
