// Sdílené tokeny a pomocné funkce pro karty (satori: jen inline styly).
import type { Level, SignId } from "@/astroroast/types";

export const C = {
  space: "#0B0420",
  space2: "#1A0B3D",
  pink: "#FF2E88",
  lime: "#C6FF3D",
  violet: "#7B5CFF",
  cream: "#FFF6E9",
  red: "#FF4B2B",
  flame: "#FF9F1C",
} as const;

export const FONT = "Jost";

/** Akcentní barva podle úrovně pálivosti. */
export const LEVEL_ACCENT: Record<Level, string> = {
  1: C.lime,
  2: C.violet,
  3: C.pink,
  4: C.red,
  5: C.flame,
};

/** České názvy znamení (nominativ), aby karty nezávisely na enginu. */
export const SIGN_NAME: Record<SignId, string> = {
  beran: "Beran",
  byk: "Býk",
  blizenci: "Blíženci",
  rak: "Rak",
  lev: "Lev",
  panna: "Panna",
  vahy: "Váhy",
  stir: "Štír",
  strelec: "Střelec",
  kozoroh: "Kozoroh",
  vodnar: "Vodnář",
  ryby: "Ryby",
};

export const FOOTER_TEXT = "AstroRoast.ai · good-inventions.work/astroroast · Zábava, ne předpověď";

/** Jost má jen řez 400: tučnost dokreslíme malým obtažením stejnou barvou. */
export function bold(color: string, px: number, extra?: string): string {
  const base = [
    `${px}px 0 0 ${color}`,
    `-${px}px 0 0 ${color}`,
    `0 ${px}px 0 ${color}`,
    `0 -${px}px 0 ${color}`,
  ].join(", ");
  return extra ? `${base}, ${extra}` : base;
}

/** Zkrátí text na celých slovech, aby se karta nepřelila. */
export function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

/** Velikost písma podle délky textu (px, pro dané měřítko). */
export function fit(len: number, steps: [number, number][], fallback: number): number {
  for (const [max, size] of steps) if (len <= max) return size;
  return fallback;
}

export const GRAIN_BG =
  `radial-gradient(900px 700px at 85% 8%, rgba(123,92,255,0.45), rgba(123,92,255,0) 70%), ` +
  `radial-gradient(800px 700px at 8% 92%, rgba(255,46,136,0.32), rgba(255,46,136,0) 70%), ${C.space}`;
