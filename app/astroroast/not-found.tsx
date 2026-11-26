import Link from "next/link";

export default function AstroRoastNotFound() {
  return (
    <section className="ar-section ar-notfound">
      <div className="ar-wrap">
        <p className="ar-badge">
          <span aria-hidden="true">☄️</span> Chyba 404
        </p>
        <h1 className="ar-h1">Tohle vypadlo z oběžné dráhy.</h1>
        <p className="ar-lead">
          Odkaz je rozbitý, zastaralý, nebo ho někdo upsal. Hvězdy za to nemůžou (tentokrát).
        </p>
        <Link href="/astroroast" className="ar-btn ar-btn-hero">
          Zpátky na roast <span aria-hidden="true">🔥</span>
        </Link>
      </div>
    </section>
  );
}
