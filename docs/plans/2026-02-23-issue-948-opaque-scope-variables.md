# Issue #948: Forward-Declared Struct Scope Variables Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate pointer types with `NULL` initialization for scope variables with forward-declared (opaque) struct types.

**Architecture:** Track opaque types in SymbolTable during C header parsing. When generating scope variables, check if type is opaque and generate pointer with `NULL`. Register opaque scope variables with `isPointer: true` so CallExprGenerator doesn't add `&`.

**Tech Stack:** TypeScript, Vitest, C-Next transpiler

---

### Task 1: Add Opaque Type Tracking to SymbolTable

**Files:**

- Modify: `src/transpiler/logic/symbols/SymbolTable.ts:77-78` (add field after `needsStructKeyword`)
- Test: `src/transpiler/logic/symbols/__tests__/SymbolTable.test.ts`

**Step 1: Write the failing test**

Add to `SymbolTable.test.ts` after the "Struct Keyword Tracking" describe block:

```typescript
// ========================================================================
// Opaque Type Tracking (Issue #948)
// ========================================================================

describe("Opaque Type Tracking", () => {
  it("should mark and check opaque types", () => {
    symbolTable.markOpaqueType("widget_t");
    expect(symbolTable.isOpaqueType("widget_t")).toBe(true);
    expect(symbolTable.isOpaqueType("other_t")).toBe(false);
  });

  it("should unmark opaque types when full definition found", () => {
    symbolTable.markOpaqueType("point_t");
    expect(symbolTable.isOpaqueType("point_t")).toBe(true);
    symbolTable.unmarkOpaqueType("point_t");
    expect(symbolTable.isOpaqueType("point_t")).toBe(false);
  });

  it("should get all opaque types", () => {
    symbolTable.markOpaqueType("handle_t");
    symbolTable.markOpaqueType("context_t");
    const all = symbolTable.getAllOpaqueTypes();
    expect(all).toContain("handle_t");
    expect(all).toContain("context_t");
    expect(all).toHaveLength(2);
  });

  it("should clear opaque types on clear()", () => {
    symbolTable.markOpaqueType("widget_t");
    symbolTable.clear();
    expect(symbolTable.isOpaqueType("widget_t")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/transpiler/logic/symbols/__tests__/SymbolTable.test.ts`
Expected: FAIL with "markOpaqueType is not a function"

**Step 3: Write minimal implementation**

In `SymbolTable.ts`, add after line 78 (`needsStructKeyword` field):

```typescript
/**
 * Issue #948: Track typedef names that alias incomplete (forward-declared) struct types.
 * These are "opaque" types that can only be used as pointers.
 */
private readonly opaqueTypes: Set<string> = new Set();
```

Add methods after `restoreNeedsStructKeyword()` (around line 856):

```typescript
// ========================================================================
// Opaque Type Tracking (Issue #948)
// ========================================================================

/**
 * Issue #948: Mark a typedef as aliasing an opaque (forward-declared) struct type.
 * @param typeName Typedef name (e.g., "widget_t")
 */
markOpaqueType(typeName: string): void {
  this.opaqueTypes.add(typeName);
}

/**
 * Issue #948: Unmark a typedef when full struct definition is found.
 * Handles edge case: typedef before definition.
 * @param typeName Typedef name
 */
unmarkOpaqueType(typeName: string): void {
  this.opaqueTypes.delete(typeName);
}

/**
 * Issue #948: Check if a typedef aliases an opaque struct type.
 * @param typeName Typedef name
 * @returns true if the type is opaque (forward-declared)
 */
isOpaqueType(typeName: string): boolean {
  return this.opaqueTypes.has(typeName);
}

/**
 * Issue #948: Get all opaque type names for cache serialization.
 * @returns Array of opaque typedef names
 */
getAllOpaqueTypes(): string[] {
  return Array.from(this.opaqueTypes);
}
```

In `clear()` method, add:

