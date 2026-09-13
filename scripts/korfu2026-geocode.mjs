#!/usr/bin/env node
/**
 * Geokódování mapových bodů pro /korfu2026.
 *
 * Implementuje SUPERVISOR DIRECTIVE 01, bod D01-A (.korfu/SOURCE_PACK.md ř. 487–498):
 *  - jediný povolený zdroj: veřejné OpenStreetMap Nominatim API bez klíče
 *  - rate limit max 1 dotaz/s, vlastní User-Agent
 *  - jednorázově při buildu dat, NIKDY za běhu webu
 *  - výsledek se ukládá staticky do repa → web na API nezávisí
 *  - nejednoznačný výsledek => coords null + coordsStatus 'neoveritelne'
 *  - souřadnice se nikdy nevymýšlejí ani neodhadují
 *
 * Spuštění:  node scripts/korfu2026-geocode.mjs
 * Výstup:    app/korfu2026/_data/coords.generated.ts
 */
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = 'app/korfu2026/_data/coords.generated.ts';
const CHECKED_AT = '2026-09-13';
const USER_AGENT = 'korfu2026-build/1.0 (osobni cestovni web, kontakt pres repo muj-web)';

/**
 * Bounding box ostrova Korfu — deterministická kontrola platnosti odpovědi.
 * Nominatim vrací i stejnojmenná místa jinde v Řecku; bod mimo box se NEPŘIJME.
 */
const CORFU_BBOX = { minLat: 39.3, maxLat: 39.9, minLon: 19.3, maxLon: 20.2 };

/**
 * Dotazy. `q` = canonical name z části 6 SOURCE_PACKu + ", Corfu, Greece"
 * přesně podle tvaru v direktivě (ř. 490). Žádná jiná polohová informace se nepřidává.
 */
const TARGETS = [
  { id: 'canal-damour', q: "Canal d'Amour, Corfu, Greece" },
  { id: 'porto-timoni', q: 'Porto Timoni, Corfu, Greece' },
  { id: 'paleokastritsa', q: 'Paleokastritsa, Corfu, Greece' },
  { id: 'kassiopi-beach', q: 'Kassiopi, Corfu, Greece' },
  { id: 'rovinia-beach', q: 'Rovinia Beach, Corfu, Greece' },
  { id: 'agios-gordios', q: 'Agios Gordios, Corfu, Greece' },
  { id: 'issos-beach', q: 'Issos Beach, Corfu, Greece' },
  { id: 'avlaki-beach', q: 'Avlaki Beach, Corfu, Greece' },
  { id: 'marathias-beach', q: 'Marathias Beach, Corfu, Greece' },
  { id: 'nissaki-beach', q: 'Nissaki Beach, Corfu, Greece' },
  { id: 'chalikounas-beach', q: 'Chalikounas Beach, Corfu, Greece' },
  { id: 'myrtiotissa-beach', q: 'Myrtiotissa Beach, Corfu, Greece' },
  { id: 'barbati-beach', q: 'Barbati Beach, Corfu, Greece' },
];

function inCorfu(lat, lon) {
  return (
    lat >= CORFU_BBOX.minLat &&
    lat <= CORFU_BBOX.maxLat &&
    lon >= CORFU_BBOX.minLon &&
    lon <= CORFU_BBOX.maxLon
  );
}

async function geocode(q) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
    encodeURIComponent(q);
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
  });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const json = await res.json();
  if (!Array.isArray(json) || json.length === 0) {
    return { ok: false, reason: 'prazdna odpoved' };
  }
  const hit = json[0];
  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, reason: 'necislena odpoved' };
  }
  if (!inCorfu(lat, lon)) {
    return { ok: false, reason: `mimo bbox Korfu (${lat}, ${lon})` };
  }
  return { ok: true, lat, lon, displayName: String(hit.display_name ?? '') };
}

const results = [];
for (const [i, t] of TARGETS.entries()) {
  if (i > 0) await sleep(1100); // D01-A: max 1 dotaz/s
  let r;
  try {
    r = await geocode(t.q);
  } catch (err) {
    r = { ok: false, reason: `chyba site: ${err?.message ?? err}` };
  }
  if (r.ok) {
    console.log(`OK   ${t.id}  ${r.lat}, ${r.lon}  <- ${r.displayName}`);
    results.push({ ...t, ...r });
  } else {
    console.log(`MISS ${t.id}  ${r.reason}`);
    results.push({ ...t, ok: false, reason: r.reason });
  }
}

const body = results
  .map((r) =>
    r.ok
      ? `  '${r.id}': {\n` +
        `    coords: { lat: ${r.lat}, lon: ${r.lon} },\n` +
        `    coordsStatus: 'overene',\n` +
        `    coordsSource: 'osm-nominatim',\n` +
        `    coordsQuery: ${JSON.stringify(r.q)},\n` +
        `    coordsCheckedAt: '${CHECKED_AT}',\n` +
        `    displayName: ${JSON.stringify(r.displayName)},\n` +
        `  },`
      : `  '${r.id}': {\n` +
        `    coords: null,\n` +
        `    coordsStatus: 'neoveritelne',\n` +
        `    coordsSource: 'osm-nominatim',\n` +
        `    coordsQuery: ${JSON.stringify(r.q)},\n` +
        `    coordsCheckedAt: '${CHECKED_AT}',\n` +
        `    displayName: null, // ${r.reason}\n` +
        `  },`,
  )
  .join('\n');

const file = `// VYGENEROVÁNO: scripts/korfu2026-geocode.mjs — needituj ručně.
// Zdroj: OpenStreetMap Nominatim (© OpenStreetMap contributors, ODbL).
// Povoleno SUPERVISOR DIRECTIVE 01 / D01-A, .korfu/SOURCE_PACK.md ř. 487–498.
// Dohledáno: ${CHECKED_AT}. Data jsou statická — web za běhu žádné API nevolá.
import type { CoordsSource, CoordsStatus } from './types';

export interface GeocodedPoint {
  coords: { lat: number; lon: number } | null;
  coordsStatus: CoordsStatus;
  coordsSource: CoordsSource;
  coordsQuery: string;
  coordsCheckedAt: string;
  displayName: string | null;
}

export const GEOCODED: Record<string, GeocodedPoint> = {
${body}
};
`;

writeFileSync(OUT, file, 'utf8');
console.log(`\nzapsáno: ${OUT}  (${results.filter((r) => r.ok).length}/${results.length} bodů)`);
