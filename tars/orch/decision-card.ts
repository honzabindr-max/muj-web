// Visual decision card (TARS-ORCH-001 §2e bod 4, DR-024): GET /rozhodnuti/<id> renders the Konzilium package
// (runs/<id>/decision.json) — recommended version in the customer's view (MEZI VÁMI web tokens: plum, EB Garamond + Jost),
// the alternative next to it, the council's thumbs and reasons, buttons GO / alternativa / REJECT.
// POST /rozhodnuti/<id> is the ONLY write action of the panel: loopback peer + Host/Origin check + CSRF token,
// then exactly the same path as `cli.ts owner <id> GO|ALT|REJECT` (the CLI is spawned, no shell).
// Kept in its own file so panel-server.ts needs a single hook line (parallel work on the dashboard).
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import type http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  Block,
  DecisionPackage,
  DecisionView,
  ExpertVerdict,
} from "./konzilium";
import type { Order, OwnerChoice } from "./types";

const here = path.dirname(fileURLToPath(import.meta.url));
const ORDER_RE = /^wo-[0-9A-Za-z-]+$/;
const CHOICES: OwnerChoice[] = ["GO", "ALT", "REJECT"];

const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

/** Per-process secret; tokens are HMAC(secret, order id). Never logged, never leaves the page. */
const SECRET = crypto.randomBytes(32);

export function csrfToken(id: string, secret: Buffer = SECRET): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`rozhodnuti:${id}`)
    .digest("hex");
}