```typescript
this.opaqueTypes.clear();
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/transpiler/logic/symbols/__tests__/SymbolTable.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/transpiler/logic/symbols/SymbolTable.ts src/transpiler/logic/symbols/__tests__/SymbolTable.test.ts
git commit -m "feat(symbols): add opaque type tracking to SymbolTable (Issue #948)"
```

---

### Task 2: Detect Forward Declarations in StructCollector

**Files:**

- Modify: `src/transpiler/logic/symbols/c/collectors/StructCollector.ts:45-72`
- Test: `src/transpiler/logic/symbols/c/__tests__/CResolver.integration.test.ts`

**Step 1: Write the failing test**

Add to `CResolver.integration.test.ts`:

```typescript
describe("CResolver - Opaque Type Detection (Issue #948)", () => {
  it("marks forward-declared typedef struct as opaque", () => {
    const tree = TestHelpers.parseC(`typedef struct _widget_t widget_t;`);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);
    expect(symbolTable.isOpaqueType("widget_t")).toBe(true);
  });

  it("does not mark typedef struct with body as opaque", () => {
    const tree = TestHelpers.parseC(`typedef struct { int x; } point_t;`);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);
    expect(symbolTable.isOpaqueType("point_t")).toBe(false);
  });

  it("unmarks opaque type when full definition follows typedef", () => {
    const tree = TestHelpers.parseC(`
      typedef struct _point_t point_t;
      struct _point_t { int x; int y; };
    `);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);
    expect(symbolTable.isOpaqueType("point_t")).toBe(false);
  });

  it("handles multiple forward declarations", () => {
    const tree = TestHelpers.parseC(`
      typedef struct _handle_t handle_t;
      typedef struct _context_t context_t;
    `);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);
    expect(symbolTable.isOpaqueType("handle_t")).toBe(true);
    expect(symbolTable.isOpaqueType("context_t")).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/transpiler/logic/symbols/c/__tests__/CResolver.integration.test.ts`
Expected: FAIL - `isOpaqueType` returns false for forward-declared types

**Step 3: Write minimal implementation**

In `StructCollector.ts`, modify the `collect()` method around lines 44-72:

```typescript
static collect(
  structSpec: StructOrUnionSpecifierContext,
  sourceFile: string,
  line: number,
  symbolTable: SymbolTable | null,
  typedefName?: string,
  isTypedef?: boolean,
  warnings?: string[],
): ICStructSymbol | null {
  const identifier = structSpec.Identifier();

  // Use typedef name for anonymous structs (e.g., typedef struct { ... } AppConfig;)
  const name = identifier?.getText() || typedefName;
  if (!name) return null; // Skip if no name available

  const isUnion = structSpec.structOrUnion()?.getText() === "union";

  // Issue #948: Detect forward declaration (struct with no body)
  const hasBody = structSpec.structDeclarationList() !== null;

  // Extract fields if struct has a body
  const fields = StructCollector.collectFields(
    structSpec,
    name,
    symbolTable,
    warnings,
  );

  // Mark named structs that are not typedef'd - they need 'struct' keyword
  const needsStructKeyword = Boolean(identifier && !isTypedef);

  if (symbolTable) {
    if (needsStructKeyword) {
      symbolTable.markNeedsStructKeyword(name);
    }

    // Issue #948: Track opaque types (forward-declared typedef structs)
    if (isTypedef && !hasBody && typedefName) {
      symbolTable.markOpaqueType(typedefName);
    }

    // Issue #948: Unmark opaque type if full definition is found
    // This handles: typedef struct _foo foo; struct _foo { ... };
    if (hasBody) {
      const structTag = identifier?.getText();
      if (structTag) {
        symbolTable.unmarkOpaqueType(structTag);
      }
      if (typedefName) {
        symbolTable.unmarkOpaqueType(typedefName);
      }
    }
  }

  return {
    kind: "struct",
    name,
    sourceFile,
    sourceLine: line,
    sourceLanguage: ESourceLanguage.C,
    isExported: true,
    isUnion,
    needsStructKeyword,
    fields: fields.size > 0 ? fields : undefined,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/transpiler/logic/symbols/c/__tests__/CResolver.integration.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/transpiler/logic/symbols/c/collectors/StructCollector.ts src/transpiler/logic/symbols/c/__tests__/CResolver.integration.test.ts
git commit -m "feat(symbols): detect forward-declared structs as opaque types (Issue #948)"
```

