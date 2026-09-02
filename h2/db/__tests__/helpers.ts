import path from "node:path";

import { Client, Pool } from "pg";

import { runMigrations } from "../migrate";

const ADMIN_URL = process.env.H2_TEST_ADMIN_DATABASE_URL ?? "postgres://localhost:5432/postgres";

/**
 * Test-only heslo pro role, kterým testy dají LOGIN (h2_runtime, h2_job,
 * h2_blind_reader, h2_control). Bezpečné zveřejnit — platí jen pro
 * efemérní testovací databáze (lokální nebo CI), nikdy pro reálný Neon.
 * Bez hesla by testy fungovaly jen lokálně přes trust auth a spadly by
 * v CI (Postgres service container vyžaduje password i pro roli na
 * "localhost", protože jde o síťové spojení mezi kontejnery, ne unix
 * socket).
 */
export const TEST_ROLE_PASSWORD = "h2_test_role_password";

/** Test-only databázová jména — nikdy nepřijímat od netestovacího vstupu. */
function assertSafeTestDbName(dbName: string): void {
  if (!/^h2_test_[a-z0-9_]+$/.test(dbName)) {
    throw new Error(`Nebezpečné jméno testovací databáze: ${dbName}`);
  }
}

/**
 * Odvodí connection string ze stejného host/port jako ADMIN_URL (funguje
 * lokálně i v CI, kde host není nutně "localhost" bez portu/credentials),
 * jen s jinou databází a volitelně jinou rolí/heslem.
 */
export function buildTestConnectionString(
  dbName: string,
  overrides: { username?: string; password?: string } = {},
): string {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${dbName}`;
  if (overrides.username) url.username = overrides.username;
  if (overrides.password !== undefined) url.password = overrides.password;
  return url.toString();
}

async function createTestDatabaseWithMigrations(dbName: string, migrationsDir: string): Promise<Pool> {
  assertSafeTestDbName(dbName);
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName}`);
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const pool = new Pool({ connectionString: buildTestConnectionString(dbName) });
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
