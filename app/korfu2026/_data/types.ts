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
 * Pole, jehož hodnotu SOURCE_PACK pro dané místo NEUVÁDÍ, zůstává `null` / prázdné pole. Nikdy
 * se nedoplňuje z modelové znalosti ani odhadem. Každá vyplněná hodnota musí být doložitelná
 * citací ze SOURCE_PACKu — proto každá karta nese pole `sp` (čísla řádků SOURCE_PACKu).
 *
 * "oblíbené / navštíveno v localStorage" NENÍ součástí statických dat — je to runtime stav
 * ukládaný pod klíčem `korfu2026:selection:v1` (implementace v pozdějším kroku).
 */

/** Klíč pro „Můj výběr" v localStorage. SOURCE_PACK ř. 391–392 a 405–406. */
export const SELECTION_KEY = 'korfu2026:selection:v1';

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
  | 'prakticke'
  /** Roda jako samostatná kategorie — SOURCE_PACK část 13, ř. 292–308. */
  | 'zakladna';

export const CATEGORY_LABEL: Record<Category, string> = {
  plaz: 'Pláž a koupání',
  pamatka: 'Památka',
  vesnice: 'Vesnice',
  mesto: 'Město',
  priroda: 'Příroda',
  vyhlidka: 'Vyhlídka',
  aktivita: 'Aktivita',
  lod: 'Loď a moře',
  jidlo: 'Jídlo',
  vecer: 'Večer',
  doprava: 'Doprava',
  prakticke: 'Praktické',
  zakladna: 'Základna Roda',
};

/** SOURCE_PACK ř. 395–396: "must-see / doporučení / další možnost". */
export type Tier = 'must-see' | 'doporuceni' | 'dalsi-moznost';

/**
 * Oblast ostrova. Hodnoty odpovídají členění, které SOURCE_PACK sám používá
 * v části 7 (ř. 74–94): "Bez přesunu / blízko základny", "Severozápad", "Západ",
 * "Severovýchod", "Jih a jihozápad". `corfu-town` a `vnitrozemi` pokrývají body
 * z části 8 (ř. 96–111), které do plážového členění nespadají.
 * `neurceno` je pro položky, které SOURCE_PACK k žádné oblasti nepřiřazuje
 * (typicky celoostrovní aktivity z části 12) — nikdy se nedoplňuje odhadem.
 */
export type Area =
  | 'blizko-zakladny'
  | 'severozapad'
  | 'zapad'
  | 'severovychod'
  | 'jih-jihozapad'
  | 'corfu-town'
  | 'vnitrozemi'
  | 'neurceno';

export const AREA_LABEL: Record<Area, string> = {
  'blizko-zakladny': 'Bez přesunu / blízko základny',
  severozapad: 'Severozápad',
  zapad: 'Západ',
  severovychod: 'Severovýchod',
  'jih-jihozapad': 'Jih a jihozápad',
  'corfu-town': 'Corfu Town',
  vnitrozemi: 'Vnitrozemí a hory',
  neurceno: 'Zdroj oblast neuvádí',
};

export const TIER_LABEL: Record<Tier, string> = {
  'must-see': 'Must-see',
  doporuceni: 'Doporučení',
  'dalsi-moznost': 'Další možnost',
};

/**
 * Náročnost přístupu (SOURCE_PACK ř. 397) jako filtrovatelný facet.
 * Vyplňuje se JEN tam, kde SOURCE_PACK náročnost výslovně popisuje
 * (např. "strmá kamenitá cesta" ř. 83, "lehký okruh" ř. 109). Jinak `null`.
 */
export type Difficulty = 'snadny' | 'stredni' | 'narocny';

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  snadny: 'Snadné',
  stredni: 'Střední',
  narocny: 'Náročné',
};

/**
 * Doprava (SOURCE_PACK ř. 397) jako filtrovatelný facet.
 * Vyplňuje se JEN tam, kde SOURCE_PACK způsob dopravy výslovně uvádí
 * (např. "pěší sestup z Afionasu nebo loď" ř. 82–83, "zejména lodí" ř. 85–86).
 */
export type TransportMode = 'auto' | 'bus' | 'taxi' | 'pesky' | 'lod' | 'skutr' | 'quad';

export const TRANSPORT_LABEL: Record<TransportMode, string> = {
  auto: 'Auto',
  bus: 'Autobus',
  taxi: 'Taxi',
  pesky: 'Pěšky',
  lod: 'Lodí',
  skutr: 'Skútr',
  quad: 'Quad',
};

