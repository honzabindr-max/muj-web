import path from "node:path";

import { Pool } from "pg";

import { runMigrations } from "../migrate";

/**
 * Aplikuje sam-byt migrace na lokální dev databázi. NENÍ určeno pro Neon.
 * SAM_BYT_DEV_DATABASE_URL, default: lokální Postgres sam_byt_dev pod
 * aktuálním OS uživatelem (trust auth, žádné heslo) — stejný vzor jako
 * h2/db/scripts/migrate-dev.ts.
 */
async function main() {
  const databaseUrl = process.env.SAM_BYT_DEV_DATABASE_URL ?? "postgres://localhost:5432/sam_byt_dev";
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const migrationsDir = path.join(__dirname, "..", "migrations");
    const applied = await runMigrations(pool, migrationsDir);
    if (applied.length === 0) {
      console.log("sam-byt dev: žádné nové migrace k aplikaci.");
    } else {
      console.log(`sam-byt dev: aplikováno ${applied.length} migrací:`, applied.join(", "));
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
