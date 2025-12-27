# C-Next

A safer C for embedded systems development. Transpiles to clean, readable C.

**Status: Working Transpiler** — Verified on Teensy MicroMod hardware.

## Quick Example

```cnx
// Register binding with type-safe access
register GPIO7 @ 0x42004000 {
    DR:         u32 rw @ 0x00,
    DR_SET:     u32 wo @ 0x84,
    DR_TOGGLE:  u32 wo @ 0x8C,
}

u32 LED_BIT <- 3;

namespace LED {
    void toggle() {
        // Type-aware bit indexing on write-only register
        GPIO7.DR_TOGGLE[LED_BIT] <- true;
    }
}
```

Generates clean C:
```c
#define GPIO7_DR_TOGGLE (*(volatile uint32_t*)(0x42004000 + 0x8C))

uint32_t LED_BIT = 3;

void LED_toggle(void) {
    GPIO7_DR_TOGGLE = (1 << LED_BIT);
}
```

## Installation

```bash
git clone https://github.com/jlaustill/c-next.git
cd c-next
npm install
npm run build
```

## Usage

```bash
# Transpile to C
node dist/index.js examples/blink.cnx -o blink.c

# Parse only (syntax check)
node dist/index.js examples/blink.cnx --parse
```

## Philosophy

C-Next follows the TypeScript model for adoption:

1. **Not all-or-nothing** — Drop a single `.cnx` file into an existing C project
2. **Clean escape hatch** — Generated C is idiomatic and maintainable
3. **Helpful, not burdensome** — If you know C, you can read C-Next immediately

### Core Principles

**KISS (Keep It Simple, Stupid)**
Every feature must pass the simplicity test: "Can a senior C developer read this cold and understand it in 30 seconds?" If not, it's too clever.

