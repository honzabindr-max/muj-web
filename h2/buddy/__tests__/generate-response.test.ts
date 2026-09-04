import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import { ingestMessage } from "../../ingestion/ingest-message";
import { claimNextJob } from "../../processing/lease";
import { H2BuddyRuntimeError } from "../errors";
import { generateBuddyResponse } from "../generate-response";

const DB_NAME = "h2_test_buddy_generate_response";
const BUDDY_RESPONSE_PURPOSE = "BUDDY_RESPONSE";
const CREDENTIALS = { anthropicApiKey: "sk-ant-test" };

const TEST_REGISTRY = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 7)]]),
};

/**
 * generateBuddyResponse() pod rolí h2_runtime (BUILD-10 plán DoD:
 * AT-09, AT-50, AT-62 + Command Gate re-detekce, DEC-007 bod 5).
 * Mockovaný `callAnthropicModel` (stejná disciplína jako BUILD-07/08/09)
 * — žádné reálné Sonnet volání v automatických testech.
 */
describe("generateBuddyResponse() pod rolí h2_runtime", () => {
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
      ["buddy-runtime-test-owner", "Honzík"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  async function activateBuddyPrompt(): Promise<void> {
    await adminPool.query(
      `insert into prompt_versions (purpose, version, status, content) values ($1, 1, 'ACTIVE', 'system prompt content')`,
      [BUDDY_RESPONSE_PURPOSE],
    );
  }

  async function ingestText(externalEventId: string, text: string): Promise<{ rawEventId: string; jobId: string }> {
    const result = await ingestMessage(runtimePool, TEST_REGISTRY, {
      ownerId,
      channel: "telegram",
      speaker: "USER",
      externalEventId,
      payloadType: "TEXT",
      payloadPlaintext: Buffer.from(text, "utf8"),
    });
    if (result.duplicate) throw new Error("unexpected duplicate in test setup");
    if (!result.jobId) throw new Error("expected job for USER speaker");
    return { rawEventId: result.rawEventId, jobId: result.jobId };
  }

  function fakeCallModel(text: string, inputTokens = 1000, outputTokens = 200) {
    return async () => ({ text, inputTokens, outputTokens });
  }

  const callModelMustNotBeCalled = async () => {
    throw new Error("callModel se nesmělo vůbec zavolat");
  };

  it("žádná ACTIVE verze pro BUDDY_RESPONSE → explicitní chyba, ne tichý no-op", async () => {
    const { rawEventId } = await ingestText("no-prompt", "Ahoj Buddy");
    const claim = await claimNextJob(runtimePool, ownerId, "processor-a");
    expect(claim?.rawEventId).toBe(rawEventId);

    await expect(
      generateBuddyResponse(runtimePool, TEST_REGISTRY, CREDENTIALS, claim!, fakeCallModel("{}")),
    ).rejects.toMatchObject({ code: "NO_ACTIVE_PROMPT" });
  });

  it("AT-62/AT-09: response už existuje pro source_raw_event_id → retry nevolá Sonnet znovu ani nevytvoří druhý responses řádek", async () => {
    await activateBuddyPrompt();
    const { rawEventId } = await ingestText("happy-path", "Ahoj, jak se máš?");
    const claim = await claimNextJob(runtimePool, ownerId, "processor-a");

    const validOutput = { responseText: "Ahoj! Mám se dobře, díky.", stance: "BE_WITH", intent: ["SHARE"] };
    const first = await generateBuddyResponse(
      runtimePool,
      TEST_REGISTRY,
      CREDENTIALS,
      claim!,
      fakeCallModel(JSON.stringify(validOutput), 5000, 300),
    );
    expect(first.reused).toBe(false);
    if (!first.reused) {
      expect(first.stance).toBe("BE_WITH");
      expect(first.intent).toEqual(["SHARE"]);
    }

    const responsesAfterFirst = await adminPool.query("select count(*)::int as n from responses where source_raw_event_id = $1", [
      rawEventId,
    ]);
    expect(responsesAfterFirst.rows[0].n).toBe(1);
    const llmRunsAfterFirst = await adminPool.query("select count(*)::int as n from llm_runs where owner_id = $1", [ownerId]);
    expect(llmRunsAfterFirst.rows[0].n).toBe(1);
    const usageAfterFirst = await adminPool.query("select count(*)::int as n from usage_ledger where owner_id = $1", [ownerId]);
    expect(usageAfterFirst.rows[0].n).toBe(2);

    // Retry se stejným (crash-simulovaným) tokenem — AT-09/AT-62: nesmí zavolat
    // Sonnet znovu ani vytvořit druhý responses řádek, jen vrátí existující ID.
    const second = await generateBuddyResponse(runtimePool, TEST_REGISTRY, CREDENTIALS, claim!, callModelMustNotBeCalled);
    expect(second.reused).toBe(true);
    expect(second.responseId).toBe(first.responseId);

    const responsesAfterSecond = await adminPool.query("select count(*)::int as n from responses where source_raw_event_id = $1", [
      rawEventId,
    ]);
    expect(responsesAfterSecond.rows[0].n).toBe(1);
    const llmRunsAfterSecond = await adminPool.query("select count(*)::int as n from llm_runs where owner_id = $1", [ownerId]);
    expect(llmRunsAfterSecond.rows[0].n).toBe(1);
  });

  it("AT-50: neplatný/zfalšovaný Sonnet výstup → žádný responses řádek, přesto llm_runs/usage zapsané, job zůstává PROCESSING", async () => {
    await activateBuddyPrompt();
    const { rawEventId, jobId } = await ingestText("malformed", "Něco jiného");
    const claim = await claimNextJob(runtimePool, ownerId, "processor-a");

    await expect(
      generateBuddyResponse(runtimePool, TEST_REGISTRY, CREDENTIALS, claim!, fakeCallModel("toto neni platny json", 800, 0)),
    ).rejects.toBeInstanceOf(H2BuddyRuntimeError);

    const responses = await adminPool.query("select count(*)::int as n from responses where source_raw_event_id = $1", [rawEventId]);
    expect(responses.rows[0].n).toBe(0);

    const llmRuns = await adminPool.query("select status from llm_runs where owner_id = $1", [ownerId]);
    expect(llmRuns.rows).toHaveLength(1);
    expect(llmRuns.rows[0].status).toBe("OK");
    const usage = await adminPool.query("select count(*)::int as n from usage_ledger where owner_id = $1", [ownerId]);
    expect(usage.rows[0].n).toBe(2);

    const job = await adminPool.query("select status from message_processing_jobs where id = $1", [jobId]);
    expect(job.rows[0].status).toBe("PROCESSING");
  });

  it("AT-50: stance mimo enum (fabrikovaný výstup) → stejná explicitní chyba, ne tichý fallback", async () => {
    await activateBuddyPrompt();
    await ingestText("bad-stance", "Ahoj");
    const claim = await claimNextJob(runtimePool, ownerId, "processor-a");

    const bogusOutput = { responseText: "ahoj", stance: "AGGRESSIVE_SELL", intent: ["SHARE"] };
    await expect(
      generateBuddyResponse(runtimePool, TEST_REGISTRY, CREDENTIALS, claim!, fakeCallModel(JSON.stringify(bogusOutput))),
    ).rejects.toBeInstanceOf(H2BuddyRuntimeError);
  });

  it("AT-50: prázdné pole intent (0 hodnot) → stejná explicitní chyba — Product Spec §5 vyžaduje aspoň jeden intent", async () => {
    await activateBuddyPrompt();
    await ingestText("empty-intent", "Ahoj");
    const claim = await claimNextJob(runtimePool, ownerId, "processor-a");

    const bogusOutput = { responseText: "ahoj", stance: "BE_WITH", intent: [] };
    await expect(
      generateBuddyResponse(runtimePool, TEST_REGISTRY, CREDENTIALS, claim!, fakeCallModel(JSON.stringify(bogusOutput))),
    ).rejects.toBeInstanceOf(H2BuddyRuntimeError);
  });

  it("více intentů na jednu zprávu (Product Spec §5: 'jedna zpráva může mít několik intentů') → validní, resolveuje všechny", async () => {
    await activateBuddyPrompt();
    await ingestText("multi-intent", "Zítra musím zavolat účetní a mimochodem mě napadl nový nápad na projekt");
    const claim = await claimNextJob(runtimePool, ownerId, "processor-a");

    const multiIntentOutput = { responseText: "Jasně, poznamenám si obojí.", stance: "ACT", intent: ["TASK", "IDEA"] };
    const result = await generateBuddyResponse(
      runtimePool,
      TEST_REGISTRY,
      CREDENTIALS,
      claim!,
      fakeCallModel(JSON.stringify(multiIntentOutput)),
    );
    expect(result.reused).toBe(false);
    if (!result.reused) {
      expect(result.intent).toEqual(["TASK", "IDEA"]);
    }
  });

  it("Command Gate (DEC-007 bod 5): přesný /stop → no-op potvrzení, epoch bumpnutý jen jednou (při ingestu), Sonnet se nevolá", async () => {
    const { rawEventId } = await ingestText("stop-cmd", "/stop");
    const claim = await claimNextJob(runtimePool, ownerId, "processor-a");
    // Ingest (DEC-007 bod 2) už bumpnul epoch ve stejné transakci jako raw_event/job.
    expect(claim?.ownerControlEpoch).toBe(BigInt(1));

    const result = await generateBuddyResponse(runtimePool, TEST_REGISTRY, CREDENTIALS, claim!, callModelMustNotBeCalled);
    expect(result.reused).toBe(false);
    if (!result.reused) {
      expect(result.isControlCommandAck).toBe(true);
      expect(result.stance).toBeNull();
    }

    const responses = await adminPool.query("select count(*)::int as n from responses where source_raw_event_id = $1", [rawEventId]);
    expect(responses.rows[0].n).toBe(1);

    // DEC-007 bod 5 — Command Gate re-detekuje stejnou funkcí a NESMÍ bumpnout znovu.
    const state = await adminPool.query("select owner_control_epoch from owner_processing_state where owner_id = $1", [ownerId]);
    expect(BigInt(state.rows[0].owner_control_epoch)).toBe(BigInt(1));
  });
});
