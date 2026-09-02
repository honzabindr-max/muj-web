import { describe, expect, it } from "vitest";

import { isAuthenticatedOwnerRequest } from "../owner-session";

describe("isAuthenticatedOwnerRequest (placeholder do BUILD-03A)", () => {
  it("vrací vždy false, dokud BUILD-03A nedodá skutečnou identity boundary", () => {
    expect(isAuthenticatedOwnerRequest(new Request("http://localhost/api/h2/health"))).toBe(false);
  });
});
