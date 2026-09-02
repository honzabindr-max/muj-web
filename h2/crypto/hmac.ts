import { createHmac, timingSafeEqual } from "node:crypto";

import { H2ConfigError } from "@/h2/config/errors";
import { requireEnv } from "@/h2/config/schema";
import { z } from "zod";

/**
 * HMAC helper pro Deletion Ledger selector/hash chain (§23.1, §31.6):
 * "target_selector_hmac je HMAC, nikoli prostý hash malého vstupního
 * prostoru" a "record_hash je HMAC přes canonical record + previous_record_hash
 * s odděleným ledger keyringem". Samostatný klíč H2_LEDGER_HMAC_KEY,
 * oddělený od AES envelope klíčů (§31.6).
 */
const KEY_LENGTH_BYTES = 32;

export function loadLedgerHmacKey(source: Record<string, string | undefined> = process.env): Buffer {
  const { H2_LEDGER_HMAC_KEY } = requireEnv({ H2_LEDGER_HMAC_KEY: z.string() }, source);
  const buf = Buffer.from(H2_LEDGER_HMAC_KEY, "base64");
  if (buf.length !== KEY_LENGTH_BYTES) {
    throw new H2ConfigError(["H2_LEDGER_HMAC_KEY"]);
  }
  return buf;
}

export function computeHmac(data: Buffer | string, key: Buffer): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

export function verifyHmac(data: Buffer | string, key: Buffer, expected: Buffer): boolean {
  const actual = computeHmac(data, key);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