---

### Task 3: Expose Opaque Types in ICodeGenSymbols

**Files:**

- Modify: `src/transpiler/types/ICodeGenSymbols.ts`
- Modify: `src/transpiler/logic/symbols/cnext/adapters/TSymbolInfoAdapter.ts`
- Test: `src/transpiler/logic/symbols/cnext/__tests__/TSymbolInfoAdapter.test.ts`

**Step 1: Add interface field**

In `ICodeGenSymbols.ts`, add after `functionReturnTypes`:

```typescript
// === Opaque Types (Issue #948) ===

/**
 * Issue #948: Types that are opaque (forward-declared structs).
 * Variables of these types should be generated as pointers.
 */
readonly opaqueTypes: ReadonlySet<string>;
```

**Step 2: Add to TSymbolInfoAdapter**

In `TSymbolInfoAdapter.ts`, in the `convert()` method:

Add to local variables (around line 55):

```typescript
// === Issue #948: Opaque Types ===
// Note: Opaque types are populated from SymbolTable, not TSymbol[]
// This will be an empty set here; actual values come from Transpiler
const opaqueTypes = new Set<string>();
```

Add to result object (around line 200):

```typescript
// Issue #948: Opaque types
opaqueTypes,
```

**Step 3: Run existing tests to verify no breakage**

Run: `npm run unit -- src/transpiler/logic/symbols/cnext/__tests__/TSymbolInfoAdapter.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/transpiler/types/ICodeGenSymbols.ts src/transpiler/logic/symbols/cnext/adapters/TSymbolInfoAdapter.ts
git commit -m "feat(types): add opaqueTypes to ICodeGenSymbols interface (Issue #948)"
```

---

### Task 4: Add Opaque Scope Variable Tracking to CodeGenState

**Files:**

- Modify: `src/transpiler/state/CodeGenState.ts`
- Test: `src/transpiler/state/__tests__/CodeGenState.test.ts`

**Step 1: Write the failing test**

Add to `CodeGenState.test.ts`:

```typescript
describe("Opaque Scope Variable Tracking (Issue #948)", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  it("should track and check opaque scope variables", () => {
    CodeGenState.markOpaqueScopeVariable("MyScope_widget");
    expect(CodeGenState.isOpaqueScopeVariable("MyScope_widget")).toBe(true);
    expect(CodeGenState.isOpaqueScopeVariable("MyScope_other")).toBe(false);
  });

  it("should clear opaque scope variables on reset", () => {
    CodeGenState.markOpaqueScopeVariable("MyScope_widget");
    CodeGenState.reset();
    expect(CodeGenState.isOpaqueScopeVariable("MyScope_widget")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/transpiler/state/__tests__/CodeGenState.test.ts`
Expected: FAIL - "markOpaqueScopeVariable is not a function"

**Step 3: Write minimal implementation**

In `CodeGenState.ts`, add field (around line 112, after typeRegistry):

```typescript
/**
 * Issue #948: Track qualified names of scope variables that are opaque pointers.
 * These variables should not have & added when passed to functions.
 */
private static opaqueScopeVariables: Set<string> = new Set();
```

Add methods (after setVariableTypeInfo, around line 560):

```typescript
// ===========================================================================
// OPAQUE SCOPE VARIABLE TRACKING (Issue #948)
// ===========================================================================

/**
 * Issue #948: Mark a scope variable as an opaque pointer.
 * @param qualifiedName Full name like "MyScope_widget"
 */
static markOpaqueScopeVariable(qualifiedName: string): void {
  this.opaqueScopeVariables.add(qualifiedName);
}

/**
 * Issue #948: Check if a scope variable is an opaque pointer.
 * @param qualifiedName Full name like "MyScope_widget"
 */
static isOpaqueScopeVariable(qualifiedName: string): boolean {
  return this.opaqueScopeVariables.has(qualifiedName);
}
```

