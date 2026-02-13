# TType and Symbol Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish TType as the foundational type system and IFunctionSymbol as the single source of truth for function definitions, eliminating string-based type representations.

**Architecture:** Types (`TType`) and symbols (`IFunctionSymbol`, `IScopeSymbol`) live in `src/transpiler/types/`. A central `SymbolRegistry` manages symbol storage and lookup. Mutation analysis is computed on-demand by traversing the symbol graph. Qualified names (e.g., `Test_fillData`) are generated only in the output layer.

**Tech Stack:** TypeScript, Vitest for unit tests, existing C-Next integration test suite.

**Design Doc:** `docs/plans/2026-02-13-ttype-symbol-refactoring-design.md`

---

## Phase 1: Create TType Foundation

### Task 1.1: Create TPrimitiveKind Type

**Files:**

- Create: `src/transpiler/types/TPrimitiveKind.ts`
- Test: `src/transpiler/types/__tests__/TPrimitiveKind.test.ts`

**Step 1: Write the failing test**

```typescript
// src/transpiler/types/__tests__/TPrimitiveKind.test.ts
import { describe, it, expect } from "vitest";
import TPrimitiveKind, { PRIMITIVE_BIT_WIDTHS } from "../TPrimitiveKind";

describe("TPrimitiveKind", () => {
  it("includes all C-Next primitive types", () => {
    const primitives: TPrimitiveKind[] = [
      "void",
      "bool",
      "u8",
      "i8",
      "u16",
      "i16",
      "u32",
      "i32",
      "u64",
      "i64",
      "f32",
      "f64",
    ];
    // Type check passes if all are valid TPrimitiveKind
    expect(primitives).toHaveLength(12);
  });

  it("provides bit widths for numeric primitives", () => {
    expect(PRIMITIVE_BIT_WIDTHS.get("u8")).toBe(8);
    expect(PRIMITIVE_BIT_WIDTHS.get("i32")).toBe(32);
    expect(PRIMITIVE_BIT_WIDTHS.get("f64")).toBe(64);
    expect(PRIMITIVE_BIT_WIDTHS.get("bool")).toBe(1);
    expect(PRIMITIVE_BIT_WIDTHS.get("void")).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/transpiler/types/__tests__/TPrimitiveKind.test.ts`
Expected: FAIL with "Cannot find module '../TPrimitiveKind'"

**Step 3: Write minimal implementation**

```typescript
// src/transpiler/types/TPrimitiveKind.ts
type TPrimitiveKind =
  | "void"
  | "bool"
  | "u8"
  | "i8"
  | "u16"
  | "i16"
  | "u32"
  | "i32"
  | "u64"
  | "i64"
  | "f32"
  | "f64";

const PRIMITIVE_BIT_WIDTHS: ReadonlyMap<TPrimitiveKind, number> = new Map([
  ["bool", 1],
  ["u8", 8],
  ["i8", 8],
  ["u16", 16],
  ["i16", 16],
  ["u32", 32],
  ["i32", 32],
  ["u64", 64],
  ["i64", 64],
  ["f32", 32],
  ["f64", 64],
]);

export { PRIMITIVE_BIT_WIDTHS };
export default TPrimitiveKind;
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/transpiler/types/__tests__/TPrimitiveKind.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/transpiler/types/TPrimitiveKind.ts src/transpiler/types/__tests__/TPrimitiveKind.test.ts
git commit -m "feat: add TPrimitiveKind type for C-Next primitive types"
```

---

### Task 1.2: Create TType Discriminated Union

**Files:**

- Create: `src/transpiler/types/TType.ts`
- Test: `src/transpiler/types/__tests__/TType.test.ts`

**Step 1: Write the failing test**

