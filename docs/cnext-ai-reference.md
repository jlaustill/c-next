# C-Next AI Reference

A complete reference for AI code generation. C-Next transpiles to C/C++. Every rule here maps to transpiler behavior — if you violate a rule, the transpiler will reject it.

---

# Part 1: Core Language

## Operators

```
ASSIGNMENT:    x <- 5          →  x = 5
COMPARISON:    if (x = 5)      →  if (x == 5)
NOT EQUAL:     if (x != 5)     →  if (x != 5)
RELATIONAL:    < > <= >=       (same as C)
COMPOUND:      x +<- 1         →  x += 1
               x -<- 1         →  x -= 1
               x *<- 2         →  x *= 2
               x /<- 2         →  x /= 2
               x %<- 2         →  x %= 2
               x &<- mask      →  x &= mask
               x |<- flags     →  x |= flags
               x ^<- mask      →  x ^= mask
               x <<<- 1        →  x <<= 1
               x >><- 1        →  x >>= 1
ARITHMETIC:    + - * / %       (% is integer-only — see notes below)
BITWISE:       & | ^ ~          (signed & unsigned, same as C)
SHIFT:         << >>            (UNSIGNED operands only — see below)
LOGICAL:       && || !          (same as C)
```

**Division and modulo guard against divide-by-zero** (unlike C):

- A **compile-time-zero** divisor — a literal `0`, or a `const` known to be `0` — is a **compile error** (`E0800: Division by zero`): e.g. `10 / 0`, or `const u32 ZERO <- 0; x / ZERO`.
- A **runtime** divisor compiles to plain C division with no implicit guard (`10 / divisor` → `10U / divisor`).
- **Floats:** `%` is **forbidden** on floats (`E0804` — `%` is integer-only).
- For guarded runtime division/modulo, use the `safe_div` / `safe_mod` built-ins (ADR-051):

```cnx
u32 result <- 0;
bool err  <- safe_div(result, 10, divisor, 99);      // divisor == 0 → result = 99, err = true
bool err2 <- safe_mod(result, 10, divisor, result);  // pass current value as default = preserve-on-error
```

`safe_div(out, numerator, divisor, defaultValue)` (and `safe_mod`) return a `bool` error flag: on a zero divisor they write `defaultValue` into `out` and return `true`; otherwise they write the quotient/remainder and return `false`. The transpiler emits a per-type helper (`cnx_safe_div_u32`, …).

**Shift operators (`<<`, `>>`) require unsigned operands** (unlike C):

