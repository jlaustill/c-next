#!/usr/bin/env tsx
/**
 * Integration test for --header-out and --clean CLI options
 * Tests that:
 * - --header-out correctly separates .h files from .c files
 * - --clean removes generated files from both directories
 */

import { existsSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "fs";
import { join } from "path";
import Pipeline from "../../src/pipeline/Pipeline";
import CleanCommand from "../../src/commands/CleanCommand";

// Test source file content
const testSource = `
// Test file for --header-out and --clean options
u32 globalCounter <- 0;

u32 add(u32 a, u32 b) {
    return a + b;
}

u32 main() {
    globalCounter <- add(1, 2);
    return globalCounter;
}
`;

// Test directory paths
const testDir = "/tmp/c-next-test-header-out-clean";
const sourceDir = join(testDir, "source");
const codeOutDir = join(testDir, "out/src");
const headerOutDir = join(testDir, "out/include");

function setup() {
  // Clean up any previous test artifacts
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }

  // Create directories
  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(codeOutDir, { recursive: true });
  mkdirSync(headerOutDir, { recursive: true });

  // Write test source file
  writeFileSync(join(sourceDir, "test.cnx"), testSource, "utf-8");
}

function getFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(
    (f) => f.endsWith(".c") || f.endsWith(".h") || f.endsWith(".cpp"),
  );
}

async function runTest() {
  setup();

  let passed = 0;
  let failed = 0;

  const check = (condition: boolean, description: string) => {
    if (condition) {
      console.log(`PASS: ${description}`);
      passed++;
    } else {
      console.error(`FAIL: ${description}`);
      failed++;
    }
  };

  // Test 1: --header-out separates headers from code
  console.log("\n=== Test 1: --header-out option ===\n");

  const pipeline = new Pipeline({
    inputs: [sourceDir],
    outDir: codeOutDir,
    headerOutDir: headerOutDir,
    includeDirs: [],
    generateHeaders: true,
  });

  const result = await pipeline.run();

  check(result.success, "Pipeline compilation succeeds");

  const codeFiles = getFiles(codeOutDir);
  const headerFiles = getFiles(headerOutDir);

  check(
    codeFiles.some((f) => f.endsWith(".c")),
    "Code directory contains .c file",
  );
  check(
    !codeFiles.some((f) => f.endsWith(".h")),
    "Code directory does NOT contain .h file",
  );
  check(
    headerFiles.some((f) => f.endsWith(".h")),
    "Header directory contains .h file",
  );
  check(
    !headerFiles.some((f) => f.endsWith(".c")),
    "Header directory does NOT contain .c file",
  );

  // Test 2: --clean removes files from both directories
  console.log("\n=== Test 2: --clean option ===\n");

  // Verify files exist before clean
  check(existsSync(join(codeOutDir, "test.c")), "test.c exists before clean");
  check(existsSync(join(headerOutDir, "test.h")), "test.h exists before clean");

  // Run clean
  CleanCommand.execute([sourceDir], codeOutDir, headerOutDir);

  // Verify files are removed
  check(!existsSync(join(codeOutDir, "test.c")), "test.c removed after clean");
  check(
    !existsSync(join(headerOutDir, "test.h")),
    "test.h removed after clean",
  );

  // Test 3: --clean with no headerOutDir (same directory)
  console.log("\n=== Test 3: --clean without --header-out ===\n");

  // Regenerate files to same directory
  const pipeline2 = new Pipeline({
    inputs: [sourceDir],
    outDir: codeOutDir,
    includeDirs: [],
    generateHeaders: true,
  });

  const result2 = await pipeline2.run();
  check(result2.success, "Pipeline compilation succeeds (same dir)");

  const allFiles = getFiles(codeOutDir);
  check(
    allFiles.some((f) => f.endsWith(".c")),
    "Code file exists in combined dir",
  );
  check(
    allFiles.some((f) => f.endsWith(".h")),
    "Header file exists in combined dir",
  );

  // Clean without headerOutDir
  CleanCommand.execute([sourceDir], codeOutDir, undefined);

  check(
    !existsSync(join(codeOutDir, "test.c")),
    "test.c removed (combined dir)",
  );
  check(
    !existsSync(join(codeOutDir, "test.h")),
    "test.h removed (combined dir)",
  );

  // Test 4: Edge case - empty input list
  console.log("\n=== Test 4: Edge cases ===\n");

  // This should handle gracefully without errors
  CleanCommand.execute([], codeOutDir, headerOutDir);
  check(true, "Empty input list handled without error");

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

  if (failed > 0) {
    process.exit(1);
  }

  console.log("All checks passed!");
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
