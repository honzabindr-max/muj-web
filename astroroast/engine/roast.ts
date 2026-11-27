import {
  DEFAULT_MODEL,
  SIGN_IDS,
  TOPIC_IDS,
  type Level,
  type Roast,
  type RoastInput,
} from "../types";
import { CONTENT } from "../content";
import { hashString, mixSeed, mulberry32, pick, pickN, randInt, shuffle } from "./rng";

const MAX_SEED = 0x7fffffff;

/** Střed pálivosti podle úrovně. Pásma se nepřekrývají, takže vyšší úroveň je vždy pálivější. */
const BURN_BASE: Record<Level, number> = { 1: 19, 2: 39, 3: 59, 4: 79, 5: 94 };

/** Kamarád smí nejvýš úroveň 3 (pravidlo souhlasu ze specifikace). */
export const FRIEND_MAX_LEVEL: Level = 3;

export function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 0;
  return Math.abs(Math.floor(seed)) % (MAX_SEED + 1);
}

/** Zvaliduje vstup a vrátí jeho kanonickou podobu (level kamaráda ořezaný na 3, seed v rozsahu). */
export function normalizeInput(input: RoastInput): RoastInput {
  if (!input || !(SIGN_IDS as readonly string[]).includes(input.sign)) {
    throw new RangeError("Neznámé znamení");
  }
  if (!(TOPIC_IDS as readonly string[]).includes(input.topic)) {
    throw new RangeError("Neznámé téma");
  }
  if (input.target !== "self" && input.target !== "friend") {
    throw new RangeError("Neznámý cíl");
  }
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > 5) {
    throw new RangeError("Úroveň musí být 1 až 5");
  }
  const level = (
    input.target === "friend" ? Math.min(input.level, FRIEND_MAX_LEVEL) : input.level
  ) as Level;
  return { ...input, level, seed: normalizeSeed(input.seed) };
}

/**
 * Deterministický roast. Skládá hotové, ručně psané věty (žádné skloňování):
 *   headline = jedna z hlaviček znamení pro danou úroveň
 *   lines    = [core znamení, 2x situace podle tématu a úrovně (t[téma][úroveň]), závěrečná věta (u kamaráda přátelská)]
 *   stats    = 1 statistika podle tématu + 1-2 podle znamení
 *   verdict  = jedna z hlášek znamení pro danou úroveň
 * Kamarád: úroveň se ořízne na 3, v `input` se vrací už ořezaná.
 */
export function generateRoast(rawInput: RoastInput): Roast {
  const input = normalizeInput(rawInput);
  const { sign, level, topic, target, seed } = input;
  const content = CONTENT[rawInput.model ?? DEFAULT_MODEL];
  const frag = content.fragments[sign];
  const rng = mulberry32(mixSeed(seed, hashString(`${sign}|${level}|${topic}|${target}`)));

  const headline = pick(rng, frag.headlines[level]);
  const core = pick(rng, frag.core[level]);
  const [topicA, topicB] = pickN(rng, frag.topic[topic][level], 2);
  const kicker =
    target === "friend"
      ? pick(rng, content.friendKickers[level as 1 | 2 | 3])
      : pick(rng, content.kickers[topic][level - 1]);
  const lines = [core, topicA, topicB, kicker];

  const signStats = pickN(rng, frag.stats, randInt(rng, 1, 2));
  const stats = shuffle(rng, [pick(rng, content.topicStats[topic]), ...signStats]).map((s) => ({
    label: s.label,
    value: s.value,
  }));

  const verdict = pick(rng, frag.verdicts[level]);
  const burn = Math.max(0, Math.min(100, BURN_BASE[level] + randInt(rng, -6, 6)));

  return { input, headline, lines, stats, verdict, burn };
}
