// AstroRoast.ai: shared contract. Engine, content and UI all import from here.
// Do not change these signatures without updating every consumer.

export const SIGN_IDS = [
  "beran", "byk", "blizenci", "rak", "lev", "panna",
  "vahy", "stir", "strelec", "kozoroh", "vodnar", "ryby",
] as const;
export type SignId = (typeof SIGN_IDS)[number];

export type Element = "ohen" | "zeme" | "vzduch" | "voda";

/** Which language model wrote the texts. Internal comparison tool: see MODEL_TOGGLE_ENABLED in copy/index.ts. */
export const MODEL_IDS = ["claude", "codex", "skills"] as const;
export type ModelId = (typeof MODEL_IDS)[number];
export const DEFAULT_MODEL: ModelId = "claude";
/**
 * Kdo texty skutečně napsal (model + reasoning effort), ověřeno z přepisů agentů a hlaviček `codex exec`.
 * id (claude/codex/skills) zůstává kvůli ?m= a localStorage, mění se jen popisky.
 */
export const MODEL_LABELS: Record<ModelId, { name: string; effort: string; detail: string }> = {
  claude: {
    name: "Sonnet 5.5",
    effort: "high + medium",
    detail: "claude-sonnet-5-5: UI texty a katalog effort high (MVP), roasty po rozšíření humoru effort medium",
  },
  codex: {
    name: "GPT-6.1-sol",
    effort: "xhigh",
    detail: "Codex CLI 0.166.0, model gpt-6.1-sol, reasoning effort xhigh",
  },
  skills: {
    name: "Sonnet 5.5",
    effort: "high + skills",
    detail: "claude-sonnet-5-5 effort high se skilly cesky-humor, humanizer-czech, anti-slop-writing, copywriting 2.3.6",
  },
};

/** Per-sign texts that differ per model (content/<model>/signinfo.ts). */
export interface SignText {
  /** One-line comedic tagline for the sign page / card */
  tagline: string;
  /** 3–5 stereotype traits used as humor motifs */
  motifs: string[];
}

/** Model-independent sign data. The texts (tagline, motifs) come from signText(sign, model). */
export interface SignInfo {
  id: SignId;
  /** Czech name, nominative: "Vodnář" */
  name: string;
  /** Plural nominative for "Sejde se deset ___": "Vodnářů" (genitive plural) */
  namePluralGen: string;
  glyph: string; // ♒
  emoji: string; // 🫗 – fun emoji, not the glyph
  element: Element;
  /** Inclusive date range, "MM-DD" */
  from: string;
  to: string;
}

/** 1 Pohlazení · 2 Šťouchnutí · 3 Sarkasmus · 4 Roast · 5 Kosmická poprava */
export type Level = 1 | 2 | 3 | 4 | 5;
export const LEVEL_NAMES: Record<Level, string> = {
  1: "Pohlazení",
  2: "Šťouchnutí",
  3: "Sarkasmus",
  4: "Roast",
  5: "Kosmická poprava",
};

export const TOPIC_IDS = ["vztahy", "prace", "zivot", "pratele", "narozeniny"] as const;
export type Topic = (typeof TOPIC_IDS)[number];

/** Who the roast targets. "friend" mode caps level at 3 (consent rule from spec). */
export type Target = "self" | "friend";

export interface SignResolution {
  sign: SignId;
  /** Set when the date sits within 1 day of a sign boundary: UI asks the user to confirm. */
  cuspWith?: SignId;
}

export interface RoastInput {
  sign: SignId;
  level: Level;
  topic: Topic;
  target: Target;
  /** Deterministic variety. Same input + seed = same roast. 0..2^31-1 */
  seed: number;
  /** Which model's texts to use. Default "claude". Never encoded into share codes. */
  model?: ModelId;
}

export interface Roast {
  input: RoastInput;
  /** Big headline punch, max ~90 chars */
  headline: string;
  /** 3–4 short punchlines, each max ~160 chars */
  lines: string[];
  /** Fake "cosmic stats" for the card, e.g. { label: "Dokončené projekty", value: "3 %" } */
  stats: { label: string; value: string }[];
  /** Closing zinger / advice, max ~120 chars */
  verdict: string;
  /** Integer 0–100, burn meter on the card */
  burn: number;
}

export interface CoupleRoast {
  a: SignId;
  b: SignId;
  level: Level; // capped at 3 for couples (both people are targets)
  seed: number;
  title: string; // "Lev × Panna: ..."
  /** Short comedic dialogue scene, 4–8 lines; both people take equal hits */
  scene: { who: "a" | "b" | "narrator"; text: string }[];
  compatibility: number; // 0–100 "kosmická kompatibilita" (obviously fake)
  verdict: string;
  model?: ModelId;
}

export interface CatalogJoke {
  id: string; // stable, e.g. "vodnar-sejde-se-1"
  sign: SignId;
  series: "sejde-se" | "dovolena" | "zprava" | "rika-vs-mysli" | "one-liner";
  text: string;
}

// Engine API (implemented in astroroast/engine/*):
//   resolveSign(month: number, day: number): SignResolution
//   generateRoast(input: RoastInput): Roast               (input.model ?? "claude")
//   generateCouple(a, b, level, seed, model = "claude"): CoupleRoast
//   dailyRoast(sign, isoDate, model = "claude"): string
//   signText(sign, model): SignText
//   encodeShare(input: RoastInput): string  // short url-safe code, NO birth date
//   decodeShare(code: string): RoastInput | null
//   encodeCouple / decodeCouple: same for couples
