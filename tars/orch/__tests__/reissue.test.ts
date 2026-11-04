// Znovuvydání karty pro zakázky bez otisku (`cli.ts reissue`): každé kolo karty má vlastní řádek panelu, rozhodnutí
// se čte jen z řádku aktuálního kola (PR #99, kolo oprav 4). Žádný model se nevolá.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdapterResult, TextAdapter } from "../adapters";
import { artifactHash } from "../approval";
import { CardRegistry } from "../cards";
import {
  CopyDepartment,
  VizualDepartment,
  type BrowserRunner,
} from "../departments";
import { NotImplementedDesktop } from "../desktop";
import { asData } from "../mcp-browser";
import type { NotionClient } from "../notion";
import { NotionRestApi, NotionRestError } from "../notion";
import {
  Orchestrator,
  SecretScanningAdapter,
  type OrchestratorDeps,
} from "../orchestrator";
import { EffectJournal, operationId } from "../effects";
import {
  HybridPanelSink,
  OWNER_DECISION_PROPERTY,
  PanelIndex,
  PanelRowDuplicate,
  PanelRowUnclear,
  RestPanelSink,
  rowToRestProperties,
  SUPERSEDED_STATE,
  supersededRow,
  type FindRowOptions,
  type OwnerRow,
  type PanelRow,
  type PanelSink,
} from "../panel";
import { SourceLoader } from "../sources";
import { transition, TransitionError } from "../state-machine";
import { PanelLockHoldError, processStartTime, Store } from "../store";
import type { ModelFamily, Order } from "../types";

const CARDS_DIR = path.join(__dirname, "..", "..", "..", ".claude", "agents");
const DRAFT = `# Draft\n\n${"Tichý, sebejistý text. ".repeat(30)}\n\n## Kontrola kritérií\n- ok`;
const PASS = '```json\n{"verdict":"PASS","issues":[]}\n```';
const BRIEF =
  "```json\n" +
  JSON.stringify({
    title: "Návrh mikrocopy formuláře",
    department: "copy",
    milestone: "3.1",
    why: "DALŠÍ KROK: paralelně běží 3.1",
    goal: "Navrhnout texty chybových stavů",
    inputs: ["fakt A"],
    acceptance: ["kritérium 1"],
    owner_decisions: ["cena"],
    sources: [
      "handoff",
      "capsule",
      "buildos",
      "funnel",
      "ui_build_brief",
      "copy_handoff",
    ],
  }) +
  "\n```";

class Mock implements TextAdapter {
  name = "mock";
  constructor(
    public family: ModelFamily,
    public model: string,
    private text: string,
  ) {}
  async run(): Promise<AdapterResult> {
    return { ok: true, text: this.text, limit: false, duration_ms: 1 };
  }
}

class Browser implements BrowserRunner {
  async run() {
    return {
      reads: [asData("x")],
      screenshots: [],
      finalUrl: "https://claude.ai/design/p/mock",
    };
  }
}

class Notion implements NotionClient {
  pages: Array<{ title: string; md: string }> = [];
  readFails = false;
  async createPage(_p: string, title: string, md: string) {
    this.pages.push({ title, md });
    return { url: `https://app.notion.com/p/mock${this.pages.length}` };
  }
  async readPage(url: string) {
    if (this.readFails) throw new NotionRestError(503, "service_unavailable");
    const p = this.pages[Number(/mock(\d+)$/.exec(url)?.[1]) - 1];
    if (!p) throw new NotionRestError(404, "object_not_found");
    return p.md;
  }
}

interface Page {
  row: PanelRow;
  /** „Rozhodnutí vlastníka“: nastavuje jen test (vlastník). */
  decision?: string;
  readable: boolean;
  /** Odkaz karty, který řádek ukazuje, když ho test přepíše (jinak z posledního zápisu). */
  cardOverride?: string | null;
}

/** Panel s více řádky (page id → řádek). Rozhodnutí do řádku zapisuje jen test, nikdy orchestrátor. */
class Panel implements PanelSink {
  pages = new Map<string, Page>();
  writes: Array<{ page: string; row: PanelRow }> = [];
  creates = 0;
  failUpsert: Error | undefined;
  /** Vytvoření řádku proběhne, ale odpověď se ztratí (nejasný výsledek). */
  createLandsThenFails = false;
  /** Jednorázové zdržení dalšího zápisu (souběžný `cli.ts panel-sync`); `holding` = zápis čeká. */
  hold: Promise<void> | undefined;
  holding = false;
  async upsert(row: PanelRow, page?: string) {
    if (this.hold) {
      const h = this.hold;
      this.hold = undefined;
      this.holding = true;
      await h;
      this.holding = false;
    }
    if (this.failUpsert) throw this.failUpsert;
    const id = page ?? `page${++this.creates}`;
    this.land(id, row);
    if (!page && this.createLandsThenFails) {
      this.createLandsThenFails = false;
      throw new Error("notion: spojení přerušeno po odeslání");
    }
    return id;
  }
  /** Zápis dorazil do Notionu (i opožděně). */
  land(id: string, row: PanelRow) {
    const p = this.pages.get(id);
    if (p) p.row = row;
    else this.pages.set(id, { row, readable: true });
    this.writes.push({ page: id, row });
  }
  async readOwnerDecision(id: string) {
    return this.pages.get(id)?.decision;
  }
  async readOwnerRow(id: string): Promise<OwnerRow> {
    const p = this.pages.get(id);
    if (!p) throw new NotionRestError(404, "object_not_found");
    return {
      decision: p.readable ? p.decision : undefined,
      readable: p.readable,
      card:
        p.cardOverride !== undefined
          ? p.cardOverride
          : (p.row["Karta rozhodnutí"] ?? null),
    };
  }
  /** Opravný PR „panel“: REST nedostupný a index MCP hledání zpožděný → dohledání nic neprokáže (`PanelRowUnclear`). */
  lookupBlind = false;
  async findRowByOrderId(orderId: string, opts: FindRowOptions = {}) {
    if (this.lookupBlind)
      throw new PanelRowUnclear("REST nedostupný, MCP hledání nic nenašlo");
    const hits: string[] = [];
    for (const [id, p] of this.pages) {
      if (p.row["ID zakázky"] !== orderId || opts.exclude?.includes(id))
        continue;
      if (opts.card !== undefined && p.row["Karta rozhodnutí"] !== opts.card)
        continue;
      if (!opts.unique) return id;
      hits.push(id);
    }
    if (hits.length > 1) throw new PanelRowDuplicate(hits);
    return hits[0];
  }
  page(id: string): Page {
    return this.pages.get(id)!;
  }
}

let dir: string;
let store: Store;
let clock: string;
/** Merge s etapou 3: řádek kola karty `round` je efekt `<id>/panel-row/r<round>` v journalu etapy 3. */
const rowOp = (id: string, round = 1) => operationId(id, "panel-row", round);
const rowEffect = (id: string, round = 1) =>
  new EffectJournal(dir).get(rowOp(id, round));
const rowReceipt = (page: string) => ({
  url: `https://www.notion.so/${page}`,
});
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-reissue-"));
  store = new Store(dir);
  clock = "2026-11-03T22:39:02.000Z";
});

function build(
  panel: PanelSink = new Panel(),
  st: Store = store,
  extra: Partial<OrchestratorDeps> = {},
) {
  const notion = new Notion();
  const o = new Orchestrator({
    store: st,
    supervisor: new Mock("claude", "opus", BRIEF),
    briefChecker: new Mock("gpt", "gpt-brief", PASS),
    departments: {
      // P16 v2 (#98): copy = Claude tvoří, GPT (v prohlížeči) kontroluje.
      copy: new CopyDepartment(
        new SecretScanningAdapter(new Mock("claude", "opus", DRAFT)),
        new Mock("gpt", "gpt-web", PASS),
      ),
      vizual: new VizualDepartment(
        new Browser(),
        new Mock("gpt", "gpt-gate", PASS),
      ),
    },
    cards: new CardRegistry(CARDS_DIR),
    ladder: {
      hasCli: () => true,
      browserReady: () => ({ ok: false, reasons: ["ne"] }),
      desktopReady: () => new NotImplementedDesktop().preflight(),
    },
    notion,
    guard: () => ({ alarm: false, summary: "TARS-GUARD OK" }),
    draftParentId: "parent",
    repoRoot: dir,
    capsulePath: path.join(dir, "capsule.md"),
    now: () => new Date(clock),
    // etapa 3: index pod stavovým zámkem téhož Store (re-entrantní jen v jedné instanci, stejně jako v cli.ts)
    panel: { sink: panel, index: new PanelIndex(dir, st) },
    sources: new SourceLoader(notion, dir, path.join(dir, "sources-cache")),
    ...extra,
  });
  return { o, notion };
}

/** Zakázka jako wo-20261103-223902: WAITING_OWNER s kartou ve staré verzi (bez approved_hash/artifact_hash), řádek page1. */
async function oldCardOrder(panel = new Panel()) {
  const x = build(panel);
  const r = (await x.o.tick()) as { order: string; status: string };
  expect(r.status).toBe("waiting_owner");
  const cur = store.load(r.order);
  const meta = { ...cur.meta };
  delete meta.approved_hash;
  delete meta.artifact_hash;
  store.save({ ...cur, meta: { ...meta, owner_ping: "1" } });
  expect(new PanelIndex(dir).get(r.order)).toBe("page1");
  return { ...x, panel, id: r.order };
}

/** Stará karta se starým GO na page1 → reissue → tick: nová karta s otiskem a nový řádek page2. */
async function reissued(panel = new Panel()) {
  const x = await oldCardOrder(panel);
  const oldCard = store.load(x.id).owner_card_url!;
  panel.page("page1").decision = "GO"; // vlastník dal GO na starou kartu; orchestrátor ho správně odmítl
  clock = "2026-11-04T08:32:00.000Z";
  await x.o.pollOwnerDecisions();
  expect(store.load(x.id).meta.owner_go).toBeUndefined();
  clock = "2026-11-04T08:40:00.000Z";
  await x.o.reissue(x.id);
  await x.o.flushPanel();
  clock = "2026-11-04T08:45:00.000Z";
  await x.o.tick();
  const w = store.load(x.id);
  expect(w.state).toBe("WAITING_OWNER");
  expect(w.meta.approved_hash).toBeTruthy();
  expect(new PanelIndex(dir).current(x.id, 1)).toBe("page2");
  clock = "2026-11-04T08:50:00.000Z";
  return { ...x, oldCard, card: w.owner_card_url! };
}

const log = () => store.readLog(500);
const writesTo = (panel: Panel, page: string) =>
  panel.writes.filter((w) => w.page === page);

