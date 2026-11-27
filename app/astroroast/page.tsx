import type { Metadata } from "next";
import Link from "next/link";
import { SIGN_LIST, SIGNS, dailyRoast, generateRoast, signText } from "@/astroroast/engine";
import { CONTENT, SERIES_ORDER } from "@/astroroast/content";
import type { CatalogJoke } from "@/astroroast/types";
import { OG_DEFAULT_IMAGE, formatRange, pragueToday, signOf } from "./_lib/helpers";
import { Generator } from "./_components/Generator";
import { RoastCard } from "./_components/RoastCard";
import { FakeDoors } from "./_components/FakeDoors";
import { T } from "./_components/T";

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

const SERIES_EMOJI: Record<CatalogJoke["series"], string> = {
  "sejde-se": "👥",
  dovolena: "🏖️",
  zprava: "💬",
  "rika-vs-mysli": "🎭",
  "one-liner": "⚡",
};

const STICKY = ["lime", "pink", "cream", "violet"] as const;

export default function AstroRoastLanding() {
  const today = pragueToday();

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

          <T as="p" className="ar-badge">
            {(c) => (
              <>
                <span aria-hidden="true">🔥</span> {c.landing.badge}
              </>
            )}
          </T>
          <T as="h1" className="ar-h1">
            {(c) => (
              <>
                {c.landing.h1Before}
                <span className="ar-h1-hot">{c.landing.h1Hot}</span>
              </>
            )}
          </T>
          <T as="p" className="ar-lead">
            {(c) => (
              <>
                {c.landing.leadBefore} <span aria-hidden="true">🌶️</span> {c.landing.leadAfter}
              </>
            )}
          </T>
          <T as="p" className="ar-en">
            {(c) => c.landing.en}
          </T>

          <div className="ar-hero-grid">
            <Generator />
            <T as="aside" className="ar-hero-aside">
              {(c, m) => {
                // Ukázka pro desktopový hero (pevný seed, stabilní SSR, žádný hydration mismatch).
                const sample = generateRoast({
                  sign: "vodnar",
                  level: 4,
                  topic: "prace",
                  target: "self",
                  seed: 4242,
                  model: m,
                });
                const catalog = CONTENT[m].catalog;
                const notes = ["panna", "strelec"].map(
                  (id) => catalog.find((j) => j.sign === id && j.series === "sejde-se") ?? catalog[0],
                );
                return (
                  <>
                    <p className="ar-hero-aside-label">
                      <span aria-hidden="true">👇</span> {c.landing.asideLabel}
                    </p>
                    <div className="ar-hero-aside-card">
                      <RoastCard roast={sample} sign={SIGNS[sample.input.sign]} copy={c} />
                    </div>
                    <ul className="ar-hero-aside-notes">
                      {notes.map((j, i) => (
                        <li key={j.id} className={`ar-sticky ar-sticky-${i % 2 ? "pink" : "lime"}`}>
                          {j.text}
                        </li>
                      ))}
                    </ul>
                  </>
                );
              }}
            </T>
          </div>
        </div>
      </section>

      <T>
        {(c) => (
          <div className="ar-ticker" aria-hidden="true">
            <div className="ar-ticker-track">
              {[0, 1].map((k) => (
                <div className="ar-ticker-set" key={k}>
                  {c.landing.ticker.map((t) => (
                    <span key={t + k}>
                      {t} <i>✦</i>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </T>

      <T>
        {(c, m) => (
          <section className="ar-section" aria-labelledby={`ar-how-${m}`}>
            <div className="ar-wrap">
              <h2 id={`ar-how-${m}`} className="ar-h2">{c.landing.howTitle}</h2>
              <ol className="ar-steps">
                {c.landing.steps.map((step, i) => (
                  <li key={i}>
                    <span className="ar-step-n">{i + 1}</span>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}
      </T>

      <span id="denni-roast" className="ar-anchor" />
      <T>
        {(c, m) => (
          <section className="ar-section" aria-labelledby={`ar-daily-${m}`}>
            <div className="ar-wrap">
              <p className="ar-eyebrow">{c.landing.dailyEyebrow(today.label)}</p>
              <h2 id={`ar-daily-${m}`} className="ar-h2">{c.landing.dailyTitle}</h2>
              <p className="ar-sub">{c.landing.dailySub}</p>
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
                    <p>{dailyRoast(s.id, today.iso, m)}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </T>

      <T>
        {(c, m) => {
          const content = CONTENT[m];
          const teasers = SERIES_ORDER.map((series) => {
            const pool = content.catalog.filter((j) => j.series === series);
            return { series, joke: pool.length ? pool[today.dayNumber % pool.length] : null };
          }).filter((t): t is { series: CatalogJoke["series"]; joke: CatalogJoke } => t.joke !== null);
          return (
            <section className="ar-section ar-section-band" aria-labelledby={`ar-series-${m}`}>
              <div className="ar-wrap">
                <p className="ar-eyebrow">{c.landing.seriesEyebrow}</p>
                <h2 id={`ar-series-${m}`} className="ar-h2">{c.landing.seriesTitle}</h2>
                <ul className="ar-teasers">
                  {teasers.map(({ series, joke }) => {
                    const s = signOf(joke.sign);
                    return (
                      <li key={series} className="ar-teaser">
                        <p className="ar-teaser-series">
                          <span aria-hidden="true">{SERIES_EMOJI[series]}</span> {content.seriesLabels[series]}
                        </p>
                        <p className="ar-teaser-text">{joke.text}</p>
                        <Link href={`/astroroast/znameni/${s.id}`} className="ar-teaser-link">
                          <span aria-hidden="true">{s.glyph}</span> {c.landing.teaserMore(s.name)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          );
        }}
      </T>

      <T>
        {(c, m) => (
          <section className="ar-section" aria-labelledby={`ar-couple-${m}`}>
            <div className="ar-wrap">
              <div className="ar-couple-cta">
                <p className="ar-badge ar-badge-lime">
                  <span aria-hidden="true">⚔️</span> {c.landing.coupleBadge}
                </p>
                <h2 id={`ar-couple-${m}`} className="ar-h2">{c.landing.coupleTitle}</h2>
                <p>{c.landing.coupleText}</p>
                <Link href="/astroroast/par" className="ar-btn ar-btn-hero">
                  {c.landing.coupleCta} <span aria-hidden="true">⚔️</span>
                </Link>
              </div>
            </div>
          </section>
        )}
      </T>

      <span id="znameni" className="ar-anchor" />
      <T>
        {(c, m) => (
          <section className="ar-section" aria-labelledby={`ar-signs-${m}`}>
            <div className="ar-wrap">
              <h2 id={`ar-signs-${m}`} className="ar-h2">{c.landing.signsTitle}</h2>
              <ul className="ar-signlinks">
                {SIGN_LIST.map((s) => (
                  <li key={s.id}>
                    <Link href={`/astroroast/znameni/${s.id}`} className="ar-signlink">
                      <span className="ar-signlink-glyph" aria-hidden="true">{s.glyph}</span>
                      <span className="ar-signlink-name">{s.name}</span>
                      <span className="ar-signlink-range">{formatRange(s)}</span>
                      <span className="ar-signlink-tag">{signText(s.id, m).tagline}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </T>

      <section className="ar-section">
        <div className="ar-wrap">
          <T>
            {(c) => (
              <>
                <p className="ar-eyebrow">{c.landing.shopEyebrow}</p>
                <h2 className="ar-h2">{c.landing.shopTitle}</h2>
                <p className="ar-sub">{c.landing.shopSub}</p>
              </>
            )}
          </T>
          <FakeDoors placement="landing" />
        </div>
      </section>
    </>
  );
}
