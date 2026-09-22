import type { Metadata } from "next";

import { getServerSessionUser } from "@/sam-byt/auth/server-session";
import { getAllListings } from "@/sam-byt/data/listings";

import { AppShell } from "./_components/app-shell";
import { LoginForm } from "./_components/login-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SAM-BYT",
  robots: { index: false, follow: false },
};

export default async function SamBytPage() {
  const sessionUser = await getServerSessionUser();
  if (!sessionUser) {
    return <LoginForm />;
  }
  return <AppShell listings={getAllListings()} username={sessionUser.username} displayName={sessionUser.displayName} />;
}
