// GET /astroroast/api/karta?c=<code>&k=roast|couple&f=story|og[&v=<verze>] → PNG sdílecí karta.
// Kód nese jen znamení + úroveň + téma + seed (žádné datum narození). Výstup je deterministický.
// Ochrana proti zneužití: povolené jen parametry c, k, f, v a jen známé hodnoty (jinak 400), takže se
// stejná karta nedá renderovat pod nekonečně mnoha různými URL. Cache je krátká na prohlížeči a dlouhá na CDN
// s revalidací, aby změna obsahu nezůstala zamrzlá rok.
import { ImageResponse } from "next/og";
import { decodeCouple, decodeShare, generateCouple, generateRoast } from "@/astroroast/engine";
import { BrandCard, CARD_SIZE, CoupleCard, RoastCard, cardFonts, type CardFormat } from "@/astroroast/card";

export const runtime = "nodejs";

const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const ALLOWED_KEYS = new Set(["c", "k", "f", "v"]);

function plain(msg: string, status: number, cache = "public, max-age=60") {
  return new Response(msg, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": cache } });
}

const bad = (msg: string) => plain(msg, 400);

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  for (const key of sp.keys()) {
    if (!ALLOWED_KEYS.has(key)) return bad("Neznámý parametr.");
  }
  if (sp.getAll("c").length !== 1 || sp.getAll("k").length > 1 || sp.getAll("f").length > 1 || sp.getAll("v").length > 1) {
    return bad("Neplatné parametry.");
  }
  const k = sp.get("k");
  const f = sp.get("f");
  const v = sp.get("v");
  if (k !== null && k !== "roast" && k !== "couple") return bad("Neplatný typ karty.");
  if (f !== null && f !== "story" && f !== "og") return bad("Neplatný formát karty.");
  if (v !== null && !/^[0-9]{1,2}$/.test(v)) return bad("Neplatná verze.");

  const code = sp.get("c") ?? "";
  const kind = k === "couple" ? "couple" : "roast";
  const format: CardFormat = f === "og" ? "og" : "story";

  if (!code || code.length > 64 || !/^[A-Za-z0-9_-]+$/.test(code)) return bad("Neplatný kód karty.");

  let element;
  if (kind === "couple") {
    const c = decodeCouple(code);
    if (!c) return bad("Neplatný kód karty.");
    element = <CoupleCard couple={generateCouple(c.a, c.b, c.level, c.seed)} format={format} />;
  } else {
    const input = decodeShare(code);
    if (!input) return bad("Neplatný kód karty.");
    element = <RoastCard roast={generateRoast(input)} format={format} />;
  }

  const brand = <BrandCard />;
  try {
    return new ImageResponse(element, {
      ...CARD_SIZE[format],
      fonts: await cardFonts(),
      headers: { "cache-control": CACHE },
    });
  } catch {
    try {
      return new ImageResponse(brand, {
        ...CARD_SIZE.og,
        fonts: await cardFonts(),
        headers: { "cache-control": "public, max-age=60" },
      });
    } catch {
      return plain("Kartu se nepodařilo vykreslit.", 500, "no-store");
    }
  }
}
