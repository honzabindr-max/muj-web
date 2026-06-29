#!/usr/bin/env node
/**
 * Fetches real hiking routes for /soci from BRouter public API.
 * Run manually: npm run fetch:routes
 * Do NOT run at build time — BRouter is a public service.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../public/soci');

const ROUTES = [
  {
    day: 3,
    name: 'Jezero Jasna → Russian Chapel → Vršič → Izvir Soče → Dom Trenta',
    // lon,lat order for BRouter
    lonlats: [
      '13.7841,46.4740', // Jezero Jasna
      '13.7677,46.4426', // Russian Chapel
      '13.7431,46.4329', // Vršič Pass
      '13.7241,46.4117', // Izvir Soče
      '13.7525,46.3804', // Dom Trenta
    ],
    outFile: 'den3.geojson',
  },
  {
    day: 4,
    name: 'Dom Trenta → Velika korita → Camp Bovec',
    lonlats: [
      '13.7525,46.3804', // Dom Trenta
      '13.6459,46.3372', // Velika korita Soče
      '13.5537,46.3355', // Camp Bovec
    ],
    outFile: 'den4.geojson',
  },
];

const PROFILES = ['hiking-mountain', 'trekking'];

async function fetchRoute(lonlats, profile) {
  const url = `https://brouter.de/brouter?lonlats=${lonlats.join('%7C')}&profile=${profile}&alternativeidx=0&format=geojson`;
  console.log(`  GET ${url}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'muj-web/soci-routes-builder (build-time, single request per route)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return json;
}

function isRealRoute(geojson) {
  // A real route has many coordinates (not a straight line between waypoints)
  const features = geojson?.features ?? [];
  if (features.length === 0) return false;
  const coords = features[0]?.geometry?.coordinates ?? [];
  // If BRouter returns < 10 points it's almost certainly an error or straight line
  return coords.length >= 10;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const route of ROUTES) {
    console.log(`\nFetching Den ${route.day}: ${route.name}`);
    let geojson = null;
    let usedProfile = null;

    for (const profile of PROFILES) {
      try {
        console.log(`  Trying profile: ${profile}`);
        const result = await fetchRoute(route.lonlats, profile);
        if (isRealRoute(result)) {
          geojson = result;
          usedProfile = profile;
          const coords = result.features[0]?.geometry?.coordinates ?? [];
          console.log(`  ✓ Success with profile=${profile}, ${coords.length} coordinates`);
          break;
        } else {
          console.log(`  ✗ Profile ${profile} returned suspicious result (too few points), trying next…`);
        }
      } catch (err) {
        console.log(`  ✗ Profile ${profile} failed: ${err.message}`);
      }
    }

    if (!geojson) {
      console.error(`  ✗ All profiles failed for Den ${route.day}. Skipping.`);
      continue;
    }

    // Annotate with metadata
    geojson._meta = { day: route.day, profile: usedProfile, fetchedAt: new Date().toISOString() };

    const outPath = resolve(OUT_DIR, route.outFile);
    await writeFile(outPath, JSON.stringify(geojson, null, 2), 'utf-8');
    console.log(`  Saved → ${outPath}`);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
