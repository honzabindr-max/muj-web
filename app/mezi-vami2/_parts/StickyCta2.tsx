"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Mobilní sticky CTA: zobrazí se, jakmile hero CTA odjede z obrazovky,
// a skryje se u závěrečného CTA. Cíl i text beze změny (stejný krok funnelu).
export function StickyCta2() {
  const [heroOut, setHeroOut] = useState(false);
  const [finalIn, setFinalIn] = useState(false);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const hero = document.getElementById("mv2-hero-cta");
    const end = document.getElementById("mv2-final");
    const ios: IntersectionObserver[] = [];
    if (hero) {
      const io = new IntersectionObserver(([e]) => setHeroOut(!e.isIntersecting && e.boundingClientRect.top < 0));
      io.observe(hero);
      ios.push(io);
    }
    if (end) {
      const io = new IntersectionObserver(([e]) => setFinalIn(e.isIntersecting));
      io.observe(end);
      ios.push(io);
    }
    return () => ios.forEach((io) => io.disconnect());
  }, []);

  const visible = heroOut && !finalIn;
  return (
    <div className="mv2-sticky" aria-hidden={!visible} data-visible={visible}>
      <Link href="/mezi-vami/osoba" prefetch={false} tabIndex={visible ? 0 : -1} className="mv2-sticky-cta">
        {"Objevit Vztahovou DNA zdarma "}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
