import localFont from "next/font/local";

// Fonty jsou v repu (OFL, viz fonts/OFL.txt), aby build nezávisel na síti.
// Variabilní WOFF2 subsetované na latin + latin-ext (osa wght zachována);
// rozsahy vah odpovídají dřívějším řezům z next/font/google.
export const garamond = localFont({
  src: [
    { path: "./fonts/EBGaramond.woff2", weight: "400 500", style: "normal" },
    {
      path: "./fonts/EBGaramond-Italic.woff2",
      weight: "400 500",
      style: "italic",
    },
  ],
  variable: "--font-mv-garamond",
  display: "swap",
});

export const jost = localFont({
  src: [{ path: "./fonts/Jost.woff2", weight: "400 500", style: "normal" }],
  variable: "--font-mv-jost",
  display: "swap",
});
