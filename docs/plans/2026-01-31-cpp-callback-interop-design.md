# C++ Callback Interop Test Coverage Design

**Issue:** #409 - Test coverage: cpp-interop (C++ interoperability)
**Date:** 2026-01-31
**Status:** Implemented

## Problem

The `tests/cpp-interop/comprehensive-cpp.test.cnx` had Section 13 (Callbacks) defined in the C++ header but never tested. The callback registration functions were:

```cpp
using Callback = void(*)();
using IntCallback = void(*)(int);
using ResultCallback = void(*)(const Result&);

void registerCallback(Callback cb);
void registerIntCallback(IntCallback cb);
void registerResultCallback(ResultCallback cb);
```

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
    global.registerResultPtrCallback(resultCallback);
    global.Registry.registerHandler(1, simpleCallback);
}
```

### 2. Discovered Reference vs Pointer Limitation

During implementation, discovered that C-Next cannot pass callbacks to C++ functions expecting reference parameters:

- C-Next transpiles `const T` struct params to `const T*` (pointer)
- C++ reference-based callbacks expect `const T&` (reference)
- These have different function pointer signatures

**Workaround:** Added `ResultPtrCallback` typedef in C++ header that uses pointer instead of reference:

```cpp
using ResultPtrCallback = void(*)(const Result*);  // C-Next compatible
void registerResultPtrCallback(ResultPtrCallback cb);
```

### 3. Updated Documentation

- `README.md`: Added Issue #409 to table and new "Callback Interop" section
- `comprehensive-cpp.patterns.md`: Added Section 15 expected output patterns

## Files Changed

- `tests/cpp-interop/comprehensive-cpp.test.cnx` — Added Section 15 tests
- `tests/cpp-interop/comprehensive-cpp.expected.c` — Updated expected output
- `tests/cpp-interop/comprehensive-cpp.hpp` — Added `ResultPtrCallback` typedef
- `tests/cpp-interop/comprehensive-cpp-stubs.cpp` — Added stub for new function
- `tests/cpp-interop/comprehensive-cpp.patterns.md` — Documented callback patterns
- `tests/cpp-interop/README.md` — Documented callback interop and limitation

## Test Results

- Integration tests: 874 passed
- Unit tests: 1450 passed
- C++ compilation: `g++ -std=c++14 -fsyntax-only` passes

## Known Limitation

C-Next callbacks cannot directly match C++ function pointer types that use reference parameters (`const T&`). For C++ libraries using reference-parameter callbacks, the library must provide pointer-based alternatives for C-Next compatibility.
