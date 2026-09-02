import { Client } from "pg";

/**
 * Vitest globalSetup — spouští se PŘESNĚ JEDNOU před všemi paralelně
 * běžícími test soubory (na rozdíl od per-souboru beforeAll). Role
 * (h2_migrator, h2_runtime, h2_job, h2_blind_reader, h2_control_migrator,
 * h2_control) jsou cluster-wide, takže když je založí paralelně dvě
 * migrace na dvou různých fresh testovacích databázích zároveň, může
 * CREATE ROLE spadnout na raw unique_violation místo přátelského
 * duplicate_object (viz DECISIONS.md / commit historie — tohle přesně
 * způsobilo flaky CI na PR #15). Založením rolí předem, sekvenčně a mimo
 * paralelní běh, migrace 0011/control-0001 v každém test souboru narazí
 * jen na už-existující roli přes bezpečnou cestu, ne na race.
 */
const ADMIN_URL = process.env.H2_TEST_ADMIN_DATABASE_URL ?? "postgres://localhost:5432/postgres";

const ROLE_DEFINITIONS = [
  "create role h2_migrator noinherit bypassrls",
  "create role h2_runtime noinherit",
  "create role h2_job noinherit",
  "create role h2_blind_reader noinherit",
  "create role h2_control_migrator noinherit bypassrls",
  "create role h2_control noinherit",
];

export default async function setup() {
  const client = new Client({ connectionString: ADMIN_URL });
  await client.connect();
  try {
    for (const statement of ROLE_DEFINITIONS) {
      try {
        await client.query(statement);
      } catch (error) {
        const code = (error as { code?: string }).code;
        // 42710 = duplicate_object, 23505 = unique_violation (raw race
        // artefakt) — obojí znamená "role už existuje", bezpečně ignorovat.
        if (code !== "42710" && code !== "23505") {
          throw error;
        }
      }
    }
  } finally {
    await client.end();
  }
}
