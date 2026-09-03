import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import { markRecentReauth } from "../../identity/session";
import { activatePromptVersion, rollbackPromptVersion } from "../activation";
import { H2PromptActivationError } from "../errors";
import type { PromptFixture } from "../fixtures";
import { runPromptFixtureSuite } from "../fixtures";
import { checkModelDrift } from "../model-drift";
import { createDraftPromptVersion } from "../registry";

const DB_NAME = "h2_test_prompt_registry_activation";
const MODEL_ID = "claude-haiku-4-5-20251001";

/**
 * Prompt registry lifecycle pod skutečnou omezenou rolí h2_runtime — AT-33,
 * AT-34, AT-35, AT-36, AT-63 (Build Specification §6, BUILD-07), plus
 * Anthropic metering atomicita (docs/h2/BUILD-07-PLAN.md Rozhodnutí 3).
 */
describe("prompt registry & activation pod rolí h2_runtime", () => {
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
      ["prompt-registry-test-owner", "Honzík"],
    );
    ownerId = owner.rows[0].id;
    await markRecentReauth(runtimePool, ownerId);
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  const passingFixture: PromptFixture = { name: "happy", input: "ahoj", kind: "happy_path", expectedValid: true };
  const failingFixture: PromptFixture = { name: "malformed", input: "ahoj", kind: "malformed_input", expectedValid: true };

  function fakeCallModel(text: string, inputTokens = 100, outputTokens = 50) {
    return async () => ({ text, inputTokens, outputTokens });
  }

  const acceptOnlyValidOutput = (text: string) => ({ valid: text === "valid-output", errorSummary: text === "valid-output" ? undefined : "schema mismatch" });

  it("AT-33: DRAFT bez passing test run → activatePromptVersion() odmítnuto, status zůstává DRAFT", async () => {
    const draft = await createDraftPromptVersion(runtimePool, "TEST_PURPOSE_33", "prompt content");

    await expect(activatePromptVersion(runtimePool, ownerId, draft.id, MODEL_ID, 1, "v1")).rejects.toBeInstanceOf(
      H2PromptActivationError,
    );

    const row = await adminPool.query("select status from prompt_versions where id = $1", [draft.id]);
    expect(row.rows[0].status).toBe("DRAFT");
  });

  it("AT-34 + metering: fixture s invalid schema outputem → FAIL, activation blocked, ale usage/llm_runs se přesto zapsaly", async () => {
    const draft = await createDraftPromptVersion(runtimePool, "TEST_PURPOSE_34", "prompt content");

    const suite = await runPromptFixtureSuite(runtimePool, ownerId, {
      promptVersionId: draft.id,
      purpose: "TEST_PURPOSE_34",
      modelId: MODEL_ID,
      promptContent: "prompt content",
      schemaVersion: 1,
      fixtureSetVersion: "v1",
      fixtures: [failingFixture],
      callModel: fakeCallModel("invalid-json"),
      validateOutput: acceptOnlyValidOutput,
    });
    expect(suite.status).toBe("FAIL");

    await expect(activatePromptVersion(runtimePool, ownerId, draft.id, MODEL_ID, 1, "v1")).rejects.toBeInstanceOf(
      H2PromptActivationError,
    );

    // Zavolalo se, zaplatilo se — i když aktivace neprošla (Rozhodnutí 3).
    const usage = await adminPool.query("select unit, quantity from usage_ledger where owner_id = $1 order by unit", [ownerId]);
    expect(usage.rows).toHaveLength(2);
    expect(usage.rows.map((r) => r.unit).sort()).toEqual(["tokens_input", "tokens_output"]);

    const llmRuns = await adminPool.query("select model_id, status, prompt_version_id from llm_runs where owner_id = $1", [ownerId]);
    expect(llmRuns.rows).toHaveLength(1);
    expect(llmRuns.rows[0].status).toBe("OK");
    expect(llmRuns.rows[0].model_id).toBe(MODEL_ID);
  });

  it("AT-36 + happy path: passing fixture suite → activation uspěje, llm_runs má plnou provenance", async () => {
    const draft = await createDraftPromptVersion(runtimePool, "TEST_PURPOSE_36", "prompt content");

    const suite = await runPromptFixtureSuite(runtimePool, ownerId, {
      promptVersionId: draft.id,
      purpose: "TEST_PURPOSE_36",
      modelId: MODEL_ID,
      promptContent: "prompt content",
      schemaVersion: 1,
      fixtureSetVersion: "v1",
      fixtures: [passingFixture],
      callModel: fakeCallModel("valid-output"),
      validateOutput: acceptOnlyValidOutput,
    });
    expect(suite.status).toBe("PASS");

    await activatePromptVersion(runtimePool, ownerId, draft.id, MODEL_ID, 1, "v1");

    const row = await adminPool.query("select status, activated_at from prompt_versions where id = $1", [draft.id]);
    expect(row.rows[0].status).toBe("ACTIVE");
    expect(row.rows[0].activated_at).not.toBeNull();

    const llmRuns = await adminPool.query(
      "select model_id, prompt_version_id, schema_version, input_reference_manifest from llm_runs where owner_id = $1",
      [ownerId],
    );
    expect(llmRuns.rows).toHaveLength(1);
    expect(llmRuns.rows[0].model_id).toBe(MODEL_ID);
    expect(llmRuns.rows[0].prompt_version_id).toBe(draft.id);
    expect(llmRuns.rows[0].schema_version).toBe(1);
    expect(llmRuns.rows[0].input_reference_manifest).not.toBeNull();
  });

  it("AT-35: rollback vrátí přesnou minulou version, ne edit historie ani novou verzi", async () => {
    const purpose = "TEST_PURPOSE_35";
    const v1 = await createDraftPromptVersion(runtimePool, purpose, "content v1");
    await runPromptFixtureSuite(runtimePool, ownerId, {
      promptVersionId: v1.id,
      purpose,
      modelId: MODEL_ID,
      promptContent: "content v1",
      schemaVersion: 1,
      fixtureSetVersion: "v1",
      fixtures: [passingFixture],
      callModel: fakeCallModel("valid-output"),
      validateOutput: acceptOnlyValidOutput,
    });
    await activatePromptVersion(runtimePool, ownerId, v1.id, MODEL_ID, 1, "v1");

    const v2 = await createDraftPromptVersion(runtimePool, purpose, "content v2");
    await runPromptFixtureSuite(runtimePool, ownerId, {
      promptVersionId: v2.id,
      purpose,
      modelId: MODEL_ID,
      promptContent: "content v2",
      schemaVersion: 1,
      fixtureSetVersion: "v1",
      fixtures: [passingFixture],
      callModel: fakeCallModel("valid-output"),
      validateOutput: acceptOnlyValidOutput,
    });
    await activatePromptVersion(runtimePool, ownerId, v2.id, MODEL_ID, 1, "v1");

    await rollbackPromptVersion(runtimePool, ownerId, purpose, 1);

    const versions = await adminPool.query("select version, status, content from prompt_versions where purpose = $1 order by version", [
      purpose,
    ]);
    expect(versions.rows).toHaveLength(2);
    expect(versions.rows[0]).toMatchObject({ version: 1, status: "ACTIVE", content: "content v1" });
    expect(versions.rows[1]).toMatchObject({ version: 2, status: "RETIRED" });
  });

  it("AT-63: model drift detekován (health) a aktivace s nekertifikovaným model_id odmítnuta", async () => {
    const purpose = "BUDDY_RESPONSE";
    const draft = await createDraftPromptVersion(runtimePool, purpose, "prompt content");
    await runPromptFixtureSuite(runtimePool, ownerId, {
      promptVersionId: draft.id,
      purpose,
      modelId: "claude-sonnet-5",
      promptContent: "prompt content",
      schemaVersion: 1,
      fixtureSetVersion: "v1",
      fixtures: [passingFixture],
      callModel: fakeCallModel("valid-output"),
      validateOutput: acceptOnlyValidOutput,
    });
    await activatePromptVersion(runtimePool, ownerId, draft.id, "claude-sonnet-5", 1, "v1");

    const noDrift = await checkModelDrift(runtimePool, ownerId, purpose);
    expect(noDrift).toMatchObject({ configuredModelId: "claude-sonnet-5", certifiedModelId: "claude-sonnet-5", drift: false });

    // Změna model_id bez passing test runu pro NOVOU kombinaci → activation blocked.
    await expect(
      activatePromptVersion(runtimePool, ownerId, draft.id, "claude-opus-5", 1, "v1"),
    ).rejects.toBeInstanceOf(H2PromptActivationError);

    // Health hlásí mismatch, pokud se pinned config (simulovaně) změní.
    const drifted = await checkModelDrift(runtimePool, ownerId, purpose, "claude-opus-5");
    expect(drifted).toMatchObject({ configuredModelId: "claude-opus-5", certifiedModelId: "claude-sonnet-5", drift: true });
  });
});
