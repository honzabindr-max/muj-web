import type { UiCopy } from "@/astroroast/copy";
import type { CoupleRoast, SignInfo } from "@/astroroast/types";

interface CoupleCardProps {
  couple: CoupleRoast;
  a: SignInfo;
  b: SignInfo;
  copy: UiCopy;
}

export function CoupleCard({ couple, a, b, copy }: CoupleCardProps) {
  const c = copy.coupleCard;
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
          {copy.card.levelTag(couple.level, copy.common.levelNames[couple.level])}
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
          aria-label={c.compatAria(couple.compatibility)}
        >
          <b>{couple.compatibility}</b>
          <small>%</small>
        </div>
        <div className="ar-compat-text">
          <span className="ar-compat-title">{c.compatTitle}</span>
          <span className="ar-compat-note">{c.compatNote}</span>
        </div>
      </div>

      <p className="ar-verdict">
        <span className="ar-verdict-tag">{copy.card.verdictTag}</span>
        {couple.verdict}
      </p>

      <p className="ar-card-foot">
        <span>{c.battle}</span>
        <span>AstroRoast.ai</span>
      </p>
    </article>
  );
}
