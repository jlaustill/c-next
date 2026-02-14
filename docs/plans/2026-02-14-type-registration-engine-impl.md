# Type Registration Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract ~330 lines of type registration logic from CodeGenerator.ts to a dedicated TypeRegistrationEngine static class.

**Architecture:** Static class with 2 callbacks (tryEvaluateConstant, requireInclude). Pure helper methods for testability. Direct CodeGenState access for state management.

**Tech Stack:** TypeScript, Vitest, ANTLR4 parser contexts

---

## Task 1: Create TypeRegistrationEngine Skeleton

**Files:**

- Create: `src/transpiler/logic/analysis/TypeRegistrationEngine.ts`

**Step 1: Create the file with interface and class skeleton**

```typescript
/**
 * Type Registration Engine
 * Issue #791: Extracted from CodeGenerator to reduce file size
 *
 * Registers variable types from AST before code generation.
 * This ensures type information is available for .length and
 * other type-dependent operations regardless of declaration order.
 */

import * as Parser from "../parser/grammar/CNextParser.js";
import TIncludeHeader from "../../output/codegen/generators/TIncludeHeader.js";

/**
 * Callbacks required for type registration.
 * Minimizes coupling to CodeGenerator.
 */
interface ITypeRegistrationCallbacks {
  /** Evaluate a compile-time constant expression */
  tryEvaluateConstant: (ctx: Parser.ExpressionContext) => number | undefined;
  /** Request an include header */
  requireInclude: (header: TIncludeHeader) => void;
}

/**
 * Static class that registers variable types from the AST.
 * Called during Stage 2 of code generation, before generating any code.
 */
class TypeRegistrationEngine {
  /**
   * Entry point: Register all variable types from the program tree.
   */
  static register(
    _tree: Parser.ProgramContext,
    _callbacks: ITypeRegistrationCallbacks,
  ): void {
    // TODO: Implement
  }
}

export default TypeRegistrationEngine;
export type { ITypeRegistrationCallbacks };
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/transpiler/logic/analysis/TypeRegistrationEngine.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/transpiler/logic/analysis/TypeRegistrationEngine.ts
git commit -m "feat(#791): add TypeRegistrationEngine skeleton"
```

---

## Task 2: Add Pure Helper - parseArrayTypeDimension

**Files:**

- Modify: `src/transpiler/logic/analysis/TypeRegistrationEngine.ts`
- Create: `src/transpiler/logic/analysis/__tests__/TypeRegistrationEngine.test.ts`

**Step 1: Write the failing test**

```typescript
/**
 * Unit tests for TypeRegistrationEngine
 * Issue #791: Tests for extracted type registration logic
 */

import { describe, it, expect } from "vitest";
import TypeRegistrationEngine from "../TypeRegistrationEngine";
import CNextSourceParser from "../../parser/CNextSourceParser";

/**
 * Helper to parse a variable declaration and get its arrayType context
 */
function parseArrayType(source: string): Parser.ArrayTypeContext | null {
  const tree = CNextSourceParser.parse(source);
  const decl = tree.declaration(0)?.variableDeclaration();
  return decl?.type()?.arrayType() ?? null;
}

describe("TypeRegistrationEngine", () => {
  describe("parseArrayTypeDimension", () => {
    it("returns number for integer literal dimension", () => {
      const ctx = parseArrayType("u8[10] buffer;");
      expect(ctx).not.toBeNull();
      const result = TypeRegistrationEngine.parseArrayTypeDimension(ctx!);
      expect(result).toBe(10);
    });

    it("returns undefined for empty dimension", () => {
      const ctx = parseArrayType("u8[] buffer;");
      expect(ctx).not.toBeNull();
      const result = TypeRegistrationEngine.parseArrayTypeDimension(ctx!);
      expect(result).toBeUndefined();
    });

    it("returns undefined for non-numeric dimension", () => {
      const ctx = parseArrayType("u8[SIZE] buffer;");
      expect(ctx).not.toBeNull();
      const result = TypeRegistrationEngine.parseArrayTypeDimension(ctx!);
      expect(result).toBeUndefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/transpiler/logic/analysis/__tests__/TypeRegistrationEngine.test.ts`
