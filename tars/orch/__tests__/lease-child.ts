// Child process for the two-process tick lock test (state-ownership.test.ts). Not a test file itself.
// argv: <runsDir> <rounds> <id>. Per round: wait for go-<r>, try the lock, report, wait for end-<r>, release.
import fs from "node:fs";
import path from "node:path";

import { Store } from "../store";

const [dir, roundsRaw, id] = process.argv.slice(2);
const rounds = Number(roundsRaw);
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

const store = new Store(dir);
fs.writeFileSync(path.join(dir, `ready-${id}`), String(process.pid));
for (let r = 0; r < rounds; r++) {
  waitFor(`go-${r}`);
  const ok = store.acquireLock();
  fs.writeFileSync(path.join(dir, `res-${r}-${id}`), ok ? "1" : "0");
  waitFor(`end-${r}`);
  if (ok) store.releaseLock();
  fs.writeFileSync(path.join(dir, `rel-${r}-${id}`), "");
}
