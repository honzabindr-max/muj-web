'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from 'react-leaflet';
import { CATEGORY_COLORS, CATEGORY_LABELS, TRANSPORT_LINE, WAYPOINTS } from '../data';
import type { WaypointCategory } from '../types';

// Category icons (Unicode, short)
const CATEGORY_ICON: Record<WaypointCategory, string> = {
  reka: '~',
  vodopad: '↓',
  hory: '▲',
  zaklad: '⌂',
  doprava: '·',
};

function createCategoryIcon(category: WaypointCategory) {
  const color = CATEGORY_COLORS[category];
  const isDoprava = category === 'doprava';
  const size = isDoprava ? 16 : 28;
  const fontSize = isDoprava ? 8 : 12;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};
      border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
      color:white;font-size:${fontSize}px;font-weight:700;font-family:sans-serif;
      line-height:1;opacity:${isDoprava ? 0.7 : 1};
    ">${CATEGORY_ICON[category]}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

// Mapy.com logo — povinná atribuce
function MapyCzLogoControl() {
  const map = useMap();
  useEffect(() => {
    const LogoControl = L.Control.extend({
      onAdd() {
        const div = L.DomUtil.create('div', 'mapy-cz-logo');
        div.style.cssText =
          'background:rgba(255,255,255,0.85);padding:3px 5px;border-radius:4px;line-height:0;';
        div.innerHTML = `<a href="https://mapy.com/" target="_blank" rel="noreferrer" title="Mapy.com">
          <img src="https://api.mapy.com/img/api/logo.svg" alt="Mapy.com" style="height:30px;display:block;" />
        </a>`;
        return div;
      },
    });
    const control = new LogoControl({ position: 'bottomleft' });
    control.addTo(map);
    return () => { control.remove(); };
  }, [map]);
  return null;
}

// Load BRouter GeoJSON: den4 = Soča Trail (reka), den3 = Vršič route (hory)
async function fetchRouteCoords(day: number): Promise<[number, number][] | null> {
  try {
    const res = await fetch(`/soci/den${day}.geojson`);
    if (!res.ok) return null;
    const json = await res.json();
    const coords: [number, number][] | undefined = json?.features?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 10) return null;
    return coords.map(([lon, lat]) => [lat, lon]);
  } catch {
    return null;
  }
}

const MAPY_API_KEY = process.env.NEXT_PUBLIC_MAPY_API_KEY;

const CATEGORIES = Object.keys(CATEGORY_COLORS) as WaypointCategory[];

export default function GuideMapClient() {
  const [activeCategory, setActiveCategory] = useState<WaypointCategory | null>(null);
  const [socsaTrail, setSocaTrail] = useState<[number, number][] | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
  }, []);

  // Load Soča Trail BRouter route (den4 = Trenta→Velika korita→Bovec)
  useEffect(() => {
    fetchRouteCoords(4).then(setSocaTrail);
  }, []);

  const visibleWaypoints = useMemo(() => {
    if (activeCategory === null) return WAYPOINTS;
    return WAYPOINTS.filter((w) => w.category === activeCategory);
  }, [activeCategory]);

  const useMapyCz = !!(MAPY_API_KEY && MAPY_API_KEY !== '__DOPLNIM__');
  const tileUrl = useMapyCz
    ? `https://api.mapy.com/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <div className="flex flex-col gap-3">
      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
            activeCategory === null
              ? 'bg-slate-800 text-white shadow'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Vše
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
              activeCategory === cat ? 'text-white shadow' : 'text-slate-700 hover:opacity-80'
            }`}
            style={
              activeCategory === cat
                ? { backgroundColor: CATEGORY_COLORS[cat] }
                : {
                    backgroundColor: CATEGORY_COLORS[cat] + '28',
                    border: `1.5px solid ${CATEGORY_COLORS[cat]}`,
                  }
            }
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <MapContainer
          center={[46.35, 13.6]}
          zoom={10}
          scrollWheelZoom={false}
          style={{ height: '420px' }}
          className="md:!h-[560px]"
        >
          <TileLayer
            url={tileUrl}
            attribution={
              useMapyCz
                ? '<a href="https://api.mapy.com/copyright" target="_blank" rel="noreferrer">&copy; Seznam.cz a.s. a další</a> | &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>, routing <a href="https://brouter.de" target="_blank" rel="noreferrer">BRouter</a>'
                : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>, routing <a href="https://brouter.de" target="_blank" rel="noreferrer">BRouter</a>'
            }
          />
          {useMapyCz && <MapyCzLogoControl />}

          {/* Transport context — šedá čárkovaná (Brno→Ljubljana→Bovec) */}
          {(activeCategory === null || activeCategory === 'doprava') && (
            <Polyline
              positions={TRANSPORT_LINE}
              pathOptions={{ color: '#94a3b8', weight: 1.5, dashArray: '6 4', opacity: 0.5 }}
            />
          )}

          {/* Soča Trail — BRouter reálná trasa, barva reka */}
          {socsaTrail && socsaTrail.length >= 2 && (activeCategory === null || activeCategory === 'reka') && (
            <Polyline
              positions={socsaTrail}
              pathOptions={{ color: CATEGORY_COLORS.reka, weight: 2.5, opacity: 0.75 }}
            />
          )}

          {/* Markers */}
          {visibleWaypoints.map((wp) => (
            <Marker key={wp.id} position={[wp.lat, wp.lng]} icon={createCategoryIcon(wp.category)}>
              <Popup>
                <div className="text-sm">
                  <div className="mb-1.5 font-semibold text-slate-900">{wp.name}</div>
                  <span
                    className="mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: CATEGORY_COLORS[wp.category] }}
                  >
                    {CATEGORY_LABELS[wp.category]}
                  </span>
                  <p className="mt-1 text-slate-600">{wp.description}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <div className="mb-2 font-medium text-slate-700">Legenda</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {CATEGORIES.map((cat) => (
            <span key={cat} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[cat] }}
              />
              {CATEGORY_LABELS[cat]}
            </span>
          ))}
        </div>
        <div className="mt-2 space-y-0.5 text-slate-400">
          <div>Modrá linie = Soča Trail (BRouter, reálná trasa)</div>
          <div>Šedá čára = dopravní kontext Brno→Ljubljana→Bovec</div>
          <div>Trasy © OpenStreetMap přispěvatelé, routing BRouter</div>
        </div>
      </div>
    </div>
  );
}
