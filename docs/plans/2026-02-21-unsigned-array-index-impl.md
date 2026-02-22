# Unsigned Array Index Restriction — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reject signed/float/non-integer types as array and bit indexes at compile time (E0850), and update ADR-054 syntax to match current C-Next conventions.

**Architecture:** New `ArrayIndexTypeAnalyzer` in `src/transpiler/logic/analysis/` following the two-pass `FloatModuloAnalyzer` pattern. Pass 1 collects variable type declarations, Pass 2 walks `postfixOp`/`postfixTargetOp` nodes and validates index expression types against the allowed set (unsigned integers, bool, enum, literals).

**Tech Stack:** ANTLR4 ParseTreeWalker, CNextListener, vitest

---

### Task 1: Update ADR-054 Syntax Examples

**Files:**

- Modify: `docs/decisions/adr-054-array-index-overflow.md`

**Step 1: Fix all C-Next syntax in the ADR**

Apply these changes throughout the file:

1. Array declarations use `type[size] name` syntax, not `type name[size]`:
   - `clamp u8 buffer[100]` → `clamp u8[100] buffer`
   - `wrap u8 ring[256]` → `wrap u8[256] ring`
   - `u8 normal[50]` → `u8[50] normal`
   - `discard u8 buffer[100]` → `discard u8[100] buffer`
   - `discard u8 sensorData[100]` → `discard u8[100] sensorData`
   - `wrap u8 rxBuffer[256]` → `wrap u8[256] rxBuffer`
   - `wrap u8 matrix[10][10]` → `wrap u8[10][10] matrix`

2. In the "Consistency with Integer Overflow" table:
   - `clamp u8 buf[100]` → `clamp u8[100] buf`

3. In "Bounded Strings" section — these use `String<64>` which is future syntax, leave as-is.

4. In the "Potential Implementation" section:
   - Grammar rule: `type IDENTIFIER arrayDimension+` → `type arrayDimension+ IDENTIFIER`
   - `clamp u8 buffer[100]` → `clamp u8[100] buffer`
   - `wrap u8 ring[256]` → `wrap u8[256] ring`
   - `discard u8 sensorData[100]` → `discard u8[100] sensorData`

5. Add a new section "### Index Type Safety" after "### Three Behaviors: Clamp, Wrap, and Discard" (before "### Consistency with Integer Overflow") with this content:

````markdown
### Index Type Safety

All bracket subscript expressions require unsigned integer types. Signed integers, floats, and other non-integer types produce a compile error. This applies uniformly to array access, bit access, and bit range access.

**Allowed index types:**

| Type                      | Allowed           | Rationale                               |
| ------------------------- | ----------------- | --------------------------------------- |
| `u8`, `u16`, `u32`, `u64` | Yes               | Primary index types                     |
| `bool`                    | Yes               | Safe (0/1), useful for lookup tables    |
| Enum members              | Yes               | Transpile to unsigned constants         |
| Integer literals          | Yes               | Most common case                        |
| `i8`, `i16`, `i32`, `i64` | **Compile error** | Negative indexes are undefined behavior |
| `f32`, `f64`              | **Compile error** | Not valid index types                   |

This follows the same approach as Rust (`usize` only) and Zig (`usize` only), but using C-Next's fixed-width unsigned types instead of a platform-sized type (see ADR-020).

```cnx
u8[100] buffer;
u32 idx <- 5;
buffer[idx] <- 0xFF;           // OK: u32 is unsigned

i32 signedIdx <- 3;
buffer[signedIdx] <- 0xFF;     // ERROR E0850: signed index

f32 floatIdx <- 2.5;
buffer[floatIdx] <- 0xFF;      // ERROR E0850: float index

// Enum indexing is allowed
enum EColor { RED, GREEN, BLUE, COUNT }
u8[EColor.COUNT] palette;
palette[EColor.RED] <- 0xFF;   // OK: enum member
```
````

````

6. Do NOT change the ADR status — it stays as "Research".

**Step 2: Commit**

