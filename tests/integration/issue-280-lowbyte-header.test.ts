#!/usr/bin/env tsx
/**
 * Integration test for Issue #280: Exact reproduction case from bug report
 *
 * This test verifies the exact scenario reported in Issue #280:
 * - A `lowByte` function that takes a u16 value parameter
 * - The .cpp file should show: uint8_t lowByte(uint16_t value)
 * - The .h file should show: uint8_t lowByte(uint16_t value) - NOT a pointer
 *
 * Prior to the fix, the header would incorrectly generate:
 *   uint8_t lowByte(uint16_t* value)  // WRONG - pointer instead of value
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Pipeline from "../../src/pipeline/Pipeline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Exact reproduction case from Issue #280
// Note: public keyword requires a scope in C-Next
const j1939EncodeSource = `
// Reproduction of Issue #280 scenario
// j1939_encode.cnx with lowByte function

scope j1939_encode {
    public u8 lowByte(u16 value) {
        return (u8)(value & 0xFF);
    }

    public u8 highByte(u16 value) {
        return (u8)((value >> 8) & 0xFF);
    }

    // Function that modifies its parameter - should remain pointer
    public void setValue(u16 target) {
        target <- 0x1234;
    }
}
`;

async function runTest() {
  const testDir = "/tmp/c-next-test-280-lowbyte";

  // Clean up any previous test run
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }

  const srcDir = join(testDir, "src");
  mkdirSync(srcDir, { recursive: true });

  const filePath = join(srcDir, "j1939_encode.cnx");
  writeFileSync(filePath, j1939EncodeSource, "utf-8");

  // Configure pipeline with header generation
  const pipeline = new Pipeline({
    inputs: [filePath],
    outDir: testDir,
    includeDirs: [],
    generateHeaders: true,
  });

  console.log("Compiling Issue #280 reproduction case...");
  const result = await pipeline.run();

  if (!result.success) {
    console.error("Compilation failed:");
    console.error("Errors:", result.errors);
    process.exit(1);
  }

  // Read generated files
  const headerPath = join(testDir, "j1939_encode.h");
  const cppPath = join(testDir, "j1939_encode.c");

  if (!existsSync(headerPath)) {
    console.error("ERROR: j1939_encode.h was not generated");
    process.exit(1);
  }

  const headerContent = readFileSync(headerPath, "utf-8");
  const cppContent = existsSync(cppPath) ? readFileSync(cppPath, "utf-8") : "";

  console.log("\n=== Generated j1939_encode.h ===");
  console.log(headerContent);
  console.log("================================\n");

  console.log("\n=== Generated j1939_encode.c ===");
  console.log(cppContent);
  console.log("================================\n");

  // Validation checks matching Issue #280 expectations
  // Note: scope name becomes part of function name prefix
  const checks = [
    // === lowByte checks (exact case from issue) ===
    {
      test: () =>
        headerContent.includes("uint8_t j1939_encode_lowByte(uint16_t value)"),
      description:
        "HEADER: lowByte should have pass-by-value: uint8_t j1939_encode_lowByte(uint16_t value)",
      expected: true,
    },
    {
      test: () =>
        !headerContent.includes("j1939_encode_lowByte(uint16_t* value"),
      description:
        "HEADER: lowByte should NOT have pointer signature (Issue #280 bug)",
      expected: true,
    },
    {
      test: () =>
        cppContent.includes("uint8_t j1939_encode_lowByte(uint16_t value)"),
      description:
        "CPP: lowByte should have pass-by-value: uint8_t j1939_encode_lowByte(uint16_t value)",
      expected: true,
    },
    // === highByte checks (similar case) ===
    {
      test: () =>
        headerContent.includes("uint8_t j1939_encode_highByte(uint16_t value)"),
      description:
        "HEADER: highByte should have pass-by-value: uint8_t j1939_encode_highByte(uint16_t value)",
      expected: true,
    },
    {
      test: () =>
        !headerContent.includes("j1939_encode_highByte(uint16_t* value"),
      description: "HEADER: highByte should NOT have pointer signature",
      expected: true,
    },
    // === setValue checks (should remain pointer - modifies param) ===
    {
      test: () =>
        headerContent.includes("void j1939_encode_setValue(uint16_t* target)"),
      description:
        "HEADER: setValue should have pointer (modifies param): void j1939_encode_setValue(uint16_t* target)",
      expected: true,
    },
    // === Signature match between .h and .c ===
    {
      test: () => {
        // Extract lowByte signatures from both files
        const headerSig = headerContent.match(
          /j1939_encode_lowByte\([^)]+\)/,
        )?.[0];
        const cppSig = cppContent.match(/j1939_encode_lowByte\([^)]+\)/)?.[0];
        return headerSig === cppSig;
      },
      description:
        "CONSISTENCY: lowByte signature in .h must match .c (prevents linker errors)",
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
    console.error("\nTest FAILED - Issue #280 regression detected!");
    console.error(
      "Headers still showing pointer signatures for pass-by-value parameters",
    );
    process.exit(1);
  }

  console.log("\nAll checks passed - Issue #280 is fixed!");
  console.log(
    "Headers correctly show pass-by-value signatures matching implementation.",
  );
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
