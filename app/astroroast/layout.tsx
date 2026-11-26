import type { Metadata, Viewport } from "next";
// Fonty self-hostované přes @fontsource (OFL): build nezávisí na síti (next/font/google padal v CI).
import "@fontsource/bricolage-grotesque/latin-800.css";
import "@fontsource/bricolage-grotesque/latin-ext-800.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-ext-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-ext-500.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/dm-sans/latin-ext-700.css";
import { Analytics } from "@vercel/analytics/next";
import "./astroroast.css";
import { SiteHeader } from "./_components/SiteHeader";
import { SiteFooter } from "./_components/SiteFooter";
import { OG_DEFAULT_IMAGE } from "./_lib/helpers";

const DESCRIPTION =
  "Vtipný roast podle znamení zvěrokruhu. Zadej datum narození (zůstane ve tvém prohlížeči), vyber pálivost 1 až 5 a hvězdy tě nešetří. Zdarma, bez registrace.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.good-inventions.work"),
  title: {
    default: "AstroRoast.ai · Hvězdy tě nešetří",
    template: "%s · AstroRoast.ai",
  },
  description: DESCRIPTION,
  applicationName: "AstroRoast.ai",
  keywords: [
    "horoskop",
    "vtipný horoskop",
    "roast",
    "znamení zvěrokruhu",
    "astrologie",
    "denní horoskop",
    "AstroRoast",
  ],
  openGraph: {
    type: "website",
    locale: "cs_CZ",
    siteName: "AstroRoast.ai",
    title: "AstroRoast.ai · Hvězdy tě nešetří",
    description: DESCRIPTION,
    images: [OG_DEFAULT_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "AstroRoast.ai · Hvězdy tě nešetří",
    description: DESCRIPTION,
    images: [OG_DEFAULT_IMAGE.url],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0420",
  width: "device-width",
  initialScale: 1,
};

export default function AstroRoastLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ar">
      <a className="ar-skip" href="#obsah">
        Přeskočit na obsah
      </a>
      <div className="ar-sky" aria-hidden="true" />
      <SiteHeader />
      <main id="obsah" className="ar-main">
        {children}
      </main>
      <SiteFooter />
      <Analytics />
    </div>
  );
}
