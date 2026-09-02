import { describe, expect, it } from "vitest";
import { z } from "zod";

import { H2ConfigError } from "../errors";
import { requireEnv } from "../schema";

describe("requireEnv", () => {
  it("vrátí typované hodnoty, pokud jsou všechny požadované proměnné přítomné a validní", () => {
    const result = requireEnv(
      { H2_TEST_URL: z.string().url() },
      { H2_TEST_URL: "https://example.com" },
    );
    expect(result.H2_TEST_URL).toBe("https://example.com");
  });

  it("selže bezpečnou chybou (jen názvy klíčů, ne hodnoty) při chybějící proměnné", () => {
    let caught: unknown;
    try {
      requireEnv({ H2_SECRET_KEY: z.string().min(1) }, {});
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(H2ConfigError);
    const error = caught as H2ConfigError;
    expect(error.missingKeys).toContain("H2_SECRET_KEY");
  });

  it("nikdy nevloží skutečnou (neplatnou) hodnotu do chybové zprávy", () => {
    let caught: unknown;
    try {
      requireEnv({ H2_TEST_URL: z.string().url() }, { H2_TEST_URL: "not-a-url-abc123secret" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(H2ConfigError);
    expect((caught as Error).message).not.toContain("not-a-url-abc123secret");
  });

  it("selže i při neplatné (ne jen chybějící) hodnotě", () => {
    expect(() =>
      requireEnv({ H2_TEST_URL: z.string().url() }, { H2_TEST_URL: "not-a-url" }),
    ).toThrow(H2ConfigError);
  });
});
