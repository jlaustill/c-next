# ADR-025: Switch Statements

## Status
**Research**

## Context

Switch statements are fundamental to embedded programming:
- State machines
- Command dispatching
- Protocol parsing
- Interrupt handlers

C's switch has footguns (fall-through, missing breaks), but the pattern is essential.

## Decision Drivers

1. **State Machines** - Core embedded pattern
2. **Safety** - Prevent accidental fall-through
3. **Exhaustiveness** - Catch missing cases with enums
4. **C Compatibility** - Generate valid C switch

## Options Considered

### Option A: C-Style with Required Break
```cnx
switch (state) {
    case State.IDLE: {
        startMotor();
        break;
    }
    case State.RUNNING: {
        checkSensors();
        break;
    }
    default: {
        handleError();
        break;
    }
}
```

**Pros:** Familiar
**Cons:** Still needs break, easy to forget

### Option B: Implicit Break, Explicit Fallthrough
```cnx
switch (state) {
    case State.IDLE: {
        startMotor();
    }  // Implicit break
    case State.RUNNING: {
        checkSensors();
    }
    case State.STOPPING:
    fallthrough;  // Explicit fall-through
    case State.STOPPED: {
        cleanup();
    }
}
```

**Pros:** Safe by default, explicit intent
**Cons:** Different from C

### Option C: Match Expression (Rust-style)
```cnx
u32 result <- match (cmd) {
    Command.READ: 1,
    Command.WRITE: 2,
    Command.ERASE: 3,
};
```

**Pros:** Expression, exhaustive
**Cons:** Very different from C, complex

## Recommended Decision

**Option B: Implicit Break, Explicit Fallthrough** - Safety first.

## Syntax

### Basic Switch
```cnx
switch (state) {
    case State.IDLE: {
        startMotor();
    }
    case State.RUNNING: {
        updateSensors();
    }
    case State.ERROR: {
        logError();
    }
    default: {
        // Unknown state
    }
}
```

### Multiple Cases (No Fallthrough)
```cnx
switch (cmd) {
    case Command.READ:
    case Command.PEEK: {
        // Handle both read operations
        readData();
    }
    case Command.WRITE: {
        writeData();
    }
}
```

### Explicit Fallthrough
```cnx
switch (level) {
    case 3: {
        doLevel3();
        fallthrough;
    }
    case 2: {
        doLevel2();
        fallthrough;
    }
    case 1: {
        doLevel1();
    }
}
```

### Generated C
```c
switch (state) {
    case State_IDLE: {
        startMotor();
        break;  // Implicit break added
    }
    case State_RUNNING: {
        updateSensors();
        break;
    }
    // ...
}
```

## Implementation Notes

### Grammar Changes
```antlr
switchStatement
    : 'switch' '(' expression ')' '{' switchCase* defaultCase? '}'
    ;

switchCase
    : 'case' expression ':' (block | 'fallthrough' ';')
    | 'case' expression ':' 'case' expression ':' block  // Multiple cases
    ;

defaultCase
    : 'default' ':' block
    ;
```

### CodeGenerator
- Add `break;` after each case block (unless fallthrough)
- Handle multiple case labels
- Warn on missing default with non-enum types

### Priority
**Critical** - Essential for embedded state machines.

## Open Questions

1. Require exhaustive matching for enums?
2. Allow expressions in case labels? `case x + 1:`
3. Require braces around case bodies?

## References

- C switch statement
- Swift switch (no fallthrough by default)
- Rust match expression
- MISRA C switch rules