Expected: FAIL with "parseArrayTypeDimension is not a function"

**Step 3: Implement parseArrayTypeDimension**

Add to TypeRegistrationEngine class:

```typescript
  /**
   * Parse array dimension from arrayType context.
   * Returns the numeric size, or undefined if not a simple integer literal.
   */
  static parseArrayTypeDimension(
    arrayTypeCtx: Parser.ArrayTypeContext,
  ): number | undefined {
    const dims = arrayTypeCtx.arrayTypeDimension();
    if (dims.length === 0) {
      return undefined;
    }
    const sizeExpr = dims[0].expression();
    if (!sizeExpr) {
      return undefined;
    }
    const size = Number.parseInt(sizeExpr.getText(), 10);
    return Number.isNaN(size) ? undefined : size;
  }
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/transpiler/logic/analysis/__tests__/TypeRegistrationEngine.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/transpiler/logic/analysis/TypeRegistrationEngine.ts \
        src/transpiler/logic/analysis/__tests__/TypeRegistrationEngine.test.ts
git commit -m "feat(#791): add parseArrayTypeDimension pure helper"
```

---

## Task 3: Add Pure Helper - resolveBaseType

**Files:**

- Modify: `src/transpiler/logic/analysis/TypeRegistrationEngine.ts`
- Modify: `src/transpiler/logic/analysis/__tests__/TypeRegistrationEngine.test.ts`

**Step 1: Write the failing tests**

Add to the test file:

```typescript
import * as Parser from "../../parser/grammar/CNextParser";

/**
 * Helper to parse a variable declaration and get its type context
 */
function parseTypeContext(source: string): Parser.TypeContext | null {
  const tree = CNextSourceParser.parse(source);
  const decl = tree.declaration(0)?.variableDeclaration();
  return decl?.type() ?? null;
}

describe("resolveBaseType", () => {
  it("resolves primitive types", () => {
    const ctx = parseTypeContext("u32 counter;");
    expect(ctx).not.toBeNull();
    const result = TypeRegistrationEngine.resolveBaseType(ctx!, null);
    expect(result).toBe("u32");
  });

  it("resolves scoped types with currentScope", () => {
    const ctx = parseTypeContext("this.State value;");
    expect(ctx).not.toBeNull();
    const result = TypeRegistrationEngine.resolveBaseType(ctx!, "Motor");
    expect(result).toBe("Motor_State");
  });

  it("resolves scoped types without currentScope", () => {
    const ctx = parseTypeContext("this.State value;");
    expect(ctx).not.toBeNull();
    const result = TypeRegistrationEngine.resolveBaseType(ctx!, null);
    expect(result).toBe("State");
  });

  it("resolves user types", () => {
    const ctx = parseTypeContext("Point origin;");
    expect(ctx).not.toBeNull();
    const result = TypeRegistrationEngine.resolveBaseType(ctx!, null);
    expect(result).toBe("Point");
  });

  it("returns null for string types", () => {
    const ctx = parseTypeContext("string<64> buffer;");
    expect(ctx).not.toBeNull();
    const result = TypeRegistrationEngine.resolveBaseType(ctx!, null);
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/transpiler/logic/analysis/__tests__/TypeRegistrationEngine.test.ts`
Expected: FAIL with "resolveBaseType is not a function"

**Step 3: Implement resolveBaseType**

Add to TypeRegistrationEngine class:

```typescript
  /**
   * Resolve base type name from a type context.
   * Handles primitive, scoped (this.Type), global, qualified, and user types.
   * Returns null for special types like string<N> that need separate handling.
   */
  static resolveBaseType(
    typeCtx: Parser.TypeContext,
    currentScope: string | null,
  ): string | null {
    if (typeCtx.primitiveType()) {
      return typeCtx.primitiveType()!.getText();
    }

    if (typeCtx.scopedType()) {
      // ADR-016: Handle this.Type for scoped types (e.g., this.State -> Motor_State)
      const typeName = typeCtx.scopedType()!.IDENTIFIER().getText();
      return currentScope ? `${currentScope}_${typeName}` : typeName;
    }

    if (typeCtx.globalType()) {
      // Issue #478: Handle global.Type for global types inside scope
      return typeCtx.globalType()!.IDENTIFIER().getText();
    }

    if (typeCtx.qualifiedType()) {
      // ADR-016: Handle Scope.Type from outside scope
      const identifiers = typeCtx.qualifiedType()!.IDENTIFIER();
      return identifiers.map((id) => id.getText()).join("_");
    }

    if (typeCtx.userType()) {
      return typeCtx.userType()!.getText();
    }

    // String types and array types are handled separately
    return null;
  }
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/transpiler/logic/analysis/__tests__/TypeRegistrationEngine.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/transpiler/logic/analysis/TypeRegistrationEngine.ts \
        src/transpiler/logic/analysis/__tests__/TypeRegistrationEngine.test.ts
git commit -m "feat(#791): add resolveBaseType pure helper"
```

---

## Task 4: Add Imports and Dependencies

**Files:**

- Modify: `src/transpiler/logic/analysis/TypeRegistrationEngine.ts`

**Step 1: Add all required imports**

Update the imports section:

```typescript
import * as Parser from "../parser/grammar/CNextParser.js";
import TIncludeHeader from "../../output/codegen/generators/TIncludeHeader.js";
import TOverflowBehavior from "../../output/codegen/types/TOverflowBehavior.js";
import TYPE_WIDTH from "../../output/codegen/types/TYPE_WIDTH.js";
import CodeGenState from "../../state/CodeGenState.js";
import TypeRegistrationUtils from "../../output/codegen/TypeRegistrationUtils.js";
import QualifiedNameGenerator from "../../output/codegen/QualifiedNameGenerator.js";
import ArrayDimensionParser from "../../output/codegen/ArrayDimensionParser.js";
```

**Step 2: Verify imports compile**

Run: `npx tsc --noEmit src/transpiler/logic/analysis/TypeRegistrationEngine.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/transpiler/logic/analysis/TypeRegistrationEngine.ts
git commit -m "feat(#791): add TypeRegistrationEngine imports"
```

---

## Task 5: Implement Core Registration Methods

**Files:**

- Modify: `src/transpiler/logic/analysis/TypeRegistrationEngine.ts`

**Step 1: Implement register() entry point**

```typescript
  /**
   * Entry point: Register all variable types from the program tree.
   */
  static register(
    tree: Parser.ProgramContext,
    callbacks: ITypeRegistrationCallbacks,
  ): void {
    for (const decl of tree.declaration()) {
      // Register global variable types
      if (decl.variableDeclaration()) {
        TypeRegistrationEngine.registerGlobalVariable(
          decl.variableDeclaration()!,
          callbacks,
        );
      }

      // Register scope member variable types
      if (decl.scopeDeclaration()) {
        TypeRegistrationEngine.registerScopeMemberTypes(
          decl.scopeDeclaration()!,
          callbacks,
        );
      }
    }
  }
```

**Step 2: Implement registerGlobalVariable()**

```typescript
  /**
   * Register a global variable type and track const values.
   */
  static registerGlobalVariable(
    varDecl: Parser.VariableDeclarationContext,
    callbacks: ITypeRegistrationCallbacks,
  ): void {
    TypeRegistrationEngine._trackVariableType(varDecl, callbacks);

    // Bug #8: Track const values for array size resolution at file scope
    if (varDecl.constModifier() && varDecl.expression()) {
      const constName = varDecl.IDENTIFIER().getText();
      const constValue = callbacks.tryEvaluateConstant(varDecl.expression()!);
      if (constValue !== undefined) {
        CodeGenState.constValues.set(constName, constValue);
      }
    }
  }
```

**Step 3: Implement registerScopeMemberTypes()**

