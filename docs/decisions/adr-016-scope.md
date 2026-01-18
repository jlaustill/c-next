# ADR-016: How to Handle Scope in C-Next?

**Status:** Implemented
**Date:** 2025-12-29
**Decision Makers:** C-Next Language Design Team
**Supersedes:** ADR-002 (Namespaces), ADR-005 (Classes Without Inheritance)
**Related:** ADR-014 (Structs)

## Context

After reflection on the language design, the terms "namespace" and "class" carry significant C++ baggage and expectations that C-Next explicitly wants to avoid. These terms imply:

- **namespace:** C++ module systems, `using namespace`, ADL (Argument Dependent Lookup), inline namespaces
- **class:** Object-oriented programming, class instances, constructors/destructors, inheritance hierarchies, methods bound to types, `this` pointers, virtual functions

C-Next's philosophy is "safety through removal, not addition" and alignment with C's mental model. The C++ terminology conflicts with this goal.

### The Problem with "namespace"

While ADR-002's _behavior_ is correct (singleton services, private by default, name prefixing), the _terminology_ creates wrong expectations:

- Developers expect C++ namespace semantics
- Questions arise about nested namespaces, `using` directives, anonymous namespaces
- The concept carries OOP baggage C-Next doesn't want

### The Problem with "class"

ADR-005 attempted to provide "classes without inheritance" but the term "class" inherently implies:

- Instances with bound methods (`obj.method()`)
- Constructors that create instances
- Data and behavior bundled together
- An OOP mental model

This conflicts with C-Next's goal of embracing C patterns with safety improvements.

---

## Proposal: The `scope` Keyword

Introduce a `scope` keyword to replace `namespace`. The term "scope" has minimal baggage — it simply means "a bucket for organizing related code."

### Current Behavior (Preserved)

The `scope` keyword initially behaves exactly like the current `namespace` implementation:

```cnx
scope LED {
    u32 brightness;              // private by default

    public void on() {
        global.GPIO7.DR_SET[global.LED_BIT] <- true;
    }

    public void off() {
        global.GPIO7.DR_CLEAR[this.brightness] <- true;
    }
}

// Usage from outside:
LED.on();
LED.off();
```

Transpiles to:

```c
static uint32_t LED_brightness;

void LED_on(void) {
    GPIO7_DR_SET = (1 << LED_BIT);
}

void LED_off(void) {
    GPIO7_DR_CLEAR = (1 << LED_brightness);
}
```

### Key Properties

- **Private by default** — Only members marked `public` are accessible outside
- **Name prefixing** — Members become `Scope_member` in generated C
- **Not a type** — Cannot create instances of a scope
- **Minimal expectations** — No baggage from C++ namespaces or classes

### Scope Variable Persistence (Issue #233)

Scope variables behave like C `static` variables — they are initialized once at program start and persist across all function calls.

```cnx
scope Counter {
    u32 value <- 0;           // Initialized once at program start

    public void increment() {
        this.value <- this.value + 1;
    }

    public u32 getValue() {
        return this.value;
    }
}

// Behavior:
Counter.increment();  // value: 0 -> 1
Counter.increment();  // value: 1 -> 2
Counter.increment();  // value: 2 -> 3
Counter.getValue();   // returns 3
```

**Generated C code:**

```c
static uint32_t Counter_value = 0;  // Static = persists

void Counter_increment(void) {
    Counter_value = Counter_value + 1;
}

uint32_t Counter_getValue(void) {
    return Counter_value;
}
```

**Variable lifetime summary:**

| Variable Type            | Lifetime         | Notes                                      |
| ------------------------ | ---------------- | ------------------------------------------ |
| Scope variables          | Program lifetime | Like C `static` — persist across all calls |
| Function-local variables | Function call    | Reset each call (standard C behavior)      |
| Global variables         | Program lifetime | Persist across all function calls          |

### Scoped Registers

Scopes can contain register declarations for platform-specific hardware:

```cnx
scope Teensy4 {
    register GPIO7 @ 0x42004000 {
        DR:         u32 rw @ 0x00,
        DR_SET:     u32 wo @ 0x84,
        DR_CLEAR:   u32 wo @ 0x88,
        DR_TOGGLE:  u32 wo @ 0x8C,
    }

    const u32 LED_BIT <- 3;

    public void blinkLed() {
        this.GPIO7.DR_TOGGLE[this.LED_BIT] <- true;
    }
}

// Usage from outside:
Teensy4.blinkLed();
Teensy4.GPIO7.DR_SET[3] <- true;
```

Transpiles to:

