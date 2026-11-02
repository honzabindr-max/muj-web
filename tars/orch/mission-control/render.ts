// TARS Mission Control — server-side HTML. One render path for the first load and for the 3 s
// live refresh (the client swaps the fragment). Every string from data is escaped here.
import {
  formatAgo,
  formatDuration,
  type FlowStep,
  type FocusView,
  type McView,
  type Member,
  type OrderView,
  type SysStatus,
} from "./view";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const clock = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit" }) : "—";

/** Live relative time; the client ticks the text every second, server text is the no-JS fallback. */
export const ago = (iso: string | undefined, now: string) =>
  iso ? `<time data-ago="${esc(iso)}" datetime="${esc(iso)}" title="${esc(clock(iso))}">${esc(formatAgo(iso, now))}</time>` : "nelze ověřit";
export const running = (from: string, to: string | undefined, now: string) =>
  to
    ? `<span>${esc(formatDuration(Date.parse(to) - Date.parse(from)))}</span>`
    : `<time data-since="${esc(from)}">${esc(formatDuration(Date.parse(now) - Date.parse(from)))}</time>`;

const STATUS_TONE: Record<SysStatus, string> = {
  working: "live",
  waiting: "wait",
  paused: "wait",
  problem: "bad",
  unavailable: "bad",
  unknown: "unknown",
};

export function q(demo: boolean, scenario?: string): string {
  return demo ? `?demo=1${scenario ? `&scenario=${encodeURIComponent(scenario)}` : ""}` : "";
}

function demoBanner(v: { demo: boolean }) {
  return v.demo
    ? `<div class="demo" role="note"><b>Ukázková data</b> · režim ?demo=1 · nic z toho se neděje doopravdy · <a href="/">Zpět na reálná data</a></div>`
    : "";
}

function commandBar(v: McView, qs: string) {
  const tone = STATUS_TONE[v.status];
  return `<header class="bar">
  <a class="brand" href="/${qs}"><span class="logo" aria-hidden="true"></span><span>TARS</span><span class="slash">/</span><span class="mute">Mission Control</span></a>
  <div class="bar-items">
    <div class="pill ${tone}" title="${esc(v.statusSentence)}"><span class="dot ${tone}${v.status === "working" ? " pulse" : ""}" aria-hidden="true"></span><span>${esc(v.statusLabel)}</span></div>
    <div class="kv"><span class="k">Mise</span><span class="v">${esc(v.mission)}</span></div>
    <div class="kv"><span class="k">Pracuje</span><span class="v">${v.workingCount} ${v.workingCount === 1 ? "specialista" : v.workingCount >= 2 && v.workingCount <= 4 ? "specialisté" : "specialistů"}</span></div>
    <div class="kv"><span class="k">Rozhodnutí</span><span class="v${v.decisionsCount ? " accent" : ""}">${v.decisionsCount}</span></div>
    <div class="kv"><span class="k">Poslední potvrzení</span><span class="v">${ago(v.lastContact, v.now)}</span></div>
  </div>
  <div class="bar-end"><a class="ghost" href="/detail${qs}">Technika</a><button class="ghost" id="theme" type="button" aria-label="Přepnout světlý / tmavý režim">◐</button></div>
</header>`;
}

function flowMap(o: OrderView, qs: string) {
  const live = o.verified;
  const nodes = o.flow
    .map((s: FlowStep, i) => {
      const seg =
        i === 0
          ? ""
          : `<span class="seg ${o.flow[i - 1].status === "done" && (s.status === "done" || s.status === "current" || s.status === "error" || s.status === "paused") ? "solid" : ""}${s.status === "current" && live ? " flowing" : ""}" aria-hidden="true"><i></i></span>`;
      const label = { done: "hotovo", current: "probíhá", future: "následuje", error: "zastaveno", paused: "pozastaveno", skipped: "nedošlo" }[s.status];
      const cls = `${s.status}${s.status === "current" && live ? " live" : ""}${s.status === "current" && !live ? " unverified" : ""}${s.key === "checker" ? " checker" : ""}`;
      return `${seg}<a class="node ${cls}" href="/zakazka/${esc(o.id)}${qs}#krok-${s.key}" aria-label="${esc(`${s.label}: ${label}`)}">
        <span class="orb" aria-hidden="true">${s.status === "done" ? "✓" : s.status === "error" ? "!" : s.status === "paused" ? "Ⅱ" : s.key === "checker" ? "◇" : ""}</span>
        <span class="nl">${esc(s.label)}</span>
        <span class="ns">${esc(s.note ?? (s.status === "done" && s.at ? clock(s.at) : s.status === "current" ? (live ? "právě teď" : "nelze ověřit") : s.status === "error" ? "zastaveno" : s.status === "skipped" ? "nedošlo" : s.who))}</span>
      </a>`;
    })
    .join("");
  return `<nav class="flow" aria-label="Tok zakázky">${nodes}</nav>`;
}

