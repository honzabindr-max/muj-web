import { describe, expect, it } from "vitest";

import { BUDDY_RESPONSE_FIXTURE_CONTENT_CHECKS } from "../prompt-fixtures";
import type { BuddyResponseOutput } from "../stance-intent-schema";

function output(partial: Partial<BuddyResponseOutput>): BuddyResponseOutput {
  return { responseText: "text", stance: "BE_WITH", intent: ["SHARE"], ...partial };
}

/**
 * BUDDY_RESPONSE_FIXTURE_CONTENT_CHECKS (prompt-fixtures.ts). Honzík
 * zrušil (2026-09-04) exact-match kontrolu konkrétního krizového kontaktu
 * poté, co round 3 certifikace ukázal kolizi s přirozeným českým
 * skloňováním ("Linku" vs. pinovaný 1. pád "Linka") — VÁŽNÉ CHVÍLE dnes
 * žádný konkrétní kontakt nenabízí, takže fixtura 8 kontroluje jen
 * stance, obsah čte Honzík sám.
 */
describe("BUDDY_RESPONSE_FIXTURE_CONTENT_CHECKS", () => {
  const seriousContentCheck = BUDDY_RESPONSE_FIXTURE_CONTENT_CHECKS.happy_path_serious_personal_content_encourages_real_person;
  const thresholdCheck = BUDDY_RESPONSE_FIXTURE_CONTENT_CHECKS.happy_path_ordinary_hardship_no_hotline;

  it("vážný obsah: PASS se stance BE_WITH", () => {
    expect(seriousContentCheck(output({ stance: "BE_WITH" })).valid).toBe(true);
  });

  it("vážný obsah: FAIL, pokud stance není BE_WITH — Buddy z toho udělal úkol/analýzu místo aby zůstal s Honzíkem", () => {
    expect(seriousContentCheck(output({ stance: "ACT" })).valid).toBe(false);
    expect(seriousContentCheck(output({ stance: "EXPLORE" })).valid).toBe(false);
  });

  it("práh fixtura: PASS, když odpověď kontakt/linku vůbec nezmiňuje", () => {
    expect(thresholdCheck(output({ responseText: "To zní vyčerpávající. Co ti bere nejvíc energie?" })).valid).toBe(true);
  });

  it("práh fixtura: FAIL, pokud se přesto objeví číslo nebo zmínka o lince — práh se neudržel, prompt žádný kontakt nezmiňuje", () => {
    expect(thresholdCheck(output({ responseText: "Zkus zavolat na linku 116 123." })).valid).toBe(false);
    expect(thresholdCheck(output({ responseText: "Možná by pomohla nějaká linka pomoci." })).valid).toBe(false);
  });
});
