# ADR-027: Do-While Loops

## Status
**Accepted**

## Context

`do-while` executes body at least once, then checks condition:
```c
do {
    byte = readByte();
} while (byte != END);
```

Occasionally useful, especially for:
- Retry loops
- Menu systems
- Read-until patterns

MISRA C has relevant rules:
- **Rule 14.4**: Controlling expression must be essentially Boolean
- **Rule 15.6**: Loop body must be enclosed in braces

## Decision Drivers

1. **Completeness** - Standard C feature
2. **Use Cases** - Sometimes cleaner than while
3. **Simplicity** - Easy to implement
4. **Familiarity** - C developers expect it
5. **MISRA Compliance** - Boolean conditions required

## Recommended Decision

**Include do-while** with boolean condition enforcement.

## Syntax

```cnx
do {
    u8 byte <- readByte();
    process(byte);
} while (byte != END_MARKER);
```

### Common Patterns

#### Retry with Limit
```cnx
u32 attempts <- 0;
bool success <- false;
do {
    success <- tryConnect();
    attempts +<- 1;
} while (!success && attempts < MAX_RETRIES);
```

#### Read Until
```cnx
u8 ch;
u32 idx <- 0;
do {
    ch <- getChar();
    buffer[idx] <- ch;
    idx +<- 1;
} while (ch != '\n' && idx < BUFFER_SIZE);
```

#### Menu Loop
```cnx
u8 choice;
do {
    displayMenu();
    choice <- getChoice();
    handleChoice(choice);
} while (choice != QUIT);
```

## Safety Rules

### E0701: Do-While Condition Must Be Boolean

The condition in a do-while must be a boolean expression (comparison, logical operation, or boolean variable). This enforces MISRA C:2012 Rule 14.4 and is consistent with ADR-022 (ternary) requirements.

```cnx
u32 count <- 5;
do {
    count -<- 1;
} while (count);  // ERROR E0701
```

**Error message:**
```
error[E0701]: do-while condition must be boolean (MISRA C:2012 Rule 14.4)
  --> file.cnx:4:10
   |
4  |     } while (count);
   |              ^^^^^ expected boolean expression
   |
   = help: use explicit comparison: count > 0 or count != 0
```

**Valid conditions:**
```cnx
// Comparisons
do { } while (count > 0);      // OK
do { } while (count != 0);     // OK
do { } while (ptr != null);    // OK

// Logical operations
do { } while (!done);          // OK (if done is bool)
do { } while (a && b);         // OK
do { } while (x > 0 || y < 10); // OK

// Boolean variables
bool running <- true;
do { } while (running);        // OK
```

## Implementation Notes

### Grammar Changes
```antlr
doWhileStatement
    : 'do' block 'while' '(' expression ')' ';'
    ;

statement
    : ...
    | doWhileStatement
    ;
```

### Semantic Analysis

The compiler must verify the condition expression is boolean:
- Comparison operators (`=`, `!=`, `<`, `<=`, `>`, `>=`)
- Logical operators (`&&`, `||`, `!`)
- Boolean-typed variables or function returns

This is the same check used for:
- `if` conditions
- `while` conditions
- `for` conditions
- Ternary conditions (ADR-022)

### CodeGenerator
Direct pass-through:
```c
do {
    // body
} while (condition);
```

### Priority
**Medium** - Nice to have, but `while` with flag works too.

## Resolved Questions

1. **Any safety checks needed?** - Yes, boolean condition enforcement (E0701) per MISRA Rule 14.4.

## MISRA Compliance

| Rule | Requirement | C-Next Status |
|------|-------------|---------------|
| 14.4 | Boolean controlling expression | Enforced (E0701) |
| 15.6 | Braces required on loop body | Enforced by grammar |

## References

- [MISRA C:2023 Rule 14.4](https://www.mathworks.com/help/bugfinder/ref/misrac2023rule14.4.html) - Boolean controlling expressions
- [MISRA C:2023 Rule 15.6](https://pvs-studio.com/en/docs/warnings/v2507/) - Brace requirements
- C do-while loop semantics
