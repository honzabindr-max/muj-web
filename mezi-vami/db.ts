// Úložiště výsledků MEZI VÁMI (Postgres, MEZI_VAMI_DATABASE_URL — Neon přes Vercel integraci).
// Schéma se zakládá idempotentně (CREATE … IF NOT EXISTS) při prvním použití instance.
// Neukládá se oslovení/jméno ani e-mail; jen údaje nutné pro výpočet a jeho výsledek.

import { randomUUID } from "node:crypto";
import { Pool } from "pg";

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

function getPool(env: Record<string, string | undefined> = process.env): Pool {
  if (pool) return pool;
  const url = env.MEZI_VAMI_DATABASE_URL || env.MEZI_VAMI_POSTGRES_URL;
  if (!url) throw new Error("MEZI_VAMI_DATABASE_URL není nastavená.");
  pool = new Pool({ connectionString: url, max: 3 });
  return pool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS mv_computations (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  input jsonb NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  longitudes jsonb NOT NULL,
  derived jsonb NOT NULL,
  usage jsonb
);
CREATE TABLE IF NOT EXISTS mv_writings (
  id uuid PRIMARY KEY,
  computation_id uuid NOT NULL REFERENCES mv_computations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  model text NOT NULL,
  prompt_version text NOT NULL,
  output jsonb NOT NULL,
  usage jsonb
);
CREATE INDEX IF NOT EXISTS mv_writings_computation_idx ON mv_writings (computation_id, created_at DESC);
`;

async function db(): Promise<Pool> {
  const p = getPool();
  if (!ready) ready = p.query(SCHEMA).then(() => undefined).catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  return p;
}

export async function insertComputation(row: {
  input: unknown;
  provider: string;
  model: string;
  longitudes: unknown;
  derived: unknown;
  usage: unknown;
}): Promise<string> {
  const id = randomUUID();
  const p = await db();
  await p.query(
    `INSERT INTO mv_computations (id, input, provider, model, longitudes, derived, usage)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, row.input, row.provider, row.model, row.longitudes, row.derived, row.usage],
  );
  return id;
}

export async function getComputation(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const p = await db();
  const r = await p.query(`SELECT * FROM mv_computations WHERE id = $1`, [id]);
  return r.rows[0] ?? null;
}

export async function insertWriting(row: {
  computationId: string;
  model: string;
  promptVersion: string;
  output: unknown;
  usage: unknown;
}): Promise<string> {
  const id = randomUUID();
  const p = await db();
  await p.query(
    `INSERT INTO mv_writings (id, computation_id, model, prompt_version, output, usage)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, row.computationId, row.model, row.promptVersion, row.output, row.usage],
  );
  return id;
}

export async function getLatestWriting(computationId: string) {
  const p = await db();
  const r = await p.query(
    `SELECT * FROM mv_writings WHERE computation_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [computationId],
  );
  return r.rows[0] ?? null;
}
