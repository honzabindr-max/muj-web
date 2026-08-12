'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'cesky-raj-2026-banner-dismissed';

export function WifiBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== '1') setDismissed(false);
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  return (
    <div className="raj-banner">
      <span>Načti si stránku na wifi v kempu — pak funguje bez signálu.</span>
      <button
        type="button"
        className="raj-banner__close"
        aria-label="Zavřít"
        onClick={() => {
          setDismissed(true);
          try {
            window.localStorage.setItem(STORAGE_KEY, '1');
          } catch {
            // ignore
          }
        }}
      >
        ×
      </button>
    </div>
  );
}
