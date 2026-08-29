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

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

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

// Issue #1364: the Prettier plugin is built here too.
//
// `.prettierrc` loads it from `prettier-plugin/dist/`, so every Prettier run --
// including the `lint-staged` pre-commit hook -- needs it present. Building it
// out of band meant a fresh clone could not run `prettier --check .` at all.
//
// The esbuild invocation lives in `prettier-plugin/package.json` and is called
// rather than repeated here: the plugin is a separately publishable package and
// must build the same way from either entry point.
//
// It has its own dependency tree, so it is skipped (rather than failed) when
// that tree has not been installed.
const pluginDir = new URL("../prettier-plugin/", import.meta.url);
if (existsSync(new URL("node_modules/antlr4ng/", pluginDir))) {
  const result = spawnSync(
    "npm",
    ["--prefix", "prettier-plugin", "run", "build"],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
} else {
  // `prepare` installs this tree on `npm install`, so reaching here means a
  // deliberately partial checkout. Fail rather than warn: `.prettierrc` points
  // `*.cnx` at the bundle, so continuing defers the error to the first commit
  // that touches a `.cnx`, where it surfaces inside the pre-commit hook as a
  // bare "Cannot find module" long after this message has scrolled away.
  console.error(
    "prettier-plugin dependencies are missing. Run `npm run plugin:install`.",
  );
  process.exit(1);
}
