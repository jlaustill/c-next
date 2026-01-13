# Learn C-Next in Y Minutes

C-Next is a safer C for embedded systems. It transpiles to clean, readable C code.

**Status Legend:**

- `[DONE]` - Implemented and working
- `[ACCEPTED]` - Design accepted, ready for implementation
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

| Bug                         | Solved? | How                         |
| --------------------------- | ------- | --------------------------- |
| 1. Operator Precedence      | ✅      | No value macros allowed     |
| 2. Multiple Evaluation      | ✅      | No function macros allowed  |
| 3. No Type Checking         | ✅      | `const` is type-checked     |
| 4. **No Scope**             | ❌      | `#define FLAG` still global |
| 5. Swallowing the Semicolon | ✅      | No statement macros         |
| 6. Control Flow Distortion  | ✅      | No macro code blocks        |
| 7. **Debugger Invisible**   | ❌      | Flags can't be inspected    |

**Why 2 bugs remain and why that's OK:**

- **No Scope (#4):** Flag-only defines like `#define ARDUINO` are meant for conditional compilation—a global concern. Platform flags _should_ be visible everywhere. Use `const` inside a scope for scoped constants.

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

### Type Casting [DONE]

C-Next takes a safety-first approach to type conversions (ADR-024):

```cnx
// Literal range validation - values must fit in target type
u8 ok <- 255;      // OK: 255 fits in u8 (0-255)
// u8 bad <- 256;  // ERROR: 256 exceeds u8 range

// Widening conversions (implicit, always safe)
u8 small <- 42;
u16 medium <- small;  // u8 → u16: safe
u32 large <- medium;  // u16 → u32: safe
u64 huge <- large;    // u32 → u64: safe

// Narrowing conversions (FORBIDDEN - use bit indexing)
u32 bigValue <- 0xDEADBEEF;
// u8 byte <- bigValue;        // ERROR: narrowing forbidden
u8 lowByte <- bigValue[0, 8];  // OK: explicit bit extraction

// Sign conversions (FORBIDDEN - use bit indexing)
i32 signedVal <- -100;
// u32 unsigned <- signedVal;    // ERROR: sign change forbidden
u32 asBits <- signedVal[0, 32];  // OK: explicit reinterpret

// Cast expressions follow same rules
// u8 x <- (u8)bigValue;   // ERROR: narrowing cast forbidden
// u32 y <- (u32)signedVal; // ERROR: sign-changing cast forbidden
```

**Why this design?**

- **Widening is safe**: u8 always fits in u32
- **Narrowing loses data**: 0x1234 truncated to u8 = 0x34 (silent bug)
- **Sign change is reinterpretation**: -1 as u32 = 4294967295 (often unexpected)
- **Bit indexing is explicit**: `val[0, 8]` clearly says "give me 8 bits"

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

// [DONE: ADR-022] Ternary - parentheses required, boolean condition, no nesting
u32 max <- (a > b) ? a : b;           // OK: parentheses, boolean condition
u32 abs <- (x < 0) ? -x : x;          // OK: simple, readable
u32 clampedPositive <- (x > 0 && x < 100) ? x : 0;  // OK: logical condition
// u32 sign <- (x > 0) ? 1 : (x < 0) ? -1 : 0;  // ERROR: nested ternary
// u32 y <- x ? 1 : 0;                          // ERROR: x is not boolean
// u32 z <- x > 0 ? 1 : 0;                      // ERROR: missing parentheses

// [DONE: ADR-023] Sizeof - with safety checks
usize intSize <- sizeof(u32);          // 4
usize structSize <- sizeof(Point);     // Includes padding

// Local arrays - sizeof works normally
u8 localBuffer[256];
usize bufBytes <- sizeof(localBuffer); // 256 - OK

// Array parameters - sizeof is FORBIDDEN (returns pointer size in C!)
void process(u8 data[]) {
    // usize bad <- sizeof(data);              // ERROR E0601: use .length
    usize count <- data.length;                // Element count
    usize bytes <- sizeof(u8) * data.length;   // Byte count (safe pattern)
}

// Side effects in sizeof - FORBIDDEN (MISRA C:2012 Rule 13.6)
// usize s <- sizeof(x++);   // ERROR E0602: side effect never executes

// Variable-length arrays - FORBIDDEN (ADR-003: static allocation)
// u8 buffer[n];             // ERROR E0603: array size must be constant

// [DONE] Type casting (ADR-024)
// Widening (small → large): Implicit, always safe
u8 byte <- 42;
u32 large <- byte;  // OK: u8 → u32 is widening

// Narrowing (large → small): ERROR! Use bit indexing
u32 big <- 1000;
// u8 small <- big;       // ERROR: narrowing forbidden
u8 low_byte <- big[0, 8]; // OK: explicit bit extraction

// Sign change: ERROR! Use bit indexing
i32 signed_val <- -5;
// u32 unsigned <- signed_val;    // ERROR: sign change
u32 bits <- signed_val[0, 32];    // OK: explicit bit reinterpret
```

## Control Flow

```cnx
// [DONE: ADR-022] If/else
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

// [DONE: ADR-027] Do-while - condition must be boolean (MISRA Rule 14.4)
u8 byte;
do {
    byte <- readByte();
} while (byte != END_MARKER);  // OK: comparison is boolean

// do { } while (count);       // ERROR E0701: must be boolean
// do { } while (count > 0);   // OK: explicit comparison

// [DONE: ADR-025] Switch - braces replace break, no fallthrough, no colons!
switch (state) {
    case State.IDLE {
        startMotor();
    }
    case State.RUNNING {
        checkSensors();
    }
    case State.STOPPED {
        cleanup();
    }
    default {
        handleError();
    }
}

// Multiple cases with || syntax
switch (cmd) {
    case Command.READ || Command.PEEK {
        readData();
    }
    case Command.WRITE {
        writeData();
    }
    default(3) {    // Counted default: 2 explicit + 3 = 5 enum variants
        handleOther();
    }
}

// Exhaustive enum matching (no default needed)
enum EState { IDLE, RUNNING, STOPPED }

switch (state) {
    case EState.IDLE {
        start();
    }
    case EState.RUNNING {
        process();
    }
    case EState.STOPPED {
        cleanup();
    }
    // All 3 cases covered - no default required
}

// [REJECTED: ADR-026] No break/continue - use structured loop conditions
// Instead of: while (true) { if (done) break; process(); }
// Use:
while (!done) {
    process();
}

// Instead of: if (skip) continue; process();
// Use:
while (!done) {
    if (!skip) {
        process();
    }
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

// [DONE: ADR-035] Array initialization - uses [] not {}
u8 data[] <- [1, 2, 3, 4, 5];     // Size inferred as 5
u8 zeros[100] <- [0*];            // All 100 elements = 0 (fill-all syntax)
u8 ones[50] <- [1*];              // All 50 elements = 1

// Partial initialization is NOT allowed (MISRA 9.3)
// u8 bad[5] <- [1, 2, 3];        // ERROR: 3 elements for size-5 array
u8 explicit[5] <- [1, 2, 3, 0, 0]; // OK: all elements explicit

// Size mismatch is a compile error
// u8 overflow[3] <- [1, 2, 3, 4]; // ERROR: 4 elements for size-3 array

// [DONE: ADR-036] Multi-dimensional arrays
u8 matrix[4][8];
matrix[0][0] <- 1;
matrix[3][7] <- 255;

// .length on each dimension (compile-time constants)
u32 rows <- matrix.length;      // 4 (first dimension)
u32 cols <- matrix[0].length;   // 8 (second dimension)

// 3D arrays also supported
u8 cube[2][3][4];
cube[0][0][0] <- 1;
cube[1][2][3] <- 99;

// Multi-dimensional arrays in structs
struct Image {
    u32 width;
    u32 height;
    u8 pixels[240][320];  // 320x240 display
}

Image screen;
screen.pixels[0][0] <- 0;
screen.pixels[239][319] <- 255;

// Nested initializers
u8 data[2][3] <- [
    [1, 2, 3],
    [4, 5, 6]
];

// Compile-time bounds checking for constant indices
// u8 bad[4][8];
// bad[5][0] <- 1;  // ERROR: index 5 >= dimension 4

// [DONE] Slice assignment - multi-byte memory copy with bounds checking
u8 packet[256];
u32 magic <- 0x12345678;
u8 length <- 4;
u32 offset <- 0;

// Copy 'length' bytes from 'magic' into 'packet' starting at 'offset'
packet[offset, length] <- magic;  // Generates bounds-checked memcpy

// Works with struct fields (binary serialization)
struct Header {
    u32 magic;
    u16 version;
    u8 flags;
}

Header hdr;
hdr.magic <- 0x43534E58;
hdr.version <- 0x0100;
hdr.flags <- 0x0F;

// Serialize struct fields into buffer
packet[0, 4] <- hdr.magic;    // Copy 4 bytes at offset 0
packet[4, 2] <- hdr.version;  // Copy 2 bytes at offset 4
packet[6, 1] <- hdr.flags;    // Copy 1 byte at offset 6

// Distinction from bit operations:
// - Arrays: buffer[offset, length] <- value  → memcpy (byte copy)
// - Scalars: flags[start, width] <- value    → bit manipulation
```

Transpiles to runtime bounds-checked code:

```c
if (offset + length <= sizeof(packet)) {
    memcpy(&packet[offset], &magic, length);
}
```

**Key Features:**

- Runtime bounds checking prevents buffer overflows
- Enables binary protocol implementation and serialization
- Distinct semantics: array slices = memory copy, scalar slices = bit operations

## Strings [DONE]

C-Next provides bounded strings with compile-time safety (ADR-045):

```cnx
// [DONE] Basic declaration - N is character capacity
string<64> name <- "Hello";           // 64 chars max, transpiles to char[65]
string<128> buffer;                    // Empty string, initialized to ""

// [DONE] Const inference - capacity auto-calculated
const string VERSION <- "1.0.0";       // Inferred as string<5>
const string APP_NAME <- "MyApp";      // Inferred as string<5>

// [DONE] Properties
u32 len <- name.length;                // Runtime: strlen(name) = 5
u32 cap <- name.capacity;              // Compile-time constant: 64

// [DONE] Comparison - uses strcmp internally
string<32> a <- "Hello";
string<64> b <- "Hello";

if (a = b) {                           // strcmp(a, b) == 0
    // Equal content (different capacities OK)
}

if (a != b) {                          // strcmp(a, b) != 0
    // Different content
}

// [DONE] Concatenation with capacity validation
string<32> first <- "Hello";
string<32> second <- " World";
string<64> result <- first + second;   // OK: 64 >= 32 + 32

// With literals (tight capacity)
string<11> greeting <- "Hello" + " World";  // OK: 11 >= 5 + 6

// [DONE] Substring extraction
string<64> source <- "Hello, World!";
string<5> hello <- source[0, 5];       // "Hello" - first 5 chars
string<6> world <- source[7, 6];       // "World!" - 6 chars at position 7
```

### Compile-Time Safety

All string operations are validated at compile time:

```cnx
// ERROR: Literal exceeds capacity
// string<4> s <- "Hello";   // ERROR: 5 > 4

// ERROR: Potential truncation
string<64> big <- "Hello";
// string<32> small <- big;  // ERROR: 64 > 32

// ERROR: Concatenation overflow
string<32> a <- "Hi";
string<32> b <- "There";
// string<50> c <- a + b;    // ERROR: 32 + 32 = 64 > 50

// ERROR: Substring out of bounds
string<64> src <- "Hello";
// string<10> bad <- src[60, 10];  // ERROR: 60 + 10 > 64

// OK: Explicit substring for truncation
string<8> short <- big[0, 8];  // Take first 8 chars explicitly
```

### Generated C

```cnx
string<64> name <- "Hello";
string<64> result <- first + second;
string<5> sub <- source[0, 5];
```

Transpiles to:

```c
#include <string.h>

char name[65] = "Hello";

char result[65] = "";
strncpy(result, first, 64);
strncat(result, second, 64 - strlen(result));
result[64] = '\0';

char sub[6] = "";
strncpy(sub, source + 0, 5);
sub[5] = '\0';
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

## Bitmap Types

```cnx
// [DONE] Portable bit-packed data types (ADR-034)
// Unlike C bit fields, bitmaps guarantee LSB-first ordering

// 8-bit bitmap with named fields
bitmap8 MotorFlags {
    Running,       // bit 0 (1 bit, default width)
    Direction,     // bit 1 (1 bit)
    Fault,         // bit 2 (1 bit)
    Mode[3],       // bits 3-5 (3 bits, explicit width)
    Reserved[2]    // bits 6-7 (2 bits)
}
// Total: 1+1+1+3+2 = 8 bits (must match bitmap8)

// Declare a bitmap variable
MotorFlags flags <- 0;

// Write to fields using dot notation
flags.Running <- true;       // Set single bit
flags.Mode <- 5;             // Set multi-bit field (0-7 valid)

// Read fields
bool isRunning <- flags.Running;  // Returns bool for 1-bit
u8 mode <- flags.Mode;            // Returns u8 for multi-bit

// Compile-time validation
// flags.Mode <- 10;  // ERROR: 10 exceeds 3-bit max (7)

// 16-bit bitmap for larger structures
bitmap16 CANStatus {
    Ready,              // bit 0
    Error,              // bit 1
    TxEmpty,            // bit 2
    RxFull,             // bit 3
    BusOff,             // bit 4
    ErrorPassive,       // bit 5
    Warning,            // bit 6
    Overrun,            // bit 7
    MessageCounter[8]   // bits 8-15 (full byte)
}

// Also available: bitmap24, bitmap32
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

// [DONE] Inferred initializer
Point p <- { x: 10, y: 20 };

// [DONE] Member access
p.x <- 100;
i32 y <- p.y;

// [DONE] Struct with array member
struct Buffer {
    u8 data[64];
    u32 length;
}

// [DONE: ADR-032] Named nested structs (no anonymous)
struct Rectangle {
    Point topLeft;
    Point bottomRight;
}

// Nested struct initialization
Rectangle bounds <- {
    topLeft: Point { x: 10, y: 20 },
    bottomRight: Point { x: 110, y: 120 }
};

// Chained member access (read)
i32 width <- bounds.bottomRight.x - bounds.topLeft.x;

// Chained member access (write)
bounds.topLeft.x <- 0;

// Deep nesting (3+ levels)
struct Color { u8 r; u8 g; u8 b; }
struct Material { Color ambient; Color diffuse; }
struct Mesh { Material mat; u32 vertexCount; }

Mesh cube <- {
    mat: Material {
        ambient: Color { r: 50, g: 50, b: 50 },
        diffuse: Color { r: 200, g: 100, b: 50 }
    },
    vertexCount: 36
};

u8 red <- cube.mat.ambient.r;  // 3-level deep read

// Alternative to anonymous structs - always use named types:
struct PacketHeader {
    u16 sequence;
    u16 length;
}

struct Packet {
    u8 type;
    PacketHeader header;    // Named, not anonymous
    u8 payload[256];
}

// Access: packet.header.sequence <- 1;

// [TODO: ADR-033] Packed struct
@packed
struct TCPHeader {
    u16 srcPort;
    u16 dstPort;
    u32 seqNum;
}
```

## Callbacks (Function-as-Type Pattern) [ACCEPTED]

C-Next provides type-safe callbacks using the Function-as-Type pattern (ADR-029):

```cnx
// A function definition creates both a callable function AND a type
void onReceive(const CAN_Message_T msg) {
    // default: no-op - this is what happens if no callback set
}

// Use the function name as a type in structs
struct Controller {
    onReceive _handler;    // Type is onReceive, initialized to default
    bool _handlerSet;
}

// User implementation - must match signature exactly
void myHandler(const CAN_Message_T msg) {
    Serial.println(msg.id);
}

// Assign compatible function
controller._handler <- myHandler;

// Always safe to call - never null
controller._handler(msg);
```

### Nominal Typing

Type identity is the **function name**, not just the signature:

```cnx
void onMouseDown(const Point p) { }
void onMouseUp(const Point p) { }

struct Handler {
    onMouseDown down;
    onMouseUp up;
}

Handler h;
h.down <- onMouseUp;  // COMPILE ERROR - type mismatch!
                       // Even though signatures match
```

This prevents accidentally swapping handlers that happen to have the same signature.

### Never Null

Callback fields are always initialized to their default function:

```cnx
struct Controller {
    onReceive _handler;  // Initialized to onReceive (the default)
}

Controller c;
c._handler(msg);  // Always safe - worst case is no-op
```

### Explicit "Is Set" Tracking

If you need to know whether a callback was explicitly set:

```cnx
void onReceive(const CAN_Message_T msg) { /* NO-OP */ }

struct Controller {
    onReceive _handler;
    bool _handlerIsSet;
}

void Controller_setHandler(Controller self, onReceive handler) {
    self._handler <- handler;
    self._handlerIsSet <- true;
}

void Controller_process(Controller self, CAN_Message_T msg) {
    if (self._handlerIsSet) {
        self._handler(msg);
    }
}
```

### Generated C

```cnx
void defaultHandler(const CAN_Message_T msg) { }

struct Controller {
    defaultHandler _handler;
}
```

Transpiles to:

```c
void defaultHandler(const CAN_Message_T msg) { }

typedef void (*defaultHandler_fp)(const CAN_Message_T);

struct Controller {
    defaultHandler_fp _handler;
};

struct Controller Controller_init(void) {
    return (struct Controller){
        ._handler = defaultHandler
    };
}
```

### State Machines: Use Enum + Switch Instead

For state machines, prefer enums over callback swapping:

```cnx
enum RobotMood {
    Sleepy,
    Happy,
    Grumpy
}

struct Robot {
    RobotMood currentMood;
}

void Robot_poke(Robot self) {
    switch (self.currentMood) {
        case RobotMood.Sleepy {
            yawn();
        }
        case RobotMood.Happy {
            giggle();
        }
        case RobotMood.Grumpy {
            growl();
        }
    }
}
```

**Why enum + switch is better:**

- No function pointers = no null dereference risk
- Exhaustive switch = compiler catches missing states
- Direct calls = easier static analysis and debugging

## ISR Type (Interrupt Service Routines) [IMPLEMENTED]

C-Next provides a built-in `ISR` type for interrupt handlers (ADR-040):

```cnx
// ISRs are defined as normal void() functions
void timerHandler() {
    // Timer interrupt code
}

void uartHandler() {
    // UART interrupt code
}

// ISR is a built-in type for void(void) function pointers
void registerHandler(ISR handler) {
    _handler <- handler;
}

// Store ISRs in structs
struct InterruptController {
    ISR timerCallback;
    ISR uartCallback;
}

// ISR arrays for vector tables
ISR vectorTable[4];

void initVectors() {
    vectorTable[0] <- resetHandler;
    vectorTable[1] <- nmiHandler;
    vectorTable[2] <- hardFaultHandler;
    vectorTable[3] <- timerHandler;
}
```

**Key differences from ADR-029 Callbacks:**

- **Structural typing**: Any `void()` function matches `ISR` (callbacks use nominal typing)
- **Can be null**: ISR fields don't have automatic defaults (callbacks always have a default)
- **Use case**: Interrupt vectors (callbacks are for event handlers and plugins)

## Atomic Variables [IMPLEMENTED]

C-Next provides the `atomic` keyword for ISR-safe variables (ADR-049):

```cnx
// [DONE] Target platform selection (determines atomic implementation)
#pragma target teensy41     // Cortex-M7: LDREX/STREX
// #pragma target cortex-m0  // Cortex-M0: PRIMASK fallback

// [DONE] Atomic variables - guaranteed ISR-safe
atomic u32 counter <- 0;           // ISR-safe counter
atomic clamp u8 brightness <- 100; // Combines atomic + overflow behavior
atomic wrap u16 ticks <- 0;        // Wrapping atomic counter

// [DONE] Atomic compound assignment - generates hardware-assisted code
void increment() {
    counter +<- 1;     // Lock-free increment (LDREX/STREX on M3+)
    brightness +<- 10; // Atomic clamp-add
    ticks +<- 1;       // Atomic wrap-add
}
```

### Generated Code

On Cortex-M3/M4/M7 (LDREX/STREX available):

```c
volatile uint32_t counter = 0;

void increment(void) {
    do {
        uint32_t __old = __LDREXW(&counter);
        uint32_t __new = cnx_clamp_add_u32(__old, 1);
        if (__STREXW(__new, &counter) == 0) break;
    } while (1);
}
```

On Cortex-M0/M0+ (PRIMASK fallback):

```c
volatile uint32_t counter = 0;

void increment(void) {
    {
        uint32_t __primask = __get_PRIMASK();
        __disable_irq();
        counter = cnx_clamp_add_u32(counter, 1);
        __set_PRIMASK(__primask);
    }
}
```

### Target Detection Priority

```bash
# 1. CLI flag (highest priority)
cnext myfile.cnx --target teensy41

# 2. Config file
# cnext.config.json: { "target": "teensy41" }

# 3. PlatformIO auto-detection
# Reads board from platformio.ini automatically

# 4. Pragma in source
#pragma target teensy41

# 5. Default (lowest priority)
# PRIMASK fallback for unknown platforms
```

### Supported Targets

| Target       | Core       | LDREX/STREX | Atomic Method    |
| ------------ | ---------- | ----------- | ---------------- |
| `teensy41`   | Cortex-M7  | ✅          | Lock-free loops  |
| `teensy40`   | Cortex-M7  | ✅          | Lock-free loops  |
| `cortex-m7`  | Cortex-M7  | ✅          | Lock-free loops  |
| `cortex-m4`  | Cortex-M4  | ✅          | Lock-free loops  |
| `cortex-m3`  | Cortex-M3  | ✅          | Lock-free loops  |
| `cortex-m0+` | Cortex-M0+ | ✅          | Lock-free loops  |
| `cortex-m0`  | Cortex-M0  | ❌          | PRIMASK fallback |
| `avr`        | AVR        | ❌          | PRIMASK fallback |

## Critical Sections [IMPLEMENTED]

For multi-statement atomic operations, use `critical { }` blocks (ADR-050):

```cnx
// [DONE] Critical sections - PRIMASK-based interrupt masking
u8 buffer[64];
u32 writeIdx <- 0;
u32 readIdx <- 0;

void enqueue(u8 data) {
    critical {
        buffer[writeIdx] <- data;
        writeIdx +<- 1;
    }
}

u8 dequeue() {
    u8 data;
    critical {
        data <- buffer[readIdx];
        readIdx +<- 1;
    }
    return data;
}
```

### Generated Code

```c
void enqueue(uint8_t data) {
    {
        uint32_t __primask = __get_PRIMASK();
        __disable_irq();
        buffer[writeIdx] = data;
        writeIdx += 1;
        __set_PRIMASK(__primask);
    }
}
```

### Safety Rules

```cnx
// ERROR E0853: return inside critical section
void badFunction() {
    critical {
        if (error) {
            return;  // COMPILE ERROR!
        }
    }
}

// OK: return after critical section
void goodFunction() {
    u8 result;
    critical {
        result <- computeValue();
    }
    return result;
}
```

**Why no return inside critical?**

- Leaving critical without restoring PRIMASK = interrupts permanently disabled
- Compiler can't track all exit paths through critical blocks
- Explicit pattern: compute in critical, return after

### When to Use What

| Use Case                      | Feature        |
| ----------------------------- | -------------- |
| Single variable, simple ops   | `atomic`       |
| Multiple related variables    | `critical { }` |
| Counter increments            | `atomic wrap`  |
| Sensor values with saturation | `atomic clamp` |
| Ring buffer read/write        | `critical { }` |
| State machine transitions     | `critical { }` |

## NULL for C Library Interop [IMPLEMENTED]

C-Next safely interoperates with C stream functions that return NULL (ADR-047):

```cnx
// [DONE] Safe NULL checking for C stream functions
#include <stdio.h>

string<64> buffer;

void readInput() {
    // NULL check is REQUIRED - compiler enforces it
    if (fgets(buffer, buffer.size, stdin) != NULL) {
        // Safe to use buffer - fgets wrote to it
        printf("Got: %s", buffer);
    }
}
```

### What's Allowed

```cnx
// OK: NULL comparison with whitelisted stream functions
if (fgets(buffer, buffer.size, stdin) != NULL) { ... }
if (fputs("hello", stdout) = NULL) { ... }  // Note: = is equality in C-Next
```

### What's NOT Allowed

```cnx
// ERROR E0901: Must check NULL
fgets(buffer, buffer.size, stdin);  // Missing NULL check!
printf("Got: %s", buffer);

// ERROR E0902: Forbidden function (returns FILE*)
fopen("test.txt", "r");  // Not supported - see ADR-103

// ERROR E0903: NULL outside comparison
u32 x <- NULL;  // NULL only valid in comparison

// ERROR E0904: Cannot store C pointer returns
string<64>? result <- fgets(...);  // No nullable types
```

### Whitelisted Functions

| Function | NULL Meaning | Header  |
| -------- | ------------ | ------- |
| `fgets`  | EOF or error | stdio.h |
| `fputs`  | Write error  | stdio.h |
| `fgetc`  | EOF or error | stdio.h |
| `fputc`  | Write error  | stdio.h |

**Why constrained?** C-Next eliminates null bugs by design. This feature is a controlled exception for C interop only - maintaining safety while enabling practical stdio usage.

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

// [DONE] Scoped registers for platform namespacing
scope Teensy4 {
    register GPIO7 @ 0x42004000 {
        DR:         u32 rw @ 0x00,
        DR_SET:     u32 wo @ 0x84,
        DR_TOGGLE:  u32 wo @ 0x8C,
    }

    const u32 LED_BIT <- 3;

    void blinkLed() {
        this.GPIO7.DR_TOGGLE[this.LED_BIT] <- true;
    }
}

// Usage: Teensy4.GPIO7.DR_SET[3] <- true;
// Generates: Teensy4_GPIO7_DR_SET = (1 << 3);

// Why scoped registers?
// - Avoid conflicts with HAL headers (e.g., Teensy's imxrt.h defines GPIO7_DR)
// - Group platform-specific registers, constants, and functions
// - Support multiple platform configurations in same codebase
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

| C                   | C-Next              | Why                                   |
| ------------------- | ------------------- | ------------------------------------- |
| `x = 5`             | `x <- 5`            | Assignment is explicit flow           |
| `x == 5`            | `x = 5`             | Equality uses mathematical =          |
| `int`, `long`       | `i32`, `i64`        | Fixed widths, no surprises            |
| `ptr->field`        | `ptr.field`         | No arrow operator                     |
| `*ptr`              | Implicit            | Simplified references                 |
| Manual init         | Zero by default     | No uninitialized variables            |
| Manual prefixes     | `scope {}`          | Organization with auto-prefixing      |
| Forward decl        | Define first        | Errors caught early (E0422)           |
| `(u8)bigVal`        | `bigVal[0, 8]`      | Explicit bit extraction for narrowing |
| Silent overflow     | `clamp`/`wrap`      | Explicit overflow behavior            |
| `case X: break;`    | `case X { }`        | Braces replace break, no fallthrough  |
| `case A: case B:`   | `case A \|\| B { }` | OR syntax for multiple cases          |
| `default:`          | `default(n) { }`    | Counted default catches enum growth   |
| `break`/`continue`  | Loop conditions     | Structured loops, no hidden exits     |
| `char buf[64]`      | `string<64> buf`    | Bounded strings with safety           |
| `strcmp(a,b)==0`    | `a = b`             | String comparison via =               |
| `strcpy`/`strcat`   | `a + b`             | Safe concatenation with validation    |
| `void (*fp)(int)`   | `funcName type`     | Function-as-Type pattern, never null  |
| `int a[] = {1,2,3}` | `u8 a[] <- [1,2,3]` | `[]` for arrays, `{}` for structs     |
| `int z[100] = {0}`  | `u8 z[100] <- [0*]` | Explicit fill-all syntax              |
| `volatile`          | `atomic`            | ISR-safe with LDREX/STREX or PRIMASK  |
| Manual IRQ disable  | `critical { }`      | PRIMASK save/restore blocks           |

## Further Reading

- [Architecture Decision Records](docs/decisions/)
- [v1 Feature Matrix](docs/plans/v1-feature-matrix.md)
- [GitHub Repository](https://github.com/jlaustill/c-next)
