# C-Next Language Guide

This guide covers all C-Next language features in detail. For a quick introduction, see the [README](../README.md).

## Table of Contents

- [Assignment vs Equality](#assignment--vs-equality-)
- [Fixed-Width Types](#fixed-width-types)
- [Register Bindings](#register-bindings)
- [Type-Aware Bit Indexing](#type-aware-bit-indexing)
- [Slice Assignment](#slice-assignment-for-memory-operations)
- [Scopes](#scopes-adr-016)
- [Switch Statements](#switch-statements-adr-025)
- [Ternary Operator](#ternary-operator-adr-022)
- [Bounded Strings](#bounded-strings-adr-045)
- [Callbacks](#callbacks-adr-029)
- [Atomic Variables](#atomic-variables-adr-049)
- [Volatile Variables](#volatile-variables-adr-108)
- [Critical Sections](#critical-sections-adr-050)
- [NULL for C Library Interop](#null-for-c-library-interop-adr-047)
- [Startup Allocation](#startup-allocation)
- [Hardware Testing](#hardware-testing)

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

### Slice Assignment for Memory Operations

Multi-byte copying with compile-time validated `memcpy` generation (Issue #234):

```cnx
u8 buffer[256];
u32 magic <- 0x12345678;

// Copy 4 bytes from value into buffer at offset 0
buffer[0, 4] <- magic;

// Named offsets using const variables
const u32 HEADER_OFFSET <- 0;
const u32 DATA_OFFSET <- 8;
buffer[HEADER_OFFSET, 4] <- magic;
buffer[DATA_OFFSET, 8] <- timestamp;
```

Transpiles to direct memcpy (bounds validated at compile time):

```c
uint8_t buffer[256] = {0};
uint32_t magic = 0x12345678;

memcpy(&buffer[0], &magic, 4);
memcpy(&buffer[8], &timestamp, 8);
```

**Key Features:**

- **Compile-time bounds checking** prevents buffer overflows at compile time
- Offset and length must be compile-time constants (literals or `const` variables)
- Silent runtime failures are now compile-time errors
- Works with struct fields: `buffer[0, 4] <- config.magic`
- Distinct from bit operations: array slices use `memcpy`, scalar bit ranges use bit manipulation

### Scopes (ADR-016)

Organize code with automatic name prefixing. Inside scopes, explicit qualification is available to avoid naming collisions:

- `this.X` for scope-local members
- `global.X` for global variables, functions, and registers

If the same name exists in local, scope, and global levels, the precedence is local, scope, global just like you are used to in other languages.

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

### Atomic Variables (ADR-049)

ISR-safe variables with hardware-assisted atomicity:

```cnx
#pragma target teensy41

atomic u32 counter <- 0;           // ISR-safe with LDREX/STREX
atomic clamp u8 brightness <- 100; // Combines atomic + clamp

void increment() {
    counter +<- 1;   // Lock-free atomic increment
}
```

Generates optimized code based on target platform:

- **Cortex-M3/M4/M7**: LDREX/STREX retry loops (lock-free)
- **Cortex-M0/M0+**: PRIMASK disable/restore (interrupt masking)

Target detection priority: `--target` CLI flag > `platformio.ini` > `#pragma target` > default

### Volatile Variables (ADR-108)

Prevent compiler optimization for variables that change outside normal program flow:

```cnx
// Delay loop - prevent optimization
void delay_ms(const u32 ms) {
    volatile u32 i <- 0;
    volatile u32 count <- ms * 2000;

    while (i < count) {
        i +<- 1;  // Compiler cannot optimize away
    }
}

// Hardware register - reads actual memory
volatile u32 status_register @ 0x40020000;

void waitReady() {
    while (status_register & 0x01 = 0) {
        // Always reads from hardware
    }
}
```

**When to use:**

- ✅ Delay loops that must not be optimized away
- ✅ Memory-mapped hardware registers
- ✅ Variables polled in tight loops
- ❌ ISR-shared variables (use `atomic` instead for RMW safety)

**Key difference from `atomic`:**

- `volatile` = prevents optimization only
- `atomic` = prevents optimization + adds synchronization (ISR-safe)

### Critical Sections (ADR-050)

Multi-statement atomic blocks with automatic interrupt masking:

```cnx
u8 buffer[64];
u32 writeIdx <- 0;

void enqueue(u8 data) {
    critical {
        buffer[writeIdx] <- data;
        writeIdx +<- 1;
    }
}
```

Transpiles to PRIMASK save/restore:

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

**Safety**: `return` inside `critical { }` is a compile error (E0853).

### NULL for C Library Interop (ADR-047)

Safe interop with C stream functions that can return NULL:

```cnx
#include <stdio.h>

string<64> buffer;

void readInput() {
    // NULL check is REQUIRED - compiler enforces it
    if (fgets(buffer, buffer.size, stdin) != NULL) {
        printf("Got: %s", buffer);
    }
}
```

**Constraints:**

- NULL only valid in comparison context (`!= NULL` or `= NULL`)
- Only whitelisted stream functions: `fgets`, `fputs`, `fgetc`, `fputc`
- Cannot store C pointer returns in variables
- `fopen`, `malloc`, etc. are errors (see ADR-103 for future FILE\* support)

### Startup Allocation

Allocate at startup, run with fixed memory. Per MISRA C:2023 Dir 4.12: all memory is allocated during initialization, then forbidden. No runtime allocation means no fragmentation, no OOM, no leaks.

## Hardware Testing

Verified on **Teensy MicroMod**, **Teensy 4.0**, and **STM32** hardware:

```bash
# Build and flash with PlatformIO
cd test-teensy
pio run -t upload
```

See `examples/blink.cnx` for the complete LED blink example.