function liveMission(v: McView, qs: string) {
  const o = v.current;
  if (!o)
    return `<section class="card mission empty" aria-labelledby="lm"><div class="eyebrow" id="lm">Live Mission</div><h1 class="hero">Zatím žádná zakázka.</h1><p class="lede">${esc(v.statusSentence)}</p></section>`;
  return `<section class="card mission tone-${o.tone}" aria-labelledby="lm">
  <div class="mission-head">
    <div class="eyebrow" id="lm">Live Mission · ${esc(o.mission)} · ${esc(o.department)}</div>
    <span class="chip ${o.tone}">${esc(o.stateLabel)}</span>
  </div>
  <h1 class="hero"><a href="/zakazka/${esc(o.id)}${qs}">${esc(o.title)}</a></h1>
  <p class="lede">${esc(o.sentence)}</p>
  ${flowMap(o, qs)}
  ${o.problem ? `<div class="problem" role="status"><div class="pt">Co se stalo</div><div>${esc(o.problem.what)}</div><div class="pc">${esc(o.problem.consequence)}</div></div>` : ""}
  <dl class="facts">
    <div><dt>${o.endedAt ? "Doba běhu" : "Běží"}</dt><dd>${running(o.startedAt, o.endedAt, v.now)}</dd></div>
    <div><dt>Zahájeno</dt><dd>${esc(clock(o.startedAt))}</dd></div>
    <div><dt>Poslední událost</dt><dd>${o.lastEvent ? `${esc(o.lastEvent.text)} · ${ago(o.lastEvent.at, v.now)}` : "zatím žádná"}</dd></div>
    <div><dt>Zakázka</dt><dd><a href="/zakazka/${esc(o.id)}${qs}">${esc(o.id)} → detail</a></dd></div>
  </dl>
</section>`;
}

