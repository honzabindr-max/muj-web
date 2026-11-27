import type { UiCopy } from "@/astroroast/copy";
import type { Roast, SignInfo } from "@/astroroast/types";

interface RoastCardProps {
  roast: Roast;
  sign: SignInfo;
  /** Texty UI (server: z <T>, klient: useCopy()). */
  copy: UiCopy;
}

/** Hlavní „tabloidní“ karta výsledku. Čistě prezentační, použitelná na serveru i klientu. */
export function RoastCard({ roast, sign, copy }: RoastCardProps) {
  const { level, target, topic } = roast.input;
  const c = copy.card;
  const doom = level === 5;
  return (
    <article className="ar-card" data-level={level} aria-label={c.ariaLabel(sign.name)}>
      <div className="ar-card-top">
        <span className="ar-sticker ar-sticker-sign">
          <span aria-hidden="true">{sign.glyph}</span> {sign.name}
        </span>
        <span className="ar-sticker ar-sticker-level">
          {doom ? copy.common.doom : c.levelTag(level, copy.common.levelNames[level])}
        </span>
      </div>

      <h2 className="ar-card-headline">{roast.headline}</h2>

      <ul className="ar-card-lines">
        {roast.lines.map((line, i) => (
          <li key={i} style={{ ["--i" as string]: i }}>
            {line}
          </li>
        ))}
      </ul>

      {roast.stats.length > 0 && (
        <dl className="ar-stats">
          {roast.stats.map((s) => (
            <div key={s.label} className="ar-stat">
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="ar-burn">
        <div className="ar-burn-head">
          <span>{c.burnLabel}</span>
          <b>{roast.burn} %</b>
        </div>
        <div
          className="ar-burn-bar"
          role="img"
          aria-label={c.burnAria(roast.burn)}
        >
          <span style={{ width: `${Math.max(4, Math.min(100, roast.burn))}%` }} />
        </div>
      </div>

      <p className="ar-verdict">
        <span className="ar-verdict-tag">{c.verdictTag}</span>
        {roast.verdict}
      </p>

      <p className="ar-card-foot">
        <span>
          {target === "friend" ? c.footFriend : c.footSelf} · {copy.common.topics[topic]}
        </span>
        <span>AstroRoast.ai</span>
      </p>

      {doom && (
        <div className="ar-flames" aria-hidden="true">
          <span>🔥</span><span>🔥</span><span>🔥</span><span>🔥</span><span>🔥</span><span>🔥</span><span>🔥</span>
        </div>
      )}
    </article>
  );
}
