# ADR-031: Inline Functions

## Status

**Rejected**

## Context

Inline functions suggest the compiler embed function body at call site:

- Eliminates function call overhead
- Common for small accessor functions
- C99 added `inline` keyword with complex semantics

## Decision

**Do not implement `inline` keyword in C-Next.** Trust the compiler to make inlining decisions.

## Rationale

### 1. MISRA C Rule 8.10 Forces Our Hand

MISRA C:2012/2023 Rule 8.10 (Required):

> "An inline function shall be declared with the static storage class."

Without `static`, inline functions cause:

- **Undefined behavior** if declared but not defined in a translation unit
- **Unspecified behavior** — compiler may inline OR call externally, affecting timing

This means C-Next would be **forced to always generate `static inline`** anyway, providing no flexibility to the developer.

### 2. Compilers Ignore the Keyword

Modern compilers treat `inline` as a hint they frequently ignore:

> "Compilers can (and usually do) ignore presence or absence of the inline specifier for the purpose of optimization."

At `-O2` and above, GCC automatically enables:

- `-finline-small-functions`
- `-findirect-inlining`
- `-finline-functions`

The compiler inlines functions it deems beneficial **regardless of the keyword**.

### 3. Analogous to `register`

The C standard explicitly compares `inline` to `register`:

> "In this respect, it is analogous to the `register` storage class specifier, which similarly provides an optimization hint."

C-Next doesn't support `register` because compilers do better register allocation than humans. The same logic applies to inlining.

### 4. Common Bugs and Edge Cases

| Issue                          | Description                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------- |
| **ODR Violations**             | Without `static`, multiple translation units can have conflicting definitions |
| **Static variables in inline** | Each translation unit gets its own copy — subtle bugs                         |
| **Code bloat**                 | Excessive inlining increases binary size, hurts cache performance             |
| **Debug vs Release**           | Code behaves differently: debug builds don't inline, release builds do        |
| **Timing changes**             | Inlining affects execution timing — breaks real-time assumptions              |

### 5. Philosophy Alignment

C-Next's guiding principle: **"Safety through removal, not addition."**

Adding `inline` provides:

- No guaranteed behavior (compiler can ignore it)
- Potential for misuse (code bloat, ODR violations)
- False sense of control

## Alternatives for Performance-Critical Code

If a developer truly needs forced inlining:

1. **Trust the compiler** — Modern optimizers inline small functions automatically
2. **Use generated C** — Add `__attribute__((always_inline))` to the generated `.c` file
3. **Profile first** — Premature optimization is the root of all evil

## Options Considered (Historical)

### Option A: C-Style `inline` (Rejected)

```cnx
inline u32 getFlag(u32 reg, u32 bit) {
    return (reg >> bit) & 1;
}
```

**Rejected:** Complex C99 semantics, MISRA forces `static inline` anyway.

### Option B: `@inline` Attribute (Rejected)

```cnx
@inline
u32 getFlag(u32 reg, u32 bit) {
    return (reg >> bit) & 1;
}
```

**Rejected:** Still just a hint the compiler ignores.

### Option C: Compiler Decides (Accepted)

No inline keyword — trust the compiler.

**Accepted:** Simple, aligns with C-Next philosophy, no false promises.

## References

- [MISRA C:2012 Rule 8.10](https://kr.mathworks.com/help/bugfinder/ref/misrac2012rule8.10.html) — Inline functions must be static
- [Inline Function - Wikipedia](https://en.wikipedia.org/wiki/Inline_function) — Compilers ignore the keyword
- [GCC Inline Documentation](https://gcc.gnu.org/onlinedocs/gcc/Inline.html) — Automatic inlining at -O2
- [Inline Code in C and C++ - Embedded.com](https://www.embedded.com/inline-code-in-c-and-c/) — Code bloat warnings
- [cppreference - inline](http://en.cppreference.com/w/c/language/inline.html) — Analogy to `register`
- [SEI CERT ODR Rule](https://wiki.sei.cmu.edu/confluence/display/cplusplus/DCL60-CPP.+Obey+the+one-definition+rule) — ODR violation examples
