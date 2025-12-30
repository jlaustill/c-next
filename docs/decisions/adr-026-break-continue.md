# ADR-026: Break and Continue

## Status
**Research**

## Context

`break` and `continue` are essential for loop control:
- `break` - exit loop early
- `continue` - skip to next iteration

Also used in switch statements (covered by ADR-025).

## Decision Drivers

1. **Loop Control** - Essential for early exit patterns
2. **Switch Statements** - Required for case termination
3. **C Compatibility** - Same semantics as C
4. **Labeled Breaks** - Useful for nested loops

## Options Considered

### Option A: C-Style
```cnx
while (true) {
    if (done) {
        break;
    }
    if (skip) {
        continue;
    }
    process();
}
```

**Pros:** Familiar, simple
**Cons:** No labeled breaks for nested loops

### Option B: Labeled Breaks
```cnx
outer: for (u32 i <- 0; i < 10; i +<- 1) {
    for (u32 j <- 0; j < 10; j +<- 1) {
        if (found) {
            break outer;  // Break from outer loop
        }
    }
}
```

**Pros:** Cleaner than goto for nested loops
**Cons:** More complex, rarely needed

## Recommended Decision

**Option A: C-Style** for v1 - Simple and sufficient.

Consider labeled breaks for v2.

## Syntax

### Basic Break
```cnx
for (u32 i <- 0; i < 100; i +<- 1) {
    if (buffer[i] = 0) {
        break;  // Exit loop
    }
}
```

### Basic Continue
```cnx
for (u32 i <- 0; i < 100; i +<- 1) {
    if (buffer[i] = 0) {
        continue;  // Skip to next iteration
    }
    process(buffer[i]);
}
```

### In While Loop
```cnx
while (hasData()) {
    u8 byte <- readByte();
    if (byte = SKIP_MARKER) {
        continue;
    }
    if (byte = END_MARKER) {
        break;
    }
    buffer[idx] <- byte;
    idx +<- 1;
}
```

### In Switch (implicit with ADR-025)
With ADR-025's implicit break, explicit `break` in switch is only for early exit:
```cnx
switch (state) {
    case State.PROCESSING: {
        if (abort) {
            break;  // Early exit from case
        }
        doWork();
    }
}
```

## Implementation Notes

### Grammar Changes
```antlr
breakStatement
    : 'break' ';'
    ;

continueStatement
    : 'continue' ';'
    ;

statement
    : ...
    | breakStatement
    | continueStatement
    ;
```

### CodeGenerator
Direct pass-through to C.

### Validation
- `break` only valid inside loop or switch
- `continue` only valid inside loop

### Priority
**Critical** - Required for switch and loop control.

## Open Questions

1. Labeled breaks for v2?
2. Error message for break/continue outside loop?

## References

- C break and continue
- Java labeled breaks
- Rust loop labels
