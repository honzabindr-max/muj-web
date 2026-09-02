import path from "node:path";

import { Pool } from "pg";

import { runMigrations } from "../migrate";

/**
 * Aplikuje h2-control migrace na lokální/dev databázi (stejný typ jako
 * migrate-dev.ts, jen pro control-migrations). NENÍ určeno pro reálný Neon
 * h2-control — na to slouží migrate-neon-control.ts.
 * DATABASE_URL bere z H2_CONTROL_DEV_DATABASE_URL, default: lokální
 * Postgres h2_dev_control pod aktuálním OS uživatelem (trust auth).
 */
async function main() {
  const databaseUrl = process.env.H2_CONTROL_DEV_DATABASE_URL ?? "postgres://localhost:5432/h2_dev_control";
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const migrationsDir = path.join(__dirname, "..", "control-migrations");
    const applied = await runMigrations(pool, migrationsDir);
    if (applied.length === 0) {
      console.log("Žádné nové migrace k aplikaci.");
    } else {
      console.log(`Aplikováno ${applied.length} migrací:`, applied.join(", "));
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
