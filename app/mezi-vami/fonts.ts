import { EB_Garamond, Jost } from "next/font/google";

export const garamond = EB_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-mv-garamond",
  display: "swap",
});

export const jost = Jost({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500"],
  variable: "--font-mv-jost",
  display: "swap",
});