/**
 * Vhodné počasí (SOURCE_PACK ř. 397) jako filtrovatelný facet.
 * Hodnoty jsou doslovná pravidla z části 17 (ř. 351–355) — nic dalšího se nedovozuje:
 * - `dobra-viditelnost`        — "Pantokrator a panoramata doporučit za dobré viditelnosti" (ř. 352–353)
 * - `problematicke-za-mokra`   — "Porto Timoni a Myrtiotissu označit jako problematické za mokra" (ř. 353–354)
 * - `vhodne-pri-horsim-pocasi` — "Corfu Town, restaurace, případná muzea a hotelový odpočinek
 *                                 označit jako možnosti při horším počasí" (ř. 354–355)
 * - `citlive-na-vitr`          — "pro loď sledovat vítr a vlny, ne jen teplotu" (ř. 352);
 *                                 u Canal d'Amour navíc "za větru a vln opatrnost" (ř. 80)
 */
export type WeatherFit =
  | 'dobra-viditelnost'
  | 'problematicke-za-mokra'
  | 'vhodne-pri-horsim-pocasi'
  | 'citlive-na-vitr';

export const WEATHER_LABEL: Record<WeatherFit, string> = {
  'dobra-viditelnost': 'Za dobré viditelnosti',
  'problematicke-za-mokra': 'Za mokra problematické',
  'vhodne-pri-horsim-pocasi': 'Možnost při horším počasí',
  'citlive-na-vitr': 'Citlivé na vítr a vlny',
};

/**
 * Stav mapového bodu.
 *
 * Části 1–25 SOURCE_PACKu neobsahují žádnou číselnou souřadnici (mezera G1, CHECKPOINT-2).
 * Rozhodnutí vlastníka D01-A (zadání běhu korfu2026-02, bod 1) proto povoluje jedinou výjimku
 * ze zákazu síťového ověřování: dohledat lat/lng přes veřejné OpenStreetMap Nominatim API
 * bez klíče, jednorázově skriptem při buildu dat, s výsledkem uloženým staticky do repa.
 *
 * - `overene`       — bod dohledaný podle D01-A a ověřený proti bounding boxu Korfu.
 * - `orientacni`    — bod existuje, ale zdroj ho označuje jako orientační.
 * - `neoveritelne`  — dotaz nevrátil jednoznačný výsledek (D01-A):
 *                     pin se nevykresluje, „Navigovat" zůstává Google Maps search podle názvu.
 * - `chybi-ve-zdroji` — hodnota zatím nebyla dohledávána.
 *
 * Souřadnice se NIKDY nevymýšlejí ani neodhadují zpaměti (D01-A).
 */
export type CoordsStatus = 'overene' | 'orientacni' | 'neoveritelne' | 'chybi-ve-zdroji';

/** Původ souřadnic. Jediná povolená hodnota podle D01-A. */
export type CoordsSource = 'osm-nominatim';

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

/**
 * Stav aktuálnosti dynamického údaje (SOURCE_PACK ř. 28–30, 393, 407).
 * Hodnota `overeno` v tomto datasetu ZÁMĚRNĚ neexistuje: rozhodnutí vlastníka D01-B
 * (zadání korfu2026-02, bod 1) zakazuje ceny, otevírací doby, sezonní provoz, dostupnost
 * a program akcí ověřovat. Každý takový údaj proto nese štítek „ověřit aktuálně" a odkaz
 * na zdroj — nikdy se nepodává jako potvrzený.
 */
export type FreshnessStatus = 'overit-aktualne' | 'starsi-lead' | 'neovereno';

export const FRESHNESS_LABEL: Record<FreshnessStatus, string> = {
  'overit-aktualne': 'ověřit aktuálně',
  'starsi-lead': 'starší lead — potvrdit přímo',
  neovereno: 'neověřeno',
};

/**
 * Dynamický údaj (cena, otevírací doba, sezonní provoz, dostupnost, program akce).
 *
 * Smí se vykreslit POUZE se štítkem podle `freshness` a s odkazem `source`
 * (SOURCE_PACK ř. 30 „Žádná falešná přesnost", ř. 407 „žádné falešné recenze, ceny,
 * dostupnosti ani otevírací doby"). Pomocná funkce `isRenderableFact()` to vynucuje.
 */
export interface DynamicFact {
  /** Co je to za údaj — např. "Sunset Beach Ride". */
  label: string;
  /** Hodnota přesně tak, jak ji uvádí SOURCE_PACK — např. "1,5 h, 45 € / osoba". */
  value: string;
  freshness: FreshnessStatus;
  /** Datum kontroly, které SOURCE_PACK sám uvádí. Jinak null. */
  checkedAt: string | null;
  /** Kam se jde údaj ověřit. Bez zdroje se hodnota nevykresluje. */
  source: SourceRef | null;
  /** Doslovná poznámka ze SOURCE_PACKu, pokud je potřeba. */
  note?: string;
  /** Provenience: čísla řádků .korfu/SOURCE_PACK.md. */
  sp: string;
}

