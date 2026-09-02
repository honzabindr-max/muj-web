import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { z } from "zod";

import { requireEnv } from "@/h2/config/schema";

/**
 * §31.1: Auth.js + Google OAuth. Credentials se čtou líně (requireEnv) —
 * import tohoto souboru sám o sobě nikdy nevyžaduje H2_GOOGLE_CLIENT_ID/
 * SECRET, jen samotné VOLÁNÍ getGoogleOAuthCredentials()/buildAuthConfig()
 * ano. Stejný lazy kontrakt jako h2/config (KROK 0, BUILD-01) — chybějící
 * H2 env proměnné nesmí ovlivnit existující stránky.
 *
 * Tento soubor je připravený scaffold. Skutečná `NextAuth(buildAuthConfig())`
 * instance a `app/api/auth/[...nextauth]/route.ts` handler se přidají, až
 * budou existovat reálné H2_GOOGLE_CLIENT_ID / H2_GOOGLE_CLIENT_SECRET —
 * volání NextAuth() by muselo proběhnout na module scope, a Next.js build
 * moduly route handlerů natahuje i bez requestu (route collection), takže
 * dřívější instanciace by mohla shodit `next build` bez H2 env přesně tím,
 * čemu se KROK 0 snažil zabránit.
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
  const { H2_GOOGLE_CLIENT_ID, H2_GOOGLE_CLIENT_SECRET, H2_AUTH_SECRET } = getGoogleOAuthCredentials(source);
  return {
    secret: H2_AUTH_SECRET,
    providers: [
      Google({
        clientId: H2_GOOGLE_CLIENT_ID,
        clientSecret: H2_GOOGLE_CLIENT_SECRET,
      }),
    ],
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
