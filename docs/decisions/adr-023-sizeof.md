# ADR-023: Sizeof Mechanism

## Status
**Research**

## Context

C's `sizeof` operator is essential for:
- Buffer sizing
- Memory operations (memcpy, memset)
- Array length calculations
- Struct padding awareness

C-Next needs a way to query type and value sizes.

## Decision Drivers

1. **Buffer Operations** - memcpy, memset need sizes
2. **Type Introspection** - Know size of structs
3. **Compile-Time** - Must be constant expression
4. **C Compatibility** - Generate valid sizeof

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
u8 buffer[256];
usize bufSize <- sizeof(buffer);   // 256

Point p;
usize pSize <- sizeof(p);          // Same as sizeof(Point)
```

### Common Patterns
```cnx
// Clear struct
memset(&config, 0, sizeof(config));

// Copy array
memcpy(dest, src, sizeof(src));

// Array element count (combine with .length)
u32 arr[10];
usize count <- arr.length;      // 10 (element count, ADR-007)
usize bytes <- sizeof(arr);     // 40 (total bytes)
```

## Implementation Notes

### Grammar Changes
```antlr
primaryExpression
    : ...
    | 'sizeof' '(' (type | expression) ')'
    ;
```

### CodeGenerator
Direct pass-through:
```c
size_t size = sizeof(uint32_t);
size_t arrSize = sizeof(buffer);
```

### Priority
**High** - Essential for memory operations.

## Open Questions

1. `sizeof` on expressions vs types - both?
2. Compile-time only, or allow in runtime expressions?

## References

- C sizeof operator
- MISRA C sizeof guidelines
