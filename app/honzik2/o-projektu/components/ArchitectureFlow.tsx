import { ScrollReveal } from './ScrollReveal';
import { ARCHITECTURE_FLOW } from '../lib/content-data';

export function ArchitectureFlow() {
  return (
    <div className="h2-flow">
      {ARCHITECTURE_FLOW.map((step, i) => {
        const isFinal = i === ARCHITECTURE_FLOW.length - 1;
        return (
          <ScrollReveal key={step.label} delay={i * 90}>
            <div className="h2-flow-step" data-final={isFinal}>
              <p className="h2-flow-label">{step.label}</p>
              <p className="h2-flow-body">{step.body}</p>
            </div>
          </ScrollReveal>
        );
      })}
    </div>
  );
}
