import { ImageResponse } from "next/og";
import { OgImage, cardFonts } from "@/mezi-vami/card-image";
import { VAZBY } from "./_data/fixtures";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "MEZI VÁMI – Vztahová DNA";

export default async function Image() {
  return new ImageResponse(
    <OgImage tema="Co se odehrává mezi vámi?" veta="Vztahová DNA pro vás dva. Zdarma, bez e-mailu." vazby={VAZBY} />,
    { ...size, fonts: await cardFonts() },
  );
}
