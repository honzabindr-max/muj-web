import Link from "next/link";
import { SIGN_LIST } from "@/astroroast/engine";

export function SiteFooter() {
  return (
    <footer className="ar-footer">
      <div className="ar-wrap">
        <div className="ar-footer-top">
          <div>
            <p className="ar-footer-brand">
              Astro<span>Roast</span>.ai
            </p>
            <p className="ar-footer-claim">Hvězdy tě nešetří. <em>The stars have jokes.</em></p>
          </div>
          <nav className="ar-footer-signs" aria-label="Všech 12 znamení">
            {SIGN_LIST.map((s) => (
              <Link key={s.id} href={`/astroroast/znameni/${s.id}`} className="ar-footer-sign">
                <span aria-hidden="true">{s.glyph}</span> {s.name}
              </Link>
            ))}
          </nav>
        </div>
        <p className="ar-disclaimer">
          <strong>Zábava, ne předpověď.</strong> Hvězdy si dělají legraci, ne diagnózu.
        </p>
        <p className="ar-footer-privacy">
          🔒 Datum narození zůstává ve tvém prohlížeči. Nikdy ho neposíláme, neukládáme ani nevidíme.
          Sdílí se jen znamení, úroveň a téma.
        </p>
        <p className="ar-footer-small">
          Vyrobeno s pokorou a trochou zlomyslnosti v{" "}
          <Link href="/">Good Inventions</Link>. <Link href="/privacy">Soukromí</Link> ·{" "}
          <Link href="/terms">Podmínky</Link>
        </p>
      </div>
    </footer>
  );
}
