"use client";

import { useEffect, useRef, useState } from "react";

export function TempCounter({ target }: { target: number }) {
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setValue(target);
      return;
    }

    const DURATION = 950; // ms
    const start = performance.now();

    function tick(now: number) {
      const p = Math.min((now - start) / DURATION, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setValue(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
      else setValue(target);
    }

    requestAnimationFrame(tick);
  }, [target]);

  return <>{value}</>;
}
