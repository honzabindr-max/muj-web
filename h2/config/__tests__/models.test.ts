import { describe, expect, it } from "vitest";

import { H2_MODELS } from "../models";

describe("H2_MODELS pin guard", () => {
  it("drží přesně certifikované pinned model IDs z Technical Architecture v1.2 §1", () => {
    expect(H2_MODELS).toEqual({
      buddy: "claude-sonnet-5",
      extraction: "claude-haiku-4-5-20251001",
      transcription: "whisper-1",
    });
  });
});
