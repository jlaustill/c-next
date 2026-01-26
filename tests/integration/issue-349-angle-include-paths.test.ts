#!/usr/bin/env tsx
/**
 * Issue #349: Angle-bracket CNX includes missing directory prefix
 *
 * Tests that angle-bracket #include <file.cnx> statements in generated .c files
 * get the correct directory prefix added to match --header-out structure.
 *
 * Bug: When source has subdirectories (e.g., src/Display/main.cnx contains
 * #include <utils.cnx> where utils.cnx is in the same directory), the generated
 * .c file uses #include <utils.h> instead of #include <Display/utils.h>.
 *
 * This causes build failures because the compiler can't find the header file
 * using -I include/ flag.
 */

import {
  existsSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import Pipeline from "../../src/pipeline/Pipeline";

// Test source files - Utils has a public function which triggers header generation
const utilsSource = `
scope Utils {
    public u8 add(u8 x) {
        return x + 1;
    }
}
`;

// Main file includes Utils using angle brackets (sibling include)
const mainSource = `
#include <utils.cnx>

u8 result;

i32 main() {
    result <- global.Utils.add(5);
    return 0;
}
`;

// Test directory paths
const testDir = "/tmp/c-next-test-issue-349";
const sourceDir = join(testDir, "src");
const displayDir = join(sourceDir, "Display");
const codeOutDir = join(testDir, "build");
const headerOutDir = join(testDir, "include");

function setup() {
  // Clean up any previous test artifacts
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }

  // Create source directory structure
  mkdirSync(displayDir, { recursive: true });
}

let passed = 0;
let failed = 0;

function check(condition: boolean, description: string) {
  if (condition) {
    console.log(`PASS: ${description}`);
    passed++;
  } else {
    console.error(`FAIL: ${description}`);
    failed++;
  }
}

/**
 * Extract angle-bracket includes only
 */
function extractAngleBracketIncludes(content: string): string[] {
  const includeRegex = /#include\s+<([^>]+)>/g;
  const includes: string[] = [];
  let match;
  while ((match = includeRegex.exec(content)) !== null) {
    includes.push(match[1]);
  }
  return includes;
}

async function testSiblingAngleBracketInclude() {
  console.log("\n=== Test 1: Sibling angle-bracket include ===\n");
  console.log("When main.cnx in Display/ includes <utils.cnx> (sibling file),");
  console.log("the generated main.c should include <Display/utils.h>.\n");

  setup();

  // Write test source files - both in Display/ subdirectory
  writeFileSync(join(displayDir, "utils.cnx"), utilsSource, "utf-8");
  writeFileSync(join(displayDir, "main.cnx"), mainSource, "utf-8");

  const pipeline = new Pipeline({
    inputs: [sourceDir],
    outDir: codeOutDir,
    headerOutDir: headerOutDir,
    includeDirs: [sourceDir],
  });

  const result = await pipeline.run();
  check(result.success, "Pipeline compilation succeeds");

  // Check that main.c includes Display/utils.h (not just utils.h)
  const mainCodePath = join(codeOutDir, "Display", "main.c");
  check(existsSync(mainCodePath), "Display/main.c exists");

  if (existsSync(mainCodePath)) {
    const mainCode = readFileSync(mainCodePath, "utf-8");
    const includes = extractAngleBracketIncludes(mainCode);
    console.log("  main.c angle-bracket includes:", includes);

    // BUG CHECK: Should include <Display/utils.h>, not <utils.h>
    check(
      includes.includes("Display/utils.h"),
      "main.c includes <Display/utils.h> (with subdirectory)",
    );
    check(
      !includes.some((inc) => inc === "utils.h"),
      "main.c does NOT include bare <utils.h>",
    );
  }
}

async function testCrossDirectoryAngleBracketInclude() {
  console.log("\n=== Test 2: Cross-directory angle-bracket include ===\n");
  console.log("When a file includes <Display/utils.cnx> explicitly,");
  console.log("it should become <Display/utils.h>.\n");

  setup();

  // Create a root-level main that includes from a subdirectory
  const rootMainSource = `
#include <Display/utils.cnx>

u8 result;

i32 main() {
    result <- global.Utils.add(5);
    return 0;
}
`;

  writeFileSync(join(displayDir, "utils.cnx"), utilsSource, "utf-8");
  writeFileSync(join(sourceDir, "main.cnx"), rootMainSource, "utf-8");

  // Clear output directories
  if (existsSync(codeOutDir)) rmSync(codeOutDir, { recursive: true });
  if (existsSync(headerOutDir)) rmSync(headerOutDir, { recursive: true });

  const pipeline = new Pipeline({
    inputs: [sourceDir],
    outDir: codeOutDir,
    headerOutDir: headerOutDir,
    includeDirs: [sourceDir],
  });

  const result = await pipeline.run();
  check(result.success, "Pipeline compilation succeeds");

  // Check that main.c includes Display/utils.h
  const mainCodePath = join(codeOutDir, "main.c");
  check(existsSync(mainCodePath), "main.c exists at root");

  if (existsSync(mainCodePath)) {
    const mainCode = readFileSync(mainCodePath, "utf-8");
    const includes = extractAngleBracketIncludes(mainCode);
    console.log("  main.c angle-bracket includes:", includes);

    // Explicit path should be preserved
    check(
      includes.includes("Display/utils.h"),
      "main.c includes <Display/utils.h> (explicit path preserved)",
    );
  }
}

