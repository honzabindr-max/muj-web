"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Prototyp: výpočet neběží, obrazovka po krátké prodlevě sama přejde dál
// (stejný cíl jako klepnutí na symbol). Bez síťových volání.
export function AutoAdvance({ href, delayMs }: { href: string; delayMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = window.setTimeout(() => router.replace(href), delayMs);
    return () => window.clearTimeout(t);
  }, [href, delayMs, router]);
  return null;
}
