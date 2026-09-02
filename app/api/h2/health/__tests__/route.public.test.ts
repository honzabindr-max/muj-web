import { describe, expect, it } from "vitest";

import { GET } from "../route";

describe("GET /api/h2/health — veřejný (neautentizovaný) request", () => {
  it("vrací pouze { status }, žádný commit hash/verzi/prostředí/build info", async () => {
    const response = await GET(new Request("http://localhost/api/h2/health"));
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });
});
