import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import { persistContextRun } from "../persist-context-run";
import type { ContextCandidateItem } from "../priority";

const DB_NAME = "h2_test_persist_context_run";

describe("persistContextRun() pod rolí h2_runtime (§7.4)", () => {
  let adminPool: Pool;
  let runtimePool: Pool;
  let ownerId: string;

  beforeEach(async () => {
    adminPool = await createRuntimeTestDatabase(DB_NAME);
    runtimePool = new PgPool({
      connectionString: buildTestConnectionString(DB_NAME, { username: "h2_runtime", password: TEST_ROLE_PASSWORD }),
    });

    const owner = await adminPool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["persist-context-run-test-owner", "Honzík"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  it("zapíše context_runs + context_run_items (included i omitted) v jedné transakci", async () => {
    const included: ContextCandidateItem = {
      itemType: "CURRENT_MESSAGE",
      itemId: "11111111-1111-1111-1111-111111111111",
      priority: "P0",
      reason: "current user turn",
      tokensEstimated: 50,
    };
    const omitted: ContextCandidateItem = {
      itemType: "EPISODE",
      itemId: "22222222-2222-2222-2222-222222222222",
      priority: "P4",
      reason: "lowest relevance",
      tokensEstimated: 999,
      personId: "33333333-3333-3333-3333-333333333333",
    };

    const { contextRunId } = await persistContextRun(runtimePool, {
      ownerId,
      purpose: "BUDDY_RESPONSE",
      maxInputTokens: 24_000,
      maxOutputTokens: 2_048,
      fit: { included: [included], omitted: [omitted], omissionReason: "token budget 24000 exceeded — omitted 1 item(s), lowest priority first" },
    });

    const run = await adminPool.query(
      "select owner_id, purpose, input_tokens_estimated, max_input_tokens, max_output_tokens, omission_reason from context_runs where id = $1",
      [contextRunId],
    );
    expect(run.rows[0]).toMatchObject({
      owner_id: ownerId,
      purpose: "BUDDY_RESPONSE",
      input_tokens_estimated: 50,
      max_input_tokens: 24_000,
      max_output_tokens: 2_048,
    });
    expect(run.rows[0].omission_reason).toContain("omitted 1 item");

    const items = await adminPool.query(
      "select item_type, item_id, priority, included, person_id, reason from context_run_items where context_run_id = $1 order by included desc",
      [contextRunId],
    );
    expect(items.rows).toHaveLength(2);
    expect(items.rows[0]).toMatchObject({ item_type: "CURRENT_MESSAGE", priority: "P0", included: true, person_id: null });
    expect(items.rows[1]).toMatchObject({ item_type: "EPISODE", priority: "P4", included: false, person_id: omitted.personId });
  });
});
