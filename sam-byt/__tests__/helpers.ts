import path from "node:path";

import { Client, Pool } from "pg";

import { runMigrations } from "../db/migrate";

const ADMIN_URL = process.env.SAM_BYT_TEST_ADMIN_DATABASE_URL ?? "postgres://localhost:5432/postgres";

/**
 * Každý testovací soubor dostane vlastní fresh databázi (stejný vzor jako
 * h2/db/__tests__/helpers.ts) — vitest pouští test soubory paralelně a
 * sdílená DB napříč soubory dřív vedla k race (duplicate key / deadlock
 * na společných tabulkách při souběžném truncate/insert).
 */
function assertSafeTestDbName(dbName: string): void {
  if (!/^sam_byt_test_[a-z0-9_]+$/.test(dbName)) {
    throw new Error(`Nebezpečné jméno testovací databáze: ${dbName}`);
  }
}

function buildTestConnectionString(dbName: string): string {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${dbName}`;
  return url.toString();
}

export async function createTestDatabase(dbName: string): Promise<Pool> {
  assertSafeTestDbName(dbName);
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName}`);
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const pool = new Pool({ connectionString: buildTestConnectionString(dbName) });
  await runMigrations(pool, path.join(__dirname, "..", "db", "migrations"));
  return pool;
}

export async function dropTestDatabase(pool: Pool, dbName: string): Promise<void> {
  assertSafeTestDbName(dbName);
  await pool.end();
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName}`);
  await admin.end();
}

export async function insertTestUser(pool: Pool, username: "sam" | "honzik"): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "insert into sam_byt_users (username, display_name, password_hash) values ($1, $2, 'scrypt$00$00') returning id",
    [username, username === "sam" ? "Sam" : "Honzík"],
  );
  return rows[0]!.id;
}
