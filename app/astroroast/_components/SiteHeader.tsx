import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="ar-header">
      <div className="ar-wrap ar-header-in">
        <Link href="/astroroast" className="ar-logo" aria-label="AstroRoast.ai, domů">
          <span className="ar-logo-mark" aria-hidden="true">
            🔥
          </span>
          <span className="ar-logo-text">
            Astro<span>Roast</span>
            <small>.ai</small>
          </span>
        </Link>
        <nav className="ar-nav" aria-label="Hlavní navigace">
          <Link href="/astroroast#denni-roast" className="ar-nav-link ar-nav-opt">
            Denní roast
          </Link>
          <Link href="/astroroast#znameni" className="ar-nav-link ar-nav-opt">
            Znamení
          </Link>
          <Link href="/astroroast/par" className="ar-nav-pill">
            <span aria-hidden="true">⚔️</span> Pár
          </Link>
        </nav>
      </div>
    </header>
  );
}
