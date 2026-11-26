import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SIGN_LIST, dailyRoast, encodeShare, signBySlug } from "@/astroroast/engine";
import { CARD_VERSION } from "@/astroroast/card/version";
import { CATALOG, SERIES_LABELS } from "@/astroroast/content/catalog";
import type { CatalogJoke, Element } from "@/astroroast/types";
import { cardPath, formatMD, formatRange, pragueToday, SITE_URL } from "../../_lib/helpers";

// Denní roast se mění o půlnoci pražského času, proto krátká revalidace. Neznámé slugy rovnou končí 404.
export const revalidate = 300;
export const dynamicParams = false;

type Props = { params: Promise<{ sign: string }> };

const ELEMENT_NAME: Record<Element, string> = {
  ohen: "Oheň",
  zeme: "Země",
  vzduch: "Vzduch",
  voda: "Voda",
};

const SERIES_ORDER: CatalogJoke["series"][] = ["sejde-se", "dovolena", "zprava", "rika-vs-mysli", "one-liner"];

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
  const description = `${sign.tagline} Vtipný roast a denní horoskop pro znamení ${sign.name} (${formatRange(sign)}). Zábava, ne předpověď.`;
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
  const daily = dailyRoast(sign.id, today.iso);
  const jokes = CATALOG.filter((j) => j.sign === sign.id);
  const idx = SIGN_LIST.findIndex((s) => s.id === sign.id);
  const prev = SIGN_LIST[(idx + SIGN_LIST.length - 1) % SIGN_LIST.length];
  const next = SIGN_LIST[(idx + 1) % SIGN_LIST.length];
  const others = SIGN_LIST.filter((s) => s.id !== sign.id);
  const range = formatRange(sign);

  const faq = [
    {
      q: `Od kdy do kdy trvá znamení ${sign.name}?`,
      a: `Od ${formatMD(sign.from)} do ${formatMD(sign.to)}. Hraniční dny generátor nechá potvrdit tebou, protože hvězdy se u hranic neumí rozhodnout.`,
    },
    {
      q: `Je roast znamení ${sign.name} míněný vážně?`,
      a: "Ne. Je to zábava, ne předpověď. Hvězdy si dělají legraci, ne diagnózu. Střílí se do stereotypu znamení, nikdy do skutečných vlastností člověka.",
    },
    {
      q: "Dá se roast poslat kámošovi?",
      a: "Jasně. Po vygenerování pošli odkaz nebo stáhni kartu do story. U kamaráda je maximum úroveň 3 (Sarkasmus). Kosmickou popravu si musí odkliknout sám.",
    },
  ];

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
          <nav className="ar-crumbs" aria-label="Drobečková navigace">
            <Link href="/astroroast">AstroRoast</Link> <span aria-hidden="true">/</span> <span>Znamení</span>
          </nav>
          <div className="ar-sign-glyph" aria-hidden="true">{sign.glyph}</div>
          <p className="ar-badge">
            <span aria-hidden="true">{sign.emoji}</span> {range} · Živel: {ELEMENT_NAME[sign.element]}
          </p>
          <h1 className="ar-h1">
            {sign.name}: <span style={{ whiteSpace: "nowrap" }}><span className="ar-h1-hot">roast</span>,</span> který hvězdy neschválily
          </h1>
          <p className="ar-lead">{sign.tagline}</p>
          <ul className="ar-motifs" aria-label="Typické motivy">
            {sign.motifs.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <Link href={`/astroroast?z=${sign.id}#roast`} className="ar-btn ar-btn-hero">
            Roastni mě jako {sign.name} <span aria-hidden="true">🔥</span>
          </Link>
        </div>
      </section>

      <section className="ar-section" aria-labelledby="ar-today">
        <div className="ar-wrap ar-narrow">
          <p className="ar-eyebrow">Dnes, {today.label}</p>
          <h2 id="ar-today" className="ar-h2">Denní roast: {sign.name}</h2>
          <p className="ar-sticky ar-sticky-lime ar-today-note" style={{ ["--r" as string]: "-1deg" }}>
            {daily}
          </p>
        </div>
      </section>

      {SERIES_ORDER.map((series) => {
        const list = jokes.filter((j) => j.series === series);
        if (!list.length) return null;
        return (
          <section key={series} className="ar-section ar-section-tight" aria-labelledby={`ar-s-${series}`}>
            <div className="ar-wrap ar-narrow">
              <h2 id={`ar-s-${series}`} className="ar-h3">{SERIES_LABELS[series]}</h2>
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

      <section className="ar-section" aria-labelledby="ar-about">
        <div className="ar-wrap ar-narrow ar-prose">
          <h2 id="ar-about" className="ar-h2">Vtipný horoskop pro znamení {sign.name}</h2>
          <p>
            Hledáš vtipný horoskop, který nebude tvrdit, že tě čeká velká změna a pozor na modrou barvu?
            Tady je opak. Kdo se narodil mezi {range}, má v horoskopu napsáno: {sign.name}. A hvězdy mají
            připravené pár poznámek, třeba k tématům jako {sign.motifs.slice(0, 3).join(", ")}.
          </p>
          <p>
            Roast se opírá o stereotyp znamení, ne o to, jaký člověk doopravdy je. Vybereš pálivost od 1
            (pohlazení) po 5 (kosmická poprava), téma a hvězdy ti poskládají novou porci. Každý klik je jiný
            a datum narození nikam neposíláme.
          </p>
          <dl className="ar-faq">
            {faq.map((f) => (
              <div key={f.q}>
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>
          <p className="ar-disclaimer-inline">
            <strong>Zábava, ne předpověď.</strong> Hvězdy si dělají legraci, ne diagnózu.
          </p>
          <Link href={`/astroroast?z=${sign.id}#roast`} className="ar-btn ar-btn-hot">
            Roastni mě jako {sign.name} <span aria-hidden="true">🌶️</span>
          </Link>
        </div>
      </section>

      <section className="ar-section" aria-labelledby="ar-duel">
        <div className="ar-wrap ar-narrow ar-prose">
          <p className="ar-badge ar-badge-lime">
            <span aria-hidden="true">⚔️</span> Astro Battle
          </p>
          <h2 id="ar-duel" className="ar-h2">Souboj: {sign.name} proti někomu jinému</h2>
          <p>
            Znamení {sign.name} se nikdy nehádá samo. Zadej, s kým žije, pracuje nebo sdílí skupinový chat, a hvězdy
            napíšou scénu, ve které oba dostanou stejně.
          </p>
          <Link href={`/astroroast/par?a=${sign.id}`} className="ar-btn ar-btn-hot">
            Roastni nás oba <span aria-hidden="true">⚔️</span>
          </Link>
        </div>
      </section>

      <section className="ar-section ar-section-band" aria-labelledby="ar-more">
        <div className="ar-wrap">
          <h2 id="ar-more" className="ar-h2">Další znamení k roastnutí</h2>
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
    </>
  );
}
