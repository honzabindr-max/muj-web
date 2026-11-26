import { SIGN_IDS, type SignId } from "../types";
import { FRAGMENTS } from "../content/fragments";
import { hashString } from "./rng";

/** Pool denních jednovětek znamení: 12 psaných na míru + hlavičky úrovní 2-3. Pálivé hlášky (4-5) do denního roastu nepatří. */
export function dailyPool(sign: SignId): string[] {
  const f = FRAGMENTS[sign];
  return [...f.daily, ...f.headlines[2], ...f.headlines[3]];
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
export function dailyRoast(sign: SignId, isoDate: string): string {
  if (!(SIGN_IDS as readonly string[]).includes(sign)) throw new RangeError("Neznámé znamení");
  const pool = dailyPool(sign);
  const n = pool.length;
  const day = dayNumber(isoDate);
  const stride = [7, 11, 13, 17, 19, 23, 29].find((s) => gcd(s, n) === 1) ?? 1;
  const offset = hashString(sign) % n;
  return pool[(((offset + day * stride) % n) + n) % n];
}
