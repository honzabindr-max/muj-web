import { SIGN_IDS, type SignId, type SignResolution } from "../types";
import { SIGNS } from "./signs";

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // únor 29: roky nevíme, přijímáme obojí

function toKey(month: number, day: number): number {
  return month * 100 + day;
}

function parse(mmdd: string): number {
  const [m, d] = mmdd.split("-").map(Number);
  return toKey(m, d);
}

/** Je klíč MMDD uvnitř (inkluzivního) rozsahu znamení? Kozoroh přetéká přes konec roku. */
function inRange(key: number, from: number, to: number): boolean {
  return from <= to ? key >= from && key <= to : key >= from || key <= to;
}

/**
 * Určí znamení podle měsíce a dne (rok se nezadává ani neukládá).
 *
 * Cusp (`cuspWith`): data okolo hranice se každý rok mírně liší, proto se na poslední a první den
 * každého znamení vrací i sousední znamení, aby UI mohlo nechat uživatele potvrdit. Příklad:
 * 20. 3. = Ryby, cuspWith Beran; 21. 3. = Beran, cuspWith Ryby.
 *
 * Neplatné datum (měsíc mimo 1-12, den mimo měsíc, nečíslo) vyhodí RangeError.
 */
export function resolveSign(month: number, day: number): SignResolution {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12) {
    throw new RangeError(`Neplatné datum: ${month}-${day}`);
  }
  if (day < 1 || day > DAYS_IN_MONTH[month - 1]) {
    throw new RangeError(`Neplatné datum: ${month}-${day}`);
  }
  const key = toKey(month, day);
  for (let i = 0; i < SIGN_IDS.length; i++) {
    const id = SIGN_IDS[i];
    const info = SIGNS[id];
    const from = parse(info.from);
    const to = parse(info.to);
    if (!inRange(key, from, to)) continue;
    const prev: SignId = SIGN_IDS[(i + 11) % 12];
    const next: SignId = SIGN_IDS[(i + 1) % 12];
    if (key === from) return { sign: id, cuspWith: prev };
    if (key === to) return { sign: id, cuspWith: next };
    return { sign: id };
  }
  // Rozsahy pokrývají celý rok; sem se nikdy nedostaneme.
  throw new RangeError(`Datum bez znamení: ${month}-${day}`);
}
