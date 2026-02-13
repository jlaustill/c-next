# Symbol Type Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate all symbol types into `src/transpiler/types/symbols/` with `IBaseSymbol` as base interface and proper `TSymbolKindCNext` typing.

**Architecture:** All symbol interfaces extend `IBaseSymbol` which has `kind: TSymbolKindCNext`. Each concrete interface narrows `kind` to its literal type. Types use `TType` instead of strings. `SymbolGuards` static class replaces `typeGuards.ts` functions.

**Tech Stack:** TypeScript, Vitest for unit tests, ts-morph MCP tools for safe refactoring.

**Design Doc:** `docs/plans/2026-02-13-ttype-symbol-refactoring-design.md`

---

## Phase 2: Create Symbol Types Directory

### Task 2.1: Create IBaseSymbol

**Files:**

- Create: `src/transpiler/types/symbols/IBaseSymbol.ts`
- Test: `src/transpiler/types/symbols/__tests__/IBaseSymbol.test.ts`

**Step 1: Create the directory**

```bash
mkdir -p src/transpiler/types/symbols/__tests__
```

**Step 2: Write the failing test**

```typescript
// src/transpiler/types/symbols/__tests__/IBaseSymbol.test.ts
import { describe, it, expect } from "vitest";
import type IBaseSymbol from "../IBaseSymbol";
import type TSymbolKindCNext from "../../symbol-kinds/TSymbolKindCNext";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";

describe("IBaseSymbol", () => {
  it("accepts valid symbol with TSymbolKindCNext kind", () => {
    // Create a mock scope for circular reference
    const mockScope = {} as IBaseSymbol & { kind: "scope" };
    mockScope.scope = mockScope; // self-reference for global scope

    const symbol: IBaseSymbol = {
      kind: "function" as TSymbolKindCNext,
      name: "testFunc",
      scope: mockScope as any,
      sourceFile: "test.cnx",
      sourceLine: 10,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
    };

    expect(symbol.kind).toBe("function");
    expect(symbol.name).toBe("testFunc");
    expect(symbol.sourceLanguage).toBe(ESourceLanguage.CNext);
  });

  it("kind field accepts all TSymbolKindCNext values", () => {
    const validKinds: TSymbolKindCNext[] = [
      "function",
      "variable",
      "struct",
      "enum",
      "enum_member",
      "bitmap",
      "bitmap_field",
      "register",
      "register_member",
      "scope",
    ];

    // Type check - if this compiles, the types are correct
    validKinds.forEach((kind) => {
      const partial: Pick<IBaseSymbol, "kind"> = { kind };
      expect(partial.kind).toBe(kind);
    });
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npm run unit -- src/transpiler/types/symbols/__tests__/IBaseSymbol.test.ts`
Expected: FAIL with "Cannot find module '../IBaseSymbol'"

**Step 4: Write the implementation**

```typescript
// src/transpiler/types/symbols/IBaseSymbol.ts
import type TSymbolKindCNext from "../symbol-kinds/TSymbolKindCNext";
import type ESourceLanguage from "../../../utils/types/ESourceLanguage";

/**
 * Base interface for all symbol types.
 * All concrete symbol interfaces extend this with a narrowed `kind` literal.
 */
interface IBaseSymbol {
  /** Symbol kind - discriminator for type narrowing */
  readonly kind: TSymbolKindCNext;

  /** Symbol name */
  readonly name: string;

  /** Scope this symbol belongs to (circular reference resolved at runtime) */
  readonly scope: IBaseSymbol;

  /** Source file where the symbol is defined */
  readonly sourceFile: string;

  /** Line number in the source file */
  readonly sourceLine: number;

  /** Source language (CNext, C, Cpp) */
  readonly sourceLanguage: ESourceLanguage;

  /** Whether this symbol is exported/public */
  readonly isExported: boolean;
}

export default IBaseSymbol;
```

**Step 5: Run test to verify it passes**

Run: `npm run unit -- src/transpiler/types/symbols/__tests__/IBaseSymbol.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/transpiler/types/symbols/
git commit -m "feat(symbols): add IBaseSymbol with TSymbolKindCNext kind"
```

---

### Task 2.2: Create IBitmapFieldInfo and IRegisterMemberInfo

**Files:**

- Create: `src/transpiler/types/symbols/IBitmapFieldInfo.ts`
- Create: `src/transpiler/types/symbols/IRegisterMemberInfo.ts`

