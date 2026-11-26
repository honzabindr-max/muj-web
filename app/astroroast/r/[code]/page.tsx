import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { decodeShare, generateRoast } from "@/astroroast/engine";
import { CARD_VERSION } from "@/astroroast/card/version";
import { cardPath, signOf } from "../../_lib/helpers";
import { RoastCard } from "../../_components/RoastCard";
import { ShareBar } from "../../_components/ShareBar";
import { ShareGenerator } from "../../_components/ShareGenerator";

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
        <p className="ar-badge">
          <span aria-hidden="true">{sign.emoji}</span> Někdo ti poslal roast
        </p>
        <h1 className="ar-h1 ar-h1-sm">
          Hvězdy roastnuly znamení <span className="ar-h1-hot">{sign.name}.</span>
        </h1>

        <div className="ar-result" data-level={input.level}>
          <RoastCard roast={roast} sign={sign} />
          <ShareBar kind="roast" code={code} headline={roast.headline} target={input.target} />
        </div>

        <div className="ar-bigcta">
          <p className="ar-bigcta-lead">A teď to zkus na sebe <span aria-hidden="true">🔥</span></p>
          <p className="ar-sub">Dobrý, co? Teď přijde ta těžší část. Vyber znamení a hvězdy ti odpoví hned tady.</p>
          <ShareGenerator defaultSign={sign.id} source="share_roast" />
          <Link href={`/astroroast/znameni/${sign.id}`} className="ar-textlink">
            Víc vtipů o znamení {sign.name} →
          </Link>
        </div>
      </div>
    </section>
  );
}
