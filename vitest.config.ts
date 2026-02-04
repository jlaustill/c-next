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
      include: ["src/**/*.ts"],
      exclude: [
        "**/__tests__/**", // Test directories (tests + helpers)
        "src/index.ts", // CLI entry point with module-level bootstrap code
        "src/antlr_parser/**", // Generated ANTLR code (legacy path)
        "src/transpiler/logic/parser/grammar/**", // Generated CNext parser
        "src/transpiler/logic/parser/c/grammar/**", // Generated C parser
        "src/transpiler/logic/parser/cpp/grammar/**", // Generated C++ parser
      ],
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
    },
  },
});
