# ADR-020: Size Type

## Status
**Research**

## Context

C has `size_t` for sizes and array indices. It's platform-dependent (32-bit on ARM Cortex-M, 64-bit on desktop).

C-Next should have a clean way to express "size of things."

## Decision Drivers

1. **Portability** - Same code works on 32-bit and 64-bit
2. **Array Indexing** - Natural type for array indices
3. **Memory Sizes** - Buffer lengths, allocation sizes
4. **C Compatibility** - Map to size_t

## Options Considered

### Option A: `usize` and `isize`
```cnx
usize length <- buffer.length;
isize offset <- -5;

for (usize i <- 0; i < length; i +<- 1) {
    buffer[i] <- 0;
}
```

Generates:
```c
size_t length = 16;
ptrdiff_t offset = -5;
```

**Pros:** Rust-familiar, clear intent
**Cons:** New types to learn

### Option B: `size` Type Only
```cnx
size length <- buffer.length;
```

**Pros:** Simple, obvious
**Cons:** No signed variant

### Option C: Use `u32`/`u64` Explicitly
No special type - developers choose appropriate fixed-width type.

**Pros:** No new concepts
**Cons:** Portability issues, verbose

## Recommended Decision

**Option A: `usize` and `isize`** - Clear, portable, modern.

## Syntax

```cnx
// Array length is usize
usize len <- buffer.length;

// Loop index
for (usize i <- 0; i < len; i +<- 1) { }

// Pointer arithmetic (if needed)
isize diff <- endPtr - startPtr;
```

## Implementation Notes

### Grammar Changes
Add to primitiveType:
```antlr
primitiveType
    : 'u8' | 'u16' | 'u32' | 'u64'
    | 'i8' | 'i16' | 'i32' | 'i64'
    | 'f32' | 'f64'
    | 'bool'
    | 'usize' | 'isize'  // NEW
    ;
```

### CodeGenerator
- `usize` -> `size_t` (requires `#include <stddef.h>`)
- `isize` -> `ptrdiff_t`

### Priority
**Low** - Nice to have for portability, but `u32` works for most embedded.

## Open Questions

1. Auto-include `<stddef.h>` when usize/isize used?
2. Implicit conversion between usize and u32?

## References

- C size_t and ptrdiff_t
- Rust usize/isize
- Zig usize
