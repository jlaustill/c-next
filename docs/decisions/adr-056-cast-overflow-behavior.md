# ADR-056: Cast Overflow Behavior

## Status

**Research**

## Context

Issue #632 revealed that float-to-integer casts were silently wrapping (undefined behavior in C) instead of clamping. The fix implemented clamping for float-to-integer casts, but this creates an inconsistency:

| Cast Type                    | Current Behavior                              |
| ---------------------------- | --------------------------------------------- |
| Integer narrowing (u32 → u8) | **ERROR** - must use bit indexing `val[0, 8]` |
| Float to integer (f32 → u8)  | **Clamps** to type range (0-255)              |

This inconsistency exists because bit indexing on floats gives raw IEEE 754 bits, not a truncated integer value - so it's not a viable alternative for float-to-integer conversion.

### Current Implementation (Issue #632)

Float-to-integer casts now generate clamping code:

```c
// C-Next: u8 result <- (u8)scaled;
// Generated C:
uint8_t result = ((scaled) > ((float)UINT8_MAX) ? UINT8_MAX : (scaled) < 0.0f ? 0 : (uint8_t)(scaled));
```

This matches C-Next's default `clamp` overflow semantics for arithmetic operations.

## Questions to Research

### 1. Should integer narrowing casts also be allowed with clamping?

Currently forbidden:

```cnx
u32 large <- 1000;
u8 small <- (u8)large;  // ERROR: use bit indexing
```

Could allow with clamping:

```cnx
u32 large <- 1000;
u8 small <- (u8)large;  // Clamps to 255
```

**Trade-off**: Bit indexing is more explicit about intent (`large[0, 8]` = "I want the low 8 bits"), but clamping might be what the developer actually wants in many cases.

### 2. Should `wrap` modifier work on cast expressions?

Syntax idea:

```cnx
f32 scaled <- 261.7;
wrap u8 result <- (u8)scaled;  // Explicit wrap: produces 5
u8 clamped <- (u8)scaled;      // Default clamp: produces 255
```

This would mirror how `wrap`/`clamp` work for variable declarations and arithmetic:

```cnx
clamp u16 safe <- 0;    // Saturates on overflow (default)
wrap u32 counter <- 0;  // Two's complement wrap (opt-in)
```

### 3. Consistency matrix to consider

| Operation              | Default | With `wrap`      |
| ---------------------- | ------- | ---------------- |
| Arithmetic overflow    | Clamp   | Wrap             |
| Float → integer cast   | Clamp   | Wrap?            |
| Integer narrowing cast | Error   | Allow with wrap? |
| Integer sign cast      | Error   | Allow with wrap? |

### 4. Alternative: Explicit conversion functions

Instead of cast syntax, require explicit functions:

```cnx
u8 result <- f32_to_u8_clamp(scaled);  // Clamps
u8 result <- f32_to_u8_wrap(scaled);   // Wraps
u8 result <- u32_to_u8_clamp(large);   // Clamps
u8 result <- u32_to_u8_bits(large);    // Same as large[0, 8]
```

**Pro**: Very explicit, no magic
**Con**: Verbose, many function combinations needed

## Related ADRs

- **ADR-024**: Type Casting - established current narrowing/sign cast rules
- **ADR-044**: Primitive Types - established `clamp`/`wrap` overflow semantics

## References

- Issue #632: Float to u8 cast wraps instead of clamping
- PR #633: Implementation of float-to-integer clamping

## Decision

_To be determined after research and discussion._

## Next Steps

1. Gather feedback on whether current inconsistency is acceptable
2. Evaluate `wrap` modifier on cast expressions
3. Consider whether integer narrowing should be allowed with clamping
4. Prototype syntax options if pursuing unification
