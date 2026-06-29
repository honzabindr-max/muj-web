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
    <figure className={`my-4 overflow-hidden rounded-xl shadow-sm ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="w-full object-cover"
        style={{ maxHeight: '420px' }}
      />
      <figcaption className="bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
        {alt} —{' '}
        <a href={commonsUrl} target="_blank" rel="noreferrer" className="underline hover:text-slate-700">
          Foto: {author}, {license}, Wikimedia Commons
        </a>
      </figcaption>
    </figure>
  );
}
