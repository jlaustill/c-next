# PlatformIO CLI Test Coverage Design

**Issue:** #405 - Test coverage: platformio-detect (PlatformIO integration)
**Date:** 2026-01-31
**Status:** Implemented

## Problem

The PlatformIO integration features (`--pio-install`, `--pio-uninstall`, `--target`) had no test coverage. Additionally, the `--target` CLI flag was documented in `--help` but never implemented.

## Solution

### 1. Implemented Missing `--target` CLI Flag

The `--target` flag was advertised in help but the argument parser didn't handle it. Fixed by:

- Added `cliTarget` variable and argument parsing in `src/index.ts`
- Added `finalTarget` computation (CLI takes precedence over config)
- Passed `target` through `runUnifiedMode()` to `Project`
- Added `target` to `IProjectConfig` interface
- Updated `Project` to pass `target` to `Pipeline`

### 2. Added 14 Comprehensive CLI Tests

Extended `scripts/test-cli.js` with four test categories:

#### Category 1: `--pio-install` (4 tests)

- Creates `cnext_build.py` and modifies `platformio.ini`
- Idempotent (safe to run twice)
- Fails gracefully without `platformio.ini`
- Preserves existing `extra_scripts`

#### Category 2: `--pio-uninstall` (4 tests)

- Removes integration cleanly
- Idempotent (safe on clean project)
- Fails gracefully without `platformio.ini`
- Preserves other `extra_scripts`

#### Category 3: `--target` flag (4 tests)

- `--target teensy41` generates LDREX/STREX code
- `--target cortex-m0` generates PRIMASK fallback
- `--target avr` generates PRIMASK fallback
- Unknown target uses default (graceful degradation)

#### Category 4: Config file integration (2 tests)

- `cnext.config.json` target is respected
- CLI `--target` overrides config file

## Test Infrastructure Added

Helper functions in `test-cli.js`:

- `createTempPioProject(pioIniContent)` — Creates isolated test fixture
- `runCliInDir(cwd, args)` — Runs CLI in specific directory
- `assertFileContains(path, substring)` — Verifies file content
- `assertFileNotExists(path)` — Verifies cleanup
- `cleanupTempDir(dir)` — Cleanup helper

## Files Changed

- `src/index.ts` — Added `--target` argument parsing
- `src/project/types/IProjectConfig.ts` — Added `target` field
- `src/project/Project.ts` — Pass `target` to Pipeline
- `scripts/test-cli.js` — Added 14 new tests

## Test Results

- CLI tests: 25 passed (11 original + 14 new)
- Integration tests: 874 passed
- Unit tests: 1450 passed
