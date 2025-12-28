# ADR-005: Classes Without Inheritance

**Status:** Approved (Pending Implementation)
**Date:** 2025-12-26
**Updated:** 2025-12-28
**Decision Makers:** C-Next Language Design Team
**Prerequisites:** ADR-014 (Structs), ADR-015 (Null State)

## Context

In embedded systems, you often have multiple instances of the same hardware:

- Teensy 4.1 has **8 UARTs**
- STM32H7 has **8 USARTs**, **3 I2Cs**, **6 SPIs**
- Most MCUs have multiple timers, ADCs, DMA channels

Without classes, you either:
1. **Copy-paste code** for each instance (violates DRY, bugs multiply)
2. **Pass everything as parameters** (verbose, error-prone)
3. **Use macros** (no type safety, debugging nightmare)

Classes solve this by bundling data and behavior. But traditional OOP classes come with baggage: inheritance hierarchies, virtual functions, the diamond problem.

### Why Arduino Uses C++

> "Arduino became popular thanks to the OOP (Object-Oriented Programming) it offers to its users."
> — [LinkedIn: Why C++ for Embedded](https://www.linkedin.com/pulse/why-c-language-choice-embedded-software-development-varteq)

> "Arduino 'language' is basically just C++. However, it is written over a custom framework of libraries specifically designed to be run on a resource-constrained embedded platform."
> — [Quora: Arduino vs C++](https://www.quora.com/Whats-the-difference-between-C-and-Arduino-language-Can-I-write-Arduino-programs-if-I-know-the-basics-maybe-a-little-more-of-C)

The key insight: Arduino uses C++ primarily for **encapsulation and code reuse**, not for deep inheritance hierarchies.

---

## Research: What Problems Do Classes Solve?

### 1. DRY Principle (Don't Repeat Yourself)

> "Every piece of knowledge must have a single, unambiguous, authoritative representation within a system."
> — [Wikipedia: Don't Repeat Yourself](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)

> "DRY minimizes the need for copy-pasting by encouraging the creation of reusable units of code, reducing the risk of introducing errors."
> — [Medium: The DRY Principle](https://medium.com/@ujjawalr/the-dry-principle-why-you-should-avoid-code-duplication-2ebdfce778a4)

Without classes, managing 8 UARTs means either:
- 8 copies of the same code (bugs get fixed in UART1, forgotten in UART5)
- One function with 8 sets of global variables (ugly, error-prone)

### 2. Encapsulation

> "Encapsulation involves combining data and the methods that operate on it into one unit. It protects data from accidental modification, enhances code organization, and streamlines interaction between program components."
> — [Stackify: What is Encapsulation](https://stackify.com/oop-concept-for-beginners-what-is-encapsulation/)

**Benefits:**
- Data protection: Private members can't be accidentally modified
- Change management: Internal implementation can change without breaking users
- Better organization: Related data and methods stay together

> "The true value of encapsulation is recognised in an environment that is prone to change. If our code is well-encapsulated, we can better manage risk in the event of a requirement change."
> — [Medium: The Importance of Code Encapsulation](https://medium.com/swlh/the-importance-of-code-encapsulation-ce19efbcfe57)

### 3. Code Reuse

> "Encapsulated classes can be reused in different programs without exposing internal logic."
> — [GeeksforGeeks: Encapsulation in C++](https://www.geeksforgeeks.org/cpp/encapsulation-in-cpp/)

A well-designed UART class can be reused across projects, MCU families, and even shared as a library.

---

## Research: What Problems Does Inheritance Cause?

### The Diamond Problem

> "The diamond problem is an ambiguity that arises when two classes B and C inherit from A, and class D inherits from both B and C. If there is a method in A that B and C have overridden, and D does not override it, then which version of the method does D inherit?"
> — [Wikipedia: Multiple Inheritance](https://en.wikipedia.org/wiki/Multiple_inheritance)

**Real-world example:**
> "In GUI software development, a class Button may inherit from both Rectangle (for appearance) and Clickable (for functionality). Both inherit from Object. Which `equals` method does Button inherit?"
> — [GeeksforGeeks: Diamond Problem](https://www.geeksforgeeks.org/cpp/diamond-problem-in-cpp/)

**Languages' responses:**
- **Java**: Banned multiple inheritance entirely
- **C++**: Added virtual inheritance (complex, overhead)
- **Go**: No inheritance at all
- **Rust**: No inheritance, uses traits

### The Fragile Base Class Problem

> "Go's creators observed that large codebases built with inheritance-heavy OOP languages often became hard to maintain. The problem comes from tight coupling—when class B inherits from class A, changes to class A can unexpectedly break class B."
> — [Medium: Why Go Chose Composition](https://medium.com/@harshithgowdakt/why-go-chose-composition-over-inheritance-and-you-should-too-ac1a89524202)

### Virtual Function Overhead

> "Virtual inheritance introduces complexity... additional memory usage and increased processing time. Each virtual base class requires a pointer to track its location in memory."
> — [MakeUseOf: Diamond Problem in C++](https://www.makeuseof.com/what-is-diamond-problem-in-cpp/)

In embedded systems with limited RAM, vtable pointers are a real cost.

### Tight Coupling

> "Classes and objects created through inheritance are tightly coupled because changing the parent or superclass risks breaking your code."
> — [Wikipedia: Composition over Inheritance](https://en.wikipedia.org/wiki/Composition_over_inheritance)

---

## Research: What TypeScript Developers Hate About Classes

### The `this` Problem

> "The problem (at least for many developers) is not with the class itself, but with `this`. If you are using classes, you use methods which change the state using `this`. And that can lead to a lot of frustration."
> — [DEV: Do you need classes in JS/TS?](https://dev.to/latobibor/do-you-need-classes-in-jsts-4ggd)

> "If you've used JS for a while you must have encountered curious problems around `this`. You passed a method of a class to a function as a callback and BOOM! 💥, `this.something` was no longer there. In a classic OOP language, this can never happen because classes 'own' their methods."
> — [DEV: Do you need classes in JS/TS?](https://dev.to/latobibor/do-you-need-classes-in-jsts-4ggd)

### Confusion About When to Use Classes

> "The right technique should be used for the right problem. The key sign of misusing a particular style is confusion. If you start to feel confused about why such a simple thing requires so many steps or files, there is a chance that the wrong paradigm was applied."
> — [DEV: Class Contradictions](https://dev.to/bytebodger/class-contradictions-in-typescript-vs-javascript-1imp)

### Classes as Syntactic Sugar

> "JavaScript (and consequently TypeScript) is neither functional nor an object oriented language. It has elements of both and it breaks important contracts of either."
> — [DEV: No, TypeScript is not OOP](https://dev.to/macsikora/no-typescript-is-not-oop-version-of-javascript-3ed4)

---

## Research: MISRA C++ and Inheritance

MISRA C++ has extensive rules about inheritance, reflecting its complexity:

### Inheritance Hierarchy Rules
- **Rule 10–1–3**: An accessible base class shall not be both virtual and non-virtual in the same hierarchy
- **Rule 10–2–1**: All accessible entity names within a multiple inheritance hierarchy should be unique

### Virtual Function Rules
- **Rule 10–3–1**: There shall be no more than one definition of each virtual function on each path through the inheritance hierarchy
- **Rule 10–3–2**: Each overriding virtual function shall be declared with the virtual keyword
- **Rule 10–3–3**: A virtual function shall only be overridden by a pure virtual function if it is itself declared as pure virtual

> "Class hierarchies are appropriate when run-time selection of implementation is required. If run-time resolution is not required, template parameterization should be considered (templates are better-behaved and faster than virtual functions)."
> — [MISRA C++:2008 Guidelines](https://582328.fs1.hubspotusercontent-na1.net/hubfs/582328/GrammaTech-Files/MISRA_CPP-2008_7.3.pdf)

The sheer number of rules reflects how much can go wrong with inheritance.

---

## Research: Modern Languages Without Inheritance

### Go: Deliberate Exclusion

> "Go didn't exclude inheritance because it was an oversight — it was a deliberate design decision based on decades of experience with inheritance problems in other languages."
> — [Medium: Why Go Chose Composition](https://medium.com/@harshithgowdakt/why-go-chose-composition-over-inheritance-and-you-should-too-ac1a89524202)

> "Rob Pike, one of Go's creators, put it perfectly: 'If C++ and Java are about type hierarchies and the taxonomy of types, Go is about composition.'"
> — [spf13: Is Go OOP?](https://spf13.com/p/is-go-an-object-oriented-language/)

Go provides the benefits of OOP without inheritance:
- **Code reuse**: Struct embedding
- **Polymorphism**: Interfaces
- **Dynamic dispatch**: Interface method calls

### Rust: Traits Instead of Inheritance

> "Rust was built with a different philosophy, dropping inheritance entirely in favor of other patterns such as composition."
> — [LogRocket: Inheritance Limitations in Rust](https://blog.logrocket.com/understanding-inheritance-other-limitations-rust/)

> "Instead of having classes that typically inherit methods from one parent class, any struct can mix and match the traits that it needs without using a hierarchy."
> — [The Coded Message: Rust Is Beyond OOP](https://www.thecodedmessage.com/posts/oop-3-inheritance/)

### James Gosling's Regret

> "James Gosling (Java's inventor) was once asked: 'If you could do Java over again, what would you change?' 'I'd leave out classes,' he replied."
> — [DEV: Go Beyond Basics](https://dev.to/saksham_malhotra_27/go-beyond-basics-closures-interfaces-and-why-go-has-no-inheritance-20a9)

---

## Research: Composition Over Inheritance

The Gang of Four (Design Patterns, 1994) established this principle:

> "Favor composition over inheritance... it is better to compose what an object can do (has-a) than extend what it is (is-a)."
> — [Wikipedia: Composition over Inheritance](https://en.wikipedia.org/wiki/Composition_over_inheritance)

### Benefits of Composition

1. **Loose Coupling**: Components can be changed independently
2. **Flexibility**: Behavior can be changed at runtime
3. **Better Testability**: Components can be tested in isolation
4. **Avoids Inheritance Pitfalls**: No diamond problem, no fragile base class

### Real-World Examples

**UI Frameworks:**
> "A LoginForm could be composed of TextFields for the username and password, and a Button for submitting the form."
> — [DEV: Composition Over Inheritance](https://dev.to/lovestaco/composition-over-inheritance-a-flexible-design-principle-4ehh)

**Vehicles:**
> "Using composition, you can create a Vehicle class that contains instances of Engine, Wheels, and Transmission. You can mix and match these components without altering the class hierarchy."
> — [Medium: Composition is Better](https://medium.com/@sandeepkv93/why-composition-is-preferred-over-inheritance-a-deep-dive-ea6911b1ad15)

---

## Initial Design Direction

C-Next classes will have a **narrow, focused purpose**: bundling data and methods for multiple instances of the same thing.

### What C-Next Classes WILL Have

1. **Encapsulation**: Private members, public interface
2. **Multiple instances**: UART1, UART2, ..., UART8 from one class definition
3. **Methods**: Functions that operate on instance data
4. **Constructors**: Initialization at creation time

### What C-Next Classes WILL NOT Have

1. **Inheritance**: No `extends`, no parent classes
2. **Virtual functions**: No vtables, no dynamic dispatch overhead
3. **Abstract classes**: Use namespaces with function pointers if needed
4. **Multiple inheritance**: Doesn't exist, can't cause diamond problem

### Final Syntax

```cnx
class UART {
    // Private by default (no keyword needed)
    u32 baseAddress;
    CircularBuffer<u8, 256> rxBuffer;
    CircularBuffer<u8, 256> txBuffer;
    u32 baudRate;

    // Constructor with default parameter
    public UART(u32 base, u32 baud <- 115200) {
        baseAddress <- base;
        baudRate <- baud;
    }

    public void setBaudRate(u32 baud) {
        baudRate <- baud;
        // Configure hardware...
    }

    public void send(u8* data, u32 len) {
        // Implementation...
    }

    public u32 receive(u8* buffer, u32 maxLen) {
        // Implementation...
    }
}

// Hardware configuration (no magic numbers per ADR-006)
const u32 UART1_BASE <- 0x40011000;
const u32 UART2_BASE <- 0x40011400;
const u32 UART3_BASE <- 0x40011800;
const u32 SLOW_BAUD <- 9600;

// Global declarations (zero-initialized per ADR-015)
UART uart1;
UART uart2;
UART uart3;

// Initialization in init()
void init() {
    uart1 <- UART(UART1_BASE);              // Uses default baud 115200
    uart2 <- UART(UART2_BASE, SLOW_BAUD);   // Override baud to 9600
    uart3 <- UART(UART3_BASE);              // Uses default baud 115200
}
```

### Composition Instead of Inheritance

Instead of:
```cpp
// Traditional OOP - NOT in C-Next
class ErrorHandlingUART extends UART {
    void handleError() { ... }
}
```

C-Next uses composition:
```
class UART {
    private u32 baseAddress;
    // ... other fields

    void send(u8* data, u32 len) {
        if (/* error condition */) {
            ErrorHandler.log("UART send failed");  // Use namespace
        }
        // ...
    }
}

// ErrorHandler is a namespace (singleton service)
namespace ErrorHandler {
    void log(const char* msg) { ... }
    void panic(const char* msg) { ... }
}
```

### Transpilation

```c
// Generated C

typedef struct {
    uint32_t baseAddress;
    CircularBuffer_u8_256 rxBuffer;
    CircularBuffer_u8_256 txBuffer;
    uint32_t baudRate;
} UART;

// Constructor (default parameter handled at call site)
void UART_init(UART* self, uint32_t base, uint32_t baud) {
    self->baseAddress = base;
    self->baudRate = baud;
}

void UART_setBaudRate(UART* self, uint32_t baud) {
    self->baudRate = baud;
    // Configure hardware...
}

void UART_send(UART* self, uint8_t* data, uint32_t len) {
    // Implementation...
}

uint32_t UART_receive(UART* self, uint8_t* buffer, uint32_t maxLen) {
    // Implementation...
}

// Hardware configuration
const uint32_t UART1_BASE = 0x40011000;
const uint32_t UART2_BASE = 0x40011400;
const uint32_t UART3_BASE = 0x40011800;
const uint32_t SLOW_BAUD = 9600;

// Global declarations (zero-initialized)
UART uart1 = {0};
UART uart2 = {0};
UART uart3 = {0};

// In init()
void init(void) {
    UART_init(&uart1, UART1_BASE, 115200);  // Default applied at call
    UART_init(&uart2, UART2_BASE, SLOW_BAUD);
    UART_init(&uart3, UART3_BASE, 115200);
}
```

No vtables. No inheritance overhead. Just clean, predictable C structs with associated functions.

---

## Design Decisions (Finalized 2025-12-28)

### Q1: No Interfaces/Traits

**Decision:** No interfaces or traits.

**Rationale:** Classes in C-Next serve ONE purpose: keeping code DRY by allowing multiple instances of the same thing. No polymorphism, no inheritance, no slippery slope into OOP complexity.

If polymorphism is ever needed, it can be added later. For now, simplicity wins.

### Q2: Global Declaration, Initialize in init()

**Decision:** Pattern A — declare globally, initialize in `init()`.

```cnx
// Hardware configuration (no magic numbers per ADR-006)
const u32 UART1_BASE <- 0x40011000;
const u32 UART2_BASE <- 0x40011400;
const u32 SLOW_BAUD <- 9600;

UART uart1;  // Global declaration (zero-initialized per ADR-015)
UART uart2;

void init() {
    uart1 <- UART(UART1_BASE);
    uart2 <- UART(UART2_BASE, SLOW_BAUD);
}
```

**Rationale:** This pattern:
- Works with startup allocation (ADR-003)
- Ties into null state semantics (ADR-015)
- Matches how embedded code typically structures initialization

### Q3: Strict — init() Only

**Decision:** All class instances must be created in `init()`.

**Rationale:** This is the surface area for a LOT of bugs without being strict. Runtime allocation leads to:
- Memory fragmentation
- Unpredictable memory usage
- OOM conditions in long-running systems

Desktop applications can use C++ if they need runtime allocation.

### Q4: Private by Default

**Decision:** All members are private by default. Only `public` keyword needed.

```cnx
class UART {
    u32 baseAddress;           // private (default)
    u32 baudRate;              // private (default)

    public UART(u32 base) { ... }
    public void send(u8* data, u32 len) { ... }
}
```

**Rationale:** Follows the principle of least privilege. Explicit `public` makes the API surface obvious.

### Q5: No Static Methods

**Decision:** No static methods on classes. Use namespaces instead.

```cnx
// Instead of UART.defaultBaudRate(), use:
namespace UARTConfig {
    u32 defaultBaudRate <- 115200;
}
```

**Rationale:** Namespaces already provide singleton/static functionality (ADR-002). No need to duplicate.

### Q6: No Getter/Setter Syntax

**Decision:** No special property syntax. Use methods or public fields.

**Rationale:** Getters/setters are just methods. Nothing stops developers from writing `getBaudRate()` and `setBaudRate()` if they want them. No language-level opinion beyond "use methods if you need validation/side-effects, public fields if you don't."

### Q7: Constructor Default Parameters Only

**Decision:** No field defaults. All defaults in constructor parameters using `<-` syntax.

```cnx
class UART {
    u32 baseAddress;
    u32 baudRate;

    public UART(u32 base, u32 baudRate <- 115200) {
        baseAddress <- base;
        this.baudRate <- baudRate;
    }
}

// Hardware configuration (no magic numbers per ADR-006)
const u32 UART1_BASE <- 0x40011000;
const u32 UART2_BASE <- 0x40011400;
const u32 SLOW_BAUD <- 9600;

// Usage:
UART uart1 <- UART(UART1_BASE);              // baudRate = 115200
UART uart2 <- UART(UART2_BASE, SLOW_BAUD);   // baudRate = 9600
```

**Rationale:** Single source of truth for defaults. Research shows field defaults cause confusion:
- C++/Java: Constructor can override field default — two places to look
- Order of initialization is non-obvious
- Scattered initialization logic

Rust and Go require explicit initialization. C-Next follows this philosophy with the ergonomic addition of default parameters in constructors.

---

## Summary: Why This Approach?

| Feature | Traditional OOP | C-Next |
|---------|-----------------|--------|
| Encapsulation | ✅ | ✅ |
| Multiple instances | ✅ | ✅ |
| Code reuse | Via inheritance | Via composition |
| Polymorphism | Virtual functions | Namespaces/interfaces (TBD) |
| Diamond problem | Possible | Impossible |
| Fragile base class | Possible | Impossible |
| vtable overhead | Yes | No |
| MISRA complexity | 10+ rules | Minimal |

---

## References

### DRY Principle and Code Reuse
- [Wikipedia: Don't Repeat Yourself](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)
- [Medium: The DRY Principle](https://medium.com/@ujjawalr/the-dry-principle-why-you-should-avoid-code-duplication-2ebdfce778a4)
- [Plutora: Understanding the DRY Principle](https://www.plutora.com/blog/understanding-the-dry-dont-repeat-yourself-principle)

### Encapsulation Benefits
- [Stackify: What is Encapsulation](https://stackify.com/oop-concept-for-beginners-what-is-encapsulation/)
- [GeeksforGeeks: Encapsulation in C++](https://www.geeksforgeeks.org/cpp/encapsulation-in-cpp/)
- [Medium: The Importance of Code Encapsulation](https://medium.com/swlh/the-importance-of-code-encapsulation-ce19efbcfe57)
- [Coursera: Encapsulation in OOP](https://www.coursera.org/in/articles/encapsulation-in-oop)

### Problems with Inheritance
- [Wikipedia: Multiple Inheritance (Diamond Problem)](https://en.wikipedia.org/wiki/Multiple_inheritance)
- [GeeksforGeeks: Diamond Problem in C++](https://www.geeksforgeeks.org/cpp/diamond-problem-in-cpp/)
- [MakeUseOf: Diamond Problem Explained](https://www.makeuseof.com/what-is-diamond-problem-in-cpp/)
- [Wikipedia: Composition over Inheritance](https://en.wikipedia.org/wiki/Composition_over_inheritance)

### Composition Over Inheritance
- [DEV: Composition Over Inheritance](https://dev.to/lovestaco/composition-over-inheritance-a-flexible-design-principle-4ehh)
- [Medium: Why Composition is Preferred](https://medium.com/@sandeepkv93/why-composition-is-preferred-over-inheritance-a-deep-dive-ea6911b1ad15)
- [Toxigon: Best Practices for 2025](https://toxigon.com/composition-over-inheritance-best-practices)
- [DigitalOcean: Composition vs Inheritance](https://www.digitalocean.com/community/tutorials/composition-vs-inheritance)

### Go's Design Decision
- [Medium: Why Go Chose Composition](https://medium.com/@harshithgowdakt/why-go-chose-composition-over-inheritance-and-you-should-too-ac1a89524202)
- [YourBasic: OOP without Inheritance in Go](https://yourbasic.org/golang/inheritance-object-oriented/)
- [spf13: Is Go OOP?](https://spf13.com/p/is-go-an-object-oriented-language/)
- [DEV: Go Beyond Basics](https://dev.to/saksham_malhotra_27/go-beyond-basics-closures-interfaces-and-why-go-has-no-inheritance-20a9)

### Rust's Approach
- [The Coded Message: Rust Is Beyond OOP](https://www.thecodedmessage.com/posts/oop-3-inheritance/)
- [LogRocket: Inheritance Limitations in Rust](https://blog.logrocket.com/understanding-inheritance-other-limitations-rust/)
- [Medium: 28 Days of Rust - Composition](https://medium.com/comsystoreply/28-days-of-rust-part-2-composition-over-inheritance-cab1b106534a)

### TypeScript/JavaScript Class Issues
- [DEV: Do you need classes in JS/TS?](https://dev.to/latobibor/do-you-need-classes-in-jsts-4ggd)
- [DEV: Class Contradictions](https://dev.to/bytebodger/class-contradictions-in-typescript-vs-javascript-1imp)
- [DEV: TypeScript is not OOP](https://dev.to/macsikora/no-typescript-is-not-oop-version-of-javascript-3ed4)

### Arduino and C++ in Embedded
- [Wikipedia: Arduino](https://en.wikipedia.org/wiki/Arduino)
- [LinkedIn: Why C++ for Embedded](https://www.linkedin.com/pulse/why-c-language-choice-embedded-software-development-varteq)
- [Qt: C++ for Embedded - Myths](https://www.qt.io/embedded-development-talk/c-for-embedded-advantages-disadvantages-and-myths)
- [Hackaday: Hacking Arduino Environment](https://hackaday.com/2015/12/31/code-craft-embedding-c-hacking-the-arduino-software-environment/)

### MISRA C++ Rules
- [MISRA C++:2008 Guidelines PDF](https://582328.fs1.hubspotusercontent-na1.net/hubfs/582328/GrammaTech-Files/MISRA_CPP-2008_7.3.pdf)
- [Perforce: MISRA C and C++](https://www.perforce.com/resources/qac/misra-c-cpp)
- [CppDepend: MISRA C++ Compliance](https://www.cppdepend.com/documentation/misra-cpp)
- [EmbeddedPrep: MISRA Guidelines Tutorial](https://embeddedprep.com/misra-c-misra-c-guidelines/)

### Multiple UART Management
- [ControllersTech: Managing Multiple UARTs](https://controllerstech.com/managing-multiple-uarts-in-stm32/)
- [Simply Embedded: UART Tutorial](http://www.simplyembedded.org/tutorials/msp430-uart/)
- [ESP-IDF: UART Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/uart.html)
