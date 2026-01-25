/**
 * Unit tests for TypeResolver
 * Tests type classification, conversion validation, and literal validation
 */
import { describe, it, expect, beforeEach } from "vitest";
import TypeResolver from "./TypeResolver";
import SymbolTable from "../symbol_resolution/SymbolTable";
import ITypeResolverDeps from "./types/ITypeResolverDeps";
import TTypeInfo from "./types/TTypeInfo";

describe("TypeResolver", () => {
  let resolver: TypeResolver;
  let symbolTable: SymbolTable;
  let typeRegistry: Map<string, TTypeInfo>;

  beforeEach(() => {
    symbolTable = new SymbolTable();
    typeRegistry = new Map();

    const deps: ITypeResolverDeps = {
      symbols: null,
      symbolTable,
      typeRegistry,
      resolveIdentifier: (name: string) => name,
    };

    resolver = new TypeResolver(deps);
  });

  // ========================================================================
  // Type Classification Methods
  // ========================================================================

  describe("isIntegerType", () => {
    it("should return true for unsigned integer types", () => {
      expect(resolver.isIntegerType("u8")).toBe(true);
      expect(resolver.isIntegerType("u16")).toBe(true);
      expect(resolver.isIntegerType("u32")).toBe(true);
      expect(resolver.isIntegerType("u64")).toBe(true);
    });

    it("should return true for signed integer types", () => {
      expect(resolver.isIntegerType("i8")).toBe(true);
      expect(resolver.isIntegerType("i16")).toBe(true);
      expect(resolver.isIntegerType("i32")).toBe(true);
      expect(resolver.isIntegerType("i64")).toBe(true);
    });

    it("should return false for non-integer types", () => {
      expect(resolver.isIntegerType("f32")).toBe(false);
      expect(resolver.isIntegerType("f64")).toBe(false);
      expect(resolver.isIntegerType("bool")).toBe(false);
      expect(resolver.isIntegerType("void")).toBe(false);
      expect(resolver.isIntegerType("MyStruct")).toBe(false);
    });
  });

  describe("isFloatType", () => {
    it("should return true for float types", () => {
      expect(resolver.isFloatType("f32")).toBe(true);
      expect(resolver.isFloatType("f64")).toBe(true);
    });

    it("should return false for non-float types", () => {
      expect(resolver.isFloatType("u32")).toBe(false);
      expect(resolver.isFloatType("i32")).toBe(false);
      expect(resolver.isFloatType("bool")).toBe(false);
    });
  });

  describe("isSignedType", () => {
    it("should return true for signed integer types", () => {
      expect(resolver.isSignedType("i8")).toBe(true);
      expect(resolver.isSignedType("i16")).toBe(true);
      expect(resolver.isSignedType("i32")).toBe(true);
      expect(resolver.isSignedType("i64")).toBe(true);
    });

    it("should return false for unsigned types", () => {
      expect(resolver.isSignedType("u8")).toBe(false);
      expect(resolver.isSignedType("u16")).toBe(false);
      expect(resolver.isSignedType("u32")).toBe(false);
      expect(resolver.isSignedType("u64")).toBe(false);
    });

    it("should return false for non-integer types", () => {
      expect(resolver.isSignedType("f32")).toBe(false);
      expect(resolver.isSignedType("bool")).toBe(false);
    });
  });

  describe("isUnsignedType", () => {
    it("should return true for unsigned integer types", () => {
      expect(resolver.isUnsignedType("u8")).toBe(true);
      expect(resolver.isUnsignedType("u16")).toBe(true);
      expect(resolver.isUnsignedType("u32")).toBe(true);
      expect(resolver.isUnsignedType("u64")).toBe(true);
    });

    it("should return false for signed types", () => {
      expect(resolver.isUnsignedType("i8")).toBe(false);
      expect(resolver.isUnsignedType("i16")).toBe(false);
      expect(resolver.isUnsignedType("i32")).toBe(false);
      expect(resolver.isUnsignedType("i64")).toBe(false);
    });

    it("should return false for non-integer types", () => {
      expect(resolver.isUnsignedType("f32")).toBe(false);
      expect(resolver.isUnsignedType("bool")).toBe(false);
    });
  });

  // ========================================================================
  // Struct Type Detection
  // ========================================================================

  describe("isStructType", () => {
    it("should return true for struct with fields in SymbolTable", () => {
      symbolTable.addStructField("Point", "x", "i32");
      symbolTable.addStructField("Point", "y", "i32");

      expect(resolver.isStructType("Point")).toBe(true);
    });

    it("should return false for unknown type", () => {
      expect(resolver.isStructType("UnknownStruct")).toBe(false);
    });

    it("should return false for primitive types", () => {
      expect(resolver.isStructType("u32")).toBe(false);
      expect(resolver.isStructType("f64")).toBe(false);
    });
  });

  // ========================================================================
  // Type Conversion Validation
  // ========================================================================

  describe("isNarrowingConversion", () => {
    it("should return true when target is smaller than source", () => {
      expect(resolver.isNarrowingConversion("u32", "u16")).toBe(true);
      expect(resolver.isNarrowingConversion("u32", "u8")).toBe(true);
      expect(resolver.isNarrowingConversion("u64", "u32")).toBe(true);
      expect(resolver.isNarrowingConversion("i64", "i8")).toBe(true);
    });

    it("should return false when target is same size or larger", () => {
      expect(resolver.isNarrowingConversion("u16", "u32")).toBe(false);
      expect(resolver.isNarrowingConversion("u32", "u32")).toBe(false);
      expect(resolver.isNarrowingConversion("u8", "u64")).toBe(false);
    });

    it("should return false for unknown types", () => {
      expect(resolver.isNarrowingConversion("unknown", "u32")).toBe(false);
      expect(resolver.isNarrowingConversion("u32", "unknown")).toBe(false);
    });
  });

  describe("isSignConversion", () => {
    it("should return true for signed to unsigned conversion", () => {
      expect(resolver.isSignConversion("i32", "u32")).toBe(true);
      expect(resolver.isSignConversion("i8", "u64")).toBe(true);
    });

    it("should return true for unsigned to signed conversion", () => {
      expect(resolver.isSignConversion("u32", "i32")).toBe(true);
      expect(resolver.isSignConversion("u8", "i64")).toBe(true);
    });

    it("should return false for same-sign conversion", () => {
      expect(resolver.isSignConversion("i32", "i64")).toBe(false);
      expect(resolver.isSignConversion("u32", "u64")).toBe(false);
    });

    it("should return false for non-integer types", () => {
      expect(resolver.isSignConversion("f32", "f64")).toBe(false);
      expect(resolver.isSignConversion("bool", "u8")).toBe(false);
    });
  });

  describe("validateTypeConversion", () => {
    it("should not throw for same type", () => {
      expect(() => resolver.validateTypeConversion("u32", "u32")).not.toThrow();
      expect(() => resolver.validateTypeConversion("i64", "i64")).not.toThrow();
    });

    it("should not throw for widening conversion", () => {
      expect(() => resolver.validateTypeConversion("u32", "u16")).not.toThrow();
      expect(() => resolver.validateTypeConversion("u64", "u8")).not.toThrow();
      expect(() => resolver.validateTypeConversion("i64", "i32")).not.toThrow();
    });

    it("should throw for narrowing conversion", () => {
      expect(() => resolver.validateTypeConversion("u8", "u32")).toThrow(
        /narrowing/,
      );
      expect(() => resolver.validateTypeConversion("u16", "u64")).toThrow(
        /narrowing/,
      );
    });

    it("should throw for sign conversion", () => {
      expect(() => resolver.validateTypeConversion("u32", "i32")).toThrow(
        /sign change/,
      );
      expect(() => resolver.validateTypeConversion("i32", "u32")).toThrow(
        /sign change/,
      );
    });

    it("should not throw when source type is null", () => {
      expect(() => resolver.validateTypeConversion("u32", null)).not.toThrow();
    });

    it("should not throw for non-integer types", () => {
      expect(() => resolver.validateTypeConversion("f32", "f64")).not.toThrow();
      expect(() => resolver.validateTypeConversion("bool", "u8")).not.toThrow();
    });
  });

  // ========================================================================
  // Literal Validation
  // ========================================================================

  describe("validateLiteralFitsType", () => {
    describe("unsigned types", () => {
      it("should accept valid u8 values", () => {
        expect(() => resolver.validateLiteralFitsType("0", "u8")).not.toThrow();
        expect(() =>
          resolver.validateLiteralFitsType("255", "u8"),
        ).not.toThrow();
        expect(() =>
          resolver.validateLiteralFitsType("0xFF", "u8"),
        ).not.toThrow();
      });

      it("should reject out-of-range u8 values", () => {
        expect(() => resolver.validateLiteralFitsType("256", "u8")).toThrow(
          /exceeds u8 range/,
        );
        expect(() => resolver.validateLiteralFitsType("1000", "u8")).toThrow(
          /exceeds u8 range/,
        );
      });

      it("should reject negative values for unsigned types", () => {
        expect(() => resolver.validateLiteralFitsType("-1", "u8")).toThrow(
          /Negative value/,
        );
        expect(() => resolver.validateLiteralFitsType("-100", "u32")).toThrow(
          /Negative value/,
        );
      });

      it("should accept valid u16 values", () => {
        expect(() =>
          resolver.validateLiteralFitsType("65535", "u16"),
        ).not.toThrow();
        expect(() =>
          resolver.validateLiteralFitsType("0xFFFF", "u16"),
        ).not.toThrow();
      });

      it("should reject out-of-range u16 values", () => {
        expect(() => resolver.validateLiteralFitsType("65536", "u16")).toThrow(
          /exceeds u16 range/,
        );
      });

      it("should accept valid u32 values", () => {
        expect(() =>
          resolver.validateLiteralFitsType("4294967295", "u32"),
        ).not.toThrow();
        expect(() =>
          resolver.validateLiteralFitsType("0xFFFFFFFF", "u32"),
        ).not.toThrow();
      });

      it("should reject out-of-range u32 values", () => {
        expect(() =>
          resolver.validateLiteralFitsType("4294967296", "u32"),
        ).toThrow(/exceeds u32 range/);
      });
    });

    describe("signed types", () => {
      it("should accept valid i8 values", () => {
        expect(() =>
          resolver.validateLiteralFitsType("-128", "i8"),
        ).not.toThrow();
        expect(() =>
          resolver.validateLiteralFitsType("127", "i8"),
        ).not.toThrow();
        expect(() => resolver.validateLiteralFitsType("0", "i8")).not.toThrow();
      });

      it("should reject out-of-range i8 values", () => {
        expect(() => resolver.validateLiteralFitsType("128", "i8")).toThrow(
          /exceeds i8 range/,
        );
        expect(() => resolver.validateLiteralFitsType("-129", "i8")).toThrow(
          /exceeds i8 range/,
        );
      });

      it("should accept valid i32 values", () => {
        expect(() =>
          resolver.validateLiteralFitsType("-2147483648", "i32"),
        ).not.toThrow();
        expect(() =>
          resolver.validateLiteralFitsType("2147483647", "i32"),
        ).not.toThrow();
      });

      it("should reject out-of-range i32 values", () => {
        expect(() =>
          resolver.validateLiteralFitsType("2147483648", "i32"),
        ).toThrow(/exceeds i32 range/);
        expect(() =>
          resolver.validateLiteralFitsType("-2147483649", "i32"),
        ).toThrow(/exceeds i32 range/);
      });
    });

    describe("hex and binary literals", () => {
      it("should validate hex literals", () => {
        expect(() =>
          resolver.validateLiteralFitsType("0xFF", "u8"),
        ).not.toThrow();
        expect(() => resolver.validateLiteralFitsType("0x100", "u8")).toThrow(
          /exceeds u8 range/,
        );
      });

      it("should validate binary literals", () => {
        expect(() =>
          resolver.validateLiteralFitsType("0b11111111", "u8"),
        ).not.toThrow();
        expect(() =>
          resolver.validateLiteralFitsType("0b100000000", "u8"),
        ).toThrow(/exceeds u8 range/);
      });
    });

    describe("edge cases", () => {
      it("should skip validation for unknown types", () => {
        expect(() =>
          resolver.validateLiteralFitsType("999999", "unknown"),
        ).not.toThrow();
        expect(() =>
          resolver.validateLiteralFitsType("999999", "f32"),
        ).not.toThrow();
      });

      it("should skip validation for non-integer literals", () => {
        expect(() =>
          resolver.validateLiteralFitsType("3.14", "u8"),
        ).not.toThrow();
        expect(() =>
          resolver.validateLiteralFitsType("hello", "u8"),
        ).not.toThrow();
      });
    });
  });

  // ========================================================================
  // Primary Expression Type Detection
  // ========================================================================

  describe("getPrimaryExpressionType", () => {
    // Helper to create mock primary expression context
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
      } as Parameters<typeof resolver.getPrimaryExpressionType>[0];
    };

    it("should return type for identifier in registry", () => {
      typeRegistry.set("myVar", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });
      const ctx = mockPrimary({ identifier: "myVar" });
      expect(resolver.getPrimaryExpressionType(ctx)).toBe("u32");
    });

    it("should return null for identifier not in registry", () => {
      const ctx = mockPrimary({ identifier: "unknownVar" });
      expect(resolver.getPrimaryExpressionType(ctx)).toBeNull();
    });

    it("should return type from literal suffix", () => {
      const ctx = mockPrimary({ literal: "42u8" });
      expect(resolver.getPrimaryExpressionType(ctx)).toBe("u8");
    });

    it("should return bool for boolean literal", () => {
      const ctx = mockPrimary({ literal: "true" });
      expect(resolver.getPrimaryExpressionType(ctx)).toBe("bool");
    });

    it("should return type from cast expression", () => {
      const ctx = mockPrimary({ castType: "i16" });
      expect(resolver.getPrimaryExpressionType(ctx)).toBe("i16");
    });

    it("should return null when no matching component", () => {
      const ctx = mockPrimary({});
      expect(resolver.getPrimaryExpressionType(ctx)).toBeNull();
    });
  });

  // ========================================================================
  // Expression Type Detection
  // ========================================================================

  describe("getExpressionType", () => {
    // Helper to create mock expression context with nested structure
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
      } as unknown as Parameters<typeof resolver.getExpressionType>[0];
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
      } as unknown as Parameters<typeof resolver.getExpressionType>[0];
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
      } as unknown as Parameters<typeof resolver.getExpressionType>[0];
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
      } as unknown as Parameters<typeof resolver.getExpressionType>[0];
    };

    it("should return null for ternary expression (multiple or expressions)", () => {
      const ctx = mockExpressionWithOr(3);
      expect(resolver.getExpressionType(ctx)).toBeNull();
    });

    it("should return bool for logical OR expression", () => {
      const ctx = mockExpressionWithAnd(2);
      expect(resolver.getExpressionType(ctx)).toBe("bool");
    });

    it("should return bool for logical AND expression", () => {
      const ctx = mockExpressionWithEquality(2);
      expect(resolver.getExpressionType(ctx)).toBe("bool");
    });

    it("should return bool for equality expression", () => {
      const ctx = mockExpressionWithRelational(2);
      expect(resolver.getExpressionType(ctx)).toBe("bool");
    });

    it("should return null for simple arithmetic expression", () => {
      // Expression with 1 of each - falls through to null (can't determine arithmetic type)
      // Need to mock the full depth of the expression tree
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
                                                  // 2 unary expressions = binary operation, can't determine type
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
      } as unknown as Parameters<typeof resolver.getExpressionType>[0];

      expect(resolver.getExpressionType(ctx)).toBeNull();
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
      } as unknown as Parameters<typeof resolver.getPostfixExpressionType>[0];

      expect(resolver.getPostfixExpressionType(ctx)).toBeNull();
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
      } as unknown as Parameters<typeof resolver.getPostfixExpressionType>[0];

      expect(resolver.getPostfixExpressionType(ctx)).toBe("u32");
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
      } as unknown as Parameters<typeof resolver.getPostfixExpressionType>[0];

      expect(resolver.getPostfixExpressionType(ctx)).toBeNull();
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
      } as unknown as Parameters<typeof resolver.getPostfixExpressionType>[0];

      expect(resolver.getPostfixExpressionType(ctx)).toBe("i32");
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
      } as unknown as Parameters<typeof resolver.getPostfixExpressionType>[0];

      expect(resolver.getPostfixExpressionType(ctx)).toBeNull();
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
      } as unknown as Parameters<typeof resolver.getPostfixExpressionType>[0];

      expect(resolver.getPostfixExpressionType(ctx)).toBeNull();
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
      } as unknown as Parameters<typeof resolver.getPostfixExpressionType>[0];

      expect(resolver.getPostfixExpressionType(ctx)).toBe("bool");
    });

    it("should return element type for array indexing on non-integer", () => {
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
      } as unknown as Parameters<typeof resolver.getPostfixExpressionType>[0];

      // After .values, type is "u8" (array element type)
      // Then [0] on "u8" - u8 is an integer, so it returns "bool" for bit access
      expect(resolver.getPostfixExpressionType(ctx)).toBe("bool");
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
      } as unknown as Parameters<typeof resolver.getUnaryExpressionType>[0];

      expect(resolver.getUnaryExpressionType(ctx)).toBe("i32");
    });

    it("should return null when no postfix or unary", () => {
      const ctx = {
        postfixExpression: () => null,
        unaryExpression: () => null,
      } as unknown as Parameters<typeof resolver.getUnaryExpressionType>[0];

      expect(resolver.getUnaryExpressionType(ctx)).toBeNull();
    });

    it("should recurse through unary expression chain", () => {
      typeRegistry.set("x", {
        baseType: "i32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });

      // Represents: -x (unary minus with nested expression)
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
      } as unknown as Parameters<typeof resolver.getUnaryExpressionType>[0];

      expect(resolver.getUnaryExpressionType(ctx)).toBe("i32");
    });
  });

  // ========================================================================
  // Literal Type Detection
  // ========================================================================

  describe("getLiteralType", () => {
    // Helper to create mock literal context
    const mockLiteral = (text: string) =>
      ({ getText: () => text }) as Parameters<
        typeof resolver.getLiteralType
      >[0];

    describe("boolean literals", () => {
      it("should return bool for true", () => {
        expect(resolver.getLiteralType(mockLiteral("true"))).toBe("bool");
      });

      it("should return bool for false", () => {
        expect(resolver.getLiteralType(mockLiteral("false"))).toBe("bool");
      });
    });

    describe("integer suffixes", () => {
      it("should detect u8 suffix", () => {
        expect(resolver.getLiteralType(mockLiteral("255u8"))).toBe("u8");
        expect(resolver.getLiteralType(mockLiteral("0U8"))).toBe("u8");
      });

      it("should detect u16 suffix", () => {
        expect(resolver.getLiteralType(mockLiteral("1000u16"))).toBe("u16");
      });

      it("should detect u32 suffix", () => {
        expect(resolver.getLiteralType(mockLiteral("1000000u32"))).toBe("u32");
      });

      it("should detect u64 suffix", () => {
        expect(resolver.getLiteralType(mockLiteral("1000000000u64"))).toBe(
          "u64",
        );
      });

      it("should detect i8 suffix", () => {
        expect(resolver.getLiteralType(mockLiteral("-50i8"))).toBe("i8");
        expect(resolver.getLiteralType(mockLiteral("50I8"))).toBe("i8");
      });

      it("should detect i16 suffix", () => {
        expect(resolver.getLiteralType(mockLiteral("1000i16"))).toBe("i16");
      });

      it("should detect i32 suffix", () => {
        expect(resolver.getLiteralType(mockLiteral("1000000i32"))).toBe("i32");
      });

      it("should detect i64 suffix", () => {
        expect(resolver.getLiteralType(mockLiteral("1000000000i64"))).toBe(
          "i64",
        );
      });
    });

    describe("float suffixes", () => {
      it("should detect f32 suffix", () => {
        expect(resolver.getLiteralType(mockLiteral("3.14f32"))).toBe("f32");
        expect(resolver.getLiteralType(mockLiteral("3.14F32"))).toBe("f32");
      });

      it("should detect f64 suffix", () => {
        expect(resolver.getLiteralType(mockLiteral("3.14159f64"))).toBe("f64");
        expect(resolver.getLiteralType(mockLiteral("3.14159F64"))).toBe("f64");
      });
    });

    describe("unsuffixed literals", () => {
      it("should return null for unsuffixed integer", () => {
        expect(resolver.getLiteralType(mockLiteral("42"))).toBeNull();
      });

      it("should return null for unsuffixed hex", () => {
        expect(resolver.getLiteralType(mockLiteral("0xFF"))).toBeNull();
      });

      it("should return null for unsuffixed float", () => {
        expect(resolver.getLiteralType(mockLiteral("3.14"))).toBeNull();
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

      const xInfo = resolver.getMemberTypeInfo("Point", "x");
      expect(xInfo).toBeDefined();
      expect(xInfo?.baseType).toBe("i32");
      expect(xInfo?.isArray).toBe(false);
    });

    it("should return array info for array fields", () => {
      symbolTable.addStructField("Buffer", "data", "u8", [256]);

      const dataInfo = resolver.getMemberTypeInfo("Buffer", "data");
      expect(dataInfo).toBeDefined();
      expect(dataInfo?.baseType).toBe("u8");
      expect(dataInfo?.isArray).toBe(true);
    });

    it("should return undefined for unknown struct", () => {
      expect(resolver.getMemberTypeInfo("Unknown", "field")).toBeUndefined();
    });

    it("should return undefined for unknown field", () => {
      symbolTable.addStructField("Point", "x", "i32");
      expect(resolver.getMemberTypeInfo("Point", "z")).toBeUndefined();
    });
  });
});
