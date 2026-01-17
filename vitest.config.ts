import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Co-locate tests with source files (*.test.ts pattern)
    // This is intentional - vitest globals are enabled to avoid
    // explicit imports of describe/it/expect in every test file
    include: ["src/**/*.test.ts"],
    exclude: ["tests/**", "node_modules/**"],
    globals: true,
    coverage: {
      include: ["src/codegen/headerGenerators/**"],
      exclude: ["**/*.test.ts"],
    },
  },
});
