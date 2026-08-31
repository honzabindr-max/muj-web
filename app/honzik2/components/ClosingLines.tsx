import { ScrollReveal } from './ScrollReveal';

const PAIRS = [
  { no: 'Nechci život bez rizika.', yes: 'Chci lépe rozumět riziku.' },
  { no: 'Nechci život bez intenzity.', yes: 'Chci intenzitu, která mě neničí.' },
  {
    no: 'Nechci život bez velkých plánů.',
    yes: 'Chci vědět, které plány stojí za můj čas.',
  },
  { no: 'Nechci život bez svobody.', yes: 'Chci svobodu, která nepotřebuje chaos.' },
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
        <p className="h2-closing-no">Nechci méně života.</p>
        <p className="h2-closing-headline">
          Chci žít víc toho,
          <br />
          co opravdu stojí za to.
        </p>
      </ScrollReveal>
    </div>
  );
}
