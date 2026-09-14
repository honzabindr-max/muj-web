"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { Place } from "../_data/types";
import { mapsUrl } from "../_data/types";

// Fallback výřez celého Korfu — používá se, když filtrované body nemají žádné souřadnice.
const KORFU_BOUNDS: L.LatLngBoundsLiteral = [
  [39.35, 19.65],
  [39.85, 20.2],
];

// SVG pin via L.divIcon — nevyžaduje žádné síťové ani lokální image soubory,
// takže nedochází k broken-asset-path problému pod Next.js/webpack bundlerem.
const PIN_ICON = L.divIcon({
  className: "",
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36" aria-hidden="true" focusable="false"><path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z" fill="#0d9488"/><circle cx="12" cy="12" r="5" fill="white"/></svg>`,
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
});

interface BoundsUpdaterProps {
  withCoords: Place[];
}

/** Reaguje na změnu filtrovaných bodů a nastaví výřez mapy. Musí být uvnitř MapContainer. */
function BoundsUpdater({ withCoords }: BoundsUpdaterProps) {
  const map = useMap();
  useEffect(() => {
    if (withCoords.length === 0) {
      map.fitBounds(KORFU_BOUNDS);
      return;
    }
    const bounds = L.latLngBounds(
      withCoords.map((p) => [p.coords!.lat, p.coords!.lon] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [48, 48] });
  }, [withCoords, map]);
  return null;
}

interface KorfuMapProps {
  /** Filtrovaný seznam míst — stejný, jaký zobrazuje katalog. Pochází výhradně z _data/**. */
  filteredPlaces: Place[];
}

export default function KorfuMap({ filteredPlaces }: KorfuMapProps) {
  const withCoords = filteredPlaces.filter((p) => p.coords !== null);
  const withoutCoords = filteredPlaces.filter((p) => p.coords === null);

  return (
    <section
      aria-label="Mapa míst — Korfu 2026"
      className="flex flex-col gap-4"
    >
      <p className="kf-card !py-2 !px-3 text-sm" style={{ color: "var(--acc)" }}>
        Základna: <strong>Silver Beach Hotel, Roda</strong>. Hotel nemá v autoritativních
        datech samostatně ověřený bod, proto mapa nezobrazuje domyšlený pin.
      </p>
      {/* Leaflet mapa — OSM dlaždice, bez API klíče */}
      <div
        className="overflow-hidden rounded-[15px] border shadow-sm"
        style={{ borderColor: "var(--line)" }}
      >
        <MapContainer
          bounds={KORFU_BOUNDS}
          scrollWheelZoom={false}
          style={{ height: "420px" }}
          className="md:!h-[560px]"
        >
          <BoundsUpdater withCoords={withCoords} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> přispěvatelé'
          />
          {withCoords.map((place) => (
            <Marker
              key={place.id}
              position={[place.coords!.lat, place.coords!.lon]}
              icon={PIN_ICON}
            >
              <Popup>
                <div className="text-sm" style={{ minWidth: 200 }}>
                  <p className="mb-1 font-semibold text-slate-900">
                    {place.canonicalName}
                  </p>
                  {place.czName && (
                    <p className="mb-1 text-xs text-slate-600">
                      {place.czName}
                    </p>
                  )}
                  <p className="mb-1 text-xs text-slate-500">
                    Zdroj souřadnic:{" "}
                    <span className="font-medium text-slate-700">
                      {place.coordsSource ?? "—"}
                    </span>
                  </p>
                  {place.coordsCheckedAt && (
                    <p className="mb-2 text-xs text-slate-500">
                      Ověřeno:{" "}
                      <span className="font-medium text-slate-700">
                        {place.coordsCheckedAt}
                      </span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <a
                      aria-label={`Navigovat na ${place.canonicalName}`}
                      className="inline-flex items-center rounded border border-teal-700 px-2 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-50"
                      href={mapsUrl(place)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Navigovat
                    </a>
                    {place.sources.length > 0 && place.sources[0].url && (
                      <a
                        aria-label={`Otevřít zdroj pro ${place.canonicalName}`}
                        className="inline-flex items-center rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        href={place.sources[0].url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Otevřít zdroj
                      </a>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Počítadlo pinů */}
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Na mapě: <strong>{withCoords.length}</strong> míst s ověřenými
        souřadnicemi · bez souřadnic: <strong>{withoutCoords.length}</strong>
      </p>

      {/* Místa bez ověřených souřadnic — jen odkaz, žádný červený blok */}
      {withoutCoords.length > 0 && (
        <div className="kf-card">
          <h2 className="mb-2 text-sm font-semibold" id="bez-souradnic-nadpis" style={{ color: "var(--ink)" }}>
            Bez pinu na mapě
          </h2>
          <p className="mb-3 text-xs" style={{ color: "var(--muted)" }}>
            Odkaz otevře Google Maps vyhledávání podle názvu.
          </p>
          <ul
            aria-labelledby="bez-souradnic-nadpis"
            className="flex flex-wrap gap-2"
            role="list"
          >
            {withoutCoords.map((place) => (
              <li key={place.id}>
                <a
                  aria-label={`Hledat ${place.canonicalName} na Google Maps`}
                  className="kf-pill"
                  href={mapsUrl(place)}
                  rel="noreferrer"
                  target="_blank"
                >
                  {place.canonicalName}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
