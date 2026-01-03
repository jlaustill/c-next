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

import { execFileSync, execSync } from 'child_process';
import { existsSync, unlinkSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const cliPath = join(rootDir, 'dist', 'index.js');

// ANSI colors for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
};

let passed = 0;
let failed = 0;

/**
 * Run a CLI command and return result
 */
function runCli(args = [], expectError = false) {
    try {
        const output = execFileSync('node', [cliPath, ...args], {
            encoding: 'utf-8',
            cwd: rootDir,
            timeout: 10000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { success: true, output, exitCode: 0 };
    } catch (error) {
        if (expectError) {
            return {
                success: false,
                output: error.stdout || '',
                stderr: error.stderr || '',
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
        console.log(`${colors.green}PASS${colors.reset}    ${name}`);
        passed++;
    } catch (error) {
        console.log(`${colors.red}FAIL${colors.reset}    ${name}`);
        console.log(`        ${colors.dim}${error.message}${colors.reset}`);
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

console.log(`${colors.cyan}C-Next CLI Integration Tests${colors.reset}`);
console.log(`${colors.dim}CLI path: ${cliPath}${colors.reset}`);
console.log();

// --version flag
test('--version returns version string and exits 0', () => {
    const result = runCli(['--version']);
    assert(result.success, 'Command should succeed');
    assert(result.output.includes('cnext v'), `Output should contain version: ${result.output}`);
    assert(result.exitCode === 0, 'Exit code should be 0');
});

test('-v returns version string and exits 0', () => {
    const result = runCli(['-v']);
    assert(result.success, 'Command should succeed');
    assert(result.output.includes('cnext v'), `Output should contain version: ${result.output}`);
    assert(result.exitCode === 0, 'Exit code should be 0');
});

// --help flag
test('--help shows help text and exits 0', () => {
    const result = runCli(['--help']);
    assert(result.success, 'Command should succeed');
    assert(result.output.includes('Usage:'), `Output should contain usage: ${result.output}`);
    assert(result.output.includes('Options:'), `Output should contain options: ${result.output}`);
    assert(result.exitCode === 0, 'Exit code should be 0');
});

test('-h shows help text and exits 0', () => {
    const result = runCli(['-h']);
    assert(result.success, 'Command should succeed');
    assert(result.output.includes('Usage:'), `Output should contain usage: ${result.output}`);
    assert(result.exitCode === 0, 'Exit code should be 0');
});

// No arguments shows help (user-friendly behavior)
test('no arguments shows help and exits 0', () => {
    const result = runCli([]);
    assert(result.success, 'Command should succeed (showing help)');
    assert(result.exitCode === 0, 'Exit code should be 0');
    assert(result.output.includes('Usage:'), 'Should show usage help');
});

// Default output path (alongside input)
test('single file transpiles to .c alongside input', () => {
    const inputFile = 'tests/basics/hello-world.cnx';
    const expectedOutput = 'tests/basics/hello-world.c';

    // Clean up first
    cleanup([expectedOutput]);

    const result = runCli([inputFile]);
    assert(result.success, `Command should succeed: ${result.output}`);
    assert(existsSync(join(rootDir, expectedOutput)), `Output file should exist: ${expectedOutput}`);

    // Clean up
    cleanup([join(rootDir, expectedOutput)]);
});

// Explicit -o flag
test('-o flag overrides output path', () => {
    const inputFile = 'tests/basics/hello-world.cnx';
    const customOutput = '/tmp/cnext-test-output.c';

    cleanup([customOutput]);

    const result = runCli([inputFile, '-o', customOutput]);
    assert(result.success, `Command should succeed: ${result.output}`);
    assert(existsSync(customOutput), `Output file should exist: ${customOutput}`);

    cleanup([customOutput]);
});

// --cpp flag
test('--cpp flag outputs .cpp extension', () => {
    const inputFile = 'tests/basics/hello-world.cnx';
    const expectedOutput = 'tests/basics/hello-world.cpp';

    cleanup([join(rootDir, expectedOutput)]);

    const result = runCli([inputFile, '--cpp']);
    assert(result.success, `Command should succeed: ${result.output}`);
    assert(existsSync(join(rootDir, expectedOutput)), `Output file should exist: ${expectedOutput}`);

    cleanup([join(rootDir, expectedOutput)]);
});

// Invalid file path
test('nonexistent file exits 1 with error', () => {
    const result = runCli(['nonexistent-file.cnx'], true);
    assert(!result.success, 'Command should fail');
    assert(result.exitCode === 1, 'Exit code should be 1');
});

// --parse mode
test('--parse mode validates without creating output file', () => {
    const inputFile = 'tests/basics/hello-world.cnx';
    const wouldBeOutput = 'tests/basics/hello-world.c';

    cleanup([join(rootDir, wouldBeOutput)]);

    const result = runCli([inputFile, '--parse']);
    assert(result.success, `Command should succeed: ${result.output}`);
    assert(!existsSync(join(rootDir, wouldBeOutput)), 'Output file should NOT be created in parse mode');
});

// Syntax error handling
test('syntax error in file exits 1', () => {
    // Create a temp file with invalid syntax
    const tempFile = '/tmp/cnext-test-invalid.cnx';
    writeFileSync(tempFile, 'this is not valid cnext syntax @@@');

    const result = runCli([tempFile], true);
    assert(!result.success, 'Command should fail');
    assert(result.exitCode === 1, 'Exit code should be 1');

    cleanup([tempFile]);
});

// ============================================================================
// Summary
// ============================================================================

console.log();
console.log(`${colors.cyan}Results:${colors.reset}`);
console.log(`  ${colors.green}Passed:${colors.reset}  ${passed}`);
if (failed > 0) {
    console.log(`  ${colors.red}Failed:${colors.reset}  ${failed}`);
}

process.exit(failed > 0 ? 1 : 0);
