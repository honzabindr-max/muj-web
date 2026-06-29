import type { ReactNode } from 'react';
import './atlas.css';

export default function SociLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Spline+Sans+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>

      <div className="atlas-root">
        {/* Fixed alpine background */}
        <div className="atlas-bg-fixed" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/soci/photos/vrsic-pass.jpg"
            alt=""
            className="atlas-bg-fixed__img"
          />
          <div className="atlas-bg-fixed__overlay" />
        </div>

        {/* Scrollable content */}
        <div className="atlas-scroll">
          {children}
        </div>
      </div>
    </>
  );
}
