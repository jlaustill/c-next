# TSymbolKind Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `ESymbolKind` enum with language-specific string union types for better type safety and zero runtime overhead.

**Architecture:** Create four type files in `src/transpiler/types/symbol-kinds/` - one per language (C-Next, C, C++) plus a union type. Update all 71 files that import `ESymbolKind` to use string literals instead. Delete the enum.

**Tech Stack:** TypeScript, string literal union types

---

## Task 1: Create TSymbolKind Type Files

**Files:**
- Create: `src/transpiler/types/symbol-kinds/TSymbolKindCNext.ts`
- Create: `src/transpiler/types/symbol-kinds/TSymbolKindC.ts`
- Create: `src/transpiler/types/symbol-kinds/TSymbolKindCpp.ts`
- Create: `src/transpiler/types/symbol-kinds/TSymbolKind.ts`

**Step 1: Create directory**

Run: `mkdir -p src/transpiler/types/symbol-kinds`

**Step 2: Create TSymbolKindCNext.ts**

```typescript
/**
 * Symbol kinds for C-Next language constructs.
 */
type TSymbolKindCNext =
  | "function"
  | "variable"
  | "struct"
  | "enum"
  | "enum_member"
  | "bitmap"
  | "bitmap_field"
  | "register"
  | "register_member"
  | "scope";

export default TSymbolKindCNext;
```

**Step 3: Create TSymbolKindC.ts**

```typescript
/**
 * Symbol kinds for C language constructs.
 */
type TSymbolKindC =
  | "function"
  | "variable"
  | "struct"
  | "enum"
  | "enum_member"
  | "type";

export default TSymbolKindC;
```

**Step 4: Create TSymbolKindCpp.ts**

```typescript
/**
 * Symbol kinds for C++ language constructs.
 */
type TSymbolKindCpp =
  | "function"
  | "variable"
  | "struct"
  | "enum"
  | "enum_member"
  | "class"
  | "namespace"
  | "type";

export default TSymbolKindCpp;
```

**Step 5: Create TSymbolKind.ts**

```typescript
import TSymbolKindCNext from "./TSymbolKindCNext";
import TSymbolKindC from "./TSymbolKindC";
import TSymbolKindCpp from "./TSymbolKindCpp";

/**
 * Union of all symbol kinds across supported languages.
 */
type TSymbolKind = TSymbolKindCNext | TSymbolKindC | TSymbolKindCpp;

export default TSymbolKind;
```

**Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/transpiler/types/symbol-kinds/TSymbolKind.ts`
Expected: No errors

**Step 7: Commit**

```bash
git add src/transpiler/types/symbol-kinds/
git commit -m "feat: add TSymbolKind string union types"
```

---

## Task 2: Update Symbol Interface Definitions

**Files:**
- Modify: `src/transpiler/logic/symbols/types/IFunctionSymbol.ts`
- Modify: `src/transpiler/logic/symbols/types/IVariableSymbol.ts`
- Modify: `src/transpiler/logic/symbols/types/IStructSymbol.ts`
- Modify: `src/transpiler/logic/symbols/types/IEnumSymbol.ts`
- Modify: `src/transpiler/logic/symbols/types/IBitmapSymbol.ts`
- Modify: `src/transpiler/logic/symbols/types/IRegisterSymbol.ts`
- Modify: `src/transpiler/logic/symbols/types/IScopeSymbol.ts`

**Step 1: Update IFunctionSymbol.ts**

Remove import, change `kind: ESymbolKind.Function` to `kind: "function"`:

```typescript
import IBaseSymbol from "./IBaseSymbol";
import IParameterInfo from "./IParameterInfo";

/**
 * Symbol representing a function definition or declaration.
 */
interface IFunctionSymbol extends IBaseSymbol {
  /** Discriminant for type narrowing */
  kind: "function";

  /** Return type (e.g., "void", "u32", "Point") */
  returnType: string;

  /** Function parameters */
  parameters: IParameterInfo[];

  /** Visibility within a scope */
  visibility: "public" | "private";

  /** Full signature for overload detection (e.g., "void foo(int, float)") */
  signature?: string;
}

