// Test runner settings: every test file runs with network access blocked.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup/no-network.ts"],
  },
});
