"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Obyčejné <img> bez next/image optimizeru (bod 4 zadání — externí URL se
 * nesmí procházet přes proxy/optimizer). Při chybě se zobrazí placeholder
 * a odkaz na původní inzerát; karta/detail zůstávají funkční.
 *
 * SSR hydration race: prohlížeč začne obrázek načítat hned z HTML ze
 * serveru, ještě než React hydratuje a připojí onError. Když selhání
 * přijde rychle (typicky net::ERR_BLOCKED_BY_ORB u některých CDN bez
 * povoleného hotlinku), 'error' event proletí dřív, než má kdo
 * naslouchat, a img zůstane viset jako "complete, naturalWidth: 0" bez
 * viditelného selhání. Proto se to po mountu ještě jednou dohledá ručně.
 */
export function ImageWithFallback({
  src,
  alt,
  fallbackHref,
  className,
  eager = false,
}: {
  src: string;
  alt: string;
  fallbackHref: string | null;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setFailed(false);
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setFailed(true);
    }
  }, [src]);

  if (failed) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-zinc-100 text-center ${className ?? ""}`}>
        <span className="text-3xl" aria-hidden>
          🏠
        </span>
        <span className="px-3 text-xs font-medium text-zinc-600">{alt}</span>
        {fallbackHref && (
          <a
            href={fallbackHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-800 shadow-sm"
          >
            Fotky v původním inzerátu
          </a>
        )}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
