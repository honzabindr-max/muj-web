"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Lišta s cenou z Mobil-05: jen v části nabídky (od sekce „Hloubková analýza“ dolů).
// Zobrazení se odvozuje z aktuální polohy, takže při scrollu zpět nad nabídku zase zmizí.
export function StickyBar({ targetId }: { targetId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      setVisible(el.getBoundingClientRect().top <= window.innerHeight * 0.6);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [targetId]);

  return (
    <div
      className="mv-sticky"
      aria-hidden={!visible}
      style={{
        position: "fixed", left: "0", right: "0", bottom: "0", zIndex: 20, padding: "14px 16px 22px",
        background: "linear-gradient(180deg, rgba(20, 10, 22, 0.82), rgba(14, 7, 15, 0.96))",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(240, 190, 165, 0.22)", boxShadow: "0 -20px 50px rgba(0, 0, 0, 0.5)",
        transform: visible ? "translateY(0)" : "translateY(110%)", visibility: visible ? "visible" : "hidden",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto", display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ flex: "1", minWidth: "0" }}>
          <p style={{ margin: "0", fontSize: "12px", color: "#C2ACB7" }}>Hloubková analýza</p>
          <p style={{ margin: "2px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "24px", color: "#F7EAE4" }}>1 990 Kč</p>
        </div>
        <Link
          href="/mezi-vami/objednavka"
          prefetch={false}
          tabIndex={visible ? 0 : -1}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "54px", padding: "0 26px", borderRadius: "999px", background: "linear-gradient(180deg, #F7D5BB 0%, #E8B391 100%)", color: "#2A1220", textDecoration: "none", fontSize: "15px", fontWeight: "500", boxShadow: "0 10px 30px rgba(240, 160, 130, 0.4), 0 0 60px rgba(240, 160, 130, 0.25), inset 0 1px 0 rgba(255, 244, 236, 0.7)" }}
        >
          Objednat <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
