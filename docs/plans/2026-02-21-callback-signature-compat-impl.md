# Callback Signature Compatibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make C-Next functions assigned to C callback typedefs generate compatible signatures in both C and C++ modes.

**Architecture:** Add a pre-analysis pass that detects function assignments to C function pointer typedefs, stores them in CodeGenState, then adjusts both parameter signature generation (via `_isPassByValueType`) and body member access (via `isStruct` override in FunctionContextManager).

**Tech Stack:** TypeScript, ANTLR4 parser, C-Next transpiler

---

### Task 1: Add callbackCompatibleFunctions state to CodeGenState

**Files:**

- Modify: `src/transpiler/state/CodeGenState.ts:129` (after callbackFieldTypes)
- Modify: `src/transpiler/state/CodeGenState.ts:326` (in reset())

**Step 1: Add the new state field**

After line 129 (`static callbackFieldTypes: Map<string, string> = new Map();`), add:

```typescript
/** Functions that need C-callback-compatible (by-value) struct parameters */
static callbackCompatibleFunctions: Set<string> = new Set();
```

**Step 2: Add reset in reset() method**

After line 326 (`this.callbackFieldTypes = new Map();`), add:

```typescript
this.callbackCompatibleFunctions = new Set();
```

**Step 3: Run unit tests to verify no regressions**

Run: `npm run unit`
Expected: All unit tests pass

**Step 4: Commit**

```bash
git add src/transpiler/state/CodeGenState.ts
git commit -m "feat: add callbackCompatibleFunctions state to CodeGenState"
```

---

### Task 2: Add detection logic in FunctionCallAnalyzer

**Files:**

- Modify: `src/transpiler/logic/analysis/FunctionCallAnalyzer.ts:222-233` (enterVariableDeclaration)
- Modify: `src/transpiler/logic/analysis/FunctionCallAnalyzer.ts:449-453` (analyze method, first pass)
- Test: `src/transpiler/logic/analysis/__tests__/FunctionCallAnalyzer.test.ts` (or new test file)

**Step 1: Write a failing unit test for callback detection**

In the FunctionCallAnalyzer test file, add a test that verifies when a variable declaration uses a C function pointer typedef as its type and a function name as its initializer, the function is added to `CodeGenState.callbackCompatibleFunctions`.

```typescript
it("detects function assigned to C function pointer typedef", () => {
  // Set up: register a C typedef for a function pointer in the symbol table
  const symbolTable = new SymbolTable();
  // Add a C typedef symbol: typedef void (*PointCallback)(Point p);
  // The symbol has kind: "type" and type contains "(*)"
  // ... (mock or use real symbol table)

  const source = `
    #include "callback_types.h"
    void my_handler(Point p) {
      i32 sum <- p.x + p.y;
    }
    void test() {
      PointCallback cb <- my_handler;
    }
  `;

  // After analysis, my_handler should be in callbackCompatibleFunctions
  // ...
  expect(CodeGenState.callbackCompatibleFunctions.has("my_handler")).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- --testPathPattern FunctionCallAnalyzer`
Expected: FAIL — callbackCompatibleFunctions not populated

**Step 3: Add a helper method to FunctionCallAnalyzer to check C function pointer typedefs**

Add a new private method to `FunctionCallAnalyzer` (around line 500, near `collectCallbackTypes`):

```typescript
/**
 * Check if a type name is a C function pointer typedef.
 * Looks up the type in the symbol table and checks if it's a typedef
 * whose underlying type contains "(*)" indicating a function pointer.
 */
isCFunctionPointerTypedef(typeName: string): boolean {
  if (!this.symbolTable) return false;
  const sym = this.symbolTable.getCSymbol(typeName);
  if (!sym || sym.kind !== "type") return false;
  // ICTypedefSymbol has a `type` field with the underlying C type string
  return "type" in sym && typeof sym.type === "string" && sym.type.includes("(*)");
}
```

**Step 4: Add a new collection pass in analyze()**

In the `analyze()` method, after line 453 (`this.collectAllLocalFunctions(tree);`), add:

```typescript
this.collectCallbackCompatibleFunctions(tree);
```

Add the new collection method:

