'use client';

import { useState } from 'react';
import { STEPS } from '../lib/content-data';

export function Stepper() {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isFirst = index === 0;
  const isLast = index === STEPS.length - 1;

  return (
    <div className="h2-stepper">
      <div className="h2-stepper-card">
        <span className="h2-stepper-count">
          Krok {index + 1} z {STEPS.length}
        </span>
        <h3 className="h2-stepper-title">{step.title}</h3>
        <p className="h2-stepper-question">{step.question}</p>
      </div>

      <div className="h2-stepper-nav">
        <button
          type="button"
          className="h2-stepper-btn"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={isFirst}
        >
          ← Zpět
        </button>
        <div className="h2-stepper-dots" role="tablist" aria-label="Pozice v procesu">
          {STEPS.map((s, i) => (
            <button
              type="button"
              key={s.title}
              className="h2-stepper-dot"
              data-active={i === index}
              onClick={() => setIndex(i)}
              aria-label={`Krok ${i + 1}: ${s.title}`}
              aria-current={i === index}
            />
          ))}
        </div>
        <button
          type="button"
          className="h2-stepper-btn"
          onClick={() => setIndex((i) => Math.min(STEPS.length - 1, i + 1))}
          disabled={isLast}
        >
          Dál →
        </button>
      </div>
    </div>
  );
}
