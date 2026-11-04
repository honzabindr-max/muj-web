// Znovuvydání karty pro zakázky bez otisku (`cli.ts reissue`) a přijetí GO až po znovuvydání. Žádný model se nevolá.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import type { AdapterResult, TextAdapter } from "../adapters";
import { artifactHash, decisionFresh } from "../approval";
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
import { Orchestrator, SecretScanningAdapter } from "../orchestrator";
import {
  PanelIndex,
  RestPanelSink,
  type OwnerRow,
  type PanelRow,
  type PanelSink,
} from "../panel";
import { SourceLoader } from "../sources";
import { transition, TransitionError } from "../state-machine";
import { Store } from "../store";
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

/** Panel s rozhodnutím vlastníka a časem poslední změny řádku (oboje nastavuje jen test). */
class Panel implements PanelSink {
  rows: PanelRow[] = [];
  decision: string | undefined;
  lastEdited: string | undefined;
  failUpsert = false;
  /** Jednorázové zdržení zápisu (souběžný `cli.ts panel-sync` se zpožděným PATCH); `holding` = zápis čeká. */
  hold: Promise<void> | undefined;
  holding = false;
  /** Volá se hned poté, co zápis dorazil do Notionu (před odpovědí). */
  onLanded: (() => void) | undefined;
  /** Odkaz karty, který řádek ukazuje, když ho test přepíše (jinak z posledního zápisu). */
  cardOverride: string | null | undefined;
  async upsert(row: PanelRow, page?: string) {
    if (this.hold) {
      const h = this.hold;
      this.hold = undefined;
      this.holding = true;
      await h;
      this.holding = false;
    }
    if (this.failUpsert) throw new Error("notion 502");
    this.rows.push(row);
    this.onLanded?.();
    return page ?? "page1";
  }
  async readOwnerDecision() {
    return this.decision;
  }
  /** false = řádek v koši nebo bez sloupce „Rozhodnutí vlastníka“ (prázdná hodnota pak nic neznamená). */
  readable = true;
  async readOwnerRow(): Promise<OwnerRow> {
    return {
      decision: this.readable ? this.decision : undefined,
      last_edited_time: this.lastEdited,
      readable: this.readable,
      card:
        this.cardOverride !== undefined
          ? this.cardOverride
          : (this.rows.at(-1)?.["Karta rozhodnutí"] ?? null),
    };
  }
}

let dir: string;
let store: Store;
let clock: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-reissue-"));
  store = new Store(dir);
  clock = "2026-11-03T22:39:02.000Z";
});

function build(panel: Panel = new Panel(), st: Store = store) {
  const notion = new Notion();
  const o = new Orchestrator({
    store: st,
    supervisor: new Mock("claude", "opus", BRIEF),
    briefChecker: new Mock("gpt", "gpt-brief", PASS),
    departments: {
      copy: new CopyDepartment(
        new SecretScanningAdapter(new Mock("gpt", "gpt", DRAFT)),
        new Mock("claude", "opus", PASS),
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
    panel: { sink: panel, index: new PanelIndex(dir) },
    sources: new SourceLoader(notion, dir, path.join(dir, "sources-cache")),
  });
  return { o, notion, panel };
}

/** Zakázka jako wo-20261103-223902: WAITING_OWNER s kartou ve staré verzi (bez approved_hash/artifact_hash) a starým GO. */
async function oldCardOrder(panel = new Panel()) {
  const x = build(panel);
  const r = (await x.o.tick()) as { order: string; status: string };
  expect(r.status).toBe("waiting_owner");
  const cur = store.load(r.order);
  const meta = { ...cur.meta };
  delete meta.approved_hash;
  delete meta.artifact_hash;
  store.save({ ...cur, meta: { ...meta, owner_ping: "1" } });
  return { ...x, id: r.order };
}

const log = () => store.readLog(500);

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
    // Ani stavový automat přechod jinde nepustí.
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

  it("reissue → DELIVERED (reissued_at, owner-pole a stará karta pryč, log) → tick vydá novou kartu s otiskem", async () => {
    const { o, notion, id } = await oldCardOrder();
    const oldCard = store.load(id).owner_card_url;
    expect(oldCard).toBeTruthy();
    clock = "2026-11-04T08:40:00.000Z";
    const r = await o.reissue(id);
    expect(r.state).toBe("DELIVERED");
    const s = store.load(id);
    expect(s.state).toBe("DELIVERED");
    expect(s.meta.reissued_at).toBe(clock);
    // Hodnota v panelu se při znovuvydání nečte (žádný snímek před zápisem karty).
    expect(Object.keys(s.meta).filter((k) => k.startsWith("reissue_"))).toEqual(
      [],
    );
    expect(Object.keys(s.meta).filter((k) => k.startsWith("owner_"))).toEqual(
      [],
    );
    expect(s.owner_card_url).toBeUndefined();
    expect(s.delivered_url).toBeTruthy(); // výstup se znovu nedoručuje
    expect(
      log().some(
        (e) =>
          e.order === id &&
          e.kind === "info" &&
          e.result === "karta znovuvydána",
      ),
    ).toBe(true);
    expect(s.manual_interventions).toBe(0);

    clock = "2026-11-04T08:45:00.000Z";
    const t = (await o.tick()) as { status: string; order: string };
    expect(t).toMatchObject({ status: "waiting_owner", order: id });
    const w = store.load(id);
    expect(w.state).toBe("WAITING_OWNER");
    const seen = artifactHash(notion.pages[0].md);
    expect(w.meta.approved_hash).toBe(seen);
    expect(w.meta.artifact_hash).toBe(seen);
    expect(w.owner_card_url).toBeTruthy();
    expect(w.owner_card_url).not.toBe(oldCard);
    expect(notion.pages.at(-1)!.title).toMatch(/^KARTA GO\/REJECT/);
    expect(notion.pages.at(-1)!.md).toContain(seen.slice(0, 16));
  });
});