function ownerDesk(v: McView) {
  const body = v.decisions.length
    ? v.decisions
        .map(
          (d) => `<article class="decision"><div class="dt">${esc(d.title)}</div><div class="dw">${esc(d.why)}</div><div class="dr">${esc(d.recommendation)}</div>
      <div class="links">${d.links.map((l) => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`).join("") || '<span class="mute">Odkaz na GO kartu nezaznamenán</span>'}</div></article>`,
        )
        .join("") + (v.moreDecisions ? `<div class="mute small">+ ${v.moreDecisions} další v Notionu</div>` : "")
    : `<div class="calm"><span class="calm-mark" aria-hidden="true">✓</span><div><b>Tým pokračuje samostatně.</b><br><span class="mute">Momentálně nemusíš nic řešit.</span></div></div>`;
  return `<section class="card desk" aria-labelledby="od"><div class="eyebrow" id="od">Owner Desk · čeká na tebe</div>${body}</section>`;
}

function nextCard(v: McView) {
  return `<section class="card next" aria-labelledby="cn"><div class="eyebrow" id="cn">Co následuje</div>
  <div class="nx">${esc(v.next.what)}</div><div class="mute small">Kdo: ${esc(v.next.who)}</div>
  ${v.next.blocker ? `<div class="blocker"><span aria-hidden="true">⚑</span> ${esc(v.next.blocker)}</div>` : ""}</section>`;
}

const STATUS_ICON: Record<Member["status"], string> = {
  working: "●",
  checking: "◇",
  waiting: "○",
  idle: "·",
  unknown: "?",
  alarm: "!",
  ok: "✓",
};

function team(v: McView) {
  return `<section aria-labelledby="tm"><div class="section-title" id="tm">AI Team</div><div class="team">${v.team
    .map(
      (m) => `<details class="member st-${m.status}" id="m-${m.key}">
  <summary>
    <div class="mh"><span class="avatar" aria-hidden="true">${esc(m.name.slice(0, 1))}</span><div><div class="mn">${esc(m.name)}</div><div class="mr">${esc(m.role)}</div></div>
      <span class="ms st-${m.status}${m.status === "working" ? " pulse" : ""}" title="${esc(m.statusLabel)}"><span aria-hidden="true">${STATUS_ICON[m.status]}</span><span class="sr">${esc(m.statusLabel)}</span></span></div>
    <div class="ma">${esc(m.activity)}</div>
    <div class="mm"><span>${esc(m.statusLabel)}</span><span>${m.calls ? `${m.calls}× dnes · ${esc(formatDuration(m.workMs))}` : "dnes 0×"}</span></div>
    <div class="model">${m.model ? esc(m.model) : '<span class="mute">model nedoložen</span>'}</div>
  </summary>
  <div class="more"><p>${esc(m.responsibility)}</p>${
    m.history.length
      ? `<ul class="hist">${m.history.map((h) => `<li><span>${esc(clock(h.at))}</span> ${esc(h.text)}${h.result ? ` · <b>${esc(h.result)}</b>` : ""}</li>`).join("")}</ul>`
      : '<div class="mute small">Žádná doložená historie.</div>'
  }</div>
</details>`,
    )
    .join("")}</div></section>`;
}

function delivery(v: McView, qs: string) {
  const del = v.deliveries.length
    ? v.deliveries
        .map(
          (d) => `<li class="dl"><div class="dlt"><a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.title)} ↗</a><span class="chip ok">${esc(d.status)}</span></div>
      <div class="mute small">Vytvořil ${esc(d.creator)} · ověřil ${esc(d.checker)} · ${esc(clock(d.at))}</div></li>`,
        )
        .join("")
    : `<li class="mute">Dnes zatím nic doručeno.</li>`;
  const sum = `${v.today.total} ${v.today.total === 1 ? "zakázka" : v.today.total >= 2 && v.today.total <= 4 ? "zakázky" : "zakázek"} dnes · ${v.today.delivered} doručeno · ${v.today.failed} selhalo · ${v.today.unknown} nelze ověřit`;
  const tl = v.timeline.length
    ? v.timeline
        .map(
          (t, i, all) => `${i === 0 || all[i - 1].order !== t.order ? `<li class="evg"><a href="/zakazka/${esc(t.order)}${qs}">${esc(t.orderTitle)}</a></li>` : ""}<li class="ev ${t.tone}"><span class="evt">${esc(clock(t.at))}</span><span class="evd" aria-hidden="true"></span><div>${esc(t.text)}${t.durationMs ? ` <span class="mute">· ${esc(formatDuration(t.durationMs))}</span>` : ""}</div></li>`,
        )
        .join("")
    : `<li class="mute">Žádné doložené události.</li>`;
  const orders = v.orders.length
    ? `<div class="orders">${v.orders
        .slice(0, 8)
        .map((o) => `<a class="ord ${o.tone}" href="/zakazka/${esc(o.id)}${qs}"><span class="dot ${o.tone}" aria-hidden="true"></span><span class="ot">${esc(o.title)}</span><span class="mute small">${esc(o.stateLabel)} · ${esc(clock(o.startedAt))}</span></a>`)
        .join("")}</div>`
    : "";
  return `<section class="cols" aria-label="Doručení a aktivita">
  <div class="card"><div class="eyebrow">Doručeno dnes</div><div class="mute small sum">${esc(sum)}</div><ul class="list">${del}</ul>
    ${orders ? `<div class="eyebrow sub">Dnešní zakázky</div>${orders}` : ""}</div>
  <div class="card"><div class="eyebrow">Co se stalo</div><ol class="timeline">${tl}</ol></div>
