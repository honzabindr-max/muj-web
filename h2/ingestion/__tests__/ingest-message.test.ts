import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildTestConnectionString,
  createRuntimeTestDatabase,
  dropTestDatabase,
  TEST_ROLE_PASSWORD,
} from "../../db/__tests__/helpers";
import { ingestMessage } from "../ingest-message";

const DB_NAME = "h2_test_ingest_message";

const TEST_REGISTRY = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 7)]]),
};

/**
 * Celý ingestMessage() pod skutečnou omezenou rolí h2_runtime, ne adminem
 * (poučení z BUILD-03A hotfixu — RLS/GRANT mezery unikaly testům pod
 * superuserem). AT-01, AT-02, AT-61 (Build Specification §6, BUILD-04).
 */
describe("ingestMessage() pod rolí h2_runtime", () => {
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
      ["ingest-test-owner-sub", "Honzík"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  it("AT-01: USER text ingest commitne raw_event + message_processing_job v jedné transakci", async () => {
    const result = await ingestMessage(runtimePool, TEST_REGISTRY, {
      ownerId,
      channel: "telegram",
      speaker: "USER",
      externalEventId: "tg-update-1",
      payloadType: "TEXT",
      payloadPlaintext: Buffer.from("ahoj", "utf8"),
    });
    expect(result.duplicate).toBe(false);
    if (result.duplicate) return;
    expect(result.jobId).not.toBeNull();

    const rawEvent = await adminPool.query(
      "select input_sequence, conversation_sequence, speaker from raw_events where id = $1",
      [result.rawEventId],
    );
    expect(rawEvent.rows).toHaveLength(1);
    expect(rawEvent.rows[0].speaker).toBe("USER");
    expect(rawEvent.rows[0].input_sequence).not.toBeNull();

    const job = await adminPool.query("select status, raw_event_id from message_processing_jobs where id = $1", [
      result.jobId,
    ]);
    expect(job.rows).toHaveLength(1);
    expect(job.rows[0].status).toBe("PENDING");
    expect(job.rows[0].raw_event_id).toBe(result.rawEventId);
  });

  it("AT-02: duplicitní external_event_id na stejném kanálu vytvoří právě jeden raw_event", async () => {
    const first = await ingestMessage(runtimePool, TEST_REGISTRY, {
      ownerId,
      channel: "telegram",
      speaker: "USER",
      externalEventId: "tg-update-dup",
      payloadType: "TEXT",
      payloadPlaintext: Buffer.from("ahoj", "utf8"),
    });
    const second = await ingestMessage(runtimePool, TEST_REGISTRY, {
      ownerId,
      channel: "telegram",
      speaker: "USER",
      externalEventId: "tg-update-dup",
      payloadType: "TEXT",
      payloadPlaintext: Buffer.from("ahoj znovu", "utf8"),
    });

    expect(second.duplicate).toBe(true);
    expect(second.rawEventId).toBe(first.duplicate ? undefined : first.rawEventId);

    const count = await adminPool.query(
      "select count(*)::int as n from raw_events where owner_id = $1 and channel = 'telegram' and external_event_id = 'tg-update-dup'",
      [ownerId],
    );
    expect(count.rows[0].n).toBe(1);

    const jobs = await adminPool.query("select count(*)::int as n from message_processing_jobs where owner_id = $1", [
      ownerId,
    ]);
    expect(jobs.rows[0].n).toBe(1);
  });

  it("AT-61: speaker=BUDDY → input_sequence NULL a žádný message_processing_job nevznikne", async () => {
    const result = await ingestMessage(runtimePool, TEST_REGISTRY, {
      ownerId,
      channel: "telegram",
      speaker: "BUDDY",
      externalEventId: null,
      payloadType: "TEXT",
      payloadPlaintext: Buffer.from("odpověď", "utf8"),
    });
    expect(result.duplicate).toBe(false);
    if (result.duplicate) return;
    expect(result.jobId).toBeNull();

    const rawEvent = await adminPool.query("select input_sequence, speaker from raw_events where id = $1", [
      result.rawEventId,
    ]);
    expect(rawEvent.rows[0].speaker).toBe("BUDDY");
    expect(rawEvent.rows[0].input_sequence).toBeNull();

    const jobs = await adminPool.query("select count(*)::int as n from message_processing_jobs where raw_event_id = $1", [
      result.rawEventId,
    ]);
    expect(jobs.rows[0].n).toBe(0);
  });

  it("AT-61: speaker=SYSTEM → input_sequence NULL a žádný message_processing_job nevznikne", async () => {
    const result = await ingestMessage(runtimePool, TEST_REGISTRY, {
      ownerId,
      channel: "web",
      speaker: "SYSTEM",
      externalEventId: null,
      payloadType: "SYSTEM_EVENT",
      payloadPlaintext: Buffer.from("system-event", "utf8"),
    });
    expect(result.duplicate).toBe(false);
    if (result.duplicate) return;
    expect(result.jobId).toBeNull();

    const rawEvent = await adminPool.query("select input_sequence, speaker from raw_events where id = $1", [
      result.rawEventId,
    ]);
    expect(rawEvent.rows[0].speaker).toBe("SYSTEM");
    expect(rawEvent.rows[0].input_sequence).toBeNull();
  });

  it("atomicita: selhání šifrování (neznámá key version) nesmí zapsat částečný raw_event", async () => {
    const brokenRegistry = { activeVersion: 99, keys: new Map<number, Buffer>() };
    await expect(
      ingestMessage(runtimePool, brokenRegistry, {
        ownerId,
        channel: "telegram",
        speaker: "USER",
        externalEventId: "tg-update-broken",
        payloadType: "TEXT",
        payloadPlaintext: Buffer.from("x", "utf8"),
      }),
    ).rejects.toThrow();

    const count = await adminPool.query("select count(*)::int as n from raw_events where owner_id = $1", [ownerId]);
    expect(count.rows[0].n).toBe(0);
  });

  it("AT-48: telegram i web ingest přes stejnou ingestMessage() produkují strukturálně shodné raw_events", async () => {
    const telegramResult = await ingestMessage(runtimePool, TEST_REGISTRY, {
      ownerId,
      channel: "telegram",
      speaker: "USER",
      externalEventId: "tg-shared-pipeline",
      payloadType: "TEXT",
      payloadPlaintext: Buffer.from("z telegramu", "utf8"),
    });
    const webResult = await ingestMessage(runtimePool, TEST_REGISTRY, {
      ownerId,
      channel: "web",
      speaker: "USER",
      externalEventId: "web-shared-pipeline",
      payloadType: "TEXT",
      payloadPlaintext: Buffer.from("z webu", "utf8"),
    });

    for (const result of [telegramResult, webResult]) {
      expect(result.duplicate).toBe(false);
      if (result.duplicate) continue;
      expect(result.jobId).not.toBeNull();
      const job = await adminPool.query("select status from message_processing_jobs where id = $1", [result.jobId]);
      expect(job.rows[0].status).toBe("PENDING");
    }
  });
});
