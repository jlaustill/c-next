#!/usr/bin/env node
/**
 * C-Next CLI Integration Tests
 *
 * Tests the cnext CLI binary for correct behavior:
 * - Flag parsing (--version, --help, etc.)
 * - Exit codes (0 for success, 1 for errors)
 * - Default output path behavior
 * - Various compilation modes
 *
 * Usage:
 *   npm run test:cli
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  unlinkSync,
  writeFileSync,
  readFileSync,
  rmSync,
  mkdtempSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const cliPath = join(rootDir, "bin", "cnext.js");

let passed = 0;
let failed = 0;

/**
 * Run a CLI command in a specific directory and return result
 */
function runCliInDir(cwd, args = [], expectError = false) {
  try {
    const output = execFileSync("node", [cliPath, ...args], {
      encoding: "utf-8",
      cwd,
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, output, exitCode: 0 };
  } catch (error) {
    if (expectError) {
      return {
        success: false,
        output: error.stdout || "",
        stderr: error.stderr || "",
        exitCode: error.status || 1,
      };
    }
    throw error;
  }
}

/**
 * Run a CLI command in the root directory
 */
function runCli(args = [], expectError = false) {
  return runCliInDir(rootDir, args, expectError);
}

/**
 * Run a test case
 */
function test(name, fn) {
  try {
    fn();
    console.log(`${chalk.green("PASS")}    ${name}`);
    passed++;
  } catch (error) {
    console.log(`${chalk.red("FAIL")}    ${name}`);
    console.log(`        ${chalk.dim(error.message)}`);
    failed++;
  }
}

/**
 * Assert helper
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Clean up generated test files
 */
function cleanup(files) {
  for (const file of files) {
    if (existsSync(file)) {
      unlinkSync(file);
    }
  }
}

// ============================================================================
// Test Cases
// ============================================================================

console.log(chalk.cyan("C-Next CLI Integration Tests"));
console.log(chalk.dim(`CLI path: ${cliPath}`));
console.log();

// --version flag
test("--version returns version string and exits 0", () => {
  const result = runCli(["--version"]);
  assert(result.success, "Command should succeed");
  assert(
    result.output.includes("cnext v"),
    `Output should contain version: ${result.output}`,
  );
  assert(result.exitCode === 0, "Exit code should be 0");
});

test("-v returns version string and exits 0", () => {
  const result = runCli(["-v"]);
  assert(result.success, "Command should succeed");
  assert(
    result.output.includes("cnext v"),
    `Output should contain version: ${result.output}`,
  );
  assert(result.exitCode === 0, "Exit code should be 0");
});

// --help flag
test("--help shows help text and exits 0", () => {
  const result = runCli(["--help"]);
  assert(result.success, "Command should succeed");
  assert(
    result.output.includes("Usage:"),
    `Output should contain usage: ${result.output}`,
  );
  assert(
    result.output.includes("Options:"),
    `Output should contain options: ${result.output}`,
  );
  assert(result.exitCode === 0, "Exit code should be 0");
});

test("-h shows help text and exits 0", () => {
  const result = runCli(["-h"]);
  assert(result.success, "Command should succeed");
  assert(
    result.output.includes("Usage:"),
    `Output should contain usage: ${result.output}`,
  );
  assert(result.exitCode === 0, "Exit code should be 0");
});

// No arguments shows help (user-friendly behavior)
test("no arguments shows help and exits 0", () => {
  const result = runCli([]);
  assert(result.success, "Command should succeed (showing help)");
  assert(result.exitCode === 0, "Exit code should be 0");
  assert(result.output.includes("Usage:"), "Should show usage help");
});

// Default output path (alongside input)
// Note: The CLI writes to input dir then renames to -o path.
// Using a copy of the input file in /tmp/ avoids affecting tracked files.
test("single file transpiles to .c alongside input", () => {
  const tempInputDir = mkdtempSync(join(tmpdir(), "cnext-test-"));
  const tempInputFile = join(tempInputDir, "test.cnx");
  const tempOutputFile = join(tempInputDir, "test.c");

  try {
    // Copy the test file to a temp location
    writeFileSync(
      tempInputFile,
      readFileSync("tests/basics/hello-world.test.cnx", "utf-8"),
    );

    const result = runCliInDir(tempInputDir, [tempInputFile]);
    assert(result.success, `Command should succeed: ${result.output}`);
    assert(
      existsSync(tempOutputFile),
      `Output file should exist: ${tempOutputFile}`,
    );
  } finally {
    cleanupTempDir(tempInputDir);
  }
});

// Explicit -o flag
// Note: Using temp copy of input to avoid renaming tracked files
test("-o flag overrides output path", () => {
  const tempInputDir = mkdtempSync(join(tmpdir(), "cnext-test-"));
  const tempInputFile = join(tempInputDir, "test.cnx");
  const customOutput = join(tempInputDir, "custom-output.c");

  try {
    writeFileSync(
      tempInputFile,
      readFileSync("tests/basics/hello-world.test.cnx", "utf-8"),
    );

    const result = runCliInDir(tempInputDir, [
      tempInputFile,
      "-o",
      customOutput,
    ]);
    assert(result.success, `Command should succeed: ${result.output}`);
    assert(
      existsSync(customOutput),
      `Output file should exist: ${customOutput}`,
    );
  } finally {
    cleanupTempDir(tempInputDir);
  }
});

// --cpp flag
// Note: Using temp copy of input to avoid renaming tracked files
test("--cpp flag outputs .cpp extension", () => {
  const tempInputDir = mkdtempSync(join(tmpdir(), "cnext-test-"));
  const tempInputFile = join(tempInputDir, "test.cnx");
  const tempOutputFile = join(tempInputDir, "test.cpp");

  try {
    writeFileSync(
      tempInputFile,
      readFileSync("tests/basics/hello-world.test.cnx", "utf-8"),
    );

    const result = runCliInDir(tempInputDir, [tempInputFile, "--cpp"]);
    assert(result.success, `Command should succeed: ${result.output}`);
    assert(
      existsSync(tempOutputFile),
      `Output file should exist: ${tempOutputFile}`,
    );
  } finally {
    cleanupTempDir(tempInputDir);
  }
});

// Invalid file path
test("nonexistent file exits 1 with error", () => {
  const result = runCli(["nonexistent-file.cnx"], true);
  assert(!result.success, "Command should fail");
  assert(result.exitCode === 1, "Exit code should be 1");
});

// --parse mode
test("--parse mode validates without creating output file", () => {
  const inputFile = "tests/basics/hello-world.test.cnx";
  const wouldBeOutput = "tests/basics/hello-world.c";

  cleanup([join(rootDir, wouldBeOutput)]);

  const result = runCli([inputFile, "--parse"]);
  assert(result.success, `Command should succeed: ${result.output}`);
  assert(
    !existsSync(join(rootDir, wouldBeOutput)),
    "Output file should NOT be created in parse mode",
  );
});

// Syntax error handling
test("syntax error in file exits 1", () => {
  // Create a temp file with invalid syntax
  const tempFile = "/tmp/cnext-test-invalid.cnx";
  writeFileSync(tempFile, "this is not valid cnext syntax @@@");

  const result = runCli([tempFile], true);
  assert(!result.success, "Command should fail");
  assert(result.exitCode === 1, "Exit code should be 1");

  cleanup([tempFile]);
});

// ============================================================================
// PlatformIO Integration Tests (Issue #405)
// ============================================================================

/**
 * Create a temporary PlatformIO project directory
 * @param {string} pioIniContent - Content for platformio.ini
 * @returns {string} Path to temp directory
 */
function createTempPioProject(pioIniContent) {
  const tempDir = mkdtempSync(join(tmpdir(), "cnext-pio-test-"));
  writeFileSync(join(tempDir, "platformio.ini"), pioIniContent, "utf-8");
  return tempDir;
}

/**
 * Assert file contains substring
 */
function assertFileContains(filePath, substring, message) {
  assert(existsSync(filePath), `File should exist: ${filePath}`);
  const content = readFileSync(filePath, "utf-8");
  assert(
    content.includes(substring),
    message || `File ${filePath} should contain "${substring}"`,
  );
}

/**
 * Assert file does not exist
 */
function assertFileNotExists(filePath, message) {
  assert(
    !existsSync(filePath),
    message || `File should not exist: ${filePath}`,
  );
}

/**
 * Clean up a temp directory
 */
function cleanupTempDir(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Create temp test environment with .cnx and .c file paths
 * Returns object with tempDir, cnxFile, cFile, and optional configFile
 */
function createTempTestEnv(prefix = "cnext-test-") {
  const tempDir = mkdtempSync(join(tmpdir(), prefix));
  return {
    tempDir,
    cnxFile: join(tempDir, "test.cnx"),
    cFile: join(tempDir, "test.c"),
    configFile: join(tempDir, "cnext.config.json"),
  };
}

/**
 * Run a test with temp directory setup and automatic cleanup
 */
function withTempTest(prefix, testFn) {
  const env = createTempTestEnv(prefix);
  try {
    testFn(env);
  } finally {
    cleanupTempDir(env.tempDir);
  }
}

// Minimal platformio.ini for tests
const minimalPioIni = `[env:teensy41]
platform = teensy
board = teensy41
framework = arduino
`;

// Multi-environment platformio.ini
const multiEnvPioIni = `[env:teensy41]
platform = teensy
board = teensy41
framework = arduino

[env:esp32]
platform = espressif32
board = esp32dev
framework = arduino

[env:uno]
platform = atmelavr
board = uno
framework = arduino
`;

// platformio.ini with existing extra_scripts
const pioIniWithExtraScripts = `[env:teensy41]
platform = teensy
board = teensy41
framework = arduino
extra_scripts = pre:custom_script.py
`;

// Simple atomic .cnx file for target tests
const atomicCnx = `atomic u32 counter <- 0;

void increment() {
    counter +<- 1;
}
`;

// ----------------------------------------------------------------------------
// Category 1: --pio-install tests
// ----------------------------------------------------------------------------

test("--pio-install creates cnext_build.py and modifies platformio.ini", () => {
  const tempDir = createTempPioProject(minimalPioIni);
  try {
    const result = runCliInDir(tempDir, ["--pio-install"]);
    assert(result.success, `Command should succeed: ${result.output}`);

    // Verify cnext_build.py was created
    assertFileContains(
      join(tempDir, "cnext_build.py"),
      "def transpile_cnext",
      "cnext_build.py should contain transpile function",
    );

    // Verify platformio.ini was modified
    assertFileContains(
      join(tempDir, "platformio.ini"),
      "extra_scripts",
      "platformio.ini should have extra_scripts",
    );
    assertFileContains(
      join(tempDir, "platformio.ini"),
      "cnext_build.py",
      "platformio.ini should reference cnext_build.py",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("--pio-install is idempotent (safe to run twice)", () => {
  const tempDir = createTempPioProject(minimalPioIni);
  try {
    // First install
    runCliInDir(tempDir, ["--pio-install"]);

    // Second install should succeed without duplicating entries
    const result = runCliInDir(tempDir, ["--pio-install"]);
    assert(result.success, "Second install should succeed");
    assert(
      result.output.includes("already configured"),
      "Should indicate already configured",
    );

    // Verify no duplicate entries
    const pioIni = readFileSync(join(tempDir, "platformio.ini"), "utf-8");
    const matches = pioIni.match(/cnext_build\.py/g) || [];
    assert(
      matches.length === 1,
      "Should have exactly one cnext_build.py entry",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("--pio-install fails without platformio.ini", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnext-pio-test-"));
  try {
    const result = runCliInDir(tempDir, ["--pio-install"], true);
    assert(!result.success, "Should fail without platformio.ini");
    assert(result.exitCode === 1, "Exit code should be 1");
    assert(
      result.stderr.includes("platformio.ini not found") ||
        result.output.includes("platformio.ini not found"),
      "Should mention missing platformio.ini",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("--pio-install preserves existing extra_scripts", () => {
  const tempDir = createTempPioProject(pioIniWithExtraScripts);
  try {
    runCliInDir(tempDir, ["--pio-install"]);

    const pioIni = readFileSync(join(tempDir, "platformio.ini"), "utf-8");
    assert(
      pioIni.includes("custom_script.py"),
      "Should preserve existing custom_script.py",
    );
    assert(pioIni.includes("cnext_build.py"), "Should add cnext_build.py");
  } finally {
    cleanupTempDir(tempDir);
  }
});

// ----------------------------------------------------------------------------
// Category 2: --pio-uninstall tests
// ----------------------------------------------------------------------------

test("--pio-uninstall removes integration cleanly", () => {
  const tempDir = createTempPioProject(minimalPioIni);
  try {
    // First install
    runCliInDir(tempDir, ["--pio-install"]);
    assert(
      existsSync(join(tempDir, "cnext_build.py")),
      "Script should exist after install",
    );

    // Then uninstall
    const result = runCliInDir(tempDir, ["--pio-uninstall"]);
    assert(result.success, `Uninstall should succeed: ${result.output}`);

    // Verify cnext_build.py was removed
    assertFileNotExists(
      join(tempDir, "cnext_build.py"),
      "cnext_build.py should be removed",
    );

    // Verify platformio.ini was cleaned
    const pioIni = readFileSync(join(tempDir, "platformio.ini"), "utf-8");
    assert(
      !pioIni.includes("cnext_build.py"),
      "platformio.ini should not reference cnext_build.py",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("--pio-uninstall is idempotent (safe on clean project)", () => {
  const tempDir = createTempPioProject(minimalPioIni);
  try {
    // Uninstall on project that was never installed
    const result = runCliInDir(tempDir, ["--pio-uninstall"]);
    assert(result.success, "Uninstall should succeed on clean project");
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("--pio-uninstall fails without platformio.ini", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnext-pio-test-"));
  try {
    const result = runCliInDir(tempDir, ["--pio-uninstall"], true);
    assert(!result.success, "Should fail without platformio.ini");
    assert(result.exitCode === 1, "Exit code should be 1");
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("--pio-uninstall preserves other extra_scripts", () => {
  const tempDir = createTempPioProject(pioIniWithExtraScripts);
  try {
    // Install then uninstall
    runCliInDir(tempDir, ["--pio-install"]);
    runCliInDir(tempDir, ["--pio-uninstall"]);

    const pioIni = readFileSync(join(tempDir, "platformio.ini"), "utf-8");
    assert(
      pioIni.includes("custom_script.py"),
      "Should preserve custom_script.py after uninstall",
    );
    assert(!pioIni.includes("cnext_build.py"), "Should remove cnext_build.py");
  } finally {
    cleanupTempDir(tempDir);
  }
});

// ----------------------------------------------------------------------------
// Category 3: --target flag tests
// ----------------------------------------------------------------------------

test("--target teensy41 generates LDREX/STREX code", () => {
  withTempTest("cnext-target-test-", ({ tempDir, cnxFile, cFile }) => {
    writeFileSync(cnxFile, atomicCnx, "utf-8");
    const result = runCliInDir(tempDir, ["--target", "teensy41", cnxFile]);
    assert(result.success, `Compile should succeed: ${result.output}`);

    assertFileContains(cFile, "__LDREXW", "Should use LDREX for teensy41");
  });
});

test("--target cortex-m0 generates PRIMASK fallback code", () => {
  withTempTest("cnext-target-test-", ({ tempDir, cnxFile, cFile }) => {
    writeFileSync(cnxFile, atomicCnx, "utf-8");
    const result = runCliInDir(tempDir, ["--target", "cortex-m0", cnxFile]);
    assert(result.success, `Compile should succeed: ${result.output}`);

    assertFileContains(
      cFile,
      "__get_PRIMASK",
      "Should use PRIMASK for cortex-m0",
    );
    // Should NOT contain LDREX
    const content = readFileSync(cFile, "utf-8");
    assert(!content.includes("__LDREX"), "Should NOT use LDREX for cortex-m0");
  });
});

test("--target avr generates PRIMASK fallback code", () => {
  withTempTest("cnext-target-test-", ({ tempDir, cnxFile, cFile }) => {
    writeFileSync(cnxFile, atomicCnx, "utf-8");
    const result = runCliInDir(tempDir, ["--target", "avr", cnxFile]);
    assert(result.success, `Compile should succeed: ${result.output}`);

    // AVR should use PRIMASK fallback (no LDREX support)
    assertFileContains(cFile, "__get_PRIMASK", "Should use PRIMASK for avr");
  });
});

test("--target with unknown target still compiles (uses default)", () => {
  withTempTest("cnext-target-test-", ({ tempDir, cnxFile }) => {
    writeFileSync(cnxFile, atomicCnx, "utf-8");
    // Unknown target should fall back to default (PRIMASK)
    const result = runCliInDir(tempDir, ["--target", "unknown-board", cnxFile]);
    assert(
      result.success,
      "Should compile with unknown target (using default)",
    );
  });
});

// ----------------------------------------------------------------------------
// Category 4: Config file target tests
// ----------------------------------------------------------------------------

test("cnext.config.json target is respected", () => {
  withTempTest(
    "cnext-config-test-",
    ({ tempDir, cnxFile, cFile, configFile }) => {
      writeFileSync(cnxFile, atomicCnx, "utf-8");
      writeFileSync(
        configFile,
        JSON.stringify({ target: "cortex-m0" }, null, 2),
        "utf-8",
      );

      const result = runCliInDir(tempDir, [cnxFile]);
      assert(result.success, `Compile should succeed: ${result.output}`);

      assertFileContains(
        cFile,
        "__get_PRIMASK",
        "Config target should be used",
      );
    },
  );
});

test("CLI --target overrides config file target", () => {
  withTempTest(
    "cnext-config-test-",
    ({ tempDir, cnxFile, cFile, configFile }) => {
      writeFileSync(cnxFile, atomicCnx, "utf-8");
      // Config says cortex-m0 (PRIMASK)
      writeFileSync(
        configFile,
        JSON.stringify({ target: "cortex-m0" }, null, 2),
        "utf-8",
      );

      // CLI says teensy41 (LDREX) - should override
      const result = runCliInDir(tempDir, ["--target", "teensy41", cnxFile]);
      assert(result.success, `Compile should succeed: ${result.output}`);

      assertFileContains(
        cFile,
        "__LDREXW",
        "CLI --target should override config",
      );
    },
  );
});

// ============================================================================
// Category 5: Multi-file const inference tests (Issue #565)
// ============================================================================

// Multi-file const inference test files
const multiFileConstConfig = `struct Config {
    i32 value;
}
`;

const multiFileConstStorage = `#include "Config.cnx"

scope Storage {
    public void loadDefaults(Config config) {
        config.value <- 42;
    }
}
`;

const multiFileConstHandler = `#include "Config.cnx"
#include "Storage.cnx"

scope Handler {
    public u8 reset(Config cfg) {
        global.Storage.loadDefaults(cfg);
        return 0;
    }
}
`;

const multiFileConstSerial = `#include "Config.cnx"
#include "Handler.cnx"

scope Serial {
    void handleReset(Config config) {
        (void) global.Handler.reset(config);
    }

    public void process(Config config) {
        this.handleReset(config);
    }
}
`;

test("Issue #565: multi-file transitive const inference propagates correctly", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnext-multifile-const-"));

  try {
    // Create the multi-file test case
    writeFileSync(join(tempDir, "Config.cnx"), multiFileConstConfig, "utf-8");
    writeFileSync(join(tempDir, "Storage.cnx"), multiFileConstStorage, "utf-8");
    writeFileSync(join(tempDir, "Handler.cnx"), multiFileConstHandler, "utf-8");
    writeFileSync(join(tempDir, "Serial.cnx"), multiFileConstSerial, "utf-8");

    // Transpile with --cpp flag (const inference only applies in C++ mode)
    const result = runCliInDir(tempDir, ["Serial.cnx", "--cpp"]);
    assert(result.success, `Compile should succeed: ${result.output}`);

    // Read the generated Serial.cpp
    const serialCpp = readFileSync(join(tempDir, "Serial.cpp"), "utf-8");

    // Key assertion: Serial__handleReset should have NON-const Config&
    // because it calls Handler.reset which calls Storage.loadDefaults which modifies config
    assert(
      serialCpp.includes("Serial__handleReset(Config& config)"),
      "Serial__handleReset should have non-const Config& (transitive modification)",
    );
    assert(
      !serialCpp.includes("Serial__handleReset(const Config& config)"),
      "Serial__handleReset should NOT have const (it transitively modifies)",
    );

    // Also verify the intermediate functions are correct
    const handlerCpp = readFileSync(join(tempDir, "Handler.cpp"), "utf-8");
    assert(
      handlerCpp.includes("Handler__reset(Config& cfg)"),
      "Handler__reset should have non-const Config&",
    );

    const storageCpp = readFileSync(join(tempDir, "Storage.cpp"), "utf-8");
    assert(
      storageCpp.includes("Storage__loadDefaults(Config& config)"),
      "Storage__loadDefaults should have non-const Config&",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("Issue #565: read-only multi-file calls preserve const", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnext-multifile-const-"));

  // Test that read-only calls still get const correctly
  const readOnlyStorage = `#include "Config.cnx"

scope Storage {
    public i32 getValue(Config config) {
        return config.value;
    }
}
`;

  const readOnlyHandler = `#include "Config.cnx"
#include "Storage.cnx"

scope Handler {
    public i32 read(Config cfg) {
        return global.Storage.getValue(cfg);
    }
}
`;

  const readOnlySerial = `#include "Config.cnx"
#include "Handler.cnx"

scope Serial {
    public i32 readValue(Config config) {
        return global.Handler.read(config);
    }
}
`;

  try {
    writeFileSync(join(tempDir, "Config.cnx"), multiFileConstConfig, "utf-8");
    writeFileSync(join(tempDir, "Storage.cnx"), readOnlyStorage, "utf-8");
    writeFileSync(join(tempDir, "Handler.cnx"), readOnlyHandler, "utf-8");
    writeFileSync(join(tempDir, "Serial.cnx"), readOnlySerial, "utf-8");

    const result = runCliInDir(tempDir, ["Serial.cnx", "--cpp"]);
    assert(result.success, `Compile should succeed: ${result.output}`);

    // All functions should have const since none modify
    const serialCpp = readFileSync(join(tempDir, "Serial.cpp"), "utf-8");
    assert(
      serialCpp.includes("Serial__readValue(const Config& config)"),
      "Serial__readValue should have const Config& (read-only chain)",
    );

    const handlerCpp = readFileSync(join(tempDir, "Handler.cpp"), "utf-8");
    assert(
      handlerCpp.includes("Handler__read(const Config& cfg)"),
      "Handler__read should have const Config&",
    );

    const storageCpp = readFileSync(join(tempDir, "Storage.cpp"), "utf-8");
    assert(
      storageCpp.includes("Storage__getValue(const Config& config)"),
      "Storage__getValue should have const Config&",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

// ============================================================================
// Category 6: Issue #580 - C++ detection from headers tests
// ============================================================================

// C++ header that triggers C++ mode detection (has C++ class)
const cppHeaderContent = `// C++ header with class to trigger C++ mode detection
#ifndef CPP_SERIAL_H
#define CPP_SERIAL_H

class SerialClass {
public:
    void println(int value);
};

extern SerialClass Serial;

#endif
`;

const issue580Config = `struct Config {
    i32 value;
}
`;

const issue580Modifier = `#include "Config.cnx"

scope Modifier {
    public void reset(Config c) {
        c.value <- 42;
    }
}
`;

// Handler that includes C++ header (triggers detection) and calls modifier
const issue580Handler = `#include "CppSerial.h"
#include "Config.cnx"
#include "Modifier.cnx"

scope Handler {
    // This function ONLY passes config through to reset()
    // Issue #580: was incorrectly marked const when C++ detected from headers
    public void passThrough(Config config) {
        global.Modifier.reset(config);
    }
}
`;

test("Issue #580: C++ mode gives correct transitive const inference", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnext-issue580-"));

  try {
    // Create the test files
    writeFileSync(join(tempDir, "CppSerial.h"), cppHeaderContent, "utf-8");
    writeFileSync(join(tempDir, "Config.cnx"), issue580Config, "utf-8");
    writeFileSync(join(tempDir, "Modifier.cnx"), issue580Modifier, "utf-8");
    writeFileSync(join(tempDir, "Handler.cnx"), issue580Handler, "utf-8");

    // #1319: declare C++. This test is about transitive const inference, not
    // about how the mode is arrived at -- it used to omit --cpp and rely on the
    // header being sniffed, which now reports E0507 instead.
    const result = runCliInDir(tempDir, ["Handler.cnx", "--cpp"]);
    assert(result.success, `Compile should succeed: ${result.output}`);

    // Should generate .cpp file (C++ mode detected from header)
    assert(
      existsSync(join(tempDir, "Handler.cpp")),
      "Should generate .cpp in declared C++ mode",
    );

    // Key assertion: Handler__passThrough should have NON-const Config&
    // because it calls Modifier.reset which modifies config
    const handlerCpp = readFileSync(join(tempDir, "Handler.cpp"), "utf-8");
    assert(
      handlerCpp.includes("Handler__passThrough(Config& config)"),
      "Handler__passThrough should have non-const Config& (calls mutating function)",
    );
    assert(
      !handlerCpp.includes("Handler__passThrough(const Config& config)"),
      "Handler__passThrough should NOT have const (it transitively modifies)",
    );

    // Also verify Modifier was processed correctly
    assert(
      existsSync(join(tempDir, "Modifier.cpp")),
      "Should generate Modifier.cpp",
    );
    const modifierCpp = readFileSync(join(tempDir, "Modifier.cpp"), "utf-8");
    assert(
      modifierCpp.includes("Modifier__reset(Config& c)"),
      "Modifier__reset should have non-const Config&",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

// ============================================================================
// Issue #1467: one owner answers "which header does this include name?"
// ============================================================================

const includePathUtils = `struct Point {
    u8 x;
    u8 y;
}

scope Utils {
    public u8 add(u8 v) {
        return v + 1;
    }
}
`;

/**
 * Issue #1467: `useStruct` decides whether the included type crosses into the
 * generated HEADER. It must, for at least one case: a header that names an
 * external type gets its include from ExternalTypeHeaderBuilder, which is a
 * THIRD derivation of this path, and a fixture that only calls a function
 * never reaches it.
 */
const includePathMain = (includeSpec, useStruct) => `#include <${includeSpec}>

${
  useStruct
    ? `scope App {
    public u8 useIt(Point p) {
        return global.Utils.add(p.x);
    }
}`
    : `u8 result;`
}

i32 main() {
${useStruct ? "    return 0;" : "    result <- global.Utils.add(5);\n    return 0;"}
}
`;

/**
 * Issue #1467: the include naming `utils`, as each generated file spells it.
 * Narrowed to that one header so the run's own `main.h`/`stdint.h` lines
 * cannot mask a disagreement.
 */
function utilsIncludesIn(source) {
  return source
    .split("\n")
    .filter((line) => /^#include\s*[<"].*utils\.h/.test(line))
    .map((line) => line.trim());
}

/**
 * Issue #1467: build a project, transpile it with a separate `-o` and
 * `--header-out`, and report what each output emitted alongside where the
 * header was actually written.
 *
 * `utilsAt` is relative to the temp dir, so a case can put the included file
 * under the entry's tree (header nests) or outside it (header goes flat).
 */
function runIncludePathCase({
  includeSpec,
  utilsAt,
  includeArg,
  useStruct,
  projectDir = ".",
}) {
  const tempDir = mkdtempSync(join(tmpdir(), "cnext-1467-"));
  // `utilsAt` is relative to tempDir; the project (and the cwd the CLI runs in)
  // is `projectDir` under it. A case that puts the included file OUTSIDE the
  // project exercises the flat-header path -- see PathResolver's #489 branch.
  const projectRoot = join(tempDir, projectDir);
  mkdirSync(join(tempDir, dirname(utilsAt)), { recursive: true });
  mkdirSync(join(projectRoot, "src"), { recursive: true });
  writeFileSync(join(tempDir, utilsAt), includePathUtils, "utf-8");
  writeFileSync(
    join(projectRoot, "src", "main.cnx"),
    includePathMain(includeSpec, useStruct),
    "utf-8",
  );

  const result = runCliInDir(projectRoot, [
    "src/main.cnx",
    "-o",
    "build",
    "--header-out",
    "include",
    "--include",
    includeArg,
  ]);

  let gccExitCode = 0;
  let gccOutput = "";
  try {
    execFileSync(
      "gcc",
      ["-c", "build/main.c", "-I", "include", "-o", "/dev/null"],
      { cwd: projectRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );
  } catch (error) {
    gccExitCode = error.status ?? 1;
    gccOutput = error.stderr || error.stdout || "";
  }

  // Where the header actually landed, relative to --header-out.
  const headerRoot = join(projectRoot, "include");
  const candidates = ["Display/utils.h", "shared/utils.h", "utils.h"];
  const headerWrittenAt =
    candidates.find((c) => existsSync(join(headerRoot, c))) ?? "<not written>";

  return {
    tempDir,
    transpileSucceeded: result.success,
    cIncludes: utilsIncludesIn(
      readFileSync(join(projectRoot, "build", "main.c"), "utf-8"),
    ),
    hIncludes: utilsIncludesIn(
      readFileSync(join(projectRoot, "include", "main.h"), "utf-8"),
    ),
    headerWrittenAt,
    gccExitCode,
    gccOutput,
  };
}

/**
 * Issue #1467: the whole assertion, in one place, for every case below.
 *
 * `expected` is the single right answer -- where the header was actually
 * written, relative to `--header-out`. Every generated file must name exactly
 * that, which is the property that makes `-I <header-out>` sufficient.
 */
function assertIncludeAgreesWithHeader(label, actual, expected) {
  assert(actual.transpileSucceeded, `${label}: transpiler should exit 0`);
  assert(
    actual.headerWrittenAt === expected,
    `${label}: header should be at ${expected}, was ${actual.headerWrittenAt}`,
  );
  for (const [where, lines] of [
    ["main.c", actual.cIncludes],
    ["main.h", actual.hIncludes],
  ]) {
    assert(
      lines.length === 1 && lines[0] === `#include <${expected}>`,
      `${label}: ${where} should include <${expected}>, had ${JSON.stringify(lines)}`,
    );
  }
  assert(
    actual.gccExitCode === 0,
    `${label}: generated C should compile with -I include alone, gcc exited ` +
      `${actual.gccExitCode}\n${actual.gccOutput}`,
  );
}

// The contract: `-I <header-out>` alone is sufficient, so every emitted include
// names its header relative to that root. Cases 2-4 hold on the unfixed tree and
// are the negative controls -- a fix that prepends unconditionally breaks them.
const includePathCases = [
  {
    name: "Issue #1467: a bare angle include of a nested .cnx names the header's real path",
    includeSpec: "utils.cnx",
    utilsAt: "src/Display/utils.cnx",
    includeArg: "src/Display",
    useStruct: false,
    expected: "Display/utils.h",
  },
  {
    name: "Issue #1467 control: an already-qualified angle include stays correct",
    includeSpec: "Display/utils.cnx",
    utilsAt: "src/Display/utils.cnx",
    includeArg: "src/Display",
    useStruct: false,
    expected: "Display/utils.h",
  },
  {
    name: "Issue #1467 control: an include dir outside the project stays flat",
    includeSpec: "utils.cnx",
    utilsAt: "shared/utils.cnx",
    includeArg: "../shared",
    projectDir: "proj",
    useStruct: false,
    expected: "utils.h",
  },
  {
    // Found while building the control above: when the shared tree is INSIDE
    // the cwd, PathResolver's #489 branch nests the header instead, and the
    // emitted include is bare either way. Same defect, third layout.
    name: "Issue #1467: a shared tree inside the cwd nests the header, and the include must follow",
    includeSpec: "utils.cnx",
    utilsAt: "shared/utils.cnx",
    includeArg: "shared",
    useStruct: false,
    expected: "shared/utils.h",
  },
  {
    // NOT a guard for ExternalTypeHeaderBuilder: its directive is deduplicated
    // by stem before it reaches the output, so poisoning it reddens nothing
    // here. That path is guarded at its producer, in IncludeResolver's unit
    // tests. This case covers the layout where a type crosses the boundary,
    // which reaches more header-generation code than a bare call does.
    name: "Issue #1467: a type crossing into the header gets the same path",
    includeSpec: "utils.cnx",
    utilsAt: "src/Display/utils.cnx",
    includeArg: "src/Display",
    useStruct: true,
    expected: "Display/utils.h",
  },
];

for (const includeCase of includePathCases) {
  test(includeCase.name, () => {
    const actual = runIncludePathCase(includeCase);
    try {
      assertIncludeAgreesWithHeader(
        includeCase.name,
        actual,
        includeCase.expected,
      );
    } finally {
      cleanupTempDir(actual.tempDir);
    }
  });
}

// ============================================================================
// Summary
// ============================================================================

console.log();
console.log(chalk.cyan("Results:"));
console.log(`  ${chalk.green("Passed:")}  ${passed}`);
if (failed > 0) {
  console.log(`  ${chalk.red("Failed:")}  ${failed}`);
}

process.exit(failed > 0 ? 1 : 0);
