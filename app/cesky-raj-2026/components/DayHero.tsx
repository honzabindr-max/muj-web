'use client';

import type { DayPlan } from '../types';
import { useLightbox } from './LightboxProvider';
import { gradientFor } from '../gradient';

export function DayHero({ day, eager }: { day: DayPlan; eager: boolean }) {
  const { open } = useLightbox();
  const photo = day.heroPhoto;

  return (
    <button
      type="button"
      className="raj-dayhero"
      style={!photo ? { background: gradientFor(day.title) } : undefined}
      onClick={() => photo && open([photo], 0)}
      aria-label={photo ? `Zobrazit fotku: ${photo.alt}` : day.title}
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="raj-dayhero__img"
          src={photo.src}
          alt={photo.alt}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          decoding="async"
        />
      )}
      <div className="raj-dayhero__scrim" />
      <div className="raj-dayhero__overlay">
        <span className="raj-dayhero__badge">{day.difficulty}</span>
        <h2 className="raj-dayhero__title">{day.title}</h2>
        <div className="raj-dayhero__stats">{day.stats}</div>
      </div>
    </button>
  );
}