```typescript
// src/transpiler/types/__tests__/TType.test.ts
import { describe, it, expect } from "vitest";
import TType, {
  createPrimitiveType,
  createArrayType,
  createStringType,
  createExternalType,
  isPrimitiveType,
  isArrayType,
} from "../TType";

describe("TType", () => {
  describe("createPrimitiveType", () => {
    it("creates a primitive type", () => {
      const t = createPrimitiveType("u32");
      expect(t.kind).toBe("primitive");
      expect(t.primitive).toBe("u32");
    });
  });

  describe("createArrayType", () => {
    it("creates an array type with dimensions", () => {
      const elem = createPrimitiveType("u8");
      const t = createArrayType(elem, [10, 20]);
      expect(t.kind).toBe("array");
      expect(t.elementType).toBe(elem);
      expect(t.dimensions).toEqual([10, 20]);
    });
  });

  describe("createStringType", () => {
    it("creates a string type with capacity", () => {
      const t = createStringType(32);
      expect(t.kind).toBe("string");
      expect(t.capacity).toBe(32);
    });
  });

  describe("createExternalType", () => {
    it("creates an external C++ type", () => {
      const t = createExternalType("FlexCAN_T4<CAN1>");
      expect(t.kind).toBe("external");
      expect(t.name).toBe("FlexCAN_T4<CAN1>");
    });
  });

  describe("type guards", () => {
    it("isPrimitiveType returns true for primitives", () => {
      const t = createPrimitiveType("i64");
      expect(isPrimitiveType(t)).toBe(true);
    });

    it("isArrayType returns true for arrays", () => {
      const t = createArrayType(createPrimitiveType("u8"), [5]);
      expect(isArrayType(t)).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/transpiler/types/__tests__/TType.test.ts`
Expected: FAIL with "Cannot find module '../TType'"

**Step 3: Write minimal implementation**

```typescript
// src/transpiler/types/TType.ts
import TPrimitiveKind from "./TPrimitiveKind";

// Forward declarations for symbol types (will be properly imported in Phase 2)
// These are placeholder interfaces to allow TType to compile before full symbol refactor
interface IStructSymbolRef {
  kind: "struct";
  name: string;
}
interface IEnumSymbolRef {
  kind: "enum";
  name: string;
}
interface IBitmapSymbolRef {
  kind: "bitmap";
  name: string;
}
interface IRegisterSymbolRef {
  kind: "register";
  name: string;
}
interface ICallbackSignatureRef {
  kind: "callback";
  paramTypes: TType[];
  returnType: TType;
}

type TType =
  | { kind: "primitive"; primitive: TPrimitiveKind }
  | { kind: "struct"; symbol: IStructSymbolRef }
  | { kind: "enum"; symbol: IEnumSymbolRef }
  | { kind: "bitmap"; symbol: IBitmapSymbolRef }
  | { kind: "array"; elementType: TType; dimensions: (number | string)[] }
  | { kind: "string"; capacity: number }
  | { kind: "callback"; signature: ICallbackSignatureRef }
  | { kind: "register"; symbol: IRegisterSymbolRef }
  | { kind: "external"; name: string };

// Factory functions
function createPrimitiveType(primitive: TPrimitiveKind): TType {
  return { kind: "primitive", primitive };
}

function createArrayType(
  elementType: TType,
  dimensions: (number | string)[],
): TType {
  return { kind: "array", elementType, dimensions };
}

function createStringType(capacity: number): TType {
  return { kind: "string", capacity };
}

function createExternalType(name: string): TType {
  return { kind: "external", name };
}

// Type guards
function isPrimitiveType(
  t: TType,
): t is { kind: "primitive"; primitive: TPrimitiveKind } {
  return t.kind === "primitive";
}

function isArrayType(
  t: TType,
): t is { kind: "array"; elementType: TType; dimensions: (number | string)[] } {
  return t.kind === "array";
}

function isStructType(
  t: TType,
): t is { kind: "struct"; symbol: IStructSymbolRef } {
  return t.kind === "struct";
}

function isEnumType(t: TType): t is { kind: "enum"; symbol: IEnumSymbolRef } {
  return t.kind === "enum";
}

function isStringType(t: TType): t is { kind: "string"; capacity: number } {
  return t.kind === "string";
}

export {
  createPrimitiveType,
  createArrayType,
  createStringType,
  createExternalType,
  isPrimitiveType,
  isArrayType,
  isStructType,
  isEnumType,
  isStringType,
};

export default TType;
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/transpiler/types/__tests__/TType.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/transpiler/types/TType.ts src/transpiler/types/__tests__/TType.test.ts
git commit -m "feat: add TType discriminated union for C-Next type system"
```

