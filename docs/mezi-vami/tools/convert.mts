/* eslint-disable */
// @ts-nocheck — dev nástroj spouštěný přes tsx, mimo typovou kontrolu buildu
// Převodník artboardů (docs/mezi-vami/design-A/*.dc.html) na TSX komponenty.
// Spuštění z kořene repa:  npx tsx docs/mezi-vami/tools/convert.mts
// Výstup: app/mezi-vami/_dc/*.tsx + app/mezi-vami/design-a.css (obojí generované, needitovat ručně).
//
// Co dělá: 1:1 převod DOM + inline stylů + textů (zdroj pravdy = artboardy), vyhodnocení
// šablon (sc-if, sc-for, {{ }}), pevné mezery přes nbsp(), tůně → CSS radial-gradient,
// křivky → <LightCurve>, animace per artboard (scope třídou) a Jost 300 → 400.

import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { nbsp } from "../../../app/mezi-vami/_lib/nbsp";

const SRC = "docs/mezi-vami/design-A";
const OUT = "app/mezi-vami/_dc";

type Job = { file: string; name: string; id: string };
const JOBS: Job[] = [
  { file: "Main", name: "LandingD", id: "main" },
  { file: "Mobil-01-Landing", name: "LandingM", id: "m01" },
  { file: "D-02-Start", name: "StartD", id: "d02" },
  { file: "Mobil-01b-Start", name: "StartM", id: "m01b" },
  { file: "D-04-Vypocet", name: "VypocetD", id: "d04" },
  { file: "Mobil-02b-Vypocet", name: "VypocetM", id: "m02b" },
  { file: "D-05-Vysledek", name: "VysledekD", id: "d05" },
  { file: "Mobil-03-Vypocet", name: "VysledekM1", id: "m03" },
  { file: "Mobil-04-DNA", name: "VysledekM2", id: "m04" },
  { file: "Mobil-05-Nabidka", name: "VysledekM3", id: "m05" },
  { file: "D-06-Pokladna", name: "ObjednavkaD", id: "d06" },
  { file: "Mobil-06-Pokladna", name: "ObjednavkaM", id: "m06" },
  { file: "D-07-Platba", name: "PlatbaD", id: "d07" },
  { file: "Mobil-07-Platba", name: "PlatbaM", id: "m07" },
  { file: "D-08-Objednavka", name: "DoruceniD", id: "d08" },
  { file: "Mobil-08-Objednavka", name: "DoruceniM", id: "m08" },
  { file: "D-09-Vzorek", name: "VzorekD", id: "d09" },
  { file: "Mobil-09-Vzorek", name: "VzorekM", id: "m09" },
  { file: "Stavy", name: "Stavy", id: "stv" },
];

const ROUTES: Record<string, string> = {
  Main: "/mezi-vami",
  "Mobil-01-Landing": "/mezi-vami",
  "D-02-Start": "/mezi-vami/start",
  "Mobil-01b-Start": "/mezi-vami/start",
  "D-03-Osoba": "/mezi-vami/osoba",
  "Mobil-02-Osoba": "/mezi-vami/osoba",
  "D-04-Vypocet": "/mezi-vami/vypocet",
  "Mobil-02b-Vypocet": "/mezi-vami/vypocet",
  "D-05-Vysledek": "/mezi-vami/vysledek",
  "Mobil-03-Vypocet": "/mezi-vami/vysledek",
  "Mobil-04-DNA": "/mezi-vami/vysledek#dna",
  "Mobil-05-Nabidka": "/mezi-vami/vysledek#nabidka",
  "D-06-Pokladna": "/mezi-vami/objednavka",
  "Mobil-06-Pokladna": "/mezi-vami/objednavka",
  "D-07-Platba": "/mezi-vami/platba",
  "Mobil-07-Platba": "/mezi-vami/platba",
  "D-08-Objednavka": "/mezi-vami/doruceni",
  "Mobil-08-Objednavka": "/mezi-vami/doruceni",
  "D-09-Vzorek": "/mezi-vami/vzorek",
  "Mobil-09-Vzorek": "/mezi-vami/vzorek",
  Stavy: "/mezi-vami/stavy",
};

