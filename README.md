# C-Next

A safer C for embedded systems development. Transpiles to clean, readable C.

## Philosophy

C-Next follows the TypeScript model for adoption:

1. **Not all-or-nothing** — Drop a single `.cnx` file into an existing C project. The rest stays untouched.
2. **Clean escape hatch** — The generated C is idiomatic and maintainable. If C-Next disappeared tomorrow, you keep working.
3. **Helpful, not burdensome** — If you know C, you can read C-Next immediately and write it within an hour.

The goal is not to replace C, but to make it harder to shoot yourself in the foot while keeping everything familiar.

### The Simplicity Constraint

Linus Torvalds famously values C because it's simple — you can look at code and understand what the machine will do. Rust adds safety, but also cognitive overhead: lifetimes, borrow checkers, `Box<dyn Trait>`.

C-Next takes a different path:

| Rust's Path | C-Next's Path |
|-------------|---------------|
| Add concepts to catch errors | Remove the ability to make errors |
| Borrow checker complexity | No heap = no ownership tracking needed |
| Lifetime annotations | Static allocation = predictable lifetimes |
| `unsafe` escape hatch | Clean C is the escape hatch |

**Guiding Principle:** If Linus Torvalds wouldn't approve of the complexity, it doesn't ship. Safety through removal, not addition.

The test: **Can a senior C developer read C-Next code cold and understand it in 30 seconds?** If not, the feature is too clever.

## Core Language Features

### Assignment Operator: `<-`

The single most common source of C bugs — `if (x = 5)` instead of `if (x == 5)` — is eliminated by design.

```
x <- 5;         // assignment: value flows INTO x
if (x = 5)      // comparison: single equals, just like math
```

This isn't arbitrary. R has supported both `<-` and `->` for decades. The community organically chose `x <- 1` because developers prefer seeing the target on the left when scanning code. And the entire point of c-next is to research common patterns that have proven to work naturally vs ones that have proven to be painful

### Namespaces and Classes

C-Next distinguishes between **namespaces** (singleton services) and **classes** (multiple instances):

- **Namespaces** — For application services: one Console, one Logger, one Math library
- **Classes** — For hardware peripherals: 8 UARTs, 3 CAN buses, multiple ring buffers

```
namespace Console {
    private UART* uart;
    private LogLevel logLevel;

    void init(UART* u) { ... }
    void print(const char* msg) { ... }
}

namespace Math {
    f32 sin(f32 x) { ... }
    f32 clamp(f32 val, f32 min, f32 max) { ... }
}
```

Transpiles to:
```c
static UART* Console_uart;           // private -> static
static LogLevel Console_logLevel;

void Console_init(UART* u) { ... }   // public -> external linkage
void Console_print(const char* msg) { ... }
```

Classes are first-class citizens (without inheritance) for when you need multiple instances.

### Register Bindings

Define hardware register layouts once, bind to addresses:

```
struct USARTRegisters {
    volatile u32 CR;    // Control register
    volatile u32 SR;    // Status register (read-only)
    volatile u32 DR;    // Data register
} 0x40000000; // default starting memory address if one isn't provided upon usage, see below

USARTRegisters USART1 0x40011000; // 3rd option is the starting memory address
USARTRegisters USART2; // uses default memory address, one and ONLY one usage may do so!
```

Usage is clean and statically typed:
```
USART1.CR <- 0x000C;
value <- USART1.DR;
```

Transpiles to standard C struct pointer patterns — exactly what experienced embedded developers already write.

### Static Allocation Only

Inspired by MISRA C and DO-178C (avionics software standards): **no dynamic memory allocation after initialization**.

This single rule eliminates:
- Memory leaks
- Fragmentation  
- Allocation failures at runtime
- Use-after-free
- Double-free

The transpiler enforces this. `malloc` and friends simply don't exist in the language.

### Sane Types

No more `uint8_t` vs `unsigned char` vs `u8` inconsistency:

```
u8, u16, u32, u64      // unsigned integers
i8, i16, i32, i64      // signed integers
f32, f64               // floating point
bool                   // boolean
```

Transpiles to `<stdint.h>` types.

## Design Goals

### Target: Safety-Critical Embedded Systems

C-Next aims to make MISRA C and DO-178C compliance easier by making violations impossible to express:

| Safety Concern | C-Next Solution |
|----------------|-----------------|
| Dynamic allocation bugs | No heap allocation primitives |
| Assignment/comparison confusion | `<-` vs `=` |
| Uninitialized variables | Mandatory initialization |
| Namespace collisions | Explicit namespaces |
| Type confusion | Fixed-width types only, no implicit conversions |

### Non-Goals

- Replacing C++ for application development
- Garbage collection
- Runtime overhead
- Clever syntax that's hard to read

## Tooling

C-Next is a single executable that runs as a pre-compile step:

```makefile
%.c: %.cnx
    cnx $< -o $@
```

Works with Make, CMake, or any build system. No IDE plugins required(for compilation), no dependencies, no runtime.

## Project Status

**Current: Research & Design Phase**

This project is exploring what a "better C for embedded" could look like, informed by:
- 30 years of embedded development experience
- MISRA C:2012 guidelines (143 rules analyzed)
- DO-178C avionics certification requirements
- CERT C secure coding standards
- The TypeScript adoption model
- R's natural experiment with `<-` vs `->` assignment

## Repository Structure

```
/docs
  /research          # Analysis of standards, other languages
  /design            # Feature specifications
  /decisions         # Architecture Decision Records (ADRs)
/grammar
  cnext.g4           # ANTLR grammar definition
/src                 # Transpiler implementation (TypeScript?)
/examples            # Example C-Next code
/tests               # Test cases
```

## Architecture Decision Records

Key decisions are documented in `/docs/decisions/`:

### Accepted
- [ADR-001: Assignment Operator](docs/decisions/adr-001-assignment-operator.md) — Why `<-` for assignment and `=` for comparison

### Proposed
- [ADR-002: Namespaces](docs/decisions/adr-002-namespaces.md) — Namespaces as singleton scoping mechanism

### Draft (Research Phase)
- [ADR-003: Static Allocation](docs/decisions/adr-003-static-allocation.md) — No dynamic memory allocation after init
- [ADR-004: Register Bindings](docs/decisions/adr-004-register-bindings.md) — Type-safe hardware register access
- [ADR-005: Classes Without Inheritance](docs/decisions/adr-005-classes-without-inheritance.md) — Multiple instances without OOP complexity
- [ADR-006: Simplified References](docs/decisions/adr-006-simplified-references.md) — Pass by reference, no pointer syntax 

## Contributing

This is currently a personal research project. Ideas and feedback welcome via issues.

## License

MIT

## Acknowledgments

- The R community for proving `<-` works in practice
- MISRA C consortium for codifying decades of embedded safety wisdom
- The TypeScript team for demonstrating gradual adoption works
