import type { Metadata } from "next";
import { CoupleGenerator } from "../_components/CoupleGenerator";
import { CrossSell } from "../_components/CrossSell";
import { OG_DEFAULT_IMAGE } from "../_lib/helpers";

export const metadata: Metadata = {
  title: "Astro Battle: roast pro dva",
  description:
    "Dvě znamení, jedna hádka. Hvězdy napíšou scénu a vymyslí kosmickou kompatibilitu. Oba dostanou stejně. Zdarma, bez registrace.",
  alternates: { canonical: "/astroroast/par" },
  openGraph: {
    title: "Astro Battle: dvě znamení, jedna hádka",
    description: "Hvězdy napíšou scénu pro dva a vymyslí kosmickou kompatibilitu.",
    url: "/astroroast/par",
    images: [OG_DEFAULT_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Astro Battle: dvě znamení, jedna hádka",
    description: "Hvězdy napíšou scénu pro dva a vymyslí kosmickou kompatibilitu.",
    images: [OG_DEFAULT_IMAGE.url],
  },
};

export default function CouplePage() {
  return (
    <>
      <section className="ar-hero">
        <div className="ar-wrap">
          <p className="ar-badge ar-badge-lime">
            <span aria-hidden="true">⚔️</span> Astro Battle
          </p>
          <h1 className="ar-h1">
            Dvě znamení. <span className="ar-h1-hot">Jedna hádka.</span>
          </h1>
          <p className="ar-lead">
            Zadej sebe a toho druhého (partner, kámoš, kolega, soused s vrtačkou). Hvězdy napíšou scénu,
            ve které oba dostanou úplně stejně.
          </p>
          <CoupleGenerator />
        </div>
      </section>

      <section className="ar-section">
        <div className="ar-wrap ar-narrow">
          <CrossSell />
        </div>
      </section>
    </>
  );
}
