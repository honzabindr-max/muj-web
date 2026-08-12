'use client';

import type { Photo } from '../types';
import { useLightbox } from './LightboxProvider';

export function HighlightCard({
  photo,
  name,
  note,
}: {
  photo?: Photo;
  name: string;
  note?: string;
}) {
  const { open } = useLightbox();

  if (!photo) {
    return (
      <div className="raj-highlight-textcard">
        <div className="raj-highlight-textcard__title">{name}</div>
        {note && <div className="raj-highlight-textcard__desc">{note}</div>}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="raj-highlight-card"
      onClick={() => open([photo], 0)}
      aria-label={`Zobrazit fotku: ${photo.alt}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="raj-highlight-card__img"
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        decoding="async"
      />
      <div className="raj-highlight-card__scrim" />
      <div className="raj-highlight-card__label">{name}</div>
    </button>
  );
}
