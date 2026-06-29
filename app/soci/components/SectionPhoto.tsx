interface SectionPhotoProps {
  src: string;
  alt: string;
  author: string;
  license: string;
  commonsUrl: string;
  className?: string;
}

export function SectionPhoto({
  src,
  alt,
  author,
  license,
  commonsUrl,
  className = '',
}: SectionPhotoProps) {
  return (
    <figure className={`atlas-section-photo ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" decoding="async" />
      <figcaption>
        {alt} —{' '}
        <a href={commonsUrl} target="_blank" rel="noreferrer">
          Foto: {author}, {license}, Wikimedia Commons
        </a>
      </figcaption>
    </figure>
  );
}

/* Horizontální pás karet 152×200px pro galerie */
interface GalleryPhoto {
  src: string;
  alt: string;
  title: string;
  sub?: string;
}

export function PhotoStrip({ photos }: { photos: GalleryPhoto[] }) {
  return (
    <div className="atlas-photo-strip">
      {photos.map((p) => (
        <div key={p.src} className="atlas-photo-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.src} alt={p.alt} loading="lazy" decoding="async" />
          <div className="atlas-photo-card-overlay" aria-hidden="true" />
          <div className="atlas-photo-card-label">
            <span className="atlas-photo-card-title">{p.title}</span>
            {p.sub && <span className="atlas-photo-card-sub">{p.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
