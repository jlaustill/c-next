# C++ Callback Interop Test Coverage Design

**Issue:** #409 - Test coverage: cpp-interop (C++ interoperability)
**Date:** 2026-01-31
**Status:** Implemented

## Problem

The `tests/cpp-interop/comprehensive-cpp.test.cnx` had Section 13 (Callbacks) defined in the C++ header but never tested. Additionally, C-Next was generating pointer-based parameters (`const T*`) even in C++ mode, which prevented callbacks from matching idiomatic C++ function pointer signatures that use references (`const T&`).

## Solution

### 1. Added Callback Interop Tests (Section 15)

Added new test section that exercises passing C-Next callbacks to C++ registration functions:

```cnx
void simpleCallback() { }
void intCallback(i32 value) { }
void resultCallback(const Result result) { }

void testCallbackInterop() {
    global.registerCallback(simpleCallback);
    global.registerIntCallback(intCallback);
    global.registerResultCallback(resultCallback);  // Now works with const T&!
    global.Registry.registerHandler(1, simpleCallback);
}
```

### 2. Implemented C++ Reference Semantics

In C++ mode, the transpiler now generates idiomatic C++ code:

| C-Next              | C Mode          | C++ Mode       |
| ------------------- | --------------- | -------------- |
| Parameter `const T` | `const T*`      | `const T&`     |
| Member access       | `param->member` | `param.member` |
| Argument passing    | `func(&local)`  | `func(local)`  |

**Changes made:**

1. **CodeGenerator.ts** (`generateParameter`): Use `&` instead of `*` in C++ mode
2. **CodeGenerator.ts** (member access at lines ~7207, ~8190): Use `.` instead of `->` in C++ mode
3. **CodeGenerator.ts** (`_generateFunctionArg`): Remove `&` prefix in C++ mode
4. **HeaderGenerator.ts** (`generateFunctionPrototype`): Use `&` instead of `*` in C++ mode
5. **IHeaderOptions.ts**: Added `cppMode` option
6. **Pipeline.ts**: Pass `cppDetected` to header generator

### 3. Updated Documentation

- `README.md`: Updated callback interop section with working examples
- `comprehensive-cpp.patterns.md`: Updated expected output patterns

## Files Changed

- `src/codegen/CodeGenerator.ts` — C++ reference semantics for parameters, member access, arguments
- `src/codegen/HeaderGenerator.ts` — C++ reference semantics for function prototypes
- `src/codegen/types/IHeaderOptions.ts` — Added `cppMode` option
- `src/pipeline/Pipeline.ts` — Pass `cppDetected` to header generator
- `tests/cpp-interop/comprehensive-cpp.test.cnx` — Added Section 15 callback tests
- `tests/cpp-interop/comprehensive-cpp.expected.c` — Updated expected output
- `tests/cpp-interop/comprehensive-cpp.hpp` — Cleaned up (removed workaround)
- `tests/cpp-interop/comprehensive-cpp-stubs.cpp` — Cleaned up (removed workaround)
- `tests/cpp-interop/README.md` — Documented C++ reference semantics
- `tests/functions/const-struct-member-cpp.expected.c` — Updated for references
- `tests/functions/enum-bool-member-cpp.expected.c` — Updated for references
- `tests/issue-502/function-param-init.expected.c` — Updated for references

## Test Results

- Integration tests: 874 passed
- Unit tests: 1450 passed
- C++ compilation: `g++ -std=c++14 -fsyntax-only` passes

## Technical Details

The key insight is that C++ references and pointers have different semantics:

- **C mode (ADR-006)**: Uses pointers for pass-by-reference. Local variables need `&` to get their address, and member access uses `->`.
- **C++ mode**: Uses references for pass-by-reference. Values are passed directly (no `&`), and member access uses `.`.

This change only affects C++ mode (`--cpp` flag or when C++ headers are detected). C mode remains unchanged.
