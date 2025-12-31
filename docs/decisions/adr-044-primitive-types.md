# ADR-044: Primitive Types

**Status:** Accepted
**Date:** 2025-12-30
**Decision Makers:** C-Next Language Design Team

## Context

C-Next needs well-defined primitive types that:

1. **Guarantee fixed widths** - Unlike C's `int` which varies by platform (16-bit on AVR, 32-bit on ARM)
2. **Map cleanly to C99 stdint.h types** - For interoperability and portability
3. **Support embedded systems** - Where knowing exact memory layouts is critical
4. **Enable type-aware features** - Like `.length` for bit width (ADR-007)

### The Problem with C's Built-in Types

```c
// C type sizes are platform-dependent
int value;       // 16 bits on AVR, 32 bits on ARM
long data;       // 32 bits on most 32-bit, 64 bits on many 64-bit systems
```

This causes real bugs when code moves between microcontrollers or when data structures are serialized.

---

## Research: How Other Languages Handle This

### Rust

Rust uses explicit-width types as the default:

```rust
let x: i32 = 42;     // Always 32-bit signed
let y: u8 = 255;     // Always 8-bit unsigned
let z: f64 = 3.14;   // Always 64-bit float
```

Rust also has `isize` and `usize` for pointer-sized integers.

### Zig

Zig follows a similar pattern with explicit widths:

```zig
const x: i32 = 42;
const y: u8 = 255;
const z: f64 = 3.14;
```

Zig also supports arbitrary bit-width integers like `u3`, `i17`, etc.

### C99 with stdint.h

C99 added fixed-width types via `<stdint.h>`:

```c
#include <stdint.h>
int32_t x = 42;
uint8_t y = 255;
```

This is widely supported but requires explicit includes.

---

## Decision

### Primitive Type Mappings

CNX provides fixed-width types that transpile to C99 stdint.h types:

| CNX Type | C Type | Description |
|----------|--------|-------------|
| `u8` | `uint8_t` | 8-bit unsigned integer |
| `u16` | `uint16_t` | 16-bit unsigned integer |
| `u32` | `uint32_t` | 32-bit unsigned integer |
| `u64` | `uint64_t` | 64-bit unsigned integer |
| `i8` | `int8_t` | 8-bit signed integer |
| `i16` | `int16_t` | 16-bit signed integer |
| `i32` | `int32_t` | 32-bit signed integer |
| `i64` | `int64_t` | 64-bit signed integer |
| `f32` | `float` | 32-bit floating point |
| `f64` | `double` | 64-bit floating point |
| `bool` | `bool` | Boolean (stdbool.h) |

### Usage Examples

```cnx
// Integer types
u8 byte <- 255;
i32 counter <- -100;
u64 bigNumber <- 0xFFFFFFFFFFFFFFFF;

// Floating point
f32 temperature <- 23.5;
f64 preciseValue <- 3.141592653589793;

// Boolean
bool isReady <- true;
bool hasData <- false;
```

### Generated C

```c
#include <stdint.h>
#include <stdbool.h>

uint8_t byte = 255;
int32_t counter = -100;
uint64_t bigNumber = 0xFFFFFFFFFFFFFFFF;

float temperature = 23.5f;
double preciseValue = 3.141592653589793;

bool isReady = true;
bool hasData = false;
```

### The .length Property

As defined in ADR-007, all primitive types expose their bit width via `.length`:

```cnx
u8 flags <- 0;
u32 data <- 0;

u32 flagBits <- flags.length;   // 8
u32 dataBits <- data.length;    // 32
```

**Generated C:**

```c
uint8_t flags = 0;
uint32_t data = 0;

uint32_t flagBits = 8;   // Compile-time constant
uint32_t dataBits = 32;  // Compile-time constant
```

---

## Design Decisions

### No Implicit Type Coercion

CNX does not allow implicit narrowing conversions:

```cnx
u32 big <- 1000;
u8 small <- big;     // ERROR: Cannot implicitly convert u32 to u8

u8 small <- (u8)big;  // OK: Explicit cast (see ADR-024)
```

This prevents subtle truncation bugs common in C.

### Integer Literals

Integer literals default to the smallest type that fits the context, or `i32` when unspecified:

```cnx
u8 a <- 42;          // 42 fits in u8, OK
u8 b <- 256;         // ERROR: 256 doesn't fit in u8
i32 c <- 42;         // Default to i32
```

### Floating Point Literals

Floating point literals default to `f64` unless explicitly typed:

```cnx
f32 temp <- 23.5;    // OK: f64 literal narrowed to f32 (loses precision)
f64 precise <- 23.5; // OK: f64 literal assigned to f64
```

