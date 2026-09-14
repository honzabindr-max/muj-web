"use client";

import type { Place, SelectionStatus } from "../_data/types";
import {
  AREA_LABEL,
  TIER_LABEL,
  CATEGORY_LABEL,
  FRESHNESS_LABEL,
  isRenderableFact,
  mapsUrl,
  SELECTION_STATUS_LABEL,
} from "../_data/types";
import { stripSpNote } from "../_lib/format";

interface PlaceCardProps {
  place: Place;
  selectionStatus: SelectionStatus | null;
  onSelectionChange: (id: string, status: SelectionStatus | null) => void;
  /** Zapnutý přepínač "Zdroje" v patičce — jinak se provenience a SP citace nevykreslují. */
  showSources: boolean;
}

const TIER_STYLE: Record<Place["tier"], string> = {
  "must-see": "bg-[var(--acc)] text-white",
  doporuceni: "bg-[var(--acc2)] text-white",
  "dalsi-moznost": "bg-[var(--muted)] text-white",
};

export function PlaceCard({
  place,
  selectionStatus,
  onSelectionChange,
  showSources,
}: PlaceCardProps) {
  const headingId = `place-${place.id}-title`;
  const showArea = place.area !== "neurceno";

  return (
    <article aria-labelledby={headingId} className="kf-card flex flex-col gap-2.5">
      {/* Header: tag + name + selection */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="kf-tag">{CATEGORY_LABEL[place.category]}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIER_STYLE[place.tier]}`}
          >
            {TIER_LABEL[place.tier]}
          </span>
        </div>
      </div>

      <h3
        id={headingId}
        className="text-lg leading-tight font-bold tracking-tight"
        style={{ color: "var(--ink)" }}
      >
        {place.canonicalName}
        {place.czName && (
          <span className="ml-1.5 font-normal" style={{ color: "var(--muted)" }}>
            / {place.czName}
          </span>
        )}
      </h3>

      {(showArea || place.subcategory) && (
        <p className="-mt-1 text-xs" style={{ color: "var(--muted)" }}>
          {[showArea ? AREA_LABEL[place.area] : null, place.subcategory]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {/* Why */}
      <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
        {place.why}
      </p>

      {place.userPriority && (
        <p className="text-sm font-semibold" style={{ color: "var(--acc)" }}>
          ★ {place.userPriority}
        </p>
      )}

      {/* Facet pills — jen krátké štítky; delší volný text (doprava) jde jako řádek níž */}
      <div className="flex flex-wrap gap-1.5">
        {place.accessDifficulty && (
          <span className="kf-pill">{place.accessDifficulty}</span>
        )}
        {place.weather && <span className="kf-pill">☀️ {place.weather}</span>}
        {place.bestPartOfDay && (
          <span className="kf-pill">🕐 {place.bestPartOfDay}</span>
        )}
        {place.visitDuration && (
          <span className="kf-pill">⏱ {place.visitDuration}</span>
        )}
      </div>

      {/* Doprava — volný text ze zdroje, může být i celá věta, proto ne jako chip */}
      {place.transport.length > 0 && (
        <p className="text-sm" style={{ color: "var(--ink)" }}>
          <span className="font-semibold" style={{ color: "var(--muted)" }}>
            Doprava:
          </span>{" "}
          {place.transport.join(" ")}
        </p>
      )}

      {place.combinesWith.length > 0 && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          <span className="font-semibold">Lze spojit:</span>{" "}
          {place.combinesWith.join(" · ")}
        </p>
      )}

      {/* Warnings — visible, inline strip, no SP citation in text */}
      {place.warnings.length > 0 && (
        <div className="kf-warn">
          <b>Upozornění</b>
          <ul className="mt-1 list-disc pl-4">
            {place.warnings.map((w) => (
              <li key={w}>{stripSpNote(w)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Dynamické fakty (ceny, varianty) — jen s odkazem na zdroj (D01-B) */}
      {place.facts.filter(isRenderableFact).length > 0 && (
        <ul className="space-y-1.5">
          {place.facts.filter(isRenderableFact).map((fact) => (
            <li key={fact.label} className="kf-pill flex flex-wrap items-baseline gap-x-2 gap-y-0.5 !py-1.5">
              <span className="font-semibold" style={{ color: "var(--ink)" }}>
                {fact.label}
              </span>
              <span>{fact.value}</span>
              <span className="kf-verify-chip">{FRESHNESS_LABEL[fact.freshness]}</span>
              <a
                className="underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                href={fact.source.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {fact.source.label}
              </a>
              {fact.note && (
                <span className="basis-full text-xs" style={{ color: "var(--muted)" }}>
                  {fact.note}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Verify — one compact line per item, no separate gray panel */}
      {place.verify.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: "var(--muted)" }}>
          {place.verify.map((v) => (
            <span key={v.what} className="inline-flex items-center gap-1.5">
              <span className="kf-verify-chip">{FRESHNESS_LABEL["overit-aktualne"]}</span>
              <span>{v.what}</span>
              {v.source && (
                <a
                  className="underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  href={v.source.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {v.source.label}
                </a>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Zdroje — provenience, citace, souřadnice. Jen pod přepínačem. */}
      {showSources && (
        <div
          className="mt-1 space-y-1 border-t pt-2 text-xs"
          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
        >
          {place.sourceException && (
            <p>
              <span className="font-semibold">Provenience:</span>{" "}
              {place.sourceException.reason}
            </p>
          )}
          {place.coords && (
            <p>
              Souřadnice: OpenStreetMap Nominatim
              {place.coordsQuery && ` · dotaz: „${place.coordsQuery}"`}
              {place.coordsCheckedAt && ` · ověřeno ${place.coordsCheckedAt}`}
            </p>
          )}
          <p className="kf-sp">{place.sp}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <a
          aria-label={`Navigovat na ${place.canonicalName} v Google Maps (nové okno)`}
          className="kf-btn"
          href={mapsUrl(place)}
          rel="noopener noreferrer"
          target="_blank"
        >
          Navigovat
        </a>

        {place.sources.length > 0 && (
          <a
            aria-label={`Otevřít zdroj ${place.sources[0].label} (nové okno)`}
            className="kf-btn kf-btn-ghost"
            href={place.sources[0].url}
            rel="noopener noreferrer"
            target="_blank"
          >
            Otevřít zdroj
          </a>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <label className="sr-only" htmlFor={`selection-${place.id}`}>
            Stav místa {place.canonicalName} v Mém výběru
          </label>
          <select
            aria-label={`Stav místa ${place.canonicalName} v Mém výběru`}
            className="rounded-full border px-2.5 py-1 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            id={`selection-${place.id}`}
            name={`selection-${place.id}`}
            style={{ borderColor: "var(--line)", background: "var(--card)", color: "var(--ink)" }}
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
      </div>
    </article>
  );
}