describe("cli.ts reissue: znovuvydání karty bez otisku", () => {
  it("odmítne zakázku, jejíž karta už má approved_hash (stav beze změny)", async () => {
    const x = build();
    const r = (await x.o.tick()) as { order: string };
    const before = store.load(r.order);
    expect(before.meta.approved_hash).toBeTruthy();
    await expect(x.o.reissue(r.order)).rejects.toThrow(TransitionError);
    await expect(x.o.reissue(r.order)).rejects.toThrow(
      /už má otisk \(approved_hash\)/,
    );
    expect(store.load(r.order)).toEqual(before);
    expect(new PanelIndex(dir).superseded(r.order)).toEqual([]);
  });

  it("odmítne zakázku v jiném stavu než WAITING_OWNER", async () => {
    const x = build();
    for (const state of ["DELIVERED", "DONE", "FAILED", "NEW"] as const) {
      const id = `wo-${state.toLowerCase()}`;
      store.save({
        id,
        mission: "m",
        state,
        created_at: clock,
        updated_at: clock,
        fix_rounds: 0,
        manual_interventions: 0,
        history: [],
        meta: {},
      });
      await expect(x.o.reissue(id)).rejects.toThrow(
        /znovuvydání odmítnuto: .* ve stavu .*, ne WAITING_OWNER/,
      );
      expect(store.load(id).state).toBe(state);
    }
    const withHash: Order = {
      id: "x",
      mission: "m",
      state: "WAITING_OWNER",
      created_at: clock,
      updated_at: clock,
      fix_rounds: 0,
      manual_interventions: 0,
      history: [],
      meta: { approved_hash: "a".repeat(64) },
    };
    expect(() => transition(withHash, { type: "reissue" }, clock)).toThrow(
      TransitionError,
    );
  });

  it("reissue → DELIVERED, kolo karty 1, starý řádek vyřazen a nepřepsán; tick → nová karta a NOVÝ řádek, starý SUPERSEDED", async () => {
    const panel = new Panel();
    const { o, notion, id } = await oldCardOrder(panel);
    const oldCard = store.load(id).owner_card_url;
    const page1Writes = writesTo(panel, "page1").length;
    clock = "2026-11-04T08:40:00.000Z";
    const r = await o.reissue(id);
    await o.flushPanel();
    expect(r.state).toBe("DELIVERED");
    const s = store.load(id);
    expect(s.meta.reissued_at).toBe(clock);
    expect(s.meta.reissue_round).toBe("1");
    expect(Object.keys(s.meta).filter((k) => k.startsWith("owner_"))).toEqual(
      [],
    );
    expect(s.owner_card_url).toBeUndefined();
    expect(s.delivered_url).toBeTruthy(); // výstup se znovu nedoručuje
    expect(s.manual_interventions).toBe(0);
    expect(
      log().some(
        (e) =>
          e.order === id &&
          e.kind === "info" &&
          e.result === "karta znovuvydána",
      ),
    ).toBe(true);
    const idx = new PanelIndex(dir);
    expect(idx.superseded(id)).toEqual(["page1"]);
    expect(idx.current(id, 1)).toBeUndefined();
    expect(idx.get(id)).toBeUndefined();
    // Bez nové karty se nevytváří řádek a starý řádek se nepřepisuje.
    expect(writesTo(panel, "page1").length).toBe(page1Writes);
    expect(panel.creates).toBe(1);

    clock = "2026-11-04T08:45:00.000Z";
    const t = (await o.tick()) as { status: string; order: string };
    expect(t).toMatchObject({ status: "waiting_owner", order: id });
    const w = store.load(id);
    const seen = artifactHash(notion.pages[0].md);
    expect(w.meta.approved_hash).toBe(seen);
    expect(w.meta.artifact_hash).toBe(seen);
    expect(w.owner_card_url).toBeTruthy();
    expect(w.owner_card_url).not.toBe(oldCard);
    expect(notion.pages.at(-1)!.md).toContain(seen.slice(0, 16));
    // Nový řádek page2: karta s otiskem od prvního zápisu, rozhodnutí prázdné.
    expect(panel.creates).toBe(2);
    const p2 = panel.page("page2");
    expect(p2.row["Karta rozhodnutí"]).toBe(w.owner_card_url);
    expect(p2.row.Stav).toBe("WAITING_OWNER");
    expect(p2.decision).toBeUndefined();
    expect(writesTo(panel, "page2")[0].row["Karta rozhodnutí"]).toBe(
      w.owner_card_url,
    );
    expect(new PanelIndex(dir).current(id, 1)).toBe("page2");
    // Journal efektu etapy 3: PREPARED → EFFECT_DONE s row id (jeden mechanismus pro kolo 0 i znovuvydaná kola).
    const eff = rowEffect(id);
    expect(eff).toMatchObject({
      operation_id: `${id}/panel-row/r1`,
      step: "panel-row",
      state: "EFFECT_DONE",
      round: 1,
      attempts: 1,
      receipt: rowReceipt("page2"),
    });
    // Starý řádek page1: SUPERSEDED, hotové, nečeká, odkaz na nový řádek, bez karty.
    const p1 = panel.page("page1").row;
    expect(p1.Stav).toBe(SUPERSEDED_STATE);
    expect(p1.Fronta).toBe("3 · Hotové");
    expect(p1["Čeká na vlastníka"]).toBe("__NO__");
    expect(p1["Poslední krok"]).toBe("karta znovuvydána → nový řádek page2");
    expect(p1["Karta rozhodnutí"]).toBeNull();
    expect(new PanelIndex(dir).supersededMarked(id)).toEqual(["page1"]);
  });

  it("označení starého řádku SUPERSEDED, které selže, se zkusí při dalším zápisu znovu", async () => {
    const panel = new Panel();
    const x = await oldCardOrder(panel);
    clock = "2026-11-04T08:40:00.000Z";
    await x.o.reissue(x.id);
    await x.o.flushPanel();
    const orig = panel.upsert.bind(panel);
    panel.upsert = async (row, page) => {
      if (page === "page1") throw new NotionRestError(502, "bad_gateway");
      return orig(row, page);
    };
    clock = "2026-11-04T08:45:00.000Z";
    await x.o.tick();
    expect(new PanelIndex(dir).supersededMarked(x.id)).toEqual([]);
    expect(
      log().some(
        (e) => e.order === x.id && /SUPERSEDED selhalo/.test(e.result ?? ""),
      ),
    ).toBe(true);
    panel.upsert = orig;
    await x.o.resyncPanel(x.id);
    expect(panel.page("page1").row.Stav).toBe(SUPERSEDED_STATE);
    expect(new PanelIndex(dir).supersededMarked(x.id)).toEqual(["page1"]);
    expect(panel.creates).toBe(2); // žádný další řádek
  });
});

describe("rozhodnutí po znovuvydání: jen z nového řádku s aktuální kartou", () => {
  it("staré GO na SUPERSEDED řádku se nikdy nepřijme, ať je jakékoli a kdykoli změněné", async () => {
    const { o, panel, id } = await reissued();
    for (const v of ["GO", "GO A", "GO B", "REJECT", undefined, "GO"]) {
      panel.page("page1").decision = v;
      clock = new Date(Date.parse(clock) + 60 * 60_000).toISOString();
      const r = await o.tick();
      expect(r).toMatchObject({ status: "waiting_owner", order: id });
      const s = store.load(id);
      expect(s.state, String(v)).toBe("WAITING_OWNER");
      expect(s.meta.owner_go, String(v)).toBeUndefined();
    }
    expect(panel.page("page2").decision).toBeUndefined(); // nový řádek nedotčen
  });

  it("nové GO na novém řádku s otiskem → zaznamenáno, DONE až po read-backu", async () => {
    const { o, panel, notion, id } = await reissued();
    panel.page("page2").decision = "GO A";
    notion.readFails = true;
    await o.tick();
    let s = store.load(id);
    expect(s.state).toBe("WAITING_OWNER");
    expect(s.meta.owner_go).toBe(clock);
    expect(s.meta.owner_go_source).toBe("Notion GO A");
    notion.readFails = false;
    clock = "2026-11-04T08:55:00.000Z";
    await o.tick();
    s = store.load(id);
    expect(s.state).toBe("DONE");
    expect(s.meta.owner_option).toBe("A");
    expect(JSON.parse(s.meta.readback).hash).toBe(s.meta.approved_hash);
  });

  it("REJECT na novém řádku → FAILED; REJECT na starém řádku nic", async () => {
    const { o, panel, id } = await reissued();
    panel.page("page1").decision = "REJECT";
    await o.pollOwnerDecisions();
    expect(store.load(id).state).toBe("WAITING_OWNER");
    panel.page("page2").decision = "REJECT";
    await o.pollOwnerDecisions();
    expect(store.load(id).state).toBe("FAILED");
  });

  it("nový řádek ukazuje jinou kartu → nepřijato; opravný PR „panel“ (nález 3): řádek neplatný, nový řádek s aktuální kartou, starý SUPERSEDED", async () => {
    const { o, panel, id, card } = await reissued();
    const p2 = panel.page("page2");
    p2.cardOverride = "https://app.notion.com/p/stara-karta";
    p2.decision = "GO";
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.owner_go).toBeUndefined();
    expect(
      log().some(
        (e) =>
          e.order === id &&
          /není aktuální karta s otiskem/.test(e.reason ?? ""),
      ),
    ).toBe(true);
    expect(store.load(id).meta.reissue_round).toBe("2");
    expect(new PanelIndex(dir).tainted(id)).toEqual(["page2"]);
    expect(new PanelIndex(dir).current(id, 2)).toBe("page3");
    expect(panel.page("page3").row["Karta rozhodnutí"]).toBe(card);
    expect(panel.page("page3").decision).toBeUndefined();
    expect(panel.page("page2").row.Stav).toBe(SUPERSEDED_STATE);
    expect(panel.page("page2").row["Karta rozhodnutí"]).toBeNull();
  });

  it("nový řádek nejde spolehlivě přečíst (koš, chybějící sloupec) nebo sink bez readOwnerRow → nepřijato", async () => {
    const { o, panel, id } = await reissued();
    const p2 = panel.page("page2");
    p2.decision = "GO";
    p2.readable = false;
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.owner_go).toBeUndefined();
    p2.readable = true;
    (panel as Partial<Panel>).readOwnerRow = undefined;
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.owner_go).toBeUndefined();
    expect(store.load(id).state).toBe("WAITING_OWNER");
  });

  it("programové owner() po znovuvydání: GO vázané na otisk nové karty → DONE po read-backu", async () => {
    const { o, id } = await reissued();
    const go = o.owner(id, "GO");
    expect(go.state).toBe("WAITING_OWNER");
    expect(go.meta.owner_go).toBe(clock);
    await o.verifyApprovals();
    expect(store.load(id).state).toBe("DONE");
  });
});

