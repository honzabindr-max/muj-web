// Shared fixture of the etapa 3 tests (effect journal) and of their SIGKILL child process. No network, no model.
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { CopyDepartment, type DepartmentRunner } from "../departments";
import type { NotionClient } from "../notion";
import { pageIdFromUrl, titleCarriesMarker } from "../notion";
import { Orchestrator } from "../orchestrator";
import type { PanelIndex, PanelSink } from "../panel";
import type { Store } from "../store";
import type { Order } from "../types";

export const NOW = "2026-11-04T12:00:00.000Z";
export const PARENT = "draftparent";
export const ORDER_ID = "wo-eff";
export const DRAFT = `# Draft\n\n${"Tichý, sebejistý text. ".repeat(30)}`;

export interface StoredPage {
  id: string;
  parent: string;
  title: string;
  md: string;
}

/**
 * „Notion“ kept in a JSONL file, so a killed child and the recovering parent see the same pages (the external system
 * survives the crash). `kill` SIGKILLs the process inside createPage, before or after the page is stored.
 */
export class FileNotion implements NotionClient {
  creates = 0;
  constructor(
    public file: string,
    public opts: {
      kill?: { when: "before" | "after"; titlePrefix: string };
      findFails?: boolean;
      failCreate?: () => Error | undefined;
    } = {},
  ) {}

  pages(): StoredPage[] {
    if (!fs.existsSync(this.file)) return [];
    return fs
      .readFileSync(this.file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as StoredPage);
  }

  add(parent: string, title: string, md = "x"): StoredPage {
    const p = { id: randomUUID().replace(/-/g, ""), parent, title, md };
    fs.appendFileSync(this.file, JSON.stringify(p) + "\n");
    return p;
  }

  async createPage(parent: string, title: string, md: string) {
    this.creates++;
    const kill =
      this.opts.kill && title.startsWith(this.opts.kill.titlePrefix)
        ? this.opts.kill.when
        : undefined;
    if (kill === "before") process.kill(process.pid, "SIGKILL");
    const err = this.opts.failCreate?.();
    if (err) throw err;
    const p = this.add(parent, title, md);
    if (kill === "after") process.kill(process.pid, "SIGKILL");
    return { url: `https://www.notion.so/${p.id}` };
  }

  async readPage(url: string) {
    const id = pageIdFromUrl(url);
    const p = this.pages().find((x) => x.id === id);
    if (!p) throw new Error("page not found");
    return p.md;
  }

  async findChildPagesByMarker(parent: string, marker: string) {
    if (this.opts.findFails) throw new Error("notion REST 0 network");
    return this.pages()
      .filter((p) => p.parent === parent && titleCarriesMarker(p.title, marker))
      .map((p) => ({ url: `https://www.notion.so/${p.id}` }));
  }
}

export function effOrder(
  state: Order["state"] = "DELIVERED",
  ownerDecisions: string[] = [],
): Order {
  return {
    id: ORDER_ID,
    mission: "m",
    state,
    created_at: NOW,
    updated_at: NOW,
    fix_rounds: 0,
    manual_interventions: 0,
    history: [],
    meta: {},
    draft_file: "draft-v0.md",
    brief: {
      title: "Mikrocopy formuláře",
      department: "copy",
      milestone: "3.1",
      why: "w",
      goal: "Navrhnout texty chybových stavů",
      inputs: [],
      acceptance: [],
      owner_decisions: ownerDecisions,
      sources: [],
    },
  };
}

/** A fresh order in DELIVERED with its draft on disk. */
export function seedDelivered(
  store: Store,
  ownerDecisions: string[] = [],
): Order {
  store.writeFile(ORDER_ID, "draft-v0.md", DRAFT);
  const o = effOrder("DELIVERED", ownerDecisions);
  store.save(o);
  return store.load(ORDER_ID);
}

export function makeOrch(
  store: Store,
  notion: NotionClient,
  opts: {
    panel?: { sink: PanelSink; index: PanelIndex };
    ownerPing?: unknown;
    department?: DepartmentRunner;
  } = {},
): Orchestrator {
  const noop = async () => ({
    ok: true,
    text: "",
    limit: false,
    duration_ms: 0,
  });
  const adapter = (family: "claude" | "gpt") => ({
    name: "fixture",
    model: `fixture-${family}`,
    family,
    run: noop,
  });
  const copy =
    opts.department ?? new CopyDepartment(adapter("gpt"), adapter("claude"));
  return new Orchestrator({
    store,
    supervisor: adapter("claude"),
    briefChecker: adapter("gpt"),
    departments: { copy },
    cards: {
      check: () => ({ ok: true, problems: [] }),
      text: () => "",
    } as never,
    ladder: {} as never,
    notion,
    guard: () => ({ alarm: false, summary: "ok" }),
    draftParentId: PARENT,
    repoRoot: store.runsDir,
    capsulePath: path.join(store.runsDir, "none"),
    now: () => new Date(NOW),
    panel: opts.panel,
    ownerPing: opts.ownerPing as never,
  });
}
