import { describe, expect, it } from "vitest";

import { H2ConfigError } from "@/h2/config/errors";

import { loadEncryptionKeyRegistry } from "../keys";

const VALID_KEY_B64 = Buffer.alloc(32, 7).toString("base64");
const ANOTHER_VALID_KEY_B64 = Buffer.alloc(32, 9).toString("base64");

describe("loadEncryptionKeyRegistry", () => {
  it("načte aktivní i starší verze klíčů z H2_ENCRYPTION_KEY_V{n}", () => {
    const registry = loadEncryptionKeyRegistry({
      H2_ENCRYPTION_ACTIVE_KEY_VERSION: "2",
      H2_ENCRYPTION_KEY_V1: VALID_KEY_B64,
      H2_ENCRYPTION_KEY_V2: ANOTHER_VALID_KEY_B64,
    });
    expect(registry.activeVersion).toBe(2);
    expect(registry.keys.size).toBe(2);
    expect(registry.keys.get(1)).toBeInstanceOf(Buffer);
    expect(registry.keys.get(2)).toBeInstanceOf(Buffer);
  });

  it("selže bezpečnou chybou, pokud aktivní verze nemá odpovídající klíč", () => {
    expect(() =>
      loadEncryptionKeyRegistry({
        H2_ENCRYPTION_ACTIVE_KEY_VERSION: "3",
        H2_ENCRYPTION_KEY_V1: VALID_KEY_B64,
      }),
    ).toThrow(H2ConfigError);
  });

  it("selže, pokud klíč nemá přesně 32 bajtů po base64 dekódování", () => {
    expect(() =>
      loadEncryptionKeyRegistry({
        H2_ENCRYPTION_ACTIVE_KEY_VERSION: "1",
        H2_ENCRYPTION_KEY_V1: Buffer.alloc(16, 1).toString("base64"),
      }),
    ).toThrow(H2ConfigError);
  });

  it("chybová zpráva nikdy neobsahuje samotnou hodnotu klíče", () => {
    let caught: unknown;
    try {
      loadEncryptionKeyRegistry({ H2_ENCRYPTION_ACTIVE_KEY_VERSION: "5" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(H2ConfigError);
    expect((caught as Error).message).not.toContain(VALID_KEY_B64);
  });
});
