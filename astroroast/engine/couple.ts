import { SIGN_IDS, type CoupleRoast, type Element, type Level, type SignId } from "../types";
import {
  COMPAT_BASE,
  COUPLE_OUTROS,
  COUPLE_PAIRS,
  COUPLE_SITUATIONS,
  FRAGMENTS,
  STEJNE_ECHO,
  type ElementPairKey,
} from "../content/fragments";
import { hashString, mixSeed, mulberry32, pick, pickN, randInt, shuffle } from "./rng";
import { normalizeSeed } from "./roast";
import { SIGNS } from "./signs";

/** Páry smí nejvýš úroveň 3 (oba jsou cílem roastu). */
export const COUPLE_MAX_LEVEL = 3;

const ELEMENT_ORDER: Element[] = ["ohen", "zeme", "vzduch", "voda"];

/** Klíč dvojice živlů v pevném pořadí (ohen < zeme < vzduch < voda), "stejne" pro dvě stejná znamení. */
export function pairKey(a: SignId, b: SignId): ElementPairKey {
  if (a === b) return "stejne";
  const [x, y] = [SIGNS[a].element, SIGNS[b].element].sort(
    (p, q) => ELEMENT_ORDER.indexOf(p) - ELEMENT_ORDER.indexOf(q),
  );
  return `${x}-${y}` as ElementPairKey;
}

export function capCoupleLevel(level: number): Level {
  if (!Number.isInteger(level) || level < 1) return 1;
  return Math.min(level, COUPLE_MAX_LEVEL) as Level;
}

/**
 * Deterministická "Astro Battle" scéna. Obě znamení dostanou stejně replik i stejně pálivé zásahy:
 * každou situaci (otázku vypráví narrator) zodpoví nejdřív jedno a potom druhé znamení, v druhé situaci
 * v opačném pořadí. Úroveň se ořízne na 3. Kompatibilita je záměrně vymyšlená a závisí na živlech.
 */
export function generateCouple(a: SignId, b: SignId, level: number, seed: number): CoupleRoast {
  if (!(SIGN_IDS as readonly string[]).includes(a) || !(SIGN_IDS as readonly string[]).includes(b)) {
    throw new RangeError("Neznámé znamení");
  }
  const lv = capCoupleLevel(level);
  const sd = normalizeSeed(seed);
  const rng = mulberry32(mixSeed(sd, hashString(`${a}|${b}|${lv}|couple`)));
  const key = pairKey(a, b);
  const content = COUPLE_PAIRS[key];
  const fa = FRAGMENTS[a];
  const fb = FRAGMENTS[b];

  const rounds = randInt(rng, 1, 2); // scéna má 5 nebo 8 replik
  const situations = pickN(
    rng,
    COUPLE_SITUATIONS.map((_, i) => i),
    rounds,
  );

  const echoes = a === b ? shuffle(rng, STEJNE_ECHO) : [];

  const scene: CoupleRoast["scene"] = [{ who: "narrator", text: pick(rng, content.intros) }];
  situations.forEach((idx, round) => {
    scene.push({ who: "narrator", text: COUPLE_SITUATIONS[idx] });
    const first = round % 2 === 0 ? "a" : "b";
    const second = first === "a" ? "b" : "a";
    const text = (who: "a" | "b") => (who === "a" ? fa.couple[idx] : fb.couple[idx]);
    scene.push({ who: first, text: text(first) });
    // Dvě stejná znamení by odpověděla slovo od slova stejně. Druhý mluvčí proto jen krátce zareaguje.
    scene.push({ who: second, text: a === b ? echoes[round % echoes.length] : text(second) });
  });
  scene.push({ who: "narrator", text: pick(rng, COUPLE_OUTROS[lv as 1 | 2 | 3]) });

  const compatibility = Math.max(
    0,
    Math.min(100, COMPAT_BASE[key] + randInt(rng, -14, 14)),
  );

  return {
    a,
    b,
    level: lv,
    seed: sd,
    title: `${SIGNS[a].name} × ${SIGNS[b].name}: ${pick(rng, content.titles)}`,
    scene,
    compatibility,
    verdict: pick(rng, content.verdicts),
  };
}
