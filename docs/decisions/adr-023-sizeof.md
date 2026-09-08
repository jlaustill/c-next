# ADR-023: Sizeof Mechanism

## Status

**Implemented**

## Context

C's `sizeof` operator is essential for:

- Buffer sizing
- Memory operations (memcpy, memset)
- Array length calculations
- Struct padding awareness

C-Next needs a way to query type and value sizes.

However, `sizeof` is also the source of several common bugs:

- **Array parameter decay**: `sizeof(arrayParam)` returns pointer size, not array size
- **Side effects ignored**: expressions inside `sizeof()` are never executed
- **VLA complications**: Variable-length arrays make sizeof runtime-evaluated

## Decision Drivers

1. **Buffer Operations** - memcpy, memset need sizes
2. **Type Introspection** - Know size of structs
3. **Compile-Time** - Must be constant expression (no VLAs)
4. **C Compatibility** - Generate valid sizeof
5. **Safety** - Prevent classic sizeof bugs at compile time

## Options Considered

### Option A: C-Style `sizeof()`

```cnx
usize size <- sizeof(u32);           // 4
usize arrSize <- sizeof(buffer);     // Total bytes
usize structSize <- sizeof(Point);   // Struct size with padding
```

**Pros:** Familiar, direct C mapping
**Cons:** Parentheses required, function-like syntax

### Option B: `.size` Property

```cnx
usize size <- u32.size;        // 4
usize arrSize <- buffer.size;  // Total bytes
usize pointSize <- Point.size; // Struct size
```

**Pros:** Consistent with `.length`, cleaner syntax
**Cons:** Conflicts if struct has `size` field

### Option C: Both

Support both `sizeof()` and `.size`:

```cnx
// Either works
usize a <- sizeof(u32);
usize b <- u32.size;
```

**Pros:** Flexibility
**Cons:** Two ways to do same thing

## Recommended Decision

**Option A: C-Style `sizeof()`** - Familiar and unambiguous.

Reserve `.size` for potential future use (e.g., collections).

## Syntax

### Type Sizeof

```cnx
usize intSize <- sizeof(u32);      // 4
usize ptrSize <- sizeof(usize);    // Platform-dependent
usize structSize <- sizeof(Point); // Includes padding
```

### Variable Sizeof

```cnx
u8[256] buffer;
usize bufSize <- sizeof(buffer);   // 256

Point p;
usize pSize <- sizeof(p);          // Same as sizeof(Point)
```

### Common Patterns

```cnx
// Clear struct
memset(&config, 0, sizeof(config));

// Copy buffer - use sizeof(type) * .length for byte count
void copyBuffer(u8[] dest, u8[] src) {
    memcpy(dest, src, sizeof(u8) * src.length);
}

// Array element count vs byte count (local arrays only)
u32[10] arr;
usize count <- arr.length;      // 10 (element count, ADR-007)
usize bytes <- sizeof(arr);     // 40 (total bytes)

// Struct array byte count
Point[5] points;
usize pointBytes <- sizeof(Point) * points.length;  // Safe pattern
```

## Safety Rules

C-Next enforces three safety rules to prevent common sizeof bugs.

### E0601: sizeof on Array Parameter

Using `sizeof()` on an array parameter is a compile error. In C, array parameters decay to pointers, so `sizeof(arrayParam)` returns pointer size (4 or 8 bytes), not the array size.

```cnx
void process(u8[] data) {
    usize size <- sizeof(data);  // ERROR E0601
}
```

**Error message:**

```
error[E0601]: sizeof() on array parameter returns pointer size, not array size
  --> file.cnx:2:18
   |
2  |     usize size <- sizeof(data);
   |                   ^^^^^^^^^^^^ use data.length for element count
   |
   = help: for element count: data.length
   = help: for byte count: sizeof(u8) * data.length
```

**Safe alternatives:**

```cnx
void process(u8[] data) {
    usize count <- data.length;               // Element count
    usize bytes <- sizeof(u8) * data.length;  // Byte count
}
```

### E0602: Side Effects in sizeof (MISRA C:2012 Rule 13.6)

The `sizeof` operator evaluates types at compile-time; expressions inside it are **never executed**. Side effects in sizeof operands are a compile error.

```cnx
u32 x <- 5;
usize s <- sizeof(x++);  // ERROR E0602
```

**Error message:**

```
error[E0602]: sizeof() operand must not have side effects (MISRA C:2012 Rule 13.6)
  --> file.cnx:2:16
   |
2  |     usize s <- sizeof(x++);
   |                       ^^^ side effect never executes
   |
   = help: move side effects outside: x++; sizeof(x)
```

