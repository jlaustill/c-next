# Specification: 100% Scope Testing Coverage

## Overview

This task expands the C-Next test suite to achieve comprehensive (100%) coverage of scope-related functionality. The scope feature (ADR-016) provides organization and visibility control for embedded systems code. Testing must verify that `this.` and `global.` accessors work correctly with every data type, all modifier permutations (public/private, atomic, clamp, wrap) function properly at scope level and within methods, and that invalid patterns (nested scopes) produce appropriate compile errors.

## Workflow Type

**Type**: feature

**Rationale**: This is a feature addition task that expands the test suite with new comprehensive test files. It requires creating many new .cnx test files with corresponding .expected.c or .expected.error snapshots to verify exhaustive scope behavior coverage.

## Task Scope

### Services Involved
- **main** (primary) - C-Next transpiler and test framework

### This Task Will:
- [ ] Create tests for `this.` accessor with every data type (u8, u16, u32, u64, i8, i16, i32, i64, f32, f64, bool, string)
- [ ] Create tests for `global.` accessor with every data type
- [ ] Create test verifying nested scopes produce compile error
- [ ] Create tests for all modifier permutations: public/private + atomic + clamp/wrap
- [ ] Verify behavior at scope level declarations
- [ ] Verify behavior inside private methods
- [ ] Verify behavior inside public methods
- [ ] Test critical sections within scopes

### Out of Scope:
- Changes to the transpiler implementation
- Changes to the grammar
- Tests for non-scope features (enum, struct, register independently)

## Service Context

### main (C-Next Transpiler)

**Tech Stack:**
- Language: TypeScript
- Framework: None (standalone transpiler)
- Key directories: `src/` (source), `tests/` (tests), `grammar/` (ANTLR4 grammar)

**Entry Point:** `src/index.ts`

**How to Run:**
```bash
npm run dev
```

**Test Command:**
```bash
npm test                    # Run all tests
npm test -- tests/scope     # Run scope tests only
npm test -- --update        # Update snapshots
```

**Port:** N/A (CLI tool)

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| `tests/scope/this-all-types.cnx` | main | NEW: Test `this.` with all primitive types |
| `tests/scope/global-all-types.cnx` | main | NEW: Test `global.` with all primitive types |
| `tests/scope/nested-scope-error.cnx` | main | NEW: Test nested scope produces compile error |
| `tests/scope/scope-public-private.cnx` | main | NEW: Test public/private visibility modifiers |
| `tests/scope/scope-atomic-modifier.cnx` | main | NEW: Test atomic variables in scopes |
| `tests/scope/scope-clamp-modifier.cnx` | main | NEW: Test clamp overflow modifier in scopes |
| `tests/scope/scope-wrap-modifier.cnx` | main | NEW: Test wrap overflow modifier in scopes |
| `tests/scope/scope-method-contexts.cnx` | main | NEW: Test public/private methods with modifiers |
| `tests/scope/scope-critical-section.cnx` | main | NEW: Test critical sections within scope methods |
| `tests/scope/scope-modifier-combos.cnx` | main | NEW: Test combined modifiers (const clamp, atomic wrap, etc.) |

## Files to Reference

These files show patterns to follow:

| File | Pattern to Copy |
|------|----------------|
| `tests/scope/this-global-test.cnx` | Basic `this.` and `global.` usage pattern |
| `tests/scope/scope-bug-demo.cnx` | Error test pattern with `.expected.error` |
| `tests/primitives/all-types.cnx` | How to test all data types systematically |
| `tests/primitives/clamp-declaration.cnx` | Clamp modifier usage |
| `tests/primitives/wrap-declaration.cnx` | Wrap modifier usage |
| `tests/atomic/atomic-all-types.cnx` | Atomic modifier with multiple types |
| `tests/critical/basic.cnx` | Critical section syntax |
| `tests/enum/scoped-enum.cnx` | Comprehensive scope example with enum, public, methods |

## Patterns to Follow

### Test File Structure

From `tests/scope/this-global-test.cnx`:

```cnx
// Test: ADR-016 description
const u8 globalValue <- 10;

scope ScopeName {
    u8 localValue <- 5;

    // Test this. for scope member access
    u8 getLocalValue() {
        return this.localValue;
    }

    // Test global. for global access
    u8 getGlobalValue() {
        return global.globalValue;
    }
}

void main() {
    ScopeName.getLocalValue();
}
```