---

### Task 1.3: Run Full Test Suite and Create PR

**Step 1: Run integration tests**

Run: `npm test`
Expected: All 951+ tests pass (TType is additive, no breaking changes)

**Step 2: Run unit tests**

Run: `npm run unit`
Expected: All tests pass

**Step 3: Commit and push**

```bash
git push -u origin <branch-name>
```

**Step 4: Create PR**

```bash
gh pr create --title "feat: Phase 1 - Add TType foundation for type system refactor" --body "$(cat <<'EOF'
## Summary
- Adds `TPrimitiveKind` type for C-Next primitive types
- Adds `TType` discriminated union as foundation for proper type representation
- Includes factory functions and type guards
- Part of #797 architectural improvement

## Test plan
- [x] Unit tests for TPrimitiveKind
- [x] Unit tests for TType factory functions and guards
- [x] All integration tests pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Phase 2: Refactor Symbol Types

### Task 2.1: Create New IScopeSymbol

**Files:**

- Create: `src/transpiler/types/IScopeSymbol.ts`
- Test: `src/transpiler/types/__tests__/IScopeSymbol.test.ts`

**Step 1: Write the failing test**

```typescript
// src/transpiler/types/__tests__/IScopeSymbol.test.ts
import { describe, it, expect } from "vitest";
import IScopeSymbol, { createGlobalScope, createScope } from "../IScopeSymbol";

