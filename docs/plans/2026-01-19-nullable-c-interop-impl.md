# Nullable C Interop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement ADR-046 to allow nullable C pointer types with mandatory `c_` prefix, replacing ADR-047's restrictive NULL handling.

**Architecture:** Rewrite `NullCheckAnalyzer.ts` to validate `c_` prefix on variables storing nullable C returns. Add new error codes E0905-E0908. Remove E0702 stream function exemption from `TypeValidator.ts`. Update tests to reflect new behavior.

**Tech Stack:** TypeScript, ANTLR4 parser, C-Next transpiler pipeline

---

## Task 1: Create Failing Test for E0905 (Missing c\_ Prefix)

**Files:**

- Create: `tests/null-check/missing-c-prefix.test.cnx`
- Create: `tests/null-check/missing-c-prefix.expected.error`

**Step 1: Create the test file**

```cnx
// tests/null-check/missing-c-prefix.test.cnx
// ADR-046: Missing c_ prefix for nullable C type
#include <stdio.h>

void openFile() {
    FILE file <- fopen("test.txt", "r"); // ERROR: missing c_ prefix
}
```

**Step 2: Create expected error file**

```
// tests/null-check/missing-c-prefix.expected.error
6:9 error[E0905]: Missing 'c_' prefix for nullable C type 'FILE'
```

**Step 3: Run test to verify it fails**

```bash
npm test -- tests/null-check/missing-c-prefix --quiet
```

Expected: FAIL (E0905 not implemented yet, will get E0902 forbidden function)

**Step 4: Commit failing test**

```bash
git add tests/null-check/missing-c-prefix.test.cnx tests/null-check/missing-c-prefix.expected.error
git commit -m "test: add failing test for E0905 missing c_ prefix"
```

---

## Task 2: Create Failing Test for Valid c\_ Prefix Usage

**Files:**

- Create: `tests/null-check/valid-c-prefix-fopen.test.cnx`
- Create: `tests/null-check/valid-c-prefix-fopen.expected.c`

**Step 1: Create the test file**

```cnx
// tests/null-check/valid-c-prefix-fopen.test.cnx
// ADR-046: Valid c_ prefix with fopen
#include <stdio.h>

string<256> line;

void readFile() {
    FILE c_file <- fopen("data.txt", "r");
    if (c_file != NULL) {
        while (fgets(line, line.size, c_file) != NULL) {
            printf("%s", line);
        }
        fclose(c_file);
    }
}
```

**Step 2: Create expected output file**

```c
// tests/null-check/valid-c-prefix-fopen.expected.c
#include <stdio.h>

char line[256];

void readFile() {
    FILE* c_file = fopen("data.txt", "r");
    if (c_file != NULL) {
        while (fgets(line, sizeof(line), c_file) != NULL) {
            printf("%s", line);
        }
        fclose(c_file);
    }
}
```

**Step 3: Run test to verify it fails**

```bash
npm test -- tests/null-check/valid-c-prefix-fopen --quiet
```

Expected: FAIL (fopen currently forbidden with E0902)

**Step 4: Commit failing test**

```bash
git add tests/null-check/valid-c-prefix-fopen.test.cnx tests/null-check/valid-c-prefix-fopen.expected.c
git commit -m "test: add failing test for valid c_ prefix with fopen"
```

---

## Task 3: Create Failing Test for E0906 (Invalid c\_ Prefix on Non-Nullable)

**Files:**

- Create: `tests/null-check/invalid-c-prefix-int.test.cnx`
- Create: `tests/null-check/invalid-c-prefix-int.expected.error`

**Step 1: Create the test file**

```cnx
// tests/null-check/invalid-c-prefix-int.test.cnx
// ADR-046: Invalid c_ prefix on non-nullable type
#include <stdio.h>

i32 getCount() {
    return 42;
}

void test() {
    i32 c_count <- getCount(); // ERROR: c_ prefix on non-nullable
}
```

**Step 2: Create expected error file**

```
// tests/null-check/invalid-c-prefix-int.expected.error
11:8 error[E0906]: Invalid 'c_' prefix on non-nullable type 'i32'
```

**Step 3: Run test to verify it fails**

```bash
npm test -- tests/null-check/invalid-c-prefix-int --quiet
```

Expected: FAIL (E0906 not implemented yet)

**Step 4: Commit failing test**

```bash
git add tests/null-check/invalid-c-prefix-int.test.cnx tests/null-check/invalid-c-prefix-int.expected.error
git commit -m "test: add failing test for E0906 invalid c_ prefix"
```