In `reset()` method, add:

```typescript
this.opaqueScopeVariables.clear();
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/transpiler/state/__tests__/CodeGenState.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/transpiler/state/CodeGenState.ts src/transpiler/state/__tests__/CodeGenState.test.ts
git commit -m "feat(state): add opaque scope variable tracking to CodeGenState (Issue #948)"
```

---

### Task 5: Add isOpaqueType Helper to CodeGenState

**Files:**

- Modify: `src/transpiler/state/CodeGenState.ts`
- Test: `src/transpiler/state/__tests__/CodeGenState.test.ts`

**Step 1: Write the failing test**

Add to `CodeGenState.test.ts`:

```typescript
describe("isOpaqueType (Issue #948)", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  it("should return false when symbols not set", () => {
    expect(CodeGenState.isOpaqueType("widget_t")).toBe(false);
  });

  it("should check opaqueTypes from symbols", () => {
    const mockSymbols = {
      opaqueTypes: new Set(["widget_t", "handle_t"]),
      // ... other required fields with empty defaults
      knownScopes: new Set<string>(),
      knownStructs: new Set<string>(),
      knownEnums: new Set<string>(),
      knownBitmaps: new Set<string>(),
      knownRegisters: new Set<string>(),
      scopeMembers: new Map(),
      scopeMemberVisibility: new Map(),
      structFields: new Map(),
      structFieldArrays: new Map(),
      structFieldDimensions: new Map(),
      enumMembers: new Map(),
      bitmapFields: new Map(),
      bitmapBackingType: new Map(),
      bitmapBitWidth: new Map(),
      scopedRegisters: new Map(),
      registerMemberAccess: new Map(),
      registerMemberTypes: new Map(),
      registerBaseAddresses: new Map(),
      registerMemberOffsets: new Map(),
      registerMemberCTypes: new Map(),
      scopeVariableUsage: new Map(),
      scopePrivateConstValues: new Map(),
      functionReturnTypes: new Map(),
      getSingleFunctionForVariable: () => null,
      hasPublicSymbols: () => false,
    };
    CodeGenState.symbols = mockSymbols;
    expect(CodeGenState.isOpaqueType("widget_t")).toBe(true);
    expect(CodeGenState.isOpaqueType("other_t")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/transpiler/state/__tests__/CodeGenState.test.ts`
Expected: FAIL - "isOpaqueType is not a function"

**Step 3: Write minimal implementation**

In `CodeGenState.ts`, add method (after isOpaqueScopeVariable):

```typescript
/**
 * Issue #948: Check if a type is opaque (forward-declared struct).
 * @param typeName Type name to check
 */
static isOpaqueType(typeName: string): boolean {
  return this.symbols?.opaqueTypes.has(typeName) ?? false;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/transpiler/state/__tests__/CodeGenState.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/transpiler/state/CodeGenState.ts src/transpiler/state/__tests__/CodeGenState.test.ts
git commit -m "feat(state): add isOpaqueType helper to CodeGenState (Issue #948)"
```

---

### Task 6: Populate opaqueTypes from SymbolTable in Transpiler

**Files:**

- Modify: `src/transpiler/Transpiler.ts`

**Step 1: Find where symbols are built**

Search for where `TSymbolInfoAdapter.convert()` is called and where `CodeGenState.symbols` is set.

**Step 2: Populate opaqueTypes from SymbolTable**

In `Transpiler.ts`, find where symbols are prepared for codegen. After building ICodeGenSymbols, merge in opaqueTypes from SymbolTable:

```typescript
// Issue #948: Populate opaqueTypes from SymbolTable
const opaqueTypesFromTable = new Set(this.symbolTable.getAllOpaqueTypes());
// Merge with symbols from TSymbolInfoAdapter
const symbolsWithOpaqueTypes = {
  ...symbols,
  opaqueTypes: opaqueTypesFromTable,
};
```

