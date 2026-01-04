# ADR-019: Type Aliases

## Status

**Rejected**

## Context

Type aliases improve code readability and maintainability:

- `Byte` instead of `u8`
- `Address` instead of `u32`
- `Callback` instead of complex function pointer syntax

C uses `typedef`, C-Next should have a cleaner syntax.

## Decision

**Rejected.** C-Next's fixed-width primitive types (`u8`, `i32`, `f64`, etc.) already solve the primary safety motivation for typedef in C. Type aliases would add complexity without a compelling use case. If a need arises in the future, this decision can be revisited.

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

### Priority

**Low** - Nice to have, not critical for v1.

## Research Findings

### MISRA Perspective

MISRA **Directive 4.6** (Advisory) states: "Typedefs that indicate size and signedness should be used in place of the basic numerical types." This encourages using `uint8_t` instead of `unsigned char`, etc.

However, this guidance exists because C's basic types (`int`, `char`, `long`) have platform-dependent sizes. **C-Next already solves this problem** by using fixed-width primitives (`u8`, `i32`, `f64`) as the default types.

Additional MISRA rules on typedef:

- **Rule 5.6** (Required): Typedef names must be unique across all namespaces
- **Rule 2.3** (Advisory): Unused typedefs are non-compliant

### Conclusion

The primary MISRA motivation for typedef is already satisfied by C-Next's type system. Type aliases would be a convenience feature, not a safety requirement.

## Resolved Questions

1. **Should aliases be interchangeable?** — Moot; feature rejected.
2. **Generic type aliases?** — Moot; feature rejected.
3. **Does C-Next need type aliases?** — No. Fixed-width primitives solve the core problem.
4. **Requirements that can't be met without them?** — None identified.
5. **What does MISRA say?** — Encourages typedef for size/signedness clarity, but C-Next's primitives already provide this.

## References

- [MISRA C:2023 Directive 4.6](https://www.mathworks.com/help/bugfinder/ref/misrac2023dir4.6.html)
- [MISRA Rule 5.6 - Typedef Uniqueness](https://pvs-studio.com/en/docs/warnings/v2619/)
- C typedef
- Rust type aliases
- Go type definitions
