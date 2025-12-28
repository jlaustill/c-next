# ADR-015: Null State and Zero Initialization

**Status:** Approved
**Date:** 2025-12-28
**Decision Makers:** C-Next Language Design Team

## Context

In C-Next, the pattern for classes (ADR-005) is:

```cnx
const u32 UART1_BASE <- 0x40011000;

UART uart1;  // Global declaration

void init() {
    uart1 <- UART(UART1_BASE);  // Initialization
}
```

This raises the question: **What is the value of `uart1` before `init()` is called?**

This applies to all variables:
- Primitives (`u32 count;`)
- Structs (`Point origin;`)
- Class instances (`UART uart1;`)
- Arrays (`u8 buffer[256];`)

## The Problem

In C, uninitialized variables have **undefined behavior**:

```c
int x;           // Could be anything: 0, garbage, nasal demons
int* ptr;        // Dangling pointer - crash waiting to happen
UART uart;       // Fields contain garbage
```

This is a source of countless bugs:
- Reading uninitialized memory
- Using garbage pointers
- Intermittent failures (works on my machine!)
- Security vulnerabilities (information leaks)

## Decision: Explicit Zero Initialization

**All C-Next variables are zero-initialized by default.**

| Type | Zero Value |
|------|------------|
| `u8`, `u16`, `u32`, `u64` | `0` |
| `i8`, `i16`, `i32`, `i64` | `0` |
| `f32`, `f64` | `0.0` |
| `bool` | `false` |
| Arrays | All elements zero |
| Structs | All fields zero |
| Class instances | All fields zero |

### C-Next Code

```cnx
u32 count;           // count = 0
bool flag;           // flag = false
u8 buffer[256];      // All bytes = 0
Point origin;        // origin.x = 0, origin.y = 0
UART uart1;          // All fields = 0
```

### Generated C

```c
uint32_t count = 0;
bool flag = false;
uint8_t buffer[256] = {0};
Point origin = {0};
UART uart1 = {0};
```

## Rationale

### Why Zero?

1. **Predictable**: Every variable has a known initial state
2. **Safe**: No garbage values, no undefined behavior
3. **Go-style**: Go uses zero values successfully ("the zero value is useful")
4. **C-compatible**: `= {0}` is valid C and widely understood
5. **No runtime cost**: Global zero-init happens in .bss, no code needed

### Why Not Require Explicit Initialization?

Rust requires explicit initialization:
```rust
let x: i32;  // Error: use of uninitialized variable
```

C-Next chooses zero-init instead because:

1. **Embedded reality**: Many variables are legitimately initialized later in `init()`
2. **Reduced boilerplate**: No need for `= 0` on every declaration
3. **Safe default**: Zero is rarely worse than compiler error, often useful
4. **C interop**: Matches C static initialization semantics

### Go's Philosophy

> "When memory is allocated to store a value, either through a declaration or make or new, and no explicit initialization is provided, the memory is given a zero value."
> — The Go Programming Language Specification

C-Next adopts this philosophy.

## Zero Values Are Useful

Go demonstrates that zero values are often the right default:

```go
var count int        // 0 - ready for counting
var buffer []byte    // nil - ready for append
var wg sync.WaitGroup // ready to use
```

In C-Next:

```cnx
u32 count;           // 0 - ready for incrementing
u8 buffer[256];      // All zeros - ready for data
bool initialized;    // false - correct initial state
```

## Implications for Classes

The global declaration + init() pattern relies on zero initialization:

```cnx
const u32 UART1_BASE <- 0x40011000;

UART uart1;  // Zero-initialized: all fields = 0

void init() {
    // Before this line, uart1 exists but is "empty"
    uart1 <- UART(UART1_BASE);
}

void main() {
    init();
    uart1.send(data, len);  // Safe: uart1 is fully initialized
}
```

### Detecting Uninitialized State

For debugging, classes can check if they've been initialized:

```cnx
class UART {
    u32 baseAddress;  // 0 if uninitialized

    public bool isInitialized() {
        return baseAddress != 0;
    }

    public void send(u8* data, u32 len) {
        // Optional: check initialization in debug builds
        // assert(isInitialized());
        ...
    }
}
```

## Default Parameter Values

Related: function parameters can have defaults using `<-`:

```cnx
void configure(u32 baudRate <- 115200, u8 dataBits <- 8) {
    ...
}

configure();              // Uses defaults: 115200, 8
configure(9600);          // baudRate=9600, dataBits=8
configure(9600, 7);       // baudRate=9600, dataBits=7
```

This is distinct from zero initialization:
- **Zero init**: Variable declaration without explicit value
- **Default params**: Function parameter with fallback value

## Implementation

### Grammar Changes

No grammar changes needed. This is a code generation decision.

### Code Generator Changes

For every variable declaration without initializer:

```typescript
// Instead of:
visitVariableDeclaration(ctx) {
    return `${type} ${name};`;  // C: undefined value
}

// Generate:
visitVariableDeclaration(ctx) {
    if (isArray) return `${type} ${name}[${size}] = {0};`;
    if (isStruct || isClass) return `${type} ${name} = {0};`;
    return `${type} ${name} = 0;`;  // Primitives
}
```

### Special Cases

| Type | Generated C |
|------|-------------|
| `u32 x;` | `uint32_t x = 0;` |
| `bool f;` | `bool f = false;` |
| `f32 v;` | `float v = 0.0f;` |
| `u8 buf[256];` | `uint8_t buf[256] = {0};` |
| `Point p;` | `Point p = {0};` |
| `UART u;` | `UART u = {0};` |

## Examples

### Before and After init()

```cnx
const u32 UART1_BASE <- 0x40011000;

UART uart1;
UART uart2;

void init() {
    uart1 <- UART(UART1_BASE);
    // uart2 intentionally left uninitialized (all zeros)
}

void main() {
    init();

    if (uart1.isInitialized()) {
        uart1.send(data, len);  // OK
    }

    if (uart2.isInitialized()) {
        uart2.send(data, len);  // Never runs - uart2.baseAddress = 0
    }
}
```

### Counter Pattern

```cnx
u32 errorCount;      // Starts at 0

void handleError() {
    errorCount +<- 1;  // Increment from 0
}
```

### Buffer Pattern

```cnx
u8 rxBuffer[1024];   // All zeros

void receive(u8 byte) {
    rxBuffer[rxIndex] <- byte;
    rxIndex +<- 1;
}
```

## Comparison with Other Languages

| Language | Uninitialized Variable |
|----------|----------------------|
| C | Undefined behavior |
| C++ | Undefined for primitives, default constructor for objects |
| Go | Zero value |
| Rust | Compile error |
| Java | Zero for primitives, null for objects |
| **C-Next** | **Zero value** |

## References

- ADR-003: Static Allocation (startup allocation context)
- ADR-005: Classes Without Inheritance (global + init pattern)
- ADR-014: Structs (struct zero initialization)
- [Go Language Specification: Zero Value](https://go.dev/ref/spec#The_zero_value)
