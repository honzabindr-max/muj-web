// Local live panel: `npm run tars:panel` → http://127.0.0.1:4747
// `/` = TARS Mission Control (owner view), `/zakazka/<id>` = Focus Mode, `/detail` = technical panel.
// Read-only view of runs/*/state.json, runs/log.jsonl, runs/.lock and screenshots, refreshed every 3 s.
// No buttons, no writes, no external dependencies, bound to localhost only.
// Mock data only with ?demo=1 (labelled „Ukázková data“), never mixed with real runs.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scenario, SCENARIOS, type Scenario } from "./mission-control/fixtures";
import { ORDER_RE, readLiveInput, readLog, readOrdersChecked } from "./mission-control/live";
import { buildFinal, buildRolePage } from "./mission-control/final";
import { CSS_FINAL, makeQs, renderFinal, renderRole } from "./mission-control/final-render";
import { CSS_A, CSS_B, renderPreviewA, renderPreviewB } from "./mission-control/preview";
import { q, renderDocument, renderFocusFragment, renderMainFragment } from "./mission-control/render";
import { buildStory } from "./mission-control/story";
import { buildFocus, buildView, type McInput } from "./mission-control/view";
import { scrub, scrubDeep } from "./secret-scan";

const here = path.dirname(fileURLToPath(import.meta.url));
const runsDir = process.env.TARS_RUNS_DIR ?? path.resolve(here, "../../runs");
const port = Number(process.env.TARS_PANEL_PORT ?? 4747);
const cardsDir = path.resolve(here, "../../.claude/agents");

export function listShots(orderDir: string): string[] {
  const out: string[] = [];
  try {
    for (const entry of fs.readdirSync(orderDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".png")) out.push(entry.name);
      if (entry.isDirectory() && entry.name.startsWith("shots-"))
        for (const f of fs.readdirSync(path.join(orderDir, entry.name)).sort())
          if (f.endsWith(".png")) out.push(`${entry.name}/${f}`);
    }
  } catch {
    // missing or removed while reading
  }
  return out;
}

/** Resolves a screenshot path safely inside runs/<order>/; undefined if outside or not a png. */
export function safeShotPath(
  root: string,
  order: string,
  file: string,
): string | undefined {
  if (!ORDER_RE.test(order) || !file.endsWith(".png")) return undefined;
  const base = path.resolve(root, order);
  const full = path.resolve(base, file);
  return full.startsWith(base + path.sep) && fs.existsSync(full)
    ? full
    : undefined;
}

/**
 * Data for /detail. Read-only (never creates runs/ – no Store here) and filtered: every string
 * passes the secret redaction, so tokens in state.json or log.jsonl never leave the server.
 */
export function snapshot(root: string) {
  const generated_at = new Date().toISOString();
  if (!fs.existsSync(root)) return { generated_at, orders: [], log: [], unavailable: "složka runs neexistuje" };
  const { orders, unreadable } = readOrdersChecked(root);
  return scrubDeep({
    generated_at,
    unreadable,
    orders: orders.map((o) => ({
      ...o,
      shots: listShots(path.join(root, o.id)),
    })),
    log: readLog(root).slice(-400),
  });
}