---

## Task 4: Create Failing Test for E0907 (NULL on Non-c\_ Variable)

**Files:**

- Create: `tests/null-check/null-comparison-no-prefix.test.cnx`
- Create: `tests/null-check/null-comparison-no-prefix.expected.error`

**Step 1: Create the test file**

```cnx
// tests/null-check/null-comparison-no-prefix.test.cnx
// ADR-046: NULL comparison on non-c_ variable
#include <stdio.h>

string<64> buffer;

void test() {
    if (buffer != NULL) { // ERROR: NULL comparison on non-c_ variable
        printf("test");
    }
}
```

**Step 2: Create expected error file**

```
// tests/null-check/null-comparison-no-prefix.expected.error
9:8 error[E0907]: NULL comparison on non-nullable variable 'buffer'
```

**Step 3: Run test to verify it fails**

```bash
npm test -- tests/null-check/null-comparison-no-prefix --quiet
```

Expected: FAIL (currently passes incorrectly or different error)

**Step 4: Commit failing test**

```bash
git add tests/null-check/null-comparison-no-prefix.test.cnx tests/null-check/null-comparison-no-prefix.expected.error
git commit -m "test: add failing test for E0907 NULL on non-c_ variable"
```

---

## Task 5: Create New Error Type Interface

**Files:**

- Modify: `src/analysis/types/INullCheckError.ts`

**Step 1: Read existing interface**

```bash
cat src/analysis/types/INullCheckError.ts
```

**Step 2: Update interface to support new error codes**

The interface should already support the new codes since it uses string for code. Verify it has:

```typescript
interface INullCheckError {
  code: string; // E0901-E0908
  functionName: string;
  line: number;
  column: number;
  message: string;
  helpText: string;
}
```

**Step 3: Commit if changes needed**

```bash
git add src/analysis/types/INullCheckError.ts
git commit -m "chore: verify INullCheckError supports new error codes"
```

---

## Task 6: Define Nullable C Functions Map

**Files:**

- Modify: `src/analysis/NullCheckAnalyzer.ts`

**Step 1: Replace FORBIDDEN_NULLABLE_FUNCTIONS with NULLABLE_C_FUNCTIONS**

Replace the forbidden functions map with a map of all nullable C functions (now allowed with c\_ prefix):

```typescript
/**
 * C library functions that return nullable pointers
 * These require the c_ prefix when stored in variables
 */
const NULLABLE_C_FUNCTIONS: Map<string, ICLibraryFunction> = new Map([
  // Stream I/O (previously in C_STREAM_FUNCTIONS)
  [
    "fgets",
    {
      header: "stdio.h",
      nullMeaning: "EOF or error",
      docsUrl: "https://en.cppreference.com/w/c/io/fgets",
    },
  ],
  [
    "fputs",
    {
      header: "stdio.h",
      nullMeaning: "Write error (EOF)",
      docsUrl: "https://en.cppreference.com/w/c/io/fputs",
    },
  ],
  [
    "fgetc",
    {
      header: "stdio.h",
      nullMeaning: "EOF or error",
      docsUrl: "https://en.cppreference.com/w/c/io/fgetc",
    },
  ],
  [
    "fputc",
    {
      header: "stdio.h",
      nullMeaning: "Write error (EOF)",
      docsUrl: "https://en.cppreference.com/w/c/io/fputc",
    },
  ],
  [
    "gets",
    {
      header: "stdio.h",
      nullMeaning: "EOF or error (DEPRECATED)",
      docsUrl: "https://en.cppreference.com/w/c/io/gets",
    },
  ],
  // File handling (previously forbidden)
  [
    "fopen",
    {
      header: "stdio.h",
      nullMeaning: "Failed to open file",
      docsUrl: "https://en.cppreference.com/w/c/io/fopen",
    },
  ],
  [
    "freopen",
    {
      header: "stdio.h",
      nullMeaning: "Failed to reopen",
      docsUrl: "https://en.cppreference.com/w/c/io/freopen",
    },
  ],
  [
    "tmpfile",
    {
      header: "stdio.h",
      nullMeaning: "Failed to create temp file",
      docsUrl: "https://en.cppreference.com/w/c/io/tmpfile",
    },
  ],
  // String functions
  [
    "strstr",
    {
      header: "string.h",
      nullMeaning: "Substring not found",
      docsUrl: "https://en.cppreference.com/w/c/string/byte/strstr",
    },
  ],
  [
    "strchr",
    {
      header: "string.h",
      nullMeaning: "Character not found",
      docsUrl: "https://en.cppreference.com/w/c/string/byte/strchr",
    },
  ],
  [
    "strrchr",
    {
      header: "string.h",
      nullMeaning: "Character not found",
      docsUrl: "https://en.cppreference.com/w/c/string/byte/strrchr",
    },
  ],
  [
    "memchr",
    {
      header: "string.h",
      nullMeaning: "Byte not found",
      docsUrl: "https://en.cppreference.com/w/c/string/byte/memchr",
    },
  ],
  // Environment
  [
    "getenv",
    {
      header: "stdlib.h",
      nullMeaning: "Variable not found",
      docsUrl: "https://en.cppreference.com/w/c/program/getenv",
    },
  ],
]);

/**
 * Functions that remain forbidden (dynamic allocation - ADR-003)
 */
const FORBIDDEN_FUNCTIONS: Set<string> = new Set([
  "malloc",
  "calloc",
  "realloc",
  "free",
]);
```

**Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/analysis/NullCheckAnalyzer.ts
git commit -m "refactor: replace forbidden functions with nullable C functions map"
```

---

## Task 7: Add c\_ Prefix Validation Helper

**Files:**

- Modify: `src/analysis/NullCheckAnalyzer.ts`

**Step 1: Add helper function to check c\_ prefix**

Add this helper in the NullCheckAnalyzer class:

```typescript
/**
 * Check if variable name has required c_ prefix
 */
private static hasNullablePrefix(varName: string): boolean {
  return varName.startsWith("c_");
}

/**
 * Check if a type is a nullable C pointer type
 * Currently checks for FILE and pointer returns from NULLABLE_C_FUNCTIONS
 */
private static isNullableCType(typeName: string): boolean {
  // FILE is always nullable
  if (typeName === "FILE") return true;
  // cstring (char*) from C functions is nullable
  if (typeName === "cstring") return true;
  // Pointer types from C headers
  if (typeName.endsWith("*")) return true;
  return false;
}
```

**Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/analysis/NullCheckAnalyzer.ts
git commit -m "feat: add c_ prefix validation helpers"
```

---

## Task 8: Implement E0905 (Missing c\_ Prefix)

**Files:**

- Modify: `src/analysis/NullCheckAnalyzer.ts`

**Step 1: Add E0905 error reporter**

```typescript
/**
 * Report error: missing c_ prefix for nullable C type
 */
public reportMissingCPrefix(
  varName: string,
  typeName: string,
  funcName: string,
  line: number,
  column: number,
): void {
  this.errors.push({
    code: "E0905",
    functionName: funcName,
    line,
    column,
    message: `Missing 'c_' prefix for nullable C type '${typeName}'`,
    helpText: `Variable '${varName}' stores nullable pointer from '${funcName}'. Use: ${typeName} c_${varName} <- ${funcName}(...)`,
  });
}
```

**Step 2: Update enterVariableDeclaration to check for c\_ prefix**

Replace the existing validation in NullCheckListener:

```typescript
override enterVariableDeclaration = (
  ctx: Parser.VariableDeclarationContext,
): void => {
  const expr = ctx.expression();
  if (!expr) return;

  const varName = ctx.IDENTIFIER().getText();
  const funcName = this.extractFunctionCallName(expr);
  const line = ctx.start?.line ?? 0;
  const column = ctx.start?.column ?? 0;

  // Check if assigning from a nullable C function
  if (funcName && NULLABLE_C_FUNCTIONS.has(funcName)) {
    // Must have c_ prefix
    if (!NullCheckAnalyzer.hasNullablePrefix(varName)) {
      const typeName = ctx.type_()?.getText() ?? "unknown";
      this.analyzer.reportMissingCPrefix(varName, typeName, funcName, line, column);
    }
  }
};
```

**Step 3: Run test**

```bash
npm test -- tests/null-check/missing-c-prefix --quiet
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/analysis/NullCheckAnalyzer.ts
git commit -m "feat: implement E0905 missing c_ prefix error"
```

---

## Task 9: Update Validation to Allow c\_ Prefix Storage

**Files:**

- Modify: `src/analysis/NullCheckAnalyzer.ts`

**Step 1: Remove E0904 for c\_ prefixed variables**

Update the variable declaration check to allow storage when c\_ prefix is present:

```typescript
override enterVariableDeclaration = (
  ctx: Parser.VariableDeclarationContext,
): void => {
  const expr = ctx.expression();
  if (!expr) return;

  const varName = ctx.IDENTIFIER().getText();
  const funcName = this.extractFunctionCallName(expr);
  const line = ctx.start?.line ?? 0;
  const column = ctx.start?.column ?? 0;

  if (funcName && NULLABLE_C_FUNCTIONS.has(funcName)) {
    if (NullCheckAnalyzer.hasNullablePrefix(varName)) {
      // Valid: c_ prefix present, storage allowed
      return;
    } else {
      // E0905: Missing c_ prefix
      const typeName = ctx.type_()?.getText() ?? "unknown";
      this.analyzer.reportMissingCPrefix(varName, typeName, funcName, line, column);
    }
  }

  // Check forbidden functions (malloc, etc.) - always error
  if (funcName && FORBIDDEN_FUNCTIONS.has(funcName)) {
    this.analyzer.reportForbiddenFunction(funcName, line, column);
  }
};
```

**Step 2: Run valid c\_ prefix test**

```bash
npm test -- tests/null-check/valid-c-prefix-fopen --quiet
```

Expected: Still FAIL (need to also update function call validation)

**Step 3: Commit progress**

```bash
git add src/analysis/NullCheckAnalyzer.ts
git commit -m "feat: allow nullable storage with c_ prefix"
```

---

## Task 10: Update Function Call Validation for New Rules

**Files:**

- Modify: `src/analysis/NullCheckAnalyzer.ts`

**Step 1: Update enterPostfixExpression**

Replace the function call checking logic:

```typescript
override enterPostfixExpression = (
  ctx: Parser.PostfixExpressionContext,
): void => {
  const primary = ctx.primaryExpression();
  if (!primary?.IDENTIFIER()) return;

  const funcName = primary.IDENTIFIER()!.getText();
  const ops = ctx.postfixOp();

  const isCall = ops.some((op) => op.getText().startsWith("("));
  if (!isCall) return;

  const line = ctx.start?.line ?? 0;
  const column = ctx.start?.column ?? 0;

  // Check forbidden functions (malloc, etc.) - always error
  if (FORBIDDEN_FUNCTIONS.has(funcName)) {
    this.analyzer.reportForbiddenFunction(funcName, line, column);
    return;
  }

  // Nullable C functions are OK in:
  // 1. Equality comparison context (NULL check)
  // 2. Assignment to c_ prefixed variable (handled in enterVariableDeclaration)
  // Error only if used without either
  if (NULLABLE_C_FUNCTIONS.has(funcName)) {
    if (this.inEqualityComparison) {
      this.equalityComparisonFuncName = funcName;
    }
    // Don't error here - let variable declaration check handle storage errors
  }
};
```

**Step 2: Run tests**

```bash
npm test -- tests/null-check/valid-c-prefix-fopen --quiet
```

Expected: PASS (or closer to passing)

**Step 3: Commit**

```bash
git add src/analysis/NullCheckAnalyzer.ts
git commit -m "feat: update function call validation for ADR-046"
```

---

## Task 11: Implement E0906 (Invalid c\_ Prefix on Non-Nullable)

**Files:**

- Modify: `src/analysis/NullCheckAnalyzer.ts`

**Step 1: Add E0906 error reporter**

```typescript
/**
 * Report error: c_ prefix on non-nullable type
 */
public reportInvalidCPrefix(
  varName: string,
  typeName: string,
  line: number,
  column: number,
): void {
  this.errors.push({
    code: "E0906",
    functionName: varName,
    line,
    column,
    message: `Invalid 'c_' prefix on non-nullable type '${typeName}'`,
    helpText: `The 'c_' prefix is only for nullable C pointer types. Use: ${typeName} ${varName.substring(2)} <- ...`,
  });
}
```

**Step 2: Add validation in enterVariableDeclaration**

Add check for c\_ prefix on non-nullable types:

```typescript
// Check for invalid c_ prefix on non-nullable types
if (NullCheckAnalyzer.hasNullablePrefix(varName)) {
  const typeName = ctx.type_()?.getText() ?? "unknown";
  // If not assigning from nullable function, c_ prefix is invalid
  if (!funcName || !NULLABLE_C_FUNCTIONS.has(funcName)) {
    if (!NullCheckAnalyzer.isNullableCType(typeName)) {
      this.analyzer.reportInvalidCPrefix(varName, typeName, line, column);
    }
  }
}
```

**Step 3: Run test**