```bash
git add docs/decisions/adr-054-array-index-overflow.md
git commit -m "docs: update ADR-054 syntax to match C-Next conventions

Fix array declarations to type[size] name format and add
Index Type Safety section for unsigned-only index restriction."
````

---

### Task 2: Create Error Type Interface

**Files:**

- Create: `src/transpiler/logic/analysis/types/IArrayIndexTypeError.ts`
- Test: N/A (interface only)

**Step 1: Create the error interface**

```typescript
import IBaseAnalysisError from "./IBaseAnalysisError";

/**
 * Error for using a non-unsigned type as an array/bit subscript index.
 *
 * Error codes:
 * - E0850: Signed integer used as subscript index
 * - E0851: Float used as subscript index
 * - E0852: Non-integer type used as subscript index
 */
interface IArrayIndexTypeError extends IBaseAnalysisError {
  actualType: string;
}

export default IArrayIndexTypeError;
```

**Step 2: Commit**

```bash
git add src/transpiler/logic/analysis/types/IArrayIndexTypeError.ts
git commit -m "feat: add IArrayIndexTypeError interface for E0850-E0852"
```

---

### Task 3: Add UNSIGNED_INDEX_TYPES to TypeConstants

**Files:**

- Modify: `src/utils/constants/TypeConstants.ts`

**Step 1: Add the constant**

Add after the existing `FLOAT_TYPES` array:

```typescript
  /**
   * Types allowed as array/bit subscript indexes.
   *
   * Used by:
   * - ArrayIndexTypeAnalyzer: validating subscript index expressions
   */
  static readonly UNSIGNED_INDEX_TYPES: readonly string[] = [
    "u8",
    "u16",
    "u32",
    "u64",
    "bool",
  ];

  /**
   * Signed integer types (not allowed as indexes).
   *
   * Used by:
   * - ArrayIndexTypeAnalyzer: detecting signed index usage
   */
  static readonly SIGNED_TYPES: readonly string[] = [
    "i8",
    "i16",
    "i32",
    "i64",
  ];
```

**Step 2: Commit**

```bash
git add src/utils/constants/TypeConstants.ts
git commit -m "feat: add UNSIGNED_INDEX_TYPES and SIGNED_TYPES to TypeConstants"
```

---

### Task 4: Write Failing Unit Tests

**Files:**

- Create: `src/transpiler/logic/analysis/__tests__/ArrayIndexTypeAnalyzer.test.ts`

**Step 1: Write the test file**

Follow the `DivisionByZeroAnalyzer.test.ts` pattern. Use `CharStream.fromString` → `CNextLexer` → `CommonTokenStream` → `CNextParser` → `parser.program()` to parse source.

```typescript
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../parser/grammar/CNextLexer";
import { CNextParser } from "../../parser/grammar/CNextParser";
import ArrayIndexTypeAnalyzer from "../ArrayIndexTypeAnalyzer";

function parse(source: string) {
  const charStream = CharStream.fromString(source);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);
  return parser.program();
}

