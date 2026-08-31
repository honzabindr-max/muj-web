'use client';

import { useState } from 'react';
import { SLIDERS } from '../lib/content-data';

export function PowerSliders() {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(SLIDERS.map((s) => [s.id, 30]))
  );

  return (
    <div className="h2-sliders">
      {SLIDERS.map((slider) => {
        const value = values[slider.id];
        const isPulled = value > 55;
        return (
          <div className="h2-slider-row" key={slider.id}>
            <div className="h2-slider-head">
              <span className="h2-slider-label">{slider.label}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={value}
              className="h2-slider-input"
              style={{ '--h2-slider-pct': `${value}%` } as React.CSSProperties}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [slider.id]: Number(e.target.value) }))
              }
              aria-label={`${slider.label}: ${isPulled ? 'přetažená podoba' : 'užitečná poloha'}`}
            />
            <p className="h2-slider-text" data-pulled={isPulled}>
              {isPulled ? slider.overstretched : slider.useful}
            </p>
          </div>
        );
      })}
    </div>
  );
}
