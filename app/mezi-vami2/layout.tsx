import type { Metadata, Viewport } from "next";
// Fonty a základní styly sdílíme importem z originálu (beze změny originálu).
import { garamond, jost } from "../mezi-vami/fonts";
import "../mezi-vami/mezi-vami.css";
import "./mezi-vami2.css";

// v2 varianta: mimo indexaci, bez odkazu odkudkoli z webu.
export const metadata: Metadata = {
  title: "MEZI VÁMI",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#0D090E",
};

export default function MeziVami2Layout({ children }: { children: React.ReactNode }) {
  // data-variant="v2": značka pro budoucí analytics, ať se data variant nemíchají.
  return (
    <div className={`${garamond.variable} ${jost.variable} mv2`} data-variant="v2">
      {children}
    </div>
  );
}
