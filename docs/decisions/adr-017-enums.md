# ADR-017: Enums

## Status
**Research**

## Context

Enums are fundamental to embedded C programming. They're used for:
- State machines (IDLE, RUNNING, ERROR)
- Error codes (OK, TIMEOUT, INVALID_PARAM)
- Register field values (MODE_SPI, MODE_I2C)
- Configuration options (BAUD_9600, BAUD_115200)

C-Next currently has no enum support. This is a critical gap for v1.

## Decision Drivers

1. **C Compatibility** - Generated code should work with existing C enums
2. **Type Safety** - Prevent mixing unrelated enum values
3. **Explicit Values** - Embedded code often needs specific values for hardware
4. **Simplicity** - Don't over-engineer (no Rust-style enum variants with data)

## Options Considered

### Option A: C-Style Enums
```cnx
enum State {
    IDLE,           // 0
    RUNNING,        // 1
    ERROR <- 255    // Explicit value
}

State current <- State.IDLE;
```

Generates:
```c
typedef enum { IDLE = 0, RUNNING = 1, ERROR = 255 } State;
State current = IDLE;
```

**Pros:** Familiar, simple, direct C mapping
**Cons:** No namespacing (IDLE conflicts with other enums)

### Option B: Namespaced Enums
```cnx
enum State {
    IDLE,
    RUNNING,
    ERROR <- 255
}

State current <- State.IDLE;
if (current = State.RUNNING) { }
```

Generates:
```c
typedef enum { State_IDLE = 0, State_RUNNING = 1, State_ERROR = 255 } State;
State current = State_IDLE;
if (current == State_RUNNING) { }
```

**Pros:** No naming conflicts, matches scope syntax
**Cons:** Longer names in generated C

### Option C: Scoped Enums (C++11 style)
```cnx
enum State {
    IDLE,
    RUNNING,
    ERROR <- 255
}

State current <- State.IDLE;
```

Generates:
```c
typedef enum State { State_IDLE = 0, State_RUNNING = 1, State_ERROR = 255 } State;
#define IDLE State_IDLE    // Optional compatibility aliases
```

**Pros:** Best of both worlds
**Cons:** More complex generation

## Recommended Decision

**Option B: Namespaced Enums** - Consistent with C-Next's `scope` approach.

## Syntax Details

### Basic Enum
```cnx
enum ErrorCode {
    OK,              // 0 (auto-increment)
    TIMEOUT,         // 1
    INVALID_PARAM,   // 2
    HARDWARE_FAULT   // 3
}
```

### Explicit Values
```cnx
enum SPI_Mode {
    MODE_0 <- 0,
    MODE_1 <- 1,
    MODE_2 <- 2,
    MODE_3 <- 3
}
```

### Hex Values (common in embedded)
```cnx
enum Command {
    READ  <- 0x01,
    WRITE <- 0x02,
    ERASE <- 0x04,
    RESET <- 0xFF
}
```

### Usage
```cnx
ErrorCode result <- ErrorCode.OK;

if (result = ErrorCode.TIMEOUT) {
    // Handle timeout
}

// Switch (once ADR-025 implemented)
switch (result) {
    case ErrorCode.OK: { }
    case ErrorCode.TIMEOUT: { }
}
```

## Implementation Notes

### Grammar Changes
```antlr
enumDeclaration
    : 'enum' IDENTIFIER '{' enumMember (',' enumMember)* ','? '}'
    ;

enumMember
    : IDENTIFIER ('<-' expression)?
    ;
```

### CodeGenerator Changes
- Track enum types in type registry
- Generate typedef enum with prefixed names
- Handle enum member access (EnumName.MEMBER)

## Open Questions

1. Should enums have an explicit underlying type? `enum Flags : u8 { ... }`
2. Should we support flags/bitfield enums? `enum Flags { A <- 1, B <- 2, C <- 4 }`
3. Exhaustiveness checking in switch statements?

## References

- C11 enum specification
- Rust enum (for comparison of what NOT to do for v1)
- MISRA C enum guidelines