**Step 1: Write IBitmapFieldInfo**

```typescript
// src/transpiler/types/symbols/IBitmapFieldInfo.ts
/**
 * Metadata for a bitmap field.
 * Bitmaps define named bit regions within a backing integer type.
 */
interface IBitmapFieldInfo {
  /** Bit offset from LSB */
  readonly bitOffset: number;

  /** Width in bits */
  readonly bitWidth: number;
}

export default IBitmapFieldInfo;
```

**Step 2: Write IRegisterMemberInfo**

```typescript
// src/transpiler/types/symbols/IRegisterMemberInfo.ts
import type TType from "../TType";

/**
 * Metadata for a register member.
 * Registers map memory-mapped I/O with typed access patterns.
 */
interface IRegisterMemberInfo {
  /** Offset from base address */
  readonly offset: number;

  /** Type of the register */
  readonly type: TType;

  /** Whether this register is read-only */
  readonly isReadOnly: boolean;
}

export default IRegisterMemberInfo;
```

**Step 3: Commit**

```bash
git add src/transpiler/types/symbols/IBitmapFieldInfo.ts src/transpiler/types/symbols/IRegisterMemberInfo.ts
git commit -m "feat(symbols): add IBitmapFieldInfo and IRegisterMemberInfo"
```

---

### Task 2.3: Create IFieldInfo and IParameterInfo

**Files:**

- Create: `src/transpiler/types/symbols/IFieldInfo.ts`
- Create: `src/transpiler/types/symbols/IParameterInfo.ts`

**Step 1: Write IFieldInfo**

```typescript
// src/transpiler/types/symbols/IFieldInfo.ts
import type TType from "../TType";

/**
 * Metadata for a struct field.
 */
interface IFieldInfo {
  /** Field name */
  readonly name: string;

  /** Field type */
  readonly type: TType;

  /** Whether this field is const */
  readonly isConst: boolean;

  /** Whether this field is atomic (volatile in C) */
  readonly isAtomic: boolean;

  /** Array dimensions if this field is an array */
  readonly arrayDimensions?: ReadonlyArray<number | string>;
}

export default IFieldInfo;
```

**Step 2: Write IParameterInfo**

```typescript
// src/transpiler/types/symbols/IParameterInfo.ts
import type TType from "../TType";

/**
 * Metadata for a function parameter.
 */
interface IParameterInfo {
  /** Parameter name */
  readonly name: string;

  /** Parameter type */
  readonly type: TType;

  /** Whether this parameter is const */
  readonly isConst: boolean;

  /** Array dimensions if this parameter is an array */
  readonly arrayDimensions?: ReadonlyArray<number | string>;
}

export default IParameterInfo;
```

**Step 3: Commit**

```bash
git add src/transpiler/types/symbols/IFieldInfo.ts src/transpiler/types/symbols/IParameterInfo.ts
git commit -m "feat(symbols): add IFieldInfo and IParameterInfo with TType"
```

---

### Task 2.4: Create IScopeSymbol

**Files:**

- Create: `src/transpiler/types/symbols/IScopeSymbol.ts`

**Step 1: Write IScopeSymbol**

```typescript
// src/transpiler/types/symbols/IScopeSymbol.ts
import type IBaseSymbol from "./IBaseSymbol";
import type TVisibility from "../TVisibility";

/**
 * Symbol representing a scope (namespace) definition.
 * Scopes group related functions and variables.
 *
 * Note: IScopeSymbol has circular references with IFunctionSymbol.
 * Functions have a scope, scopes contain functions.
 */
interface IScopeSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "scope" */
  readonly kind: "scope";

  /** Functions in this scope (forward declaration to avoid circular import) */
  readonly functions: ReadonlyArray<IBaseSymbol>;

  /** Variables in this scope */
  readonly variables: ReadonlyArray<unknown>;

  /** Visibility of each member */
  readonly memberVisibility: ReadonlyMap<string, TVisibility>;
}

export default IScopeSymbol;
```

**Step 2: Commit**

```bash
git add src/transpiler/types/symbols/IScopeSymbol.ts
git commit -m "feat(symbols): add IScopeSymbol extending IBaseSymbol"
```

---

### Task 2.5: Create IFunctionSymbol

**Files:**

- Create: `src/transpiler/types/symbols/IFunctionSymbol.ts`

