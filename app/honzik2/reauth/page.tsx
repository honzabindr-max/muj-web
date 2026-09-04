import type { Metadata } from "next";

import { auth } from "@/auth";
import { getH2Pool } from "@/h2/db/pool";
import { H2AuthError, H2ReauthRequiredError } from "@/h2/identity/errors";
import { requireOwnerSession, requireRecentReauth } from "@/h2/identity/session";

import { ReauthButton } from "./reauth-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Re-auth — Honzík 2.0",
  robots: { index: false, follow: false },
};

/**
 * BUILD-10 prep — schválený rozsah (Honzík, 2026-09-04): samostatný PR
 * před BUILD-11, JEDNA stránka, ŽÁDNÁ administrace promptů. Aktivace
 * (`activatePromptVersion()`) se pořád spouští ze skriptu/konzole, ne
 * odsud — tahle stránka jen vynutí čerstvé Google přihlášení, aby
 * `requireRecentReauth()` (BUILD-03A, 5min okno) prošlo.
 *
 * `markRecentReauth()` NENÍ nový kód — `auth.ts`'s `signIn` callback ho
 * volá už dnes na KAŽDÉM úspěšném Google přihlášení (BUILD-03A). Tahle
 * stránka nepřidává auth logiku, jen dává Honzíkovi tlačítko, které
 * vynutí NOVÝ OAuth round-trip (ne recyklaci existující session cookie) —
 * bez toho by `signIn` callback nemusel proběhnout znovu, kdyby byl
 * ještě platně přihlášený z dřívějška.
 */
type ReauthStatus =
  | { kind: "unauthenticated" }
  | { kind: "unknown_owner" }
  | { kind: "valid"; recentReauthAt: Date }
  | { kind: "expired"; recentReauthAt: Date | null };

async function loadReauthStatus(googleSub: string | undefined): Promise<ReauthStatus> {
  const pool = getH2Pool();
  let ownerId: string;
  try {
    ({ ownerId } = await requireOwnerSession(pool, googleSub));
  } catch (error) {
    if (error instanceof H2AuthError) {
      return { kind: error.code === "UNAUTHENTICATED" ? "unauthenticated" : "unknown_owner" };
    }
    throw error;
  }

  const result = await pool.query<{ recent_reauth_at: Date | null }>(
    "select recent_reauth_at from owners where id = $1",
    [ownerId],
  );
  const recentReauthAt = result.rows[0]?.recent_reauth_at ?? null;

  try {
    await requireRecentReauth(pool, ownerId);
    // requireRecentReauth() by bez neprázdného recentReauthAt vyhodilo
    // H2ReauthRequiredError samo — pokud sem dorazíme, řádek existuje.
    return { kind: "valid", recentReauthAt: recentReauthAt as Date };
  } catch (error) {
    if (error instanceof H2ReauthRequiredError) {
      return { kind: "expired", recentReauthAt };
    }
    throw error;
  }
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("cs-CZ", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Europe/Prague",
});

export default async function ReauthPage() {
  const session = await auth();
  const status = await loadReauthStatus(session?.googleSub);

  return (
    <main
      style={{
        maxWidth: "32rem",
        margin: "4rem auto",
        padding: "0 1.5rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
        lineHeight: 1.5,
      }}
    >
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Re-auth pro aktivaci promptu</h1>
      <p style={{ color: "#555", marginBottom: "1.5rem" }}>
        Aktivace nové verze promptu (<code>activatePromptVersion()</code>) vyžaduje přihlášení ne
        starší než 5 minut. Tahle stránka jen vynutí nové přihlášení — samotnou aktivaci pořád
        spouští Code ze skriptu.
      </p>

      <div style={{ marginBottom: "1.5rem" }}>
        {status.kind === "unauthenticated" && <p style={{ color: "#b23" }}>Nejsi přihlášený.</p>}
        {status.kind === "unknown_owner" && (
          <p style={{ color: "#b23" }}>Google účet není na allowlistu ownera.</p>
        )}
        {status.kind === "valid" && (
          <p style={{ color: "#0a7d33" }}>
            Přihlášení je čerstvé (od {DATE_TIME_FORMAT.format(status.recentReauthAt)}) — aktivace
            teď projde.
          </p>
        )}
        {status.kind === "expired" && (
          <p style={{ color: "#b23" }}>
            {status.recentReauthAt
              ? `Poslední přihlášení bylo ${DATE_TIME_FORMAT.format(status.recentReauthAt)} — okno vypršelo.`
              : "Žádné dřívější přihlášení nezaznamenáno."}
          </p>
        )}
      </div>

      <ReauthButton />
    </main>
  );
}
