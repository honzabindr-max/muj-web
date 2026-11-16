import type { Metadata } from "next";
import "./globals.css";
import { FontLinks } from "./FontLinks";

export const metadata: Metadata = {
  title: "Good Inventions",
  description: "Co Češi hledají na internetu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <head>
        <FontLinks />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
