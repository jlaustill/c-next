#!/usr/bin/env tsx
/**
 * Issue #337: -o and --header-out flatten directory structure
 *
 * Tests that output directory structure matches input directory structure
 * when using -o and --header-out options.
 *
 * Bug: When source has subdirectories (e.g., Domain/, Display/), the output
 * flattens all files into the root of the output directory instead of
 * preserving the structure.
 */

import {
  existsSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import Pipeline from "../../src/pipeline/Pipeline";
import Project from "../../src/project/Project";

// Test source files matching the bug report structure
const mainSource = `
#include <Domain/App.cnx>

u8 result;

i32 main() {
    result <- global.App.run();
    return 0;
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

const utilsSource = `
scope Utils {
    public u8 add(u8 x) {
        return x + 1;
    }
}
`;

// Test directory paths
const testDir = "/tmp/c-next-test-issue-337";
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

function getAllFiles(dir: string, base = ""): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = base ? join(base, entry.name) : entry.name;
    if (entry.isDirectory()) {
      results.push(...getAllFiles(join(dir, entry.name), relPath));
    } else {
      results.push(relPath);
    }
  }
  return results;
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

async function testPipelineWithDirectory() {
  console.log("\n=== Test 1: Pipeline with directory input (baseline) ===\n");
  console.log("This tests that Pipeline correctly preserves structure when");
  console.log("given a directory as input.\n");

  setup();

  const pipeline = new Pipeline({
    inputs: [sourceDir], // Directory as input - should work
    outDir: codeOutDir,
    headerOutDir: headerOutDir,
    includeDirs: [sourceDir],
    generateHeaders: true,
  });

  const result = await pipeline.run();
  check(result.success, "Pipeline compilation succeeds");

  // Check output structure
  const codeFiles = getAllFiles(codeOutDir);
  const headerFiles = getAllFiles(headerOutDir);

  console.log("\nGenerated code files:", codeFiles);
  console.log("Generated header files:", headerFiles);

  // Expected structure (preserved):
  // build/main.c, build/Domain/App.c, build/Display/Utils.c
  check(codeFiles.includes("main.c"), "main.c exists in build/");
  check(
    codeFiles.includes(join("Domain", "App.c")),
    "Domain/App.c exists (structure preserved)",
  );
  check(
    codeFiles.includes(join("Display", "Utils.c")),
    "Display/Utils.c exists (structure preserved)",
  );

  // BUG CHECK: Files should NOT be flattened
  check(
    !codeFiles.includes("App.c"),
    "App.c should NOT be in root (should be in Domain/)",
  );
  check(
    !codeFiles.includes("Utils.c"),
    "Utils.c should NOT be in root (should be in Display/)",
  );

  // Same for headers
  check(
    headerFiles.includes(join("Domain", "App.h")),
    "Domain/App.h exists (structure preserved)",
  );
  check(
    headerFiles.includes(join("Display", "Utils.h")),
    "Display/Utils.h exists (structure preserved)",
  );
}

async function testProjectWithExpandedFiles() {
  console.log(
    "\n=== Test 2: CLI simulation (correct behavior after fix) ===\n",
  );
  console.log("This simulates what the CLI should do after the fix:");
  console.log("- Identify directory inputs");
  console.log("- Pass directories to srcDirs");
  console.log("- Pass only explicit files to files array\n");

  setup();

  // Clear output directories
  if (existsSync(codeOutDir)) rmSync(codeOutDir, { recursive: true });
  if (existsSync(headerOutDir)) rmSync(headerOutDir, { recursive: true });
  mkdirSync(codeOutDir, { recursive: true });
  mkdirSync(headerOutDir, { recursive: true });

  // Simulate CLI behavior: identify directory inputs (Issue #337 fix)
  const inputs = [sourceDir];
  const srcDirs: string[] = [];
  const explicitFiles: string[] = [];

  for (const input of inputs) {
    const resolvedPath = resolve(input);
    if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
      srcDirs.push(resolvedPath);
    } else {
      explicitFiles.push(resolvedPath);
    }
  }

  console.log("Input directories (srcDirs):", srcDirs);
  console.log("Explicit files:", explicitFiles);

  // This is what the CLI should do after the fix
  const project = new Project({
    srcDirs, // Directory inputs preserved for structure calculation
    files: explicitFiles, // Only non-directory inputs
    includeDirs: [sourceDir],
    outDir: codeOutDir,
    headerOutDir: headerOutDir,
    generateHeaders: true,
  });

  const result = await project.compile();
  check(result.success, "Project compilation succeeds");

  // Check output structure
  const codeFiles = getAllFiles(codeOutDir);
  const headerFiles = getAllFiles(headerOutDir);

  console.log("\nGenerated code files:", codeFiles);
  console.log("Generated header files:", headerFiles);

  // These checks verify the fix works
  check(
    codeFiles.includes(join("Domain", "App.c")),
    "Domain/App.c exists (structure preserved)",
  );
  check(
    codeFiles.includes(join("Display", "Utils.c")),
    "Display/Utils.c exists (structure preserved)",
  );

  // Verify files are NOT flattened
  check(!codeFiles.includes("App.c"), "App.c should NOT be in root");
  check(!codeFiles.includes("Utils.c"), "Utils.c should NOT be in root");

  // Same for headers
  check(
    headerFiles.includes(join("Domain", "App.h")),
    "Domain/App.h exists (structure preserved)",
  );
  check(
    headerFiles.includes(join("Display", "Utils.h")),
    "Display/Utils.h exists (structure preserved)",
  );
}

async function testProjectWithSrcDirs() {
  console.log("\n=== Test 3: Project with srcDirs (proper usage) ===\n");
  console.log("This tests that Project works when srcDirs is properly set.\n");

  setup();

  // Clear output directories
  if (existsSync(codeOutDir)) rmSync(codeOutDir, { recursive: true });
  if (existsSync(headerOutDir)) rmSync(headerOutDir, { recursive: true });
  mkdirSync(codeOutDir, { recursive: true });
  mkdirSync(headerOutDir, { recursive: true });

  // Pass directory via srcDirs - this should work
  const project = new Project({
    srcDirs: [sourceDir], // Properly set!
    files: [],
    includeDirs: [sourceDir],
    outDir: codeOutDir,
    headerOutDir: headerOutDir,
    generateHeaders: true,
  });

  const result = await project.compile();
  check(result.success, "Project compilation succeeds");

  const codeFiles = getAllFiles(codeOutDir);
  const headerFiles = getAllFiles(headerOutDir);

  console.log("\nGenerated code files:", codeFiles);
  console.log("Generated header files:", headerFiles);

  check(
    codeFiles.includes(join("Domain", "App.c")),
    "Domain/App.c exists with srcDirs",
  );
  check(
    codeFiles.includes(join("Display", "Utils.c")),
    "Display/Utils.c exists with srcDirs",
  );
  check(!codeFiles.includes("App.c"), "App.c not flattened with srcDirs");
  check(!codeFiles.includes("Utils.c"), "Utils.c not flattened with srcDirs");
}

async function testCompilationOrder() {
  console.log("\n=== Test 4: Compilation order (leaves first) ===\n");
  console.log("Verifying that dependencies are compiled before dependents.");
  console.log("Expected order: Utils.c → App.c → main.c\n");

  setup();

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
    generateHeaders: true,
  });

  const result = await pipeline.run();
  check(result.success, "Pipeline compilation succeeds");

  // The outputFiles array should reflect compilation order:
  // Leaves (no dependencies) first, then files that depend on them
  console.log("Output files order:", result.outputFiles);

  // Utils.cnx has no dependencies - should be compiled first
  // App.cnx depends on Utils.cnx - should be compiled second
  // main.cnx depends on App.cnx - should be compiled last
  const codeFiles = result.outputFiles.filter((f) => f.endsWith(".c"));

  // Find indices of each file in the output order
  const utilsIndex = codeFiles.findIndex((f) => f.includes("Utils.c"));
  const appIndex = codeFiles.findIndex((f) => f.includes("App.c"));
  const mainIndex = codeFiles.findIndex((f) => f.includes("main.c"));

  console.log(`Utils.c at index: ${utilsIndex}`);
  console.log(`App.c at index: ${appIndex}`);
  console.log(`main.c at index: ${mainIndex}`);

  // Verify leaf-first order
  check(utilsIndex < appIndex, "Utils.c compiled before App.c (leaf first)");
  check(
    appIndex < mainIndex,
    "App.c compiled before main.c (dependency before dependent)",
  );
  check(
    utilsIndex < mainIndex,
    "Utils.c compiled before main.c (transitive dependency)",
  );
}

async function runTests() {
  console.log("Issue #337: Testing directory structure preservation\n");
  console.log("=".repeat(60));

  await testPipelineWithDirectory();
  await testProjectWithExpandedFiles();
  await testProjectWithSrcDirs();
  await testCompilationOrder();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log(
      "TEST FAILED: Bug #337 is present - directory structure is flattened",
    );
    process.exit(1);
  }

  console.log("All checks passed! Bug #337 is fixed.");
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
