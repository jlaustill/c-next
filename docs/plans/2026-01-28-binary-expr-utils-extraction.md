# BinaryExprUtils Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract 6 pure functions from BinaryExprGenerator.ts into a testable BinaryExprUtils module with comprehensive unit tests.

**Architecture:** Create `BinaryExprUtils.ts` in `src/codegen/generators/expressions/` containing pure utility functions. Update `BinaryExprGenerator.ts` to import and use these utilities. Write unit tests in `__tests__/BinaryExprUtils.test.ts`.

**Tech Stack:** TypeScript, Vitest

---

## Task 1: Create BinaryExprUtils Module with tryParseNumericLiteral

**Files:**

- Create: `src/codegen/generators/expressions/BinaryExprUtils.ts`
- Create: `src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

**Step 1: Write the failing test**

```typescript
// src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts
import { describe, it, expect } from "vitest";
import BinaryExprUtils from "../BinaryExprUtils";

describe("BinaryExprUtils", () => {
  describe("tryParseNumericLiteral", () => {
    it("parses decimal integers", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("42")).toBe(42);
      expect(BinaryExprUtils.tryParseNumericLiteral("0")).toBe(0);
      expect(BinaryExprUtils.tryParseNumericLiteral("123456")).toBe(123456);
    });

    it("parses negative decimal integers", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("-1")).toBe(-1);
      expect(BinaryExprUtils.tryParseNumericLiteral("-42")).toBe(-42);
    });

    it("parses hex literals (0x prefix)", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("0xFF")).toBe(255);
      expect(BinaryExprUtils.tryParseNumericLiteral("0x0")).toBe(0);
      expect(BinaryExprUtils.tryParseNumericLiteral("0xDEAD")).toBe(0xdead);
      expect(BinaryExprUtils.tryParseNumericLiteral("0Xff")).toBe(255);
    });

    it("parses binary literals (0b prefix)", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("0b1010")).toBe(10);
      expect(BinaryExprUtils.tryParseNumericLiteral("0b0")).toBe(0);
      expect(BinaryExprUtils.tryParseNumericLiteral("0B1111")).toBe(15);
    });

    it("trims whitespace", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("  42  ")).toBe(42);
      expect(BinaryExprUtils.tryParseNumericLiteral("\t0xFF\n")).toBe(255);
    });

    it("returns undefined for non-numeric strings", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("abc")).toBeUndefined();
      expect(BinaryExprUtils.tryParseNumericLiteral("x + 1")).toBeUndefined();
      expect(BinaryExprUtils.tryParseNumericLiteral("")).toBeUndefined();
      expect(BinaryExprUtils.tryParseNumericLiteral("12.5")).toBeUndefined();
    });

    it("returns undefined for invalid hex/binary", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("0xGG")).toBeUndefined();
      expect(BinaryExprUtils.tryParseNumericLiteral("0b123")).toBeUndefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

Expected: FAIL - Cannot find module '../BinaryExprUtils'

**Step 3: Write minimal implementation**

```typescript
// src/codegen/generators/expressions/BinaryExprUtils.ts
/**
 * Pure utility functions for binary expression generation.
 * Extracted from BinaryExprGenerator for testability (Issue #419).
 */

/**
 * Issue #235: Try to parse a string as a numeric constant.
 * Returns the numeric value if it's a simple integer literal, undefined otherwise.
 * Handles decimal, hex (0x), and binary (0b) formats.
 */
const tryParseNumericLiteral = (code: string): number | undefined => {
  const trimmed = code.trim();

  // Decimal integer (including negative)
  if (/^-?\d+$/.exec(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  // Hex literal
  if (/^0[xX][0-9a-fA-F]+$/.exec(trimmed)) {
    return Number.parseInt(trimmed, 16);
  }

  // Binary literal
  if (/^0[bB][01]+$/.exec(trimmed)) {
    return Number.parseInt(trimmed.substring(2), 2);
  }

  return undefined;
};

class BinaryExprUtils {
  static tryParseNumericLiteral = tryParseNumericLiteral;
}

export default BinaryExprUtils;
```

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

Expected: PASS (all 7 tests)

**Step 5: Commit**

Message: `feat(#419): add BinaryExprUtils with tryParseNumericLiteral`

---

## Task 2: Add tryFoldConstants

