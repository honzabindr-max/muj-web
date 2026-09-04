import { existsSync } from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import { runMigrations } from "../migrate";
import { resolveMigrateEnvFile } from "./resolve-migrate-env-file";

/**
 * Aplikuje h2-control migrace na REÁLNÝ Neon projekt h2-control. Viz
 * komentář v migrate-neon-runtime.ts — connection string jen z
 * .env.migrate.<target>, nikdy z chatu. h2-control nemá dnes v repu
 * doloženou preview/production distinkci — write-migrate-env.sh zapisuje
 * stejný H2_CONTROL_MIGRATOR_DATABASE_URL do obou souborů, takže volba
 * cíle tu funguje jen kvůli symetrii s runtime skriptem.
 *
 * Cílové prostředí — volitelný 1. CLI argument ("preview" | "production"),
 * bez argumentu fallback na dřívější .env.migrate (beze změny chování).
 */
async function main() {
  const envFile = resolveMigrateEnvFile(process.argv[2]);
  if (!existsSync(envFile)) {
    throw new Error(`${envFile} neexistuje. Spusť nejdřív: bash h2/db/scripts/write-migrate-env.sh`);
  }
  process.loadEnvFile(envFile);

  const databaseUrl = process.env.H2_CONTROL_MIGRATOR_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(`${envFile} neobsahuje H2_CONTROL_MIGRATOR_DATABASE_URL.`);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const migrationsDir = path.join(__dirname, "..", "control-migrations");
    const applied = await runMigrations(pool, migrationsDir);
    if (applied.length === 0) {
      console.log("h2-control: žádné nové migrace k aplikaci.");
    } else {
      console.log(`h2-control: aplikováno ${applied.length} migrací:`, applied.join(", "));
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
