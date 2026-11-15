"use client";

import { usePathname } from "next/navigation";

// Google Fonts pro ostatní části webu. Segment /mezi-vami má vlastní self-hostované fonty
// (viz mezi-vami/fonts.ts) a třetí stranu nenačítá (soulad/IP návštěvníka, žádný blokující request).
export function FontLinks() {
  const pathname = usePathname() ?? "";
  if (pathname === "/mezi-vami" || pathname.startsWith("/mezi-vami/")) return null;
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=Source+Serif+4:wght@500;600;700&family=Atkinson+Hyperlegible+Next:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
    </>
  );
}
