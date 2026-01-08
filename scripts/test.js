#!/usr/bin/env node
/**
 * C-Next Integration Test Runner
 *
 * Comprehensive testing for transpiler output:
 * - Finds all .cnx test files
 * - Transpiles each file
 * - Compares output to .expected.c file (if exists)
 * - For error tests, compares to .expected.error file
 * - ALWAYS validates generated C:
 *   1. GCC compilation check
 *   2. Cppcheck static analysis
 *   3. Clang-tidy analysis
 *   4. MISRA C compliance check
 *   5. Execution test (if test-execution marker present)
 *
 * Execution testing:
 * - Add test-execution comment at top of .cnx file to enable
 * - Test must return 0 for success, non-zero for failure
 * - ARM tests (using LDREX/STREX/PRIMASK) auto-skip execution
 *
 * Usage:
 *   npm test                    # Run all tests with full validation
 *   npm test -- --update        # Update snapshots
 *   npm test -- tests/enum      # Run specific directory
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { transpile } from "../dist/lib/transpiler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

// ANSI colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

/**
 * Find all .cnx files recursively in a directory
 */
function findCnxFiles(dir) {
  const files = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findCnxFiles(fullPath));
    } else if (entry.endsWith(".cnx")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Normalize output for comparison (trim trailing whitespace, normalize line endings)
 */
function normalize(str) {
  return str
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/**
 * Validate that a C file compiles without errors
 * Uses gcc with -fsyntax-only for fast syntax checking
 */
function validateCompilation(cFile) {
  try {
    // Use gcc to check syntax only (no object file generated)
    // -std=c99 for C99 features, -fsyntax-only for fast check
    // Suppress warnings about unused variables and void main (common in tests)
    // -I tests/include for stub headers (e.g., cmsis_gcc.h for ARM intrinsics)
    execFileSync(
      "gcc",
      [
        "-fsyntax-only",
        "-std=c99",
        "-Wno-unused-variable",
        "-Wno-main",
        "-I",
        join(rootDir, "tests/include"),
        cFile,
      ],
      { encoding: "utf-8", timeout: 10000, stdio: "pipe" },
    );
    return { valid: true };
  } catch (error) {
    // Extract just the error messages
    const output = error.stderr || error.stdout || error.message;
    const errors = output
      .split("\n")
      .filter((line) => line.includes("error:"))
      .map((line) => line.replace(cFile + ":", ""))
      .slice(0, 5)
      .join("\n");
    return {
      valid: false,
      message: errors || "Compilation failed",
    };
  }
}

/**
 * Validate that a C file passes cppcheck static analysis
 */
function validateCppcheck(cFile) {
  try {
    execFileSync(
      "cppcheck",
      [
        "--error-exitcode=1",
        "--enable=warning,performance",
        "--suppress=unusedFunction",
        "--suppress=missingIncludeSystem",
        "--suppress=unusedVariable",
        "--quiet",
        cFile,
      ],
      { encoding: "utf-8", timeout: 30000, stdio: "pipe" },
    );
    return { valid: true };
  } catch (error) {
    const output = error.stderr || error.stdout || error.message;
    const issues = output
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .slice(0, 5)
      .join("\n");
    return {
      valid: false,
      message: issues || "Cppcheck failed",
    };
  }
}

/**
 * Validate that a C file passes clang-tidy analysis
 */
function validateClangTidy(cFile) {
  try {
    // Run clang-tidy with safety and readability checks
    execFileSync(
      "clang-tidy",
      [cFile, "--", "-std=c99", "-Wno-unused-variable"],
      { encoding: "utf-8", timeout: 30000, stdio: "pipe" },
    );
    return { valid: true };
  } catch (error) {
    const output = error.stderr || error.stdout || error.message;
    // Filter for actual warnings/errors (not notes)
    const issues = output
      .split("\n")
      .filter((line) => line.includes("warning:") || line.includes("error:"))
      .slice(0, 5)
      .join("\n");
    // clang-tidy returns non-zero even for warnings, only fail on errors
    if (issues.includes("error:")) {
      return {
        valid: false,
        message: issues || "Clang-tidy failed",
      };
    }
    return { valid: true };
  }
}

/**
 * Validate that a C file passes MISRA C compliance check
 * Uses cppcheck's MISRA addon
 */
function validateMisra(cFile) {
  try {
    // Run cppcheck with MISRA addon
    execFileSync(
      "cppcheck",
      [
        "--addon=misra",
        "--error-exitcode=1",
        "--suppress=missingIncludeSystem",
        "--suppress=unusedFunction",
        "--quiet",
        cFile,
      ],
      { encoding: "utf-8", timeout: 60000, stdio: "pipe" },
    );
    return { valid: true };
  } catch (error) {
    const output = error.stderr || error.stdout || error.message;
    const issues = output
      .split("\n")
      .filter((line) => line.includes("misra") || line.includes("MISRA"))
      .slice(0, 5)
      .join("\n");
    return {
      valid: false,
      message: issues || "MISRA check failed",
    };
  }
}

/**
 * Get a unique path for a test executable in the temp directory
 */
function getExecutablePath(cnxFile) {
  const testName = basename(cnxFile, ".cnx");
  const uniqueId = randomBytes(4).toString("hex");
  return join(tmpdir(), `cnx-test-${testName}-${uniqueId}`);
}

/**
 * Check if generated C code requires ARM runtime (can't execute on x86)
 */
function requiresArmRuntime(cCode) {
  return (
    cCode.includes("cmsis_gcc.h") ||
    cCode.includes("__LDREX") ||
    cCode.includes("__STREX") ||
    cCode.includes("__get_PRIMASK") ||
    cCode.includes("__set_PRIMASK") ||
    cCode.includes("__disable_irq") ||
    cCode.includes("__enable_irq")
  );
}

/**
 * Compile and execute a C file, validating exit code
 * @param {string} cFile - Path to the C file
 * @param {number} expectedExitCode - Expected exit code (default 0)
 * @returns {{valid: boolean, message?: string}}
 */
function executeTest(cFile, expectedExitCode = 0) {
  const execPath = getExecutablePath(cFile);

  try {
    // Compile to executable
    execFileSync(
      "gcc",
      [
        "-std=c99",
        "-Wno-unused-variable",
        "-Wno-main",
        "-I",
        join(rootDir, "tests/include"),
        "-o",
        execPath,
        cFile,
      ],
      { encoding: "utf-8", timeout: 30000, stdio: "pipe" },
    );

    // Execute the compiled program
    try {
      execFileSync(execPath, [], {
        encoding: "utf-8",
        timeout: 5000,
        stdio: "pipe",
      });

      // Program exited with 0
      if (expectedExitCode !== 0) {
        return {
          valid: false,
          message: `Expected exit ${expectedExitCode}, got 0`,
        };
      }
      return { valid: true };
    } catch (execError) {
      const actualCode = execError.status || 1;

      if (actualCode === expectedExitCode) {
        return { valid: true };
      }

      return {
        valid: false,
        message: `Expected exit 0, got ${actualCode}`,
      };
    }
  } catch (compileError) {
    const output = compileError.stderr || compileError.message;
    return {
      valid: false,
      message: `Compile failed: ${output.split("\n")[0]}`,
    };
  } finally {
    // Clean up executable
    try {
      if (existsSync(execPath)) {
        unlinkSync(execPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Check if validation tools are available
 */
function checkValidationTools() {
  const tools = { gcc: false, cppcheck: false, clangTidy: false, misra: false };

  try {
    execFileSync("gcc", ["--version"], { encoding: "utf-8", stdio: "pipe" });
    tools.gcc = true;
  } catch {}

  try {
    execFileSync("cppcheck", ["--version"], {
      encoding: "utf-8",
      stdio: "pipe",
    });
    tools.cppcheck = true;
    // MISRA addon requires cppcheck
    tools.misra = true;
  } catch {}

  try {
    execFileSync("clang-tidy", ["--version"], {
      encoding: "utf-8",
      stdio: "pipe",
    });
    tools.clangTidy = true;
  } catch {}

  return tools;
}

/**
 * Run a single test
 * Always validates: transpile -> snapshot match -> gcc -> cppcheck -> clang-tidy -> MISRA
 */
function runTest(cnxFile, updateMode, tools) {
  const source = readFileSync(cnxFile, "utf-8");
  const basePath = cnxFile.replace(/\.cnx$/, "");
  const expectedCFile = basePath + ".expected.c";
  const expectedErrorFile = basePath + ".expected.error";

  const result = transpile(source);

  // Check if this is an error test (no validation needed for error tests)
  if (existsSync(expectedErrorFile)) {
    const expectedErrors = readFileSync(expectedErrorFile, "utf-8").trim();

    if (result.success) {
      return {
        passed: false,
        message: `Expected errors but transpilation succeeded`,
        expected: expectedErrors,
        actual: "(no errors)",
      };
    }

    const actualErrors = result.errors
      .map((e) => `${e.line}:${e.column} ${e.message}`)
      .join("\n");

    if (updateMode) {
      writeFileSync(expectedErrorFile, actualErrors + "\n");
      return { passed: true, message: "Updated error snapshot", updated: true };
    }

    if (normalize(actualErrors) === normalize(expectedErrors)) {
      return { passed: true };
    }

    return {
      passed: false,
      message: "Error output mismatch",
      expected: expectedErrors,
      actual: actualErrors,
    };
  }

  // Check if this is a success test
  if (existsSync(expectedCFile)) {
    const expectedC = readFileSync(expectedCFile, "utf-8");

    if (!result.success) {
      const errors = result.errors
        .map((e) => `${e.line}:${e.column} ${e.message}`)
        .join("\n");
      return {
        passed: false,
        message: `Transpilation failed unexpectedly`,
        expected: "(success)",
        actual: errors,
      };
    }

    if (updateMode) {
      writeFileSync(expectedCFile, result.code);
      return { passed: true, message: "Updated C snapshot", updated: true };
    }

    if (normalize(result.code) === normalize(expectedC)) {
      // Snapshot matches - now run all validation steps

      // Step 1: GCC compilation
      if (tools.gcc) {
        const compileResult = validateCompilation(expectedCFile);
        if (!compileResult.valid) {
          return {
            passed: false,
            message: "GCC compilation failed",
            actual: compileResult.message,
          };
        }
      }

      // Step 2: Cppcheck static analysis
      if (tools.cppcheck) {
        const cppcheckResult = validateCppcheck(expectedCFile);
        if (!cppcheckResult.valid) {
          return {
            passed: false,
            message: "Cppcheck failed",
            actual: cppcheckResult.message,
          };
        }
      }

      // Step 3: Clang-tidy analysis
      if (tools.clangTidy) {
        const clangTidyResult = validateClangTidy(expectedCFile);
        if (!clangTidyResult.valid) {
          return {
            passed: false,
            message: "Clang-tidy failed",
            actual: clangTidyResult.message,
          };
        }
      }

      // Step 4: MISRA compliance check
      if (tools.misra) {
        const misraResult = validateMisra(expectedCFile);
        if (!misraResult.valid) {
          return {
            passed: false,
            message: "MISRA check failed",
            actual: misraResult.message,
          };
        }
      }

      // Step 5: Execution test (if /* test-execution */ marker present)
      if (source.includes("/* test-execution */")) {
        const expectedC = readFileSync(expectedCFile, "utf-8");
        if (requiresArmRuntime(expectedC)) {
          return { passed: true, skippedExec: true };
        }

        const execResult = executeTest(expectedCFile, 0);
        if (!execResult.valid) {
          return {
            passed: false,
            message: "Execution failed",
            actual: execResult.message,
          };
        }
      }

      return { passed: true };
    }

    return {
      passed: false,
      message: "C output mismatch",
      expected: expectedC,
      actual: result.code,
    };
  }

  // No expected file - in update mode, create one
  if (updateMode) {
    if (result.success) {
      writeFileSync(expectedCFile, result.code);
      return { passed: true, message: "Created C snapshot", updated: true };
    } else {
      const errors = result.errors
        .map((e) => `${e.line}:${e.column} ${e.message}`)
        .join("\n");
      writeFileSync(expectedErrorFile, errors + "\n");
      return { passed: true, message: "Created error snapshot", updated: true };
    }
  }

  // No expected file and not in update mode
  return {
    passed: false,
    message: "No expected file found. Run with --update to create snapshot.",
    noSnapshot: true,
  };
}

/**
 * Main test runner
 */
function main() {
  const args = process.argv.slice(2);
  const updateMode = args.includes("--update") || args.includes("-u");
  const filterPath = args.find((arg) => !arg.startsWith("-"));

  // Determine test directory
  let testDir = join(rootDir, "tests");
  if (filterPath) {
    testDir = filterPath.startsWith("/")
      ? filterPath
      : join(rootDir, filterPath);
  }

  if (!existsSync(testDir)) {
    console.error(
      `${colors.red}Error: Test directory not found: ${testDir}${colors.reset}`,
    );
    process.exit(1);
  }

  // Always check for validation tools (validation is mandatory)
  const tools = checkValidationTools();

  // Require at least GCC for compilation check
  if (!tools.gcc) {
    console.error(
      `${colors.red}Error: gcc is required for C compilation validation${colors.reset}`,
    );
    process.exit(1);
  }

  console.log(`${colors.cyan}C-Next Integration Tests${colors.reset}`);
  console.log(`${colors.dim}Test directory: ${testDir}${colors.reset}`);
  if (updateMode) {
    console.log(
      `${colors.yellow}Update mode: snapshots will be created/updated${colors.reset}`,
    );
  }

  // Show available validation tools
  const toolList = [];
  if (tools.gcc) toolList.push("gcc");
  if (tools.cppcheck) toolList.push("cppcheck");
  if (tools.clangTidy) toolList.push("clang-tidy");
  if (tools.misra) toolList.push("MISRA");
  console.log(
    `${colors.cyan}Validation: ${toolList.join(" → ")}${colors.reset}`,
  );
  console.log();

  const cnxFiles = findCnxFiles(testDir);

  if (cnxFiles.length === 0) {
    console.log(`${colors.yellow}No .cnx test files found${colors.reset}`);
    process.exit(0);
  }

  let passed = 0;
  let failed = 0;
  let updated = 0;
  let noSnapshot = 0;

  for (const cnxFile of cnxFiles) {
    const relativePath = cnxFile.replace(rootDir + "/", "");
    const result = runTest(cnxFile, updateMode, tools);

    if (result.passed) {
      if (result.updated) {
        console.log(`${colors.yellow}UPDATED${colors.reset} ${relativePath}`);
        updated++;
      } else if (result.skippedExec) {
        console.log(
          `${colors.green}PASS${colors.reset}    ${relativePath} ${colors.dim}(exec skipped: ARM)${colors.reset}`,
        );
      } else {
        console.log(`${colors.green}PASS${colors.reset}    ${relativePath}`);
      }
      passed++;
    } else {
      if (result.noSnapshot) {
        console.log(
          `${colors.yellow}SKIP${colors.reset}    ${relativePath} (no snapshot)`,
        );
        noSnapshot++;
      } else {
        console.log(`${colors.red}FAIL${colors.reset}    ${relativePath}`);
        console.log(`        ${colors.dim}${result.message}${colors.reset}`);
        if (result.expected && result.actual) {
          console.log(`        ${colors.dim}Expected:${colors.reset}`);
          console.log(
            `        ${result.expected.split("\n").slice(0, 5).join("\n        ")}`,
          );
          console.log(`        ${colors.dim}Actual:${colors.reset}`);
          console.log(
            `        ${result.actual.split("\n").slice(0, 5).join("\n        ")}`,
          );
        } else if (result.actual) {
          // Just actual (no expected) - for compilation/analysis errors
          console.log(
            `        ${result.actual.split("\n").slice(0, 5).join("\n        ")}`,
          );
        }
      }
      failed++;
    }
  }

  console.log();
  console.log(`${colors.cyan}Results:${colors.reset}`);
  console.log(`  ${colors.green}Passed:${colors.reset}  ${passed}`);
  if (failed > 0) {
    console.log(`  ${colors.red}Failed:${colors.reset}  ${failed}`);
  }
  if (updated > 0) {
    console.log(`  ${colors.yellow}Updated:${colors.reset} ${updated}`);
  }
  if (noSnapshot > 0) {
    console.log(
      `  ${colors.yellow}Skipped:${colors.reset} ${noSnapshot} (no snapshot)`,
    );
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