describe("GO po znovuvydání karty: jen nové, s read-backem", () => {
  async function reissued() {
    const panel = new Panel();
    const x = await oldCardOrder(panel);
    // Vlastník dal GO na starou kartu (8:31); orchestrátor ho správně odmítl.
    panel.decision = "GO";
    panel.lastEdited = "2026-11-04T08:31:00.000Z";
    clock = "2026-11-04T08:32:00.000Z";
    await x.o.pollOwnerDecisions();
    expect(store.load(x.id).meta.owner_go).toBeUndefined();
    expect(
      log().some((e) =>
        /GO nepřijato.*chybí approved_hash/.test(e.result ?? ""),
      ),
    ).toBe(true);
    clock = "2026-11-04T08:40:00.000Z";
    await x.o.reissue(x.id);
    await x.o.flushPanel();
    clock = "2026-11-04T08:45:00.000Z";
    await x.o.tick(); // nová karta s otiskem, zápis řádku v 8:45
    const w = store.load(x.id);
    expect(w.state).toBe("WAITING_OWNER");
    expect(w.meta.approved_hash).toBeTruthy();
    // Výchozí hodnota přečtená hned po zápisu nové karty (staré GO), vázaná na tuto kartu.
    expect(w.meta.reissue_seen).toBe("GO");
    expect(w.meta.reissue_seen_card).toBe(w.owner_card_url);
    clock = "2026-11-04T08:50:00.000Z";
    return x;
  }
  const WAIT = /nepřijato \(Notion GO\): čeká na nové GO po znovuvydání karty/;

  it("staré GO v panelu (last_edited před reissued_at) se nepřijme, zakázka čeká", async () => {
    const { o, panel, id } = await reissued();
    expect(panel.lastEdited).toBe("2026-11-04T08:31:00.000Z");
    const r = await o.tick();
    expect(r).toMatchObject({ status: "waiting_owner", order: id });
    expect(store.load(id).state).toBe("WAITING_OWNER");
    expect(store.load(id).meta.owner_go).toBeUndefined();
    expect(log().some((e) => e.order === id && WAIT.test(e.result ?? ""))).toBe(
      true,
    );
  });

  it("změna řádku po reissued_at, ale jen vlastním zápisem orchestrátoru (před ním), se za nové GO nepočítá", async () => {
    const { o, panel, id } = await reissued();
    panel.decision = "GO A"; // nová hodnota: rozhoduje jen čas
    for (const t of ["08:44", "08:45", "08:46", "08:47"]) {
      // před vlastním zápisem (8:45), přesně na něm, nebo v rezervě 2 min po něm
      panel.lastEdited = `2026-11-04T${t}:00.000Z`;
      await o.pollOwnerDecisions();
      expect(store.load(id).meta.owner_go, t).toBeUndefined();
    }
    panel.lastEdited = "2026-11-04T08:48:00.000Z";
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.owner_go).toBe(clock);
  });

  it("stejná hodnota jako před znovuvydáním (GO) s čerstvým časem se nepřijme; po vymazání pole a novém GO ano", async () => {
    const { o, panel, id } = await reissued();
    panel.lastEdited = "2026-11-04T08:49:00.000Z"; // čas se posunul (např. cizí nebo vlastní zápis jiného sloupce)
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.owner_go).toBeUndefined();
    expect(
      log().some(
        (e) =>
          e.order === id &&
          WAIT.test(e.result ?? "") &&
          /nezměnilo/.test(e.reason ?? ""),
      ),
    ).toBe(true);
    panel.decision = undefined; // vlastník pole smazal
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.reissue_seen).toBe("");
    panel.decision = "GO";
    clock = "2026-11-04T08:53:00.000Z";
    panel.lastEdited = "2026-11-04T08:52:00.000Z";
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.owner_go).toBe(clock);
  });

  it("výchozí hodnotu po zápisu karty nešlo přečíst → první pozorování v pollu je jen výchozí hodnota; přijme se až změna", async () => {
    const panel = new Panel();
    const x = await oldCardOrder(panel);
    panel.decision = "GO";
    const read = panel.readOwnerRow.bind(panel);
    panel.readOwnerRow = async () => {
      throw new Error("notion 502");
    };
    clock = "2026-11-04T08:40:00.000Z";
    await x.o.reissue(x.id);
    clock = "2026-11-04T08:45:00.000Z";
    await x.o.tick();
    expect(store.load(x.id).meta.reissue_seen_card).toBeUndefined();
    panel.readOwnerRow = read;
    clock = "2026-11-04T08:50:00.000Z";
    panel.decision = "GO A";
    panel.lastEdited = "2026-11-04T08:49:00.000Z";
    await x.o.pollOwnerDecisions();
    expect(store.load(x.id).meta.owner_go).toBeUndefined();
    panel.decision = undefined;
    await x.o.pollOwnerDecisions();
    panel.decision = "GO";
    await x.o.pollOwnerDecisions();
    expect(store.load(x.id).meta.owner_go).toBe(clock);
  });

  it("řádek v koši (nebo bez sloupce) při znovuvydání ani potom nic neznamená: stará hodnota „?“, žádné aktivování; obnovený řádek se starým GO neprojde", async () => {
    const panel = new Panel();
    const x = await oldCardOrder(panel);
    panel.decision = "GO"; // staré GO na řádku
    panel.readable = false; // řádek je zrovna v koši
    clock = "2026-11-04T08:40:00.000Z";
    await x.o.reissue(x.id);
    clock = "2026-11-04T08:45:00.000Z";
    await x.o.tick();
    clock = "2026-11-04T08:50:00.000Z";
    await x.o.pollOwnerDecisions(); // čte se „prázdno“ z koše
    expect(store.load(x.id).meta.reissue_seen_card).toBeUndefined();
    panel.readable = true; // řádek obnoven se starým GO, čas změny je nový
    panel.lastEdited = "2026-11-04T08:49:00.000Z";
    await x.o.pollOwnerDecisions();
    expect(store.load(x.id).meta.owner_go).toBeUndefined();
    expect(store.load(x.id).state).toBe("WAITING_OWNER");
  });

  it("vlastní zápis řádku, který selže (Notion ho mohl uložit), posune hranici také", async () => {
    const panel = new Panel();
    const x = await oldCardOrder(panel);
    clock = "2026-11-04T08:40:00.000Z";
    await x.o.reissue(x.id);
    await x.o.flushPanel();
    panel.failUpsert = true;
    clock = "2026-11-04T08:45:00.000Z";
    await x.o.tick();
    expect(store.load(x.id).state).toBe("WAITING_OWNER");
    expect(
      log().some((e) => e.order === x.id && e.result === "panel sync failed"),
    ).toBe(true);
    expect(new PanelIndex(dir).writtenAt(x.id)).toBe(
      "2026-11-04T08:45:00.000Z",
    );
    panel.failUpsert = false;
    clock = "2026-11-04T08:50:00.000Z";
    panel.decision = "GO";
    panel.lastEdited = "2026-11-04T08:46:00.000Z"; // jen důsledek nejasného zápisu
    await x.o.pollOwnerDecisions();
    expect(store.load(x.id).meta.owner_go).toBeUndefined();
  });

  it("neznámý last_edited (chybí čas nebo sink bez readOwnerRow) → nepřijato, čeká", async () => {
    const { o, panel, id } = await reissued();
    panel.decision = "GO A"; // nová hodnota: rozhoduje jen čas
    panel.lastEdited = undefined;
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.owner_go).toBeUndefined();
    panel.lastEdited = "není čas";
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.owner_go).toBeUndefined();
    // Sink, který umí jen hodnotu bez času (žádný readOwnerRow).
    (panel as Partial<Panel>).readOwnerRow = undefined;
    panel.lastEdited = "2026-11-04T08:49:00.000Z";
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.owner_go).toBeUndefined();
    expect(store.load(id).state).toBe("WAITING_OWNER");
  });

  it("nové GO (po reissued_at i po vlastním zápisu) → zaznamenáno, DONE až po read-backu", async () => {
    const { o, panel, notion, id } = await reissued();
    panel.decision = "GO A";
    panel.lastEdited = "2026-11-04T08:49:00.000Z";
    notion.readFails = true;
    await o.tick();
    let s = store.load(id);
    expect(s.state).toBe("WAITING_OWNER");
    expect(s.meta.owner_go).toBe(clock);
    expect(s.meta.readback).toBeUndefined();
    notion.readFails = false;
    clock = "2026-11-04T08:55:00.000Z";
    await o.tick();
    s = store.load(id);
    expect(s.state).toBe("DONE");
    expect(s.meta.owner_option).toBe("A");
    expect(JSON.parse(s.meta.readback).hash).toBe(s.meta.approved_hash);
  });

  it("staré REJECT v panelu po znovuvydání také neplatí", async () => {
    const { o, panel, id } = await reissued();
    panel.decision = "REJECT";
    await o.pollOwnerDecisions();
    expect(store.load(id).state).toBe("WAITING_OWNER");
  });

  it("programové owner(): rozhodnutí v čase ≤ reissued_at se nepřijme, pozdější ano (a DONE až po read-backu)", async () => {
    const { o, id } = await reissued();
    clock = store.load(id).meta.reissued_at;
    expect(o.owner(id, "GO").meta.owner_go).toBeUndefined();
    expect(
      log().some((e) =>
        /nepřijato \(owner GO\): čeká na nové GO po znovuvydání karty/.test(
          e.result ?? "",
        ),
      ),
    ).toBe(true);
    clock = "2026-11-04T08:51:00.000Z";
    const go = o.owner(id, "GO");
    expect(go.state).toBe("WAITING_OWNER");
    expect(go.meta.owner_go).toBe(clock);
    await o.verifyApprovals();
    expect(store.load(id).state).toBe("DONE");
  });
});