```typescript
  /**
   * Register scope member variable types.
   */
  static registerScopeMemberTypes(
    scopeDecl: Parser.ScopeDeclarationContext,
    callbacks: ITypeRegistrationCallbacks,
  ): void {
    const scopeName = scopeDecl.IDENTIFIER().getText();

    // Set currentScope so that this.Type references resolve correctly
    const savedScope = CodeGenState.currentScope;
    CodeGenState.currentScope = scopeName;

    for (const member of scopeDecl.scopeMember()) {
      if (member.variableDeclaration()) {
        const varDecl = member.variableDeclaration()!;
        const varName = varDecl.IDENTIFIER().getText();
        const fullName = QualifiedNameGenerator.forMember(scopeName, varName);
        // Register with mangled name (Scope_variable)
        TypeRegistrationEngine._trackVariableTypeWithName(
          varDecl,
          fullName,
          callbacks,
        );
      }
    }

    // Restore previous scope
    CodeGenState.currentScope = savedScope;
  }
```

**Step 4: Verify file compiles**

Run: `npx tsc --noEmit src/transpiler/logic/analysis/TypeRegistrationEngine.ts`
Expected: No errors (may have unused method warnings, that's fine for now)

**Step 5: Commit**

```bash
git add src/transpiler/logic/analysis/TypeRegistrationEngine.ts
git commit -m "feat(#791): add core registration methods"
```

---

## Task 6: Implement Private Tracking Methods

**Files:**

- Modify: `src/transpiler/logic/analysis/TypeRegistrationEngine.ts`

**Step 1: Add \_trackVariableType**

```typescript
  /**
   * Extract type info from a variable declaration and register it.
   * Delegates to _trackVariableTypeWithName using the variable's identifier.
   */
  private static _trackVariableType(
    varDecl: Parser.VariableDeclarationContext,
    callbacks: ITypeRegistrationCallbacks,
  ): void {
    const name = varDecl.IDENTIFIER().getText();
    TypeRegistrationEngine._trackVariableTypeWithName(varDecl, name, callbacks);
  }
```

**Step 2: Add \_trackVariableTypeWithName**

```typescript
  /**
   * Track variable type with a specific name (for namespace/class members).
   * This allows tracking with mangled names for proper scope resolution.
   */
  private static _trackVariableTypeWithName(
    varDecl: Parser.VariableDeclarationContext,
    registryName: string,
    callbacks: ITypeRegistrationCallbacks,
  ): void {
    const typeCtx = varDecl.type();
    const arrayDim = varDecl.arrayDimension();
    const isConst = varDecl.constModifier() !== null;

    // ADR-044: Extract overflow modifier (clamp is default)
    const overflowMod = varDecl.overflowModifier();
    const overflowBehavior: TOverflowBehavior =
      overflowMod?.getText() === "wrap" ? "wrap" : "clamp";

    // ADR-049: Extract atomic modifier
    const isAtomic = varDecl.atomicModifier() !== null;

    // ADR-045: Handle bounded string type first (special case)
    if (
      TypeRegistrationEngine._tryRegisterStringType(
        registryName,
        typeCtx,
        arrayDim,
        isConst,
        overflowBehavior,
        isAtomic,
        callbacks,
      )
    ) {
      return;
    }

    // Handle array type syntax: u8[10]
    if (typeCtx.arrayType()) {
      TypeRegistrationEngine._registerArrayTypeVariable(
        registryName,
        typeCtx.arrayType()!,
        arrayDim,
        isConst,
        overflowBehavior,
        isAtomic,
        callbacks,
      );
      return;
    }

    // Resolve base type from context
    const baseType = TypeRegistrationEngine.resolveBaseType(
      typeCtx,
      CodeGenState.currentScope,
    );
    if (!baseType) {
      return;
    }

    // ADR-017/ADR-034: Check if enum or bitmap type
    if (
      TypeRegistrationEngine._tryRegisterEnumOrBitmapType(
        registryName,
        baseType,
        isConst,
        arrayDim,
        overflowBehavior,
        isAtomic,
        callbacks,
      )
    ) {
      return;
    }

    // Standard type registration
    TypeRegistrationEngine._registerStandardType(
      registryName,
      baseType,
      arrayDim,
      isConst,
      overflowBehavior,
      isAtomic,
      callbacks,
    );
  }
```

**Step 3: Verify file compiles**

Run: `npx tsc --noEmit src/transpiler/logic/analysis/TypeRegistrationEngine.ts`
Expected: No errors (missing private methods expected - we'll add them next)

**Step 4: Commit**

```bash
git add src/transpiler/logic/analysis/TypeRegistrationEngine.ts
git commit -m "feat(#791): add private tracking methods"
```

---

## Task 7: Implement String Type Registration

**Files:**

- Modify: `src/transpiler/logic/analysis/TypeRegistrationEngine.ts`

**Step 1: Add \_tryRegisterStringType**

```typescript
  /**
   * Register a string type in the type registry.
   * Returns true if registration was successful.
   */
  private static _tryRegisterStringType(
    registryName: string,
    typeCtx: Parser.TypeContext,
    arrayDim: Parser.ArrayDimensionContext[] | null,
    isConst: boolean,
    overflowBehavior: TOverflowBehavior,
    isAtomic: boolean,
    callbacks: ITypeRegistrationCallbacks,
  ): boolean {
    const stringCtx = typeCtx.stringType();
    if (!stringCtx) {
      return false;
    }

    const intLiteral = stringCtx.INTEGER_LITERAL();
    if (!intLiteral) {
      return false;
    }

    const capacity = Number.parseInt(intLiteral.getText(), 10);
    callbacks.requireInclude("string");
    const stringDim = capacity + 1;

    // Check if there are additional array dimensions (e.g., [4] in string<64> arr[4])
    const additionalDims = ArrayDimensionParser.parseSimpleDimensions(arrayDim);
    const allDims =
      additionalDims.length > 0 ? [...additionalDims, stringDim] : [stringDim];

    CodeGenState.setVariableTypeInfo(registryName, {
      baseType: "char",
      bitWidth: 8,
      isArray: true,
      arrayDimensions: allDims,
      isConst,
      isString: true,
      stringCapacity: capacity,
      overflowBehavior,
      isAtomic,
    });
    return true;
  }
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/transpiler/logic/analysis/TypeRegistrationEngine.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/transpiler/logic/analysis/TypeRegistrationEngine.ts
git commit -m "feat(#791): add string type registration"
```

---

## Task 8: Implement Array Type and Standard Registration

**Files:**

- Modify: `src/transpiler/logic/analysis/TypeRegistrationEngine.ts`

**Step 1: Add \_registerArrayTypeVariable**

```typescript
  /**
   * Register an array type variable (u8[10] syntax).
   */
  private static _registerArrayTypeVariable(
    registryName: string,
    arrayTypeCtx: Parser.ArrayTypeContext,
    arrayDim: Parser.ArrayDimensionContext[] | null,
    isConst: boolean,
    overflowBehavior: TOverflowBehavior,
    isAtomic: boolean,
    callbacks: ITypeRegistrationCallbacks,
  ): void {
    let baseType = "";
    let bitWidth = 0;

    if (arrayTypeCtx.primitiveType()) {
      baseType = arrayTypeCtx.primitiveType()!.getText();
      bitWidth = TYPE_WIDTH[baseType] || 0;
    } else if (arrayTypeCtx.userType()) {
      baseType = arrayTypeCtx.userType()!.getText();

      const combinedArrayDim = arrayDim ?? [];

      // Check if this is an enum or bitmap type
      if (
        TypeRegistrationEngine._tryRegisterEnumOrBitmapType(
          registryName,
          baseType,
          isConst,
          combinedArrayDim,
          overflowBehavior,
          isAtomic,
          callbacks,
        )
      ) {
        // Update with arrayType dimension
        const existingInfo = CodeGenState.getVariableTypeInfo(registryName);
        if (existingInfo) {
          const arrayTypeDim =
            TypeRegistrationEngine.parseArrayTypeDimension(arrayTypeCtx);
          const allDims = arrayTypeDim
            ? [arrayTypeDim, ...(existingInfo.arrayDimensions ?? [])]
            : existingInfo.arrayDimensions;
          CodeGenState.setVariableTypeInfo(registryName, {
            ...existingInfo,
            isArray: true,
            arrayDimensions: allDims,
          });
        }
        return;
      }
    }

    if (!baseType) {
      return;
    }

    const arrayDimensions = TypeRegistrationEngine._collectArrayDimensions(
      arrayTypeCtx,
      arrayDim,
      callbacks,
    );

    CodeGenState.setVariableTypeInfo(registryName, {
      baseType,
      bitWidth,
      isArray: true,
      arrayDimensions: arrayDimensions.length > 0 ? arrayDimensions : undefined,
      isConst,
      overflowBehavior,
      isAtomic,
    });
  }
```

**Step 2: Add \_collectArrayDimensions**

```typescript
  /**
   * Collect array dimensions from array type and additional dimensions.
   */
  private static _collectArrayDimensions(
    arrayTypeCtx: Parser.ArrayTypeContext,
    arrayDim: Parser.ArrayDimensionContext[] | null,
    callbacks: ITypeRegistrationCallbacks,
  ): number[] {
    const arrayDimensions: number[] = [];

    // Get all dimensions from array type syntax (supports multi-dimensional)
    for (const dim of arrayTypeCtx.arrayTypeDimension()) {
      const sizeExpr = dim.expression();
      if (sizeExpr) {
        const size = Number.parseInt(sizeExpr.getText(), 10);
        if (!Number.isNaN(size)) {
          arrayDimensions.push(size);
        }
      }
    }

    // Add additional dimensions using const evaluation
    const additionalDims = TypeRegistrationEngine._evaluateArrayDimensions(
      arrayDim,
      callbacks,
    );
    if (additionalDims) {
      arrayDimensions.push(...additionalDims);
    }

    return arrayDimensions;
  }
```

**Step 3: Add \_evaluateArrayDimensions**

```typescript
  /**
   * Evaluate array dimensions using const evaluation.
   */
  private static _evaluateArrayDimensions(
    arrayDim: Parser.ArrayDimensionContext[] | null,
    callbacks: ITypeRegistrationCallbacks,
  ): number[] | undefined {
    return ArrayDimensionParser.parseAllDimensions(arrayDim, {
      constValues: CodeGenState.constValues,
      typeWidths: TYPE_WIDTH,
      isKnownStruct: (name) => CodeGenState.isKnownStruct(name),
    });
  }
```

**Step 4: Add \_registerStandardType**

```typescript
  /**
   * Register a standard (non-array-syntax, non-special) type.
   */
  private static _registerStandardType(
    registryName: string,
    baseType: string,
    arrayDim: Parser.ArrayDimensionContext[] | null,
    isConst: boolean,
    overflowBehavior: TOverflowBehavior,
    isAtomic: boolean,
    callbacks: ITypeRegistrationCallbacks,
  ): void {
    const bitWidth = TYPE_WIDTH[baseType] || 0;
    // Issue #665: Check array syntax presence first, then try to resolve dimensions
    const isArray = arrayDim !== null && arrayDim.length > 0;
    const arrayDimensions = isArray
      ? TypeRegistrationEngine._evaluateArrayDimensions(arrayDim, callbacks)
      : undefined;

    CodeGenState.setVariableTypeInfo(registryName, {
      baseType,
      bitWidth,
      isArray,
      arrayDimensions: isArray ? arrayDimensions : undefined,
      isConst,
      overflowBehavior,
      isAtomic,
    });
  }
```

**Step 5: Verify file compiles**

Run: `npx tsc --noEmit src/transpiler/logic/analysis/TypeRegistrationEngine.ts`
Expected: No errors

**Step 6: Commit**

```bash
git add src/transpiler/logic/analysis/TypeRegistrationEngine.ts
git commit -m "feat(#791): add array and standard type registration"
```

---

## Task 9: Implement Enum/Bitmap Registration

**Files:**

- Modify: `src/transpiler/logic/analysis/TypeRegistrationEngine.ts`

**Step 1: Add \_tryRegisterEnumOrBitmapType**

```typescript
  /**
   * Try to register a type as enum or bitmap. Returns true if handled.
   */
  private static _tryRegisterEnumOrBitmapType(
    name: string,
    baseType: string,
    isConst: boolean,
    arrayDim: Parser.ArrayDimensionContext[] | null,
    overflowBehavior: TOverflowBehavior,
    isAtomic: boolean,
    callbacks: ITypeRegistrationCallbacks,
  ): boolean {
    // Common options for type registration
    const registrationOptions = {
      name,
      baseType,
      isConst,
      overflowBehavior,
      isAtomic,
    };

    // ADR-017: Check if this is an enum type
    if (
      TypeRegistrationUtils.tryRegisterEnumType(
        CodeGenState.symbols!,
        registrationOptions,
      )
    ) {
      return true;
    }

    // ADR-034: Check if this is a bitmap type
    const bitmapDimensions = TypeRegistrationEngine._evaluateArrayDimensions(
      arrayDim,
      callbacks,
    );
    if (
      TypeRegistrationUtils.tryRegisterBitmapType(
        CodeGenState.symbols!,
        registrationOptions,
        bitmapDimensions,
      )
    ) {
      return true;
    }

    return false;
  }
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/transpiler/logic/analysis/TypeRegistrationEngine.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/transpiler/logic/analysis/TypeRegistrationEngine.ts
git commit -m "feat(#791): add enum/bitmap type registration"
```

---

## Task 10: Wire Up CodeGenerator to Use Engine

**Files:**

- Modify: `src/transpiler/output/codegen/CodeGenerator.ts`

**Step 1: Add import for TypeRegistrationEngine**

Add near the top imports:

```typescript
import TypeRegistrationEngine from "../../logic/analysis/TypeRegistrationEngine.js";
```

**Step 2: Update registerAllVariableTypes to delegate**

Find the existing `registerAllVariableTypes` method and replace the body with delegation:

```typescript
  private registerAllVariableTypes(tree: Parser.ProgramContext): void {
    TypeRegistrationEngine.register(tree, {
      tryEvaluateConstant: (ctx) => this.tryEvaluateConstant(ctx),
      requireInclude: (header) => this.requireInclude(header),
    });
  }
```

**Step 3: Run existing integration tests**

Run: `npm test -- tests/transpiler/output/codegen/__tests__/TrackVariableTypeHelpers.test.ts`
Expected: All tests pass (regression safety)

**Step 4: Commit**

```bash
git add src/transpiler/output/codegen/CodeGenerator.ts
git commit -m "feat(#791): wire CodeGenerator to use TypeRegistrationEngine"
```

---

## Task 11: Run Full Test Suite

**Files:**

- None (verification only)

**Step 1: Run all unit tests**

Run: `npm run unit`
Expected: All tests pass

**Step 2: Run all integration tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Run coverage check**

Run: `npm run unit:coverage`
Expected: TypeRegistrationEngine.ts should have ≥80% coverage from existing integration tests

**Step 4: Commit if all pass**

```bash
git commit --allow-empty -m "test(#791): verify all tests pass after extraction"
```

---

## Task 12: Remove Dead Code from CodeGenerator

**Files:**

- Modify: `src/transpiler/output/codegen/CodeGenerator.ts`

**Step 1: Identify dead methods**

The following methods can now be removed from CodeGenerator (they were moved to TypeRegistrationEngine):

- `registerGlobalVariableType` (private)
- `registerScopeMemberTypes` (private)
- `trackVariableType` (private)
- `trackVariableTypeWithName` (private)
- `tryRegisterStringType` (private)
- `_registerArrayTypeVariable` (private)
- `_parseArrayTypeDimensionFromCtx` (private)
- `_collectArrayDimensions` (private)
- `_registerStandardType` (private)
- `extractArrayDimensionsSimple` (private)
- `resolveBaseTypeFromContext` (private)
- `_tryRegisterEnumOrBitmapType` (private)

**Step 2: Remove dead methods one at a time**

Remove each method and verify compilation between removals.

**Step 3: Run tests after cleanup**

Run: `npm test`
Expected: All tests pass

**Step 4: Commit cleanup**

```bash
git add src/transpiler/output/codegen/CodeGenerator.ts
git commit -m "refactor(#791): remove dead type registration methods from CodeGenerator"
```

---

## Task 13: Add Unit Tests for Orchestration

**Files:**

- Modify: `src/transpiler/logic/analysis/__tests__/TypeRegistrationEngine.test.ts`

**Step 1: Add orchestration tests with mocks**

```typescript
import { vi, beforeEach, afterEach } from "vitest";
import CodeGenState from "../../../state/CodeGenState";

describe("register orchestration", () => {
  const mockCallbacks = {
    tryEvaluateConstant: vi.fn(),
    requireInclude: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    CodeGenState.reset();
  });

  afterEach(() => {
    CodeGenState.reset();
  });

  it("registers global variable types", () => {
    const source = `u32 counter;`;
    const tree = CNextSourceParser.parse(source);

    TypeRegistrationEngine.register(tree, mockCallbacks);

    const info = CodeGenState.getVariableTypeInfo("counter");
    expect(info).not.toBeNull();
    expect(info?.baseType).toBe("u32");
    expect(info?.bitWidth).toBe(32);
  });

  it("tracks const values", () => {
    mockCallbacks.tryEvaluateConstant.mockReturnValue(10);
    const source = `const u32 SIZE <- 10;`;
    const tree = CNextSourceParser.parse(source);

    TypeRegistrationEngine.register(tree, mockCallbacks);

    expect(CodeGenState.constValues.get("SIZE")).toBe(10);
  });

  it("requires string include for string types", () => {
    const source = `string<64> message;`;
    const tree = CNextSourceParser.parse(source);

    TypeRegistrationEngine.register(tree, mockCallbacks);

    expect(mockCallbacks.requireInclude).toHaveBeenCalledWith("string");
  });
});
```

**Step 2: Run new tests**

Run: `npm run unit -- src/transpiler/logic/analysis/__tests__/TypeRegistrationEngine.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/transpiler/logic/analysis/__tests__/TypeRegistrationEngine.test.ts
git commit -m "test(#791): add orchestration unit tests for TypeRegistrationEngine"
```

---

## Task 14: Final Verification and PR

**Files:**

- None (verification only)

**Step 1: Run all quality checks**

Run: `npm run prettier:fix && npm run oxlint:check`
Expected: No errors

**Step 2: Run full test suite with coverage**

Run: `npm run unit:coverage`
Expected: All tests pass, coverage ≥80% on new code

**Step 3: Run integration tests**

Run: `npm test`
Expected: All tests pass

**Step 4: Comment on GitHub issue**

```bash
gh issue comment 791 --body "Implementation complete. Created TypeRegistrationEngine with ~330 lines extracted from CodeGenerator. Ready for PR."
```

**Step 5: Create PR**

```bash
git push -u origin HEAD
gh pr create --title "refactor(#791): extract Type Registration Engine from CodeGenerator" --body "$(cat <<'EOF'
## Summary

Extracts the Type Registration Engine (~330 lines) from CodeGenerator.ts to a dedicated `TypeRegistrationEngine` static class.

- New class: `src/transpiler/logic/analysis/TypeRegistrationEngine.ts`
- Unit tests: `src/transpiler/logic/analysis/__tests__/TypeRegistrationEngine.test.ts`
- CodeGenerator now delegates to TypeRegistrationEngine

Closes #791

## Test plan

- [x] All existing integration tests pass (TrackVariableTypeHelpers.test.ts)
- [x] New unit tests for pure helpers (parseArrayTypeDimension, resolveBaseType)
- [x] New unit tests for orchestration (mock callbacks)
- [x] Coverage ≥80% on new code

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Summary

| Task | Description                     | Est. Steps |
| ---- | ------------------------------- | ---------- |
| 1    | Create skeleton                 | 3          |
| 2    | parseArrayTypeDimension helper  | 5          |
| 3    | resolveBaseType helper          | 5          |
| 4    | Add imports                     | 3          |
| 5    | Core registration methods       | 5          |
| 6    | Private tracking methods        | 4          |
| 7    | String type registration        | 3          |
| 8    | Array and standard registration | 6          |
| 9    | Enum/bitmap registration        | 3          |
| 10   | Wire CodeGenerator              | 4          |
| 11   | Full test suite                 | 4          |
| 12   | Remove dead code                | 4          |
| 13   | Orchestration tests             | 3          |
| 14   | Final verification and PR       | 5          |

**Total: 14 tasks, ~57 steps**
