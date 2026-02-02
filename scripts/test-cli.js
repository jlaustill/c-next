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
  mkdirSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const cliPath = join(rootDir, "bin", "cnext.js");

let passed = 0;
let failed = 0;

/**
 * Run a CLI command and return result
 */
function runCli(args = [], expectError = false) {
  try {
    const output = execFileSync("node", [cliPath, ...args], {
      encoding: "utf-8",
      cwd: rootDir,
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
test("single file transpiles to .c alongside input", () => {
  const inputFile = "tests/basics/hello-world.test.cnx";
  const expectedOutput = "tests/basics/hello-world.test.c";

  // Clean up first
  cleanup([expectedOutput]);

  const result = runCli([inputFile]);
  assert(result.success, `Command should succeed: ${result.output}`);
  assert(
    existsSync(join(rootDir, expectedOutput)),
    `Output file should exist: ${expectedOutput}`,
  );

  // Clean up
  cleanup([join(rootDir, expectedOutput)]);
});

// Explicit -o flag
test("-o flag overrides output path", () => {
  const inputFile = "tests/basics/hello-world.test.cnx";
  const customOutput = "/tmp/cnext-test-output.c";

  cleanup([customOutput]);

  const result = runCli([inputFile, "-o", customOutput]);
  assert(result.success, `Command should succeed: ${result.output}`);
  assert(existsSync(customOutput), `Output file should exist: ${customOutput}`);

  cleanup([customOutput]);
});

// --cpp flag
test("--cpp flag outputs .cpp extension", () => {
  const inputFile = "tests/basics/hello-world.test.cnx";
  const expectedOutput = "tests/basics/hello-world.test.cpp";

  cleanup([join(rootDir, expectedOutput)]);

  const result = runCli([inputFile, "--cpp"]);
  assert(result.success, `Command should succeed: ${result.output}`);
  assert(
    existsSync(join(rootDir, expectedOutput)),
    `Output file should exist: ${expectedOutput}`,
  );

  cleanup([join(rootDir, expectedOutput)]);
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
 * Run CLI command in a specific directory
 * @param {string} cwd - Working directory
 * @param {string[]} args - CLI arguments
 * @param {boolean} expectError - Whether to expect an error
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
  const tempDir = mkdtempSync(join(tmpdir(), "cnext-target-test-"));
  const cnxFile = join(tempDir, "test.cnx");
  const cFile = join(tempDir, "test.c");

  try {
    writeFileSync(cnxFile, atomicCnx, "utf-8");
    const result = runCliInDir(tempDir, ["--target", "teensy41", cnxFile]);
    assert(result.success, `Compile should succeed: ${result.output}`);

    assertFileContains(cFile, "__LDREXW", "Should use LDREX for teensy41");
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("--target cortex-m0 generates PRIMASK fallback code", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnext-target-test-"));
  const cnxFile = join(tempDir, "test.cnx");
  const cFile = join(tempDir, "test.c");

  try {
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
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("--target avr generates PRIMASK fallback code", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnext-target-test-"));
  const cnxFile = join(tempDir, "test.cnx");
  const cFile = join(tempDir, "test.c");

  try {
    writeFileSync(cnxFile, atomicCnx, "utf-8");
    const result = runCliInDir(tempDir, ["--target", "avr", cnxFile]);
    assert(result.success, `Compile should succeed: ${result.output}`);

    // AVR should use PRIMASK fallback (no LDREX support)
    assertFileContains(cFile, "__get_PRIMASK", "Should use PRIMASK for avr");
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("--target with unknown target still compiles (uses default)", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnext-target-test-"));
  const cnxFile = join(tempDir, "test.cnx");

  try {
    writeFileSync(cnxFile, atomicCnx, "utf-8");
    // Unknown target should fall back to default (PRIMASK)
    const result = runCliInDir(tempDir, ["--target", "unknown-board", cnxFile]);
    assert(
      result.success,
      "Should compile with unknown target (using default)",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

// ----------------------------------------------------------------------------
// Category 4: Config file target tests
// ----------------------------------------------------------------------------

test("cnext.config.json target is respected", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnext-config-test-"));
  const cnxFile = join(tempDir, "test.cnx");
  const cFile = join(tempDir, "test.c");
  const configFile = join(tempDir, "cnext.config.json");

  try {
    writeFileSync(cnxFile, atomicCnx, "utf-8");
    writeFileSync(
      configFile,
      JSON.stringify({ target: "cortex-m0" }, null, 2),
      "utf-8",
    );

    const result = runCliInDir(tempDir, [cnxFile]);
    assert(result.success, `Compile should succeed: ${result.output}`);

    assertFileContains(cFile, "__get_PRIMASK", "Config target should be used");
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("CLI --target overrides config file target", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnext-config-test-"));
  const cnxFile = join(tempDir, "test.cnx");
  const cFile = join(tempDir, "test.c");
  const configFile = join(tempDir, "cnext.config.json");

  try {
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
  } finally {
    cleanupTempDir(tempDir);
  }
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
        global.Handler.reset(config);
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

    // Key assertion: Serial_handleReset should have NON-const Config&
    // because it calls Handler.reset which calls Storage.loadDefaults which modifies config
    assert(
      serialCpp.includes("Serial_handleReset(Config& config)"),
      "Serial_handleReset should have non-const Config& (transitive modification)",
    );
    assert(
      !serialCpp.includes("Serial_handleReset(const Config& config)"),
      "Serial_handleReset should NOT have const (it transitively modifies)",
    );

    // Also verify the intermediate functions are correct
    const handlerCpp = readFileSync(join(tempDir, "Handler.cpp"), "utf-8");
    assert(
      handlerCpp.includes("Handler_reset(Config& cfg)"),
      "Handler_reset should have non-const Config&",
    );

    const storageCpp = readFileSync(join(tempDir, "Storage.cpp"), "utf-8");
    assert(
      storageCpp.includes("Storage_loadDefaults(Config& config)"),
      "Storage_loadDefaults should have non-const Config&",
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
      serialCpp.includes("Serial_readValue(const Config& config)"),
      "Serial_readValue should have const Config& (read-only chain)",
    );

    const handlerCpp = readFileSync(join(tempDir, "Handler.cpp"), "utf-8");
    assert(
      handlerCpp.includes("Handler_read(const Config& cfg)"),
      "Handler_read should have const Config&",
    );

    const storageCpp = readFileSync(join(tempDir, "Storage.cpp"), "utf-8");
    assert(
      storageCpp.includes("Storage_getValue(const Config& config)"),
      "Storage_getValue should have const Config&",
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

test("Issue #580: C++ detected from headers triggers correct const inference", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnext-issue580-"));

  try {
    // Create the test files
    writeFileSync(join(tempDir, "CppSerial.h"), cppHeaderContent, "utf-8");
    writeFileSync(join(tempDir, "Config.cnx"), issue580Config, "utf-8");
    writeFileSync(join(tempDir, "Modifier.cnx"), issue580Modifier, "utf-8");
    writeFileSync(join(tempDir, "Handler.cnx"), issue580Handler, "utf-8");

    // Transpile WITHOUT --cpp flag - C++ mode should be auto-detected from header
    const result = runCliInDir(tempDir, ["Handler.cnx"]);
    assert(result.success, `Compile should succeed: ${result.output}`);

    // Should generate .cpp file (C++ mode detected from header)
    assert(
      existsSync(join(tempDir, "Handler.cpp")),
      "Should generate .cpp when C++ detected from header",
    );

    // Key assertion: Handler_passThrough should have NON-const Config&
    // because it calls Modifier.reset which modifies config
    const handlerCpp = readFileSync(join(tempDir, "Handler.cpp"), "utf-8");
    assert(
      handlerCpp.includes("Handler_passThrough(Config& config)"),
      "Handler_passThrough should have non-const Config& (calls mutating function)",
    );
    assert(
      !handlerCpp.includes("Handler_passThrough(const Config& config)"),
      "Handler_passThrough should NOT have const (it transitively modifies)",
    );

    // Also verify Modifier was processed correctly
    assert(
      existsSync(join(tempDir, "Modifier.cpp")),
      "Should generate Modifier.cpp",
    );
    const modifierCpp = readFileSync(join(tempDir, "Modifier.cpp"), "utf-8");
    assert(
      modifierCpp.includes("Modifier_reset(Config& c)"),
      "Modifier_reset should have non-const Config&",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

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
