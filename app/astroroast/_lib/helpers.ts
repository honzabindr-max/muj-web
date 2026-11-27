import { SIGN_LIST } from "@/astroroast/engine";
import type { Level, SignId, SignInfo, Target } from "@/astroroast/types";
import { SIGN_IDS, TOPIC_IDS, type Topic } from "@/astroroast/types";

/** Bezpečné dohledání znamení podle id (nezávislé na tom, zda je SIGNS pole nebo mapa). */
export function signOf(id: SignId): SignInfo {
  const s = SIGN_LIST.find((x) => x.id === id);
  if (!s) throw new Error(`AstroRoast: neznámé znamení ${id}`);
  return s;
}

export function isSignId(v: unknown): v is SignId {
  return typeof v === "string" && (SIGN_IDS as readonly string[]).includes(v);
}

export function isTopic(v: unknown): v is Topic {
  return typeof v === "string" && (TOPIC_IDS as readonly string[]).includes(v);
}

/** "03-21" -> "21. 3." */
export function formatMD(md: string): string {
  const [m, d] = md.split("-").map(Number);
  return `${d}. ${m}.`;
}

export function formatRange(s: SignInfo): string {
  return `${formatMD(s.from)} – ${formatMD(s.to)}`;
}

/** Dnešní datum v Europe/Prague (server i klient dají stejný výsledek). */
export function pragueToday(): { iso: string; label: string; dayNumber: number } {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = iso.split("-").map(Number);
  return {
    iso,
    label: `${d}. ${m}. ${y}`,
    dayNumber: Math.floor(Date.UTC(y, m - 1, d) / 86_400_000),
  };
}

export function maxLevelFor(target: Target): Level {
  return target === "friend" ? 3 : 5;
}

export function clampLevel(level: number, target: Target): Level {
  const max = maxLevelFor(target);
  return Math.max(1, Math.min(max, Math.round(level))) as Level;
}

/** Náhodný seed (pouze na klientu). 0..2^31-1 */
export function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] & 0x7fffffff;
}

/** Ikony témat (texty témat jsou v UiCopy.common.topics). */
export const TOPIC_EMOJI: Record<Topic, string> = {
  vztahy: "💔",
  prace: "💼",
  zivot: "🌀",
  pratele: "🫂",
  narozeniny: "🎂",
};

export const SITE_URL = "https://www.good-inventions.work";

/** Výchozí sdílecí obrázek (1200×630). Page-level openGraph přepisuje layout, proto se předává explicitně. */
export const OG_DEFAULT_IMAGE = {
  url: "/astroroast/opengraph-image",
  width: 1200,
  height: 630,
  alt: "AstroRoast.ai · Hvězdy tě nešetří",
};

/** Kanonická URL karty (stejná forma jako ve ShareBaru, aby se cache nedělila). */
export function cardPath(code: string, kind: "roast" | "couple", format: "og" | "story", version: string): string {
  return `/astroroast/api/karta?c=${encodeURIComponent(code)}&k=${kind}&f=${format}&v=${version}`;
}
