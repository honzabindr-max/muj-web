import { describe, expect, it } from "vitest";

import { decryptPayload, encryptPayload, H2DecryptionError } from "../envelope";
import type { EncryptionKeyRegistry } from "../keys";

function makeRegistry(entries: Record<number, string>, activeVersion: number): EncryptionKeyRegistry {
  const keys = new Map<number, Buffer>();
  for (const [version, hex] of Object.entries(entries)) {
    keys.set(Number(version), Buffer.from(hex, "hex"));
  }
  return { activeVersion, keys };
}

const KEY_V1 = "11".repeat(32);
const KEY_V2 = "22".repeat(32);

describe("envelope encrypt/decrypt (§24 AES-256-GCM)", () => {
  it("round-trip: encryptPayload → decryptPayload vrátí původní plaintext", () => {
    const registry = makeRegistry({ 1: KEY_V1 }, 1);
    const plaintext = Buffer.from("Honzíku, jak se máš?", "utf8");
    const { ciphertext, keyVersion } = encryptPayload(plaintext, registry);
    expect(keyVersion).toBe(1);
    const decrypted = decryptPayload(ciphertext, keyVersion, registry);
    expect(decrypted.toString("utf8")).toBe("Honzíku, jak se máš?");
  });

  it("ciphertext nikdy neobsahuje plaintext jako substring", () => {
    const registry = makeRegistry({ 1: KEY_V1 }, 1);
    const plaintext = Buffer.from("citlivá zpráva o Markétce", "utf8");
    const { ciphertext } = encryptPayload(plaintext, registry);
    expect(ciphertext.toString("latin1")).not.toContain("Markétce");
  });

  it("dva encrypty téhož plaintextu dají různý ciphertext (náhodné IV)", () => {
    const registry = makeRegistry({ 1: KEY_V1 }, 1);
    const plaintext = Buffer.from("stejný text", "utf8");
    const a = encryptPayload(plaintext, registry);
    const b = encryptPayload(plaintext, registry);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it("mixed key versions jsou čitelné, dokud jsou oba klíče v registru (AT-41)", () => {
    const registryDuringRotation = makeRegistry({ 1: KEY_V1, 2: KEY_V2 }, 2);
    const oldEncrypted = encryptPayload(Buffer.from("stará zpráva"), makeRegistry({ 1: KEY_V1 }, 1));
    const newEncrypted = encryptPayload(Buffer.from("nová zpráva"), registryDuringRotation);

    expect(decryptPayload(oldEncrypted.ciphertext, 1, registryDuringRotation).toString()).toBe("stará zpráva");
    expect(decryptPayload(newEncrypted.ciphertext, 2, registryDuringRotation).toString()).toBe("nová zpráva");
  });

  it("dekrypt s neznámou key version selže bezpečnou chybou (žádná hodnota v ní)", () => {
    const registry = makeRegistry({ 1: KEY_V1 }, 1);
    const { ciphertext } = encryptPayload(Buffer.from("test"), registry);
    expect(() => decryptPayload(ciphertext, 99, registry)).toThrow(H2DecryptionError);
  });

  it("poškozený auth tag je odmítnut (integrita, ne jen důvěrnost)", () => {
    const registry = makeRegistry({ 1: KEY_V1 }, 1);
    const { ciphertext } = encryptPayload(Buffer.from("test"), registry);
    const tampered = Buffer.from(ciphertext);
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decryptPayload(tampered, 1, registry)).toThrow(H2DecryptionError);
  });

  it("dešifrování jiným klíčem než byl zašifrován selže", () => {
    const { ciphertext } = encryptPayload(Buffer.from("test"), makeRegistry({ 1: KEY_V1 }, 1));
    expect(() => decryptPayload(ciphertext, 2, makeRegistry({ 2: KEY_V2 }, 2))).toThrow(H2DecryptionError);
  });
});
