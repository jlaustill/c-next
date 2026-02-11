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
 * 5. Finds and processes helper .cnx files referenced via #include directives
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Transpiler from "../src/transpiler/Transpiler";
import IncludeDiscovery from "../src/transpiler/data/IncludeDiscovery";
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
 * Check if source has test-cpp-only marker
 * (these already run in C++ mode, don't need separate C++ snapshots)
 */
function isCppOnlyTest(source: string): boolean {
  return /\/\/\s*test-cpp-only/i.test(source);
}

// Use shared FileScanner.findTestFiles instead of local implementation

/**
 * Track already-processed helper files to avoid duplicates
 */
const processedHelpers = new Set<string>();

/**
 * Extract .cnx includes from source content
 * Returns array of include paths (e.g., ["Config.cnx", "Utils.cnx"])
 */
function extractCnxIncludes(
  source: string,
): Array<{ path: string; isLocal: boolean }> {
  return IncludeDiscovery.extractIncludesWithInfo(source).filter((inc) =>
    inc.path.endsWith(".cnx"),
  );
}

/**
 * Resolve an include path to an absolute file path
 * Returns null if not found
 */
function resolveIncludePath(
  includePath: string,
  sourceDir: string,
  includeDirs: string[],
): string | null {
  const searchPaths = [sourceDir, ...includeDirs];
  return IncludeDiscovery.resolveInclude(includePath, searchPaths);
}

/**
 * Recursively find all helper .cnx files referenced by a source file
 */
function findHelperFiles(
  cnxFile: string,
  includeDirs: string[],
  visited: Set<string> = new Set(),
): string[] {
  const absolutePath = resolve(cnxFile);
  if (visited.has(absolutePath)) {
    return [];
  }
  visited.add(absolutePath);

  if (!existsSync(cnxFile)) {
    return [];
  }

  const source = readFileSync(cnxFile, "utf-8");
  const includes = extractCnxIncludes(source);
  const helpers: string[] = [];
  const sourceDir = dirname(cnxFile);

  for (const inc of includes) {
    const resolved = resolveIncludePath(inc.path, sourceDir, includeDirs);
    if (resolved && !visited.has(resolve(resolved))) {
      helpers.push(resolved);
      // Recursively find helpers of this helper
      helpers.push(...findHelperFiles(resolved, includeDirs, visited));
    }
  }

  return helpers;
}

/**
 * Generate C++ snapshots for a helper .cnx file (non-test file)
 */
async function generateHelperCppSnapshot(
  cnxFile: string,
  dryRun: boolean,
  includeDirs: string[],
): Promise<IGenerationResult> {
  const absolutePath = resolve(cnxFile);

  // Skip if already processed
  if (processedHelpers.has(absolutePath)) {
    return {
      file: cnxFile,
      generated: false,
      skipped: true,
      reason: "already processed",
    };
  }
  processedHelpers.add(absolutePath);

  // Helper files use .expected.cpp/.expected.hpp (no .test. prefix)
  const basePath = cnxFile.replace(/\.cnx$/, "");
  const expectedCppFile = basePath + ".expected.cpp";
  const expectedHppFile = basePath + ".expected.hpp";

  // Skip if .expected.cpp already exists
  if (existsSync(expectedCppFile)) {
    return {
      file: cnxFile,
      generated: false,
      skipped: true,
      reason: ".expected.cpp already exists",
    };
  }

  const source = readFileSync(cnxFile, "utf-8");

  // Skip helpers with C-only marker
  if (hasCOnlyMarker(source)) {
    return {
      file: cnxFile,
      generated: false,
      skipped: true,
      reason: "test-c-only marker",
    };
  }

  // Transpile in C++ mode
  try {
    const pipeline = new Transpiler({
      inputs: [],
      includeDirs,
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
      reason: "already C++ only (test-cpp-only)",
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

  // Build include dirs from target path (include tests/include for common includes)
  const includeDirs = [join(rootDir, "tests/include")];

  let generated = 0;
  let skipped = 0;
  let errors = 0;
  let helpersGenerated = 0;
  let helpersSkipped = 0;
  let helpersErrors = 0;

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

    // Find and process helper files referenced by this test
    const sourceDir = dirname(cnxFile);
    const allIncludeDirs = [sourceDir, ...includeDirs];
    const helpers = findHelperFiles(cnxFile, allIncludeDirs);

    for (const helper of helpers) {
      const helperResult = await generateHelperCppSnapshot(
        helper,
        dryRun,
        allIncludeDirs,
      );
      const helperRelativePath = helper.replace(rootDir + "/", "");

      if (helperResult.generated) {
        console.log(
          `${chalk.green("GEN")}     ${helperRelativePath} ${chalk.cyan("(helper)")}`,
        );
        helpersGenerated++;
      } else if (helperResult.skipped) {
        // Only show skipped helpers if verbose (they're expected to be skipped often)
        if (
          helperResult.reason !== "already processed" &&
          helperResult.reason !== ".expected.cpp already exists"
        ) {
          console.log(
            `${chalk.dim("SKIP")}    ${helperRelativePath} ${chalk.cyan("(helper)")} ${chalk.dim(`(${helperResult.reason})`)}`,
          );
        }
        helpersSkipped++;
      } else if (helperResult.error) {
        console.log(
          `${chalk.red("ERROR")}   ${helperRelativePath} ${chalk.cyan("(helper)")}`,
        );
        console.log(`        ${chalk.dim(helperResult.error)}`);
        helpersErrors++;
      }
    }
  }

  console.log();
  console.log(chalk.cyan("Summary:"));
  console.log(chalk.bold("  Test files:"));
  console.log(`    ${chalk.green("Generated:")} ${generated}`);
  console.log(`    ${chalk.dim("Skipped:")}   ${skipped}`);
  if (errors > 0) {
    console.log(`    ${chalk.red("Errors:")}    ${errors}`);
  }

  if (helpersGenerated > 0 || helpersErrors > 0) {
    console.log(chalk.bold("  Helper files:"));
    console.log(`    ${chalk.green("Generated:")} ${helpersGenerated}`);
    console.log(`    ${chalk.dim("Skipped:")}   ${helpersSkipped}`);
    if (helpersErrors > 0) {
      console.log(`    ${chalk.red("Errors:")}    ${helpersErrors}`);
    }
  }

  const totalGenerated = generated + helpersGenerated;
  const totalErrors = errors + helpersErrors;

  if (dryRun && totalGenerated > 0) {
    console.log();
    console.log(
      chalk.yellow("Run without --dry-run to actually generate files"),
    );
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main();
