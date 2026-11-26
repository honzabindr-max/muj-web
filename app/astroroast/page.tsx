import type { Metadata } from "next";
import Link from "next/link";
import { SIGN_LIST, SIGNS, dailyRoast, generateRoast } from "@/astroroast/engine";
import { CATALOG, SERIES_LABELS } from "@/astroroast/content/catalog";
import type { CatalogJoke } from "@/astroroast/types";
import { OG_DEFAULT_IMAGE, formatRange, pragueToday, signOf } from "./_lib/helpers";
import { Generator } from "./_components/Generator";
import { RoastCard } from "./_components/RoastCard";
import { FakeDoors } from "./_components/FakeDoors";

// Denní obsah se mění o půlnoci pražského času, proto krátká revalidace.
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "AstroRoast.ai · Hvězdy tě nešetří | Vtipný roast podle znamení" },
  description:
    "Zadej datum narození, vyber pálivost 1 až 5 a hvězdy tě roastnou. Vtipný horoskop, který chceš poslat kámošům. Zdarma, bez registrace, datum zůstává ve tvém prohlížeči.",
  alternates: { canonical: "/astroroast" },
  openGraph: {
    title: "AstroRoast.ai · Hvězdy tě nešetří",
    description: "Vtipný roast podle znamení. Vyber pálivost 1 až 5. Zdarma, bez registrace.",
    url: "/astroroast",
    images: [OG_DEFAULT_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "AstroRoast.ai · Hvězdy tě nešetří",
    description: "Vtipný roast podle znamení. Vyber pálivost 1 až 5. Zdarma, bez registrace.",
    images: [OG_DEFAULT_IMAGE.url],
  },
};

const TICKER = [
  "Hvězdy tě nešetří",
  "100 % zdarma",
  "Bez registrace",
  "Datum zůstává u tebe",
  "Zábava, ne předpověď",
  "The stars have jokes",
];

const SERIES_ORDER: CatalogJoke["series"][] = ["sejde-se", "dovolena", "zprava", "rika-vs-mysli", "one-liner"];
const SERIES_EMOJI: Record<CatalogJoke["series"], string> = {
  "sejde-se": "👥",
  dovolena: "🏖️",
  zprava: "💬",
  "rika-vs-mysli": "🎭",
  "one-liner": "⚡",
};

const STICKY = ["lime", "pink", "cream", "violet"] as const;

// Ukázka pro desktopový hero (pevný seed → stabilní SSR, žádný hydration mismatch).
const SAMPLE_ROAST = generateRoast({ sign: "vodnar", level: 4, topic: "prace", target: "self", seed: 4242 });
const SAMPLE_NOTES = ["panna", "strelec"].map(
  (id) => CATALOG.find((j) => j.sign === id && j.series === "sejde-se") ?? CATALOG[0],
);

