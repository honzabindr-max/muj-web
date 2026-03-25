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
      const [sr, gr] = await Promise.all([
        supabase.from("suggestions").select("phrase").order("id",{ascending:false}).limit(6),
        supabase.from("google_suggestions").select("phrase").order("id",{ascending:false}).limit(6),
      ]);
      if (sr.data) setSeznamRecent(sr.data.map((r:any)=>r.phrase));
      if (gr.data) setGoogleRecent(gr.data.map((r:any)=>r.phrase));
    }
    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, []);

  function pct(s:CrawlState|null) { return s?.queue_size ? Math.round(s.processed/s.queue_size*100) : 0; }
  function qRemain(s:CrawlState|null) { try { return JSON.parse(s?.queue||"[]").length; } catch { return 0; } }
  function nextQ(s:CrawlState|null) { try { return JSON.parse(s?.next_queue||"[]").length; } catch { return 0; } }
  function isRunning(s:CrawlState|null) { return s?.status==="running"; }
  function statusLabel(s:CrawlState|null) {
    if (!s) return "Neznámý stav";
    if (s.status==="running") return "Crawluje";
    if (s.status==="completed") return "Dokončeno";
    return s.status.charAt(0).toUpperCase()+s.status.slice(1);
  }
  function elapsed(s:CrawlState|null) {
    if (!s?.started_at) return "—";
    const sec=Math.round((Date.now()-new Date(s.started_at).getTime())/1000);
    const h=Math.floor(sec/3600);const m=Math.floor((sec%3600)/60);
    return h>0?h+"h "+m+"m":m+"m";
  }
  function lastUpdate(s:CrawlState|null) {
    if (!s?.updated_at) return "—";
    return new Date(s.updated_at).toLocaleTimeString("cs-CZ",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  }
  const total=seznamCount+googleCount;
  const active=(isRunning(seznamState)?1:0)+(isRunning(googleState)?1:0);

  function CrawlerCard({name,color,count,state,recent}:{name:string;color:string;count:number;state:CrawlState|null;recent:string[]}) {
    const grad=color==="red"?"from-red-500/10 to-orange-500/10":"from-blue-500/10 to-cyan-500/10";
    const bar=color==="red"?"from-red-500 to-orange-500":"from-blue-500 to-cyan-500";
    const dot=color==="red"?"bg-red-500":"bg-blue-500";
    const ring=color==="red"?"border-red-100 ring-red-500/10":"border-blue-100 ring-blue-500/10";
    return (
      <section className={"rounded-3xl border bg-white shadow-sm ring-1 "+ring+" overflow-hidden"}>
        <div className={"bg-gradient-to-br "+grad+" px-6 py-6"}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className={"h-2.5 w-2.5 rounded-full "+dot+(isRunning(state)?" animate-pulse":"")} />
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">Zdroj</p>
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">{name}</h2>
            </div>
            <div className={"rounded-2xl border px-3 py-2 text-xs font-medium "+(isRunning(state)?"bg-emerald-50 text-emerald-700 border-emerald-200":"bg-zinc-100 text-zinc-600 border-zinc-200")}>{statusLabel(state)}</div>
          </div>
          <div className="mt-8 flex items-end justify-between gap-4">
            <div>
              <div className="text-sm text-zinc-500">Celkem frází</div>
              <div className="mt-1 text-5xl font-semibold tracking-tight text-zinc-950 md:text-6xl">{count.toLocaleString("cs")}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-zinc-500">Aktivní prefix</div>
              <div className="mt-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm">{isRunning(state)&&state?.current_prefix?'"'+state.current_prefix+'"':"—"}</div>
            </div>
          </div>
        </div>
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-900">Průběh crawleru</div>
                <div className="text-sm text-zinc-500">{state?"Hloubka "+state.current_depth+" — "+state.processed+"/"+state.queue_size:"Stav není k dispozici"}</div>
              </div>
              <div className="text-sm font-semibold text-zinc-900">{pct(state)}%</div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-100">
              <div className={"h-full rounded-full bg-gradient-to-r "+bar+" transition-all duration-700"} style={{width:pct(state)+"%"}} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                {l:"Dotazy",v:state?state.queries_total.toLocaleString("cs"):"—"},
                {l:"Nové fráze",v:state?"+"+state.new_total.toLocaleString("cs"):"—"},
                {l:"Fronta teď",v:qRemain(state).toLocaleString("cs")},
                {l:"Další hloubka",v:nextQ(state).toLocaleString("cs"),sub:"prefixů"},
              ].map(s=>(
                <div key={s.l} className="surface-muted p-5">
                  <div className="label-ui">{s.l}</div>
                  <div className="kpi-value mt-2">{s.v}</div>
                  {s.sub&&<div className="mt-1 text-sm text-zinc-500">{s.sub}</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="surface-muted p-5">
            <div className="text-sm font-medium text-zinc-900">Live detail</div>
            <div className="mt-4 space-y-3 text-sm">
              {[
                {l:"Status",v:statusLabel(state)},
                {l:"Hloubka",v:state?String(state.current_depth):"—"},
                {l:"Zpracováno",v:state?state.processed+"/"+state.queue_size:"—"},
                {l:"Běží",v:elapsed(state)},
                {l:"Aktualizováno",v:lastUpdate(state)},
              ].map(r=>(
                <div key={r.l} className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">{r.l}</span>
                  <span className="font-medium text-zinc-900">{r.v}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-zinc-200 pt-5">
              <div className="text-sm font-medium text-zinc-900">Poslední fráze</div>
              <div className="mt-3 space-y-2">
                {recent.length?recent.map((p,i)=>(
                  <div key={i} className="rounded-lg bg-white px-3 py-1.5 text-sm border border-zinc-100">{p}</div>
                )):(
                  <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-3 py-6 text-center text-sm text-zinc-500">Zatím žádné fráze.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="surface mb-6 flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950">← Zpět</Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Crawler Dashboard</h1>
                <span className={"inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium "+(active>0?"border-emerald-200 bg-emerald-50 text-emerald-700":"border-zinc-200 bg-zinc-50 text-zinc-600")}>{active>0?active+" aktivní":"Standby"}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">Přehled sběru návrhů v reálném čase.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
            <div className="surface-muted px-4 py-3 text-right">
              <div className="label-ui">Aktualizace</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">každé 3 s</div>
            </div>
            <div className="surface-muted px-4 py-3 text-right">
              <div className="label-ui">Projekt</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">good-inventions.work</div>
            </div>
          </div>
        </div>

        <section className="surface mb-8 p-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="label-ui">Celkový přehled</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">{total.toLocaleString("cs")} unikátních frází</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">Data ze Seznamu a Googlu. Crawlery běží non-stop přes GitHub Actions.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="surface p-5"><div className="label-ui">Seznam.cz</div><div className="kpi-value mt-2">{seznamCount.toLocaleString("cs")}</div><div className="mt-1 text-sm text-zinc-500">{statusLabel(seznamState)}</div></div>
              <div className="surface p-5"><div className="label-ui">Google.cz</div><div className="kpi-value mt-2">{googleCount.toLocaleString("cs")}</div><div className="mt-1 text-sm text-zinc-500">{statusLabel(googleState)}</div></div>
              <div className="surface p-5"><div className="label-ui">Aktivních</div><div className="kpi-value mt-2">{active}</div><div className="mt-1 text-sm text-zinc-500">{active>0?"crawluje":"žádný aktivní"}</div></div>
            </div>
          </div>
        </section>

        <div className="space-y-8">
          <CrawlerCard name="Seznam.cz" color="red" count={seznamCount} state={seznamState} recent={seznamRecent} />
          <CrawlerCard name="Google.cz" color="blue" count={googleCount} state={googleState} recent={googleRecent} />
        </div>

        <footer className="mt-8 flex flex-col gap-2 border-t border-zinc-200 px-1 pt-5 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Realtime monitoring dashboard</span>
          <span>{new Date().toLocaleDateString("cs-CZ")} • good-inventions.work</span>
        </footer>
      </div>
    </div>
  );
}
