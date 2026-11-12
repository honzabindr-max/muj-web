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

/**
 * Hledání: přesná shoda názvu → název začíná dotazem → slovo v názvu začíná dotazem →
 * dotaz je kdekoli v názvu. Uvnitř skupiny zůstává abecední pořadí číselníku.
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
    if (
      exact.length + starts.length >= limit * 4 &&
      words.length + inside.length >= limit
    )
      break;
  }
  return [...exact, ...starts, ...words, ...inside].slice(0, limit);
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
