// Fonty pro next/og (satori umí jen TTF, ne woff2). Jost je OFL, kopie leží v astroroast/fonts/,
// aby ji Vercel zabalil k funkci. Žádné stahování za běhu. Jost je jen v řezu 400:
// tučnost se na kartách dokresluje textShadow (viz theme.ts, bold()).

import { readFile } from "node:fs/promises";
import path from "node:path";

const dir = path.join(process.cwd(), "astroroast", "fonts");

let cache: Promise<Buffer> | null = null;

export async function cardFonts() {
  // Odmítnutý promise se nesmí držet navždy: po chybě se příští volání zkusí znovu.
  cache ??= readFile(path.join(dir, "Jost.ttf")).catch((e) => {
    cache = null;
    throw e;
  });
  const data = await cache;
  return [{ name: "Jost", data, style: "normal" as const, weight: 400 as const }];
}
