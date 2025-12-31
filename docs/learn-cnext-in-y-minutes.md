# Learn C-Next in Y Minutes

C-Next is a safer C for embedded systems. It transpiles to clean, readable C code.

**Status Legend:**
- `[DONE]` - Implemented and working
- `[TODO]` - Planned for v1

## Comments [DONE]

```cnx
// Single-line comment (C99+ style, preserved in output)

/* Multi-line block comment
   spanning multiple lines */

/// Documentation comment - converts to Doxygen format
/// @param value The input parameter
/// @return The result

// Comments are preserved in generated C output!
```

### Doxygen Conversion

Triple-slash comments (`///`) are converted to Doxygen format:

```cnx
/// Calculate the square of a number
/// @param x The input value
/// @return x squared
u32 square(u32 x) {
    return x * x;
}
```

Generates:

```c
/**
 * Calculate the square of a number
 * @param x The input value
 * @return x squared
 */
uint32_t square(uint32_t* x) {
    return (*x) * (*x);
}
```

### MISRA C:2012 Compliance

C-Next enforces comment rules at transpile time:

```cnx
// ERROR: Nested comment markers (Rule 3.1)
// This has /* nested block */ markers    // Compile error!

// OK: URLs are allowed (Amendment 4 exception)
// See https://example.com/docs           // No error

// ERROR: Line-splice causes undefined behavior (Rule 3.2)
// Comment ending with backslash \        // Compile error!
```

## Preprocessor [DONE]

C-Next takes a safety-first approach to the preprocessor (ADR-037).

```cnx
// [DONE] Include directives - pass through to C
#include <stdint.h>      // Search system headers first (standard library)
#include <stdbool.h>     // Angle brackets for system/library headers
#include "myheader.h"    // Quotes search local directory first, then system

// [DONE] Flag-only defines - for conditional compilation
#define ARDUINO
#define DEBUG

// ERROR: Value defines are forbidden - use const instead!
// #define BUFFER_SIZE 256   // E0502: Use const u32 BUFFER_SIZE <- 256;

// ERROR: Function macros are forbidden - use inline functions!
// #define MAX(a, b) ...     // E0501: Use inline functions

// [DONE] Conditional compilation
#ifdef ARDUINO
#endif

#ifndef DEBUG
#else
#endif
```

### Why No `#define` with Values?

`#define` macros cause 5 of the 7 classic C preprocessor bugs:
- No type checking
- Operator precedence errors
- Multiple evaluation problems
- No scope (global namespace pollution)
- Debugger-invisible values

C-Next requires `const` for type-safe, scoped, debuggable constants.

### Bug Prevention Analysis

| Bug | Solved? | How |
|-----|---------|-----|
| 1. Operator Precedence | ✅ | No value macros allowed |
| 2. Multiple Evaluation | ✅ | No function macros allowed |
| 3. No Type Checking | ✅ | `const` is type-checked |
| 4. **No Scope** | ❌ | `#define FLAG` still global |
| 5. Swallowing the Semicolon | ✅ | No statement macros |
| 6. Control Flow Distortion | ✅ | No macro code blocks |
| 7. **Debugger Invisible** | ❌ | Flags can't be inspected |

**Why 2 bugs remain and why that's OK:**

