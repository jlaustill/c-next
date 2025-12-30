# ADR-035: Array Initializers

## Status
**Research**

## Context

Array initialization is common in embedded:
- Lookup tables
- Default configurations
- ROM data
- Font/image data

C supports brace-enclosed initializers:
```c
int values[] = {1, 2, 3, 4, 5};
```

## Decision Drivers

1. **Lookup Tables** - Sin tables, CRC tables, etc.
2. **Configuration** - Default settings arrays
3. **C Compatibility** - Generate valid initializers
4. **Const Data** - ROM placement

## Recommended Decision

**Support array initializers** with C-Next assignment syntax.

## Syntax

### Basic Initializer
```cnx
u8 data[5] <- {1, 2, 3, 4, 5};
```

### Inferred Size
```cnx
u8 data[] <- {1, 2, 3, 4, 5};  // Size inferred as 5
```

### Partial Initialization
```cnx
u8 buffer[100] <- {0};  // First element 0, rest zero-initialized
```

### String Initialization
```cnx
u8 message[] <- "Hello";  // Includes null terminator
```

### Const Lookup Tables
```cnx
const u8 sinTable[256] <- {
    0, 3, 6, 9, 12, 15, 18, 21,
    // ... more values
};
```

### Struct Array Initialization
```cnx
struct Command { u8 code; u8 length; }

const Command commands[] <- {
    Command { code: 0x01, length: 4 },
    Command { code: 0x02, length: 8 },
    Command { code: 0x03, length: 2 },
};
```

### Nested Array Initialization
```cnx
u8 matrix[3][3] <- {
    {1, 2, 3},
    {4, 5, 6},
    {7, 8, 9}
};
```

## Implementation Notes

### Grammar Changes
```antlr
arrayInitializer
    : '{' (expression | arrayInitializer) (',' (expression | arrayInitializer))* ','? '}'
    ;

variableDeclaration
    : constModifier? type IDENTIFIER arrayDimension? ('<-' (expression | arrayInitializer))? ';'
    ;
```

### Size Inference
When `[]` used without size, count initializer elements:
```cnx
u8 data[] <- {1, 2, 3};  // data[3]
```

### CodeGenerator
```c
uint8_t data[5] = {1, 2, 3, 4, 5};
const uint8_t sinTable[256] = { 0, 3, 6, ... };
```

### Priority
**Medium** - Useful for lookup tables and configuration.

## Open Questions

1. Designated initializers? `{[0] = 1, [5] = 10}`
2. Partial initialization fills with zero?
3. Size mismatch handling?

## References

- C array initialization
- C99 designated initializers
