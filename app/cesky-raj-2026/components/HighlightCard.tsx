'use client';

import type { Photo } from '../types';
import { useLightbox } from './LightboxProvider';
import { gradientFor } from '../gradient';

export function HighlightCard({ photo, name }: { photo?: Photo; name: string }) {
  const { open } = useLightbox();

  return (
    <button
      type="button"
      className="raj-highlight-card"
      style={!photo ? { background: gradientFor(name) } : undefined}
      onClick={() => photo && open([photo], 0)}
      aria-label={photo ? `Zobrazit fotku: ${photo.alt}` : name}
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="raj-highlight-card__img"
          src={photo.src}
          alt={photo.alt}
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="raj-highlight-card__scrim" />
      <div className="raj-highlight-card__label">{name}</div>
    </button>
  );
}
