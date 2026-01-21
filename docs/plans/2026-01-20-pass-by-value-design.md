# Pass-by-Value for Small Unmodified Parameters

**Date**: 2026-01-20
**Issue**: #269
**Status**: Design Complete

## Overview

Generate pass-by-value for small primitive types (≤8 bytes) when the parameter is never modified, either directly or through function calls.

### Scope

- **Applies to**: `u8`, `i8`, `u16`, `i16`, `u32`, `i32`, `u64`, `i64`, `bool`
- **Already by-value**: `f32`, `f64`, enums (no changes needed)
- **Always by-pointer**: arrays, structs, strings

### Before

```cnx
fn lowByte(u16 value) { return value[0, 8]; }
```

```c
uint8_t lowByte(uint16_t* value) { return ((*value) & 0xFFU); }
```

### After

```c
uint8_t lowByte(uint16_t value) { return ((value) & 0xFFU); }
```

### Benefits

1. **Performance** — Small values pass in registers, no pointer indirection
2. **C++ interop** — No wrapper functions needed when calling from C++
3. **Cleaner API** — Generated signatures match developer intent

## Algorithm: Fixed-Point Analysis

### Phase 1: Direct Modification Detection

Scan each function body for direct assignments to parameters:

```cnx
fn increment(u32 x) {
    x <- x + 1;  // x is directly modified
}
```

Mark parameter as "modified" if it appears on the left-hand side of `<-`.

### Phase 2: Call Graph Propagation

For each function call, check if the argument is passed to a by-pointer parameter:

```cnx
fn wrapper(u32 x) {
    increment(x);  // increment takes x by pointer → x is "effectively modified"
}
```

### Phase 3: Fixed-Point Iteration

Repeat Phase 2 until no new modifications are found. This handles transitive chains:

```
A(x) → B(x) → C(x) → x <- ...
```

All three parameters end up marked as modified.

### Edge Cases

- **Recursive functions**: Handled naturally by fixed-point iteration
- **External/built-in functions**: Assume parameters are unmodified
- **Callbacks**: Keep as-is (already handled specially)

## Code Changes

### Files to Modify

| File                                         | Change                                                           |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `src/codegen/CodeGenerator.ts:4102-4159`     | `generateParameter()` — check if param is unmodified, omit `*`   |
| `src/codegen/CodeGenerator.ts:6355-6395`     | Identifier handling — skip `(*)` dereference for by-value params |
| `src/codegen/CodeGenerator.ts` (new section) | Add analysis phase before generation                             |
| `src/codegen/types/TParameterInfo.ts`        | Add `passByValue: boolean` field                                 |

### Data Structures

```typescript
// Extend TParameterInfo
interface TParameterInfo {
  // ... existing fields
  passByValue: boolean; // NEW: true if unmodified small primitive
}
```

### Key Code Paths

1. **Parameter declaration** (`generateParameter` ~line 4158):
   - Current: `return \`${type}\* ${name}\`;`
   - New: Check if `passByValue`, return without `*`

2. **Parameter usage** (`generateIdentifier` ~line 6378):
   - Current: `return \`(\*${id})\`;`
   - New: Check if `passByValue`, return without dereference

3. **Call site arguments**:
   - Current: Generates `func(&arg)`
   - New: Check if callee's param is `passByValue`, omit `&`

## Test Strategy

### Step 1: Failing Test

Create `tests/pass-by-value/small-unmodified.test.cnx`:

```cnx
u8 getLowByte(u16 value) {
    return value[0, 8];
}

u8 getHighByte(u16 value) {
    return value[8, 8];
}

u32 addTwo(u32 a, u32 b) {
    return a + b;
}
```

Expected output without `*` in parameters.

### Step 2: Additional Tests

- Modified parameter still uses pointer
- Transitively modified (passed to modifying function) uses pointer
- Mixed: some params by value, some by pointer
- All primitive types coverage
- Execution tests to verify correctness

## Implementation Order

1. Create failing test
2. Update GitHub issue with start comment
3. Add `passByValue` to `TParameterInfo`
4. Implement modification analysis (direct assignments)
5. Implement call graph propagation (fixed-point)
6. Update `generateParameter()` to omit `*`
7. Update identifier dereferencing to omit `(*)`
8. Update call site generation to omit `&`
9. Run tests, iterate until passing
10. Add comprehensive edge case tests
11. Update documentation (ADR-006, learn-cnext)
12. Close GitHub issue with PR
