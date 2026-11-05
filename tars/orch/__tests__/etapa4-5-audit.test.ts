// Dodatek PR 5 po auditu pravidel (karta fable-q-audit-pravidel): P20 původ GO, DR-033 kontrola prostojů při ticku,
// DR-030 doplněk adaptér Codexu. Bez sítě a bez kvóty: fake panel, fake Notion, fake `codex` na PATH.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CODEX_MODEL,
  CodexCli,
  codexEffort,
  codexModelLabel,
} from "../adapters";
import { callChecker, CopyDepartment, DevDepartment } from "../departments";
import { EffectJournal, operationId } from "../effects";
import { observeScopeDecision } from "../inbox/decision";
import { scopeOp, scopeTick } from "../inbox/scope";
import { ORCHESTRATOR_ROW_ID } from "../orchestrator";
import {
  OWNER_ORIGIN_ENV,
  ownerIdFromConfig,
  OwnerOriginVerifier,
  type UserKindResolver,
} from "../owner-origin";
import {
  PanelIndex,
  type OwnerRow,
  type PanelRow,
  type PanelSink,
} from "../panel";
import { Store } from "../store";
import type { IdleStatus } from "../idle";
import {
  FileNotion,
  makeOrch,
  ORDER_ID,
  seedDelivered,
} from "./effects-fixture";
import { BOT, OWNER, PANEL_DS } from "./inbox-fake";
import { makeWorld } from "./inbox-world";

vi.setConfig({ testTimeout: 30_000 });

const OWNER_ID = "28ed872b594c813fb94f00025f08b7b6";
const BOT_ID = "b".repeat(32);
const OTHER_PERSON = "c".repeat(32);

let dir: string;
let store: Store;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-e4pr5-audit-"));
  store = new Store(dir);
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const users: UserKindResolver = async (id) => {
  if (id === OWNER_ID || id === OTHER_PERSON) return "person";
  if (id === BOT_ID) return "bot";
  throw new Error("object_not_found");
};

// ───────────────────────────── 1. P20: původ GO ─────────────────────────────

describe("P20 původ rozhodnutí: OwnerOriginVerifier (fail-closed)", () => {
  it("jen ověřený vlastník (ID z konfigurace + resolver: osoba) projde; vše ostatní HOLD OWNER_ORIGIN_UNVERIFIED", async () => {
    const v = new OwnerOriginVerifier(OWNER_ID, users);
    expect(await v.verify("28ed872b-594c-813f-b94f-00025f08b7b6")).toEqual({
      ok: true,
      editor: OWNER_ID,
    });
    for (const editor of [BOT_ID, OTHER_PERSON, undefined, "x"]) {
      expect(await v.verify(editor)).toMatchObject({
        ok: false,
        code: "OWNER_ORIGIN_UNVERIFIED",
      });
    }
    // ID vlastníka chybí v konfiguraci, resolver chybí, resolver selže nebo tvrdí bot
    expect(
      await new OwnerOriginVerifier(undefined, users).verify(OWNER_ID),
    ).toMatchObject({ ok: false });
    expect(
      await new OwnerOriginVerifier(OWNER_ID, undefined).verify(OWNER_ID),
    ).toMatchObject({ ok: false });
    expect(
      await new OwnerOriginVerifier(OWNER_ID, async () => {
        throw new Error("502");
      }).verify(OWNER_ID),
    ).toMatchObject({ ok: false });
    expect(
      await new OwnerOriginVerifier(OWNER_ID, async () => "bot").verify(
        OWNER_ID,
      ),
    ).toMatchObject({ ok: false });
  });

  it("ID vlastníka jen z konfigurace (prostředí), žádná výchozí hodnota v kódu", () => {
    expect(ownerIdFromConfig({})).toBeUndefined();
    expect(
      ownerIdFromConfig({ [OWNER_ORIGIN_ENV]: "nesmysl" }),
    ).toBeUndefined();
    expect(
      ownerIdFromConfig({
        [OWNER_ORIGIN_ENV]: "28ed872b-594c-813f-b94f-00025f08b7b6",
      }),
    ).toBe(OWNER_ID);
  });
});

/** Fake panel: řádek s rozhodnutím, autorem posledního zápisu a časem zápisu. */
class OriginPanel implements PanelSink {
  rows: Array<{ row: PanelRow; page?: string }> = [];
  decision: string | undefined;
  editor: string | undefined;
  editedAt = "2026-11-04T11:58:00.000Z";
  creates = 0;
  async readOwnerDecision() {
    return this.decision;
  }
  async readOwnerRow(): Promise<OwnerRow> {
    return {
      decision: this.decision,
      readable: true,
      last_edited_by: this.editor,
      last_edited_time: this.editedAt,
    };
  }
  async findRowByOrderId(orderId: string) {
    const r = this.rows.find((x) => x.row["ID zakázky"] === orderId);
    return r ? (r.page ?? `page-${orderId}`) : undefined;
  }
  async upsert(row: PanelRow, page?: string) {
    if (!page) this.creates++;
    this.rows.push({ row, page });
    return page ?? `page-${row["ID zakázky"]}`;
  }
}

