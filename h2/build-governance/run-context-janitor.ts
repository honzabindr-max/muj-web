import path from "node:path";

import { runContextJanitor } from "./context-janitor";

const repoRoot = path.resolve(__dirname, "..", "..");
const { failures, warnings } = runContextJanitor(repoRoot);

for (const w of warnings) {
  console.warn(`WARNING [${w.file}] ${w.message}`);
}
for (const f of failures) {
  console.error(`FAIL [${f.file}] ${f.message}`);
}

console.log(`context-janitor: ${failures.length} FAIL, ${warnings.length} WARNING`);

if (failures.length > 0) {
  process.exit(1);
}
