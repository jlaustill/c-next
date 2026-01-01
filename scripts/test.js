#!/usr/bin/env node
/**
 * C-Next Integration Test Runner
 *
 * Snapshot testing for transpiler output:
 * - Finds all .cnx test files
 * - Transpiles each file
 * - Compares output to .expected.c file (if exists)
 * - For error tests, compares to .expected.error file
 * - Validates generated C compiles without errors (--validate)
 * - Runs static analysis on generated C (--validate)
 *
 * Usage:
 *   npm test                    # Run all tests
 *   npm test -- --update        # Update snapshots
 *   npm test -- --validate      # Validate C compiles and passes static analysis
 *   npm test -- tests/enum      # Run specific directory
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { transpile } from '../dist/lib/transpiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// ANSI colors for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
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
        } else if (entry.endsWith('.cnx')) {
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
        .split('\n')
        .map(line => line.trimEnd())
        .join('\n')
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
        execFileSync('gcc', [
            '-fsyntax-only',
            '-std=c99',
            '-Wno-unused-variable',
            '-Wno-main',
            cFile
        ], { encoding: 'utf-8', timeout: 10000, stdio: 'pipe' });
        return { valid: true };
    } catch (error) {
        // Extract just the error messages
        const output = error.stderr || error.stdout || error.message;
        const errors = output
            .split('\n')
            .filter(line => line.includes('error:'))
            .map(line => line.replace(cFile + ':', ''))
            .slice(0, 5)
            .join('\n');
        return {
            valid: false,
            message: errors || 'Compilation failed',
        };
    }
}

/**
 * Validate that a C file passes static analysis
 * Uses cppcheck for comprehensive checking
 */
function validateStaticAnalysis(cFile) {
    try {
        // Run cppcheck with error-only output
        execFileSync('cppcheck', [
            '--error-exitcode=1',
            '--enable=warning,performance',
            '--suppress=unusedFunction',
            '--suppress=missingIncludeSystem',
            '--suppress=unusedVariable',
            '--quiet',
            cFile
        ], { encoding: 'utf-8', timeout: 30000, stdio: 'pipe' });
        return { valid: true };
    } catch (error) {
        const output = error.stderr || error.stdout || error.message;
        const issues = output
            .split('\n')
            .filter(line => line.trim().length > 0)
            .slice(0, 5)
            .join('\n');
        return {
            valid: false,
            message: issues || 'Static analysis failed',
        };
    }
}

/**
 * Check if validation tools are available
 */
function checkValidationTools() {
    const tools = { gcc: false, cppcheck: false };

    try {
        execFileSync('gcc', ['--version'], { encoding: 'utf-8', stdio: 'pipe' });
        tools.gcc = true;
    } catch {}

    try {
        execFileSync('cppcheck', ['--version'], { encoding: 'utf-8', stdio: 'pipe' });
        tools.cppcheck = true;
    } catch {}

    return tools;
}

/**
 * Run a single test
 */
function runTest(cnxFile, updateMode, validateMode, tools) {
    const source = readFileSync(cnxFile, 'utf-8');
    const basePath = cnxFile.replace(/\.cnx$/, '');
    const expectedCFile = basePath + '.expected.c';
    const expectedErrorFile = basePath + '.expected.error';

    const result = transpile(source);

    // Check if this is an error test
    if (existsSync(expectedErrorFile)) {
        const expectedErrors = readFileSync(expectedErrorFile, 'utf-8').trim();

        if (result.success) {
            return {
                passed: false,
                message: `Expected errors but transpilation succeeded`,
                expected: expectedErrors,
                actual: '(no errors)',
            };
        }

        const actualErrors = result.errors
            .map(e => `${e.line}:${e.column} ${e.message}`)
            .join('\n');

        if (updateMode) {
            writeFileSync(expectedErrorFile, actualErrors + '\n');
            return { passed: true, message: 'Updated error snapshot', updated: true };
        }

        if (normalize(actualErrors) === normalize(expectedErrors)) {
            return { passed: true };
        }

        return {
            passed: false,
            message: 'Error output mismatch',
            expected: expectedErrors,
            actual: actualErrors,
        };
    }

    // Check if this is a success test
    if (existsSync(expectedCFile)) {
        const expectedC = readFileSync(expectedCFile, 'utf-8');

        if (!result.success) {
            const errors = result.errors.map(e => `${e.line}:${e.column} ${e.message}`).join('\n');
            return {
                passed: false,
                message: `Transpilation failed unexpectedly`,
                expected: '(success)',
                actual: errors,
            };
        }

        if (updateMode) {
            writeFileSync(expectedCFile, result.code);
            return { passed: true, message: 'Updated C snapshot', updated: true };
        }

        if (normalize(result.code) === normalize(expectedC)) {
            // Snapshot matches - now validate if requested
            if (validateMode) {
                // Check compilation
                if (tools.gcc) {
                    const compileResult = validateCompilation(expectedCFile);
                    if (!compileResult.valid) {
                        return {
                            passed: false,
                            message: 'C compilation failed',
                            actual: compileResult.message,
                        };
                    }
                }

                // Check static analysis
                if (tools.cppcheck) {
                    const analysisResult = validateStaticAnalysis(expectedCFile);
                    if (!analysisResult.valid) {
                        return {
                            passed: false,
                            message: 'Static analysis failed',
                            actual: analysisResult.message,
                        };
                    }
                }
            }
            return { passed: true };
        }

        return {
            passed: false,
            message: 'C output mismatch',
            expected: expectedC,
            actual: result.code,
        };
    }

    // No expected file - in update mode, create one
    if (updateMode) {
        if (result.success) {
            writeFileSync(expectedCFile, result.code);
            return { passed: true, message: 'Created C snapshot', updated: true };
        } else {
            const errors = result.errors.map(e => `${e.line}:${e.column} ${e.message}`).join('\n');
            writeFileSync(expectedErrorFile, errors + '\n');
            return { passed: true, message: 'Created error snapshot', updated: true };
        }
    }

    // No expected file and not in update mode
    return {
        passed: false,
        message: 'No expected file found. Run with --update to create snapshot.',
        noSnapshot: true,
    };
}

