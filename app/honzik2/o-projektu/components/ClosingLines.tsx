import { ScrollReveal } from './ScrollReveal';

const WANT_LINES = [
  'Pořád chci nové nápady.',
  'Pořád chci občas udělat něco, o čem ostatní řeknou, že je to trochu šílené.',
  'Pořád chci cestovat.',
  'Pořád chci spontánnost.',
  'Pořád chci dobrodružství.',
  'Pořád chci svobodu.',
  'A pořád chci nás.',
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
          „Jen bych rád líp věděl, čemu říct ano —
          <br />
          abych měl víc času a hlavy na věci,
          <br />
          kterým už jsem ano řekl."
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
          Chci mít víc prostoru na život,
          <br />
          který jsem si vybral.
        </p>
      </ScrollReveal>
    </div>
  );
}
