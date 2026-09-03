import { describe, expect, it } from "vitest";

import { H2ConfigError } from "@/h2/config/errors";

import { isAllowlistedTelegramSender, verifyTelegramWebhookSecret } from "../telegram-auth";

describe("verifyTelegramWebhookSecret", () => {
  const source = { H2_TELEGRAM_WEBHOOK_SECRET: "correct-secret-value" };

  it("vrací true pro přesně shodný secret", () => {
    expect(verifyTelegramWebhookSecret("correct-secret-value", source)).toBe(true);
  });

  it("vrací false pro nesprávný secret", () => {
    expect(verifyTelegramWebhookSecret("wrong-secret-value", source)).toBe(false);
  });

  it("vrací false pro chybějící hlavičku", () => {
    expect(verifyTelegramWebhookSecret(null, source)).toBe(false);
  });

  it("selže H2ConfigError, pokud env proměnná chybí", () => {
    expect(() => verifyTelegramWebhookSecret("cokoliv", {})).toThrow(H2ConfigError);
  });
});

describe("isAllowlistedTelegramSender (§31.1 allowlist, ne first-contact enrollment)", () => {
  const source = { H2_TELEGRAM_OWNER_USER_ID: "6034875251" };

  it("povolí allowlistovaný telegram_user_id", () => {
    expect(isAllowlistedTelegramSender(6034875251, source)).toBe(true);
  });

  it("odmítne cizí telegram_user_id", () => {
    expect(isAllowlistedTelegramSender(999999999, source)).toBe(false);
  });
});
