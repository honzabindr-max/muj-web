'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/cesky-raj-2026/sw.js').catch(() => {
      // offline-first is a nice-to-have; ignore registration failures
    });
  }, []);

  return null;
}