describe("decisionFresh a RestPanelSink.readOwnerRow", () => {
  it("decisionFresh: jen čas striktně po reissued_at a po vlastním zápisu; neznámý čas = false", () => {
    const at = "2026-11-04T08:40:00.000Z";
    expect(decisionFresh(at, "2026-11-04T08:43:00.000Z")).toBe(true);
    expect(decisionFresh(at, "2026-11-04T08:42:00.000Z")).toBe(false); // v rezervě CLOCK_MARGIN_MS
    expect(decisionFresh(at, at)).toBe(false);
    expect(decisionFresh(at, "2026-11-04T08:31:00.000Z")).toBe(false);
    expect(decisionFresh(at, undefined)).toBe(false);
    expect(decisionFresh(at, "nesmysl")).toBe(false);
    expect(decisionFresh("nesmysl", "2026-11-04T08:41:00.000Z")).toBe(false);
    expect(
      decisionFresh(at, "2026-11-04T08:41:00.000Z", "2026-11-04T08:45:00.000Z"),
    ).toBe(false);
    expect(
      decisionFresh(at, "2026-11-04T08:47:00.000Z", "2026-11-04T08:45:00.000Z"),
    ).toBe(false);
    expect(
      decisionFresh(at, "2026-11-04T08:48:00.000Z", "2026-11-04T08:45:00.000Z"),
    ).toBe(true);
  });

  it("RestPanelSink.readOwnerRow vrátí hodnotu i last_edited_time; řádek v koši = nic", async () => {
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
        last_edited_time: "2026-11-04T08:49:00.000Z",
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
    // Sloupec chybí (přejmenovaný): prázdná hodnota není „prázdné pole“.
    expect(await sink.readOwnerRow("d")).toEqual({
      decision: undefined,
      last_edited_time: undefined,
      readable: false,
    });
    expect(await sink.readOwnerDecision("a")).toBe("GO");
  });
});

