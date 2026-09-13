// VYGENEROVÁNO: scripts/korfu2026-geocode.mjs — needituj ručně.
// Zdroj: OpenStreetMap Nominatim (© OpenStreetMap contributors, ODbL).
// Povoleno SUPERVISOR DIRECTIVE 01 / D01-A, .korfu/SOURCE_PACK.md ř. 487–498.
// Dohledáno: 2026-09-13. Data jsou statická — web za běhu žádné API nevolá.
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
  'canal-damour': {
    coords: { lat: 39.7974749, lon: 19.6980829 },
    coordsStatus: 'overene',
    coordsSource: 'osm-nominatim',
    coordsQuery: "Canal d'Amour, Corfu, Greece",
    coordsCheckedAt: '2026-09-13',
    displayName: "Canal d'Amour, Sidari, Municipality of Northern Corfu, Corfu Regional Unit, Ioanian Islands, Peloponnese, Western Greece and the Ionian, 490 81, Greece",
  },
  'porto-timoni': {
    coords: { lat: 39.7150927, lon: 19.657751 },
    coordsStatus: 'overene',
    coordsSource: 'osm-nominatim',
    coordsQuery: "Porto Timoni, Corfu, Greece",
    coordsCheckedAt: '2026-09-13',
    displayName: "Porto Timoni, Afionas, Municipality of Northern Corfu, Corfu Regional Unit, Ioanian Islands, Peloponnese, Western Greece and the Ionian, 490 81, Greece",
  },
  'paleokastritsa': {
    coords: { lat: 39.6757716, lon: 19.7119035 },
    coordsStatus: 'overene',
    coordsSource: 'osm-nominatim',
    coordsQuery: "Paleokastritsa, Corfu, Greece",
    coordsCheckedAt: '2026-09-13',
    displayName: "Palaiokastritsa, Municipality of Central Corfu and Diapontia Islands, Corfu Regional Unit, Ioanian Islands, Peloponnese, Western Greece and the Ionian, 490 83, Greece",
  },
  'kassiopi-beach': {
    coords: { lat: 39.7891062, lon: 19.9220526 },
    coordsStatus: 'overene',
    coordsSource: 'osm-nominatim',
    coordsQuery: "Kassiopi, Corfu, Greece",
    coordsCheckedAt: '2026-09-13',
    displayName: "Kassiopi, Kassopaia Municipal Unit, Municipality of Northern Corfu, Corfu Regional Unit, Ioanian Islands, Peloponnese, Western Greece and the Ionian, Greece",
  },
  'rovinia-beach': {
    coords: { lat: 39.6705236, lon: 19.7278861 },
    coordsStatus: 'overene',
    coordsSource: 'osm-nominatim',
    coordsQuery: "Rovinia Beach, Corfu, Greece",
    coordsCheckedAt: '2026-09-13',
    displayName: "Rovinia, Liapades, Municipality of Central Corfu and Diapontia Islands, Corfu Regional Unit, Ioanian Islands, Peloponnese, Western Greece and the Ionian, 490 83, Greece",
  },
  'agios-gordios': {
    coords: { lat: 39.5463723, lon: 19.8535708 },
    coordsStatus: 'overene',
    coordsSource: 'osm-nominatim',
    coordsQuery: "Agios Gordios, Corfu, Greece",
    coordsCheckedAt: '2026-09-13',
    displayName: "Agios Gordios, Municipality of Central Corfu and Diapontia Islands, Corfu Regional Unit, Ioanian Islands, Peloponnese, Western Greece and the Ionian, Greece",
  },
  'issos-beach': {
    coords: { lat: 39.4293085, lon: 19.9393258 },
    coordsStatus: 'overene',
    coordsSource: 'osm-nominatim',
    coordsQuery: "Issos Beach, Corfu, Greece",
    coordsCheckedAt: '2026-09-13',
    displayName: "Issos Beach, Municipal Unit of Meliteieis, Municipality of Southern Corfu, Corfu Regional Unit, Ioanian Islands, Peloponnese, Western Greece and the Ionian, Greece",
  },
  'avlaki-beach': {
    coords: { lat: 39.7799454, lon: 19.9425103 },
    coordsStatus: 'overene',
    coordsSource: 'osm-nominatim',
    coordsQuery: "Avlaki Beach, Corfu, Greece",
    coordsCheckedAt: '2026-09-13',
    displayName: "Avlaki Beach, Kariotiko, Kassopaia Municipal Unit, Municipality of Northern Corfu, Corfu Regional Unit, Ioanian Islands, Peloponnese, Western Greece and the Ionian, 491 00, Greece",
  },
  'marathias-beach': {
    coords: { lat: 39.4141688, lon: 19.9838528 },
    coordsStatus: 'overene',
    coordsSource: 'osm-nominatim',
    coordsQuery: "Marathias Beach, Corfu, Greece",
    coordsCheckedAt: '2026-09-13',
    displayName: "Marathias beach, Potamia, Marathias, Municipal Unit of Korissia, Municipality of Southern Corfu, Corfu Regional Unit, Ioanian Islands, Peloponnese, Western Greece and the Ionian, 490 80, Greece",
  },
  'nissaki-beach': {
    coords: { lat: 39.7240175, lon: 19.8969852 },
    coordsStatus: 'overene',
    coordsSource: 'osm-nominatim',
    coordsQuery: "Nissaki Beach, Corfu, Greece",
    coordsCheckedAt: '2026-09-13',
    displayName: "Nissaki Beach, Nissaki, Kassopaia Municipal Unit, Municipality of Northern Corfu, Corfu Regional Unit, Ioanian Islands, Peloponnese, Western Greece and the Ionian, Greece",
  },
  'chalikounas-beach': {
    coords: { lat: 39.4475963, lon: 19.8861189 },
    coordsStatus: 'overene',
    coordsSource: 'osm-nominatim',
    coordsQuery: "Chalikounas Beach, Corfu, Greece",
    coordsCheckedAt: '2026-09-13',
    displayName: "Chalikounas Beach, Chalikounas, Municipal Unit of Meliteieis, Municipality of Southern Corfu, Corfu Regional Unit, Ioanian Islands, Peloponnese, Western Greece and the Ionian, 490 84, Greece",
  },
  'myrtiotissa-beach': {
    coords: { lat: 39.5955325, lon: 19.799522 },
    coordsStatus: 'overene',
    coordsSource: 'osm-nominatim',
    coordsQuery: "Myrtiotissa Beach, Corfu, Greece",
    coordsCheckedAt: '2026-09-13',
    displayName: "Myrtiotissa Beach, Glyfada, Municipality of Central Corfu and Diapontia Islands, Corfu Regional Unit, Ioanian Islands, Peloponnese, Western Greece and the Ionian, 491 00, Greece",
  },
  'barbati-beach': {
    coords: { lat: 39.7157285, lon: 19.8672221 },
    coordsStatus: 'overene',
    coordsSource: 'osm-nominatim',
    coordsQuery: "Barbati Beach, Corfu, Greece",
    coordsCheckedAt: '2026-09-13',
    displayName: "Barbati Beach, Glyfa, Barbati, Municipality of Central Corfu and Diapontia Islands, Corfu Regional Unit, Ioanian Islands, Peloponnese, Western Greece and the Ionian, 490 81, Greece",
  },
};
