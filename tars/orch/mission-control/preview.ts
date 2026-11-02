// Mission Control V2 — two comparable compositions on the same real data.
// A „Mission Control“: cinematic live centre, active specialist spotlight, flow with FIX loops.
// B „Executive Command Center“: editorial, decisions and results first.
// Preview routes only (/preview/a, /preview/b); the production page `/` is unchanged until the owner picks.
import { formatDuration, type Member, type McView } from "./view";
import { ago, clock, esc, q, running } from "./render";
import { IDENTITY, symbol, type KeyEvent, type Story, type StoryStep } from "./story";

const STATUS_WORD: Record<Member["status"], string> = {
  working: "Pracuje",
  checking: "Kontroluje",
  waiting: "Převezme dál",
  idle: "V klidu",
  unknown: "Nelze ověřit",
  alarm: "Poplach",
  ok: "Vše v pořádku",
};

const SYS_TONE: Record<McView["status"], string> = { working: "live", waiting: "wait", paused: "wait", problem: "bad", unavailable: "bad", unknown: "unknown" };

function demoBanner(s: Story, variant: "a" | "b") {
  return s.view.demo ? `<div class="demo" role="note"><b>Ukázková data</b> · režim ?demo=1 · nic z toho se neděje doopravdy · <a href="/preview/${variant}">Zpět na reálná data</a></div>` : "";
}

function bar(s: Story, qs: string, variant: "a" | "b") {
  const v = s.view;
  const tone = SYS_TONE[v.status];
  return `<header class="bar">
  <a class="brand" href="/preview/${variant}${qs}"><span class="logo" aria-hidden="true">${symbol("vedouci", 16)}</span><b>TARS</b><span class="sep">/</span><span>${variant === "a" ? "Mission Control" : "Command Center"}</span></a>
  <div class="bar-mid">
    <span data-sys class="sys ${tone}"><i class="led" aria-hidden="true"></i>${esc(v.statusLabel)}</span>
    <span class="bar-kv"><span>Mise</span>${esc(v.mission)}</span>
    <span class="bar-kv"><span>Poslední potvrzení</span>${ago(v.lastContact, v.now)}</span>
  </div>
  <div class="bar-end">
    <span class="variant">Náhled ${variant.toUpperCase()} · <a href="/preview/${variant === "a" ? "b" : "a"}${qs}">přepnout na ${variant === "a" ? "B" : "A"}</a></span>
    <a class="ghost" href="/detail">Technika</a>
    <button class="ghost icon" id="theme" type="button" aria-label="Přepnout světlý / tmavý režim">◐</button>
  </div>
</header>`;
}

const KIND_LABEL: Record<StoryStep["kind"], string> = { plan: "plánování", create: "tvorba", check: "kontrola", deliver: "doručení", owner: "rozhodnutí" };

function stepSub(st: StoryStep, live: boolean): string {
  if (st.status === "current") return st.note ?? (live ? "právě teď" : "nelze ověřit");
  if (st.status === "done") return st.at ? clock(st.at) : "hotovo";
  if (st.status === "error") return "zastaveno";
  if (st.status === "paused") return "pozastaveno";
  if (st.status === "skipped") return "nedošlo";
  return KIND_LABEL[st.kind];
}

/** Process line: nodes by kind, segments solid only for real handoffs, FIX loops as arcs back. */
function flow(s: Story, qs: string, layout: "wide" | "thin") {
  if (!s.flow.length) return "";
  const live = Boolean(s.headline?.live);
  const id = s.headline?.id ?? "";
  return `<ol class="flow ${layout}" aria-label="Průběh zakázky">${s.flow
    .map((st, i) => {
      const prev = s.flow[i - 1];
      const reached = prev && prev.status === "done" && st.status !== "future" && st.status !== "skipped";
      const seg = i
        ? `<span class="seg${reached ? " on" : ""}${st.status === "current" ? " into" : ""}" aria-hidden="true">${
            st.returns
              ? `<span class="loop" title="${esc(`${st.label} vrátil práci zpět ${st.returns}×`)}"><svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M92 28 C 80 2, 20 2, 8 28" fill="none" stroke="currentColor" stroke-width="1.4" vector-effect="non-scaling-stroke"/><path d="M8 28 l-1.5 -6 M8 28 l5.5 -3" fill="none" stroke="currentColor" stroke-width="1.4" vector-effect="non-scaling-stroke"/></svg><em>${st.returns}× vráceno</em></span>`
              : ""
          }</span>`
        : "";
      const cls = `node k-${st.kind} s-${st.status}${st.status === "current" ? (live ? " live" : " unverified") : ""}`;
      const glyph = st.status === "done" ? "✓" : st.status === "error" ? "!" : st.status === "paused" ? "Ⅱ" : "";
      return `${seg}<li class="${cls}"><a href="/zakazka/${esc(id)}${qs}" aria-label="${esc(`${st.label}: ${stepSub(st, live)}`)}"><span class="orb"><span class="ring" aria-hidden="true"></span><span class="glyph">${glyph}</span></span><span class="nl">${esc(st.label)}</span><span class="ns">${esc(stepSub(st, live))}</span></a></li>`;
    })
    .join("")}</ol>`;
}

