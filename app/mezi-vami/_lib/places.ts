// Číselník obcí ČR + SR (statický JSON v _data, načítaný líně) a hledání bez ohledu na diakritiku.

import { normalizeText, type Cc, type Place } from "./persons";

export type IndexedPlace = Place & { key: string };

type PlacesFile = { v: number; src: string[]; p: [string, string, Cc][] };

export function buildIndex(file: PlacesFile): IndexedPlace[] {
  return file.p.map(([name, okres, cc]) => ({
    name,
    okres,
    cc,
    key: normalizeText(name),
  }));
}

// Největší města (název bez diakritiky | stát) — v rámci skupiny shody jdou první.
const BIG = [
  "praha|CZ", "brno|CZ", "ostrava|CZ", "plzen|CZ", "liberec|CZ", "olomouc|CZ",
  "ceske budejovice|CZ", "hradec kralove|CZ", "usti nad labem|CZ", "pardubice|CZ",
  "zlin|CZ", "jihlava|CZ", "karlovy vary|CZ", "bratislava|SK", "kosice|SK",
  "presov|SK", "zilina|SK", "nitra|SK", "banska bystrica|SK", "trnava|SK",
  "trencin|SK", "martin|SK", "poprad|SK",
];
const bigRank = (p: IndexedPlace) => {
  const i = BIG.indexOf(`${p.key}|${p.cc}`);
  return i < 0 ? BIG.length : i;
};

/** Řazení uvnitř skupiny: největší města, pak kratší název, pak pořadí číselníku (abecední). */
const byRelevance = (a: IndexedPlace, b: IndexedPlace) =>
  bigRank(a) - bigRank(b) || a.key.length - b.key.length;

/**
 * Hledání: přesná shoda názvu → název začíná dotazem → slovo v názvu začíná dotazem →
 * dotaz je kdekoli v názvu. Uvnitř skupiny největší města a kratší názvy dřív (Brn → Brno před Brňany).
 */
export function searchPlaces(
  index: IndexedPlace[],
  query: string,
  limit = 8,
): IndexedPlace[] {
  const q = normalizeText(query);
  if (q.length < 1) return [];
  const exact: IndexedPlace[] = [];
  const starts: IndexedPlace[] = [];
  const words: IndexedPlace[] = [];
  const inside: IndexedPlace[] = [];
  for (const p of index) {
    if (p.key === q) exact.push(p);
    else if (p.key.startsWith(q)) starts.push(p);
    else if (p.key.includes(` ${q}`)) words.push(p);
    else if (q.length >= 3 && p.key.includes(q)) inside.push(p);
  }
  // Array.prototype.sort je stabilní → stejně relevantní zůstávají abecedně
  return [
    ...exact.sort(byRelevance),
    ...starts.sort(byRelevance),
    ...words.sort(byRelevance),
    ...inside.sort(byRelevance),
  ].slice(0, limit);
}

let cache: Promise<IndexedPlace[]> | null = null;

/** Líné načtení (samostatný chunk): první volání stáhne JSON a postaví index. */
export function loadPlaces(): Promise<IndexedPlace[]> {
  if (!cache) {
    cache = import("../_data/places.json").then((m) =>
      buildIndex(m.default as unknown as PlacesFile),
    );
  }
  return cache;
}