**Safe alternative:**

```cnx
u32 x <- 5;
x++;
usize s <- sizeof(x);  // OK - no side effects
```

### E0603: Variable-Length Arrays Forbidden (ADR-003)

Variable-length arrays (VLAs) are not allowed in C-Next. This aligns with ADR-003 (static allocation) and avoids:

- Runtime sizeof evaluation
- Stack overflow risks
- Security vulnerabilities
- The reason VLAs were banned from the Linux kernel

```cnx
void process(u32 n) {
    u8[n] buffer;  // ERROR E0603
}
```

**Error message:**

```
error[E0603]: variable-length arrays are not allowed (ADR-003: static allocation)
  --> file.cnx:2:5
   |
2  |     u8[n] buffer;
   |        ^^^^^^^^^ array size must be compile-time constant
   |
   = help: use a fixed-size buffer or allocate at startup
```

**Safe alternatives:**

```cnx
// Fixed-size buffer
void process(u32 n) {
    u8[MAX_SIZE] buffer;  // Compile-time constant
    // Use only first n elements...
}

// Or allocate at startup (ADR-003)
```

## Valid sizeof Uses

```cnx
// Type sizes
usize intSize <- sizeof(u32);           // 4
usize ptrSize <- sizeof(usize);         // Platform-dependent

// Struct sizes
usize pointSize <- sizeof(Point);       // Includes padding

// Local fixed arrays (not parameters)
u8[256] localBuffer;
usize bufBytes <- sizeof(localBuffer);  // 256 - OK

// Struct instances
Point p;
usize pSize <- sizeof(p);               // Same as sizeof(Point)

// Byte count via explicit multiplication (recommended for params)
void clear(u8[] data) {
    memset(data, 0, sizeof(u8) * data.length);  // Explicit and safe
}
```

## Implementation Notes

### Grammar Changes

```antlr
primaryExpression
    : ...
    | 'sizeof' '(' (type | expression) ')'
    ;
```

### Semantic Analysis

The compiler must:

1. Track which variables are array parameters vs local arrays
2. Detect side effects in sizeof operands (increment, decrement, assignment, function calls)
3. Verify array sizes are compile-time constants (no VLAs)

### Generated C

Direct pass-through for valid cases:

```c
size_t size = sizeof(uint32_t);
size_t arrSize = sizeof(buffer);
```

### Priority

**High** - Essential for memory operations.

## Resolved Questions

1. **sizeof on expressions vs types?** - Both supported, same as C.
2. **Compile-time only?** - Yes, sizeof is always compile-time (no VLAs).

## Diagnostics

| Code  | Reported when                                        | Asserted by                                           |
| ----- | ---------------------------------------------------- | ----------------------------------------------------- |
| E0601 | `sizeof` is applied to an array PARAMETER            | `tests/adr-023/sizeof-array-parameter-error.test.cnx` |
| E0602 | The operand contains a call (MISRA C:2012 Rule 13.6) | `tests/adr-023/sizeof-side-effects-error.test.cnx`    |

An array parameter is passed by reference (ADR-006), so its size is a
pointer's. The identical spelling on a LOCAL array measures the array, which is
why the rule asks where the name is declared rather than what its type is.

`sizeof` never evaluates its operand, so a call inside one does not run. That
is the only side effect an expression can have here: assignment is a statement.

## Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist**,
`warn` that it should be covered and is not, `error` that it must be.

<!-- MATRIX-SEVERITY -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | warn     |
| global variable    | same file           | off      |
| scope member       | same file           | off      |
| top-level function | imported direct     | off      |
| scope method       | imported direct     | off      |
| global variable    | imported direct     | off      |
| scope member       | imported direct     | off      |
| top-level function | imported transitive | off      |
| scope method       | imported transitive | off      |
| global variable    | imported transitive | off      |
| scope member       | imported transitive | off      |

Both rules are decided inside the function that writes the `sizeof`: E0601 asks
that function's own parameter list, and E0602 asks the operand's own shape.
Nothing crosses an include, and a parameter cannot exist at file scope, so the
variable contexts and every imported cell record that they cannot exist.

## References

- [MISRA C:2012 Rule 13.6](https://pvs-studio.com/en/docs/warnings/v2557/) - sizeof operand side effects
- [SEI CERT ARR01-C](https://wiki.sei.cmu.edu/confluence/display/c/ARR01-C.+Do+not+apply+the+sizeof+operator+to+a+pointer+when+taking+the+size+of+an+array) - sizeof on array parameters
- [LWN: VLAs and the max() mess](https://lwn.net/Articles/749064/) - Why Linux banned VLAs
- C sizeof operator semantics
