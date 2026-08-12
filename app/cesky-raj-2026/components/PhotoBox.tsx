import type { Photo } from '../types';

const GRADIENTS = [
  'linear-gradient(135deg,#14532D 0%,#0B3A1F 100%)',
  'linear-gradient(135deg,#3F6212 0%,#1A2E05 100%)',
  'linear-gradient(135deg,#164E63 0%,#0C2A33 100%)',
  'linear-gradient(135deg,#5B4A1F 0%,#2E2410 100%)',
];

function gradientFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

export function HeroBox({ photo, name, eager = false }: { photo?: Photo; name: string; eager?: boolean }) {
  if (photo) {
    return (
      <div className="raj-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.src} alt={photo.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />
      </div>
    );
  }
  return (
    <div className="raj-hero" style={{ background: gradientFor(name) }}>
      <div className="raj-hero__fallback">{name}</div>
    </div>
  );
}

export function ThumbBox({ photo, name }: { photo?: Photo; name: string }) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="raj-thumb__img" src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />
    );
  }
  return <div className="raj-thumb__fallback" style={{ background: gradientFor(name) }} />;
}