describe("kolo oprav 4: nálezy review (souběh starých zápisů)", () => {
  it("nález 1 (kolo 4, od kola 5 pod zámkem panelu): pozastavený panel-sync staré karty drží zámek → reissue čeká (HOLD), stará karta zasáhne jen starý řádek", async () => {
    const panel = new Panel();
    const x = await oldCardOrder(panel);
    const fast = build(panel, store, { panelLockWaitMs: 150 });
    const oldCard = store.load(x.id).owner_card_url!;
    let release!: () => void;
    panel.hold = new Promise<void>((r) => (release = r));
    clock = "2026-11-04T08:39:30.000Z";
    const cli = build(panel, new Store(dir)); // `cli.ts panel-sync <id>` jako samostatný proces
    const synced = cli.o.resyncPanel(x.id);
    while (!panel.holding) await new Promise((r) => setImmediate(r));
    clock = "2026-11-04T08:40:00.000Z";
    // Pozastavený panel-sync drží zámek panelu: znovuvydání nesmí proběhnout mezi jeho kontrolou kola a zápisem.
    await expect(fast.o.reissue(x.id)).rejects.toThrow(
      /zámek \.panel\.lock, HOLD/,
    );
    expect(store.load(x.id).state).toBe("WAITING_OWNER");
    expect(new PanelIndex(dir).round(x.id)).toBe(0);
    release();
    await synced;
    expect(writesTo(panel, "page1").at(-1)!.row["Karta rozhodnutí"]).toBe(
      oldCard,
    );
    // Teď znovuvydání projde; nový řádek page2 nese jen novou kartu.
    await x.o.reissue(x.id);
    clock = "2026-11-04T08:45:00.000Z";
    await x.o.tick();
    const card = store.load(x.id).owner_card_url!;
    expect(new PanelIndex(dir).current(x.id, 1)).toBe("page2");
    expect(panel.page("page1").row.Stav).toBe(SUPERSEDED_STATE);
    await cli.o.resyncPanel(x.id); // další panel-sync čte kolo i řádek pod zámkem
    expect(
      writesTo(panel, "page2").every((w) => w.row["Karta rozhodnutí"] === card),
    ).toBe(true);
    for (const v of ["GO A", "REJECT", "GO"]) {
      panel.page("page1").decision = v;
      clock = new Date(Date.parse(clock) + 10 * 60_000).toISOString();
      await x.o.tick();
      expect(store.load(x.id).state, v).toBe("WAITING_OWNER");
      expect(store.load(x.id).meta.owner_go, v).toBeUndefined();
    }
    panel.page("page2").decision = "GO B";
    await x.o.pollOwnerDecisions();
    expect(store.load(x.id).meta.owner_go).toBe(clock);
    expect(store.load(x.id).meta.owner_option).toBe("B");
  });

  it("nález 2: REST PATCH staré karty po timeoutu, MCP fallback uspěje, REST PATCH dorazí opožděně → jen starý řádek, rozhodnutí nepřijato", async () => {
    const panel = new Panel();
    const late: Array<{ page: string; row: PanelRow }> = [];
    let timeoutNext = false;
    const rest: PanelSink = {
      upsert: async (row, page) => {
        if (timeoutNext && page) {
          timeoutNext = false;
          late.push({ page, row }); // požadavek odešel, odpověď nepřišla
          throw new NotionRestError(0, "timeout");
        }
        return panel.upsert(row, page);
      },
      readOwnerDecision: (p) => panel.readOwnerDecision(p),
      readOwnerRow: (p) => panel.readOwnerRow(p),
      findRowByOrderId: (id, opts) => panel.findRowByOrderId(id, opts),
    };
    const mcp: PanelSink = { upsert: (row, page) => panel.upsert(row, page) };
    const hybrid = new HybridPanelSink(rest, mcp, () => undefined);
    const x = build(hybrid);
    const r = (await x.o.tick()) as { order: string };
    const id = r.order;
    const cur = store.load(id);
    const meta = { ...cur.meta };
    delete meta.approved_hash;
    delete meta.artifact_hash;
    store.save({ ...cur, meta: { ...meta, owner_ping: "1" } });
    const oldCard = store.load(id).owner_card_url!;
    // Zápis řádku staré karty: REST timeout, MCP fallback zapíše.
    timeoutNext = true;
    clock = "2026-11-04T08:39:00.000Z";
    await x.o.resyncPanel(id);
    expect(late).toHaveLength(1);
    expect(late[0].page).toBe("page1");
    clock = "2026-11-04T08:40:00.000Z";
    await x.o.reissue(id);
    clock = "2026-11-04T08:45:00.000Z";
    await x.o.tick();
    const card = store.load(id).owner_card_url!;
    expect(new PanelIndex(dir).current(id, 1)).toBe("page2");
    const page2Writes = writesTo(panel, "page2").length;
    // Opožděný REST PATCH dorazí: starý řádek ukáže starou kartu, vlastník vybere GO A.
    panel.land(late[0].page, late[0].row);
    expect(panel.page("page1").row["Karta rozhodnutí"]).toBe(oldCard);
    panel.page("page1").decision = "GO A";
    clock = "2026-11-04T08:53:00.000Z";
    await x.o.tick(); // další panel-sync / tick nový řádek nemění
    clock = "2026-11-04T09:10:00.000Z";
    await x.o.tick();
    let s = store.load(id);
    expect(s.state).toBe("WAITING_OWNER");
    expect(s.meta.owner_go).toBeUndefined();
    expect(writesTo(panel, "page2").length).toBeGreaterThanOrEqual(page2Writes);
    expect(
      writesTo(panel, "page2").every((w) => w.row["Karta rozhodnutí"] === card),
    ).toBe(true);
    expect(panel.page("page2").decision).toBeUndefined();
    panel.page("page2").decision = "GO";
    await x.o.pollOwnerDecisions();
    s = store.load(id);
    expect(s.meta.owner_go).toBe(clock);
  });

  it("vyřazený řádek nejde do indexu vrátit (PanelIndex.set odmítne starý řádek i starší kolo)", () => {
    const idx = new PanelIndex(dir);
    idx.set("wo-1", "page1");
    idx.retire("wo-1", 1);
    expect(idx.set("wo-1", "page1")).toBe("stale");
    expect(idx.set("wo-1", "page1", 1)).toBe("stale");
    expect(idx.set("wo-1", "page9", 0)).toBe("stale"); // zápis staršího kola
    expect(idx.current("wo-1", 1)).toBeUndefined();
    expect(idx.set("wo-1", "page2", 1)).toBe("ok");
    expect(idx.current("wo-1", 1)).toBe("page2");
    expect(idx.current("wo-1", 0)).toBeUndefined();
    // Kolo oprav 5: stejné kolo, jiný řádek = konflikt, nikdy tiché nahrazení.
    expect(idx.set("wo-1", "page3", 1)).toBe("conflict");
    expect(idx.current("wo-1", 1)).toBe("page2");
    expect(idx.set("wo-1", "page2", 1)).toBe("ok"); // stejný řádek znovu = v pořádku
    idx.set("wo-2", "rowA");
    expect(idx.set("wo-2", "rowB")).toBe("conflict");
    expect(idx.get("wo-2")).toBe("rowA");
  });
});

describe("journal efektu nového řádku (PREPARED → receipt)", () => {
  it("vytvoření s nejasným výsledkem se naslepo neopakuje: řádek se dohledá podle karty, druhý nevznikne", async () => {
    const panel = new Panel();
    const x = await oldCardOrder(panel);
    clock = "2026-11-04T08:40:00.000Z";
    await x.o.reissue(x.id);
    panel.createLandsThenFails = true;
    clock = "2026-11-04T08:45:00.000Z";
    await x.o.tick();
    // Jediný POST (attempts 1); další zápis v ticku nebo panel-sync řádek jen dohledá.
    expect(rowEffect(x.id)).toMatchObject({
      attempts: 1,
    });
    expect(panel.creates).toBe(2);
    await x.o.resyncPanel(x.id);
    expect(panel.creates).toBe(2); // žádný duplicitní řádek
    expect(rowEffect(x.id)).toMatchObject({
      state: "EFFECT_DONE",
      recovered: true,
      receipt: rowReceipt("page2"),
    });
    expect(new PanelIndex(dir).current(x.id, 1)).toBe("page2");
    expect(panel.page("page1").row.Stav).toBe(SUPERSEDED_STATE);
  });

  it("dohledání nikdy nevezme vyřazený řádek; čisté odmítnutí = EFFECT_ABSENT a nový pokus", async () => {
    const panel = new Panel();
    const x = await oldCardOrder(panel);
    clock = "2026-11-04T08:40:00.000Z";
    await x.o.reissue(x.id);
    panel.failUpsert = new NotionRestError(400, "validation_error");
    clock = "2026-11-04T08:45:00.000Z";
    await x.o.tick();
    const absent = rowEffect(x.id)!;
    expect(absent.state).toBe("EFFECT_ABSENT");
    expect(panel.creates).toBe(1); // čistá odmítnutí nic nevytvořila
    panel.failUpsert = undefined;
    await x.o.resyncPanel(x.id);
    expect(rowEffect(x.id)).toMatchObject({
      state: "EFFECT_DONE",
      attempts: absent.attempts + 1,
      receipt: rowReceipt("page2"),
    });
    // Nejasný pokus: page1 (stejné ID zakázky) se jako výsledek nikdy nepřijme.
    expect(await panel.findRowByOrderId(x.id, { exclude: ["page1"] })).toBe(
      "page2",
    );
    expect(
      await panel.findRowByOrderId(x.id, { exclude: ["page1", "page2"] }),
    ).toBeUndefined();
  });

  it("RestPanelSink.findRowByOrderId vynechá vyřazené řádky a s `card` vezme jen řádek s odkazem na tuto kartu", async () => {
    const results = [
      {
        id: "aaaaaaaa-0000-0000-0000-000000000001",
        properties: {
          "Karta rozhodnutí": { url: "https://app.notion.com/p/old" },
        },
      },
      {
        id: "aaaaaaaa-0000-0000-0000-000000000002",
        properties: {
          "Karta rozhodnutí": { url: "https://app.notion.com/p/orphan" },
        },
      },
      {
        id: "aaaaaaaa-0000-0000-0000-000000000003",
        properties: {
          "Karta rozhodnutí": { url: "https://app.notion.com/p/new" },
        },
      },
    ];
    const fn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ results, has_more: false }),
    });
    const token = [
      "ntn",
      "_",
      "Z9y8X7w6V5u4T3s2R1q0P9o8N7m6L5k4J3i2H1g0F9e8D7",
    ].join("");
    const sink = new RestPanelSink(new NotionRestApi(token, fn as never));
    expect(await sink.findRowByOrderId("wo-1")).toBe(
      "aaaaaaaa000000000000000000000001",
    );
    expect(
      await sink.findRowByOrderId("wo-1", {
        exclude: ["aaaaaaaa000000000000000000000001"],
      }),
    ).toBe("aaaaaaaa000000000000000000000002");
    expect(
      await sink.findRowByOrderId("wo-1", {
        exclude: ["aaaaaaaa000000000000000000000001"],
        card: "https://app.notion.com/p/new",
      }),
    ).toBe("aaaaaaaa000000000000000000000003");
    expect(
      await sink.findRowByOrderId("wo-1", {
        card: "https://app.notion.com/p/none",
      }),
    ).toBeUndefined();
  });
});