**Step 3: Run integration test**

Run: `npm test -- bugs/issue-948-forward-decl-scope-var/test.test.cnx`
Expected: Still fails (we haven't modified ScopeGenerator yet), but should not error

**Step 4: Commit**

```bash
git add src/transpiler/Transpiler.ts
git commit -m "feat(transpiler): populate opaqueTypes from SymbolTable (Issue #948)"
```

---

### Task 7: Generate Pointer for Opaque Types in ScopeGenerator

**Files:**

- Modify: `src/transpiler/output/codegen/generators/declarationGenerators/ScopeGenerator.ts:176-213`
- Modify: `src/transpiler/output/codegen/generators/IOrchestrator.ts` (add interface methods)
- Test: Integration test already exists

**Step 1: Add methods to IOrchestrator interface**

In `IOrchestrator.ts` (or wherever IOrchestrator is defined), add:

```typescript
/**
 * Issue #948: Check if a type is opaque (forward-declared struct).
 */
isOpaqueType(typeName: string): boolean;

/**
 * Issue #948: Mark a scope variable as an opaque pointer.
 */
markOpaqueScopeVariable(qualifiedName: string): void;
```

**Step 2: Implement in CodeGenerator**

In `CodeGenerator.ts`, add implementations:

```typescript
isOpaqueType(typeName: string): boolean {
  return CodeGenState.isOpaqueType(typeName);
}

markOpaqueScopeVariable(qualifiedName: string): void {
  CodeGenState.markOpaqueScopeVariable(qualifiedName);
  // Also register with isPointer: true so CallExprGenerator skips &
  CodeGenState.setVariableTypeInfo(qualifiedName, {
    baseType: "opaque",
    bitWidth: 0,
    isArray: false,
    isConst: false,
    isPointer: true,
  });
}
```

**Step 3: Modify generateRegularVariable in ScopeGenerator**

```typescript
function generateRegularVariable(
  varDecl: Parser.VariableDeclarationContext,
  varName: string,
  scopeName: string,
  isPrivate: boolean,
  orchestrator: IOrchestrator,
): string {
  // Derive array and const info from varDecl
  const isConst = varDecl.constModifier() !== null;
  const arrayDims = varDecl.arrayDimension();
  const arrayTypeCtx = varDecl.type().arrayType?.() ?? null;
  const isArray = arrayDims.length > 0 || arrayTypeCtx !== null;

  // ADR-016: All scope variables are emitted at file scope
  let type = orchestrator.generateType(varDecl.type());
  const fullName = QualifiedNameGenerator.forMember(scopeName, varName);

  // Issue #948: Opaque types become pointers with NULL initialization
  const isOpaqueType = orchestrator.isOpaqueType(type);
  if (isOpaqueType) {
    type = `${type}*`;
    orchestrator.markOpaqueScopeVariable(fullName);
  }

  // Issue #282: Add 'const' modifier for const variables
  const constPrefix = isConst ? "const " : "";
  const prefix = isPrivate ? "static " : "";

  // Build declaration with all dimensions
  let decl = `${prefix}${constPrefix}${type} ${fullName}`;
  decl += ArrayDimensionUtils.generateArrayTypeDimension(
    arrayTypeCtx,
    orchestrator,
  );

  if (arrayDims.length > 0) {
    // C-style or additional dimensions
    decl += orchestrator.generateArrayDimensions(arrayDims);
  }

  // ADR-045: Add string capacity dimension for string arrays
  decl += ArrayDimensionUtils.generateStringCapacityDim(varDecl.type());

  // Issue #948: Use NULL for opaque types
  if (isOpaqueType) {
    decl += " = NULL";
  } else {
    decl += generateInitializer(varDecl, isArray, orchestrator);
  }

  return decl + ";";
}
```

**Step 4: Run integration test**

Run: `npm test -- bugs/issue-948-forward-decl-scope-var/test.test.cnx`
Expected: PASS (or closer - may need CallExprGenerator fix)

**Step 5: Commit**

```bash
git add src/transpiler/output/codegen/generators/declarationGenerators/ScopeGenerator.ts src/transpiler/output/codegen/generators/IOrchestrator.ts src/transpiler/output/codegen/CodeGenerator.ts
git commit -m "feat(codegen): generate pointer for opaque scope variables (Issue #948)"
```

---

### Task 8: Create Edge Case Integration Test

**Files:**

- Create: `bugs/issue-948-forward-then-define/forward-then-define.h`
- Create: `bugs/issue-948-forward-then-define/test.test.cnx`
- Create: `bugs/issue-948-forward-then-define/test.expected.c`
- Create: `bugs/issue-948-forward-then-define/test.expected.h`

**Step 1: Create test files**

`forward-then-define.h`:

```c
#ifndef FORWARD_THEN_DEFINE_H
#define FORWARD_THEN_DEFINE_H
#include <stdint.h>

/* Forward declaration first */
typedef struct _point_t point_t;

/* Full definition later - point_t is NOT opaque */
struct _point_t {
    int32_t x;
    int32_t y;
};

point_t point_create(int32_t x, int32_t y);
#endif
```

`test.test.cnx`:

```cnx
// test-transpile-only
// Issue #948 edge case: typedef before definition should NOT be opaque
#include "forward-then-define.h"

scope Geometry {
    point_t origin;

    public void init() {
        this.origin <- global.point_create(0, 0);
    }
}
```

`test.expected.c`:

```c
/**
 * Generated by C-Next Transpiler
 * A safer C for embedded systems
 */

#include "test.test.h"

// test-transpile-only
// Issue #948 edge case: typedef before definition should NOT be opaque
#include "forward-then-define.h"

/* Scope: Geometry */
static point_t Geometry_origin = {0};

void Geometry_init(void) {
    Geometry_origin = point_create(0, 0);
}
```

`test.expected.h`:

```c
/**
 * Generated by C-Next Transpiler
 * A safer C for embedded systems
 */

#ifndef TEST_TEST_H
#define TEST_TEST_H

#include <stdbool.h>
#include <stdint.h>

/* Scope: Geometry */
void Geometry_init(void);

#endif /* TEST_TEST_H */
```

**Step 2: Run test**

Run: `npm test -- bugs/issue-948-forward-then-define/test.test.cnx`
Expected: PASS

**Step 3: Commit**

```bash
git add bugs/issue-948-forward-then-define/
git commit -m "test: add edge case test for typedef before definition (Issue #948)"
```

---

### Task 9: Update Main Integration Test Expected Output

**Files:**

- Modify: `bugs/issue-948-forward-decl-scope-var/test.expected.c`

**Step 1: Verify expected output is correct**

The expected output should be:

```c
/**
 * Generated by C-Next Transpiler
 * A safer C for embedded systems
 */

#include "test.test.h"

// test-transpile-only
#include "fake_lib.h"

/* Scope: MyScope */
static widget_t* MyScope_w = NULL;

void MyScope_init(void) {
    MyScope_w = widget_create();
    widget_set_value(MyScope_w, 42);
}
```

**Step 2: Run test**

Run: `npm test -- bugs/issue-948-forward-decl-scope-var/test.test.cnx`
Expected: PASS

**Step 3: Commit if changes needed**

```bash
git add bugs/issue-948-forward-decl-scope-var/
git commit -m "test: update expected output for Issue #948"
```

---

### Task 10: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm run test:all`
Expected: All tests pass

**Step 2: Check for regressions**

If any tests fail, investigate and fix.

**Step 3: Final commit**

```bash
git add -A
git commit -m "fix: scope variables with forward-declared struct types generate as pointers (Issue #948)

- Track opaque (forward-declared) types in SymbolTable
- Detect forward declarations in StructCollector
- Generate pointer with NULL for opaque scope variables
- Register opaque scope variables with isPointer flag
- Handle edge case: typedef before definition

Fixes #948"
```

---

Plan complete and saved to `docs/plans/2026-02-23-issue-948-opaque-scope-variables.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
