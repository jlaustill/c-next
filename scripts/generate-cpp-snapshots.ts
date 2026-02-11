#!/usr/bin/env tsx
/**
 * Generate C++ Snapshots for Dual-Mode Testing
 *
 * This script generates .expected.cpp and .expected.hpp files for existing tests
 * to enable dual-mode testing (both C and C++ output validation).
 *
 * Usage:
 *   npx tsx scripts/generate-cpp-snapshots.ts                    # Generate for all tests
 *   npx tsx scripts/generate-cpp-snapshots.ts tests/enum         # Generate for specific directory
 *   npx tsx scripts/generate-cpp-snapshots.ts --dry-run          # Show what would be generated
 *
 * This script:
 * 1. Finds all .test.cnx files
 * 2. Skips tests with // test-c-only marker
 * 3. Transpiles each in C++ mode (cppRequired: true)
 * 4. Writes .expected.cpp and .expected.hpp files (if headers are generated)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Transpiler from "../src/transpiler/Transpiler";
import FileScanner from "./utils/FileScanner";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

interface IGenerationResult {
  file: string;
  generated: boolean;
  skipped: boolean;
  reason?: string;
  error?: string;
}

/**
 * Check if source has test-c-only marker (skip C++ generation)
 */
function hasCOnlyMarker(source: string): boolean {
  return /\/\/\s*test-c-only/i.test(source);
}

/**
 * Check if source has test-cpp-only or test-cpp-mode marker
 * (these already run in C++ mode, don't need separate C++ snapshots)
 */
function isCppOnlyTest(source: string): boolean {
  return (
    /\/\/\s*test-cpp-only/i.test(source) || /\/\/\s*test-cpp-mode/i.test(source)
  );
}

// Use shared FileScanner.findTestFiles instead of local implementation

/**
 * Generate C++ snapshots for a single test file
 */
async function generateCppSnapshot(
  cnxFile: string,
  dryRun: boolean,
): Promise<IGenerationResult> {
  const basePath = cnxFile.replace(/\.test\.cnx$/, "");
  const expectedCppFile = basePath + ".expected.cpp";
  const expectedHppFile = basePath + ".expected.hpp";
  const expectedErrorFile = basePath + ".expected.error";

  // Skip error tests
  if (existsSync(expectedErrorFile)) {
    return {
      file: cnxFile,
      generated: false,
      skipped: true,
      reason: "error test",
    };
  }

  const source = readFileSync(cnxFile, "utf-8");

  // Skip tests with C-only marker
  if (hasCOnlyMarker(source)) {
    return {
      file: cnxFile,
      generated: false,
      skipped: true,
      reason: "test-c-only marker",
    };
  }

  // Skip tests that are already C++ only (they use .expected.c for C++ output)
  if (isCppOnlyTest(source)) {
    return {
      file: cnxFile,
      generated: false,
      skipped: true,
      reason: "already C++ only (test-cpp-mode or test-cpp-only)",
    };
  }

  // Skip if .expected.cpp already exists
  if (existsSync(expectedCppFile)) {
    return {
      file: cnxFile,
      generated: false,
      skipped: true,
      reason: ".expected.cpp already exists",
    };
  }

  // Transpile in C++ mode
  try {
    const pipeline = new Transpiler({
      inputs: [],
      includeDirs: [join(rootDir, "tests/include")],
      noCache: true,
      cppRequired: true,
    });

    const result = await pipeline.transpileSource(source, {
      workingDir: dirname(cnxFile),
      sourcePath: cnxFile,
    });

    if (!result.success) {
      const errors = result.errors
        .map((e) => `${e.line}:${e.column} ${e.message}`)
        .join("\n");
      return {
        file: cnxFile,
        generated: false,
        skipped: false,
        error: `Transpilation failed: ${errors}`,
      };
    }

    if (!dryRun) {
      writeFileSync(expectedCppFile, result.code);
      if (result.headerCode) {
        writeFileSync(expectedHppFile, result.headerCode);
      }
    }

    return {
      file: cnxFile,
      generated: true,
      skipped: false,
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      file: cnxFile,
      generated: false,
      skipped: false,
      error: err.message,
    };
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const filterPath = args.find((arg) => !arg.startsWith("-"));

  // Determine path to process
  let targetPath = join(rootDir, "tests");
  if (filterPath) {
    targetPath = filterPath.startsWith("/")
      ? filterPath
      : join(rootDir, filterPath);
  }

  if (!existsSync(targetPath)) {
    console.error(chalk.red(`Error: Path not found: ${targetPath}`));
    process.exit(1);
  }

  console.log(chalk.cyan("Generate C++ Snapshots for Dual-Mode Testing"));
  console.log(chalk.dim(`Target: ${targetPath}`));
  if (dryRun) {
    console.log(chalk.yellow("Dry run mode - no files will be written"));
  }
  console.log();

  // Find all test files
  const stat = statSync(targetPath);
  const cnxFiles = stat.isFile()
    ? [targetPath]
    : FileScanner.findTestFiles(targetPath);

  console.log(`Found ${cnxFiles.length} test files`);
  console.log();

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const cnxFile of cnxFiles) {
    const result = await generateCppSnapshot(cnxFile, dryRun);
    const relativePath = cnxFile.replace(rootDir + "/", "");

    if (result.generated) {
      console.log(`${chalk.green("GEN")}     ${relativePath}`);
      generated++;
    } else if (result.skipped) {
      console.log(
        `${chalk.dim("SKIP")}    ${relativePath} ${chalk.dim(`(${result.reason})`)}`,
      );
      skipped++;
    } else if (result.error) {
      console.log(`${chalk.red("ERROR")}   ${relativePath}`);
      console.log(`        ${chalk.dim(result.error)}`);
      errors++;
    }
  }

  console.log();
  console.log(chalk.cyan("Summary:"));
  console.log(`  ${chalk.green("Generated:")} ${generated}`);
  console.log(`  ${chalk.dim("Skipped:")}   ${skipped}`);
  if (errors > 0) {
    console.log(`  ${chalk.red("Errors:")}    ${errors}`);
  }

  if (dryRun && generated > 0) {
    console.log();
    console.log(
      chalk.yellow("Run without --dry-run to actually generate files"),
    );
  }

  process.exit(errors > 0 ? 1 : 0);
}

main();
