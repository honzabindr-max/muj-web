import { LEVEL_NAMES, type Roast, type SignInfo } from "@/astroroast/types";
import { TOPIC_LABELS } from "../_lib/helpers";

interface RoastCardProps {
  roast: Roast;
  sign: SignInfo;
}

/** Hlavní „tabloidní“ karta výsledku. Čistě prezentační, použitelná na serveru i klientu. */
export function RoastCard({ roast, sign }: RoastCardProps) {
  const { level, target, topic } = roast.input;
  const doom = level === 5;
  return (
    <article className="ar-card" data-level={level} aria-label={`Roast: ${sign.name}`}>
      <div className="ar-card-top">
        <span className="ar-sticker ar-sticker-sign">
          <span aria-hidden="true">{sign.glyph}</span> {sign.name}
        </span>
        <span className="ar-sticker ar-sticker-level">
          {doom ? "KOSMICKÁ POPRAVA" : `LEVEL ${level} · ${LEVEL_NAMES[level]}`}
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
          <span>Index spálení</span>
          <b>{roast.burn} %</b>
        </div>
        <div
          className="ar-burn-bar"
          role="img"
          aria-label={`Index spálení ${roast.burn} procent`}
        >
          <span style={{ width: `${Math.max(4, Math.min(100, roast.burn))}%` }} />
        </div>
      </div>

      <p className="ar-verdict">
        <span className="ar-verdict-tag">Verdikt hvězd</span>
        {roast.verdict}
      </p>

      <p className="ar-card-foot">
        <span>
          {target === "friend" ? "Roast na kámoše" : "Roast na mě"} · {TOPIC_LABELS[topic].label}
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
