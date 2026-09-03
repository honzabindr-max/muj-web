import { describe, expect, it } from "vitest";

import { fitToBudget } from "../budget-fit";
import { H2ContextBudgetError } from "../errors";
import type { ContextCandidateItem } from "../priority";

function item(overrides: Partial<ContextCandidateItem> & Pick<ContextCandidateItem, "itemType" | "priority" | "tokensEstimated">): ContextCandidateItem {
  return {
    itemId: "00000000-0000-0000-0000-000000000000",
    reason: "test",
    ...overrides,
  };
}

describe("fitToBudget() (§7.4, AT-58)", () => {
  it("vše se vejde → nic se neodřízne, omissionReason je null", () => {
    const p0 = [item({ itemType: "CURRENT_MESSAGE", priority: "P0", tokensEstimated: 100 })];
    const other = [item({ itemType: "PROJECT", priority: "P1", tokensEstimated: 200 })];

    const result = fitToBudget(p0, other, 1000);

    expect(result.included).toHaveLength(2);
    expect(result.omitted).toHaveLength(0);
    expect(result.omissionReason).toBeNull();
  });

  it("AT-58: overflow odřízne jen nižší priority, P0 vždy zůstane, omitted_item_ids auditované", () => {
    const p0 = [item({ itemType: "CURRENT_MESSAGE", priority: "P0", tokensEstimated: 100 })];
    const p1 = item({ itemType: "PROJECT", priority: "P1", tokensEstimated: 400, itemId: "p1" });
    const p4 = item({ itemType: "EPISODE", priority: "P4", tokensEstimated: 400, itemId: "p4" });

    const result = fitToBudget(p0, [p1, p4], 500);

    expect(result.included.map((i) => i.itemId)).toEqual([p0[0].itemId, "p1"]);
    expect(result.omitted.map((i) => i.itemId)).toEqual(["p4"]);
    expect(result.omissionReason).toContain("1 item");
  });

  it("P0 samo přesahuje budget → H2ContextBudgetError('P0_EXCEEDS_BUDGET'), ne tiché ořezání", () => {
    const p0 = [item({ itemType: "CURRENT_MESSAGE", priority: "P0", tokensEstimated: 5000 })];

    expect(() => fitToBudget(p0, [], 1000)).toThrow(H2ContextBudgetError);
    try {
      fitToBudget(p0, [], 1000);
    } catch (error) {
      expect((error as H2ContextBudgetError).code).toBe("P0_EXCEEDS_BUDGET");
    }
  });

  it("priorita se odřezává deterministicky P4 → P1, ne podle pořadí ve vstupu", () => {
    const p0 = [item({ itemType: "CURRENT_MESSAGE", priority: "P0", tokensEstimated: 0 })];
    // P4 první ve vstupním poli, ale P1 má přednost při zařazování.
    const p4 = item({ itemType: "EPISODE", priority: "P4", tokensEstimated: 300, itemId: "p4" });
    const p1 = item({ itemType: "PROJECT", priority: "P1", tokensEstimated: 300, itemId: "p1" });

    const result = fitToBudget(p0, [p4, p1], 300);

    expect(result.included.map((i) => i.itemId)).toContain("p1");
    expect(result.omitted.map((i) => i.itemId)).toEqual(["p4"]);
  });
});