describe("IScopeSymbol", () => {
  describe("createGlobalScope", () => {
    it("creates global scope with self-reference parent", () => {
      const global = createGlobalScope();
      expect(global.kind).toBe("scope");
      expect(global.name).toBe("");
      expect(global.parent).toBe(global); // Self-reference
      expect(global.functions).toEqual([]);
      expect(global.variables).toEqual([]);
    });
  });

  describe("createScope", () => {
    it("creates named scope with parent reference", () => {
      const global = createGlobalScope();
      const test = createScope("Test", global);
      expect(test.kind).toBe("scope");
      expect(test.name).toBe("Test");
      expect(test.parent).toBe(global);
    });

    it("supports nested scopes", () => {
      const global = createGlobalScope();
      const outer = createScope("Outer", global);
      const inner = createScope("Inner", outer);
      expect(inner.parent).toBe(outer);
      expect(outer.parent).toBe(global);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/transpiler/types/__tests__/IScopeSymbol.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/transpiler/types/IScopeSymbol.ts

// Forward declarations - will be replaced with proper imports in later tasks
interface IFunctionSymbolRef {
  kind: "function";
  name: string;
}
interface IVariableSymbolRef {
  kind: "variable";
  name: string;
}

interface IScopeSymbol {
  kind: "scope";
  name: string; // "" for global scope
  parent: IScopeSymbol; // Global scope's parent is itself
  functions: IFunctionSymbolRef[];
  variables: IVariableSymbolRef[];
}

function createGlobalScope(): IScopeSymbol {
  const global: IScopeSymbol = {
    kind: "scope",
    name: "",
    parent: null as unknown as IScopeSymbol, // Temporary, set below
    functions: [],
    variables: [],
  };
  global.parent = global; // Self-reference for global scope
  return global;
}

function createScope(name: string, parent: IScopeSymbol): IScopeSymbol {
  return {
    kind: "scope",
    name,
    parent,
    functions: [],
    variables: [],
  };
}

export { createGlobalScope, createScope };
export default IScopeSymbol;
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/transpiler/types/__tests__/IScopeSymbol.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/transpiler/types/IScopeSymbol.ts src/transpiler/types/__tests__/IScopeSymbol.test.ts
git commit -m "feat: add IScopeSymbol with global scope and nesting support"
```

---

### Task 2.2: Create New IParameterInfo Using TType

**Files:**

- Create: `src/transpiler/types/IParameterInfo.ts`
- Test: `src/transpiler/types/__tests__/IParameterInfo.test.ts`

**Step 1: Write the failing test**

```typescript
// src/transpiler/types/__tests__/IParameterInfo.test.ts
import { describe, it, expect } from "vitest";
import IParameterInfo, { createParameterInfo } from "../IParameterInfo";
import { createPrimitiveType } from "../TType";

describe("IParameterInfo", () => {
  it("creates parameter with TType", () => {
    const param = createParameterInfo(
      "count",
      createPrimitiveType("u32"),
      false,
    );
    expect(param.name).toBe("count");
    expect(param.type.kind).toBe("primitive");
    expect(param.isConst).toBe(false);
  });

  it("creates const parameter", () => {
    const param = createParameterInfo(
      "config",
      createPrimitiveType("u8"),
      true,
    );
    expect(param.isConst).toBe(true);
  });

  it("supports array dimensions", () => {
    const param = createParameterInfo(
      "buffer",
      createPrimitiveType("u8"),
      false,
      [64],
    );
    expect(param.arrayDimensions).toEqual([64]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/transpiler/types/__tests__/IParameterInfo.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/transpiler/types/IParameterInfo.ts
import TType from "./TType";

interface IParameterInfo {
  name: string;
  type: TType;
  isConst: boolean;
  arrayDimensions?: (number | string)[];
}

function createParameterInfo(
  name: string,
  type: TType,
  isConst: boolean,
  arrayDimensions?: (number | string)[],
): IParameterInfo {
  const param: IParameterInfo = { name, type, isConst };
  if (arrayDimensions) {
    param.arrayDimensions = arrayDimensions;
  }
  return param;
}

export { createParameterInfo };
export default IParameterInfo;
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/transpiler/types/__tests__/IParameterInfo.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/transpiler/types/IParameterInfo.ts src/transpiler/types/__tests__/IParameterInfo.test.ts
git commit -m "feat: add IParameterInfo using TType instead of string"
```

---

### Task 2.3: Create New IFunctionSymbol Using TType and IScopeSymbol

**Files:**

- Create: `src/transpiler/types/IFunctionSymbol.ts`
- Test: `src/transpiler/types/__tests__/IFunctionSymbol.test.ts`

**Step 1: Write the failing test**

```typescript
// src/transpiler/types/__tests__/IFunctionSymbol.test.ts
import { describe, it, expect } from "vitest";
import IFunctionSymbol, { createFunctionSymbol } from "../IFunctionSymbol";
import { createGlobalScope, createScope } from "../IScopeSymbol";
import { createParameterInfo } from "../IParameterInfo";
import { createPrimitiveType } from "../TType";

describe("IFunctionSymbol", () => {
  it("creates function with bare name and scope reference", () => {
    const global = createGlobalScope();
    const testScope = createScope("Test", global);

    const func = createFunctionSymbol({
      name: "fillData", // Bare name, NOT "Test_fillData"
      scope: testScope,
      parameters: [createParameterInfo("d", createPrimitiveType("u32"), false)],
      returnType: createPrimitiveType("void"),
      visibility: "private",
      body: null, // AST reference, null in tests
      sourceFile: "test.cnx",
      sourceLine: 10,
    });

    expect(func.kind).toBe("function");
    expect(func.name).toBe("fillData");
    expect(func.scope).toBe(testScope);
    expect(func.parameters).toHaveLength(1);
    expect(func.returnType.kind).toBe("primitive");
    expect(func.visibility).toBe("private");
  });

  it("creates public function in global scope", () => {
    const global = createGlobalScope();

    const func = createFunctionSymbol({
      name: "main",
      scope: global,
      parameters: [],
      returnType: createPrimitiveType("i32"),
      visibility: "public",
      body: null,
      sourceFile: "main.cnx",
      sourceLine: 1,
    });

    expect(func.scope).toBe(global);
    expect(func.visibility).toBe("public");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/transpiler/types/__tests__/IFunctionSymbol.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/transpiler/types/IFunctionSymbol.ts
import TType from "./TType";
import IParameterInfo from "./IParameterInfo";
import IScopeSymbol from "./IScopeSymbol";

// AST context type - using any for now to avoid parser dependency in types layer
// Will be properly typed when integrating with symbol collection
type FunctionBodyContext = unknown;

interface IFunctionSymbol {
  kind: "function";
  name: string; // Bare name: "fillData", NOT "Test_fillData"
  scope: IScopeSymbol;
  parameters: IParameterInfo[];
  returnType: TType;
  visibility: "public" | "private";
  body: FunctionBodyContext; // AST reference for mutation analysis
  sourceFile: string;
  sourceLine: number;
}

interface IFunctionSymbolInit {
  name: string;
  scope: IScopeSymbol;
  parameters: IParameterInfo[];
  returnType: TType;
  visibility: "public" | "private";
  body: FunctionBodyContext;
  sourceFile: string;
  sourceLine: number;
}

function createFunctionSymbol(init: IFunctionSymbolInit): IFunctionSymbol {
  return {
    kind: "function",
    ...init,
  };
}

export { createFunctionSymbol };
export type { FunctionBodyContext };
export default IFunctionSymbol;
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/transpiler/types/__tests__/IFunctionSymbol.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/transpiler/types/IFunctionSymbol.ts src/transpiler/types/__tests__/IFunctionSymbol.test.ts
git commit -m "feat: add IFunctionSymbol with bare name and scope reference"
```

---

### Task 2.4: Run Full Test Suite and Create PR for Phase 2

**Step 1: Run all tests**

Run: `npm run test:all`
Expected: All tests pass

**Step 2: Push and create PR**

```bash
git push -u origin <branch-name>
gh pr create --title "feat: Phase 2 - Add new symbol types using TType" --body "$(cat <<'EOF'
## Summary
- Adds `IScopeSymbol` with global scope and nesting support
- Adds `IParameterInfo` using `TType` instead of string
- Adds `IFunctionSymbol` with bare name and scope reference
- Part of #797 architectural improvement

## Test plan
- [x] Unit tests for all new types
- [x] All integration tests pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Phase 3: Create SymbolRegistry

### Task 3.1: Create SymbolRegistry Class

**Files:**

- Create: `src/transpiler/state/SymbolRegistry.ts`
- Test: `src/transpiler/state/__tests__/SymbolRegistry.test.ts`

**Step 1: Write the failing test**

```typescript
// src/transpiler/state/__tests__/SymbolRegistry.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import SymbolRegistry from "../SymbolRegistry";
import { createFunctionSymbol } from "../../types/IFunctionSymbol";
import { createPrimitiveType } from "../../types/TType";

describe("SymbolRegistry", () => {
  beforeEach(() => {
    SymbolRegistry.reset();
  });

  describe("getGlobalScope", () => {
    it("returns the global scope singleton", () => {
      const global = SymbolRegistry.getGlobalScope();
      expect(global.kind).toBe("scope");
      expect(global.name).toBe("");
      expect(global.parent).toBe(global);
    });

    it("returns same instance on multiple calls", () => {
      const g1 = SymbolRegistry.getGlobalScope();
      const g2 = SymbolRegistry.getGlobalScope();
      expect(g1).toBe(g2);
    });
  });

  describe("getOrCreateScope", () => {
    it("creates scope with global parent for simple name", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      expect(scope.name).toBe("Test");
      expect(scope.parent).toBe(SymbolRegistry.getGlobalScope());
    });

    it("returns same scope for same path", () => {
      const s1 = SymbolRegistry.getOrCreateScope("Test");
      const s2 = SymbolRegistry.getOrCreateScope("Test");
      expect(s1).toBe(s2);
    });

    it("creates nested scopes for dotted path", () => {
      const inner = SymbolRegistry.getOrCreateScope("Outer.Inner");
      expect(inner.name).toBe("Inner");
      expect(inner.parent.name).toBe("Outer");
      expect(inner.parent.parent).toBe(SymbolRegistry.getGlobalScope());
    });
  });

  describe("registerFunction", () => {
    it("adds function to its scope", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      const func = createFunctionSymbol({
        name: "fillData",
        scope,
        parameters: [],
        returnType: createPrimitiveType("void"),
        visibility: "private",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 1,
      });
      SymbolRegistry.registerFunction(func);

      expect(scope.functions).toContain(func);
    });
  });

  describe("resolveFunction", () => {
    it("finds function in current scope", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      const func = createFunctionSymbol({
        name: "fillData",
        scope,
        parameters: [],
        returnType: createPrimitiveType("void"),
        visibility: "private",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 1,
      });
      SymbolRegistry.registerFunction(func);

      const found = SymbolRegistry.resolveFunction("fillData", scope);
      expect(found).toBe(func);
    });

    it("finds function in parent scope", () => {
      const global = SymbolRegistry.getGlobalScope();
      const func = createFunctionSymbol({
        name: "helper",
        scope: global,
        parameters: [],
        returnType: createPrimitiveType("void"),
        visibility: "public",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 1,
      });
      SymbolRegistry.registerFunction(func);

      const childScope = SymbolRegistry.getOrCreateScope("Test");
      const found = SymbolRegistry.resolveFunction("helper", childScope);
      expect(found).toBe(func);
    });

    it("returns null for unknown function", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      const found = SymbolRegistry.resolveFunction("unknown", scope);
      expect(found).toBeNull();
    });
  });

  describe("reset", () => {
    it("clears all registered symbols", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      const func = createFunctionSymbol({
        name: "foo",
        scope,
        parameters: [],
        returnType: createPrimitiveType("void"),
        visibility: "private",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 1,
      });
      SymbolRegistry.registerFunction(func);

      SymbolRegistry.reset();

      // Global scope should be fresh
      const newGlobal = SymbolRegistry.getGlobalScope();
      expect(newGlobal.functions).toHaveLength(0);

      // Scope "Test" should not exist anymore
      const found = SymbolRegistry.resolveFunction("foo", newGlobal);
      expect(found).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/transpiler/state/__tests__/SymbolRegistry.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/transpiler/state/SymbolRegistry.ts
import IScopeSymbol, {
  createGlobalScope,
  createScope,
} from "../types/IScopeSymbol";
import IFunctionSymbol from "../types/IFunctionSymbol";

class SymbolRegistry {
  private static globalScope: IScopeSymbol = createGlobalScope();
  private static scopes: Map<string, IScopeSymbol> = new Map();

  static getGlobalScope(): IScopeSymbol {
    return this.globalScope;
  }

  static getOrCreateScope(path: string): IScopeSymbol {
    if (path === "") return this.globalScope;
    if (this.scopes.has(path)) return this.scopes.get(path)!;

    const parts = path.split(".");
    const name = parts.pop()!;
    const parentPath = parts.join(".");
    const parent =
      parentPath === "" ? this.globalScope : this.getOrCreateScope(parentPath);

    const scope = createScope(name, parent);
    this.scopes.set(path, scope);
    return scope;
  }

  static registerFunction(func: IFunctionSymbol): void {
    func.scope.functions.push(func);
  }

  static resolveFunction(
    name: string,
    fromScope: IScopeSymbol,
  ): IFunctionSymbol | null {
    // Check current scope
    const found = fromScope.functions.find((f) => f.name === name);
    if (found) return found;

    // Check parent scope (unless we're at global)
    if (fromScope !== this.globalScope && fromScope.parent !== fromScope) {
      return this.resolveFunction(name, fromScope.parent);
    }

    return null;
  }

  static reset(): void {
    this.globalScope = createGlobalScope();
    this.scopes.clear();
  }
}

export default SymbolRegistry;
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/transpiler/state/__tests__/SymbolRegistry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/transpiler/state/SymbolRegistry.ts src/transpiler/state/__tests__/SymbolRegistry.test.ts
git commit -m "feat: add SymbolRegistry for centralized symbol management"
```

---

### Task 3.2: Run Full Test Suite and Create PR for Phase 3

**Step 1: Run all tests**

Run: `npm run test:all`
Expected: All tests pass

**Step 2: Push and create PR**

```bash
git push -u origin <branch-name>
gh pr create --title "feat: Phase 3 - Add SymbolRegistry for symbol management" --body "$(cat <<'EOF'
## Summary
- Adds `SymbolRegistry` class for centralized symbol storage
- Supports scope creation, merging, and function resolution
- Scope chain lookup for bare name → function resolution
- Part of #797 architectural improvement

## Test plan
- [x] Unit tests for SymbolRegistry
- [x] All integration tests pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Phase 4: Create QualifiedNameGenerator

### Task 4.1: Create QualifiedNameGenerator

**Files:**

- Create: `src/transpiler/output/codegen/utils/QualifiedNameGenerator.ts`
- Test: `src/transpiler/output/codegen/utils/__tests__/QualifiedNameGenerator.test.ts`

**Step 1: Write the failing test**

```typescript
// src/transpiler/output/codegen/utils/__tests__/QualifiedNameGenerator.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import QualifiedNameGenerator from "../QualifiedNameGenerator";
import SymbolRegistry from "../../../../state/SymbolRegistry";
import { createFunctionSymbol } from "../../../../types/IFunctionSymbol";
import { createPrimitiveType } from "../../../../types/TType";

describe("QualifiedNameGenerator", () => {
  beforeEach(() => {
    SymbolRegistry.reset();
  });

  describe("forFunction", () => {
    it("returns bare name for global scope function", () => {
      const global = SymbolRegistry.getGlobalScope();
      const func = createFunctionSymbol({
        name: "main",
        scope: global,
        parameters: [],
        returnType: createPrimitiveType("i32"),
        visibility: "public",
        body: null,
        sourceFile: "main.cnx",
        sourceLine: 1,
      });

      expect(QualifiedNameGenerator.forFunction(func)).toBe("main");
    });

    it("returns Scope_name for scoped function", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      const func = createFunctionSymbol({
        name: "fillData",
        scope,
        parameters: [],
        returnType: createPrimitiveType("void"),
        visibility: "private",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 1,
      });

      expect(QualifiedNameGenerator.forFunction(func)).toBe("Test_fillData");
    });

    it("returns Outer_Inner_name for nested scope function", () => {
      const scope = SymbolRegistry.getOrCreateScope("Outer.Inner");
      const func = createFunctionSymbol({
        name: "deepFunc",
        scope,
        parameters: [],
        returnType: createPrimitiveType("void"),
        visibility: "private",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 1,
      });

      expect(QualifiedNameGenerator.forFunction(func)).toBe(
        "Outer_Inner_deepFunc",
      );
    });
  });

  describe("getScopePath", () => {
    it("returns empty array for global scope", () => {
      const global = SymbolRegistry.getGlobalScope();
      expect(QualifiedNameGenerator.getScopePath(global)).toEqual([]);
    });

    it("returns single element for direct child of global", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      expect(QualifiedNameGenerator.getScopePath(scope)).toEqual(["Test"]);
    });

    it("returns full path for nested scope", () => {
      const scope = SymbolRegistry.getOrCreateScope("A.B.C");
      expect(QualifiedNameGenerator.getScopePath(scope)).toEqual([
        "A",
        "B",
        "C",
      ]);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/transpiler/output/codegen/utils/__tests__/QualifiedNameGenerator.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/transpiler/output/codegen/utils/QualifiedNameGenerator.ts
import IFunctionSymbol from "../../../types/IFunctionSymbol";
import IScopeSymbol from "../../../types/IScopeSymbol";

class QualifiedNameGenerator {
  static forFunction(func: IFunctionSymbol): string {
    const scopePath = this.getScopePath(func.scope);
    if (scopePath.length === 0) return func.name;
    return [...scopePath, func.name].join("_");
  }

  static getScopePath(scope: IScopeSymbol): string[] {
    // Global scope: name is "" and parent is self
    if (scope.name === "" || scope.parent === scope) return [];
    return [...this.getScopePath(scope.parent), scope.name];
  }
}

export default QualifiedNameGenerator;
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/transpiler/output/codegen/utils/__tests__/QualifiedNameGenerator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/transpiler/output/codegen/utils/QualifiedNameGenerator.ts src/transpiler/output/codegen/utils/__tests__/QualifiedNameGenerator.test.ts
git commit -m "feat: add QualifiedNameGenerator for C-style name generation"
```

---

## Phase 5: Integration (COMPLETED)

Phase 5 integrates the new types into the existing codebase.

### Task 5.1: Add Bridge Methods to SymbolRegistry (COMPLETED)

Added methods to allow gradual migration from string-based lookups:

```typescript
// SymbolRegistry.ts - new methods
static findByMangledName(mangledName: string): IFunctionSymbol | null
static getScopeByMangledFunctionName(mangledName: string): IScopeSymbol | null
```

### Task 5.2: Update PassByValueAnalyzer (COMPLETED)

Updated `resolveCalleeNameInScope()` to use SymbolRegistry bridge methods:

- Try SymbolRegistry.getScopeByMangledFunctionName() first
- Fall back to legacy string parsing if not found

### Task 5.3: Update Output Layer to Use QualifiedNameGenerator (COMPLETED)

Added helper methods to QualifiedNameGenerator for string-based inputs:

```typescript
// QualifiedNameGenerator.ts - new methods
static forFunctionStrings(scopeName: string | undefined, funcName: string): string
static forMember(scopeName: string | undefined, memberName: string): string
```

Updated all output layer files to use QualifiedNameGenerator:

| File                       | Occurrences Updated |
| -------------------------- | ------------------- |
| CodeGenerator.ts           | 4                   |
| ScopeGenerator.ts          | 5                   |
| ScopedRegisterGenerator.ts | 2                   |
| AssignmentClassifier.ts    | 1                   |
| BitmapHandlers.ts          | 2                   |
| RegisterHandlers.ts        | 1                   |
| AssignmentHandlerUtils.ts  | 1                   |
| EnumTypeResolver.ts        | 1                   |

---

## Phase 6: Deprecate Legacy Maps (TODO - Future Work)

> **Status:** Deferred for future implementation. The current architecture works correctly with the hybrid approach.

### Background

The legacy maps `functionParamLists` and `modifiedParameters` in `CodeGenState` are deeply integrated into:

- `PassByValueAnalyzer` - tracks which parameters are modified
- `TransitiveModificationPropagator` - propagates modifications across call chains
- `CodeGenerator` - uses modification info for auto-const inference

### Task 6.1: Store Parameter Modification on IFunctionSymbol

**Goal:** Move parameter modification tracking from Maps to IFunctionSymbol.

**Files to modify:**

- `src/transpiler/types/IFunctionSymbol.ts` - Add `modifiedParameters: Set<string>` field
- `src/transpiler/state/SymbolRegistry.ts` - Add method to update function's modified params

**Approach:**

1. Add `modifiedParameters?: Set<string>` to IFunctionSymbol
2. Update PassByValueAnalyzer to write to IFunctionSymbol instead of Map
3. Update TransitiveModificationPropagator to work with IFunctionSymbol
4. Update CodeGenerator consumers to read from IFunctionSymbol

### Task 6.2: Migrate PassByValueAnalyzer

**Files:**

- `src/transpiler/logic/analysis/PassByValueAnalyzer.ts`
- `src/transpiler/logic/analysis/helpers/TransitiveModificationPropagator.ts`

**Steps:**

1. Update `registerFunction()` to store params on IFunctionSymbol
2. Update `trackModification()` to update IFunctionSymbol.modifiedParameters
3. Update `propagate()` to traverse IFunctionSymbol graph
4. Remove dependency on CodeGenState.functionParamLists/modifiedParameters

### Task 6.3: Remove Legacy Maps

After all consumers are migrated:

1. Remove `CodeGenState.functionParamLists`
2. Remove `CodeGenState.modifiedParameters`
3. Update tests that mock these Maps

### Estimated Scope

- ~20 files to modify
- ~500 lines of code changes
- Requires careful migration with integration tests at each step

---

## Summary

| Phase | Tasks   | Status      | Key Deliverables                              |
| ----- | ------- | ----------- | --------------------------------------------- |
| 1     | 1.1-1.3 | ✅ Done     | TPrimitiveKind, TType, TTypeUtils             |
| 2     | 2.1-2.4 | ✅ Done     | IScopeSymbol, IParameterInfo, IFunctionSymbol |
| 3     | 3.1-3.2 | ✅ Done     | SymbolRegistry                                |
| 4     | 4.1     | ✅ Done     | QualifiedNameGenerator                        |
| 5     | 5.1-5.3 | ✅ Done     | Bridge methods, output layer migration        |
| 6     | 6.1-6.3 | ⏸️ Deferred | Deprecate legacy Maps                         |

**Files created:** 14 (7 implementation + 7 test files)
**Files modified:** 10+ (output layer using QualifiedNameGenerator)

Phases 1-5 are complete. Phase 6 is deferred as the hybrid approach works correctly and the full migration requires significant refactoring of the pass-by-value analysis system.
