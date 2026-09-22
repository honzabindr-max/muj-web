import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getServerSessionUser } from "@/sam-byt/auth/server-session";
import { getListingById } from "@/sam-byt/data/listings";

import { DetailView } from "../../_components/detail-view";
import { LoginForm } from "../../_components/login-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SAM-BYT — detail",
  robots: { index: false, follow: false },
};

export default async function SamBytDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = getListingById(id);
  if (!listing) notFound();

  const sessionUser = await getServerSessionUser();
  if (!sessionUser) {
    return <LoginForm />;
  }

  return <DetailView listing={listing} username={sessionUser.username} />;
}
