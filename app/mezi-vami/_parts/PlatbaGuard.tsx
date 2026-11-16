"use client";

// /platba bez rozpracované objednávky (přímý odkaz) nemá co ukázat → zpět na úvod.
// Varianty pro kontrolu návrhu (?stav=…) zůstávají dostupné.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PlatbaGuard({ preview }: { preview: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (preview) return;
    let has = false;
    try {
      has = !!window.sessionStorage.getItem("mv:order");
    } catch {
      /* ignorovat */
    }
    if (!has) router.replace("/mezi-vami");
  }, [preview, router]);
  return null;
}
