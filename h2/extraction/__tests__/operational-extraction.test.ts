import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import { extractOperationalCandidates, OPERATIONAL_EXTRACTION_PURPOSE } from "../operational-extraction";
import { H2ExtractionError } from "../errors";

const DB_NAME = "h2_test_operational_extraction";
const MODEL_ID = "claude-haiku-4-5-20251001";

/**
 * Operational extraction pod skutečnou omezenou rolí h2_runtime (BUILD-08
 * plán) — happy path (status OK), malformed output (status INVALID, ale
 * zavolalo se/zaplatilo se), missing ACTIVE prompt version (explicitní
 * chyba, ne no-op), metering rozlišitelnost od Sonnetu (Rozhodnutí 5).
 */
describe("extractOperationalCandidates() pod rolí h2_runtime", () => {
  let adminPool: Pool;
  let runtimePool: Pool;
  let ownerId: string;
  let rawEventId: string;

  beforeEach(async () => {
    adminPool = await createRuntimeTestDatabase(DB_NAME);
    runtimePool = new PgPool({
      connectionString: buildTestConnectionString(DB_NAME, { username: "h2_runtime", password: TEST_ROLE_PASSWORD }),
    });

    const owner = await adminPool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["operational-extraction-test-owner", "Honzík"],
    );
    ownerId = owner.rows[0].id;

    const rawEvent = await adminPool.query<{ id: string }>(
      `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
       values ($1, 1, 1, 'telegram', 'USER', '\\x00', 'TEXT', 1)
       returning id`,
      [ownerId],
    );
    rawEventId = rawEvent.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  async function activatePromptVersionDirectly(): Promise<void> {
    await adminPool.query(
      `insert into prompt_versions (purpose, version, status, content)
       values ($1, 1, 'ACTIVE', 'system prompt content')`,
      [OPERATIONAL_EXTRACTION_PURPOSE],
    );
  }

  function fakeCallModel(text: string, inputTokens = 100, outputTokens = 50) {
    return async () => ({ text, inputTokens, outputTokens });
  }

  it("žádná ACTIVE verze pro OPERATIONAL_EXTRACTION → explicitní chyba, ne tichý no-op", async () => {
    await expect(
      extractOperationalCandidates(runtimePool, ownerId, rawEventId, "ahoj", { anthropicApiKey: "sk-ant-test" }, fakeCallModel("{}")),
    ).rejects.toBeInstanceOf(H2ExtractionError);
  });

  it("happy path: validní kandidáti → status OK, output odpovídá vstupu, llm_runs + 2 usage_ledger řádky, metering rozlišitelnost od Sonnetu", async () => {
    await activatePromptVersionDirectly();
    const validOutput = { candidates: [{ type: "TASK", payload: { title: "Koupit mléko" }, confidence: 0.9 }] };

    const result = await extractOperationalCandidates(
      runtimePool,
      ownerId,
      rawEventId,
      "Musím koupit mléko",
      { anthropicApiKey: "sk-ant-test" },
      fakeCallModel(JSON.stringify(validOutput), 120_000, 60_000),
    );

    expect(result.status).toBe("OK");

    const extraction = await adminPool.query(
      "select status, output, extractor_version, owner_id, raw_event_id, llm_run_id from operational_extractions where id = $1",
      [result.extractionId],
    );
    expect(extraction.rows[0].status).toBe("OK");
    expect(extraction.rows[0].output).toEqual(validOutput);
    expect(extraction.rows[0].owner_id).toBe(ownerId);
    expect(extraction.rows[0].raw_event_id).toBe(rawEventId);

    const llmRuns = await adminPool.query(
      "select model_id, purpose, status, prompt_version_id from llm_runs where id = $1",
      [result.llmRunId],
    );
    expect(llmRuns.rows).toHaveLength(1);
    expect(llmRuns.rows[0].model_id).toBe(MODEL_ID);
    expect(llmRuns.rows[0].purpose).toBe(OPERATIONAL_EXTRACTION_PURPOSE);
    expect(llmRuns.rows[0].status).toBe("OK");

    const usage = await adminPool.query(
      "select unit, model_id, purpose, cost_usd, quantity from usage_ledger where owner_id = $1 order by unit",
      [ownerId],
    );
    expect(usage.rows).toHaveLength(2);
    for (const row of usage.rows) {
      expect(row.model_id).toBe(MODEL_ID);
      expect(row.purpose).toBe(OPERATIONAL_EXTRACTION_PURPOSE);
    }
    const inputUsage = usage.rows.find((r) => r.unit === "tokens_input");
    const outputUsage = usage.rows.find((r) => r.unit === "tokens_output");
    // Haiku sazba ($1/$5 za MTok), ne Sonnetova ($2/$10) — cost_usd je numeric(10,4) v DB.
    expect(Number(inputUsage.cost_usd)).toBeCloseTo((120_000 / 1_000_000) * 1, 4);
    expect(Number(outputUsage.cost_usd)).toBeCloseTo((60_000 / 1_000_000) * 5, 4);
  });

  it("malformed output: nevalidní tvar → status INVALID, přesto se zapíše llm_runs/usage, žádná jiná operational tabulka nemá nový řádek", async () => {
    await activatePromptVersionDirectly();

    const result = await extractOperationalCandidates(
      runtimePool,
      ownerId,
      rawEventId,
      "ahoj",
      { anthropicApiKey: "sk-ant-test" },
      fakeCallModel("toto neni platny json"),
    );

    expect(result.status).toBe("INVALID");

    const extraction = await adminPool.query("select status from operational_extractions where id = $1", [result.extractionId]);
    expect(extraction.rows[0].status).toBe("INVALID");

    const llmRuns = await adminPool.query("select count(*)::int as count from llm_runs where id = $1", [result.llmRunId]);
    expect(llmRuns.rows[0].count).toBe(1);

    const usage = await adminPool.query("select count(*)::int as count from usage_ledger where owner_id = $1", [ownerId]);
    expect(usage.rows[0].count).toBe(2);

    // DoD: invalid výsledek nesmí mít kam propsat škodu do jiné operational tabulky.
    const tasks = await adminPool.query("select count(*)::int as count from tasks");
    const commitments = await adminPool.query("select count(*)::int as count from commitments");
    const openLoops = await adminPool.query("select count(*)::int as count from open_loops");
    const reminders = await adminPool.query("select count(*)::int as count from reminders");
    expect(tasks.rows[0].count).toBe(0);
    expect(commitments.rows[0].count).toBe(0);
    expect(openLoops.rows[0].count).toBe(0);
    expect(reminders.rows[0].count).toBe(0);
  });
});
