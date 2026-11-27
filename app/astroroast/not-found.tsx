import Link from "next/link";
import { T } from "./_components/T";

export default function AstroRoastNotFound() {
  return (
    <T>
      {(c) => (
        <section className="ar-section ar-notfound">
          <div className="ar-wrap">
            <p className="ar-badge">
              <span aria-hidden="true">☄️</span> {c.notFound.badge}
            </p>
            <h1 className="ar-h1">{c.notFound.title}</h1>
            <p className="ar-lead">{c.notFound.text}</p>
            <Link href="/astroroast" className="ar-btn ar-btn-hero">
              {c.notFound.cta} <span aria-hidden="true">🔥</span>
            </Link>
          </div>
        </section>
      )}
    </T>
  );
}
