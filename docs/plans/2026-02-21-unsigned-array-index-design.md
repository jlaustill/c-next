# Unsigned Array Index Restriction — Design

**Date:** 2026-02-21
**Related ADR:** ADR-054 (Array Index Overflow Semantics)

## Problem

C-Next currently accepts any expression as an array or bit index with zero type validation. Signed integers, floats, strings, and structs are all silently passed through to generated C. This contradicts C-Next's safety-by-construction philosophy and allows negative index bugs (CWE-787).

## Decision

All bracket subscript expressions (`arr[idx]`, `val[bit]`, `val[start, width]`) must use unsigned integer types, bool, or enum members. Signed integers, floats, and other types produce a compile error.

### Allowed Index Types

| Type                      | Allowed           | Rationale                            |
| ------------------------- | ----------------- | ------------------------------------ |
| `u8`, `u16`, `u32`, `u64` | Yes               | Primary index types                  |
| `bool`                    | Yes               | Safe (0/1), useful for lookup tables |
| Enum members              | Yes               | Transpile to unsigned constants      |
| Integer literals          | Yes               | Most common case                     |
| `i8`, `i16`, `i32`, `i64` | **Compile error** | Negative indexes cause UB            |
| `f32`, `f64`              | **Compile error** | Not valid indexes                    |
| `string`, structs         | **Compile error** | Not indexable types                  |

### Scope

Applies to **all** bracket subscript contexts uniformly:

- Array element access: `arr[idx]`
- Single bit access: `flags[bit]`
- Bit range access: `reg[start, width]`

This is consistent since negative bit positions are equally invalid.

## Implementation Approach

### New Analyzer: `ArrayIndexTypeAnalyzer`

Follow the `DivisionByZeroAnalyzer` pattern in `src/transpiler/logic/analysis/`:

1. Walk the parse tree with `ParseTreeWalker`
2. On `postfixOp` and `postfixTargetOp` nodes containing `[expr]` or `[expr, expr]`, resolve the type of each index expression
3. Check if the resolved type is in the allowed set (unsigned integers, bool, enum)
4. Emit error E0850 if not

### Error Code

**E0850**: `Subscript index must be an unsigned integer type, bool, or enum; got '<type>'`

### Type Resolution Strategy

Use `TypeResolver.getExpressionType()` to determine the type of the index expression. For cases where the type can't be resolved (unknown variables, complex expressions), allow through — the C compiler will catch truly invalid types.

### ADR-054 Updates

1. Fix all C-Next syntax examples (e.g., `wrap u8[256] rxBuffer;` not `wrap u8 rxBuffer[256];`)
2. Add unsigned index types as a design element
3. Keep status as Research (no status change)
4. Update code blocks to use `<-` for assignment, `=` for comparison

## Files to Create/Modify

| File                                                                     | Action                                    |
| ------------------------------------------------------------------------ | ----------------------------------------- |
| `docs/decisions/adr-054-array-index-overflow.md`                         | Update syntax, add unsigned index section |
| `src/transpiler/logic/analysis/ArrayIndexTypeAnalyzer.ts`                | New analyzer                              |
| `src/transpiler/logic/analysis/runAnalyzers.ts`                          | Register new analyzer                     |
| `src/transpiler/logic/analysis/__tests__/ArrayIndexTypeAnalyzer.test.ts` | Unit tests                                |
| `tests/array-index-type/`                                                | Integration tests (test-error cases)      |

## Test Plan

### Unit Tests

- Unsigned types accepted: `u8`, `u16`, `u32`, `u64`
- Bool accepted
- Enum members accepted
- Integer literals accepted
- Signed types rejected: `i8`, `i16`, `i32`, `i64`
- Float types rejected: `f32`, `f64`
- Works for array access, bit access, and bit range access
- Complex expressions (arithmetic on unsigned) accepted

### Integration Tests

- `test-error` files for each rejected type
- Existing tests continue to pass (no regressions)
