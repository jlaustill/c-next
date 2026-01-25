#!/usr/bin/env tsx
/**
 * Issue #331: Overlapping include paths cause duplicate symbol detection for same file
 *
 * This test verifies that when include paths overlap (e.g., the same directory
 * is included via different paths), the transpiler correctly canonicalizes
 * file paths and only processes each .cnx file once.
 *
 * Run with: npx tsx tests/regression/issue-331-overlapping-include-paths/test-issue-331.ts
 *
 * The bug manifested when:
 * - include paths like [src/module, src] overlap (src/module is inside src)
 * - The same file was discovered multiple times via different paths
 * - This caused "Symbol conflict: 'X' is defined multiple times" errors
 *   with the SAME file appearing multiple times in the error message
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import FileDiscovery from "../../../src/project/FileDiscovery";
import Pipeline from "../../../src/pipeline/Pipeline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(): Promise<void> {
  console.log("Issue #331: Testing overlapping include paths...\n");

  // Test directory structure:
  //   issue-331-overlapping-include-paths/
  //     src/
  //       module/
  //         App.cnx      <- Main file
  //         Utils.cnx    <- Included by App.cnx
  //
  // The overlapping paths are:
  //   - src/module (direct)
  //   - src (recursive, includes src/module)

  const srcDir = join(__dirname, "src");
  const moduleDir = join(srcDir, "module");
  const appFile = join(moduleDir, "App.cnx");

  // Test 1: FileDiscovery.discover should not return duplicates
  console.log("Test 1: FileDiscovery.discover() deduplication");

  // These paths overlap: moduleDir is inside srcDir
  const overlappingPaths = [moduleDir, srcDir];

  const discovered = FileDiscovery.discover(overlappingPaths, {
    recursive: true,
  });
  const cnxFiles = discovered.filter((f) => f.extension === ".cnx");

  console.log(`  Paths searched: ${overlappingPaths.length}`);
  console.log(`  Files discovered: ${cnxFiles.length}`);
  console.log(`  Unique paths: ${new Set(cnxFiles.map((f) => f.path)).size}`);

  if (cnxFiles.length !== 2) {
    // Should find App.cnx and Utils.cnx, each only once
    console.log("  FAIL: Expected 2 unique .cnx files, got:", cnxFiles.length);
    for (const f of cnxFiles) {
      console.log(`    ${f.path}`);
    }
    process.exit(1);
  }
  console.log("  PASS: Correct deduplication\n");

  // Test 2: Pipeline should not report symbol conflicts for the same file
  console.log("Test 2: Pipeline symbol conflict detection");

  // Create pipeline with overlapping include paths (like the bug report)
  const pipeline = new Pipeline({
    inputs: [appFile],
    includeDirs: [moduleDir, srcDir], // Overlapping: moduleDir is inside srcDir
    outDir: join(__dirname, "output"),
    noCache: true,
  });

  const result = await pipeline.run();

  if (result.conflicts.length > 0) {
    console.log("  FAIL: Symbol conflicts detected:\n");
    for (const conflict of result.conflicts) {
      console.log("    " + conflict.split("\n").join("\n    "));
    }
    console.log("");
    process.exit(1);
  }

  if (!result.success) {
    console.log("  FAIL: Transpilation failed:\n");
    for (const error of result.errors) {
      console.log(`    ${error.line}:${error.column} ${error.message}`);
    }
    console.log("");
    process.exit(1);
  }

  console.log("  PASS: No duplicate symbol conflicts");
  console.log(`  Files processed: ${result.filesProcessed}`);
  console.log(`  Symbols collected: ${result.symbolsCollected}`);
  console.log("");

  console.log("All tests PASSED!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