- Shifting a **signed** value (`i8`/`i16`/`i32`/`i64`) is a compile error (`E0805`, MISRA 10.1) — left-shift of a signed value is UB and right-shift is implementation-defined in C, so C-Next forbids it. Bitwise `& | ^ ~` _are_ allowed on signed values (two's-complement, same as C).
- The shift amount must be **non-negative** and **less than the operand's bit width** (MISRA 12.2): `x << -1` and `u8val << 8` are both compile errors. Widen first: `u16 wide <- val; u16 r <- wide << 8;`.

## Types

```
UNSIGNED:  u8  u16  u32  u64   → uint8_t  uint16_t  uint32_t  uint64_t
SIGNED:    i8  i16  i32  i64   → int8_t   int16_t   int32_t   int64_t
FLOAT:     f32  f64            → float    double
BOOL:      bool                → bool
SIZE:      usize               → size_t
STRING:    string<N>           → char[N+1]
```

Scalar values also expose **`.bit_length`** — the compile-time bit width: `u32 x; x.bit_length` → 32, `f64 d; d.bit_length` → 64, `bool b; b.bit_length` → 8. (Arrays additionally expose `.byte_length`/`.element_count` — see Arrays.)

## Literals

Number bases — prefix is case-insensitive; type inferred from context:

```cnx
u8 a <- 200;          // decimal
u8 b <- 0xFF;         // hex     (0x / 0X; digits case-insensitive)
u8 c <- 0b10101010;   // binary  (0b / 0B)
```

Integer **type suffixes** force a literal's type (case-insensitive), with any base — `u8 u16 u32 i8 i16 i32`:

```cnx
u8  d <- 42u8;
u16 e <- 0xABCDu16;
i32 f <- 100I32;
```

**Char literals** are `u8` — the character's byte value — and work anywhere a `u8` does (init, comparison, array elements, `switch` cases, arithmetic):

```cnx
u8 ch <- 'A';         // 65
u8 lo <- 'A' + 32;    // 'a'
```

Standard char escape sequences work in `'...'` literals: newline (10), tab (9), carriage return (13), null (0), backslash (92), single-quote (39), double-quote (34).

**Float literals**: decimal (`3.14`, `-0.0`), scientific/`e` notation (`1.5e-10`, `3.0e8`), and `f32`/`f64` type suffixes (case-insensitive — `3.14f32`, `6.022e23f64`, `100.5F32`).

## Variable Declarations

```cnx
u32 x <- 42;                    // initialized
u32 y;                           // zero-initialized (NOT garbage)
const u32 MAX <- 100;            // compile-time constant
clamp u8 brightness <- 200;      // saturating arithmetic (DEFAULT behavior)
wrap u32 counter <- 0;           // wrapping arithmetic (opt-in)
atomic u32 shared <- 0;          // ISR-safe
```

All variables are zero-initialized. No uninitialized variables exist.

## Overflow Behavior

- **Default is clamp** (saturating): `u8 x <- 200; x +<- 100;` → x = 255
- **opt-in wrap**: `wrap u32 c <- 0; c -<- 1;` → c = UINT32_MAX
- Combine with atomic: `atomic clamp u8 brightness <- 0;`

Clamp/wrap apply to **signed** types too: `clamp i8` saturates at both `-128` and `127`; `wrap` uses natural two's-complement wraparound.

## Arrays

```cnx
u8[256] buffer;                  // fixed-size, zero-initialized
u8[5] data <- [1, 2, 3, 4, 5];  // literal init with []
u8[100] zeros <- [0*];           // fill all elements
u8[4][8] matrix;                 // multi-dimensional

usize len <- buffer.element_count;  // 256 (compile-time)
u32 bits <- buffer.bit_length;      // 2048 (compile-time)
u32 bytes <- buffer.byte_length;    // 256 (compile-time)
```

**Rules:**

- Use `[]` for array literals, NOT `{}`
- Partial initialization forbidden (MISRA 9.3) — provide all elements or use `[val*]`
- **Size inference (ADR-035):** omit the size with empty `[]` in the **type position** to infer it from the initializer — `u8[] data <- [1, 2, 3];` (size 3). Brackets always go before the name, never after.
- **Compile-time bounds checking (ADR-036):** a constant index past the end is a compile error — `u8[5] a; a[5] <- 1;` fails with `index 5 >= array size 5`
- **Indices must be unsigned integers** — a signed index errors `E0850`, a float index errors `E0851` (applies to both array `a[i]` and bit `x[i]` indexing)
- Size goes BEFORE the name: `u8[256] buffer` not `u8 buffer[256]`

## Strings

```cnx
string<64> name <- "Hello";         // 64-char max capacity
u32 len <- name.char_count;         // runtime: strlen → 5
u32 cap <- name.capacity;           // compile-time: 64
u32 sz <- name.size;                // compile-time: 65 (capacity + null terminator)
string<5> sub <- name[0, 5];        // substring
string<96> joined <- name + " World"; // concat (capacity >= sum of operand capacities)
const string VERSION <- "1.0.0";    // auto-sized
```

**Rules:**

- Non-`const` strings must be sized (`string<64> s;`); only `const string` auto-sizes from its initializer.
- A literal or concat that exceeds the destination capacity is a compile error.
- Compare strings with `=` / `!=`; **compound operators are not supported** (`s +<- x` ✗ — use `s <- s + x`).
- String literals accept the same escape sequences as char literals (newline, tab, carriage return, backslash, quote).
- **Concat (`+`) and substring (`s[off, len]`) emit runtime code (`strncpy`/`strncat`)** — they may only appear **inside a function**, never at global/initializer scope (a global string initializes from a literal).
- Substring `s[off, len]` is bounds-checked at compile time: `off + len` must fit the source's capacity, and the destination string must be large enough to hold `len`.

**Slice assignment into byte buffers:** `buf[byteOffset, byteCount] <- value` copies `byteCount` **little-endian** bytes of an integer `value` into any integer array (`u8[]`/`u16[]`/`u32[]`/`u64[]`) or string buffer. Offset and length must be **compile-time constants** — literals, `const` variables, or `const` expressions (a runtime offset/length, or a zero length, is a compile error); the write is bounds-checked at compile time. On a byte _array_, `[off, len]` means BYTES; on a scalar/float, `[start, width]` means BITS. A **single** subscript `s[i]` accesses one element: a `u8` byte value in numeric context (`u8 b <- s[0]`, or passed to a `u8` parameter) and the target of a byte write (`s[i] <- 'X'`); assigned to a `string<1>` it instead yields a one-character substring.

```cnx
u8[64] buf;
buf[0, 4]  <- 0x12345678;   // bytes 78 56 34 12 at indices 0..3 (LE)
buf[10, 2] <- 0xCDEFu16;    // bytes EF CD at indices 10..11
```

## Structs

```cnx
struct Point {
    i32 x;
    i32 y;
}

Point origin;                        // zero-initialized
Point p <- { x: 10, y: 20 };        // named field init (MUST use names)
p.x <- 100;                         // member access

// Nested
struct Rect {
    Point topLeft;
    Point bottomRight;
}

Rect r <- {
    topLeft: { x: 0, y: 0 },
    bottomRight: { x: 100, y: 50 }
};
```

**Rules:**

- Named field initialization only: `{ x: 10, y: 20 }` — NOT positional `{ 10, 20 }`
- All fields public (structs are data containers)
- Zero-initialized by default

Don't repeat the struct type in an initializer — `Point p <- {x: 1, y: 2};`, not `Point p <- Point {x: 1, y: 2};` (ADR-014: redundant type is an error).

## Enums

```cnx
enum State {
    IDLE,                // 0
    RUNNING,             // 1
    ERROR <- 255         // explicit value
}

State s <- State.IDLE;
if (s = State.RUNNING) { }

switch (s) {
    case State.IDLE { start(); }
    case State.RUNNING { check(); }
    default { handleError(); }
}
```

**Rules:**

- Enums are **strongly typed**: you cannot assign or compare an enum with a raw integer (`s <- 1` ✗, `if (s = 0)` ✗) — convert explicitly with `(u32)State.X`. Negative enum values are not allowed.
- **Qualify** members as `State.IDLE`. An unqualified member (`IDLE`) is accepted only where the target type is already known (assignment to an enum-typed variable/field, or an enum-typed argument); it is an error in comparisons or a `switch` on a non-enum. Prefer qualified everywhere.

## Bitmaps

```cnx
bitmap8 Flags {          // MUST be bitmap8, bitmap16, bitmap24, or bitmap32
    Running,             // bit 0 (1 bit)
    Direction,           // bit 1
    Fault,               // bit 2
    Mode[3],             // bits 3-5 (3 bits)
    Reserved[2]          // bits 6-7 (2 bits)
}
// Total bits MUST equal the bitmap size (8 here)

Flags f <- 0;
f.Running <- true;
f.Mode <- 5;
bool r <- f.Running;
```

Access bitmap fields by **name** (`f.Mode`); bracket-indexing a bitmap (`f[3]`) is an error.

## Bit Manipulation

```cnx
u8 flags <- 0;
flags[3] <- true;              // set bit 3
bool b <- flags[3];            // read bit 3
flags[4, 3] <- 5;             // set 3 bits starting at bit 4
u8 field <- flags[4, 3];      // read 3-bit field

// Use for narrowing (casts are FORBIDDEN)
u32 big <- 0xDEADBEEF;
u8 low <- big[0, 8];          // bits 0-7 → 0xEF
u8 high <- big[24, 8];        // bits 24-31 → 0xDE
```

Bit indexing also works on **floats** (`f32`/`f64`): `f32val[24, 8]` reads/writes IEEE-754 bytes (union-based, MISRA 21.15) — the way to build a float from wire bytes.

**Compound assignment is not supported on a bit-index target:** `flags[0, 4] +<- 3;` is a compile error — read, modify, then write back.

(On a byte _array_, `buf[off, len]` means BYTES — see Strings/slice assignment; on a scalar/float, `[start, width]` means BITS.)

### Zero-Extension on Wider Target Fields

Writing a narrow value into a wider bit field **zero-fills the remaining bits**. The transpiler clears the entire target window before writing.

```cnx
// Assembling a 12-bit value from wire protocol bytes:
u16 x;
x[0, 8] <- lo_byte;          // write 8 bits into bits [0..7]
x[8, 8] <- hi_byte[0, 4];    // write 4-bit value into 8-bit field
                               // bits [8..11] get the value, [12..15] zeroed
```

This eliminates the need to zero the variable first. The generated C clears the full target window via mask:

```c
// x[8,8] <- hi_byte[0,4] generates:
x = (uint16_t)((x & ~(0xFFU << 8)) | ((((hi_byte) & 0x0F) & 0xFFU) << 8));
```

## Type Casting Rules

```
WIDENING (implicit, safe):     u8 → u32, i8 → i32  (same sign only)
NARROWING (FORBIDDEN):         u32 → u8   — use bit indexing: val[0, 8]
SIGN CHANGE (FORBIDDEN):       i32 → u32  — use bit indexing: val[0, 32]
CROSS-SIGN WIDEN (FORBIDDEN):  u16 → i32  — use bit indexing: val[0, 16]
FLOAT→INT (allowed):           (u32)f — truncates fraction, THEN clamps to range
POINTER CAST (NOT SUPPORTED):  use register keyword for MMIO
```

**Literal range checking:** an out-of-range or wrong-sign literal in a declaration/assignment is a compile error — `u8 x <- 256;` ("Value 256 exceeds u8 range"), `u8 y <- -1;` ("Negative value … to unsigned u8"). In-range literals are fine.

**Enum → integer** requires an explicit cast: `u32 v <- (u32)Priority.HIGH;` (to any integer width).

## sizeof (ADR-023)

`sizeof(...)` returns the byte size (a compile-time constant) of a type, variable, struct, struct member, or array:

```cnx
u32 a <- sizeof(u32);        // 4   (bool = 1, f64 = 8, ...)
u32 b <- sizeof(myVar);      // size of a variable
u32 c <- sizeof(Point);      // size of a struct type (or instance: sizeof(p))
u32 d <- sizeof(p.x);        // size of a struct member
u32 e <- sizeof(buffer);     // total bytes of an array  (u32[8] → 32)
u8[sizeof(u32)] buf;         // usable as an array dimension
```

Usable in any constant expression (arithmetic, comparison, ternary, array sizes). Errors:

- `sizeof` on an **array parameter** (`u8[16] data`) → `E0601` (it would measure the pointer, not the array — use `data.element_count`).
- `sizeof` of an expression **with side effects** (e.g. a function call) → `E0602`.

(Arrays also expose `.byte_length` / `.element_count`; `sizeof` additionally covers types, structs, and members.)

## Functions

```cnx
void doNothing() { }

u32 add(u32 a, u32 b) {
    return a + b;
}
```

**Rules:**

- Define before use (no forward declarations) — applies within scopes too
- No recursion (MISRA 17.2)
- No `break`/`continue` — use structured conditions

## Pass-by-Reference (ADR-006)

**Pass-by-reference semantics, no pointer syntax** — modify a parameter and the caller's variable changes (e.g. `swap` works). The transpiler picks the C form automatically (auto-const): a parameter you **modify** becomes a pointer (`uint32_t* x`; caller passes `&var`); one you only **read** is passed **by value** (scalars) or const (structs). Literals still can't be passed (see below).

```cnx
void increment(u32 x) {     // transpiles to: void increment(uint32_t *x)
    x +<- 1;                // transpiles to: *x += 1;
}

increment(myVar);            // transpiles to: increment(&myVar);
```

**Consequence:** Cannot pass literals to functions (no addressable location).

```cnx
const u32 LED_PIN <- 13;
init(LED_PIN);                // OK: LED_PIN has an address
// init(13);                  // ERROR: literal has no address
```

## Control Flow

```cnx
// If/else (braces required)
if (x > 0) {
    doA();
} else if (x < 0) {
    doB();
} else {
    doC();
}

// While
while (running) { process(); }

// For
for (u32 i <- 0; i < 10; i +<- 1) { buffer[i] <- 0; }

// Do-while (condition MUST be boolean comparison)
do {
    byte <- read();
} while (byte != END_MARKER);
// } while (byte);           // ERROR: bare bool not allowed

// Ternary (condition MUST be PARENTHESIZED and a comparison or logical op)
u32 max <- (a > b) ? a : b;
// u32 y <- flag ? 1 : 0;   // ERROR: bare bool
// u32 z <- a > b ? a : b;   // ERROR: condition must be parenthesized
// Nested ternary FORBIDDEN

// Switch (braces, no colons, no fallthrough, no break needed)
switch (state) {
    case State.IDLE { start(); }
    case State.RUNNING { check(); }
    default { error(); }
}

// Multiple cases
switch (cmd) {
    case Cmd.READ || Cmd.PEEK { readData(); }
    case Cmd.WRITE { writeData(); }
}
```

**Switch rules (ADR-025):**

- **≥2 clauses** required (MISRA 16.6) — a single-case switch is an error; use `if`.
- **No `switch` on a boolean** (16.7) — use `if/else`. Switch on an **integral or enum** type; case labels are **constant** expressions.
- **No duplicate** case values; **`default` must be last** (16.5).
- **Enums must be exhaustive:** cover every variant explicitly, or use a **counted default** `default(n)` where `n` = how many variants the default covers (adding a variant later breaks the build until you bump `n` or add a case). Non-enum switches require a plain `default`.

```cnx
switch (state) {                 // enum with 4 variants
    case EState.IDLE { start(); }
    case EState.RUNNING { check(); }
    default(2) { other(); }      // explicitly covers the remaining 2 variants
}
```

## Scopes

Scopes are singleton modules with automatic name prefixing.

```cnx
scope Counter {
    private u32 value <- 0;         // private — must be explicit

    void increment() {              // public (default for scope functions)
        this.value +<- 1;
    }

    u32 get() {
        return this.value;
    }
}

// External usage
Counter.increment();                // → Counter_increment()
u32 v <- Counter.get();             // → Counter_get()
```

### Name Resolution (ADR-057)

Priority: **local → scope → global**

```cnx
scope Foo {
    u32 x <- 10;

    void bar() {
        u32 x <- 5;        // local shadows scope
        // x = 5            (local)
        // this.x = 10      (scope, explicit)
        // global.x          (global, explicit)
    }
}
```

**Rules:**

- Inside a scope, bare names resolve local first, then scope, then global
- `this.name` forces scope resolution
- `global.name` forces global resolution
- `global.ScopeName.function()` calls another scope's public function

### Scope Transpilation

```cnx
scope LED {
    private u32 pin <- 13;            // → static uint32_t LED_pin = 13;
    void on() { }                    // → void LED_on(void) { } (public by default)
    private void helper() { }        // → static void LED_helper(void) { }
}
```

- Private members → `static` (file-scoped)
- Public members → non-static + header prototype
- Names prefixed: `ScopeName_memberName`

### Scoped Types

Structs, enums, and registers can be declared **inside** a scope. Refer to the type as `this.Name` within the scope and `ScopeName.Name` from outside; a `private` scoped type is only usable inside its scope.

```cnx
scope Motor {
    public enum State { IDLE, RUNNING }
    public this.State current <- this.State.IDLE;   // member typed by a scoped enum

    public void start() { this.current <- this.State.RUNNING; }
}

Motor.State s <- Motor.State.IDLE;        // refer to the scoped type from outside
Motor.start();
bool running <- Motor.current = Motor.State.RUNNING;
```

Scopes **cannot be nested** (`scope A { scope B { } }` is a compile error, ADR-016).

## Includes

```cnx
#include "local_file.cnx"           // relative to this file → #include "local_file.hpp"
#include <J1939Message.cnx>          // searches cnext include paths → #include <J1939Message.hpp>
#include <Arduino.h>                 // C/C++ header (passed through)
#include <lvgl.h>                    // external library header
```

- Quoted `.cnx` includes resolve **relative to the including file**
- Angle bracket `.cnx` includes resolve via **cnext config `include` array** (for external libraries like PlatformIO lib_deps)
- In C++ mode (`cppRequired: true`), `.cnx` includes transpile to `.hpp`. In C mode, `.h`
- C/C++ headers pass through unchanged

## Preprocessor

```cnx
#define ARDUINO                      // flags OK for conditional compilation
#define DEBUG

#ifdef ARDUINO
// platform-specific code
#endif

// #define MAX_SIZE 100              // FORBIDDEN: use const instead
const u32 MAX_SIZE <- 100;          // correct
```

`#define` with values is forbidden. Use `const` for values, `#define` only for flags.

## Constants

```cnx
const u32 BUFFER_SIZE <- 256;
const f32 PI <- 3.14159;
const string VERSION <- "1.0.0";     // auto-sized string
```

Constants are compile-time values with fixed addresses (can be passed to functions).

## Callbacks (ADR-029: Function-as-Type)

A function definition creates both a callable function AND a type. Callbacks are never null.

```cnx
// Define callback type + default implementation
void onReceive(const CAN_Message msg) {
    // no-op default
}

// Use as struct field type
struct Controller {
    onReceive handler;               // initialized to onReceive (never null)
}

// User provides implementation
void myHandler(const CAN_Message msg) {
    Serial.println(msg.id);
}

controller.handler <- myHandler;     // OK: signatures match
controller.handler(msg);             // always safe to call
```

**Nominal typing:** Type identity is the function NAME, not just signature. Two callbacks with identical signatures are different types.

### Scope Function as Callback

```cnx
scope LvglPort {
    private void disp_flush(lv_display_t disp, const lv_area_t area, u8 px_map) {
        // ...
    }

    void init() {
        lv_display_t disp <- lv_display_create(480, 480);
        lv_display_set_flush_cb(disp, this.disp_flush);
    }
}
```

`this.functionName` passes the scope function as a callback.

## ISR (ADR-040)

`ISR` is a built-in type for `void(void)` functions (interrupt handlers). Any `void name()` function is an `ISR`. Use it as a parameter or struct-field type, pass a handler by name, and invoke it:

```cnx
void timerHandler() { }

void registerHandler(ISR handler) { handler(); }   // invoke via the param

struct InterruptController {
    ISR onTick;                                     // ISR-typed field
}

registerHandler(timerHandler);                       // pass by name
```

## Atomic Types (ADR-049)

```cnx
atomic u32 counter <- 0;
atomic clamp u8 brightness <- 0;
atomic bool ready <- false;

counter +<- 1;                       // lock-free on Cortex-M3+ (LDREX/STREX)
brightness +<- 10;                   // atomic add with clamp
ready <- true;                       // atomic store
u32 val <- counter;                  // atomic load
```

Transpiles to LDREX/STREX loops on Cortex-M3+, critical sections on Cortex-M0.

`volatile` is a separate modifier (ADR-108) that stops the compiler caching a variable (C `volatile` semantics) — for memory-mapped/shared flags that aren't lock-free atomics: `volatile u32 status <- 0;`. It is **distinct from `atomic`** (lock-free ISR-safe ops); combining them (`atomic volatile`) is a compile error.

## Critical Sections (ADR-050)

```cnx
critical {
    buffer[writeIdx] <- data;
    writeIdx +<- 1;
}
// No return/break/continue inside critical blocks
```

## Register Bindings (ADR-004)

```cnx
register GPIO7 @ 0x42004000 {
    DR:         u32 rw @ 0x00,
    GDIR:       u32 rw @ 0x04,
    PSR:        u32 ro @ 0x08,
    DR_SET:     u32 wo @ 0x84,
    DR_CLEAR:   u32 wo @ 0x88,
}

GPIO7.DR <- 0xFF;
GPIO7.DR_SET[3] <- true;            // atomic set bit 3
bool bit <- GPIO7.PSR[3];           // read bit 3
```

Access modes: `rw` (read-write), `ro` (read-only), `wo` (write-only), `w1c` (write-1-to-clear), `w1s` (write-1-to-set). Violating a mode (reading a `wo`, writing a `ro`) is a compile error.

A register field can be typed by a **bitmap** for named bit-field access:

```cnx
bitmap8 UartControl { Enable, TxEnable, RxEnable, Parity, StopBits, DataBits[2], Reserved }
register UART @ 0x40010000 {
    CTRL: UartControl rw @ 0x00,
}
UART.CTRL.Enable   <- true;     // named field write
UART.CTRL.DataBits <- 3;
bool en <- UART.CTRL.Enable;    // named field read
```

## MISRA Compliance

C-Next enforces several MISRA C:2012 rules at the language level:

| Rule | Enforcement                                                |
| ---- | ---------------------------------------------------------- |
| 10.1 | No signed shift operands; hex masks use unsigned literals  |
| 12.2 | Shift amount must be < type bit width                      |
| 13.5 | No function calls in `if`/`while`/`do-while` conditions    |
| 14.4 | Conditions must be boolean comparisons, not bare variables |
| 9.3  | No partial array initialization                            |
| 17.2 | No recursion                                               |
| 10.3 | No implicit narrowing conversions                          |
| 11.1 | No function pointer type conversions                       |

### MISRA 13.5 Pattern

```cnx
// WRONG: function call in condition
if (config.enabled && manager.isReady()) { }
while (global.twai_receive(msg, 0) = ESP_OK) { }

// RIGHT: extract to variable
bool ready <- manager.isReady();
if (config.enabled && ready) { }

esp_err_t result <- global.twai_receive(msg, 0);
while (result = ESP_OK) {
    this.process(msg);
    result <- global.twai_receive(msg, 0);
}
```

### MISRA 12.2 Pattern

```cnx
// WRONG: shifting u8 by 8 (equals type width)
u8 val <- 1;
u16 result <- val << 8;             // ERROR

// RIGHT: widen first
u16 wide <- val;
u16 result <- wide << 8;            // OK: 8 < 16
```

---

# Part 2: C/C++ Interop

## Calling C Functions

C functions from included headers are called with `global.` prefix (or bare if unambiguous):

```cnx
#include <Arduino.h>

void setup() {
    Serial.begin(115200);            // implicit global resolution
    global.pinMode(LED_PIN, OUTPUT); // explicit global
    delay(100);                      // implicit global
}
```

C library **globals** are usable directly by their C name: `extern` variables (read / write / compound-assign), `const` externs, extern arrays, and `#define` macro constants from included headers — e.g. `extern_counter <- 42;`, `u32 m <- MAX_SIZE;`. (Defining a _value_ macro is still forbidden in your own C-Next code — that rule doesn't apply to C headers.)

## Using C Struct Types

C struct types from headers work with named field initialization:

```cnx
#include <driver/spi_master.h>

spi_bus_config_t cfg <- {
    mosi_io_num: 1,
    miso_io_num: -1,
    sclk_io_num: 2,
    quadwp_io_num: -1,
    quadhd_io_num: -1,
    max_transfer_sz: 64
};
```

Locally initialized C structs are passed by reference automatically (ADR-006):

```cnx
// twai_driver_install expects pointers — transpiler adds & automatically
esp_err_t err <- global.twai_driver_install(g_config, t_config, f_config);
// generates: twai_driver_install(&g_config, &t_config, &f_config);
```

## Using C Enum Types

C enum types from headers work as variable types and constant values:

```cnx
#include <driver/twai.h>
#include <driver/gpio.h>

// Use C enum type directly with its constants
const gpio_num_t TX_PIN <- GPIO_NUM_19;
const gpio_num_t RX_PIN <- GPIO_NUM_20;

// In struct initialization
twai_general_config_t cfg <- {
    mode: TWAI_MODE_NORMAL,        // twai_mode_t enum value
    tx_io: TX_PIN,                 // gpio_num_t enum value
    rx_io: RX_PIN
};
```

**Important:** C++ is strict about int-to-enum conversion. Use the enum constants (`GPIO_NUM_19`) not bare integers (`19`), or the C++ compiler will reject it.

## Constructing C++ Objects

In C++ mode you can instantiate C++ library classes (e.g. Adafruit drivers) two ways:

```cnx
// Constructor arguments — args must be const variables, NOT literals
const u8 csPin <- 10;
Adafruit_MAX31856 tc(csPin);              // → Adafruit_MAX31856 tc(csPin);

// Aggregate / field initialization
DefaultConstructible obj <- { value: 42, name: "label" };

// Arrays default-construct each element
DefaultConstructible[3] sensors;
```

A bare literal constructor argument (`tc(10)`) is a parse error — bind a `const` first. Works inside scopes too.

## C++ Template Types

C++ template-instantiation syntax is parsed and passed through to C++ unchanged — use it for templated library types (Issue #291):

```cnx
FlexCAN_T4<CAN1, RX_SIZE_256, TX_SIZE_16> canBus;   // identifier args
Buffer<256, 16> buf;                                 // integer args
```

## C Struct Member Access

### Union and Bitfield Members

C structs with unions and bitfields are accessed directly:

```cnx
twai_message_t msg;
// Bitfield access in union
if (msg.extd = 1) {              // extended frame flag
    u32 id <- msg.identifier;    // 29-bit CAN ID
}
u8 dlc <- msg.data_length_code;  // regular field
```

### Array Fields

Array members on C structs are indexed normally:

```cnx
u8 i <- 0;
while (i < msg.data_length_code) {
    global.Serial.print(msg.data[i], 16);    // hex print each byte
    i +<- 1;
}
```

## Opaque/Handle Types

C libraries often use opaque pointer types (e.g., `esp_lcd_panel_handle_t` = `void*`). These work as scope variables and function parameters. The transpiler manages the pointer nature.

```cnx
scope Display {
    private esp_lcd_panel_handle_t panel_handle;    // stored as pointer internally

    void init() {
        esp_lcd_new_rgb_panel(rgb_config, this.panel_handle);
        esp_lcd_panel_init(this.panel_handle);
    }
}
```

## Nullable C Interop (ADR-046)

C-Next types are never null. C library return values that CAN be null require `c_` prefix.

```cnx
#include <stdio.h>

// Nullable C return → requires c_ prefix
FILE c_file <- fopen("data.txt", "r");
if (c_file != NULL) {
    // use c_file
    fclose(c_file);
}

// Non-nullable C-Next variable → NO c_ prefix
string<64> buffer;                   // always valid
u32 count <- 0;                      // always valid
```

**Rules:**

- `c_` prefix REQUIRED for variables holding nullable C pointer returns
- `c_` prefix FORBIDDEN on non-nullable types (error E0906)
- A `c_` variable must be **NULL-checked before use** — using it unguarded is `E0908` (`FILE c_file <- fopen(...); fclose(c_file);` ✗ → wrap in `if (c_file != NULL) { … }`)
- NULL comparison only allowed on `c_`-prefixed variables
- `malloc`/`calloc`/`realloc`/`free` FORBIDDEN (ADR-003)

### When c\_ IS Needed

| Returns pointer that can be NULL | Example                                         |
| -------------------------------- | ----------------------------------------------- |
| `fopen()`                        | `FILE c_file <- fopen(...)`                     |
| `lv_display_create()`            | `lv_display_t c_disp <- lv_display_create(...)` |
| `lv_label_create()`              | `lv_obj_t c_label <- lv_label_create(...)`      |

### When c\_ is NOT Needed

| Returns non-pointer or C-Next type | Example                |
| ---------------------------------- | ---------------------- |
| Primitive return values            | `u32 len <- strlen(s)` |
| C-Next variables                   | `u32 count <- 0`       |
| Scope members                      | `this.value`           |

## C Boundary Layer for void\* (ADR-061)

C-Next has **no void\* type** by design. When a C function takes `void*` (e.g., `lv_image_set_src`), you MUST write a thin C boundary file. Data stays in `.cnx`, only the unsafe cast lives in `.h/.c`.

**Pattern:** `.cnx` (safe data) → `.h` boundary (unsafe void\* cast) → C library

```cnx
// --- needle_img.cnx (safe data in C-Next) ---
#include <lvgl.h>

scope NeedleImg {
    u8[14400] map <- [0x00, 0x00, /* ... */];
    lv_image_dsc_t dsc <- {
        header: {cf: LV_COLOR_FORMAT_ARGB8888, w: 180, h: 20},
        data_size: 14400,
        data: this.map                  // scope var ref works in struct init
    };
}
```

```c
// --- needle_img_boundary.h (C boundary — void* cast only) ---
#include "needle_img.hpp"              // generated header from .cnx
static inline lv_obj_t * create_needle_img(lv_obj_t * parent) {
    lv_obj_t * img = lv_image_create(parent);
    lv_image_set_src(img, &NeedleImg_dsc);  // void* cast happens in C
    return img;
}
```

```cnx
// --- gauge.cnx (uses the boundary wrapper) ---
#include "needle_img.cnx"
#include "needle_img_boundary.h"

scope Gauge {
    void create() {
        lv_obj_t scale <- lv_scale_create(scr);
        lv_obj_t needle <- global.create_needle_img(scale);
    }
}
```

**Rules:**

- The `.h` boundary file MUST have a different base name than the `.cnx` file (E0504)
- Keep boundary files minimal — only the void\* cast, nothing else
- Data, constants, and descriptors belong in `.cnx`

## Variadic C Function Calls

C variadic functions (`printf`, `lv_label_set_text_fmt`, etc.) work directly — no wrapper needed:

```cnx
global.lv_label_set_text_fmt(this.speed_label, "%d mph", speed);
// generates: lv_label_set_text_fmt(GaugeSpeed_speed_label, "%d mph", *speed);
```

## Scope Variable References in Struct Initializers

Scope variables can be referenced in struct initializers, including arrays that decay to pointers in C:

```cnx
scope NeedleImg {
    u8[14400] map <- [ /* data */ ];
    lv_image_dsc_t dsc <- {
        header: {cf: LV_COLOR_FORMAT_ARGB8888, w: 180, h: 20},
        data_size: 14400,
        data: this.map                  // → .data = NeedleImg_map
    };
}
```

Nested struct init with C enum constants works — enum values resolve inside nested fields.

## Anonymous Nested Structs (ESP-IDF style)

C structs with anonymous nested structs (common in ESP-IDF) **can be initialized inline** with nested `{ … }` (Issue #882):

```cnx
PanelConfig panel <- {
    clk_src: 1,
    timings: { clock_hz: 16000000, h_res: 800, v_res: 480 },
    flags:   { fb_in_psram: 1, double_fb: 0 }      // nested anon-struct init works
};
```

Partial init of the nested part is fine. (Setting fields after construction — `panel.flags.fb_in_psram <- true;` — also works.)

---

# Part 3: Common AI Mistakes

### 1. Wrong assignment/comparison operators

```cnx
// WRONG
x = 5;                               // This is COMPARISON, not assignment
if (x == 5) { }                      // == doesn't exist

// RIGHT
x <- 5;                              // assignment
if (x = 5) { }                       // comparison
```

### 2. C-style array init

```cnx
// WRONG
u8[3] data <- {1, 2, 3};            // {} is for structs

// RIGHT
u8[3] data <- [1, 2, 3];            // [] for arrays
```

### 3. Using pointers

```cnx
// WRONG — no pointer syntax exists
u32* ptr <- &value;
ptr->field <- 5;

// RIGHT — everything is pass-by-reference automatically
void modify(u32 x) { x <- 5; }      // modifies original
```

### 4. Using malloc/dynamic allocation

```cnx
// WRONG — forbidden (ADR-003)
void c_buf <- heap_caps_malloc(size, MALLOC_CAP_SPIRAM);

// RIGHT — static allocation
u8[46080] buf;
```

### 5. Missing c\_ prefix on nullable returns

```cnx
// WRONG — E0906 if type IS nullable, E0905 if missing prefix
lv_display_t disp <- lv_display_create(480, 480);

// RIGHT (if the C function returns a pointer that can be NULL)
lv_display_t c_disp <- lv_display_create(480, 480);
```

### 6. Bare bool in conditions

```cnx
// WRONG
if (flag) { }
do { } while (running);
u32 x <- flag ? 1 : 0;

// RIGHT
if (flag = true) { }
do { } while (running = true);
u32 x <- (flag = true) ? 1 : 0;
```

### 7. Function call in if/while condition

```cnx
// WRONG — MISRA 13.5
if (sensor.read() > threshold) { }
while (queue.pop(item) = true) { }

// RIGHT
u32 val <- sensor.read();
if (val > threshold) { }

bool got <- queue.pop(item);
while (got = true) {
    process(item);
    got <- queue.pop(item);
}
```

### 8. Narrowing cast

```cnx
// WRONG
u8 byte <- (u8)bigValue;

// RIGHT
u8 byte <- bigValue[0, 8];
```

### 9. Increment/decrement operators

```cnx
// WRONG — no ++ or -- in C-Next
x++;
--y;

// RIGHT
x +<- 1;
y -<- 1;
```

### 10. Break/continue

```cnx
// WRONG — break/continue don't exist
while (true) {
    if (done) break;
}

// RIGHT — structured conditions
while (!done) {
    process();
}
```

### 11. Type aliases

```cnx
// WRONG — type aliases don't exist (ADR-019 rejected)
type Byte <- u8;

// RIGHT — use the type directly
u8 value <- 0;
```

### 12. Bitmap with wrong size

```cnx
// WRONG — bits don't sum to 8
bitmap8 Bad {
    A,          // 1
    B,          // 1
    C[3]        // 3  → total 5, not 8!
}

// RIGHT — must sum exactly
bitmap8 Good {
    A,          // 1
    B,          // 1
    C[3],       // 3
    Reserved[3] // 3  → total 8
}
```

### 13. Using integer for C enum fields

```cnx
// WRONG — C++ rejects int-to-enum conversion
twai_general_config_t cfg <- { tx_io: 19, rx_io: 20 };

// RIGHT — use enum constants
twai_general_config_t cfg <- { tx_io: GPIO_NUM_19, rx_io: GPIO_NUM_20 };
```

### 14. Trying to pass void\* in C-Next

```cnx
// WRONG — C-Next has no void* (ADR-061)
global.lv_image_set_src(img, this.dsc);     // ERROR: can't convert to void*

// RIGHT — use a C boundary file for void* casts
// In .h boundary: lv_image_set_src(img, &NeedleImg_dsc);
// In .cnx: call the C wrapper
lv_obj_t needle <- global.create_needle_img(this.scale);
```

### 15. Same base name for .h and .cnx files

```cnx
// WRONG — E0504: same base name conflict
#include "needle_img.cnx"
#include "needle_img.h"                 // ERROR: needle_img exists as .cnx

// RIGHT — use a different name for the boundary file
#include "needle_img.cnx"
#include "needle_img_boundary.h"        // different base name — OK
```

### 16. C-style string concatenation with macros

```cnx
// WRONG — C-Next parser doesn't support adjacent string literal concatenation with macros
global.lv_label_set_text_fmt(label, "%" PRId32 " C", temp);

// RIGHT — use format specifier directly
global.lv_label_set_text_fmt(label, "%d C", temp);
```

### 17. Sign change on widening assignment

```cnx
// WRONG — u16 → i32 is FORBIDDEN even though u16 fits in i32 (sign changes)
u16 raw <- 7456;
i32 wide <- raw;                        // ERROR: sign change (unsigned → signed)

// RIGHT — use bit extraction to widen across sign boundary
i32 wide <- raw[0, 16];                 // explicit 16-bit extraction → i32
```

---

# Part 4: Transpilation Reference

## Transpilation Summary

| C-Next                            | Generated C                                               |
| --------------------------------- | --------------------------------------------------------- |
| `x <- 5`                          | `x = 5`                                                   |
| `if (x = 5)`                      | `if (x == 5)`                                             |
| `x +<- 1`                         | `x += 1`                                                  |
| `void f(u32 x)` (x modified)      | `void f(uint32_t *x)` — or `uint32_t x` if read-only      |
| `f(myVar)`                        | `f(&myVar)`                                               |
| `scope S { private void f() {} }` | `static void S_f(void) {}`                                |
| `scope S { void f() {} }`         | `void S_f(void) {}` + header (public by default)          |
| `S.f()`                           | `S_f()`                                                   |
| `u8[5] a <- [1,2,3,4,5]`          | `uint8_t a[5] = {1,2,3,4,5}`                              |
| `string<64> s <- "hi"`            | `char s[65] = "hi"`                                       |
| `s.char_count`                    | `strlen(s)`                                               |
| `s.capacity`                      | `64`                                                      |
| `flags[3] <- true`                | bit-set expression                                        |
| `val[0, 8]`                       | `(val >> 0) & 0xFF`                                       |
| `x[8,8] <- v[0,4]`                | clear 8-bit window + write 4-bit value (zero-extended)    |
| `atomic u32 x`                    | `volatile uint32_t x` + LDREX/STREX                       |
| `volatile u32 x`                  | `volatile uint32_t x` (no atomics)                        |
| `critical { ... }`                | PRIMASK save/disable/restore                              |
| `#include "x.cnx"`                | `#include "x.hpp"` (C++ mode) / `#include "x.h"` (C mode) |
| `#include <x.cnx>`                | `#include <x.hpp>` (C++ mode) / `#include <x.h>` (C mode) |

## Known Transpiler Issues

| Issue                                                                                                                                 | Version | Status          |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------- |
| #967: Symbol cache cross-language conflict on scoped method names                                                                     | v0.2.12 | FIXED (v0.2.15) |
| #981: Macro-sized array field on local struct generates bit extraction instead of array index (`msg.data[3]` → `(msg.data >> 3) & 1`) | v0.2.15 | FIXED (v0.2.16) |
