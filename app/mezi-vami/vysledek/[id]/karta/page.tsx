import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { A } from "../../../_lib/A";
import Karta from "../../../_v/Karta";
import { DnaViewProvider } from "../../../_v/view";
import { ShareActions } from "../../../_v/ShareActions";
import { loadResult } from "@/mezi-vami/result";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sdílecí karta", robots: { index: false, follow: false } };

const BTN = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
  padding: "0 18px",
  borderRadius: 999,
  border: "1px solid rgba(240, 190, 165, 0.45)",
  background: "transparent",
  color: "#F7EAE4",
  fontSize: 15,
} as const;

export default async function MeziVamiKartaId({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadResult(id).catch(() => null);
  if (!r || r.state !== "ready") notFound();
  return (
    <DnaViewProvider view={r.view}>
      <div className="mvp" style={{ background: "#0E070F" }}>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: "32px 16px" }}>
          <Karta />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 360 }}>
            <ShareActions labels={["Poslat obrázek", "Uložit do telefonu"]} style={BTN} />
          </div>
          <A href={`/mezi-vami/vysledek/${id}`} style={{ fontSize: 15 }}>
            Zpět na výsledek
          </A>
        </main>
      </div>
    </DnaViewProvider>
  );
}
