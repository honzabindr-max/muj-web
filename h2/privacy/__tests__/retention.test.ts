import { describe, expect, it } from "vitest";

import { computeRetentionCutoff, isExpired } from "../retention";

describe("retention policy (§31.8)", () => {
  it("voice_audio_quarantined cutoff je přesně 24 hodin před 'now'", () => {
    const now = new Date("2026-09-02T12:00:00Z");
    const cutoff = computeRetentionCutoff("voice_audio_quarantined", now);
    expect(cutoff.toISOString()).toBe("2026-09-01T12:00:00.000Z");
  });

  it("platform_logs cutoff je 30 dní", () => {
    const now = new Date("2026-09-30T00:00:00Z");
    const cutoff = computeRetentionCutoff("platform_logs", now);
    expect(cutoff.toISOString()).toBe("2026-08-31T00:00:00.000Z");
  });

  it("isExpired: záznam starší než cutoff je expirovaný, novější není", () => {
    const now = new Date("2026-09-02T12:00:00Z");
    const oldEnough = new Date("2026-09-01T00:00:00Z");
    const tooRecent = new Date("2026-09-02T06:00:00Z");
    expect(isExpired("voice_audio_quarantined", oldEnough, now)).toBe(true);
    expect(isExpired("voice_audio_quarantined", tooRecent, now)).toBe(false);
  });

  it("server_side_export a voice_audio_quarantined mají shodně 24h okno (§31.8)", () => {
    const now = new Date("2026-09-02T12:00:00Z");
    expect(computeRetentionCutoff("server_side_export", now).getTime()).toBe(
      computeRetentionCutoff("voice_audio_quarantined", now).getTime(),
    );
  });
});
