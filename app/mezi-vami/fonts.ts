import localFont from "next/font/local";

// Fonty jsou v repu (OFL, viz fonts/OFL.txt), aby build nezávisel na síti.
// Variabilní WOFF2: osa wght omezena na 400–500 (jediné používané váhy), znaková sada latin +
// latin-ext (Ext-A: č ř ů ě …) + typografické znaky, bez hintingu. Kurzíva se nepoužívá.
export const garamond = localFont({
  src: [
    { path: "./fonts/EBGaramond.woff2", weight: "400 500", style: "normal" },
  ],
  variable: "--font-mv-garamond",
  display: "swap",
});

export const jost = localFont({
  src: [{ path: "./fonts/Jost.woff2", weight: "400 500", style: "normal" }],
  variable: "--font-mv-jost",
  display: "swap",
});
