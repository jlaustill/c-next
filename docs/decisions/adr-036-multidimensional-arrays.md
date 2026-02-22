# ADR-036: Multi-dimensional Arrays

## Status

**Implemented**

## Context

Multi-dimensional arrays are used for:

- Matrices (graphics, transforms)
- 2D sensor data
- Lookup tables with multiple indices
- Display buffers

## Decision Drivers

1. **Graphics** - Transformation matrices
2. **Display** - Framebuffers, character buffers
3. **Tables** - 2D lookup tables
4. **C Compatibility** - Row-major layout
5. **Safety** - Bounds checking and type enforcement

## Recommended Decision

**Support multi-dimensional arrays** with compile-time safety guarantees exceeding standard C.

## Syntax

### 2D Arrays

```cnx
u8[24][80] display;  // 24 rows, 80 columns

display[0][0] <- 'H';
display[0][1] <- 'i';
```

### 3D Arrays

```cnx
u8[16][16][16] voxels;

voxels[x][y][z] <- material;
```

### Matrices

```cnx
f32[4][4] transform;

// Identity matrix
transform[0][0] <- 1.0;
transform[1][1] <- 1.0;
transform[2][2] <- 1.0;
transform[3][3] <- 1.0;
```

### With Initialization (ADR-035 Syntax)

Per ADR-035, array initializers use square brackets `[]`, not curly braces:

```cnx
u8[128][8] font <- [
    [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],  // ' '
    [0x18, 0x3C, 0x3C, 0x18, 0x18, 0x00, 0x18, 0x00],  // '!'
    // ... more character data
];
```

### Fill-All Syntax for Multi-dimensional

Extending ADR-035's `[value*]` syntax:

```cnx
u8[4][4] matrix <- [0*][4*];     // All 16 elements = 0
                                 // Read as: 4 rows, each filled with [0*]

i32[3][3][3] cube <- [0*][3*][3*];  // All 27 elements = 0

// Fill with non-zero values
u8[24][80] screen <- [' '*][80*];   // All spaces (ASCII 32)
```

### In Struct

```cnx
struct Image {
    u32 width;
    u32 height;
    u8[240][320] pixels;  // 320x240 display
}
```

### As Function Parameter (Size Enforced)

```cnx
void matrixMultiply(f32[4][4] a, f32[4][4] b, f32[4][4] result) {
    // All dimensions enforced at compile time
    // Unlike C, you cannot pass a [3][3] matrix here
}
```

## Type System Design

### Nested Types

Multi-dimensional array indexing produces nested array types:

```cnx
u8[8][8][8] matrix;

// Type of matrix[1] is u8[8][8]
// Type of matrix[1][2] is u8[8]
// Type of matrix[1][2][3] is u8

u8[8][8] row <- matrix[0];      // Copy first "plane"
u8[8] column <- matrix[0][0];   // Copy first row of first plane
u8 value <- matrix[0][0][0];    // Single element
```

### `.length` Property (Compile-Time)

The `.length` property returns the outermost dimension and is resolved at compile time:

```cnx
u8[4][8] matrix;
const usize rows <- matrix.length;      // 4 (compile-time const)
const usize cols <- matrix[0].length;   // 8 (compile-time const)
```

Generated C:

```c
uint8_t matrix[4][8];
const size_t rows = 4;   // Compile-time constant
const size_t cols = 8;   // Compile-time constant
```

### Function Parameters: Strict Enforcement

Unlike C (where array sizes in parameters are advisory), C-Next enforces dimensions at compile time:

```cnx
void process4x4(f32[4][4] matrix) {
    // Implementation uses matrix.length = 4, matrix[0].length = 4
}

f32[3][3] small;
f32[4][4] correct;

process4x4(correct);  // OK
process4x4(small);    // COMPILE ERROR: expected [4][4], got [3][3]
```

This prevents the entire class of "array decay" bugs that plague C.

## Implementation Notes

### Grammar Changes

```antlr
arrayDimension
    : '[' expression? ']' ('[' expression? ']')*
    ;

// Fill-all for multi-dimensional
arrayInitializer
    : '[' expression '*' ']' ('[' INTEGER_LITERAL '*' ']')*  // Fill-all
    | '[' (expression | arrayInitializer) (',' (expression | arrayInitializer))* ','? ']'
    ;
```

### Memory Layout

C-Next uses **row-major** order (same as C):