```c
/* Register: Teensy4_GPIO7 @ 0x42004000 */
#define Teensy4_GPIO7_DR (*(volatile uint32_t*)(0x42004000 + 0x00))
#define Teensy4_GPIO7_DR_SET (*(volatile uint32_t*)(0x42004000 + 0x84))
#define Teensy4_GPIO7_DR_CLEAR (*(volatile uint32_t*)(0x42004000 + 0x88))
#define Teensy4_GPIO7_DR_TOGGLE (*(volatile uint32_t*)(0x42004000 + 0x8C))

static const uint32_t Teensy4_LED_BIT = 3;

void Teensy4_blinkLed(void) {
    Teensy4_GPIO7_DR_TOGGLE = (1 << Teensy4_LED_BIT);
}
```

This pattern is useful for:

- **Platform namespacing** — Avoid conflicts with HAL headers (e.g., Teensy's imxrt.h defines GPIO7_DR)
- **Organization** — Group platform-specific registers, constants, and functions together
- **Multiple platforms** — Support different hardware configurations in the same codebase

---

## Instance Model: C-Style with ADR-014 Structs

Instead of "classes," C-Next embraces the C approach for instances:

1. **Define data with structs** (ADR-014)
2. **Define behavior with free functions** that take struct pointers

### Example: UART Implementation

```cnx
// Data definition (ADR-014 struct)
struct UART {
    u32 baseAddress;
    u32 baudRate;
    bool initialized;
}

// Free functions that operate on UART
void UART_init(UART* self, u32 base, u32 baud) {
    self.baseAddress <- base;
    self.baudRate <- baud;
    self.initialized <- true;
}

void UART_send(UART* self, u8* data, u32 len) {
    // Implementation...
}

u32 UART_receive(UART* self, u8* buffer, u32 maxLen) {
    // Implementation...
}

// Usage
UART uart1;
UART uart2;

void init() {
    UART_init(&uart1, UART1_BASE, 115200);
    UART_init(&uart2, UART2_BASE, 9600);
}

void main_loop() {
    UART_send(&uart1, data, len);
}
```

### Why C-Style?

| Aspect         | C-Style (Proposed)                   | Class-Style (Rejected)               |
| -------------- | ------------------------------------ | ------------------------------------ |
| Mental model   | Familiar to C developers             | Requires OOP understanding           |
| Data ownership | Explicit — you see the pointer       | Hidden behind `this`                 |
| Generated code | Obvious, 1:1 mapping                 | Requires understanding transpilation |
| Flexibility    | Can use any function with any struct | Methods bound to types               |
| KISS principle | Simple, no magic                     | Implicit `self`, constructors        |

---

## Research Questions

The following questions remain open and require further exploration:

### DECIDED: Name Resolution with `this.` and `global.`

C-Next requires **explicit qualification** for all non-local references inside a scope. This eliminates ambiguity entirely and aligns with C-Next's safety-first philosophy.

#### The Rule

Inside a scope, you MUST use:

- **`this.X`** — for ANY scope member (variables, functions, types, enums)
- **`global.X`** — for ANY global (variables, functions, registers, types)
- **Bare `X`** — ONLY for function-local variables and parameters

#### Example

```cnx
const u8 defaultValue <- 3;           // Global

register GPIO7 @ 0x42004000 {
    DR_SET: u32 wo @ 0x84,
}

scope Motor {
    public enum State {
        IDLE,
        RUNNING,
        STALLED
    }

    const u8 defaultValue <- 1;       // Scope member (shadows global)

    this.State current <- this.State.IDLE;

    u8 start() {
        u8 localVar <- 5;             // Local - bare identifier OK

        this.current <- this.State.RUNNING;

        return localVar               // Local - bare
             + this.defaultValue      // Scope member - MUST use this.
             + global.defaultValue;   // Global - MUST use global.
    }

    void setPin() {
        global.GPIO7.DR_SET[3] <- true;  // Global register - MUST use global.
    }
}
```

#### Transpiles to:

```c
const uint8_t defaultValue = 3;

#define GPIO7_DR_SET (*(volatile uint32_t*)(0x42004000 + 0x84))

typedef enum {
    Motor_State_IDLE = 0,
    Motor_State_RUNNING = 1,
    Motor_State_STALLED = 2
} Motor_State;

static const uint8_t Motor_defaultValue = 1;

Motor_State Motor_current = Motor_State_IDLE;

uint8_t Motor_start(void) {
    uint8_t localVar = 5;
    Motor_current = Motor_State_RUNNING;
    return localVar + Motor_defaultValue + defaultValue;
}

void Motor_setPin(void) {
    GPIO7_DR_SET = (1 << 3);
}
```

#### `this.` for Types

The `this.` prefix also works in type position for scoped types:

```cnx
scope Motor {
    public enum State { IDLE, RUNNING }

    void example() {
        const this.State currentState <- this.State.IDLE;  // Type is Motor_State
    }
}
```

#### Compile-Time Errors

Bare identifiers referencing scope members or globals inside a scope produce compile errors:

```cnx
scope Motor {
    const u8 value <- 1;

    void bad() {
        value;           // ERROR: use 'this.value' for scope member
        GPIO7.DR;        // ERROR: use 'global.GPIO7.DR' for global register
        defaultValue;    // ERROR: ambiguous - use 'this.' or 'global.'
    }
}
```

#### Why This Design?

| Aspect      | `this.`/`global.` Required     | Implicit Resolution           |
| ----------- | ------------------------------ | ----------------------------- |
| Ambiguity   | **Zero** — always explicit     | Shadowing causes confusion    |
| Safety      | **Maximum** — no accidents     | Easy to reference wrong thing |
| Readability | **Self-documenting**           | Must trace scope manually     |
| Refactoring | **Safe** — rename scope once   | Must update all references    |
| Compiler    | **Simple** — just parse prefix | Complex resolution rules      |

This approach embodies C-Next's philosophy: **safety through explicitness, not clever inference**.

---

### 1. What exactly should `scope` provide?

Options to research:

- **Organization only** — Pure name prefixing, visibility handled separately
- **Organization + visibility** — Current namespace behavior (private by default)
- **Organization + visibility + state** — Can scopes have private state?

### 2. Should scopes nest?

**DECIDED: No nested scopes for v1.**

Nested scopes add complexity without significant benefit for embedded use cases. Keep it simple:

```cnx
// NOT supported in v1:
scope Hardware {
    scope GPIO { ... }  // ERROR: nested scopes not allowed
}

// Instead, use flat scopes with naming conventions:
scope Hardware_GPIO { ... }
scope Hardware_UART { ... }
```

### 3. Syntax for "methods" on structs?

If we want `uart1.send(data, len)` sugar (common request), how do we provide it without implying OOP?

Options:

- **No sugar** — Always `UART_send(&uart1, data, len)` (pure C-style)
- **UFCS** — Uniform Function Call Syntax: `uart1.send(data, len)` desugars to `UART_send(&uart1, data, len)`
- **Scope-based association** — Associate functions with structs via scopes

### 4. How does visibility work with scopes?

Current approach (from namespaces):

- `public` keyword makes member externally accessible
- No keyword means private (internal to scope)

Is this sufficient? Should structs also have visibility control?

### 5. Generic/parameterized scopes?

The rejected ADR-005 supported `class RingBuffer<T, N>`. Do we need this for scopes or structs?

```cnx
// Parameterized struct?
struct RingBuffer<T, N> {
    T buffer[N];
    u32 head;
    u32 tail;
}
```

---

## What This ADR Decides

- **Name resolution:** `this.` and `global.` are REQUIRED inside scopes (no implicit resolution)
- **Nested scopes:** Not supported in v1
- **`this.` in type position:** Supported for scoped types (e.g., `this.State`)

## What This ADR Does NOT Decide

The following questions remain open:

- Whether UFCS or method syntax will be added
- How generic types will work
- The complete visibility model

These questions will be answered through:

- Practical usage in examples
- Community feedback
- Analysis of embedded use cases
- Evaluation against the KISS principle

---

## Implementation Status

The `scope` keyword replaces `namespace` in the current implementation:

- Grammar updated: `namespace` → `scope`
- Code generator updated
- All examples and tests converted

**Pending implementation:**

- `this.` keyword for scope-local references
- `global.` keyword for global references
- Compile-time enforcement of explicit qualification
- `this.Type` in type position for scoped types

The class implementation has been removed pending further research.

---

## References

### Rejected ADRs

- **ADR-002:** Namespaces Over Static Classes (Rejected — terminology issue)
- **ADR-005:** Classes Without Inheritance (Rejected — OOP baggage)

### Active ADRs

- **ADR-014:** Structs (Defines data containers)
- **ADR-015:** Null State (Zero initialization)
- **ADR-003:** Static Allocation (No dynamic memory after init)

### Design Principles

- [KISS Principle](https://en.wikipedia.org/wiki/KISS_principle)
- [C-Next Philosophy: Safety through removal, not addition](../README.md)
