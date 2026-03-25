"use client";

import { useEffect, useRef, useState } from "react";

export function useAnimatedNumber(value: number, duration = 700) {
  const [display, setDisplay] = useState(value);
  const previousRef = useRef(value);

  useEffect(() => {
    const start = previousRef.current;
    const end = value;

    if (start === end) {
      setDisplay(end);
      return;
    }

    const startTime = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        previousRef.current = end;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}