export default IFunctionSymbol;
```

**Step 2: Update IVariableSymbol.ts**

Remove import, change `kind: ESymbolKind.Variable` to `kind: "variable"`.

**Step 3: Update IStructSymbol.ts**

Remove import, change `kind: ESymbolKind.Struct` to `kind: "struct"`.

**Step 4: Update IEnumSymbol.ts**

Remove import, change `kind: ESymbolKind.Enum` to `kind: "enum"`.

**Step 5: Update IBitmapSymbol.ts**

Remove import, change `kind: ESymbolKind.Bitmap` to `kind: "bitmap"`.

**Step 6: Update IRegisterSymbol.ts**

Remove import, change `kind: ESymbolKind.Register` to `kind: "register"`.

**Step 7: Update IScopeSymbol.ts**

Remove import, change `kind: ESymbolKind.Namespace` to `kind: "scope"` (C-Next scopes, not C++ namespaces).

**Step 8: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Errors in files still using ESymbolKind (expected at this stage)

**Step 9: Commit**

```bash
git add src/transpiler/logic/symbols/types/
git commit -m "refactor: update symbol interfaces to use string literal kinds"
```

---

## Task 3: Update ISymbol and Type Guards

**Files:**
- Modify: `src/utils/types/ISymbol.ts`
- Modify: `src/transpiler/logic/symbols/types/typeGuards.ts`

**Step 1: Update ISymbol.ts**

Replace `ESymbolKind` import with `TSymbolKind`:

```typescript
import TSymbolKind from "../../transpiler/types/symbol-kinds/TSymbolKind";
import ESourceLanguage from "./ESourceLanguage";
import IParameterSymbol from "./IParameterSymbol";

/**
 * Represents a symbol collected from a source file
 */
interface ISymbol {
  /** Symbol name (e.g., "LED_toggle", "GPIO7", "uint32_t") */
  name: string;

  /** Kind of symbol */
  kind: TSymbolKind;

  // ... rest unchanged
}
```

**Step 2: Update typeGuards.ts**

Remove import, use string literals for comparisons:

```typescript
import IBitmapSymbol from "./IBitmapSymbol";
import IEnumSymbol from "./IEnumSymbol";
import IFunctionSymbol from "./IFunctionSymbol";
import IRegisterSymbol from "./IRegisterSymbol";
import IScopeSymbol from "./IScopeSymbol";
import IStructSymbol from "./IStructSymbol";
import IVariableSymbol from "./IVariableSymbol";
import TSymbol from "./TSymbol";

/**
 * Type guards for narrowing TSymbol to specific symbol types.
 */
class SymbolGuards {
  static isStruct(symbol: TSymbol): symbol is IStructSymbol {
    return symbol.kind === "struct";
  }

  static isEnum(symbol: TSymbol): symbol is IEnumSymbol {
    return symbol.kind === "enum";
  }

  static isBitmap(symbol: TSymbol): symbol is IBitmapSymbol {
    return symbol.kind === "bitmap";
  }

  static isFunction(symbol: TSymbol): symbol is IFunctionSymbol {
    return symbol.kind === "function";
  }

  static isVariable(symbol: TSymbol): symbol is IVariableSymbol {
    return symbol.kind === "variable";
  }

  static isScope(symbol: TSymbol): symbol is IScopeSymbol {
    return symbol.kind === "scope";
  }

  static isRegister(symbol: TSymbol): symbol is IRegisterSymbol {
    return symbol.kind === "register";
  }
}

