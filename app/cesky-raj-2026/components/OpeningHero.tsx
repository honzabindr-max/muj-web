'use client';

import type { Photo } from '../types';
import { useLightbox } from './LightboxProvider';

export function OpeningHero({
  photo,
  title,
  dates,
  summary,
  route,
}: {
  photo?: Photo;
  title: string;
  dates: string;
  summary: string;
  route: string;
}) {
  const { open } = useLightbox();

  return (
    <button
      type="button"
      className="raj-masthead"
      onClick={() => photo && open([photo], 0)}
      aria-label={photo ? `Zobrazit fotku: ${photo.alt}` : title}
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="raj-masthead__img"
          src={photo.src}
          alt={photo.alt}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      )}
      <div className="raj-masthead__scrim" />
      <div className="raj-masthead__content">
        <h1 className="raj-masthead__title">{title}</h1>
        <div className="raj-masthead__meta">
          {dates} · {summary}
        </div>
        <div className="raj-masthead__route">{route}</div>
        <div className="raj-masthead__scroll">↓ SCROLLUJ DOLŮ</div>
      </div>
    </button>
  );
}
