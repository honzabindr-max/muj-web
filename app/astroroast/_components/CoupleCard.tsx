import { LEVEL_NAMES, type CoupleRoast, type SignInfo } from "@/astroroast/types";

interface CoupleCardProps {
  couple: CoupleRoast;
  a: SignInfo;
  b: SignInfo;
}

export function CoupleCard({ couple, a, b }: CoupleCardProps) {
  return (
    <article className="ar-card ar-couple-card" data-level={couple.level} aria-label={couple.title}>
      <div className="ar-card-top">
        <span className="ar-sticker ar-sticker-sign">
          <span aria-hidden="true">{a.glyph}</span> {a.name}
        </span>
        <span className="ar-versus" aria-hidden="true">
          ×
        </span>
        <span className="ar-sticker ar-sticker-sign ar-sticker-b">
          <span aria-hidden="true">{b.glyph}</span> {b.name}
        </span>
      </div>

      <h2 className="ar-card-headline">{couple.title}</h2>
      <p className="ar-couple-level">
        <span className="ar-sticker ar-sticker-level">
          LEVEL {couple.level} · {LEVEL_NAMES[couple.level]}
        </span>
      </p>

      <ol className="ar-scene">
        {couple.scene.map((line, i) => (
          <li
            key={i}
            className={`ar-bubble ar-bubble-${line.who}`}
            style={{ ["--i" as string]: i }}
          >
            {line.who !== "narrator" && (
              <span className="ar-bubble-who">{line.who === "a" ? a.name : b.name}</span>
            )}
            <span>{line.text}</span>
          </li>
        ))}
      </ol>

      <div className="ar-compat">
        <div
          className="ar-compat-ring"
          style={{ ["--p" as string]: `${couple.compatibility}%` }}
          role="img"
          aria-label={`Kosmická kompatibilita ${couple.compatibility} procent`}
        >
          <b>{couple.compatibility}</b>
          <small>%</small>
        </div>
        <div className="ar-compat-text">
          <span className="ar-compat-title">Kosmická kompatibilita</span>
          <span className="ar-compat-note">(vymyšlená, jako většina horoskopů)</span>
        </div>
      </div>

      <p className="ar-verdict">
        <span className="ar-verdict-tag">Verdikt hvězd</span>
        {couple.verdict}
      </p>

      <p className="ar-card-foot">
        <span>Astro Battle</span>
        <span>AstroRoast.ai</span>
      </p>
    </article>
  );
}
