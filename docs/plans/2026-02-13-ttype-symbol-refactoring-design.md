# TType and Symbol Refactoring Design

**Date:** 2026-02-13
**Status:** Approved
**Issue:** #797 (root cause investigation revealed architectural debt)

## Problem Statement

The transpiler currently represents types and functions as strings throughout the codebase:

- `IFunctionSymbol.name` stores C-mangled names like `"Test_fillData"` instead of bare names
- `IFunctionSymbol.returnType` and `IParameterInfo.type` are strings, not type references
- `CodeGenState` uses string-keyed maps: `Map<string, Set<string>>` for tracking modifications
- `PassByValueAnalyzer` rebuilds function data from AST into string maps, ignoring symbol objects
- Multiple parallel type representations exist (`IFunctionSymbol`, `IFunctionSignature`, `TTypeInfo`)

This causes:

1. Logic layer coupled to C output format (mangled names)
2. Type resolution deferred to code generation via string matching
3. Bug #797: bare function names don't match mangled keys in transitive analysis
4. Duplicate/inconsistent type representations across layers

## Design Goals

1. Single source of truth for types (`TType`) and functions (`IFunctionSymbol`)
2. Types are references to symbols, not strings
3. Function names are bare; qualified names generated only at output
4. Mutation analysis computed on-demand by traversing symbol graph
5. No string-keyed function maps

## Architecture

### Layer Separation

```
src/transpiler/types/           # Shared type definitions (TType, etc.)
src/transpiler/types/symbols/   # Symbol type definitions (IBaseSymbol, IFunctionSymbol, etc.)
src/transpiler/state/           # SymbolRegistry - central symbol storage
src/transpiler/logic/           # Analysis (MutationAnalyzer) - computed queries
src/transpiler/output/          # QualifiedNameGenerator - C-style name generation
```

### Symbol Directory Structure

All symbol types live in `src/transpiler/types/symbols/`:

```
src/transpiler/types/symbols/
├── IBaseSymbol.ts          # Base interface with kind: TSymbolKindCNext
├── IFunctionSymbol.ts      # extends IBaseSymbol
├── IScopeSymbol.ts         # extends IBaseSymbol
├── IStructSymbol.ts        # extends IBaseSymbol
├── IEnumSymbol.ts          # extends IBaseSymbol
├── IVariableSymbol.ts      # extends IBaseSymbol
├── IBitmapSymbol.ts        # extends IBaseSymbol
├── IRegisterSymbol.ts      # extends IBaseSymbol
├── TSymbol.ts              # Discriminated union of all symbol types
├── SymbolGuards.ts         # Static class with type guard methods
├── IParameterInfo.ts       # TType-based parameter info
├── IFieldInfo.ts           # TType-based struct field info
├── IBitmapFieldInfo.ts     # Bit offset/width for bitmap fields
└── IRegisterMemberInfo.ts  # Address offset for register members
```

### Type Foundation: TType

Location: `src/transpiler/types/TType.ts`

```typescript
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

type TType =
  | { kind: "primitive"; primitive: TPrimitiveKind }
  | { kind: "struct"; symbol: IStructSymbol }
  | { kind: "enum"; symbol: IEnumSymbol }
  | { kind: "bitmap"; symbol: IBitmapSymbol }
  | { kind: "array"; elementType: TType; dimensions: (number | string)[] }
  | { kind: "string"; capacity: number }
  | { kind: "callback"; signature: IFunctionSignature }
  | { kind: "register"; symbol: IRegisterSymbol }
  | { kind: "external"; name: string }; // C++ types like FlexCAN_T4<CAN1>
```

### Symbol Types

Location: `src/transpiler/types/symbols/`

**IBaseSymbol.ts** - Base interface for all symbol types

