import { execFileSync } from "node:child_process";

import { REQUIRED_ENV_VARS, type RequiredEnvVar } from "../../build-governance/required-env";

/**
 * Ruční preflight krok deploy gate (BUILD-STATUS.md pravidlo č. 8) — NE CI.
 * Honzík vědomě odmítl GitHub Actions variantu: čtení produkčních Vercel
 * env by vyžadovalo nový Vercel token jako CI secret, nová úniková plocha
 * kvůli chybě, co se objeví jednou za slice, ne za commit.
 *
 * Parsuje `vercel env ls <environment>` (jen JMÉNA proměnných ve sloupci
 * "name", nikdy hodnoty — ty CLI i tak defaultně skrývá jako "Hidden" pro
 * typ Secret) a porovná proti REQUIRED_ENV_VARS manifestu.
 *
 * Spustit PŘED registrací/spuštěním nové externí integrace (Telegram
 * setWebhook a budoucí obdoby) a PO `vercel env add`, PŘED redeployem, ne
 * po něm — env proměnná přidaná do Vercelu se do už běžící instance
 * nedostane, potřebuje nový deployment (BUILD-04 nález 2026-09-03).
 *
 * Použití: npx tsx h2/db/scripts/check-required-env.ts
 */
type Environment = "production" | "preview";

function listEnvVarNames(environment: Environment): Set<string> {
  const output = execFileSync("vercel", ["env", "ls", environment], { encoding: "utf8" });
  const names = new Set<string>();
  for (const line of output.split("\n")) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s+/);
    if (match) names.add(match[1]);
  }
  return names;
}

function main() {
  const environments: Environment[] = ["production", "preview"];
  let anyFailClosedMissing = false;

  for (const environment of environments) {
    const present = listEnvVarNames(environment);
    const missing = REQUIRED_ENV_VARS.filter((v: RequiredEnvVar) => !present.has(v.key));

    console.log(`\n${environment}:`);
    if (missing.length === 0) {
      console.log("  OK — všechny proměnné z required-env.ts přítomné.");
      continue;
    }
    for (const m of missing) {
      console.log(`  CHYBÍ ${m.key} [${m.failureMode}] — ${m.module}`);
      if (m.failureMode === "fail-closed") anyFailClosedMissing = true;
    }
  }

  if (anyFailClosedMissing) {
    console.log("\nAlespoň jedna fail-closed proměnná chybí — daná cesta v produkci spadne na 500. Deploy gate NEPROŠEL.");
    process.exitCode = 1;
  } else {
    console.log("\nDeploy gate prošel (fail-closed proměnné kompletní).");
  }
}

main();