</section>`;
}

export function renderMainFragment(v: McView, qs = q(v.demo)): string {
  return `${demoBanner(v)}${commandBar(v, qs)}<main class="wrap">
  <div class="top">${liveMission(v, qs)}<div class="side">${ownerDesk(v)}${nextCard(v)}</div></div>
  ${team(v)}
  ${delivery(v, qs)}
  <footer class="foot mute small">Jen čtení · obnova každé 3 s · zdroj runs/*/state.json, runs/log.jsonl, runs/.lock, karty specialistů · stav počítá kód, ne model</footer>
</main>`;
}

export function renderFocusFragment(f: FocusView, v: McView, qs = q(v.demo)): string {
  const o = f.order;
  const row = (c: FocusView["chronology"][number]) =>
    `<li class="ev ${c.tone}"><span class="evt">${esc(clock(c.at))}</span><span class="evd" aria-hidden="true"></span><div><div><b>${esc(c.who)}</b> — ${esc(c.text)}${c.durationMs ? ` <span class="mute">· ${esc(formatDuration(c.durationMs))}</span>` : ""}</div>${c.detail ? `<div class="mute small">${esc(c.detail)}</div>` : ""}</div></li>`;
  return `${demoBanner(v)}${commandBar(v, qs)}<main class="wrap focus">
  <a class="back" href="/${qs}">← Mission Control</a>
  <section class="card mission tone-${o.tone}">
    <div class="mission-head"><div class="eyebrow">Focus · ${esc(o.mission)} · ${esc(o.department)} · ${esc(o.id)}</div><span class="chip ${o.tone}">${esc(o.stateLabel)}</span></div>
    <h1 class="hero">${esc(o.title)}</h1><p class="lede">${esc(o.sentence)}</p>
    ${flowMap(o, qs)}
    ${o.problem ? `<div class="problem" role="status"><div class="pt">Blokace</div><div>${esc(o.problem.what)}</div><div class="pc">${esc(o.problem.consequence)}</div></div>` : ""}
    <dl class="facts">
      <div><dt>${o.endedAt ? "Doba běhu" : "Běží"}</dt><dd>${running(o.startedAt, o.endedAt, v.now)}</dd></div>
      <div><dt>Kola oprav</dt><dd>${f.fixRounds}</dd></div>
      <div><dt>Ruční zásahy</dt><dd>${f.manualInterventions}</dd></div>
      <div><dt>Výstup</dt><dd>${o.deliveredUrl ? `<a href="${esc(o.deliveredUrl)}" target="_blank" rel="noopener noreferrer">otevřít ↗</a>` : "nedoručen"}${o.ownerCardUrl ? ` · <a href="${esc(o.ownerCardUrl)}" target="_blank" rel="noopener noreferrer">GO karta ↗</a>` : ""}</dd></div>
    </dl>
  </section>
  <div class="cols">
    <section class="card"><div class="eyebrow">Celá chronologie</div><ol class="timeline">${f.chronology.map(row).join("") || '<li class="mute">Žádné doložené události.</li>'}</ol></section>
    <div class="stack">
      ${f.brief ? `<section class="card"><div class="eyebrow">Zadání · milník ${esc(f.brief.milestone)}</div><p>${esc(f.brief.goal)}</p><div class="mute small">Proč teď: ${esc(f.brief.why)}</div>
        ${f.brief.acceptance.length ? `<div class="eyebrow sub">Akceptační kritéria</div><ul class="list tight">${f.brief.acceptance.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
        ${f.brief.ownerDecisions.length ? `<div class="eyebrow sub">Vyhrazeno tobě</div><ul class="list tight">${f.brief.ownerDecisions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}</section>` : `<section class="card"><div class="eyebrow">Zadání</div><p class="mute">Vedoucí zatím zadání nedokončil.</p></section>`}
      <section class="card" id="krok-checker"><div class="eyebrow">Kdo co vytvořil a kdo kontroloval</div>
        ${f.handoffs.length ? `<ul class="list tight">${f.handoffs.map((h) => `<li>${esc(clock(h.at))} · ${esc(h.from)} → ${esc(h.to)}</li>`).join("")}</ul>` : '<div class="mute small">Žádné předání.</div>'}
        ${f.verdicts.length ? `<div class="eyebrow sub">Verdikty</div><ul class="list">${f.verdicts.map((x) => `<li><span class="chip ${x.result === "PASS" ? "ok" : x.result === "FIX" ? "wait" : "bad"}">${esc(x.result)}</span> <b>${esc(x.who)}</b> <span class="mute small">${esc(x.model)} · ${esc(clock(x.at))}</span>${x.reason ? `<div class="small">${esc(x.reason)}</div>` : ""}</li>`).join("")}</ul>` : ""}
      </section>
      <section class="card"><div class="eyebrow">Artefakty a důkazy</div>${
        f.artifacts.length
          ? `<ul class="list tight">${f.artifacts.map((a) => `<li><code>runs/${esc(o.id)}/${esc(a.name)}</code>${a.shot && !v.demo ? ` · <a href="/shot?order=${encodeURIComponent(o.id)}&file=${encodeURIComponent(a.name)}">screenshot</a>` : ""}</li>`).join("")}</ul>`
          : '<div class="mute small">Žádné soubory.</div>'
      }<div class="mute small">Prompty, raw log a JSON: <a href="/detail${qs}">/detail</a></div></section>
    </div>
  </div>
</main>`;
}

const CSS = `
:root{color-scheme:dark;--bg:#060912;--bg2:#0b1020;--surf:rgba(255,255,255,.035);--surf2:rgba(255,255,255,.06);--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.14);
--ink:#e9ecf5;--ink2:#b5bbcc;--mute:#7c8399;--acc:#9b8cff;--acc2:rgba(155,140,255,.16);--live:#2dd4bf;--live2:rgba(45,212,191,.16);--wait:#f2b155;--wait2:rgba(242,177,85,.14);
--bad:#f47f7f;--bad2:rgba(244,127,127,.13);--ok:#7fd3a5;--ok2:rgba(127,211,165,.12);--unk:#a7adbf;--unk2:rgba(167,173,191,.13);--shadow:0 1px 0 rgba(255,255,255,.04) inset,0 20px 60px -30px rgba(0,0,0,.8)}
:root[data-theme=light]{color-scheme:light;--bg:#f5f6fa;--bg2:#eef0f7;--surf:#fff;--surf2:#f6f7fb;--line:rgba(15,23,42,.08);--line2:rgba(15,23,42,.14);--ink:#0f1424;--ink2:#3b4256;--mute:#6b7287;
--acc:#6d5ae6;--acc2:rgba(109,90,230,.1);--live:#0d9488;--live2:rgba(13,148,136,.1);--wait:#b7791f;--wait2:rgba(183,121,31,.1);--bad:#d14343;--bad2:rgba(209,67,67,.08);--ok:#2f855a;--ok2:rgba(47,133,90,.09);--unk:#5f667a;--unk2:rgba(95,102,122,.1);--shadow:0 1px 2px rgba(15,23,42,.04),0 12px 40px -24px rgba(15,23,42,.25)}
*{box-sizing:border-box}html,body{margin:0}body{background:radial-gradient(1200px 600px at 15% -10%,rgba(124,108,255,.10),transparent 60%),radial-gradient(900px 500px at 100% 0,rgba(45,212,191,.05),transparent 60%),var(--bg);background-attachment:fixed;color:var(--ink);
font:14px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",system-ui,sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh}
:root[data-theme=light] body{background:radial-gradient(1200px 600px at 15% -10%,rgba(109,90,230,.07),transparent 60%),var(--bg)}
a{color:inherit;text-decoration:none}a:hover{color:var(--acc)}a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid var(--acc);outline-offset:3px;border-radius:8px}
.mute{color:var(--mute)}.small{font-size:12.5px}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.demo{background:repeating-linear-gradient(135deg,var(--wait2) 0 14px,transparent 14px 28px),var(--bg2);border-bottom:1px solid var(--wait);color:var(--ink);text-align:center;padding:8px 12px;font-size:13px}.demo b{color:var(--wait);letter-spacing:.02em}.demo a{text-decoration:underline}
.bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:24px;padding:12px 28px;background:color-mix(in srgb,var(--bg) 78%,transparent);backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:8px;font-weight:650;letter-spacing:.02em;white-space:nowrap}.slash{color:var(--line2)}
.logo{width:18px;height:18px;border-radius:6px;background:conic-gradient(from 210deg,var(--acc),var(--live),var(--acc));box-shadow:0 0 0 1px var(--line2) inset}
.bar-items{display:flex;align-items:center;gap:22px;flex:1;flex-wrap:wrap}.bar-end{display:flex;gap:8px}
.kv{display:flex;flex-direction:column;line-height:1.2}.k{font-size:11px;color:var(--mute);letter-spacing:.04em}.v{font-weight:560;font-variant-numeric:tabular-nums}.v.accent{color:var(--acc)}
.pill{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:99px;font-weight:600;font-size:13px;border:1px solid var(--line2);background:var(--surf)}
.pill.live{color:var(--live);background:var(--live2)}.pill.wait{color:var(--wait);background:var(--wait2)}.pill.bad{color:var(--bad);background:var(--bad2)}.pill.unknown{color:var(--unk);background:var(--unk2)}
.dot{width:8px;height:8px;border-radius:50%;background:currentColor;display:inline-block;flex:none}.dot.live{color:var(--live)}.dot.wait{color:var(--wait)}.dot.bad{color:var(--bad)}.dot.ok{color:var(--ok)}.dot.mute,.dot.unknown{color:var(--unk)}.dot.check{color:var(--acc)}
.pulse{position:relative}.dot.pulse::after,.ms.pulse::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1.5px solid currentColor;opacity:0;animation:ring 2.4s ease-out infinite}
@keyframes ring{0%{transform:scale(.6);opacity:.55}100%{transform:scale(1.6);opacity:0}}
.ghost{background:transparent;border:1px solid var(--line2);color:var(--ink2);border-radius:9px;padding:6px 11px;font:inherit;font-size:12.5px;cursor:pointer}.ghost:hover{color:var(--ink);border-color:var(--acc)}
.wrap{max-width:1560px;margin:0 auto;padding:28px 28px 40px;display:flex;flex-direction:column;gap:28px}
.card{background:var(--surf);border:1px solid var(--line);border-radius:18px;padding:22px 24px;box-shadow:var(--shadow)}
.eyebrow{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--mute);font-weight:600;margin-bottom:12px}.eyebrow.sub{margin:18px 0 8px}
.section-title{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--mute);font-weight:600;margin:0 0 12px 4px}
.top{display:grid;grid-template-columns:minmax(0,2.4fr) minmax(300px,1fr);gap:20px}.side{display:flex;flex-direction:column;gap:20px}
.mission{position:relative;overflow:hidden;padding:28px 32px}.mission::before{content:"";position:absolute;inset:0 0 auto;height:2px;background:linear-gradient(90deg,transparent,var(--tone,var(--acc)),transparent);opacity:.7}
.tone-live{--tone:var(--live)}.tone-check{--tone:var(--acc)}.tone-wait{--tone:var(--wait)}.tone-bad{--tone:var(--bad)}.tone-ok{--tone:var(--ok)}.tone-unknown,.tone-mute{--tone:var(--unk)}
.mission-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.hero{font-size:28px;line-height:1.22;letter-spacing:-.015em;font-weight:640;margin:2px 0 10px;max-width:60ch;text-wrap:balance}.lede{font-size:16px;color:var(--ink2);margin:0 0 26px;max-width:72ch}
.chip{display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;white-space:nowrap;background:var(--surf2);color:var(--ink2);border:1px solid var(--line)}
.chip.live{color:var(--live);background:var(--live2)}.chip.check{color:var(--acc);background:var(--acc2)}.chip.wait{color:var(--wait);background:var(--wait2)}.chip.bad{color:var(--bad);background:var(--bad2)}.chip.ok{color:var(--ok);background:var(--ok2)}.chip.unknown,.chip.mute{color:var(--unk);background:var(--unk2)}
.flow{display:flex;align-items:flex-start;margin:4px 0 22px;padding:18px 6px 6px;overflow-x:auto}
.node{display:flex;flex-direction:column;align-items:center;gap:7px;min-width:92px;text-align:center;flex:none}
.orb{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:14px;font-weight:700;border:1.5px solid var(--line2);color:var(--mute);background:var(--bg2);transition:transform .3s ease,box-shadow .3s ease}
.nl{font-weight:600;font-size:13px}.ns{font-size:11.5px;color:var(--mute);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.node.done .orb{background:var(--ok2);border-color:transparent;color:var(--ok)}.node.done .nl{color:var(--ink2)}
.node.current .orb{border-color:var(--live);color:var(--live);box-shadow:0 0 0 6px var(--live2)}.node.current.checker .orb{border-color:var(--acc);color:var(--acc);box-shadow:0 0 0 6px var(--acc2)}
.node.current.live .orb::after{content:"";width:10px;height:10px;border-radius:50%;background:currentColor;animation:breathe 2.2s ease-in-out infinite}.node.current.checker.live .orb::after{content:none}
.node.current.unverified .orb{border-style:dashed;border-color:var(--unk);color:var(--unk);box-shadow:none}
@keyframes breathe{0%,100%{transform:scale(.7);opacity:.6}50%{transform:scale(1);opacity:1}}
.node.future .orb,.node.skipped .orb{border-style:dashed;opacity:.7}.node.future .nl,.node.skipped .nl{color:var(--mute);font-weight:500}.node.skipped{opacity:.55}
.node.error .orb{background:var(--bad2);border-color:var(--bad);color:var(--bad)}.node.error .nl,.node.error .ns{color:var(--bad)}.node.paused .orb{border-color:var(--wait);color:var(--wait)}
.seg{flex:1;min-width:24px;height:34px;display:flex;align-items:center;position:relative}.seg i{display:block;width:100%;height:1px;background:repeating-linear-gradient(90deg,var(--line2) 0 4px,transparent 4px 8px)}
.seg.solid i{background:linear-gradient(90deg,var(--ok),color-mix(in srgb,var(--ok) 40%,transparent))}
.seg.flowing::after{content:"";position:absolute;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:var(--live);box-shadow:0 0 10px var(--live);animation:travel 2.6s cubic-bezier(.45,0,.2,1) infinite}
@keyframes travel{0%{left:0;opacity:0}15%{opacity:1}85%{opacity:1}100%{left:calc(100% - 6px);opacity:0}}
.problem{border:1px solid color-mix(in srgb,var(--bad) 40%,transparent);background:var(--bad2);border-radius:12px;padding:12px 14px;margin:0 0 20px}.pt{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--bad);font-weight:700;margin-bottom:4px}.pc{color:var(--ink2);margin-top:6px;font-size:13px}
.facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:0;padding-top:18px;border-top:1px solid var(--line)}.facts dt{font-size:11.5px;color:var(--mute);margin-bottom:3px}.facts dd{margin:0;font-variant-numeric:tabular-nums;font-weight:520}.facts a{color:var(--acc)}
.calm{display:flex;gap:12px;align-items:flex-start;padding:4px 0}.calm-mark{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--ok2);color:var(--ok);flex:none;font-weight:700}
.decision{padding:12px 0;border-top:1px solid var(--line)}.decision:first-of-type{border-top:0;padding-top:0}.dt{font-weight:600}.dw{color:var(--ink2);font-size:13px;margin:4px 0}.dr{font-size:12.5px;color:var(--mute)}
.links{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.btn{display:inline-block;padding:6px 12px;border-radius:9px;background:var(--acc2);color:var(--acc);font-weight:600;font-size:12.5px}
.nx{font-weight:600;font-size:15px;margin-bottom:4px}.blocker{margin-top:12px;padding:10px 12px;border-radius:10px;background:var(--wait2);color:var(--ink);font-size:13px}.blocker span{color:var(--wait)}
.team{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:14px}
.member{background:var(--surf);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);transition:border-color .25s ease,transform .25s ease}.member:hover{border-color:var(--line2)}
.member summary{list-style:none;cursor:pointer;padding:16px}.member summary::-webkit-details-marker{display:none}
.mh{display:flex;align-items:center;gap:10px}.mh>div{flex:1;min-width:0}.avatar{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;font-weight:700;background:var(--surf2);border:1px solid var(--line);color:var(--ink2)}
.mn{font-weight:630}.mr{font-size:11.5px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ms{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;color:var(--mute);position:relative;flex:none}
.ms.st-working{color:var(--live);background:var(--live2)}.ms.st-checking{color:var(--acc);background:var(--acc2)}.ms.st-waiting{color:var(--ink2)}.ms.st-unknown{color:var(--unk);background:var(--unk2)}.ms.st-alarm{color:var(--bad);background:var(--bad2)}.ms.st-ok{color:var(--ok);background:var(--ok2)}
.member.st-working{border-color:color-mix(in srgb,var(--live) 45%,var(--line))}.member.st-checking{border-color:color-mix(in srgb,var(--acc) 45%,var(--line))}.member.st-idle{opacity:.78}.member.st-alarm{border-color:var(--bad)}
.ma{margin:12px 0 8px;font-size:13px;color:var(--ink2);min-height:2.9em}.mm{display:flex;justify-content:space-between;gap:6px;font-size:11.5px;color:var(--mute)}
.model{margin-top:8px;font-size:11.5px;font-family:ui-monospace,"SF Mono",Menlo,monospace;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.more{padding:0 16px 16px;font-size:12.5px;color:var(--ink2);border-top:1px solid var(--line)}.more p{margin:12px 0}
.hist{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px}.hist span{color:var(--mute);font-variant-numeric:tabular-nums}
.cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:20px;align-items:start}.stack{display:flex;flex-direction:column;gap:20px}
.list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}.list.tight{gap:6px}.list.tight li{font-size:13px;color:var(--ink2)}.sum{margin:-6px 0 14px}
.dlt{display:flex;justify-content:space-between;gap:10px;font-weight:600}
.orders{display:flex;flex-direction:column;gap:2px}.ord{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:10px;align-items:center;padding:7px 8px;border-radius:9px}.ord:hover{background:var(--surf2);color:inherit}
.ot{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px}
.timeline{list-style:none;margin:0;padding:0}.ev{display:grid;grid-template-columns:44px 14px minmax(0,1fr);gap:8px;padding:0 0 14px;position:relative}
.evt{font-size:12px;color:var(--mute);font-variant-numeric:tabular-nums;padding-top:1px}.evd{width:9px;height:9px;border-radius:50%;margin-top:6px;background:var(--unk);box-shadow:0 0 0 3px var(--bg2)}
.ev::before{content:"";position:absolute;left:56px;top:16px;bottom:0;width:1px;background:var(--line)}.ev:last-child::before{content:none}
.ev.ok .evd{background:var(--ok)}.ev.bad .evd{background:var(--bad)}.ev.wait .evd{background:var(--wait)}.ev.live .evd{background:var(--live)}
.evg{font-size:12px;color:var(--mute);padding:4px 0 10px 66px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.evg a:hover{color:var(--acc)}
.foot{text-align:center;padding-top:6px}.back{color:var(--mute);font-size:13px}.focus .hero{font-size:24px}
code{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12px;color:var(--ink2)}
@media (max-width:1380px){.team{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (max-width:1080px){.top,.cols{grid-template-columns:1fr}.facts{grid-template-columns:repeat(2,1fr)}.team{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:720px){.bar{flex-wrap:wrap;gap:12px;padding:10px 16px}.wrap{padding:18px 14px}.team{grid-template-columns:repeat(2,minmax(0,1fr))}.hero{font-size:22px}.mission{padding:20px}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
`;

const SCRIPT = `
(function(){
var root=document.documentElement;var saved=null;try{saved=localStorage.getItem('tars-theme')}catch(e){}
function apply(t){if(t)root.setAttribute('data-theme',t);else root.removeAttribute('data-theme')}
apply(saved||(matchMedia('(prefers-color-scheme: light)').matches?'light':null));
function dur(ms){if(!isFinite(ms)||ms<0)return '—';var s=Math.round(ms/1000);if(s<60)return s+' s';var m=Math.floor(s/60);if(m<60)return m+' min '+(s%60)+' s';var h=Math.floor(m/60);return h+' h '+(m%60)+' min'}
function ago(ms){if(!isFinite(ms))return 'nelze ověřit';var s=Math.max(0,Math.round(ms/1000));if(s<60)return 'před chvílí';var m=Math.floor(s/60);if(m<60)return 'před '+m+' min';var h=Math.floor(m/60);if(h<24)return 'před '+h+' h '+(m%60)+' min';return 'před '+Math.floor(h/24)+' d'}
function tick(){var n=Date.now();document.querySelectorAll('time[data-since]').forEach(function(t){t.textContent=dur(n-Date.parse(t.dataset.since))});document.querySelectorAll('time[data-ago]').forEach(function(t){t.textContent=ago(n-Date.parse(t.dataset.ago))})}
function bind(){var b=document.getElementById('theme');if(b)b.onclick=function(){var cur=root.getAttribute('data-theme')==='light'?'light':'dark';var nx=cur==='light'?'dark':'light';apply(nx);try{localStorage.setItem('tars-theme',nx)}catch(e){}}}
var app=document.getElementById('app');var norm=function(h){return h.replace(/(<time[^>]*>)[^<]*(<\\/time>)/g,'$1$2')};var last=norm(app.innerHTML);var ph0=app.querySelector('[data-phase]');var lastPhase=ph0?ph0.dataset.phase:null;
async function refresh(){try{var r=await fetch(app.dataset.src,{cache:'no-store'});if(!r.ok)throw new Error(r.status);var h=await r.text();var n=norm(h);if(n!==last){var open=[].map.call(document.querySelectorAll('details[open]'),function(d){return d.id});app.innerHTML=h;var ph=app.querySelector('[data-phase]');if(ph&&lastPhase&&ph.dataset.phase!==lastPhase){ph.classList.add('phase-changed');setTimeout(function(){ph.classList.remove('phase-changed')},2400)}lastPhase=ph?ph.dataset.phase:null;open.forEach(function(id){var d=document.getElementById(id);if(d)d.open=true});last=n;bind()}document.body.classList.remove('offline');tick()}catch(e){document.body.classList.add('offline');var p=document.querySelector('.pill');if(p){p.className='pill bad';p.lastChild.textContent='Nedostupné'}}}
bind();tick();setInterval(tick,1000);if(app.dataset.src)setInterval(refresh,3000);
})();`;

export function renderDocument(title: string, fragment: string, src: string, css = CSS): string {
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><title>${esc(title)}</title><style>${css}</style></head>
<body><div id="app" data-src="${esc(src)}">${fragment}</div><script>${SCRIPT}</script></body></html>`;
}
