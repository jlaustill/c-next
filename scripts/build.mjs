#!/usr/bin/env node
/**
 * Build the C-Next transpiler into a single JS bundle using esbuild.
 *
 * Output: dist/index.js (ESM, Node 18+, with sourcemaps)
 *
 * This eliminates the tsx/npx overhead (~300-500ms per invocation) from:
 *   - Integration tests (952 tests × `npx tsx src/index.ts`)
 *   - CLI usage via `bin/cnext.js`
 *   - CI pipeline jobs
 */

import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "dist/index.js",
  sourcemap: true,
  // Externalize npm packages to avoid CJS→ESM interop issues (cosmiconfig
  // uses require("fs") internally). Our TypeScript source code is still
  // compiled and bundled — the main win is eliminating tsx JIT compilation.
  packages: "external",
});