const PAGE = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TARS — technický detail</title><style>
:root{--bg:#14111a;--card:#1e1a26;--ink:#ece6f2;--mute:#9a90a8;--ok:#6cc58a;--warn:#e7b84f;--bad:#e5676b;--acc:#9d7ff0}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 -apple-system,system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:16px}h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;color:var(--mute);margin:20px 0 8px;text-transform:uppercase;letter-spacing:.06em}
.card{background:var(--card);border-radius:10px;padding:12px 14px;margin-bottom:10px}.mute{color:var(--mute)}
.st{display:inline-block;padding:2px 8px;border-radius:99px;font-weight:600;font-size:12px;background:#2c2638}
.DONE,.DELIVERED,.PASS{color:var(--ok)}.WAITING_OWNER,.FIXING,.PAUSED,.FIX{color:var(--warn)}.FAILED,.UNKNOWN,.BLOCK{color:var(--bad)}
table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:5px 6px;border-bottom:1px solid #2c2638;vertical-align:top}th{color:var(--mute);font-weight:500}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}.shots img{width:100%;border-radius:6px;border:1px solid #2c2638}
code{font-size:12px}</style></head><body><main>
<div class="mute"><a style="color:var(--acc)" href="/">← Mission Control</a></div><h1>TARS — technický detail <span class="mute" id="ts"></span></h1><div class="mute">Jen čtení · obnova každé 3 s · zdroj runs/*/state.json a runs/log.jsonl</div>
<div id="app"></div></main><script>
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const su=u=>/^https:\\/\\/[^\\s"'<>]+$/.test(String(u??''))?String(u):'';
const t=s=>s?new Date(s).toLocaleTimeString('cs-CZ'):'';const dur=ms=>ms==null?'':(ms/1000).toFixed(1)+' s';
async function load(){const r=await fetch('/api/state',{cache:'no-store'});const d=await r.json();document.getElementById('ts').textContent='· '+t(d.generated_at);
const active=['NEW','PLANNED','DOING','CHECKING','FIXING','DELIVERED','PAUSED'];
if(d.unavailable){document.getElementById('app').innerHTML='<div class="card">Data nejsou dostupná: '+esc(d.unavailable)+'</div>';return}
const cur=d.orders.find(o=>active.includes(o.state))||d.orders.find(o=>o.state==='WAITING_OWNER')||d.orders[d.orders.length-1];
let h='';if((d.unreadable||[]).length)h+='<div class="card UNKNOWN">Nelze ověřit: '+esc(d.unreadable.length)+' zakázek nejde přečíst (state.json je poškozený nebo neúplný): '+esc(d.unreadable.join(', '))+'</div>';
if(!cur){h+='<div class="card">'+((d.unreadable||[]).length?'Stav zakázek nelze ověřit.':'Žádná zakázka.')+'</div>'}else{
const log=d.log.filter(e=>e.order===cur.id);
const calls=log.filter(e=>e.kind==='call');const roles={};calls.forEach(c=>{roles[c.role]=c.model+(c.family?' · '+c.family:'')});
h+='<h2>Aktuální zakázka</h2><div class="card"><div><b>'+esc(cur.brief?.title||cur.id)+'</b> <span class="st '+esc(cur.state)+'">'+esc(cur.state)+'</span></div>'+
'<div class="mute">'+esc(cur.id)+' · oddělení '+esc(cur.brief?.department||'—')+' · kolo oprav '+esc(cur.fix_rounds)+' · ruční zásahy '+esc(cur.manual_interventions)+'</div>'+
(su(cur.delivered_url)?'<div>Výstup: <a style="color:var(--acc)" rel="noreferrer" href="'+esc(su(cur.delivered_url))+'">'+esc(cur.delivered_url)+'</a></div>':cur.delivered_url?'<div>Výstup: '+esc(cur.delivered_url)+' <span class="mute">(odkaz není https – neaktivní)</span></div>':'')+
(cur.failure_reason?'<div class="FAILED">'+esc(cur.failure_reason)+'</div>':'')+'</div>';
h+='<h2>Modely v rolích</h2><div class="card"><table>'+Object.entries(roles).map(([r,m])=>'<tr><th>'+esc(r)+'</th><td>'+esc(m)+'</td></tr>').join('')+'</table></div>';
h+='<h2>Časová osa</h2><div class="card"><table><tr><th>čas</th><th>přechod / volání</th><th>role · model</th><th>trvání</th><th>výsledek</th></tr>'+
log.filter(e=>e.kind==='transition'||e.kind==='call'||e.kind==='error').map(e=>'<tr><td>'+t(e.ts)+'</td><td>'+(e.kind==='transition'?'<b>'+esc(e.from)+' → <span class="'+esc(e.to)+'">'+esc(e.to)+'</span></b>':esc(e.kind))+'</td><td class="mute">'+esc(e.role||'')+' '+esc(e.model||'')+'</td><td>'+dur(e.duration_ms)+'</td><td class="'+esc(e.result||'')+'">'+esc((e.result||'')+(e.reason?' — '+e.reason:'')).slice(0,240)+'</td></tr>').join('')+'</table></div>';
const v=calls.filter(c=>c.role==='checker');h+='<h2>Verdikty kontrol</h2><div class="card">'+(v.length?v.map(c=>'<div><span class="st '+esc(c.result)+'">'+esc(c.result)+'</span> <span class="mute">'+esc(c.model)+' · '+t(c.ts)+'</span><div>'+esc(c.reason||'')+'</div></div>').join('<hr style="border-color:#2c2638">'):'<span class="mute">zatím žádné</span>')+'</div>';
h+='<h2>Screenshoty z prohlížeče</h2><div class="card">'+(cur.shots.length?'<div class="shots">'+cur.shots.map(s=>'<a href="/shot?order='+encodeURIComponent(cur.id)+'&file='+encodeURIComponent(s)+'"><img loading="lazy" src="/shot?order='+encodeURIComponent(cur.id)+'&file='+encodeURIComponent(s)+'" alt="'+esc(s)+'"></a>').join('')+'</div>':'<span class="mute">žádné</span>')+'</div>';}
h+='<h2>Všechny zakázky</h2><div class="card"><table><tr><th>zakázka</th><th>stav</th><th>opravy</th><th>změna</th></tr>'+d.orders.slice().reverse().map(o=>'<tr><td>'+esc(o.brief?.title||o.id)+'<div class="mute">'+esc(o.id)+'</div></td><td class="'+esc(o.state)+'">'+esc(o.state)+'</td><td>'+esc(o.fix_rounds)+'</td><td>'+t(o.updated_at)+'</td></tr>').join('')+'</table></div>';
document.getElementById('app').innerHTML=h}
function fail(){document.getElementById('ts').textContent='· spojení přerušeno – zobrazená data nelze ověřit'}
load().catch(fail);setInterval(()=>load().catch(fail),3000);
</script></body></html>`;

/** Real data, or a labelled demo scenario when ?demo=1 (never both). */
/** Demo mode: ?demo=1 (with &scenario=…) or ?demo=<scenario>. */
export function demoOf(url: URL): { demo?: string; scenario?: Scenario } {
  const d = url.searchParams.get("demo");
  if (!d || d === "0") return {};
  if (SCENARIOS.includes(d as Scenario)) return { demo: d, scenario: d as Scenario };
  const sc = url.searchParams.get("scenario") as Scenario | null;
  return { demo: d, scenario: sc && SCENARIOS.includes(sc) ? sc : "aktivita" };
}

/** Real data, or a labelled demo scenario (never both). */
export function inputFor(root: string, url: URL, cards = cardsDir): McInput {
  const d = demoOf(url);
  if (d.demo) return scenario(d.scenario ?? "aktivita");
  return readLiveInput(root, cards);
}

const HTML = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
const SECURITY = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };

function route(root: string, cards: string, req: http.IncomingMessage, res: http.ServerResponse) {
  // Last-line guard: no text response leaves the panel with a secret pattern in it.
  const send = (status: number, headers: Record<string, string>, body = "") => res.writeHead(status, { ...SECURITY, ...headers }).end(scrub(body));
  if (req.method !== "GET") {
    send(405, {});
    return;
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const dm = demoOf(url);
  const demo = Boolean(dm.demo);
  const qs = q(demo, demo ? dm.scenario : undefined);
  const fq = makeQs(dm.demo, dm.demo && dm.demo !== dm.scenario ? dm.scenario : undefined);
  const frag = url.searchParams.get("_frag") === "1";
  const selfSrc = () => {
    const u = new URLSearchParams(url.search);
    u.set("_frag", "1");
    return `${url.pathname}?${u}`;
  };
  const roleId = /^\/role\/([a-z0-9][a-z0-9-]{0,40})$/.exec(url.pathname)?.[1];
  if (url.pathname === "/") {
    // V2-A final (owner pick): multi-order, recipe-aware main page.
    const f = buildFinal(inputFor(root, url, cards), url.searchParams.get("focus") ?? undefined);
    const body = renderFinal(f, fq);
    send(200, HTML, frag ? body : renderDocument("TARS / Mission Control", body, selfSrc(), CSS_FINAL));
    return;
  }
  if (roleId) {
    const input = inputFor(root, url, cards);
    const p = buildRolePage(input, roleId);
    if (!p) {
      send(404, HTML, renderDocument("TARS — role nenalezena", `<main class="a"><a class="back" href="/${fq.base}">← Mission Control</a><section class="panel"><h2>Role nenalezena</h2><p>Takovou roli v kartách ani receptech nemám.</p></section></main>`, "", CSS_FINAL));
      return;
    }
    const body = renderRole(p, buildFinal(input), fq);
    send(200, HTML, frag ? body : renderDocument(`TARS · ${p.role.name}`, body, selfSrc(), CSS_FINAL));
    return;
  }
  const focusId = /^\/zakazka\/((?:wo|dev)-[0-9A-Za-z-]+)$/.exec(url.pathname)?.[1];
  const pv = /^\/preview\/(a|b)$/.exec(url.pathname)?.[1] ?? (url.pathname === "/fragment" ? url.searchParams.get("preview") : null);
  if (pv === "a" || pv === "b") {
    // V2 compositions for the owner's choice; production `/` stays unchanged.
    const story = buildStory(inputFor(root, url, cards));
    const body = pv === "a" ? renderPreviewA(story, qs) : renderPreviewB(story, qs);
    const src = `/fragment${qs ? `${qs}&` : "?"}preview=${pv}`;
    send(200, HTML, url.pathname === "/fragment" ? body : renderDocument(`TARS · náhled ${pv.toUpperCase()}`, body, src, pv === "a" ? CSS_A : CSS_B));
  } else if (url.pathname === "/p0" || (url.pathname === "/fragment" && !url.searchParams.get("order"))) {
    const view = buildView(inputFor(root, url, cards));
    const body = renderMainFragment(view, qs);
    const src = `/fragment${qs}`;
    send(200, HTML, url.pathname === "/p0" ? renderDocument("TARS / Mission Control P0", body, src) : body);
  } else if (focusId || url.pathname === "/fragment") {
    const id = focusId ?? url.searchParams.get("order") ?? "";
    const input = inputFor(root, url, cards);
    const f = ORDER_RE.test(id) ? buildFocus(input, id) : undefined;
    if (!f) {
      send(404, HTML, renderDocument("TARS — zakázka nenalezena", `<main class="wrap"><a class="back" href="/${qs}">← Mission Control</a><section class="card"><h1 class="hero">Zakázka nenalezena</h1><p class="lede">Takovou zakázku v datech nemám.</p></section></main>`, ""));
      return;
    }
    const body = renderFocusFragment(f, buildView(input), qs);
    const src = `/fragment${qs ? `${qs}&` : "?"}order=${encodeURIComponent(id)}`;
    send(200, HTML, focusId ? renderDocument(`TARS · ${f.order.title}`, body, src) : body);
  } else if (url.pathname === "/detail") {
    send(200, HTML, PAGE);
  } else if (url.pathname === "/api/state") {
    send(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }, JSON.stringify(snapshot(root)));
  } else if (url.pathname === "/shot") {
    const p = safeShotPath(root, url.searchParams.get("order") ?? "", url.searchParams.get("file") ?? "");
    let png: Buffer | undefined;
    try {
      png = p ? fs.readFileSync(p) : undefined;
    } catch {
      png = undefined; // removed between the check and the read
    }
    if (!png) send(404, {});
    else res.writeHead(200, { ...SECURITY, "Content-Type": "image/png", "Cache-Control": "no-store" }).end(png);
  } else send(404, {});
}

/**
 * Request handler. Never lets an exception escape: a failing read answers 500 „Nelze ověřit“
 * instead of crashing the panel process (an uncaught error in an http handler ends the server).
 */
export function handler(root: string, cards = cardsDir) {
  return (req: http.IncomingMessage, res: http.ServerResponse) => {
    try {
      route(root, cards, req, res);
    } catch {
      if (!res.headersSent) res.writeHead(500, { ...SECURITY, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      if (!res.writableEnded) res.end("Chyba panelu – stav nelze ověřit.");
    }
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  http
    .createServer(handler(runsDir))
    .listen(port, "127.0.0.1", () =>
      console.log(`TARS panel: http://127.0.0.1:${port}  (runs: ${runsDir})`),
    );
}
