// Child process of effects-review3.test.ts: many read-modify-writes of runs/panel-index.json from a separate process.
// argv: <runsDir> <orderId> <count> <startAtMs> [markDirty]
// Prints the sequence numbers it got as JSON. Starts at startAtMs, so two children really overlap.
import { PanelIndex } from "../panel";

const [dir, orderId, count, startAt, mark] = process.argv.slice(2);
while (Date.now() < Number(startAt)) {
  /* wait for the common start */
}
const index = new PanelIndex(dir);
const seqs: number[] = [];
for (let i = 0; i < Number(count); i++) {
  seqs.push(index.beginWrite(orderId));
  if (mark === "markDirty" && i === Math.floor(Number(count) / 2))
    index.markDirty(orderId);
}
process.stdout.write(JSON.stringify(seqs));
