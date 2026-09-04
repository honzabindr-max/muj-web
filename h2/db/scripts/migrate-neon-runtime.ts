import { existsSync } from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import { runMigrations } from "../migrate";
import { resolveMigrateEnvFile } from "./resolve-migrate-env-file";

/**
 * Aplikuje h2-runtime migrace na REÁLNÝ Neon projekt h2-runtime. Connection
 * string se čte z .env.migrate.<target> (H2_RUNTIME_MIGRATOR_DATABASE_URL),
 * NIKDY z argumentu/chatu — oba soubory jsou v .gitignore (.env* pattern)
 * a nikdy se nesmí dostat do gitu ani do Vercelu. Honzík je zapisuje sám
 * přes h2/db/scripts/write-migrate-env.sh, hodnota nikdy neprojde přes Code.
 *
 * Cílové prostředí — volitelný 1. CLI argument ("preview" | "production"):
 *   npx tsx h2/db/scripts/migrate-neon-runtime.ts preview
 *   npx tsx h2/db/scripts/migrate-neon-runtime.ts production
 * Bez argumentu: fallback na dřívější .env.migrate (beze změny chování,
 * pro zpětnou kompatibilitu se staršími lokálními soubory).
 */
async function main() {
  const envFile = resolveMigrateEnvFile(process.argv[2]);
  if (!existsSync(envFile)) {
    throw new Error(`${envFile} neexistuje. Spusť nejdřív: bash h2/db/scripts/write-migrate-env.sh`);
  }
  process.loadEnvFile(envFile);

  const databaseUrl = process.env.H2_RUNTIME_MIGRATOR_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(`${envFile} neobsahuje H2_RUNTIME_MIGRATOR_DATABASE_URL.`);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const migrationsDir = path.join(__dirname, "..", "migrations");
    const applied = await runMigrations(pool, migrationsDir);
    if (applied.length === 0) {
      console.log("h2-runtime: žádné nové migrace k aplikaci.");
    } else {
      console.log(`h2-runtime: aplikováno ${applied.length} migrací:`, applied.join(", "));
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
