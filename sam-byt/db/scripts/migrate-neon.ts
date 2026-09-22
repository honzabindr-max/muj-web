import { existsSync } from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import { runMigrations } from "../migrate";

/**
 * Aplikuje sam-byt migrace na REÁLNÝ Neon projekt sam-byt. Connection
 * string se čte z .env.migrate.sam-byt.<target> (SAM_BYT_MIGRATOR_DATABASE_URL),
 * NIKDY z argumentu/chatu — soubor je v .gitignore (.env* pattern) a nikdy
 * se nesmí dostat do gitu ani Vercelu.
 *
 *   npx tsx sam-byt/db/scripts/migrate-neon.ts preview
 *   npx tsx sam-byt/db/scripts/migrate-neon.ts production
 */
async function main() {
  const target = process.argv[2];
  if (target !== "preview" && target !== "production") {
    throw new Error("Použití: npx tsx sam-byt/db/scripts/migrate-neon.ts <preview|production>");
  }
  const envFile = path.join(process.cwd(), `.env.migrate.sam-byt.${target}`);
  if (!existsSync(envFile)) {
    throw new Error(`${envFile} neexistuje. Vlož SAM_BYT_MIGRATOR_DATABASE_URL do tohoto souboru ručně.`);
  }
  process.loadEnvFile(envFile);

  const databaseUrl = process.env.SAM_BYT_MIGRATOR_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(`${envFile} neobsahuje SAM_BYT_MIGRATOR_DATABASE_URL.`);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const migrationsDir = path.join(__dirname, "..", "migrations");
    const applied = await runMigrations(pool, migrationsDir);
    if (applied.length === 0) {
      console.log(`sam-byt ${target}: žádné nové migrace k aplikaci.`);
    } else {
      console.log(`sam-byt ${target}: aplikováno ${applied.length} migrací:`, applied.join(", "));
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
