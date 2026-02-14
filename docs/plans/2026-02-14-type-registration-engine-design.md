# Type Registration Engine Extraction Design

**Issue:** #791
**Date:** 2026-02-14
**Status:** Implemented

## Summary

Extract the Type Registration Engine (~330 lines across 11 methods) from `CodeGenerator.ts` to a dedicated static class in `src/transpiler/output/codegen/helpers/TypeRegistrationEngine.ts`.

> **Note:** Originally planned for `logic/analysis/` but moved to `output/codegen/helpers/` due to architecture constraints (engine imports from output layer types).

## Motivation

From PR #789 analysis, the Type Registration Engine was identified as an extraction opportunity but deferred due to tight coupling. This design addresses the coupling through minimal callbacks while maximizing pure, testable logic.

## Architecture

**Location:** `src/transpiler/output/codegen/helpers/TypeRegistrationEngine.ts`

**Pattern:** Static class with minimal callback interface (2 callbacks only).

**Callback Interface:**

```typescript
interface ITypeRegistrationCallbacks {
  tryEvaluateConstant: (ctx: Parser.ExpressionContext) => number | undefined;
  requireInclude: (header: TIncludeHeader) => void;
}
```

**State Access:** Direct `CodeGenState` access for:

- `constValues` - const value tracking
- `currentScope` - scope context (read/temporarily set)
- `setVariableTypeInfo()` - type registry writes
- `symbols` - enum/bitmap lookup

## API Design

### Public Methods

```typescript
class TypeRegistrationEngine {
  /** Entry point: Register all variable types from the program tree. */
  static register(
    tree: Parser.ProgramContext,
    callbacks: ITypeRegistrationCallbacks,
  ): void;

  /** Register a single global variable's type. */
  static registerGlobalVariable(
    varDecl: Parser.VariableDeclarationContext,
    callbacks: ITypeRegistrationCallbacks,
  ): void;

  /** Register all member variable types within a scope. */
  static registerScopeMemberTypes(
    scopeDecl: Parser.ScopeDeclarationContext,
    callbacks: ITypeRegistrationCallbacks,
  ): void;
}
```

### Private Orchestration Methods

- `trackVariableType(varDecl, callbacks)` - delegates to `trackVariableTypeWithName`
- `trackVariableTypeWithName(varDecl, name, callbacks)` - main registration logic
- `tryRegisterStringType(...)` - string type handling
- `registerArrayTypeVariable(...)` - array syntax handling
- `registerStandardType(...)` - regular type registration

### Pure Static Helpers (no callbacks)

- `parseArrayTypeDimension(ctx)` - parse single dimension from arrayType
- `resolveBaseType(typeCtx, currentScope)` - resolve type name
- `collectArrayDimensions(...)` - gather all dimensions

## Data Flow

```
CodeGenerator.generate()
  └── TypeRegistrationEngine.register(tree, callbacks)
      ├── For each declaration:
      │   ├── variableDeclaration → registerGlobalVariable()
      │   │   ├── trackVariableTypeWithName()
      │   │   └── Track const value if applicable
      │   └── scopeDeclaration → registerScopeMemberTypes()
      │       └── For each member: trackVariableTypeWithName(varDecl, mangledName)
      │
      └── trackVariableTypeWithName() dispatches to:
          ├── tryRegisterStringType() → CodeGenState.setVariableTypeInfo()
          ├── registerArrayTypeVariable() → CodeGenState.setVariableTypeInfo()
          ├── _tryRegisterEnumOrBitmapType() → TypeRegistrationUtils (existing)
          └── registerStandardType() → CodeGenState.setVariableTypeInfo()
```

## Callback Usage

| Callback                   | Used By                      | Purpose              |
| -------------------------- | ---------------------------- | -------------------- |
| `tryEvaluateConstant`      | `registerGlobalVariable()`   | Const value tracking |
| `tryEvaluateConstant`      | `_evaluateArrayDimensions()` | Dimension resolution |
| `requireInclude("string")` | `tryRegisterStringType()`    | Include string.h     |

## Testing Strategy

### Unit Tests

Location: `src/transpiler/output/codegen/helpers/__tests__/TypeRegistrationEngine.test.ts`

**Pure helper tests (no mocking):**

- `parseArrayTypeDimension()` - integer literals, empty dimensions
- `resolveBaseType()` - primitive, scoped, global, qualified, user types

**Orchestration tests (mock callbacks):**

- `register()` - global variables, scope members
- Const value tracking
- String include requirement

### Existing Integration Tests

`src/transpiler/output/codegen/__tests__/TrackVariableTypeHelpers.test.ts` provides regression safety - all tests should continue passing after extraction.

### Coverage Target

≥80% per SonarCloud requirements.

## Migration Steps

1. Create `TypeRegistrationEngine.ts` with full implementation
2. Add unit tests for pure helpers
3. Add unit tests for orchestration (with mocks)
4. Update `CodeGenerator.ts` to delegate to engine
5. Verify existing integration tests pass
6. Run coverage check
7. Clean up any dead code in CodeGenerator

## Acceptance Criteria

- [x] Type registration logic extracted to dedicated class
- [x] CodeGenerator delegates to new class
- [x] All existing tests pass
- [x] Unit tests for extracted class with ≥80% coverage
- [x] No new SonarCloud issues
