// Child process for the two-process `.state.lock` test (state-ownership.test.ts). Not a test file itself.
// argv: <runsDir> <role> <orderId>
//   role "a": a worker in the middle of a save. Takes the short lock, reads the order, reports `a-in`, then waits for
//             `a-go` (the test pauses it with SIGSTOP and ages the lock meanwhile). Then saves its output, and after
//             leaving the lock tries once more with the object it read before the abort (late output) → must be refused.
//   role "b": `abort` from another process (same read–modify–write as Orchestrator.abort): waits for the lock, loads,
//             saves a FAILED state.
import fs from "node:fs";
import path from "node:path";

import { transition } from "../state-machine";
import { Store } from "../store";
import type { Order } from "../types";

const [dir, role, id] = process.argv.slice(2);
const sleep = (ms: number) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const mark = (name: string, v = "") =>
  fs.writeFileSync(path.join(dir, name), v);

function waitFor(name: string): void {
  const f = path.join(dir, name);
  const t0 = Date.now();
  while (!fs.existsSync(f)) {
    if (Date.now() - t0 > 60_000) process.exit(3);
    sleep(5);
  }
}

const store = new Store(dir);
if (role === "a") {
  let before!: Order;
  store.withStateLock(() => {
    before = store.load(id);
    mark("a-in", String(process.pid));
    waitFor("a-go");
    const ok = store.save({ ...structuredClone(before), draft_file: "a.md" });
    mark("a-save", ok ? "1" : "0");
  }, 60_000);
  const late = store.save({
    ...structuredClone(before),
    draft_file: "a-late.md",
  });
  mark("a-late", late ? "1" : "0");
} else {
  mark("b-start", String(process.pid));
  try {
    store.withStateLock(() => {
      const cur = store.load(id);
      const ok = store.save(
        transition(
          { ...cur, manual_interventions: cur.manual_interventions + 1 },
          { type: "fail", reason: "manual abort: B" },
          new Date().toISOString(),
        ),
      );
      mark("b-save", ok ? "1" : "0");
    }, 60_000);
  } catch (e) {
    mark("b-save", `error: ${(e as Error).message}`);
  }
}
