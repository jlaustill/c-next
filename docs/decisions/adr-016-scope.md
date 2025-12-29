# ADR-016: How to Handle Scope in C-Next?

**Status:** Research Needed
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

While ADR-002's *behavior* is correct (singleton services, private by default, name prefixing), the *terminology* creates wrong expectations:
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
        GPIO7.DR_SET[LED_BIT] <- true;
    }

    public void off() {
        GPIO7.DR_CLEAR[LED_BIT] <- true;
    }
}

// Usage:
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
    GPIO7_DR_CLEAR = (1 << LED_BIT);
}
```

### Key Properties

- **Private by default** — Only members marked `public` are accessible outside
- **Name prefixing** — Members become `Scope_member` in generated C
- **Not a type** — Cannot create instances of a scope
- **Minimal expectations** — No baggage from C++ namespaces or classes

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

| Aspect | C-Style (Proposed) | Class-Style (Rejected) |
|--------|-------------------|----------------------|
| Mental model | Familiar to C developers | Requires OOP understanding |
| Data ownership | Explicit — you see the pointer | Hidden behind `this` |
| Generated code | Obvious, 1:1 mapping | Requires understanding transpilation |
| Flexibility | Can use any function with any struct | Methods bound to types |
| KISS principle | Simple, no magic | Implicit `self`, constructors |

---

## Research Questions

The following questions remain open and require further exploration:

### CRITICAL: Name Shadowing and Resolution

This is the most important scoping question to resolve. Consider this example:

```cnx
register GPIO7 @ 0x42004000 {
    DR_SET: u32 wo @ 0x84,
}

scope LED {
    const bool GPIO7 <- true;   // Scope member, shadows register!

    void on() {
        u32 GPIO7 <- 0;         // Local variable, shadows scope member!
        GPIO7.DR_SET[LED_BIT] <- true;  // WHICH GPIO7???
    }
}
```

**The Ambiguity:** When the compiler sees `GPIO7.DR_SET[LED_BIT]`, which `GPIO7` does it refer to?

| Candidate | Type | Has `.DR_SET`? |
|-----------|------|----------------|
| Local `GPIO7` | `u32` | No (would be type error) |
| Scope `LED_GPIO7` | `const bool` | No (would be type error) |
| Register `GPIO7` | Register | Yes |

**Traditional Lexical Scoping** says "innermost scope wins" — so the local `u32 GPIO7` would be selected, causing a type error because `u32` has no `.DR_SET` member.

**But this is confusing!** The developer clearly meant to access the register, not the shadowing variable.

#### Options to Research

**Option A: Strict Shadowing Ban**
- Disallow shadowing of registers, globals, and scope members
- Compile-time error if a local variable has the same name as an outer scope identifier
- **Pro:** Eliminates ambiguity entirely
- **Con:** May be overly restrictive for large codebases

**Option B: Explicit Qualification Required**
- If shadowing occurs, require explicit qualification to access outer scopes
- Syntax options: `::GPIO7` (C++ style), `global.GPIO7`, `register.GPIO7`
- **Pro:** Allows shadowing when intentional
- **Con:** Adds syntax complexity

**Option C: Type-Aware Resolution**
- If the innermost candidate doesn't type-check, try outer scopes
- `GPIO7.DR_SET` fails on `u32`, so try scope member, then register
- **Pro:** "Does what you mean"
- **Con:** Surprising behavior, hard to reason about

**Option D: Separate Namespaces**
- Registers, scopes, and locals are in separate "namespaces" (not `scope` keyword)
- `GPIO7` (local), `LED.GPIO7` (scope), `GPIO7` (register) are all distinct
- Member access (`.DR_SET`) only applies to registers/structs, so `GPIO7.DR_SET` unambiguously means the register
- **Pro:** Clear resolution rules
- **Con:** What if a struct is named `GPIO7`?

**Option E: Warning + Innermost Wins**
- Traditional lexical scoping (innermost wins)
- Compiler emits warning when shadowing occurs
- Developer must rename or explicitly qualify
- **Pro:** Familiar behavior, explicit about the problem
- **Con:** Warning fatigue if common

#### Current Behavior (BUGGY)

The current implementation has inconsistent behavior:
- `resolveIdentifier()` checks scope members first
- But member access (`GPIO7.DR_SET`) may bypass this check
- This leads to unpredictable results depending on context

**This MUST be resolved before the language is stable.**

#### Recommended Research Approach

1. Survey other languages:
   - How does Rust handle shadowing with modules?
   - How does Zig handle this?
   - What does C do with file-scope vs block-scope?

2. Create test cases covering:
   - Local shadows scope member
   - Scope member shadows global
   - Scope member shadows register
   - All three levels of shadowing

3. Implement strict shadowing detection as a starting point
   - Fail fast, then relax rules if too restrictive

---

### 1. What exactly should `scope` provide?

Options to research:
- **Organization only** — Pure name prefixing, visibility handled separately
- **Organization + visibility** — Current namespace behavior (private by default)
- **Organization + visibility + state** — Can scopes have private state?

### 2. Should scopes nest?

```cnx
// Is this desirable?
scope Hardware {
    scope GPIO {
        public void init() { ... }
    }
    scope UART {
        public void init() { ... }
    }
}

// Calls become:
Hardware.GPIO.init();
Hardware.UART.init();
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

## What This ADR Does NOT Decide

This ADR is in "Research Needed" status. It does NOT conclude:
- The final semantics of `scope`
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
