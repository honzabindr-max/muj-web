import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import type { Pool } from "pg";

/**
 * Aplikuje .sql soubory z migrationsDir v abecedním pořadí, každý v jedné
 * transakci, a eviduje aplikované soubory v `_h2_migrations` — opakované
 * spuštění je idempotentní (přeskočí už aplikované). Fresh DB lze vytvořit
 * pouze z těchto migrací (BUILD-02 DoD).
 */
export async function runMigrations(pool: Pool, migrationsDir: string): Promise<string[]> {
  await pool.query(`
    create table if not exists _h2_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied: string[] = [];
  for (const file of files) {
    const already = await pool.query<{ filename: string }>(
      "select filename from _h2_migrations where filename = $1",
      [file],
    );
    if ((already.rowCount ?? 0) > 0) continue;

    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into _h2_migrations (filename) values ($1)", [file]);
      await client.query("commit");
      applied.push(file);
    } catch (error) {
      await client.query("rollback");
      throw new Error(`Migrace ${file} selhala: ${(error as Error).message}`, { cause: error });
    } finally {
      client.release();
    }
  }
  return applied;
}
