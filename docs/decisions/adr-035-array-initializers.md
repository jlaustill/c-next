# ADR-035: Array Initializers

## Status

**Implemented**

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

## Decision

**Support array initializers** with C-Next assignment syntax. C-Next uses square brackets `[]` instead of curly brackets `{}` to avoid confusion between arrays and scopes (functions, loops, etc).

## Syntax

### Basic Initializer

```cnx
u8 data[5] <- [1, 2, 3, 4, 5];
```

### Inferred Size

```cnx
u8 data[] <- [1, 2, 3, 4, 5];  // Size inferred as 5
```

### Fill-All Initialization

```cnx
u8 buffer[100] <- [0*];  // All 100 elements initialized to 0
```

### String Initialization

```cnx
u8 message[] <- "Hello";  // Includes null terminator
```

### Const Lookup Tables

```cnx
const u8 sinTable[256] <- [
    0, 3, 6, 9, 12, 15, 18, 21,
    // ... more values
];
```

### Struct Array Initialization

```cnx
struct Command { u8 code; u8 length; }

const Command commands[] <- [
    { code: 0x01, length: 4 },
    { code: 0x02, length: 8 },
    { code: 0x03, length: 2 },
];
```

### Nested Array Initialization

```cnx
u8 matrix[3][3] <- [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
];
```

## Implementation Notes

### Grammar Changes

```antlr
arrayInitializer
    : '[' (expression '*'? | arrayInitializer) (',' (expression '*'? | arrayInitializer))* ','? ']'
    ;

variableDeclaration
    : constModifier? type IDENTIFIER arrayDimension? ('<-' (expression | arrayInitializer))? ';'
    ;
```

### Size Inference

When `[]` used without size, count initializer elements:

```cnx
u8 data[] <- [1, 2, 3];  // data[3]
```

### CodeGenerator

```c
uint8_t data[5] = {1, 2, 3, 4, 5};
const uint8_t sinTable[256] = { 0, 3, 6, ... };
```

### Priority

**Medium** - Useful for lookup tables and configuration.

## MISRA Research

### MISRA C:2023 Rule 9.3: "Arrays shall not be partially initialized"

The rationale is that explicit initialization demonstrates every element was deliberately considered. Exceptions allowed:

| Pattern                      | Allowed? | Reason                        |
| ---------------------------- | -------- | ----------------------------- |
| `int x[3] = {0,1,2}`         | ✅       | All elements explicit         |
| `int z[3] = {0}`             | ✅       | Shorthand for all zeros       |
| `int a[30] = {[1]=1,[15]=1}` | ✅       | Only designated initializers  |
| `char c[20] = "Hello"`       | ✅       | String literal exception      |
| `int y[3] = {0,1}`           | ❌       | Missing final element         |
| `int b[30] = {[1]=1, 1}`     | ❌       | Mixed designated and implicit |

### MISRA C:2023 Rule 9.5: Explicit Size with Designated Initializers

When using designated initializers, array size must be explicit—because adding/removing the highest index can silently change array size.

### C99 Standard: Partial Initialization Zero-Fill

C99 §6.7.8/6.7.9 guarantees: When fewer initializers are provided than array elements, remaining elements are initialized "implicitly the same as objects with static storage duration" (i.e., zero for arithmetic types, NULL for pointers).

```c
int y[5] = {1,2,3};   // y = {1, 2, 3, 0, 0}
int z[4] = {1};       // z = {1, 0, 0, 0}
```

### Common Bugs

| Bug                                    | Description                                    | C-Next Mitigation            |
| -------------------------------------- | ---------------------------------------------- | ---------------------------- |
| **Uninitialized elements**             | Relying on implicit zeros without realizing it | Require explicit fill syntax |
| **Size mismatch**                      | Too many/few initializers                      | Compile error                |
| **Designated initializer size change** | Removing `[19]=x` silently shrinks array       | Not supported                |

## C-Next Decisions

### 1. Size Mismatch: Compile Error

More initializer elements than array size is a **hard error**:

```cnx
u8 data[3] <- [1, 2, 3, 4, 5];  // ERROR: 5 elements for size-3 array
```

### 2. Explicit Fill Syntax: `[value*]`

C-Next does NOT support C's implicit zero-fill for partial initialization. Instead, use the explicit fill-all syntax `[value*]`:

```cnx
u8 buffer[100] <- [0*];      // All 100 elements initialized to 0
u8 ones[50] <- [1*];         // All 50 elements initialized to 1
i32 magic[10] <- [0xDEAD*];  // All 10 elements initialized to 0xDEAD
```

The `*` is familiar from bash globs, regex, and other contexts meaning "all" or "any number of".

This is clearer than C's `{0}` which looks like it only initializes the first element but actually zero-fills all.

### 3. No Designated Initializers

C-Next does **not** support C99 designated initializers like `[index]=value`. Rationale:

- Violates explicit initialization principle (gaps are implicitly zero-filled)
- Can silently change array size when highest index changes
- Sparse arrays are rare in embedded; explicit full initialization is clearer

### 4. Partial Initialization: Not Allowed

```cnx
u8 data[5] <- [1, 2, 3];  // ERROR: 3 elements for size-5 array
```

If you want partial values with zero-fill, be explicit:

```cnx
u8 data[5] <- [1, 2, 3, 0, 0];  // OK: all elements explicit
```

## References

- [MISRA C:2023 Rule 9.3 - MathWorks](https://www.mathworks.com/help/bugfinder/ref/misrac2023rule9.3.html)
- [MISRA C:2023 Rule 9.5 - MathWorks](https://www.mathworks.com/help/bugfinder/ref/misrac2023rule9.5.html)
- [V2540 MISRA Arrays Partial Initialization - PVS-Studio](https://pvs-studio.com/en/docs/warnings/v2540/)
- [C Array Initialization - cppreference.com](https://en.cppreference.com/w/c/language/array_initialization)
- C99 Standard §6.7.8, §6.7.9