- `arr[i][j]` = `arr + i * cols + j`
- Last index varies fastest in memory

This is the only sensible choice for C compatibility.

### CodeGenerator

Direct mapping to C with size enforcement:

```c
// C-Next input
void process(u8[4][4] data) { }

// Generated C - preserve array notation for safety
void process(uint8_t data[4][4]) {
    // Or: void process(uint8_t (*data)[4])
    // With static analysis metadata
}
```

### Priority

**Medium** - Useful but many embedded apps don't need.

## MISRA C Research

### Relevant MISRA C:2012 Rules

| Rule     | Category | Description                                      | C-Next Mitigation                             |
| -------- | -------- | ------------------------------------------------ | --------------------------------------------- |
| **9.2**  | Required | Initializers shall be enclosed in braces         | Enforced: nested `[]` required                |
| **17.5** | Advisory | Array parameters should have bounds specified    | Enforced: bounds always specified and checked |
| **18.1** | Required | Pointer arithmetic must stay within array bounds | Compile-time bounds checking                  |
| **1.3**  | Required | No undefined behavior                            | Bounds checks eliminate UB from array access  |

### Rule 9.2: Brace Enclosure for Multi-dimensional

MISRA requires each row's initializers to be enclosed in braces:

```c
// MISRA Compliant
int x[4][2] = {{0,0}, {1,0}, {0,1}, {1,1}};

// MISRA Non-Compliant (missing inner braces)
int w[4][2] = {0, 0, 1, 0, 0, 1, 1, 1};
```

C-Next enforces this with `[]` syntax - each dimension requires its own brackets.

### Rule 17.5: Array Parameter Bounds

MISRA advises specifying array bounds in function parameters to enable static analysis. C-Next makes this **mandatory and enforced**.

### Rule 18.1: Pointer Arithmetic Within Bounds

MISRA requires pointer arithmetic to stay within the originating array. C-Next achieves this through:

- Compile-time bounds checking for constant indices
- Runtime bounds checking for variable indices (optional, enabled by default)
- `.length` property eliminates need for manual size tracking

## Security Research: CWE Vulnerabilities

### CWE-125: Out-of-bounds Read

"The product reads data past the end, or before the beginning, of the intended buffer."

**Consequences:**

- Information disclosure (cryptographic keys, PII, memory addresses)
- ASLR bypass through memory address leaks
- Denial of service via segmentation faults
- The 2024 CrowdStrike outage was caused by CWE-125

**C-Next Mitigation:** Compile-time and runtime bounds checking prevents all out-of-bounds reads.

### CWE-787: Out-of-bounds Write

"The product writes data past the end, or before the beginning, of the intended buffer."

**Consequences:**

- Arbitrary code execution
- Data corruption
- Stack smashing attacks
- Control flow hijacking

**C-Next Mitigation:** Same bounds checking prevents out-of-bounds writes.

### CWE-119: Improper Restriction of Operations within Bounds

Parent category covering all buffer access issues.

**C-Next Mitigation:** Comprehensive bounds enforcement addresses the entire category.

## Common Bug Patterns

### Bug 1: Array Decay in Function Parameters (SEI CERT ARR01-C)

**The Problem:**

```c
void clear(int array[]) {
    // sizeof(array) returns pointer size (4 or 8), NOT array size!
    for (size_t i = 0; i < sizeof(array) / sizeof(array[0]); i++) {
        array[i] = 0;
    }
}

int data[100];
clear(data);  // Only clears 1-2 elements!
```

**Why This Happens:**
In C, array parameters "decay" to pointers. The size information is lost. This affects multi-dimensional arrays too:

```c
void process(int matrix[4][4]) {
    // sizeof(matrix) is still pointer size!
    // Only the innermost dimension is preserved
}
```

**C-Next Solution:**

- `.length` is resolved at compile time, never at runtime
- Array parameters retain their full type including all dimensions
- Transpiler generates size constants, not runtime calculations

### Bug 2: Loop Index/Dimension Mismatch (SEI CERT ARR30-C)

**The Problem:**

```c
#define ROWS 10
#define COLS 5

int matrix[ROWS][COLS];

// WRONG: swapped loop limits
for (size_t i = 0; i < COLS; i++) {     // Should be ROWS
    for (size_t j = 0; j < ROWS; j++) { // Should be COLS
        matrix[i][j] = 0;  // Out-of-bounds when i >= 5
    }
}
```

