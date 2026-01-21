#!/usr/bin/env tsx
/**
 * Integration test for Issue #294: Cross-scope function calls not converted
 *
 * Problem: When calling functions from another scope defined in an included file
 * using bare scope access (scopeName.function() instead of global.scopeName.function()),
 * the transpiler outputs invalid code with dot notation instead of either:
 * 1. Throwing an error requiring the global. prefix, or
 * 2. Converting to underscore notation (scopeName_function())
 *
 * This test verifies that bare scope access from within a scope throws an error
 * when the target scope is defined in an included file, just like it does when
 * both scopes are in the same file.
 */

import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Pipeline from "../../src/pipeline/Pipeline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// First file: defines a scope with a public function
const providerSource = `
scope j1939_decode {
    public u16 getSpn(const u8 data[8]) {
        return 100;
    }
}
`;

// Second file: includes first file and calls function with bare scope access
// This SHOULD error because you must use global.j1939_decode.getSpn() from inside a scope
const consumerSource = `
#include <j1939_decode.cnx>

scope j1939_bus {
    public void handleMessage(const u8 data[8]) {
        // BUG: This bare scope access should error but doesn't when scope is in included file
        u16 spn <- j1939_decode.getSpn(data);
    }
}

void main() {
}
`;

async function runTest() {
  const testDir = "/tmp/c-next-test-294";

  // Clean up any previous test run
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }

  const srcDir = join(testDir, "src");
  mkdirSync(srcDir, { recursive: true });

  const providerPath = join(srcDir, "j1939_decode.cnx");
  const consumerPath = join(srcDir, "j1939_bus.cnx");

  writeFileSync(providerPath, providerSource, "utf-8");
  writeFileSync(consumerPath, consumerSource, "utf-8");

  const pipeline = new Pipeline({
    inputs: [srcDir],
    outDir: testDir,
    includeDirs: [srcDir],
    generateHeaders: true,
  });

  console.log("Testing bare scope access with included file...");
  const result = await pipeline.run();

  // The expected behavior is that this should FAIL with an error
  // because bare scope access (j1939_decode.getSpn) is not allowed
  // when inside another scope - you must use global.j1939_decode.getSpn()

  if (result.success) {
    // BUG: The compilation succeeded when it should have failed!
    // Check if the generated code has the bug (dot notation instead of underscore)
    const { readFileSync } = await import("fs");
    const generatedPath = join(testDir, "j1939_bus.c");

    if (existsSync(generatedPath)) {
      const generatedCode = readFileSync(generatedPath, "utf-8");
      console.log("\n=== Generated j1939_bus.c ===");
      console.log(generatedCode);
      console.log("================================\n");

      if (generatedCode.includes("j1939_decode.getSpn")) {
        console.error(
          "FAIL: Generated code contains dot notation (j1939_decode.getSpn)",
        );
        console.error(
          "Expected: Either an error OR conversion to underscore notation (j1939_decode_getSpn)",
        );
        process.exit(1);
      }

      if (generatedCode.includes("j1939_decode_getSpn")) {
        console.error(
          "FAIL: Bare scope access should have thrown an error, not been silently converted",
        );
        console.error(
          "Inside a scope, you must use global.j1939_decode.getSpn() not j1939_decode.getSpn()",
        );
        process.exit(1);
      }
    }

    console.error("FAIL: Compilation succeeded when it should have failed");
    console.error(
      "Bare scope access (j1939_decode.getSpn) should require global. prefix",
    );
    process.exit(1);
  }

  // Check that we got the expected error message
  const errorMessages = result.errors?.map((e) => e.message).join(" ") || "";
  const expectedErrorPattern = /global\.j1939_decode/i;

  if (expectedErrorPattern.test(errorMessages)) {
    console.log("PASS: Got expected error requiring global. prefix");
    console.log("Error message:", result.errors?.[0]?.message);
  } else {
    console.error("FAIL: Did not get expected error about global. prefix");
    console.error("Actual errors:", result.errors);
    process.exit(1);
  }

  console.log("\nAll checks passed!");
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
