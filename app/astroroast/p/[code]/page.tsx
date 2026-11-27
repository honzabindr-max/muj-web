import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { generateCouple } from "@/astroroast/engine";
import { CARD_VERSION } from "@/astroroast/card/version";
import { cardPath, signOf } from "../../_lib/helpers";
import { parseCouple } from "../../_lib/couple";
import { CoupleCard } from "../../_components/CoupleCard";
import { ShareBar } from "../../_components/ShareBar";
import { ShareGenerator } from "../../_components/ShareGenerator";
import { CrossSell } from "../../_components/CrossSell";
import { T } from "../../_components/T";

type Props = { params: Promise<{ code: string }> };

// Výstup je deterministický podle kódu: jednou vykreslená stránka se drží na CDN (neplatné kódy dál končí 404).
export const revalidate = 86400;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const input = parseCouple(code);
  if (!input) return { title: "Souboj nenalezen", robots: { index: false, follow: false } };
  const couple = generateCouple(input.a, input.b, input.level, input.seed);
  const description = `${signOf(input.a).name} × ${signOf(input.b).name}: kosmická kompatibilita ${couple.compatibility} %. Zkus to na vás dva.`;
  const image = cardPath(code, "couple", "og", CARD_VERSION);
  return {
    title: couple.title,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: `/astroroast/p/${code}` },
    openGraph: {
      title: couple.title,
      description,
      url: `/astroroast/p/${code}`,
      type: "article",
      images: [{ url: image, width: 1200, height: 630, alt: couple.title }],
    },
    twitter: { card: "summary_large_image", title: couple.title, description, images: [image] },
  };
}

export default async function SharedCouplePage({ params }: Props) {
  const { code } = await params;
  const input = parseCouple(code);
  if (!input) notFound();
  const couple = generateCouple(input.a, input.b, input.level, input.seed);
  const a = signOf(input.a);
  const b = signOf(input.b);

  return (
    <section className="ar-hero ar-shared">
      <div className="ar-wrap ar-narrow">
        <T as="p" className="ar-badge">
          {(c) => (
            <>
              <span aria-hidden="true">⚔️</span> {c.sharedCouple.badge}
            </>
          )}
        </T>
        <T as="h1" className="ar-h1 ar-h1-sm">
          {(c) => (
            <>
              <span className="ar-h1-hot">{a.name}</span> × <span className="ar-h1-hot ar-h1-lime">{b.name}</span>
              {c.sharedCouple.h1After}
            </>
          )}
        </T>

        <div className="ar-result" data-level={couple.level}>
          {/* Sdílený souboj je psaný Claudem (kód model nenese). Mění se jen text karty. */}
          <T>{(c) => <CoupleCard couple={couple} a={a} b={b} copy={c} />}</T>
          <ShareBar kind="couple" code={code} headline={couple.title} />
        </div>

        <div className="ar-bigcta">
          <T as="p" className="ar-bigcta-lead">
            {(c) => c.sharedCouple.bigCtaLead}
          </T>
          <T>
            {(c) => (
              <Link href="/astroroast/par" className="ar-btn ar-btn-hero">
                {c.sharedCouple.bigCtaBtn} <span aria-hidden="true">⚔️</span>
              </Link>
            )}
          </T>
          <T as="p" className="ar-sub">
            {(c) => c.sharedCouple.bigCtaSub}
          </T>
          <ShareGenerator defaultSign={a.id} source="share_couple" />
        </div>

        <CrossSell />
      </div>
    </section>
  );
}
