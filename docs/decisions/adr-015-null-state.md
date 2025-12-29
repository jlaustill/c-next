# ADR-015: Null State and Zero Initialization

**Status:** Implemented
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

## Proposed Approach: Explicit Zero Initialization

> **Note:** This is a draft proposal. The final decision is pending further research and discussion.

**Option A (Go-style):** All C-Next variables are zero-initialized by default.

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

## Research: Go's Zero Initialization Experience

Go has used zero initialization since 2009. Research into Go's bug history shows:

### What Works Well

| Type | Zero Value | Read | Write | Result |
|------|------------|------|-------|--------|
| `int`, `bool`, `struct` | `0`, `false`, `{0}` | ✅ Safe | ✅ Safe | **No issues** |
| `sync.Mutex` | unlocked | ✅ Safe | ✅ Safe | **Brilliant design** |
| `bytes.Buffer` | empty | ✅ Safe | ✅ Safe | **Ready to use** |

Go's philosophy of "make the zero value useful" works excellently for **value types**.

### Where Go Has Problems

| Type | Zero Value | Read | Write | Result |
|------|------------|------|-------|--------|
| `map` | `nil` | ✅ Returns zero | ❌ **Panic** | Runtime crash |
| `slice` | `nil` | ✅ Safe | ❌ **Panic** | Must use `append` |
| `pointer` | `nil` | ❌ **Panic** | ❌ **Panic** | Null pointer |
| `channel` | `nil` | ❌ Blocks forever | ❌ Blocks forever | Deadlock |

The issues arise from **reference types**, not value types. There's an [open proposal](https://github.com/golang/go/issues/39572)
debating whether nil map reads should panic instead of silently returning zero.

### Why C-Next Avoids Go's Problems

C-Next sidesteps these issues by design:

- **No maps/slices**: Static allocation only (ADR-003)
- **No pointers in user code**: Pass-by-reference hides them (ADR-006)
- **Structs are values**: Zero initialization is always safe
- **No channels**: Not applicable to embedded

C-Next operates in **Go's safe subset** where zero initialization is proven to work.

## Research: Rust's Compile-Time Enforcement

Rust takes the opposite approach: **uninitialized variables are compile errors**.

### Benefits

Microsoft's security team found that **70% of CVEs are memory safety issues** that Rust prevents:

> "By phasing out C++ code with Rust code, a whole class of vulnerabilities could be eliminated."
> — [Visual Studio Magazine](https://visualstudiomagazine.com/articles/2019/07/18/microsoft-eyes-rust.aspx)

On December 16, 2025, the first Rust CVE appeared in the Linux kernel. **On the same day, C had 159 CVEs**.
The Rust bug only causes crashes, not code execution—a testament to memory safety.

### Tradeoffs

Rust's strict checking creates developer friction:

> "Fighting the compiler will be an awfully frustrating experience... this is always done in our best interests."
> — [Rust Reviewed](https://dev.to/somedood/rust-reviewed-is-the-hype-justified-1pa1)

Common issues include:
- [False positives](https://github.com/rust-lang/rust/issues/106377) where the compiler claims variables are uninitialized when they aren't
- [Confusing error messages](https://github.com/rust-lang/rust/issues/72649) that say "borrowed after move" instead of "uninitialized"
- Closures that [can't initialize variables](https://github.com/rust-lang/rust/issues/41124) even when they obviously would

The learning curve is real: ["Senior engineers may struggle for weeks/months or even give up entirely"](https://corrode.dev/blog/flattening-rusts-learning-curve/).

### Arguments For Zero-Init Over Compile Errors

1. **Embedded reality**: Variables often initialized in `init()`, not at declaration
2. **Simpler mental model**: Every variable has a value, always
3. **No false positives**: Zero-init can't have "possibly uninitialized" bugs
4. **C interop**: Matches C static initialization semantics
5. **Target audience**: Embedded developers want predictability, not compiler battles

### Arguments For Compile-Time Errors (Rust-style)

1. **Catches bugs earlier**: Reading before writing is almost always a bug
2. **Explicit intent**: Forces developer to think about initial state
3. **No silent failures**: Zero might not be the right default (e.g., divisor = 0)
4. **Proven safety**: Microsoft's 70% CVE reduction data is compelling
5. **Optional middle ground**: Could be a warning instead of error

## Summary: Options Under Consideration

| Approach | Pros | Cons |
|----------|------|------|
| **C (undefined)** | Fast | Bugs, CVEs, undefined behavior |
| **Rust (compile error)** | Safest | Learning curve, false positives, friction |
| **Go (zero value)** | Simple, safe for value types | Panics on reference types |

### Possible C-Next Approaches

| Option | Description | Tradeoff |
|--------|-------------|----------|
| **A: Go-style** | Zero-init all variables | Simple, but hides "forgot to init" bugs |
| **B: Rust-style** | Compile error on use before init | Safe, but friction and false positives |
| **C: Hybrid warning** | Zero-init + warn on use before init | Best of both? Or worst of both? |
| **D: Opt-in strictness** | Zero-init default, `--strict` flag for errors | Flexibility, but inconsistent codebases |

### Open Questions

1. **Is zero always safe?** What about `divisor <- 0` then dividing by it?
2. **Does the global + init() pattern require zero-init?** Or could we detect it?
3. **Would Rust-style checking be simpler for C-Next?** We have no lifetimes/borrowing.
4. **What do embedded developers actually want?** Need user research.

### Key Insight

C-Next avoids Go's reference type problems (nil map panic, nil pointer crash) because
C-Next is **all value types**. This makes zero-init safer than in Go, but doesn't
necessarily make it the *right* choice.

## References

- ADR-003: Static Allocation (startup allocation context)
- ADR-005: Classes Without Inheritance (global + init pattern)
- ADR-014: Structs (struct zero initialization)
- [Go Language Specification: Zero Value](https://go.dev/ref/spec#The_zero_value)
- [Go Zero Values Make Sense, Actually](https://yoric.github.io/post/go-nil-values/)
- [Understanding Zero Values in Go](https://www.victorpierre.dev/blog/zero-values-in-go/)
- [Microsoft Eyes Rust for Memory Safety](https://visualstudiomagazine.com/articles/2019/07/18/microsoft-eyes-rust.aspx)
- [Memory-Safety Challenge Considered Solved? (Rust CVE Study)](https://arxiv.org/pdf/2003.03296)
- [Flattening Rust's Learning Curve](https://corrode.dev/blog/flattening-rusts-learning-curve/)
- [The First Rust CVE in Linux Kernel](https://itsfoss.com/news/first-linux-kernel-rust-cve/)