export function csrfOk(
  id: string,
  token: string,
  secret: Buffer = SECRET,
): boolean {
  const a = Buffer.from(csrfToken(id, secret));
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isLoopback(addr: string | undefined): boolean {
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

/** Host must be the panel itself; Origin (when sent) must match Host — blocks cross-site and DNS-rebinding posts. */
export function hostOriginOk(
  host: string | undefined,
  origin: string | undefined,
): boolean {
  if (!host || !/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host))
    return false;
  if (origin === undefined) return true;
  return origin === `http://${host}`;
}

// ───────────────────────────── rendering ─────────────────────────────

const MARK: Record<string, { icon: string; label: string; cls: string }> = {
  PALEC: { icon: "👍", label: "palec", cls: "ok" },
  VYHRADA: { icon: "✋", label: "výhrada", cls: "warn" },
  UPRAVA: { icon: "✎", label: "úprava", cls: "edit" },
};

function renderBlocks(blocks: Block[]): string {
  const sections = blocks.filter((b) => b.kind === "section");
  let sectionsDone = false;
  return blocks
    .map((b) => {
      switch (b.kind) {
        case "eyebrow":
          return `<p class="eyebrow">${esc(b.text)}</p>`;
        case "headline":
          return `<h2 class="headline">${esc(b.text)}</h2>`;
        case "lede":
          return `<p class="lede">${esc(b.text)}</p>`;
        case "section":
          if (sectionsDone) return "";
          sectionsDone = true;
          return `<ol class="sections">${sections.map((s, i) => `<li><span class="num">${String(i + 1).padStart(2, "0")}</span><div>${s.label ? `<p class="slabel">${esc(s.label)}</p>` : ""}<p class="stext">${esc(s.text)}</p></div></li>`).join("")}</ol>`;
        case "price":
          return `<p class="price">${esc(b.text)}</p>`;
        case "cta":
          return `<span class="cta" role="presentation">${esc(b.text)}</span>`;
        case "list":
          return `<ul class="list">${b.text
            .split(/\n+/)
            .map((l) => `<li>${esc(l.replace(/^[-•]\s*/, ""))}</li>`)
            .join("")}</ul>`;
        case "option":
          return `<div class="option">${b.label ? `<p class="olabel">${esc(b.label)}</p>` : ""}<p>${esc(b.text)}</p></div>`;
        default:
          return `<p class="note">${esc(b.text)}</p>`;
      }
    })
    .join("");
}

function renderView(v: DecisionView, tag: string, primary: boolean): string {
  return `<section class="col ${primary ? "rec" : "alt"}"><header class="colhead"><span class="tag">${esc(tag)}</span><h3>${esc(v.label)}</h3>${v.summary ? `<p class="mute">${esc(v.summary)}</p>` : ""}</header>
<div class="phone"><div class="mvp">${renderBlocks(v.blocks)}</div></div></section>`;
}

function renderExpert(e: ExpertVerdict): string {
  const m = e.verdict
    ? MARK[e.verdict]
    : { icon: "·", label: "bez verdiktu", cls: "none" };
  const ch = e.changes.length
    ? `<ul class="changes">${e.changes.map((c) => `<li><q>${esc(c.target)}</q> → <b>${esc(c.proposal)}</b><div class="mute">${esc(c.reason)} · zdroj: <span class="${c.no_source ? "warnc" : ""}">${esc(c.source)}</span></div></li>`).join("")}</ul>`
    : "";
  return `<details class="expert ${m.cls}"><summary><span class="mark">${m.icon}</span><span class="who">${esc(e.title)}</span><span class="fam">${esc(e.family)} · ${esc(m.label)}</span></summary><p>${esc(e.summary || e.error || "")}</p>${ch}<p class="mute small">${esc(e.model)}</p></details>`;
}

export function renderDecisionPage(
  pkg: DecisionPackage,
  order: Order | undefined,
  token: string,
  notice = "",
  rev = "",
): string {
  const decided = order && order.state !== "WAITING_OWNER";
  const state = order?.state ?? "UNKNOWN";
  const thumbs = pkg.experts
    .map((e) => (e.verdict ? MARK[e.verdict].icon : "·"))
    .join(" ");
  const buttons = decided
    ? `<p class="decided">Rozhodnuto: <b>${esc(order?.owner_choice ?? state)}</b> (stav zakázky ${esc(state)}).</p>`
    : `<form method="post" action="/rozhodnuti/${esc(pkg.order)}" class="actions">
<input type="hidden" name="csrf" value="${esc(token)}">
<input type="hidden" name="rev" value="${esc(rev)}">
${pkg.merge?.blocked ? `<span class="mute">Automatický merge zablokován — GO nejde.</span>` : `<button name="choice" value="GO" class="b go">GO — doporučená verze</button>`}
${pkg.alternative ? `<button name="choice" value="ALT" class="b altb">Zvolit alternativu</button>` : ""}
<button name="choice" value="REJECT" class="b rej">REJECT</button></form>`;
  const kind =
    pkg.kind === "prep"
      ? "Příprava rozhodnutí"
      : pkg.kind === "merge"
        ? "Merge (třída B)"
        : "Copy";
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rozhodnutí · ${esc(pkg.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<main>
<p class="crumb"><a href="/">← TARS</a> · <a href="/rozhodnuti">všechna rozhodnutí</a></p>
${notice ? `<p class="notice">${esc(notice)}</p>` : ""}
<header class="top"><p class="eyebrow">${esc(kind)} · milník ${esc(pkg.milestone)} · ${esc(pkg.order)}</p>
<h1>${esc(pkg.title)}</h1>
<p class="lede">Doporučení: <b>${esc(pkg.recommended.label)}</b>. Autor doporučení: ${esc(pkg.author.role)} · ${esc(pkg.author.model)}. Rada: <span class="thumbs">${thumbs}</span></p>
${buttons}
</header>
<div class="cols">${renderView(pkg.recommended, "Doporučeno", true)}${pkg.alternative ? renderView(pkg.alternative, "Alternativa", false) : `<section class="col alt empty"><p class="mute">Alternativa není — soudce doporučuje jen jednu verzi.</p></section>`}</div>
<section class="panel"><h2>Proč</h2><ul>${pkg.reasons.map((r) => `<li>${esc(r)}</li>`).join("") || "<li class='mute'>soudce neuvedl</li>"}</ul></section>
<section class="panel"><h2>Rada odborníků</h2>${pkg.experts.map(renderExpert).join("")}</section>
<section class="panel"><h2>Otázky prvního principu</h2><ul class="qs">${pkg.advocate
    .map(
      (q) =>
        `<li><b>${esc(q.question)}</b>${q.mandatory ? ` <span class="pill">povinná</span>` : ""} <span class="pill ${q.touches}">${q.touches === "sponsor" ? "rozhodnutí Sponzora" : q.touches === "contract" ? "zamčený kontrakt" : "pro radu"}</span><div class="mute">${esc(q.why)}</div>${q.prep_order ? `<div>→ <a href="/rozhodnuti/${esc(q.prep_order)}">Příprava rozhodnutí ${esc(q.prep_order)}</a></div>` : ""}</li>`,
    )
    .join("")}</ul></section>
<section class="panel"><h2>Spory</h2><ul>${pkg.disputes.map((d) => `<li>${esc(d)}</li>`).join("") || "<li class='mute'>žádné</li>"}</ul></section>
${pkg.merge ? `<section class="panel"><h2>Pull request</h2><p><a href="${esc(pkg.merge.pr)}">${esc(pkg.merge.pr)}</a> · třída ${esc(pkg.merge.cls)}</p><ul>${pkg.merge.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></section>` : ""}
<section class="panel"><h2>Vyhrazeno Sponzorovi</h2><ul>${pkg.sponsor_reserved.map((r) => `<li>${esc(r)}</li>`).join("") || "<li class='mute'>nic</li>"}</ul><p class="mute">GO vybírá verzi; nezamyká cenu, název ani právní znění.</p></section>
<p class="honest">${esc(pkg.honest_note)}</p>
<p class="mute small">Tvůrce: ${esc(pkg.creator.role)} · ${esc(pkg.creator.model)}. Archiv: ${pkg.notion_archive_url ? `<a href="${esc(pkg.notion_archive_url)}">Notion</a>` : "—"}${pkg.drafts.notion ? ` · <a href="${esc(pkg.drafts.notion)}">DRAFT před konziliem</a>` : ""}. Zdroj: runs/${esc(pkg.order)}/decision.json.</p>
</main></body></html>`;
}

export function renderIndex(
  items: Array<{ pkg: DecisionPackage; order?: Order }>,
): string {
  const rows = items
    .map(
      ({ pkg, order }) =>
        `<li><a href="/rozhodnuti/${esc(pkg.order)}">${esc(pkg.title)}</a> <span class="pill">${esc(order?.state ?? "?")}</span> <span class="mute">${esc(pkg.order)} · ${esc(pkg.kind)}</span></li>`,
    )
    .join("");
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rozhodnutí</title><style>${CSS}</style></head><body><main><p class="crumb"><a href="/">← TARS</a></p><h1>Rozhodnutí</h1><ul class="qs">${rows || "<li class='mute'>Žádné rozhodovací balíčky.</li>"}</ul></main></body></html>`;
}

const CSS = `:root{--bg:#0D090E;--ink:#F2E8E4;--soft:#EADCE2;--mute:#A897A3;--acc:#E8B391;--acc2:#F0B48F;--line:#3A2535}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(1200px 600px at 70% -10%,#2A1230 0%,var(--bg) 60%);color:var(--ink);font:300 15px/1.55 Jost,system-ui,sans-serif}
main{max-width:1180px;margin:0 auto;padding:20px 18px 60px}a{color:#EFCDB8}.mute{color:var(--mute)}.small{font-size:12px}
.crumb{font-size:13px;margin:0 0 14px}.notice{background:#2A1230;border:1px solid var(--line);padding:10px 14px;border-radius:12px}
.top h1,h2,h3,.headline{font-family:"EB Garamond",Georgia,serif;font-weight:400}.top h1{font-size:34px;line-height:1.15;margin:4px 0 8px}
.eyebrow{letter-spacing:.14em;text-transform:uppercase;font-size:11px;color:var(--acc2);margin:0}.lede{color:var(--soft);font-size:16px}
.thumbs{font-size:18px;letter-spacing:4px}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 4px}.b{font:500 15px Jost,sans-serif;min-height:50px;padding:0 24px;border-radius:999px;cursor:pointer;border:1px solid rgba(240,190,165,.45);background:rgba(255,225,205,.04);color:#F7EAE4}
.b.go{background:linear-gradient(180deg,#F7D5BB 0%,#E8B391 100%);color:#2A1220;border:0;box-shadow:0 10px 30px rgba(240,160,130,.35)}.b.rej{color:#E8A4A8;border-color:rgba(232,164,168,.4)}
.decided{padding:10px 14px;border:1px solid var(--line);border-radius:12px;display:inline-block}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:20px 0}@media(max-width:860px){.cols{grid-template-columns:1fr}}
.col{border-radius:24px;padding:16px;border:1px solid transparent;background:linear-gradient(170deg,rgba(46,24,48,.92),rgba(24,12,26,.94)) padding-box,linear-gradient(140deg,rgba(255,214,190,.45),rgba(185,138,198,.1) 60%) border-box}
.col.alt{opacity:.92}.col.empty{display:flex;align-items:center;justify-content:center}.colhead h3{margin:2px 0;font-size:22px}.tag{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--acc)}
.phone{margin-top:12px;border-radius:28px;background:#0D090E;padding:26px 20px;border:1px solid #2A1A28;max-width:430px}
.mvp .headline{font-size:30px;line-height:1.12;margin:6px 0 12px;background:linear-gradient(135deg,#FFE3CF,#E9AFC0);-webkit-background-clip:text;background-clip:text;color:transparent}
.mvp .lede{font-size:15px;line-height:1.65;color:var(--soft)}.mvp .sections{list-style:none;padding:0;margin:16px 0;display:grid;gap:10px}
.mvp .sections li{display:flex;gap:10px;padding:12px 14px;border-radius:16px;background:rgba(46,24,48,.6);border:1px solid #3A2535}.mvp .num{flex:0 0 28px;font-family:"EB Garamond",serif;font-size:20px;color:#E9AFC0}
.mvp .slabel{margin:0;font-size:14px;color:#F7EAE4;font-weight:400}.mvp .stext{margin:2px 0 0;font-size:13px;color:#C2ACB7}
.mvp .price{font-family:"EB Garamond",serif;font-size:26px;margin:14px 0 6px;color:#F7EAE4}.mvp .cta{display:flex;align-items:center;justify-content:center;min-height:54px;padding:0 26px;margin:12px 0;border-radius:999px;background:linear-gradient(180deg,#F7D5BB 0%,#E8B391 100%);color:#2A1220;font-size:15px;font-weight:500;box-shadow:0 10px 30px rgba(240,160,130,.4)}
.mvp .note{font-size:12px;color:#A8909D}.mvp .option{padding:12px 14px;border-radius:16px;border:1px solid #3A2535;margin:10px 0}.mvp .olabel{margin:0 0 4px;font-family:"EB Garamond",serif;font-size:20px;color:#F7EAE4}
.panel{margin:16px 0;padding:14px 18px;border:1px solid var(--line);border-radius:18px;background:rgba(18,10,18,.6)}.panel h2{margin:0 0 8px;font-size:22px}
.expert{border-top:1px solid var(--line);padding:8px 0}.expert summary{display:flex;gap:10px;align-items:baseline;cursor:pointer}.mark{font-size:18px}.who{font-weight:400}.fam{color:var(--mute);font-size:12px}
.expert.ok .fam{color:#9FD2A8}.expert.warn .fam{color:#E7C27A}.expert.edit .fam{color:#E8B391}.changes q{color:#C2ACB7}.warnc{color:#E7C27A}
.qs{list-style:none;padding:0}.qs li{margin:0 0 12px}.pill{font-size:11px;padding:1px 8px;border-radius:99px;border:1px solid var(--line);color:var(--mute)}.pill.sponsor{color:#E8B391;border-color:#6B4038}.pill.contract{color:#E8A4A8}
.honest{font-family:"EB Garamond",serif;font-style:italic;font-size:17px;color:var(--soft);border-left:2px solid var(--acc2);padding-left:12px}`;

// ───────────────────────────── route ─────────────────────────────

export interface DecisionRouteOpts {
  /** Runs the owner decision; default spawns `npx tsx tars/orch/cli.ts owner <id> <choice>` (same path as the CLI). */
  runOwner?: (
    id: string,
    choice: OwnerChoice,
    rev: string,
  ) => Promise<{ code: number; out: string }>;
  secret?: Buffer;
}

function loadOrder(root: string, id: string): Order | undefined {
  const f = path.join(root, id, "state.json");
  return fs.existsSync(f)
    ? (JSON.parse(fs.readFileSync(f, "utf8")) as Order)
    : undefined;
}

/** sha256 of decision.json bytes — the revision the page shows and the POST must carry. */
function rev(root: string, id: string): string {
  const f = path.join(root, id, "decision.json");
  return fs.existsSync(f) ? crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex") : "";
}

function loadPkg(root: string, id: string): DecisionPackage | undefined {
  const f = path.join(root, id, "decision.json");
  return fs.existsSync(f)
    ? (JSON.parse(fs.readFileSync(f, "utf8")) as DecisionPackage)
    : undefined;
}

export function spawnOwnerCli(
  root: string,
): (id: string, choice: OwnerChoice, rev: string) => Promise<{ code: number; out: string }> {
  const repoRoot = path.resolve(here, "../..");
  return (id, choice, rev) =>
    new Promise((resolve) => {
      if (!ORDER_RE.test(id) || !CHOICES.includes(choice) || !/^[0-9a-f]{64}$/.test(rev))
        return resolve({ code: 2, out: "neplatný vstup" });
      const p = spawn("npx", ["tsx", "tars/orch/cli.ts", "owner", id, choice, "--rev", rev], {
        cwd: repoRoot,
        env: { ...process.env, TARS_RUNS_DIR: root, TARS_OWNER_VIA: "panel /rozhodnuti" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (out += d));
      p.on("close", (code) =>
        resolve({ code: code ?? 1, out: out.slice(-500) }),
      );
      p.on("error", (e) => resolve({ code: 1, out: String(e) }));
    });
}

const HTML = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

/** Returns true when the request was handled (so panel-server needs only `if (decisionRoute(...)) return;`). */
export function decisionRoute(root: string, opts: DecisionRouteOpts = {}) {
  const secret = opts.secret ?? SECRET;
  const runOwner = opts.runOwner ?? spawnOwnerCli(root);
  return (req: http.IncomingMessage, res: http.ServerResponse): boolean => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/rozhodnuti" && !url.pathname.startsWith("/rozhodnuti/")) return false;
    // Reads are protected too: the page carries the CSRF token and internal content (DNS rebinding).
    if (!isLoopback(req.socket.remoteAddress) || !hostOriginOk(req.headers.host, req.method === "POST" ? (req.headers.origin as string | undefined) : undefined)) {
      res.writeHead(403).end("forbidden");
      return true;
    }
    if (url.pathname === "/rozhodnuti" && req.method === "GET") {
      const items = fs.existsSync(root)
        ? fs
            .readdirSync(root)
            .filter((d) => ORDER_RE.test(d))
            .sort()
            .reverse()
            .map((d) => ({ pkg: loadPkg(root, d), order: loadOrder(root, d) }))
            .filter(
              (x): x is { pkg: DecisionPackage; order: Order | undefined } =>
                Boolean(x.pkg),
            )
        : [];
      res.writeHead(200, HTML).end(renderIndex(items));
      return true;
    }
    const id = /^\/rozhodnuti\/(wo-[0-9A-Za-z-]+)$/.exec(url.pathname)?.[1];
    if (!id) return false;
    const pkg = loadPkg(root, id);
    if (!pkg) {
      res.writeHead(404, HTML).end(renderIndex([]));
      return true;
    }
    if (req.method === "GET") {
      const notice = url.searchParams.get("ok")
        ? "Rozhodnutí zapsáno."
        : url.searchParams.get("err")
          ? `Zápis selhal: ${url.searchParams.get("err")}`
          : "";
      res
        .writeHead(200, HTML)
        .end(
          renderDecisionPage(
            pkg,
            loadOrder(root, id),
            csrfToken(`${id}:${rev(root, id)}`, secret),
            notice,
            rev(root, id),
          ),
        );
      return true;
    }
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return true;
    }
    if (
      !isLoopback(req.socket.remoteAddress) ||
      !hostOriginOk(req.headers.host, req.headers.origin as string | undefined)
    ) {
      res.writeHead(403).end("forbidden");
      return true;
    }
    let body = "";
    req.on("data", (d: Buffer) => {
      body += d;
      if (body.length > 2048) req.destroy();
    });
    req.on("end", () => {
      const form = new URLSearchParams(body);
      const choice = form.get("choice") as OwnerChoice | null;
      if (
        !/^[0-9a-f]{64}$/.test(form.get("rev") ?? "") ||
        !csrfOk(`${id}:${form.get("rev")}`, form.get("csrf") ?? "", secret) ||
        !choice ||
        !CHOICES.includes(choice) ||
        (choice === "ALT" && !pkg.alternative) ||
        (choice === "GO" && pkg.merge?.blocked)
      ) {
        res.writeHead(403).end("forbidden");
        return;
      }
      const order = loadOrder(root, id);
      if (order?.state !== "WAITING_OWNER") {
        res
          .writeHead(303, {
            Location: `/rozhodnuti/${id}?err=${encodeURIComponent("zakázka nečeká na vlastníka")}`,
          })
          .end();
        return;
      }
      // The CLI re-checks under the order lock that decision.json still has this revision.
      void runOwner(id, choice, form.get("rev")!).then((r) => {
        res
          .writeHead(303, {
            Location: `/rozhodnuti/${id}${r.code === 0 ? "?ok=1" : `?err=${encodeURIComponent(r.out.split("\n").filter(Boolean).at(-1) ?? "chyba")}`}`,
          })
          .end();
      });
    });
    return true;
  };
}
