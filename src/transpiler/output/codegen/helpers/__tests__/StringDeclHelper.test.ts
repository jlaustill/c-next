/**
 * Unit tests for StringDeclHelper
 *
 * Issue #644: Tests for the extracted string declaration helper.
 * Migrated to use CodeGenState instead of constructor DI.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import StringDeclHelper from "../StringDeclHelper.js";
import CodeGenState from "../../../../state/CodeGenState.js";

/**
 * Default callbacks for testing.
 */
const defaultCallbacks = {
  generateExpression: vi.fn((ctx: { getText: () => string }) => ctx.getText()),
  generateArrayDimensions: vi.fn(
    (dims: { expression: () => { getText: () => string } | null }[]) =>
      dims
        .map((d) => {
          const expr = d.expression();
          return expr ? `[${expr.getText()}]` : "[]";
        })
        .join(""),
  ),
  getStringConcatOperands: vi.fn(() => null),
  getSubstringOperands: vi.fn(() => null),
  getStringExprCapacity: vi.fn(() => null),
  requireStringInclude: vi.fn(),
};

// #1322: the `throws error ...` cases below now assert INVARIANTS, not
// diagnostics. ADR-045's declaration rules are E0862-E0866 in pass 2.1, which
// halts before codegen runs, so a declaration reaching this helper has already
// been checked. The assertion is the safety net for a DIVERGENCE between the
// two -- 2.1 accepting something this code cannot emit -- and these cases are
// what prove the net is there. Kept and re-aimed rather than deleted: they
// were the only coverage of these conditions, and an assertion nothing
// exercises is the guard-that-cannot-fail shape.
describe("StringDeclHelper", () => {
  beforeEach(() => {
    CodeGenState.reset();
    CodeGenState.inFunctionBody = true;
    CodeGenState.indentLevel = 1;
    vi.clearAllMocks();
  });

  describe("generateStringDecl", () => {
    it("returns handled: false for non-string types", () => {
      const typeCtx = {
        stringType: () => null,
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "myVar",
        null,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        defaultCallbacks,
      );

      expect(result.handled).toBe(false);
    });

    it("generates bounded string with literal initializer", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "64" }),
        }),
      } as never;

      const expression = {
        getText: () => '"Hello"',
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "greeting",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        defaultCallbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("char greeting[65]");
      expect(result.code).toContain('"Hello"');
    });

    it("generates empty bounded string without initializer", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "buffer",
        null,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        defaultCallbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toBe('char buffer[33] = "";');
    });

    it("generates const bounded string", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => '"Test"',
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "label",
        expression,
        [],
        { extern: "", const: "const ", atomic: "", volatile: "" },
        true,
        defaultCallbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("const char label[11]");
    });

    it("asserts the invariant for string literal exceeding capacity", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "5" }),
        }),
      } as never;

      const expression = {
        getText: () => '"HelloWorld"', // 10 chars, exceeds 5
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "small",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          defaultCallbacks,
        ),
      ).toThrow("a string literal fits its declared capacity");
    });

    it("asserts the invariant for non-const unsized string", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => null,
        }),
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "invalid",
          null,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          defaultCallbacks,
        ),
      ).toThrow("a non-const string states its capacity");
    });

    it("asserts the invariant for unsized const string without initializer", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => null,
        }),
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "invalid",
          null,
          [],
          { extern: "", const: "const ", atomic: "", volatile: "" },
          true,
          defaultCallbacks,
        ),
      ).toThrow("an unsized const string has an initializer to infer from");
    });

    it("asserts the invariant for unsized const string with non-literal", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => null,
        }),
      } as never;

      const expression = {
        getText: () => "otherVar",
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "invalid",
          expression,
          [],
          { extern: "", const: "const ", atomic: "", volatile: "" },
          true,
          defaultCallbacks,
        ),
      ).toThrow("an unsized const string infers from a LITERAL");
    });

    it("generates unsized const string with literal initializer", () => {
      const requireStringInclude = vi.fn();
      const callbacks = {
        ...defaultCallbacks,
        requireStringInclude,
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => null,
        }),
      } as never;

      const expression = {
        getText: () => '"Hello"',
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "greeting",
        expression,
        [],
        { extern: "", const: "const ", atomic: "", volatile: "" },
        true,
        callbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toBe('const char greeting[6] = "Hello";');
      expect(requireStringInclude).toHaveBeenCalled();
      expect(CodeGenState.getVariableTypeInfo("greeting")).toMatchObject({
        baseType: "char",
        isString: true,
        stringCapacity: 5,
      });
    });

    it("generates extern bounded string", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "20" }),
        }),
      } as never;

      const expression = {
        getText: () => '"External"',
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "extStr",
        expression,
        [],
        { extern: "extern ", const: "", atomic: "", volatile: "" },
        false,
        defaultCallbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("extern char extStr[21]");
    });
  });

  describe("string variable assignment validation", () => {
    it("asserts the invariant when source string capacity exceeds destination", () => {
      const callbacks = {
        ...defaultCallbacks,
        getStringExprCapacity: vi.fn(() => 100),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
      } as never;

      const expression = {
        getText: () => "largeString", // Not a literal, so capacity check will run
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "small",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          callbacks,
        ),
      ).toThrow(
        "a string source fits its destination -- E0864 rejects string<100> into string<32>",
      );
    });

    it("allows assignment when source capacity fits", () => {
      // Issue #1044: String variable initialization uses a bounded strncpy
      // (shared with the reassignment path), not an unsafe strcpy (CWE-120).
      const callbacks = {
        ...defaultCallbacks,
        getStringExprCapacity: vi.fn(() => 20),
        generateExpression: vi.fn(() => "smallString"),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
      } as never;

      const expression = {
        getText: () => "smallString",
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "dest",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(result.handled).toBe(true);
      // Issue #1044: bounded copy, not strcpy
      expect(result.code).toContain('char dest[33] = "";');
      expect(result.code).toContain("(void) strncpy(dest, smallString, 32);");
      expect(result.code).toContain("dest[32] = '\\0';");
      expect(result.code).not.toContain("strcpy(dest, smallString)");
    });

    it("does not indent continuation lines (the block emitter owns indentation) — Issue #1037", () => {
      // indentLevel = 1 (beforeEach). generateBlock prefixes every line of a
      // statement, so the helper must NOT add its own indent or continuation
      // lines double-indent.
      const callbacks = {
        ...defaultCallbacks,
        getStringExprCapacity: vi.fn(() => 20),
        generateExpression: vi.fn(() => "smallString"),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
      } as never;

      const expression = {
        getText: () => "smallString",
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "dest",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      const lines = result.code.split("\n");
      expect(lines[0]).toBe('char dest[33] = "";');
      // Continuation line must have no leading whitespace of its own.
      expect(lines[1]).toBe(
        "(void) strncpy(dest, smallString, 32); dest[32] = '\\0';",
      );
    });

    it("asserts the invariant for string variable initialization at global scope", () => {
      // Issue #1030: String variable initialization requires function body
      CodeGenState.inFunctionBody = false;
      const callbacks = {
        ...defaultCallbacks,
        getStringExprCapacity: vi.fn(() => 20),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
      } as never;

      const expression = {
        getText: () => "sourceVar",
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "dest",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          callbacks,
        ),
      ).toThrow(
        "a string at file scope is initialized by a literal -- E0863 rejects a copy from a variable",
      );
    });
  });

  describe("string concatenation", () => {
    it("generates concatenation code in function body", () => {
      const concatOps = {
        left: "str1",
        right: "str2",
        leftCapacity: 10,
        rightCapacity: 10,
      };
      const callbacks = {
        ...defaultCallbacks,
        getStringConcatOperands: vi.fn(() => concatOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
      } as never;

      const expression = {
        getText: () => "str1 + str2",
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "combined",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(result.handled).toBe(true);
      // Issue #1037: every line carries no indent of its own (the block emitter
      // prefixes each line); continuation lines must not double-indent.
      const concatLines = result.code.split("\n");
      expect(concatLines[0]).toBe('char combined[33] = "";');
      expect(concatLines[1]).toBe("(void) strncpy(combined, str1, 32);");
      expect(concatLines[2]).toBe(
        "(void) strncat(combined, str2, 32 - strlen(combined));",
      );
      expect(concatLines[3]).toBe("combined[32] = '\\0';");
    });

    it("asserts the invariant for concatenation at global scope", () => {
      CodeGenState.inFunctionBody = false;
      const concatOps = {
        left: "str1",
        right: "str2",
        leftCapacity: 10,
        rightCapacity: 10,
      };
      const callbacks = {
        ...defaultCallbacks,
        getStringConcatOperands: vi.fn(() => concatOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
      } as never;

      const expression = {
        getText: () => "str1 + str2",
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "combined",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          callbacks,
        ),
      ).toThrow(
        "a string at file scope is initialized by a literal -- E0863 rejects a concatenation",
      );
    });

    it("asserts the invariant when combined capacity exceeds destination", () => {
      const concatOps = {
        left: "str1",
        right: "str2",
        leftCapacity: 20,
        rightCapacity: 20,
      };
      const callbacks = {
        ...defaultCallbacks,
        getStringConcatOperands: vi.fn(() => concatOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "30" }),
        }),
      } as never;

      const expression = {
        getText: () => "str1 + str2",
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "combined",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          callbacks,
        ),
      ).toThrow(
        "a concatenation fits its destination -- E0864 rejects 40 into string<30>",
      );
    });

    it("generates const concatenation declaration", () => {
      const concatOps = {
        left: "str1",
        right: "str2",
        leftCapacity: 5,
        rightCapacity: 5,
      };
      const callbacks = {
        ...defaultCallbacks,
        getStringConcatOperands: vi.fn(() => concatOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "20" }),
        }),
      } as never;

      const expression = {
        getText: () => "str1 + str2",
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "combined",
        expression,
        [],
        { extern: "", const: "const ", atomic: "", volatile: "" },
        true,
        callbacks,
      );

      expect(result.code).toContain('const char combined[21] = "";');
    });
  });

  describe("substring extraction", () => {
    it("generates substring extraction code in function body", () => {
      const substringOps = {
        source: "srcStr",
        start: "0",
        lengthExpression: "5",
        sourceCapacity: 32,
      };
      const callbacks = {
        ...defaultCallbacks,
        getSubstringOperands: vi.fn(() => substringOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(0, 5)",
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "sub",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(result.handled).toBe(true);
      // Issue #1037: continuation lines carry no indent of their own.
      const subLines = result.code.split("\n");
      expect(subLines[0]).toBe('char sub[11] = "";');
      expect(subLines[1]).toBe("(void) strncpy(sub, srcStr + 0, 5);");
      expect(subLines[2]).toBe("sub[5] = '\\0';");
    });

    it("asserts the invariant for substring at global scope", () => {
      CodeGenState.inFunctionBody = false;
      const substringOps = {
        source: "srcStr",
        start: "0",
        lengthExpression: "5",
        sourceCapacity: 32,
      };
      const callbacks = {
        ...defaultCallbacks,
        getSubstringOperands: vi.fn(() => substringOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(0, 5)",
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "sub",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          callbacks,
        ),
      ).toThrow(
        "a string at file scope is initialized by a literal -- E0863 rejects a substring",
      );
    });

    it("asserts the invariant when substring bounds exceed source capacity", () => {
      const substringOps = {
        source: "srcStr",
        start: "30",
        lengthExpression: "10",
        sourceCapacity: 32, // start + length = 40 > 32
      };
      const callbacks = {
        ...defaultCallbacks,
        getSubstringOperands: vi.fn(() => substringOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "20" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(30, 10)",
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "sub",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          callbacks,
        ),
      ).toThrow(
        "substring bounds stay within the source -- E0865 rejects [30, 10] against string<32>",
      );
    });

    it("asserts the invariant when substring length exceeds destination capacity", () => {
      const substringOps = {
        source: "srcStr",
        start: "0",
        lengthExpression: "20",
        sourceCapacity: 32,
      };
      const callbacks = {
        ...defaultCallbacks,
        getSubstringOperands: vi.fn(() => substringOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(0, 20)",
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "sub",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          callbacks,
        ),
      ).toThrow(
        "a substring fits its destination -- E0864 rejects 20 into string<10>",
      );
    });

    it("skips bounds check when start is not numeric", () => {
      const substringOps = {
        source: "srcStr",
        start: "startVar", // Non-numeric
        lengthExpression: "5",
        sourceCapacity: 32,
      };
      const callbacks = {
        ...defaultCallbacks,
        getSubstringOperands: vi.fn(() => substringOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(startVar, 5)",
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "sub",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain(
        "(void) strncpy(sub, srcStr + startVar, 5)",
      );
    });

    it("skips length check when length is not numeric", () => {
      const substringOps = {
        source: "srcStr",
        start: "0",
        lengthExpression: "lenVar", // Non-numeric
        sourceCapacity: 32,
      };
      const callbacks = {
        ...defaultCallbacks,
        getSubstringOperands: vi.fn(() => substringOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(0, lenVar)",
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "sub",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("(void) strncpy(sub, srcStr + 0, lenVar)");
    });

    it("generates const substring declaration", () => {
      const substringOps = {
        source: "srcStr",
        start: "5",
        lengthExpression: "3",
        sourceCapacity: 32,
      };
      const callbacks = {
        ...defaultCallbacks,
        getSubstringOperands: vi.fn(() => substringOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(5, 3)",
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "sub",
        expression,
        [],
        { extern: "", const: "const ", atomic: "", volatile: "" },
        true,
        callbacks,
      );

      expect(result.code).toContain('const char sub[11] = "";');
    });
  });

  // #1322a: the C-style string-array path these exercised is deleted. Every
  // route into it -- `string<8> items[3]`, `items[]`, and the fill-all form --
  // is intercepted by `VariableDeclHelper.validateArrayDeclarationSyntax` with
  // the C-style-array error (#1014-#1017), verified by probing all three. These
  // tests reached it by calling `generate` directly with trailing dimensions
  // that the grammar path can no longer deliver.
  //
  // The prefix form `string<8>[3] names` is unaffected and covered by
  // `tests/string-array-init/`, including the size-mismatch diagnostic.

  describe("string arrays from arrayType syntax (Issue #1029)", () => {
    it("generates string array from arrayType without initializer", () => {
      // Simulates: string<32>[4] items;
      const typeCtx = {
        stringType: () => null, // Not directly on typeCtx
        arrayType: () => ({
          stringType: () => ({
            INTEGER_LITERAL: () => ({ getText: () => "32" }),
          }),
          arrayTypeDimension: () => [
            { expression: () => ({ getText: () => "4" }) },
          ],
        }),
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "items",
        null,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        defaultCallbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toBe("char items[4][33] = {0};");
    });

    it("generates string array from arrayType with initializer", () => {
      const callbacks = {
        ...defaultCallbacks,
        generateExpression: vi.fn(() => {
          CodeGenState.lastArrayInitCount = 2;
          CodeGenState.lastArrayFillValue = undefined;
          return '{"One", "Two"}';
        }),
      };

      // Simulates: string<10>[2] labels <- ["One", "Two"];
      const typeCtx = {
        stringType: () => null,
        arrayType: () => ({
          stringType: () => ({
            INTEGER_LITERAL: () => ({ getText: () => "10" }),
          }),
          arrayTypeDimension: () => [
            { expression: () => ({ getText: () => "2" }) },
          ],
        }),
      } as never;

      const expression = {
        getText: () => '["One", "Two"]',
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "labels",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("[2]");
      expect(result.code).toContain("[11]"); // capacity + 1
      expect(result.code).toContain('{"One", "Two"}');
    });

    it("generates string array from arrayType with trailing dimensions", () => {
      // Simulates: string<10>[2] matrix[3]; (2D string array)
      const typeCtx = {
        stringType: () => null,
        arrayType: () => ({
          stringType: () => ({
            INTEGER_LITERAL: () => ({ getText: () => "10" }),
          }),
          arrayTypeDimension: () => [
            { expression: () => ({ getText: () => "2" }) },
          ],
        }),
      } as never;

      const trailingDims = [
        { expression: () => ({ getText: () => "3" }) },
      ] as never[];

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "matrix",
        null,
        trailingDims,
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        defaultCallbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toBe("char matrix[2][3][11] = {0};");
    });

    it("asserts the invariant for unsized string array from arrayType", () => {
      // Simulates: string[4] items; (missing capacity)
      const typeCtx = {
        stringType: () => null,
        arrayType: () => ({
          stringType: () => ({
            INTEGER_LITERAL: () => null, // No capacity
          }),
          arrayTypeDimension: () => [
            { expression: () => ({ getText: () => "4" }) },
          ],
        }),
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "items",
          null,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          defaultCallbacks,
        ),
      ).toThrow("a string array states its element capacity");
    });

    it("validates element count matches declared size from arrayType", () => {
      const callbacks = {
        ...defaultCallbacks,
        generateExpression: vi.fn(() => {
          CodeGenState.lastArrayInitCount = 2; // Only 2 elements
          CodeGenState.lastArrayFillValue = undefined;
          return '{"One", "Two"}';
        }),
      };

      // Simulates: string<10>[4] items <- ["One", "Two"]; (size mismatch)
      const typeCtx = {
        stringType: () => null,
        arrayType: () => ({
          stringType: () => ({
            INTEGER_LITERAL: () => ({ getText: () => "10" }),
          }),
          arrayTypeDimension: () => [
            { expression: () => ({ getText: () => "4" }) }, // Declared size = 4
          ],
        }),
      } as never;

      const expression = {
        getText: () => '["One", "Two"]',
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "items",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          callbacks,
        ),
      ).toThrow(
        "a string array initializer matches its declared size -- E0866 rejects [4] against 2 element(s)",
      );
    });

    it("tracks local arrays from arrayType in localArrays set", () => {
      const typeCtx = {
        stringType: () => null,
        arrayType: () => ({
          stringType: () => ({
            INTEGER_LITERAL: () => ({ getText: () => "20" }),
          }),
          arrayTypeDimension: () => [
            { expression: () => ({ getText: () => "3" }) },
          ],
        }),
      } as never;

      StringDeclHelper.generateStringDecl(
        typeCtx,
        "tracked",
        null,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        defaultCallbacks,
      );

      expect(CodeGenState.localArrays.has("tracked")).toBe(true);
    });

    it("generates string array from arrayType with modifiers", () => {
      const typeCtx = {
        stringType: () => null,
        arrayType: () => ({
          stringType: () => ({
            INTEGER_LITERAL: () => ({ getText: () => "8" }),
          }),
          arrayTypeDimension: () => [
            { expression: () => ({ getText: () => "2" }) },
          ],
        }),
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "data",
        null,
        [],
        {
          extern: "extern ",
          const: "const ",
          atomic: "",
          volatile: "volatile ",
        },
        true,
        defaultCallbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("extern const volatile char data[2][9]");
    });
  });
});
