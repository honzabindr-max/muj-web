import type { Metadata, Viewport } from "next";
import { garamond, jost } from "./fonts";
import "./tokens.css";
import "./mezi-vami.css";
import "./design-a.css";
import { SkipLink } from "./_lib/SkipLink";

// Prototyp: vše pod /mezi-vami je mimo indexaci a mimo navigaci zbytku webu.
// Popis = podnadpis hero landingu (COPY_SYSTEM_V1 v3.2, L1 Hero). Titulek stránek:
// „<název obrazovky z plátna> — MEZI VÁMI“ (šablona; stránky dávají jen název obrazovky).
export const metadata: Metadata = {
  title: { default: "MEZI VÁMI", template: "%s — MEZI VÁMI" },
  description:
    "Vztahová DNA pro vás dva. První pohled na váš vztah z údajů o narození obou lidí.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0D090E",
};

export default function MeziVamiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div lang="cs" className={`${garamond.variable} ${jost.variable}`}>
      <SkipLink />
      {children}
    </div>
  );
}