function memberCard(m: Member, size: "hero" | "next" | "pill" | "row") {
  const id = IDENTITY[m.key];
  const st = `st-${m.status}`;
  const detail = `<div class="mdetail"><p>${esc(m.responsibility)}</p><div class="mmeta"><span>Model</span><b>${m.model ? esc(m.model) : "nedoložen"}</b><span>Dnes</span><b>${m.calls ? `${m.calls}× · ${esc(formatDuration(m.workMs))}` : "bez práce"}</b></div>${
    m.history.length ? `<ul class="mhist">${m.history.slice(0, 4).map((h) => `<li><span>${esc(clock(h.at))}</span>${esc(h.text)}${h.result ? ` · <b>${esc(h.result)}</b>` : ""}</li>`).join("")}</ul>` : ""
  }</div>`;
  const mark = `<span class="mark" style="--h:${id.hue}">${symbol(m.key, size === "hero" ? 40 : size === "next" ? 26 : 20)}</span>`;
  if (size === "hero")
    return `<details class="spot ${st}" id="mm-${m.key}"><summary>
      <div class="spot-top">${mark}<span class="badge ${st}"><i class="led" aria-hidden="true"></i>${esc(STATUS_WORD[m.status])}</span></div>
      <div class="spot-name">${esc(m.name)}</div><div class="spot-role">${esc(m.role)}</div>
      <div class="spot-act">${esc(m.activity)}</div>
      <div class="spot-model">${m.model ? esc(m.model) : "model nedoložen"}</div></summary>${detail}</details>`;
  if (size === "next")
    return `<details class="nextm ${st}" id="mm-${m.key}"><summary>${mark}<div><div class="nm-k">Převezme práci</div><div class="nm-n">${esc(m.name)} <span>${m.model ? esc(m.model) : ""}</span></div></div></summary>${detail}</details>`;
  if (size === "pill")
    return `<details class="pill ${st}" id="mm-${m.key}"><summary>${mark}<span class="pn">${esc(m.name)}</span><span class="ps">${esc(STATUS_WORD[m.status])}</span></summary>${detail}</details>`;
  return `<details class="mrow ${st}" id="mm-${m.key}"><summary>${mark}<span class="rn">${esc(m.name)}<span>${esc(m.role)}</span></span><span class="rs">${esc(STATUS_WORD[m.status])}</span></summary>${detail}</details>`;
}

const EVENT_MARK: Record<KeyEvent["kind"], string> = { handoff: "→", "verdict-ok": "✓", "verdict-fix": "↺", "verdict-stop": "■", delivery: "◆", problem: "!" };

function events(s: Story, qs: string, max: number) {
  const list = s.events.slice(0, max);
  if (!list.length) return `<p class="quiet">Zatím žádné doložené události.</p>`;
  let lastOrder = "";
  return `<ol class="events">${list
    .map((e) => {
      const head = e.order !== lastOrder ? `<li class="eg"><a href="/zakazka/${esc(e.order)}${qs}">${esc(e.orderTitle)}</a></li>` : "";
      lastOrder = e.order;
      return `${head}<li class="e ev-${e.kind}"><span class="et">${esc(clock(e.at))}</span><span class="em" aria-hidden="true">${EVENT_MARK[e.kind]}</span><span class="ex">${esc(e.text)}</span></li>`;
    })
    .join("")}</ol>`;
}

