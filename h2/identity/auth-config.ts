import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { z } from "zod";

import { requireEnv } from "@/h2/config/schema";

/**
 * §31.1: Auth.js + Google OAuth.
 *
 * getGoogleOAuthCredentials() je PŘÍSNÁ (fail-closed přes requireEnv) —
 * pro testy a případné budoucí startup/health kontroly, kde je chybějící
 * konfigurace skutečná chyba, kterou chceme nahlas.
 *
 * buildAuthConfig() je záměrně NEHÁZEJÍCÍ. `auth.ts` volá NextAuth(config)
 * na module scope a Next.js `next build` route collection fáze modul
 * naimportuje i bez requestu (např. v CI, kde H2_GOOGLE_CLIENT_ID
 * neexistuje) — kdyby buildAuthConfig() házel, spadl by celý build přesně
 * tím, čemu KROK 0 (BUILD-01) zabraňoval. Bez konfigurace vrátí prázdné
 * providers pole; NextAuth v takovém stavu nikoho nepřihlásí (degradovaný,
 * ne rozbitý stav) — skutečná chyba se projeví až při pokusu o přihlášení,
 * ne při buildu.
 */
export function getGoogleOAuthCredentials(source: Record<string, string | undefined> = process.env) {
  return requireEnv(
    {
      H2_GOOGLE_CLIENT_ID: z.string().min(1),
      H2_GOOGLE_CLIENT_SECRET: z.string().min(1),
      H2_AUTH_SECRET: z.string().min(1),
    },
    source,
  );
}

export function buildAuthConfig(source: Record<string, string | undefined> = process.env): NextAuthConfig {
  const clientId = source.H2_GOOGLE_CLIENT_ID;
  const clientSecret = source.H2_GOOGLE_CLIENT_SECRET;
  const authSecret = source.H2_AUTH_SECRET;

  const providers =
    clientId && clientSecret ? [Google({ clientId, clientSecret })] : [];

  return {
    secret: authSecret,
    providers,
    session: {
      strategy: "jwt",
    },
    cookies: {
      sessionToken: {
        options: {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
        },
      },
    },
  };
}