**Step 1: Write IFunctionSymbol**

```typescript
// src/transpiler/types/symbols/IFunctionSymbol.ts
import type IBaseSymbol from "./IBaseSymbol";
import type IParameterInfo from "./IParameterInfo";
import type TType from "../TType";
import type TVisibility from "../TVisibility";

/**
 * Symbol representing a function definition.
 */
interface IFunctionSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "function" */
  readonly kind: "function";

  /** Function parameters */
  readonly parameters: ReadonlyArray<IParameterInfo>;

  /** Return type */
  readonly returnType: TType;

  /** Visibility within scope */
  readonly visibility: TVisibility;

  /** AST reference for function body (unknown to avoid parser dependency) */
  readonly body: unknown;
}

export default IFunctionSymbol;
```

**Step 2: Commit**

```bash
git add src/transpiler/types/symbols/IFunctionSymbol.ts
git commit -m "feat(symbols): add IFunctionSymbol extending IBaseSymbol"
```

---

### Task 2.6: Create Remaining Symbol Interfaces

**Files:**

- Create: `src/transpiler/types/symbols/IStructSymbol.ts`
- Create: `src/transpiler/types/symbols/IEnumSymbol.ts`
- Create: `src/transpiler/types/symbols/IVariableSymbol.ts`
- Create: `src/transpiler/types/symbols/IBitmapSymbol.ts`
- Create: `src/transpiler/types/symbols/IRegisterSymbol.ts`

**Step 1: Write IStructSymbol**

```typescript
// src/transpiler/types/symbols/IStructSymbol.ts
import type IBaseSymbol from "./IBaseSymbol";
import type IFieldInfo from "./IFieldInfo";

/**
 * Symbol representing a struct type definition.
 */
interface IStructSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "struct" */
  readonly kind: "struct";

  /** Map of field name to field metadata */
  readonly fields: ReadonlyMap<string, IFieldInfo>;
}

export default IStructSymbol;
```

**Step 2: Write IEnumSymbol**

```typescript
// src/transpiler/types/symbols/IEnumSymbol.ts
import type IBaseSymbol from "./IBaseSymbol";

/**
 * Symbol representing an enum type definition.
 */
interface IEnumSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "enum" */
  readonly kind: "enum";

  /** Map of member name to numeric value */
  readonly members: ReadonlyMap<string, number>;

  /** Optional explicit bit width (e.g., 8 for u8 backing type) */
  readonly bitWidth?: number;
}

export default IEnumSymbol;
```

**Step 3: Write IVariableSymbol**

```typescript
// src/transpiler/types/symbols/IVariableSymbol.ts
import type IBaseSymbol from "./IBaseSymbol";
import type TType from "../TType";

/**
 * Symbol representing a variable (global, static, or extern).
 */
interface IVariableSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "variable" */
  readonly kind: "variable";

  /** Variable type */
  readonly type: TType;

  /** Whether this variable is const */
  readonly isConst: boolean;

  /** Whether this variable is atomic (volatile in C) */
  readonly isAtomic: boolean;

  /** Initial value expression (as string) */
  readonly initialValue?: string;
}

export default IVariableSymbol;
```

**Step 4: Write IBitmapSymbol**

```typescript
// src/transpiler/types/symbols/IBitmapSymbol.ts
import type IBaseSymbol from "./IBaseSymbol";
import type IBitmapFieldInfo from "./IBitmapFieldInfo";

/**
 * Symbol representing a bitmap type definition.
 */
interface IBitmapSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "bitmap" */
  readonly kind: "bitmap";

  /** Total bit width of the bitmap */
  readonly bitWidth: number;

  /** Map of field name to bit offset/width metadata */
  readonly fields: ReadonlyMap<string, IBitmapFieldInfo>;
}

export default IBitmapSymbol;
```

**Step 5: Write IRegisterSymbol**

```typescript
// src/transpiler/types/symbols/IRegisterSymbol.ts
import type IBaseSymbol from "./IBaseSymbol";
import type IRegisterMemberInfo from "./IRegisterMemberInfo";

/**
 * Symbol representing a register block definition.
 */
interface IRegisterSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "register" */
  readonly kind: "register";

  /** Base address expression (as string, e.g., "0x40000000") */
  readonly baseAddress: string;

  /** Map of member name to register member metadata */
  readonly members: ReadonlyMap<string, IRegisterMemberInfo>;
}

export default IRegisterSymbol;
```

