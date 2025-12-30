# ADR-019: Type Aliases

## Status
**Research**

## Context

Type aliases improve code readability and maintainability:
- `Byte` instead of `u8`
- `Address` instead of `u32`
- `Callback` instead of complex function pointer syntax

C uses `typedef`, C-Next should have a cleaner syntax.

## Decision Drivers

1. **Readability** - Self-documenting code
2. **Refactoring** - Change type in one place
3. **Simplicity** - Easy to understand syntax
4. **C Compatibility** - Generate valid typedef

## Options Considered

### Option A: `type` Keyword with Assignment
```cnx
type Byte <- u8;
type Address <- u32;
type Buffer <- u8[256];
```

Generates:
```c
typedef uint8_t Byte;
typedef uint32_t Address;
typedef uint8_t Buffer[256];
```

**Pros:** Consistent with C-Next assignment syntax
**Cons:** `<-` might be confusing for types (not a value flow)

### Option B: `type` Keyword with Equals
```cnx
type Byte = u8;
type Address = u32;
```

**Pros:** `=` for equivalence makes sense
**Cons:** Inconsistent with `=` being comparison elsewhere

### Option C: `alias` Keyword
```cnx
alias Byte <- u8;
alias Address <- u32;
```

**Pros:** Clear intent
**Cons:** New keyword

## Recommended Decision

**Option A: `type` with `<-`** - Maintains consistency with rest of language.

## Syntax

### Basic Alias
```cnx
type Byte <- u8;
type Word <- u16;
type DWord <- u32;
```

### Pointer/Reference Alias
```cnx
type BytePtr <- u8*;  // If we had pointers
// But with ADR-006, references are implicit
```

### Array Alias
```cnx
type Buffer <- u8[64];
type Matrix4x4 <- f32[16];
```

### Struct Alias
```cnx
struct Point { i32 x; i32 y; }
type Vector2D <- Point;
```

### Function Pointer Alias (depends on ADR-029)
```cnx
type Callback <- void(u32);
type Comparator <- i32(const void, const void);
```

## Implementation Notes

### Grammar Changes
```antlr
typeAliasDeclaration
    : 'type' IDENTIFIER '<-' type ';'
    ;
```

### Priority
**Low** - Nice to have, not critical for v1.

## Open Questions

1. Should aliases be interchangeable with original type?
2. Generic type aliases? `type List<T> <- T[100];`

## References

- C typedef
- Rust type aliases
- Go type definitions
