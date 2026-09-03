import { describe, expect, it } from "vitest";

import { CONTEXT_TOKEN_BUDGETS, estimateTokens } from "../token-budget";

describe("CONTEXT_TOKEN_BUDGETS (Technical Architecture v1.2 §7.4)", () => {
  it("obsahuje přesně 7 purposes se stropy z §7.4 tabulky", () => {
    expect(CONTEXT_TOKEN_BUDGETS).toEqual({
      BUDDY_RESPONSE: { maxInputTokens: 24_000, maxOutputTokens: 2_048 },
      BUDDY_DEEP_DIVE: { maxInputTokens: 48_000, maxOutputTokens: 8_192 },
      OPERATIONAL_EXTRACTION: { maxInputTokens: 8_000, maxOutputTokens: 2_048 },
      BLIND_EXTRACTION: { maxInputTokens: 8_000, maxOutputTokens: 2_048 },
      WEEKLY_FACTUAL_REVIEW: { maxInputTokens: 32_000, maxOutputTokens: 4_096 },
      WEEKLY_EPISTEMIC_REVIEW: { maxInputTokens: 48_000, maxOutputTokens: 6_144 },
      MONTHLY_REVIEW: { maxInputTokens: 80_000, maxOutputTokens: 8_192 },
    });
  });
});

describe("estimateTokens()", () => {
  it("prázdný text → 0 tokenů", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("delší text → víc tokenů, monotónně rostoucí", () => {
    const short = estimateTokens("ahoj");
    const long = estimateTokens("ahoj ".repeat(1000));
    expect(long).toBeGreaterThan(short);
  });

  it("8000 znaků odhadne přes 2000 tokenů (konzervativní ~3.5 chars/token)", () => {
    expect(estimateTokens("a".repeat(8000))).toBeGreaterThan(2000);
  });
});
