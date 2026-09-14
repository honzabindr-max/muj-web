"use client";

import type { Place, SelectionStatus } from "../_data/types";
import {
  AREA_LABEL,
  TIER_LABEL,
  CATEGORY_LABEL,
  FRESHNESS_LABEL,
  mapsUrl,
  SELECTION_STATUS_LABEL,
} from "../_data/types";

interface PlaceCardProps {
  place: Place;
  selectionStatus: SelectionStatus | null;
  onSelectionChange: (id: string, status: SelectionStatus | null) => void;
}

const TIER_COLOR: Record<Place["tier"], string> = {
  "must-see": "bg-teal-800 text-white",
  doporuceni: "bg-sky-700 text-white",
  "dalsi-moznost": "bg-slate-500 text-white",
};

export function PlaceCard({
  place,
  selectionStatus,
  onSelectionChange,
}: PlaceCardProps) {
  const headingId = `place-${place.id}-title`;
  return (
    <article
      aria-labelledby={headingId}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      {/* Header: name + tier badge + selection */}
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h3
          id={headingId}
          className="text-base leading-snug font-semibold text-slate-900"
        >
          {place.canonicalName}
          {place.czName && (
            <span className="ml-1.5 font-normal text-slate-600">
              / {place.czName}
            </span>
          )}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIER_COLOR[place.tier]}`}
          >
            {TIER_LABEL[place.tier]}
          </span>
          <label className="sr-only" htmlFor={`selection-${place.id}`}>
            Stav místa {place.canonicalName} v Mém výběru
          </label>
          <select
            aria-label={`Stav místa ${place.canonicalName} v Mém výběru`}
            className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            id={`selection-${place.id}`}
            onChange={(event) =>
              onSelectionChange(place.id, (event.target.value as SelectionStatus) || null)
            }
            value={selectionStatus ?? ""}
          >
            <option value="">Přidat do výběru</option>
            {(Object.keys(SELECTION_STATUS_LABEL) as SelectionStatus[]).map((status) => (
              <option key={status} value={status}>
                {SELECTION_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Meta: area + category */}
      <p className="mt-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
        {AREA_LABEL[place.area]}
        {place.subcategory
          ? ` · ${place.subcategory}`
          : ` · ${CATEGORY_LABEL[place.category]}`}
      </p>

      {/* Why */}
      <p className="mt-2 text-sm leading-relaxed text-slate-800">{place.why}</p>

      {place.userPriority && (
        <p className="mt-1.5 text-sm font-medium text-teal-900">
          ★ {place.userPriority}
        </p>
      )}

      {/* Facets */}
      <dl className="mt-3 space-y-1.5 text-sm text-slate-800">
        {place.transport.length > 0 && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-slate-600">Doprava:</dt>
            <dd>{place.transport.join(" ")}</dd>
          </div>
        )}
        {place.accessDifficulty && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-slate-600">
              Náročnost:
            </dt>
            <dd>{place.accessDifficulty}</dd>
          </div>
        )}
        {place.weather && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-slate-600">Počasí:</dt>
            <dd>{place.weather}</dd>
          </div>
        )}
        {place.bestPartOfDay && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-slate-600">
              Nejlepší čas:
            </dt>
            <dd>{place.bestPartOfDay}</dd>
          </div>
        )}
        {place.visitDuration && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-slate-600">
              Délka návštěvy:
            </dt>
            <dd>{place.visitDuration}</dd>
          </div>
        )}
        {place.combinesWith.length > 0 && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-slate-600">
              Lze spojit:
            </dt>
            <dd>{place.combinesWith.join(" · ")}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="shrink-0 font-semibold text-slate-600">SP:</dt>
          <dd className="text-slate-500">{place.sp}</dd>
        </div>
      </dl>

      {/* Warnings */}
      {place.warnings.length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3">
          <h4 className="text-xs font-bold tracking-wide text-amber-900 uppercase">
            Upozornění
          </h4>
          <ul className="mt-1 list-disc pl-4 text-sm text-amber-950">
            {place.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Verify / dynamic facts */}
      {place.verify.length > 0 && (
        <div className="mt-3 rounded-xl bg-slate-100 p-3">
          <h4 className="text-xs font-bold tracking-wide text-slate-700 uppercase">
            {FRESHNESS_LABEL["overit-aktualne"]}
          </h4>
          <ul className="mt-1 list-disc pl-4 text-sm text-slate-800">
            {place.verify.map((v) => (
              <li key={v.what}>
                {v.what}
                {v.source && (
                  <>
                    {" "}
                    <a
                      className="underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                      href={v.source.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {v.source.label}
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {place.sourceException && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <h4 className="text-xs font-bold tracking-wide text-slate-700 uppercase">
            Provenience obsahu
          </h4>
          <p className="mt-1 text-sm text-slate-800">
            {place.sourceException.reason}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Citace: {place.sourceException.sp}
          </p>
        </div>
      )}

      {/* ── Coords provenience — constraint 1: never silent null ── */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        {place.coords ? (
          <>
            <span className="font-semibold text-teal-800">
              Souřadnice: OpenStreetMap Nominatim
            </span>
            {place.coordsQuery && (
              <span className="text-slate-600">
                {" "}
                · dotaz: „{place.coordsQuery}&quot;
              </span>
            )}
            {place.coordsCheckedAt && (
              <span className="text-slate-500">
                {" "}
                · ověřeno {place.coordsCheckedAt}
              </span>
            )}
            <span className="ml-1 text-slate-400">
              ({place.coords.lat.toFixed(5)}, {place.coords.lon.toFixed(5)})
            </span>
          </>
        ) : (
          <>
            <span className="font-semibold text-amber-700">
              Souřadnice neověřeny
            </span>
            {place.coordsNote && (
              <span className="ml-1 text-slate-600">— {place.coordsNote}</span>
            )}
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        {/* Navigovat — always present on Place cards */}
        <a
          aria-label={`Navigovat na ${place.canonicalName} v Google Maps (nové okno)`}
          className="inline-flex items-center rounded-xl bg-teal-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          href={mapsUrl(place)}
          rel="noopener noreferrer"
          target="_blank"
        >
          Navigovat
        </a>

        {/* Otevřít zdroj — only when sources exist */}
        {place.sources.length > 0 && (
          <a
            aria-label={`Otevřít zdroj ${place.sources[0].label} (nové okno)`}
            className="inline-flex items-center rounded-xl border border-teal-700 px-3 py-1.5 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            href={place.sources[0].url}
            rel="noopener noreferrer"
            target="_blank"
          >
            Otevřít zdroj
          </a>
        )}
      </div>
    </article>
  );
}
