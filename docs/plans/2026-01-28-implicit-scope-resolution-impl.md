# Implicit Scope Resolution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable bare identifiers inside scopes to resolve using local → scope → global priority, eliminating mandatory `this.`/`global.` prefixes while preserving them for explicit access.

**Architecture:** Modify `TypeValidator.validateBareIdentifierInScope()` to resolve identifiers instead of erroring, and update `CodeGenerator.generatePrimaryExpr()` to use the resolved value. Add context-aware resolution for member access (`.`) to prefer scope names.

**Tech Stack:** TypeScript, ANTLR-generated parser

---

## Task 1: Update TypeValidator to Resolve Instead of Error

**Files:**

- Modify: `src/codegen/TypeValidator.ts:347-408`
- Test: `src/codegen/__tests__/TypeValidator.resolution.test.ts` (new)

**Step 1: Write the failing test**

Create `src/codegen/__tests__/TypeValidator.resolution.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import TypeValidator from "../TypeValidator";
import type ISymbolInfo from "../generators/ISymbolInfo";

describe("TypeValidator.resolveBareIdentifier", () => {
  let mockSymbols: ISymbolInfo;
  let scopeMembers: Map<string, Set<string>>;
  let typeRegistry: Map<string, { baseType: string }>;
  let currentScope: string | null;

  beforeEach(() => {
    scopeMembers = new Map([["Motor", new Set(["speed", "maxSpeed"])]]);
    typeRegistry = new Map([
      ["globalCounter", { baseType: "u32" }],
      ["Motor_speed", { baseType: "u32" }],
    ]);
    currentScope = "Motor";
    mockSymbols = {
      knownScopes: new Set(["Motor", "LED"]),
      knownRegisters: new Set(["GPIO"]),
      knownEnums: new Set(["State"]),
      knownStructs: new Set(["Point"]),
      knownBitmaps: new Set(),
      scopeMembers: new Map([["Motor", new Set(["speed", "maxSpeed"])]]),
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
    } as ISymbolInfo;
  });

  function createValidator(): TypeValidator {
    return new TypeValidator({
      symbols: mockSymbols,
      typeRegistry,
      knownFunctions: new Set(["globalFunc", "Motor_stop"]),
      getCurrentScopeFn: () => currentScope,
      getScopeMembersFn: () => scopeMembers,
    });
  }

  describe("inside a scope", () => {
    it("returns null for local variables (no transformation needed)", () => {
      const validator = createValidator();
      const result = validator.resolveBareIdentifier(
        "localVar",
        true,
        () => false,
      );
      expect(result).toBeNull();
    });

    it("resolves scope member to prefixed name", () => {
      const validator = createValidator();
      const result = validator.resolveBareIdentifier(
        "speed",
        false,
        () => false,
      );
      expect(result).toBe("Motor_speed");
    });

    it("resolves global variable to itself", () => {
      const validator = createValidator();
      const result = validator.resolveBareIdentifier(
        "globalCounter",
        false,
        () => false,
      );
      expect(result).toBe("globalCounter");
    });

    it("resolves global function to itself", () => {
      const validator = createValidator();
      const result = validator.resolveBareIdentifier(
        "globalFunc",
        false,
        () => false,
      );
      expect(result).toBe("globalFunc");
    });

    it("resolves scope function to prefixed name", () => {
      const validator = createValidator();
      const result = validator.resolveBareIdentifier(
        "stop",
        false,
        () => false,
      );
      // 'stop' should check if Motor_stop exists as a function
      expect(result).toBe("Motor_stop");
    });
  });

  describe("outside a scope", () => {
    beforeEach(() => {
      currentScope = null;
    });

    it("returns null for local variables", () => {
      const validator = createValidator();
      const result = validator.resolveBareIdentifier(
        "localVar",
        true,
        () => false,
      );
      expect(result).toBeNull();
    });

    it("returns null for global variables (no transformation)", () => {
      const validator = createValidator();
      const result = validator.resolveBareIdentifier(
        "globalCounter",
        false,
        () => false,
      );
      expect(result).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/codegen/__tests__/TypeValidator.resolution.test.ts`
Expected: FAIL - `resolveBareIdentifier` method doesn't exist

**Step 3: Implement resolveBareIdentifier method**

In `src/codegen/TypeValidator.ts`, add new method after `validateBareIdentifierInScope`:

