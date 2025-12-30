# ADR-027: Do-While Loops

## Status
**Research**

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

## Decision Drivers

1. **Completeness** - Standard C feature
2. **Use Cases** - Sometimes cleaner than while
3. **Simplicity** - Easy to implement
4. **Familiarity** - C developers expect it

## Recommended Decision

**Include do-while** - Simple to add, occasionally useful.

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
do {
    ch <- getChar();
    buffer[idx] <- ch;
    idx +<- 1;
} while (ch != '\n' && idx < BUFFER_SIZE);
```

#### Menu Loop
```cnx
do {
    displayMenu();
    choice <- getChoice();
    handleChoice(choice);
} while (choice != QUIT);
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

### CodeGenerator
Direct pass-through:
```c
do {
    // body
} while (condition);
```

### Priority
**Medium** - Nice to have, but `while` with flag works too.

## Open Questions

1. Any safety checks needed?

## References

- C do-while loop
