"use client";

import { signIn } from "next-auth/react";

/**
 * Vynucuje NOVÝ Google OAuth round-trip (ne jen existující session cookie)
 * — `signIn()` vždy projde providerem, takže `auth.ts`'s `signIn` callback
 * znovu zavolá `markRecentReauth()` (BUILD-03A, už produkčně zapojené).
 * Tahle stránka nepřidává žádnou novou re-auth logiku, jen dává Honzíkovi
 * explicitní tlačítko, které tenhle už existující mechanismus spustí na
 * požádání, místo čekání na příští přirozené přihlášení.
 */
export function ReauthButton() {
  return (
    <button
      type="button"
      onClick={() => {
        void signIn("google", { callbackUrl: "/honzik2/reauth" });
      }}
      style={{
        padding: "0.75rem 1.25rem",
        fontSize: "1rem",
        fontWeight: 600,
        color: "#fff",
        backgroundColor: "#1a1a1a",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
      }}
    >
      Přihlásit se znovu přes Google
    </button>
  );
}
