# Analyzer Utilities Design

**Issue:** #395
**Date:** 2026-01-24
**Status:** Approved

## Problem

The 7 analyzers in `src/analysis/` have duplicated code that should be extracted into reusable utilities. Rather than using inheritance (BaseAnalyzer), we use composition with focused utility classes.

## Solution: Composition-Based Utilities

### 1. LiteralUtils (`src/analysis/LiteralUtils.ts`)

Extracts duplicated literal checking logic.

```typescript
class LiteralUtils {
  static isZero(ctx: LiteralContext): boolean;
  static isFloat(ctx: LiteralContext): boolean;
}
```

**Consumers:**

- `DivisionByZeroAnalyzer` - both ConstZeroCollector and DivisionByZeroListener
- `FloatModuloAnalyzer` - isFloatLiteral check

### 2. ExpressionUtils (`src/analysis/ExpressionUtils.ts`)

Extracts the 40+ line expression tree traversal pattern.

```typescript
class ExpressionUtils {
  static extractLiteral(ctx: ExpressionContext): LiteralContext | null;
  static extractPrimaryExpression(
    ctx: ExpressionContext,
  ): PrimaryExpressionContext | null;
  static extractUnaryExpression(
    ctx: ExpressionContext,
  ): UnaryExpressionContext | null;
}
```

**Consumers:**

- `DivisionByZeroAnalyzer.ConstZeroCollector.isExpressionZero()`
- `InitializationAnalyzer.markArgumentsAsInitialized()`

### 3. TypeConstants (`src/analysis/TypeConstants.ts`)

Shared type constants.

```typescript
const FLOAT_TYPES: readonly string[] = ["f32", "f64", "float", "double"];
```

**Consumers:**

- `FloatModuloAnalyzer`

## Refactoring Plan

| Analyzer                 | Change                                                             |
| ------------------------ | ------------------------------------------------------------------ |
| `DivisionByZeroAnalyzer` | Use `LiteralUtils.isZero()` and `ExpressionUtils.extractLiteral()` |
| `FloatModuloAnalyzer`    | Import `FLOAT_TYPES`, use `LiteralUtils.isFloat()`                 |
| `InitializationAnalyzer` | Use `ExpressionUtils.extractPrimaryExpression()`                   |

## Testing

Each utility gets its own unit test file:

- `tests/unit/analysis/LiteralUtils.test.ts`
- `tests/unit/analysis/ExpressionUtils.test.ts`
- `tests/unit/analysis/TypeConstants.test.ts`

## Why Not Inheritance?

- Analyzers have different structures (single-pass, two-pass, multi-pass)
- Composition allows each analyzer to use only what it needs
- Utilities are independently testable
- No coupling between unrelated analyzers