/**
 * Main test runner
 */
function main() {
    const args = process.argv.slice(2);
    const updateMode = args.includes('--update') || args.includes('-u');
    const validateMode = args.includes('--validate') || args.includes('-v');
    const filterPath = args.find(arg => !arg.startsWith('-'));

    // Determine test directory
    let testDir = join(rootDir, 'tests');
    if (filterPath) {
        testDir = filterPath.startsWith('/') ? filterPath : join(rootDir, filterPath);
    }

    if (!existsSync(testDir)) {
        console.error(`${colors.red}Error: Test directory not found: ${testDir}${colors.reset}`);
        process.exit(1);
    }

    // Check for validation tools if validate mode is enabled
    let tools = { gcc: false, cppcheck: false };
    if (validateMode) {
        tools = checkValidationTools();
        if (!tools.gcc && !tools.cppcheck) {
            console.error(`${colors.red}Error: --validate requires gcc or cppcheck${colors.reset}`);
            process.exit(1);
        }
    }

    console.log(`${colors.cyan}C-Next Integration Tests${colors.reset}`);
    console.log(`${colors.dim}Test directory: ${testDir}${colors.reset}`);
    if (updateMode) {
        console.log(`${colors.yellow}Update mode: snapshots will be created/updated${colors.reset}`);
    }
    if (validateMode) {
        const toolList = [];
        if (tools.gcc) toolList.push('gcc');
        if (tools.cppcheck) toolList.push('cppcheck');
        console.log(`${colors.cyan}Validate mode: checking with ${toolList.join(', ')}${colors.reset}`);
    }
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
        const relativePath = cnxFile.replace(rootDir + '/', '');
        const result = runTest(cnxFile, updateMode, validateMode, tools);

        if (result.passed) {
            if (result.updated) {
                console.log(`${colors.yellow}UPDATED${colors.reset} ${relativePath}`);
                updated++;
            } else {
                console.log(`${colors.green}PASS${colors.reset}    ${relativePath}`);
            }
            passed++;
        } else {
            if (result.noSnapshot) {
                console.log(`${colors.yellow}SKIP${colors.reset}    ${relativePath} (no snapshot)`);
                noSnapshot++;
            } else {
                console.log(`${colors.red}FAIL${colors.reset}    ${relativePath}`);
                console.log(`        ${colors.dim}${result.message}${colors.reset}`);
                if (result.expected && result.actual) {
                    console.log(`        ${colors.dim}Expected:${colors.reset}`);
                    console.log(`        ${result.expected.split('\n').slice(0, 5).join('\n        ')}`);
                    console.log(`        ${colors.dim}Actual:${colors.reset}`);
                    console.log(`        ${result.actual.split('\n').slice(0, 5).join('\n        ')}`);
                } else if (result.actual) {
                    // Just actual (no expected) - for compilation/analysis errors
                    console.log(`        ${result.actual.split('\n').slice(0, 5).join('\n        ')}`);
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
        console.log(`  ${colors.yellow}Skipped:${colors.reset} ${noSnapshot} (no snapshot)`);
    }

    process.exit(failed > 0 ? 1 : 0);
}

main();
