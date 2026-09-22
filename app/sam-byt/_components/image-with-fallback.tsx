"use client";

import { useState } from "react";

/**
 * Obyčejné <img> bez next/image optimizeru (bod 4 zadání — externí URL se
 * nesmí procházet přes proxy/optimizer). Při chybě se zobrazí placeholder
 * a odkaz na původní inzerát; karta/detail zůstávají funkční.
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

  if (failed) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-zinc-100 text-center ${className ?? ""}`}>
        <span className="text-3xl" aria-hidden>
          🏠
        </span>
        <span className="px-3 text-xs text-zinc-500">{alt}</span>
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
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
