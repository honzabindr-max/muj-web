// Child process of effects.test.ts: runs one DELIVERED step and is SIGKILLed inside the Notion write.
// argv: <runsDir> <before|after> <titlePrefix> <ownerDecision?>
import path from "node:path";

import { Store } from "../store";
import { FileNotion, makeOrch, ORDER_ID } from "./effects-fixture";

async function main() {
  const [dir, when, titlePrefix] = process.argv.slice(2);
  const store = new Store(dir);
  const notion = new FileNotion(path.join(dir, "notion.jsonl"), {
    kill: { when: when as "before" | "after", titlePrefix },
  });
  await makeOrch(store, notion).step(store.load(ORDER_ID));
}

main().then(
  () => process.exit(0),
  (e) => {
    process.stderr.write(String((e as Error)?.message ?? e));
    process.exit(3);
  },
);