export default function AstroRoastLanding() {
  const today = pragueToday();

  const teasers = SERIES_ORDER.map((series) => {
    const pool = CATALOG.filter((j) => j.series === series);
    return { series, joke: pool.length ? pool[today.dayNumber % pool.length] : null };
  }).filter((t): t is { series: CatalogJoke["series"]; joke: CatalogJoke } => t.joke !== null);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "AstroRoast.ai",
    url: "https://www.good-inventions.work/astroroast",
    applicationCategory: "EntertainmentApplication",
    operatingSystem: "Any",
    inLanguage: "cs",
    description: "Vtipný roast podle znamení zvěrokruhu. Zdarma, bez registrace.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "CZK" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="ar-hero">
        <div className="ar-wrap">
          <span className="ar-deco ar-deco-1" aria-hidden="true">🪐</span>
          <span className="ar-deco ar-deco-2" aria-hidden="true">☄️</span>
          <span className="ar-deco ar-deco-3" aria-hidden="true">🌶️</span>
          <span className="ar-deco ar-deco-4" aria-hidden="true">🔮</span>

          <p className="ar-badge">
            <span aria-hidden="true">🔥</span> Nově · 100 % zdarma · bez registrace
          </p>
          <h1 className="ar-h1">
            Hvězdy tě <span className="ar-h1-hot">nešetří.</span>
          </h1>
          <p className="ar-lead">
            Zadej datum narození, vyber pálivost <span aria-hidden="true">🌶️</span> a nech kosmos říct,
            co si o tobě doopravdy myslí. Pak to pošli kámošům a ať zkusí taky.
          </p>
          <p className="ar-en">The stars have jokes.</p>

          <div className="ar-hero-grid">
            <Generator />
            <aside className="ar-hero-aside" aria-label="Ukázka výsledku">
              <p className="ar-hero-aside-label">
                <span aria-hidden="true">👇</span> Takhle to dopadne
              </p>
              <div className="ar-hero-aside-card">
                <RoastCard roast={SAMPLE_ROAST} sign={SIGNS[SAMPLE_ROAST.input.sign]} />
              </div>
              <ul className="ar-hero-aside-notes">
                {SAMPLE_NOTES.map((j, i) => (
                  <li key={j.id} className={`ar-sticky ar-sticky-${i % 2 ? "pink" : "lime"}`}>
                    {j.text}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </section>

      <div className="ar-ticker" aria-hidden="true">
        <div className="ar-ticker-track">
          {[0, 1].map((k) => (
            <div className="ar-ticker-set" key={k}>
              {TICKER.map((t) => (
                <span key={t + k}>
                  {t} <i>✦</i>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="ar-section" aria-labelledby="ar-how">
        <div className="ar-wrap">
          <h2 id="ar-how" className="ar-h2">Jak to funguje</h2>
          <ol className="ar-steps">
            <li>
              <span className="ar-step-n">1</span>
              <h3>Řekni, kdy ses narodil/a</h3>
              <p>Nebo rovnou vyber znamení. Datum se zpracuje u tebe v prohlížeči a nikam neodejde.</p>
            </li>
            <li>
              <span className="ar-step-n">2</span>
              <h3>Nastav pálivost</h3>
              <p>Od pohlazení po kosmickou popravu. Na kámoše max. Sarkasmus, jen ať zůstanete kámoši.</p>
            </li>
            <li>
              <span className="ar-step-n">3</span>
              <h3>Sdílej a pošli dál</h3>
              <p>Odkaz nebo kartu do story. Kdo ji dostane, bude chtít vlastní. Tak to funguje celý vesmír.</p>
            </li>
          </ol>
        </div>
      </section>

      <section id="denni-roast" className="ar-section" aria-labelledby="ar-daily">
        <div className="ar-wrap">
          <p className="ar-eyebrow">Dnes, {today.label}</p>
          <h2 id="ar-daily" className="ar-h2">Denní roast pro všech 12 znamení</h2>
          <p className="ar-sub">Každý den nový. Najdi to svoje a přepošli tomu, kdo si to zaslouží.</p>
          <ul className="ar-daily">
            {SIGN_LIST.map((s, i) => (
              <li
                key={s.id}
                className={`ar-sticky ar-sticky-${STICKY[i % STICKY.length]}`}
                style={{ ["--r" as string]: `${[-1.6, 1.2, -0.8, 1.8][i % 4]}deg` }}
              >
                <Link href={`/astroroast/znameni/${s.id}`} className="ar-sticky-head">
                  <span className="ar-sticky-glyph" aria-hidden="true">{s.glyph}</span>
                  <span>{s.name}</span>
                </Link>
                <p>{dailyRoast(s.id, today.iso)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ar-section ar-section-band" aria-labelledby="ar-series">
        <div className="ar-wrap">
          <p className="ar-eyebrow">Z archivu hvězdné hanby</p>
          <h2 id="ar-series" className="ar-h2">Série, které se sdílejí samy</h2>
          <ul className="ar-teasers">
            {teasers.map(({ series, joke }) => {
              const s = signOf(joke.sign);
              return (
                <li key={series} className="ar-teaser">
                  <p className="ar-teaser-series">
                    <span aria-hidden="true">{SERIES_EMOJI[series]}</span> {SERIES_LABELS[series]}
                  </p>
                  <p className="ar-teaser-text">{joke.text}</p>
                  <Link href={`/astroroast/znameni/${s.id}`} className="ar-teaser-link">
                    <span aria-hidden="true">{s.glyph}</span> Víc o znamení {s.name} →
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="ar-section" aria-labelledby="ar-couple">
        <div className="ar-wrap">
          <div className="ar-couple-cta">
            <p className="ar-badge ar-badge-lime">
              <span aria-hidden="true">⚔️</span> Astro Battle
            </p>
            <h2 id="ar-couple" className="ar-h2">Dvě znamení. Jedna hádka. Žádní přeživší.</h2>
            <p>
              Zadej sebe a toho druhého. Hvězdy napíšou scénu, na kterou se nedá dívat bez kamaráda po boku,
              a vymyslí kosmickou kompatibilitu. Oba dostanou stejně.
            </p>
            <Link href="/astroroast/par" className="ar-btn ar-btn-hero">
              Roastni nás oba <span aria-hidden="true">⚔️</span>
            </Link>
          </div>
        </div>
      </section>

      <section id="znameni" className="ar-section" aria-labelledby="ar-signs">
        <div className="ar-wrap">
          <h2 id="ar-signs" className="ar-h2">Všech 12 znamení, všech 12 hříchů</h2>
          <ul className="ar-signlinks">
            {SIGN_LIST.map((s) => (
              <li key={s.id}>
                <Link href={`/astroroast/znameni/${s.id}`} className="ar-signlink">
                  <span className="ar-signlink-glyph" aria-hidden="true">{s.glyph}</span>
                  <span className="ar-signlink-name">{s.name}</span>
                  <span className="ar-signlink-range">{formatRange(s)}</span>
                  <span className="ar-signlink-tag">{s.tagline}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ar-section" aria-labelledby="ar-shop">
        <div className="ar-wrap">
          <p className="ar-eyebrow">Obchůdek, který ještě nemá pokladnu</p>
          <h2 id="ar-shop" className="ar-h2">Chceš víc ohně?</h2>
          <p className="ar-sub">Zkus kliknout. Čím víc vás klikne, tím dřív to vyrobíme.</p>
          <FakeDoors placement="landing" />
        </div>
      </section>
    </>
  );
}
