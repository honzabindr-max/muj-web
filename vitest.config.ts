import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["h2/**/*.test.ts", "app/**/*.test.ts"],
    globalSetup: ["h2/db/scripts/ensure-test-roles.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
