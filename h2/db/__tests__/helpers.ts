import path from "node:path";

import { Client, Pool } from "pg";

import { runMigrations } from "../migrate";

const ADMIN_URL = process.env.H2_TEST_ADMIN_DATABASE_URL ?? "postgres://localhost:5432/postgres";

/** Test-only databázová jména — nikdy nepřijímat od netestovacího vstupu. */
function assertSafeTestDbName(dbName: string): void {
  if (!/^h2_test_[a-z0-9_]+$/.test(dbName)) {
    throw new Error(`Nebezpečné jméno testovací databáze: ${dbName}`);
  }
}

async function createTestDatabaseWithMigrations(dbName: string, migrationsDir: string): Promise<Pool> {
  assertSafeTestDbName(dbName);
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName}`);
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const pool = new Pool({ connectionString: `postgres://localhost:5432/${dbName}` });
  await runMigrations(pool, migrationsDir);
  return pool;
}

export async function createRuntimeTestDatabase(dbName: string): Promise<Pool> {
  return createTestDatabaseWithMigrations(dbName, path.join(__dirname, "..", "migrations"));
}

export async function createControlTestDatabase(dbName: string): Promise<Pool> {
  return createTestDatabaseWithMigrations(dbName, path.join(__dirname, "..", "control-migrations"));
}

export async function dropTestDatabase(pool: Pool, dbName: string): Promise<void> {
  assertSafeTestDbName(dbName);
  await pool.end();
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName}`);
  await admin.end();
}
