# ADR-017: Enums

## Status
**Implemented**

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
    Motor_State_IDLE = 0,
    Motor_State_RUNNING = 1,
    Motor_State_STALLED = 2
} Motor_State;

Motor_State current = Motor_State_IDLE;
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
    State_IDLE = 0,
    State_RUNNING = 1,
    State_ERROR = 255
} State;

State currentState = State_IDLE;
if (currentState == State_IDLE) { }
uint8_t val = (uint8_t)State_ERROR;
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

### CodeGenerator
- Generate typedef enum with prefixed member names
- Handle explicit value assignments with `<-`
- Auto-increment values when not specified (like C)
- Prefix member names: `State.IDLE` → `State_IDLE`

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

## References

- TypeScript enum semantics
- C# enum with explicit casting
- Zig enum type safety
- [Safer Enums in Go](https://threedots.tech/post/safer-enums-in-go/)
