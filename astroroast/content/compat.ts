// Model-independent numeric base of the fake "cosmic compatibility". Not text, so it is shared by both models.

import type { ElementPairKey } from "./types";

/** Základní "kosmická kompatibilita" podle dvojice živlů (obvykle 0-100, vše je samozřejmě vymyšlené). */
export const COMPAT_BASE: Record<ElementPairKey, number> = {
  "ohen-ohen": 62,
  "ohen-zeme": 38,
  "ohen-vzduch": 82,
  "ohen-voda": 32,
  "zeme-zeme": 70,
  "zeme-vzduch": 36,
  "zeme-voda": 78,
  "vzduch-vzduch": 66,
  "vzduch-voda": 34,
  "voda-voda": 74,
  stejne: 55,
};
