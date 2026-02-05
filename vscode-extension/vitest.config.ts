import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: "./vscode-extension",
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});
