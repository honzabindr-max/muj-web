import { ScrollReveal } from './ScrollReveal';

const WANT_LINES = [
  'Pořád chci nové nápady.',
  'Pořád chci riskovat.',
  'Pořád chci dobrodružství.',
  'Pořád chci svobodu.',
  'Pořád chci být já.',
];

export function ClosingLines() {
  return (
    <div className="h2-finale">
      <div className="h2-finale-wants">
        {WANT_LINES.map((line, i) => (
          <ScrollReveal delay={i * 90} key={line}>
            <p className="h2-finale-want">{line}</p>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal delay={WANT_LINES.length * 90}>
        <p className="h2-quote h2-finale-statement">
          „Jen bych rád líp věděl, čemu říct ano a čemu už ne."
        </p>
      </ScrollReveal>

      <ScrollReveal delay={WANT_LINES.length * 90 + 100} className="h2-finale-motto-wrap">
        <p className="h2-finale-motto">
          Stejný motor.
          <br />
          <span className="h2-finale-motto-accent">Lepší řízení.</span>
        </p>
        <p className="h2-finale-signature">
          Nechci žít méně.
          <br />
          Chci žít víc toho, co opravdu stojí za to.
        </p>
      </ScrollReveal>
    </div>
  );
}
