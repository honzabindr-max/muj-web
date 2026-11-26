import { ImageResponse } from "next/og";
import { decodeShare, generateRoast } from "@/astroroast/engine";
import { BrandCard, RoastCard, cardFonts } from "@/astroroast/card";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AstroRoast.ai – hvězdy mě právě roastnuly";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const input = decodeShare(code);
  const fonts = await cardFonts();
  if (!input) return new ImageResponse(<BrandCard />, { ...size, fonts });
  return new ImageResponse(<RoastCard roast={generateRoast(input)} format="og" />, { ...size, fonts });
}
