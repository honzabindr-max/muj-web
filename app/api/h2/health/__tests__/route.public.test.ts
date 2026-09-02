import { describe, expect, it, vi } from "vitest";

// next-auth interně importuje next/server, což vitestí Node resolver v
// téhle konfiguraci nenajde (balíčkové exports quirk, ne reálná chyba) —
// mock stejně jako u ostatních "public"/"owner" variant testů.
vi.mock("@/h2/identity/owner-session", () => ({
  isAuthenticatedOwnerRequest: async () => false,
}));

describe("GET /api/h2/health — veřejný (neautentizovaný) request", () => {
  it("vrací pouze { status }, žádný commit hash/verzi/prostředí/build info", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/h2/health"));
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });
});
