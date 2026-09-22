import { describe, expect, it } from "vitest";

import { generatePassword, hashPassword, verifyPassword } from "../auth/password";

describe("hashování hesel", () => {
  it("hash+verify roundtrip projde se správným heslem", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("verify odmítne špatné heslo", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("dvě volání hashPassword pro stejné heslo dají různý hash (náhodná sůl)", async () => {
    const [a, b] = await Promise.all([hashPassword("same"), hashPassword("same")]);
    expect(a).not.toBe(b);
  });

  it("generatePassword vrací 24 znaků bez matoucích znaků (0/O/1/l/I)", () => {
    const password = generatePassword();
    expect(password).toHaveLength(24);
    expect(password).not.toMatch(/[0O1lI]/);
  });
});