```typescript
import type TSymbolKindCNext from "../symbol-kinds/TSymbolKindCNext";
import type IScopeSymbol from "./IScopeSymbol";
import type ESourceLanguage from "../../utils/types/ESourceLanguage";

interface IBaseSymbol {
  readonly kind: TSymbolKindCNext;
  readonly name: string;
  readonly scope: IScopeSymbol;
  readonly sourceFile: string;
  readonly sourceLine: number;
  readonly sourceLanguage: ESourceLanguage;
  readonly isExported: boolean;
}

export default IBaseSymbol;
```

**IParameterInfo.ts**

```typescript
interface IParameterInfo {
  readonly name: string;
  readonly type: TType;
  readonly isConst: boolean;
  readonly arrayDimensions?: ReadonlyArray<number | string>;
}
```

**IFieldInfo.ts** - Struct field info

```typescript
interface IFieldInfo {
  readonly name: string;
  readonly type: TType;
  readonly isConst: boolean;
  readonly isAtomic: boolean;
  readonly arrayDimensions?: ReadonlyArray<number | string>;
}
```

**IFunctionSymbol.ts**

```typescript
interface IFunctionSymbol extends IBaseSymbol {
  readonly kind: "function";
  readonly parameters: ReadonlyArray<IParameterInfo>;
  readonly returnType: TType;
  readonly visibility: TVisibility;
  readonly body: unknown; // AST reference, avoids parser dependency
}
```

**IScopeSymbol.ts**

```typescript
interface IScopeSymbol extends IBaseSymbol {
  readonly kind: "scope";
  readonly functions: ReadonlyArray<IFunctionSymbol>;
  readonly variables: ReadonlyArray<unknown>; // Typed later
  readonly memberVisibility: ReadonlyMap<string, TVisibility>;
}
```

**IStructSymbol.ts**

```typescript
interface IStructSymbol extends IBaseSymbol {
  readonly kind: "struct";
  readonly fields: ReadonlyMap<string, IFieldInfo>;
}
```

**IEnumSymbol.ts**

```typescript
interface IEnumSymbol extends IBaseSymbol {
  readonly kind: "enum";
  readonly members: ReadonlyMap<string, number>;
  readonly bitWidth?: number;
}
```

**IVariableSymbol.ts**

```typescript
interface IVariableSymbol extends IBaseSymbol {
  readonly kind: "variable";
  readonly type: TType;
  readonly isConst: boolean;
  readonly isAtomic: boolean;
  readonly initialValue?: string;
}
```

**IBitmapSymbol.ts**

```typescript
interface IBitmapSymbol extends IBaseSymbol {
  readonly kind: "bitmap";
  readonly bitWidth: number;
  readonly fields: ReadonlyMap<string, IBitmapFieldInfo>;
}
```

**IRegisterSymbol.ts**

```typescript
interface IRegisterSymbol extends IBaseSymbol {
  readonly kind: "register";
  readonly baseAddress: string;
  readonly members: ReadonlyMap<string, IRegisterMemberInfo>;
}
```

**TSymbol.ts** - Discriminated union

```typescript
type TSymbol =
  | IFunctionSymbol
  | IScopeSymbol
  | IStructSymbol
  | IEnumSymbol
  | IVariableSymbol
  | IBitmapSymbol
  | IRegisterSymbol;
```

**SymbolGuards.ts** - Type guard static class

```typescript
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

Key design decisions:

- All symbols extend `IBaseSymbol` which has `kind: TSymbolKindCNext`
- Each concrete interface narrows `kind` to its specific literal type
- `scope` is always non-null on `IBaseSymbol`; global scope is explicit
- `scope Test` in multiple files merges into single `IScopeSymbol`
- Scopes can nest: `parent` on `IScopeSymbol` enables `Outer.Inner.func` patterns
- `body` holds AST reference for walking during analysis
- All fields are `readonly` to enforce immutability

### Symbol Registry

Location: `src/transpiler/state/SymbolRegistry.ts`

```typescript
class SymbolRegistry {
  private static globalScope: IScopeSymbol;
  private static scopes: Map<string, IScopeSymbol>; // "Outer.Inner" → scope
  private static structs: Map<string, IStructSymbol>;
  private static enums: Map<string, IEnumSymbol>;
  private static bitmaps: Map<string, IBitmapSymbol>;

