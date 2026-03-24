import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const revalidate = 60;

async function getStats() {
  const { count } = await supabase
    .from("suggestions")
    .select("*", { count: "exact", head: true });

  const { data: lastRun } = await supabase
    .from("runs")
    .select("finished_at,new_suggestions")
    .eq("status", "completed")
    .order("finished_at", { ascending: false })
    .limit(1)
    .single();

  return {
    total: count ?? 0,
    lastRun: lastRun?.finished_at ?? null,
    lastNew: lastRun?.new_suggestions ?? 0,
  };
}

export default async function Home() {
  const stats = await getStats();

  const words = [
    "jak zhubnout","jak se naučit anglicky","jak upéct chleba",
    "jak na daňové přiznání","jak vyčistit pračku","jak pěstovat rajčata",
    "jak na bolest zad","jak vařit rýži","jak změnit heslo",
    "jak funguje hypotéka","jak meditovat","jak psát životopis",
    "jak odstranit vodní kámen","jak založit živnost","jak lépe spát",
    "počasí praha","kurz dolaru","recept na svíčkovou",
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex justify-between items-center px-8 py-5 border-b border-black/10 text-[11px] uppercase tracking-wider text-[var(--muted)]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {stats.total.toLocaleString("cs")} frází v databázi
        </div>
        <div>good-inventions.work</div>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col justify-center items-center px-8 py-20 text-center relative">
        <h1 className="font-serif text-[clamp(48px,10vw,120px)] leading-[0.92] tracking-tight mb-6 fade-up">
          Co Češi<br /><em className="text-[var(--accent)]">hledají</em>
        </h1>
        <p className="text-sm text-[var(--muted)] max-w-md leading-relaxed font-light fade-up-delay">
          Automaticky sbíráme data z našeptávače Seznam.cz.
          Každých 6 hodin crawler projde strom prefixů a uloží,
          co lidé hledají.
        </p>
        <Link
          href="/suggest"
          className="mt-8 px-6 py-3 border border-[var(--ink)] text-sm uppercase tracking-wider hover:bg-[var(--ink)] hover:text-[var(--paper)] transition-colors fade-up-delay"
        >
          Prozkoumat data →
        </Link>
      </div>

      {/* Ticker */}
      <div className="border-y border-black/10 py-3.5 overflow-hidden">
        <div className="flex gap-12 animate-ticker whitespace-nowrap w-max">
          {[...words, ...words].map((w, i) => (
            <span key={i} className="text-[13px] text-[var(--muted)]">
              <b className="text-[var(--ink)] font-medium">{w}</b>
            </span>
          ))}
        </div>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-t border-black/10 text-[11px] uppercase tracking-wider text-[var(--muted)]">
        <div className="px-8 py-5 md:border-r border-black/10 flex items-center gap-2">
          Poslední crawl
          <span className="text-[13px] text-[var(--ink)] font-medium normal-case tracking-normal">
            {stats.lastRun
              ? new Date(stats.lastRun).toLocaleString("cs-CZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
              : "—"}
          </span>
        </div>
        <div className="px-8 py-5 md:border-r border-black/10 flex items-center gap-2">
          Nových frází
          <span className="text-[13px] text-[var(--ink)] font-medium normal-case tracking-normal">
            +{stats.lastNew}
          </span>
        </div>
        <div className="px-8 py-5 flex items-center gap-2 md:justify-end">
          Stack
          <span className="text-[13px] text-[var(--ink)] font-medium normal-case tracking-normal">
            Next.js · Supabase · Python
          </span>
        </div>
      </div>
    </div>
  );
}
