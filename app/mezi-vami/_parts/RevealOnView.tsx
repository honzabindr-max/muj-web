"use client";

import { useEffect } from "react";

// Odhalí prvky .mv-rv, až se objeví ve viewportu. Bez JS zůstávají viditelné.
export function RevealOnView() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".mv-rv"));
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("mv-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.25 },
    );
    for (const el of els) {
      el.classList.add("mv-armed");
      io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return null;
}