### Integer Overflow Behavior

See **Research: Integer Overflow** section below for the full decision.

**Summary:** CNX uses per-variable overflow semantics with `clamp` (default) and `wrap` keywords:

```cnx
clamp u16 sensorValue <- 0;  // Saturates at boundaries (safe default)
wrap u32 counter <- 0;       // Two's complement wrap (opt-in)
u8 normal <- 0;              // Default: clamp
```

Use `--debug` flag to panic on any overflow during development.

---

## Research: Integer Overflow

Integer overflow is a major source of bugs in embedded systems. This section documents real-world failures, how other languages handle overflow, and options for CNX.

### Real-World Disasters

| Incident | Cause | Consequence |
|----------|-------|-------------|
| **Ariane 5 (1996)** | 64-bit float to 16-bit signed integer overflow | Rocket destroyed 37 seconds after launch, $370M loss |
| **Therac-25 (1985-87)** | Arithmetic overflow + no hardware safety | 6 deaths from radiation overdoses |
| **Boeing 787 (2015)** | 32-bit signed counter after 248 days | FAA ordered periodic resets to prevent power loss |
| **WhatsApp (2022)** | CVE-2022-36934 integer overflow | Remote code execution during video calls |

Integer overflow ranked **#14 in CWE Top 25** most dangerous software weaknesses (2023).