function waitingOrder(o: { orchestratorPanelRow?: boolean } = {}) {
  seedDelivered(store, ["cena"]);
  const notion = new FileNotion(path.join(dir, "notion.jsonl"));
  const panel = new OriginPanel();
  const orch = makeOrch(store, notion, {
    panel: { sink: panel, index: new PanelIndex(dir) },
    ownerOrigin: new OwnerOriginVerifier(OWNER_ID, users),
    orchestratorPanelRow: o.orchestratorPanelRow,
  });
  return { orch, panel, notion };
}

const receipts = () => {
  const d = path.join(dir, "inbox", "decisions");
  return fs.existsSync(d)
    ? fs.readdirSync(d).filter((f) => /^[0-9a-f]{64}\.json$/.test(f))
    : [];
};
const idleStatus = (): IdleStatus =>
  JSON.parse(fs.readFileSync(path.join(dir, "idle", "status.json"), "utf8"));

describe("P20 původ rozhodnutí v orchestrátoru (fake panel)", () => {
  it("GO zapsané botem → 0 efektů (žádný receipt, žádné DONE), HOLD OWNER_ORIGIN_UNVERIFIED; GO od vlastníka → převzato v dalším ticku → DONE", async () => {
    const { orch, panel } = waitingOrder();
    await orch.step(store.load(ORDER_ID));
    expect(store.load(ORDER_ID).state).toBe("WAITING_OWNER");

    panel.decision = "GO";
    panel.editor = BOT_ID;
    const r1 = await orch.tick();
    expect(r1).toMatchObject({ status: "waiting_owner", order: ORDER_ID });
    const w = store.load(ORDER_ID);
    expect(w.state).toBe("WAITING_OWNER");
    expect(w.meta.owner_go).toBeUndefined();
    expect(w.meta.result_decision_id).toBeUndefined();
    expect(receipts()).toHaveLength(0);
    expect(
      store
        .readLog(500)
        .some((e) => /HOLD OWNER_ORIGIN_UNVERIFIED/.test(e.result ?? "")),
    ).toBe(true);
    const s1 = idleStatus();
    expect(s1.idle_reason).toBe("OWNER_DECISION_NOT_TAKEN");
    expect(s1.overview.pending_decisions).toEqual([
      expect.objectContaining({
        order: ORDER_ID,
        value: "GO",
        code: "OWNER_ORIGIN_UNVERIFIED",
      }),
    ]);

    // vlastník zadá GO znovu (poslední zápis řádku je jeho) → další tick ho převezme
    panel.editor = OWNER_ID;
    await orch.tick();
    expect(store.load(ORDER_ID).state).toBe("DONE");
    expect(receipts()).toHaveLength(1);
    const lat = fs
      .readFileSync(path.join(dir, "idle", "go-latency.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    expect(lat).toEqual([
      expect.objectContaining({
        order: ORDER_ID,
        value: "GO",
        owner_written_at: "2026-11-04T11:58:00.000Z",
        latency_ms: 120_000, // NOW fixture 12:00:00 − zápis 11:58:00
      }),
    ]);
  });

  it("REJECT od jiného uživatele než vlastníka → zakázka nespadne (0 přechodů), HOLD", async () => {
    const { orch, panel } = waitingOrder();
    await orch.step(store.load(ORDER_ID));
    panel.decision = "REJECT";
    panel.editor = OTHER_PERSON;
    await orch.pollOwnerDecisions();
    expect(store.load(ORDER_ID).state).toBe("WAITING_OWNER");
  });

  it("bez ověřovače původu (konfigurace chybí) se žádné rozhodnutí z panelu nepřijme", async () => {
    seedDelivered(store, ["cena"]);
    const panel = new OriginPanel();
    const orch = makeOrch(store, new FileNotion(path.join(dir, "n.jsonl")), {
      panel: { sink: panel, index: new PanelIndex(dir) },
      ownerOrigin: new OwnerOriginVerifier(ownerIdFromConfig({}), users),
    });
    await orch.step(store.load(ORDER_ID));
    panel.decision = "GO";
    panel.editor = OWNER_ID;
    await orch.pollOwnerDecisions();
    expect(store.load(ORDER_ID).state).toBe("WAITING_OWNER");
    expect(receipts()).toHaveLength(0);
  });
});