async function testRootLevelAngleBracketInclude() {
  console.log("\n=== Test 3: Root-level angle-bracket include ===\n");
  console.log(
    "When files are at the root level, no directory prefix needed.\n",
  );

  setup();

  // Put both files at root level
  writeFileSync(join(sourceDir, "utils.cnx"), utilsSource, "utf-8");
  writeFileSync(join(sourceDir, "main.cnx"), mainSource, "utf-8");

  // Clear output directories
  if (existsSync(codeOutDir)) rmSync(codeOutDir, { recursive: true });
  if (existsSync(headerOutDir)) rmSync(headerOutDir, { recursive: true });

  const pipeline = new Pipeline({
    inputs: [sourceDir],
    outDir: codeOutDir,
    headerOutDir: headerOutDir,
    includeDirs: [sourceDir],
  });

  const result = await pipeline.run();
  check(result.success, "Pipeline compilation succeeds");

  const mainCodePath = join(codeOutDir, "main.c");
  check(existsSync(mainCodePath), "main.c exists");

  if (existsSync(mainCodePath)) {
    const mainCode = readFileSync(mainCodePath, "utf-8");
    const includes = extractAngleBracketIncludes(mainCode);
    console.log("  main.c angle-bracket includes:", includes);

    // At root level, should use bare name
    check(
      includes.includes("utils.h"),
      "main.c includes <utils.h> (bare name for root level)",
    );
    // Should not have any weird prefixes
    check(
      !includes.some((inc) => inc.startsWith("./") && inc.includes("utils")),
      "main.c does NOT include <./utils.h>",
    );
  }
}

async function testAngleBracketIncludeFallback() {
  console.log("\n=== Test 4: Angle-bracket include fallback ===\n");
  console.log(
    "When .cnx file is not found, should fall back to simple replacement.\n",
  );

  setup();

  // Include a non-existent CNX file (e.g., system header)
  const mainWithExternalInclude = `
#include <external.cnx>

i32 main() {
    return 0;
}
`;

  writeFileSync(join(sourceDir, "main.cnx"), mainWithExternalInclude, "utf-8");

  // Clear output directories
  if (existsSync(codeOutDir)) rmSync(codeOutDir, { recursive: true });
  if (existsSync(headerOutDir)) rmSync(headerOutDir, { recursive: true });

  const pipeline = new Pipeline({
    inputs: [sourceDir],
    outDir: codeOutDir,
    headerOutDir: headerOutDir,
    includeDirs: [sourceDir],
  });

  const result = await pipeline.run();
  check(result.success, "Pipeline compilation succeeds");

  const mainCodePath = join(codeOutDir, "main.c");
  check(existsSync(mainCodePath), "main.c exists");

  if (existsSync(mainCodePath)) {
    const mainCode = readFileSync(mainCodePath, "utf-8");
    const includes = extractAngleBracketIncludes(mainCode);
    console.log("  main.c angle-bracket includes:", includes);

    // Fallback: when file not found, just do simple replacement
    check(
      includes.includes("external.h"),
      "main.c includes <external.h> (fallback for non-existent file)",
    );
  }
}

async function testNestedDirectoryAngleBracketInclude() {
  console.log("\n=== Test 5: Deeply nested angle-bracket include ===\n");
  console.log("Tests that multi-level directory structures are handled.\n");

  setup();

  // Create deeply nested structure: src/A/B/C/Deep.cnx
  const deepDir = join(sourceDir, "A", "B", "C");
  mkdirSync(deepDir, { recursive: true });

  const deepUtilsSource = `
scope DeepUtils {
    public u8 getDeepValue() {
        return 99;
    }
}
`;

  // Main in the same deep directory includes sibling
  const deepMainSource = `
#include <deep_utils.cnx>

u8 result;

i32 main() {
    result <- global.DeepUtils.getDeepValue();
    return 0;
}
`;

  writeFileSync(join(deepDir, "deep_utils.cnx"), deepUtilsSource, "utf-8");
  writeFileSync(join(deepDir, "main.cnx"), deepMainSource, "utf-8");

  // Clear output directories
  if (existsSync(codeOutDir)) rmSync(codeOutDir, { recursive: true });
  if (existsSync(headerOutDir)) rmSync(headerOutDir, { recursive: true });

  const pipeline = new Pipeline({
    inputs: [sourceDir],
    outDir: codeOutDir,
    headerOutDir: headerOutDir,
    includeDirs: [sourceDir],
  });

  const result = await pipeline.run();
  check(result.success, "Pipeline compilation succeeds");

  // Check main.c - should include A/B/C/deep_utils.h
  const mainCodePath = join(codeOutDir, "A", "B", "C", "main.c");
  check(existsSync(mainCodePath), "A/B/C/main.c exists");

  if (existsSync(mainCodePath)) {
    const mainCode = readFileSync(mainCodePath, "utf-8");
    const includes = extractAngleBracketIncludes(mainCode);
    console.log("  main.c includes:", includes);

    check(
      includes.includes("A/B/C/deep_utils.h"),
      "main.c includes <A/B/C/deep_utils.h> (full nested path)",
    );
    check(
      !includes.some((inc) => inc === "deep_utils.h"),
      "main.c does NOT include bare <deep_utils.h>",
    );
  }
}

async function runTests() {
  console.log(
    "Issue #349: Testing angle-bracket include paths match --header-out structure\n",
  );
  console.log("=".repeat(60));

  await testSiblingAngleBracketInclude();
  await testCrossDirectoryAngleBracketInclude();
  await testRootLevelAngleBracketInclude();
  await testAngleBracketIncludeFallback();
  await testNestedDirectoryAngleBracketInclude();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log(
      "TEST FAILED: Bug #349 is present - angle-bracket include paths don't match header-out structure",
    );
    process.exit(1);
  }

  console.log("All checks passed! Bug #349 is fixed.");
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
