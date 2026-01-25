import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Co-locate tests with source files (*.test.ts pattern)
    // This is intentional - vitest globals are enabled to avoid
    // explicit imports of describe/it/expect in every test file
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: ["tests/**", "node_modules/**"],
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "scripts/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "src/antlr_parser/**", // Generated ANTLR code
        "scripts/test.ts", // Integration test runner
        "scripts/test-worker.ts", // Test worker
      ],
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
    },
  },
});
