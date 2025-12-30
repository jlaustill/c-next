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

## Enums [DONE]

```cnx
enum State {
    IDLE,           // 0
    RUNNING,        // 1
    ERROR <- 255    // Explicit value
}

State current <- State.IDLE;

if (current = State.RUNNING) {
    // ...
}
```

## Includes

```cnx
// [DONE] Pass-through to C
#include <stdint.h>
#include <stdbool.h>
#include "myheader.h"

// [TODO: ADR-037] Preprocessor directives
#define BUFFER_SIZE 256
#ifdef DEBUG
    // debug code
#endif
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
f64 double_;    // double

// [DONE] Boolean
bool flag;      // bool (from stdbool.h)

// [TODO: ADR-020] Size types
usize length;   // size_t (platform-dependent)
isize offset;   // ptrdiff_t
```

## Variables and Constants

```cnx
// [DONE] Variables are zero-initialized by default (ADR-015)
u32 counter;    // counter = 0, not garbage!

// [DONE] Assignment uses <- (ADR-001)
counter <- 42;

// [DONE] Constants
const u32 MAX_SIZE <- 1024;

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

## Functions

```cnx
// [DONE] Function declaration
void doNothing() {
}

u32 add(u32 a, u32 b) {
    return a + b;
}

// [DONE] Parameters with const
void process(const u8 data[], usize length) {
    // data is read-only
}

// [DONE] Pass by reference (ADR-006) - structs passed by reference automatically
void updatePoint(Point p) {
    p.x <- 10;  // Modifies original!
}

// [TODO: ADR-030] Forward declarations
void laterFunction(u32 param);

// [TODO: ADR-031] Inline functions
inline u32 square(u32 x) {
    return x * x;
}

// [TODO: ADR-029] Function pointers
type Callback <- void(u32 event);

Callback handler <- myHandler;
handler(42);
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

## Further Reading

- [Architecture Decision Records](docs/decisions/)
- [v1 Feature Matrix](docs/plans/v1-feature-matrix.md)
- [GitHub Repository](https://github.com/jlaustill/c-next)
