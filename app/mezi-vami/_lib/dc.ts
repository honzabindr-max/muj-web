// Malý runtime pro komponenty převedené z artboardů (Design component formát).
// Server-safe: žádné hooky. Hooky jsou v dc-client.ts.

import type { CSSProperties } from "react";

export type DcValues = Record<string, unknown>;
type SetState = (update: Record<string, unknown>) => void;

/** Základ pro logiku artboardu: this.props, this.state, this.setState + renderVals(). */
export class DCLogic {
  props: Record<string, unknown> = {};
  state: Record<string, unknown> = {};
  setState: SetState = () => {};
  renderVals(): DcValues {
    return {};
  }
}

export type DcLogicClass = new () => DCLogic;

/** Vyhodnocení logiky bez stavu (server). */
export function evalDc(
  Logic: DcLogicClass,
  props: Record<string, unknown> = {},
): DcValues {
  const inst = new Logic();
  inst.props = props;
  return inst.renderVals();
}

/** Řetězec CSS deklarací → objekt pro React style (pro hodnoty z renderVals). */
export function css(input: string): CSSProperties {
  const out: Record<string, string> = {};
  let depth = 0;
  let cur = "";
  const decls: string[] = [];
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === ";" && depth === 0) {
      decls.push(cur);
      cur = "";
    } else cur += ch;
  }
  decls.push(cur);
  for (const d of decls) {
    const i = d.indexOf(":");
    if (i < 0) continue;
    const rawKey = d.slice(0, i).trim();
    const value = d.slice(i + 1).trim();
    if (!rawKey || !value) continue;
    const key = rawKey.startsWith("--")
      ? rawKey
      : rawKey
          .replace(/^-/, "Webkit")
          .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[key] = value;
  }
  return out as CSSProperties;
}

/* ---------- parametry z query (?stav=…, ?vzorek=…) ---------- */

export type PropMeta =
  | { editor: "enum"; options: string[]; default?: string }
  | { editor: "boolean"; default?: boolean };
export type PropsMeta = Record<string, PropMeta>;

const strip = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Slug volby: „S1 — provizorní ukázka“ → s1, „Čeká na potvrzení“ → ceka-na-potvrzeni. */
export function optionSlug(option: string): string {
  const code = /^(S\d)\b/.exec(option);
  if (code) return code[1].toLowerCase();
  return strip(option)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type SearchParams = Record<string, string | string[] | undefined>;

/** Převede query parametry na props artboardu. Výchozí = první hodnota výčtu. */
export function resolveProps(
  meta: PropsMeta,
  search: SearchParams = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, m] of Object.entries(meta)) {
    const raw = search[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (m.editor === "enum") {
      const slug = value
        ? strip(value)
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
        : "";
      const hit = value
        ? m.options.find((o) => o === value || optionSlug(o) === slug)
        : undefined;
      out[name] = hit ?? m.options[0];
    } else if (value === undefined) {
      out[name] = m.default ?? false;
    } else {
      out[name] = !["0", "false", "ne", "off"].includes(value.toLowerCase());
    }
  }
  return out;
}