**Files:**

- Modify: `src/codegen/generators/expressions/BinaryExprUtils.ts`
- Modify: `src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

**Step 1: Write the failing tests**

Add to the test file after the `tryParseNumericLiteral` describe block:

```typescript
describe("tryFoldConstants", () => {
  it("folds addition", () => {
    expect(BinaryExprUtils.tryFoldConstants(["2", "3"], ["+"])).toBe(5);
    expect(BinaryExprUtils.tryFoldConstants(["1", "2", "3"], ["+", "+"])).toBe(
      6,
    );
  });

  it("folds subtraction", () => {
    expect(BinaryExprUtils.tryFoldConstants(["10", "3"], ["-"])).toBe(7);
    expect(BinaryExprUtils.tryFoldConstants(["10", "3", "2"], ["-", "-"])).toBe(
      5,
    );
  });

  it("folds multiplication", () => {
    expect(BinaryExprUtils.tryFoldConstants(["4", "5"], ["*"])).toBe(20);
    expect(BinaryExprUtils.tryFoldConstants(["2", "3", "4"], ["*", "*"])).toBe(
      24,
    );
  });

  it("folds division with truncation toward zero", () => {
    expect(BinaryExprUtils.tryFoldConstants(["10", "3"], ["/"])).toBe(3);
    expect(BinaryExprUtils.tryFoldConstants(["7", "2"], ["/"])).toBe(3);
    expect(BinaryExprUtils.tryFoldConstants(["-7", "2"], ["/"])).toBe(-3);
  });

  it("folds modulo", () => {
    expect(BinaryExprUtils.tryFoldConstants(["10", "3"], ["%"])).toBe(1);
    expect(BinaryExprUtils.tryFoldConstants(["17", "5"], ["%"])).toBe(2);
  });

  it("folds mixed operations left-to-right", () => {
    expect(BinaryExprUtils.tryFoldConstants(["2", "3", "4"], ["+", "*"])).toBe(
      20,
    );
    expect(BinaryExprUtils.tryFoldConstants(["10", "2", "3"], ["-", "+"])).toBe(
      11,
    );
  });

  it("folds hex and binary literals", () => {
    expect(BinaryExprUtils.tryFoldConstants(["0xFF", "1"], ["+"])).toBe(256);
    expect(BinaryExprUtils.tryFoldConstants(["0b1010", "2"], ["*"])).toBe(20);
  });

  it("returns undefined for division by zero", () => {
    expect(
      BinaryExprUtils.tryFoldConstants(["10", "0"], ["/"]),
    ).toBeUndefined();
  });

  it("returns undefined for modulo by zero", () => {
    expect(
      BinaryExprUtils.tryFoldConstants(["10", "0"], ["%"]),
    ).toBeUndefined();
  });

  it("returns undefined when any operand is not numeric", () => {
    expect(BinaryExprUtils.tryFoldConstants(["x", "3"], ["+"])).toBeUndefined();
    expect(BinaryExprUtils.tryFoldConstants(["2", "y"], ["+"])).toBeUndefined();
    expect(
      BinaryExprUtils.tryFoldConstants(["a + b", "3"], ["+"]),
    ).toBeUndefined();
  });

  it("returns undefined for unknown operators", () => {
    expect(BinaryExprUtils.tryFoldConstants(["2", "3"], ["&"])).toBeUndefined();
    expect(
      BinaryExprUtils.tryFoldConstants(["2", "3"], ["<<"]),
    ).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

Expected: FAIL - tryFoldConstants is not a function

**Step 3: Write minimal implementation**

Add to `BinaryExprUtils.ts` before the class definition:

```typescript
/**
 * Issue #235: Evaluate a constant arithmetic expression.
 * Returns the result if all operands are numeric and evaluation succeeds,
 * undefined otherwise (falls back to non-folded code).
 */
const tryFoldConstants = (
  operandCodes: string[],
  operators: string[],
): number | undefined => {
  const values = operandCodes.map(tryParseNumericLiteral);

  if (values.some((v) => v === undefined)) {
    return undefined;
  }

  let result = values[0] as number;
  for (let i = 0; i < operators.length; i++) {
    const op = operators[i];
    const rightValue = values[i + 1] as number;

    switch (op) {
      case "*":
        result = result * rightValue;
        break;
      case "/":
        if (rightValue === 0) {
          return undefined;
        }
        result = Math.trunc(result / rightValue);
        break;
      case "%":
        if (rightValue === 0) {
          return undefined;
        }
        result = result % rightValue;
        break;
      case "+":
        result = result + rightValue;
        break;
      case "-":
        result = result - rightValue;
        break;
      default:
        return undefined;
    }
  }

  return result;
};
```

Update class to add the method.

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

Expected: PASS (all tests)

**Step 5: Commit**

Message: `feat(#419): add tryFoldConstants to BinaryExprUtils`

---

## Task 3: Add mapEqualityOperator

**Files:**

- Modify: `src/codegen/generators/expressions/BinaryExprUtils.ts`
- Modify: `src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

**Step 1: Write the failing tests**

Add to the test file:

```typescript
describe("mapEqualityOperator", () => {
  it("maps = to == (ADR-001)", () => {
    expect(BinaryExprUtils.mapEqualityOperator("=")).toBe("==");
  });

  it("preserves != unchanged", () => {
    expect(BinaryExprUtils.mapEqualityOperator("!=")).toBe("!=");
  });

  it("preserves other operators unchanged", () => {
    expect(BinaryExprUtils.mapEqualityOperator("<")).toBe("<");
    expect(BinaryExprUtils.mapEqualityOperator(">")).toBe(">");
    expect(BinaryExprUtils.mapEqualityOperator("<=")).toBe("<=");
    expect(BinaryExprUtils.mapEqualityOperator(">=")).toBe(">=");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

Expected: FAIL - mapEqualityOperator is not a function

**Step 3: Write minimal implementation**

Add to `BinaryExprUtils.ts`:

```typescript
/**
 * ADR-001: Map C-Next equality operator to C.
 * C-Next uses = for equality (mathematical notation), C uses ==.
 */
const mapEqualityOperator = (cnextOp: string): string =>
  cnextOp === "=" ? "==" : cnextOp;
```

Update class to add the method.

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

Expected: PASS

**Step 5: Commit**

Message: `feat(#419): add mapEqualityOperator to BinaryExprUtils (ADR-001)`

---

## Task 4: Add generateStrcmpCode

**Files:**

- Modify: `src/codegen/generators/expressions/BinaryExprUtils.ts`
- Modify: `src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

**Step 1: Write the failing tests**

Add to the test file:

```typescript
describe("generateStrcmpCode", () => {
  it("generates strcmp equality check", () => {
    expect(BinaryExprUtils.generateStrcmpCode("str1", "str2", false)).toBe(
      "strcmp(str1, str2) == 0",
    );
  });

  it("generates strcmp inequality check", () => {
    expect(BinaryExprUtils.generateStrcmpCode("str1", "str2", true)).toBe(
      "strcmp(str1, str2) != 0",
    );
  });

  it("handles complex expressions as operands", () => {
    expect(
      BinaryExprUtils.generateStrcmpCode("getName()", '"test"', false),
    ).toBe('strcmp(getName(), "test") == 0');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

Expected: FAIL - generateStrcmpCode is not a function

**Step 3: Write minimal implementation**

Add to `BinaryExprUtils.ts`:

```typescript
/**
 * ADR-045: Generate strcmp comparison code for string equality.
 */
const generateStrcmpCode = (
  left: string,
  right: string,
  isNotEqual: boolean,
): string => {
  const cmpOp = isNotEqual ? "!= 0" : "== 0";
  return `strcmp(${left}, ${right}) ${cmpOp}`;
};
```

Update class to add the method.

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

Expected: PASS

**Step 5: Commit**

Message: `feat(#419): add generateStrcmpCode to BinaryExprUtils (ADR-045)`

---

## Task 5: Add buildChainedExpression

**Files:**

- Modify: `src/codegen/generators/expressions/BinaryExprUtils.ts`
- Modify: `src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

**Step 1: Write the failing tests**

Add to the test file:

```typescript
describe("buildChainedExpression", () => {
  it("returns single operand unchanged", () => {
    expect(BinaryExprUtils.buildChainedExpression(["x"], [], "+")).toBe("x");
  });

  it("joins two operands with operator", () => {
    expect(BinaryExprUtils.buildChainedExpression(["a", "b"], ["+"], "+")).toBe(
      "a + b",
    );
  });

  it("chains multiple operands with their operators", () => {
    expect(
      BinaryExprUtils.buildChainedExpression(["a", "b", "c"], ["+", "-"], "+"),
    ).toBe("a + b - c");
  });

  it("uses default operator when operator array is short", () => {
    expect(
      BinaryExprUtils.buildChainedExpression(["a", "b", "c"], ["+"], "*"),
    ).toBe("a + b * c");
  });

  it("handles all bitwise operators", () => {
    expect(BinaryExprUtils.buildChainedExpression(["a", "b"], ["|"], "|")).toBe(
      "a | b",
    );
    expect(BinaryExprUtils.buildChainedExpression(["a", "b"], ["^"], "^")).toBe(
      "a ^ b",
    );
    expect(BinaryExprUtils.buildChainedExpression(["a", "b"], ["&"], "&")).toBe(
      "a & b",
    );
  });

  it("handles shift operators", () => {
    expect(
      BinaryExprUtils.buildChainedExpression(["x", "2"], ["<<"], "<<"),
    ).toBe("x << 2");
    expect(
      BinaryExprUtils.buildChainedExpression(["x", "2"], [">>"], ">>"),
    ).toBe("x >> 2");
  });

  it("handles relational operators", () => {
    expect(BinaryExprUtils.buildChainedExpression(["a", "b"], ["<"], "<")).toBe(
      "a < b",
    );
    expect(
      BinaryExprUtils.buildChainedExpression(["a", "b"], [">="], "<"),
    ).toBe("a >= b");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

Expected: FAIL - buildChainedExpression is not a function

**Step 3: Write minimal implementation**

Add to `BinaryExprUtils.ts`:

```typescript
/**
 * Build a chained binary expression from operands and operators.
 * Used by relational, shift, additive, and multiplicative generators.
 */
const buildChainedExpression = (
  operands: string[],
  operators: string[],
  defaultOp: string,
): string => {
  if (operands.length === 0) {
    return "";
  }

  let result = operands[0];
  for (let i = 1; i < operands.length; i++) {
    const op = operators[i - 1] || defaultOp;
    result += ` ${op} ${operands[i]}`;
  }

  return result;
};
```

Update class to add the method.

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

Expected: PASS

**Step 5: Commit**

Message: `feat(#419): add buildChainedExpression to BinaryExprUtils`

---

## Task 6: Add validateEnumComparison

**Files:**

- Modify: `src/codegen/generators/expressions/BinaryExprUtils.ts`
- Modify: `src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

**Step 1: Write the failing tests**

Add to the test file:

```typescript
describe("validateEnumComparison", () => {
  it("allows comparing same enum types", () => {
    expect(() =>
      BinaryExprUtils.validateEnumComparison("Color", "Color", false, false),
    ).not.toThrow();
  });

  it("allows comparing non-enum values", () => {
    expect(() =>
      BinaryExprUtils.validateEnumComparison(null, null, true, true),
    ).not.toThrow();
  });

  it("throws when comparing different enum types (ADR-017)", () => {
    expect(() =>
      BinaryExprUtils.validateEnumComparison("Color", "Size", false, false),
    ).toThrow("Error: Cannot compare Color enum to Size enum");
  });

  it("throws when comparing enum to integer on left (ADR-017)", () => {
    expect(() =>
      BinaryExprUtils.validateEnumComparison("Color", null, false, true),
    ).toThrow("Error: Cannot compare Color enum to integer");
  });

  it("throws when comparing enum to integer on right (ADR-017)", () => {
    expect(() =>
      BinaryExprUtils.validateEnumComparison(null, "Color", true, false),
    ).toThrow("Error: Cannot compare integer to Color enum");
  });

  it("allows enum compared to non-integer non-enum", () => {
    expect(() =>
      BinaryExprUtils.validateEnumComparison("Color", null, false, false),
    ).not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

Expected: FAIL - validateEnumComparison is not a function

**Step 3: Write minimal implementation**

Add to `BinaryExprUtils.ts`:

```typescript
/**
 * ADR-017: Validate enum type safety for comparisons.
 * Throws if comparing different enum types or enum to integer.
 */
const validateEnumComparison = (
  leftEnumType: string | null,
  rightEnumType: string | null,
  leftIsInteger: boolean,
  rightIsInteger: boolean,
): void => {
  if (leftEnumType && rightEnumType && leftEnumType !== rightEnumType) {
    throw new Error(
      `Error: Cannot compare ${leftEnumType} enum to ${rightEnumType} enum`,
    );
  }

  if (leftEnumType && rightIsInteger) {
    throw new Error(`Error: Cannot compare ${leftEnumType} enum to integer`);
  }

  if (rightEnumType && leftIsInteger) {
    throw new Error(`Error: Cannot compare integer to ${rightEnumType} enum`);
  }
};
```

Update class to add the method.

**Step 4: Run test to verify it passes**

Run: `npm run unit -- src/codegen/generators/expressions/__tests__/BinaryExprUtils.test.ts`

Expected: PASS

**Step 5: Commit**

Message: `feat(#419): add validateEnumComparison to BinaryExprUtils (ADR-017)`

---

## Task 7: Update BinaryExprGenerator to Use Utils

**Files:**

- Modify: `src/codegen/generators/expressions/BinaryExprGenerator.ts`

**Step 1: Run existing tests to establish baseline**

Run: `npm test -- tests/ && npm run unit`

Expected: All tests pass (baseline)

**Step 2: Update imports and remove duplicated code**

At the top of `BinaryExprGenerator.ts`, add import:

```typescript
import BinaryExprUtils from "./BinaryExprUtils";
```

**Step 3: Remove internal functions**

Delete the `tryParseNumericLiteral` function (lines 21-45) and the `tryFoldConstants` function (lines 47-102).

**Step 4: Update constant folding usages**

In `generateAdditiveExpr` and `generateMultiplicativeExpr`, change:

```typescript
const foldedResult = tryFoldConstants(operandCodes, operators);
```

To:

```typescript
const foldedResult = BinaryExprUtils.tryFoldConstants(operandCodes, operators);
```

**Step 5: Update equality operator mapping**

In `generateEqualityExpr`, change:

```typescript
const op = rawOp === "=" ? "==" : rawOp;
```

To:

```typescript
const op = BinaryExprUtils.mapEqualityOperator(rawOp);
```

**Step 6: Update strcmp generation**

In `generateEqualityExpr`, change the strcmp code generation block to use:

```typescript
return {
  code: BinaryExprUtils.generateStrcmpCode(
    leftResult.code,
    rightResult.code,
    isNotEqual,
  ),
  effects,
};
```

**Step 7: Update enum validation**

In `generateEqualityExpr`, replace the inline validation with:

```typescript
const leftIsInteger = orchestrator.isIntegerExpression(exprs[0]);
const rightIsInteger = orchestrator.isIntegerExpression(exprs[1]);
BinaryExprUtils.validateEnumComparison(
  leftEnumType,
  rightEnumType,
  leftIsInteger,
  rightIsInteger,
);
```

**Step 8: Run all tests to verify refactoring**

Run: `npm test -- tests/ && npm run unit`

Expected: All tests pass

**Step 9: Commit**

Message: `refactor(#419): use BinaryExprUtils in BinaryExprGenerator`

---

## Task 8: Final Verification and PR

**Step 1: Run full test suite**

Run: `npm run test:all`

Expected: All tests pass

**Step 2: Run linting**

Run: `npm run oxlint:check`

Expected: No new errors

**Step 3: Create PR**

Title: `feat(#419): Extract pure functions from BinaryExprGenerator into testable module`

Body:

```
## Summary
- Extracts 6 pure functions from BinaryExprGenerator.ts into BinaryExprUtils.ts
- Adds comprehensive unit tests for all extracted functions
- Updates BinaryExprGenerator to use the new utilities

## Functions Extracted
1. `tryParseNumericLiteral` - Parse decimal/hex/binary literals
2. `tryFoldConstants` - Compile-time constant folding (Issue #235)
3. `mapEqualityOperator` - ADR-001 = to == transformation
4. `generateStrcmpCode` - ADR-045 string comparison
5. `buildChainedExpression` - Chained binary expression builder
6. `validateEnumComparison` - ADR-017 enum type safety

## Test Plan
- [x] All new unit tests pass
- [x] All existing integration tests pass
- [x] Linting passes

Closes #419
```
