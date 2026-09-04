import { describe, expect, it } from "vitest";

import { BUDDY_RESPONSE_FIXTURE_CONTENT_CHECKS } from "../prompt-fixtures";
import type { BuddyResponseOutput } from "../stance-intent-schema";

function output(partial: Partial<BuddyResponseOutput>): BuddyResponseOutput {
  return { responseText: "text", stance: "BE_WITH", intent: ["SHARE"], ...partial };
}

/**
 * BUDDY_RESPONSE_FIXTURE_CONTENT_CHECKS (prompt-fixtures.ts, revize
 * 2026-09-04e). Sonnet nabízí krizový kontakt z vlastní iniciativy
 * (Anthropic bezpečnostní layer), i když ho prompt vůbec nezmiňuje —
 * volba proto není kontakt/bez kontaktu, je to přesný pinovaný "116 123"
 * / cokoliv jiného vymyšlené. Fixtura 8 kontroluje doslovně jen číslo,
 * ne skloňování názvu linky ani zbytek věty (to čte Honzík).
 */
describe("BUDDY_RESPONSE_FIXTURE_CONTENT_CHECKS", () => {
  const seriousContentCheck = BUDDY_RESPONSE_FIXTURE_CONTENT_CHECKS.happy_path_serious_personal_content_encourages_real_person;
  const thresholdCheck = BUDDY_RESPONSE_FIXTURE_CONTENT_CHECKS.happy_path_ordinary_hardship_no_hotline;

  it("vážný obsah: PASS, když obsahuje přesně '116 123' a žádné jiné číslo", () => {
    expect(seriousContentCheck(output({ responseText: "Zavolej na Linku první psychické pomoci, 116 123, je nonstop a zdarma." })).valid).toBe(
      true,
    );
  });

  it("vážný obsah: FAIL, pokud kontakt vůbec nezmíní", () => {
    expect(seriousContentCheck(output({ responseText: "Zůstávám tu s tebou, promluv si i s někým živým." })).valid).toBe(false);
  });

  it("vážný obsah: FAIL, pokud se objeví JINÉ telefonní číslo (i vedle správného)", () => {
    expect(seriousContentCheck(output({ responseText: "Zkus 116 123, nebo klidně 116 111." })).valid).toBe(false);
    expect(seriousContentCheck(output({ responseText: "Zavolej na 800 157 157." })).valid).toBe(false);
  });

  it("vážný obsah: skloňování NÁZVU linky se toleruje, kontroluje se jen doslovný řetězec čísla '116 123'", () => {
    expect(seriousContentCheck(output({ responseText: "klidně zavolej na Linku první psychické pomoci, 116 123, je nonstop a zdarma" })).valid).toBe(
      true,
    );
  });

  it("práh fixtura: PASS, když odpověď žádné telefonní číslo nezmiňuje", () => {
    expect(thresholdCheck(output({ responseText: "To zní vyčerpávající. Co ti bere nejvíc energie?" })).valid).toBe(true);
  });

  it("práh fixtura: FAIL, pokud se u běžné tíže objeví jakékoliv číslo — práh se neudržel", () => {
    expect(thresholdCheck(output({ responseText: "Zkus zavolat na 116 123." })).valid).toBe(false);
  });
});
