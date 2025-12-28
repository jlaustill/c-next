# ADR-002: Namespaces Over Static Classes

**Status:** Approved
**Date:** 2025-12-25
**Updated:** 2025-12-28
**Decision Makers:** C-Next Language Design Team

## Context

Embedded systems code includes both **hardware peripherals** (often multiple instances) and **application-level services** (true singletons). It's important to distinguish these:

**Hardware peripherals are often NOT singletons:**
- Teensy 4.0 has 8 UARTs, 3 CAN buses, 2 ADCs
- STM32H7 has 8 USARTs, 2 FDCANs, 3 ADCs
- These should be **classes** — same code, different instances

**Application services ARE typically singletons:**
- One Console (that may use a UART internally)
- One Logger
- One Math utility library
- One application-specific state machine

In C, developers organize singleton services through **naming conventions**:

```c
// Manual namespacing via prefixes
static LogLevel Console_logLevel;
static bool Console_initialized;

void Console_Init(void) { ... }
void Console_Print(const char* msg) { ... }
void Console_SetLogLevel(LogLevel level) { ... }
```

This pattern is universal in embedded C codebases. However, it has limitations:

1. **No compiler enforcement** — Nothing prevents `Console_logLevel` from being accessed outside its "module"
2. **Verbose and error-prone** — Every function and variable must repeat the prefix
3. **No scoping** — All prefixed names share the global namespace
4. **Inconsistent conventions** — `Console_Init` vs `console_init` vs `ConsoleInit`

### The Static Class Anti-Pattern

Some languages use **static classes** to organize singleton-like functionality:

```java
// Java
public final class Math {
    private Math() {}  // Prevent instantiation
    public static double sin(double a) { ... }
    public static double cos(double a) { ... }
}
```

```csharp
// C#
public static class Console {
    public static void WriteLine(string value) { ... }
}
```

This works, but conflates two separate concepts:

> "The class `java.lang.Math` is really just a namespace for a batch of functions and is not, in any sense, a classification of objects. This conflation of object classification and namespaces is confusing and unnecessary."
> — [Uncle Bob: Functional Classes](https://blog.cleancoder.com/uncle-bob/2023/01/18/functional-classes.html)

### Modern Language Evolution

Modern languages have learned to separate these concerns:

**Go (2009)** uses packages for namespacing, structs for data:
> "Rather than conflate the concepts of record types, modules, and traits in this God-concept of 'class,' [Go] keeps these three concepts quite separate."

**Rust (2015)** uses modules for namespacing, structs + traits for types:
> "There is no inheritance in Rust... Rust uses traits to define shared behavior."
> — [The Coded Message](https://www.thecodedmessage.com/posts/oop-3-inheritance/)

### Application Services vs Hardware Peripherals

While individual hardware peripheral *instances* are singletons (there's only one UART1 at address 0x40011000), the *type* UART often has multiple instances. This is why hardware peripherals should be **classes** in C-Next.

However, application-level services are true singletons:

> "The singleton pattern ensures that only one instance of each [resource] exists in the entire program. This avoids common bugs caused by multiple pieces of code trying to modify the same [resource] simultaneously."
> — [The Embedded Rust Book](https://doc.rust-lang.org/stable/embedded-book/peripherals/singletons.html)

For application services like `Console`, `Logger`, or `Math`, there genuinely is only one — and namespaces are the right tool.

## Decision

C-Next provides **namespaces** as a first-class scoping mechanism for organizing singleton services.

### Visibility: Private by Default

Like classes (ADR-005), namespace members are **private by default**. Only members marked `public` are accessible outside the namespace:

```cnx
namespace Console {
    UART* uart;              // private (default) - internal state
    LogLevel logLevel;       // private (default) - internal state

    public void init(UART* u) {
        uart <- u;
        logLevel <- LogLevel.Info;
    }

    public void print(const char* msg) {
        uart.send(msg);
    }

    public void setLogLevel(LogLevel level) {
        logLevel <- level;
    }
}
```

Another classic example — utility functions with no state:

```cnx
namespace Math {
    public f32 sin(f32 x) { ... }
    public f32 cos(f32 x) { ... }
    public f32 sqrt(f32 x) { ... }
    public f32 clamp(f32 value, f32 min, f32 max) { ... }

    f32 taylorTerm(f32 x, u8 n) { ... }  // private helper
}
```

This ensures consistency with classes: one rule to remember — **everything is private unless marked `public`**.

### Transpilation

Namespaces transpile to C's established prefix convention:

```c
// Generated C
// private members (default) transpile to static (file-scope only)
static UART* Console_uart;
static LogLevel Console_logLevel;

// public members transpile without static
void Console_init(UART* u) {
    Console_uart = u;
    Console_logLevel = LogLevel_Info;
}

void Console_print(const char* msg) {
    UART_send(Console_uart, msg);
}

void Console_setLogLevel(LogLevel level) {
    Console_logLevel = level;
}
```

### Usage

Namespace members are accessed with dot notation:

```
Console.init(uart1);
Console.print("Hello, world!");
Console.setLogLevel(LogLevel.Debug);
```

Transpiles to:

```c
Console_init(uart1);
Console_print("Hello, world!");
Console_setLogLevel(LogLevel_Debug);
```

### Key Properties

1. **Namespaces are not types** — You cannot instantiate a namespace
2. **Namespaces are singletons** — There is exactly one `Console`, one `Math`
3. **Private by default** — Members are private unless marked `public` (consistent with classes)
4. **All members are implicitly static** — They belong to the namespace, not an instance

## Alternatives Considered

### Alternative 1: Use C++ Namespaces

C++ has `namespace` but it only provides name scoping, not data encapsulation:

```cpp
namespace Console {
    static LogLevel logLevel;  // Still visible to anyone who includes the header
}
```

**Rejected.** C++ namespaces don't provide the encapsulation we want, and C-Next transpiles to C, not C++.

### Alternative 2: Use Static Classes (C#/Java Style)

```
static class Console {
    static LogLevel logLevel;
    void init() { ... }
}
```

**Rejected.** This conflates namespacing with classification. A namespace is not a class — it has no instances, no constructors, no inheritance. Using `class` keyword implies things that don't apply.

### Alternative 3: Use Modules (Rust/Go Style)

Make each file implicitly a module with the file name as namespace.

**Rejected for now.** While elegant, this couples code organization to file structure. C-Next aims to drop into existing C projects where file organization may be constrained. Explicit namespaces are more flexible.

### Alternative 4: Keep C's Manual Prefix Convention

Just use `Console_init()` everywhere like C developers already do.

**Rejected.** This provides no compiler enforcement, no scoping, and no encapsulation. The prefix convention works but C-Next can do better.

## Consequences

### Positive

1. **Formalizes existing C patterns** — Embedded developers already think this way
2. **Compiler-enforced scoping** — `private` members are truly encapsulated
3. **Clean transpiled output** — Generated C is idiomatic and familiar
4. **Right tool for singletons** — Application services, utility libraries
5. **Simpler than classes** — No constructors, destructors, inheritance, vtables

### Negative

1. **Different from C++** — C++ `namespace` means something different
2. **Learning curve** — Developers must understand namespace ≠ class
3. **Single instance only** — When you need multiple instances, you need a class (separate ADR)

### Neutral

1. **File organization is independent** — Multiple namespaces can live in one file, or one namespace can span files

## Relationship to Classes

Namespaces are for **singleton services**. When you need **multiple instances** of something, you need a **class**. Classes are first-class citizens in C-Next (without inheritance). That is documented in a future ADR.

| Need | C-Next Construct |
|------|------------------|
| One system console | `namespace Console { ... }` |
| Math utilities | `namespace Math { ... }` |
| Application state machine | `namespace AppState { ... }` |
| 8 UART peripherals | `class UART { ... }` (future ADR) |
| 3 ring buffers | `class RingBuffer { ... }` (future ADR) |
| Multiple motor controllers | `class MotorController { ... }` (future ADR) |

## Implementation Notes

The transpiler:

1. Collects all members of a namespace
2. Prefixes each with `NamespaceName_`
3. Converts `.` access to `_` in function calls
4. Transpiles `private` members with C's `static` keyword (file-scope linkage)
5. Transpiles public members without `static` (external linkage)

No runtime overhead. No vtables. No dynamic dispatch. Just organized, scoped C code.

## References

### Language Design Philosophy
- [Uncle Bob: Functional Classes](https://blog.cleancoder.com/uncle-bob/2023/01/18/functional-classes.html) — "java.lang.Math is just a namespace"
- [The Coded Message: Rust Is Beyond OO](https://www.thecodedmessage.com/posts/oop-3-inheritance/) — Separating modules from types
- [Medium: Why Go Chose Composition](https://medium.com/@harshithgowdakt/why-go-chose-composition-over-inheritance-and-you-should-too-ac1a89524202)
- [YourBasic: OOP without inheritance in Go](https://yourbasic.org/golang/inheritance-object-oriented/)

### Embedded Systems Patterns
- [The Embedded Rust Book: Singletons](https://doc.rust-lang.org/stable/embedded-book/peripherals/singletons.html) — When singletons are appropriate
- [mbedded.ninja: C++ On Embedded Systems](https://blog.mbedded.ninja/programming/languages/c-plus-plus/cpp-on-embedded-systems/)
- [Stratify Labs: Singletons in Embedded C++](https://blog.stratifylabs.dev/device/2021-11-29-Using-Singletons-in-embedded-cpp/)

### C Naming Conventions
- [EJRH: Namespaces in C](https://ejrh.wordpress.com/2012/01/24/namespaces-in-c/) — Prefix conventions
- [Buildstorm: C Naming Conventions for Embedded](https://buildstorm.com/blog/c-naming-conventions-and-style-guide-for-embedded-firmware-project/)
- [Embedded.com: Adopting C Programming Conventions](https://www.embedded.com/adopting-c-programming-conventions/)
- [MaJerle C Code Style Guide](https://github.com/MaJerle/c-code-style)

### Composition Over Inheritance
- [silverweed: Composition over Inheritance lessons learned](https://silverweed.github.io/Composition_over_Inheritance_lessons_learned/)
- [Wikipedia: Composition over Inheritance](https://en.wikipedia.org/wiki/Composition_over_inheritance)
- [Thoughtworks: Composition vs Inheritance](https://www.thoughtworks.com/insights/blog/composition-vs-inheritance-how-choose)
- [30DaysCoding: Limitations of Inheritance in OOP](https://30dayscoding.com/blog/limitations-of-inheritance-in-oop)
