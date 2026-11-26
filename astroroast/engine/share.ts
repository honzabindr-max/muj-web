import {
  SIGN_IDS,
  TOPIC_IDS,
  type Level,
  type RoastInput,
  type SignId,
  type Target,
  type Topic,
} from "../types";
import { COUPLE_MAX_LEVEL } from "./couple";
import { FRIEND_MAX_LEVEL, normalizeInput } from "./roast";

// Formát sdíleného kódu (verze 1), vždy 9 URL-bezpečných znaků:
//   [verze "1"] [7 znaků base64url = 42 bitů dat] [1 kontrolní znak]
// Data roastu:  ((((sign*8 + level)*8 + topic)*2 + target) * 2^31) + seed
// Data páru:    (((a*12 + b)*3 + (level-1)) * 2^31) + seed
// Kontrolní znak chrání před překlepy a zároveň odlišuje roast kód od kódu páru.
// V kódu NENÍ žádné datum narození: jen znamení, úroveň, téma, cíl a seed.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const VERSION = "1";
const DATA_CHARS = 7;
const SEED_SPAN = 2 ** 31;
const SALT_ROAST = 17;
const SALT_COUPLE = 41;

function toChars(value: number): string {
  let v = value;
  let out = "";
  for (let i = 0; i < DATA_CHARS; i++) {
    out = ALPHABET[v % 64] + out;
    v = Math.floor(v / 64);
  }
  return out;
}

function fromChars(chars: string): number | null {
  let v = 0;
  for (const c of chars) {
    const idx = ALPHABET.indexOf(c);
    if (idx < 0) return null;
    v = v * 64 + idx;
  }
  return v;
}

function checksum(data: string, salt: number): string {
  let sum = salt;
  for (let i = 0; i < data.length; i++) sum += (ALPHABET.indexOf(data[i]) + 1) * (i + 3);
  return ALPHABET[sum % 64];
}

function seal(value: number, salt: number): string {
  const data = toChars(value);
  return VERSION + data + checksum(data, salt);
}

function open(code: unknown, salt: number): number | null {
  if (typeof code !== "string" || code.length !== DATA_CHARS + 2) return null;
  if (code[0] !== VERSION) return null;
  const data = code.slice(1, 1 + DATA_CHARS);
  if (checksum(data, salt) !== code[code.length - 1]) return null;
  return fromChars(data);
}

/** Kód roastu. Level kamaráda se před zakódováním ořízne na 3 (kód tedy vždy projde dekódováním). */
export function encodeShare(input: RoastInput): string {
  const n = normalizeInput(input);
  const sign = SIGN_IDS.indexOf(n.sign);
  const topic = TOPIC_IDS.indexOf(n.topic);
  const target = n.target === "friend" ? 1 : 0;
  const meta = ((sign * 8 + n.level) * 8 + topic) * 2 + target;
  return seal(meta * SEED_SPAN + n.seed, SALT_ROAST);
}

/** Dekóduje kód roastu. Cokoli neplatné vrací null (nikdy nevyhazuje). */
export function decodeShare(code: string): RoastInput | null {
  const value = open(code, SALT_ROAST);
  if (value === null) return null;
  const seed = value % SEED_SPAN;
  let meta = Math.floor(value / SEED_SPAN);
  const target: Target = meta % 2 === 1 ? "friend" : "self";
  meta = Math.floor(meta / 2);
  const topicIdx = meta % 8;
  meta = Math.floor(meta / 8);
  const level = meta % 8;
  const signIdx = Math.floor(meta / 8);
  if (signIdx >= SIGN_IDS.length || topicIdx >= TOPIC_IDS.length) return null;
  if (level < 1 || level > 5) return null;
  if (target === "friend" && level > FRIEND_MAX_LEVEL) return null;
  const sign: SignId = SIGN_IDS[signIdx];
  const topic: Topic = TOPIC_IDS[topicIdx];
  return { sign, level: level as Level, topic, target, seed };
}

export interface CoupleCodeData {
  a: SignId;
  b: SignId;
  level: Level;
  seed: number;
}

/** Kód páru. Level se ořízne na 3, seed se zúží do rozsahu 0..2^31-1. */
export function encodeCouple(a: SignId, b: SignId, level: number, seed: number): string {
  const ai = SIGN_IDS.indexOf(a);
  const bi = SIGN_IDS.indexOf(b);
  if (ai < 0 || bi < 0) throw new RangeError("Neznámé znamení");
  const lv = Math.min(Math.max(Math.floor(level) || 1, 1), COUPLE_MAX_LEVEL);
  const sd = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) % SEED_SPAN : 0;
  const meta = (ai * 12 + bi) * 3 + (lv - 1);
  return seal(meta * SEED_SPAN + sd, SALT_COUPLE);
}

/** Dekóduje kód páru, neplatné vrací null. */
export function decodeCouple(code: string): CoupleCodeData | null {
  const value = open(code, SALT_COUPLE);
  if (value === null) return null;
  const seed = value % SEED_SPAN;
  let meta = Math.floor(value / SEED_SPAN);
  const lv = (meta % 3) + 1;
  meta = Math.floor(meta / 3);
  const bi = meta % 12;
  const ai = Math.floor(meta / 12);
  if (ai >= SIGN_IDS.length) return null;
  return { a: SIGN_IDS[ai], b: SIGN_IDS[bi], level: lv as Level, seed };
}