describe("P20 původ rozhodnutí na scope kartě Inboxu (fake Notion, resolver DR-042)", () => {
  it("GO na S zapsané botem → HOLD OWNER_ORIGIN_UNVERIFIED, 0 receipt; od vlastníka → receipt", async () => {
    const w = makeWorld(dir);
    const { ev } = await w.ready();
    expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({ kind: "done" });
    const S = w.fake.rows.find((r) => r.ds === PANEL_DS)!;
    const inp = () => ({
      http: w.http,
      runsDir: dir,
      event: ev,
      scopeRecord: w.journal.get(scopeOp(ev.event_id)),
      panel: w.panel,
      trusted: w.trusted,
      read: w.scopeCtx(ev).read,
      lease: w.lease,
      now: w.now,
    });
    S.props["Rozhodnutí vlastníka"] = "GO";
    S.last_edited_by = BOT;
    expect(await observeScopeDecision(inp())).toMatchObject({
      kind: "hold",
      code: "OWNER_ORIGIN_UNVERIFIED",
    });
    expect(receipts()).toHaveLength(0);
    S.last_edited_by = OWNER;
    expect(await observeScopeDecision(inp())).toMatchObject({
      kind: "receipt",
      write: "CREATED",
    });
  });
});

// ───────────────────────────── 2. DR-033: kontrola prostojů ─────────────────────────────

describe("DR-033 kontrola prostojů při ticku", () => {
  it("žádná práce (zakázka čeká na vlastníka, nic nevyplněno) → idle_reason WAITING_OWNER s časem a přehledem; řádek orchestrátoru jen při změně důvodu", async () => {
    const { orch, panel } = waitingOrder({ orchestratorPanelRow: true });
    await orch.step(store.load(ORDER_ID));
    const before = panel.rows.length;
    expect(await orch.tick()).toMatchObject({ status: "waiting_owner" });
    const s = idleStatus();
    expect(s).toMatchObject({
      v: 1,
      tick_status: "waiting_owner",
      idle_reason: "WAITING_OWNER",
      overview: {
        runnable: [],
        waiting_owner: [ORDER_ID],
        limit_hold: false,
        dispatch_mode: "hold",
        pending_decisions: [],
      },
    });
    expect(Date.parse(s.at)).not.toBeNaN();
    const orchRows = () =>
      panel.rows
        .slice(before)
        .filter((r) => r.row["ID zakázky"] === ORCHESTRATOR_ROW_ID);
    expect(orchRows()).toHaveLength(1);
    expect(orchRows()[0].row["Poslední krok"]).toMatch(/WAITING_OWNER/);
    expect(orchRows()[0].row).not.toHaveProperty("Rozhodnutí vlastníka");
    expect(
      new EffectJournal(dir).get(
        operationId(ORCHESTRATOR_ROW_ID, "panel-row", 0),
      )?.state,
    ).toBe("EFFECT_DONE");
    // stejný důvod v dalším ticku: žádný další zápis do panelu, žádné druhé vytvoření řádku
    await orch.tick();
    expect(orchRows()).toHaveLength(1);
    expect(
      panel.rows.filter(
        (r) => r.row["ID zakázky"] === ORCHESTRATOR_ROW_ID && !r.page,
      ),
    ).toHaveLength(1);
    const hist = fs
      .readFileSync(path.join(dir, "idle", "history.jsonl"), "utf8")
      .trim()
      .split("\n");
    expect(hist, hist.join("\n")).toHaveLength(1);
  });

  it("v režimu hold kontrola prostojů nic nespouští: bez panelu řádku orchestrátoru (výchozí) jen runs/idle", async () => {
    const { orch, panel } = waitingOrder();
    await orch.step(store.load(ORDER_ID));
    await orch.tick();
    expect(
      panel.rows.some((r) => r.row["ID zakázky"] === ORCHESTRATOR_ROW_ID),
    ).toBe(false);
    expect(idleStatus().idle_reason).toBe("WAITING_OWNER");
    expect(store.listOrders().map((o) => o.id)).toEqual([ORDER_ID]);
  });
});

// ───────────────────────────── 3. DR-030 doplněk: adaptér Codexu ─────────────────────────────