describe("P20: znovuvydání nezapisuje „Rozhodnutí vlastníka“", () => {
  it("žádný zápis řádku (nový řádek, SUPERSEDED, oprava karty) nenese „Rozhodnutí vlastníka“; REST whitelist ho nevydá", async () => {
    const { o, panel, id } = await reissued();
    panel.page("page2").cardOverride = "https://app.notion.com/p/jina"; // vyvolá opravu karty
    panel.page("page2").decision = "GO";
    await o.pollOwnerDecisions();
    expect(panel.writes.length).toBeGreaterThan(3);
    for (const w of panel.writes) {
      expect(Object.keys(w.row)).not.toContain(OWNER_DECISION_PROPERTY);
      expect(Object.keys(rowToRestProperties(w.row))).not.toContain(
        OWNER_DECISION_PROPERTY,
      );
    }
    const sup = supersededRow(store.load(id), "a", "b", "page2");
    expect(Object.keys(rowToRestProperties(sup))).not.toContain(
      OWNER_DECISION_PROPERTY,
    );
    // Rozhodnutí v řádcích nastavil jen test (vlastník), orchestrátor žádné nezměnil.
    expect(panel.page("page1").decision).toBe("GO");
    expect(panel.page("page2").decision).toBe("GO");
  });
});

describe("RestPanelSink.readOwnerRow", () => {
  it("vrátí hodnotu, spolehlivost čtení a odkaz karty; řádek v koši = nic", async () => {
    const pages: Record<string, unknown> = {
      a: {
        last_edited_time: "2026-11-04T08:49:00.000Z",
        properties: {
          "Rozhodnutí vlastníka": { select: { name: "GO" } },
          "Karta rozhodnutí": { url: "https://app.notion.com/p/k1" },
        },
      },
      b: {
        in_trash: true,
        properties: { "Rozhodnutí vlastníka": { select: { name: "GO" } } },
      },
      c: { properties: { "Rozhodnutí vlastníka": { select: null } } },
      d: { properties: { Rozhodnutí: { select: { name: "GO" } } } },
    };
    const fn = async (url: string) => {
      const id = /\/v1\/pages\/(\w+)$/.exec(url)![1];
      return { ok: true, status: 200, json: async () => pages[id] };
    };
    const token = [
      "ntn",
      "_",
      "Z9y8X7w6V5u4T3s2R1q0P9o8N7m6L5k4J3i2H1g0F9e8D7",
    ].join("");
    const sink = new RestPanelSink(new NotionRestApi(token, fn as never));
    expect(await sink.readOwnerRow("a")).toEqual({
      decision: "GO",
      last_edited_time: "2026-11-04T08:49:00.000Z",
      readable: true,
      card: "https://app.notion.com/p/k1",
    });
    expect(await sink.readOwnerRow("b")).toEqual({ readable: false });
    expect(await sink.readOwnerRow("c")).toEqual({
      decision: undefined,
      last_edited_time: undefined,
      readable: true,
    });
    expect(await sink.readOwnerRow("d")).toEqual({
      decision: undefined,
      last_edited_time: undefined,
      readable: false,
    });
    expect(await sink.readOwnerDecision("a")).toBe("GO");
  });
});

const yieldLoop = () => new Promise((r) => setImmediate(r));

describe("kolo oprav 5: zápisy panelu jedné zakázky pod jedním zámkem", () => {
  it("review 3, nález 1: panel-sync pozastavený pod zámkem (po kontrole kola, před načtením ID) → reissue ani tick nového řádku neproběhnou mezi tím; stará karta do nového řádku nikdy", async () => {
    const panel = new Panel();
    const x = await oldCardOrder(panel);
    const other = build(panel, new Store(dir), { panelLockWaitMs: 150 }); // jiný proces: reissue + tick
    let release!: () => void;
    panel.hold = new Promise<void>((r) => (release = r));
    const cli = build(panel, new Store(dir)); // pozastavený `cli.ts panel-sync`
    const synced = cli.o.resyncPanel(x.id);
    while (!panel.holding) await yieldLoop();
    clock = "2026-11-04T08:40:00.000Z";
    await expect(other.o.reissue(x.id)).rejects.toThrow(
      /zámek \.panel\.lock, HOLD/,
    );
    expect(store.load(x.id).meta.reissue_round).toBeUndefined();
    release();
    await synced;
    // Po uvolnění: reissue, tick vytvoří page2; panel-sync starého procesu (znovu spuštěný) píše jen novou kartu do page2.
    await other.o.reissue(x.id);
    clock = "2026-11-04T08:45:00.000Z";
    await x.o.tick(); // tick s DRAFTem v Notionu (read-back karty)
    const card = store.load(x.id).owner_card_url!;
    await cli.o.resyncPanel(x.id);
    expect(panel.creates).toBe(2);
    expect(
      writesTo(panel, "page2").every((w) => w.row["Karta rozhodnutí"] === card),
    ).toBe(true);
    expect(new PanelIndex(dir).lastWrite(x.id)).toMatchObject({
      row: "page2",
      round: 1,
      card,
    });
    // Staré rozhodnutí se nepřijme, nové na page2 ano.
    panel.page("page1").decision = "GO";
    await other.o.pollOwnerDecisions();
    expect(store.load(x.id).meta.owner_go).toBeUndefined();
    panel.page("page2").decision = "REJECT";
    await other.o.pollOwnerDecisions();
    expect(store.load(x.id).state).toBe("FAILED");
  });

  it("review 3, nález 2: souběžný POST nového řádku (tick) a panel-sync → druhý POST nevznikne, REJECT na aktuálním řádku se neztratí", async () => {
    const panel = new Panel();
    const x = await oldCardOrder(panel);
    clock = "2026-11-04T08:40:00.000Z";
    await x.o.reissue(x.id);
    await x.o.flushPanel();
    let release!: () => void;
    panel.hold = new Promise<void>((r) => (release = r));
    clock = "2026-11-04T08:45:00.000Z";
    const ticking = x.o.tick();
    while (!panel.holding) await yieldLoop();
    // Tick drží zámek panelu: PREPARED uložený, POST nového řádku ještě nedoběhl.
    expect(rowEffect(x.id)).toMatchObject({
      state: "PREPARED",
      attempts: 1,
    });
    // Souběžný panel-sync PREPARED bez receiptu nevidí jako volnou cestu: čeká na zámek, po limitu HOLD, žádný POST.
    const cli = build(panel, new Store(dir), { panelLockWaitMs: 150 });
    await cli.o.resyncPanel(x.id);
    expect(panel.creates).toBe(1);
    expect(
      log().some(
        (e) =>
          e.order === x.id &&
          e.result === "panel sync failed" &&
          /zámek \.panel\.lock, HOLD/.test(e.reason ?? ""),
      ),
    ).toBe(true);
    // Panel-sync s delším čekáním doběhne až po POST a jen aktualizuje page2.
    const cli2 = build(panel, new Store(dir));
    const waitingSync = cli2.o.resyncPanel(x.id);
    await new Promise((r) => setTimeout(r, 60));
    release();
    await ticking;
    await waitingSync;
    expect(panel.creates).toBe(2);
    expect(new PanelIndex(dir).current(x.id, 1)).toBe("page2");
    expect(rowEffect(x.id)).toMatchObject({
      state: "EFFECT_DONE",
      attempts: 1,
      receipt: rowReceipt("page2"),
    });
    expect(writesTo(panel, "page3")).toEqual([]);
    panel.page("page2").decision = "REJECT";
    await cli2.o.pollOwnerDecisions();
    expect(store.load(x.id).state).toBe("FAILED");
  });

  it("stará karta zapsaná do nového řádku kýmkoli mimo zámek → rozhodnutí z řádku se nepřijme nikdy (nález 3: nový řádek, starý SUPERSEDED)", async () => {
    const { o, panel, id, oldCard, card } = await reissued();
    const p2 = panel.page("page2");
    panel.land("page2", { ...p2.row, "Karta rozhodnutí": oldCard });
    p2.decision = "GO";
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.owner_go).toBeUndefined();
    expect(writesTo(panel, "page2").at(-1)!.row.Stav).toBe(SUPERSEDED_STATE);
    expect(new PanelIndex(dir).tainted(id)).toEqual(["page2"]);
    expect(new PanelIndex(dir).current(id, 2)).toBe("page3");
    expect(panel.page("page3").row["Karta rozhodnutí"]).toBe(card);
    // GO / REJECT ve starém řádku: pořád nepřijato.
    for (const v of ["GO", "REJECT", "GO A"]) {
      p2.decision = v;
      clock = new Date(Date.parse(clock) + 10 * 60_000).toISOString();
      await o.tick();
      expect(store.load(id).state, v).toBe("WAITING_OWNER");
      expect(store.load(id).meta.owner_go, v).toBeUndefined();
    }
    expect(
      log().some(
        (e) =>
          e.order === id &&
          /je neplatný pro rozhodnutí \(HOLD\)/.test(e.result ?? ""),
      ),
    ).toBe(true);
    // Rozhodnutí na novém řádku aktuální karty se přijme.
    panel.page("page3").decision = "GO";
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.owner_go).toBe(clock);
  });

  it("rozhodnutí se nepřijme, když poslední zápis řádku pod zámkem nenesl aktuální kartu (záznam chybí nebo patří jinému řádku)", async () => {
    const { o, panel, id } = await reissued();
    const f = path.join(dir, "panel-index.json");
    const all = JSON.parse(fs.readFileSync(f, "utf8")) as Record<
      string,
      string
    >;
    all[`written:${id}`] = JSON.stringify({
      row: "page2",
      round: 1,
      card: "https://app.notion.com/p/jina",
      fence: 1,
    });
    fs.writeFileSync(f, JSON.stringify(all));
    panel.page("page2").decision = "GO";
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.owner_go).toBeUndefined();
    expect(new PanelIndex(dir).tainted(id)).toEqual(["page2"]);
    expect(
      log().some(
        (e) =>
          e.order === id &&
          /poslední zápis řádku pod zámkem panelu nenesl aktuální kartu/.test(
            e.result ?? "",
          ),
      ),
    ).toBe(true);
  });

  it("zámek panelu: živý držitel = HOLD, nečitelný zámek = HOLD, převzetí jen po prokázaném konci; zápis s neplatným fence se neodešle", async () => {
    const s = new Store(dir);
    const id = "wo-lock";
    const lockFile = path.join(s.orderDir(id), ".panel.lock");
    const started = processStartTime(process.pid)!;
    fs.writeFileSync(
      lockFile,
      JSON.stringify({
        order: id,
        token: "live",
        fence: 3,
        pid: process.pid,
        started,
        acquired_at: "2000-01-01T00:00:00Z",
      }),
    );
    let ran = false;
    await expect(
      s.withPanelLock(id, async () => void (ran = true), 80),
    ).rejects.toThrow(PanelLockHoldError);
    fs.writeFileSync(lockFile, "{nečitelné");
    await expect(
      s.withPanelLock(id, async () => void (ran = true), 80),
    ).rejects.toThrow(/HOLD/);
    expect(ran).toBe(false);
    // Držitel prokazatelně skončil (PID neexistuje): převzetí, fence roste nad jeho fence.
    fs.writeFileSync(
      lockFile,
      JSON.stringify({
        order: id,
        token: "dead",
        fence: 3,
        pid: 2147483646,
        started: "x",
        acquired_at: "2000-01-01T00:00:00Z",
      }),
    );
    const fence = await s.withPanelLock(
      id,
      async (lease) => {
        expect(lease.took_over).toBe("dead");
        expect(() =>
          s.withStateLock(() => s.assertPanelLease(lease)),
        ).not.toThrow();
        // Někdo zámek přepsal jiným udělením: náš fence už neplatí, zápis se neprovede.
        fs.writeFileSync(lockFile, JSON.stringify({ ...lease, token: "jiny" }));
        expect(() => s.withStateLock(() => s.assertPanelLease(lease))).toThrow(
          /fence panelu 4 už neplatí/,
        );
        return lease.fence;
      },
      80,
    );
    expect(fence).toBe(4);
    expect(fs.existsSync(lockFile)).toBe(true); // cizí udělení se při uvolnění nemaže
    expect(
      s
        .readLog(50)
        .some(
          (e) => e.order === id && /zámek panelu převzat/.test(e.result ?? ""),
        ),
    ).toBe(true);
  });

  it("orchestrátor: zápis řádku s neplatným fence se neodešle", async () => {
    const { o, panel, id } = await reissued();
    const before = panel.writes.length;
    const orig = panel.upsert.bind(panel);
    const lockFile = path.join(store.orderDir(id), ".panel.lock");
    let sent = 0;
    // Během zápisu page2 přepíše jiný proces zámek panelu: záznam zápisu ani další zápis v témž zámku neproběhne.
    panel.upsert = async (row, page) => {
      sent++;
      const r = await orig(row, page);
      const cur = JSON.parse(fs.readFileSync(lockFile, "utf8")) as Record<
        string,
        unknown
      >;
      fs.writeFileSync(lockFile, JSON.stringify({ ...cur, token: "jiny" }));
      return r;
    };
    const f = path.join(dir, "panel-index.json");
    const all = JSON.parse(fs.readFileSync(f, "utf8")) as Record<
      string,
      string
    >;
    delete all[`superseded-marked:${id}`]; // jinak by po page2 následoval i zápis SUPERSEDED do page1
    fs.writeFileSync(f, JSON.stringify(all));
    const lastBefore = new PanelIndex(dir).lastWrite(id);
    await o.resyncPanel(id);
    expect(sent).toBe(1);
    expect(panel.writes.length).toBe(before + 1);
    expect(new PanelIndex(dir).supersededMarked(id)).toEqual([]);
    // Opravný PR „panel“, kolo 2: před PATCH (ještě s platným fence) záznam „zápis běží, karta neprokázaná“; záznam
    // s aktuální kartou po zápisu už držitel se ztraceným fence nezapíše.
    expect(new PanelIndex(dir).lastWrite(id)).toEqual({
      ...lastBefore,
      card: null,
      fence: expect.any(Number),
    });
    expect(
      log().some(
        (e) =>
          e.order === id && /fence panelu \d+ už neplatí/.test(e.reason ?? ""),
      ),
    ).toBe(true);
    fs.rmSync(lockFile, { force: true });
  });

  it("P20: reissue ani panel-sync nikdy nezapisují „Rozhodnutí vlastníka“", async () => {
    const panel = new Panel();
    const x = await oldCardOrder(panel);
    panel.page("page1").decision = "GO";
    const before = panel.writes.length;
    clock = "2026-11-04T08:40:00.000Z";
    await x.o.reissue(x.id);
    await x.o.flushPanel();
    const cli = build(panel, new Store(dir));
    await cli.o.resyncPanel(x.id);
    clock = "2026-11-04T08:45:00.000Z";
    await x.o.tick();
    panel.page("page2").decision = "REJECT";
    await cli.o.resyncPanel(x.id);
    await cli.o.resyncPanel(x.id);
    const mine = panel.writes.slice(before);
    expect(mine.length).toBeGreaterThan(2);
    for (const w of mine) {
      expect(Object.keys(w.row)).not.toContain(OWNER_DECISION_PROPERTY);
      expect(Object.keys(rowToRestProperties(w.row))).not.toContain(
        OWNER_DECISION_PROPERTY,
      );
    }
    expect(panel.page("page1").decision).toBe("GO");
    expect(panel.page("page2").decision).toBe("REJECT");
  });
});