  static getGlobalScope(): IScopeSymbol;
  static getOrCreateScope(path: string): IScopeSymbol;
  static resolveFunction(
    name: string,
    fromScope: IScopeSymbol,
  ): IFunctionSymbol | null;
  static reset(): void;
}
```

- Central registry for all symbols
- `getOrCreateScope` handles scope merging across files
- `resolveFunction` walks scope chain (current → parent → global)
- String keys in Maps for lookup; values are proper symbol objects

### Mutation Analysis (Computed)

Location: `src/transpiler/logic/analysis/MutationAnalyzer.ts`

```typescript
class MutationAnalyzer {
  static isMutated(func: IFunctionSymbol, param: IParameterInfo): boolean {
    // Walk func.body AST
    // - Direct mutation found → true
    // - Param passed to another function → recurse via resolveFunction
    // - Otherwise → false
  }

  static isPassByValue(func: IFunctionSymbol, param: IParameterInfo): boolean {
    if (this.isMutated(func, param)) return false;
    if (param.type.kind !== "primitive") return false;
    // Check primitive size
    return true;
  }
}
```

Key points:

- No stored state; computed on-demand
- Traverses actual symbol graph, not string maps
- Can memoize for performance (implementation detail)
- Direct vs transitive mutation is an implementation detail, not exposed

### Qualified Name Generation (Output Layer)

Location: `src/transpiler/output/codegen/utils/QualifiedNameGenerator.ts`

```typescript
class QualifiedNameGenerator {
  static forFunction(func: IFunctionSymbol): string {
    const scopePath = this.getScopePath(func.scope);
    if (scopePath.length === 0) return func.name;
    return [...scopePath, func.name].join("_");
  }

