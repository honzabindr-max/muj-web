import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { EncryptionKeyRegistry } from "./keys";

/**
 * AES-256-GCM envelope (§24, §31.6). Binární formát bytea sloupce:
 * [12B IV][16B auth tag][ciphertext]. `encryption_key_version` se ukládá
 * do samostatného DB sloupce vedle payloadu (viz h2/db/schema), ne uvnitř
 * envelope — díky tomu jde poznat verzi bez dešifrování.
 */
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const ALGORITHM = "aes-256-gcm";

export class H2DecryptionError extends Error {
  constructor(keyVersion: number) {
    super(`H2 crypto: key version ${keyVersion} není v registru nebo je payload poškozený`);
    this.name = "H2DecryptionError";
  }
}

export function encryptPayload(
  plaintext: Buffer,
  registry: EncryptionKeyRegistry,
): { ciphertext: Buffer; keyVersion: number } {
  const keyVersion = registry.activeVersion;
  const key = registry.keys.get(keyVersion);
  if (!key) {
    throw new H2DecryptionError(keyVersion);
  }

  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { ciphertext: Buffer.concat([iv, authTag, encrypted]), keyVersion };
}

export function decryptPayload(ciphertext: Buffer, keyVersion: number, registry: EncryptionKeyRegistry): Buffer {
  const key = registry.keys.get(keyVersion);
  if (!key) {
    throw new H2DecryptionError(keyVersion);
  }

  const iv = ciphertext.subarray(0, IV_LENGTH_BYTES);
  const authTag = ciphertext.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const encrypted = ciphertext.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch {
    throw new H2DecryptionError(keyVersion);
  }
}
