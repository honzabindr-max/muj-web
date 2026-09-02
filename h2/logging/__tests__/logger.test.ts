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

  it("odmítne pole, které vypadá jako uniklý content payload (dlouhý text)", () => {
    const longText = "a".repeat(500);
    expect(() => logH2Event({ purpose: "buddy", status: "error", errorCode: longText })).toThrow(
      H2LogPayloadError,
    );
  });
});
