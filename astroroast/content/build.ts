// Model-independent helpers that turn authored raw content into the structures the engine uses.

import { SIGN_IDS, type CatalogJoke, type Level, type SignId, type Topic } from "../types";
import type { Five, RawSign, SignFragments } from "./types";

export const SERIES_ORDER: CatalogJoke["series"][] = [
  "sejde-se",
  "dovolena",
  "zprava",
  "rika-vs-mysli",
  "one-liner",
];

const LEVELS: Level[] = [1, 2, 3, 4, 5];

function byLevel<T>(five: Five<T>): Record<Level, T> {
  const out = {} as Record<Level, T>;
  LEVELS.forEach((lv, i) => {
    out[lv] = five[i];
  });
  return out;
}

/** Raw (compact, authored) sign data -> the structure the engine reads. */
export function toSignFragments(raw: RawSign): SignFragments {
  const topic = {} as Record<Topic, Record<Level, string[]>>;
  (Object.keys(raw.t) as Topic[]).forEach((k) => {
    topic[k] = byLevel(raw.t[k]);
  });
  return {
    headlines: byLevel(raw.h),
    core: byLevel(raw.c),
    verdicts: byLevel(raw.v),
    topic,
    stats: raw.s.map(([label, value]) => ({ label, value })),
    daily: raw.d,
    couple: raw.q,
  };
}

export function buildCatalog(raw: Record<SignId, Record<CatalogJoke["series"], string[]>>): CatalogJoke[] {
  return SIGN_IDS.flatMap((sign) =>
    SERIES_ORDER.flatMap((series) =>
      raw[sign][series].map(
        (text, i): CatalogJoke => ({ id: `${sign}-${series}-${i + 1}`, sign, series, text }),
      ),
    ),
  );
}
