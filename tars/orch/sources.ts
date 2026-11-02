// Canonical sources of the mission (karta §2a bod 2). Cards list source keys in frontmatter
// (`sources: a, b`). The orchestrator loads them raw (no model paraphrase) and hands them to
// supervisor, checker and creator. A source that cannot be loaded = UNKNOWN with a reason —
// never "the creator does not have it".
import fs from "node:fs";
import path from "node:path";

import type { NotionClient } from "./notion";

export interface SourceDef {
  title: string;
  /** Notion page id, or repo-relative file path. */
  notion?: string;
  file?: string;
  /** Sections that matter for the department (informative, shown in prompts). */
  focus: string;
}

export const SOURCE_REGISTRY: Record<string, SourceDef> = {
  handoff: {
    title: "HANDOFF — MEZI VÁMI",
    notion: "3d40ae49f507817db496c4e823996bc4",
    focus:
      "ACTIVE TRACK, DALŠÍ KROK, otevřená rozhodnutí Sponzora, Co se NESMÍ dělat znovu",
  },
  capsule: {
    title: "Kufřík mise MEZI VÁMI",
    file: "missions/mezi-vami/capsule.md",
    focus: "index stavu (při rozporu vyhrává HANDOFF)",
  },
  buildos: {
    title: "MEZI VÁMI — Build Operating System V1 (LOCKED)",
    notion: "3d10ae49f50781e78cbadb30aaac2346",
    focus:
      "§4 role, §8 P1.2–P1.6, §17–§19, LOCKED AMENDMENTS A1–A6 (A2 Copy amendment)",
  },
  funnel: {
    title: "MEZI VÁMI — Funnel V1 / Architecture & Screen Inventory",
    notion: "3d00ae49f50781d58306ec854f9d809d",
    focus:
      "zamčená architektura obrazovek; FÁZE C = sémantická/terminologická baseline copy",
  },
  ui_build_brief: {
    title: "UI_BUILD_BRIEF_V1 (P1 READINESS PACKET V1, 5)",
    notion: "3d10ae49f507817dbd65e733a98c96e8",
    focus: "inventář obrazovek a stavů, copy constraints",
  },
  ui_data_contract: {
    title: "ui_data_contract_v1 (P1 READINESS PACKET V1, 6)",
    notion: "3d10ae49f507810680e3fcd4858fe1a6",
    focus: "datový kontrakt UI (A2)",
  },
  copy_handoff: {
    title:
      "GPT_COPY_STUDIO_HANDOFF_V1 (P1 READINESS PACKET V1, 9 — PREPARED, NOT EXECUTED)",
    notion: "3d10ae49f50781fda23cc78198d0346a",
    focus: "připravené zadání Copy Studia (operační vrstva, ne kanonická)",
  },
  design_handoff: {
    title:
      "CLAUDE_DESIGN_HANDOFF_V1 (P1 READINESS PACKET V1, 10 — PREPARED, NOT EXECUTED)",
    notion: "3d10ae49f50781d9a445d5b720b176a5",
    focus: "připravené zadání Claude Design (operační vrstva, ne kanonická)",
  },
};

export interface LoadedSource {
  key: string;
  title: string;
  ok: boolean;
  text?: string;
  /** UNKNOWN reason when ok = false. */
  reason?: string;
}

export function parseSourceKeys(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export class SourceLoader {
  constructor(
    private notion: NotionClient,
    private repoRoot: string,
    private cacheDir: string,
    private ttlMs = 6 * 60 * 60 * 1000,
  ) {}

  async load(key: string): Promise<LoadedSource> {
    const def = SOURCE_REGISTRY[key];
    if (!def)
      return { key, title: key, ok: false, reason: "zdroj není v registru" };
    try {
      if (def.file) {
        const p = path.join(this.repoRoot, def.file);
        if (!fs.existsSync(p))
          return {
            key,
            title: def.title,
            ok: false,
            reason: `soubor ${def.file} neexistuje`,
          };
        return {
          key,
          title: def.title,
          ok: true,
          text: fs.readFileSync(p, "utf8"),
        };
      }
      fs.mkdirSync(this.cacheDir, { recursive: true });
      const cached = path.join(this.cacheDir, `${key}.md`);
      if (
        fs.existsSync(cached) &&
        Date.now() - fs.statSync(cached).mtimeMs < this.ttlMs
      )
        return {
          key,
          title: def.title,
          ok: true,
          text: fs.readFileSync(cached, "utf8"),
        };
      if (!this.notion.fetchPage)
        return {
          key,
          title: def.title,
          ok: false,
          reason: "Notion transport neumí čtení stránek",
        };
      const text = await this.notion.fetchPage(def.notion!);
      fs.writeFileSync(cached, text);
      return { key, title: def.title, ok: true, text };
    } catch (e) {
      return {
        key,
        title: def.title,
        ok: false,
        reason: `načtení selhalo: ${(e as Error).message.slice(0, 200)}`,
      };
    }
  }

  async loadAll(keys: string[]): Promise<LoadedSource[]> {
    const out: LoadedSource[] = [];
    for (const k of [...new Set(keys)]) out.push(await this.load(k));
    return out;
  }
}

/** Prompt block with sources as quoted data; failed ones are explicit UNKNOWN with reason. */
export function sourcesBlock(
  sources: LoadedSource[],
  exclude: string[] = [],
): string {
  return sources
    .filter((s) => !exclude.includes(s.key))
    .map((s) =>
      s.ok
        ? `<<<ZDROJ ${s.key} — ${s.title} (zaměření: ${SOURCE_REGISTRY[s.key]?.focus ?? "—"})\n${s.text}\nZDROJ ${s.key}>>>`
        : `ZDROJ ${s.key} — ${s.title}: UNKNOWN (${s.reason})`,
    )
    .join("\n\n");
}

/** Deterministic part of the brief check: every required source of the card must be referenced. */
export function missingSources(
  required: string[],
  referenced: string[],
): string[] {
  return required.filter((k) => !referenced.includes(k));
}
