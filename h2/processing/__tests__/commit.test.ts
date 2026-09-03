import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ingestMessage } from "../../ingestion/ingest-message";
import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import { bumpOwnerControlEpoch } from "../control-epoch";
import { commitJobResult } from "../commit";
import { H2FencingError } from "../errors";
import { claimNextJob } from "../lease";

const DB_NAME = "h2_test_processing_commit";

const TEST_REGISTRY = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 7)]]),
};

/**
 * commitJobResult() fencing pod skutečnou omezenou rolí h2_runtime — AT-67
 * (lease_epoch race, dva skuteční souběžní klienti), AT-71 (owner_control_
 * epoch invalidace, budoucí PAUSE/STOP primitiv) — Build Specification §6,
 * BUILD-05.
 */
describe("commitJobResult() fencing pod rolí h2_runtime", () => {
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
      ["commit-test-owner-sub", "Honzík"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  async function ingestUserText(externalEventId: string): Promise<string> {
    const result = await ingestMessage(runtimePool, TEST_REGISTRY, {
      ownerId,
      channel: "telegram",
      speaker: "USER",
      externalEventId,
      payloadType: "TEXT",
      payloadPlaintext: Buffer.from(`msg-${externalEventId}`, "utf8"),
    });
    if (result.duplicate) throw new Error("unexpected duplicate in test setup");
    return result.rawEventId;
  }

  it("AT-67: dva skuteční souběžní procesoři — jen ten s aktuálním lease_epoch commitne, druhý dostane explicitní fencing chybu", async () => {
    const rawEventId = await ingestUserText("fencing-race");

    const claimA = await claimNextJob(runtimePool, ownerId, "processor-a");
    expect(claimA).not.toBeNull();

    // Lease A vyprší (procesor zmrzl, ale — na rozdíl od AT-03/07 —
    // tentokrát ho pořád ještě necháme dokončit, aby závodil s B).
    await adminPool.query("update owner_processing_state set lease_until = now() - interval '1 minute' where owner_id = $1", [
      ownerId,
    ]);

    const claimB = await claimNextJob(runtimePool, ownerId, "processor-b");
    expect(claimB).not.toBeNull();
    expect(claimB?.jobId).toBe(claimA?.jobId);
    expect(claimB?.leaseEpoch).toBeGreaterThan(claimA!.leaseEpoch);

    // Skutečný závod: dvě nezávislé DB transakce spuštěné přes Promise.all,
    // ne sekvenčně. commitJobResult otevírá vlastní pool.connect() uvnitř
    // withOwnerScope, takže jde o dvě opravdové souběžné connections.
    const [settledA, settledB] = await Promise.allSettled([
      commitJobResult(runtimePool, TEST_REGISTRY, claimA!, async () => ({
        responsePayloadPlaintext: Buffer.from("odpověď A (neaktuální)", "utf8"),
      })),
      commitJobResult(runtimePool, TEST_REGISTRY, claimB!, async () => ({
        responsePayloadPlaintext: Buffer.from("odpověď B (aktuální)", "utf8"),
      })),
    ]);

    expect(settledA.status).toBe("rejected");
    if (settledA.status === "rejected") {
      expect(settledA.reason).toBeInstanceOf(H2FencingError);
    }
    expect(settledB.status).toBe("fulfilled");

    const responses = await adminPool.query("select count(*)::int as n from responses where source_raw_event_id = $1", [
      rawEventId,
    ]);
    expect(responses.rows[0].n).toBe(1);

    const job = await adminPool.query("select status from message_processing_jobs where raw_event_id = $1", [rawEventId]);
    expect(job.rows[0].status).toBe("RESPONSE_READY");
  });

  it("AT-71: bumpOwnerControlEpoch() invaliduje rozpracovaný fencing token stejně jako lease_epoch", async () => {
    const rawEventId = await ingestUserText("control-epoch-invalidation");

    const claim = await claimNextJob(runtimePool, ownerId, "processor-a");
    expect(claim).not.toBeNull();

    // Simuluje budoucí explicitní PAUSE/STOP command (BUILD-12) bez
    // nutnosti stavět skutečný command parser.
    const newControlEpoch = await bumpOwnerControlEpoch(runtimePool, ownerId);
    expect(newControlEpoch).toBeGreaterThan(claim!.ownerControlEpoch);

    await expect(
      commitJobResult(runtimePool, TEST_REGISTRY, claim!, async () => ({
        responsePayloadPlaintext: Buffer.from("odpověď po PAUSE", "utf8"),
      })),
    ).rejects.toBeInstanceOf(H2FencingError);

    const responses = await adminPool.query("select count(*)::int as n from responses where source_raw_event_id = $1", [
      rawEventId,
    ]);
    expect(responses.rows[0].n).toBe(0);

    const job = await adminPool.query("select status from message_processing_jobs where raw_event_id = $1", [rawEventId]);
    expect(job.rows[0].status).toBe("PROCESSING");
  });
});
