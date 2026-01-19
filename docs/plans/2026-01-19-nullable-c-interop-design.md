# Nullable C Interop Design

**Date:** 2026-01-19
**Status:** Draft
**Supersedes:** ADR-047 (NULL Keyword for C Library Interop)

## Problem

C-Next eliminates null bugs by design for native types. However, C library functions commonly return nullable pointers (`FILE*`, `char*`, etc.). The current ADR-047 approach is too restrictive:

- Cannot store nullable returns in variables (E0904)
- Functions like `fopen`, `getenv` are forbidden (E0902)
- Required awkward inline-only patterns: `if (fgets(...) != NULL)`
- Created conflicts with other rules (E0702 needed special exemptions)

## Solution

Allow nullable C pointer types with a mandatory `c_` prefix that signals "this is C territory with different rules."

### Core Rules

1. **`c_` prefix required** for variables storing nullable C pointer returns
2. **NULL comparisons allowed** only for `c_` prefixed variables
3. **C-Next native types unchanged** — `string`, `u32`, structs remain non-nullable
4. **Compiler enforces** correct prefix usage and NULL checks before use

### Examples

```cnx
#include <stdio.h>

// Nullable C return - requires c_ prefix
FILE c_file <- fopen("data.txt", "r");
if (c_file != NULL) {
    string<256> line;
    while (fgets(line, line.size, c_file) != NULL) {
        printf("%s", line);
    }
    fclose(c_file);
}

// Non-nullable C-Next variable - no prefix, no NULL
string<64> buffer;  // Always valid, zero-initialized
```

## When `c_` Prefix is Required

| Scenario                         | Prefix Required?   | Example                             |
| -------------------------------- | ------------------ | ----------------------------------- |
| C function returning pointer     | Yes                | `FILE c_file <- fopen(...)`         |
| C function returning int/value   | No                 | `i32 count <- get_count()`          |
| C struct with pointer members    | Yes                | `CRecord c_rec <- get_record()`     |
| C struct with only value members | No                 | `SimpleRecord rec <- make_record()` |
| C-Next native types              | No (and forbidden) | `string<64> buffer`                 |

## Struct Member Access

When a C struct has nullable pointer members, the `c_` prefix goes on the variable, not the member access.

```c
// In c_library.h
typedef struct {
    char* name;        // Nullable pointer
    char* address;     // Nullable pointer
    int id;            // Not nullable
} Customer;

Customer* get_customer(int id);  // Returns nullable pointer
```

```cnx
#include "c_library.h"

// The struct variable gets c_ prefix (contains nullable members)
Customer c_cust <- get_customer(42);

if (c_cust != NULL) {
    // Access members normally - reader knows c_cust is "C territory"
    if (c_cust.name != NULL) {
        printf("Name: %s", c_cust.name);
    }

    // Non-pointer members don't need NULL check
    printf("ID: %d", c_cust.id);
}
```

**Rationale:**

- The `c_` prefix signals "everything inside is C rules"
- Avoids verbose `c_cust.c_name.c_whatever` chains
- Member names stay readable and match the C header

## Changes from ADR-047

| ADR-047 Rule                          | New Rule                        |
| ------------------------------------- | ------------------------------- |
| NULL only in direct comparisons       | NULL allowed for `c_` variables |
| Cannot store nullable returns (E0904) | Allowed with `c_` prefix        |
| fopen, getenv forbidden (E0902)       | Now usable                      |
| malloc/free forbidden                 | Still forbidden (ADR-003)       |

**Functions that become usable:**

- `fopen`, `fclose`, `freopen`
- `getenv`
- `strstr`, `strchr`, `strrchr` (return pointers into strings)
- `tmpfile`, `tmpnam`

**Still forbidden (ADR-003 - no dynamic allocation):**

- `malloc`, `calloc`, `realloc`, `free`

## Compiler Enforcement

The compiler tracks which C functions return nullable pointers via:

1. **Built-in knowledge** of standard library (stdio.h, stdlib.h, string.h)
2. **Header parsing** for user's custom `.h` files to detect pointer return types

**Enforcement flow:**

1. Function returns pointer type → require `c_` prefix on receiving variable
2. Struct contains pointer members → require `c_` prefix on struct variable
3. Variable has `c_` prefix → allow NULL comparisons
4. Variable lacks `c_` prefix → forbid NULL comparisons
5. `c_` variable used without prior NULL check → error

## Error Codes

| Code  | Message                                  | Trigger                              |
| ----- | ---------------------------------------- | ------------------------------------ |
| E0905 | Missing `c_` prefix for nullable C type  | `FILE file <- fopen(...)`            |
| E0906 | Invalid `c_` prefix on non-nullable type | `i32 c_count <- get_count()`         |
| E0907 | NULL comparison on non-nullable variable | `if (buffer != NULL)`                |
| E0908 | Missing NULL check before use            | Using `c_` variable without checking |

**Example error output:**

```
error[E0905]: Missing 'c_' prefix for nullable C type
  --> src/main.cnx:12:5
   |
12 |     FILE file <- fopen("test.txt", "r");
   |          ^^^^ 'fopen' returns nullable pointer
   |
   = help: use 'c_file' to indicate this is a nullable C type
   = help: FILE c_file <- fopen("test.txt", "r");
```

## Migration

Existing code using ADR-047 patterns remains valid:

```cnx
// Still works - inline NULL check
if (fgets(buffer, buffer.size, stdin) != NULL) {
    printf("Got: %s", buffer);
}

// New option - store result
cstring c_result <- fgets(buffer, buffer.size, stdin);
if (c_result != NULL) {
    printf("Got: %s", buffer);
}
```

**Error code changes:**

- E0901 → Replaced by E0908 (more general)
- E0902 → Removed (functions now allowed)
- E0903 → Keep (NULL invalid for C-Next types)
- E0904 → Removed (storage allowed with `c_` prefix)

**The E0702 stream function exemption can be removed** — users choose to store or check inline.

## Benefits

1. **Self-documenting code** — `c_` prefix tells readers "nullable C territory"
2. **Maintains null safety** — C-Next native types remain non-nullable
3. **Unlocks practical I/O** — File handling, environment variables now usable
4. **Simpler rules** — No special exemptions needed for stream functions
5. **Clear errors** — Compiler guides correct usage

## Implementation Notes

Key components to modify:

- `NullCheckAnalyzer.ts` — New prefix validation logic
- `TypeValidator.ts` — Remove E0702 stream function exemption
- `CodeGenerator.ts` — Track `c_` prefixed variables for NULL check flow analysis
- Grammar — No changes needed (`c_` is just an identifier prefix)
- Header parsing — Detect pointer-returning functions and pointer-containing structs
