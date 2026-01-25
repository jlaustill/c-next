#!/usr/bin/env tsx
/**
 * Integration test for Issue #280: Header not updated when function signatures change
 *
 * Problem: In multi-file builds, headers for earlier files get pointer signatures
 * instead of pass-by-value signatures because passByValueParams only contains the
 * last file's data when header generation runs.
 *
 * Test setup:
 * - Two C-Next files, each with a function that has a small unmodified struct parameter
 * - Both should generate headers with pass-by-value (no pointer) signatures
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Pipeline from "../../src/pipeline/Pipeline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// First file: math_utils with a primitive parameter function
// Uses u32 which qualifies for pass-by-value optimization
const file1Source = `
// File 1: math_utils.cnx
// Contains a public function that takes a small primitive type

scope MathUtils {
    // This function takes u32 but never modifies it
    // Should be pass-by-value in both .c and .h
    public u32 square(u32 value) {
        return value * value;
    }

    // This function modifies its parameter - should be pointer
    public void increment(u32 counter) {
        counter <- counter + 1;
    }
}
`;

// Second file: vector_utils with another primitive parameter function
const file2Source = `
// File 2: vector_utils.cnx
// Contains another public function with primitive parameter

scope VectorUtils {
    // This function takes u32 but never modifies it
    // Should be pass-by-value in both .c and .h
    public u32 double_it(u32 value) {
        return value * 2;
    }

    // This function modifies its parameter - should be pointer
    public void decrement(u32 counter) {
        counter <- counter - 1;
    }
}
`;

// Main test function
async function runTest() {
  const testDir = "/tmp/c-next-test-280";

  // Clean up any previous test run
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }

  const srcDir = join(testDir, "src");
  mkdirSync(srcDir, { recursive: true });

  const file1Path = join(srcDir, "math_utils.cnx");
  const file2Path = join(srcDir, "vector_utils.cnx");

  writeFileSync(file1Path, file1Source, "utf-8");
  writeFileSync(file2Path, file2Source, "utf-8");

  // Configure pipeline with header generation (process both files explicitly)
  // Use explicit file list to ensure deterministic processing order
  const pipeline = new Pipeline({
    inputs: [file1Path, file2Path], // Explicit files instead of directory
    outDir: testDir,
    includeDirs: [],
    generateHeaders: true,
  });

  console.log("Compiling multi-file project with header generation...");
  const result = await pipeline.run();

  if (!result.success) {
    console.error("Compilation failed:");
    console.error("Errors:", result.errors);
    process.exit(1);
  }

  // Read generated files (flat output since files passed individually)
  const header1Path = join(testDir, "math_utils.h");
  const header2Path = join(testDir, "vector_utils.h");
  const cpp1Path = join(testDir, "math_utils.c");
  const cpp2Path = join(testDir, "vector_utils.c");

  // Check that header files were generated
  if (!existsSync(header1Path)) {
    console.error("ERROR: math_utils.h was not generated");
    process.exit(1);
  }
  if (!existsSync(header2Path)) {
    console.error("ERROR: vector_utils.h was not generated");
    process.exit(1);
  }

  const header1Content = readFileSync(header1Path, "utf-8");
  const header2Content = readFileSync(header2Path, "utf-8");
  const cpp1Content = existsSync(cpp1Path)
    ? readFileSync(cpp1Path, "utf-8")
    : "";
  const cpp2Content = existsSync(cpp2Path)
    ? readFileSync(cpp2Path, "utf-8")
    : "";

  console.log("\n=== Generated math_utils.h ===");
  console.log(header1Content);
  console.log("================================\n");

  console.log("\n=== Generated vector_utils.h ===");
  console.log(header2Content);
  console.log("================================\n");

  console.log("\n=== Generated math_utils.c ===");
  console.log(cpp1Content);
  console.log("================================\n");

  console.log("\n=== Generated vector_utils.c ===");
  console.log(cpp2Content);
  console.log("================================\n");

  // Validation checks - the key insight is that BOTH headers should have
  // pass-by-value signatures (uint32_t value) NOT pointers (uint32_t* value)
  // This tests Issue #280: multi-file header pass-by-value consistency
  const checks = [
    // === File 1 (math_utils) checks ===
    {
      test: () =>
        header1Content.includes("uint32_t MathUtils_square(uint32_t value)"),
      description:
        "math_utils.h should have pass-by-value: MathUtils_square(uint32_t value)",
      expected: true,
    },
    {
      test: () => !header1Content.includes("MathUtils_square(uint32_t* value"),
      description:
        "math_utils.h should NOT have pointer: MathUtils_square(uint32_t* value)",
      expected: true,
    },
    {
      test: () =>
        header1Content.includes("void MathUtils_increment(uint32_t* counter)"),
      description:
        "math_utils.h should have pointer for modified param: MathUtils_increment(uint32_t* counter)",
      expected: true,
    },
    // === File 2 (vector_utils) checks ===
    {
      test: () =>
        header2Content.includes(
          "uint32_t VectorUtils_double_it(uint32_t value)",
        ),
      description:
        "vector_utils.h should have pass-by-value: VectorUtils_double_it(uint32_t value)",
      expected: true,
    },
    {
      test: () =>
        !header2Content.includes("VectorUtils_double_it(uint32_t* value"),
      description:
        "vector_utils.h should NOT have pointer: VectorUtils_double_it(uint32_t* value)",
      expected: true,
    },
    {
      test: () =>
        header2Content.includes(
          "void VectorUtils_decrement(uint32_t* counter)",
        ),
      description:
        "vector_utils.h should have pointer for modified param: VectorUtils_decrement(uint32_t* counter)",
      expected: true,
    },
    // === .c file checks (should match headers) ===
    {
      test: () =>
        cpp1Content.includes("uint32_t MathUtils_square(uint32_t value)"),
      description:
        "math_utils.c should have pass-by-value: MathUtils_square(uint32_t value)",
      expected: true,
    },
    {
      test: () =>
        cpp2Content.includes("uint32_t VectorUtils_double_it(uint32_t value)"),
      description:
        "vector_utils.c should have pass-by-value: VectorUtils_double_it(uint32_t value)",
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
    console.error("\nTest FAILED - Issue #280: Headers not correctly updated");
    process.exit(1);
  }

  console.log("\nAll checks passed!");
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
