# ADR-016: How to Handle Scope in C-Next?

**Status:** Implemented
**Date:** 2025-12-29
**Decision Makers:** C-Next Language Design Team
**Supersedes:** ADR-002 (Namespaces), ADR-005 (Classes Without Inheritance)
**Related:** ADR-014 (Structs), ADR-063 (Identifier Syntax — amends the qualified-name separator, see below)
**Amended by:** ADR-057 (Implicit Scope Resolution — withdraws this ADR's requirement that `this.` and `global.` be explicit), ADR-111 (Safe Hardware Abstraction Primitives — `Research`; on acceptance, replaces the `@ address` form used throughout `### Scoped Registers`)
**Amends:** ADR-002 (Namespaces — carries forward its file-independence rule, see _Scope Composition_)

> **Amended by ADR-063 (Issue #1117).** Members are named `Scope__member` in
> generated C. The separator is two underscores, and ADR-063 forbids a C-Next
> identifier from ending with `_` or containing `__`, which makes the join
> injective: a global `Reg_flags` and a `scope Reg` member `flags` are now
> distinct C symbols, as are the members of `scope A_B { c }` and
> `scope A { B_c }`.

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

The argument above is stated rather than demonstrated. **[The comparison matrix in the
language guide](../language-guide.md#how-a-scope-compares-to-a-class-a-namespace-and-a-struct)**
turns it into row-by-row claims a reader can check — including the two rows where
"scope" behaves like neither term (`private` members, and no nesting), and the `this.`
rows, where a class and a scope share a spelling but not a meaning.

---

## Proposal: The `scope` Keyword

Introduce a `scope` keyword to replace `namespace`. The term "scope" has minimal baggage — it simply means "a bucket for organizing related code."

### Visibility Defaults

C-Next uses **member-type-aware visibility defaults** to reduce boilerplate:

- **Functions**: Public by default (API surface), use `private` keyword to hide
- **Variables/types**: Private by default (internal state), use `public` keyword to expose

This design reflects typical usage patterns — functions are almost always public (they form the API), while variables are almost always private (they hold internal state).

```cnx
scope LED {
    u8 brightness;              // private by default (variable)
    public u8 maxBrightness;    // public (explicit)

    void on() { }               // public by default (function)
    void off() { }              // public by default (function)
    private void reset() { }    // private (explicit)
}

// Usage from outside:
LED.on();                       // OK - public by default
LED.off();                      // OK - public by default
LED.maxBrightness <- 100;       // OK - explicitly public variable
// LED.brightness <- 50;        // ERROR - private variable
// LED.reset();                 // ERROR - explicitly private function
```

Transpiles to:

```c
static uint8_t LED__brightness;        // private → static
uint8_t LED__maxBrightness;            // public → extern linkage

void LED__on(void) { }                 // public → extern linkage
void LED__off(void) { }                // public → extern linkage
static void LED__reset(void) { }       // private → static
```

### Key Properties

- **Member-type-aware defaults** — Functions public, variables/types private
- **Name prefixing** — Members become `Scope__member` in generated C (ADR-063)
- **Static linkage** — Private members use `static` for file-local visibility
- **Not a type** — Cannot create instances of a scope
- **File-independent** — A scope may be reopened; declarations compose (see below)
- **Minimal expectations** — No baggage from C++ namespaces or classes

### Scope Composition (Issue #1333)

**DECIDED: A scope may be reopened. Declaring the same scope again adds members
to it; it does not redefine it.** This holds within one file and across files.

```cnx
// lib.cnx
scope Lib {
    public struct Point { u32 x; u32 y; }
}

// app.cnx
#include "lib.cnx"

scope Lib {                       // reopens Lib, does not redefine it
    public u32 useIt() {
        Point p <- {x: 3, y: 4};  // bare name, resolves to Lib.Point (ADR-057)
    }
}
```

Scopes exist for organization. A scope that must live in exactly one contiguous
block forces one file per scope and grows without bound, which is the opposite of
what the construct is for.

**This rule is not new.** ADR-002 stated it:

> File organization is independent — Multiple namespaces can live in one file, or
> one namespace can span files

ADR-002 is `Rejected`, but by its own rationale it was rejected **for terminology,
not behavior** — "namespace" carried C++ baggage. This ADR superseded it and
carried the behavior while never restating this rule, so the requirement existed
nowhere that governed. It was consequently unimplemented: a second declaration of
a scope was rejected as a duplicate symbol definition, in the same file as well as
across files (#1333).

**What still conflicts.** Reopening composes the scope; it does not relax member
uniqueness. Two definitions of `Lib.useIt` collide whichever block they appear in,
because members are grouped by the scope's own identity rather than by the
declaration block.

**What this requires of resolution.** A bare type name inside a reopened block
resolves against the whole scope, not the block. Cross-file, this means every
type-forming kind must be visible across the include boundary on the same terms —
if enums are visible and structs are not, `Mode` and `Point` declared side by side
in one file resolve differently in another, and the second does not compile.

The same obligation holds over a second axis, and missing it is the more dangerous
half. C-Next resolves a type name at **two points** (CLAUDE.md, _"Two resolution
points, one decision"_): the **symbols layer**, which produces the header, and the
**codegen layer**, which produces the body. Both must see the same scope types.
If they disagree, the prototype and the definition disagree — a bare `Point` in a
parameter reaches the `.h` as `Point` and the `.c` as `Lib__Point`, `cnext` exits 0,
and the C compiler rejects the pair.

The two axes multiply rather than add: a kind that is visible in one layer and not
the other fails only in the positions that route through the missing layer. A
function-body local is resolved by codegen alone and keeps working, which is exactly
why this can look fixed while parameters, return types and struct fields are broken.
Coverage therefore has to name positions, not just kinds.

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
static uint32_t Counter__value = 0;  // Static = persists

void Counter__increment(void) {
    Counter__value = Counter__value + 1;
}

uint32_t Counter__getValue(void) {
    return Counter__value;
}
```

**Variable lifetime summary:**

| Variable Type            | Lifetime         | Notes                                      |
| ------------------------ | ---------------- | ------------------------------------------ |
| Scope variables          | Program lifetime | Like C `static` — persist across all calls |
| Function-local variables | Function call    | Reset each call (standard C behavior)      |
| Global variables         | Program lifetime | Persist across all function calls          |

### Thread Safety and Reentrancy (Issue #313)

Scope variables use static storage, which means functions accessing them are **not reentrant** by design. This is intentional and safe in C-Next because:

1. **Compiler enforcement**: If a scope variable is accessed from multiple execution contexts (threads, RTOS tasks, interrupts), the compiler requires it to be marked `atomic`. This prevents accidental unsafe sharing.

2. **Semantic clarity**: Scope variables are meant for persistent state (counters, accumulators, state machines). If you need a reentrant utility function, use function-local variables instead.

**Example - Reentrant vs Non-Reentrant Design:**

```cnx
// NON-REENTRANT: Scope variable persists (correct for state)
scope Counter {
    u32 value <- 0;

    public void increment() {
        this.value <- this.value + 1;  // Persists across calls
    }
}

// REENTRANT: Local variable resets each call (correct for utilities)
scope CRC {
    public u32 calculate(u8[] data) {
        u32 acc <- 0xFFFFFFFF;  // Local - each call gets fresh state
        // ... calculate CRC ...
        return acc;
    }
}
```

**Why not optimize single-function variables to local?** (Issue #232, fixed in #313)

A previous optimization attempted to convert scope variables used by only one function into function-local variables. This was **incorrect** because it changed observable behavior — a counter would reset on each call instead of persisting. The optimization was removed because:

- It violated the semantic contract of scope variables (static-like persistence)
- C-Next's `atomic` enforcement already prevents unsafe multi-context access
- Users who need reentrant functions should explicitly use local variables

### Scoped Registers

> **Amended by ADR-111 (on acceptance).** The `register GPIO7 @ 0x42004000 { … }` form
> below is ADR-004's, and ADR-111 removes it: a register definition will carry plain
> byte offsets with the base address supplied at instantiation, so one definition can
> produce several instances (`Serial1`, `Serial2`, `Serial3`). ADR-111 is `Research`,
> so the form shown here is still the correct one to write today.

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
/* Register: Teensy4__GPIO7 @ 0x42004000 */
#define Teensy4__GPIO7__DR (*(volatile uint32_t*)(0x42004000 + 0x00))
#define Teensy4__GPIO7__DR_SET (*(volatile uint32_t*)(0x42004000 + 0x84))
#define Teensy4__GPIO7__DR_CLEAR (*(volatile uint32_t*)(0x42004000 + 0x88))
#define Teensy4__GPIO7__DR_TOGGLE (*(volatile uint32_t*)(0x42004000 + 0x8C))

static const uint32_t Teensy4__LED_BIT = 3;

void Teensy4__blinkLed(void) {
    Teensy4__GPIO7__DR_TOGGLE = (1 << Teensy4__LED_BIT);
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

#define GPIO7__DR_SET (*(volatile uint32_t*)(0x42004000 + 0x84))

typedef enum {
    Motor__State__IDLE = 0,
    Motor__State__RUNNING = 1,
    Motor__State__STALLED = 2
} Motor__State;

static const uint8_t Motor__defaultValue = 1;

Motor__State Motor__current = Motor__State__IDLE;

uint8_t Motor__start(void) {
    uint8_t localVar = 5;
    Motor__current = Motor__State__RUNNING;
    return localVar + Motor__defaultValue + defaultValue;
}

void Motor__setPin(void) {
    GPIO7__DR_SET = (1 << 3);
}
```

#### `this.` for Types

The `this.` prefix also works in type position for scoped types:

```cnx
scope Motor {
    public enum State { IDLE, RUNNING }

    void example() {
        const this.State currentState <- this.State.IDLE;  // Type is Motor__State
    }
}
```

#### Bare identifiers — withdrawn, see ADR-057

> **Superseded by [ADR-057](adr-057-implicit-scope-resolution.md) (Implemented).**
> This ADR originally required `this.` and `global.` and rejected bare identifiers
> inside a scope. That requirement was withdrawn: bare names resolve
> **local → scope → global**, and `this.` / `global.` remain available to force a
> level. The paragraphs below are kept because the trade-off they weigh is still
> the right one to have weighed — they are **not** a description of the language.

What ADR-016 rejected, and ADR-057 now accepts:

```cnx
scope Motor {
    const u8 value <- 1;

    void ok() {
        value;           // resolves to Motor.value  (was: ERROR)
    }
}
```

`tests/scope-resolution/bare-scope-member.expected.c` is the committed proof —
bare `value` compiles to `Counter__value`.

What ADR-057 kept from this decision: explicitness still wins where the two
levels genuinely collide, and where C itself cannot express the result the
shadowing local is emitted under a qualified C name so the outer one stays
reachable.

#### Why the original design chose explicitness

| Aspect      | `this.`/`global.` Required     | Implicit Resolution           |
| ----------- | ------------------------------ | ----------------------------- |
| Ambiguity   | **Zero** — always explicit     | Shadowing causes confusion    |
| Safety      | **Maximum** — no accidents     | Easy to reference wrong thing |
| Readability | **Self-documenting**           | Must trace scope manually     |
| Refactoring | **Safe** — rename scope once   | Must update all references    |
| Compiler    | **Simple** — just parse prefix | Complex resolution rules      |

ADR-057 accepted the right-hand column's costs in exchange for a syntax C
developers already know, and mitigated the first two rows by keeping `this.` and
`global.` available and by rejecting the one case C cannot express.

---

### 1. What exactly should `scope` provide?

Options to research:

- **Organization only** — Pure name prefixing, visibility handled separately
- **Organization + visibility** — Current namespace behavior (private by default)
- **Organization + visibility + state** — Can scopes have private state?

### 2. Should scopes nest?

**DECIDED: No nested scopes. This is permanent, not a simplification to revisit.**

The limit is imposed by the target, not by taste. C99 section 5.2.4.1 guarantees only
31 significant initial characters in an external identifier, and MISRA C:2012 Rule 5.1
is evaluated inside that budget. With six-character scope names, a depth-3 member
generates a 30-character name and stays distinct; a depth-4 member generates 38 and
does not. Nesting therefore cannot be admitted without either abandoning the guarantee
or silently truncating names that a conforming toolchain is free to conflate.

```cnx
// NOT supported:
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

- **Name resolution:** ~~`this.` and `global.` are REQUIRED inside scopes (no implicit resolution)~~ — **withdrawn by [ADR-057](adr-057-implicit-scope-resolution.md)**, which resolves bare names local → scope → global. `this.` and `global.` remain available to force a level.
- **Nested scopes:** Not supported, permanently — the generated name would exceed C99's 31-character significance guarantee at depth 4
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

## Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist** for
this feature, `warn` that it should be covered and is not, `error` that it must
be. Undeclared cells are `off`.

This ADR has never declared a matrix, which per [`README.md`](README.md) is
indistinguishable from claiming the feature cannot occur anywhere. That silence is
why #1333 survived: no obligation existed for "a scope member, in an imported
file", so nothing could report that the cell was empty.

**All six cells are occupied and are declared `error`.** They were `warn` while a
cell's context could only come from a diagnostic's position, and ADR-016's
conflict diagnostic reported `1:0` rather than the offending declaration, so
nothing could be derived from it and the ratchet had no path forward. #1241
(2026-08-29) removed that constraint — occupancy now also derives from where the
rule fired, recorded at the decision itself, which reaches every cell here at once.

**#1334 is fixed (`de137c9f`, 2026-08-29) and is no longer the blocker this ADR
recorded it as.** The conflict diagnostic now reports a real position — but that
position belongs to the file holding the FIRST definition
(`conflict-lib-a.cnx:3:0`), while the matrix resolves a diagnostic line against
the FIXTURE's parse tree, where line 3 is a comment. So
`conflict-across-files.test.cnx` still links to this ADR and lands in "no
derivable context". That costs a fixture its cell, not the matrix its
obligation.

<!-- MATRIX-SEVERITY -->

| Context      | Relationship        | Severity |
| ------------ | ------------------- | -------- |
| scope member | same file           | error    |
| scope method | same file           | error    |
| scope member | imported direct     | error    |
| scope method | imported direct     | error    |
| scope member | imported transitive | error    |
| scope method | imported transitive | error    |

`global variable` and `top-level function` are left undeclared, which reads as
`off`, and that is a claim being made deliberately rather than an omission: scope
composition is a property of a scope, so a declaration that is not inside one
cannot occupy a cell of this rule. A global variable declared twice is an ordinary
duplicate-definition error and belongs to whatever ADR governs that, not here.

## Diagnostics

| Code  | Reported when                                                                                       | Asserted by                                                                                                                                                             |
| ----- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0425 | Two definitions of the same member name in one scope, or a C-Next symbol colliding with a C/C++ one | `tests/bugs/issue-1333-scope-reopening/duplicate-member-reopened`, `tests/bugs/issue-1334-scope-declaration-sites/conflict-across-files`, `.../cross-language-conflict` |
| E0430 | A scope is declared inside another scope, in the entry file or in an included one                   | `tests/scope/nested-scope-error`, `tests/bugs/issue-1306-nested-scope-diagnostic/cross-file-nested`                                                                     |

A scope **composes**: reopening it in another file adds members rather than
redefining it (see Scope Composition above). Member names stay unique across every
block, so the check groups by scope identity, not by declaration block — two blocks in
different files that both define `Lib.useIt` are a conflict, and the diagnostic names
each definition's own file and line plus every block the scope is declared in.

Every block that declares a scope is remembered, not just the first. Before #1334
only one position was kept, so a conflict spanning two files printed the same
location twice — the diagnostic named a file the reader had already looked at
instead of the other definition.

E0430 names the position of the inner `scope` keyword and carries the flat-scope
workaround in its own text. Recovery noise that follows the rejection is suppressed:
error recovery moves the surrounding block, so any further complaint
describes a structure already known to be wrong. A second genuine nested scope is
still reported. The rejection is stated once here and enforced where a nested scope
first becomes visible, which is while the source is being read — a scope member is
not admitted as a scope declaration in the first place, so the construct never reaches
a later stage to be analyzed.

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