**Key Points:**
- ADR reference in comment at top
- Declare global variables for global. tests
- Declare scope variables for this. tests
- Methods must use explicit this./global. accessors
- main() function required for valid C output

### Error Test Pattern

From `tests/scope/scope-bug-demo.cnx` and `.expected.error`:

```cnx
// Test: Verify error condition

scope Counter {
    u8 count <- 0;

    void increment() {
        count <- count + 1;  // ERROR: must use this.count
    }
}
```

Expected error file (`.expected.error`):
```
1:0 Code generation failed: Error: Use 'this.count' to access scope member...
```

**Key Points:**
- Error tests have `.expected.error` instead of `.expected.c`
- Error format: `line:column message`
- Test runner validates transpiler produces expected error

### All Types Pattern

From `tests/primitives/all-types.cnx`:

```cnx
// Unsigned integers
u8 byte <- 255;
u16 word <- 65535;
u32 dword <- 4294967295;
u64 qword <- 0;

// Signed integers
i8 sbyte <- -128;
i16 sword <- -32768;
i32 sdword <- -2147483648;
i64 sqword <- 0;

// Floating point
f32 single <- 3.14;
f64 precise <- 3.141592653589793;

// Boolean
bool flag <- true;
```

**Key Points:**
- Test all primitive types systematically
- Use representative values for each type
- Comments organize by category

## Requirements

### Functional Requirements

1. **this. with All Data Types**
   - Description: Verify `this.` accessor works correctly with every C-Next primitive type inside scope methods
   - Acceptance: Test file transpiles successfully, generated C compiles with gcc, cppcheck, clang-tidy, MISRA

2. **global. with All Data Types**
   - Description: Verify `global.` accessor works correctly with every C-Next primitive type inside scope methods
   - Acceptance: Test file transpiles successfully, generated C passes all validation

3. **Nested Scope Error**
   - Description: Verify that declaring a scope inside another scope produces a compile-time error
   - Acceptance: Transpiler outputs expected error message, test matches `.expected.error`

4. **Public/Private Visibility**
   - Description: Test that public and private modifiers work on scope members
   - Acceptance: Public members accessible from outside scope, private not accessible

5. **Atomic Modifier in Scopes**
   - Description: Verify atomic variables work correctly inside scopes with this. accessor
   - Acceptance: Generated C includes proper atomic operations

6. **Clamp Modifier in Scopes**
   - Description: Verify clamp overflow behavior works with scope variables
   - Acceptance: Generated C includes clamping logic

7. **Wrap Modifier in Scopes**
   - Description: Verify wrap overflow behavior works with scope variables
   - Acceptance: Generated C handles wrapping correctly

8. **Modifier Combinations**
   - Description: Test valid modifier combinations (const clamp, atomic, etc.) in scopes
   - Acceptance: All valid combinations transpile correctly

9. **Critical Sections in Scopes**
   - Description: Verify critical { } blocks work inside scope methods
   - Acceptance: Generated C includes interrupt disable/enable

10. **Method Context Coverage**
    - Description: Test modifiers inside both public and private methods
    - Acceptance: All contexts produce correct output

### Edge Cases

1. **Empty scope** - Scope with no members should transpile to empty output
2. **Mixed modifiers** - Multiple modifiers on same variable (e.g., `const clamp u8`)
3. **this. in global context** - Should error (no scope context)
4. **global. from nested method** - Should resolve to true global

## Implementation Notes

### DO
- Follow the pattern in `tests/scope/this-global-test.cnx` for test structure
- Use `tests/primitives/all-types.cnx` as reference for covering all types
- Create corresponding `.expected.c` or `.expected.error` for each test
- Run `npm test -- --update` after creating new tests to generate snapshots
- Verify generated C compiles and passes static analysis
- Group related tests logically within files

### DON'T
- Create redundant tests that duplicate existing coverage
- Skip any primitive type in type coverage tests
- Forget the main() function (required for valid C)
- Use bare identifiers inside scopes (must use this. or global.)

## Development Environment

### Start Services

```bash
# Build transpiler (required before testing)
npm run build

# Run all tests
npm test

# Run scope tests only
npm test -- tests/scope

# Update snapshots after creating new tests
npm test -- tests/scope --update
```

### Service URLs
- N/A (CLI tool, no web interface)

