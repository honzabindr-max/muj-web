'use client';

import { useState } from 'react';
import { SLIDERS, sliderBand } from '../lib/content-data';

export function PowerSliders() {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(SLIDERS.map((s) => [s.id, 20]))
  );

  return (
    <div className="h2-sliders">
      {SLIDERS.map((slider) => {
        const value = values[slider.id];
        const band = sliderBand(value);
        const text = slider[band];
        return (
          <div className="h2-slider-row" key={slider.id}>
            <span className="h2-slider-label">{slider.label}</span>
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
              aria-label={slider.label}
              aria-valuetext={text}
            />
            <p className="h2-slider-text" data-band={band}>
              {text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
