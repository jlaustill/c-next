#!/usr/bin/env tsx
/**
 * Issue #339: Generated includes don't match --header-out directory structure
 *
 * Tests that self-include statements in generated .cpp files use relative paths
 * that match the directory structure preserved by --header-out.
 *
 * Bug: When source has subdirectories (e.g., Display/Utils.cnx), the generated
 * .cpp file uses #include "Utils.h" instead of #include "Display/Utils.h".
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
import Project from "../../src/project/Project";

// Test source files - Utils has a public function which triggers header generation
const utilsSource = `
scope Utils {
    public u8 add(u8 x) {
        return x + 1;
    }
}
`;

const appSource = `
#include <Display/Utils.cnx>

scope App {
    public u8 run() {
        return global.Utils.add(5);
    }
}
`;

const mainSource = `
#include <Domain/App.cnx>

u8 result;

i32 main() {
    result <- global.App.run();
    return 0;
}
`;

// Test directory paths
const testDir = "/tmp/c-next-test-issue-339";
const sourceDir = join(testDir, "src");
const domainDir = join(sourceDir, "Domain");
const displayDir = join(sourceDir, "Display");
const codeOutDir = join(testDir, "build");
const headerOutDir = join(testDir, "include");

function setup() {
  // Clean up any previous test artifacts
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }

  // Create source directory structure
  mkdirSync(domainDir, { recursive: true });
  mkdirSync(displayDir, { recursive: true });

  // Write test source files
  writeFileSync(join(sourceDir, "main.cnx"), mainSource, "utf-8");
  writeFileSync(join(domainDir, "App.cnx"), appSource, "utf-8");
  writeFileSync(join(displayDir, "Utils.cnx"), utilsSource, "utf-8");
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
 * Extract all #include statements from generated code
 */
function extractIncludes(content: string): string[] {
  const includeRegex = /#include\s+["<]([^">]+)[">]/g;
  const includes: string[] = [];
  let match;
  while ((match = includeRegex.exec(content)) !== null) {
    includes.push(match[1]);
  }
  return includes;
}

async function testSelfIncludePathsWithPipeline() {
  console.log("\n=== Test 1: Self-include paths with Pipeline ===\n");
  console.log("Verifies that generated .c files include their headers with");
  console.log("correct relative paths matching header-out structure.\n");

  setup();

  const pipeline = new Pipeline({
    inputs: [sourceDir],
    outDir: codeOutDir,
    headerOutDir: headerOutDir,
    includeDirs: [sourceDir],
  });

  const result = await pipeline.run();
  check(result.success, "Pipeline compilation succeeds");

  // Check that Utils.c includes Display/Utils.h (not just Utils.h)
  const utilsCodePath = join(codeOutDir, "Display", "Utils.c");
  check(existsSync(utilsCodePath), "Display/Utils.c exists");

  if (existsSync(utilsCodePath)) {
    const utilsCode = readFileSync(utilsCodePath, "utf-8");
    const includes = extractIncludes(utilsCode);
    console.log("  Utils.c includes:", includes);

    // BUG CHECK: Should include "Display/Utils.h", not "Utils.h"
    check(
      includes.includes("Display/Utils.h"),
      'Utils.c includes "Display/Utils.h" (with subdirectory)',
    );
    check(
      !includes.some((inc) => inc === "Utils.h"),
      'Utils.c does NOT include bare "Utils.h"',
    );
  }

  // Check that App.c includes Domain/App.h (not just App.h)
  const appCodePath = join(codeOutDir, "Domain", "App.c");
  check(existsSync(appCodePath), "Domain/App.c exists");

  if (existsSync(appCodePath)) {
    const appCode = readFileSync(appCodePath, "utf-8");
    const includes = extractIncludes(appCode);
    console.log("  App.c includes:", includes);

    // BUG CHECK: Should include "Domain/App.h", not "App.h"
    check(
      includes.includes("Domain/App.h"),
      'App.c includes "Domain/App.h" (with subdirectory)',
    );
    check(
      !includes.some((inc) => inc === "App.h"),
      'App.c does NOT include bare "App.h"',
    );
  }

  // main.c should have no self-include (no public symbols)
  // but verify for completeness
  const mainCodePath = join(codeOutDir, "main.c");
  if (existsSync(mainCodePath)) {
    const mainCode = readFileSync(mainCodePath, "utf-8");
    const includes = extractIncludes(mainCode);
    console.log("  main.c includes:", includes);

    // main.c should NOT have a self-include since it has no public symbols
    check(
      !includes.some((inc) => inc === "main.h"),
      "main.c has no self-include (no public symbols)",
    );
  }
}

