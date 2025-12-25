# C-Next

A safer C for embedded systems development. Transpiles to clean, readable C.

## Philosophy

C-Next follows the TypeScript model for adoption:

1. **Not all-or-nothing** — Drop a single `.cnx` file into an existing C project. The rest stays untouched.
2. **Clean escape hatch** — The generated C is idiomatic and maintainable. If C-Next disappeared tomorrow, you keep working.
3. **Helpful, not burdensome** — If you know C, you can read C-Next immediately and write it within an hour.

The goal is not to replace C, but to make it harder to shoot yourself in the foot while keeping everything familiar.

## Core Language Features

### Assignment Operator: `<-`

The single most common source of C bugs — `if (x = 5)` instead of `if (x == 5)` — is eliminated by design.

```
x <- 5          // assignment: value flows INTO x
if (x = 5)      // comparison: single equals, just like math
```

This isn't arbitrary. R has supported both `<-` and `->` for decades. The community organically chose `x <- 1` because developers prefer seeing the target on the left when scanning code. And the entire point of c-next is to research common patterns that have proven to work naturally vs ones that have proven to be painful

### Namespaces (Not Classes)

Most embedded code is naturally singleton — one CAN bus, one UART, one ADC. Namespaces make this explicit:

```
namespace CanBus {
    static Buffer txBuffer[8];
    static i32 baudRate;
    
    void init(i32 baud) { ... }
    void send(Message msg) { ... }
}
```

Transpiles to:
```c
static Buffer CanBus_txBuffer[8];
static int32_t CanBus_baudRate;

void CanBus_init(int32_t baud) { ... }
void CanBus_send(Message msg) { ... }
```

Use structs/classes only when you actually need multiple instances.

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

- [ADR-001: Assignment Operator](docs/decisions/adr-001-assignment-operator.md) — Why `<-` for assignment and `=` for comparison
- [ADR-002: Namespaces Over Classes](docs/decisions/adr-002-namespaces.md) — Why namespaces are the default organizational unit
- [ADR-003: Static Allocation Only](docs/decisions/adr-003-static-allocation.md) — Why dynamic allocation is prohibited
- [ADR-004: Register Binding Syntax](docs/decisions/adr-004-register-bindings.md) — 

## Contributing

This is currently a personal research project. Ideas and feedback welcome via issues.

## License

MIT

## Acknowledgments

- The R community for proving `<-` works in practice
- MISRA C consortium for codifying decades of embedded safety wisdom
- The TypeScript team for demonstrating gradual adoption works
