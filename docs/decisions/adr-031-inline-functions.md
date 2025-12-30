# ADR-031: Inline Functions

## Status
**Research**

## Context

Inline functions suggest the compiler embed function body at call site:
- Eliminates function call overhead
- Common for small accessor functions
- Critical for performance-sensitive embedded code

C99 added `inline` keyword with complex semantics.

## Decision Drivers

1. **Performance** - Avoid call overhead
2. **Small Functions** - Getters, setters, bit operations
3. **Simplicity** - Don't need full C99 inline semantics
4. **Header Functions** - Inline often defined in headers

## Options Considered

### Option A: C-Style `inline`
```cnx
inline u32 getFlag(u32 reg, u32 bit) {
    return (reg >> bit) & 1;
}
```

**Pros:** Familiar
**Cons:** Complex C99 semantics

### Option B: `@inline` Attribute
```cnx
@inline
u32 getFlag(u32 reg, u32 bit) {
    return (reg >> bit) & 1;
}
```

**Pros:** Clear it's a hint
**Cons:** New syntax

### Option C: Compiler Decides
No inline keyword - trust the compiler.

**Pros:** Simple
**Cons:** Less control

## Recommended Decision

**Option A: C-Style `inline`** - Familiar, generates `static inline`.

## Syntax

### Basic Inline
```cnx
inline bool getBit(u32 value, u32 bit) {
    return (value >> bit) & 1;
}

inline void setBit(u32 value, u32 bit) {
    value |<- (1 << bit);
}
```

### Force Inline (if needed)
```cnx
forceinline u32 fastAbs(i32 x) {
    return (x < 0) ? -x : x;
}
```

## Implementation Notes

### Grammar Changes
```antlr
functionDeclaration
    : inlineModifier? type IDENTIFIER '(' parameterList? ')' block
    ;

inlineModifier
    : 'inline'
    | 'forceinline'
    ;
```

### CodeGenerator
```c
// C-Next: inline bool getBit(...)
// C:      static inline bool getBit(...)
```

Using `static inline` ensures one definition rule compliance.

### Priority
**Medium** - Performance optimization, not critical for correctness.

## Open Questions

1. `forceinline` or just `inline`?
2. Always use `static inline` in generated C?

## References

- C99 inline semantics
- GCC always_inline attribute
- When to use inline in embedded