```typescript
/**
 * Detect functions assigned to C function pointer typedefs.
 * When `PointCallback cb <- my_handler;` is found and PointCallback
 * is a C function pointer typedef, mark my_handler as callback-compatible.
 */
private collectCallbackCompatibleFunctions(tree: Parser.ProgramContext): void {
  for (const decl of tree.declaration()) {
    const funcDecl = decl.functionDeclaration();
    if (!funcDecl) continue;

    const block = funcDecl.block();
    if (!block) continue;

    this.scanBlockForCallbackAssignments(block);
  }
}

private scanBlockForCallbackAssignments(block: Parser.BlockContext): void {
  for (const stmt of block.statement()) {
    const varDecl = stmt.variableDeclaration();
    if (!varDecl) continue;

    const typeName = varDecl.type().getText();
    if (!this.isCFunctionPointerTypedef(typeName)) continue;

    // Get the initializer expression
    const expr = varDecl.expression();
    if (!expr) continue;

    // Extract the function name from a simple identifier expression
    const funcName = this.extractSimpleIdentifier(expr);
    if (funcName && this.allLocalFunctions.has(funcName)) {
      CodeGenState.callbackCompatibleFunctions.add(funcName);
    }
  }
}

/**
 * Extract a simple identifier from an expression context.
 * Returns null if the expression is not a simple identifier reference.
 */
private extractSimpleIdentifier(expr: Parser.ExpressionContext): string | null {
  // Navigate: expression -> ternaryExpression -> orExpression -> ... -> postfixExpression -> primaryExpression -> IDENTIFIER
  // Simple approach: get text and check if it's a single identifier
  const text = expr.getText();
  // A simple identifier contains only word characters
  if (/^\w+$/.test(text)) {
    return text;
  }
  return null;
}
```

**Step 5: Run test to verify it passes**

Run: `npm run unit -- --testPathPattern FunctionCallAnalyzer`
Expected: PASS

**Step 6: Commit**

```bash
git add src/transpiler/logic/analysis/FunctionCallAnalyzer.ts
git add src/transpiler/logic/analysis/__tests__/FunctionCallAnalyzer.test.ts
git commit -m "feat: detect functions assigned to C function pointer typedefs"
```

---

### Task 3: Adjust parameter signature for callback-compatible functions

**Files:**

- Modify: `src/transpiler/output/codegen/CodeGenerator.ts:3760-3778` (\_isPassByValueType)

**Step 1: Write a failing integration test**

Create a simple test file that assigns a C-Next function to a C callback typedef and verifies the output uses by-value parameters.

Use the existing `tests/interop/callback-signature/callback-assign.test.cnx` — update it to expect by-value signature.

**Step 2: Add callback-compatible check to \_isPassByValueType()**

In `_isPassByValueType()` at line 3760, add a check after the existing checks (before `return false;` at line 3777):

```typescript
// Callback-compatible functions: struct params become pass-by-value
// to match C function pointer typedef signatures
if (
  CodeGenState.currentFunctionName &&
  CodeGenState.callbackCompatibleFunctions.has(
    CodeGenState.currentFunctionName,
  ) &&
  this.isKnownStruct(typeName)
) {
  return true;
}
```

**Step 3: Run the integration test**

Run: `npm test -- tests/interop/callback-signature/`
Expected: Signature should now show `Point p` instead of `const Point& p` in C++ mode. Test may still fail due to body access or expected file mismatch.

**Step 4: Commit**

```bash
git add src/transpiler/output/codegen/CodeGenerator.ts
git commit -m "feat: mark struct params as pass-by-value for callback-compatible functions"
```

---

### Task 4: Adjust body member access for callback-compatible functions

**Files:**

- Modify: `src/transpiler/output/codegen/helpers/FunctionContextManager.ts:153-162`

**Step 1: Override isStruct for callback-compatible functions**

In `processParameter()` at line 153, modify the `paramInfo` construction:

```typescript
// Register in currentParameters
// For callback-compatible functions, struct params use by-value semantics
// (no pointer dereference, dot access instead of arrow in C mode)
const isCallbackCompat =
  CodeGenState.currentFunctionName !== null &&
  CodeGenState.callbackCompatibleFunctions.has(
    CodeGenState.currentFunctionName,
  );

const paramInfo = {
  name,
  baseType: typeInfo.typeName,
  isArray,
  isStruct: isCallbackCompat ? false : typeInfo.isStruct,
  isConst,
  isCallback: typeInfo.isCallback,
  isString: typeInfo.isString,
};
```

**Step 2: Run unit tests**

Run: `npm run unit -- --testPathPattern FunctionContextManager`
Expected: Existing tests still pass (none use callbackCompatibleFunctions)

**Step 3: Commit**