- **No Scope (#4):** Flag-only defines like `#define ARDUINO` are meant for conditional compilation—a global concern. Platform flags *should* be visible everywhere. Use `const` inside a scope for scoped constants.

- **Debugger Invisible (#7):** Flags control which code compiles, not runtime values. They don't need runtime inspection. Use `const` for values you want to debug.

## Constants [DONE]

Constants in C-Next use `const` and `enum` - not `#define`.

### Const Variables (ADR-013)

```cnx
// Type-safe constants - preferred over #define
const u32 BUFFER_SIZE <- 256;
const u8 VERSION[] <- "1.0.0";
const f32 PI <- 3.14159;

// Const in function parameters
void process(const u8 data[]) {
    // data is read-only, use data.length for size
}
```

### Enumeration Constants (ADR-017)

```cnx
// Enums provide named integer constants
enum State {
    IDLE,           // 0
    RUNNING,        // 1
    ERROR <- 255    // Explicit value
};

State current <- State.IDLE;

if (current = State.RUNNING) {
    // ...
}

// Enums are type-safe - can't accidentally mix types
// u8 val <- State.IDLE;  // Error without explicit cast
u8 val <- (u8)State.IDLE;  // OK with cast
```

## Functions

```cnx
// [DONE] Function declaration
void doNothing() {
}

u32 add(const u32 a, const u32 b) {
    return a + b;
}

// [DONE] Parameters with const
void process(const u8 data[]) {
    // data is read-only, use data.length for size
}

// [DONE] Pass by reference (ADR-006) - structs passed by reference automatically
void updatePointXToTen(Point p) {
    p.x <- 10;  // Modifies original!
}
```

### Define-Before-Use [DONE]

C-Next enforces define-before-use with zero exceptions (ADR-030):

```cnx
// ERROR: Can't call function before it's defined
void first() {
    second();  // error[E0422]: function 'second' called before definition
}

void second() { }

// OK: Define helper functions first
void helper() {
    // do something
}

void main() {
    helper();  // OK - helper is defined above
}
```

**Why no forward declarations?**
- Catches errors at C-Next compile time, not C compile or runtime
- Forces logical code organization (dependencies first)
- Eliminates declaration/definition mismatch bugs
- No developer confusion about when to use forward declarations

**C Compatibility:** The transpiler generates `.h` files with prototypes for all functions, so the generated C code compiles correctly. This complexity is hidden from CNX developers.

### Parameters Are Always Named [DONE]

Per MISRA C:2012 Rule 8.2, all function parameters must have names:

```cnx
// OK: All parameters named
void process(u8 data[], u32 flags) {
    // use data.length for array size
}

// ERROR: Unnamed parameters not allowed
// void process(u8[], u32) { }  // Compile error
```

### Program Entry Point [DONE]

C-Next supports standard C entry points with a cleaner syntax:

```cnx
// Embedded style (no command line args)
i32 main() {
    return 0;
}

// CLI style with command line arguments
#include <stdio.h>

i32 main(u8 args[][]) {
    printf("Program: %s\n", args[0]);
    printf("Arg count: %d\n", args.length);
    return 0;
}
```

The `args` parameter provides:
- `args[n]` - Access the nth argument string
- `args.length` - Get the argument count (like argc)

Transpiles to standard C:
```c
int main(int argc, char *argv[]) {
    printf("Program: %s\n", argv[0]);
    printf("Arg count: %d\n", argc);
    return 0;
}
```

For Arduino/embedded frameworks, use `setup()` and `loop()` as usual:
```cnx
void setup() {
    pinMode(LED_PIN, OUTPUT);
}

void loop() {
    LED.toggle();
    delay(1000);
}
```

## Types

```cnx
// [DONE] Fixed-width integers (no platform surprises)
u8  byte;       // uint8_t
u16 word;       // uint16_t
u32 dword;      // uint32_t
u64 qword;      // uint64_t

i8  sbyte;      // int8_t
i16 sword;      // int16_t
i32 sdword;     // int32_t
i64 sqword;     // int64_t

// [DONE] Floating point
f32 single;     // float
f64 double;    // double

// [DONE] Boolean
bool flag;      // bool (from stdbool.h)
```

### Overflow Behavior [DONE]

C-Next provides explicit control over integer overflow behavior (ADR-044):

```cnx
// [DONE] clamp - Saturating arithmetic (safe default)
clamp u8 brightness <- 200;
brightness +<- 100;  // Clamps to 255, not 44!

// [DONE] wrap - Two's complement wrapping (opt-in for counters)
wrap u32 counter <- 0;
counter +<- 1;       // Wraps naturally at UINT32_MAX

// No modifier = clamp (safe default)
u16 temperature <- 0;
temperature -<- 100; // Clamps to 0, not 65436!
```

**Why per-variable?** Different use cases need different behavior:
- **Sensors/PWM**: Clamping prevents wraparound glitches
- **Counters/Timers**: Wrapping is the intended behavior
- **Default safe**: Unmarked variables use saturating arithmetic

Generated C uses inline helper functions:
```c
static inline uint8_t cnx_clamp_add_u8(uint8_t a, uint8_t b) {
    if (a > UINT8_MAX - b) return UINT8_MAX;
    return a + b;
}

brightness = cnx_clamp_add_u8(brightness, 100);  // clamp variable
counter += 1;                                      // wrap variable
```

**Debug mode:** Compile with `--debug` to generate panic-on-overflow helpers:
```bash
cnx --debug myfile.cnx -o myfile.c
```
This replaces clamp helpers with abort() calls for catching overflow during development.

## Variables

```cnx
// [DONE] Variables are zero-initialized by default (ADR-015)
u32 counter;    // counter = 0, not garbage!

// [DONE] Assignment uses <- (ADR-001)
counter <- 42;

// [TODO: ADR-038] Static and extern
static u32 filePrivate <- 0;
extern u32 globalVar;
```

## Operators

```cnx
// [DONE] Arithmetic
x <- a + b;
x <- a - b;
x <- a * b;
x <- a / b;
x <- a % b;

// [DONE] Comparison - IMPORTANT: = is equality, not assignment!
if (a = b) { }      // Equal (not ==)
if (a != b) { }     // Not equal
if (a < b) { }      // Less than
if (a <= b) { }     // Less or equal
if (a > b) { }      // Greater than
if (a >= b) { }     // Greater or equal

// [DONE] Logical
if (a && b) { }     // AND
if (a || b) { }     // OR
if (!a) { }         // NOT

// [DONE] Bitwise
x <- a & b;         // AND
x <- a | b;         // OR
x <- a ^ b;         // XOR
x <- ~a;            // NOT
x <- a << 2;        // Left shift
x <- a >> 2;        // Right shift

// [DONE] Compound assignment
x +<- 1;            // x = x + 1
x -<- 1;            // x = x - 1
x *<- 2;            // x = x * 2
x /<- 2;            // x = x / 2
x &<- mask;         // x = x & mask
x |<- flags;        // x = x | flags
x ^<- bits;         // x = x ^ bits
x <<<- 1;           // x = x << 1
x >><- 1;           // x = x >> 1

// [TODO: ADR-021] Increment/decrement
i++;                // Statement only, not in expressions
i--;

// [TODO: ADR-022] Ternary
u32 max <- (a > b) ? a : b;

// [TODO: ADR-023] Sizeof
usize size <- sizeof(u32);

// [TODO: ADR-024] Type casting
u8 byte <- value as u8;
```

## Control Flow

```cnx
// [DONE] If/else
if (x > 0) {
    doSomething();
} else if (x < 0) {
    doOther();
} else {
    doDefault();
}

// [DONE] While loop
while (running) {
    process();
}

// [DONE] For loop
for (u32 i <- 0; i < 10; i +<- 1) {
    buffer[i] <- 0;
}

// [TODO: ADR-027] Do-while
do {
    byte <- readByte();
} while (byte != END_MARKER);

// [TODO: ADR-025] Switch (implicit break!)
switch (state) {
    case State.IDLE: {
        startMotor();
    }   // Implicit break - no fall-through by default!
    case State.RUNNING: {
        checkSensors();
    }
    case State.STOPPING:
    fallthrough;        // Explicit fall-through
    case State.STOPPED: {
        cleanup();
    }
    default: {
        handleError();
    }
}

// [TODO: ADR-026] Break and continue
while (true) {
    if (done) { break; }
    if (skip) { continue; }
    process();
}
```

## Arrays

```cnx
// [DONE] Fixed-size arrays
u8 buffer[256];

// [DONE] Array access
buffer[0] <- 0xFF;
u8 first <- buffer[0];

// [DONE] .length property (ADR-007)
usize len <- buffer.length;  // 256

// [TODO: ADR-035] Array initialization
u8 data[] <- {1, 2, 3, 4, 5};
u8 zeros[100] <- {0};

// [TODO: ADR-036] Multi-dimensional arrays
u8 matrix[4][4];
matrix[0][0] <- 1;
```

## Bit Manipulation

```cnx
// [DONE] Type-aware bit indexing (ADR-007)
u8 flags <- 0;

flags[0] <- true;           // Set bit 0
flags[3] <- true;           // Set bit 3
bool isSet <- flags[0];     // Read bit 0

flags[4, 3] <- 5;           // Set 3 bits starting at bit 4
u8 field <- flags[4, 3];    // Read 3-bit field

// .length on integers gives bit width
u8 width8 <- flags.length;  // 8
u32 width32 <- counter.length;  // 32
```

## Structs

```cnx
// [DONE] Struct declaration (ADR-014)
struct Point {
    i32 x;
    i32 y;
}

// [DONE] Zero-initialized by default (ADR-015)
Point origin;  // x=0, y=0

// [DONE] Designated initializer
Point p <- Point { x: 10, y: 20 };

// [DONE] Member access
p.x <- 100;
i32 y <- p.y;

// [DONE] Inferred initializer
Point q <- { x: 5, y: 10 };

// [DONE] Struct with array member
struct Buffer {
    u8 data[64];
    u32 length;
}

// [TODO: ADR-032] Nested structs
struct Rectangle {
    Point topLeft;
    Point bottomRight;
}

// [TODO: ADR-033] Packed struct
@packed
struct TCPHeader {
    u16 srcPort;
    u16 dstPort;
    u32 seqNum;
}
```

## Unions

```cnx
// [TODO: ADR-018] Unions
union Converter {
    u32 asU32;
    f32 asFloat;
    u8 bytes[4];
}

Converter c;
c.asFloat <- 3.14;
u32 bits <- c.asU32;  // Type punning
```

## Register Bindings

```cnx
// [DONE] Type-safe hardware access (ADR-004)
register GPIO7 @ 0x42004000 {
    DR:         u32 rw @ 0x00,    // Read-Write
    GDIR:       u32 rw @ 0x04,    // Direction
    PSR:        u32 ro @ 0x08,    // Read-Only status
    DR_SET:     u32 wo @ 0x84,    // Write-Only atomic set
    DR_CLEAR:   u32 wo @ 0x88,    // Write-Only atomic clear
    DR_TOGGLE:  u32 wo @ 0x8C,    // Write-Only atomic toggle
}

// [DONE] Access registers
u32 data <- GPIO7.DR;           // Read
GPIO7.DR <- 0xFF;               // Write

// [DONE] Bit manipulation on registers
GPIO7.DR_SET[3] <- true;        // Set bit 3 (atomic)
GPIO7.DR_CLEAR[3] <- true;      // Clear bit 3 (atomic)
GPIO7.DR_TOGGLE[3] <- true;     // Toggle bit 3 (atomic)

// [DONE] Write-only optimization
// GPIO7.DR_SET[3] <- true generates:
//   GPIO7_DR_SET = (1 << 3);
// No read-modify-write for atomic registers!
```

## Scopes

```cnx
// [DONE] Organize code with automatic name prefixing (ADR-016)
scope LED {
    const u32 BIT <- 3;

    void on() {
        GPIO7.DR_SET[BIT] <- true;
    }

    void off() {
        GPIO7.DR_CLEAR[BIT] <- true;
    }

    void toggle() {
        GPIO7.DR_TOGGLE[BIT] <- true;
    }
}

// Usage: dot syntax
LED.on();
LED.off();
LED.toggle();

// Generates:
// void LED_on(void) { GPIO7_DR_SET = (1 << 3); }
// void LED_off(void) { GPIO7_DR_CLEAR = (1 << 3); }
// void LED_toggle(void) { GPIO7_DR_TOGGLE = (1 << 3); }
```

## Instance Pattern (C-Style OOP)

```cnx
// [DONE] Data in structs, behavior in free functions
struct UART {
    u32 baseAddress;
    u32 baudRate;
}

void UART_init(UART self, u32 base, u32 baud) {
    self.baseAddress <- base;
    self.baudRate <- baud;
}

void UART_send(UART self, u8 data) {
    // Write to TX register
}

u8 UART_receive(UART self) {
    // Read from RX register
    return 0;
}

// Usage
UART uart1;
UART_init(uart1, 0x40011000, 115200);
UART_send(uart1, 'H');
```

## Complete Example

```cnx
// blink.cnx - LED Blink for Teensy 4.x
#include <Arduino.h>
#include <stdint.h>
#include <stdbool.h>

// Hardware configuration
register GPIO7 @ 0x42004000 {
    DR:         u32 rw @ 0x00,
    GDIR:       u32 rw @ 0x04,
    DR_SET:     u32 wo @ 0x84,
    DR_CLEAR:   u32 wo @ 0x88,
    DR_TOGGLE:  u32 wo @ 0x8C,
}

// Configuration
const u32 LED_PIN <- 13;
const u32 LED_BIT <- 3;
const u32 BLINK_DELAY_MS <- 1000;

// LED control
scope LED {
    void on() {
        GPIO7.DR_SET[LED_BIT] <- true;
    }

    void off() {
        GPIO7.DR_CLEAR[LED_BIT] <- true;
    }

    void toggle() {
        GPIO7.DR_TOGGLE[LED_BIT] <- true;
    }
}

// Arduino entry points
void setup() {
    pinMode(LED_PIN, OUTPUT);
}

void loop() {
    LED.toggle();
    delay(BLINK_DELAY_MS);
}
```

## Generated C

The above transpiles to clean, readable C:

```c
#include <Arduino.h>
#include <stdint.h>
#include <stdbool.h>

#define GPIO7_DR         (*(volatile uint32_t*)(0x42004000 + 0x00))
#define GPIO7_GDIR       (*(volatile uint32_t*)(0x42004000 + 0x04))
#define GPIO7_DR_SET     (*(volatile uint32_t*)(0x42004000 + 0x84))
#define GPIO7_DR_CLEAR   (*(volatile uint32_t*)(0x42004000 + 0x88))
#define GPIO7_DR_TOGGLE  (*(volatile uint32_t*)(0x42004000 + 0x8C))

const uint32_t LED_PIN = 13;
const uint32_t LED_BIT = 3;
const uint32_t BLINK_DELAY_MS = 1000;

void LED_on(void) {
    GPIO7_DR_SET = (1 << LED_BIT);
}

void LED_off(void) {
    GPIO7_DR_CLEAR = (1 << LED_BIT);
}

void LED_toggle(void) {
    GPIO7_DR_TOGGLE = (1 << LED_BIT);
}

void setup(void) {
    pinMode(LED_PIN, OUTPUT);
}

void loop(void) {
    LED_toggle();
    delay(BLINK_DELAY_MS);
}
```

## Key Differences from C

| C | C-Next | Why |
|---|--------|-----|
| `x = 5` | `x <- 5` | Assignment is explicit flow |
| `x == 5` | `x = 5` | Equality uses mathematical = |
| `int`, `long` | `i32`, `i64` | Fixed widths, no surprises |
| `ptr->field` | `ptr.field` | No arrow operator |
| `*ptr` | Implicit | Simplified references |
| Manual init | Zero by default | No uninitialized variables |
| `namespace {}` | `scope {}` | Organization with prefixing |
| Forward decl | Define first | Errors caught early (E0422) |

## Further Reading

- [Architecture Decision Records](docs/decisions/)
- [v1 Feature Matrix](docs/plans/v1-feature-matrix.md)
- [GitHub Repository](https://github.com/jlaustill/c-next)
