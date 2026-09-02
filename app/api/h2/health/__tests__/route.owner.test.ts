import { describe, expect, it, vi } from "vitest";

vi.mock("@/h2/identity/owner-session", () => ({
  isAuthenticatedOwnerRequest: () => true,
}));

describe("GET /api/h2/health — authenticated owner request", () => {
  it("vrací environment/models/capabilities/buildInfo jen ownerovi", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/h2/health"));
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.environment).toBeDefined();
    expect(body.models).toEqual({
      buddy: "claude-sonnet-5",
      extraction: "claude-haiku-4-5-20251001",
      transcription: "whisper-1",
    });
    expect(body.buildInfo).toBeDefined();
  });
});
