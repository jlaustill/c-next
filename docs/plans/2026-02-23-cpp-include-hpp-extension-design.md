# Design: Fix .hpp Include Directives in C++ Mode (Issue #941)

## Problem

When C++ mode is triggered, the transpiler generates `.hpp` header files (fixed in #933) but cross-file `#include` directives in `.cpp` files still reference `.h`. This causes compilation failures on clean builds.

## Root Cause

`IncludeGenerator.ts` hardcodes `.h` in 3 locations. The `IIncludeTransformOptions` interface has no `cppMode` field, and `CodeGenerator.transformIncludeDirective()` doesn't pass it through.

## Approach: Pass `cppMode` through `IIncludeTransformOptions`

Matches the existing pattern in `CodeGenerator.ts` (self-include, line 2212) and `HeaderGeneratorUtils.ts` (line 284).

## Changes

### 1. `IncludeGenerator.ts`

- Add `cppMode?: boolean` to `IIncludeTransformOptions` (line 12)
- `resolveAngleIncludePath` (line 45): `.replace(/\.cnx$/, ext)` where `ext = cppMode ? ".hpp" : ".h"`
- `transformAngleInclude` fallback (line 73): use dynamic extension
- `transformQuoteInclude` (line 102): use dynamic extension
- Pass `cppMode` through from `transformAngleInclude`/`transformQuoteInclude` to `resolveAngleIncludePath`

### 2. `CodeGenerator.ts`

- `transformIncludeDirective()` (~line 2430): add `cppMode: CodeGenState.cppMode` to options

### 3. Tests

- Integration test: cross-file `.cnx` include in C++ mode verifying `.hpp` in output
- Unit test: `IncludeGenerator.transformIncludeDirective()` with `cppMode: true`
- Regenerate ~79 `.expected.cpp` snapshot files

## Scope

- Only `.cnx` includes are transformed. User-provided `.h` includes (e.g., `fake_cpp.h`) are unchanged.
- Non-`.cnx` includes are not matched by the regex and pass through as-is.
