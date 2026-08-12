import { PHOTOS } from '../data';
import type { Photo } from '../types';

export function PhotoCredits() {
  const entries = Object.values(PHOTOS).filter((p): p is Photo => Boolean(p));
  if (entries.length === 0) return null;
  return (
    <section className="raj-credits">
      <h2 className="raj-credits__title">Fotografie a licence</h2>
      {entries.map((photo) => (
        <div className="raj-credits__item" key={photo.src}>
          {photo.alt} — Foto: {photo.author}, {photo.license},{' '}
          <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
            Wikimedia Commons
          </a>
        </div>
      ))}
    </section>
  );
}
