"use client";

import { useState } from "react";

import { ImageWithFallback } from "./image-with-fallback";

/**
 * 7 z 11 bytů má jedinou fotku (bod 2.3 zadání) — lightbox se šipkami se
 * zobrazí jen když má víc než jeden obrázek, jinak jen jedna fotka bez
 * prázdné galerie.
 */
export function Gallery({ images, alt, fallbackHref }: { images: string[]; alt: string; fallbackHref: string | null }) {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (images.length <= 1) {
    return (
      <ImageWithFallback
        src={images[0]}
        alt={alt}
        fallbackHref={fallbackHref}
        eager
        className="h-72 w-full rounded-2xl object-cover sm:h-96"
      />
    );
  }

  function go(delta: number) {
    setIndex((i) => (i + delta + images.length) % images.length);
  }

  return (
    <div>
      <button type="button" onClick={() => setLightboxOpen(true)} className="block w-full">
        <ImageWithFallback
          src={images[index]}
          alt={`${alt} — foto ${index + 1}/${images.length}`}
          fallbackHref={fallbackHref}
          eager
          className="h-72 w-full rounded-2xl object-cover sm:h-96"
        />
      </button>
      <div className="mt-2 flex gap-2 overflow-x-auto">
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setIndex(i)}
            className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${
              i === index ? "border-zinc-900" : "border-transparent"
            }`}
          >
            <ImageWithFallback src={src} alt={`${alt} — náhled ${i + 1}`} fallbackHref={fallbackHref} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {lightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm"
          >
            Zavřít
          </button>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Předchozí fotka"
            className="absolute left-4 rounded-full bg-white/90 px-3 py-2 text-lg"
          >
            ‹
          </button>
          <ImageWithFallback
            src={images[index]}
            alt={`${alt} — foto ${index + 1}/${images.length}`}
            fallbackHref={fallbackHref}
            eager
            className="max-h-[85vh] max-w-full rounded-xl object-contain"
          />
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Další fotka"
            className="absolute right-4 rounded-full bg-white/90 px-3 py-2 text-lg"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