export default SymbolGuards;
```

**Step 3: Commit**

```bash
git add src/utils/types/ISymbol.ts src/transpiler/logic/symbols/types/typeGuards.ts
git commit -m "refactor: update ISymbol and type guards to use string literals"
```

---

## Task 4: Update C-Next Symbol Collectors

These files create C-Next symbols - all use `"scope"` for scopes.

**Files:**
- Modify: `src/transpiler/logic/symbols/cnext/collectors/FunctionCollector.ts`
- Modify: `src/transpiler/logic/symbols/cnext/collectors/VariableCollector.ts`
- Modify: `src/transpiler/logic/symbols/cnext/collectors/StructCollector.ts`
- Modify: `src/transpiler/logic/symbols/cnext/collectors/EnumCollector.ts`
- Modify: `src/transpiler/logic/symbols/cnext/collectors/BitmapCollector.ts`
- Modify: `src/transpiler/logic/symbols/cnext/collectors/RegisterCollector.ts`
- Modify: `src/transpiler/logic/symbols/cnext/collectors/ScopeCollector.ts`

**Step 1: Update each collector**

For each file:
1. Remove `import ESymbolKind from "../../../../../utils/types/ESymbolKind";`
2. Replace `ESymbolKind.X` with string literal `"x"`

Example for FunctionCollector.ts - change:
```typescript
kind: ESymbolKind.Function,
```
to:
```typescript
kind: "function",
```

For ScopeCollector.ts specifically - change:
```typescript
kind: ESymbolKind.Namespace,
```
to:
```typescript
kind: "scope",
```

**Step 2: Commit**

```bash
git add src/transpiler/logic/symbols/cnext/collectors/
git commit -m "refactor: update C-Next collectors to use string literal kinds"
```

---

## Task 5: Update C-Next Symbol Adapters

**Files:**
- Modify: `src/transpiler/logic/symbols/cnext/adapters/TSymbolAdapter.ts`
- Modify: `src/transpiler/logic/symbols/cnext/adapters/TSymbolInfoAdapter.ts`

**Step 1: Update TSymbolAdapter.ts**

Remove ESymbolKind import. Update switch cases:
- `case ESymbolKind.Bitmap:` → `case "bitmap":`
- `case ESymbolKind.Enum:` → `case "enum":`
- `case ESymbolKind.Struct:` → `case "struct":`
- `case ESymbolKind.Function:` → `case "function":`
- `case ESymbolKind.Variable:` → `case "variable":`
- `case ESymbolKind.Register:` → `case "register":`
- `case ESymbolKind.Namespace:` → `case "scope":` (C-Next scopes)

Also update object literals:
- `kind: ESymbolKind.Namespace,` → `kind: "scope",`

**Step 2: Update TSymbolInfoAdapter.ts**

Same pattern as TSymbolAdapter.ts - remove import, update switch cases and object literals.

**Step 3: Commit**

```bash
git add src/transpiler/logic/symbols/cnext/adapters/
git commit -m "refactor: update C-Next adapters to use string literal kinds"
```

---

## Task 6: Update C/C++ Symbol Collectors

These files handle C and C++ symbols - use `"namespace"` for C++ namespaces.

**Files:**
- Modify: `src/transpiler/logic/symbols/CSymbolCollector.ts`
- Modify: `src/transpiler/logic/symbols/CppSymbolCollector.ts`

**Step 1: Update CSymbolCollector.ts**

Remove ESymbolKind import. Replace:
- `ESymbolKind.Function` → `"function"`
- `ESymbolKind.Variable` → `"variable"`
- `ESymbolKind.Struct` → `"struct"`
- `ESymbolKind.Enum` → `"enum"`
- `ESymbolKind.EnumMember` → `"enum_member"`
- `ESymbolKind.Type` → `"type"`

**Step 2: Update CppSymbolCollector.ts**

Remove ESymbolKind import. Replace:
- `ESymbolKind.Namespace` → `"namespace"` (C++ namespaces)
- `ESymbolKind.Class` → `"class"`
- Other kinds same as CSymbolCollector

**Step 3: Commit**

```bash
git add src/transpiler/logic/symbols/CSymbolCollector.ts src/transpiler/logic/symbols/CppSymbolCollector.ts
git commit -m "refactor: update C/C++ collectors to use string literal kinds"
```

---

## Task 7: Update Symbol Table and AutoConstUpdater

**Files:**
- Modify: `src/transpiler/logic/symbols/SymbolTable.ts`
- Modify: `src/transpiler/logic/symbols/AutoConstUpdater.ts`

**Step 1: Update SymbolTable.ts**

Remove ESymbolKind import. Replace all usages with string literals.

**Step 2: Update AutoConstUpdater.ts**

Remove ESymbolKind import. Replace all usages with string literals.

**Step 3: Commit**

```bash
git add src/transpiler/logic/symbols/SymbolTable.ts src/transpiler/logic/symbols/AutoConstUpdater.ts
git commit -m "refactor: update SymbolTable and AutoConstUpdater to use string literals"
```

---

## Task 8: Update Analyzers

**Files:**
- Modify: `src/transpiler/logic/analysis/FunctionCallAnalyzer.ts`
- Modify: `src/transpiler/logic/analysis/InitializationAnalyzer.ts`

**Step 1: Update FunctionCallAnalyzer.ts**

Remove ESymbolKind import. Replace usages with string literals.

**Step 2: Update InitializationAnalyzer.ts**

Remove ESymbolKind import. Replace usages with string literals.

**Step 3: Commit**

```bash
git add src/transpiler/logic/analysis/
git commit -m "refactor: update analyzers to use string literal kinds"
```

---

## Task 9: Update Code Generation Files

**Files:**
- Modify: `src/transpiler/output/codegen/CodeGenerator.ts`
- Modify: `src/transpiler/output/codegen/generators/expressions/CallExprUtils.ts`
- Modify: `src/transpiler/output/codegen/helpers/CppConstructorHelper.ts`
- Modify: `src/transpiler/output/codegen/helpers/SymbolLookupHelper.ts`

**Step 1: Update CodeGenerator.ts**

Remove ESymbolKind import. Replace usages with string literals.

**Step 2: Update CallExprUtils.ts**

Remove ESymbolKind import. Replace usages with string literals.

**Step 3: Update CppConstructorHelper.ts**

Remove ESymbolKind import. Replace usages with string literals.

**Step 4: Update SymbolLookupHelper.ts**

Remove ESymbolKind import. Replace `ESymbolKind.Namespace` with `"namespace"` (this checks for C++ namespaces).

**Step 5: Commit**

```bash
git add src/transpiler/output/codegen/
git commit -m "refactor: update codegen files to use string literal kinds"
```

---

## Task 10: Update Header Generation Files

**Files:**
- Modify: `src/transpiler/output/headers/HeaderGeneratorUtils.ts`
- Modify: `src/transpiler/output/headers/ExternalTypeHeaderBuilder.ts`

**Step 1: Update HeaderGeneratorUtils.ts**

Remove ESymbolKind import. Replace usages with string literals.

**Step 2: Update ExternalTypeHeaderBuilder.ts**

Remove ESymbolKind import. Replace usages with string literals.

**Step 3: Commit**

```bash
git add src/transpiler/output/headers/
git commit -m "refactor: update header generation to use string literal kinds"
```

---

## Task 11: Update State and Transpiler

**Files:**
- Modify: `src/transpiler/state/CodeGenState.ts`
- Modify: `src/transpiler/Transpiler.ts`

**Step 1: Update CodeGenState.ts**

Remove ESymbolKind import. Replace usages with string literals.

**Step 2: Update Transpiler.ts**

Remove ESymbolKind import. Replace usages with string literals.

**Step 3: Commit**

```bash
git add src/transpiler/state/CodeGenState.ts src/transpiler/Transpiler.ts
git commit -m "refactor: update state and transpiler to use string literal kinds"
```

---

## Task 12: Update Library Files

**Files:**
- Modify: `src/lib/parseWithSymbols.ts`
- Modify: `src/lib/parseCHeader.ts`

**Step 1: Update parseWithSymbols.ts**

Remove ESymbolKind import. Update switch cases:
- `case ESymbolKind.Namespace:` → `case "namespace":` and add `case "scope":` (handles both)

```typescript
switch (kind) {
  case "namespace":
  case "scope":
    return "Scope/Namespace";
  case "struct":
    return "Structure";
  // ... etc
}
```

**Step 2: Update parseCHeader.ts**

Remove ESymbolKind import. Update switch cases with string literals.

**Step 3: Commit**

```bash
git add src/lib/
git commit -m "refactor: update lib files to use string literal kinds"
```

---

## Task 13: Update Utility Files

**Files:**
- Modify: `src/utils/CppNamespaceUtils.ts`
- Modify: `src/transpiler/types/__tests__/FunctionSymbolAdapter.test.ts`

**Step 1: Update CppNamespaceUtils.ts**

Remove ESymbolKind import. Replace:
- `ESymbolKind.Namespace` → `"namespace"` (C++ namespaces)
- `ESymbolKind.Class` → `"class"`
- `ESymbolKind.Enum` → `"enum"`

**Step 2: Update FunctionSymbolAdapter.test.ts**

Remove ESymbolKind import. Replace usages with string literals.

**Step 3: Commit**

```bash
git add src/utils/CppNamespaceUtils.ts src/transpiler/types/__tests__/
git commit -m "refactor: update utility files to use string literal kinds"
```

---

## Task 14: Update Test Files - Symbol Types

**Files:**
- Modify: `src/transpiler/logic/symbols/types/__tests__/SymbolGuards.test.ts`
- Modify: `src/transpiler/logic/symbols/__tests__/SymbolTable.test.ts`
- Modify: `src/transpiler/logic/symbols/__tests__/SymbolCollectorContext.test.ts`
- Modify: `src/transpiler/logic/symbols/__tests__/AutoConstUpdater.test.ts`

**Step 1: Update each test file**

For each file:
1. Remove `import ESymbolKind from "...";`
2. Replace all `ESymbolKind.X` with `"x"` string literals
3. For SymbolGuards.test.ts, change `ESymbolKind.Namespace` to `"scope"` for C-Next scope tests

**Step 2: Commit**

```bash
git add src/transpiler/logic/symbols/types/__tests__/ src/transpiler/logic/symbols/__tests__/
git commit -m "test: update symbol type tests to use string literal kinds"
```

---

## Task 15: Update Test Files - C-Next Collectors

**Files:**
- Modify: `src/transpiler/logic/symbols/cnext/__tests__/FunctionCollector.test.ts`
- Modify: `src/transpiler/logic/symbols/cnext/__tests__/VariableCollector.test.ts`
- Modify: `src/transpiler/logic/symbols/cnext/__tests__/StructCollector.test.ts`
- Modify: `src/transpiler/logic/symbols/cnext/__tests__/EnumCollector.test.ts`
- Modify: `src/transpiler/logic/symbols/cnext/__tests__/BitmapCollector.test.ts`
- Modify: `src/transpiler/logic/symbols/cnext/__tests__/RegisterCollector.test.ts`
- Modify: `src/transpiler/logic/symbols/cnext/__tests__/ScopeCollector.test.ts`

**Step 1: Update each test file**

For each file, remove ESymbolKind import and replace with string literals.
For ScopeCollector.test.ts, use `"scope"` instead of `ESymbolKind.Namespace`.

**Step 2: Commit**

```bash
git add src/transpiler/logic/symbols/cnext/__tests__/
git commit -m "test: update C-Next collector tests to use string literal kinds"
```

---

## Task 16: Update Test Files - C-Next Adapters

**Files:**
- Modify: `src/transpiler/logic/symbols/cnext/__tests__/TSymbolAdapter.test.ts`
- Modify: `src/transpiler/logic/symbols/cnext/__tests__/TSymbolInfoAdapter.test.ts`
- Modify: `src/transpiler/logic/symbols/cnext/__tests__/CNextResolver.integration.test.ts`

**Step 1: Update each test file**

Remove ESymbolKind imports, replace with string literals.
Use `"scope"` for C-Next scopes.

**Step 2: Commit**

```bash
git add src/transpiler/logic/symbols/cnext/__tests__/
git commit -m "test: update C-Next adapter tests to use string literal kinds"
```

---

## Task 17: Update Test Files - C/C++ Collectors

**Files:**
- Modify: `src/transpiler/logic/symbols/__tests__/CSymbolCollector.test.ts`
- Modify: `src/transpiler/logic/symbols/__tests__/CppSymbolCollector.test.ts`

**Step 1: Update CSymbolCollector.test.ts**

Remove ESymbolKind import. Replace with string literals.

**Step 2: Update CppSymbolCollector.test.ts**

Remove ESymbolKind import. Use `"namespace"` for C++ namespace tests.

**Step 3: Commit**

```bash
git add src/transpiler/logic/symbols/__tests__/CSymbolCollector.test.ts src/transpiler/logic/symbols/__tests__/CppSymbolCollector.test.ts
git commit -m "test: update C/C++ collector tests to use string literal kinds"
```

---

## Task 18: Update Test Files - Analysis

**Files:**
- Modify: `src/transpiler/logic/analysis/__tests__/FunctionCallAnalyzer.test.ts`
- Modify: `src/transpiler/logic/analysis/__tests__/InitializationAnalyzer.test.ts`
- Modify: `src/transpiler/logic/analysis/__tests__/runAnalyzers.test.ts`

**Step 1: Update each test file**

Remove ESymbolKind imports, replace with string literals.

**Step 2: Commit**

```bash
git add src/transpiler/logic/analysis/__tests__/
git commit -m "test: update analyzer tests to use string literal kinds"
```

---

## Task 19: Update Test Files - CodeGen

**Files:**
- Modify: `src/transpiler/output/codegen/generators/expressions/__tests__/CallExprUtils.test.ts`
- Modify: `src/transpiler/output/codegen/generators/expressions/__tests__/CallExprGenerator.test.ts`
- Modify: `src/transpiler/output/codegen/helpers/__tests__/CppConstructorHelper.test.ts`
- Modify: `src/transpiler/output/codegen/helpers/__tests__/SymbolLookupHelper.test.ts`

**Step 1: Update each test file**

Remove ESymbolKind imports, replace with string literals.
For SymbolLookupHelper.test.ts, use `"namespace"` for C++ namespace tests.

**Step 2: Commit**

```bash
git add src/transpiler/output/codegen/
git commit -m "test: update codegen tests to use string literal kinds"
```

---

## Task 20: Update Test Files - Headers

**Files:**
- Modify: `src/transpiler/output/headers/__tests__/BaseHeaderGenerator.test.ts`
- Modify: `src/transpiler/output/headers/__tests__/CHeaderGenerator.test.ts`
- Modify: `src/transpiler/output/headers/__tests__/CppHeaderGenerator.test.ts`
- Modify: `src/transpiler/output/headers/__tests__/HeaderGenerator.test.ts`
- Modify: `src/transpiler/output/headers/__tests__/HeaderGeneratorUtils.test.ts`
- Modify: `src/transpiler/output/headers/__tests__/ExternalTypeHeaderBuilder.test.ts`

**Step 1: Update each test file**

Remove ESymbolKind imports, replace with string literals.

**Step 2: Commit**

```bash
git add src/transpiler/output/headers/__tests__/
git commit -m "test: update header generator tests to use string literal kinds"
```

---

## Task 21: Update Test Files - State and Cache

**Files:**
- Modify: `src/transpiler/state/__tests__/CodeGenState.test.ts`
- Modify: `src/utils/cache/__tests__/CacheManager.test.ts`

**Step 1: Update CodeGenState.test.ts**

Remove ESymbolKind import, replace with string literals.

**Step 2: Update CacheManager.test.ts**

Remove ESymbolKind import, replace with string literals.
This file tests all symbol kinds - use appropriate strings for each.

**Step 3: Commit**

```bash
git add src/transpiler/state/__tests__/ src/utils/cache/__tests__/
git commit -m "test: update state and cache tests to use string literal kinds"
```

---

## Task 22: Update Test Files - Lib and Utils

**Files:**
- Modify: `src/lib/__tests__/parseCHeader.mocked.test.ts`
- Modify: `src/utils/__tests__/CppNamespaceUtils.test.ts`

**Step 1: Update parseCHeader.mocked.test.ts**

Remove ESymbolKind import, replace with string literals.

**Step 2: Update CppNamespaceUtils.test.ts**

Remove ESymbolKind import, use `"namespace"` for C++ namespace tests.

**Step 3: Commit**

```bash
git add src/lib/__tests__/ src/utils/__tests__/
git commit -m "test: update lib and utils tests to use string literal kinds"
```

---

## Task 23: Delete ESymbolKind Enum

**Files:**
- Delete: `src/utils/types/ESymbolKind.ts`

**Step 1: Verify no remaining imports**

Run: `grep -r "ESymbolKind" src/`
Expected: No matches

**Step 2: Delete the file**

Run: `rm src/utils/types/ESymbolKind.ts`

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: delete ESymbolKind enum"
```

---

## Task 24: Run Full Test Suite

**Step 1: Run TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run unit tests**

Run: `npm run unit`
Expected: All tests pass

**Step 3: Run integration tests**

Run: `npm test`
Expected: All tests pass

**Step 4: Run linting**

Run: `npm run oxlint:check`
Expected: No new errors

---

## Task 25: Final Commit and Cleanup

**Step 1: If any fixes needed, commit them**

```bash
git add -A
git commit -m "fix: address test failures from TSymbolKind refactor"
```

**Step 2: Run full verification**

Run: `npm run test:all`
Expected: All tests pass

**Step 3: Summarize changes**

Total files changed: ~71
- 4 new type files created
- 1 enum file deleted
- ~66 files updated to use string literals
