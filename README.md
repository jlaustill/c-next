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

scope LED {
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

### Scopes (ADR-016)

Organize code with automatic name prefixing. Inside scopes, explicit qualification is required:
- `this.X` for scope-local members
- `global.X` for global variables, functions, and registers

```cnx
const u8 LED_BIT <- 3;

scope LED {
    u8 brightness <- 100;

    void on() { global.GPIO7.DR_SET[global.LED_BIT] <- true; }
    void off() { global.GPIO7.DR_CLEAR[global.LED_BIT] <- true; }

    u8 getBrightness() { return this.brightness; }
}

// Call as:
LED.on();
LED.off();
```

Transpiles to:
```c
const uint8_t LED_BIT = 3;

static uint8_t LED_brightness = 100;

void LED_on(void) { GPIO7_DR_SET = (1 << LED_BIT); }
void LED_off(void) { GPIO7_DR_CLEAR = (1 << LED_BIT); }

uint8_t LED_getBrightness(void) { return LED_brightness; }
```

### Switch Statements (ADR-025)

Safe switch with MISRA compliance:
- Braces replace break (no colons needed)
- No fallthrough allowed
- Multiple cases with `||` syntax
- Counted `default(n)` for enum exhaustiveness

```cnx
enum EState { IDLE, RUNNING, STOPPED }

void handleState(EState state) {
    switch (state) {
        case EState.IDLE {
            startMotor();
        }
        case EState.RUNNING || EState.STOPPED {
            checkSensors();
        }
    }
}
```

Transpiles to:
```c
switch (state) {
    case EState_IDLE: {
        startMotor();
        break;
    }
    case EState_RUNNING:
    case EState_STOPPED: {
        checkSensors();
        break;
    }
}
```

### Ternary Operator (ADR-022)

Safe conditional expressions with MISRA compliance:
- Parentheses required around condition
- Condition must be boolean (comparison or logical)
- No nesting allowed (use if/else instead)

```cnx
u32 max <- (a > b) ? a : b;
u32 abs <- (x < 0) ? -x : x;
u32 result <- (a > 0 && b > 0) ? a : b;

// ERROR: Condition must be boolean
// u32 bad <- (x) ? 1 : 0;

// ERROR: Nested ternary not allowed
// i32 sign <- (x > 0) ? 1 : (x < 0) ? -1 : 0;
```

### Bounded Strings (ADR-045)

Safe, statically-allocated strings with compile-time capacity checking:

```cnx
string<64> name <- "Hello";           // 64-char capacity, transpiles to char[65]
string<128> message;                   // Empty string, initialized to ""
const string VERSION <- "1.0.0";       // Auto-sized to string<5>

// Properties
u32 len <- name.length;                // Runtime: strlen(name)
u32 cap <- name.capacity;              // Compile-time: 64

// Comparison - uses strcmp
if (name = "Hello") { }                // strcmp(name, "Hello") == 0

// Concatenation with capacity validation
string<32> first <- "Hello";
string<32> second <- " World";
string<64> result <- first + second;   // OK: 64 >= 32 + 32

// Substring extraction with bounds checking
string<5> greeting <- name[0, 5];      // First 5 chars
```

All operations are validated at compile time:
- Literal overflow → compile error
- Truncation on assignment → compile error
- Concatenation capacity mismatch → compile error
- Substring out of bounds → compile error

### Callbacks (ADR-029)

Type-safe function pointers with the Function-as-Type pattern:
- A function definition creates both a callable function AND a type
- Nominal typing: type identity is the function name, not just signature
- Never null: callbacks are always initialized to their default function

```cnx
// Define callback type with default behavior
void onReceive(const CAN_Message_T msg) {
    // default: no-op
}

struct Controller {
    onReceive _handler;    // Type is onReceive, initialized to default
}

// User implementation must match signature
void myHandler(const CAN_Message_T msg) {
    Serial.println(msg.id);
}

controller._handler <- myHandler;  // OK: signature matches
controller._handler(msg);          // Always safe - never null
```

Transpiles to:
```c
void onReceive(const CAN_Message_T msg) { }

typedef void (*onReceive_fp)(const CAN_Message_T);

struct Controller {
    onReceive_fp _handler;
};

// Initialization always sets to default
struct Controller Controller_init(void) {
    return (struct Controller){ ._handler = onReceive };
}
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
| [ADR-003](docs/decisions/adr-003-static-allocation.md) | Static Allocation | No dynamic memory after init |
| [ADR-004](docs/decisions/adr-004-register-bindings.md) | Register Bindings | Type-safe hardware access |
| [ADR-006](docs/decisions/adr-006-simplified-references.md) | Simplified References | Pass by reference, no pointer syntax |
| [ADR-007](docs/decisions/adr-007-type-aware-bit-indexing.md) | Type-Aware Bit Indexing | Integers as bit arrays, `.length` property |
| [ADR-010](docs/decisions/adr-010-c-interoperability.md) | C Interoperability | Unified ANTLR parser architecture |
| [ADR-011](docs/decisions/adr-011-vscode-extension.md) | VS Code Extension | Live C preview with syntax highlighting |
| [ADR-012](docs/decisions/adr-012-static-analysis.md) | Static Analysis | cppcheck integration for generated C |
| [ADR-013](docs/decisions/adr-013-const-qualifier.md) | Const Qualifier | Compile-time const enforcement |
| [ADR-014](docs/decisions/adr-014-structs.md) | Structs | Data containers without methods |
| [ADR-015](docs/decisions/adr-015-null-state.md) | Null State | Zero initialization for all variables |
| [ADR-016](docs/decisions/adr-016-scope.md) | Scope | `this.`/`global.` explicit qualification |
| [ADR-017](docs/decisions/adr-017-enums.md) | Enums | Type-safe enums with C-style casting |
| [ADR-030](docs/decisions/adr-030-forward-declarations.md) | Define-Before-Use | Functions must be defined before called |
| [ADR-037](docs/decisions/adr-037-preprocessor.md) | Preprocessor | Flag-only defines, const for values |
| [ADR-043](docs/decisions/adr-043-comments.md) | Comments | Comment preservation with MISRA compliance |
| [ADR-044](docs/decisions/adr-044-primitive-types.md) | Primitive Types | Fixed-width types with `clamp`/`wrap` overflow |
| [ADR-024](docs/decisions/adr-024-type-casting.md) | Type Casting | Widening implicit, narrowing uses bit indexing |
| [ADR-022](docs/decisions/adr-022-conditional-expressions.md) | Conditional Expressions | Ternary with required parens, boolean condition, no nesting |
| [ADR-025](docs/decisions/adr-025-switch-statements.md) | Switch Statements | Safe switch with braces, `\|\|` syntax, counted `default(n)` |
| [ADR-029](docs/decisions/adr-029-function-pointers.md) | Callbacks | Function-as-Type pattern with nominal typing |
| [ADR-045](docs/decisions/adr-045-string-type.md) | Bounded Strings | `string<N>` with compile-time safety |
| [ADR-023](docs/decisions/adr-023-sizeof.md) | Sizeof | Type/value size queries with safety checks |
| [ADR-027](docs/decisions/adr-027-do-while.md) | Do-While | `do { } while ()` with boolean condition (E0701) |
| [ADR-032](docs/decisions/adr-032-nested-structs.md) | Nested Structs | Named nested structs only (no anonymous) |
| [ADR-035](docs/decisions/adr-035-array-initializers.md) | Array Initializers | `[1, 2, 3]` syntax with `[0*]` fill-all |

### Accepted (Ready for Implementation)
| ADR | Title | Description |
|-----|-------|-------------|
| [ADR-034](docs/decisions/adr-034-bit-fields.md) | Bitmap Types | `bitmap8`/`bitmap16`/`bitmap32` for portable bit-packed data |
| [ADR-036](docs/decisions/adr-036-multidimensional-arrays.md) | Multi-dim Arrays | `arr[i][j]` with compile-time bounds enforcement |

### Research (v1 Roadmap)
| ADR | Title | Description |
|-----|-------|-------------|
| [ADR-040](docs/decisions/adr-040-isr-declaration.md) | ISR Declaration | Interrupt handler syntax |
| [ADR-041](docs/decisions/adr-041-inline-assembly.md) | Inline Assembly | Platform-specific asm |
| [ADR-046](docs/decisions/adr-046-prefixed-includes.md) | Prefixed Includes | Namespace control for includes |

### Foundational Research
| ADR | Title | Description |
|-----|-------|-------------|
| [ADR-008](docs/decisions/adr-008-language-bug-prevention.md) | Language-Level Bug Prevention | Top 15 embedded bugs and prevention |
| [ADR-009](docs/decisions/adr-009-isr-safety.md) | ISR Safety | Safe interrupts without `unsafe` blocks |

### Rejected
| ADR | Title | Description |
|-----|-------|-------------|
| [ADR-042](docs/decisions/adr-042-error-handling.md) | Error Handling | Works with existing features (enums, pass-by-reference, struct returns) |
| [ADR-039](docs/decisions/adr-039-null-safety.md) | Null Safety | Emergent from ADR-003 + ADR-006 + ADR-015; no additional feature needed |
| [ADR-020](docs/decisions/adr-020-size-type.md) | Size Type | Fixed-width types are more predictable than platform-sized |
| [ADR-019](docs/decisions/adr-019-type-aliases.md) | Type Aliases | Fixed-width primitives already solve the problem |
| [ADR-021](docs/decisions/adr-021-increment-decrement.md) | Increment/Decrement | Use `+<- 1` instead; separation of concerns |
| [ADR-002](docs/decisions/adr-002-namespaces.md) | Namespaces | Replaced by `scope` keyword (ADR-016) |
| [ADR-005](docs/decisions/adr-005-classes-without-inheritance.md) | Classes | Use structs + free functions instead (ADR-016) |
| [ADR-018](docs/decisions/adr-018-unions.md) | Unions | Use ADR-004 register bindings or explicit byte manipulation |
| [ADR-038](docs/decisions/adr-038-static-extern.md) | Static/Extern | Use `scope` for visibility; no `static` keyword in v1 |
| [ADR-026](docs/decisions/adr-026-break-continue.md) | Break/Continue | Use structured loop conditions instead |
| [ADR-028](docs/decisions/adr-028-goto.md) | Goto | Permanently rejected; use structured alternatives |
| [ADR-031](docs/decisions/adr-031-inline-functions.md) | Inline Functions | Trust compiler; `inline` is just a hint anyway |
| [ADR-033](docs/decisions/adr-033-packed-structs.md) | Packed Structs | Use ADR-004 register bindings or explicit serialization |

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
