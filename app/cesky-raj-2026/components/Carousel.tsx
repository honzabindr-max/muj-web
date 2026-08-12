'use client';

import { useRef, useState } from 'react';
import type { SubPoint } from '../types';
import { useLightbox } from './LightboxProvider';
import { gradientFor } from '../gradient';

export function Carousel({ points }: { points: SubPoint[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const { open } = useLightbox();

  const photos = points.filter((p) => p.photo).map((p) => p.photo!);

  function onScroll() {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <>
      <div className="raj-carousel" ref={trackRef} onScroll={onScroll}>
        {points.map((point) => (
          <button
            type="button"
            key={point.name}
            className="raj-carousel__card"
            style={!point.photo ? { background: gradientFor(point.name) } : undefined}
            onClick={() => {
              if (!point.photo) return;
              open(photos, photos.indexOf(point.photo));
            }}
            aria-label={point.photo ? `Zobrazit fotku: ${point.name}` : point.name}
          >
            {point.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="raj-carousel__img"
                src={point.photo.src}
                alt={point.photo.alt}
                loading="lazy"
                decoding="async"
              />
            )}
            <div className="raj-carousel__scrim" />
            <div className="raj-carousel__label">{point.name}</div>
          </button>
        ))}
      </div>
      <div className="raj-carousel__counter">
        {Math.min(index + 1, points.length)} / {points.length}
      </div>
    </>
  );
}