**C-Next Solution:**

```cnx
u8[10][5] matrix;

// Use .length to ensure correct bounds
for (usize i <- 0; i < matrix.length; i +<- 1) {        // 10
    for (usize j <- 0; j < matrix[0].length; j +<- 1) { // 5
        matrix[i][j] <- 0;
    }
}
```

### Bug 3: Negative Index (SEI CERT ARR30-C)

**The Problem:**

```c
int *table = ...;
int len = ...;

int get(int index) {
    if (index < len) {  // Missing: index >= 0 check!
        return table[index];  // UB if index < 0
    }
    return -1;
}
```

**C-Next Solution:**

- Use `usize` for indices (unsigned, cannot be negative)
- Runtime bounds checking catches any remaining issues

### Bug 4: sizeof on Pointer Parameter

**The Problem:**

```c
void clear(int a[100]) {
    memset(a, 0, sizeof(a));  // WRONG: sizeof(int*), not sizeof(int[100])
}
```

Even when you specify the size in the parameter declaration, C ignores it and treats the parameter as a pointer.

**C-Next Solution:**
ADR-023 already forbids `sizeof` on array parameters, requiring `.length` instead. This pattern extends to multi-dimensional arrays.

### Bug 5: Blaster Worm Pattern (Unbounded Loop)

**The Problem:**
The Blaster worm exploited this exact pattern:

```c
while (*pwszTemp != L'\\')
    *pwszServerName++ = *pwszTemp++;  // No bounds check!
```

**C-Next Solution:**

- All array access is bounds-checked
- Loop patterns with array indexing generate bounds checks

## Bounds Checking Strategy

### Compile-Time Checking (Always)

- Constant indices checked at compile time
- Dimension mismatches in function calls are compile errors
- `.length` resolved to constants

### Runtime Checking (Default, Optional)

For variable indices, generate bounds checks:

```cnx
u8[10][10] matrix;
u8 value <- matrix[x][y];  // x and y are variables
```

Generated C (with bounds checking):

```c
uint8_t matrix[10][10];
// Bounds check macro/inline function
if (x >= 10 || y >= 10) {
    cnx_bounds_error(__FILE__, __LINE__, x, y, 10, 10);
}
uint8_t value = matrix[x][y];
```

Compiler flags:

- `--bounds-check` (default): Generate runtime checks
- `--no-bounds-check`: Omit for release builds (user's responsibility)
- `--bounds-panic`: Abort on violation (development)
- `--bounds-clamp`: Clamp to valid range (safety-critical)

## Open Questions

1. ~~Row-major vs column-major?~~ **Decided: Row-major (C compatible)**
2. ~~Bounds checking?~~ **Decided: Compile-time always, runtime by default**
3. Slicing syntax? `matrix[0]` returns `u8[cols]` - is this sufficient?
4. Should `--bounds-clamp` be an option, or is panic-only safer?

## References

### MISRA C Standards

- [MISRA C:2012 Rule 9.2 - Brace Enclosure](https://www.mathworks.com/help/bugfinder/ref/misrac2012rule9.2.html)
- [MISRA C:2012 Pointer Rules - AdaCore Analysis](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/04_strong_typing.html)

### SEI CERT C Coding Standard

- [ARR30-C: Do not form or use out-of-bounds pointers](https://wiki.sei.cmu.edu/confluence/display/c/ARR30-C.+Do+not+form+or+use+out-of-bounds+pointers+or+array+subscripts)
- [ARR01-C: Do not apply sizeof to pointer when taking array size](https://wiki.sei.cmu.edu/confluence/display/c/ARR01-C.+Do+not+apply+the+sizeof+operator+to+a+pointer+when+taking+the+size+of+an+array)

### CWE (Common Weakness Enumeration)

- [CWE-125: Out-of-bounds Read](https://cwe.mitre.org/data/definitions/125.html)
- [CWE-787: Out-of-bounds Write](https://cwe.mitre.org/data/definitions/787.html)
- [CWE-119: Improper Restriction of Operations within Bounds](https://cwe.mitre.org/data/definitions/119.html)

### Related ADRs

- ADR-007: `.length` property and bit indexing
- ADR-035: Array initializers (syntax applies to multi-dimensional)
- ADR-023: sizeof safety (forbids sizeof on array parameters)
