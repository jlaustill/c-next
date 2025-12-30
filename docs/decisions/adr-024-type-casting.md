# ADR-024: Type Casting

## Status
**Research**

## Context

Type casting is unavoidable in embedded C:
- Narrowing conversions (u32 to u8)
- Widening conversions (u8 to u32)
- Signed/unsigned conversions
- Pointer casts (via references in C-Next)

C's cast syntax `(type)value` is error-prone and unclear about intent.

## Decision Drivers

1. **Safety** - Make dangerous casts explicit
2. **Clarity** - Distinguish safe vs unsafe casts
3. **C Compatibility** - Generate valid C casts
4. **Embedded Reality** - Casts are sometimes necessary

## Options Considered

### Option A: C-Style Cast
```cnx
u8 byte <- (u8)value;
i32 signed <- (i32)unsigned_val;
```

**Pros:** Familiar
**Cons:** No distinction between safe/unsafe

### Option B: `as` Keyword
```cnx
u8 byte <- value as u8;
i32 signed <- unsigned_val as i32;
```

**Pros:** Readable, modern
**Cons:** New syntax to learn

### Option C: Explicit Cast Functions
```cnx
u8 byte <- u8(value);      // Truncating cast
i32 signed <- i32(unsigned_val);
```

**Pros:** Clear intent
**Cons:** Looks like constructor

### Option D: Safe vs Unsafe Cast
```cnx
u32 wide <- narrow as u32;           // Safe (widening)
u8 byte <- value as! u8;             // Unsafe (narrowing) - requires !
```

**Pros:** Highlights dangerous casts
**Cons:** More complex

## Recommended Decision

**Option B: `as` Keyword** - Clean, readable, and becoming standard in modern languages.

Consider warnings for lossy casts.

## Syntax

### Widening (Safe)
```cnx
u8 byte <- 42;
u32 wide <- byte as u32;   // No data loss
i16 small <- 100;
i32 large <- small as i32; // No data loss
```

### Narrowing (Potentially Lossy)
```cnx
u32 large <- 1000;
u8 byte <- large as u8;    // Truncates to 232 - compiler warning?

i32 signed <- -5;
u32 unsigned <- signed as u32;  // Dangerous! Warning?
```

### Common Patterns
```cnx
// Register access
u8 regValue <- (GPIO7.DR as u8);

// Bit manipulation result
bool bit <- ((flags >> 3) & 1) as bool;

// Array index
u8 buffer[256];
buffer[index as usize] <- value;
```

### Pointer/Reference Casts
```cnx
// With ADR-006 simplified references, most pointer casts go away
// But for hardware access:
u32 rawAddr <- 0x40000000;
volatile u32 reg <- rawAddr as volatile u32;  // Maybe?
```

## Implementation Notes

### Grammar Changes
```antlr
castExpression
    : unaryExpression ('as' type)*
    ;
```

### CodeGenerator
```c
// C-Next: value as u8
// C:      (uint8_t)value
```

### Warnings to Consider
- Narrowing conversions
- Signed to unsigned
- Floating point to integer
- Loss of precision

### Priority
**Critical** - Casts are unavoidable in embedded.

## Open Questions

1. Require explicit cast for narrowing, implicit for widening?
2. Special syntax for reinterpret casts (bit-level)?
3. Overflow behavior - wrap, saturate, or error?

## References

- C type casting
- Rust `as` casting
- Zig type coercion
- MISRA C type conversion rules
