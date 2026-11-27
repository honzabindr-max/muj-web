import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { decodeShare, generateRoast } from "@/astroroast/engine";
import { CARD_VERSION } from "@/astroroast/card/version";
import { cardPath, signOf } from "../../_lib/helpers";
import { RoastCard } from "../../_components/RoastCard";
import { ShareBar } from "../../_components/ShareBar";
import { ShareGenerator } from "../../_components/ShareGenerator";
import { T } from "../../_components/T";

type Props = { params: Promise<{ code: string }> };

// Výstup je deterministický podle kódu: jednou vykreslená stránka se drží na CDN (neplatné kódy dál končí 404).
export const revalidate = 86400;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const input = decodeShare(code);
  if (!input) return { title: "Roast nenalezen", robots: { index: false, follow: false } };
  const roast = generateRoast(input);
  const sign = signOf(input.sign);
  const description = `Hvězdy roastnuly znamení ${sign.name}. Zkus to na sebe, nebo na kámoše. Zdarma, bez registrace.`;
  const image = cardPath(code, "roast", "og", CARD_VERSION);
  return {
    title: roast.headline,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: `/astroroast/r/${code}` },
    openGraph: {
      title: roast.headline,
      description,
      url: `/astroroast/r/${code}`,
      type: "article",
      images: [{ url: image, width: 1200, height: 630, alt: roast.headline }],
    },
    twitter: { card: "summary_large_image", title: roast.headline, description, images: [image] },
  };
}

export default async function SharedRoastPage({ params }: Props) {
  const { code } = await params;
  const input = decodeShare(code);
  if (!input) notFound();
  const roast = generateRoast(input);
  const sign = signOf(input.sign);

  return (
    <section className="ar-hero ar-shared">
      <div className="ar-wrap ar-narrow">
        <T as="p" className="ar-badge">
          {(c) => (
            <>
              <span aria-hidden="true">{sign.emoji}</span> {c.sharedRoast.badge}
            </>
          )}
        </T>
        <T as="h1" className="ar-h1 ar-h1-sm">
          {(c) => (
            <>
              {c.sharedRoast.h1Before}
              <span className="ar-h1-hot">{sign.name}.</span>
            </>
          )}
        </T>

        <div className="ar-result" data-level={input.level}>
          {/* Sdílený roast je psaný Claudem (kód model nenese). Mění se jen text karty. */}
          <T>{(c) => <RoastCard roast={roast} sign={sign} copy={c} />}</T>
          <ShareBar kind="roast" code={code} headline={roast.headline} target={input.target} />
        </div>

        <div className="ar-bigcta">
          <T as="p" className="ar-bigcta-lead">
            {(c) => (
              <>
                {c.sharedRoast.bigCtaLead} <span aria-hidden="true">🔥</span>
              </>
            )}
          </T>
          <T as="p" className="ar-sub">
            {(c) => c.sharedRoast.bigCtaSub}
          </T>
          <ShareGenerator defaultSign={sign.id} source="share_roast" />
          <T>
            {(c) => (
              <Link href={`/astroroast/znameni/${sign.id}`} className="ar-textlink">
                {c.sharedRoast.moreLink(sign.name)}
              </Link>
            )}
          </T>
        </div>
      </div>
    </section>
  );
}
