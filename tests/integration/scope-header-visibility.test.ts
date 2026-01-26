#!/usr/bin/env tsx
/**
 * Integration test for Issue #218: Scope variables static/extern mismatch
 * Tests that private scope variables do NOT appear in generated headers
 * while public scope variables DO appear with extern declarations.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Pipeline from "../../src/pipeline/Pipeline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a temporary test file content
const testSource = `
// Test: Issue #218 - Private scope variables should not appear in headers
scope TestScope {
    // Private variables (default - no modifier)
    u32 privateCounter <- 0;
    bool privateFlag <- false;

    // Public variables (explicit public modifier)
    public u32 publicCounter <- 10;
    public bool publicFlag <- true;

    // Private method
    u32 getPrivateInternal() {
        return this.privateCounter;
    }

    // Public method accessing private state
    public u32 getPrivateCounter() {
        return this.privateCounter;
    }

    // Public method accessing public state
    public u32 getPublicCounter() {
        return this.publicCounter;
    }
}

u32 main() {
    return 0;
}
`;

// Main test function
async function runTest() {
  // Write test source to temp location
  const testDir = "/tmp/c-next-test-218";
  const testFile = join(testDir, "scope-visibility.cnx");

  mkdirSync(testDir, { recursive: true });
  writeFileSync(testFile, testSource, "utf-8");

  // Configure pipeline with C++ output and header generation
  const pipeline = new Pipeline({
    inputs: [testFile],
    outDir: testDir,
    includeDirs: [],
    cppRequired: true, // Force C++ output
  });

  console.log("Compiling with C++ output and header generation...");
  const result = await pipeline.run();

  if (!result.success) {
    console.error("Compilation failed:");
    console.error("Errors:", result.errors);
    process.exit(1);
  }

  // Read the generated header file
  const headerFile = join(testDir, "scope-visibility.h");
  if (!existsSync(headerFile)) {
    console.error("ERROR: Header file was not generated");
    process.exit(1);
  }

  const headerContent = readFileSync(headerFile, "utf-8");

  console.log("\n=== Generated Header Content ===");
  console.log(headerContent);
  console.log("================================\n");

  // Also read the generated C++ file to see the implementation
  const cppFile = join(testDir, "scope-visibility.cpp");
  if (existsSync(cppFile)) {
    const cppContent = readFileSync(cppFile, "utf-8");
    console.log("\n=== Generated C++ Content ===");
    console.log(cppContent);
    console.log("==============================\n");
  }

  // Validation checks
  const checks = [
    {
      test: () =>
        headerContent.includes("extern uint32_t TestScope_publicCounter"),
      description:
        "Public variable TestScope_publicCounter should have extern declaration",
      expected: true,
    },
    {
      test: () => headerContent.includes("extern bool TestScope_publicFlag"),
      description:
        "Public variable TestScope_publicFlag should have extern declaration",
      expected: true,
    },
    {
      test: () => !headerContent.includes("TestScope_privateCounter"),
      description:
        "Private variable TestScope_privateCounter should NOT appear in header",
      expected: true,
    },
    {
      test: () => !headerContent.includes("TestScope_privateFlag"),
      description:
        "Private variable TestScope_privateFlag should NOT appear in header",
      expected: true,
    },
    {
      test: () => headerContent.includes("TestScope_getPrivateCounter"),
      description:
        "Public method TestScope_getPrivateCounter should have prototype",
      expected: true,
    },
    {
      test: () => headerContent.includes("TestScope_getPublicCounter"),
      description:
        "Public method TestScope_getPublicCounter should have prototype",
      expected: true,
    },
    {
      test: () => !headerContent.includes("TestScope_getPrivateInternal"),
      description:
        "Private method TestScope_getPrivateInternal should NOT appear in header",
      expected: true,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    const checkResult = check.test();
    if (checkResult === check.expected) {
      console.log(`PASS: ${check.description}`);
      passed++;
    } else {
      console.error(`FAIL: ${check.description}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error(
      "\nTest FAILED - private scope members are incorrectly appearing in the header",
    );
    process.exit(1);
  }

  console.log("\nAll checks passed!");
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
