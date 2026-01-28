# CallExprUtils Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract pure functions from CallExprGenerator.ts into a testable CallExprUtils module with comprehensive unit tests.

**Architecture:** Create `CallExprUtils.ts` in `src/codegen/generators/expressions/` containing pure utility functions (`mapTypeToCType`, `isSmallPrimitiveType`, `generateSafeDivModHelperName`). Update `CallExprGenerator.ts` to import and use these utilities. Write unit tests for the extracted functions.

**Tech Stack:** TypeScript, Vitest

---

## Task 1: Create CallExprUtils Module with mapTypeToCType

**Files:**

- Create: `src/codegen/generators/expressions/CallExprUtils.ts`
- Create: `src/codegen/generators/expressions/__tests__/CallExprUtils.test.ts`

**Step 1: Write the failing test**

```typescript
// src/codegen/generators/expressions/__tests__/CallExprUtils.test.ts
import { describe, it, expect } from "vitest";
import CallExprUtils from "../CallExprUtils";

describe("CallExprUtils", () => {
  describe("mapTypeToCType", () => {
    it("maps unsigned integer types", () => {
      expect(CallExprUtils.mapTypeToCType("u8")).toBe("uint8_t");
      expect(CallExprUtils.mapTypeToCType("u16")).toBe("uint16_t");
      expect(CallExprUtils.mapTypeToCType("u32")).toBe("uint32_t");
      expect(CallExprUtils.mapTypeToCType("u64")).toBe("uint64_t");
    });

    it("maps signed integer types", () => {
      expect(CallExprUtils.mapTypeToCType("i8")).toBe("int8_t");
      expect(CallExprUtils.mapTypeToCType("i16")).toBe("int16_t");
      expect(CallExprUtils.mapTypeToCType("i32")).toBe("int32_t");
      expect(CallExprUtils.mapTypeToCType("i64")).toBe("int64_t");
    });

    it("maps float types", () => {
      expect(CallExprUtils.mapTypeToCType("f32")).toBe("float");
      expect(CallExprUtils.mapTypeToCType("f64")).toBe("double");
    });

    it("maps bool type", () => {
      expect(CallExprUtils.mapTypeToCType("bool")).toBe("bool");
    });

    it("returns unknown types unchanged", () => {
      expect(CallExprUtils.mapTypeToCType("MyStruct")).toBe("MyStruct");
      expect(CallExprUtils.mapTypeToCType("CustomType")).toBe("CustomType");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/CallExprUtils.test.ts`

Expected: FAIL - Cannot find module '../CallExprUtils'

**Step 3: Write minimal implementation**

```typescript
// src/codegen/generators/expressions/CallExprUtils.ts
/**
 * Pure utility functions for function call expression generation.
 * Extracted from CallExprGenerator for testability (Issue #420).
 */

/**
 * Issue #304: C-Next type to C type mapping for static_cast.
 */
const TYPE_MAP: Record<string, string> = {
  u8: "uint8_t",
  u16: "uint16_t",
  u32: "uint32_t",
  u64: "uint64_t",
  i8: "int8_t",
  i16: "int16_t",
  i32: "int32_t",
  i64: "int64_t",
  f32: "float",
  f64: "double",
  bool: "bool",
};

class CallExprUtils {
  /**
   * Issue #304: Map C-Next type to C type for static_cast.
   * Returns the input unchanged if not a known C-Next primitive type.
   */
  static mapTypeToCType(cnxType: string): string {
    return TYPE_MAP[cnxType] || cnxType;
  }
}

export default CallExprUtils;
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/CallExprUtils.test.ts`

Expected: PASS (all 5 tests)

**Step 5: Commit**

Message: `feat(#420): add CallExprUtils with mapTypeToCType`

---

## Task 2: Add isSmallPrimitiveType

**Files:**

- Modify: `src/codegen/generators/expressions/CallExprUtils.ts`
- Modify: `src/codegen/generators/expressions/__tests__/CallExprUtils.test.ts`

**Step 1: Write the failing tests**

Add to the test file:

```typescript
describe("isSmallPrimitiveType", () => {
  it("returns true for small unsigned types", () => {
    expect(CallExprUtils.isSmallPrimitiveType("u8")).toBe(true);
    expect(CallExprUtils.isSmallPrimitiveType("u16")).toBe(true);
  });

  it("returns true for small signed types", () => {
    expect(CallExprUtils.isSmallPrimitiveType("i8")).toBe(true);
    expect(CallExprUtils.isSmallPrimitiveType("i16")).toBe(true);
  });

  it("returns true for bool", () => {
    expect(CallExprUtils.isSmallPrimitiveType("bool")).toBe(true);
  });

  it("returns false for larger types", () => {
    expect(CallExprUtils.isSmallPrimitiveType("u32")).toBe(false);
    expect(CallExprUtils.isSmallPrimitiveType("u64")).toBe(false);
    expect(CallExprUtils.isSmallPrimitiveType("i32")).toBe(false);
    expect(CallExprUtils.isSmallPrimitiveType("i64")).toBe(false);
  });

  it("returns false for float types", () => {
    expect(CallExprUtils.isSmallPrimitiveType("f32")).toBe(false);
    expect(CallExprUtils.isSmallPrimitiveType("f64")).toBe(false);
  });

  it("returns false for struct/custom types", () => {
    expect(CallExprUtils.isSmallPrimitiveType("MyStruct")).toBe(false);
    expect(CallExprUtils.isSmallPrimitiveType("CustomType")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/CallExprUtils.test.ts`

Expected: FAIL - isSmallPrimitiveType is not a function

**Step 3: Write minimal implementation**

Add to `CallExprUtils.ts` before the class:

```typescript
/**
 * Issue #315: Small primitive types that are always passed by value.
 * These match the types used in Issue #269 for pass-by-value optimization.
 */
const SMALL_PRIMITIVE_TYPES = new Set(["u8", "u16", "i8", "i16", "bool"]);
```

Add to the class:

```typescript
  /**
   * Issue #315: Check if a type is a small primitive that should be passed by value.
   * Used for cross-file function calls where modification info is unavailable.
   */
  static isSmallPrimitiveType(typeName: string): boolean {
    return SMALL_PRIMITIVE_TYPES.has(typeName);
  }
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/CallExprUtils.test.ts`

Expected: PASS

**Step 5: Commit**

Message: `feat(#420): add isSmallPrimitiveType to CallExprUtils (Issue #315)`

---

## Task 3: Add generateSafeDivModHelperName

**Files:**

- Modify: `src/codegen/generators/expressions/CallExprUtils.ts`
- Modify: `src/codegen/generators/expressions/__tests__/CallExprUtils.test.ts`

**Step 1: Write the failing tests**

Add to the test file:

```typescript
describe("generateSafeDivModHelperName", () => {
  it("generates safe_div helper name", () => {
    expect(CallExprUtils.generateSafeDivModHelperName("safe_div", "u32")).toBe(
      "cnx_safe_div_u32",
    );
    expect(CallExprUtils.generateSafeDivModHelperName("safe_div", "i64")).toBe(
      "cnx_safe_div_i64",
    );
  });

  it("generates safe_mod helper name", () => {
    expect(CallExprUtils.generateSafeDivModHelperName("safe_mod", "u32")).toBe(
      "cnx_safe_mod_u32",
    );
    expect(CallExprUtils.generateSafeDivModHelperName("safe_mod", "i16")).toBe(
      "cnx_safe_mod_i16",
    );
  });

  it("works with all integer types", () => {
    expect(CallExprUtils.generateSafeDivModHelperName("safe_div", "u8")).toBe(
      "cnx_safe_div_u8",
    );
    expect(CallExprUtils.generateSafeDivModHelperName("safe_mod", "u16")).toBe(
      "cnx_safe_mod_u16",
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/CallExprUtils.test.ts`

Expected: FAIL - generateSafeDivModHelperName is not a function

**Step 3: Write minimal implementation**

Add to the class:

```typescript
  /**
   * ADR-051: Generate the helper function name for safe_div/safe_mod.
   */
  static generateSafeDivModHelperName(
    funcName: "safe_div" | "safe_mod",
    cnxType: string,
  ): string {
    const op = funcName === "safe_div" ? "div" : "mod";
    return `cnx_safe_${op}_${cnxType}`;
  }
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/CallExprUtils.test.ts`

Expected: PASS

**Step 5: Commit**

Message: `feat(#420): add generateSafeDivModHelperName to CallExprUtils (ADR-051)`

---

## Task 4: Add generateStaticCast

**Files:**

- Modify: `src/codegen/generators/expressions/CallExprUtils.ts`
- Modify: `src/codegen/generators/expressions/__tests__/CallExprUtils.test.ts`

**Step 1: Write the failing tests**

Add to the test file:

```typescript
describe("generateStaticCast", () => {
  it("wraps code with static_cast for C-Next types", () => {
    expect(CallExprUtils.generateStaticCast("MyEnum::Value", "u32")).toBe(
      "static_cast<uint32_t>(MyEnum::Value)",
    );
    expect(CallExprUtils.generateStaticCast("val", "i8")).toBe(
      "static_cast<int8_t>(val)",
    );
  });

  it("uses C type names in cast", () => {
    expect(CallExprUtils.generateStaticCast("x", "u8")).toBe(
      "static_cast<uint8_t>(x)",
    );
    expect(CallExprUtils.generateStaticCast("x", "f32")).toBe(
      "static_cast<float>(x)",
    );
  });

  it("passes through unknown types", () => {
    expect(CallExprUtils.generateStaticCast("x", "CustomType")).toBe(
      "static_cast<CustomType>(x)",
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/CallExprUtils.test.ts`

Expected: FAIL - generateStaticCast is not a function

**Step 3: Write minimal implementation**

Add to the class:

```typescript
  /**
   * Issue #304: Generate a C++ static_cast expression.
   * Used for enum class to integer conversions.
   */
  static generateStaticCast(code: string, targetType: string): string {
    const cType = CallExprUtils.mapTypeToCType(targetType);
    return `static_cast<${cType}>(${code})`;
  }
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/CallExprUtils.test.ts`

Expected: PASS

**Step 5: Commit**

Message: `feat(#420): add generateStaticCast to CallExprUtils (Issue #304)`

---

## Task 5: Update CallExprGenerator to Use CallExprUtils

**Files:**

- Modify: `src/codegen/generators/expressions/CallExprGenerator.ts`

**Step 1: Run existing tests to establish baseline**

Run: `npm test -- tests/ && npm run unit`

Expected: All tests pass (baseline)

**Step 2: Add import**

At the top of `CallExprGenerator.ts`, add:

```typescript
import CallExprUtils from "./CallExprUtils";
```

**Step 3: Remove TYPE_MAP and mapTypeToCType**

Delete lines 21-40 (the `TYPE_MAP` constant and `mapTypeToCType` function).

**Step 4: Remove SMALL_PRIMITIVE_TYPES**

Delete line 48 (the `SMALL_PRIMITIVE_TYPES` constant).

**Step 5: Update wrapWithCppEnumCast**

Change line 73 from:

```typescript
const cType = mapTypeToCType(targetParamBaseType);
```

To:

```typescript
const cType = CallExprUtils.mapTypeToCType(targetParamBaseType);
```

**Step 6: Update SMALL_PRIMITIVE_TYPES usage**

Change line 210 from:

```typescript
SMALL_PRIMITIVE_TYPES.has(targetParam.baseType);
```

To:

```typescript
CallExprUtils.isSmallPrimitiveType(targetParam.baseType);
```

**Step 7: Update generateSafeDivMod helper name generation**

Change lines 290-293 from:

```typescript
const helperName =
  funcName === "safe_div"
    ? `cnx_safe_div_${cnxType}`
    : `cnx_safe_mod_${cnxType}`;
```

To:

```typescript
const helperName = CallExprUtils.generateSafeDivModHelperName(
  funcName as "safe_div" | "safe_mod",
  cnxType,
);
```

**Step 8: Run all tests to verify refactoring**

Run: `npm test -- tests/ && npm run unit`

Expected: All tests pass

**Step 9: Commit**

Message: `refactor(#420): use CallExprUtils in CallExprGenerator`

---

## Task 6: Final Verification and PR

**Step 1: Run full test suite**

Run: `npm run test:all`

Expected: All tests pass

**Step 2: Run linting**

Run: `npm run oxlint:check`

Expected: No new errors

**Step 3: Create PR**

Title: `feat(#420): Extract pure functions from CallExprGenerator into testable module`

Body:

```
## Summary
- Extracts 4 pure functions from CallExprGenerator.ts into CallExprUtils.ts
- Adds comprehensive unit tests for all extracted functions
- Updates CallExprGenerator to use the new utilities

## Functions Extracted
1. `mapTypeToCType` - Issue #304: C-Next to C type mapping for static_cast
2. `isSmallPrimitiveType` - Issue #315: Pass-by-value type detection
3. `generateSafeDivModHelperName` - ADR-051: Safe division helper names
4. `generateStaticCast` - Issue #304: C++ static_cast generation

## Test Plan
- [x] All new unit tests pass
- [x] All existing integration tests pass
- [x] Linting passes

Closes #420
```