  private static getScopePath(scope: IScopeSymbol): string[] {
    if (scope.name === "" || scope.parent === scope) return [];
    return [...this.getScopePath(scope.parent), scope.name];
  }
}
```

- ONLY place that constructs `Scope_function` strings
- Lives in output layer
- Easy to extend for C++ namespaces (`Outer::Inner::func`) if needed

## What Gets Deleted

### Old Symbol Types (entire directory)

All files in `src/transpiler/logic/symbols/types/` are deleted:

- `IBaseSymbol.ts` → Moved to `src/transpiler/types/symbols/`
- `IFunctionSymbol.ts` → Moved to `src/transpiler/types/symbols/`
- `IScopeSymbol.ts` → Moved to `src/transpiler/types/symbols/`
- `IStructSymbol.ts` → Moved to `src/transpiler/types/symbols/`
- `IEnumSymbol.ts` → Moved to `src/transpiler/types/symbols/`
- `IVariableSymbol.ts` → Moved to `src/transpiler/types/symbols/`
- `IBitmapSymbol.ts` → Moved to `src/transpiler/types/symbols/`
- `IRegisterSymbol.ts` → Moved to `src/transpiler/types/symbols/`
- `TSymbol.ts` → Moved to `src/transpiler/types/symbols/`
- `typeGuards.ts` → Replaced by `SymbolGuards.ts` static class
- `IParameterInfo.ts` → Moved to `src/transpiler/types/symbols/`
- `IFieldInfo.ts` → Moved to `src/transpiler/types/symbols/`
- `IBitmapFieldInfo.ts` → Moved to `src/transpiler/types/symbols/`
- `IRegisterMemberInfo.ts` → Moved to `src/transpiler/types/symbols/`

### Duplicate Types in `src/transpiler/types/`

- `IFunctionSymbol.ts` → Consolidated to `symbols/IFunctionSymbol.ts`
- `IScopeSymbol.ts` → Consolidated to `symbols/IScopeSymbol.ts`
- `IParameterInfo.ts` → Consolidated to `symbols/IParameterInfo.ts`
- `FunctionSymbolAdapter.ts` → Deleted (no longer needed after consolidation)

### CodeGenState Fields

| Current                           | Replacement                         |
| --------------------------------- | ----------------------------------- |
| `CodeGenState.functionParamLists` | `IFunctionSymbol.parameters`        |
| `CodeGenState.modifiedParameters` | `MutationAnalyzer.isMutated()`      |
| `CodeGenState.passByValueParams`  | `MutationAnalyzer.isPassByValue()`  |
| `CodeGenState.functionCallGraph`  | Traversal of `IFunctionSymbol.body` |
| `CodeGenState.functionSignatures` | `SymbolRegistry`                    |

### Other Deletions

| Current                                                      | Replacement       |
| ------------------------------------------------------------ | ----------------- |
| `src/transpiler/output/codegen/types/IFunctionSignature.ts`  | `IFunctionSymbol` |
| `src/transpiler/output/codegen/types/TTypeInfo.ts`           | `TType`           |

## Implementation Phases

Each phase is a separate mergeable PR.

### Phase 1: Create TType Foundation (if not done)

- Create `src/transpiler/types/TType.ts`
- Create `src/transpiler/types/TPrimitiveKind.ts`
- Unit tests for type construction

### Phase 2: Create Symbol Types Directory

- Create `src/transpiler/types/symbols/` directory
- Create `IBaseSymbol.ts` with `kind: TSymbolKindCNext`
- Create all symbol interfaces extending `IBaseSymbol`:
  - `IFunctionSymbol.ts`, `IScopeSymbol.ts`, `IStructSymbol.ts`
  - `IEnumSymbol.ts`, `IVariableSymbol.ts`, `IBitmapSymbol.ts`, `IRegisterSymbol.ts`
- Create supporting types:
  - `IParameterInfo.ts`, `IFieldInfo.ts`, `IBitmapFieldInfo.ts`, `IRegisterMemberInfo.ts`
- Create `TSymbol.ts` discriminated union
- Create `SymbolGuards.ts` static class
- Unit tests for type guards

### Phase 3: Update All Imports

- Update all imports from `logic/symbols/types/` to `types/symbols/`
- Update all imports from duplicate types in `transpiler/types/`
- Use ts-morph rename tools for safe refactoring
- Verify compilation passes

### Phase 4: Delete Old Types

- Delete entire `src/transpiler/logic/symbols/types/` directory
- Delete `src/transpiler/types/IFunctionSymbol.ts` (duplicate)
- Delete `src/transpiler/types/IScopeSymbol.ts` (duplicate)
- Delete `src/transpiler/types/IParameterInfo.ts` (duplicate)
- Delete `src/transpiler/types/FunctionSymbolAdapter.ts` (no longer needed)

### Phase 5: Create SymbolRegistry

- Create `src/transpiler/state/SymbolRegistry.ts`
- Update symbol collectors to populate registry
- Handle scope merging across files
- Unit tests for resolution

### Phase 6: Refactor MutationAnalyzer

- Create new `MutationAnalyzer` using symbol graph traversal
- Replace `PassByValueAnalyzer` string-based implementation
- Verify identical behavior via integration tests

### Phase 7: Refactor CodeGenerator

- Use `SymbolRegistry` instead of string maps
- Use `QualifiedNameGenerator` for output names
- Remove string-keyed map accesses

### Phase 8: Final Cleanup

- Delete `IFunctionSignature`, `TTypeInfo`
- Delete string-keyed maps from `CodeGenState`
- Update all imports
- Verify all tests pass

## Testing Strategy

- Each phase includes unit tests for new components
- Integration tests (`npm test`) must pass at each phase
- Phase 4 specifically validates mutation analysis produces identical results
- Final phase validates no regressions across all 951+ integration tests

## Risks and Mitigations

| Risk                                              | Mitigation                                       |
| ------------------------------------------------- | ------------------------------------------------ |
| Large scope of changes                            | Phased approach with mergeable PRs               |
| Behavioral regressions                            | Integration tests at each phase                  |
| Performance regression from on-demand computation | Memoization can be added if profiling shows need |
| Cross-file scope merging complexity               | SymbolRegistry handles merge logic centrally     |