```bash
npm test -- tests/null-check/invalid-c-prefix-int --quiet
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/analysis/NullCheckAnalyzer.ts
git commit -m "feat: implement E0906 invalid c_ prefix error"
```

---

## Task 12: Implement E0907 (NULL Comparison on Non-c\_ Variable)

**Files:**

- Modify: `src/analysis/NullCheckAnalyzer.ts`

**Step 1: Add E0907 error reporter**

```typescript
/**
 * Report error: NULL comparison on non-nullable variable
 */
public reportNullComparisonOnNonNullable(
  varName: string,
  line: number,
  column: number,
): void {
  this.errors.push({
    code: "E0907",
    functionName: varName,
    line,
    column,
    message: `NULL comparison on non-nullable variable '${varName}'`,
    helpText: `Only variables with 'c_' prefix can be compared to NULL. C-Next variables are never null.`,
  });
}
```

**Step 2: Update NULL literal handling to check variable prefix**

This requires tracking the variable being compared in the equality expression. Update enterEqualityExpression and enterLiteral:

```typescript
/** Track variable names in current equality comparison */
private equalityComparisonVarNames: string[] = [];

override enterEqualityExpression = (
  ctx: Parser.EqualityExpressionContext,
): void => {
  const children = ctx.children ?? [];
  for (const child of children) {
    const text = child.getText();
    if (text === "=" || text === "!=") {
      this.inEqualityComparison = true;
      this.equalityComparisonFuncName = null;
      this.equalityComparisonHasNull = false;
      this.equalityComparisonVarNames = this.extractVariableNames(ctx);
      return;
    }
  }
};

private extractVariableNames(ctx: Parser.EqualityExpressionContext): string[] {
  const names: string[] = [];
  const text = ctx.getText();
  // Simple extraction: look for identifiers that aren't NULL or function calls
  const match = text.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
  if (match && match[1] !== "NULL") {
    names.push(match[1]);
  }
  return names;
}

override enterLiteral = (ctx: Parser.LiteralContext): void => {
  const text = ctx.getText();

  if (text === "NULL") {
    const line = ctx.start?.line ?? 0;
    const column = ctx.start?.column ?? 0;

    if (this.inEqualityComparison) {
      // Check if any compared variable lacks c_ prefix
      for (const varName of this.equalityComparisonVarNames) {
        if (!NullCheckAnalyzer.hasNullablePrefix(varName) &&
            !NULLABLE_C_FUNCTIONS.has(varName)) {
          this.analyzer.reportNullComparisonOnNonNullable(varName, line, column);
        }
      }
      this.equalityComparisonHasNull = true;
    } else {
      this.analyzer.reportInvalidNullUsage(line, column);
    }
  }
};
```

**Step 3: Run test**

```bash
npm test -- tests/null-check/null-comparison-no-prefix --quiet
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/analysis/NullCheckAnalyzer.ts
git commit -m "feat: implement E0907 NULL comparison on non-c_ variable"
```

---

## Task 13: Remove E0702 Stream Function Exemption

**Files:**

- Modify: `src/codegen/TypeValidator.ts`

**Step 1: Remove C_STREAM_FUNCTIONS constant**

Delete the constant near the top of the file:

```typescript
// DELETE THIS BLOCK:
const C_STREAM_FUNCTIONS = new Set([
  "fgets",
  "fputs",
  "fgetc",
  "fputc",
  "gets",
]);
```

**Step 2: Remove isCStreamFunctionNullCheck method**

Delete the entire method (~50 lines).

**Step 3: Remove extractFunctionName method**

Delete the entire method (~30 lines).

**Step 4: Update validateConditionNoFunctionCall**

Remove the exemption check:

```typescript
validateConditionNoFunctionCall(
  ctx: Parser.ExpressionContext,
  conditionType: string,
): void {
  // REMOVED: C stream function exemption check

  if (this.hasPostfixFunctionCall(ctx)) {
    const text = ctx.getText();
    throw new Error(
      `Error E0702: Function call in '${conditionType}' condition is not allowed (MISRA C:2012 Rule 13.5)\n` +
        `  expression: ${text}\n` +
        `  help: store the function result in a variable first`,
    );
  }
}
```

**Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

**Step 6: Run all tests**

```bash
npm test -- --quiet
```

Expected: Some null-check tests may fail (need updating)

**Step 7: Commit**

```bash
git add src/codegen/TypeValidator.ts
git commit -m "refactor: remove E0702 stream function exemption (ADR-046)"
```

---

## Task 14: Update Existing Null-Check Tests

