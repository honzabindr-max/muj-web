import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SIGN_LIST, dailyRoast, encodeShare, signBySlug, signText } from "@/astroroast/engine";
import { CARD_VERSION } from "@/astroroast/card/version";
import { CONTENT, SERIES_ORDER } from "@/astroroast/content";
import { cardPath, formatMD, formatRange, pragueToday, SITE_URL } from "../../_lib/helpers";
import { T } from "../../_components/T";

// Denní roast se mění o půlnoci pražského času, proto krátká revalidace. Neznámé slugy rovnou končí 404.
export const revalidate = 300;
export const dynamicParams = false;

type Props = { params: Promise<{ sign: string }> };

export function generateStaticParams() {
  return SIGN_LIST.map((s) => ({ sign: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sign: slug } = await params;
  const sign = signBySlug(slug);
  if (!sign) return { title: "Znamení nenalezeno", robots: { index: false } };
  const title = `${sign.name}: vtipný roast znamení`;
  // Ukázková karta znamení (pevný seed, úroveň 3): sign-specifický obrázek bez dalších route.
  const image = cardPath(
    encodeShare({ sign: sign.id, level: 3, topic: "zivot", target: "self", seed: 20261126 }),
    "roast",
    "og",
    CARD_VERSION,
  );
  const description = `${signText(sign.id, "claude").tagline} Vtipný roast a denní horoskop pro znamení ${sign.name} (${formatRange(sign)}). Zábava, ne předpověď.`;
  return {
    title,
    description,
    alternates: { canonical: `/astroroast/znameni/${sign.id}` },
    openGraph: {
      title,
      description,
      url: `/astroroast/znameni/${sign.id}`,
      type: "article",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SignPage({ params }: Props) {
  const { sign: slug } = await params;
  const sign = signBySlug(slug);
  if (!sign) notFound();

  const today = pragueToday();
  const idx = SIGN_LIST.findIndex((s) => s.id === sign.id);
  const prev = SIGN_LIST[(idx + SIGN_LIST.length - 1) % SIGN_LIST.length];
  const next = SIGN_LIST[(idx + 1) % SIGN_LIST.length];
  const others = SIGN_LIST.filter((s) => s.id !== sign.id);
  const range = formatRange(sign);

  // FAQPage JSON-LD se nepoužívá (Google ho od 2023 zobrazuje jen u vládních a zdravotnických webů). Zůstává viditelné FAQ.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "AstroRoast.ai", item: `${SITE_URL}/astroroast` },
      { "@type": "ListItem", position: 2, name: sign.name, item: `${SITE_URL}/astroroast/znameni/${sign.id}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="ar-hero ar-sign-hero">
        <div className="ar-wrap">
          <T as="nav" className="ar-crumbs">
            {(c) => (
              <>
                <Link href="/astroroast">{c.signPage.crumbsHome}</Link> <span aria-hidden="true">/</span>{" "}
                <span>{c.signPage.crumbsSigns}</span>
              </>
            )}
          </T>
          <div className="ar-sign-glyph" aria-hidden="true">{sign.glyph}</div>
          <T as="p" className="ar-badge">
            {(c) => (
              <>
                <span aria-hidden="true">{sign.emoji}</span>{" "}
                {c.signPage.badge(range, c.common.elements[sign.element])}
              </>
            )}
          </T>
          <T as="h1" className="ar-h1">
            {(c) => (
              <>
                {c.signPage.h1Before(sign.name)}
                <span style={{ whiteSpace: "nowrap" }}>
                  <span className="ar-h1-hot">{c.signPage.h1Hot}</span>,
                </span>{" "}
                {c.signPage.h1After}
              </>
            )}
          </T>
          <T as="p" className="ar-lead">
            {(_c, m) => signText(sign.id, m).tagline}
          </T>
          <T>
            {(c, m) => (
              <ul className="ar-motifs" aria-label={c.signPage.motifsAria}>
                {signText(sign.id, m).motifs.map((motif) => (
                  <li key={motif}>{motif}</li>
                ))}
              </ul>
            )}
          </T>
          <T>
            {(c) => (
              <Link href={`/astroroast?z=${sign.id}#roast`} className="ar-btn ar-btn-hero">
                {c.signPage.cta(sign.name)} <span aria-hidden="true">🔥</span>
              </Link>
            )}
          </T>
        </div>
      </section>

      <T>
        {(c, m) => (
          <section className="ar-section" aria-labelledby={`ar-today-${m}`}>
            <div className="ar-wrap ar-narrow">
              <p className="ar-eyebrow">{c.signPage.todayEyebrow(today.label)}</p>
              <h2 id={`ar-today-${m}`} className="ar-h2">{c.signPage.todayTitle(sign.name)}</h2>
              <p className="ar-sticky ar-sticky-lime ar-today-note" style={{ ["--r" as string]: "-1deg" }}>
                {dailyRoast(sign.id, today.iso, m)}
              </p>
            </div>
          </section>
        )}
      </T>

      <T>
        {(_c, m) => {
          const content = CONTENT[m];
          const jokes = content.catalog.filter((j) => j.sign === sign.id);
          return (
            <>
              {SERIES_ORDER.map((series) => {
                const list = jokes.filter((j) => j.series === series);
                if (!list.length) return null;
                return (
                  <section key={series} className="ar-section ar-section-tight" aria-labelledby={`ar-s-${series}-${m}`}>
                    <div className="ar-wrap ar-narrow">
                      <h2 id={`ar-s-${series}-${m}`} className="ar-h3">{content.seriesLabels[series]}</h2>
                      <ul className="ar-jokes">
                        {list.map((j, i) => (
                          <li key={j.id} className="ar-joke" style={{ ["--r" as string]: `${i % 2 ? 0.7 : -0.7}deg` }}>
                            {j.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>
                );
              })}
            </>
          );
        }}
      </T>

      <T>
        {(c, m) => (
          <section className="ar-section" aria-labelledby={`ar-about-${m}`}>
            <div className="ar-wrap ar-narrow ar-prose">
              <h2 id={`ar-about-${m}`} className="ar-h2">{c.signPage.aboutTitle(sign.name)}</h2>
              <p>{c.signPage.aboutP1(sign.name, range, signText(sign.id, m).motifs.slice(0, 3).join(", "))}</p>
              <p>{c.signPage.aboutP2}</p>
              <dl className="ar-faq">
                {c.signPage.faq(sign.name, formatMD(sign.from), formatMD(sign.to)).map((f) => (
                  <div key={f.q}>
                    <dt>{f.q}</dt>
                    <dd>{f.a}</dd>
                  </div>
                ))}
              </dl>
              <p className="ar-disclaimer-inline">
                <strong>{c.common.disclaimerStrong}</strong> {c.common.disclaimerRest}
              </p>
              <Link href={`/astroroast?z=${sign.id}#roast`} className="ar-btn ar-btn-hot">
                {c.signPage.cta(sign.name)} <span aria-hidden="true">🌶️</span>
              </Link>
            </div>
          </section>
        )}
      </T>

      <T>
        {(c, m) => (
          <section className="ar-section" aria-labelledby={`ar-duel-${m}`}>
            <div className="ar-wrap ar-narrow ar-prose">
              <p className="ar-badge ar-badge-lime">
                <span aria-hidden="true">⚔️</span> {c.signPage.duelBadge}
              </p>
              <h2 id={`ar-duel-${m}`} className="ar-h2">{c.signPage.duelTitle(sign.name)}</h2>
              <p>{c.signPage.duelText(sign.name)}</p>
              <Link href={`/astroroast/par?a=${sign.id}`} className="ar-btn ar-btn-hot">
                {c.signPage.duelCta} <span aria-hidden="true">⚔️</span>
              </Link>
            </div>
          </section>
        )}
      </T>

      <T>
        {(c, m) => (
          <section className="ar-section ar-section-band" aria-labelledby={`ar-more-${m}`}>
            <div className="ar-wrap">
              <h2 id={`ar-more-${m}`} className="ar-h2">{c.signPage.moreTitle}</h2>
              <ul className="ar-signlinks ar-signlinks-compact">
                {others.map((s) => (
                  <li key={s.id}>
                    <Link href={`/astroroast/znameni/${s.id}`} className="ar-signlink">
                      <span className="ar-signlink-glyph" aria-hidden="true">{s.glyph}</span>
                      <span className="ar-signlink-name">{s.name}</span>
                      <span className="ar-signlink-range">{formatRange(s)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="ar-prevnext">
                <Link href={`/astroroast/znameni/${prev.id}`}>← {prev.name}</Link>
                <Link href={`/astroroast/znameni/${next.id}`}>{next.name} →</Link>
              </p>
            </div>
          </section>
        )}
      </T>
    </>
  );
}
