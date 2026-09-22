import { Pool } from "pg";

/**
 * Lazy pool getter — validace SAM_BYT_DATABASE_URL až při skutečném
 * použití, ne při importu (stejný kontrakt jako h2/db/pool.ts), aby
 * `next build` nespadl bez env proměnné.
 */
let cachedPool: Pool | null = null;

export function getSamBytPool(source: Record<string, string | undefined> = process.env): Pool {
  if (cachedPool) return cachedPool;
  const databaseUrl = source.SAM_BYT_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("SAM_BYT_DATABASE_URL není nastavená.");
  }
  cachedPool = new Pool({ connectionString: databaseUrl });
  return cachedPool;
}

export function resetSamBytPoolForTests(): void {
  cachedPool = null;
}
