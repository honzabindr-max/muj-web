import { ImageResponse } from "next/og";
import { OgImage, cardFonts } from "@/mezi-vami/card-image";
import { loadResult } from "@/mezi-vami/result";
import { FIXTURE_VIEW } from "../../_v/view-data";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Vztahová DNA – MEZI VÁMI";

// OG náhled sdíleného odkazu: hlavní téma bez jmen.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadResult(id).catch(() => null);
  const v = r?.state === "ready" ? r.view : FIXTURE_VIEW;
  return new ImageResponse(
    <OgImage tema={v.pair.mainTheme.title} veta={v.pair.mainTheme.line.replace(/\{[AB]\d\}/g, "")} vazby={v.vazby} />,
    { ...size, fonts: await cardFonts() },
  );
}
