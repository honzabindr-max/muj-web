import { describe, expect, it, vi } from "vitest";

vi.mock("@/h2/config", async () => {
  const actual = await vi.importActual<typeof import("@/h2/config")>("@/h2/config");
  return {
    ...actual,
    getH2Config: () => {
      throw new actual.H2ConfigError(["H2_RUNTIME_DATABASE_URL"]);
    },
  };
});

describe("GET /api/h2/health — veřejný request při neplatné H2 konfiguraci (KROK 0)", () => {
  it("dostane jen bezpečnou {status: error}, žádné missingKeys/errorCode", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/h2/health"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ status: "error" });
  });
});
