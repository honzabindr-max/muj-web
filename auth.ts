import NextAuth from "next-auth";

import { getH2Pool } from "@/h2/db/pool";
import { recordIdentityEvent } from "@/h2/identity/audit";
import { buildAuthConfig } from "@/h2/identity/auth-config";
import { enrollOrVerifyOwner } from "@/h2/identity/owner-enrollment";
import { markRecentReauth } from "@/h2/identity/session";

/**
 * BUILD-03A wiring. buildAuthConfig() je nehážející (viz h2/identity/
 * auth-config.ts) — bez H2_GOOGLE_CLIENT_ID/SECRET dostane prázdné
 * providers pole, nikdy nespadne `next build`. getH2Pool()/DB volání jsou
 * uvnitř callbacků, tedy líné — spustí se jen při skutečném sign-in
 * requestu, ne při importu tohoto souboru.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...buildAuthConfig(),
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !account.providerAccountId) {
        return false;
      }
      const pool = getH2Pool();
      const result = await enrollOrVerifyOwner(pool, account.providerAccountId, user.name ?? "Owner");
      if (result.rejected) {
        await recordIdentityEvent(pool, null, "LOGIN_REJECTED_UNKNOWN_OWNER");
        return false;
      }
      await markRecentReauth(pool, result.ownerId);
      await recordIdentityEvent(pool, result.ownerId, "LOGIN_SUCCESS");
      return true;
    },
    async jwt({ token, account }) {
      if (account?.providerAccountId) {
        token.googleSub = account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.googleSub === "string") {
        session.googleSub = token.googleSub;
      }
      return session;
    },
  },
});
