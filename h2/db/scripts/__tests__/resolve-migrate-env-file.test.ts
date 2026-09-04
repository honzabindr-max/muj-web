import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveMigrateEnvFile } from "../resolve-migrate-env-file";

describe("resolveMigrateEnvFile()", () => {
  it("bez argumentu → fallback na dřívější .env.migrate (zpětná kompatibilita)", () => {
    expect(resolveMigrateEnvFile(undefined)).toBe(path.join(process.cwd(), ".env.migrate"));
  });

  it('"preview" → .env.migrate.preview', () => {
    expect(resolveMigrateEnvFile("preview")).toBe(path.join(process.cwd(), ".env.migrate.preview"));
  });

  it('"production" → .env.migrate.production', () => {
    expect(resolveMigrateEnvFile("production")).toBe(path.join(process.cwd(), ".env.migrate.production"));
  });

  it("neplatná hodnota → explicitní chyba, ne tichý fallback", () => {
    expect(() => resolveMigrateEnvFile("staging")).toThrow(/Neplatné cílové prostředí/);
  });
});
