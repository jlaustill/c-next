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
src/transpiler/types/           # Shared type definitions (TType, IFunctionSymbol, etc.)
src/transpiler/state/           # SymbolRegistry - central symbol storage
src/transpiler/logic/           # Analysis (MutationAnalyzer) - computed queries
src/transpiler/output/          # QualifiedNameGenerator - C-style name generation
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

Location: `src/transpiler/types/`

**IParameterInfo.ts**

```typescript
interface IParameterInfo {
  name: string;
  type: TType;
  isConst: boolean; // Source-level const modifier
  arrayDimensions?: (number | string)[];
}
```

**IFunctionSymbol.ts**

```typescript
interface IFunctionSymbol {
  kind: "function";
  name: string; // Bare name: "fillData", NOT "Test_fillData"
  scope: IScopeSymbol; // Reference to parent scope (never null)
  parameters: IParameterInfo[];
  returnType: TType;
  visibility: "public" | "private";
  body: FunctionDeclarationContext; // AST reference for mutation analysis
  sourceFile: string;
  sourceLine: number;
}
```

**IScopeSymbol.ts**

```typescript
interface IScopeSymbol {
  kind: "scope";
  name: string; // "" for global scope
  parent: IScopeSymbol; // Global scope's parent is itself
  functions: IFunctionSymbol[];
  variables: IVariableSymbol[];
  // No sourceFile - scopes span multiple files
}
```

Key design decisions:

- `scope` is always non-null; global scope is explicit
- `scope Test` in multiple files merges into single `IScopeSymbol`
- Scopes can nest: `parent` enables `Outer.Inner.func` patterns
- `body` holds AST reference for walking during analysis

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

| Current                                                     | Replacement                         |
| ----------------------------------------------------------- | ----------------------------------- |
| `src/transpiler/output/codegen/types/IFunctionSignature.ts` | `IFunctionSymbol`                   |
| `src/transpiler/output/codegen/types/TTypeInfo.ts`          | `TType`                             |
| `src/transpiler/logic/symbols/types/IFunctionSymbol.ts`     | Moved to `src/transpiler/types/`    |
| `CodeGenState.functionParamLists`                           | `IFunctionSymbol.parameters`        |
| `CodeGenState.modifiedParameters`                           | `MutationAnalyzer.isMutated()`      |
| `CodeGenState.passByValueParams`                            | `MutationAnalyzer.isPassByValue()`  |
| `CodeGenState.functionCallGraph`                            | Traversal of `IFunctionSymbol.body` |
| `CodeGenState.functionSignatures`                           | `SymbolRegistry`                    |

## Implementation Phases

Each phase is a separate mergeable PR.

### Phase 1: Create TType Foundation

- Create `src/transpiler/types/TType.ts`
- Create `src/transpiler/types/TPrimitiveKind.ts`
- Unit tests for type construction

### Phase 2: Refactor Symbol Types

- Move `IFunctionSymbol`, `IParameterInfo`, `IScopeSymbol` to `src/transpiler/types/`
- Update to use `TType` instead of strings
- Update to use scope references instead of string names
- Keep old types temporarily for compatibility

### Phase 3: Create SymbolRegistry

- Create `src/transpiler/state/SymbolRegistry.ts`
- Update symbol collectors to populate registry
- Handle scope merging across files
- Unit tests for resolution

### Phase 4: Refactor MutationAnalyzer

- Create new `MutationAnalyzer` using symbol graph traversal
- Replace `PassByValueAnalyzer` string-based implementation
- Verify identical behavior via integration tests

### Phase 5: Refactor CodeGenerator

- Use `SymbolRegistry` instead of string maps
- Use `QualifiedNameGenerator` for output names
- Remove string-keyed map accesses

### Phase 6: Cleanup

- Delete `IFunctionSignature`, `TTypeInfo`
- Delete string-keyed maps from `CodeGenState`
- Remove old symbol types from `logic/symbols/types/`
- Update all imports

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
