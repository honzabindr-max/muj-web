import path from "node:path";

import { Pool } from "pg";

import { runMigrations } from "../migrate";

/**
 * Aplikuje h2-runtime migrace na lokální/dev databázi. NENÍ určeno pro Neon
 * h2-runtime/h2-control (ty zakládá Honzík, viz docs/h2/BUILD-STATUS.md).
 * DATABASE_URL bere z H2_DEV_DATABASE_URL, default: lokální Postgres h2_dev
 * pod aktuálním OS uživatelem (trust auth, žádné heslo).
 */
async function main() {
  const databaseUrl = process.env.H2_DEV_DATABASE_URL ?? "postgres://localhost:5432/h2_dev";
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const migrationsDir = path.join(__dirname, "..", "migrations");
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
