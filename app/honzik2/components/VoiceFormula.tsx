import { ScrollReveal } from './ScrollReveal';
import { VOICE_FORMULA_BALANCE, VOICE_FORMULA_REFLEX } from '../lib/content-data';

function FormulaRow({ words, variant }: { words: string[]; variant: 'reflex' | 'balance' }) {
  return (
    <p className="h2-formula-row" data-variant={variant}>
      {words.map((word, i) => (
        <span className="h2-formula-word" key={word}>
          {word}
          {i < words.length - 1 && (
            <span className="h2-formula-arrow" aria-hidden="true">
              →
            </span>
          )}
        </span>
      ))}
    </p>
  );
}

export function VoiceFormula() {
  return (
    <div className="h2-formula">
      <ScrollReveal delay={0}>
        <p className="h2-formula-caption">Můj přirozený reflex:</p>
        <FormulaRow words={VOICE_FORMULA_REFLEX} variant="reflex" />
      </ScrollReveal>
      <ScrollReveal delay={150}>
        <p className="h2-formula-caption">A Honzík 2.0 k tomu přidává:</p>
        <FormulaRow words={VOICE_FORMULA_BALANCE} variant="balance" />
      </ScrollReveal>
    </div>
  );
}