describe("ArrayIndexTypeAnalyzer", () => {
  describe("allowed types", () => {
    it("should accept unsigned integer index (u32)", () => {
      const tree = parse(
        `void main() { u8[10] arr; u32 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });

    it("should accept unsigned integer index (u8)", () => {
      const tree = parse(
        `void main() { u8[10] arr; u8 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });

    it("should accept unsigned integer index (u16)", () => {
      const tree = parse(
        `void main() { u8[10] arr; u16 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });

    it("should accept unsigned integer index (u64)", () => {
      const tree = parse(
        `void main() { u8[10] arr; u64 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });

    it("should accept bool index", () => {
      const tree = parse(
        `void main() { u8[2] arr; bool flag <- true; arr[flag] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });

    it("should accept integer literal index", () => {
      const tree = parse(`void main() { u8[10] arr; arr[3] <- 1; }`);
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });

    it("should accept enum member index", () => {
      const tree = parse(
        `enum EColor { RED, GREEN, BLUE } void main() { u8[3] arr; arr[EColor.RED] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });
  });

  describe("rejected types", () => {
    it("should reject signed integer index (i32)", () => {
      const tree = parse(
        `void main() { u8[10] arr; i32 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i32");
    });

    it("should reject signed integer index (i8)", () => {
      const tree = parse(
        `void main() { u8[10] arr; i8 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i8");
    });

    it("should reject signed integer index (i16)", () => {
      const tree = parse(
        `void main() { u8[10] arr; i16 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
    });

    it("should reject signed integer index (i64)", () => {
      const tree = parse(
        `void main() { u8[10] arr; i64 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
    });

    it("should reject float index (f32)", () => {
      const tree = parse(
        `void main() { u8[10] arr; f32 idx <- 0.0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0851");
      expect(errors[0].actualType).toBe("f32");
    });

    it("should reject float index (f64)", () => {
      const tree = parse(
        `void main() { u8[10] arr; f64 idx <- 0.0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0851");
    });
  });

  describe("bit indexing", () => {
    it("should reject signed type for single bit access", () => {
      const tree = parse(
        `void main() { u8 flags <- 0; i32 bit <- 0; flags[bit] <- true; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
    });

    it("should reject signed type for bit range start", () => {
      const tree = parse(
        `void main() { u16 reg <- 0; i32 start <- 0; u8 val <- reg[start, 4]; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
    });

    it("should reject signed type for bit range width", () => {
      const tree = parse(
        `void main() { u16 reg <- 0; i32 width <- 4; u8 val <- reg[0, width]; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
    });

    it("should accept unsigned type for bit access", () => {
      const tree = parse(
        `void main() { u8 flags <- 0; u32 bit <- 3; flags[bit] <- true; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });
  });

  describe("multiple errors", () => {
    it("should report multiple errors in same function", () => {
      const tree = parse(
        `void main() { u8[10] arr; i32 a <- 0; i32 b <- 1; arr[a] <- 1; arr[b] <- 2; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(2);
    });
  });

  describe("unknown types (pass through)", () => {
    it("should not error on unresolvable expression type", () => {
      const tree = parse(
        `void main() { u8[10] arr; arr[someUnknown()] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });
  });

  describe("for loop indexes", () => {
    it("should accept unsigned for loop variable", () => {
      const tree = parse(
        `void main() { u8[10] arr; for (u32 i <- 0; i < 10; i <- i + 1) { arr[i] <- 0; } }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });

    it("should reject signed for loop variable", () => {
      const tree = parse(
        `void main() { u8[10] arr; for (i32 i <- 0; i < 10; i <- i + 1) { arr[i] <- 0; } }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
    });
  });

  describe("function parameters", () => {
    it("should track parameter types", () => {
      const tree = parse(`void fn(u8[10] arr, i32 idx) { arr[idx] <- 1; }`);
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
    });

    it("should accept unsigned parameter", () => {
      const tree = parse(`void fn(u8[10] arr, u32 idx) { arr[idx] <- 1; }`);
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/transpiler/logic/analysis/__tests__/ArrayIndexTypeAnalyzer.test.ts`
Expected: FAIL — `ArrayIndexTypeAnalyzer` module not found

**Step 3: Commit**

```bash
git add src/transpiler/logic/analysis/__tests__/ArrayIndexTypeAnalyzer.test.ts
git commit -m "test: add failing unit tests for ArrayIndexTypeAnalyzer (E0850)"
```

---

### Task 5: Implement ArrayIndexTypeAnalyzer

**Files:**

- Create: `src/transpiler/logic/analysis/ArrayIndexTypeAnalyzer.ts`

**Step 1: Implement the analyzer**

Follow the `FloatModuloAnalyzer` two-pass pattern exactly:

```typescript
/**
 * Array Index Type Analyzer
 * Detects usage of signed, float, or non-integer types as array/bit subscript indexes.
 *
 * All bracket subscript expressions (array access, bit access, bit range) must use
 * unsigned integer types, bool, or enum members. This prevents negative index bugs
 * (CWE-787) and invalid index types at compile time.
 *
 * Two-pass analysis:
 * 1. Collect variable/parameter declarations with their types
 * 2. Walk postfixOp/postfixTargetOp nodes and validate index expression types
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import IArrayIndexTypeError from "./types/IArrayIndexTypeError";
import LiteralUtils from "../../../utils/LiteralUtils";
import ParserUtils from "../../../utils/ParserUtils";
import TypeConstants from "../../../utils/constants/TypeConstants";

/**
 * First pass: Collect variable and parameter declarations with their types
 */
class VariableTypeCollector extends CNextListener {
  private readonly varTypes: Map<string, string> = new Map();

  public getVarTypes(): Map<string, string> {
    return this.varTypes;
  }

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    const typeCtx = ctx.type();
    const identifier = ctx.IDENTIFIER();
    if (typeCtx && identifier) {
      this.varTypes.set(identifier.getText(), typeCtx.getText());
    }
  };

  override enterParameter = (ctx: Parser.ParameterContext): void => {
    const typeCtx = ctx.type();
    const identifier = ctx.IDENTIFIER();
    if (typeCtx && identifier) {
      this.varTypes.set(identifier.getText(), typeCtx.getText());
    }
  };

  override enterForVarDecl = (ctx: Parser.ForVarDeclContext): void => {
    const typeCtx = ctx.type();
    const identifier = ctx.IDENTIFIER();
    if (typeCtx && identifier) {
      this.varTypes.set(identifier.getText(), typeCtx.getText());
    }
  };
}

/**
 * Second pass: Validate index expressions in subscript operations
 */
class IndexTypeListener extends CNextListener {
  private readonly analyzer: ArrayIndexTypeAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly varTypes: Map<string, string>;

  constructor(analyzer: ArrayIndexTypeAnalyzer, varTypes: Map<string, string>) {
    super();
    this.analyzer = analyzer;
    this.varTypes = varTypes;
  }

  /**
   * Check postfixOp: [...] expressions in read context
   */
  override enterPostfixOp = (ctx: Parser.PostfixOpContext): void => {
    this.validateSubscriptExpressions(ctx.expression());
  };

  /**
   * Check postfixTargetOp: [...] expressions in assignment context
   */
  override enterPostfixTargetOp = (
    ctx: Parser.PostfixTargetOpContext,
  ): void => {
    this.validateSubscriptExpressions(ctx.expression());
  };

  private validateSubscriptExpressions(
    expressions: Parser.ExpressionContext[],
  ): void {
    for (const expr of expressions) {
      this.validateIndexExpression(expr);
    }
  }

  private validateIndexExpression(expr: Parser.ExpressionContext): void {
    const resolvedType = this.resolveExpressionType(expr);
    if (!resolvedType) return; // Unknown type — let C compiler handle it

    if (TypeConstants.SIGNED_TYPES.includes(resolvedType)) {
      const { line, column } = ParserUtils.getPosition(expr);
      this.analyzer.addError("E0850", resolvedType, line, column);
    } else if (TypeConstants.FLOAT_TYPES.includes(resolvedType)) {
      const { line, column } = ParserUtils.getPosition(expr);
      this.analyzer.addError("E0851", resolvedType, line, column);
    } else if (
      !TypeConstants.UNSIGNED_INDEX_TYPES.includes(resolvedType) &&
      resolvedType !== "enum"
    ) {
      const { line, column } = ParserUtils.getPosition(expr);
      this.analyzer.addError("E0852", resolvedType, line, column);
    }
  }

  /**
   * Resolve the type of an expression by drilling down to the identifier or literal.
   * Returns null if the type cannot be determined.
   */
  private resolveExpressionType(expr: Parser.ExpressionContext): string | null {
    // Drill through expression → orExpression → ... → unaryExpression → postfixExpression → primaryExpression
    const primary = this.drillToPrimary(expr);
    if (!primary) return null;

    // Check for literal
    const literal = primary.literal();
    if (literal) {
      if (LiteralUtils.isFloat(literal)) return "f32";
      // Integer and hex literals are unsigned by default
      return null; // Literals are always allowed — return null to skip validation
    }

    // Check for identifier — look up in collected variable types
    const identifier = primary.IDENTIFIER();
    if (identifier) {
      const name = identifier.getText();
      return this.varTypes.get(name) ?? null;
    }

    // Check for member access (e.g., EColor.RED) — treat as enum
    // This is handled at the postfixExpression level, not primaryExpression
    return this.checkForEnumAccess(expr);
  }

  /**
   * Drill through the expression grammar hierarchy to find the primaryExpression.
   * Expression → OrExpression → ... → PostfixExpression → PrimaryExpression
   */
  private drillToPrimary(
    expr: Parser.ExpressionContext,
  ): Parser.PrimaryExpressionContext | null {
    const ternary = expr.ternaryExpression();
    if (!ternary) return null;
    const or = ternary.orExpression();
    if (!or || or.length === 0) return null;
    const and = or[0].andExpression();
    if (!and || and.length === 0) return null;
    const equality = and[0].equalityExpression();
    if (!equality || equality.length === 0) return null;
    const relational = equality[0].relationalExpression();
    if (!relational || relational.length === 0) return null;
    const shift = relational[0].shiftExpression();
    if (!shift || shift.length === 0) return null;
    const additive = shift[0].additiveExpression();
    if (!additive || additive.length === 0) return null;
    const multiplicative = additive[0].multiplicativeExpression();
    if (!multiplicative || multiplicative.length === 0) return null;
    const unary = multiplicative[0].unaryExpression();
    if (!unary || unary.length === 0) return null;
    const postfix = unary[0].postfixExpression();
    if (!postfix) return null;
    return postfix.primaryExpression();
  }

  /**
   * Check if the expression is a dotted enum access like EColor.RED
   */
  private checkForEnumAccess(expr: Parser.ExpressionContext): string | null {
    const text = expr.getText();
    // Enum access pattern: contains a dot (e.g., "EColor.RED")
    if (text.includes(".")) return "enum";
    return null;
  }
}

/**
 * Analyzer that detects non-unsigned types used as array/bit subscript indexes
 */
class ArrayIndexTypeAnalyzer {
  private errors: IArrayIndexTypeError[] = [];

  /**
   * Analyze the parse tree for invalid subscript index types
   */
  public analyze(tree: Parser.ProgramContext): IArrayIndexTypeError[] {
    this.errors = [];

    // First pass: collect variable types
    const collector = new VariableTypeCollector();
    ParseTreeWalker.DEFAULT.walk(collector, tree);
    const varTypes = collector.getVarTypes();

    // Second pass: validate index expressions
    const listener = new IndexTypeListener(this, varTypes);
    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /**
   * Add an index type error
   */
  public addError(
    code: string,
    actualType: string,
    line: number,
    column: number,
  ): void {
    const messages: Record<string, string> = {
      E0850: `Subscript index must be an unsigned integer type; got '${actualType}'`,
      E0851: `Subscript index must be an unsigned integer type; got '${actualType}'`,
      E0852: `Subscript index must be an unsigned integer type; got '${actualType}'`,
    };

    this.errors.push({
      code,
      line,
      column,
      message:
        messages[code] ?? `Invalid subscript index type: '${actualType}'`,
      actualType,
      helpText:
        "Array and bit indexes must be unsigned integer types (u8, u16, u32, u64), bool, or enum members.",
    });
  }

  public getErrors(): IArrayIndexTypeError[] {
    return this.errors;
  }
}

export default ArrayIndexTypeAnalyzer;
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/transpiler/logic/analysis/__tests__/ArrayIndexTypeAnalyzer.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/transpiler/logic/analysis/ArrayIndexTypeAnalyzer.ts
git commit -m "feat: implement ArrayIndexTypeAnalyzer for unsigned index validation

Two-pass analyzer that collects variable types then validates all
bracket subscript expressions use unsigned integers, bool, or enums.
Error codes: E0850 (signed), E0851 (float), E0852 (other)."
```

---

### Task 6: Register Analyzer in Pipeline

**Files:**

- Modify: `src/transpiler/logic/analysis/runAnalyzers.ts`

**Step 1: Add import and registration**

Add import at top alongside other analyzers:

```typescript
import ArrayIndexTypeAnalyzer from "./ArrayIndexTypeAnalyzer";
```

Add as analyzer #9 after the float modulo analyzer (step 7) and before comment validation (step 8):

```typescript
// 8. Array index type validation (ADR-054: unsigned indexes only)
const indexTypeAnalyzer = new ArrayIndexTypeAnalyzer();
if (collectErrors(indexTypeAnalyzer.analyze(tree), errors, formatWithCode)) {
  return errors;
}
```

Renumber the comment validation to step 9.

**Step 2: Run full unit tests to check for regressions**

Run: `npm run unit`
Expected: All existing tests PASS

**Step 3: Commit**

```bash
git add src/transpiler/logic/analysis/runAnalyzers.ts
git commit -m "feat: register ArrayIndexTypeAnalyzer in analyzer pipeline"
```

---

### Task 7: Check Existing Test Suite for Regressions

**Step 1: Run the full integration test suite**

Run: `npm test`

Expected: Some existing tests may fail if they use signed variables as array indexes. Common patterns to watch for:

- `for (i32 i <- 0; ...)` loops indexing arrays
- Functions with `i32` parameters used as indexes

**Step 2: Fix any false positives**

If existing tests use `i32` loop variables for array indexing, update them to use `u32` instead. This is the correct fix — the analyzer is catching real issues.

For each failing test file:

1. Change `i32` loop/index variables to `u32`
2. Regenerate expected output if needed: `npm test -- <path> --update`
3. For C++ tests, regenerate snapshots: `npx tsx scripts/generate-cpp-snapshots.ts <path>`

**Step 3: Run tests again**

Run: `npm test`
Expected: All PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: update existing tests to use unsigned index variables

Existing tests that used i32 for array indexing now use u32,
consistent with the new unsigned index restriction (E0850)."
```

---

### Task 8: Create Integration Error Tests

**Files:**

- Create: `tests/analysis/signed-array-index.test.cnx`
- Create: `tests/analysis/signed-array-index.expected.error`
- Create: `tests/analysis/float-array-index.test.cnx`
- Create: `tests/analysis/float-array-index.expected.error`

**Step 1: Create signed index error test**

`tests/analysis/signed-array-index.test.cnx`:

```c-next
// EXPECT-ERROR: Signed integer used as array index
void test_signed_index() {
    u8[10] buffer;
    i32 idx <- 5;
    buffer[idx] <- 0xFF;
}
```

`tests/analysis/signed-array-index.expected.error`:

```
5:11 error[E0850]: Subscript index must be an unsigned integer type; got 'i32'
```

Note: The exact line:column will need to be verified by running the test and checking the actual output. Run: `npx tsx src/index.ts tests/analysis/signed-array-index.test.cnx` to see the actual error output, then update the `.expected.error` file to match.

**Step 2: Create float index error test**

`tests/analysis/float-array-index.test.cnx`:

```c-next
// EXPECT-ERROR: Float used as array index
void test_float_index() {
    u8[10] buffer;
    f32 idx <- 2.5;
    buffer[idx] <- 0xFF;
}
```

`tests/analysis/float-array-index.expected.error`:

```
5:11 error[E0851]: Subscript index must be an unsigned integer type; got 'f32'
```

Same note: verify exact line:column by running transpiler first.

**Step 3: Run integration tests for these files**

Run: `npm test -- tests/analysis/signed-array-index.test.cnx tests/analysis/float-array-index.test.cnx`
Expected: PASS

**Step 4: Commit**

```bash
git add tests/analysis/signed-array-index.test.cnx tests/analysis/signed-array-index.expected.error
git add tests/analysis/float-array-index.test.cnx tests/analysis/float-array-index.expected.error
git commit -m "test: add integration tests for signed/float array index errors"
```

---

### Task 9: Create Integration Test for Signed Bit Index

**Files:**

- Create: `tests/analysis/signed-bit-index.test.cnx`
- Create: `tests/analysis/signed-bit-index.expected.error`

**Step 1: Create signed bit index error test**

`tests/analysis/signed-bit-index.test.cnx`:

```c-next
// EXPECT-ERROR: Signed integer used as bit index
void test_signed_bit() {
    u8 flags <- 0xFF;
    i32 bit <- 3;
    flags[bit] <- false;
}
```

`tests/analysis/signed-bit-index.expected.error`:

```
5:10 error[E0850]: Subscript index must be an unsigned integer type; got 'i32'
```

Verify exact positions by running transpiler.

**Step 2: Run integration test**

Run: `npm test -- tests/analysis/signed-bit-index.test.cnx`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/analysis/signed-bit-index.test.cnx tests/analysis/signed-bit-index.expected.error
git commit -m "test: add integration test for signed bit index error"
```

---

### Task 10: Final Verification

**Step 1: Run all tests**

Run: `npm run test:all`
Expected: All PASS (unit tests, integration tests, C validation)

**Step 2: Run unit coverage**

Run: `npm run unit:coverage`
Expected: New analyzer file has >= 80% coverage

**Step 3: Run spelling check**

Run: `npm run cspell:check`
Expected: No new spelling errors

**Step 4: Commit any remaining fixes**

If anything needed fixing, commit it.
