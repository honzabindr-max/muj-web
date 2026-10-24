import type { Metadata, Viewport } from "next";
import { garamond, jost } from "./fonts";
import "./mezi-vami.css";

// Prototyp: vše pod /mezi-vami je mimo indexaci a mimo navigaci zbytku webu.
export const metadata: Metadata = {
  title: "MEZI VÁMI",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0D090E",
};

export default function MeziVamiLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${garamond.variable} ${jost.variable}`}>{children}</div>;
}