```typescript
/**
 * Resolve a bare identifier to its qualified name using priority:
 * 1. Local variables/parameters (return null - no transformation needed)
 * 2. Scope members (return Scope_identifier)
 * 3. Global variables/functions (return identifier)
 *
 * Returns null if no transformation needed, the resolved name otherwise.
 * Throws if identifier cannot be resolved at all.
 */
resolveBareIdentifier(
  identifier: string,
  isLocalVariable: boolean,
  isKnownStruct: (name: string) => boolean,
): string | null {
  // Priority 1: Local variables and parameters - no transformation
  if (isLocalVariable) {
    return null;
  }

  const currentScope = this.getCurrentScopeFn();

  // Priority 2: If inside a scope, check scope members
  if (currentScope) {
    const scopeMembers = this.getScopeMembersFn().get(currentScope);
    if (scopeMembers && scopeMembers.has(identifier)) {
      return `${currentScope}_${identifier}`;
    }

    // Check if it's a scope function (exists as Scope_identifier in knownFunctions)
    const scopedFuncName = `${currentScope}_${identifier}`;
    if (this.knownFunctions.has(scopedFuncName)) {
      return scopedFuncName;
    }
  }

  // Priority 3: Global resolution
  // Check global variables in type registry (no underscore = global)
  const typeInfo = this.typeRegistry.get(identifier);
  if (typeInfo && !identifier.includes("_")) {
    return currentScope ? identifier : null; // Only transform if inside scope
  }

  // Check global functions
  if (this.knownFunctions.has(identifier)) {
    return currentScope ? identifier : null;
  }

  // Check known types (enums, structs, registers) - these are valid as identifiers
  if (this.symbols!.knownEnums.has(identifier)) {
    return currentScope ? identifier : null;
  }

  if (isKnownStruct(identifier)) {
    return currentScope ? identifier : null;
  }

  if (this.symbols!.knownRegisters.has(identifier)) {
    return currentScope ? identifier : null;
  }

  // Not found anywhere - let it pass through (may be enum member or error later)
  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/codegen/__tests__/TypeValidator.resolution.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/codegen/TypeValidator.ts src/codegen/__tests__/TypeValidator.resolution.test.ts
git commit -m "feat: add resolveBareIdentifier method to TypeValidator

Implements local → scope → global resolution priority for bare
identifiers inside scopes.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add Context-Aware Resolution for Member Access

**Files:**

- Modify: `src/codegen/TypeValidator.ts`
- Test: `src/codegen/__tests__/TypeValidator.resolution.test.ts`

**Step 1: Write the failing test**

Add to `TypeValidator.resolution.test.ts`:

```typescript
describe("resolveForMemberAccess", () => {
  it("prefers scope name over global variable for member access", () => {
    // Setup: global variable 'LED' exists AND scope 'LED' exists
    typeRegistry.set("LED", { baseType: "u8" });
    const validator = createValidator();

    const result = validator.resolveForMemberAccess("LED");
    expect(result).toBe("LED"); // Returns scope name, not transformed
    expect(result).not.toBe("Motor_LED"); // Should NOT be scope-prefixed
  });

  it("returns scope name when it exists", () => {
    const validator = createValidator();
    const result = validator.resolveForMemberAccess("LED");
    expect(result).toBe("LED");
  });

  it("returns null for unknown identifiers", () => {
    const validator = createValidator();
    const result = validator.resolveForMemberAccess("Unknown");
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/codegen/__tests__/TypeValidator.resolution.test.ts`
Expected: FAIL - `resolveForMemberAccess` doesn't exist

**Step 3: Implement resolveForMemberAccess**

Add to `src/codegen/TypeValidator.ts`:

```typescript
/**
 * Resolve an identifier that appears before a '.' (member access).
 * Prioritizes scope names for Scope.member() calls.
 *
 * Returns the resolved name or null if not a scope.
 */
resolveForMemberAccess(identifier: string): string | null {
  // For member access, check if it's a scope name first
  if (this.symbols!.knownScopes.has(identifier)) {
    return identifier;
  }
  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/codegen/__tests__/TypeValidator.resolution.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/codegen/TypeValidator.ts src/codegen/__tests__/TypeValidator.resolution.test.ts
git commit -m "feat: add resolveForMemberAccess for context-aware resolution

When identifier precedes '.', prefer scope name over variable.
LED.on() resolves LED as scope, not global variable.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Update CodeGenerator to Use Resolution

**Files:**

- Modify: `src/codegen/CodeGenerator.ts:8604-8691`

**Step 1: Write the failing integration test**

Create `tests/scope-resolution/bare-scope-member.test.cnx`:

```cnx
// Test bare identifier resolves to scope member
// test-execution

scope Counter {
    u32 value <- 0;

    public void increment() {
        value +<- 1;  // Should resolve to this.value
    }

    public u32 getValue() {
        return value;  // Should resolve to this.value
    }
}

u32 main() {
    Counter.increment();
    Counter.increment();
    if (Counter.getValue() != 2) return 1;
    return 0;
}
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/scope-resolution/bare-scope-member.test.cnx`
Expected: FAIL with error "Use 'this.value' to access scope member"

**Step 3: Update generatePrimaryExpr in CodeGenerator.ts**

Replace the `validateBareIdentifierInScope` call with resolution logic at line ~8655:

```typescript
// Check if it's a local variable (tracked in type registry with no underscore prefix)
// Local variables are those that were declared inside the current function
const isLocalVariable = this.context.localVariables.has(id);

// ADR-016: Resolve bare identifier using local → scope → global priority
const resolved = this.typeValidator!.resolveBareIdentifier(
  id,
  isLocalVariable,
  (name: string) => this.isKnownStruct(name),
);

// If resolved to a different name, use it
if (resolved !== null) {
  return resolved;
}

// Not resolved - continue with existing enum member logic...
```

Also update the second occurrence around line ~7147 in the same way.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/scope-resolution/bare-scope-member.test.cnx`
Expected: PASS (or needs snapshot update)

**Step 5: Generate expected output and commit**

```bash
npm test -- tests/scope-resolution/bare-scope-member.test.cnx --update
git add src/codegen/CodeGenerator.ts tests/scope-resolution/
git commit -m "feat: use implicit resolution for bare identifiers in scopes

Bare identifiers now resolve using local → scope → global priority.
'value' inside Counter scope becomes Counter_value automatically.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Handle Cross-Scope Access Without global. Prefix

**Files:**

- Modify: `src/codegen/CodeGenerator.ts` (postfix handling)
- Test: `tests/scope-resolution/cross-scope-access.test.cnx`

**Step 1: Write the failing test**

Create `tests/scope-resolution/cross-scope-access.test.cnx`:

```cnx
// Test cross-scope access without global. prefix
// test-execution

scope LED {
    u8 brightness <- 100;

    public void setBrightness(u8 level) {
        brightness <- level;
    }

    public u8 getBrightness() {
        return brightness;
    }
}

scope Motor {
    public void adjustLED() {
        // Should work without global. prefix
        LED.setBrightness(50);
    }
}

u32 main() {
    Motor.adjustLED();
    if (LED.getBrightness() != 50) return 1;
    return 0;
}
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/scope-resolution/cross-scope-access.test.cnx`
Expected: FAIL with error "Use 'global.LED.setBrightness'"

**Step 3: Update postfix handling in CodeGenerator**

In the postfix chain handling (around line 8287-8296), modify the scope access validation:

Find the code that throws "Use 'global.X.Y' to access scope" and change it to allow bare scope names when followed by member access:

```typescript
// Check if identifier is a known scope name (for Scope.member access)
if (this.symbols!.knownScopes.has(result)) {
  // Allow bare scope name - it will be handled in member access
  // No error, just continue processing
} else if (this.context.currentScope) {
  // Only error if we're inside a scope and trying to access something unknown
  // that isn't being resolved through the normal path
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/scope-resolution/cross-scope-access.test.cnx`
Expected: PASS

**Step 5: Commit**

```bash
npm test -- tests/scope-resolution/cross-scope-access.test.cnx --update
git add src/codegen/CodeGenerator.ts tests/scope-resolution/
git commit -m "feat: allow cross-scope access without global. prefix

LED.setBrightness() works inside Motor scope without requiring
global.LED.setBrightness().

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Test Local Shadows Scope with this. Access

**Files:**

- Test: `tests/scope-resolution/local-shadows-scope.test.cnx`

**Step 1: Write the test**

Create `tests/scope-resolution/local-shadows-scope.test.cnx`:

```cnx
// Test local variable shadows scope member, this. accesses scope
// test-execution

scope State {
    u32 value <- 100;

    public u32 shadowTest() {
        u32 value <- 5;       // Local shadows scope
        this.value <- value;   // Assign local to scope via this.
        return this.value;
    }
}

u32 main() {
    if (State.shadowTest() != 5) return 1;
    return 0;
}
```

**Step 2: Run test**

Run: `npm test -- tests/scope-resolution/local-shadows-scope.test.cnx`
Expected: Should PASS (this. handling already works)

**Step 3: Generate expected output and commit**

```bash
npm test -- tests/scope-resolution/local-shadows-scope.test.cnx --update
git add tests/scope-resolution/
git commit -m "test: verify local shadows scope with this. access

Local variable 'value' shadows scope member. this.value
correctly accesses the scope-level variable.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Test Bare Function Calls Within Scope

**Files:**

- Test: `tests/scope-resolution/bare-function-call.test.cnx`

**Step 1: Write the test**

Create `tests/scope-resolution/bare-function-call.test.cnx`:

```cnx
// Test bare function names call scope functions
// test-execution

scope Calculator {
    u32 result <- 0;

    void reset() {
        result <- 0;
    }

    void addTen() {
        result +<- 10;
    }

    public void compute() {
        reset();      // Bare call to scope function
        addTen();     // Bare call to scope function
        addTen();
    }

    public u32 getResult() {
        return result;
    }
}

u32 main() {
    Calculator.compute();
    if (Calculator.getResult() != 20) return 1;
    return 0;
}
```

**Step 2: Run test**

Run: `npm test -- tests/scope-resolution/bare-function-call.test.cnx`
Expected: Should PASS if function resolution is working

**Step 3: Generate expected output and commit**

```bash
npm test -- tests/scope-resolution/bare-function-call.test.cnx --update
git add tests/scope-resolution/
git commit -m "test: verify bare function calls resolve to scope functions

reset() and addTen() inside Calculator scope resolve to
Calculator_reset() and Calculator_addTen().

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Test All Three Levels with Explicit Access

**Files:**

- Test: `tests/scope-resolution/shadowing-all-levels.test.cnx`

**Step 1: Write the test**

Create `tests/scope-resolution/shadowing-all-levels.test.cnx`:

```cnx
// Test accessing local, scope, and global when all have same name
// test-execution

u32 count <- 1000;  // Global

scope Counter {
    u32 count <- 100;  // Scope

    public u32 testAllLevels() {
        u32 count <- 10;           // Local
        u32 sum <- 0;

        sum +<- count;             // Local (10)
        sum +<- this.count;        // Scope (100)
        sum +<- global.count;      // Global (1000)

        return sum;
    }
}

u32 main() {
    if (Counter.testAllLevels() != 1110) return 1;
    return 0;
}
```

**Step 2: Run test**

Run: `npm test -- tests/scope-resolution/shadowing-all-levels.test.cnx`
Expected: PASS

**Step 3: Commit**

```bash
npm test -- tests/scope-resolution/shadowing-all-levels.test.cnx --update
git add tests/scope-resolution/
git commit -m "test: verify all three resolution levels with explicit access

Local 'count' shadows scope, which shadows global.
this.count and global.count provide explicit access.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Update Existing Error Tests

**Files:**

- Modify: `tests/scope/bare-identifier-error.test.cnx` → convert to success test
- Modify: `tests/scope/bare-global-error.test.cnx` → convert or keep as edge case

**Step 1: Update bare-identifier-error test**

The old test expected an error for `return localValue;` inside a scope. Now this should work.

Move to `tests/scope-resolution/` and update:

```cnx
// Test that bare identifiers resolve to scope members (was error test)
// test-execution

const u8 globalValue <- 10;

scope Motor {
    const u8 localValue <- 5;

    public u8 getLocalValue() {
        return localValue;  // Now resolves to Motor_localValue
    }
}

u32 main() {
    if (Motor.getLocalValue() != 5) return 1;
    return 0;
}
```

**Step 2: Delete old error test and create new success test**

```bash
rm tests/scope/bare-identifier-error.test.cnx tests/scope/bare-identifier-error.expected.error
```

**Step 3: Run and commit**

```bash
npm test -- tests/scope-resolution/ --update
git add tests/scope/ tests/scope-resolution/
git commit -m "test: update bare identifier tests for implicit resolution

Old error tests now succeed with implicit resolution.
Bare identifiers resolve to scope members automatically.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Edge Case - Global Var Same Name as Scope

**Files:**

- Test: `tests/scope-resolution/edge-cases/global-var-same-as-scope.test.cnx`

**Step 1: Write the test**

Create directory and test:

```cnx
// Test global variable with same name as scope
// Both can coexist - scope becomes prefix, variable stays as-is
// test-execution

u8 LED <- 5;  // Global variable

scope LED {
    public u8 brightness <- 100;

    public void on() {
        brightness <- 255;
    }
}

scope Motor {
    public u32 test() {
        u8 val <- global.LED;    // Access global variable (5)
        LED.on();                 // Access scope function
        return val + LED.brightness;  // 5 + 255 = 260
    }
}

u32 main() {
    if (Motor.test() != 260) return 1;
    return 0;
}
```

**Step 2: Run and commit**

```bash
mkdir -p tests/scope-resolution/edge-cases
npm test -- tests/scope-resolution/edge-cases/global-var-same-as-scope.test.cnx --update
git add tests/scope-resolution/
git commit -m "test: global var can have same name as scope

LED variable (u8) and LED scope coexist. Access via
global.LED vs LED.member() distinguishes them.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Run Full Test Suite and Fix Regressions

**Step 1: Run all tests**

```bash
npm test
```

**Step 2: Identify and fix any failures**

Some existing tests may rely on the old error behavior. Update them to:

- Either test the new success behavior
- Or update expected errors for truly invalid cases

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: update tests for implicit scope resolution

Existing tests updated to work with new resolution behavior.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Create ADR Document

**Files:**

- Create: `docs/decisions/adr-057-implicit-scope-resolution.md`

**Step 1: Write ADR**

```markdown
# ADR-057: Implicit Scope Resolution

## Status

Implemented

## Context

C-Next required explicit `this.` and `global.` prefixes for all scope and global variable access inside scopes. This was verbose and unfamiliar to developers coming from C.

## Decision

Implement implicit variable resolution with priority: local → scope → global.

- Bare identifiers resolve automatically
- `this.` forces scope-level access
- `global.` forces global-level access
- Member access (`X.member`) prefers scope names over variables

## Consequences

### Positive

- More natural syntax matching C developer expectations
- Less verbose code
- Backward compatible - explicit prefixes still work

### Negative

- Silent shadowing may cause subtle bugs (mitigated by allowing explicit access)
- Slightly more complex resolution logic
```

**Step 2: Commit**

```bash
git add docs/decisions/adr-057-implicit-scope-resolution.md
git commit -m "docs: add ADR-057 for implicit scope resolution

Documents the local → scope → global resolution priority.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Update Documentation

**Files:**

- Modify: `docs/learn-cnext-in-y-minutes.md`
- Modify: `README.md` (if ADR list needs updating)

**Step 1: Update learn-cnext-in-y-minutes.md**

Add section on variable resolution in scopes:

````markdown
### Variable Resolution in Scopes

Inside a scope, bare identifiers resolve using priority: local → scope → global.

```cnx
u32 globalCount <- 1000;

scope Counter {
    u32 count <- 0;

    void increment() {
        count +<- 1;           // Resolves to this.count (scope level)
    }

    void reset() {
        u32 count <- 0;        // Local variable shadows scope
        this.count <- count;   // Explicit this. accesses scope
    }

    void readGlobal() {
        u32 g <- globalCount;  // Resolves to global
        u32 g2 <- global.globalCount;  // Explicit global.
    }
}
```
````

Cross-scope access works without `global.` prefix:

```cnx
scope LED {
    public void on() { }
}

scope Motor {
    void start() {
        LED.on();  // Works! No global. needed
    }
}
```

````

**Step 2: Commit**

```bash
git add docs/learn-cnext-in-y-minutes.md README.md
git commit -m "docs: document implicit scope resolution

Updated learn-cnext-in-y-minutes with variable resolution rules
and cross-scope access examples.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
````

---

## Summary

After completing all tasks:

1. Run `npm test` to verify all tests pass
2. Run `npm run test:all` to include unit tests
3. Create PR with `gh pr create`