/** Odkaz na jiný artboard → trasa. Odkaz uvnitř téže stránky (mobilní výsledek) → jen #kotva. */
function mapHref(from: string, href: string): string {
  const m = /^([\w-]+)\.dc\.html(#[\w-]*)?$/.exec(href);
  if (!m) return href;
  const target = ROUTES[m[1]];
  if (!target) return href;
  const [tPath, tHash] = target.split("#");
  const fromPath = ROUTES[from]?.split("#")[0];
  const hash = m[2] ?? (tHash ? `#${tHash}` : "");
  if (fromPath === tPath && hash) return hash;
  return tPath + hash;
}

const SCOPED = ["breathe", "travel", "float", "spin", "pulse", "glow"];

/* ---------- pomocné ---------- */

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

const HTML_ATTRS: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  maxlength: "maxLength",
  minlength: "minLength",
  inputmode: "inputMode",
  autocomplete: "autoComplete",
  autocapitalize: "autoCapitalize",
  spellcheck: "spellCheck",
  readonly: "readOnly",
  tabindex: "tabIndex",
  colspan: "colSpan",
  rowspan: "rowSpan",
  datetime: "dateTime",
  onclick: "onClick",
  onchange: "onChange",
  crossorigin: "crossOrigin",
  enterkeyhint: "enterKeyHint",
};

