import type { Pool } from "pg";

import { requireRecentReauth } from "@/h2/identity/session";

import { H2PromptActivationError } from "./errors";

/**
 * JEDINÁ funkce v celém repu, která smí nastavit `prompt_versions.status
 * = 'ACTIVE'` (Technical Architecture v1.2 §9.1, BUILD-07 plán Rozhodnutí
 * 1). Hlídáno strojově v CI —
 * `h2/build-governance/__tests__/prompt-activation-single-writer.test.ts`
 * (Rozhodnutí 7).
 *
 * Atomicky: recent re-auth (BUILD-03A) → ověří existenci `PASS`
 * `prompt_test_runs` pro PŘESNOU kombinaci (verze, model, schema, fixture
 * set) → retire staré `ACTIVE` (stejný purpose) → aktivuje nové. Partial
 * unique index `prompt_versions_one_active_per_purpose` (BUILD-02) je
 * druhá vrstva obrany, kdyby tahle transakce sama selhala.
 */
export async function activatePromptVersion(
  pool: Pool,
  ownerId: string,
  promptVersionId: string,
  modelId: string,
  schemaVersion: number,
  fixtureSetVersion: string,
): Promise<void> {
  await requireRecentReauth(pool, ownerId);

  const client = await pool.connect();
  try {
    await client.query("begin");

    const versionResult = await client.query<{ purpose: string }>(`select purpose from prompt_versions where id = $1`, [
      promptVersionId,
    ]);
    const purpose = versionResult.rows[0]?.purpose;
    if (!purpose) {
      throw new H2PromptActivationError("VERSION_NOT_FOUND");
    }

    const passingRun = await client.query(
      `select id from prompt_test_runs
       where prompt_version_id = $1 and model_id = $2 and schema_version = $3 and fixture_set_version = $4 and status = 'PASS'
       order by run_at desc
       limit 1`,
      [promptVersionId, modelId, schemaVersion, fixtureSetVersion],
    );
    if (passingRun.rows.length === 0) {
      throw new H2PromptActivationError("NO_PASSING_TEST_RUN");
    }

    await client.query(`update prompt_versions set status = 'RETIRED', retired_at = now() where purpose = $1 and status = 'ACTIVE'`, [
      purpose,
    ]);
    await client.query(`update prompt_versions set status = 'ACTIVE', activated_at = now() where id = $1`, [promptVersionId]);

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Rollback (AT-35) — žádná editace historie, jen re-aktivace přesně dané
 * starší verze přes STEJNOU `activatePromptVersion()` cestu, s posledním
 * `PASS` test run comba pro tu verzi.
 */
export async function rollbackPromptVersion(pool: Pool, ownerId: string, purpose: string, targetVersion: number): Promise<void> {
  const versionResult = await pool.query<{ id: string }>(`select id from prompt_versions where purpose = $1 and version = $2`, [
    purpose,
    targetVersion,
  ]);
  const promptVersionId = versionResult.rows[0]?.id;
  if (!promptVersionId) {
    throw new H2PromptActivationError("VERSION_NOT_FOUND");
  }

  const passingCombo = await pool.query<{ model_id: string; schema_version: number; fixture_set_version: string }>(
    `select model_id, schema_version, fixture_set_version
     from prompt_test_runs where prompt_version_id = $1 and status = 'PASS'
     order by run_at desc
     limit 1`,
    [promptVersionId],
  );
  const combo = passingCombo.rows[0];
  if (!combo) {
    throw new H2PromptActivationError("NO_PASSING_TEST_RUN");
  }

  await activatePromptVersion(pool, ownerId, promptVersionId, combo.model_id, combo.schema_version, combo.fixture_set_version);
}