function decisions(s: Story, compactEmpty: boolean) {
  const v = s.view;
  if (!v.decisions.length)
    return compactEmpty
      ? `<span class="calm-chip"><i aria-hidden="true">✓</i>Nic nečeká na tvoje rozhodnutí</span>`
      : `<div class="calm"><span class="calm-mark" aria-hidden="true">✓</span><div><div class="calm-t">Nic nečeká na tvoje rozhodnutí.</div><div class="calm-s">Tým pokračuje samostatně. Jakmile bude potřeba GO, objeví se tady jako první.</div></div></div>`;
  return `<div class="decisions">${v.decisions
    .map(
      (d) => `<article class="dec"><div class="dec-t">${esc(d.title)}</div><div class="dec-w">${esc(d.why)}</div><div class="dec-r">${esc(d.recommendation)}</div><div class="dec-l">${
        d.links.map((l) => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`).join("") || '<span class="quiet">Odkaz na GO kartu nezaznamenán</span>'
      }</div></article>`,
    )
    .join("")}${v.moreDecisions ? `<div class="quiet">+ ${v.moreDecisions} další</div>` : ""}</div>`;
}

function results(s: Story, qs: string) {
  const v = s.view;
  const t = v.today;
  const zak = t.total === 1 ? "zakázka" : t.total >= 2 && t.total <= 4 ? "zakázky" : "zakázek";
  const sentence = t.delivered
    ? `Dnes doručeno ${t.delivered} z ${t.total} ${zak}.`
    : t.total
      ? `Dnes zatím nic doručeno. ${t.total} ${zak}: ${t.failed} se zastavilo, ${t.unknown} nelze ověřit.`
      : "Dnes zatím žádná zakázka.";
  const del = v.deliveries
    .map((d) => `<li class="del"><a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.title)} ↗</a><span>${esc(d.status)} · vytvořil ${esc(d.creator)} · ověřil ${esc(d.checker)} · ${esc(clock(d.at))}</span></li>`)
    .join("");
  const ord = v.orders
    .slice(0, 6)
    .map((o) => `<li><a class="oline ${o.tone}" href="/zakazka/${esc(o.id)}${qs}"><i class="led" aria-hidden="true"></i><span class="ot">${esc(o.title)}</span><span class="os">${esc(o.stateLabel)} · ${esc(clock(o.startedAt))}</span></a></li>`)
    .join("");
  return `<p class="res-s">${esc(sentence)}</p>${del ? `<ul class="dels">${del}</ul>` : ""}<ul class="olist">${ord}</ul>`;
}

function vitals(s: Story) {
  const o = s.view.current!;
  return `<dl class="vitals">
    <div><dt>${o.endedAt ? "Trvala" : "Běží"}</dt><dd>${running(o.startedAt, o.endedAt, s.view.now)}</dd></div>
    <div><dt>Poslední ověřená událost</dt><dd>${o.lastEvent ? `${esc(o.lastEvent.text)} <span class="quiet">${ago(o.lastEvent.at, s.view.now)}</span>` : "zatím žádná"}</dd></div>
    <div><dt>Další předání</dt><dd>${s.nextHandoff ? esc(s.nextHandoff) : o.endedAt ? "žádné — zakázka skončila" : "—"}</dd></div>
  </dl>`;
}

function technical(s: Story, qs: string) {
  const h = s.headline!;
  return `<a class="tech" href="/zakazka/${esc(h.id)}${qs}"><span>${esc(h.technical)}</span><span class="tid">${esc(h.id)} →</span></a>`;
}

function idleSpot(s: Story) {
  const g = s.view.team.find((m) => m.key === "strazce");
  return `<div class="spot idle"><div class="spot-top"><span class="mark" style="--h:${IDENTITY.vedouci.hue}">${symbol("vedouci", 40)}</span><span class="badge st-idle">V klidu</span></div>
    <div class="spot-name">Nikdo teď nepracuje</div><div class="spot-act">${esc(s.view.next.what)}.${s.view.next.blocker ? ` ${esc(s.view.next.blocker)}` : ""}</div>
    ${g ? `<div class="spot-model">Strážce: ${esc(g.statusLabel)}</div>` : ""}</div>`;
}

export function renderPreviewA(s: Story, qs = q(s.view.demo)): string {
  const v = s.view;
  const h = s.headline;
  const o = v.current;
  const stage = !h || !o
    ? `<section class="stage empty" data-phase="${esc(s.phaseKey)}"><div class="eyebrow">Teď</div><h1 class="h-title">Zatím žádná zakázka</h1><p class="h-sub">${esc(v.statusSentence)}</p></section>`
    : `<section class="stage t-${h.tone}${h.live ? " is-live" : ""}" data-phase="${esc(s.phaseKey)}">
  <div class="stage-top"><div class="eyebrow"><i class="led" aria-hidden="true"></i>${h.live ? "Právě teď" : "Poslední zakázka"} · ${esc(o.mission)} · ${esc(o.department)}</div>${decisions(s, true)}</div>
  <div class="stage-grid">
    <div class="story">
      <h1 class="h-title">${esc(h.title)}</h1>
      <p class="h-sub">${esc(h.subtitle)}</p>
      ${vitals(s)}
      ${technical(s, qs)}
    </div>
    <div class="cast">${s.primary ? memberCard(s.primary, "hero") : idleSpot(s)}${s.secondary ? memberCard(s.secondary, "next") : ""}</div>
  </div>
  ${flow(s, qs, "wide")}
  ${o.problem ? `<div class="problem"><b>Co to znamená</b> ${esc(o.problem.consequence)}</div>` : ""}
</section>`;
  const decBlock = v.decisions.length ? `<section class="panel decide-a"><h2>Moje rozhodnutí</h2>${decisions(s, false)}</section>` : "";
  return `${demoBanner(s, "a")}${bar(s, qs, "a")}<main class="a">
${stage}
${decBlock}
<section class="crew" aria-label="AI tým"><h2>Tým</h2><div class="pills">${s.others.map((m) => memberCard(m, "pill")).join("")}</div></section>
<div class="lower">
  <section class="panel"><h2>Výsledky dnes</h2>${results(s, qs)}</section>
  <section class="panel"><h2>Důležité události</h2>${events(s, qs, 10)}</section>
