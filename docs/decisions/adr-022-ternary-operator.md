# ADR-022: Ternary Operator

## Status
**Research**

## Context

The ternary operator `condition ? true_value : false_value` is widely used in C for:
- Inline conditionals
- Min/max expressions
- Default values
- Conditional assignment

## Decision Drivers

1. **Convenience** - Avoids verbose if/else for simple cases
2. **Expression Context** - Works where statements don't
3. **Readability** - Can be clearer OR more confusing
4. **C Compatibility** - Familiar syntax

## Options Considered

### Option A: Standard C Ternary
```cnx
u32 max <- (a > b) ? a : b;
u32 abs <- (x < 0) ? -x : x;
```

**Pros:** Familiar, concise
**Cons:** Can be nested/abused

### Option B: Keyword-Based
```cnx
u32 max <- if a > b then a else b;
```

**Pros:** More readable
**Cons:** Unfamiliar, longer

### Option C: No Ternary
Use if/else statements only.

**Pros:** Forces explicit code
**Cons:** Verbose, can't use in expressions

## Recommended Decision

**Option A: Standard C Ternary** - It's familiar and useful.

Consider limiting nesting depth in static analysis.

## Syntax

### Basic Usage
```cnx
// Simple conditional
u32 result <- (x > 0) ? x : 0;

// With comparison (note: = is comparison in C-Next)
bool isEven <- (n % 2 = 0) ? true : false;

// Chained (discouraged but allowed)
u32 sign <- (x > 0) ? 1 : (x < 0) ? -1 : 0;
```

### Common Patterns
```cnx
// Min/max
u32 min <- (a < b) ? a : b;
u32 max <- (a > b) ? a : b;

// Clamp
u32 clamped <- (x < min) ? min : (x > max) ? max : x;

// Default value
u32 value <- (ptr != null) ? ptr.value : 0;
```

## Implementation Notes

### Grammar Changes
```antlr
conditionalExpression
    : orExpression ('?' expression ':' conditionalExpression)?
    ;
```

### CodeGenerator
Direct pass-through to C:
```c
uint32_t result = (x > 0) ? x : 0;
```

### Priority
**High** - Very commonly used, relatively simple to implement.

## Open Questions

1. Warn on deeply nested ternaries?
2. Require parentheses around condition?

## References

- C ternary operator
- MISRA C ternary guidelines
