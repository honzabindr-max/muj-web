import Link from "next/link";
import { T } from "./T";

export function SiteHeader() {
  return (
    <T>
      {(c) => (
        <header className="ar-header">
          <div className="ar-wrap ar-header-in">
            <Link href="/astroroast" className="ar-logo" aria-label={c.header.logoAria}>
              <span className="ar-logo-mark" aria-hidden="true">
                🔥
              </span>
              <span className="ar-logo-text">
                Astro<span>Roast</span>
                <small>.ai</small>
              </span>
            </Link>
            <nav className="ar-nav" aria-label={c.header.navAria}>
              <Link href="/astroroast#denni-roast" className="ar-nav-link ar-nav-opt">
                {c.header.navDaily}
              </Link>
              <Link href="/astroroast#znameni" className="ar-nav-link ar-nav-opt">
                {c.header.navSigns}
              </Link>
              <Link href="/astroroast/par" className="ar-nav-pill">
                <span aria-hidden="true">⚔️</span> {c.header.navCouple}
              </Link>
            </nav>
          </div>
        </header>
      )}
    </T>
  );
}