```bash
git add src/transpiler/output/codegen/helpers/FunctionContextManager.ts
git commit -m "feat: override isStruct for callback-compatible function params"
```

---

### Task 5: Update test files for execution

**Files:**

- Modify: `tests/interop/callback-signature/callback-assign.test.cnx`
- Modify: `tests/interop/callback-signature/callback_types.h`
- Modify: `tests/interop/callback-signature/callback-assign.expected.cpp`
- Create: `tests/interop/callback-signature/callback-assign.expected.c`
- Create: `tests/interop/callback-signature/callback-assign.expected.h`

**Step 1: Update the C header to provide function implementations**

Update `callback_types.h` to make `register_callback` an inline function so linking works:

```c
#ifndef CALLBACK_TYPES_H
#define CALLBACK_TYPES_H

typedef struct {
    int x;
    int y;
} Point;

/* C callback typedef - takes struct by value */
typedef void (*PointCallback)(Point p);

/* Struct containing callback */
typedef struct {
    PointCallback on_point;
} PointHandler;

/* Function that accepts a callback - provide implementation for testing */
static int callback_was_registered = 0;
static inline void register_callback(PointCallback cb) {
    callback_was_registered = 1;
    /* Call it to verify signature compatibility */
    Point test_point = { .x = 10, .y = 20 };
    cb(test_point);
}

#endif /* CALLBACK_TYPES_H */
```

**Step 2: Rewrite the test for execution with validation**

Update `callback-assign.test.cnx`:

```c-next
// test-execution
// Test: Assigning C-Next function to C callback typedef
// Verifies signature compatibility in both C and C++ modes
#include "callback_types.h"

i32 handler_sum <- 0;

// C-Next function that should be assignable to PointCallback
void my_point_handler(Point p) {
    handler_sum <- p.x + p.y;
}

i32 main() {
    // Test 1: Direct assignment to callback typedef variable
    PointCallback cb <- my_point_handler;
    Point p1 <- {x: 3, y: 7};
    cb(p1);
    if (handler_sum != 10) return 1;

    // Test 2: Reset and call via struct field
    handler_sum <- 0;
    PointHandler handler <- {
        on_point: my_point_handler
    };
    Point p2 <- {x: 5, y: 15};
    handler.on_point(p2);
    if (handler_sum != 20) return 2;

    // Test 3: Pass to C function that calls the callback
    handler_sum <- 0;
    register_callback(my_point_handler);
    if (handler_sum != 30) return 3;

    return 0;
}
```

**Step 3: Regenerate expected output files**

Run: `npm test -- tests/interop/callback-signature/callback-assign.test.cnx --update`

This generates the `.expected.c`, `.expected.cpp`, and `.expected.h` files.

**Step 4: Verify expected output is correct**

Read the generated `.expected.cpp` and verify:

- `my_point_handler` has signature `void my_point_handler(Point p)` (NOT `const Point& p`)
- Member access uses `p.x` and `p.y`

Read the generated `.expected.c` and verify:

- `my_point_handler` has signature `void my_point_handler(Point p)` (NOT `const Point* p`)
- Member access uses `p.x` and `p.y` (NOT `p->x`)

**Step 5: Run the test in execution mode**

Run: `npm test -- tests/interop/callback-signature/`
Expected: PASS with execution (no "exec skipped" or "transpile-only")

**Step 6: Run the full test suite**

Run: `npm test`
Expected: All tests pass

**Step 7: Run unit tests**

Run: `npm run unit`
Expected: All unit tests pass

**Step 8: Commit**

```bash
git add tests/interop/callback-signature/
git commit -m "test: make callback-assign test executable in both C and C++ modes"
```

---

### Task 6: Verify all anonymous-structs tests still pass

**Step 1: Run the anonymous-structs test suite**

Run: `npm test -- tests/interop/anonymous-structs/`
Expected: All 8 tests pass

**Step 2: Run the full integration test suite**

Run: `npm test`
Expected: All tests pass (no regressions)

**Step 3: Run the full test suite**

Run: `npm run test:all`
Expected: All tests, unit tests, and validation pass

---

### Task 7: Update design doc status and push

**Step 1: Update the design doc status**

Change `docs/plans/2026-02-21-callback-signature-compat-design.md` status from "Draft" to "Implemented".

**Step 2: Push to the PR branch**

Run: `git push origin claude/2026-02-21-1771682751848`
Expected: PR #883 is updated with all changes
