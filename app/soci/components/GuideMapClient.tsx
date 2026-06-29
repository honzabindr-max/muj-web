'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, TileLayer } from 'react-leaflet';
import { DAY_COLORS, TRANSPORT_LINE, WAYPOINTS } from '../data';

// Days that have real BRouter GeoJSON routes in /public/soci/
const REAL_ROUTE_DAYS = new Set([3, 4]);

function createDayIcon(day: number | null, color: string, isContext: boolean) {
  const size = isContext ? 20 : 28;
  const label = day !== null ? String(day) : '·';
  const fontSize = isContext ? 9 : 11;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};
      border:2.5px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      color:white;font-size:${fontSize}px;font-weight:700;font-family:sans-serif;
      line-height:1;
    ">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

// Fetch GeoJSON and extract [lat, lng][] for Leaflet Polyline.
// Returns null on any error — caller falls back to schematic line.
async function fetchRouteCoords(day: number): Promise<[number, number][] | null> {
  try {
    const res = await fetch(`/soci/den${day}.geojson`);
    if (!res.ok) return null;
    const json = await res.json();
    const coords: [number, number][] | undefined = json?.features?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 10) return null;
    // BRouter returns [lon, lat, ele] → Leaflet wants [lat, lon]
    return coords.map(([lon, lat]) => [lat, lon]);
  } catch {
    return null;
  }
}

const CONTEXT_COLOR = '#94a3b8';

export default function GuideMapClient() {
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [realRoutes, setRealRoutes] = useState<Record<number, [number, number][] | null>>({});

  // Suppress leaflet missing icon warning
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
  }, []);

  // Load real routes on mount
  useEffect(() => {
    Promise.all(
      [...REAL_ROUTE_DAYS].map(async (day) => {
        const coords = await fetchRouteCoords(day);
        return [day, coords] as [number, [number, number][] | null];
      }),
    ).then((results) => {
      setRealRoutes(Object.fromEntries(results));
    });
  }, []);

  const days = useMemo(
    () => [...new Set(WAYPOINTS.filter((w) => w.day !== null).map((w) => w.day as number))].sort(),
    [],
  );

  const visibleWaypoints = useMemo(() => {
    if (activeDay === null) return WAYPOINTS;
    return WAYPOINTS.filter((w) => w.day === null || w.day === activeDay);
  }, [activeDay]);

  // Schematic fallback: waypoints grouped by day
  const schematicPolylines = useMemo(() => {
    const grouped: Record<number, [number, number][]> = {};
    WAYPOINTS.filter((w) => w.day !== null).forEach((w) => {
      const d = w.day as number;
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push([w.lat, w.lng]);
    });
    return grouped;
  }, []);

  const hasSchematicOnly = days.some(
    (d) => !REAL_ROUTE_DAYS.has(d) && (schematicPolylines[d]?.length ?? 0) >= 2,
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Day filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveDay(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
            activeDay === null
              ? 'bg-slate-800 text-white shadow'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Vše
        </button>
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setActiveDay(activeDay === d ? null : d)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
              activeDay === d ? 'text-white shadow' : 'text-slate-700 hover:opacity-80'
            }`}
            style={
              activeDay === d
                ? { backgroundColor: DAY_COLORS[d] }
                : { backgroundColor: DAY_COLORS[d] + '33', border: `1.5px solid ${DAY_COLORS[d]}` }
            }
          >
            Den {d}
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <MapContainer
          center={[46.36, 13.63]}
          zoom={9}
          scrollWheelZoom={false}
          style={{ height: '420px' }}
          className="md:!h-[560px]"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> přispěvatelé, routing <a href="https://brouter.de" target="_blank" rel="noreferrer">BRouter</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Transport layer — šedá čárkovaná, oddělená od trekové */}
          <Polyline
            positions={TRANSPORT_LINE}
            pathOptions={{ color: '#94a3b8', weight: 1.5, dashArray: '6 4', opacity: 0.6 }}
          />

          {/* Trek polylines — real BRouter routes for days 3 & 4, schematic fallback for others */}
          {days.map((d) => {
            if (activeDay !== null && activeDay !== d) return null;
            const real = realRoutes[d];
            const schematic = schematicPolylines[d];

            if (REAL_ROUTE_DAYS.has(d)) {
              // Real route available (or still loading — real will be null until loaded)
              if (real && real.length >= 2) {
                return (
                  <Polyline
                    key={`route-${d}`}
                    positions={real}
                    pathOptions={{ color: DAY_COLORS[d], weight: 3, opacity: 0.85 }}
                  />
                );
              }
              // Fallback while loading or if fetch failed
              if (schematic && schematic.length >= 2) {
                return (
                  <Polyline
                    key={`fallback-${d}`}
                    positions={schematic}
                    pathOptions={{ color: DAY_COLORS[d], weight: 2.5, dashArray: '8 5', opacity: 0.6 }}
                  />
                );
              }
              return null;
            }

            // Other days — schematic dashed
            if (!schematic || schematic.length < 2) return null;
            return (
              <Polyline
                key={`trek-${d}`}
                positions={schematic}
                pathOptions={{ color: DAY_COLORS[d], weight: 2.5, dashArray: '8 5', opacity: 0.75 }}
              />
            );
          })}

          {/* Markers */}
          {visibleWaypoints.map((wp) => {
            const isContext = wp.day === null;
            const color = isContext ? CONTEXT_COLOR : DAY_COLORS[wp.day as number];
            const icon = createDayIcon(wp.day, color, isContext);
            return (
              <Marker key={wp.id} position={[wp.lat, wp.lng]} icon={icon}>
                <Popup>
                  <div className="text-sm">
                    <div className="mb-1 font-semibold text-slate-900">{wp.name}</div>
                    {wp.day !== null && (
                      <div
                        className="mb-1 inline-block rounded-full px-2 py-0.5 text-xs text-white"
                        style={{ backgroundColor: DAY_COLORS[wp.day] }}
                      >
                        Den {wp.day}
                      </div>
                    )}
                    <div className="mt-1 text-slate-600">{wp.description}</div>
                    {wp.day !== null && (
                      <a
                        href={`#den-${wp.day}`}
                        className="mt-2 block text-xs font-medium text-sky-600 hover:text-sky-800"
                      >
                        → Zobrazit Den {wp.day}
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <div className="mb-2 font-medium text-slate-700">Legenda</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {days.map((d) => (
            <span key={d} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: DAY_COLORS[d] }}
              />
              Den {d}
              {REAL_ROUTE_DAYS.has(d) && (
                <span className="text-slate-400">(BRouter)</span>
              )}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            Kontext (Brno/Ljubljana)
          </span>
        </div>
        {hasSchematicOnly && (
          <div className="mt-2 text-slate-400">
            Ostatní dny — schematická trasa (čárkovaně)
          </div>
        )}
        <div className="text-slate-400">Dopravní vrstva — šedá čára Brno→Ljubljana→KG</div>
        <div className="mt-1 text-slate-400">
          Trasy © OpenStreetMap přispěvatelé, routing BRouter
        </div>
      </div>
    </div>
  );
}
