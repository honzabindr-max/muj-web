import { ImageResponse } from "next/og";
import { BrandCard, cardFonts } from "@/astroroast/card";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AstroRoast.ai – Hvězdy tě nešetří.";

export default async function Image() {
  return new ImageResponse(<BrandCard />, { ...size, fonts: await cardFonts() });
}
