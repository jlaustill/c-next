# Design: Nullable C Interop Implementation (ADR-046)

**Date:** 2026-01-19
**Author:** C-Next Team
**Status:** Implementation In Progress

## Overview

This document details the implementation of ADR-046 - the `c_` prefix system for nullable C interop.

## File Changes

### Primary File: `src/analysis/NullCheckAnalyzer.ts`

#### 1. Function Registry Changes

**Before:**

```typescript
const FORBIDDEN_NULLABLE_FUNCTIONS: Map<string, string> = new Map([
  ["fopen", "File handling will be available via ADR-103"],
  ["getenv", "Environment access requires ADR-103 infrastructure"],
  ["strstr", "Returns pointer into string - use indexOf pattern instead"],
  // ...
]);
```

**After:**

```typescript
// Functions that return nullable pointers - allowed with c_ prefix
const C_NULLABLE_FUNCTIONS: Map<string, ICLibraryFunction> = new Map([
  [
    "fopen",
    { header: "stdio.h", nullMeaning: "File open failed", docsUrl: "..." },
  ],
  [
    "getenv",
    { header: "stdlib.h", nullMeaning: "Variable not set", docsUrl: "..." },
  ],
  // ...
]);

// Still forbidden - no c_ prefix can make these safe
const FORBIDDEN_NULLABLE_FUNCTIONS: Map<string, string> = new Map([
  ["malloc", "Dynamic allocation is forbidden by ADR-003"],
  ["calloc", "Dynamic allocation is forbidden by ADR-003"],
  ["realloc", "Dynamic allocation is forbidden by ADR-003"],
  ["free", "Dynamic allocation is forbidden by ADR-003"],
]);
```

#### 2. State Tracking

```typescript
interface INullableVariableState {
  /** Variable name (without c_ prefix for lookup) */
  name: string;
  /** Line where declared */
  line: number;
  /** Column where declared */
  column: number;
  /** Whether NULL check has been performed */
  isNullChecked: boolean;
  /** Which function's return this stores */
  sourceFunction: string;
}
```

#### 3. Listener Changes

**enterVariableDeclaration:**

```typescript
// Check if RHS is a nullable function call
const funcName = extractFunctionCallName(expr);
const isNullableFunc = C_NULLABLE_FUNCTIONS.has(funcName);
const hasCPrefix = varName.startsWith("c_");

if (isNullableFunc && !hasCPrefix) {
  reportError(
    "E0905",
    `Variable '${varName}' stores nullable C pointer - must use 'c_' prefix`,
  );
} else if (isNullableFunc && hasCPrefix) {
  // Track as nullable variable requiring NULL check
  trackNullableVariable(varName, funcName, line, column);
}

if (hasCPrefix && !isNullableFunc && !isAssignmentFromNullableVar) {
  reportError(
    "E0906",
    `Variable '${varName}' has 'c_' prefix but is not a nullable C pointer type`,
  );
}
```

**exitEqualityExpression:**

```typescript
// Check for NULL comparison
if (hasNullComparison) {
  const comparedVar = extractComparedVariable(ctx);

  if (!comparedVar) return;

  if (!comparedVar.startsWith("c_")) {
    reportError(
      "E0907",
      `Cannot compare '${comparedVar}' to NULL - only 'c_' prefixed variables can be NULL`,
    );
  } else {
    // Mark variable as NULL-checked in current scope
    markNullChecked(comparedVar);
  }
}
```

**enterPostfixExpression (for function calls using c\_ variables):**

```typescript
// When a c_ variable is used as an argument
if (argName.startsWith("c_") && !isNullChecked(argName)) {
  reportError("E0908", `Variable '${argName}' must be NULL-checked before use`);
}
```

#### 4. Control Flow Analysis

Follow the pattern from `InitializationAnalyzer.ts`:

```typescript
// State management
private nullableVariables: Map<string, INullableVariableState> = new Map();
private savedStates: Map<string, INullableVariableState>[] = [];

// On entering if statement
enterIfStatement(): void {
  this.savedStates.push(this.cloneNullableState());
}

// On exiting if statement
exitIfStatement(ctx): void {
  const stateBefore = this.savedStates.pop();
  const hasElse = ctx.ELSE() !== null;

  if (!hasElse) {
    // Without else: restore state (NULL check not guaranteed)
    this.restoreNullableState(stateBefore);
  }
  // With else: keep merged state from both branches
}
```

### Secondary File: `src/analysis/types/INullCheckError.ts`

Update documentation:

```typescript
/**
 * Error codes:
 * - E0901: C library function can return NULL - must check result
 * - E0902: C library function returns pointer - not supported (malloc/free)
 * - E0903: NULL can only be used in comparison context
 * - E0904: Cannot store C function pointer return in variable (deprecated for c_ vars)
 * - E0905: Missing c_ prefix for nullable C type
 * - E0906: Invalid c_ prefix on non-nullable type
 * - E0907: NULL comparison on non-nullable variable
 * - E0908: Missing NULL check before use
 */
```

## Test Plan

### Valid Patterns (should compile without errors)

1. `c-prefix-valid-fopen.test.cnx`:

```cnx
#include <stdio.h>
void test() {
    FILE c_file <- fopen("test.txt", "r");
    if (c_file != NULL) {
        fclose(c_file);
    }
}
```

2. `c-prefix-valid-getenv.test.cnx`:

```cnx
#include <stdlib.h>
void test() {
    string c_home <- getenv("HOME");
    if (c_home != NULL) {
        printf("Home: %s\n", c_home);
    }
}
```

### Error Patterns

1. `c-prefix-missing-e0905.test.cnx`:

```cnx
FILE file <- fopen("x.txt", "r");  // E0905
```

2. `c-prefix-invalid-e0906.test.cnx`:

```cnx
u32 c_count <- 0;  // E0906
```

3. `c-prefix-null-compare-e0907.test.cnx`:

```cnx
u32 x <- 5;
if (x != NULL) { }  // E0907
```

4. `c-prefix-use-before-check-e0908.test.cnx`:

```cnx
FILE c_file <- fopen("x.txt", "r");
fclose(c_file);  // E0908 - not NULL-checked
```

## Edge Cases

### Nested Control Flow

```cnx
FILE c_file <- fopen("x.txt", "r");
if (condition1) {
    if (c_file != NULL) {
        fclose(c_file);  // OK - checked in this branch
    }
}
fclose(c_file);  // E0908 - might not have been checked
```

### While Loop with NULL Check

```cnx
FILE c_file <- fopen("x.txt", "r");
while (c_file != NULL) {
    // c_file is checked here
    fgets(buffer, size, c_file);  // OK
}
```

### Re-assignment

```cnx
FILE c_file <- fopen("a.txt", "r");
if (c_file != NULL) {
    fclose(c_file);
}
c_file <- fopen("b.txt", "r");  // Resets NULL-check state
fclose(c_file);  // E0908 - second assignment not checked
```

## Migration Impact

### Existing Tests

- `forbidden-fopen.test.cnx` needs update - fopen now allowed with c\_ prefix
- Stream function tests (fgets, etc.) unchanged - inline NULL check still works

### Backward Compatibility

- E0904 becomes a deprecation warning for non-c\_ variables, error remains for store attempts
- Code using inline NULL checks continues to work unchanged