function splitDecls(input: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === ";" && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

function fixFontWeight(prop: string, value: string): string {
  // Jost 400/500, EB Garamond 400/500 (žádná 300)
  if (prop === "font-weight" && value.trim() === "300") return "400";
  return value;
}

let mobileJob = false;
let stavyJob = false;

function styleObject(style: string): string {
  const parts: string[] = [];
  for (const d of splitDecls(style)) {
    const i = d.indexOf(":");
    if (i < 0) continue;
    const prop = d.slice(0, i).trim();
    let value = fixFontWeight(prop, d.slice(i + 1).trim())
      .replaceAll("'Jost'", "var(--font-mv-jost)")
      .replaceAll("'EB Garamond'", "var(--font-mv-garamond)");
    // mobilní artboardy mají pevných 375 px; web má být responzivní i mezi 375 a 768
    if (mobileJob && prop === "width" && value === "375px") value = "100%";
    // galerie stavů: artboard 1772 px → web ji zalamuje podle šířky okna
    if (stavyJob && prop === "width" && value === "1772px") value = "100%";
    if (stavyJob && prop === "height" && value === "2240px") {
      parts.push(`minHeight: ${JSON.stringify("2240px")}`);
      continue;
    }
    if (stavyJob && prop === "padding" && value === "64px") value = "clamp(20px, 4.5vw, 64px)";
    if (stavyJob && prop === "grid-template-columns" && value === "repeat(4, minmax(0, 1fr))")
      value = "repeat(auto-fit, minmax(300px, 1fr))";
    let key: string;
    if (prop.startsWith("--")) key = JSON.stringify(prop);
    else if (prop.startsWith("-")) {
      const c = camel(prop.slice(1));
      key = c[0].toUpperCase() + c.slice(1);
    } else key = camel(prop);
    parts.push(`${key}: ${JSON.stringify(value)}`);
  }
  return `{ ${parts.join(", ")} }`;
}

const hasExpr = (s: string) => s.includes("{{");

/* ---------- konvertor jednoho artboardu ---------- */

function convert(job: Job) {
  const html = fs.readFileSync(path.join(SRC, `${job.file}.dc.html`), "utf8");
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const xdc = doc.querySelector("x-dc")!;
  const helmet = xdc.querySelector("helmet");
  const scriptEl = doc.querySelector('script[type="text/x-dc"]')!;
  const propsMeta = JSON.parse(scriptEl.getAttribute("data-props") ?? "{}");
  delete propsMeta.$preview;
  const logicSrc = scriptEl.textContent ?? "";

  mobileJob = /^m\d/.test(job.id);
  stavyJob = job.id === "stv";
  const cls = `x${job.id}`;
  const warnings: string[] = [];
  let usesLight = false;
  let usesPools = false;
  let usesA = false;

  /* --- CSS z <helmet>: jen pohyb; třídy a keyframes se scopují na artboard --- */
  const cssLines: string[] = [];
  const styleText = Array.from(helmet?.querySelectorAll("style") ?? [])
    .map((s) => s.textContent)
    .join("\n");
  for (const line of styleText.split("\n")) {
    if (!/\bmv/.test(line)) {
      // základní pravidla artboardu (barva odkazů, placeholder, focus, balance) scopovaná na kořen
      for (const m of line.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sel = m[1].trim();
        if (sel === "body" || sel.startsWith("@")) continue;
        cssLines.push(
          `${sel
            .split(",")
            .map((s) => `.${cls} ${s.trim()}`)
            .join(",")}{${m[2]}}`,
        );
      }
      continue;
    }
    let l = line;
    for (const k of SCOPED) {
      const K = k[0].toUpperCase() + k.slice(1);
      l = l.replaceAll(`.mv-${k}`, `.${cls}-${k}`).replaceAll(`mv${K}`, `${cls}${K}`);
    }
    cssLines.push(l.trim());
  }

  const className = (c: string) =>
    c
      .split(/\s+/)
      .map((t) => {
        const m = /^mv-(.+)$/.exec(t);
        return m && SCOPED.includes(m[1]) ? `${cls}-${m[1]}` : t;
      })
      .join(" ");

  /* --- filtry (pro tůně a záře) --- */
  const blurOf = new Map<string, number>();
  for (const f of Array.from(xdc.querySelectorAll("filter"))) {
    const g = f.querySelector("feGaussianBlur");
    if (g) blurOf.set(f.id, parseFloat(g.getAttribute("stdDeviation") ?? "0"));
  }
  const filterRef = (el: Element) => /url\(#([^)]+)\)/.exec(el.getAttribute("filter") ?? "")?.[1];

  /* --- výrazy --- */
  const expr = (raw: string, scope: Set<string>) => {
    const e = raw.replace(/^\{\{\s*|\s*\}\}$/g, "").trim();
    const root = e.split(".")[0];
    return scope.has(root) ? e : `v.${e}`;
  };
  const interpolate = (s: string, scope: Set<string>, wrap: (e: string) => string) => {
    const parts: string[] = [];
    let last = 0;
    for (const m of s.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
      if (m.index! > last) parts.push(JSON.stringify(s.slice(last, m.index)));
      parts.push(wrap(expr(m[0], scope)));
      last = m.index! + m[0].length;
    }
    if (last < s.length) parts.push(JSON.stringify(s.slice(last)));
    return parts;
  };

  /* --- atributy --- */
  const attrName = (el: Element, n: string): string => {
    if (HTML_ATTRS[n]) return HTML_ATTRS[n];
    if (n.startsWith("aria-") || n.startsWith("data-")) return n;
    if (n.includes("-")) return camel(n);
    return n;
  };

  const attrs = (el: Element, scope: Set<string>, skip: string[] = []): string => {
    const tag = el.tagName.toLowerCase();
    const out: string[] = [];
    for (const a of Array.from(el.attributes)) {
      const n = a.name;
      if (skip.includes(n) || n.startsWith("hint-")) continue;
      let name = attrName(el, n);
      let value = a.value;
      if (tag === "input" && n === "checked") name = "defaultChecked";
      if (tag === "input" && n === "value") name = "defaultValue";
      if (n === "style") {
        if (hasExpr(value)) {
          const parts = interpolate(value, scope, (e) => `\${${e}}`);
          const tpl = parts
            .map((p) => (p.startsWith('"') ? JSON.parse(p).replaceAll("`", "\\`") : p))
            .join("");
          usesCssFn = true;
          out.push(`style={css(\`${tpl}\`)}`);
        } else out.push(`style={${styleObject(value)}}`);
        continue;
      }
      if (n === "class") {
        out.push(`className=${JSON.stringify(className(value) + (el === rootEl ? ` ${cls}` : ""))}`);
        continue;
      }
      if (n === "href" && tag === "a") {
        if (!hasExpr(value)) value = mapHref(job.file, value);
      }
      if (/^\{\{\s*[^}]+\s*\}\}$/.test(value)) {
        out.push(`${name}={${expr(value, scope)}}`);
      } else if (hasExpr(value)) {
        out.push(`${name}={${interpolate(value, scope, (e) => e).join(" + ")}}`);
      } else if (value === "" && !["alt", "value", "placeholder", "d"].includes(n)) {
        out.push(name);
      } else {
        out.push(`${name}=${JSON.stringify(value)}`);
      }
    }
    // vodorovně scrollovatelná oblast musí jít ovládat klávesnicí (axe: scrollable-region-focusable)
    if (/overflow-x:\s*(auto|scroll)/.test(el.getAttribute("style") ?? "") && !el.hasAttribute("tabindex"))
      out.push("tabIndex={0}");
    if (el === rootEl && !el.hasAttribute("class")) out.push(`className=${JSON.stringify(cls)}`);
    return out.length ? " " + out.join(" ") : "";
  };

  let usesCssFn = false;
  let rootEl: Element | null = null;
  let usesPV = false;

  /** Ukázkové údaje osob v shrnutí výsledku (d05, m03) a v pokladně (d06, m06) → živé hodnoty. */
  function markPersonValues(rootNode: Element) {
    const mk = (name: string, attrs: Record<string, string>) => {
      const n = doc.createElement(name);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      return n;
    };
    if (job.id === "d05" || job.id === "m03") {
      let i = 0;
      for (const sp of Array.from(rootNode.querySelectorAll("span"))) {
        if (!/text-align:\s*right/.test(sp.getAttribute("style") ?? "")) continue;
        const first = sp.firstChild?.textContent?.trim() ?? "";
        if (!/^\d+\. \d+\. \d{4} · /.test(first)) continue;
        const inner = sp.querySelector("span");
        const pv = mk("pv-summary", {
          p: i++ === 0 ? "a" : "b",
          fb1: first,
          fb2: inner?.textContent?.trim() ?? "",
          sub: inner?.getAttribute("style") ?? "",
        });
        sp.replaceChildren(pv);
      }
    }
    if (job.id === "d06" || job.id === "m06") {
      const map: Record<string, string> = { "Datum narození": "datum", "Místo narození": "misto", "Čas narození": "cas" };
      Array.from(rootNode.querySelectorAll("dl")).forEach((dl, idx) => {
        for (const dt of Array.from(dl.querySelectorAll("dt"))) {
          const f = map[dt.textContent?.trim() ?? ""];
          const dd = dt.nextElementSibling;
          if (!f || !dd || dd.tagName.toLowerCase() !== "dd") continue;
          dd.replaceChildren(mk("pv-field", { p: idx === 0 ? "a" : "b", f, fb: dd.textContent?.trim() ?? "" }));
        }
      });
      for (const g of Array.from(rootNode.querySelectorAll('div[role="radiogroup"]'))) {
        const labels = Array.from(g.querySelectorAll("label"));
        const name = labels[0]?.querySelector("input")?.getAttribute("name") ?? "";
        const m = /-(a|b)$/.exec(name);
        if (!m || labels.length !== 3) continue;
        g.replaceChildren(
          mk("pv-style", {
            p: m[1],
            name,
            on: labels[0].getAttribute("style") ?? "",
            off: labels[1].getAttribute("style") ?? "",
          }),
        );
      }
    }
  }

  /* --- tůně a křivky z <svg> --- */
  const hexToRgb = (hex: string) => {
    const h = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
  };

  const svgBoxStyle = (svg: Element) => {
    const st = svg.getAttribute("style") ?? "";
    return styleObject(st);
  };

  function emitSvg(svg: Element, scope: Set<string>): string {
    const vb = svg.getAttribute("viewBox") ?? "0 0 100 100";
    const par = svg.getAttribute("preserveAspectRatio") ?? undefined;
    const [, , W, H] = vb.split(/\s+/).map(Number);
    const kids = Array.from(svg.children);
    const ellipses = kids.filter((k) => k.tagName.toLowerCase() === "ellipse" && filterRef(k));
    const rest = kids.filter((k) => !ellipses.includes(k));
    const pre: string[] = [];

    if (ellipses.length) {
      usesPools = true;
      const specs = ellipses.map((e) => {
        const cx = +e.getAttribute("cx")!;
        const cy = +e.getAttribute("cy")!;
        const rx = +e.getAttribute("rx")!;
        const ry = +e.getAttribute("ry")!;
        const sigma = blurOf.get(filterRef(e)!) ?? 0;
        const Rx = rx + 1.5 * sigma;
        const Ry = ry + 1.5 * sigma;
        return {
          left: +(((cx - Rx) / W) * 100).toFixed(3),
          top: +(((cy - Ry) / H) * 100).toFixed(3),
          width: +(((2 * Rx) / W) * 100).toFixed(3),
          height: +(((2 * Ry) / H) * 100).toFixed(3),
          rgb: hexToRgb(e.getAttribute("fill") ?? "#3A1838"),
          alpha: +(e.getAttribute("opacity") ?? "1"),
        };
      });
      pre.push(`<Pools style={${svgBoxStyle(svg)}} pools={${JSON.stringify(specs)}} />`);
    }

    const nonDefs = rest.filter((k) => !["defs", "filter"].includes(k.tagName.toLowerCase()));
    const paths = nonDefs.filter((k) => k.tagName.toLowerCase() === "path");
    const pureCurves =
      nonDefs.length > 0 &&
      paths.length === nonDefs.length &&
      paths.some((p) => /url\(#/.test(p.getAttribute("stroke") ?? "") || p.hasAttribute("stroke-dasharray"));

    if (nonDefs.length === 0) return pre.join("\n");

    if (pureCurves) {
      usesLight = true;
      const defsKids = rest
        .filter((k) => k.tagName.toLowerCase() === "defs")
        .flatMap((d) => Array.from(d.children))
        .filter((k) => k.tagName.toLowerCase() !== "filter");
      const defs = defsKids.map((k) => emitNode(k, scope)).join("");
      const layers: string[] = [];
      let crisp: string[] = [];
      const flush = () => {
        if (crisp.length) {
          layers.push(
            `<LightLayer viewBox="${vb}"${par ? ` preserveAspectRatio="${par}"` : ""}>${crisp.join("")}</LightLayer>`,
          );
          crisp = [];
        }
      };
      for (const p of paths) {
        const fid = filterRef(p);
        const jsx = emitNode(p, scope, ["filter"]).replace(/^<path/, "<path vectorEffect=\"non-scaling-stroke\"");
        if (fid) {
          flush();
          layers.push(
            `<LightLayer viewBox="${vb}"${par ? ` preserveAspectRatio="${par}"` : ""} blur={${blurOf.get(fid) ?? 0}}>${jsx}</LightLayer>`,
          );
        } else crisp.push(jsx);
      }
      flush();
      return `${pre.join("\n")}<LightCurve style={${svgBoxStyle(svg)}} defs={<>${defs}</>}>${layers.join("")}</LightCurve>`;
    }

    // obecné SVG (ikony, prstence, mockup): zachovat, jen bez tůní
    const inner = rest.map((k) => emitNode(k, scope)).join("");
    const a = attrs(svg, scope);
    return `${pre.join("\n")}<svg${a}>${inner}</svg>`;
  }

  /* --- obecný uzel --- */
  function emitText(text: string, scope: Set<string>): string {
    if (hasExpr(text)) {
      const collapsed = text.replace(/\s+/g, " ");
      const parts = interpolate(collapsed, scope, (e) => `nb(${e})`);
      return parts
        .map((p) => (p.startsWith('"') ? `{${JSON.stringify(nbsp(JSON.parse(p)))}}` : `{${p}}`))
        .join("");
    }
    const collapsed = text.replace(/\s+/g, " ");
    if (!collapsed.trim()) return text.includes("\n") ? "" : collapsed ? '{" "}' : "";
    const final = nbsp(collapsed);
    if (!/[{}<>&]/.test(final)) return final;
    return `{${JSON.stringify(final)}}`;
  }

  function emitNode(node: Node, scope: Set<string>, skipAttrs: string[] = []): string {
    if (node.nodeType === 3) return emitText(node.textContent ?? "", scope);
    if (node.nodeType !== 1) return "";
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    // zadané údaje osob (viz _parts/PersonValues.tsx): značky vložené markPersonValues()
    if (tag === "pv-summary") {
      usesPV = true;
      return `<PersonSummary p=${JSON.stringify(el.getAttribute("p"))} fb1=${JSON.stringify(el.getAttribute("fb1"))} fb2=${JSON.stringify(el.getAttribute("fb2"))} sub={${styleObject(el.getAttribute("sub") ?? "")}} />`;
    }
    if (tag === "pv-field") {
      usesPV = true;
      return `<PersonField p=${JSON.stringify(el.getAttribute("p"))} f=${JSON.stringify(el.getAttribute("f"))} fb=${JSON.stringify(el.getAttribute("fb"))} />`;
    }
    if (tag === "pv-style") {
      usesPV = true;
      return `<StyleChoice p=${JSON.stringify(el.getAttribute("p"))} name=${JSON.stringify(el.getAttribute("name"))} on={${styleObject(el.getAttribute("on") ?? "")}} off={${styleObject(el.getAttribute("off") ?? "")}} />`;
    }

    if (tag === "sc-if") {
      const cond = expr(el.getAttribute("value") ?? "false", scope);
      return `{${cond} && (<>${children(el, scope)}</>)}`;
    }
    if (tag === "sc-for") {
      const list = expr(el.getAttribute("list") ?? "[]", scope);
      const as = el.getAttribute("as") ?? "item";
      const inner = new Set(scope).add(as);
      return `{(${list} as any[]).map((${as}, i_${as}) => (<Fragment key={i_${as}}>${children(el, inner)}</Fragment>))}`;
    }
    if (tag === "svg" && el.parentElement?.closest("svg") == null) {
      return emitSvg(el, scope);
    }

    // role="status" na <h1> je neplatná ARIA role pro nadpis → živá oblast obalí nadpis
    if (/^h[1-6]$/.test(tag) && el.getAttribute("role") === "status" && !skipAttrs.includes("role")) {
      return `<div role="status">${emitNode(el, scope, [...skipAttrs, "role"])}</div>`;
    }

    const VOID = ["input", "br", "img", "hr", "meta", "link", "wbr"];
    let tagOut = el.namespaceURI?.includes("svg") ? el.tagName : tag;
    // mobilní výsledek = 3 artboardy v jedné stránce; <main> dodá stránka, ne první artboard
    if (tag === "main" && ["m03", "m09", "d09"].includes(job.id)) tagOut = "div";
    if (tag === "a") {
      usesA = true;
      tagOut = "A";
    }
    const a = attrs(el, scope, skipAttrs);
    if (VOID.includes(tag) || (el.childNodes.length === 0 && (el.namespaceURI?.includes("svg") || tag === "span" || tag === "div" || tag === "path" || tag === "circle"))) {
      return `<${tagOut}${a} />`;
    }
    return `<${tagOut}${a}>${children(el, scope)}</${tagOut}>`;
  }

  function children(el: Element, scope: Set<string>): string {
    return Array.from(el.childNodes)
      .map((n) => emitNode(n, scope))
      .join("");
  }

  // kořen artboardu = první element za <helmet>
  const root = Array.from(xdc.children).find((c) => c.tagName.toLowerCase() !== "helmet")!;
  rootEl = root;
  markPersonValues(root);
  const jsx = emitNode(root, new Set());

  /* --- logika --- */
  const stateful = /setState/.test(logicSrc);
  let logic = logicSrc.replace("class Component extends DCLogic", "class Logic extends DCLogic");
  logic = logic.replace(/'([\w-]+\.dc\.html)(#[\w-]*)?'/g, (_m, f: string, h?: string) => `'${mapHref(job.file, f + (h ?? ""))}'`);
  logic = logic.replace(/'([\w-]+)\.dc\.html'/g, (m) => m);

  const imports = [
    "/* eslint-disable */\n// @ts-nocheck\n",
    `// GENERATED by docs/mezi-vami/tools/convert.mts from ${SRC}/${job.file}.dc.html — needitovat ručně.\n`,
    stateful ? `'use client'\n` : "",
    `import { Fragment } from 'react'\n`,
    `import { DCLogic, ${stateful ? "" : "evalDc, "}css${usesCssFn ? "" : ""}, type PropsMeta } from '../_lib/dc'\n`,
    stateful ? `import { useDc } from '../_lib/dc-client'\n` : "",
    `import { nb } from '../_lib/nbsp'\n`,
    usesA ? `import { A } from '../_lib/A'\n` : "",
    usesPV ? `import { PersonSummary, PersonField, StyleChoice } from '../_parts/PersonValues'\n` : "",
    usesLight || usesPools ? `import { ${[usesLight ? "LightCurve, LightLayer" : "", usesPools ? "Pools" : ""].filter(Boolean).join(", ")} } from '../_lib/LightCurve'\n` : "",
  ].join("");

  const tsx = `${imports}
export const propsMeta: PropsMeta = ${JSON.stringify(propsMeta)}

${logic.trim()}

export default function ${job.name}({ props = {} }: { props?: Record<string, unknown> }) {
  const v = ${stateful ? "useDc(Logic, props)" : "evalDc(Logic, props)"}
  return (
    ${jsx}
  )
}
`;
  fs.writeFileSync(path.join(OUT, `${job.name}.tsx`), tsx);
  return { cssLines, warnings };
}

/* ---------- main ---------- */
fs.mkdirSync(OUT, { recursive: true });
const allCss = new Set<string>();
const perFile: string[] = [];
for (const job of JOBS) {
  const { cssLines, warnings } = convert(job);
  const own = cssLines.filter((l) => l.includes(`x${job.id}`));
  const shared = cssLines.filter((l) => !l.includes(`x${job.id}`));
  perFile.push(`/* ${job.file} */`, ...own);
  shared.forEach((l) => allCss.add(l));
  if (warnings.length) console.warn(job.file, warnings);
  console.log("OK", job.file, "→", `${job.name}.tsx`);
}
fs.writeFileSync(
  "app/mezi-vami/design-a.css",
  [
    "/* GENERATED by docs/mezi-vami/tools/convert.mts — pohyb z artboardů, scoped per artboard. */",
    ...allCss,
    ...perFile,
    "",
  ].join("\n"),
);
