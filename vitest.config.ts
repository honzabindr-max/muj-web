import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // CI runnery jsou pod zátěží pomalé; lokálně zůstává výchozích 5 s.
    ...(process.env.CI ? { testTimeout: 20_000 } : {}),
    include: [
      "h2/**/*.test.ts",
      "app/**/*.test.{ts,tsx}",
      "sam-byt/**/*.test.{ts,tsx}",
      "tars/**/*.test.ts",
    ],
    globalSetup: ["h2/db/scripts/ensure-test-roles.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
