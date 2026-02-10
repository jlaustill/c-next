/**
 * Unit tests for TypeResolver
 * Tests type classification, conversion validation, and literal validation
 */
import { describe, it, expect, beforeEach } from "vitest";
import TypeResolver from "../TypeResolver";
import SymbolTable from "../../../logic/symbols/SymbolTable";
import CodeGenState from "../CodeGenState";
import TTypeInfo from "../types/TTypeInfo";

describe("TypeResolver", () => {
  let symbolTable: SymbolTable;
  let typeRegistry: Map<string, TTypeInfo>;

  beforeEach(() => {
    CodeGenState.reset();
    symbolTable = new SymbolTable();
    typeRegistry = CodeGenState.typeRegistry;
    CodeGenState.symbolTable = symbolTable;
  });

  // ========================================================================
  // Type Classification Methods
  // ========================================================================

  describe("isIntegerType", () => {
    it("should return true for unsigned integer types", () => {
      expect(TypeResolver.isIntegerType("u8")).toBe(true);
      expect(TypeResolver.isIntegerType("u16")).toBe(true);
      expect(TypeResolver.isIntegerType("u32")).toBe(true);
      expect(TypeResolver.isIntegerType("u64")).toBe(true);
    });

    it("should return true for signed integer types", () => {
      expect(TypeResolver.isIntegerType("i8")).toBe(true);
      expect(TypeResolver.isIntegerType("i16")).toBe(true);
      expect(TypeResolver.isIntegerType("i32")).toBe(true);
      expect(TypeResolver.isIntegerType("i64")).toBe(true);
    });

    it("should return false for non-integer types", () => {
      expect(TypeResolver.isIntegerType("f32")).toBe(false);
      expect(TypeResolver.isIntegerType("f64")).toBe(false);
      expect(TypeResolver.isIntegerType("bool")).toBe(false);
      expect(TypeResolver.isIntegerType("void")).toBe(false);
      expect(TypeResolver.isIntegerType("MyStruct")).toBe(false);
    });
  });

  describe("isFloatType", () => {
    it("should return true for float types", () => {
      expect(TypeResolver.isFloatType("f32")).toBe(true);
      expect(TypeResolver.isFloatType("f64")).toBe(true);
    });

    it("should return false for non-float types", () => {
      expect(TypeResolver.isFloatType("u32")).toBe(false);
      expect(TypeResolver.isFloatType("i32")).toBe(false);
      expect(TypeResolver.isFloatType("bool")).toBe(false);
    });
  });

  describe("isSignedType", () => {
    it("should return true for signed integer types", () => {
      expect(TypeResolver.isSignedType("i8")).toBe(true);
      expect(TypeResolver.isSignedType("i16")).toBe(true);
      expect(TypeResolver.isSignedType("i32")).toBe(true);
      expect(TypeResolver.isSignedType("i64")).toBe(true);
    });

    it("should return false for unsigned types", () => {
      expect(TypeResolver.isSignedType("u8")).toBe(false);
      expect(TypeResolver.isSignedType("u16")).toBe(false);
      expect(TypeResolver.isSignedType("u32")).toBe(false);
      expect(TypeResolver.isSignedType("u64")).toBe(false);
    });

    it("should return false for non-integer types", () => {
      expect(TypeResolver.isSignedType("f32")).toBe(false);
      expect(TypeResolver.isSignedType("bool")).toBe(false);
    });
  });

  describe("isUnsignedType", () => {
    it("should return true for unsigned integer types", () => {
      expect(TypeResolver.isUnsignedType("u8")).toBe(true);
      expect(TypeResolver.isUnsignedType("u16")).toBe(true);
      expect(TypeResolver.isUnsignedType("u32")).toBe(true);
      expect(TypeResolver.isUnsignedType("u64")).toBe(true);
    });

    it("should return false for signed types", () => {
      expect(TypeResolver.isUnsignedType("i8")).toBe(false);
      expect(TypeResolver.isUnsignedType("i16")).toBe(false);
      expect(TypeResolver.isUnsignedType("i32")).toBe(false);
      expect(TypeResolver.isUnsignedType("i64")).toBe(false);
    });

    it("should return false for non-integer types", () => {
      expect(TypeResolver.isUnsignedType("f32")).toBe(false);
      expect(TypeResolver.isUnsignedType("bool")).toBe(false);
    });
  });

  // ========================================================================
  // Struct Type Detection
  // ========================================================================

  describe("isStructType", () => {
    it("should return true for struct with fields in SymbolTable", () => {
      symbolTable.addStructField("Point", "x", "i32");
      symbolTable.addStructField("Point", "y", "i32");

      expect(TypeResolver.isStructType("Point")).toBe(true);
    });

    it("should return false for unknown type", () => {
      expect(TypeResolver.isStructType("UnknownStruct")).toBe(false);
    });

    it("should return false for primitive types", () => {
      expect(TypeResolver.isStructType("u32")).toBe(false);
      expect(TypeResolver.isStructType("f64")).toBe(false);
    });
  });

  // ========================================================================
  // Type Conversion Validation
  // ========================================================================

  describe("isNarrowingConversion", () => {
    it("should return true when target is smaller than source", () => {
      expect(TypeResolver.isNarrowingConversion("u32", "u16")).toBe(true);
      expect(TypeResolver.isNarrowingConversion("u32", "u8")).toBe(true);
      expect(TypeResolver.isNarrowingConversion("u64", "u32")).toBe(true);
      expect(TypeResolver.isNarrowingConversion("i64", "i8")).toBe(true);
    });

    it("should return false when target is same size or larger", () => {
      expect(TypeResolver.isNarrowingConversion("u16", "u32")).toBe(false);
      expect(TypeResolver.isNarrowingConversion("u32", "u32")).toBe(false);
      expect(TypeResolver.isNarrowingConversion("u8", "u64")).toBe(false);
    });

    it("should return false for unknown types", () => {
      expect(TypeResolver.isNarrowingConversion("unknown", "u32")).toBe(false);
      expect(TypeResolver.isNarrowingConversion("u32", "unknown")).toBe(false);
    });
  });

  describe("isSignConversion", () => {
    it("should return true for signed to unsigned conversion", () => {
      expect(TypeResolver.isSignConversion("i32", "u32")).toBe(true);
      expect(TypeResolver.isSignConversion("i8", "u64")).toBe(true);
    });

    it("should return true for unsigned to signed conversion", () => {
      expect(TypeResolver.isSignConversion("u32", "i32")).toBe(true);
      expect(TypeResolver.isSignConversion("u8", "i64")).toBe(true);
    });

    it("should return false for same-sign conversion", () => {
      expect(TypeResolver.isSignConversion("i32", "i64")).toBe(false);
      expect(TypeResolver.isSignConversion("u32", "u64")).toBe(false);
    });

    it("should return false for non-integer types", () => {
      expect(TypeResolver.isSignConversion("f32", "f64")).toBe(false);
      expect(TypeResolver.isSignConversion("bool", "u8")).toBe(false);
    });
  });

  describe("validateTypeConversion", () => {
    it("should not throw for same type", () => {
      expect(() =>
        TypeResolver.validateTypeConversion("u32", "u32"),
      ).not.toThrow();
      expect(() =>
        TypeResolver.validateTypeConversion("i64", "i64"),
      ).not.toThrow();
    });

    it("should not throw for widening conversion", () => {
      expect(() =>
        TypeResolver.validateTypeConversion("u32", "u16"),
      ).not.toThrow();
      expect(() =>
        TypeResolver.validateTypeConversion("u64", "u8"),
      ).not.toThrow();
      expect(() =>
        TypeResolver.validateTypeConversion("i64", "i32"),
      ).not.toThrow();
    });

    it("should throw for narrowing conversion", () => {
      expect(() => TypeResolver.validateTypeConversion("u8", "u32")).toThrow(
        /narrowing/,
      );
      expect(() => TypeResolver.validateTypeConversion("u16", "u64")).toThrow(
        /narrowing/,
      );
    });

    it("should throw for sign conversion", () => {
      expect(() => TypeResolver.validateTypeConversion("u32", "i32")).toThrow(
        /sign change/,
      );
      expect(() => TypeResolver.validateTypeConversion("i32", "u32")).toThrow(
        /sign change/,
      );
    });

    it("should not throw when source type is null", () => {
      expect(() =>
        TypeResolver.validateTypeConversion("u32", null),
      ).not.toThrow();
    });

    it("should not throw for non-integer types", () => {
      expect(() =>
        TypeResolver.validateTypeConversion("f32", "f64"),
      ).not.toThrow();
      expect(() =>
        TypeResolver.validateTypeConversion("bool", "u8"),
      ).not.toThrow();
    });
  });

  // ========================================================================
  // Literal Validation
  // ========================================================================

  describe("validateLiteralFitsType", () => {
    describe("unsigned types", () => {
      it("should accept valid u8 values", () => {
        expect(() =>
          TypeResolver.validateLiteralFitsType("0", "u8"),
        ).not.toThrow();
        expect(() =>
          TypeResolver.validateLiteralFitsType("255", "u8"),
        ).not.toThrow();
        expect(() =>
          TypeResolver.validateLiteralFitsType("0xFF", "u8"),
        ).not.toThrow();
      });

      it("should reject out-of-range u8 values", () => {
        expect(() => TypeResolver.validateLiteralFitsType("256", "u8")).toThrow(
          /exceeds u8 range/,
        );
        expect(() =>
          TypeResolver.validateLiteralFitsType("1000", "u8"),
        ).toThrow(/exceeds u8 range/);
      });

      it("should reject negative values for unsigned types", () => {
        expect(() => TypeResolver.validateLiteralFitsType("-1", "u8")).toThrow(
          /Negative value/,
        );
        expect(() =>
          TypeResolver.validateLiteralFitsType("-100", "u32"),
        ).toThrow(/Negative value/);
      });

      it("should accept valid u16 values", () => {
        expect(() =>
          TypeResolver.validateLiteralFitsType("65535", "u16"),
        ).not.toThrow();
        expect(() =>
          TypeResolver.validateLiteralFitsType("0xFFFF", "u16"),
        ).not.toThrow();
      });

      it("should reject out-of-range u16 values", () => {
        expect(() =>
          TypeResolver.validateLiteralFitsType("65536", "u16"),
        ).toThrow(/exceeds u16 range/);
      });

      it("should accept valid u32 values", () => {
        expect(() =>
          TypeResolver.validateLiteralFitsType("4294967295", "u32"),
        ).not.toThrow();
        expect(() =>
          TypeResolver.validateLiteralFitsType("0xFFFFFFFF", "u32"),
        ).not.toThrow();
      });

      it("should reject out-of-range u32 values", () => {
        expect(() =>
          TypeResolver.validateLiteralFitsType("4294967296", "u32"),
        ).toThrow(/exceeds u32 range/);
      });
    });

    describe("signed types", () => {
      it("should accept valid i8 values", () => {
        expect(() =>
          TypeResolver.validateLiteralFitsType("-128", "i8"),
        ).not.toThrow();
        expect(() =>
          TypeResolver.validateLiteralFitsType("127", "i8"),
        ).not.toThrow();
        expect(() =>
          TypeResolver.validateLiteralFitsType("0", "i8"),
        ).not.toThrow();
      });

      it("should reject out-of-range i8 values", () => {
        expect(() => TypeResolver.validateLiteralFitsType("128", "i8")).toThrow(
          /exceeds i8 range/,
        );
        expect(() =>
          TypeResolver.validateLiteralFitsType("-129", "i8"),
        ).toThrow(/exceeds i8 range/);
      });

      it("should accept valid i32 values", () => {
        expect(() =>
          TypeResolver.validateLiteralFitsType("-2147483648", "i32"),
        ).not.toThrow();
        expect(() =>
          TypeResolver.validateLiteralFitsType("2147483647", "i32"),
        ).not.toThrow();
      });

      it("should reject out-of-range i32 values", () => {
        expect(() =>
          TypeResolver.validateLiteralFitsType("2147483648", "i32"),
        ).toThrow(/exceeds i32 range/);
        expect(() =>
          TypeResolver.validateLiteralFitsType("-2147483649", "i32"),
        ).toThrow(/exceeds i32 range/);
      });
    });

    describe("hex and binary literals", () => {
      it("should validate hex literals", () => {
        expect(() =>
          TypeResolver.validateLiteralFitsType("0xFF", "u8"),
        ).not.toThrow();
        expect(() =>
          TypeResolver.validateLiteralFitsType("0x100", "u8"),
        ).toThrow(/exceeds u8 range/);
      });

      it("should validate binary literals", () => {
        expect(() =>
          TypeResolver.validateLiteralFitsType("0b11111111", "u8"),
        ).not.toThrow();
        expect(() =>
          TypeResolver.validateLiteralFitsType("0b100000000", "u8"),
        ).toThrow(/exceeds u8 range/);
      });
    });

    describe("edge cases", () => {
      it("should skip validation for unknown types", () => {
        expect(() =>
          TypeResolver.validateLiteralFitsType("999999", "unknown"),
        ).not.toThrow();
        expect(() =>
          TypeResolver.validateLiteralFitsType("999999", "f32"),
        ).not.toThrow();
      });

      it("should skip validation for non-integer literals", () => {
        expect(() =>
          TypeResolver.validateLiteralFitsType("3.14", "u8"),
        ).not.toThrow();
        expect(() =>
          TypeResolver.validateLiteralFitsType("hello", "u8"),
        ).not.toThrow();
      });
    });
  });

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
        literal: () => (opts.literal ? { getText: () => opts.literal } : null),
        expression: () => null,
        castExpression: () =>
          opts.castType
            ? { type: () => ({ getText: () => opts.castType }) }
            : null,
      } as Parameters<typeof TypeResolver.getPrimaryExpressionType>[0];
    };

    it("should return type for identifier in registry", () => {
      typeRegistry.set("myVar", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });
      const ctx = mockPrimary({ identifier: "myVar" });
      expect(TypeResolver.getPrimaryExpressionType(ctx)).toBe("u32");
    });

    it("should return null for identifier not in registry", () => {
      const ctx = mockPrimary({ identifier: "unknownVar" });
      expect(TypeResolver.getPrimaryExpressionType(ctx)).toBeNull();
    });

    it("should return type from literal suffix", () => {
      const ctx = mockPrimary({ literal: "42u8" });
      expect(TypeResolver.getPrimaryExpressionType(ctx)).toBe("u8");
    });

    it("should return bool for boolean literal", () => {
      const ctx = mockPrimary({ literal: "true" });
      expect(TypeResolver.getPrimaryExpressionType(ctx)).toBe("bool");
    });

    it("should return type from cast expression", () => {
      const ctx = mockPrimary({ castType: "i16" });
      expect(TypeResolver.getPrimaryExpressionType(ctx)).toBe("i16");
    });

    it("should return null when no matching component", () => {
      const ctx = mockPrimary({});
      expect(TypeResolver.getPrimaryExpressionType(ctx)).toBeNull();
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
      } as unknown as Parameters<typeof TypeResolver.getExpressionType>[0];
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
      } as unknown as Parameters<typeof TypeResolver.getExpressionType>[0];
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
      } as unknown as Parameters<typeof TypeResolver.getExpressionType>[0];
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
      } as unknown as Parameters<typeof TypeResolver.getExpressionType>[0];
    };

    it("should return null for ternary expression (multiple or expressions)", () => {
      const ctx = mockExpressionWithOr(3);
      expect(TypeResolver.getExpressionType(ctx)).toBeNull();
    });

    it("should return bool for logical OR expression", () => {
      const ctx = mockExpressionWithAnd(2);
      expect(TypeResolver.getExpressionType(ctx)).toBe("bool");
    });

    it("should return bool for logical AND expression", () => {
      const ctx = mockExpressionWithEquality(2);
      expect(TypeResolver.getExpressionType(ctx)).toBe("bool");
    });

    it("should return bool for equality expression", () => {
      const ctx = mockExpressionWithRelational(2);
      expect(TypeResolver.getExpressionType(ctx)).toBe("bool");
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
      } as unknown as Parameters<typeof TypeResolver.getExpressionType>[0];

      expect(TypeResolver.getExpressionType(ctx)).toBeNull();
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
        typeof TypeResolver.getPostfixExpressionType
      >[0];

      expect(TypeResolver.getPostfixExpressionType(ctx)).toBeNull();
    });

    it("should return type from simple identifier", () => {
      typeRegistry.set("counter", {
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
        typeof TypeResolver.getPostfixExpressionType
      >[0];

      expect(TypeResolver.getPostfixExpressionType(ctx)).toBe("u32");
    });

    it("should return null when primary type cannot be determined", () => {
      const ctx = {
        primaryExpression: () => ({
          IDENTIFIER: () => ({ getText: () => "unknownVar" }),
          literal: () => null,
          expression: () => null,
          castExpression: () => null,
        }),
        children: [{ getText: () => "unknownVar" }],
      } as unknown as Parameters<
        typeof TypeResolver.getPostfixExpressionType
      >[0];

      expect(TypeResolver.getPostfixExpressionType(ctx)).toBeNull();
    });

    it("should return member type for struct member access", () => {
      typeRegistry.set("point", {
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
        typeof TypeResolver.getPostfixExpressionType
      >[0];

      expect(TypeResolver.getPostfixExpressionType(ctx)).toBe("i32");
    });

    it("should return null for unknown member", () => {
      typeRegistry.set("point", {
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
        typeof TypeResolver.getPostfixExpressionType
      >[0];

      expect(TypeResolver.getPostfixExpressionType(ctx)).toBeNull();
    });

    it("should return null for range bit indexing", () => {
      typeRegistry.set("flags", {
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
        typeof TypeResolver.getPostfixExpressionType
      >[0];

      expect(TypeResolver.getPostfixExpressionType(ctx)).toBeNull();
    });

    it("should return bool for single bit indexing on integer", () => {
      typeRegistry.set("flags", {
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
        typeof TypeResolver.getPostfixExpressionType
      >[0];

      expect(TypeResolver.getPostfixExpressionType(ctx)).toBe("bool");
    });

    it("should return element type for struct array member indexing", () => {
      typeRegistry.set("data", {
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
      } as unknown as Parameters<
        typeof TypeResolver.getPostfixExpressionType
      >[0];

      // Bug fix: After .values (u8 array), [0] should be array element access -> "u8"
      expect(TypeResolver.getPostfixExpressionType(ctx)).toBe("u8");
    });

    it("should return element type for direct array variable indexing", () => {
      typeRegistry.set("arr", {
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
        typeof TypeResolver.getPostfixExpressionType
      >[0];

      // u8 array with [0] should be array element access -> "u8" (not "bool")
      expect(TypeResolver.getPostfixExpressionType(ctx)).toBe("u8");
    });

    it("should return bool for bit indexing on plain integer variable", () => {
      typeRegistry.set("val", {
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
        typeof TypeResolver.getPostfixExpressionType
      >[0];

      // Plain u8 (not array) with [0] should be bit indexing -> "bool"
      expect(TypeResolver.getPostfixExpressionType(ctx)).toBe("bool");
    });
  });

  // ========================================================================
  // Unary Expression Type Detection
  // ========================================================================

  describe("getUnaryExpressionType", () => {
    it("should return type from postfix expression", () => {
      typeRegistry.set("value", {
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
      } as unknown as Parameters<typeof TypeResolver.getUnaryExpressionType>[0];

      expect(TypeResolver.getUnaryExpressionType(ctx)).toBe("i32");
    });

    it("should return null when no postfix or unary", () => {
      const ctx = {
        postfixExpression: () => null,
        unaryExpression: () => null,
      } as unknown as Parameters<typeof TypeResolver.getUnaryExpressionType>[0];

      expect(TypeResolver.getUnaryExpressionType(ctx)).toBeNull();
    });

    it("should recurse through unary expression chain", () => {
      typeRegistry.set("x", {
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
      } as unknown as Parameters<typeof TypeResolver.getUnaryExpressionType>[0];

      expect(TypeResolver.getUnaryExpressionType(ctx)).toBe("i32");
    });
  });

  // ========================================================================
  // Literal Type Detection
  // ========================================================================

  describe("getLiteralType", () => {
    const mockLiteral = (text: string) =>
      ({ getText: () => text }) as Parameters<
        typeof TypeResolver.getLiteralType
      >[0];

    describe("boolean literals", () => {
      it("should return bool for true", () => {
        expect(TypeResolver.getLiteralType(mockLiteral("true"))).toBe("bool");
      });

      it("should return bool for false", () => {
        expect(TypeResolver.getLiteralType(mockLiteral("false"))).toBe("bool");
      });
    });

    describe("integer suffixes", () => {
      it("should detect u8 suffix", () => {
        expect(TypeResolver.getLiteralType(mockLiteral("255u8"))).toBe("u8");
        expect(TypeResolver.getLiteralType(mockLiteral("0U8"))).toBe("u8");
      });

      it("should detect u16 suffix", () => {
        expect(TypeResolver.getLiteralType(mockLiteral("1000u16"))).toBe("u16");
      });

      it("should detect u32 suffix", () => {
        expect(TypeResolver.getLiteralType(mockLiteral("1000000u32"))).toBe(
          "u32",
        );
      });

      it("should detect u64 suffix", () => {
        expect(TypeResolver.getLiteralType(mockLiteral("1000000000u64"))).toBe(
          "u64",
        );
      });

      it("should detect i8 suffix", () => {
        expect(TypeResolver.getLiteralType(mockLiteral("-50i8"))).toBe("i8");
        expect(TypeResolver.getLiteralType(mockLiteral("50I8"))).toBe("i8");
      });

      it("should detect i16 suffix", () => {
        expect(TypeResolver.getLiteralType(mockLiteral("1000i16"))).toBe("i16");
      });

      it("should detect i32 suffix", () => {
        expect(TypeResolver.getLiteralType(mockLiteral("1000000i32"))).toBe(
          "i32",
        );
      });

      it("should detect i64 suffix", () => {
        expect(TypeResolver.getLiteralType(mockLiteral("1000000000i64"))).toBe(
          "i64",
        );
      });
    });

    describe("float suffixes", () => {
      it("should detect f32 suffix", () => {
        expect(TypeResolver.getLiteralType(mockLiteral("3.14f32"))).toBe("f32");
        expect(TypeResolver.getLiteralType(mockLiteral("3.14F32"))).toBe("f32");
      });

      it("should detect f64 suffix", () => {
        expect(TypeResolver.getLiteralType(mockLiteral("3.14159f64"))).toBe(
          "f64",
        );
        expect(TypeResolver.getLiteralType(mockLiteral("3.14159F64"))).toBe(
          "f64",
        );
      });
    });

    describe("unsuffixed literals", () => {
      it("should return null for unsuffixed integer", () => {
        expect(TypeResolver.getLiteralType(mockLiteral("42"))).toBeNull();
      });

      it("should return null for unsuffixed hex", () => {
        expect(TypeResolver.getLiteralType(mockLiteral("0xFF"))).toBeNull();
      });

      it("should return null for unsuffixed float", () => {
        expect(TypeResolver.getLiteralType(mockLiteral("3.14"))).toBeNull();
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

      const xInfo = TypeResolver.getMemberTypeInfo("Point", "x");
      expect(xInfo).toBeDefined();
      expect(xInfo?.baseType).toBe("i32");
      expect(xInfo?.isArray).toBe(false);
    });

    it("should return array info for array fields", () => {
      symbolTable.addStructField("Buffer", "data", "u8", [256]);

      const dataInfo = TypeResolver.getMemberTypeInfo("Buffer", "data");
      expect(dataInfo).toBeDefined();
      expect(dataInfo?.baseType).toBe("u8");
      expect(dataInfo?.isArray).toBe(true);
    });

    it("should return undefined for unknown struct", () => {
      expect(
        TypeResolver.getMemberTypeInfo("Unknown", "field"),
      ).toBeUndefined();
    });

    it("should return undefined for unknown field", () => {
      symbolTable.addStructField("Point", "x", "i32");
      expect(TypeResolver.getMemberTypeInfo("Point", "z")).toBeUndefined();
    });
  });
});
