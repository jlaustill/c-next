# ADR-030: Forward Declarations

## Status
**Research**

## Context

Forward declarations are needed in C for:
- Mutual recursion (function A calls B, B calls A)
- Opaque types (declare struct without defining)
- Header files (prototypes before definitions)
- Circular dependencies

## Decision Drivers

1. **Multi-File Projects** - Headers need prototypes
2. **Mutual Recursion** - Functions calling each other
3. **Opaque Types** - Hide implementation details
4. **C Compatibility** - Generate valid prototypes

## Recommended Decision

**Support forward declarations** for functions and structs.

## Syntax

### Function Forward Declaration
```cnx
// Prototype - no body
void processData(u8 buffer[], usize length);
bool validateInput(u32 value);

// Later, full definition
void processData(u8 buffer[], usize length) {
    // implementation
}
```

### Opaque Struct Declaration
```cnx
// Forward declare - no body
struct Handle;

// Function using opaque type
void closeHandle(Handle h);

// Later, or in another file, define it
struct Handle {
    u32 id;
    void internal;
}
```

### Mutual Recursion
```cnx
// Forward declare
bool isEven(u32 n);
bool isOdd(u32 n);

// Define
bool isEven(u32 n) {
    if (n = 0) { return true; }
    return isOdd(n - 1);
}

bool isOdd(u32 n) {
    if (n = 0) { return false; }
    return isEven(n - 1);
}
```

## Implementation Notes

### Grammar Changes
```antlr
// Function prototype (no body)
functionPrototype
    : type IDENTIFIER '(' parameterList? ')' ';'
    ;

// Opaque struct (no body)
opaqueStructDeclaration
    : 'struct' IDENTIFIER ';'
    ;

declaration
    : ...
    | functionPrototype
    | opaqueStructDeclaration
    ;
```

### Header Generation
Forward declarations go in `.h` file:
```c
// file.h
#ifndef FILE_H
#define FILE_H

void processData(uint8_t buffer[], size_t length);
bool validateInput(uint32_t value);

typedef struct Handle Handle;

#endif
```

### Priority
**Critical** - Essential for multi-file projects.

## Open Questions

1. Auto-generate prototypes for all public functions?
2. How to mark functions as "private" (no prototype in header)?
3. Extern declarations for global variables?

## References

- C forward declarations
- C header file conventions
