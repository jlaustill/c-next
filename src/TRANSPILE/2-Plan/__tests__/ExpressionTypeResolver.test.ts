/**
 * Unit tests for ExpressionTypeResolver
 * Tests type classification, conversion validation, and literal validation
 */
import { describe, it, expect, beforeEach } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import ExpressionTypeResolver from "../ExpressionTypeResolver";
import SymbolTable from "../../../PARSE/3-Declare/SymbolTable";
import RenderState from "../../3-Render/RenderState";
import TTypeInfo from "../../../transpiler/types/TTypeInfo";
import { CNextLexer } from "../../../PARSE/2-Parse/grammar/CNextLexer";
import { CNextParser } from "../../../PARSE/2-Parse/grammar/CNextParser";
import enterScope from "../../../transpiler/__tests__/enterScope";

/** Parse a standalone C-Next expression into an ExpressionContext. */
function parseExpression(source: string) {
  const lexer = new CNextLexer(CharStream.fromString(source));
  const parser = new CNextParser(new CommonTokenStream(lexer));
  return parser.expression();
}

/**
 * #1303: a real `PostfixExpressionContext` answers `postfixOp()` as well as
 * `children`, and `getPostfixExpressionType` now consults it for the
 * `global.Scope.member` spelling. Derived from the same suffix texts the mock
 * already declares so the two views cannot disagree -- a hand-written second
 * list is how a mock starts describing a context the grammar never produces.
 */
const postfixOpsFrom = (
  suffixes: readonly string[],
): ReadonlyArray<{
  IDENTIFIER: () => { getText: () => string } | null;
  LBRACKET: () => object | null;
}> =>
  suffixes.map((text) => ({
    IDENTIFIER: () =>
      text.startsWith(".") ? { getText: () => text.slice(1) } : null,
    LBRACKET: () => (text.startsWith("[") ? {} : null),
  }));

let state: RenderState;

