# ADR-047: NULL Keyword for C Library Interop

**Status:** Superseded
**Date:** 2026-01-06
**Superseded By:** ADR-046 (Nullable C Interop with c\_ Prefix)
**Decision Makers:** C-Next Language Design Team

## Context

C-Next eliminates null-related bugs by design through:

- ADR-003: No dynamic allocation (no malloc/free)
- ADR-006: No pointer arithmetic or reassignment
- ADR-015: Zero initialization + init-before-use checks
- ADR-039: Null safety is emergent from these constraints

However, C library functions commonly return `NULL` to signal failure:

```c
char *fgets(char *s, int n, FILE *stream);   // Returns NULL on EOF or error
```

C-Next needs a way to safely interoperate with these functions, particularly for stdin/stdout I/O operations that are common even in embedded systems.

## Decision

**Support the `NULL` keyword exclusively for direct comparison with C stream function returns.**

This is an intentionally constrained design:

1. **NULL keyword only valid in comparison context** - Cannot be assigned to variables
2. **Whitelisted functions only** - Stream I/O functions (fgets, fputs, etc.)
3. **Compiler enforces NULL check** - Using result without check is an ERROR
4. **No intermediate storage** - Result must be used directly in comparison
5. **Forbidden functions are errors** - fopen, malloc, etc. are not supported

### Valid Pattern

```cnx
#include <stdio.h>

string<64> buffer;

void readInput() {
    if (fgets(buffer, buffer.size, stdin) != NULL) {
        // Safe to use buffer here - fgets wrote to it
        printf("Got: %s", buffer);
    }
}
```

### Invalid Patterns (Errors)

```cnx
// E0901: Missing NULL check
fgets(buffer, buffer.size, stdin);
printf("Got: %s", buffer);  // ERROR!

// E0902: Forbidden function
fopen("file.txt", "r");  // ERROR: Not supported in v1

// E0903: NULL outside comparison
u32 x <- NULL;  // ERROR

// E0904: Cannot store result
string<64>? result <- fgets(...);  // ERROR: No nullable types
```

## Whitelisted Stream Functions

| Function | NULL Meaning              | Header  |
| -------- | ------------------------- | ------- |
| `fgets`  | EOF reached or read error | stdio.h |
| `fputs`  | Write error (returns EOF) | stdio.h |
| `fgetc`  | EOF reached or read error | stdio.h |
| `fputc`  | Write error (returns EOF) | stdio.h |
| `gets`   | EOF or error (DEPRECATED) | stdio.h |

## Forbidden Functions (ADR-103)

These functions return pointers that cannot be safely handled in C-Next v1:

| Function  | Reason                                                   |
| --------- | -------------------------------------------------------- |
| `fopen`   | Returns FILE\* handle - requires ADR-103 stream handling |
| `fclose`  | Operates on FILE\* - requires ADR-103                    |
| `malloc`  | Dynamic allocation forbidden (ADR-003)                   |
| `calloc`  | Dynamic allocation forbidden (ADR-003)                   |
| `realloc` | Dynamic allocation forbidden (ADR-003)                   |
| `free`    | Dynamic allocation forbidden (ADR-003)                   |
| `getenv`  | Returns pointer - requires ADR-103                       |
| `strstr`  | Returns pointer into string                              |
| `strchr`  | Returns pointer into string                              |
| `memchr`  | Returns pointer into memory                              |

## Error Codes

| Code  | Message                                                        |
| ----- | -------------------------------------------------------------- |
| E0901 | C library function 'X' can return NULL - must check result     |
| E0902 | C library function 'X' returns a pointer - not supported in v1 |
| E0903 | NULL can only be used in comparison context                    |
| E0904 | Cannot store 'X' return value in variable 'Y'                  |

## Why This Approach

### Alternatives Considered

**Option A: Nullable Type Suffix (T?)** - Original proposal

- Adds `?` suffix for nullable types
- Requires flow analysis for null safety
- More complex, introduces nullable types to C-Next

**Option B: Result Type** - Rust-style

- Requires match expressions
- Significant language complexity

**Option C: Full NULL support** - C-style

- Allows NULL anywhere
- Defeats C-Next's null safety guarantees

### Why Constrained NULL

1. **Maintains null safety** - C-Next variables cannot be null
2. **Enables practical interop** - stdin/stdout I/O works
3. **Minimal complexity** - No new type system features
4. **Clear semantics** - NULL only appears in C interop context
5. **VS Code integration** - Tooltips indicate "this is C code"

## Implementation

### Grammar (CNext.g4)

```antlr
C_NULL : 'NULL';     // Distinct from lowercase 'null'

literal
    : ...
    | 'NULL'         // C library NULL for interop
    ;
```

### Analysis (NullCheckAnalyzer.ts)

New analyzer that:

1. Detects C stream function calls
2. Verifies they're in NULL comparison context
3. Errors on forbidden functions
4. Errors on NULL outside comparison

### VS Code Extension

- `[C Library]` badge on hover for stream functions
- NULL return information
- Links to cppreference documentation

## Related ADRs

- **ADR-003**: Static Allocation - No malloc/free
- **ADR-006**: Simplified References - No pointers
- **ADR-015**: Null State - Zero initialization
- **ADR-039**: Null Safety - Emergent from design
- **ADR-103**: Stream Handling (Research) - FILE\* and fopen patterns

## References

- [Tony Hoare: Null References - The Billion Dollar Mistake](https://www.infoq.com/presentations/Null-References-The-Billion-Dollar-Mistake-Tony-Hoare/)
- [cppreference: fgets](https://en.cppreference.com/w/c/io/fgets)
