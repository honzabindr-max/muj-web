import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Dual } from "../../_lib/Dual";
import VysledekD from "../../_v/VysledekD";
import VysledekM from "../../_v/VysledekM";
import { DnaViewProvider } from "../../_v/view";
import { loadResult } from "@/mezi-vami/result";
import { ResultRecovery, TrackOnce } from "../../_parts/ResultClient";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }>; searchParams?: Promise<{ psani?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const r = await loadResult(id).catch(() => null);
  const theme = r?.state === "ready" ? r.view.pair.mainTheme.title : "Vztahová DNA";
  // bez jmen: odkaz může otevřít kdokoli
  return {
    title: "Vztahová DNA",
    openGraph: { title: `Vztahová DNA – ${theme}`, description: "Spočítejte si svou na MEZI VÁMI." },
    twitter: { card: "summary_large_image" },
  };
}

// Skutečný výsledek: uložený výpočet + texty z DB. Jména dosazuje jen prohlížeč, který výpočet spustil.
export default async function MeziVamiVysledekId({ params, searchParams }: Params) {
  const { id } = await params;
  // ?psani=<id> zobrazí konkrétní verzi textu (srovnání modelů a zadání); jinak nejnovější
  const psani = (await searchParams)?.psani;
  const r = await loadResult(id, psani).catch((e) => {
    console.error("[mezi-vami/vysledek]", e instanceof Error ? e.message : e);
    return null;
  });
  if (!r) return <ResultRecovery id={id} failed />;
  if (r.state === "missing") notFound();
  if (r.state === "writing") return <ResultRecovery id={id} />;
  return (
    <DnaViewProvider view={r.view}>
      <TrackOnce event="vysledek_view" />
      <Dual
        bg="#0E070F"
        landmark
        desktop={<VysledekD sampleState="s0" />}
        mobile={<VysledekM sampleState="s0" />}
      />
    </DnaViewProvider>
  );
}