describe("kolo oprav 3: rozhodnutí jen z nové karty", () => {
  it.each(["GO", "REJECT"])(
    "nález 1: ťuknutí %s na starou kartu těsně před uložením reissue + pozdější úprava jiného sloupce → nepřijato",
    async (tap) => {
      const panel = new Panel();
      const x = await oldCardOrder(panel);
      expect(panel.decision).toBeUndefined(); // pole je prázdné, když reissue začíná
      // Vlastník vybere rozhodnutí na staré kartě až ve chvíli, kdy se ukládá znovuvydání (po případném čtení panelu).
      const save = store.save.bind(store);
      let tapped = false;
      store.save = (o: Order) => {
        if (o.meta.reissued_at && !tapped) {
          tapped = true;
          panel.decision = tap;
          panel.lastEdited = clock;
        }
        return save(o);
      };
      clock = "2026-11-04T08:40:00.000Z";
      await x.o.reissue(x.id);
      expect(tapped).toBe(true);
      clock = "2026-11-04T08:45:00.000Z";
      await x.o.tick(); // nová karta s otiskem
      panel.lastEdited = "2026-11-04T08:50:00.000Z"; // někdo upravil jiný sloupec řádku
      clock = "2026-11-04T08:53:00.000Z";
      await x.o.tick();
      const s = store.load(x.id);
      expect(s.state).toBe("WAITING_OWNER");
      expect(s.meta.owner_go).toBeUndefined();
      // Výchozí hodnota přečtená po zápisu nové karty obsahuje ťuknutí na starou kartu.
      expect(s.meta.reissue_seen).toBe(tap);
      // Až skutečná změna na nové kartě platí.
      panel.decision = tap === "GO" ? "GO A" : "GO";
      panel.lastEdited = "2026-11-04T08:56:00.000Z";
      clock = "2026-11-04T08:57:00.000Z";
      await x.o.pollOwnerDecisions();
      expect(store.load(x.id).meta.owner_go).toBe(clock);
    },
  );

  /** Zakázka se starou kartou, souběžný panel-sync (druhý proces) se zdrženým PATCH, reissue a tick s novou kartou. */
  async function delayedPanelSync() {
    const panel = new Panel();
    const x = await oldCardOrder(panel);
    panel.decision = "GO"; // staré GO na staré kartě
    panel.lastEdited = "2026-11-04T08:31:00.000Z";
    const oldCard = store.load(x.id).owner_card_url!;
    let release!: () => void;
    panel.hold = new Promise<void>((r) => (release = r));
    clock = "2026-11-04T08:39:30.000Z"; // panel-sync začne těsně před znovuvydáním
    const cli = build(panel, new Store(dir)); // `cli.ts panel-sync <id>` jako samostatný proces
    const synced = cli.o.resyncPanel(x.id);
    while (!panel.holding) await new Promise((r) => setImmediate(r));
    clock = "2026-11-04T08:40:00.000Z";
    await x.o.reissue(x.id);
    clock = "2026-11-04T08:45:00.000Z";
    await x.o.tick(); // nová karta s otiskem zapsána do řádku
    const card = store.load(x.id).owner_card_url!;
    expect(card).not.toBe(oldCard);
    expect(panel.rows.at(-1)!["Karta rozhodnutí"]).toBe(card);
    return { ...x, panel, oldCard, card, release, synced };
  }

  it("nález 2: zpožděný PATCH panel-sync přepíše kartu na starou, oprava selže → rozhodnutí na staré kartě nepřijato, řádek přepsán, zakázka čeká", async () => {
    const { o, panel, id, oldCard, card, release, synced } =
      await delayedPanelSync();
    // Během souběžného zápisu se starou kartou se výchozí hodnota nezjišťuje.
    expect(store.load(id).meta.reissue_seen_card).toBeUndefined();
    panel.onLanded = () => {
      panel.onLanded = undefined;
      panel.failUpsert = true; // oprava řádku po zpožděném zápisu selže
    };
    release();
    await synced;
    panel.failUpsert = false;
    expect(panel.rows.at(-1)!["Karta rozhodnutí"]).toBe(oldCard); // řádek ukazuje starou kartu bez otisku
    // Vlastník na staré kartě změní původní GO na GO A (po dvouminutové rezervě).
    panel.decision = "GO A";
    panel.lastEdited = "2026-11-04T08:50:00.000Z";
    clock = "2026-11-04T08:53:00.000Z";
    await o.pollOwnerDecisions();
    let s = store.load(id);
    expect(s.meta.owner_go).toBeUndefined();
    expect(s.state).toBe("WAITING_OWNER");
    expect(
      log().some(
        (e) =>
          e.order === id &&
          /není aktuální karta s otiskem/.test(e.result ?? ""),
      ),
    ).toBe(true);
    expect(panel.rows.at(-1)!["Karta rozhodnutí"]).toBe(card); // řádek přepsán aktuální kartou
    // GO A z doby staré karty je jen výchozí hodnota, ne rozhodnutí.
    expect(s.meta.reissue_seen).toBe("GO A");
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.owner_go).toBeUndefined();
    // Změna na aktuální kartě platí.
    panel.decision = "GO B";
    panel.lastEdited = "2026-11-04T08:56:00.000Z";
    clock = "2026-11-04T08:59:00.000Z";
    await o.pollOwnerDecisions();
    s = store.load(id);
    expect(s.meta.owner_go).toBe(clock);
    expect(s.meta.owner_option).toBe("B");
  });

  it("nález 2: zpožděný PATCH se starou kartou se hned po odpovědi opraví; ťuknutí mezi tím se za rozhodnutí nepočítá", async () => {
    const { o, panel, id, oldCard, card, release, synced } =
      await delayedPanelSync();
    let shown: string | null | undefined;
    panel.onLanded = () => {
      panel.onLanded = undefined;
      shown = panel.rows.at(-1)!["Karta rozhodnutí"];
      panel.decision = "GO A"; // vlastník ťukne, zatímco řádek ukazuje starou kartu
      panel.lastEdited = "2026-11-04T08:50:00.000Z";
    };
    release();
    await synced;
    expect(shown).toBe(oldCard);
    expect(panel.rows.at(-1)!["Karta rozhodnutí"]).toBe(card); // oprava: uložený stav přepsal starší data
    expect(
      log().some(
        (e) =>
          e.order === id &&
          /karta se během zápisu změnila/.test(e.result ?? ""),
      ),
    ).toBe(true);
    clock = "2026-11-04T08:53:00.000Z";
    await o.pollOwnerDecisions();
    expect(store.load(id).meta.owner_go).toBeUndefined();
    expect(store.load(id).meta.reissue_seen).toBe("GO A");
  });

  it("zápis se starou kartou, který právě běží, blokuje výchozí hodnotu i přijetí", async () => {
    const { o, panel, id, release, synced } = await delayedPanelSync();
    panel.decision = "GO A";
    panel.lastEdited = "2026-11-04T08:50:00.000Z";
    clock = "2026-11-04T08:53:00.000Z";
    await o.pollOwnerDecisions(); // řádek zatím ukazuje novou kartu, ale zápis se starou kartou neskončil
    let s = store.load(id);
    expect(s.meta.owner_go).toBeUndefined();
    expect(s.meta.reissue_seen_card).toBeUndefined();
    expect(
      log().some(
        (e) =>
          e.order === id &&
          /zápis řádku, který může ukázat jinou kartu/.test(e.reason ?? ""),
      ),
    ).toBe(true);
    release();
    await synced;
    await o.pollOwnerDecisions();
    s = store.load(id);
    expect(s.meta.owner_go).toBeUndefined();
    expect(s.meta.reissue_seen).toBe("GO A");
  });

  it("řádek ukazuje jinou kartu než aktuální → nepřijato, výchozí hodnota zahozena, řádek přepsán", async () => {
    const panel = new Panel();
    const x = await oldCardOrder(panel);
    panel.decision = "GO";
    panel.lastEdited = "2026-11-04T08:31:00.000Z";
    clock = "2026-11-04T08:40:00.000Z";
    await x.o.reissue(x.id);
    clock = "2026-11-04T08:45:00.000Z";
    await x.o.tick();
    const writes = panel.rows.length;
    panel.cardOverride = "https://app.notion.com/p/stara-karta";
    panel.decision = "GO A";
    panel.lastEdited = "2026-11-04T08:49:00.000Z";
    clock = "2026-11-04T08:50:00.000Z";
    await x.o.pollOwnerDecisions();
    const s = store.load(x.id);
    expect(s.meta.owner_go).toBeUndefined();
    expect(s.meta.reissue_seen_card).toBeUndefined(); // výchozí hodnota („GO“ z nové karty) zahozena
    expect(panel.rows.length).toBe(writes + 1);
    panel.cardOverride = undefined;
    await x.o.pollOwnerDecisions(); // první pozorování na aktuální kartě = výchozí hodnota
    expect(store.load(x.id).meta.reissue_seen).toBe("GO A");
    expect(store.load(x.id).meta.owner_go).toBeUndefined();
  });
});
