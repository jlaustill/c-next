# C++ Interop Comprehensive Test Suite

This directory contains comprehensive tests for C-Next's C++ interoperability features.

## Purpose

C-Next has working C interop but C++ interop has known issues with scope resolution syntax.
These tests exercise all C++ syntax patterns to ensure correct transpilation.

## Key Issues Addressed

| Issue | Description                                                    |
| ----- | -------------------------------------------------------------- |
| #304  | Enum::VALUE, Class::method, {0} initialization, &array members |
| #295  | = 0 for classes with constructors                              |
| #296  | Forward declarations for named structs                         |
| #256  | array[i].member access                                         |
| #252  | enum/bool → u8 type conversions                                |
| #409  | Callback interop - passing C-Next functions to C++ registrars  |

## Root Cause

C++ uses `::` for scope resolution; C-Next was generating `_` (C-style) for all symbols.
The fix uses symbol provenance (`sourceLanguage`) to determine correct syntax.

## Test Structure

```
cpp-interop/
├── comprehensive-cpp.hpp          # Master header (20 sections)
├── comprehensive-cpp-stubs.cpp    # Stub implementations for linking
├── comprehensive-cpp.test.cnx     # Master test (all sections)
├── comprehensive-cpp.expected.c   # Expected output patterns
│
├── isolated/                      # Isolated tests per feature
│   ├── namespace.*                # Namespace access tests
│   ├── static-methods.*           # Static method tests
│   ├── enum-class.*               # Enum class tests
│   └── ...                        # More isolated tests
│
└── README.md                      # This file
```

## Running Tests

```bash
# Run all cpp-interop tests (transpile + compile only, no execution)
npm test -- tests/cpp-interop/

# Manual comprehensive test
cnext tests/cpp-interop/comprehensive-cpp.test.cnx --cpp -o /tmp/out/
g++ -std=c++14 -fsyntax-only /tmp/out/comprehensive-cpp.cpp -I tests/cpp-interop/

# Check specific patterns in output
grep -E '::' /tmp/out/comprehensive-cpp.cpp | head -20  # Should see ::
grep -E '\{0\}' /tmp/out/comprehensive-cpp.cpp          # Should be empty
```

## Validation Criteria

1. **All test files transpile** without parse or generation errors
2. **Generated .cpp compiles** with `g++ -std=c++14 -fsyntax-only`
3. **Correct C++ scope syntax:**
   - `namespace::function()` not `namespace_function()`
   - `Class::staticMethod()` not `Class.staticMethod()`
   - `Enum::VALUE` not `Enum_VALUE` (for enum class)
4. **Correct initialization:**
   - `Type var{}` or `Type var` not `Type var = 0`
5. **Correct type conversions:**
   - `static_cast<uint8_t>(enumValue)` for enum→integer

## Design Decision

C-Next syntax uses dots for all scope resolution:

- `global.namespace.function()` → `namespace::function()`
- `global.CommandHandler.execute(1)` → `CommandHandler::execute(1)`
- `global.EMode.ON` → `EMode::ON`

The CodeGenerator checks `symbol.sourceLanguage` to determine output syntax.

## Callback Interop (Issue #409)

C-Next callbacks can be passed to C++ callback registration functions. Section 15 of the comprehensive test exercises this pattern:

```cnx
// Define C-Next callback matching C++ void(*)() signature
void simpleCallback() { }

// C-Next callback with struct parameter - matches C++ void(*)(const Result&)
void resultCallback(const Result result) { }

// Pass to C++ registration functions
global.registerCallback(simpleCallback);
global.registerResultCallback(resultCallback);  // Works with const T& in C++ mode!
```

### C++ Mode Reference Semantics

In C++ mode (`--cpp` flag or `.hpp` include detected), C-Next generates idiomatic C++ code:

| C-Next          | C Mode Output    | C++ Mode Output  |
| --------------- | ---------------- | ---------------- |
| `const T param` | `const T* param` | `const T& param` |
| `param.member`  | `param->member`  | `param.member`   |
| `func(local)`   | `func(&local)`   | `func(local)`    |

This allows C-Next callbacks to match standard C++ function pointer signatures like `void(*)(const T&)`.
