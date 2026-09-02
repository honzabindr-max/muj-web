import { existsSync } from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import { runMigrations } from "../migrate";

/**
 * Aplikuje h2-runtime migrace na REÁLNÝ Neon projekt h2-runtime. Connection
 * string se čte z .env.migrate (H2_RUNTIME_MIGRATOR_DATABASE_URL), NIKDY
 * z argumentu/chatu — .env.migrate je v .gitignore (.env* pattern) a nikdy
 * se nesmí dostat do gitu ani do Vercelu. Honzík ho zapisuje sám přes
 * h2/db/scripts/write-migrate-env.sh, hodnota nikdy neprojde přes Code.
 */
async function main() {
  const envFile = path.join(process.cwd(), ".env.migrate");
  if (!existsSync(envFile)) {
    throw new Error(
      ".env.migrate neexistuje. Spusť nejdřív: bash h2/db/scripts/write-migrate-env.sh",
    );
  }
  process.loadEnvFile(envFile);

  const databaseUrl = process.env.H2_RUNTIME_MIGRATOR_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(".env.migrate neobsahuje H2_RUNTIME_MIGRATOR_DATABASE_URL.");
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