describe("oprava po review sloučení: dohledaný řádek a PATCH, který selže", () => {
  /** Po znovuvydání: první POST nového řádku dorazí, ale odpověď se ztratí; další PATCHe vrací 409, dokud `patchFails`. */
  async function lostPostThen409() {
    const panel = new Panel();
    const x = await oldCardOrder(panel);
    const oldCard = store.load(x.id).owner_card_url!;
    clock = "2026-11-04T08:40:00.000Z";
    await x.o.reissue(x.id);
    await x.o.flushPanel();
    const real = panel.upsert.bind(panel);
    const ctl = { lostPost: false, patchFails: false, patches409: 0 };
    panel.upsert = async (row: PanelRow, page?: string) => {
      if (!page && !ctl.lostPost) {
        ctl.lostPost = true;
        ctl.patchFails = true;
        await real(row);
        throw new Error("notion: spojení přerušeno po odeslání");
      }
      if (page && ctl.patchFails) {
        ctl.patches409++;
        throw new NotionRestError(409, "conflict_error");
      }
      return real(row, page);
    };
    clock = "2026-11-04T08:45:00.000Z";
    await x.o.tick();
    await x.o.flushPanel();
    expect(panel.creates).toBe(2); // page2 vznikl, odpověď POST se ztratila
    // Obnova: dohledání page2 podle aktuální karty, následný PATCH 409.
    await x.o.resyncPanel(x.id);
    expect(ctl.patches409).toBeGreaterThan(0);
    expect(panel.creates).toBe(2);
    const w = store.load(x.id);
    expect(w.state).toBe("WAITING_OWNER");
    expect(new PanelIndex(dir).current(x.id, 1)).toBe("page2");
    return { ...x, panel, ctl, oldCard, card: w.owner_card_url! };
  }

  it("ztracená odpověď POST → dohledání → PATCH 409 → REJECT na P2 se nezahodí (žádné tainted) a po úspěšném syncu se přijme", async () => {
    const { o, panel, ctl, id, card } = await lostPostThen409();
    // Záznam zápisu nese aktuální kartu dohledaného řádku, ne null.
    expect(new PanelIndex(dir).lastWrite(id)).toMatchObject({
      row: "page2",
      round: 1,
      card,
    });
    panel.page("page2").decision = "REJECT";
    await o.pollOwnerDecisions();
    await o.flushPanel();
    expect(new PanelIndex(dir).tainted(id)).toEqual([]);
    ctl.patchFails = false;
    await o.resyncPanel(id);
    await o.pollOwnerDecisions();
    expect(store.load(id).state).toBe("FAILED");
    expect(new PanelIndex(dir).tainted(id)).toEqual([]);
  });

  // Opravný PR „panel“, kolo 2, bod 1 (záměrná změna): rozhodnutí v řádku bez důkazu, že jeho karta byla od vydání
  // aktuální karty pořád aktuální (chybí záznam zápisu), se nepřijme ani po úspěšném zápisu. Řádek se vyřadí, nový řádek.
  it("chybějící záznam zápisu + rozhodnutí v řádku: nepřijme se, řádek se vyřadí a rozhodnutí platí až na novém řádku", async () => {
    const { o, panel, id, card } = await reissued();
    const f = path.join(dir, "panel-index.json");
    const all = JSON.parse(fs.readFileSync(f, "utf8")) as Record<
      string,
      string
    >;
    delete all[`written:${id}`];
    fs.writeFileSync(f, JSON.stringify(all));
    panel.failUpsert = new NotionRestError(409, "conflict_error");
    panel.page("page2").decision = "REJECT";
    await o.pollOwnerDecisions();
    await o.flushPanel();
    expect(store.load(id).state).toBe("WAITING_OWNER");
    expect(new PanelIndex(dir).tainted(id)).toEqual(["page2"]);
    expect(store.load(id).meta.reissue_round).toBe("2");
    panel.failUpsert = undefined;
    await o.resyncPanel(id);
    await o.pollOwnerDecisions();
    expect(store.load(id).state).toBe("WAITING_OWNER");
    const cur = new PanelIndex(dir).current(id, 2)!;
    expect(cur).toBe("page3");
    expect(panel.page(cur).row["Karta rozhodnutí"]).toBe(card);
    expect(panel.page("page2").row.Stav).toBe(SUPERSEDED_STATE);
    panel.page(cur).decision = "REJECT";
    await o.pollOwnerDecisions();
    expect(store.load(id).state).toBe("FAILED");
  });

  it("skutečně cizí stará karta v dohledaném řádku dál vede na tainted (HOLD), ani REJECT se nepřijme", async () => {
    const { o, panel, ctl, id, oldCard, card } = await lostPostThen409();
    expect(oldCard).not.toBe(card);
    const p2 = panel.page("page2");
    panel.land("page2", { ...p2.row, "Karta rozhodnutí": oldCard }); // někdo mimo zámek
    p2.decision = "REJECT";
    await o.pollOwnerDecisions();
    await o.flushPanel();
    expect(store.load(id).state).toBe("WAITING_OWNER");
    expect(new PanelIndex(dir).tainted(id)).toEqual(["page2"]);
    ctl.patchFails = false;
    await o.resyncPanel(id);
    await o.pollOwnerDecisions();
    expect(store.load(id).state).toBe("WAITING_OWNER");
    expect(new PanelIndex(dir).tainted(id)).toEqual(["page2"]);
  });

  it("záznam zápisu do tohoto řádku s jinou (starou) kartou dál vede na tainted", async () => {
    const { o, panel, id, oldCard, card } = await reissued();
    expect(oldCard).not.toBe(card);
    const f = path.join(dir, "panel-index.json");
    const all = JSON.parse(fs.readFileSync(f, "utf8")) as Record<
      string,
      string
    >;
    all[`written:${id}`] = JSON.stringify({
      row: "page2",
      round: 1,
      card: oldCard,
      fence: 1,
    });
    fs.writeFileSync(f, JSON.stringify(all));
    panel.page("page2").decision = "REJECT";
    await o.pollOwnerDecisions();
    expect(store.load(id).state).toBe("WAITING_OWNER");
    expect(new PanelIndex(dir).tainted(id)).toEqual(["page2"]);
  });
});
describe("opravný PR „panel“: zbylé nálezy etapy 3 (#97) a znovuvydání karty (#99)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("nález 1: zámek indexu se před POST nezíská → PREPARED nevznikne, další zápis řádek normálně vytvoří (žádný HOLD)", async () => {
    const panel = new Panel();
    const x = await oldCardOrder(panel);
    clock = "2026-11-04T08:40:00.000Z";
    await x.o.reissue(x.id);
    await x.o.flushPanel();
    panel.lookupBlind = true; // REST nedostupný, MCP hledání nic neprokáže
    const real = PanelIndex.prototype.beginWrite;
    let failed = 0;
    vi.spyOn(PanelIndex.prototype, "beginWrite").mockImplementation(function (
      this: PanelIndex,
      orderId: string,
    ) {
      if (failed++ === 0)
        throw new Error(
          "stav zakázky právě mění jiný proces (zámek .state.lock, HOLD), zkus to za chvíli",
        );
      return real.call(this, orderId);
    });
    clock = "2026-11-04T08:45:00.000Z";
    await x.o.tick();
    await x.o.resyncPanel(x.id);
    expect(failed).toBeGreaterThan(1);
    expect(new PanelIndex(dir).current(x.id, 1)).toBe("page2");
    expect(rowEffect(x.id)).toMatchObject({
      state: "EFFECT_DONE",
      attempts: 1,
      receipt: rowReceipt("page2"),
    });
    expect(panel.creates).toBe(2);
    expect(
      log().some(
        (e) => e.order === x.id && /EFFECT_UNKNOWN/.test(e.result ?? ""),
      ),
    ).toBe(false);
  });

  it("nález 2: HOLD nesmaže značku dirty; až MCP index řádek zpřístupní, catchUpPanel ho s odstupem dorovná (FAILED)", async () => {
    const panel = new Panel();
    panel.createLandsThenFails = true; // POST řádku dorazí, odpověď se ztratí
    panel.lookupBlind = true; // REST 404, MCP index řádek zatím nevidí
    const x = build(panel);
    const r = (await x.o.tick()) as { order: string; status: string };
    expect(r.status).toBe("waiting_owner");
    const id = r.order;
    expect(panel.creates).toBe(1);
    expect(new PanelIndex(dir).get(id)).toBeUndefined();
    x.o.owner(id, "REJECT"); // lokálně FAILED
    await x.o.flushPanel();
    expect(store.load(id).state).toBe("FAILED");
    expect(new PanelIndex(dir).isDirty(id)).toBe(true);
    expect(panel.page("page1").row.Stav).not.toBe("FAILED");
    panel.lookupBlind = false; // MCP index řádek zpřístupnil
    // dorovnání jako na začátku ticku (bez supervizora, který by jinak založil další zakázku)
    const catchUp = () =>
      (x.o as unknown as { catchUpPanel(): Promise<void> }).catchUpPanel();
    clock = new Date(Date.parse(clock) + 60_000).toISOString();
    await catchUp();
    expect(panel.page("page1").row.Stav).not.toBe("FAILED"); // odstup ještě neuplynul
    clock = new Date(Date.parse(clock) + 11 * 60_000).toISOString();
    await catchUp();
    expect(panel.page("page1").row.Stav).toBe("FAILED");
    expect(new PanelIndex(dir).get(id)).toBe("page1");
    expect(new PanelIndex(dir).isDirty(id)).toBe(false);
    expect(new PanelIndex(dir).heldAt(id)).toBeUndefined();
    expect(panel.creates).toBe(1);
  });

  it("nález 3: řádek ukazuje starou kartu bez rozhodnutí, vlastník vybere GO během opravy odkazu → GO se nepřijme, nový řádek", async () => {
    const { o, panel, id, oldCard, card } = await reissued();
    const p2 = panel.page("page2");
    panel.land("page2", { ...p2.row, "Karta rozhodnutí": oldCard }); // opožděný / ruční zápis
    const orig = panel.upsert.bind(panel);
    panel.upsert = async (row, page) => {
      if (page === "page2" && !p2.decision) p2.decision = "GO"; // vlastník klikne nad starou kartou v okně opravy
      return orig(row, page);
    };
    await o.pollOwnerDecisions();
    await o.flushPanel();
    await o.pollOwnerDecisions();
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.owner_go).toBeUndefined();
    expect(store.load(id).state).toBe("WAITING_OWNER");
    expect(new PanelIndex(dir).tainted(id)).toEqual(["page2"]);
    const round = Number(store.load(id).meta.reissue_round);
    const cur = new PanelIndex(dir).current(id, round)!;
    expect(cur).toBeTruthy();
    expect(cur).not.toBe("page2");
    expect(panel.page(cur).row["Karta rozhodnutí"]).toBe(card);
    expect(panel.page(cur).decision).toBeUndefined();
    expect(panel.page("page2").row.Stav).toBe(SUPERSEDED_STATE);
    // P20: žádný zápis nenese „Rozhodnutí vlastníka“.
    for (const w of panel.writes)
      expect(Object.keys(w.row)).not.toContain(OWNER_DECISION_PROPERTY);
  });

  it("nález 3: přímý panel-sync před pollem opraví odkaz jen novým řádkem; GO nad starou kartou se nepřijme", async () => {
    const { o, panel, id, oldCard, card } = await reissued();
    const p2 = panel.page("page2");
    panel.land("page2", { ...p2.row, "Karta rozhodnutí": oldCard });
    p2.decision = "GO";
    const sync = build(panel, new Store(dir)); // samostatný proces panel-sync
    await sync.o.resyncPanel(id);
    await o.pollOwnerDecisions();
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.owner_go).toBeUndefined();
    expect(new PanelIndex(dir).tainted(id)).toEqual(["page2"]);
    expect(store.load(id).meta.reissue_round).toBe("2");
    const cur = new PanelIndex(dir).current(id, 2)!;
    expect(cur).toBe("page3");
    expect(panel.page(cur).row["Karta rozhodnutí"]).toBe(card);
    expect(panel.page("page2").row.Stav).toBe(SUPERSEDED_STATE);
    panel.page(cur).decision = "REJECT";
    await o.pollOwnerDecisions();
    expect(store.load(id).state).toBe("FAILED");
  });

  /** Po znovuvydání: POST nového řádku vyprší na klientovi, server ho doběhne až později (`landLate`). */
  async function postTimesOut() {
    const panel = new Panel();
    const x = await oldCardOrder(panel);
    clock = "2026-11-04T08:40:00.000Z";
    await x.o.reissue(x.id);
    await x.o.flushPanel();
    const pending: PanelRow[] = [];
    let timeoutNext = true;
    const orig = panel.upsert.bind(panel);
    panel.upsert = async (row, page) => {
      if (!page && timeoutNext) {
        timeoutNext = false;
        pending.push(row);
        throw new NotionRestError(0, "timeout");
      }
      return orig(row, page);
    };
    clock = "2026-11-04T08:45:00.000Z";
    await x.o.tick();
    await x.o.flushPanel();
    expect(pending).toHaveLength(1);
    expect(rowEffect(x.id)).toMatchObject({ state: "PREPARED", attempts: 1 });
    return { ...x, panel, landLate: () => orig(pending[0]) };
  }

  it("nález 4: POST vyprší, souběžný panel-sync v ochranné době druhý POST nepošle; pozdě doběhlý řádek se použije a REJECT na něm se přijme", async () => {
    const { o, panel, id, landLate } = await postTimesOut();
    clock = "2026-11-04T08:46:00.000Z";
    const sync = build(panel, new Store(dir));
    await sync.o.resyncPanel(id);
    expect(panel.creates).toBe(1); // jen page1 (kolo 0), žádný druhý POST
    expect(rowEffect(id)).toMatchObject({ state: "PREPARED", attempts: 1 });
    expect(
      log().some(
        (e) => e.order === id && /ochrannou dobu/.test(e.result ?? ""),
      ),
    ).toBe(true);
    const late = await landLate(); // první POST doběhl na serveru
    expect(late).toBe("page2");
    clock = "2026-11-04T08:47:00.000Z";
    await sync.o.resyncPanel(id);
    expect(panel.creates).toBe(2);
    expect(new PanelIndex(dir).current(id, 1)).toBe("page2");
    expect(rowEffect(id)).toMatchObject({
      state: "EFFECT_DONE",
      attempts: 1,
      recovered: true,
    });
    panel.page("page2").decision = "REJECT";
    await o.pollOwnerDecisions();
    expect(store.load(id).state).toBe("FAILED");
  });

  it("nález 4: po ochranné době a konzistentním „neexistuje“ smí jít nový POST (stejná operace)", async () => {
    const { panel, id } = await postTimesOut();
    clock = "2026-11-04T08:56:00.000Z"; // 11 min po nejasném POST
    await build(panel, new Store(dir)).o.resyncPanel(id);
    expect(panel.creates).toBe(2);
    expect(rowEffect(id)).toMatchObject({ state: "EFFECT_DONE", attempts: 2 });
  });

  it("nález 4: dva řádky stejného kola → HOLD, žádný se nepoužije, log říká, že konflikt řeší Fable", async () => {
    const { o, panel, id, landLate } = await postTimesOut();
    await landLate();
    await landLate(); // dva řádky téhož kola (stejné ID zakázky i karta)
    clock = "2026-11-04T08:56:00.000Z";
    await build(panel, new Store(dir)).o.resyncPanel(id);
    expect(new PanelIndex(dir).current(id, 1)).toBeUndefined();
    expect(
      log().some(
        (e) =>
          e.order === id &&
          /dva řádky stejného kola 1 \(page2, page3\).*konflikt řeší Fable/.test(
            e.result ?? "",
          ),
      ),
    ).toBe(true);
    panel.page("page2").decision = "REJECT";
    panel.page("page3").decision = "GO";
    await o.pollOwnerDecisions();
    expect(store.load(id).state).toBe("WAITING_OWNER");
    expect(store.load(id).meta.owner_go).toBeUndefined();
    expect(panel.creates).toBe(3); // žádný další POST
    expect(new PanelIndex(dir).isDirty(id)).toBe(true); // HOLD čeká na vyřešení, značka zůstává
  });
});

