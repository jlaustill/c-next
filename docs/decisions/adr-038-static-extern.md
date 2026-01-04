# ADR-038: Static and Extern Keywords

## Status

**Rejected**

## Context

C's storage class specifiers:

- `static` in function: local persistence across calls
- `static` at file scope: internal linkage (private to file)
- `extern`: external linkage (defined elsewhere)

## Decision

**Rejected for v1.** C-Next will not support the `static` keyword.

Visibility control is handled by `scope` (ADR-016) instead:

- Scope members are **private by default** (generates `static` in C)
- `public` keyword exposes members (no `static` in C)

This approach is simpler and more aligned with C-Next's philosophy.

## Rationale

### Why No `static` Keyword?

#### 1. Redundant with `scope`

ADR-016's scope system already handles visibility:

```cnx
scope Motor {
    void helper() { }        // Private - generates: static void Motor_helper(void)
    public void start() { }  // Public  - generates: void Motor_start(void)
}
```

Adding `static` would be redundant:

```cnx
scope Motor {
    static void helper() { }  // Redundant - private is already default
}
```

#### 2. Static Locals Create Hidden State

Static local variables (persistence across calls) are a source of bugs:

**Thread Safety Issues:**

```c
// C code - NOT thread safe
char* strtok(char* str, const char* delim) {
    static char* buffer;  // All threads share this!
}
```

The `strtok()` function caused [JVM crashes](https://bugs.openjdk.org/browse/JDK-8214773) due to its static buffer.

**Reentrancy Problems:**

```c
// C code - NOT safe in ISR
void send_data(char* data) {
    static char buffer[10];  // Corrupted if ISR preempts
}
```

These bugs are [notoriously sporadic](https://interrupt.memfault.com/blog/arm-cortex-m-exceptions-and-nvic) in embedded systems.

**Testing Difficulties:**

```c
// C code - hard to test
int counter() {
    static int count = 0;  // Can't reset between tests!
    return ++count;
}
```

Per [Google Testing Blog](https://testing.googleblog.com/2008/12/static-methods-are-death-to-testability.html): "Static methods are death to testability."

**Hidden Dependencies:**
Static locals violate C-Next's "explicit over implicit" philosophy — function behavior depends on invisible state.

#### 3. Simpler Language

One less keyword to learn. Visibility is consistently handled through `scope` and `public`.

### The C-Next Alternative

Instead of `static`, use explicit state at scope level:

```cnx
scope Counter {
    u32 count <- 0;  // Private, visible at scope level

    public u32 next() {
        count +<- 1;
        return count;
    }
}
```

Generates:

```c
static uint32_t Counter_count = 0;

uint32_t Counter_next(void) {
    Counter_count += 1;
    return Counter_count;
}
```

Benefits:

- State is visible at scope level (not hidden inside function)
- Obvious target for thread-safety review
- Easy to reset in tests
- No hidden surprises

## What About `extern`?

The `extern` keyword for multi-file projects is a separate concern. Options:

1. **Support `extern` separately** — May still be needed for C interop
2. **Defer to a module system** — Future ADR for imports/exports
3. **Header file convention** — Use C-style headers for now

This decision is deferred to a future ADR on multi-file projects and C interoperability.

## References

- [ADR-016: Scope](./adr-016-scope.md) — Visibility control via `scope` and `public`
- [SEI CERT CON33-C: Avoid race conditions when using library functions](https://wiki.sei.cmu.edu/confluence/display/c/CON33-C.+Avoid+race+conditions+when+using+library+functions)
- [OpenJDK Bug: Thread-unsafe strtok](https://bugs.openjdk.org/browse/JDK-8214773)
- [Memfault: ARM Cortex-M Exceptions and NVIC](https://interrupt.memfault.com/blog/arm-cortex-m-exceptions-and-nvic)
- [Google Testing Blog: Static Methods are Death to Testability](https://testing.googleblog.com/2008/12/static-methods-are-death-to-testability.html)
- [MISRA C:2012 Rule 8.9](https://it.mathworks.com/help/bugfinder/ref/misrac2012rule8.9.html)
