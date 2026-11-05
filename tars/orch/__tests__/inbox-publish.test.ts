// Etapa 4 PR 3 — publishOnce (mapa v6 §3.3a, N-09), trvanlivost před přijetím jiným procesem (N-11) a exkluzivita
// odeslání mezi generacemi lease (N-12). Souběhové testy T18–T21, T23, T26, T27 běží jako DVA SKUTEČNÉ PROCESY nad
// stejným dočasným runs/ s bariérami přes soubory (inbox-child.ts); T24 s pádem skutečného procesu.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotionRestError } from "../notion";
import {
  DurabilityHold,
  durableMarker,
  nodePublishFs,
  publishOnce,
  readPublished,
  type PublishFs,
} from "../publish";
import { ackLedgerFile, ackOp, ackStep } from "../inbox/ack";
import { sha256Hex } from "../inbox/common";
import {
  scopeLedgerFile,
  scopeOp,
  scopeTick,
  type ScopeLedger,
} from "../inbox/scope";
import { intentFile } from "../inbox/send-intent";
import { makeWorld } from "./inbox-world";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const TSX = path.join(ROOT, "node_modules", "tsx", "dist", "loader.mjs");
const CHILD = path.join(__dirname, "inbox-child.ts");

// víceprocesové a fsync testy: pod plnou zátěží celé sady nestačí výchozích 5 s
vi.setConfig({ testTimeout: 60_000 });

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "inbox-pub-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFile(name: string, ms = 30_000): Promise<void> {
  const t0 = Date.now();
  while (!fs.existsSync(path.join(dir, name))) {
    if (Date.now() - t0 > ms) throw new Error(`čekání na ${name} vypršelo`);
    await sleep(2);
  }
}
function child(cfg: Record<string, unknown>) {
  const f = path.join(dir, `cfg-${cfg.id as string}.json`);
  fs.writeFileSync(f, JSON.stringify({ dir, ...cfg }));
  const k = spawn(process.execPath, ["--import", TSX, CHILD, f], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  let err = "";
  k.stderr!.on("data", (d) => (err += String(d)));
  const exit = new Promise<number | null>((r) => k.on("exit", (c) => r(c)));
  return { k, exit, err: () => err };
}
const setLease = (token: string) => {
  const tmp = path.join(dir, `lease.${token}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify({ token }));
  fs.renameSync(tmp, path.join(dir, "lease.json"));
};
const go = (id: string) => fs.writeFileSync(path.join(dir, `go-${id}`), "");
const res = (id: string) =>
  JSON.parse(fs.readFileSync(path.join(dir, `res-${id}.json`), "utf8")) as {
    kind: string;
    code?: string;
  };
const lines = (f: string) =>
  fs.existsSync(path.join(dir, f))
    ? fs
        .readFileSync(path.join(dir, f), "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
    : [];
const trace = (id: string) => lines(`trace-${id}.log`);

async function prepared() {
  const w = makeWorld(dir);
  const { row, ev } = await w.ready();
  return { w, row, ev, base: { rowId: row.id, eventId: ev.event_id } };
}

/**
 * Model filesystemu s výpadkem napájení: nová položka adresáře (soubor i podadresář) je trvalá až po fsync adresáře.
 * FIX1 nález 1: adresáře jsou modelované; `mkdirDurable` se chová jako skutečný (fsync rodiče jen u NOVĚ vytvořených
 * adresářů), `mkdirNoSync` = proces, který adresář založil a spadl před fsync rodiče. Výpadek smaže netrvalé položky
 * a všechno pod ztraceným adresářem.
 */
class PowerLossFs implements PublishFs {
  entries = new Map<string, { data: Buffer; durable: boolean }>();
  dirs = new Map<string, { durable: boolean }>([["/", { durable: true }]]);
  private fds = new Map<number, string>();
  private next = 3;
  failDirSync = false;
  dirSyncs: string[] = [];
  private err(code: string): Error {
    return Object.assign(new Error(code), { code });
  }
  openSync(p: string, flags: string): number {
    if (flags === "wx") {
      if (!this.dirs.has(path.dirname(p))) throw this.err("ENOENT");
      if (this.entries.has(p)) throw this.err("EEXIST");
      this.entries.set(p, { data: Buffer.alloc(0), durable: false });
    } else if (!this.entries.has(p)) throw this.err("ENOENT");
    this.fds.set(this.next, p);
    return this.next++;
  }
  writeSync(fd: number, buf: Buffer, off: number, len: number): number {
    const e = this.entries.get(this.fds.get(fd)!)!;
    e.data = Buffer.concat([e.data, buf.subarray(off, off + len)]);
    return len;
  }
  fsyncSync(): void {}
  closeSync(fd: number): void {
    this.fds.delete(fd);
  }
  linkSync(a: string, b: string): void {
    if (!this.dirs.has(path.dirname(b))) throw this.err("ENOENT");
    if (this.entries.has(b)) throw this.err("EEXIST");
    this.entries.set(b, { data: this.entries.get(a)!.data, durable: false });
  }
  rmTmp(p: string): void {
    this.entries.delete(p);
  }
  readFileSync(p: string): Buffer {
    const e = this.entries.get(p);
    if (!e) throw this.err("ENOENT");
    return e.data;
  }
  existsSync(p: string): boolean {
    return this.entries.has(p);
  }
  fsyncDir(d: string): void {
    if (this.failDirSync) throw this.err("EIO");
    if (!this.dirs.has(d)) throw this.err("ENOENT");
    this.dirSyncs.push(d);
    for (const [p, e] of this.entries)
      if (path.dirname(p) === d) e.durable = true;
    for (const [p, e] of this.dirs)
      if (p !== d && path.dirname(p) === d) e.durable = true;
  }
  /** `mkdir -p` bez fsync; vrací nově vytvořené adresáře od nejhlubšího. */
  mkdirNoSync(dir: string): string[] {
    const made: string[] = [];
    for (let d = dir; !this.dirs.has(d); d = path.dirname(d)) made.push(d);
    for (const d of [...made].reverse()) this.dirs.set(d, { durable: false });
    return made;
  }
  /** Stejné chování jako store.ts `mkdirDurable`: fsync rodiče jen u nově vytvořených adresářů, existující nic. */
  mkdirDurable(dir: string): void {
    for (const d of this.mkdirNoSync(dir)) this.fsyncDir(path.dirname(d));
  }
  powerLoss(): void {
    for (const [p, e] of this.dirs) if (!e.durable) this.dirs.delete(p);
    const alive = (p: string): boolean => {
      for (let d = path.dirname(p); ; d = path.dirname(d)) {
        if (!this.dirs.has(d)) return false;
        if (d === "/") return true;
      }
    };
    for (const p of [...this.dirs.keys()])
      if (p !== "/" && !alive(p)) this.dirs.delete(p);
    for (const [p, e] of this.entries)
      if (!e.durable || !alive(p)) this.entries.delete(p);
  }
}

describe("publishOnce (N-09) — základ a statický test T25", () => {
  it("CREATED → cíl + značka trvanlivosti; IDENTICAL; CONFLICT = cíl bajtově i inode beze změny", () => {
    const f = path.join(dir, "x", "r0.json");
    expect(publishOnce(f, "A\n")).toBe("CREATED");
    expect(fs.readFileSync(durableMarker(f), "utf8")).toBe(
      `${sha256Hex("A\n")}\n`,
    );
    expect(publishOnce(f, "A\n")).toBe("IDENTICAL");
    const ino = fs.statSync(f).ino;
    expect(publishOnce(f, "B\n")).toBe("CONFLICT");
    expect(fs.readFileSync(f, "utf8")).toBe("A\n");
    expect(fs.statSync(f).ino).toBe(ino);
    expect(
      fs.readdirSync(path.dirname(f)).filter((n) => n.endsWith(".tmp")),
    ).toEqual([]);
  });

  it("T25 statický: publikační primitivy nevolají rename/writeFile/truncate/unlink; rmTmp jen na tmp; scope/ack ledger nejde přes writeDurable", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "..", "publish.ts"),
      "utf8",
    );
    const section = src.slice(src.indexOf("function writeTmpFully"));
    expect(section.length).toBeGreaterThan(1000);
    const code = section.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(code).not.toMatch(
      /rename|writeFile|truncate|unlink|rmSync|writeDurable/,
    );
    const rm = [...code.matchAll(/ops\.rmTmp\(([^)]*)\)/g)].map((m) => m[1]);
    expect(rm.length).toBeGreaterThan(0);
    for (const a of rm) expect(a).toMatch(/^(tmp|m\.tmp|r\.tmp!)$/);
    // nodePublishFs.rmTmp je jediné místo s rmSync a volá se jen s cestami tmp (výše)
    expect(src.match(/rmSync/g)).toHaveLength(1);
  });
});

describe("N-11: záznam se přijme až po doložené trvanlivosti", () => {
  it("model výpadku napájení: pád A mezi link a fsync adresáře; naivní čtenář by přijal ledger, který výpadek smaže; readPublished provede bariéru a ledger výpadek přežije", () => {
    const f = "/runs/inbox/scope/e/r0.json";
    const naive = new PowerLossFs();
    expect(() =>
      publishOnce(f, "L\n", {
        fs: naive,
        point: (p) => {
          if (p === "linked") throw new Error("pád A");
        },
      }),
    ).toThrow("pád A");
    expect(naive.existsSync(f)).toBe(true); // jiný proces ho vidí…
    naive.powerLoss();
    expect(naive.existsSync(f)).toBe(false); // …ale bez fsync adresáře výpadek nepřežije

    const fsm = new PowerLossFs();
    expect(() =>
      publishOnce(f, "L\n", {
        fs: fsm,
        point: (p) => {
          if (p === "linked") throw new Error("pád A");
        },
      }),
    ).toThrow("pád A");
    const got = readPublished(f, { fs: fsm });
    expect(got.state).toBe("present");
    expect(fsm.dirSyncs).toContain(path.dirname(f));
    fsm.powerLoss();
    expect(fsm.existsSync(f)).toBe(true);
    expect(fsm.readFileSync(durableMarker(f)).toString()).toBe(
      `${sha256Hex("L\n")}\n`,
    );
  });

  it("FIX1 nález 1: A založí adresář scope události a spadne před fsync rodiče; B publikuje do existujícího adresáře → fsync celé cesty od runs/ dolů a ledger výpadek přežije", () => {
    const f = "/data/runs/inbox/scope/e/r0.json";
    // kontrola modelu: dřívější chování (mkdirDurable nad existujícím adresářem + fsync jen adresáře souboru) ledger ztratí
    const old = new PowerLossFs();
    old.mkdirDurable("/data");
    old.mkdirNoSync(path.dirname(f)); // proces A, pád před fsync rodiče
    old.mkdirDurable(path.dirname(f)); // B: adresář existuje → žádný fsync
    const fd = old.openSync(f, "wx");
    old.writeSync(fd, Buffer.from("L\n"), 0, 2);
    old.closeSync(fd);
    old.fsyncDir(path.dirname(f));
    old.powerLoss();
    expect(old.existsSync(f)).toBe(false);

    const fsm = new PowerLossFs();
    fsm.mkdirDurable("/data");
    fsm.mkdirNoSync(path.dirname(f));
    expect(publishOnce(f, "L\n", { fs: fsm, root: "/data/runs" })).toBe(
      "CREATED",
    );
    for (const d of [
      "/data/runs/inbox/scope/e",
      "/data/runs/inbox/scope",
      "/data/runs/inbox",
      "/data/runs",
      "/data",
    ])
      expect(fsm.dirSyncs, d).toContain(d);
    fsm.powerLoss();
    expect(fsm.existsSync(f)).toBe(true);
    expect(fsm.readFileSync(durableMarker(f)).toString()).toBe(
      `${sha256Hex("L\n")}\n`,
    );
  });

  it("FIX1 nález 1: čtenář bez značky (A spadl po link, adresáře bez fsync rodiče) provede bariéru celé cesty; záznam mimo kořen = DurabilityHold", () => {
    const f = "/data/runs/inbox/ack/e/r0.json";
    const fsm = new PowerLossFs();
    fsm.mkdirDurable("/data");
    fsm.mkdirNoSync(path.dirname(f));
    const fd = fsm.openSync(f, "wx"); // A: link proběhl, pak pád (bez fsync adresářů)
    fsm.writeSync(fd, Buffer.from("L\n"), 0, 2);
    fsm.closeSync(fd);
    const got = readPublished(f, { fs: fsm, root: "/data/runs" });
    expect(got.state).toBe("present");
    fsm.powerLoss();
    expect(fsm.existsSync(f)).toBe(true);

    expect(() =>
      publishOnce("/jinde/x.json", "L\n", {
        fs: new PowerLossFs(),
        root: "/data/runs",
      }),
    ).toThrow(DurabilityHold);
  });

  it("FIX1 nález 1: scope tick v run režimu publikuje ledger s kořenem runs/ (rodič runs/ i runs/ synchronizovány před POST)", async () => {
    const { w, ev } = await prepared();
    const syncs: string[] = [];
    const spy: PublishFs = {
      ...nodePublishFs,
      fsyncDir: (d) => {
        syncs.push(d);
        nodePublishFs.fsyncDir(d);
      },
    };
    let postSyncs = -1;
    const out = await scopeTick(
      w.scopeCtx(ev, {
        publish: { fs: spy },
        point: (p: string) => {
          if (p === "before-post") postSyncs = syncs.length;
        },
      }),
    );
    expect(out.kind).toBe("done");
    const lf = scopeLedgerFile(dir, ev.event_id);
    const before = syncs.slice(0, postSyncs);
    for (let d = path.dirname(lf); ; d = path.dirname(d)) {
      expect(before, d).toContain(d);
      if (d === dir) break;
    }
    expect(before).toContain(path.dirname(dir));
  });

  it("bariéra selže (EIO na fsync adresáře) → DurabilityHold; ve scope ticku LEDGER_NOT_DURABLE, 0 prepare, 0 HTTP", async () => {
    const fsm = new PowerLossFs();
    const f = "/r/x.json";
    expect(() =>
      publishOnce(f, "L", {
        fs: fsm,
        point: (p) => {
          if (p === "linked") throw new Error("x");
        },
      }),
    ).toThrow();
    fsm.failDirSync = true;
    expect(() => readPublished(f, { fs: fsm })).toThrow(DurabilityHold);

    const { w, ev } = await prepared();
    await expect(
      scopeTick(
        w.scopeCtx(ev, {
          publish: {
            point: (p) => {
              if (p === "linked") throw new Error("pád A");
            },
          },
        }),
      ),
    ).rejects.toThrow("pád A");
    expect(
      fs.existsSync(durableMarker(scopeLedgerFile(dir, ev.event_id))),
    ).toBe(false);
    const broken: PublishFs = {
      ...nodePublishFs,
      fsyncDir: () => {
        throw Object.assign(new Error("EIO"), { code: "EIO" });
      },
    };
    expect(
      await scopeTick(w.scopeCtx(ev, { publish: { fs: broken } })),
    ).toMatchObject({ kind: "hold", code: "LEDGER_NOT_DURABLE" });
    expect(w.journal.get(scopeOp(ev.event_id))).toBeUndefined();
    expect(w.fake.posts()).toHaveLength(0);
  });

  it("značka trvanlivosti nesedí na obsah → LEDGER_NOT_DURABLE, 0 HTTP", async () => {
    const { w, ev } = await prepared();
    await expect(
      scopeTick(
        w.scopeCtx(ev, {
          point: (p) => {
            if (p === "ledger-published") throw new Error("x");
          },
        }),
      ),
    ).rejects.toThrow();
    const m = durableMarker(scopeLedgerFile(dir, ev.event_id));
    fs.rmSync(m);
    fs.writeFileSync(m, `${"0".repeat(64)}\n`);
    expect(await scopeTick(w.scopeCtx(ev))).toMatchObject({
      kind: "hold",
      code: "LEDGER_NOT_DURABLE",
    });
    expect(w.fake.posts()).toHaveLength(0);
  });

  it("T26 (dva procesy): A spadne mezi link a fsync adresáře; B ledger přijme až po vlastní bariéře (fsync adresáře), teprve pak prepare; 1 POST s bajty A", async () => {
    const { base } = await prepared();
    setLease("A");
    const a = child({
      ...base,
      id: "A",
      role: "scope",
      token: "A",
      fence: 2,
      crashAt: "pub:linked:r0.json",
    });
    expect(await a.exit).toBe(9);
    const f = scopeLedgerFile(dir, base.eventId);
    expect(fs.existsSync(f)).toBe(true);
    expect(fs.existsSync(durableMarker(f))).toBe(false);
    const bytesA = fs.readFileSync(f);
    setLease("B");
    const b = child({ ...base, id: "B", role: "scope", token: "B", fence: 3 });
    expect(await b.exit, b.err()).toBe(0);
    expect(res("B")).toMatchObject({ kind: "done" });
    const t = trace("B");
    expect(t.indexOf("pub:barrier-synced:r0.json")).toBeGreaterThanOrEqual(0);
    expect(t.indexOf("pub:barrier-synced:r0.json")).toBeLessThan(
      t.indexOf("flow:prepared"),
    );
    expect(t).not.toContain("pub:linked:r0.json"); // B ledger znovu nepublikoval
    expect(fs.readFileSync(f).equals(bytesA)).toBe(true);
    expect(lines("posts.log")).toHaveLength(1);
  });

  it("T26b: A zastaven (nespadl) mezi link a fsync adresáře, lease přejde na B; B projde bariérou a odešle; A pak doběhne bez prepare → celkem 1 POST", async () => {
    const { base } = await prepared();
    setLease("A");
    const a = child({
      ...base,
      id: "A",
      role: "scope",
      token: "A",
      fence: 2,
      stopAt: "pub:linked:r0.json",
    });
    await waitFile("at-A");
    setLease("B");
    const b = child({ ...base, id: "B", role: "scope", token: "B", fence: 3 });
    expect(await b.exit, b.err()).toBe(0);
    expect(res("B")).toMatchObject({ kind: "done" });
    go("A");
    expect(await a.exit, a.err()).toBe(0);
    expect(res("A")).toMatchObject({ kind: "hold", code: "LEASE_LOST" });
    expect(trace("A")).not.toContain("flow:prepared");
    expect(lines("posts.log")).toHaveLength(1);
  });
});

describe("N-09: souběh dvou zapisovatelů ledgeru (dva skutečné procesy)", () => {
  it("T18: A (F1) před link, lease → B (F2) publikuje a pošle; A pak link → CONFLICT, 0 prepare, 0 HTTP; r0 = bajty B, inode beze změny", async () => {
    const { base, w } = await prepared();
    setLease("A");
    const a = child({
      ...base,
      id: "A",
      role: "scope",
      token: "A",
      fence: 1,
      stopAt: "pub:tmp-synced:r0.json",
    });
    await waitFile("at-A");
    setLease("B");
    const b = child({ ...base, id: "B", role: "scope", token: "B", fence: 2 });
    expect(await b.exit, b.err()).toBe(0);
    expect(res("B")).toMatchObject({ kind: "done" });
    const f = scopeLedgerFile(dir, base.eventId);
    const bytesB = fs.readFileSync(f);
    const ino = fs.statSync(f).ino;
    go("A");
    expect(await a.exit, a.err()).toBe(0);
    expect(res("A")).toMatchObject({
      kind: "hold",
      code: "SCOPE_LEDGER_CONFLICT",
    });
    expect(trace("A")).not.toContain("flow:prepared");
    expect(fs.readFileSync(f).equals(bytesB)).toBe(true);
    expect(fs.statSync(f).ino).toBe(ino);
    const L = JSON.parse(bytesB.toString()) as ScopeLedger;
    expect(L.fence).toBe(2);
    expect(lines("posts.log")).toHaveLength(1);
    expect(w.journal.get(scopeOp(base.eventId))).toMatchObject({
      state: "EFFECT_DONE",
      attempts: 1,
      content_hash: L.body_sha256,
    });
  });

  it("T19: B čeká před link, dožívající A (lease ztracen po kontrole 1) publikuje první → A: kontrola (2) selže, 0 prepare; B: CONFLICT; r0 = bajty A; 0 POST", async () => {
    const { base, w } = await prepared();
    setLease("A");
    const a = child({
      ...base,
      id: "A",
      role: "scope",
      token: "A",
      fence: 1,
      stopAt: "pub:tmp-synced:r0.json",
    });
    await waitFile("at-A");
    setLease("B");
    const b = child({
      ...base,
      id: "B",
      role: "scope",
      token: "B",
      fence: 2,
      stopAt: "pub:tmp-synced:r0.json",
    });
    await waitFile("at-B");
    go("A");
    expect(await a.exit, a.err()).toBe(0);
    expect(res("A")).toMatchObject({ kind: "hold", code: "LEASE_LOST" });
    const f = scopeLedgerFile(dir, base.eventId);
    const bytesA = fs.readFileSync(f);
    go("B");
    expect(await b.exit, b.err()).toBe(0);
    expect(res("B")).toMatchObject({
      kind: "hold",
      code: "SCOPE_LEDGER_CONFLICT",
    });
    expect(fs.readFileSync(f).equals(bytesA)).toBe(true);
    expect((JSON.parse(bytesA.toString()) as ScopeLedger).fence).toBe(1);
    expect(w.journal.get(scopeOp(base.eventId))).toBeUndefined();
    expect(lines("posts.log")).toHaveLength(0);
  });

  it("T20: dva procesy se stejným fence na jedné bariéře před link, 200 opakování → v každém přesně 1 CREATED a 1 CONFLICT, soubor = vítěz, nejvýš 1 prepare/POST", async () => {
    const rounds = 200;
    const a = child({ id: "a", role: "publish-loop", rounds });
    const b = child({ id: "b", role: "publish-loop", rounds });
    for (let r = 0; r < rounds; r++) {
      await waitFile(`at-a-${r}`);
      await waitFile(`at-b-${r}`);
      fs.writeFileSync(path.join(dir, `go-${r}`), "");
    }
    expect(await a.exit, a.err()).toBe(0);
    expect(await b.exit, b.err()).toBe(0);
    const ra = lines("res-a.log").map((l) => l.split(" ")[1]);
    const rb = lines("res-b.log").map((l) => l.split(" ")[1]);
    const actions = lines("t20-actions.log");
    expect(actions).toHaveLength(rounds);
    for (let r = 0; r < rounds; r++) {
      expect([ra[r], rb[r]].sort()).toEqual(["CONFLICT", "CREATED"]);
      const winner = ra[r] === "CREATED" ? "a" : "b";
      expect(fs.readFileSync(path.join(dir, "t20", `r${r}.json`), "utf8")).toBe(
        `${winner}-${r}\n`,
      );
      expect(actions.filter((l) => l.startsWith(`${r} `))).toEqual([
        `${r} ${winner}`,
      ]);
    }
  }, 180_000);

  it("T21: A publikuje a připraví, ztratí lease před POST; B najde ledger + PREPARED → ledger nepublikuje, ověří a jde cestou adopce; 0 POST, ledger beze změny", async () => {
    const { base } = await prepared();
    setLease("A");
    const a = child({
      ...base,
      id: "A",
      role: "scope",
      token: "A",
      fence: 1,
      stopAt: "flow:prepared",
    });
    await waitFile("at-A");
    const f = scopeLedgerFile(dir, base.eventId);
    const before = fs.readFileSync(f);
    setLease("B");
    const b = child({ ...base, id: "B", role: "scope", token: "B", fence: 2 });
    expect(await b.exit, b.err()).toBe(0);
    expect(res("B")).toMatchObject({
      kind: "hold",
      code: "SCOPE_CARD_UNKNOWN",
    });
    expect(trace("B").some((t) => t.startsWith("pub:tmp-synced:r0.json"))).toBe(
      false,
    );
    go("A");
    expect(await a.exit, a.err()).toBe(0);
    expect(res("A")).toMatchObject({ kind: "hold", code: "LEASE_LOST" });
    expect(lines("posts.log")).toHaveLength(0);
    expect(fs.readFileSync(f).equals(before)).toBe(true);
  });

  it("T23: ACK ledger r1 — dva procesy publikují přes bariéru před link → jeden CREATED, druhý ACK_LEDGER_CONFLICT; nejvýš 1 PATCH s textem vítěze", async () => {
    const { base, w, ev } = await prepared();
    const r0text = (
      w.fake.row(ev.page_id).props["Přijetí TARS"] as string[]
    ).join("");
    setLease("S");
    const a = child({
      ...base,
      id: "A",
      role: "ack",
      token: "S",
      fence: 5,
      desired: "CLAIMED",
      ackValue: r0text,
      stopAt: "pub:tmp-synced:r1.json",
    });
    const b = child({
      ...base,
      id: "B",
      role: "ack",
      token: "S",
      fence: 5,
      desired: "CLAIMED",
      ackValue: r0text,
      stopAt: "pub:tmp-synced:r1.json",
    });
    await waitFile("at-A");
    await waitFile("at-B");
    go("A");
    go("B");
    expect(await a.exit, a.err()).toBe(0);
    expect(await b.exit, b.err()).toBe(0);
    const outs = [res("A"), res("B")];
    expect(
      outs.filter((o) => o.kind === "hold" && o.code === "ACK_LEDGER_CONFLICT"),
    ).toHaveLength(1);
    const winnerText = (
      JSON.parse(
        fs.readFileSync(ackLedgerFile(dir, ev.event_id, 1), "utf8"),
      ) as { text: string }
    ).text;
    const p = lines("patches.log");
    expect(p.length).toBeLessThanOrEqual(1);
    for (const l of p)
      expect(JSON.parse(l.slice(l.indexOf(" ") + 1))).toBe(winnerText);
  });
});

describe("T24: pád skutečného procesu uvnitř publishOnce", () => {
  for (const [label, point, expectTarget] of [
    ["(a) po fsync tmp, před link", "pub:tmp-synced:r0.json", false],
    ["(b) po link, před fsync adresáře", "pub:linked:r0.json", true],
    [
      "(c) po fsync adresáře a značce, před unlink(tmp)",
      "pub:marked:r0.json",
      true,
    ],
  ] as const) {
    it(`${label}: nikdy neúplný r0.json; tick pokračuje bez POST před platnou publikací`, async () => {
      const { base, w, ev } = await prepared();
      setLease("A");
      const a = child({
        ...base,
        id: "A",
        role: "scope",
        token: "A",
        fence: 1,
        crashAt: point,
      });
      expect(await a.exit).toBe(9);
      const f = scopeLedgerFile(dir, ev.event_id);
      expect(fs.existsSync(f)).toBe(expectTarget);
      const tmps = fs
        .readdirSync(path.dirname(f))
        .filter((n) => n.endsWith(".tmp"));
      expect(tmps.length).toBeGreaterThan(0); // tmp zbyl a nikdo ho nečte
      const before = expectTarget ? fs.readFileSync(f) : undefined;
      if (before) JSON.parse(before.toString()); // celý, parsovatelný
      expect(w.journal.get(scopeOp(ev.event_id))).toBeUndefined();
      expect(lines("posts.log")).toHaveLength(0);
      const out = await scopeTick(w.scopeCtx(ev));
      expect(out).toMatchObject({ kind: "done" });
      const L = JSON.parse(fs.readFileSync(f, "utf8")) as ScopeLedger;
      if (before) expect(fs.readFileSync(f).equals(before)).toBe(true); // existující ledger se použil, nepřepsal
      expect(w.fake.posts().map((p) => p.body!.toString())).toEqual([L.body]);
      for (const t of tmps)
        expect(fs.existsSync(path.join(path.dirname(f), t))).toBe(true);
    });
  }
});

describe("N-12: dvě generace lease nikdy neodešlou stejný POST/PATCH (dva skutečné procesy)", () => {
  async function absentScope() {
    const p = await prepared();
    let n = 0;
    p.w.fake.onPost = () => {
      if (n++ === 0) throw new NotionRestError(429, "rate_limited");
    };
    expect(await scopeTick(p.w.scopeCtx(p.ev))).toMatchObject({
      kind: "hold",
      code: "EFFECT_RETRY",
    });
    expect(p.w.journal.get(scopeOp(p.ev.event_id))).toMatchObject({
      state: "EFFECT_ABSENT",
      attempts: 1,
    });
    return p;
  }

  it("T27: ledger + EFFECT_ABSENT; A zastaven po kontrole fence těsně před HTTP; lease → B na stejném stavu → B HOLD bez odeslání; pozdní POST A → celkem 1 POST", async () => {
    const { base, ev } = await absentScope();
    setLease("A");
    const a = child({
      ...base,
      id: "A",
      role: "scope",
      token: "A",
      fence: 2,
      stopAt: "flow:before-post",
    });
    await waitFile("at-A");
    setLease("B");
    const b = child({ ...base, id: "B", role: "scope", token: "B", fence: 3 });
    expect(await b.exit, b.err()).toBe(0);
    expect(res("B")).toMatchObject({
      kind: "hold",
      code: "SCOPE_CARD_UNKNOWN",
    });
    expect(trace("B")).not.toContain("flow:before-post");
    go("A");
    expect(await a.exit, a.err()).toBe(0);
    expect(res("A")).toMatchObject({ kind: "hold", code: "LEASE_LOST" }); // POST odešel, done bez lease ne
    expect(lines("posts.log")).toHaveLength(1);
    expect(fs.existsSync(intentFile(dir, scopeOp(ev.event_id), 2))).toBe(true);
    expect(fs.existsSync(intentFile(dir, scopeOp(ev.event_id), 3))).toBe(false);
  });

  it("T27b: A zastaven po záměru, před prepare; B najde cizí záměr pokusu, který journal nezná → SEND_INTENT_FOREIGN; A pak LEASE_LOST → 0 POST", async () => {
    const { base, w, ev } = await absentScope();
    setLease("A");
    const a = child({
      ...base,
      id: "A",
      role: "scope",
      token: "A",
      fence: 2,
      stopAt: "flow:intent-published",
    });
    await waitFile("at-A");
    setLease("B");
    const b = child({ ...base, id: "B", role: "scope", token: "B", fence: 3 });
    expect(await b.exit, b.err()).toBe(0);
    expect(res("B")).toMatchObject({
      kind: "hold",
      code: "SEND_INTENT_FOREIGN",
    });
    go("A");
    expect(await a.exit, a.err()).toBe(0);
    expect(res("A")).toMatchObject({ kind: "hold", code: "LEASE_LOST" });
    expect(lines("posts.log")).toHaveLength(0);
    expect(w.journal.get(scopeOp(ev.event_id))).toMatchObject({
      state: "EFFECT_ABSENT",
      attempts: 1,
    });
  });

  it("T27-ACK: r1 EFFECT_ABSENT; A zastaven těsně před PATCH; B na stejném stavu → bez PATCH (PREPARED → read-back, HOLD); pozdní PATCH A → celkem 1 PATCH", async () => {
    const { base, w, ev } = await prepared();
    const r0text = (
      w.fake.row(ev.page_id).props["Přijetí TARS"] as string[]
    ).join("");
    let n = 0;
    w.fake.onPatch = () => {
      if (n++ === 0) throw new NotionRestError(429, "rate_limited");
    };
    expect(await ackStep(w.ackCtx(ev), "CLAIMED")).toMatchObject({
      kind: "hold",
      code: "EFFECT_RETRY",
    });
    expect(w.journal.get(ackOp(ev.event_id, 1))).toMatchObject({
      state: "EFFECT_ABSENT",
      attempts: 1,
    });
    setLease("A");
    const a = child({
      ...base,
      id: "A",
      role: "ack",
      token: "A",
      fence: 2,
      desired: "CLAIMED",
      ackValue: r0text,
      stopAt: "flow:before-patch",
    });
    await waitFile("at-A");
    setLease("B");
    const b = child({
      ...base,
      id: "B",
      role: "ack",
      token: "B",
      fence: 3,
      desired: "CLAIMED",
      ackValue: r0text,
    });
    expect(await b.exit, b.err()).toBe(0);
    expect(res("B").kind).toBe("hold");
    expect(trace("B")).not.toContain("flow:before-patch");
    go("A");
    expect(await a.exit, a.err()).toBe(0);
    expect(lines("patches.log")).toHaveLength(1);
    expect(
      sha256Hex(
        JSON.parse(
          lines("patches.log")[0].split(" ").slice(1).join(" "),
        ) as string,
      ),
    ).toBe(w.journal.get(ackOp(ev.event_id, 1))?.content_hash);
  });
});