**Files:**

- Modify: `tests/null-check/valid-fgets-check.test.cnx`
- Modify: `tests/null-check/valid-fgets-else.test.cnx`
- Modify: `tests/null-check/valid-fputs-check.test.cnx`
- Modify: `tests/null-check/valid-null-eq-check.test.cnx`
- Modify: `tests/null-check/null-in-while.test.cnx`
- Delete: `tests/null-check/forbidden-fopen.test.cnx` (fopen now allowed)
- Delete: `tests/null-check/forbidden-fopen.expected.error`

**Step 1: Update valid-fgets-check.test.cnx**

Since inline fgets check now triggers E0702, update to use c\_ prefix pattern:

```cnx
// ADR-046: Valid c_ prefix pattern for fgets result
#include <stdio.h>

string<64> buffer;

void readInput() {
    cstring c_result <- fgets(buffer, buffer.size, stdin);
    if (c_result != NULL) {
        printf("Got: %s", buffer);
    }
}
```

**Step 2: Update expected output file accordingly**

**Step 3: Update remaining test files similarly**

Each test using inline `if (fgets(...) != NULL)` needs updating to either:

- Store result with c\_ prefix, or
- If testing E0702, expect an error

**Step 4: Delete forbidden-fopen test**

```bash
rm tests/null-check/forbidden-fopen.test.cnx tests/null-check/forbidden-fopen.expected.error
```

**Step 5: Run all null-check tests**

```bash
npm test -- tests/null-check --quiet
```

Expected: PASS

**Step 6: Commit**

```bash
git add tests/null-check/
git commit -m "test: update null-check tests for ADR-046"
```

---

## Task 15: Update Documentation

**Files:**

- Modify: `docs/learn-cnext-in-y-minutes.md`
- Modify: `README.md` (if applicable)

**Step 1: Update learn-cnext-in-y-minutes.md**

Find the NULL section and update with new c\_ prefix pattern:

````markdown
## C Library Interop with NULL

C-Next variables are never null. C library functions can return nullable pointers.
Use the `c_` prefix to mark variables storing nullable C returns:

```cnx
#include <stdio.h>

string<256> line;

void readFile() {
    // c_ prefix marks nullable C pointer
    FILE c_file <- fopen("data.txt", "r");
    if (c_file != NULL) {
        cstring c_result <- fgets(line, line.size, c_file);
        while (c_result != NULL) {
            printf("%s", line);
            c_result <- fgets(line, line.size, c_file);
        }
        fclose(c_file);
    }
}

// Errors:
FILE file <- fopen("x", "r");     // E0905: Missing c_ prefix
i32 c_count <- getCount();        // E0906: Invalid c_ prefix on i32
if (buffer != NULL) { }           // E0907: NULL on non-c_ variable
```
````

````

**Step 2: Commit**

```bash
git add docs/learn-cnext-in-y-minutes.md README.md
git commit -m "docs: update NULL handling documentation for ADR-046"
````

---

## Task 16: Run Full Test Suite and Fix Regressions

**Step 1: Run full test suite**

```bash
npm test -- --quiet
```

**Step 2: Fix any failing tests**

Review each failure and update as needed.

**Step 3: Run tests again**

```bash
npm test -- --quiet
```

Expected: All tests pass

**Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve test regressions from ADR-046 implementation"
```

---

## Task 17: Final Verification and Cleanup

**Step 1: Run linting**

```bash
npm run oxlint:check
npm run prettier:check
```

**Step 2: Fix any lint issues**

```bash
npm run prettier:fix
```

**Step 3: Run full test suite one more time**

```bash
npm test
```

Expected: All tests pass

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup for ADR-046 nullable C interop"
```

---

## Summary

| Task  | Description                          | Key Files                          |
| ----- | ------------------------------------ | ---------------------------------- |
| 1-4   | Create failing tests for E0905-E0907 | `tests/null-check/*.test.cnx`      |
| 5     | Verify error interface               | `INullCheckError.ts`               |
| 6-7   | Define nullable functions + helpers  | `NullCheckAnalyzer.ts`             |
| 8-12  | Implement E0905, E0906, E0907        | `NullCheckAnalyzer.ts`             |
| 13    | Remove E0702 exemption               | `TypeValidator.ts`                 |
| 14    | Update existing tests                | `tests/null-check/*.test.cnx`      |
| 15    | Update documentation                 | `docs/learn-cnext-in-y-minutes.md` |
| 16-17 | Verify and cleanup                   | All files                          |
