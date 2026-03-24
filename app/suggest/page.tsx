"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Suggestion = { id:number; phrase:string; first_seen_at:string; last_seen_at:string; seen_count:number };
type CrawlState = { current_depth:number; status:string; processed:number; queue_size:number; current_prefix:string; queries_total:number; new_total:number; updated_at:string; started_at:string; queue:string; next_queue:string };

export default function SuggestPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"phrase"|"first_seen_at"|"seen_count">("first_seen_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [state, setState] = useState<CrawlState|null>(null);
  const [latestPhrase, setLatestPhrase] = useState("");

  useEffect(() => {
    async function poll() {
      const { count } = await supabase.from("suggestions").select("*",{count:"exact",head:true});
      if (count!==null) setLiveCount(count);
      const { data:s } = await supabase.from("crawl_state").select("*").eq("id",1).single();
      if (s) setState(s as CrawlState);
      const { data:n } = await supabase.from("suggestions").select("phrase").order("id",{ascending:false}).limit(1).single();
      if (n) setLatestPhrase(n.phrase);
    }
    poll(); const iv=setInterval(poll,2000); return ()=>clearInterval(iv);
  }, []);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("suggestions").select("*").order("first_seen_at",{ascending:false}).limit(1000);
      setSuggestions(data ?? []); setLoading(false);
    }
    load(); const iv=setInterval(load,15000); return ()=>clearInterval(iv);
  }, []);

  const filtered = useMemo(() => {
    let r = suggestions;
    if (search) { const q=search.toLowerCase(); r=r.filter(s=>s.phrase.toLowerCase().includes(q)); }
    r.sort((a,b) => {
      const av=a[sortBy],bv=b[sortBy];
      if (typeof av==="string"&&typeof bv==="string") return sortAsc?av.localeCompare(bv):bv.localeCompare(av);
      if (typeof av==="number"&&typeof bv==="number") return sortAsc?av-bv:bv-av;
      return 0;
    });
    return r;
  }, [suggestions, search, sortBy, sortAsc]);

  const pct = state && state.queue_size>0 ? Math.round(state.processed/state.queue_size*100) : 0;
  const isRunning = state?.status==="running";
  const nextQueueSize = state?.next_queue ? JSON.parse(state.next_queue).length : 0;
  const queueRemaining = state?.queue ? JSON.parse(state.queue).length : 0;

  function elapsed() {
    if (!state?.started_at) return "—";
    const s = Math.round((Date.now()-new Date(state.started_at).getTime())/1000);
    const m=Math.floor(s/60); const sec=s%60;
    return m+"m "+sec+"s";
  }

  function handleSort(col:typeof sortBy) {
    if (sortBy===col) setSortAsc(!sortAsc); else { setSortBy(col); setSortAsc(col==="phrase"); }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex justify-between items-center px-8 py-5 border-b border-black/10 text-[11px] uppercase tracking-wider text-[var(--muted)]">
        <Link href="/" className="hover:text-[var(--ink)] transition-colors">← Zpět</Link>
        <div className="flex items-center gap-2">
          {isRunning && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
          {isRunning ? "Crawler běží" : "Crawler idle"}
        </div>
      </div>

      {/* MEGA counter */}
      <div className="flex flex-col items-center py-12 md:py-20 border-b border-black/10">
        <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-3">Frází v databázi</div>
        <div className="font-serif text-[100px] md:text-[160px] lg:text-[200px] leading-none tracking-tight">{liveCount.toLocaleString("cs")}</div>

        {isRunning && state && (
          <div className="mt-8 flex flex-col items-center gap-3 w-full max-w-lg">
            <div className="text-[13px] text-[var(--muted)]">Dotazuji Seznam.cz na:</div>
            <div className="font-mono text-4xl md:text-5xl font-medium text-[var(--ink)] bg-white px-6 py-3 border border-black/10">&quot;{state.current_prefix}&quot;</div>
            <div className="text-xs text-[var(--muted)]">Poslední nalezená: <span className="text-[var(--ink)] font-medium">{latestPhrase}</span></div>

            {/* Progress bar */}
            <div className="w-full mt-4">
              <div className="flex justify-between text-[11px] text-[var(--muted)] mb-1">
                <span>Hloubka {state.current_depth} — {pct}%</span>
                <span>{state.processed} / {state.queue_size} prefixů</span>
              </div>
              <div className="w-full h-2 bg-black/5 overflow-hidden">
                <div className="h-full bg-[var(--accent)] transition-all duration-1000" style={{width:pct+"%"}} />
              </div>
            </div>
          </div>
        )}

        {!isRunning && state?.status==="completed" && (
          <div className="mt-6 text-lg text-emerald-700 font-medium">Crawl dokončen</div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-black/10 border-b border-black/10">
        {[
          { label:"Hloubka", value: state ? String(state.current_depth) : "—" },
          { label:"Dotazů celkem", value: state ? state.queries_total.toLocaleString("cs") : "—" },
          { label:"Nových frází", value: state ? "+"+state.new_total.toLocaleString("cs") : "—" },
          { label:"Fronta zbývá", value: String(queueRemaining) },
          { label:"Další hloubka", value: nextQueueSize.toLocaleString("cs")+" prefixů" },
        ].map(s => (
          <div key={s.label} className="bg-[var(--paper)] px-5 py-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">{s.label}</div>
            <div className="text-lg font-medium">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="px-8 py-5 border-b border-black/10">
        <input type="text" placeholder="Hledat ve frázích..." value={search} onChange={e=>setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 bg-white border border-black/15 text-sm font-mono outline-none focus:border-[var(--accent)] transition-colors" />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        {loading ? <div className="px-8 py-20 text-center text-[var(--muted)]">Načítám...</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-black/10 text-[11px] uppercase tracking-wider text-[var(--muted)]">
              <th className="text-left px-8 py-3 cursor-pointer hover:text-[var(--ink)]" onClick={()=>handleSort("phrase")}>Fráze {sortBy==="phrase"?(sortAsc?"↑":"↓"):""}</th>
              <th className="text-left px-4 py-3 cursor-pointer hover:text-[var(--ink)] hidden md:table-cell" onClick={()=>handleSort("first_seen_at")}>Poprvé {sortBy==="first_seen_at"?(sortAsc?"↑":"↓"):""}</th>
              <th className="text-right px-8 py-3 cursor-pointer hover:text-[var(--ink)]" onClick={()=>handleSort("seen_count")}>Viděno× {sortBy==="seen_count"?(sortAsc?"↑":"↓"):""}</th>
            </tr></thead>
            <tbody>{filtered.slice(0,200).map(s => (
              <tr key={s.id} className="border-b border-black/5 hover:bg-black/[0.02] transition-colors">
                <td className="px-8 py-3 font-medium">{s.phrase}</td>
                <td className="px-4 py-3 text-[var(--muted)] hidden md:table-cell">{new Date(s.first_seen_at).toLocaleDateString("cs-CZ",{day:"numeric",month:"short"})}</td>
                <td className="px-8 py-3 text-right text-[var(--muted)]">{s.seen_count}×</td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {!loading && filtered.length>200 && <div className="px-8 py-4 text-[var(--muted)] text-xs">Zobrazeno 200 z {filtered.length}.</div>}
      </div>

      <div className="px-8 py-5 border-t border-black/10 text-[11px] text-[var(--muted)] flex justify-between">
        <span>Aktualizace každé 2s</span><span>good-inventions.work</span>
      </div>
    </div>
  );
}
