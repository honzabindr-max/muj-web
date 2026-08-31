import { ScrollReveal } from './ScrollReveal';

const PAIRS = [
  { no: 'Ne menší cíle.', yes: 'Lepší výběr cílů.' },
  { no: 'Ne méně svobody.', yes: 'Svoboda, která nepotřebuje chaos.' },
  { no: 'Ne méně intenzity.', yes: 'Lepší práce s intenzitou.' },
  { no: 'Ne jiný Honzík.', yes: 'Vědomější Honzík.' },
];

export function ClosingLines() {
  return (
    <div className="h2-closing-lines">
      {PAIRS.map((pair, i) => (
        <ScrollReveal className="h2-closing-pair" delay={i * 80} key={pair.no}>
          <p className="h2-closing-no">{pair.no}</p>
          <p className="h2-closing-yes">{pair.yes}</p>
        </ScrollReveal>
      ))}
      <ScrollReveal className="h2-closing-final" delay={PAIRS.length * 80}>
        <p className="h2-closing-headline">
          Stejný motor.
          <br />
          Lepší řízení.
        </p>
        <p className="h2-closing-signature">
          „Nechci žít méně. Chci žít víc toho, co opravdu stojí za to."
        </p>
      </ScrollReveal>
    </div>
  );
}
