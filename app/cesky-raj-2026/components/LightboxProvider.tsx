'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Photo } from '../types';

interface LightboxState {
  photos: Photo[];
  index: number;
  scrollY: number;
}

interface LightboxContextValue {
  open: (photos: Photo[], index: number) => void;
}

const LightboxContext = createContext<LightboxContextValue | null>(null);

export function useLightbox(): LightboxContextValue {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error('useLightbox must be used within LightboxProvider');
  return ctx;
}

const SWIPE_THRESHOLD = 40;

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LightboxState | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!state) return;
    const scrollY = state.scrollY;
    const body = document.body;
    const prevPosition = body.style.position;
    const prevTop = body.style.top;
    const prevWidth = body.style.width;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setState(null);
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    }
    window.addEventListener('keydown', onKeyDown);

    return () => {
      body.style.position = prevPosition;
      body.style.top = prevTop;
      body.style.width = prevWidth;
      window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' });
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!state]);

  function step(dir: number) {
    setState((prev) => {
      if (!prev) return prev;
      const nextIndex = Math.min(Math.max(prev.index + dir, 0), prev.photos.length - 1);
      return { ...prev, index: nextIndex };
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    startRef.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      step(dx < 0 ? 1 : -1);
    } else {
      setState(null);
    }
  }

  const photo = state ? state.photos[state.index] : null;

  return (
    <LightboxContext.Provider
      value={{ open: (photos, index) => setState({ photos, index, scrollY: window.scrollY }) }}
    >
      {children}
      {state && photo && (
        <div className="raj-lightbox" role="dialog" aria-modal="true" aria-label={photo.alt}>
          <div
            className="raj-lightbox__stage"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="raj-lightbox__img" src={photo.src} alt={photo.alt} draggable={false} />
            <button
              type="button"
              className="raj-lightbox__close"
              aria-label="Zavřít"
              onClick={() => setState(null)}
            >
              ×
            </button>
          </div>
          <div className="raj-lightbox__caption">
            {state.photos.length > 1 && (
              <div className="raj-lightbox__counter">
                {state.index + 1} / {state.photos.length}
              </div>
            )}
            {photo.alt} — {photo.author}, {photo.license}
          </div>
        </div>
      )}
    </LightboxContext.Provider>
  );
}