> "The software had been considered bug-free since it had been used in many previous flights, but those used smaller rockets which generated lower acceleration than Ariane 5."
> — [Wikipedia: Integer Overflow](https://en.wikipedia.org/wiki/Integer_overflow)

### C's Undefined Behavior Problem

In C, signed integer overflow is **undefined behavior**. This means:

1. The compiler assumes it **cannot happen**
2. Overflow checks can be **optimized away**
3. Code that worked in older compilers may **silently break** in newer ones

```c
// This "overflow check" gets REMOVED by modern compilers!
if (a + 1 < a) {
    handle_overflow();  // DELETED - compiler assumes this is dead code
}
```

Why compilers do this:
- **Performance**: 30-50% speedup in tight loops when exploiting signed overflow UB
- **Standard compliance**: C standard says signed overflow is undefined

> "When GCC's developers changed their compiler in 2008 such that it omitted certain overflow checks that relied on undefined behavior, CERT issued a warning against the newer versions of the compiler."
> — [A Guide to Undefined Behavior in C](https://blog.regehr.org/archives/213)

**Unsigned integers** wrap predictably (two's complement), but this silent wrapping can still cause bugs.

### How Other Languages Handle Overflow

| Language | Debug Mode | Release Mode | Explicit Control |
|----------|------------|--------------|------------------|
| **C** | Undefined (signed), Wrap (unsigned) | Same | `-fwrapv` flag |
| **Rust** | Panic | Wrap | `checked_*`, `wrapping_*`, `saturating_*` |
| **Zig** | Panic | Panic | `+%`, `-%`, `*%` wrapping operators |
| **Swift** | Trap (crash) | Trap (crash) | `&+`, `&-`, `&*` overflow operators |
| **Ada/SPARK** | Constraint_Error | Configurable | Range types, preconditions |

#### Rust's Approach

Rust provides **different behavior per build mode** plus explicit methods:

```rust
let a: u8 = 255;

// Debug mode: panics
// Release mode: wraps to 0
let b = a + 1;

// Explicit control (works same in all modes):
let c = a.wrapping_add(1);     // 0 - always wraps
let d = a.saturating_add(1);   // 255 - clamps to max
let e = a.checked_add(1);      // None - returns Option
let (f, overflow) = a.overflowing_add(1);  // (0, true)
```

> "When compiling in release mode with the --release flag, Rust does not include checks for integer overflow that cause panics. Instead, if overflow occurs, Rust performs two's complement wrapping."
> — [Rust Book: Data Types](https://doc.rust-lang.org/book/ch03-02-data-types.html)

#### Zig's Approach

Zig treats overflow as **illegal by default** in all builds:

```zig
var a: u8 = 255;
a = a + 1;    // Runtime panic! (illegal overflow)

a = a +% 1;   // OK: wrapping add, result is 0
```

> "In Zig both signed and unsigned integers have illegal behavior on overflow, contrasted to only signed integers in C."
> — [Zig Guide: Integer Rules](https://zig.guide/language-basics/integer-rules/)

#### Swift's Approach

Swift **always traps** on overflow (cannot be caught):

```swift
var a: UInt8 = 255
a = a + 1     // Fatal error: crash

a = a &+ 1   // OK: overflow operator, wraps to 0
```

> "In Swift, arithmetic operators do not overflow or underflow by default... the result is a crash."
> — [Apple: Integer Overflow](https://developer.apple.com/documentation/xcode/integer-overflow)

#### Ada/SPARK's Approach

Ada raises an exception; SPARK can **prove at compile-time** that overflow is impossible:

```ada
X : Integer := Integer'Last;
X := X + 1;  -- Raises Constraint_Error at runtime

-- SPARK can prove this is safe with preconditions:
procedure Increment(X : in out Integer)
  with Pre => X < Integer'Last;
```

> "GNATprove can be used to demonstrate statically that none of these errors can ever occur at runtime."
> — [AdaCore: Proof of Program Integrity](https://learn.adacore.com/courses/intro-to-spark/chapters/03_Proof_Of_Program_Integrity.html)

### MISRA C Guidelines

MISRA C treats signed overflow as a critical issue:

- **Rule 1.3**: "There shall be no occurrence of undefined or critical unspecified behaviour"
- **Signed overflow**: Undefined behavior (violation)
- **Unsigned overflow**: Well-defined wrap, but flagged in constant expressions

> "Appendix H of MISRA:C 2012 lists hundreds of cases of undefined and critical unspecified behavior in the C programming language standard."
> — [SPARK for the MISRA C Developer](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/07_undefined_behavior.html)

### Decision: Per-Variable Overflow Semantics

CNX takes a unique approach: **overflow behavior is declared per-variable** using keywords, with a safe default.

#### Syntax

```cnx
// Explicit overflow behavior at declaration (keyword before type)
clamp u16 egtTemp <- 0;      // Saturates at 0 and 65535
wrap u32 cycleCounter <- 0;  // Wraps intentionally (two's complement)
u8 normalVar <- 0;           // Default: clamp (safe)
```

#### Keywords

| Keyword | Behavior | Use Case |
|---------|----------|----------|
| `clamp` | Saturates at min/max of type | Sensor readings, control values, safety-critical |
| `wrap` | Two's complement wrap-around | Counters, checksums, timing, hashing |
| (none) | Default to `clamp` | Most variables |

#### Rationale

1. **Intent is documented at declaration** - Code is self-documenting
2. **Default to safe (clamp)** - Must opt-in to dangerous wrap behavior
3. **No hidden surprises** - Behavior is explicit and predictable
4. **Matches embedded reality** - Different variables genuinely need different behavior

#### Why Clamp is the Default

From [MATLAB Fixed-Point documentation](https://www.mathworks.com/help/fixedpoint/ug/saturation-and-wrapping.html):
> "For most control applications, **saturation is the safer way** of dealing with fixed-point overflow."

The disasters (Ariane 5, Therac-25, Boeing 787) were all **wrap-around bugs**:
- EGT sensor: 65535 + 1 = **0** with wrap (reads "cold" - engine melts)
- EGT sensor: 65535 + 1 = **65535** with clamp (reads "max hot" - safe)

#### Debug Mode: `--debug` Flag

When compiled with `--debug`, **all** arithmetic operations panic on overflow regardless of `clamp`/`wrap` keywords:

```cnx
clamp u8 temp <- 255;
temp <- temp + 1;    // Normal: clamps to 255
                     // --debug: PANIC! Overflow detected
```

This catches bugs during development before they matter in production.

#### Examples

```cnx
// Safety-critical: exhaust gas temperature (clamp is explicit but matches default)
clamp u16 egtTemp <- 0;
egtTemp <- egtTemp + 100;  // If at 65535, stays at 65535

// Intentional wrap: CPU cycle counter for timing
wrap u32 cycleCount <- 0;
cycleCount <- cycleCount + 1;  // At 0xFFFFFFFF, wraps to 0

// Default behavior (clamp): most variables
u8 brightness <- 200;
brightness <- brightness + 100;  // Clamps to 255, not 44
```

#### Generated C

```c
// clamp u16 egtTemp <- 0;
uint16_t egtTemp = 0;

// egtTemp <- egtTemp + 100;
egtTemp = cnx_clamp_add_u16(egtTemp, 100);

// wrap u32 cycleCount <- 0;
uint32_t cycleCount = 0;

// cycleCount <- cycleCount + 1;
cycleCount = (uint32_t)(cycleCount + 1);  // Natural wrap

// With --debug flag, ALL operations become:
// cnx_debug_add_u16(egtTemp, 100);  // Panics on overflow
```

#### Helper Macros (Generated)

```c
// Saturating addition for u16
static inline uint16_t cnx_clamp_add_u16(uint16_t a, uint16_t b) {
    uint16_t result = a + b;
    if (result < a) return UINT16_MAX;  // Overflow detected
    return result;
}

// Debug mode: panic on any overflow
static inline uint16_t cnx_debug_add_u16(uint16_t a, uint16_t b) {
    if (a > UINT16_MAX - b) {
        cnx_panic("Integer overflow");
    }
    return a + b;
}
```

#### Trade-offs

**Advantages:**
- Intent is always clear at declaration
- Safe default prevents catastrophic wrap bugs
- Explicit `wrap` keyword documents intentional wrapping
- Debug mode catches all overflow bugs during development
- More expressive than any other language surveyed

**Disadvantages:**
- Slight runtime cost for clamp checks (mitigated by compiler optimization)
- New syntax for C programmers to learn
- Generated C is more verbose

---

## Platform-Specific Considerations

### 8-bit Microcontrollers (AVR)

On 8-bit platforms, 64-bit types may be emulated in software. CNX should:
1. Allow their use (for portability)
2. Warn about performance implications
3. Never silently fail

---

## Trade-offs

### Advantages

1. **Portability** - Code works identically across platforms
2. **Clarity** - Type size is obvious from the name
3. **Safety** - No surprise narrowing or widening
4. **Interoperability** - Clean mapping to C99 types

### Disadvantages

1. **Unfamiliar syntax** - `u32` vs `int` looks different to C programmers
2. **Learning curve** - C programmers must adapt
3. **No "native" int** - Can't get optimal register-sized type

---

## Interaction with Other Features

### Bit Indexing (ADR-007)

Bit width is known from the type:

```cnx
u8 flags <- 0;
flags[7] <- true;    // OK: bit 7 exists in u8
flags[8] <- true;    // ERROR: u8 only has bits 0-7
```

### Type Casting (ADR-024)

Explicit casts between numeric types:

```cnx
i32 signed <- -42;
u32 unsigned <- (u32)signed;   // Explicit cast required
```

### Arrays

Array element types are explicit:

```cnx
u8 buffer[256];      // 256-byte buffer
i32 values[10];      // 10 32-bit integers
```

---

## Implementation Notes

### Required C Headers

The transpiler must emit:

```c
#include <stdint.h>   // For uint8_t, int32_t, etc.
#include <stdbool.h>  // For bool, true, false
```

### Type Width Tracking

The code generator maintains a type registry for `.length` support:

```typescript
const TYPE_WIDTH: Record<string, number> = {
    'u8': 8, 'i8': 8,
    'u16': 16, 'i16': 16,
    'u32': 32, 'i32': 32,
    'u64': 64, 'i64': 64,
    'f32': 32, 'f64': 64,
    'bool': 1,
};
```

---

## Success Criteria

1. All primitive types transpile to correct C99 types
2. `.length` returns correct bit width for all types
3. No implicit narrowing conversions allowed
4. `<stdint.h>` and `<stdbool.h>` are automatically included when needed
5. Type errors caught at compile time, not runtime
6. `clamp` keyword generates saturating arithmetic
7. `wrap` keyword generates natural two's complement wrap
8. Default (no keyword) behaves as `clamp`
9. `--debug` flag causes panic on any overflow

---

## References

### Type Systems
- [C99 stdint.h specification](https://en.cppreference.com/w/c/types/integer)
- [Rust primitive types](https://doc.rust-lang.org/book/ch03-02-data-types.html)
- [Zig primitive types](https://ziglang.org/documentation/master/#Primitive-Types)
- [MISRA C: Type rules](https://www.misra.org.uk/)

### Integer Overflow
- [Wikipedia: Integer Overflow](https://en.wikipedia.org/wiki/Integer_overflow) - Ariane 5, Therac-25, Boeing 787 cases
- [CWE-190: Integer Overflow or Wraparound](https://cwe.mitre.org/data/definitions/190.html)
- [A Guide to Undefined Behavior in C](https://blog.regehr.org/archives/213)
- [Compilers Exploiting Signed Overflow](https://gist.github.com/rygorous/e0f055bfb74e3d5f0af20690759de5a7)

### Language Approaches
- [Rust: Overflow Behavior](https://www.slingacademy.com/article/exploring-rusts-overflow-behavior-wrapping-saturating-and-panicking/)
- [Zig: Integer Rules](https://zig.guide/language-basics/integer-rules/)
- [Swift: Integer Overflow](https://developer.apple.com/documentation/xcode/integer-overflow)
- [Ada/SPARK: Proof of Program Integrity](https://learn.adacore.com/courses/intro-to-spark/chapters/03_Proof_Of_Program_Integrity.html)
- [SPARK for the MISRA C Developer](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/07_undefined_behavior.html)

### Related ADRs
- ADR-007: Type-Aware Bit Indexing
- ADR-024: Type Casting
