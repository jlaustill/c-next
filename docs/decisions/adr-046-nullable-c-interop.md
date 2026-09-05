# ADR-046: Nullable C Interop with c\_ Prefix

**Status:** Implemented
**Date:** 2026-01-19
**Implemented:** 2026-01-19 (v0.1.12)
**Supersedes:** ADR-047 (NULL Keyword for C Library Interop)

## Context

C-Next eliminates null bugs by design for native types through:

- ADR-003: No dynamic allocation (no malloc/free)
- ADR-006: No pointer arithmetic or reassignment
- ADR-015: Zero initialization + init-before-use checks
- ADR-039: Null safety is emergent from these constraints

However, ADR-047's approach to C library interop was too restrictive:

- Could not store nullable returns in variables (E0904)
- Functions like `fopen`, `getenv` were forbidden (E0902)
- Required awkward inline-only patterns: `if (fgets(...) != NULL)`
- Created conflicts with MISRA Rule 13.5 (E0702) requiring special exemptions

## Decision

**Allow nullable C pointer types with a mandatory `c_` prefix.**

The `c_` prefix signals to both compiler and reader: "this variable holds a C pointer that may be NULL."

### Core Rules

1. Variables storing nullable C pointer returns must use the `c_` prefix
2. NULL comparisons are allowed only for `c_` prefixed variables
3. C-Next native types (`string`, `u32`, arrays, structs) remain non-nullable
4. Compiler enforces correct prefix usage and NULL checks before use

### Valid Code

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

### When c\_ Prefix is Required

| Scenario                         | Prefix Required? |
| -------------------------------- | ---------------- |
| C function returning pointer     | Yes              |
| C function returning int/value   | No               |
| C struct with pointer members    | Yes              |
| C struct with only value members | No               |
| C-Next native types              | No (forbidden)   |

### Struct Member Access

The `c_` prefix goes on the variable, not member access:

```cnx
// C header: typedef struct { char* name; int id; } Customer;
Customer c_customer <- get_customer(42);

if (c_customer != NULL) {
    if (c_customer.name != NULL) {  // Member access is normal
        printf("Name: %s", c_customer.name);
    }
}
```

## Error Codes

| Code  | Message                                  |
| ----- | ---------------------------------------- |
| E0905 | Missing `c_` prefix for nullable C type  |
| E0906 | Invalid `c_` prefix on non-nullable type |
| E0907 | NULL comparison on non-nullable variable |
| E0908 | Missing NULL check before use            |

### Retired Error Codes

- E0901 → Replaced by E0908 (more general)
- E0902 → Retained, and re-scoped: the stream and lookup functions this ADR
  allows no longer trigger it, but importing a dynamic memory function still
  does (see _Functions Still Forbidden_ below). It reads "importing X from
  C/C++ is forbidden" rather than naming X as a C-Next function
- E0904 → Removed (storage allowed with `c_` prefix)
- E0903 → Retained (NULL invalid for C-Next types)

## Functions Now Usable

Previously forbidden by ADR-047, now allowed:

- `fopen`, `fclose`, `freopen`, `tmpfile`
- `getenv`
- `strstr`, `strchr`, `strrchr`
- Any user-defined C function returning pointers

## Functions Still Forbidden

Dynamic memory imported from C or C++, reported as **E0902**.

**Which names, and the match rule, are stated once — in
[ADR-003 § What a `.cnx` File May Not Call](adr-003-static-allocation.md#decision-what-a-cnx-file-may-not-call).**
That is the ADR that owns static allocation, so that is where the language-level
statement of what compiles belongs. This section deliberately does not repeat the
list: when it did, the two homes disagreed — ADR-003 named five functions and
this file named fourteen plus a suffix rule, so a transpiler rebuilt from one
rejected `heap_caps_malloc` and one rebuilt from the other did not.

What belongs here is the interop consequence: a header that declares these
functions can still be included, and every other function it declares remains
usable under this ADR's `c_` rules. Only a call to a forbidden name from a `.cnx`
file is rejected, and the diagnostic names the **import** as what is forbidden
rather than describing the function as a C-Next one.

## Compiler Enforcement

The compiler determines nullability via:

1. **Built-in knowledge** of standard library functions (stdio.h, stdlib.h, string.h)
2. **Header parsing** of user `.h` files to detect pointer return types and pointer-containing structs

## Benefits

1. **Self-documenting** — `c_` prefix tells readers "nullable C territory"
2. **Maintains null safety** — C-Next native types remain non-nullable
3. **Unlocks practical I/O** — File handling, environment variables now usable
4. **Simpler rules** — No special exemptions needed (removes E0702 workaround)
5. **Clear errors** — Compiler guides correct usage

## Consequences

- ADR-047 is superseded
- E0702's exemption for stream functions is no longer needed and goes away: the
  rule becomes one that applies everywhere rather than one with a carve-out, which
  is the point of the change
- Existing code using `if (fgets(...) != NULL)` still works
- New code can store results: `cstring c_result <- fgets(...)`

## Related ADRs

- **ADR-003**: Static Allocation - malloc/free remain forbidden
- **ADR-006**: Simplified References - No raw pointers in C-Next
- **ADR-039**: Null Safety - Native types remain non-nullable
- **ADR-047**: Superseded by this ADR
- **ADR-103**: Stream Handling - FILE\* now usable with c\_ prefix
