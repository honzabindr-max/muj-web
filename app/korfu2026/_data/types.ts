/**
 * Datový model karty — Korfu 2026.
 *
 * Model je 1:1 odvozen z části 19 SOURCE_PACKu (.korfu/SOURCE_PACK.md, ř. 395–399):
 *   "Datový model karty: canonical name; český název; kategorie a podkategorie; must-see /
 *    doporučení / další možnost; oblast ostrova; krátké „proč sem"; WOW faktor 1–5; doporučená
 *    délka; nejlepší část dne; vhodné počasí; doprava; náročnost přístupu; parkování; co lze
 *    spojit; rizika / upozornění; orientační čas z Silver Beach Hotelu; ověřené souřadnice;
 *    navigační odkaz; oficiální nebo ověřovací zdroj; aktuálnost; oblíbené / navštíveno
 *    v localStorage."
 *
 * PRAVIDLO PROVENIENCE (kontrakt bod 16):
 * Pole, jehož hodnotu SOURCE_PACK pro dané místo NEUVÁDÍ, zůstává `null`. Nikdy se nedoplňuje
 * z modelové znalosti ani odhadem. Každá vyplněná hodnota musí být doložitelná citací ze
 * SOURCE_PACKu — proto každá karta nese pole `sp` (čísla řádků SOURCE_PACKu).
 *
 * "oblíbené / navštíveno v localStorage" NENÍ součástí statických dat — je to runtime stav
 * ukládaný pod klíčem `korfu2026:selection:v1` (implementace v pozdějším kroku).
 */

/** Kategorie karty. */
export type Category =
  | 'plaz'
  | 'pamatka'
  | 'vesnice'
  | 'mesto'
  | 'priroda'
  | 'vyhlidka'
  | 'aktivita'
  | 'lod'
  | 'jidlo'
  | 'vecer'
  | 'doprava'
  | 'prakticke';

/** SOURCE_PACK ř. 395–396: "must-see / doporučení / další možnost". */
export type Tier = 'must-see' | 'doporuceni' | 'dalsi-moznost';

/**
 * Oblast ostrova. Hodnoty odpovídají členění, které SOURCE_PACK sám používá
 * v části 7 (ř. 74–94): "Bez přesunu / blízko základny", "Severozápad", "Západ",
 * "Severovýchod", "Jih a jihozápad". `corfu-town` a `vnitrozemi` pokrývají body
 * z části 8 (ř. 96–111), které do plážového členění nespadají.
 */
export type Area =
  | 'blizko-zakladny'
  | 'severozapad'
  | 'zapad'
  | 'severovychod'
  | 'jih-jihozapad'
  | 'corfu-town'
  | 'vnitrozemi';

export const AREA_LABEL: Record<Area, string> = {
  'blizko-zakladny': 'Bez přesunu / blízko základny',
  severozapad: 'Severozápad',
  zapad: 'Západ',
  severovychod: 'Severovýchod',
  'jih-jihozapad': 'Jih a jihozápad',
  'corfu-town': 'Corfu Town',
  vnitrozemi: 'Vnitrozemí a hory',
};

export const TIER_LABEL: Record<Tier, string> = {
  'must-see': 'Must-see',
  doporuceni: 'Doporučení',
  'dalsi-moznost': 'Další možnost',
};

/**
 * Stav mapového bodu.
 * SOURCE_PACK (v. 13. 9. 2026) NEOBSAHUJE ŽÁDNÉ ČÍSELNÉ SOUŘADNICE — viz CHECKPOINT-2, mezera G1.
 * Proto je dnes u všech karet `coords: null` a `coordsStatus: 'chybi-ve-zdroji'`.
 * Souřadnice se doplní až z doloženého zdroje, nikdy z paměti modelu.
 */
export type CoordsStatus = 'overene' | 'orientacni' | 'chybi-ve-zdroji';

export interface Coords {
  lat: number;
  lon: number;
}

/** Odkaz na oficiální nebo ověřovací zdroj (SOURCE_PACK ř. 398–399). */
export interface SourceRef {
  label: string;
  url: string;
}

/**
 * Údaj, který se podle SOURCE_PACKu ř. 28–30 musí ověřovat co nejblíže použití.
 * V UI se vykresluje se štítkem „ověřit aktuálně".
 */
export interface VerifyItem {
  /** Co přesně se má ověřit — doslovná formulace ze SOURCE_PACKu. */
  what: string;
  /** Citace řádků SOURCE_PACKu, odkud požadavek na ověření pochází. */
  sp: string;
  /** Zdroj k ověření, pokud ho SOURCE_PACK uvádí. Jinak null. */
  source?: SourceRef | null;
}