**Step 6: Commit**

```bash
git add src/transpiler/types/symbols/IStructSymbol.ts src/transpiler/types/symbols/IEnumSymbol.ts src/transpiler/types/symbols/IVariableSymbol.ts src/transpiler/types/symbols/IBitmapSymbol.ts src/transpiler/types/symbols/IRegisterSymbol.ts
git commit -m "feat(symbols): add IStructSymbol, IEnumSymbol, IVariableSymbol, IBitmapSymbol, IRegisterSymbol"
```

---

### Task 2.7: Create TSymbol Discriminated Union

**Files:**

- Create: `src/transpiler/types/symbols/TSymbol.ts`

**Step 1: Write TSymbol**

````typescript
// src/transpiler/types/symbols/TSymbol.ts
import type IFunctionSymbol from "./IFunctionSymbol";
import type IScopeSymbol from "./IScopeSymbol";
import type IStructSymbol from "./IStructSymbol";
import type IEnumSymbol from "./IEnumSymbol";
import type IVariableSymbol from "./IVariableSymbol";
import type IBitmapSymbol from "./IBitmapSymbol";
import type IRegisterSymbol from "./IRegisterSymbol";

/**
 * Discriminated union of all symbol types.
 *
 * Use the `kind` field to narrow to a specific symbol type:
 * ```typescript
 * if (symbol.kind === "struct") {
 *   // TypeScript knows symbol is IStructSymbol here
 * }
 * ```
 */
type TSymbol =
  | IFunctionSymbol
  | IScopeSymbol
  | IStructSymbol
  | IEnumSymbol
  | IVariableSymbol
  | IBitmapSymbol
  | IRegisterSymbol;

export default TSymbol;
````

**Step 2: Commit**

```bash
git add src/transpiler/types/symbols/TSymbol.ts
git commit -m "feat(symbols): add TSymbol discriminated union"
```

---

### Task 2.8: Create SymbolGuards Static Class

**Files:**

- Create: `src/transpiler/types/symbols/SymbolGuards.ts`
- Test: `src/transpiler/types/symbols/__tests__/SymbolGuards.test.ts`

**Step 1: Write the failing test**

```typescript
// src/transpiler/types/symbols/__tests__/SymbolGuards.test.ts
import { describe, it, expect } from "vitest";
import SymbolGuards from "../SymbolGuards";
import type TSymbol from "../TSymbol";
import type IFunctionSymbol from "../IFunctionSymbol";
import type IStructSymbol from "../IStructSymbol";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";

describe("SymbolGuards", () => {
  // Helper to create a minimal mock symbol
  const createMockSymbol = (kind: string): TSymbol => {
    const mockScope = { kind: "scope" } as any;
    mockScope.scope = mockScope;

    return {
      kind,
      name: "test",
      scope: mockScope,
      sourceFile: "test.cnx",
      sourceLine: 1,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
    } as TSymbol;
  };

  it("isFunction returns true for function symbols", () => {
    const funcSymbol = {
      ...createMockSymbol("function"),
      parameters: [],
      returnType: { kind: "primitive", primitive: "void" },
      visibility: "public",
      body: null,
    } as IFunctionSymbol;

    expect(SymbolGuards.isFunction(funcSymbol)).toBe(true);
    expect(SymbolGuards.isStruct(funcSymbol)).toBe(false);
  });

  it("isStruct returns true for struct symbols", () => {
    const structSymbol = {
      ...createMockSymbol("struct"),
      fields: new Map(),
    } as IStructSymbol;

    expect(SymbolGuards.isStruct(structSymbol)).toBe(true);
    expect(SymbolGuards.isFunction(structSymbol)).toBe(false);
  });

  it("all guards return false for non-matching kinds", () => {
    const funcSymbol = createMockSymbol("function") as TSymbol;

    expect(SymbolGuards.isScope(funcSymbol)).toBe(false);
    expect(SymbolGuards.isEnum(funcSymbol)).toBe(false);
    expect(SymbolGuards.isVariable(funcSymbol)).toBe(false);
    expect(SymbolGuards.isBitmap(funcSymbol)).toBe(false);
    expect(SymbolGuards.isRegister(funcSymbol)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/transpiler/types/symbols/__tests__/SymbolGuards.test.ts`
Expected: FAIL with "Cannot find module '../SymbolGuards'"

