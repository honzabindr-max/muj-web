import { describe, expect, it } from "vitest";

import { H2ConfigError } from "@/h2/config/errors";

import { computeHmac, loadLedgerHmacKey, verifyHmac } from "../hmac";

const VALID_KEY = Buffer.alloc(32, 3);

describe("ledger HMAC (§23.1, §31.6 — selector je HMAC, ne prostý hash)", () => {
  it("stejný vstup + klíč dá stejný HMAC (deterministické, testovatelné pro chain verify)", () => {
    const a = computeHmac("deletion-selector-123", VALID_KEY);
    const b = computeHmac("deletion-selector-123", VALID_KEY);
    expect(a.equals(b)).toBe(true);
  });

  it("jiný vstup dá jiný HMAC", () => {
    const a = computeHmac("selector-a", VALID_KEY);
    const b = computeHmac("selector-b", VALID_KEY);
    expect(a.equals(b)).toBe(false);
  });

  it("jiný klíč dá jiný HMAC pro stejný vstup", () => {
    const a = computeHmac("selector", VALID_KEY);
    const b = computeHmac("selector", Buffer.alloc(32, 4));
    expect(a.equals(b)).toBe(false);
  });

  it("verifyHmac potvrdí platný pár a odmítne neplatný", () => {
    const mac = computeHmac("record-hash-input", VALID_KEY);
    expect(verifyHmac("record-hash-input", VALID_KEY, mac)).toBe(true);
    expect(verifyHmac("record-hash-input", VALID_KEY, computeHmac("jiny-input", VALID_KEY))).toBe(false);
  });
});

describe("loadLedgerHmacKey", () => {
  it("načte a dekóduje H2_LEDGER_HMAC_KEY z base64", () => {
    const key = loadLedgerHmacKey({ H2_LEDGER_HMAC_KEY: VALID_KEY.toString("base64") });
    expect(key.equals(VALID_KEY)).toBe(true);
  });

  it("selže bezpečnou chybou při chybějící proměnné", () => {
    expect(() => loadLedgerHmacKey({})).toThrow(H2ConfigError);
  });

  it("selže při nesprávné délce klíče", () => {
    expect(() =>
      loadLedgerHmacKey({ H2_LEDGER_HMAC_KEY: Buffer.alloc(10).toString("base64") }),
    ).toThrow(H2ConfigError);
  });
});
