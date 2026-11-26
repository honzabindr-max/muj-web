import { decodeCouple, encodeCouple } from "@/astroroast/engine";
import type { Level, SignId } from "@/astroroast/types";

export interface CoupleInput {
  a: SignId;
  b: SignId;
  level: Level;
  seed: number;
}

/** Tenký adaptér nad engine: jediné místo, které zná tvar encodeCouple/decodeCouple. */
export function coupleCode(input: CoupleInput): string {
  return encodeCouple(input.a, input.b, input.level, input.seed);
}

export function parseCouple(code: string): CoupleInput | null {
  const c = decodeCouple(code);
  return c ? { a: c.a, b: c.b, level: c.level, seed: c.seed } : null;
}
