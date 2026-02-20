#!/usr/bin/env node
/**
 * Batch C/C++ Static Analysis
 *
 * Runs cppcheck, clang-tidy, MISRA, and flawfinder on all generated
 * test files in a single batch. This replaces per-file analysis that
 * previously ran during integration tests, amortizing tool startup
 * costs and ensuring local + CI behavior are identical.
 *
 * Usage:
 *   npm run validate:c              # Run all available checks
 *   node scripts/batch-validate.mjs # Same thing
 *
 * Security: All external tool invocations use execFileSync (not exec)
 * to prevent shell injection. File paths come from filesystem traversal,
 * not user input.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TESTS_DIR = join(ROOT, "tests");
const INCLUDE_DIR = join(ROOT, "tests/include");

// ============================================================================
// Tool detection
// ============================================================================

function toolAvailable(cmd) {
  try {
    execFileSync(cmd, ["--version"], {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

const hasCppcheck = toolAvailable("cppcheck");
const hasClangTidy = toolAvailable("clang-tidy");
const hasFlawfinder = toolAvailable("flawfinder");

// ============================================================================
// File discovery
// ============================================================================

function findFilesRecursively(dir, pattern) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFilesRecursively(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const cFiles = findFilesRecursively(TESTS_DIR, /\.test\.c$/);
const cppFiles = findFilesRecursively(TESTS_DIR, /\.test\.cpp$/);

console.log(`Found ${cFiles.length} C files and ${cppFiles.length} C++ files`);

if (cFiles.length === 0 && cppFiles.length === 0) {
  console.log("No test files found — run integration tests first (npm test)");
  process.exit(1);
}

// ============================================================================
// C++ detection (simplified from test-utils.ts TestUtils.requiresCpp14)
//
// Intentionally simplified — these patterns only determine which cppcheck/
// clang-tidy mode to use. A false negative (C++ file analyzed as C) causes
// cppcheck to handle it gracefully, so full transpiler-level detection
// (constructor patterns, detectCppSyntax) is not needed here.
// ============================================================================

const CPP_FEATURE_PATTERNS = [
  /\b(static_cast|reinterpret_cast|const_cast|dynamic_cast)\s*</,
  /\b(?!string\b)\w+<[^;=<>]+>/,
  /\w+::\w+/,
];

const CPP_HEADER_PATTERNS = [
  /\bclass\s+\w+/,
  /\bnamespace\s+\w+/,
  /\btemplate\s*</,
  /\bpublic\s*:/,
  /\bprivate\s*:/,
  /\bprotected\s*:/,
];

function hasCppFeatures(code) {
  for (const pattern of CPP_FEATURE_PATTERNS) {
    if (pattern.test(code)) return true;
  }
  return false;
}

function requiresCpp(cFile) {
  try {
    const code = readFileSync(cFile, "utf-8");
    if (hasCppFeatures(code)) return true;

    const includePattern = /#include\s+"([^"]+)"/g;
    let match;
    while ((match = includePattern.exec(code)) !== null) {
      const headerPath = join(dirname(cFile), match[1]);
      if (existsSync(headerPath)) {
        const headerContent = readFileSync(headerPath, "utf-8");
        if (hasCppFeatures(headerContent)) return true;
        for (const pattern of CPP_HEADER_PATTERNS) {
          if (pattern.test(headerContent)) return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ============================================================================
// Validation runners
// ============================================================================

let failures = 0;

function reportFailure(tool, file, message) {
  console.error(`FAIL [${tool}] ${file}`);
  if (message) {
    const lines = message.split("\n").slice(0, 5);
    for (const line of lines) {
      console.error(`  ${line}`);
    }
  }
  failures++;
}

// --- cppcheck (batch mode) ---
function runCppcheck() {
  if (!hasCppcheck) {
    console.log("⊘ cppcheck not available, skipping");
    return;
  }

  const baseArgs = [
    "--error-exitcode=1",
    "--enable=warning,performance",
    "--suppress=unusedFunction",
    "--suppress=missingIncludeSystem",
    "--suppress=unusedVariable",
    "--suppress=uninitMemberVar:*fixtures/*",
    "--quiet",
  ];

  // Batch C files (excluding those that need C++ mode)
  const pureCFiles = cFiles.filter((f) => !requiresCpp(f));
  const cppDetectedFiles = cFiles.filter((f) => requiresCpp(f));

  if (pureCFiles.length > 0) {
    console.log(`Running cppcheck on ${pureCFiles.length} C files...`);
    try {
      execFileSync("cppcheck", [...baseArgs, ...pureCFiles], {
        encoding: "utf-8",
        timeout: 300000,
        stdio: "pipe",
      });
    } catch (error) {
      const output = error.stderr || error.stdout || error.message;
      reportFailure("cppcheck", `${pureCFiles.length} C files`, output);
    }
  }

  // C files needing C++ mode + actual C++ files
  const allCppFiles = [...cppDetectedFiles, ...cppFiles];
  if (allCppFiles.length > 0) {
    console.log(
      `Running cppcheck (C++ mode) on ${allCppFiles.length} files...`,
    );
    try {
      execFileSync(
        "cppcheck",
        [...baseArgs, "--language=c++", "--std=c++14", ...allCppFiles],
        { encoding: "utf-8", timeout: 300000, stdio: "pipe" },
      );
    } catch (error) {
      const output = error.stderr || error.stdout || error.message;
      reportFailure("cppcheck-cpp", `${allCppFiles.length} C++ files`, output);
    }
  }
}

// --- clang-tidy (per-file, no batch mode) ---
// Enhancement over original: adds -I flags for include resolution, reducing
// false positives from missing headers (original validateClangTidy lacked these).
function runClangTidy() {
  if (!hasClangTidy) {
    console.log("⊘ clang-tidy not available, skipping");
    return;
  }

  const allFiles = [...cFiles, ...cppFiles];
  console.log(`Running clang-tidy on ${allFiles.length} files...`);

  for (const file of allFiles) {
    const useCpp = cppFiles.includes(file) || requiresCpp(file);
    const stdFlag = useCpp ? "-std=c++14" : "-std=c99";

    try {
      execFileSync(
        "clang-tidy",
        [
          file,
          "--",
          stdFlag,
          "-Wno-unused-variable",
          "-I",
          INCLUDE_DIR,
          "-I",
          dirname(file),
        ],
        { encoding: "utf-8", timeout: 30000, stdio: "pipe" },
      );
    } catch (error) {
      const output = error.stderr || error.stdout || error.message;
      const issues = output
        .split("\n")
        .filter((line) => line.includes("error:"))
        .slice(0, 5)
        .join("\n");
      // clang-tidy returns non-zero even for warnings; only fail on errors
      if (issues.includes("error:")) {
        reportFailure("clang-tidy", file, issues);
      }
    }
  }
}

// --- MISRA (per-file, C only) ---
// Files excluded from MISRA validation (contain valid exceptions or intentional violations)
const MISRA_EXCLUDED_FILES = [
  // uri-exception.test.c tests MISRA Amendment 4 URI exception (://);
  // cppcheck doesn't implement Amendment 4, so it false-positives on Rule 3.1
  "uri-exception.test.c",
];

function runMisra() {
  if (!hasCppcheck) {
    console.log("⊘ cppcheck not available (needed for MISRA addon), skipping");
    return;
  }

  // MISRA is C-only; skip files that need C++ compilation
  // Also exclude files testing valid MISRA exceptions
  const misraFiles = cFiles.filter(
    (f) =>
      !requiresCpp(f) && !MISRA_EXCLUDED_FILES.some((exc) => f.endsWith(exc)),
  );
  console.log(`Running MISRA on ${misraFiles.length} C files...`);

  for (const file of misraFiles) {
    try {
      execFileSync(
        "cppcheck",
        [
          "--addon=misra",
          "--error-exitcode=1",
          "--suppress=missingIncludeSystem",
          "--suppress=unusedFunction",
          "--quiet",
          "-I",
          INCLUDE_DIR,
          "-I",
          dirname(file),
          file,
        ],
        { encoding: "utf-8", timeout: 60000, stdio: "pipe" },
      );
    } catch (error) {
      const output = error.stderr || error.stdout || error.message;
      const issues = output
        .split("\n")
        .filter((line) => line.includes("misra") || line.includes("MISRA"))
        .slice(0, 5)
        .join("\n");
      reportFailure("MISRA", file, issues);
    }
  }
}

// --- flawfinder (batch mode) ---
function runFlawfinder() {
  if (!hasFlawfinder) {
    console.log("⊘ flawfinder not available, skipping");
    return;
  }

  const allFiles = [...cFiles, ...cppFiles];
  console.log(`Running flawfinder on ${allFiles.length} files...`);

  try {
    execFileSync(
      "flawfinder",
      ["--minlevel=3", "--error-level=3", "--dataonly", "--quiet", ...allFiles],
      { encoding: "utf-8", timeout: 120000, stdio: "pipe" },
    );
  } catch (error) {
    const output = error.stdout || error.stderr || error.message;
    const issues = output
      .split("\n")
      .filter((line) => line.includes("CWE") || line.trim().length > 0)
      .slice(0, 10)
      .join("\n");
    reportFailure("flawfinder", `${allFiles.length} files`, issues);
  }
}

// ============================================================================
// Main
// ============================================================================

const tools = [];
if (hasCppcheck) tools.push("cppcheck", "MISRA");
if (hasClangTidy) tools.push("clang-tidy");
if (hasFlawfinder) tools.push("flawfinder");

if (tools.length === 0) {
  console.log(
    "No static analysis tools available — install cppcheck, clang-tidy, or flawfinder",
  );
  process.exit(0);
}

console.log(`Tools: ${tools.join(", ")}`);
console.log();

runCppcheck();
runClangTidy();
runMisra();
runFlawfinder();

console.log();
if (failures > 0) {
  console.error(`${failures} validation failure(s)`);
  process.exit(1);
} else {
  console.log("All static analysis checks passed");
}
