import Link from "next/link";
import { SIGN_LIST } from "@/astroroast/engine";
import { T } from "./T";

export function SiteFooter() {
  return (
    <T>
      {(c) => (
        <footer className="ar-footer">
          <div className="ar-wrap">
            <div className="ar-footer-top">
              <div>
                <p className="ar-footer-brand">
                  Astro<span>Roast</span>.ai
                </p>
                <p className="ar-footer-claim">
                  {c.common.claim} <em>{c.common.claimEn}</em>
                </p>
              </div>
              <nav className="ar-footer-signs" aria-label={c.footer.signsAria}>
                {SIGN_LIST.map((s) => (
                  <Link key={s.id} href={`/astroroast/znameni/${s.id}`} className="ar-footer-sign">
                    <span aria-hidden="true">{s.glyph}</span> {s.name}
                  </Link>
                ))}
              </nav>
            </div>
            <p className="ar-disclaimer">
              <strong>{c.common.disclaimerStrong}</strong> {c.common.disclaimerRest}
            </p>
            <p className="ar-footer-privacy">{c.footer.privacy}</p>
            <p className="ar-footer-small">
              {c.footer.made} <Link href="/">{c.footer.madeBrand}</Link>.{" "}
              <Link href="/privacy">{c.footer.privacyLink}</Link> · <Link href="/terms">{c.footer.termsLink}</Link>
            </p>
          </div>
        </footer>
      )}
    </T>
  );
}