/**
 * Dynamický údaj se smí zobrazit jen tehdy, když je k němu ověřovací odkaz
 * (SOURCE_PACK ř. 30 a 407). Bez zdroje se hodnota nevykresluje vůbec.
 */
export function isRenderableFact(fact: DynamicFact): boolean {
  return fact.source !== null;
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
  /** SOURCE_PACK ř. 397: "vhodné počasí" — volný text ze zdroje. */
  weather: string | null;
  /** Filtrovatelný facet k poli `weather`. Prázdné pole = zdroj nic neuvádí. */
  weatherFit: WeatherFit[];
  /** SOURCE_PACK ř. 397: "doprava". Prázdné pole = zdroj neuvádí. */
  transport: string[];
  /** Filtrovatelný facet k poli `transport`. Prázdné pole = zdroj neuvádí. */
  transportModes: TransportMode[];
  /** SOURCE_PACK ř. 397: "náročnost přístupu". null, pokud zdroj neuvádí. */
  accessDifficulty: string | null;
  /** Filtrovatelný facet k poli `accessDifficulty`. null = zdroj neuvádí. */
  difficulty: Difficulty | null;
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
  /** D01-A: povinná provenience souřadnic. */
  coordsSource: CoordsSource | null;
  /** D01-A: přesný dotaz odeslaný na Nominatim. */
  coordsQuery: string | null;
  /** D01-A: datum dohledání (`coordsCheckedAt`). */
  coordsCheckedAt: string | null;
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
  /** Dynamické údaje karty (ceny, provoz). Vždy se štítkem a zdrojem — D01-B. */
  facts: DynamicFact[];
  /** Provenience: čísla řádků .korfu/SOURCE_PACK.md, ze kterých karta vychází. */
  sp: string;
}

/**
 * Deterministické pravidlo R-NAV.
 * Je-li k dispozici ověřený bod, Navigovat míří na souřadnice; jinak na Google Maps hledání
 * podle canonical name (D01-A).
 */
export function mapsUrl(place: Place): string {
  if (place.coords) {
    return `https://www.google.com/maps/search/?api=1&query=${place.coords.lat},${place.coords.lon}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.mapsQuery)}`;
}

/** Geografický balíček z části 9 SOURCE_PACKu (ř. 113–125). NE dny. */
export interface Combo {
  id: string;
  /** Doslovné znění balíčku ze SOURCE_PACKu. */
  title: string;
  /** Id karet, které balíček pokrývá. Prázdné, pokud karta pro položku neexistuje. */
  placeIds: string[];
  sp: string;
}

/** Nabídka provozovatele — cena, délka, varianta. Vždy dynamický údaj (D01-B). */
export interface Offer extends DynamicFact {}

/** Provozovatel (koně, lodě, potápění, quad…) — část 10, 11, 12 SOURCE_PACKu. */
export interface Operator {
  id: string;
  name: string;
  /** Role podle SOURCE_PACKu: první volba / alternativa / neověřený lead. */
  role: 'prvni-volba' | 'alternativa' | 'lead';
  /** Základna / místo působení, doslova dle zdroje. null = zdroj neuvádí. */
  base: string | null;
  /** Co provozovatel nabízí — doslovné formulace zdroje. */
  offers: Offer[];
  /** Veřejné firemní telefony (privacy firewall ř. 50–53 se týká cestujících, ne firem). */
  phones: string[];
  emails: string[];
  sources: SourceRef[];
  warnings: string[];
  freshness: FreshnessStatus;
  sp: string;
}

/** Checklist ze SOURCE_PACKu — položky doslova, bez doplňování. */
export interface Checklist {
  id: string;
  title: string;
  items: string[];
  sp: string;
}

/** Hotová kontaktní zpráva (SOURCE_PACK ř. 175–179, 282–289). */
export interface ContactTemplate {
  id: string;
  title: string;
  body: string;
  sp: string;
}

/** Telefonní kontakt s tlačítky Volat / Kopírovat číslo (SOURCE_PACK ř. 407–408). */
export interface PhoneContact {
  label: string;
  phone: string;
  /** Doslovná poznámka ze zdroje, např. „(před použitím ověřit)". */
  note: string | null;
  sp: string;
}