**Step 3: Write the implementation**

```typescript
// src/transpiler/types/symbols/SymbolGuards.ts
import type TSymbol from "./TSymbol";
import type IFunctionSymbol from "./IFunctionSymbol";
import type IScopeSymbol from "./IScopeSymbol";
import type IStructSymbol from "./IStructSymbol";
import type IEnumSymbol from "./IEnumSymbol";
import type IVariableSymbol from "./IVariableSymbol";
import type IBitmapSymbol from "./IBitmapSymbol";
import type IRegisterSymbol from "./IRegisterSymbol";

/**
 * Type guard functions for TSymbol discriminated union.
 */
class SymbolGuards {
  static isFunction(symbol: TSymbol): symbol is IFunctionSymbol {
    return symbol.kind === "function";
  }

  static isScope(symbol: TSymbol): symbol is IScopeSymbol {
    return symbol.kind === "scope";
  }

  static isStruct(symbol: TSymbol): symbol is IStructSymbol {
    return symbol.kind === "struct";
  }

  static isEnum(symbol: TSymbol): symbol is IEnumSymbol {
    return symbol.kind === "enum";
  }

  static isVariable(symbol: TSymbol): symbol is IVariableSymbol {
    return symbol.kind === "variable";
  }

  static isBitmap(symbol: TSymbol): symbol is IBitmapSymbol {
    return symbol.kind === "bitmap";
  }

  static isRegister(symbol: TSymbol): symbol is IRegisterSymbol {
    return symbol.kind === "register";
  }
}

export default SymbolGuards;
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/transpiler/types/symbols/__tests__/SymbolGuards.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/transpiler/types/symbols/SymbolGuards.ts src/transpiler/types/symbols/__tests__/SymbolGuards.test.ts
git commit -m "feat(symbols): add SymbolGuards static class with type guards"
```

---

## Phase 3: Update All Imports

### Task 3.1: Identify All Import Locations

**Step 1: Find all imports from old locations**

Run these grep commands to identify files needing updates:

```bash
# Old location imports
grep -r "from.*logic/symbols/types" src/ --include="*.ts" | grep -v __tests__ | cut -d: -f1 | sort -u

# Duplicate type imports
grep -r "from.*transpiler/types/IFunctionSymbol" src/ --include="*.ts" | cut -d: -f1 | sort -u
grep -r "from.*transpiler/types/IScopeSymbol" src/ --include="*.ts" | cut -d: -f1 | sort -u
grep -r "from.*transpiler/types/IParameterInfo" src/ --include="*.ts" | cut -d: -f1 | sort -u
```

**Step 2: Document the files to update**

Create a checklist of files that need import updates. Group by directory.

---

### Task 3.2: Update Imports in logic/symbols/cnext/

**Files to modify:**

- `src/transpiler/logic/symbols/cnext/adapters/TSymbolAdapter.ts`
- `src/transpiler/logic/symbols/cnext/adapters/TSymbolInfoAdapter.ts`
- `src/transpiler/logic/symbols/cnext/collectors/FunctionCollector.ts`

**Step 1: Update TSymbolAdapter.ts imports**

Change:

```typescript
import IFunctionSymbol from "../../types/IFunctionSymbol";
```

To:

```typescript
import type IFunctionSymbol from "../../../../types/symbols/IFunctionSymbol";
```

**Step 2: Update all other imports similarly**

Use the ts-morph MCP tool for safe refactoring:

```bash
# Use mcp__ts-morph__rename_filesystem_entry_by_tsmorph if available
# Otherwise update manually
```

**Step 3: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No type errors in updated files

**Step 4: Commit**

```bash
git add src/transpiler/logic/symbols/cnext/
git commit -m "refactor(symbols): update imports in logic/symbols/cnext to use types/symbols"
```

---

### Task 3.3: Update Imports in transpiler/state/

**Files to modify:**

- `src/transpiler/state/SymbolRegistry.ts`

**Step 1: Update imports**

Change imports from old locations to new `types/symbols/` location.

**Step 2: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/transpiler/state/
git commit -m "refactor(symbols): update imports in state/ to use types/symbols"
```

---

### Task 3.4: Update Imports in transpiler/output/

**Files to modify:**

- `src/transpiler/output/codegen/utils/QualifiedNameGenerator.ts`
- Any other files importing old symbol types

**Step 1: Update imports**

**Step 2: Run TypeScript to verify**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/transpiler/output/
git commit -m "refactor(symbols): update imports in output/ to use types/symbols"
```

