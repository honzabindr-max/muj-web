import NextAuth from "next-auth";

import { getH2Pool } from "@/h2/db/pool";
import { withOwnerScope } from "@/h2/db/with-owner-scope";
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
 *
 * LOGIN_SUCCESS audit event se zapisuje uvnitř withOwnerScope — má
 * vyplněné owner_id a identity_audit_events má RLS, takže bez SET LOCAL
 * app.owner_id by insert pod rolí h2_runtime spadl (produkční bug,
 * opraveno). LOGIN_REJECTED_UNKNOWN_OWNER má owner_id=null, RLS ho pustí
 * i bez scope.
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
      await withOwnerScope(pool, result.ownerId, (client) =>
        recordIdentityEvent(client, result.ownerId, "LOGIN_SUCCESS"),
      );
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
