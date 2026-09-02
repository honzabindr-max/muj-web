import { describe, expect, it } from "vitest";

import { assertSameOrigin } from "../csrf";
import { H2CsrfError } from "../errors";

const ALLOWED = ["https://good-inventions.work", "https://muj-web-steel.vercel.app"];

describe("assertSameOrigin (§31.1 CSRF/origin ochrana)", () => {
  it("povolí request s Origin z allowlistu", () => {
    const request = new Request("https://good-inventions.work/api/h2/whatever", {
      method: "POST",
      headers: { origin: "https://good-inventions.work" },
    });
    expect(() => assertSameOrigin(request, ALLOWED)).not.toThrow();
  });

  it("odmítne request bez Origin headeru", () => {
    const request = new Request("https://good-inventions.work/api/h2/whatever", { method: "POST" });
    expect(() => assertSameOrigin(request, ALLOWED)).toThrow(H2CsrfError);
  });

  it("odmítne request s cizím Origin", () => {
    const request = new Request("https://good-inventions.work/api/h2/whatever", {
      method: "POST",
      headers: { origin: "https://utocnik.example" },
    });
    expect(() => assertSameOrigin(request, ALLOWED)).toThrow(H2CsrfError);
  });
});
