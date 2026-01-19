# ADR-046: Nullable C Interop with `c_` Prefix

**Status:** Accepted
**Date:** 2026-01-19
**Decision Makers:** C-Next Language Design Team
**Supersedes:** ADR-047 (partially)

## Context

ADR-047 introduced NULL safety for C library interop but was too restrictive:

- **E0904** forbade storing nullable returns in variables (must use inline comparison)
- **E0902** completely blocked useful functions like `fopen`, `getenv`, `strstr`
- Created awkward patterns: `if (fgets(...) != NULL)` inline only
- Conflicted with MISRA Rule 13.5 (side effects in conditionals)

Real-world C interop needs:

- File I/O with `fopen`/`fclose`
- Environment variable access with `getenv`
- String searching with `strstr`, `strchr`, etc.

## Decision

**Introduce the `c_` prefix to explicitly mark variables that hold nullable C pointers.**

### Rules

1. **`c_` prefix required** for variables storing nullable C pointer returns
2. **NULL comparisons only allowed** for `c_` prefixed variables
3. **`c_` prefixed variables must be NULL-checked** before use
4. **C-Next native types remain non-nullable** - no change to core language
5. **`malloc`/`free` remain forbidden** (ADR-003)

### Valid Pattern

```cnx
#include <stdio.h>

void processFile() {
    FILE c_file <- fopen("data.txt", "r");  // c_ prefix required
    if (c_file != NULL) {
        // Safe to use - NULL check performed
        string<256> buffer;
        while (fgets(buffer, buffer.size, c_file) != NULL) {
            printf("%s", buffer);
        }
        fclose(c_file);
    }
}

void checkEnv() {
    string c_value <- getenv("HOME");  // c_ prefix required
    if (c_value != NULL) {
        printf("Home: %s\n", c_value);
    }
}
```

### Error Patterns

```cnx
// E0905: Missing c_ prefix for nullable C type
FILE file <- fopen("x.txt", "r");  // ERROR: needs c_ prefix

// E0906: Invalid c_ prefix on non-nullable type
u32 c_counter <- 0;  // ERROR: u32 is not nullable

// E0907: NULL comparison on non-nullable variable
u32 value <- 10;
if (value != NULL) { }  // ERROR: cannot compare non-nullable to NULL

// E0908: Missing NULL check before use
FILE c_file <- fopen("x.txt", "r");
fclose(c_file);  // ERROR: must check for NULL first
```

## Error Codes

| Code  | Message                                  |
| ----- | ---------------------------------------- |
| E0905 | Missing `c_` prefix for nullable C type  |
| E0906 | Invalid `c_` prefix on non-nullable type |
| E0907 | NULL comparison on non-nullable variable |
| E0908 | Missing NULL check before use            |

### Changes from ADR-047

| Old Code | Old Behavior                         | New Behavior                   |
| -------- | ------------------------------------ | ------------------------------ |
| E0901    | Stream function must be NULL-checked | Unchanged for stream functions |
| E0902    | fopen/getenv/etc. forbidden          | Now allowed with `c_` prefix   |
| E0903    | NULL outside comparison              | Unchanged                      |
| E0904    | Cannot store result                  | Now allowed with `c_` prefix   |

## Nullable C Functions

Functions that return nullable pointers and are now allowed with `c_` prefix:

| Function    | Returns      | NULL Meaning                  |
| ----------- | ------------ | ----------------------------- |
| `fopen`     | `FILE*`      | File open failed              |
| `freopen`   | `FILE*`      | Reopen failed                 |
| `tmpfile`   | `FILE*`      | Temp file creation failed     |
| `getenv`    | `char*`      | Environment variable not set  |
| `strstr`    | `char*`      | Substring not found           |
| `strchr`    | `char*`      | Character not found           |
| `strrchr`   | `char*`      | Character not found (reverse) |
| `strpbrk`   | `char*`      | No character from set found   |
| `memchr`    | `void*`      | Byte not found                |
| `localtime` | `struct tm*` | Invalid time                  |
| `gmtime`    | `struct tm*` | Invalid time                  |

## Still Forbidden (ADR-003)

Dynamic allocation functions remain forbidden:

- `malloc`, `calloc`, `realloc`, `free`

## Flow Analysis

The analyzer tracks NULL-check state through control flow:

```cnx
FILE c_file <- fopen("x.txt", "r");

if (c_file != NULL) {
    // Inside this branch: c_file is known non-NULL
    fclose(c_file);  // OK
} else {
    // c_file is NULL here
    printf("Failed to open file\n");
}

// After if: c_file might be NULL (not checked in all paths)
fclose(c_file);  // E0908: might be NULL
```

## Why `c_` Prefix

### Alternatives Considered

1. **Nullable type suffix `T?`** - Adds complexity to type system
2. **Result type** - Requires match expressions, major language change
3. **Automatic tracking** - Invisible nullability confuses developers

### Benefits of `c_` Prefix

1. **Explicit marker** - Makes nullable variables visible at declaration
2. **Self-documenting** - "c\_" signals "this is C interop, handle with care"
3. **No type system changes** - Purely naming convention + compiler checks
4. **MISRA compliant** - Can store result, check separately
5. **IDE friendly** - Easy to highlight/lint

## Implementation

### Grammar

No grammar changes needed - uses existing identifier rules.

### NullCheckAnalyzer

1. New `C_NULLABLE_FUNCTIONS` map (replaces some FORBIDDEN entries)
2. Prefix validation in `enterVariableDeclaration` / `enterAssignmentStatement`
3. NULL comparison validation in `exitEqualityExpression`
4. Flow analysis for NULL-check tracking (follows `InitializationAnalyzer` pattern)

### VS Code Extension

- Highlight `c_` prefixed variables with distinct color
- Tooltip: "Nullable C pointer - must be NULL-checked before use"
- Quick-fix for missing `c_` prefix

## Related ADRs

- **ADR-003**: Static Allocation - No malloc/free (unchanged)
- **ADR-006**: Simplified References - No pointers (unchanged)
- **ADR-047**: Nullable Types - Partially superseded by this ADR
- **ADR-103**: Stream Handling - Enables full file I/O with c\_ prefix

## References

- [MISRA C:2012 Rule 13.5](https://wiki.sei.cmu.edu/confluence/display/c/EXP10-C.+Do+not+depend+on+the+order+of+evaluation+of+subexpressions+or+the+order+in+which+side+effects+take+place)
- [GitHub Issue #259](https://github.com/jlaustill/c-next/issues/259)
