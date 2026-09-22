"use client";

import { useEffect, useRef, useState } from "react";

import { DECISIONS, type Decision, type ListingId, type ListingState } from "@/sam-byt/types";
import type { StatePatchInput } from "@/app/sam-byt/_lib/use-sam-byt-state";

const DECISION_LABELS: Record<Decision, string> = {
  unreviewed: "Nerozhodnuto",
  favorite: "Favorit",
  maybe: "Možná",
  want_viewing: "Chci na prohlídku",
  reject: "Nechci",
};

const RATING_FIELDS: Array<{ key: keyof Pick<ListingState, "ratingPrice" | "ratingPet" | "ratingLocation" | "ratingBalcony" | "ratingFurnishing">; label: string }> = [
  { key: "ratingPrice", label: "Cena" },
  { key: "ratingPet", label: "Pes" },
  { key: "ratingLocation", label: "Lokalita" },
  { key: "ratingBalcony", label: "Balkón" },
  { key: "ratingFurnishing", label: "Vybavení" },
];

export function DecisionControls({
  listingId,
  state,
  onMutate,
  compact = false,
}: {
  listingId: ListingId;
  state: ListingState;
  onMutate: (listingId: ListingId, patch: StatePatchInput) => Promise<"ok" | "conflict" | "error">;
  compact?: boolean;
}) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [notesDraft, setNotesDraft] = useState(state.notes);
  const [notesDirty, setNotesDirty] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!notesDirty) setNotesDraft(state.notes);
  }, [state.notes, notesDirty]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (notesDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [notesDirty]);

  async function save(patch: StatePatchInput) {
    setSaveStatus("saving");
    const result = await onMutate(listingId, patch);
    setSaveStatus(result === "ok" ? "saved" : "error");
    if (result === "ok") setTimeout(() => setSaveStatus("idle"), 1500);
  }

  function onNotesChange(value: string) {
    setNotesDraft(value);
    setNotesDirty(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await save({ notes: value });
      setNotesDirty(false);
    }, 900);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={state.favorite}
          onClick={() => save({ favorite: !state.favorite })}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            state.favorite ? "bg-rose-100 text-rose-700" : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {state.favorite ? "♥ Favorit" : "♡ Favorit"}
        </button>
        <SaveIndicator status={saveStatus} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {DECISIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => save({ decision: d })}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
              state.decision === d ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {DECISION_LABELS[d]}
          </button>
        ))}
      </div>

      {!compact && (
        <>
          <textarea
            value={notesDraft}
            onChange={(e) => onNotesChange(e.target.value)}
            maxLength={2000}
            placeholder="Poznámka…"
            rows={3}
            className="w-full rounded-xl border border-zinc-200 p-2.5 text-sm outline-none focus:border-zinc-400"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {RATING_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col items-center gap-1">
                <span className="text-xs text-zinc-500">{label}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${label}: ${n} z 5`}
                      onClick={() => save({ [key]: state[key] === n ? null : n } as StatePatchInput)}
                      className={`h-5 w-5 rounded ${
                        (state[key] ?? 0) >= n ? "bg-amber-400" : "bg-zinc-200"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;
  if (status === "saving") return <span className="text-xs text-zinc-400">Ukládám…</span>;
  if (status === "saved") return <span className="text-xs text-emerald-600">Uloženo</span>;
  return <span className="text-xs text-red-600">Chyba při ukládání — zkus to znovu</span>;
}