</div>
<footer class="foot">Jen čtení · obnova 3 s · stav počítá kód z runs/*/state.json, runs/log.jsonl a runs/.lock · titulky skládá kód ze stavu a role, ne model</footer>
</main>`;
}

export function renderPreviewB(s: Story, qs = q(s.view.demo)): string {
  const v = s.view;
  const h = s.headline;
  const o = v.current;
  const lead = !h || !o
    ? `<section class="lead" data-phase="${esc(s.phaseKey)}"><div class="kicker">Stav k ${esc(clock(v.now))}</div><h1 class="serif">Zatím žádná zakázka.</h1><p class="lede">${esc(v.statusSentence)}</p></section>`
    : `<section class="lead t-${h.tone}${h.live ? " is-live" : ""}" data-phase="${esc(s.phaseKey)}">
  <div class="kicker"><i class="led" aria-hidden="true"></i>${h.live ? "Právě teď" : "Poslední zakázka"} · ${esc(o.mission)} · ${esc(o.department)}</div>
  <h1 class="serif">${esc(h.title)}</h1>
  <p class="lede">${esc(h.subtitle)}</p>
  ${flow(s, qs, "thin")}
  <div class="duo">
    ${s.primary ? `<div class="duo-c"><div class="duo-k">Na tahu</div>${memberCard(s.primary, "row")}</div>` : `<div class="duo-c"><div class="duo-k">Na tahu</div><p class="quiet">Nikdo teď nepracuje. ${esc(v.next.what)}.</p></div>`}
    ${s.secondary ? `<div class="duo-c"><div class="duo-k">Potom</div>${memberCard(s.secondary, "row")}</div>` : `<div class="duo-c"><div class="duo-k">Potom</div><p class="quiet">${esc(s.nextHandoff ?? (v.next.blocker ?? v.next.what))}</p></div>`}
  </div>
  ${vitals(s)}
  ${technical(s, qs)}
</section>`;
  return `${demoBanner(s, "b")}${bar(s, qs, "b")}<main class="b">
<div class="b-grid">
  <div class="b-main">
    ${lead}
    <section class="panel results-b"><h2>Výsledky</h2>${results(s, qs)}</section>
  </div>
  <aside class="b-rail">
    <section class="panel decide-b${v.decisions.length ? " has" : ""}"><h2>Tvoje rozhodnutí${v.decisions.length ? ` <span class="count">${v.decisionsCount}</span>` : ""}</h2>${decisions(s, false)}</section>
    <section class="panel"><h2>Důležité události</h2>${events(s, qs, 9)}</section>
    <section class="panel"><h2>Tým</h2><div class="rows">${v.team.map((m) => memberCard(m, "row")).join("")}</div></section>
  </aside>
</div>
<footer class="foot">Jen čtení · obnova 3 s · stav počítá kód z runs/*/state.json, runs/log.jsonl a runs/.lock · titulky skládá kód ze stavu a role, ne model</footer>
</main>`;
}

const BASE = `
:root{color-scheme:dark;--bg:#07080d;--bg2:#0c0e17;--s1:rgba(255,255,255,.03);--s2:rgba(255,255,255,.055);--line:rgba(255,255,255,.07);--line2:rgba(255,255,255,.13);
--ink:#eef0f7;--ink2:#c3c8d6;--mute:#9aa1b4;--acc:#a197ff;--acc-s:rgba(161,151,255,.14);--live:#3ddbc3;--live-s:rgba(61,219,195,.13);--wait:#f0b45e;--wait-s:rgba(240,180,94,.13);
--bad:#f38a8a;--bad-s:rgba(243,138,138,.12);--ok:#86d9aa;--ok-s:rgba(134,217,170,.11);--fix:#f0b45e;--unk:#aab0c2;--unk-s:rgba(170,176,194,.12);
--glow:radial-gradient(900px 480px at 18% -8%,rgba(115,96,255,.16),transparent 62%),radial-gradient(700px 420px at 92% 4%,rgba(61,219,195,.06),transparent 60%);
--sh:0 1px 0 rgba(255,255,255,.05) inset,0 30px 80px -40px rgba(0,0,0,.9);--sat:62%;--lit:72%}
:root[data-theme=light]{color-scheme:light;--bg:#f4f5f9;--bg2:#eceef5;--s1:#ffffff;--s2:#f5f6fa;--line:rgba(16,20,40,.08);--line2:rgba(16,20,40,.15);--ink:#0e1222;--ink2:#2f3550;--mute:#5d6480;
--acc:#5b48e0;--acc-s:rgba(91,72,224,.09);--live:#0b8f7f;--live-s:rgba(11,143,127,.09);--wait:#a8670f;--wait-s:rgba(168,103,15,.09);--bad:#c53a3a;--bad-s:rgba(197,58,58,.07);--ok:#25804f;--ok-s:rgba(37,128,79,.08);--fix:#a8670f;--unk:#565d75;--unk-s:rgba(86,93,117,.08);
--glow:radial-gradient(900px 480px at 18% -8%,rgba(91,72,224,.08),transparent 62%);--sh:0 1px 2px rgba(16,20,40,.04),0 18px 50px -30px rgba(16,20,40,.28);--sat:55%;--lit:38%}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--glow),var(--bg);background-attachment:fixed;color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh}
a{color:inherit;text-decoration:none}a:hover{color:var(--acc)}:focus-visible{outline:2px solid var(--acc);outline-offset:3px;border-radius:8px}
.quiet{color:var(--mute)}
.demo{background:repeating-linear-gradient(135deg,var(--wait-s) 0 14px,transparent 14px 28px),var(--bg2);border-bottom:1px solid var(--wait);text-align:center;padding:8px;font-size:13px}.demo b{color:var(--wait)}.demo a{text-decoration:underline}
.led{display:inline-block;width:7px;height:7px;border-radius:50%;background:currentColor;margin-right:8px;vertical-align:1px;flex:none}
.bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:28px;padding:14px 36px;background:color-mix(in srgb,var(--bg) 76%,transparent);backdrop-filter:blur(16px) saturate(1.3);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:9px;white-space:nowrap;font-size:14px;color:var(--ink2)}.brand b{color:var(--ink);letter-spacing:.06em}.sep{color:var(--line2)}.logo{color:var(--acc);display:grid}
.bar-mid{display:flex;align-items:center;gap:26px;flex:1;flex-wrap:wrap}.bar-kv{display:flex;flex-direction:column;font-size:14px;font-weight:550;line-height:1.25}.bar-kv span{font-size:11.5px;font-weight:500;color:var(--mute);letter-spacing:.03em}
.sys{display:inline-flex;align-items:center;padding:6px 13px;border-radius:99px;font-weight:600;font-size:13.5px;border:1px solid var(--line2)}
.sys.live{color:var(--live);background:var(--live-s);border-color:transparent}.sys.wait{color:var(--wait);background:var(--wait-s);border-color:transparent}.sys.bad{color:var(--bad);background:var(--bad-s);border-color:transparent}.sys.unknown{color:var(--unk);background:var(--unk-s);border-color:transparent}
.bar-end{display:flex;align-items:center;gap:10px}.variant{font-size:12.5px;color:var(--mute);margin-right:6px}.variant a{color:var(--acc)}
.ghost{background:transparent;border:1px solid var(--line2);color:var(--ink2);border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;cursor:pointer}.ghost:hover{border-color:var(--acc);color:var(--ink)}.ghost.icon{padding:7px 10px}
h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);font-weight:650;margin:0 0 16px}
.panel{background:var(--s1);border:1px solid var(--line);border-radius:20px;padding:24px 26px;box-shadow:var(--sh)}
.mark{--c:hsl(var(--h) var(--sat) var(--lit));display:grid;place-items:center;color:var(--c);flex:none}
.flow{list-style:none;margin:0;padding:0;display:flex;align-items:flex-start}
.flow .node a{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
.flow .orb{position:relative;display:grid;place-items:center;border-radius:50%;border:1.5px dashed var(--line2);color:var(--mute);background:var(--bg2);transition:transform .5s cubic-bezier(.2,.8,.2,1)}
.flow .k-check .orb{border-radius:12px;transform:rotate(45deg)}.flow .k-check .glyph{transform:rotate(-45deg)}
.flow .k-owner .orb{border-radius:10px}
.flow .glyph{font-weight:700}
.flow .nl{font-weight:600;color:var(--ink2)}.flow .ns{font-size:12.5px;color:var(--mute);white-space:nowrap}
.flow .s-done .orb{border-style:solid;border-color:transparent;background:var(--ok-s);color:var(--ok)}
.flow .s-current .orb{border-style:solid;border-color:var(--live);color:var(--live);background:var(--live-s)}.flow .s-current .nl{color:var(--ink)}
.flow .k-check.s-current .orb{border-color:var(--acc);color:var(--acc);background:var(--acc-s)}
.flow .s-current .ring{position:absolute;inset:-7px;border-radius:inherit;border:1.5px solid currentColor;opacity:.0}
.flow .s-current.live .ring{animation:contour 3.6s ease-in-out infinite}
@keyframes contour{0%,100%{opacity:.08;transform:scale(.96)}50%{opacity:.5;transform:scale(1.04)}}
.flow .s-current.unverified .orb{border-style:dashed;border-color:var(--unk);color:var(--unk);background:transparent}
.flow .s-error .orb{border-style:solid;border-color:var(--bad);color:var(--bad);background:var(--bad-s)}.flow .s-error .nl,.flow .s-error .ns{color:var(--bad)}
.flow .s-paused .orb{border-style:solid;border-color:var(--wait);color:var(--wait)}
.flow .s-future,.flow .s-skipped{opacity:.62}.flow .s-skipped .ns{text-decoration:line-through}
.flow .seg{flex:1;position:relative;display:flex;align-items:center;min-width:28px}
.flow .seg::before{content:"";display:block;width:100%;height:1px;background:repeating-linear-gradient(90deg,var(--line2) 0 4px,transparent 4px 9px)}
.flow .seg.on::before{background:linear-gradient(90deg,color-mix(in srgb,var(--ok) 70%,transparent),color-mix(in srgb,var(--ok) 35%,transparent))}
.flow .loop{position:absolute;left:8%;right:8%;bottom:50%;height:30px;color:var(--fix);display:block}.flow .loop svg{width:100%;height:100%;display:block}
.flow .loop em{position:absolute;left:50%;top:-13px;transform:translateX(-50%);font-style:normal;font-size:11.5px;font-weight:650;color:var(--fix);background:var(--bg);padding:0 7px;border-radius:99px;white-space:nowrap}
.phase-changed .flow .seg.into::after{content:"";position:absolute;left:0;top:50%;height:2px;margin-top:-1px;width:0;background:linear-gradient(90deg,transparent,var(--live));animation:handoff 1.4s cubic-bezier(.4,0,.2,1) forwards}
.phase-changed .flow .s-current .orb{animation:arrive 1s cubic-bezier(.2,.8,.2,1)}
@keyframes handoff{to{width:100%}}@keyframes arrive{0%{transform:scale(.7);opacity:.3}100%{transform:scale(1);opacity:1}}
.flow .k-check.s-current .orb{animation:none}
.tech{display:inline-flex;gap:12px;align-items:baseline;max-width:100%;font-size:13px;color:var(--mute);border-top:1px solid var(--line);padding-top:14px;margin-top:4px}
.tech span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}.tid{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12px;white-space:nowrap;color:var(--acc)}
.vitals{display:grid;grid-template-columns:auto 1.5fr 1fr;gap:28px;margin:0 0 22px}.vitals dt{font-size:12px;color:var(--mute);margin-bottom:4px;letter-spacing:.02em}.vitals dd{margin:0;font-weight:560;font-variant-numeric:tabular-nums;font-size:15px}
.badge{display:inline-flex;align-items:center;font-size:12.5px;font-weight:650;padding:5px 11px;border-radius:99px;background:var(--s2);color:var(--ink2)}
.badge.st-working{color:var(--live);background:var(--live-s)}.badge.st-checking{color:var(--acc);background:var(--acc-s)}.badge.st-unknown{color:var(--unk);background:var(--unk-s)}.badge.st-idle .led{display:none}
details summary{list-style:none;cursor:pointer}details summary::-webkit-details-marker{display:none}
.mdetail{font-size:13.5px;color:var(--ink2);padding-top:14px;margin-top:14px;border-top:1px solid var(--line)}.mdetail p{margin:0 0 12px}
.mmeta{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:13px}.mmeta span{color:var(--mute)}.mmeta b{font-weight:550;font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12.5px}
.mhist{list-style:none;padding:0;margin:12px 0 0;display:flex;flex-direction:column;gap:4px;font-size:12.5px}.mhist span{color:var(--mute);margin-right:8px;font-variant-numeric:tabular-nums}
.calm-chip{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--ink2);padding:6px 12px;border-radius:99px;border:1px solid var(--line)}.calm-chip i{font-style:normal;color:var(--ok)}
.calm{display:flex;gap:16px;align-items:flex-start}.calm-mark{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--ok-s);color:var(--ok);font-weight:700;flex:none}.calm-t{font-weight:600;font-size:16px}.calm-s{color:var(--mute);font-size:14px;margin-top:3px}
.dec{padding:16px 0;border-top:1px solid var(--line)}.dec:first-child{border-top:0;padding-top:0}.dec-t{font-weight:650;font-size:16px}.dec-w{color:var(--ink2);margin:6px 0}.dec-r{color:var(--mute);font-size:13.5px}.dec-l{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.btn{display:inline-block;padding:8px 14px;border-radius:10px;background:var(--wait-s);color:var(--wait);font-weight:650;font-size:13.5px}
.events{list-style:none;margin:0;padding:0}.eg{font-size:12.5px;color:var(--mute);padding:12px 0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.eg:first-child{padding-top:0}.eg a:hover{color:var(--acc)}
.e{display:grid;grid-template-columns:46px 20px 1fr;align-items:baseline;padding:5px 0;font-size:14px}.et{color:var(--mute);font-size:12.5px;font-variant-numeric:tabular-nums}.em{font-weight:700;text-align:center;color:var(--mute)}
.e.ev-verdict-ok .em,.e.ev-delivery .em{color:var(--ok)}.e.ev-verdict-fix .em{color:var(--fix)}.e.ev-verdict-stop .em,.e.ev-problem .em{color:var(--bad)}.e.ev-handoff .em{color:var(--live)}.e.ev-delivery .ex{font-weight:600}
.res-s{font-size:16px;margin:0 0 16px;color:var(--ink)}.dels,.olist{list-style:none;margin:0;padding:0}.del{display:flex;flex-direction:column;padding:10px 0;border-top:1px solid var(--line)}.del a{font-weight:600}.del span{font-size:13px;color:var(--mute)}
.oline{display:grid;grid-template-columns:14px minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--line);font-size:14px}.ot{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink2)}.os{font-size:12.5px;color:var(--mute);white-space:nowrap}
.oline.live,.oline.check{color:var(--live)}.oline.bad{color:var(--bad)}.oline.ok{color:var(--ok)}.oline.wait{color:var(--wait)}.oline.unknown,.oline.mute{color:var(--unk)}
.problem{margin-top:22px;padding:12px 16px;border-radius:12px;background:var(--bad-s);color:var(--ink2);font-size:14px}.problem b{color:var(--bad);margin-right:6px}
.foot{text-align:center;color:var(--mute);font-size:12.5px;padding:8px 0 0}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
`;

const A = `
.a{max-width:1520px;margin:0 auto;padding:32px 36px 44px;display:flex;flex-direction:column;gap:26px}
.stage{position:relative;border-radius:28px;padding:30px 40px 34px;background:linear-gradient(180deg,var(--s2),var(--s1));border:1px solid var(--line);box-shadow:var(--sh);overflow:hidden}
.stage::before{content:"";position:absolute;inset:-1px;border-radius:inherit;pointer-events:none;background:radial-gradient(600px 260px at 22% 0%,color-mix(in srgb,var(--tone,var(--acc)) 16%,transparent),transparent 70%)}
.t-live{--tone:var(--live)}.t-check{--tone:var(--acc)}.t-fix{--tone:var(--fix)}.t-wait{--tone:var(--wait)}.t-bad{--tone:var(--bad)}.t-ok{--tone:var(--ok)}.t-unknown{--tone:var(--unk)}
.stage-top{position:relative;display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:22px}
.eyebrow{font-size:12.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);font-weight:650;display:flex;align-items:center}.eyebrow .led{color:var(--tone,var(--mute))}
.stage-grid{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:48px;align-items:start;margin-bottom:38px}
.h-title{font-size:52px;line-height:1.06;letter-spacing:-.028em;font-weight:680;margin:0 0 16px;text-wrap:balance}
.h-sub{font-size:19px;line-height:1.5;color:var(--ink2);margin:0 0 30px;max-width:56ch;text-wrap:pretty}
.cast{display:flex;flex-direction:column;gap:12px}
.spot{border-radius:22px;padding:22px;background:var(--bg2);border:1px solid var(--line2);position:relative}
.spot.st-working{border-color:color-mix(in srgb,var(--live) 50%,var(--line));box-shadow:0 0 0 6px var(--live-s)}.spot.st-checking{border-color:color-mix(in srgb,var(--acc) 50%,var(--line));box-shadow:0 0 0 6px var(--acc-s)}.spot.st-unknown{border-style:dashed}
.spot-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}.spot .mark{width:64px;height:64px;border-radius:18px;background:color-mix(in srgb,var(--c) 12%,transparent);border:1px solid color-mix(in srgb,var(--c) 30%,transparent)}
.spot-name{font-size:24px;font-weight:680;letter-spacing:-.01em}.spot-role{color:var(--mute);font-size:13.5px;margin-bottom:12px}.spot-act{font-size:15px;color:var(--ink2)}.spot-model{margin-top:12px;font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12.5px;color:var(--mute)}
.nextm{border-radius:16px;padding:14px 16px;border:1px solid var(--line);background:var(--s1)}.nextm summary{display:flex;align-items:center;gap:14px}.nextm .mark{width:42px;height:42px;border-radius:13px;background:color-mix(in srgb,var(--c) 10%,transparent)}
.nm-k{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);font-weight:650}.nm-n{font-weight:620;font-size:16px}.nm-n span{font-weight:450;color:var(--mute);font-size:13px;margin-left:6px;font-family:ui-monospace,"SF Mono",Menlo,monospace}
.flow.wide .orb{width:46px;height:46px;font-size:16px}.flow.wide .k-check .orb{width:38px;height:38px;margin:4px}.flow.wide .seg{height:46px}.flow.wide .nl{font-size:14.5px}.flow.wide .node{min-width:110px}
.flow.wide{position:relative;padding:28px 6px 0;border-top:1px solid var(--line)}
.decide-a{border-color:color-mix(in srgb,var(--wait) 45%,var(--line));background:linear-gradient(90deg,var(--wait-s),var(--s1) 60%)}
.crew h2,.lower h2{margin-left:2px}
.pills{display:flex;flex-wrap:wrap;gap:10px}
.pill{border-radius:16px;border:1px solid var(--line);background:var(--s1);padding:10px 16px 10px 12px;transition:border-color .2s}.pill:hover{border-color:var(--line2)}.pill[open]{flex-basis:340px}
.pill summary{display:flex;align-items:center;gap:12px}.pill .mark{width:34px;height:34px;border-radius:10px;background:color-mix(in srgb,var(--c) 9%,transparent)}.pn{font-weight:600}.ps{font-size:13px;color:var(--mute)}
.pill.st-ok .ps{color:var(--ok)}.pill.st-alarm{border-color:var(--bad)}.pill.st-alarm .ps{color:var(--bad)}.pill.st-unknown .ps{color:var(--unk)}
.lower{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px;align-items:start}
@media (max-width:1240px){.h-title{font-size:42px}.stage-grid{grid-template-columns:minmax(0,1fr) 300px;gap:32px}.flow.wide .node{min-width:92px}.vitals{grid-template-columns:auto 1fr;}.vitals div:last-child{grid-column:1/-1}}
@media (max-width:980px){.stage-grid,.lower{grid-template-columns:1fr}.stage{padding:24px}.h-title{font-size:36px}.flow.wide{overflow-x:auto}.bar{flex-wrap:wrap;padding:12px 18px}.a{padding:20px 16px}}
`;

const B = `
.b{max-width:1480px;margin:0 auto;padding:40px 44px 48px}
.b-grid{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(340px,1fr);gap:28px;align-items:start}
.b-main,.b-rail{display:flex;flex-direction:column;gap:28px}
.lead{position:relative;padding:8px 8px 4px}
.kicker{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);font-weight:650;display:flex;align-items:center;margin-bottom:18px}
.t-live .kicker .led{color:var(--live)}.t-check .kicker .led{color:var(--acc)}.t-fix .kicker .led{color:var(--fix)}.t-bad .kicker .led{color:var(--bad)}.t-wait .kicker .led{color:var(--wait)}.t-ok .kicker .led{color:var(--ok)}.t-unknown .kicker .led{color:var(--unk)}
.serif{font-family:ui-serif,"New York","Iowan Old Style",Georgia,serif;font-weight:500;font-size:58px;line-height:1.06;letter-spacing:-.022em;margin:0 0 18px;text-wrap:balance;max-width:20ch}
.lede{font-size:20px;line-height:1.5;color:var(--ink2);margin:0 0 36px;max-width:52ch;text-wrap:pretty}
.flow.thin{margin:0 0 34px;padding:22px 0 0}.flow.thin .orb{width:30px;height:30px;font-size:12.5px}.flow.thin .k-check .orb{width:24px;height:24px;margin:3px;border-radius:7px}.flow.thin .seg{height:30px}.flow.thin .nl{font-size:13.5px}.flow.thin .node{min-width:86px}
.duo{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:30px}
.duo-c{border-radius:18px;border:1px solid var(--line);background:var(--s1);padding:16px 18px;box-shadow:var(--sh)}
.t-live .duo-c:first-child,.t-fix .duo-c:first-child{border-color:color-mix(in srgb,var(--live) 40%,var(--line))}.t-check .duo-c:first-child{border-color:color-mix(in srgb,var(--acc) 40%,var(--line))}
.duo-k{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);font-weight:650;margin-bottom:10px}
.duo .mrow{border:0;padding:0;background:none}.duo .mrow .mark{width:46px;height:46px}
.vitals{padding-top:22px;border-top:1px solid var(--line)}
.rows{display:flex;flex-direction:column}
.mrow{border-top:1px solid var(--line);padding:10px 0}.rows .mrow:first-child{border-top:0;padding-top:0}
.mrow summary{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:center}.mrow .mark{width:36px;height:36px;border-radius:11px;background:color-mix(in srgb,var(--c) 10%,transparent)}
.rn{font-weight:620;display:flex;flex-direction:column;line-height:1.3}.rn span{font-weight:450;font-size:13px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rs{font-size:13px;color:var(--mute)}.mrow.st-working .rs{color:var(--live);font-weight:650}.mrow.st-checking .rs{color:var(--acc);font-weight:650}.mrow.st-waiting .rs{color:var(--ink2)}.mrow.st-ok .rs{color:var(--ok)}.mrow.st-alarm .rs{color:var(--bad)}.mrow.st-unknown .rs{color:var(--unk)}
.mrow.st-idle .mark{opacity:.7}
.decide-b{padding:28px}.decide-b.has{border-color:color-mix(in srgb,var(--wait) 55%,var(--line));box-shadow:0 0 0 6px var(--wait-s),var(--sh)}.count{display:inline-grid;place-items:center;min-width:22px;height:22px;border-radius:99px;background:var(--wait);color:var(--bg);font-size:12px;margin-left:6px;letter-spacing:0}
.results-b .res-s{font-size:18px}
@media (max-width:1240px){.serif{font-size:46px}.b{padding:28px}.b-grid{grid-template-columns:minmax(0,1.5fr) minmax(320px,1fr)}.flow.thin .node{min-width:72px}.vitals{grid-template-columns:auto 1fr}.vitals div:last-child{grid-column:1/-1}}
@media (max-width:980px){.b-grid,.duo{grid-template-columns:1fr}.serif{font-size:38px}.flow.thin{overflow-x:auto}.bar{flex-wrap:wrap;padding:12px 18px}.b{padding:20px 16px}}
`;

export const CSS_A = BASE + A;
export const CSS_B = BASE + B;