describe("DR-030 doplněk: codex exec s výslovným modelem a intenzitou podle třídy", () => {
  let binDir: string;
  let argsFile: string;
  let oldPath: string | undefined;
  beforeEach(() => {
    binDir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-codex-"));
    argsFile = path.join(binDir, "args.txt");
    const script = `#!/bin/sh
printf '%s\\n' "$@" > '${argsFile}'
out=""
prev=""
for a in "$@"; do
  if [ "$prev" = "-o" ]; then out="$a"; fi
  prev="$a"
done
cat > /dev/null
printf '%s' '{"verdict":"PASS","issues":[],"findings":[]}' > "$out"
`;
    fs.writeFileSync(path.join(binDir, "codex"), script, { mode: 0o755 });
    oldPath = process.env.PATH;
    process.env.PATH = `${binDir}:${oldPath}`;
  });
  afterEach(() => {
    process.env.PATH = oldPath;
    fs.rmSync(binDir, { recursive: true, force: true });
  });
  const args = () => fs.readFileSync(argsFile, "utf8").trim().split("\n");
  const pair = (a: string[], flag: string) => a[a.indexOf(flag) + 1];

  it("pravidlo intenzity: B (i neurčená) nebo 1. kolo většího diffu = xhigh; A malý diff nebo 2. kolo = high", () => {
    expect(codexEffort({ prClass: "B", round: 2, diffChars: 10 })).toBe(
      "xhigh",
    );
    expect(codexEffort({ prClass: undefined, round: 2, diffChars: 10 })).toBe(
      "xhigh",
    );
    expect(codexEffort({ prClass: "A", round: 1, diffChars: 50_000 })).toBe(
      "xhigh",
    );
    expect(codexEffort({ prClass: "A", round: 1, diffChars: 500 })).toBe(
      "high",
    );
    expect(codexEffort({ prClass: "A", round: 2, diffChars: 50_000 })).toBe(
      "high",
    );
  });

  it("fake codex na PATH: třída A (malý diff) → -m gpt-6.1-sol -c model_reasoning_effort=high; třída B → xhigh; i v izolovaném běhu", async () => {
    const cwd = fs.mkdtempSync(path.join(dir, "cwd-"));
    const codex = new CodexCli();
    const a = await callChecker(
      codex,
      "posuď",
      cwd,
      codexEffort({ prClass: "A", round: 1, diffChars: 500 }),
    );
    expect(a.r.ok).toBe(true);
    let got = args();
    expect(pair(got, "-m")).toBe(CODEX_MODEL);
    expect(CODEX_MODEL).toBe("gpt-6.1-sol");
    expect(pair(got, "-c")).toBe("model_reasoning_effort=high");

    await callChecker(
      codex,
      "posuď",
      cwd,
      codexEffort({ prClass: "B", round: 1, diffChars: 500 }),
    );
    got = args();
    expect(pair(got, "-m")).toBe("gpt-6.1-sol");
    expect(got).toContain("model_reasoning_effort=xhigh");

    // izolovaný běh (Konzilium Lite, --ignore-user-config) bez třídy: model výslovně, intenzita xhigh
    await codex.run("text", { cwd, isolated: true });
    got = args();
    expect(got).toContain("--ignore-user-config");
    expect(pair(got, "-m")).toBe("gpt-6.1-sol");
    expect(got).toContain("model_reasoning_effort=xhigh");
  });

  it("hodnota jde do záznamu kroku a do pole „Kontrolor (model)“ panelu", async () => {
    const dev = new DevDepartment(
      { name: "ai-chain", model: "sonnet", family: "claude" } as never,
      new CodexCli(),
      path.join(dir, "sentinel.md"),
    );
    expect(dev.checkerModel("high")).toBe(
      `codex exec (${codexModelLabel(CODEX_MODEL, "high")}) + deterministic`,
    );
    // orchestrátor: model kontroly z kroku se uloží do meta.checker_model a řádek panelu ho ukáže
    const label = `codex exec (${codexModelLabel(CODEX_MODEL, "xhigh")})`;
    class Checked extends CopyDepartment {
      async check(...a: Parameters<CopyDepartment["check"]>) {
        return { ...(await super.check(...a)), model: label };
      }
    }
    const fixture = (family: "claude" | "gpt", text: string) => ({
      name: "fixture",
      model: `fixture-${family}`,
      family,
      run: async () => ({ ok: true, text, limit: false, duration_ms: 0 }),
    });
    seedDelivered(store);
    const cur = store.load(ORDER_ID);
    store.save({ ...cur, state: "CHECKING" });
    const panel = new OriginPanel();
    const orch = makeOrch(store, new FileNotion(path.join(dir, "c.jsonl")), {
      panel: { sink: panel, index: new PanelIndex(dir) },
      department: new Checked(
        fixture("claude", "x"),
        fixture("gpt", '```json\n{"verdict":"PASS","issues":[]}\n```'),
      ),
    });
    await orch.step(store.load(ORDER_ID));
    expect(store.load(ORDER_ID).meta.checker_model).toBe(label);
    expect(
      store
        .readLog(200)
        .some(
          (e) => e.kind === "call" && e.role === "checker" && e.model === label,
        ),
    ).toBe(true);
    await orch.flushPanel();
    expect(panel.rows.at(-1)?.row["Kontrolor (model)"]).toBe(label);
  });
});