describe("opravný PR „panel“, kolo 2 (Codex review kolo 1)", () => {
  afterEach(() => vi.restoreAllMocks());

  /** Pád mezi receiptem POST a uložením indexu: index kola karty bez řádku a bez záznamu zápisu. */
  function dropIndexRow(id: string) {
    const f = path.join(dir, "panel-index.json");
    const all = JSON.parse(fs.readFileSync(f, "utf8")) as Record<
      string,
      string
    >;
    delete all[id];
    delete all[`written:${id}`];
    fs.writeFileSync(f, JSON.stringify(all));
  }

  /**
   * Receipt nese skutečné (hex) ID stránky; testovací panel čísluje „pageN“, které `pageIdFromUrl` nepřečte. Řádek page2
   * se proto přesune pod hex ID a receipt journalu na něj ukáže (jako u skutečného POST).
   */
  const HEX2 = "2".padStart(32, "0");
  function receiptRowToHex(panel: Panel, id: string) {
    panel.pages.set(HEX2, panel.page("page2"));
    panel.pages.delete("page2");
    const f = path.join(dir, id, "effects", "panel-row-r1.json");
    const rec = JSON.parse(fs.readFileSync(f, "utf8")) as Record<
      string,
      unknown
    >;
    fs.writeFileSync(f, JSON.stringify({ ...rec, receipt: rowReceipt(HEX2) }));
  }

  /** Nový řádek kola 2 (page3) s aktuální kartou; starý řádek vyřazený a označený SUPERSEDED; REJECT na page3 se přijme. */
  async function expectNewRow(
    o: Orchestrator,
    panel: Panel,
    id: string,
    card: string,
    old = "page2",
  ) {
    expect(store.load(id).meta.owner_go).toBeUndefined();
    expect(store.load(id).state).toBe("WAITING_OWNER");
    expect(new PanelIndex(dir).tainted(id)).toContain(old);
    expect(store.load(id).meta.reissue_round).toBe("2");
    expect(new PanelIndex(dir).current(id, 2)).toBe("page3");
    expect(panel.page("page3").row["Karta rozhodnutí"]).toBe(card);
    expect(panel.page("page3").decision).toBeUndefined();
    expect(panel.page(old).row.Stav).toBe(SUPERSEDED_STATE);
    panel.page("page3").decision = "REJECT";
    await o.pollOwnerDecisions();
    expect(store.load(id).state).toBe("FAILED");
    for (const w of panel.writes)
      expect(Object.keys(w.row)).not.toContain(OWNER_DECISION_PROPERTY); // P20
  }

  it("bod 1: řádek obnovený z receiptu (pád před indexem), mezitím stará karta a GO → GO se nepřijme, řádek se vyřadí, nový řádek", async () => {
    const { panel, id, oldCard, card } = await reissued();
    expect(rowEffect(id)).toMatchObject({
      state: "EFFECT_DONE",
      receipt: rowReceipt("page2"),
    });
    dropIndexRow(id);
    receiptRowToHex(panel, id);
    const p2 = panel.page(HEX2);
    panel.land(HEX2, { ...p2.row, "Karta rozhodnutí": oldCard }); // cizí zápis staré karty
    p2.decision = "GO"; // vlastník nad starou kartou
    const restarted = build(panel, new Store(dir));
    await restarted.o.pollOwnerDecisions();
    await restarted.o.pollOwnerDecisions();
    expect(
      log().some(
        (e) =>
          e.order === id &&
          /řádek panelu 0+2 je neplatný/.test(e.result ?? "") &&
          /jinou kartu/.test(e.reason ?? ""),
      ),
    ).toBe(true);
    await expectNewRow(restarted.o, panel, id, card, HEX2);
  });

  it("bod 1: řádek z receiptu ukazuje aktuální kartu, ale už nese GO (karta od vydání neprokázaná) → nepřijme se, nový řádek", async () => {
    const { panel, id, card } = await reissued();
    dropIndexRow(id);
    receiptRowToHex(panel, id);
    panel.page(HEX2).decision = "GO";
    const restarted = build(panel, new Store(dir));
    await restarted.o.pollOwnerDecisions();
    await restarted.o.pollOwnerDecisions();
    expect(
      log().some(
        (e) => e.order === id && /receiptu journalu/.test(e.reason ?? ""),
      ),
    ).toBe(true);
    await expectNewRow(restarted.o, panel, id, card, HEX2);
  });

  it("bod 1: řádek z dohledání (pád před indexem) ukazuje aktuální kartu, ale už nese GO → nepřijme se, nový řádek", async () => {
    const { panel, id, card } = await reissued();
    dropIndexRow(id);
    panel.page("page2").decision = "GO";
    const restarted = build(panel, new Store(dir));
    await restarted.o.pollOwnerDecisions();
    await restarted.o.pollOwnerDecisions();
    // receipt „pageN“ testovacího panelu nejde přečíst → řádek se dohledá podle ID zakázky a karty
    expect(
      log().some(
        (e) => e.order === id && /řádek z dohledání\)/.test(e.reason ?? ""),
      ),
    ).toBe(true);
    await expectNewRow(restarted.o, panel, id, card);
  });

  it("bod 1: cizí zápis staré karty a GO v okně mezi čtením řádku a PATCH → GO se nepřijme, nový řádek", async () => {
    const { o, panel, id, oldCard, card } = await reissued();
    const p2 = panel.page("page2");
    const orig = panel.upsert.bind(panel);
    let armed = true;
    panel.upsert = async (row, page) => {
      if (page === "page2" && armed) {
        armed = false; // čtení před zápisem už proběhlo a ukázalo aktuální kartu bez rozhodnutí
        panel.land("page2", { ...p2.row, "Karta rozhodnutí": oldCard });
        p2.decision = "GO";
      }
      return orig(row, page); // náš PATCH odkaz „opraví“ a GO by zůstalo
    };
    await o.resyncPanel(id);
    await o.pollOwnerDecisions();
    await o.pollOwnerDecisions();
    await expectNewRow(o, panel, id, card);
  });

  it("bod 2: pád mezi zvýšením kola řádku a vyřazením v indexu → po restartu se vyřazení dokončí podle journalu, jeden platný řádek", async () => {
    const { o, panel, id, oldCard, card } = await reissued();
    const f = path.join(dir, "panel-index.json");
    const all = JSON.parse(fs.readFileSync(f, "utf8")) as Record<
      string,
      string
    >;
    // Poslední zápis pod zámkem nesl starou kartu, řádek ukazuje aktuální → vyřazení řádku.
    all[`written:${id}`] = JSON.stringify({
      row: "page2",
      round: 1,
      card: oldCard,
      fence: 1,
    });
    fs.writeFileSync(f, JSON.stringify(all));
    panel.page("page2").decision = "REJECT";
    let crashed = 0;
    vi.spyOn(PanelIndex.prototype, "retire").mockImplementation(() => {
      crashed++;
      throw new Error("SIGKILL: proces ukončen uprostřed vyřazení řádku");
    });
    await o.pollOwnerDecisions();
    expect(crashed).toBe(1);
    expect(store.load(id).meta.reissue_round).toBe("2"); // stav už v novém kole
    expect(new PanelIndex(dir).superseded(id)).not.toContain("page2"); // index ještě ne
    vi.restoreAllMocks();
    const restarted = build(panel, new Store(dir));
    await restarted.o.pollOwnerDecisions();
    await restarted.o.pollOwnerDecisions();
    expect(new PanelIndex(dir).superseded(id)).toContain("page2");
    expect(
      new EffectJournal(dir).get(operationId(id, "row-invalidate", 1)),
    ).toMatchObject({ state: "EFFECT_DONE", subject: "page2" });
    expect(store.load(id).state).toBe("WAITING_OWNER"); // REJECT ze znehodnoceného řádku nepřijat
    await expectNewRow(restarted.o, panel, id, card);
  });

  it("bod 2: pád po záznamu v journalu, před zvýšením kola řádku → po restartu se vyřazení dokončí, jeden platný řádek", async () => {
    const { o, panel, id, oldCard, card } = await reissued();
    const p2 = panel.page("page2");
    panel.land("page2", { ...p2.row, "Karta rozhodnutí": oldCard });
    const real = Store.prototype.save;
    let crashed = 0;
    vi.spyOn(Store.prototype, "save").mockImplementation(function (
      this: Store,
      x: Order,
    ) {
      if (x.meta.row_invalidated_at && crashed++ === 0)
        throw new Error("SIGKILL: proces ukončen před zápisem stavu");
      return real.call(this, x);
    });
    await o.pollOwnerDecisions();
    expect(crashed).toBe(1);
    expect(store.load(id).meta.reissue_round).toBe("1");
    expect(
      new EffectJournal(dir).get(operationId(id, "row-invalidate", 1)),
    ).toMatchObject({ state: "PREPARED", subject: "page2" });
    vi.restoreAllMocks();
    const restarted = build(panel, new Store(dir));
    await restarted.o.pollOwnerDecisions();
    await restarted.o.pollOwnerDecisions();
    await expectNewRow(restarted.o, panel, id, card);
  });

  it("bod 3: HybridPanelSink předá `unique` i MCP hledání; dva řádky z MCP = PanelRowDuplicate", async () => {
    const rest: PanelSink = {
      upsert: async () => "x",
      findRowByOrderId: async () => {
        throw new NotionRestError(503, "service_unavailable");
      },
    };
    const find = vi.fn(async (_id: string, opts?: { unique?: boolean }) => {
      if (opts?.unique) throw new PanelRowDuplicate(["pageA", "pageB"]);
      return "pageA";
    });
    const sink = new HybridPanelSink(rest, rest, () => {}, { find });
    await expect(
      sink.findRowByOrderId("wo-1", { unique: true }),
    ).rejects.toBeInstanceOf(PanelRowDuplicate);
    expect(find).toHaveBeenCalledWith("wo-1", { unique: true });
  });

  it("bod 3: dva řádky stejného kola nalezené přes MCP fallback → HOLD, žádný se nepoužije, žádný další POST", async () => {
    const panel = new Panel();
    panel.createLandsThenFails = true; // POST kola 0 dorazí, odpověď se ztratí
    panel.lookupBlind = true; // dohledání zatím nic neprokáže → EFFECT_UNKNOWN (HOLD)
    const x = build(panel);
    const r = (await x.o.tick()) as { order: string; status: string };
    const id = r.order;
    panel.lookupBlind = false;
    // Pozdě doběhl i souběžný druhý POST: dva řádky téže zakázky.
    panel.land("page9", { ...panel.page("page1").row });
    const rest: PanelSink = {
      upsert: (row, page) => panel.upsert(row, page),
      findRowByOrderId: async () => {
        throw new NotionRestError(503, "service_unavailable");
      },
    };
    const lookup = {
      find: async (orderId: string, opts?: { unique?: boolean }) =>
        panel.findRowByOrderId(orderId, { unique: opts?.unique }),
    };
    const hybrid = new HybridPanelSink(rest, rest, () => {}, lookup);
    const restarted = build(hybrid, new Store(dir));
    new PanelIndex(dir).markDirty(id);
    clock = new Date(Date.parse(clock) + 20 * 60_000).toISOString();
    await restarted.o.resyncPanel(id);
    expect(new PanelIndex(dir).get(id)).toBeUndefined();
    expect(panel.creates).toBe(1);
    expect(
      log().some(
        (e) =>
          e.order === id &&
          /dva řádky stejného kola 0 \(page1, page9\).*konflikt řeší Fable/.test(
            e.result ?? "",
          ),
      ),
    ).toBe(true);
  });

  it("bod 3: POST řádku přes MCP fallback s nejasným výsledkem, REST dohledání nedostupné → HOLD s logem, MCP hledání ani další POST", async () => {
    const panel = new Panel();
    let mcpCreates = 0;
    let lookups = 0;
    const rest: PanelSink = {
      upsert: async (row, page) => {
        if (!page) throw new NotionRestError(429, "rate_limited"); // REST odmítne před zápisem → fallback
        return panel.upsert(row, page);
      },
      findRowByOrderId: async () => {
        throw new NotionRestError(503, "service_unavailable");
      },
      readOwnerDecision: (p) => panel.readOwnerDecision(p),
    };
    const mcp: PanelSink = {
      upsert: async (row, page) => {
        if (page) return panel.upsert(row, page);
        mcpCreates++;
        panel.land(`page${++panel.creates}`, row); // řádek vznikl …
        throw new Error("claude -p: proces ukončen (timeout)"); // … ale výsledek nevíme
      },
    };
    const lookup = {
      find: async (orderId: string, opts?: { unique?: boolean }) => {
        lookups++;
        return panel.findRowByOrderId(orderId, { unique: opts?.unique });
      },
    };
    const x = build(new HybridPanelSink(rest, mcp, () => {}, lookup));
    const r = (await x.o.tick()) as { order: string };
    await x.o.flushPanel();
    const id = r.order;
    expect(mcpCreates).toBe(1);
    expect(lookups).toBe(0); // zpožděné MCP hledání se po POST přes MCP neptá
    expect(new EffectJournal(dir).get(rowOp(id, 0))).toMatchObject({
      transport: "mcp",
      state: "EFFECT_UNKNOWN",
      attempts: 1,
    });
    expect(
      log().some(
        (e) =>
          e.order === id &&
          /přes MCP fallback s nejasným výsledkem.*další POST se neposílá/.test(
            e.result ?? "",
          ),
      ),
    ).toBe(true);
    expect(new PanelIndex(dir).get(id)).toBeUndefined();
  });
});

