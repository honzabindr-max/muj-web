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
      <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
        Základna: <strong>Silver Beach Hotel, Roda</strong>. Hotel nemá v autoritativních
        datech samostatně ověřený bod, proto mapa nezobrazuje domyšlený pin.
      </p>
      {/* Leaflet mapa — OSM dlaždice, bez API klíče */}
      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
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
      <p className="text-xs text-slate-500">
        Na mapě: <strong>{withCoords.length}</strong> míst s ověřenými
        souřadnicemi (OSM Nominatim) · bez souřadnic:{" "}
        <strong>{withoutCoords.length}</strong>
      </p>

      {/* Místa bez ověřených souřadnic — seznam s Google Maps search deep-linkem */}
      {withoutCoords.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2
            className="mb-2 text-sm font-semibold text-amber-900"
            id="bez-souradnic-nadpis"
          >
            Bez ověřených souřadnic — pin na mapě chybí
          </h2>
          <p className="mb-3 text-xs text-amber-700">
            Souřadnice se nepodařilo jednoznačně dohledat přes OSM Nominatim
            (D01-A). Odkaz otevře Google Maps vyhledávání podle názvu.
          </p>
          <ul
            aria-labelledby="bez-souradnic-nadpis"
            className="space-y-1"
            role="list"
          >
            {withoutCoords.map((place) => (
              <li key={place.id} className="flex items-center gap-2">
                <a
                  aria-label={`Hledat ${place.canonicalName} na Google Maps`}
                  className="text-sm font-medium text-teal-800 underline decoration-teal-400 underline-offset-2 hover:text-teal-600 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  href={mapsUrl(place)}
                  rel="noreferrer"
                  target="_blank"
                >
                  {place.canonicalName}
                </a>
                <span className="text-xs text-amber-600">({place.area})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
