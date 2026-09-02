import { describe, expect, it } from "vitest";

import { getH2Environment } from "../environment";

describe("getH2Environment", () => {
  it("použije VERCEL_ENV, pokud je nastavené", () => {
    expect(getH2Environment({ VERCEL_ENV: "preview" })).toBe("preview");
  });

  it("bez VERCEL_ENV spadne na NODE_ENV=production → production", () => {
    expect(getH2Environment({ NODE_ENV: "production" })).toBe("production");
  });

  it("bez jakéhokoli env spadne na development (lokální dev)", () => {
    expect(getH2Environment({})).toBe("development");
  });
});