describe("opravný PR „panel“, kolo 3 (Codex review kolo 2)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("bod 1: uložené GO, read-back selže, vlastník během PATCH změní GO na REJECT → řádek se vyřadí, staré GO se do nového kola nepřenese, DONE nenastane", async () => {
    const { o, notion, panel, id, card } = await reissued();
    const p2 = panel.page("page2");
    p2.decision = "GO";
    notion.readFails = true; // read-back selže: zakázka zůstane WAITING_OWNER s uloženým GO
    const orig = panel.upsert.bind(panel);
    let armed = true;
    panel.upsert = async (row, page) => {
      if (page === "page2" && armed && store.load(id).meta.owner_go) {
        armed = false; // panel-sync už přečetl řádek s GO; vlastník teď (během PATCH) změní GO na REJECT
        p2.decision = "REJECT";
      }
      return orig(row, page);
    };
    // Poll přijme GO (uloží owner_go), read-back selže; panel-sync po přijetí: čtení (GO) → PATCH (vlastník mezitím
    // REJECT) → čtení po PATCH.
    await o.pollOwnerDecisions();
    await o.flushPanel();
    expect(armed).toBe(false);
    expect(store.load(id).state).toBe("WAITING_OWNER");
    expect(
      log().some(
        (e) =>
          e.order === id &&
          /rozhodnutí REJECT vzniklo v okně zápisu řádku/.test(e.reason ?? ""),
      ),
    ).toBe(true);
    notion.readFails = false; // read-back by teď prošel
    await o.pollOwnerDecisions();
    await o.pollOwnerDecisions();
    const w = store.load(id);
    expect(w.state).toBe("WAITING_OWNER"); // nikdy DONE podle starého GO
    expect(w.meta.owner_go).toBeUndefined();
    expect(w.meta.owner_go_source).toBeUndefined();
    expect(
      log().some(
        (e) =>
          e.order === id &&
          /uložené GO .* z vyřazeného řádku zrušeno/.test(e.result ?? ""),
      ),
    ).toBe(true);
    await expectNewRowR2(o, panel, id, card);
  });

  /** Nový řádek kola 2 (page3) s aktuální kartou a prázdným rozhodnutím; REJECT na něm → FAILED. */
  async function expectNewRowR2(
    o: Orchestrator,
    panel: Panel,
    id: string,
    card: string,
  ) {
    expect(store.load(id).meta.reissue_round).toBe("2");
    expect(new PanelIndex(dir).current(id, 2)).toBe("page3");
    expect(panel.page("page3").row["Karta rozhodnutí"]).toBe(card);
    expect(panel.page("page3").decision).toBeUndefined();
    expect(panel.page("page2").row.Stav).toBe(SUPERSEDED_STATE);
    panel.page("page3").decision = "REJECT";
    await o.pollOwnerDecisions();
    expect(store.load(id).state).toBe("FAILED");
    for (const w of panel.writes)
      expect(Object.keys(w.row)).not.toContain(OWNER_DECISION_PROPERTY); // P20
  }

  /**
   * REST vytvoření čistě odmítne (401), REST dohledání nedostupné (503), MCP hledání nic nenajde (zpožděný index).
   * `blockLocks` = kolik dalších `.state.lock` po odmítnutí REST vyprší (souběžný držitel zámku).
   */
  function mcpSetup(blockLocks: number) {
    const panel = new Panel();
    let mcpCreates = 0;
    let restRefusals = 0;
    let block = 0;
    const real = Store.prototype.withStateLock;
    vi.spyOn(Store.prototype, "withStateLock").mockImplementation(function <T>(
      this: Store,
      fn: () => T,
      waitMs?: number,
    ): T {
      if (block > 0) {
        block--;
        throw new Error(
          "stav zakázky právě mění jiný proces (zámek .state.lock, HOLD), zkus to za chvíli",
        );
      }
      return real.call(this, fn, waitMs) as T;
    });
    const rest: PanelSink = {
      upsert: async (row, page) => {
        if (!page) {
          restRefusals++;
          block = restRefusals === 1 ? blockLocks : 0; // jen u prvního pokusu je zámek obsazený
          throw new NotionRestError(401, "unauthorized"); // čisté odmítnutí před zápisem → fallback
        }
        return panel.upsert(row, page);
      },
      findRowByOrderId: async () => {
        throw new NotionRestError(503, "service_unavailable");
      },
      readOwnerDecision: (p) => panel.readOwnerDecision(p),
    };
    const mcp: PanelSink = {
      upsert: async (row, page) => {
        if (!page) mcpCreates++;
        return panel.upsert(row, page);
      },
    };
    const lookup = {
      find: async (orderId: string, opts?: { unique?: boolean }) => {
        void orderId;
        void opts;
        return undefined; // index MCP hledání je zpožděný
      },
    };
    const x = build(new HybridPanelSink(rest, mcp, () => {}, lookup));
    return {
      ...x,
      panel,
      mcpCreates: () => mcpCreates,
      restRefusals: () => restRefusals,
    };
  }

  async function expectCreatedOnce(x: ReturnType<typeof mcpSetup>, id: string) {
    new PanelIndex(dir).markDirty(id);
    clock = new Date(Date.parse(clock) + 20 * 60_000).toISOString();
    await x.o.resyncPanel(id);
    // První pokus: REST odmítl, záznam transportu nezískal zámek → MCP se nezavolalo, chyba nese „neodešlo“.
    expect(x.restRefusals()).toBe(2);
    expect(
      log().some(
        (e) =>
          e.order === id &&
          e.result === "panel sync failed" &&
          /MCP vytvoření neodešlo/.test(e.reason ?? ""),
      ),
    ).toBe(true);
    expect(x.mcpCreates()).toBe(1); // první pokus MCP nevolal, druhý řádek vytvořil
    expect(x.panel.creates).toBe(1);
    expect(new PanelIndex(dir).get(id)).toBe("page1");
    expect(new EffectJournal(dir).get(rowOp(id, 0))).toMatchObject({
      state: "EFFECT_DONE",
      transport: "mcp",
      attempts: 2,
    });
    expect(
      log().some(
        (e) => e.order === id && /EFFECT_UNKNOWN \/ HOLD/.test(e.result ?? ""),
      ),
    ).toBe(false);
  }

  it("bod 2: po PREPARED REST odmítne (401) a záznam transportu MCP nezíská `.state.lock` → MCP neodejde, EFFECT_ABSENT, další sync řádek vytvoří (žádný HOLD)", async () => {
    const x = mcpSetup(1);
    const r = (await x.o.tick()) as { order: string };
    await x.o.flushPanel();
    await expectCreatedOnce(x, r.order);
  });

  it("bod 2: zámek nedostupný i pro zápis EFFECT_ABSENT → zůstane PREPARED, další sync ho doplní z paměti procesu a řádek vytvoří jednou (žádný HOLD)", async () => {
    const x = mcpSetup(2);
    const r = (await x.o.tick()) as { order: string };
    await x.o.flushPanel();
    await expectCreatedOnce(x, r.order);
  });
});
