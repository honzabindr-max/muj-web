import { DEFAULT_MODEL, SIGN_IDS, type ModelId, type SignId } from "../types";
import { CONTENT } from "../content";
import { hashString } from "./rng";

/** Pool denních jednovětek znamení: jen řádky psané přímo na "dnes" (d), žádné hlavičky úrovní. */
export function dailyPool(sign: SignId, model: ModelId = DEFAULT_MODEL): string[] {
  const f = CONTENT[model].fragments[sign];
  return [...f.daily];
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Dnů od 1970-01-01 pro ISO datum YYYY-MM-DD. Neplatné datum vyhodí RangeError. */
function dayNumber(isoDate: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new RangeError(`Neplatné ISO datum: ${isoDate}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const check = new Date(t);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    throw new RangeError(`Neplatné ISO datum: ${isoDate}`);
  }
  return Math.floor(t / 86_400_000);
}

/**
 * Denní roast: deterministická jednovětka pro znamení a den. Index = (offset + den × krok) mod N,
 * kde krok je nesoudělný s N, takže se hláška neopakuje dřív než za N dní a po sobě jdoucí dny
 * jsou od sebe tematicky daleko. Stejné vstupy = stejný výstup (server i klient ukážou totéž).
 */
export function dailyRoast(sign: SignId, isoDate: string, model: ModelId = DEFAULT_MODEL): string {
  if (!(SIGN_IDS as readonly string[]).includes(sign)) throw new RangeError("Neznámé znamení");
  const pool = dailyPool(sign, model);
  const n = pool.length;
  const day = dayNumber(isoDate);
  const stride = [7, 11, 13, 17, 19, 23, 29].find((s) => gcd(s, n) === 1) ?? 1;
  const offset = hashString(sign) % n;
  return pool[(((offset + day * stride) % n) + n) % n];
}
