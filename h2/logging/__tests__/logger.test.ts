import { describe, expect, it, vi } from "vitest";

import { H2LogPayloadError, logH2Event } from "../logger";

describe("logH2Event", () => {
  it("zaloguje bezpečná strukturovaná pole jako JSON", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logH2Event({ purpose: "health", status: "ok" });
    expect(spy).toHaveBeenCalledTimes(1);
    const record = JSON.parse(spy.mock.calls[0][0] as string);
    expect(record.purpose).toBe("health");
    expect(record.status).toBe("ok");
    spy.mockRestore();
  });

  it("propustí sanitizovaný stack trace v rámci jeho limitu (§31.7 to explicitně povoluje)", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const stack = "Error: H2_CONFIG_INVALID\n    at getH2Config (h2/config/index.ts:20:9)".repeat(20);
    expect(stack.length).toBeLessThanOrEqual(4000);
    expect(() =>
      logH2Event({ purpose: "job", status: "error", errorCode: "H2_CONFIG_INVALID", sanitizedStackTrace: stack }),
    ).not.toThrow();
    const record = JSON.parse(spy.mock.calls[0][0] as string);
    expect(record.sanitizedStackTrace).toBe(stack);
    spy.mockRestore();
  });

  it("propustí krátký errorSummary v rámci jeho limitu", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(() =>
      logH2Event({
        purpose: "processing",
        status: "error",
        errorSummary: "Whisper transcription timeout po 300s, retry naplánován",
      }),
    ).not.toThrow();
    spy.mockRestore();
  });

  it("odmítne sanitizedStackTrace, který přesáhne jeho vlastní (velkorysejší) limit", () => {
    const tooLong = "x".repeat(4001);
    expect(() =>
      logH2Event({ purpose: "job", status: "error", sanitizedStackTrace: tooLong }),
    ).toThrow(H2LogPayloadError);
  });

  it("odmítne errorCode, který vypadá jako uniklý raw user/content text (přes jeho krátký limit)", () => {
    const rawUserText =
      "Honzíku, dneska jsem měl fakt těžký den v práci a nevím si rady s tím projektem".repeat(3);
    expect(() =>
      logH2Event({ purpose: "buddy", status: "error", errorCode: rawUserText }),
    ).toThrow(H2LogPayloadError);
  });

  it("odmítne jakékoli string pole mimo allowlist i při nulové délce (obrana proti novým polím bez limitu)", () => {
    // Cast obchází typový systém záměrně — testuje runtime obranu pro data,
    // která do logH2Event dorazí bez statické typové kontroly (např. z JSON).
    const fieldsWithUnknownKey = {
      purpose: "buddy",
      status: "ok",
      unlistedField: "",
    } as unknown as Parameters<typeof logH2Event>[0];
    expect(() => logH2Event(fieldsWithUnknownKey)).toThrow(H2LogPayloadError);
  });
});
