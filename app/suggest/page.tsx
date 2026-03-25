"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type CrawlState = {
  current_depth:number; status:string; processed:number; queue_size:number;
  current_prefix:string; queries_total:number; new_total:number;
  updated_at:string; started_at:string; queue:string; next_queue:string;
};

export default function SuggestPage() {
  const [seznamCount, setSeznamCount] = useState(0);
  const [googleCount, setGoogleCount] = useState(0);
  const [seznamState, setSeznamState] = useState<CrawlState|null>(null);
  const [googleState, setGoogleState] = useState<CrawlState|null>(null);
  const [seznamLatest, setSeznamLatest] = useState("");
  const [googleLatest, setGoogleLatest] = useState("");
  const [seznamRecent, setSeznamRecent] = useState<string[]>([]);
  const [googleRecent, setGoogleRecent] = useState<string[]>([]);

  useEffect(() => {
    async function poll() {
      const [sc, gc] = await Promise.all([
        supabase.from("suggestions").select("*",{count:"exact",head:true}),
        supabase.from("google_suggestions").select("*",{count:"exact",head:true}),
      ]);
      if (sc.count!==null) setSeznamCount(sc.count);
      if (gc.count!==null) setGoogleCount(gc.count);

      const [ss, gs] = await Promise.all([
        supabase.from("crawl_state").select("*").eq("id",1).single(),
        supabase.from("google_crawl_state").select("*").eq("id",1).single(),
      ]);
      if (ss.data) setSeznamState(ss.data as CrawlState);
      if (gs.data) setGoogleState(gs.data as CrawlState);

      const [sl, gl, sr, gr] = await Promise.all([
        supabase.from("suggestions").select("phrase").order("id",{ascending:false}).limit(1).single(),
        supabase.from("google_suggestions").select("phrase").order("id",{ascending:false}).limit(1).single(),
        supabase.from("suggestions").select("phrase").order("id",{ascending:false}).limit(8),
        supabase.from("google_suggestions").select("phrase").order("id",{ascending:false}).limit(8),
      ]);
      if (sl.data) setSeznamLatest(sl.data.phrase);
      if (gl.data) setGoogleLatest(gl.data.phrase);
      if (sr.data) setSeznamRecent(sr.data.map((r:any)=>r.phrase));
      if (gr.data) setGoogleRecent(gr.data.map((r:any)=>r.phrase));
    }
    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, []);

  function pct(s:CrawlState|null) {
    if (!s || !s.queue_size) return 0;
    return Math.round(s.processed / s.queue_size * 100);
  }
  function qRemain(s:CrawlState|null) {
    if (!s) return 0;
    try { return JSON.parse(s.queue).length; } catch { return 0; }
  }
  function nextQ(s:CrawlState|null) {
    if (!s) return 0;
    try { return JSON.parse(s.next_queue).length; } catch { return 0; }
  }
  function elapsed(s:CrawlState|null) {
    if (!s?.started_at) return "—";
    const sec = Math.round((Date.now()-new Date(s.started_at).getTime())/1000);
    const h=Math.floor(sec/3600); const m=Math.floor((sec%3600)/60);
    if (h>0) return h+"h "+m+"m";
    return m+"m";
  }
  function isRunning(s:CrawlState|null) { return s?.status==="running"; }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <div className="flex justify-between items-center px-8 py-5 border-b border-black/10 text-[11px] uppercase tracking-wider text-[var(--muted)]">
        <Link href="/" className="hover:text-[var(--ink)] transition-colors">← Zpět</Link>
        <div className="flex items-center gap-3">
          {(isRunning(seznamState) || isRunning(googleState)) && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
          Crawler dashboard
        </div>
      </div>

      {/* Two big counters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-black/10 border-b border-black/10">

        {/* Seznam */}
        <div className="bg-[var(--paper)] flex flex-col items-center py-12 md:py-16 px-6">
          <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1">Seznam.cz</div>
          <div className="font-serif text-[80px] md:text-[110px] lg:text-[130px] leading-none tracking-tight">
            {seznamCount.toLocaleString("cs")}
          </div>
          <div className="text-[11px] text-[var(--muted)] mt-2">frází</div>
          {isRunning(seznamState) && seznamState && (
            <div className="mt-6 w-full max-w-xs flex flex-col items-center gap-2">
              <div className="font-mono text-2xl font-medium text-[var(--ink)] bg-white px-4 py-1.5 border border-black/10">
                &quot;{seznamState.current_prefix}&quot;
              </div>
              <div className="w-full">
                <div className="flex justify-between text-[10px] text-[var(--muted)] mb-0.5">
                  <span>Hloubka {seznamState.current_depth} — {pct(seznamState)}%</span>
                  <span>{seznamState.processed}/{seznamState.queue_size}</span>
                </div>
                <div className="w-full h-1.5 bg-black/5 overflow-hidden">
                  <div className="h-full bg-[var(--accent)] transition-all duration-1000" style={{width:pct(seznamState)+"%"}} />
                </div>
              </div>
            </div>
          )}
          {!isRunning(seznamState) && (
            <div className="mt-4 text-[11px] text-[var(--muted)]">
              {seznamState?.status==="completed" ? "✓ Crawl dokončen" : "○ Idle"}
            </div>
          )}
        </div>

        {/* Google */}
        <div className="bg-[var(--paper)] flex flex-col items-center py-12 md:py-16 px-6">
          <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1">Google.cz</div>
          <div className="font-serif text-[80px] md:text-[110px] lg:text-[130px] leading-none tracking-tight">
            {googleCount.toLocaleString("cs")}
          </div>
          <div className="text-[11px] text-[var(--muted)] mt-2">frází</div>
          {isRunning(googleState) && googleState && (
            <div className="mt-6 w-full max-w-xs flex flex-col items-center gap-2">
              <div className="font-mono text-2xl font-medium text-[var(--ink)] bg-white px-4 py-1.5 border border-black/10">
                &quot;{googleState.current_prefix}&quot;
              </div>
              <div className="w-full">
                <div className="flex justify-between text-[10px] text-[var(--muted)] mb-0.5">
                  <span>Hloubka {googleState.current_depth} — {pct(googleState)}%</span>
                  <span>{googleState.processed}/{googleState.queue_size}</span>
                </div>
                <div className="w-full h-1.5 bg-black/5 overflow-hidden">
                  <div className="h-full bg-[#4285f4] transition-all duration-1000" style={{width:pct(googleState)+"%"}} />
                </div>
              </div>
            </div>
          )}
          {!isRunning(googleState) && (
            <div className="mt-4 text-[11px] text-[var(--muted)]">
              {googleState?.status==="completed" ? "✓ Crawl dokončen" : "○ Idle"}
            </div>
          )}
        </div>
      </div>

      {/* Combined total */}
      <div className="flex items-center justify-center py-4 border-b border-black/10 bg-white/50">
        <span className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Celkem</span>
        <span className="font-serif text-3xl ml-3 tracking-tight">{(seznamCount+googleCount).toLocaleString("cs")}</span>
        <span className="text-[11px] text-[var(--muted)] ml-2">unikátních frází</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-black/10 border-b border-black/10">
        {[
          { label:"Seznam hloubka", value: seznamState ? String(seznamState.current_depth) : "—" },
          { label:"Seznam dotazů", value: seznamState ? seznamState.queries_total.toLocaleString("cs") : "—" },
          { label:"Google hloubka", value: googleState ? String(googleState.current_depth) : "—" },
          { label:"Google dotazů", value: googleState ? googleState.queries_total.toLocaleString("cs") : "—" },
          { label:"Seznam fronta", value: qRemain(seznamState).toLocaleString("cs") },
          { label:"Seznam další hl.", value: nextQ(seznamState).toLocaleString("cs")+" prefixů" },
          { label:"Google fronta", value: qRemain(googleState).toLocaleString("cs") },
          { label:"Google další hl.", value: nextQ(googleState).toLocaleString("cs")+" prefixů" },
        ].map(s => (
          <div key={s.label} className="bg-[var(--paper)] px-5 py-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">{s.label}</div>
            <div className="text-lg font-medium">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Recent phrases side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-black/10 border-b border-black/10">
        <div className="bg-[var(--paper)] px-6 py-5">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-3">Poslední ze Seznamu</div>
          {seznamRecent.map((p,i) => (
            <div key={i} className="text-sm py-1 border-b border-black/5 last:border-0">{p}</div>
          ))}
        </div>
        <div className="bg-[var(--paper)] px-6 py-5">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-3">Poslední z Google</div>
          {googleRecent.map((p,i) => (
            <div key={i} className="text-sm py-1 border-b border-black/5 last:border-0">{p}</div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-5 border-t border-black/10 text-[11px] text-[var(--muted)] flex justify-between">
        <span>Aktualizace každé 3s</span>
        <span>good-inventions.work</span>
      </div>
    </div>
  );
}