**DRY (Don't Repeat Yourself)**
Configuration belongs in one place. No magic numbers scattered through code. Named constants and register bindings enforce single sources of truth.

**Pragmatic, Not Dogmatic**
C-Next makes the right thing easy and the wrong thing hard, but doesn't prevent escape hatches. Generated C is always readable and maintainable.

### C Preprocessor Compatibility

C-Next uses the standard C preprocessor — no custom module system. This means:
- `#include` directives pass through to generated C
- MISRA preprocessor guidelines apply
- Full compatibility with existing toolchains (PlatformIO, arm-gcc, etc.)
- Conditional compilation (`#ifdef`) works as expected

Generated headers automatically include guards:
```c
#ifndef MYFILE_H
#define MYFILE_H
// ...
#endif /* MYFILE_H */
```

### The Simplicity Constraint

| Rust's Path | C-Next's Path |
|-------------|---------------|
| Add concepts to catch errors | Remove the ability to make errors |
| Borrow checker complexity | Startup allocation = predictable memory |
| Lifetime annotations | Fixed runtime layout = clear lifetimes |
| `unsafe` escape hatch | Clean C is the escape hatch |

**Guiding Principle:** If Linus Torvalds wouldn't approve of the complexity, it doesn't ship. Safety through removal, not addition.

## Core Features

### Assignment: `<-` vs Equality: `=`

Eliminates the `if (x = 5)` bug by design:

```cnx
x <- 5;         // assignment: value flows INTO x
if (x = 5)      // comparison: single equals, just like math
```

### Fixed-Width Types

```cnx
u8, u16, u32, u64      // unsigned integers
i8, i16, i32, i64      // signed integers
f32, f64               // floating point
bool                   // boolean
```

### Register Bindings

Type-safe hardware access with access modifiers:

```cnx
register GPIO7 @ 0x42004000 {
    DR:         u32 rw @ 0x00,    // Read-Write
    PSR:        u32 ro @ 0x08,    // Read-Only
    DR_SET:     u32 wo @ 0x84,    // Write-Only (atomic set)
    DR_CLEAR:   u32 wo @ 0x88,    // Write-Only (atomic clear)
    DR_TOGGLE:  u32 wo @ 0x8C,    // Write-Only (atomic toggle)
}
```

### Type-Aware Bit Indexing

Integers are indexable as bit arrays:

```cnx
u8 flags <- 0;
flags[3] <- true;           // Set bit 3
flags[0, 3] <- 5;           // Set 3 bits starting at bit 0
bool isSet <- flags[3];     // Read bit 3

// .length property
u8 buffer[16];
buffer.length;              // 16 (array element count)
flags.length;               // 8 (bit width of u8)
```

Write-only registers generate optimized code:
```cnx
GPIO7.DR_SET[LED_BIT] <- true;    // Generates: GPIO7_DR_SET = (1 << LED_BIT);
```

### Namespaces

Singleton services with automatic name prefixing:

```cnx
namespace LED {
    void on() { GPIO7.DR_SET[LED_BIT] <- true; }
    void off() { GPIO7.DR_CLEAR[LED_BIT] <- true; }
}

// Call as:
LED.on();
LED.off();
```

Transpiles to:
```c
void LED_on(void) { GPIO7_DR_SET = (1 << LED_BIT); }
void LED_off(void) { GPIO7_DR_CLEAR = (1 << LED_BIT); }
```

### Startup Allocation

Allocate at startup, run with fixed memory. Per MISRA C:2023 Dir 4.12: all memory is allocated during initialization, then forbidden. No runtime allocation means no fragmentation, no OOM, no leaks.

## Hardware Testing

Verified on **Teensy MicroMod** (NXP i.MX RT1062):

```bash
# Build and flash with PlatformIO
cd test-teensy
pio run -t upload
```

See `examples/blink.cnx` for the complete LED blink example.

## Project Structure

```
c-next/
├── grammar/CNext.g4           # ANTLR4 grammar definition
├── src/
│   ├── codegen/CodeGenerator.ts   # Transpiler core
│   ├── parser/                    # Generated ANTLR parser
│   └── index.ts                   # CLI entry point
├── examples/
│   ├── blink.cnx                  # LED blink (Teensy verified)
│   └── bit_test.cnx               # Bit manipulation tests
├── test-teensy/                   # PlatformIO test project
└── docs/decisions/               # Architecture Decision Records
```

## Architecture Decision Records

Decisions are documented in `/docs/decisions/`:

### Implemented
| ADR | Title | Description |
|-----|-------|-------------|
| [ADR-001](docs/decisions/adr-001-assignment-operator.md) | Assignment Operator | `<-` for assignment, `=` for comparison |
| [ADR-002](docs/decisions/adr-002-namespaces.md) | Namespaces | Singleton scoping with name prefixing |
| [ADR-003](docs/decisions/adr-003-static-allocation.md) | Static Allocation | No dynamic memory after init |
| [ADR-004](docs/decisions/adr-004-register-bindings.md) | Register Bindings | Type-safe hardware access |
| [ADR-006](docs/decisions/adr-006-simplified-references.md) | Simplified References | Pass by reference, no pointer syntax |
| [ADR-007](docs/decisions/adr-007-type-aware-bit-indexing.md) | Type-Aware Bit Indexing | Integers as bit arrays, `.length` property |
| [ADR-011](docs/decisions/adr-011-vscode-extension.md) | VS Code Extension | Live C preview with syntax highlighting |

### Planned
| ADR | Title | Description |
|-----|-------|-------------|
| [ADR-005](docs/decisions/adr-005-classes-without-inheritance.md) | Classes Without Inheritance | Multiple instances without OOP complexity |

### Research Phase
| ADR | Title | Description |
|-----|-------|-------------|
| [ADR-008](docs/decisions/adr-008-language-bug-prevention.md) | Language-Level Bug Prevention | Top 15 embedded bugs and prevention |
| [ADR-009](docs/decisions/adr-009-isr-safety.md) | ISR Safety | Safe interrupts without `unsafe` blocks |
| [ADR-010](docs/decisions/adr-010-c-interoperability.md) | C/C++ Interoperability | Unified ANTLR parser architecture |

## Build Commands

```bash
npm run build      # Full build: ANTLR + TypeScript
npm run antlr      # Regenerate parser from grammar
npx tsc            # TypeScript only
```

## Contributing

Ideas and feedback welcome via issues.

## License

MIT

## Acknowledgments

- The R community for proving `<-` works in practice
- MISRA C consortium for codifying embedded safety wisdom
- The TypeScript team for demonstrating gradual adoption works
- ANTLR for the parser infrastructure
