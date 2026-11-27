import { DEFAULT_MODEL, SIGN_IDS, type ModelId, type SignId, type SignInfo, type SignText } from "../types";
import { CONTENT } from "../content";

// Tropická data (inkluzivní, "MM-DD"). Hranice se každý rok liší o den, proto resolveSign hlásí cusp.
export const SIGNS: Record<SignId, SignInfo> = {
  beran: {
    id: "beran",
    name: "Beran",
    namePluralGen: "Beranů",
    glyph: "♈",
    emoji: "🐏",
    element: "ohen",
    from: "03-21",
    to: "04-19",
  },
  byk: {
    id: "byk",
    name: "Býk",
    namePluralGen: "Býků",
    glyph: "♉",
    emoji: "🐂",
    element: "zeme",
    from: "04-20",
    to: "05-20",
  },
  blizenci: {
    id: "blizenci",
    name: "Blíženci",
    namePluralGen: "Blíženců",
    glyph: "♊",
    emoji: "👯",
    element: "vzduch",
    from: "05-21",
    to: "06-20",
  },
  rak: {
    id: "rak",
    name: "Rak",
    namePluralGen: "Raků",
    glyph: "♋",
    emoji: "🦀",
    element: "voda",
    from: "06-21",
    to: "07-22",
  },
  lev: {
    id: "lev",
    name: "Lev",
    namePluralGen: "Lvů",
    glyph: "♌",
    emoji: "🦁",
    element: "ohen",
    from: "07-23",
    to: "08-22",
  },
  panna: {
    id: "panna",
    name: "Panna",
    namePluralGen: "Panen",
    glyph: "♍",
    emoji: "📋",
    element: "zeme",
    from: "08-23",
    to: "09-22",
  },
  vahy: {
    id: "vahy",
    name: "Váhy",
    namePluralGen: "Vah",
    glyph: "♎",
    emoji: "⚖️",
    element: "vzduch",
    from: "09-23",
    to: "10-22",
  },
  stir: {
    id: "stir",
    name: "Štír",
    namePluralGen: "Štírů",
    glyph: "♏",
    emoji: "🦂",
    element: "voda",
    from: "10-23",
    to: "11-21",
  },
  strelec: {
    id: "strelec",
    name: "Střelec",
    namePluralGen: "Střelců",
    glyph: "♐",
    emoji: "🏹",
    element: "ohen",
    from: "11-22",
    to: "12-21",
  },
  kozoroh: {
    id: "kozoroh",
    name: "Kozoroh",
    namePluralGen: "Kozorohů",
    glyph: "♑",
    emoji: "🐐",
    element: "zeme",
    from: "12-22",
    to: "01-19",
  },
  vodnar: {
    id: "vodnar",
    name: "Vodnář",
    namePluralGen: "Vodnářů",
    glyph: "♒",
    emoji: "🫗",
    element: "vzduch",
    from: "01-20",
    to: "02-18",
  },
  ryby: {
    id: "ryby",
    name: "Ryby",
    namePluralGen: "Ryb",
    glyph: "♓",
    emoji: "🐟",
    element: "voda",
    from: "02-19",
    to: "03-20",
  },
};

/** Texty znamení (tagline, motivy) podle modelu. Jména, glyfy a data jsou model-nezávislé v SIGNS. */
export function signText(sign: SignId, model: ModelId = DEFAULT_MODEL): SignText {
  return CONTENT[model].signText[sign];
}

/** Znamení v pořadí zvěrokruhu (Beran první). */
export const SIGN_LIST: SignInfo[] = SIGN_IDS.map((id) => SIGNS[id]);

/** Najde znamení podle slugu (shoduje se s SignId). Nerozlišuje velikost písmen. */
export function signBySlug(slug: string): SignInfo | undefined {
  if (typeof slug !== "string") return undefined;
  const key = slug.trim().toLowerCase() as SignId;
  return (SIGN_IDS as readonly string[]).includes(key) ? SIGNS[key] : undefined;
}
