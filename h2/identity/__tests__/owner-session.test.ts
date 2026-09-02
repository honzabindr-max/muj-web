import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";

import { isAuthenticatedOwnerRequest } from "../owner-session";

describe("isAuthenticatedOwnerRequest (BUILD-03A — reálná Auth.js session)", () => {
  it("vrací true, pokud session obsahuje googleSub enrollnutého ownera", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ googleSub: "some-sub" } as never);
    expect(await isAuthenticatedOwnerRequest(new Request("http://localhost/"))).toBe(true);
  });

  it("vrací false bez session", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    expect(await isAuthenticatedOwnerRequest(new Request("http://localhost/"))).toBe(false);
  });

  it("vrací false, pokud session existuje, ale nemá googleSub", async () => {
    vi.mocked(auth).mockResolvedValueOnce({} as never);
    expect(await isAuthenticatedOwnerRequest(new Request("http://localhost/"))).toBe(false);
  });
});
