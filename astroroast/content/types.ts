// AstroRoast.ai: tvary obsahu. Oba modely (claude, codex) musí mít shodnou strukturu.

import type { CatalogJoke, Level, SignId, SignText, Topic } from "../types";

export type Five<T> = [T, T, T, T, T];

/** Surová, kompaktní podoba dat jednoho znamení (index 0 = úroveň 1). Jeden soubor na znamení a model. */
export interface RawSign {
  /** Headlines: 3 na úroveň. */
  h: Five<string[]>;
  /** Core lines (výchozí věta o znamení): 2 na úroveň. */
  c: Five<string[]>;
  /** Verdikty: 2 na úroveň. */
  v: Five<string[]>;
  /** Témata po úrovních: pro každé téma pět polí vět (index 0 = úroveň 1), min. 3 věty v každém. */
  t: Record<Topic, Five<string[]>>;
  /** Falešné statistiky znamení: 6 kusů [label, value]. */
  s: [string, string][];
  /** Denní jednovětky: 12 kusů (+ headlines úrovní 2-3 = pool >= 20). */
  d: string[];
  /** Odpovědi v páru, pořadí viz COUPLE_SITUATIONS: 6 kusů. */
  q: string[];
}

export interface SignFragments {
  headlines: Record<Level, string[]>;
  core: Record<Level, string[]>;
  verdicts: Record<Level, string[]>;
  /** topic -> level -> věty */
  topic: Record<Topic, Record<Level, string[]>>;
  stats: { label: string; value: string }[];
  daily: string[];
  /** Odpověď znamení na každou situaci z COUPLE_SITUATIONS (stejné pořadí). */
  couple: string[];
}

export type ElementPairKey =
  | "ohen-ohen" | "ohen-zeme" | "ohen-vzduch" | "ohen-voda"
  | "zeme-zeme" | "zeme-vzduch" | "zeme-voda"
  | "vzduch-vzduch" | "vzduch-voda" | "voda-voda"
  | "stejne";

export interface CouplePairContent {
  intros: string[];
  titles: string[];
  verdicts: string[];
}

/** Vše, co model dodává. Obě složky content/<model>/ musí tento tvar naplnit stejně. */
export interface ModelContent {
  fragments: Record<SignId, SignFragments>;
  kickers: Record<Topic, Five<string[]>>;
  friendKickers: Record<1 | 2 | 3, string[]>;
  topicStats: Record<Topic, { label: string; value: string }[]>;
  coupleSituations: string[];
  couplePairs: Record<ElementPairKey, CouplePairContent>;
  coupleOutros: Record<1 | 2 | 3, string[]>;
  stejneEcho: string[];
  catalog: CatalogJoke[];
  seriesLabels: Record<CatalogJoke["series"], string>;
  signText: Record<SignId, SignText>;
}