export interface Place {
  /** Stabilní slug — jediná hodnota odvozená mechanicky z canonical name. */
  id: string;
  /** SOURCE_PACK ř. 395: "canonical name". */
  canonicalName: string;
  /** SOURCE_PACK ř. 395: "český název". null, pokud zdroj český název neuvádí. */
  czName: string | null;
  /** SOURCE_PACK ř. 395: "kategorie a podkategorie". */
  category: Category;
  subcategory: string | null;
  /** SOURCE_PACK ř. 395–396: "must-see / doporučení / další možnost". */
  tier: Tier;
  /** SOURCE_PACK ř. 396: "oblast ostrova". */
  area: Area;
  /** SOURCE_PACK ř. 396: "krátké ‚proč sem'" — složeno z doslovných formulací zdroje. */
  why: string;
  /**
   * SOURCE_PACK ř. 396: "WOW faktor 1–5".
   * ZDROJ ŽÁDNÉ ČÍSLO WOW NEUVÁDÍ → vždy null, nikdy se nedopočítává (kontrakt bod 16).
   */
  wow: 1 | 2 | 3 | 4 | 5 | null;
  /**
   * Priorita vyjádřená v ručním seznamu (část 6). Nejde o WOW faktor — je to doslovná
   * poznámka uživatele, např. „označena srdcem" / „označena hvězdičkou".
   */
  userPriority: string | null;
  /** SOURCE_PACK ř. 396: "doporučená délka". null, pokud zdroj neuvádí. */
  visitDuration: string | null;
  /** SOURCE_PACK ř. 397: "nejlepší část dne" — neutrální metadatum povolené v ř. 433–435. */
  bestPartOfDay: string | null;
  /** SOURCE_PACK ř. 397: "vhodné počasí" — neutrální metadatum povolené v ř. 433–435. */
  weather: string | null;
  /** SOURCE_PACK ř. 397: "doprava". Prázdné pole = zdroj neuvádí. */
  transport: string[];
  /** SOURCE_PACK ř. 397: "náročnost přístupu". null, pokud zdroj neuvádí. */
  accessDifficulty: string | null;
  /**
   * SOURCE_PACK ř. 397: "parkování".
   * ZDROJ parkování u konkrétních míst NEUVÁDÍ (jen požadavek ověřit u Myrtiotissy, ř. 87–88)
   * → jinak null (kontrakt bod 16).
   */
  parking: string | null;
  /** SOURCE_PACK ř. 397: "co lze spojit" — doslovné balíčky z části 9 (ř. 113–125). */
  combinesWith: string[];
  /** SOURCE_PACK ř. 397–398: "rizika / upozornění". */
  warnings: string[];
  /**
   * SOURCE_PACK ř. 398: "orientační čas z Silver Beach Hotelu".
   * ZDROJ ŽÁDNÝ ČAS Z HOTELU NEUVÁDÍ → vždy null, nikdy se neodhaduje (kontrakt bod 16).
   */
  timeFromHotel: string | null;
  /** SOURCE_PACK ř. 398: "ověřené souřadnice". null, dokud není doložený zdroj. */
  coords: Coords | null;
  coordsStatus: CoordsStatus;
  /** Vysvětlení stavu mapového bodu pro uživatele. */
  coordsNote: string | null;
  /**
   * SOURCE_PACK ř. 398: "navigační odkaz".
   * Dotaz pro Google Maps deep-link. Odvozen DETERMINISTICKY z canonicalName
   * (pravidlo R-NAV, CHECKPOINT-2) — neobsahuje žádnou vymyšlenou polohu.
   */
  mapsQuery: string;
  /** SOURCE_PACK ř. 398–399: "oficiální nebo ověřovací zdroj". */
  sources: SourceRef[];
  /** SOURCE_PACK ř. 399: "aktuálnost" — co je nutné ověřit před použitím. */
  verify: VerifyItem[];
  /** Provenience: čísla řádků .korfu/SOURCE_PACK.md, ze kterých karta vychází. */
  sp: string;
}

/** Deterministické pravidlo R-NAV: Google Maps hledání podle názvu, bez souřadnic. */
export function mapsUrl(place: Place): string {
  if (place.coords) {
    return `https://www.google.com/maps/search/?api=1&query=${place.coords.lat},${place.coords.lon}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.mapsQuery)}`;
}
