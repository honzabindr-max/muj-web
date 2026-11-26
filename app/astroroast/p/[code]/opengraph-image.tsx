import { ImageResponse } from "next/og";
import { decodeCouple, generateCouple } from "@/astroroast/engine";
import { BrandCard, CoupleCard, cardFonts } from "@/astroroast/card";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AstroRoast.ai – Astro Battle: kosmická kompatibilita";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const c = decodeCouple(code);
  const fonts = await cardFonts();
  if (!c) return new ImageResponse(<BrandCard />, { ...size, fonts });
  return new ImageResponse(<CoupleCard couple={generateCouple(c.a, c.b, c.level, c.seed)} format="og" />, { ...size, fonts });
}
