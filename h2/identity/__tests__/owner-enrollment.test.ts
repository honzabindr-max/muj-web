import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createRuntimeTestDatabase, dropTestDatabase } from "../../db/__tests__/helpers";
import { enrollOrVerifyOwner } from "../owner-enrollment";

const DB_NAME = "h2_test_owner_enrollment";

describe("enrollOrVerifyOwner (§31.1 — první enrollment, přesně jeden povolený owner)", () => {
  let pool: Pool;

  beforeEach(async () => {
    pool = await createRuntimeTestDatabase(DB_NAME);
  }, 30_000);

  afterEach(async () => {
    await dropTestDatabase(pool, DB_NAME);
  });

  it("první přihlášení enrolluje nového ownera", async () => {
    const result = await enrollOrVerifyOwner(pool, "google-sub-honzik", "Honzík");
    expect(result.rejected).toBe(false);
    if (!result.rejected) {
      expect(result.enrolled).toBe(true);
      expect(result.ownerId).toBeTruthy();
    }
  });

  it("stejný google sub podruhé vrátí stejného ownera bez nového enrollmentu", async () => {
    const first = await enrollOrVerifyOwner(pool, "google-sub-honzik", "Honzík");
    const second = await enrollOrVerifyOwner(pool, "google-sub-honzik", "Honzík");
    expect(first.rejected).toBe(false);
    expect(second.rejected).toBe(false);
    if (!first.rejected && !second.rejected) {
      expect(second.enrolled).toBe(false);
      expect(second.ownerId).toBe(first.ownerId);
    }
  });

  it("jiný google sub po enrollmentu je odmítnut — jen jeden povolený owner", async () => {
    await enrollOrVerifyOwner(pool, "google-sub-honzik", "Honzík");
    const intruder = await enrollOrVerifyOwner(pool, "google-sub-cizi-ucet", "Někdo jiný");
    expect(intruder.rejected).toBe(true);
  });

  it("souběžné první přihlášení dvou různých účtů — vyhraje právě jeden, druhý je odmítnut", async () => {
    const [a, b] = await Promise.all([
      enrollOrVerifyOwner(pool, "google-sub-a", "Účet A"),
      enrollOrVerifyOwner(pool, "google-sub-b", "Účet B"),
    ]);
    const rejectedCount = [a, b].filter((r) => r.rejected).length;
    const enrolledCount = [a, b].filter((r) => !r.rejected && r.enrolled).length;
    expect(rejectedCount).toBe(1);
    expect(enrolledCount).toBe(1);
  });
});
