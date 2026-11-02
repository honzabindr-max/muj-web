// Mission Control V2-A (final) — main page, role page. Same visual language as preview A.
import { formatDuration, safe } from "./view";
import { type FinalView, type LiveOrder, type RolePage, type RoleView, type Step } from "./final";
import { CSS_A } from "./preview";
import { ago, clock, esc, running } from "./render";
import { IDENTITY, symbol, type KeyEvent } from "./story";

const SYS_TONE: Record<string, string> = { working: "live", waiting: "wait", paused: "wait", problem: "bad", unavailable: "bad", unknown: "unknown" };

/** Query string that keeps demo mode across links (?demo=…&scenario=…). */
export type Qs = { base: string; with: (k: string, v: string) => string };
export function makeQs(demo?: string, scenario?: string): Qs {
  const p = new URLSearchParams();
  if (demo) p.set("demo", demo);
  if (scenario) p.set("scenario", scenario);
  const base = p.toString() ? `?${p}` : "";
  return { base, with: (k, v) => `?${new URLSearchParams([...p, [k, v]])}` };
}

function hue(r: RoleView): string {
  if (r.team) return IDENTITY[r.team].hue;
  let h = 0;
  for (const c of r.id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return String(h);
}

export function roleMark(r: RoleView, size: number): string {
  const inner = r.team
    ? symbol(r.team, size)
    : `<svg viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true"><rect x="4.5" y="4.5" width="23" height="23" rx="7" fill="none" stroke="currentColor" stroke-width="1.6"/><text x="16" y="20.5" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" font-family="-apple-system,system-ui,sans-serif">${esc(r.name.slice(0, 2))}</text></svg>`;
  return `<span class="mark" style="--h:${hue(r)}">${inner}</span>`;
}

function demoBanner(f: FinalView) {
  return f.view.demo ? `<div class="demo" role="note"><b>Ukázková data</b> · režim ?demo · nic z toho se neděje doopravdy · <a href="/">Zpět na reálná data</a></div>` : "";
}

function bar(f: FinalView, qs: Qs) {
  const v = f.view;
  return `<header class="bar">
  <a class="brand" href="/${qs.base}"><span class="logo" aria-hidden="true">${symbol("vedouci", 16)}</span><b>TARS</b><span class="sep">/</span><span>Mission Control</span></a>
  <div class="bar-mid">
    <span data-sys class="sys ${SYS_TONE[f.status]}"><i class="led" aria-hidden="true"></i>${esc(f.statusLabel)}</span>
    <span class="bar-kv"><span>Mise</span>${esc(f.focus?.mission ?? v.mission)}</span>
    <span class="bar-kv"><span>Běží zakázek</span>${f.orders.filter((o) => o.active).length}</span>
    <span class="bar-kv"><span>Rozhodnutí</span>${v.decisionsCount}</span>
    <span class="bar-kv"><span>Poslední potvrzení</span>${ago(v.lastContact, v.now)}</span>
  </div>
  <div class="bar-end"><a class="ghost" href="/detail">Technika</a><button class="ghost icon" id="theme" type="button" aria-label="Přepnout světlý / tmavý režim">◐</button></div>
</header>`;
}

const SUB: Record<Step["status"], string> = { done: "", current: "", future: "", error: "zastaveno", paused: "pozastaveno", skipped: "nedošlo" };
const KIND: Record<Step["kind"], string> = { plan: "plan", create: "create", check: "check", deliver: "deliver", owner: "owner" };

function flow(o: LiveOrder, qs: Qs) {
  return `<ol class="flow wide" aria-label="Průběh zakázky podle receptu">${o.steps
    .map((st, i) => {
      const prev = o.steps[i - 1];
      const reached = prev && prev.status === "done" && st.status !== "future" && st.status !== "skipped";
      const seg = i
        ? `<span class="seg${reached ? " on" : ""}${st.status === "current" ? " into" : ""}" aria-hidden="true">${
            st.returns
              ? `<span class="loop" title="${esc(`${st.label} vrátil práci zpět ${st.returns}×`)}"><svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M92 28 C 80 2, 20 2, 8 28" fill="none" stroke="currentColor" stroke-width="1.4" vector-effect="non-scaling-stroke"/><path d="M8 28 l-1.5 -6 M8 28 l5.5 -3" fill="none" stroke="currentColor" stroke-width="1.4" vector-effect="non-scaling-stroke"/></svg><em>${st.returns}× vráceno</em></span>`
              : ""
          }</span>`
        : "";
      const sub =
        st.status === "current" ? (st.kind === "owner" ? "čeká na tebe" : (st.note ?? (o.verified ? "právě teď" : "nelze ověřit"))) : st.status === "done" ? (st.at ? clock(st.at) : "hotovo") : SUB[st.status] || (st.who ?? "");
      const href = st.roleId ? `/role/${esc(st.roleId)}${qs.base}` : `/zakazka/${esc(o.id)}${qs.base}`;
      const cls = `node k-${KIND[st.kind]} s-${st.status}${st.status === "current" ? (st.kind === "owner" ? " owner-wait" : o.verified ? " live" : " unverified") : ""}`;
      const glyph = st.status === "done" ? "✓" : st.status === "error" ? "!" : st.status === "paused" ? "Ⅱ" : "";
      return `${seg}<li class="${cls}"><a href="${href}" aria-label="${esc(`${st.label}: ${sub}`)}"><span class="orb"><span class="ring" aria-hidden="true"></span><span class="glyph">${glyph}</span></span><span class="nl">${esc(st.label)}</span><span class="ns">${esc(sub)}</span></a></li>`;
    })
    .join("")}</ol>`;
}

const BADGE: Record<RoleView["status"], string> = { working: "Pracuje", checking: "Kontroluje", waiting: "Převezme dál", idle: "V klidu", unknown: "Nelze ověřit", alarm: "Poplach", ok: "Vše v pořádku" };

function hero(r: RoleView, o: LiveOrder, qs: Qs) {
  return `<a class="spot st-${r.status}" href="/role/${esc(r.id)}${qs.base}">
    <div class="spot-top">${roleMark(r, 40)}<span class="badge st-${r.status}"><i class="led" aria-hidden="true"></i>${esc(o.verified ? BADGE[r.status] : "Nelze ověřit")}</span></div>
    <div class="spot-name">${esc(r.name)}</div><div class="spot-role">${esc(r.sub)}</div>
    <div class="spot-act">${esc(o.activeStep ? `Krok „${o.activeStep.stepName}“ na této zakázce` : r.activity)}${r.works.length > 1 ? ` · celkem na ${r.works.length} zakázkách` : ""}</div>
    <div class="spot-model">${o.activeStep?.who ? esc(o.activeStep.who) : "model na této zakázce zatím nedoložen"}</div></a>`;
}

function nextCard(r: RoleView, qs: Qs) {
  return `<a class="nextm" href="/role/${esc(r.id)}${qs.base}"><span class="nm-row">${roleMark(r, 26)}<span><span class="nm-k">Převezme práci</span><span class="nm-n">${esc(r.name)} <span>${r.model ? esc(r.model) : ""}</span></span></span></span></a>`;
}

function idleSpot(f: FinalView) {
  const v = f.view;
  return `<div class="spot idle"><div class="spot-top"><span class="mark" style="--h:${IDENTITY.vedouci.hue}">${symbol("vedouci", 40)}</span><span class="badge st-idle">V klidu</span></div>
    <div class="spot-name">Nikdo teď nepracuje</div><div class="spot-act">${esc(v.next.what)}.${v.next.blocker ? ` ${esc(v.next.blocker)}` : ""}</div></div>`;
}

function decisionsChip(f: FinalView) {
  const n = f.view.decisionsCount;
  return n ? `<a class="calm-chip warn" href="#rozhodnuti"><i aria-hidden="true">◆</i>${n} ${n === 1 ? "rozhodnutí čeká" : "rozhodnutí čekají"} na tebe</a>` : `<span class="calm-chip"><i aria-hidden="true">✓</i>Nic nečeká na tvoje rozhodnutí</span>`;
}

function stage(f: FinalView, qs: Qs) {
  const o = f.focus;
  if (!o) return `<section class="stage empty" data-phase="none"><div class="eyebrow">Teď</div><h1 class="h-title">Zatím žádná zakázka</h1><p class="h-sub">${esc(f.view.statusSentence)}</p></section>`;
  const h = o.headline;
  const primary = o.active && o.activeRole ? f.roles.find((r) => r.id === o.activeRole) : undefined;
  const next = o.active && o.verified && o.nextRole ? f.roles.find((r) => r.id === o.nextRole) : undefined;
  return `<section class="stage t-${h.tone}${o.verified ? " is-live" : ""}" data-phase="${esc(f.phaseKey)}">
  <div class="stage-top"><div class="eyebrow"><i class="led" aria-hidden="true"></i>${o.verified ? "Právě teď" : o.active ? "Rozpracováno · nelze ověřit" : o.state === "WAITING_OWNER" ? "Čeká na tebe" : "Poslední zakázka"} · ${esc(o.mission)} · ${esc(o.department)}${o.recipe ? ` · recept ${esc(o.recipe)}` : ""}</div>${decisionsChip(f)}</div>
  <div class="stage-grid">
    <div class="story">
      <h1 class="h-title">${esc(h.title)}</h1>
      <p class="h-sub">${esc(h.subtitle)}</p>
      <dl class="vitals">
        <div><dt>${o.endedAt ? "Trvala" : "Běží"}</dt><dd>${running(o.startedAt, o.endedAt, f.view.now)}</dd></div>
        <div><dt>Poslední ověřená událost</dt><dd>${o.lastEvent ? `${esc(o.lastEvent.text)} <span class="quiet">${ago(o.lastEvent.at, f.view.now)}</span>` : "zatím žádná"}</dd></div>
        <div><dt>Další předání</dt><dd>${o.active && o.nextLabel ? esc(o.nextLabel) : o.endedAt ? "žádné — zakázka skončila" : "—"}</dd></div>
      </dl>
      <a class="tech" href="/zakazka/${esc(o.id)}${qs.base}"><span>${esc(h.technical)}</span><span class="tid">${esc(o.id)} →</span></a>
    </div>
    <div class="cast">${primary ? hero(primary, o, qs) : idleSpot(f)}${next ? nextCard(next, qs) : ""}</div>
  </div>
  ${flow(o, qs)}
  ${o.problem ? `<div class="problem"><b>Co to znamená</b> ${esc(o.problem.consequence)}</div>` : ""}
</section>`;
}

function runningRows(f: FinalView, qs: Qs) {
  if (!f.running.length) return "";
  return `<section class="runs" aria-label="Další běžící zakázky"><h2>Současně běží</h2><ul>${f.running
    .map((o) => {
      const r = o.activeRole ? f.roles.find((x) => x.id === o.activeRole) : undefined;
      const tone = o.state === "WAITING_OWNER" ? "wait" : !o.verified ? "unknown" : o.activeStep?.kind === "check" ? "check" : "live";
      return `<li><a class="run t-${tone}" href="/${qs.with("focus", o.id)}">
        <i class="led" aria-hidden="true"></i>
        <span class="rt"><b>${esc(o.headline.title)}</b><span>${esc(o.headline.technical)}</span></span>
        <span class="rr">${r ? `${roleMark(r, 18)}${esc(r.name)}` : '<span class="quiet">—</span>'}</span>
        <span class="rs">${esc(o.activeStep ? `${o.activeStep.stepName} · krok ${o.steps.indexOf(o.activeStep) + 1} z ${o.steps.length}` : o.stateLabel)}${o.verified ? "" : " · nelze ověřit"}</span>
        <span class="rd">${running(o.startedAt, o.endedAt, f.view.now)}</span>
        <span class="go" aria-hidden="true">→</span></a></li>`;
    })
    .join("")}</ul></section>`;
}

function team(f: FinalView, qs: Qs) {
  const o = f.focus;
  const skip = new Set([o?.active ? o.activeRole : undefined, o?.active && o.verified ? o.nextRole : undefined].filter(Boolean) as string[]);
  const others = f.roles.filter((r) => !skip.has(r.id)).sort((a, b) => rank(a) - rank(b));
  return `<section class="crew" aria-label="AI tým"><h2>Tým</h2><div class="pills">${others
    .map((r) => {
      const w = r.works.filter((x) => x.order !== o?.id)[0] ?? r.next.filter((x) => x.order !== o?.id)[0];
      return `<a class="pill st-${r.status}" href="/role/${esc(r.id)}${qs.base}">${roleMark(r, 20)}<span class="pt"><span class="pn">${esc(r.name)}</span><span class="ps">${esc(r.statusLabel)}${w ? ` · ${esc(f.orders.find((x) => x.id === w.order)?.headline.technical ?? w.order)}` : ""}</span></span></a>`;
    })
    .join("")}</div></section>`;
}
const rank = (r: RoleView) => (r.status === "working" || r.status === "checking" ? 0 : r.status === "waiting" ? 1 : r.status === "unknown" || r.status === "alarm" ? 2 : 3);

const EVENT_MARK: Record<KeyEvent["kind"], string> = { handoff: "→", "verdict-ok": "✓", "verdict-fix": "↺", "verdict-stop": "■", delivery: "◆", problem: "!" };

function lower(f: FinalView, qs: Qs) {
  const v = f.view;
  const t = v.today;
  const zak = t.total === 1 ? "zakázka" : t.total >= 2 && t.total <= 4 ? "zakázky" : "zakázek";
  const sentence = t.delivered ? `Dnes doručeno ${t.delivered} z ${t.total} ${zak}.` : t.total ? `Dnes zatím nic doručeno. ${t.total} ${zak}: ${t.failed} se zastavilo, ${t.unknown} nelze ověřit.` : "Dnes zatím žádná zakázka.";
  const dels = v.deliveries.map((d) => `<li class="del"><a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.title)} ↗</a><span>${esc(d.status)} · vytvořil ${esc(d.creator)} · ověřil ${esc(d.checker)} · ${esc(clock(d.at))}</span></li>`).join("");
  const ord = f.orders
    .slice(0, 6)
    .map((o) => `<li><a class="oline ${o.state === "FAILED" ? "bad" : o.state === "UNKNOWN" ? "unknown" : o.active ? "live" : o.state === "WAITING_OWNER" ? "wait" : "ok"}" href="/${qs.with("focus", o.id)}"><i class="led" aria-hidden="true"></i><span class="ot">${esc(o.headline.technical)}</span><span class="os">${esc(o.stateLabel)} · ${esc(clock(o.startedAt))}</span></a></li>`)
    .join("");
  let lastOrder = "";
  const evs = f.events.length
    ? `<ol class="events">${f.events
        .slice(0, 10)
        .map((e) => {
          const head = e.order !== lastOrder ? `<li class="eg"><a href="/${qs.with("focus", e.order)}">${esc(e.orderTitle)}</a></li>` : "";
          lastOrder = e.order;
          return `${head}<li class="e ev-${e.kind}"><span class="et">${esc(clock(e.at))}</span><span class="em" aria-hidden="true">${EVENT_MARK[e.kind]}</span><span class="ex">${esc(e.text)}</span></li>`;
        })
        .join("")}</ol>`
    : `<p class="quiet">Zatím žádné doložené události.</p>`;
  return `<div class="lower"><section class="panel"><h2>Výsledky dnes</h2><p class="res-s">${esc(sentence)}</p>${dels ? `<ul class="dels">${dels}</ul>` : ""}<ul class="olist">${ord}</ul></section><section class="panel"><h2>Důležité události</h2>${evs}</section></div>`;
}

function decisionsBlock(f: FinalView) {
  const v = f.view;
  if (!v.decisions.length) return "";
  return `<section class="panel decide-a" id="rozhodnuti"><h2>Moje rozhodnutí</h2><div class="decisions">${v.decisions
    .map((d) => `<article class="dec"><div class="dec-t">${esc(d.title)}</div><div class="dec-w">${esc(d.why)}</div><div class="dec-r">${esc(d.recommendation)}</div><div class="dec-l">${d.links.map((l) => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`).join("") || '<span class="quiet">Odkaz na GO kartu nezaznamenán</span>'}</div></article>`)
    .join("")}</div></section>`;
}

const FOOT = `<footer class="foot">Jen čtení · obnova 3 s · stav počítá kód z runs/*/state.json, runs/log.jsonl a zámků běhu · titulky skládá kód ze stavu, receptu a role, ne model</footer>`;

export function renderFinal(f: FinalView, qs: Qs): string {
  return `${demoBanner(f)}${bar(f, qs)}<main class="a">${stage(f, qs)}${decisionsBlock(f)}${runningRows(f, qs)}${team(f, qs)}${lower(f, qs)}${FOOT}</main>`;
}

/** Card section lines → small safe HTML (lists and paragraphs, inline code). */
function mdLines(lines: string[]): string {
  const inline = (t: string) => esc(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  let out = "";
  let list: "ul" | "ol" | "" = "";
  for (const raw of lines) {
    const l = safe(raw, 600);
    const ul = /^[-*]\s+(.*)$/.exec(l);
    const ol = /^\d+[.)]\s+(.*)$/.exec(l);
    const want = ul ? "ul" : ol ? "ol" : "";
    if (list && want !== list) {
      out += `</${list}>`;
      list = "";
    }
    if (want && !list) {
      out += `<${want}>`;
      list = want;
    }
    out += want ? `<li>${inline((ul ?? ol)![1])}</li>` : /^\|/.test(l) ? `<p class="mono">${inline(l)}</p>` : `<p>${inline(l)}</p>`;
  }
  return list ? `${out}</${list}>` : out;
}

export function renderRole(p: RolePage, f: FinalView, qs: Qs): string {
  const r = p.role;
  const undefinedBlock = `<p class="undef">Zatím nedefinováno</p><p class="quiet small">${r.card ? "Karta specialisty tuto sekci (§2c) zatím nemá." : "Role nemá vlastní kartu specialisty."} Panel nic nedomýšlí.</p>`;
  const cardInfo = r.card
    ? `<dl class="kv"><dt>Karta</dt><dd><code>${esc(safe(r.card.file, 200))}</code></dd><dt>Model podle karty</dt><dd>${esc(safe(r.card.model, 120) || "—")}</dd><dt>Adaptér</dt><dd>${esc(safe(r.card.adapter, 120) || "—")}</dd><dt>Příčka §2b</dt><dd>${esc(safe(r.card.rung, 120) || "—")}</dd></dl>`
    : `<p class="quiet">${r.id === "kontrolor" ? "Kontrolor nemá vlastní kartu: jeho checklist je v kartě každého tvůrce (bod 6. Kontrolor)." : r.id === "strazce" ? "Strážce je deterministický skript TARS-GUARD (hook), ne model; nemá kartu specialisty." : "Karta specialisty pro tuto roli v repu chybí. Podle §2a se role bez karty nesmí spustit."}</p>`;
  const assign = (list: RoleView["works"], empty: string) =>
    list.length ? `<ul class="alist">${list.map((a) => `<li><a href="/${qs.with("focus", a.order)}"><b>${esc(a.title)}</b><span>${esc(a.step)} · ${esc(a.order)}${a.verified ? "" : " · nelze ověřit"}</span></a></li>`).join("")}</ul>` : `<p class="quiet">${empty}</p>`;
  const hist = p.history.length
    ? `<table class="htable"><thead><tr><th>Čas</th><th>Zakázka</th><th>Co</th><th>Výsledek</th><th>Trvání</th></tr></thead><tbody>${p.history
        .map((h) => `<tr><td>${esc(clock(h.at))}</td><td>${h.order === "-" ? "—" : `<a href="/${qs.with("focus", h.order)}">${esc(h.title)}</a>`}</td><td>${esc(h.what)}${h.model ? `<span class="quiet small"> · ${esc(h.model)}</span>` : ""}</td><td>${esc(h.result ?? "")}</td><td>${h.durationMs ? esc(formatDuration(h.durationMs)) : "—"}</td></tr>`)
        .join("")}</tbody></table>`
    : `<p class="quiet">Žádná doložená práce v záznamu.</p>`;
  return `${demoBanner(f)}${bar(f, qs)}<main class="a role-page">
  <a class="back" href="/${qs.base}">← Mission Control</a>
  <section class="stage role-head t-${r.status === "working" ? "live" : r.status === "checking" ? "check" : r.status === "alarm" ? "bad" : "unknown"}" data-phase="${esc(`role|${r.id}|${r.status}`)}">
    <div class="rh">${roleMark(r, 44)}<div><div class="eyebrow">Role</div><h1 class="h-title">${esc(r.name)}</h1><p class="rh-sub">${esc(r.sub)}</p></div><span class="badge st-${r.status}"><i class="led" aria-hidden="true"></i>${esc(r.statusLabel)}</span></div>
    <p class="h-sub">${esc(r.responsibility)}</p>
    <dl class="vitals"><div><dt>Model (doložený)</dt><dd>${r.model ? esc(r.model) : "nedoložen"}</dd></div><div><dt>Dnes</dt><dd>${r.callsToday}× · ${esc(formatDuration(r.workMsToday))}</dd></div><div><dt>Teď</dt><dd>${esc(r.activity)}</dd></div></dl>
  </section>
  <div class="lower">
    <section class="panel"><h2>Postup</h2>${r.card?.postup ? `<div class="md">${mdLines(r.card.postup)}</div>` : undefinedBlock}</section>
    <section class="panel"><h2>Dosah</h2>${r.card?.dosah ? `<div class="md">${mdLines(r.card.dosah)}</div>` : undefinedBlock}</section>
  </div>
  <div class="lower">
    <section class="panel"><h2>Aktuální práce</h2>${assign(r.works, "Teď na žádné zakázce.")}<h2 class="h2b">Převezme jako další</h2>${assign(r.next, "Nic.")}</section>
    <section class="panel"><h2>Karta specialisty</h2>${cardInfo}</section>
  </div>
  <section class="panel"><h2>Historie práce role</h2>${hist}</section>
  ${FOOT}
</main>`;
}

export const CSS_FINAL =
  CSS_A +
  `
.flow .s-current.owner-wait .orb{border-style:solid;border-color:var(--wait);color:var(--wait);background:var(--wait-s)}.flow .s-current.owner-wait .ns{color:var(--wait)}
a.spot{display:block;color:inherit}a.spot:hover{color:inherit;border-color:var(--acc)}a.nextm{display:block;color:inherit}a.nextm:hover{color:inherit;border-color:var(--line2)}
.nm-row{display:flex;align-items:center;gap:14px}.nm-row .mark{width:42px;height:42px;border-radius:13px;background:color-mix(in srgb,var(--c) 10%,transparent)}.nm-k{display:block;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);font-weight:650}.nm-n{display:block}
.calm-chip.warn{color:var(--wait);border-color:color-mix(in srgb,var(--wait) 45%,transparent);background:var(--wait-s)}.calm-chip.warn i{color:var(--wait)}
.runs ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.run{display:grid;grid-template-columns:14px minmax(0,2.2fr) minmax(0,1fr) minmax(0,1fr) auto 18px;gap:16px;align-items:center;padding:14px 20px;border-radius:16px;border:1px solid var(--line);background:var(--s1);box-shadow:var(--sh);color:inherit}
.run:hover{border-color:var(--line2);color:inherit}.run .led{margin:0}.t-live .led{color:var(--live)}.t-check .led{color:var(--acc)}.t-wait .led{color:var(--wait)}.t-unknown .led{color:var(--unk)}
.rt{display:flex;flex-direction:column;min-width:0}.rt b{font-weight:640;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rt span{font-size:12.5px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rr{display:flex;align-items:center;gap:8px;font-weight:560;white-space:nowrap}.rr .mark{width:26px;height:26px;border-radius:8px;background:color-mix(in srgb,var(--c) 10%,transparent)}
.rs{font-size:13.5px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rd{font-variant-numeric:tabular-nums;font-size:13.5px;color:var(--mute)}.go{color:var(--mute)}
a.pill{display:flex;align-items:center;gap:12px;color:inherit;max-width:420px}a.pill:hover{color:inherit}.pt{display:flex;flex-direction:column;line-height:1.3;min-width:0}.pt .ps{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pill.st-working{border-color:color-mix(in srgb,var(--live) 45%,var(--line))}.pill.st-working .ps{color:var(--live)}.pill.st-checking{border-color:color-mix(in srgb,var(--acc) 45%,var(--line))}.pill.st-checking .ps{color:var(--acc)}.pill.st-waiting .ps{color:var(--ink2)}
.back{color:var(--mute);font-size:14px}.role-head{padding-bottom:28px}.rh{display:flex;align-items:center;gap:20px;margin-bottom:18px}.rh>div{flex:1}.rh .mark{width:76px;height:76px;border-radius:22px;background:color-mix(in srgb,var(--c) 12%,transparent);border:1px solid color-mix(in srgb,var(--c) 30%,transparent)}
.rh .h-title{margin:0}.rh-sub{margin:4px 0 0;color:var(--mute)}.role-head .vitals{margin:6px 0 0;grid-template-columns:1fr 1fr 1.4fr}
.undef{font-size:17px;font-weight:600;color:var(--ink2);margin:0 0 6px}.small{font-size:13px}
.md{font-size:14.5px;color:var(--ink2)}.md ul,.md ol{margin:0 0 10px;padding-left:20px}.md li{margin:4px 0}.md p{margin:0 0 8px}.md code,.kv code{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12.5px;color:var(--ink)}.md .mono{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12px;white-space:pre-wrap}
.kv{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;margin:0;font-size:14px}.kv dt{color:var(--mute)}.kv dd{margin:0;overflow-wrap:anywhere}
.alist{list-style:none;margin:0 0 8px;padding:0}.alist a{display:flex;flex-direction:column;padding:10px 0;border-top:1px solid var(--line);color:inherit}.alist li:first-child a{border-top:0;padding-top:0}.alist span{font-size:13px;color:var(--mute)}.h2b{margin-top:22px}
.htable{width:100%;border-collapse:collapse;font-size:14px}.htable th{text-align:left;font-weight:600;color:var(--mute);font-size:12.5px;padding:0 10px 10px 0}.htable td{padding:9px 10px 9px 0;border-top:1px solid var(--line);vertical-align:top}.htable td:first-child,.htable td:last-child{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--mute)}.htable a:hover{color:var(--acc)}
@media (max-width:1240px){.run{grid-template-columns:14px minmax(0,1.6fr) minmax(0,1fr) auto 18px}.run .rs{display:none}}
@media (max-width:980px){.run{grid-template-columns:14px minmax(0,1fr) auto}.run .rr,.run .go{display:none}.role-head .vitals{grid-template-columns:1fr}}
`;