---

### Task 3.5: Update Remaining Imports

**Files to modify:**

- `src/transpiler/types/FunctionUtils.ts`
- `src/transpiler/types/ScopeUtils.ts`
- Any test files

**Step 1: Update each file's imports**

**Step 2: Run full test suite**

Run: `npm run unit`
Expected: All tests pass

**Step 3: Commit**

```bash
git add .
git commit -m "refactor(symbols): update all remaining imports to use types/symbols"
```

---

## Phase 4: Delete Old Types

### Task 4.1: Delete Duplicate Types in transpiler/types/

**Files to delete:**

- `src/transpiler/types/IFunctionSymbol.ts`
- `src/transpiler/types/IScopeSymbol.ts`
- `src/transpiler/types/IParameterInfo.ts`
- `src/transpiler/types/FunctionSymbolAdapter.ts`
- `src/transpiler/types/FunctionUtils.ts` (if only used for old types)
- `src/transpiler/types/ScopeUtils.ts` (if only used for old types)

**Step 1: Verify no remaining imports**

```bash
grep -r "from.*transpiler/types/IFunctionSymbol" src/ --include="*.ts"
grep -r "from.*transpiler/types/IScopeSymbol" src/ --include="*.ts"
```

Expected: No matches

**Step 2: Delete the files**

```bash
rm src/transpiler/types/IFunctionSymbol.ts
rm src/transpiler/types/IScopeSymbol.ts
rm src/transpiler/types/IParameterInfo.ts
rm src/transpiler/types/FunctionSymbolAdapter.ts
```

**Step 3: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor(symbols): delete duplicate symbol types from transpiler/types"
```

---

### Task 4.2: Delete Old Types in logic/symbols/types/

**Files to delete:**

- `src/transpiler/logic/symbols/types/IBaseSymbol.ts`
- `src/transpiler/logic/symbols/types/IFunctionSymbol.ts`
- `src/transpiler/logic/symbols/types/IScopeSymbol.ts`
- `src/transpiler/logic/symbols/types/IStructSymbol.ts`
- `src/transpiler/logic/symbols/types/IEnumSymbol.ts`
- `src/transpiler/logic/symbols/types/IVariableSymbol.ts`
- `src/transpiler/logic/symbols/types/IBitmapSymbol.ts`
- `src/transpiler/logic/symbols/types/IRegisterSymbol.ts`
- `src/transpiler/logic/symbols/types/TSymbol.ts`
- `src/transpiler/logic/symbols/types/typeGuards.ts`
- `src/transpiler/logic/symbols/types/IParameterInfo.ts`
- `src/transpiler/logic/symbols/types/IFieldInfo.ts`
- `src/transpiler/logic/symbols/types/IBitmapFieldInfo.ts`
- `src/transpiler/logic/symbols/types/IRegisterMemberInfo.ts`
- `src/transpiler/logic/symbols/types/ICollectorContext.ts` (if not needed)
- `src/transpiler/logic/symbols/types/IConflict.ts` (if not needed)
- `src/transpiler/logic/symbols/types/IStructFieldInfo.ts` (if duplicate)

**Step 1: Verify no remaining imports**

```bash
grep -r "from.*logic/symbols/types" src/ --include="*.ts"
```

Expected: No matches (or only test files that will be updated)

**Step 2: Delete the directory**

```bash
rm -rf src/transpiler/logic/symbols/types/
```

**Step 3: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Run full test suite**

Run: `npm test && npm run unit`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(symbols): delete old symbol types from logic/symbols/types"
```

---

## Phase 4.5: Final Verification

### Task 4.3: Run Full Test Suite

**Step 1: Run all tests**

```bash
npm run test:all
```

Expected: All integration and unit tests pass

**Step 2: Run linting**

```bash
npm run oxlint:check
npm run prettier:fix
```

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: fix linting issues after symbol consolidation"
```

---

## Summary

After completing all tasks:

1. ✅ All symbol types live in `src/transpiler/types/symbols/`
2. ✅ All symbols extend `IBaseSymbol` with `kind: TSymbolKindCNext`
3. ✅ `SymbolGuards` static class replaces `typeGuards.ts`
4. ✅ Old duplicate types deleted
5. ✅ All tests pass
