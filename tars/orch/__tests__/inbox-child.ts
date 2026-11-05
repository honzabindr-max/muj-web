// Dětský proces pro víceprocesové testy inboxu (inbox-publish.test.ts). Není to test sám o sobě.
// argv: <cesta ke konfiguraci JSON>. Sdílený je jen adresář runs/ (ledger, journal, záměry, lease.json, bariéry, logy);
// každý proces má vlastní fake Notion. Bariéra: v bodě `stopAt` zapíše `at-<id>` a čeká na `go-<id>`.
// Pád: v bodě `crashAt` skončí `process.exit(9)` bez úklidu (finally se nespustí).
import fs from "node:fs";
import path from "node:path";

import { ackStep, type AckState } from "../inbox/ack";
import type { LeaseView } from "../inbox/common";
import { readEvent } from "../inbox/event";
import { scopeTick } from "../inbox/scope";
import { publishOnce } from "../publish";
import { INBOX_DS, OWNER, inboxProps } from "./inbox-fake";
import { makeWorld } from "./inbox-world";

interface Cfg {
  dir: string;
  id: string;
  role: "scope" | "ack" | "publish-loop" | "crash-publish";
  token?: string;
  fence?: number;
  rowId?: string;
  eventId?: string;
  ackValue?: string;
  desired?: AckState;
  stopAt?: string;
  crashAt?: string;
  rounds?: number;
  target?: string;
  content?: string;
}

const cfg = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Cfg;
const dir = cfg.dir;
const sleep = (ms: number) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function waitFor(name: string): void {
  const f = path.join(dir, name);
  const t0 = Date.now();
  while (!fs.existsSync(f)) {
    if (Date.now() - t0 > 60_000) process.exit(3);
    sleep(2);
  }
}
const trace = (p: string) =>
  fs.appendFileSync(path.join(dir, `trace-${cfg.id}.log`), `${p}\n`);

function hook(p: string): void {
  trace(p);
  if (cfg.crashAt === p) process.exit(9);
  if (cfg.stopAt === p) {
    fs.writeFileSync(path.join(dir, `at-${cfg.id}`), String(process.pid));
    waitFor(`go-${cfg.id}`);
  }
}

class FileLease implements LeaseView {
  constructor(
    public readonly token: string,
    public readonly fence: number,
  ) {}
  holds(): boolean {
    try {
      return (
        (
          JSON.parse(fs.readFileSync(path.join(dir, "lease.json"), "utf8")) as {
            token: string;
          }
        ).token === this.token
      );
    } catch {
      return false;
    }
  }
}

const publish = {
  point: (p: string, file: string) => hook(`pub:${p}:${path.basename(file)}`),
};
const done = (v: unknown) =>
  fs.writeFileSync(path.join(dir, `res-${cfg.id}.json`), JSON.stringify(v));

async function main(): Promise<void> {
  if (cfg.role === "publish-loop") {
    for (let r = 0; r < cfg.rounds!; r++) {
      const target = path.join(dir, "t20", `r${r}.json`);
      const res = publishOnce(target, `${cfg.id}-${r}\n`, {
        point: (p) => {
          if (p !== "tmp-synced") return;
          fs.writeFileSync(path.join(dir, `at-${cfg.id}-${r}`), "");
          waitFor(`go-${r}`);
        },
      });
      // vítěz pokračuje k (simulovanému) prepare a POST, poražený nic neodesílá
      if (res === "CREATED")
        fs.appendFileSync(
          path.join(dir, "t20-actions.log"),
          `${r} ${cfg.id}\n`,
        );
      fs.appendFileSync(path.join(dir, `res-${cfg.id}.log`), `${r} ${res}\n`);
    }
    return;
  }
  if (cfg.role === "crash-publish") {
    publishOnce(cfg.target!, cfg.content!, publish);
    done("finished");
    return;
  }
  const w = makeWorld(dir);
  w.fake.postLogFile = path.join(dir, "posts.log");
  w.fake.patchLogFile = path.join(dir, "patches.log");
  const props = inboxProps();
  if (cfg.ackValue !== undefined) props["Přijetí TARS"] = [cfg.ackValue];
  w.fake.addRow(INBOX_DS, props, OWNER, cfg.rowId);
  const ev = readEvent(dir, cfg.eventId!)!;
  const lease = new FileLease(cfg.token!, cfg.fence!);
  try {
    if (cfg.role === "scope") {
      done(
        await scopeTick(
          w.scopeCtx(ev, {
            lease,
            ackR0Done: () => true,
            point: (p) => hook(`flow:${p}`),
            publish,
          }),
        ),
      );
    } else {
      done(
        await ackStep(
          w.ackCtx(ev, { lease, point: (p) => hook(`flow:${p}`), publish }),
          cfg.desired!,
        ),
      );
    }
  } catch (e) {
    done({ kind: "error", message: String((e as Error)?.message ?? e) });
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    fs.writeFileSync(path.join(dir, `err-${cfg.id}`), String(e?.stack ?? e));
    process.exit(1);
  },
);