async function testSelfIncludePathsWithProject() {
  console.log("\n=== Test 2: Self-include paths with Project ===\n");
  console.log("Verifies the same behavior when using Project API directly.\n");

  setup();

  // Clear output directories
  if (existsSync(codeOutDir)) rmSync(codeOutDir, { recursive: true });
  if (existsSync(headerOutDir)) rmSync(headerOutDir, { recursive: true });
  mkdirSync(codeOutDir, { recursive: true });
  mkdirSync(headerOutDir, { recursive: true });

  const project = new Project({
    srcDirs: [sourceDir],
    files: [],
    includeDirs: [sourceDir],
    outDir: codeOutDir,
    headerOutDir: headerOutDir,
  });

  const result = await project.compile();
  check(result.success, "Project compilation succeeds");

  // Check Utils.c
  const utilsCodePath = join(codeOutDir, "Display", "Utils.c");
  if (existsSync(utilsCodePath)) {
    const utilsCode = readFileSync(utilsCodePath, "utf-8");
    const includes = extractIncludes(utilsCode);
    console.log("  Utils.c includes:", includes);

    check(
      includes.includes("Display/Utils.h"),
      'Utils.c includes "Display/Utils.h" via Project',
    );
  }

  // Check App.c
  const appCodePath = join(codeOutDir, "Domain", "App.c");
  if (existsSync(appCodePath)) {
    const appCode = readFileSync(appCodePath, "utf-8");
    const includes = extractIncludes(appCode);
    console.log("  App.c includes:", includes);

    check(
      includes.includes("Domain/App.h"),
      'App.c includes "Domain/App.h" via Project',
    );
  }
}

async function testRootLevelFileHasNoPrefix() {
  console.log("\n=== Test 3: Root-level files have no prefix ===\n");
  console.log("Files at the root of the source directory should use bare");
  console.log("include names (no leading ./)\n");

  setup();

  // Add a root-level file with public symbols
  const rootSource = `
scope RootModule {
    public u8 getValue() {
        return 42;
    }
}
`;
  writeFileSync(join(sourceDir, "RootModule.cnx"), rootSource, "utf-8");

  // Clear output directories
  if (existsSync(codeOutDir)) rmSync(codeOutDir, { recursive: true });
  if (existsSync(headerOutDir)) rmSync(headerOutDir, { recursive: true });
  mkdirSync(codeOutDir, { recursive: true });
  mkdirSync(headerOutDir, { recursive: true });

  const pipeline = new Pipeline({
    inputs: [sourceDir],
    outDir: codeOutDir,
    headerOutDir: headerOutDir,
    includeDirs: [sourceDir],
  });

  const result = await pipeline.run();
  check(result.success, "Pipeline compilation succeeds");

  // Check RootModule.c - should use bare "RootModule.h" (no subdirectory)
  const rootCodePath = join(codeOutDir, "RootModule.c");
  check(existsSync(rootCodePath), "RootModule.c exists at root");

  if (existsSync(rootCodePath)) {
    const rootCode = readFileSync(rootCodePath, "utf-8");
    const includes = extractIncludes(rootCode);
    console.log("  RootModule.c includes:", includes);

    check(
      includes.includes("RootModule.h"),
      'RootModule.c includes "RootModule.h" (bare name for root files)',
    );
    // Should not have any weird prefixes
    check(
      !includes.some(
        (inc) => inc.startsWith("./") && inc.includes("RootModule"),
      ),
      'RootModule.c does NOT include "./RootModule.h"',
    );
  }
}

async function testNestedSubdirectories() {
  console.log("\n=== Test 4: Deeply nested subdirectories ===\n");
  console.log("Tests that multi-level directory structures are handled.\n");

  setup();

  // Create deeply nested structure: src/A/B/C/Deep.cnx
  const deepDir = join(sourceDir, "A", "B", "C");
  mkdirSync(deepDir, { recursive: true });

  const deepSource = `
scope Deep {
    public u8 getDeepValue() {
        return 99;
    }
}
`;
  writeFileSync(join(deepDir, "Deep.cnx"), deepSource, "utf-8");

  // Clear output directories
  if (existsSync(codeOutDir)) rmSync(codeOutDir, { recursive: true });
  if (existsSync(headerOutDir)) rmSync(headerOutDir, { recursive: true });
  mkdirSync(codeOutDir, { recursive: true });
  mkdirSync(headerOutDir, { recursive: true });

  const pipeline = new Pipeline({
    inputs: [sourceDir],
    outDir: codeOutDir,
    headerOutDir: headerOutDir,
    includeDirs: [sourceDir],
  });

  const result = await pipeline.run();
  check(result.success, "Pipeline compilation succeeds");

  // Check Deep.c - should include A/B/C/Deep.h
  const deepCodePath = join(codeOutDir, "A", "B", "C", "Deep.c");
  check(existsSync(deepCodePath), "A/B/C/Deep.c exists");

  if (existsSync(deepCodePath)) {
    const deepCode = readFileSync(deepCodePath, "utf-8");
    const includes = extractIncludes(deepCode);
    console.log("  Deep.c includes:", includes);

    check(
      includes.includes("A/B/C/Deep.h"),
      'Deep.c includes "A/B/C/Deep.h" (full nested path)',
    );
    check(
      !includes.some((inc) => inc === "Deep.h"),
      'Deep.c does NOT include bare "Deep.h"',
    );
  }
}

async function runTests() {
  console.log(
    "Issue #339: Testing include paths match --header-out structure\n",
  );
  console.log("=".repeat(60));

  await testSelfIncludePathsWithPipeline();
  await testSelfIncludePathsWithProject();
  await testRootLevelFileHasNoPrefix();
  await testNestedSubdirectories();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log(
      "TEST FAILED: Bug #339 is present - include paths don't match header-out structure",
    );
    process.exit(1);
  }

  console.log("All checks passed! Bug #339 is fixed.");
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
