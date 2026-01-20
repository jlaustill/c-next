# Design: C++ Casts Instead of C-Style Casts

**Issue:** #267
**Date:** 2026-01-20
**Status:** Implemented (Phase 1)

## Problem

The transpiler generates C-style casts which trigger `cstyleCast` warnings in cppcheck and don't meet MISRA C++/AUTOSAR requirements.

**Current:** `(uint32_t)value`
**Desired:** `static_cast<uint32_t>(value)`

## Solution

Convert C-style casts to appropriate C++ casts when `cppMode` is enabled:

- **`static_cast<T>()`** — numeric conversions, enum-to-int, widening/narrowing
- **`reinterpret_cast<T>()`** — integer-to-pointer (registers), pointer type changes

## Implementation Scope

### Phase 1 (This PR) ✅

| Location             | Function                       | Status                    |
| -------------------- | ------------------------------ | ------------------------- |
| Main cast expression | `generateCastExpression()`     | ✅ Conditional on cppMode |
| String-to-pointer    | `generateArgForPointerParam()` | ✅ Conditional on cppMode |

### Phase 2 (Future Work)

| Location           | Function                    | Notes                                 |
| ------------------ | --------------------------- | ------------------------------------- |
| Register access    | `generateRegister()`        | Requires passing cppMode to generator |
| Scoped registers   | `generateScopedRegister()`  | Requires passing cppMode to generator |
| Arithmetic helpers | `generateOverflowHelpers()` | Requires passing cppMode to generator |

**Why deferred:** These generators don't currently have access to `cppMode`. They produce `#define` macros that are expanded at use sites, which may be in C or C++ context. A proper solution requires either:

1. Passing `cppMode` through the generator call chain, or
2. Using conditional macros that expand differently in C vs C++

## Testing

- ✅ Test: `tests/casting/cpp-cast-mode.test.cnx` verifies `static_cast` generation
- ✅ Test: `tests/casting/cpp-reinterpret-cast.test.cnx` verifies `reinterpret_cast` generation
- ✅ All tests pass

## Execution Log

1. ✅ Create feature branch
2. ✅ Comment on GitHub issue
3. ✅ Write test with .hpp header to trigger cppMode
4. ✅ Implement conditional casts in CodeGenerator
5. ✅ Add C++ cast detection to test runner
6. ✅ Run full test suite
7. ✅ Create PR #273
