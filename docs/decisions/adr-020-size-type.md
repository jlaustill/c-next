# ADR-020: Size Type

## Status

**Rejected**

## Context

C has `size_t` for sizes and array indices. It's platform-dependent (32-bit on ARM Cortex-M, 64-bit on desktop).

The question was whether C-Next should have a clean way to express "size of things" via `usize`/`isize` types.

## Decision

**Rejected: Use fixed-width types (`u32`/`u64`) instead of platform-sized types.**

C-Next's core philosophy is that fixed-width types solve portability problems by being explicit and predictable. Adding `usize`/`isize` would reintroduce the platform variance that fixed-width types eliminate.

## Rationale

### Fixed-Width Types Are More Predictable

| Approach      | Behavior                                             |
| ------------- | ---------------------------------------------------- |
| `u32` / `u64` | Same size everywhere — explicit choice by developer  |
| `usize`       | 16-bit on AVR, 32-bit on Cortex-M, 64-bit on desktop |

C-Next targets embedded systems where predictability matters more than abstracting over platform differences.

### MISRA C Supports This Decision

MISRA C:2023 Directive 4.6 recommends using fixed-width types from `<stdint.h>` instead of basic types. While MISRA _permits_ `size_t` and `ptrdiff_t` as exceptions, the core recommendation aligns with C-Next's approach.

### Embedded Systems Don't Need Platform-Sized Types

On C-Next's target platforms (e.g., Teensy MicroMod with ~16MB RAM):

- Maximum array size is well under `u32`'s 4GB limit
- Fixed-width types generate more predictable assembly
- Explicit sizing matches the MISRA philosophy

### The "Portability" Argument Is Inverted

The original ADR listed "portability issues" as a con of using fixed-width types. This is backwards:

- `usize` creates portability issues by changing size per platform
- `u32` is portable because it's always 32 bits everywhere

## Mitigation Strategies

### Problem: Arrays Larger Than 4GB

**Solution:** The transpiler will emit a warning if an array declaration exceeds `u32` indexing capacity. This is a compile-time check that catches the rare edge case.

### Problem: C Standard Library Interop

Functions like `malloc()`, `memcpy()`, and `strlen()` use `size_t`.

**Solution:** The transpiler handles casts at the C library boundary automatically. When C-Next code calls C stdlib functions, the generated C includes appropriate casts:

```c
// C-Next: u32 len <- myString.length();
// Generated C:
uint32_t len = (uint32_t)strlen(myString);
```

This keeps the C-Next source clean while ensuring correct C output.

## Options Considered

### Option A: `usize` and `isize` (Rejected)

```cnx
usize length <- buffer.length;
isize offset <- -5;
```

**Why rejected:** Reintroduces platform variance that C-Next's type system was designed to eliminate.

### Option B: `size` Type Only (Rejected)

```cnx
size length <- buffer.length;
```

**Why rejected:** Same platform variance issue, plus no signed variant.

### Option C: Use `u32`/`u64` Explicitly (Accepted)

Developers choose the appropriate fixed-width type based on their requirements.

**Why accepted:**

- Matches C-Next's philosophy of explicit, predictable types
- Aligns with MISRA C recommendations
- Sufficient for all embedded use cases
- Simpler — no new types to learn

## References

- [MISRA C:2023 Directive 4.6](https://www.mathworks.com/help/bugfinder/ref/misrac2023dir4.6.html) — Fixed-width type recommendations
- [Feabhas: Beyond Fixed-Size Integers](https://blog.feabhas.com/2024/01/embedded-expertise-beyond-fixed-size-integers-exploring-fast-and-least-types/) — Embedded performance considerations
- [cppreference: size_t](http://en.cppreference.com/w/c/types/size_t.html) — Standard definition
- [Rust Forum: usize vs u32](https://users.rust-lang.org/t/why-would-someone-use-usize-over-u32/105229) — Community discussion on explicit types
