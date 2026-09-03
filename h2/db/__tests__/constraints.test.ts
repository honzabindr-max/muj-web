import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRuntimeTestDatabase, dropTestDatabase } from "./helpers";

const DB_NAME = "h2_test_constraints";

describe("h2-runtime — DB constraints (fresh DB jen z migrací, BUILD-02 DoD)", () => {
  let pool: Pool;
  let ownerId: string;

  beforeAll(async () => {
    pool = await createRuntimeTestDatabase(DB_NAME);
    const owner = await pool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["test-sub-1", "Test Owner"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterAll(async () => {
    await dropTestDatabase(pool, DB_NAME);
  });

  it("raw_events: partial unique (owner_id, input_sequence) WHERE input_sequence IS NOT NULL (§5)", async () => {
    await pool.query(
      `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
       values ($1, 1, 1, 'telegram', 'USER', '\\x00', 'TEXT', 1)`,
      [ownerId],
    );
    await expect(
      pool.query(
        `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
         values ($1, 2, 1, 'telegram', 'USER', '\\x00', 'TEXT', 1)`,
        [ownerId],
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it("raw_events: BUDDY/SYSTEM raw events s input_sequence NULL se navzájem nekonfliktují (§4.1 AT-61)", async () => {
    await pool.query(
      `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
       values ($1, 3, null, 'telegram', 'BUDDY', '\\x00', 'TEXT', 1)`,
      [ownerId],
    );
    await expect(
      pool.query(
        `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
         values ($1, 4, null, 'telegram', 'BUDDY', '\\x00', 'TEXT', 1)`,
        [ownerId],
      ),
    ).resolves.toBeDefined();
  });

  it("raw_events: input_sequence smí být vyplněný jen pro speaker=USER", async () => {
    await expect(
      pool.query(
        `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
         values ($1, 5, 99, 'telegram', 'BUDDY', '\\x00', 'TEXT', 1)`,
        [ownerId],
      ),
    ).rejects.toThrow(/raw_events_input_sequence_only_user/);
  });

  it("message_processing_jobs: neplatný status je odmítnut (§4.2 stavový automat)", async () => {
    const rawEvent = await pool.query<{ id: string }>(
      `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
       values ($1, 6, 2, 'telegram', 'USER', '\\x00', 'TEXT', 1) returning id`,
      [ownerId],
    );
    await expect(
      pool.query(
        `insert into message_processing_jobs (owner_id, raw_event_id, status) values ($1, $2, 'NOT_A_REAL_STATUS')`,
        [ownerId, rawEvent.rows[0].id],
      ),
    ).rejects.toThrow(/message_processing_jobs_status_check/);
  });

  it("message_processing_jobs: MANUALLY_CLEARED je platný terminální stav (migrace 0016, BUILD-11 prep)", async () => {
    const rawEvent = await pool.query<{ id: string }>(
      `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
       values ($1, 20, 20, 'telegram', 'USER', '\\x00', 'TEXT', 1) returning id`,
      [ownerId],
    );
    await expect(
      pool.query(`insert into message_processing_jobs (owner_id, raw_event_id, status) values ($1, $2, 'MANUALLY_CLEARED')`, [
        ownerId,
        rawEvent.rows[0].id,
      ]),
    ).resolves.toBeDefined();
  });

  it("responses: nejvýše jeden BUDDY response na (owner_id, source_input_sequence) (§4.4 exactly-once)", async () => {
    const rawEventA = await pool.query<{ id: string }>(
      `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
       values ($1, 7, 3, 'telegram', 'USER', '\\x00', 'TEXT', 1) returning id`,
      [ownerId],
    );
    const rawEventB = await pool.query<{ id: string }>(
      `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
       values ($1, 8, 4, 'telegram', 'USER', '\\x00', 'TEXT', 1) returning id`,
      [ownerId],
    );
    // Dva různé raw_events (input_sequence 3 a 4), ale obě responses tvrdí
    // stejné source_input_sequence=3 — testuje se unikátnost na responses,
    // ne na raw_events (ta má vlastní partial unique test výše).
    await pool.query(
      `insert into responses (owner_id, source_raw_event_id, source_input_sequence, payload_ciphertext, encryption_key_version)
       values ($1, $2, 3, '\\x00', 1)`,
      [ownerId, rawEventA.rows[0].id],
    );
    await expect(
      pool.query(
        `insert into responses (owner_id, source_raw_event_id, source_input_sequence, payload_ciphertext, encryption_key_version)
         values ($1, $2, 3, '\\x00', 1)`,
        [ownerId, rawEventB.rows[0].id],
      ),
    ).rejects.toThrow(/responses_owner_input_sequence_buddy_unique/);
  });

  it("commitments: událostní expiry (expires_on_event) vyžaduje review_at (§14.2)", async () => {
    await expect(
      pool.query(
        `insert into commitments (owner_id, statement, created_by_user, expires_on_event) values ($1, 'test', true, 'after trip')`,
        [ownerId],
      ),
    ).rejects.toThrow(/commitments_event_expiry_needs_review/);

    await expect(
      pool.query(
        `insert into commitments (owner_id, statement, created_by_user, expires_on_event, review_at)
         values ($1, 'test', true, 'after trip', now() + interval '30 days')`,
        [ownerId],
      ),
    ).resolves.toBeDefined();
  });

  it("experiments: NO_DATA observation nesmí nést data a jinak data musí nést (§16, AT-29)", async () => {
    const experiment = await pool.query<{ id: string }>(
      `insert into experiments (owner_id, question) values ($1, 'test question') returning id`,
      [ownerId],
    );
    await expect(
      pool.query(
        `insert into experiment_observations (owner_id, experiment_id, is_no_data, data) values ($1, $2, true, '{}'::jsonb)`,
        [ownerId, experiment.rows[0].id],
      ),
    ).rejects.toThrow(/experiment_observations_data_presence/);
    await expect(
      pool.query(
        `insert into experiment_observations (owner_id, experiment_id, is_no_data, data) values ($1, $2, false, null)`,
        [ownerId, experiment.rows[0].id],
      ),
    ).rejects.toThrow(/experiment_observations_data_presence/);
    await expect(
      pool.query(
        `insert into experiment_observations (owner_id, experiment_id, is_no_data) values ($1, $2, true)`,
        [ownerId, experiment.rows[0].id],
      ),
    ).resolves.toBeDefined();
  });

  it("job_runs: unique(job_name, scheduled_for) — dva schedulery nesmí vytvořit dvojí job (§20, AT-72)", async () => {
    await pool.query(
      `insert into job_definitions (job_name, schedule_kind, health_grace_seconds) values ('process-pending-messages', 'interval', 900)`,
    );
    const scheduledFor = "2026-09-02T12:00:00Z";
    await pool.query(
      `insert into job_runs (job_name, scheduled_for, claimed_by) values ('process-pending-messages', $1, 'github-actions')`,
      [scheduledFor],
    );
    await expect(
      pool.query(
        `insert into job_runs (job_name, scheduled_for, claimed_by) values ('process-pending-messages', $1, 'cron-job.org')`,
        [scheduledFor],
      ),
    ).rejects.toThrow(/job_runs_job_name_scheduled_for_unique/);
  });

  it("claims: unknown_count > 0 blokuje VALIDOVANO/MECHANISMUS/LIVING_OS stavy (§10.3)", async () => {
    await expect(
      pool.query(
        `insert into claims (owner_id, statement, state, unknown_count) values ($1, 'test claim', 'VALIDOVANO', 1)`,
        [ownerId],
      ),
    ).rejects.toThrow(/claims_unknown_blocks_validated/);
    await expect(
      pool.query(
        `insert into claims (owner_id, statement, state, unknown_count) values ($1, 'test claim', 'VALIDOVANO', 0)`,
        [ownerId],
      ),
    ).resolves.toBeDefined();
  });
});
