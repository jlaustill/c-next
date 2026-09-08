# ADR-017: Enums

## Status

**Implemented**

**Related:** ADR-063 (Identifier Syntax — amends the qualified-name separator)

> **Amended by ADR-063 (Issue #1117).** Enum members join their components with
> `__`: `State__IDLE` globally, `Motor__State__IDLE` inside a scope. ADR-063
> forbids a C-Next identifier from containing `__`, so a generated member name
> can no longer collide with a plain identifier such as `u8 State_IDLE`.

## Context

Enums are fundamental to embedded C programming:

- State machines (IDLE, RUNNING, ERROR)
- Error codes (OK, TIMEOUT, INVALID_PARAM)
- Register field values (MODE_SPI, MODE_I2C)
- Configuration options (BAUD_9600, BAUD_115200)
- Bit flags ({ A <- 1, B <- 2, C <- 4 })

C-Next currently has no enum support. This is a critical gap for v1.

## Research Summary

### The Problem with C Enums

C enums are just integers, which allows bugs:

```c
typedef enum { IDLE = 0, RUNNING = 1 } State;
typedef enum { OFF = 0, ON = 1 } Power;

void handleState(State s);

Power p = ON;
handleState(p);      // COMPILES! But Power != State - BUG!
handleState(42);     // COMPILES! 42 isn't a valid State - BUG!
```

### Modern Language Approach (TypeScript, C#, Zig)

Enums are their own type, not freely interchangeable with integers:

- Can't compare different enum types
- Can't assign integer to enum without explicit cast
- Explicit conversion required for integer value

## Decision

**Type-safe enums with C-style cast syntax for hardware access.**

### Syntax

```cnx
enum State {
    IDLE,
    RUNNING,
    PAUSED,
    ERROR
}
```

With explicit values:

```cnx
enum Command {
    READ  <- 0x01,
    WRITE <- 0x02,
    ERASE <- 0x04,
    RESET <- 0xFF
}
```

Bit flags pattern:

```cnx
enum Flags {
    NONE     <- 0,
    READABLE <- 1,
    WRITABLE <- 2,
    EXECUTABLE <- 4
}
```

### Usage

```cnx
State currentState <- State.IDLE;

// Comparison - enum to enum of SAME type only
if (currentState = State.IDLE) {
    startMotor();
}

// Assignment
currentState <- State.ERROR;
```

### Type Safety Rules

```cnx
enum State { IDLE, RUNNING }
enum Power { OFF, ON }

State s <- State.IDLE;
Power p <- Power.ON;

// ALLOWED:
if (s = State.RUNNING) { }     // Same enum type comparison
s <- State.IDLE;                // Same enum type assignment

// NOT ALLOWED (compile errors):
if (s = Power.ON) { }          // ERROR: can't compare State to Power
if (s = 0) { }                 // ERROR: can't compare enum to integer
s <- 1;                        // ERROR: can't assign integer to enum
s <- p;                        // ERROR: can't assign Power to State
```

### Casting to Integer (for hardware registers)

When you need the integer value for hardware access, use C-style cast:

```cnx
enum SPIMode {
    MODE_0 <- 0,
    MODE_1 <- 1,
    MODE_2 <- 2,
    MODE_3 <- 3
}

// Writing enum value to hardware register
SPI_CR1[3, 2] <- (u8)SPIMode.MODE_2;

// Storing enum as integer
u8 modeValue <- (u8)SPIMode.MODE_1;
```

Enums are always treated as **unsigned integers** when cast:

- Cast to `u8`, `u16`, `u32`, or `u64`
- Value must fit in target type (compile error if too large)
- Negative values are NOT allowed (compile error)

### Scoped Enums

Enums declared inside a scope get the scope prefix:

```cnx
scope Motor {
    public enum State {
        IDLE,
        RUNNING,
        STALLED
    }
}

Motor.State current <- Motor.State.IDLE;
```

Generates:

```c
typedef enum {
    Motor__State__IDLE = 0,
    Motor__State__RUNNING = 1,
    Motor__State__STALLED = 2
} Motor__State;

Motor__State current = Motor__State__IDLE;
```

### Error Messages

Type safety violations produce clear error messages:

```
Error: Cannot compare State enum to Power enum
Error: Cannot assign integer to State enum
Error: Cannot assign Power enum to State enum
Error: Negative values not allowed in enum (found -1)
Error: Enum value 300 exceeds u8 range (0-255)
```

### Generated C

```cnx
enum State { IDLE, RUNNING, ERROR <- 255 }
State currentState <- State.IDLE;
if (currentState = State.IDLE) { }
u8 val <- (u8)State.ERROR;
```

Generates:

```c
typedef enum {
    State__IDLE = 0,
    State__RUNNING = 1,
    State__ERROR = 255
} State;

State currentState = State__IDLE;
if (currentState == State__IDLE) { }
uint8_t val = (uint8_t)State__ERROR;
```

## Implementation

### Grammar Changes

```antlr
enumDeclaration
    : 'enum' IDENTIFIER '{' enumMember (',' enumMember)* ','? '}'
    ;

enumMember
    : IDENTIFIER ('<-' expression)?
    ;

// Cast expression (for enum to integer)
castExpression
    : '(' type ')' unaryExpression
    ;
```

### Type System

- Register enum types in type registry
- Track enum members and their integer values
- Validate comparisons: same enum type only
- Validate assignments: same enum type only
- Allow explicit cast to unsigned integer types

### Generated C

- Generate typedef enum with prefixed member names
- Handle explicit value assignments with `<-`
- Auto-increment values when not specified (like C)
- Prefix member names: `State.IDLE` → `State__IDLE`

## Consequences

### Positive

- Prevents real bugs (wrong enum type, accidental integer comparison)
- Hardware access still possible via explicit cast
- Matches modern language expectations (TypeScript, C#)
- Still generates standard C enums

### Negative

- Slightly more verbose than C for hardware writes
- Stricter than C (but that's the point!)

## Open Questions (Deferred)

1. Exhaustiveness checking in switch statements? (ADR-025)

## Diagnostics

| Code  | Reported when                                                                          | Asserted by                                                                          |
| ----- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| E0424 | An enum member is written bare where nothing names its enum, or names a different enum | `tests/adr-017/unqualified-enum-*.test.cnx`, `tests/adr-017/enum-bare-in-*.test.cnx` |
| E0428 | A value assigned to an enum-typed target is not of that enum                           | `tests/adr-017/enum-error-assign-*.test.cnx`                                         |
| E0434 | The two sides of a comparison are not the same enum type                               | `tests/adr-017/enum-error-compare-*.test.cnx`                                        |

A bare member (`RED` for `Color.RED`) is accepted only where the position
already names the enum: a declaration or assignment whose type is the enum, a
return from a function of that type, a struct field or array element of that
type, and a ternary arm in any of those. A comparison operand, a call
argument, a subscript and an array dimension name nothing, and a bare member
there is rejected with the enums that declare it. A member of a DIFFERENT enum
under an enum-typed position is the same mistake and is reported the same way
(#1322 closed that one -- it used to reach the generated C bare). The rule is
decided during analysis, at the member's own position, and every offense in a
file is reported.

## Scope-context matrix

Declared for the enum type-safety rules -- a value assigned to an enum must be
of that enum type, and the two sides of a comparison must be the same enum type.

<!-- MATRIX-SEVERITY -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | error    |
| scope member       | imported direct     | error    |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | error    |
| scope member       | imported transitive | error    |

Every cell is `error`, and none of them is an assumption. An enum value is an
EXPRESSION, so it reaches an initializer as well as a function body, which
occupies the two declaration contexts; and an enum TYPE crosses an include
boundary, so the rule is observable wherever the enum was declared. Both were
probed rather than reasoned about.

The imported columns are the ones worth stating: a checker that consulted only
the file it is looking at finds no enum there, and "no enum" reads as "the rule
does not apply" -- so the rule would go quiet across an include instead of
failing, which is the silence this matrix exists to make visible.

## References

- TypeScript enum semantics
- C# enum with explicit casting
- Zig enum type safety
- [Safer Enums in Go](https://threedots.tech/post/safer-enums-in-go/)
