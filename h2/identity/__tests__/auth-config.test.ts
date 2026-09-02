import { describe, expect, it } from "vitest";

import { H2ConfigError } from "@/h2/config/errors";

import { buildAuthConfig, getGoogleOAuthCredentials } from "../auth-config";

describe("getGoogleOAuthCredentials / buildAuthConfig (lazy, KROK 0 kontrakt)", () => {
  it("import modulu bez H2 env nespadne (jen volání funkce ano)", async () => {
    await expect(import("../auth-config")).resolves.toBeDefined();
  });

  it("getGoogleOAuthCredentials selže bezpečnou chybou bez env proměnných", () => {
    expect(() => getGoogleOAuthCredentials({})).toThrow(H2ConfigError);
  });

  it("buildAuthConfig sestaví platnou konfiguraci, když env proměnné existují", () => {
    const config = buildAuthConfig({
      H2_GOOGLE_CLIENT_ID: "test-client-id",
      H2_GOOGLE_CLIENT_SECRET: "test-client-secret",
      H2_AUTH_SECRET: "test-auth-secret-min-length-ok",
    });
    expect(config.providers).toHaveLength(1);
    expect(config.session?.strategy).toBe("jwt");
    expect(config.cookies?.sessionToken?.options?.httpOnly).toBe(true);
  });
});