describe("ExpressionTypeResolver", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    state = new RenderState();
    symbolTable = new SymbolTable();
    state.symbolTable = symbolTable;
  });

  /** Helper function to set type info in the registry */
  function setTypeInfo(name: string, info: TTypeInfo): void {
    state.setVariableTypeInfo(name, info);
  }

  // ========================================================================
  // Type Classification Methods
  // ========================================================================

  describe("isIntegerType", () => {
    it("should return true for unsigned integer types", () => {
      expect(ExpressionTypeResolver.isIntegerType("u8")).toBe(true);
      expect(ExpressionTypeResolver.isIntegerType("u16")).toBe(true);
      expect(ExpressionTypeResolver.isIntegerType("u32")).toBe(true);
      expect(ExpressionTypeResolver.isIntegerType("u64")).toBe(true);
    });

    it("should return true for signed integer types", () => {
      expect(ExpressionTypeResolver.isIntegerType("i8")).toBe(true);
      expect(ExpressionTypeResolver.isIntegerType("i16")).toBe(true);
      expect(ExpressionTypeResolver.isIntegerType("i32")).toBe(true);
      expect(ExpressionTypeResolver.isIntegerType("i64")).toBe(true);
    });

    it("should return false for non-integer types", () => {
      expect(ExpressionTypeResolver.isIntegerType("f32")).toBe(false);
      expect(ExpressionTypeResolver.isIntegerType("f64")).toBe(false);
      expect(ExpressionTypeResolver.isIntegerType("bool")).toBe(false);
      expect(ExpressionTypeResolver.isIntegerType("void")).toBe(false);
      expect(ExpressionTypeResolver.isIntegerType("MyStruct")).toBe(false);
    });
  });

  describe("isFloatType", () => {
    it("should return true for float types", () => {
      expect(ExpressionTypeResolver.isFloatType("f32")).toBe(true);
      expect(ExpressionTypeResolver.isFloatType("f64")).toBe(true);
    });

    it("should return false for non-float types", () => {
      expect(ExpressionTypeResolver.isFloatType("u32")).toBe(false);
      expect(ExpressionTypeResolver.isFloatType("i32")).toBe(false);
      expect(ExpressionTypeResolver.isFloatType("bool")).toBe(false);
    });
  });

  describe("isUnsignedType", () => {
    it("should return true for unsigned integer types", () => {
      expect(ExpressionTypeResolver.isUnsignedType("u8")).toBe(true);
      expect(ExpressionTypeResolver.isUnsignedType("u16")).toBe(true);
      expect(ExpressionTypeResolver.isUnsignedType("u32")).toBe(true);
      expect(ExpressionTypeResolver.isUnsignedType("u64")).toBe(true);
    });

    it("should return false for signed types", () => {
      expect(ExpressionTypeResolver.isUnsignedType("i8")).toBe(false);
      expect(ExpressionTypeResolver.isUnsignedType("i16")).toBe(false);
      expect(ExpressionTypeResolver.isUnsignedType("i32")).toBe(false);
      expect(ExpressionTypeResolver.isUnsignedType("i64")).toBe(false);
    });

    it("should return false for non-integer types", () => {
      expect(ExpressionTypeResolver.isUnsignedType("f32")).toBe(false);
      expect(ExpressionTypeResolver.isUnsignedType("bool")).toBe(false);
    });
  });

  // ========================================================================
  // Struct Type Detection
  // ========================================================================

  describe("isStructType", () => {
    it("should return true for struct with fields in SymbolTable", () => {
      symbolTable.addStructField("Point", "x", "i32");
      symbolTable.addStructField("Point", "y", "i32");

      expect(ExpressionTypeResolver.isStructType("Point", state)).toBe(true);
    });

    it("should return false for unknown type", () => {
      expect(ExpressionTypeResolver.isStructType("UnknownStruct", state)).toBe(
        false,
      );
    });

    it("should return false for primitive types", () => {
      expect(ExpressionTypeResolver.isStructType("u32", state)).toBe(false);
      expect(ExpressionTypeResolver.isStructType("f64", state)).toBe(false);
    });
  });

  // ========================================================================
  // Type Conversion Validation
  // ========================================================================

  // #1322: the `validateTypeConversion` suite that stood here is gone with the method. ADR-024's
  // rules are E0868/E0869 in pass 2.1, covered by
  // `1-Analyze/__tests__/IntegerConversionAnalyzer.test.ts` against real source
  // rather than a text API.

  // ========================================================================
  // Literal Validation
  // ========================================================================

  // #1322: the `validateLiteralFitsType` suite that stood here is gone with the method. ADR-024's
  // rules are E0868/E0869 in pass 2.1, covered by
  // `1-Analyze/__tests__/IntegerConversionAnalyzer.test.ts` against real source
  // rather than a text API.

  // ========================================================================
  // Primary Expression Type Detection
  // ========================================================================

  describe("getPrimaryExpressionType", () => {
    const mockPrimary = (opts: {
      identifier?: string;
      literal?: string;
      castType?: string;
    }) => {
      return {
        IDENTIFIER: () =>
          opts.identifier ? { getText: () => opts.identifier } : null,
        GLOBAL: () => null,
        THIS: () => null,
        literal: () => (opts.literal ? { getText: () => opts.literal } : null),
        expression: () => null,
        castExpression: () =>
          opts.castType
            ? { type: () => ({ getText: () => opts.castType }) }
            : null,
      } as Parameters<
        typeof ExpressionTypeResolver.getPrimaryExpressionType
      >[0];
    };

    it("should return type for identifier in registry", () => {
      setTypeInfo("myVar", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });
      const ctx = mockPrimary({ identifier: "myVar" });
      expect(ExpressionTypeResolver.getPrimaryExpressionType(ctx, state)).toBe(
        "u32",
      );
    });

    it("should return null for identifier not in registry", () => {
      const ctx = mockPrimary({ identifier: "unknownVar" });
      expect(
        ExpressionTypeResolver.getPrimaryExpressionType(ctx, state),
      ).toBeNull();
    });

    it("should return type from literal suffix", () => {
      const ctx = mockPrimary({ literal: "42u8" });
      expect(ExpressionTypeResolver.getPrimaryExpressionType(ctx, state)).toBe(
        "u8",
      );
    });

    it("should return bool for boolean literal", () => {
      const ctx = mockPrimary({ literal: "true" });
      expect(ExpressionTypeResolver.getPrimaryExpressionType(ctx, state)).toBe(
        "bool",
      );
    });

    it("should return type from cast expression", () => {
      const ctx = mockPrimary({ castType: "i16" });
      expect(ExpressionTypeResolver.getPrimaryExpressionType(ctx, state)).toBe(
        "i16",
      );
    });

    it("should return null when no matching component", () => {
      const ctx = mockPrimary({});
      expect(
        ExpressionTypeResolver.getPrimaryExpressionType(ctx, state),
      ).toBeNull();
    });
  });

  // ========================================================================
  // Expression Type Detection
  // ========================================================================

  describe("getExpressionType", () => {
    const mockExpressionWithOr = (orCount: number) => {
      const orExprs = Array(orCount)
        .fill(null)
        .map(() => ({
          andExpression: () => [
            {
              equalityExpression: () => [
                {
                  relationalExpression: () => [
                    { bitwiseOrExpression: () => [] },
                  ],
                },
              ],
            },
          ],
        }));

      return {
        ternaryExpression: () => ({
          orExpression: () => orExprs,
        }),
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getExpressionType
      >[0];
    };

    const mockExpressionWithAnd = (andCount: number) => {
      const andExprs = Array(andCount)
        .fill(null)
        .map(() => ({
          equalityExpression: () => [
            { relationalExpression: () => [{ bitwiseOrExpression: () => [] }] },
          ],
        }));

      return {
        ternaryExpression: () => ({
          orExpression: () => [{ andExpression: () => andExprs }],
        }),
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getExpressionType
      >[0];
    };

    const mockExpressionWithEquality = (eqCount: number) => {
      const eqExprs = Array(eqCount)
        .fill(null)
        .map(() => ({
          relationalExpression: () => [{ bitwiseOrExpression: () => [] }],
        }));

      return {
        ternaryExpression: () => ({
          orExpression: () => [
            { andExpression: () => [{ equalityExpression: () => eqExprs }] },
          ],
        }),
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getExpressionType
      >[0];
    };

    const mockExpressionWithRelational = (relCount: number) => {
      const relExprs = Array(relCount)
        .fill(null)
        .map(() => ({
          bitwiseOrExpression: () => [],
        }));

      return {
        ternaryExpression: () => ({
          orExpression: () => [
            {
              andExpression: () => [
                {
                  equalityExpression: () => [
                    { relationalExpression: () => relExprs },
                  ],
                },
              ],
            },
          ],
        }),
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getExpressionType
      >[0];
    };

    it("should return null for ternary expression (multiple or expressions)", () => {
      const ctx = mockExpressionWithOr(3);
      expect(ExpressionTypeResolver.getExpressionType(ctx, state)).toBeNull();
    });

    it("should return bool for logical OR expression", () => {
      const ctx = mockExpressionWithAnd(2);
      expect(ExpressionTypeResolver.getExpressionType(ctx, state)).toBe("bool");
    });

    it("should return bool for logical AND expression", () => {
      const ctx = mockExpressionWithEquality(2);
      expect(ExpressionTypeResolver.getExpressionType(ctx, state)).toBe("bool");
    });

    it("should return bool for equality expression", () => {
      const ctx = mockExpressionWithRelational(2);
      expect(ExpressionTypeResolver.getExpressionType(ctx, state)).toBe("bool");
    });

    it("should return null for simple arithmetic expression", () => {
      const ctx = {
        ternaryExpression: () => ({
          orExpression: () => [
            {
              andExpression: () => [
                {
                  equalityExpression: () => [
                    {
                      relationalExpression: () => [
                        {
                          bitwiseOrExpression: () => [
                            {
                              bitwiseXorExpression: () => [
                                {
                                  bitwiseAndExpression: () => [
                                    {
                                      shiftExpression: () => [
                                        {
                                          additiveExpression: () => [
                                            {
                                              multiplicativeExpression: () => [
                                                {
                                                  unaryExpression: () => [
                                                    {},
                                                    {},
                                                  ],
                                                },
                                              ],
                                            },
                                          ],
                                        },
                                      ],
                                    },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getExpressionType
      >[0];

      expect(ExpressionTypeResolver.getExpressionType(ctx, state)).toBeNull();
    });
  });

  describe("getIntegerExpressionType", () => {
    function setInt(name: string, baseType: string, bitWidth: number): void {
      setTypeInfo(name, { baseType, bitWidth, isArray: false, isConst: false });
    }

    it("resolves a signed composite to its operand category and width", () => {
      setInt("a", "i32", 32);
      setInt("b", "i32", 32);
      expect(
        ExpressionTypeResolver.getIntegerExpressionType(
          parseExpression("a + b"),
          state,
        ),
      ).toBe("i32");
    });

    it("resolves an unsigned composite to its operand category and width", () => {
      setInt("a", "u32", 32);
      setInt("b", "u32", 32);
      expect(
        ExpressionTypeResolver.getIntegerExpressionType(
          parseExpression("a | b"),
          state,
        ),
      ).toBe("u32");
    });

    it("uses the widest operand width across a same-category composite", () => {
      setInt("small", "u8", 8);
      setInt("big", "u32", 32);
      expect(
        ExpressionTypeResolver.getIntegerExpressionType(
          parseExpression("small + big"),
          state,
        ),
      ).toBe("u32");
    });

    it("still resolves a simple variable via getExpressionType", () => {
      setInt("x", "i16", 16);
      expect(
        ExpressionTypeResolver.getIntegerExpressionType(
          parseExpression("x"),
          state,
        ),
      ).toBe("i16");
    });

    it("returns null when no integer variable leaf can be resolved", () => {
      expect(
        ExpressionTypeResolver.getIntegerExpressionType(
          parseExpression("a + b"),
          state,
        ),
      ).toBeNull();
    });

    it("ignores integer literals (contextually typed, not fixed-category)", () => {
      setInt("a", "u32", 32);
      expect(
        ExpressionTypeResolver.getIntegerExpressionType(
          parseExpression("a + 5"),
          state,
        ),
      ).toBe("u32");
    });

    it("narrows a bit-extraction operand to the extracted width, not the variable's full width", () => {
      setInt("a", "u32", 32);
      setInt("b", "u64", 64);
      // b[0, 32] is u32, so a + b[0, 32] is u32 — NOT u64. Typing it u64 would
      // make slice codegen cast the composite to a wider type (MISRA 10.8).
      expect(
        ExpressionTypeResolver.getIntegerExpressionType(
          parseExpression("a + b[0, 32]"),
          state,
        ),
      ).toBe("u32");
    });

    it("types an array-element operand by its element type, ignoring the index variable's width", () => {
      setTypeInfo("arr", {
        baseType: "u8",
        bitWidth: 8,
        isArray: true,
        isConst: false,
      });
      setInt("idx", "u64", 64);
      setInt("a", "u8", 8);
      // arr[idx] is u8 (the element); a wide index must not inflate the width.
      expect(
        ExpressionTypeResolver.getIntegerExpressionType(
          parseExpression("a + arr[idx]"),
          state,
        ),
      ).toBe("u8");
    });

    it("types a bit-extraction operand by the extracted width when it is the widest operand", () => {
      setInt("b", "u64", 64);
      setInt("c", "u8", 8);
      expect(
        ExpressionTypeResolver.getIntegerExpressionType(
          parseExpression("b[0, 32] + c"),
          state,
        ),
      ).toBe("u32");
    });
  });

  // ========================================================================
  // Postfix Expression Type Detection
  // ========================================================================

  describe("getPostfixExpressionType", () => {
    it("should return null when no primary expression", () => {
      const ctx = {
        primaryExpression: () => null,
        children: [],
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getPostfixExpressionType
      >[0];

      expect(
        ExpressionTypeResolver.getPostfixExpressionType(ctx, state),
      ).toBeNull();
    });

    it("should return type from simple identifier", () => {
      setTypeInfo("counter", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });

      const ctx = {
        primaryExpression: () => ({
          IDENTIFIER: () => ({ getText: () => "counter" }),
          literal: () => null,
          expression: () => null,
          castExpression: () => null,
        }),
        children: [{ getText: () => "counter" }],
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getPostfixExpressionType
      >[0];

      expect(ExpressionTypeResolver.getPostfixExpressionType(ctx, state)).toBe(
        "u32",
      );
    });

    it("should return null when primary type cannot be determined", () => {
      const ctx = {
        primaryExpression: () => ({
          IDENTIFIER: () => ({ getText: () => "unknownVar" }),
          literal: () => null,
          expression: () => null,
          castExpression: () => null,
        }),
        // #1303: a real PostfixExpressionContext always answers postfixOp().
        // An unresolvable primary now consults the scope-member branch, which
        // needs the chain; with no ops there is no member to name, so the answer
        // stays null and this test keeps asserting exactly what it always did.
        postfixOp: () => [],
        children: [{ getText: () => "unknownVar" }],
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getPostfixExpressionType
      >[0];

      expect(
        ExpressionTypeResolver.getPostfixExpressionType(ctx, state),
      ).toBeNull();
    });

    it("should return member type for struct member access", () => {
      setTypeInfo("point", {
        baseType: "Point",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });
      symbolTable.addStructField("Point", "x", "i32");

      const ctx = {
        primaryExpression: () => ({
          IDENTIFIER: () => ({ getText: () => "point" }),
          literal: () => null,
          expression: () => null,
          castExpression: () => null,
        }),
        children: [{ getText: () => "point" }, { getText: () => ".x" }],
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getPostfixExpressionType
      >[0];

      expect(ExpressionTypeResolver.getPostfixExpressionType(ctx, state)).toBe(
        "i32",
      );
    });

    it("should return null for unknown member", () => {
      setTypeInfo("point", {
        baseType: "Point",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });
      symbolTable.addStructField("Point", "x", "i32");

      const ctx = {
        primaryExpression: () => ({
          IDENTIFIER: () => ({ getText: () => "point" }),
          literal: () => null,
          expression: () => null,
          castExpression: () => null,
        }),
        children: [{ getText: () => "point" }, { getText: () => ".unknown" }],
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getPostfixExpressionType
      >[0];

      expect(
        ExpressionTypeResolver.getPostfixExpressionType(ctx, state),
      ).toBeNull();
    });

    it("should return null for range bit indexing", () => {
      setTypeInfo("flags", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });

      const ctx = {
        primaryExpression: () => ({
          IDENTIFIER: () => ({ getText: () => "flags" }),
          literal: () => null,
          expression: () => null,
          castExpression: () => null,
        }),
        children: [{ getText: () => "flags" }, { getText: () => "[0, 8]" }],
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getPostfixExpressionType
      >[0];

      expect(
        ExpressionTypeResolver.getPostfixExpressionType(ctx, state),
      ).toBeNull();
    });

    it("should return bool for single bit indexing on integer", () => {
      setTypeInfo("flags", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });

      const ctx = {
        primaryExpression: () => ({
          IDENTIFIER: () => ({ getText: () => "flags" }),
          literal: () => null,
          expression: () => null,
          castExpression: () => null,
        }),
        children: [{ getText: () => "flags" }, { getText: () => "[7]" }],
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getPostfixExpressionType
      >[0];

      expect(ExpressionTypeResolver.getPostfixExpressionType(ctx, state)).toBe(
        "bool",
      );
    });

    it("should return element type for struct array member indexing", () => {
      setTypeInfo("data", {
        baseType: "Data",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });
      symbolTable.addStructField("Data", "values", "u8", [10]);

      const ctx = {
        primaryExpression: () => ({
          IDENTIFIER: () => ({ getText: () => "data" }),
          literal: () => null,
          expression: () => null,
          castExpression: () => null,
        }),
        children: [
          { getText: () => "data" },
          { getText: () => ".values" },
          { getText: () => "[0]" },
        ],
        postfixOp: () => postfixOpsFrom([".values", "[0]"]),
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getPostfixExpressionType
      >[0];

      // Bug fix: After .values (u8 array), [0] should be array element access -> "u8"
      expect(ExpressionTypeResolver.getPostfixExpressionType(ctx, state)).toBe(
        "u8",
      );
    });

    it("should return element type for direct array variable indexing", () => {
      setTypeInfo("arr", {
        baseType: "u8",
        bitWidth: 8,
        isArray: true,
        isConst: false,
      });

      const ctx = {
        primaryExpression: () => ({
          IDENTIFIER: () => ({ getText: () => "arr" }),
          literal: () => null,
          expression: () => null,
          castExpression: () => null,
        }),
        children: [{ getText: () => "arr" }, { getText: () => "[0]" }],
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getPostfixExpressionType
      >[0];

      // u8 array with [0] should be array element access -> "u8" (not "bool")
      expect(ExpressionTypeResolver.getPostfixExpressionType(ctx, state)).toBe(
        "u8",
      );
    });

    it("should return bool for bit indexing on plain integer variable", () => {
      setTypeInfo("val", {
        baseType: "u8",
        bitWidth: 8,
        isArray: false,
        isConst: false,
      });

      const ctx = {
        primaryExpression: () => ({
          IDENTIFIER: () => ({ getText: () => "val" }),
          literal: () => null,
          expression: () => null,
          castExpression: () => null,
        }),
        children: [{ getText: () => "val" }, { getText: () => "[0]" }],
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getPostfixExpressionType
      >[0];

      // Plain u8 (not array) with [0] should be bit indexing -> "bool"
      expect(ExpressionTypeResolver.getPostfixExpressionType(ctx, state)).toBe(
        "bool",
      );
    });
  });

  // ========================================================================
  // global/this Primary Expression Handling
  // ========================================================================

  describe("getPostfixExpressionType with global/this", () => {
    it("should resolve global.structVar.field type", () => {
      setTypeInfo("config", {
        baseType: "TConfig",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });
      symbolTable.addStructField("TConfig", "value", "u32");

      const ctx = {
        primaryExpression: () => ({
          IDENTIFIER: () => null,
          GLOBAL: () => ({ getText: () => "global" }),
          THIS: () => null,
          literal: () => null,
          expression: () => null,
          castExpression: () => null,
        }),
        children: [
          { getText: () => "global" },
          { getText: () => ".config" },
          { getText: () => ".value" },
        ],
        postfixOp: () => postfixOpsFrom([".config", ".value"]),
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getPostfixExpressionType
      >[0];

      expect(ExpressionTypeResolver.getPostfixExpressionType(ctx, state)).toBe(
        "u32",
      );
    });

    it("should resolve global.arrayVar[0] element type", () => {
      setTypeInfo("inputs", {
        baseType: "TInput",
        bitWidth: 0,
        isArray: true,
        isConst: false,
      });

      const ctx = {
        primaryExpression: () => ({
          IDENTIFIER: () => null,
          GLOBAL: () => ({ getText: () => "global" }),
          THIS: () => null,
          literal: () => null,
          expression: () => null,
          castExpression: () => null,
        }),
        children: [
          { getText: () => "global" },
          { getText: () => ".inputs" },
          { getText: () => "[0]" },
        ],
        postfixOp: () => postfixOpsFrom([".inputs", "[0]"]),
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getPostfixExpressionType
      >[0];

      expect(ExpressionTypeResolver.getPostfixExpressionType(ctx, state)).toBe(
        "TInput",
      );
    });

    it("should resolve this.scopeVar type", () => {
      enterScope(state, "Motor");
      setTypeInfo("Motor__speed", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });

      const ctx = {
        primaryExpression: () => ({
          IDENTIFIER: () => null,
          GLOBAL: () => null,
          THIS: () => ({ getText: () => "this" }),
          literal: () => null,
          expression: () => null,
          castExpression: () => null,
        }),
        children: [{ getText: () => "this" }, { getText: () => ".speed" }],
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getPostfixExpressionType
      >[0];

      expect(ExpressionTypeResolver.getPostfixExpressionType(ctx, state)).toBe(
        "u32",
      );
    });

    it("should return null for global.unknownVar", () => {
      const ctx = {
        primaryExpression: () => ({
          IDENTIFIER: () => null,
          GLOBAL: () => ({ getText: () => "global" }),
          THIS: () => null,
          literal: () => null,
          expression: () => null,
          castExpression: () => null,
        }),
        children: [{ getText: () => "global" }, { getText: () => ".unknown" }],
        postfixOp: () => postfixOpsFrom([".unknown"]),
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getPostfixExpressionType
      >[0];

      expect(
        ExpressionTypeResolver.getPostfixExpressionType(ctx, state),
      ).toBeNull();
    });

    it("should return null for this.X without current scope", () => {
      enterScope(state, null);

      const ctx = {
        primaryExpression: () => ({
          IDENTIFIER: () => null,
          GLOBAL: () => null,
          THIS: () => ({ getText: () => "this" }),
          literal: () => null,
          expression: () => null,
          castExpression: () => null,
        }),
        children: [{ getText: () => "this" }, { getText: () => ".speed" }],
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getPostfixExpressionType
      >[0];

      expect(
        ExpressionTypeResolver.getPostfixExpressionType(ctx, state),
      ).toBeNull();
    });

    it("should resolve global.struct.enumField for enum type", () => {
      setTypeInfo("input", {
        baseType: "TInput",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });
      symbolTable.addStructField("TInput", "assignedValue", "EValueId");

      const ctx = {
        primaryExpression: () => ({
          IDENTIFIER: () => null,
          GLOBAL: () => ({ getText: () => "global" }),
          THIS: () => null,
          literal: () => null,
          expression: () => null,
          castExpression: () => null,
        }),
        children: [
          { getText: () => "global" },
          { getText: () => ".input" },
          { getText: () => ".assignedValue" },
        ],
        postfixOp: () => postfixOpsFrom([".input", ".assignedValue"]),
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getPostfixExpressionType
      >[0];

      expect(ExpressionTypeResolver.getPostfixExpressionType(ctx, state)).toBe(
        "EValueId",
      );
    });
  });

  // ========================================================================
  // Unary Expression Type Detection
  // ========================================================================

  describe("getUnaryExpressionType", () => {
    it("should return type from postfix expression", () => {
      setTypeInfo("value", {
        baseType: "i32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });

      const ctx = {
        postfixExpression: () => ({
          primaryExpression: () => ({
            IDENTIFIER: () => ({ getText: () => "value" }),
            literal: () => null,
            expression: () => null,
            castExpression: () => null,
          }),
          children: [{ getText: () => "value" }],
        }),
        unaryExpression: () => null,
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getUnaryExpressionType
      >[0];

      expect(ExpressionTypeResolver.getUnaryExpressionType(ctx, state)).toBe(
        "i32",
      );
    });

    it("should return null when no postfix or unary", () => {
      const ctx = {
        postfixExpression: () => null,
        unaryExpression: () => null,
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getUnaryExpressionType
      >[0];

      expect(
        ExpressionTypeResolver.getUnaryExpressionType(ctx, state),
      ).toBeNull();
    });

    it("should recurse through unary expression chain", () => {
      setTypeInfo("x", {
        baseType: "i32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });

      const ctx = {
        postfixExpression: () => null,
        unaryExpression: () => ({
          postfixExpression: () => ({
            primaryExpression: () => ({
              IDENTIFIER: () => ({ getText: () => "x" }),
              literal: () => null,
              expression: () => null,
              castExpression: () => null,
            }),
            children: [{ getText: () => "x" }],
          }),
          unaryExpression: () => null,
        }),
      } as unknown as Parameters<
        typeof ExpressionTypeResolver.getUnaryExpressionType
      >[0];

      expect(ExpressionTypeResolver.getUnaryExpressionType(ctx, state)).toBe(
        "i32",
      );
    });
  });

  // ========================================================================
  // Literal Type Detection
  // ========================================================================

  describe("getLiteralType", () => {
    const mockLiteral = (text: string) =>
      ({ getText: () => text }) as Parameters<
        typeof ExpressionTypeResolver.getLiteralType
      >[0];

    describe("boolean literals", () => {
      it("should return bool for true", () => {
        expect(ExpressionTypeResolver.getLiteralType(mockLiteral("true"))).toBe(
          "bool",
        );
      });

      it("should return bool for false", () => {
        expect(
          ExpressionTypeResolver.getLiteralType(mockLiteral("false")),
        ).toBe("bool");
      });
    });

    describe("integer suffixes", () => {
      it("should detect u8 suffix", () => {
        expect(
          ExpressionTypeResolver.getLiteralType(mockLiteral("255u8")),
        ).toBe("u8");
        expect(ExpressionTypeResolver.getLiteralType(mockLiteral("0U8"))).toBe(
          "u8",
        );
      });

      it("should detect u16 suffix", () => {
        expect(
          ExpressionTypeResolver.getLiteralType(mockLiteral("1000u16")),
        ).toBe("u16");
      });

      it("should detect u32 suffix", () => {
        expect(
          ExpressionTypeResolver.getLiteralType(mockLiteral("1000000u32")),
        ).toBe("u32");
      });

      it("should detect u64 suffix", () => {
        expect(
          ExpressionTypeResolver.getLiteralType(mockLiteral("1000000000u64")),
        ).toBe("u64");
      });

      it("should detect i8 suffix", () => {
        expect(
          ExpressionTypeResolver.getLiteralType(mockLiteral("-50i8")),
        ).toBe("i8");
        expect(ExpressionTypeResolver.getLiteralType(mockLiteral("50I8"))).toBe(
          "i8",
        );
      });

      it("should detect i16 suffix", () => {
        expect(
          ExpressionTypeResolver.getLiteralType(mockLiteral("1000i16")),
        ).toBe("i16");
      });

      it("should detect i32 suffix", () => {
        expect(
          ExpressionTypeResolver.getLiteralType(mockLiteral("1000000i32")),
        ).toBe("i32");
      });

      it("should detect i64 suffix", () => {
        expect(
          ExpressionTypeResolver.getLiteralType(mockLiteral("1000000000i64")),
        ).toBe("i64");
      });
    });

    describe("float suffixes", () => {
      it("should detect f32 suffix", () => {
        expect(
          ExpressionTypeResolver.getLiteralType(mockLiteral("3.14f32")),
        ).toBe("f32");
        expect(
          ExpressionTypeResolver.getLiteralType(mockLiteral("3.14F32")),
        ).toBe("f32");
      });

      it("should detect f64 suffix", () => {
        expect(
          ExpressionTypeResolver.getLiteralType(mockLiteral("3.14159f64")),
        ).toBe("f64");
        expect(
          ExpressionTypeResolver.getLiteralType(mockLiteral("3.14159F64")),
        ).toBe("f64");
      });
    });

    describe("unsuffixed literals (MISRA 10.3 compliance)", () => {
      it("should return int for unsuffixed integer", () => {
        expect(ExpressionTypeResolver.getLiteralType(mockLiteral("42"))).toBe(
          "int",
        );
      });

      it("should return int for unsuffixed hex", () => {
        expect(ExpressionTypeResolver.getLiteralType(mockLiteral("0xFF"))).toBe(
          "int",
        );
      });

      it("should return f64 for unsuffixed float", () => {
        expect(ExpressionTypeResolver.getLiteralType(mockLiteral("3.14"))).toBe(
          "f64",
        );
      });
    });
  });

  // ========================================================================
  // Member Type Info
  // ========================================================================

  describe("getMemberTypeInfo", () => {
    it("should return field info from SymbolTable", () => {
      symbolTable.addStructField("Point", "x", "i32");
      symbolTable.addStructField("Point", "y", "i32");

      const xInfo = ExpressionTypeResolver.getMemberTypeInfo(
        "Point",
        "x",
        state,
      );
      expect(xInfo).toBeDefined();
      expect(xInfo?.baseType).toBe("i32");
      expect(xInfo?.isArray).toBe(false);
    });

    it("should return array info for array fields", () => {
      symbolTable.addStructField("Buffer", "data", "u8", [256]);

      const dataInfo = ExpressionTypeResolver.getMemberTypeInfo(
        "Buffer",
        "data",
        state,
      );
      expect(dataInfo).toBeDefined();
      expect(dataInfo?.baseType).toBe("u8");
      expect(dataInfo?.isArray).toBe(true);
    });

    it("should return undefined for unknown struct", () => {
      expect(
        ExpressionTypeResolver.getMemberTypeInfo("Unknown", "field", state),
      ).toBeUndefined();
    });

    it("should return undefined for unknown field", () => {
      symbolTable.addStructField("Point", "x", "i32");
      expect(
        ExpressionTypeResolver.getMemberTypeInfo("Point", "z", state),
      ).toBeUndefined();
    });
  });
});