### Required Environment Variables
- None required for testing

### Validation Tools Required
- `gcc` - C compilation validation (required)
- `cppcheck` - Static analysis
- `clang-tidy` - Additional static analysis
- MISRA addon for cppcheck (compliance checking)

## Data Types to Test

Complete list of primitive types from grammar:

| Type | Category | Test Values |
|------|----------|-------------|
| `u8` | Unsigned | 0, 255 |
| `u16` | Unsigned | 0, 65535 |
| `u32` | Unsigned | 0, 4294967295 |
| `u64` | Unsigned | 0 |
| `i8` | Signed | -128, 127 |
| `i16` | Signed | -32768, 32767 |
| `i32` | Signed | -2147483648, 0 |
| `i64` | Signed | 0 |
| `f32` | Float | 3.14 |
| `f64` | Float | 3.141592653589793 |
| `bool` | Boolean | true, false |
| `string<N>` | String | Various sizes |

## Modifiers to Test

| Modifier | Description | Valid With |
|----------|-------------|------------|
| `public` | Visible outside scope | Variables, methods |
| `private` | Hidden from outside | Variables, methods |
| `atomic` | ISR-safe operations | Integer types |
| `clamp` | Saturating overflow | Integer types |
| `wrap` | Wrapping overflow | Integer types |
| `const` | Immutable | All types |
| `critical` | Section block | Code blocks |

## Test Matrix

| Context | this. types | global. types | Modifiers | Error cases |
|---------|-------------|---------------|-----------|-------------|
| Scope level | All | All | public, private, const, clamp, wrap | nested scope |
| Private method | All | All | atomic, clamp, wrap, critical | bare identifier |
| Public method | All | All | atomic, clamp, wrap, critical | bare identifier |

## Success Criteria

The task is complete when:

1. [ ] Test file `this-all-types.cnx` covers all primitive types with `this.` accessor
2. [ ] Test file `global-all-types.cnx` covers all primitive types with `global.` accessor
3. [ ] Test file `nested-scope-error.cnx` verifies nested scope produces compile error
4. [ ] Test files exist for public/private, atomic, clamp, wrap modifiers
5. [ ] Test file covers critical sections in scope methods
6. [ ] Test file covers modifier combinations
7. [ ] All new tests pass (`npm test -- tests/scope`)
8. [ ] No regressions in existing tests
9. [ ] Generated C passes gcc compilation
10. [ ] Generated C passes cppcheck analysis
11. [ ] Generated C passes clang-tidy analysis
12. [ ] Generated C passes MISRA compliance check

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Unit Tests
| Test | File | What to Verify |
|------|------|----------------|
| this-all-types | `tests/scope/this-all-types.cnx` | `this.` works with u8, u16, u32, u64, i8, i16, i32, i64, f32, f64, bool |
| global-all-types | `tests/scope/global-all-types.cnx` | `global.` works with all primitive types |
| nested-scope-error | `tests/scope/nested-scope-error.cnx` | Nested scope produces expected compile error |
| scope-modifiers | `tests/scope/scope-*.cnx` | All modifier tests transpile correctly |

### Integration Tests
| Test | Services | What to Verify |
|------|----------|----------------|
| Full test suite | transpiler | `npm test` passes with all new tests |
| Scope directory | transpiler | `npm test -- tests/scope` runs clean |

### End-to-End Tests
| Flow | Steps | Expected Outcome |
|------|-------|------------------|
| Complete scope test | 1. Create .cnx files 2. Run `npm test -- --update` 3. Run `npm test` | All tests pass, snapshots generated |

### Generated C Verification
| Check | Tool | Expected |
|-------|------|----------|
| Compilation | gcc -fsyntax-only | No errors |
| Static analysis | cppcheck | No warnings |
| Tidy analysis | clang-tidy | No errors |
| MISRA compliance | cppcheck --addon=misra | Pass |

### QA Sign-off Requirements
- [ ] All unit tests pass (new scope tests)
- [ ] All integration tests pass (full suite)
- [ ] All E2E tests pass (transpile + validate cycle)
- [ ] Generated C compiles without errors
- [ ] Static analysis clean
- [ ] No regressions in existing functionality
- [ ] Code follows established test patterns
- [ ] Every primitive type covered in type tests
- [ ] All modifier combinations tested
- [ ] Error cases produce expected messages
