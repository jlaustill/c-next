/**
 * Unit tests for TypeValidator
 * Tests include validation, identifier validation, and type checking
 */
import { describe, it, expect, beforeEach } from "vitest";
import TypeValidator from "./TypeValidator";
import TypeResolver from "./TypeResolver";
import SymbolTable from "../../logic/symbols/SymbolTable";
import ITypeValidatorDeps from "./types/ITypeValidatorDeps";
import ITypeResolverDeps from "./types/ITypeResolverDeps";
import TTypeInfo from "./types/TTypeInfo";

describe("TypeValidator", () => {
  let validator: TypeValidator;
  let symbolTable: SymbolTable;
  let typeRegistry: Map<string, TTypeInfo>;
  let typeResolver: TypeResolver;

  beforeEach(() => {
    symbolTable = new SymbolTable();
    typeRegistry = new Map();

    const resolverDeps: ITypeResolverDeps = {
      symbols: null,
      symbolTable,
      typeRegistry,
      resolveIdentifier: (name: string) => name,
    };
    typeResolver = new TypeResolver(resolverDeps);

    const validatorDeps: ITypeValidatorDeps = {
      symbols: null,
      symbolTable,
      typeRegistry,
      typeResolver,
      callbackTypes: new Map(),
      knownFunctions: new Set(),
      knownGlobals: new Set(),
      getCurrentScope: () => null,
      getScopeMembers: () => new Map(),
      getCurrentParameters: () => new Map(),
      getLocalVariables: () => new Set(),
      resolveIdentifier: (name: string) => name,
      getExpressionType: () => null,
    };

    validator = new TypeValidator(validatorDeps);
  });

  // ========================================================================
  // Include Validation (ADR-010)
  // ========================================================================

  describe("validateIncludeNotImplementationFile", () => {
    describe("should allow header files", () => {
      it("should allow .h files with angle brackets", () => {
        expect(() =>
          validator.validateIncludeNotImplementationFile(
            "#include <stdio.h>",
            1,
          ),
        ).not.toThrow();
      });

      it("should allow .h files with quotes", () => {
        expect(() =>
          validator.validateIncludeNotImplementationFile(
            '#include "myheader.h"',
            1,
          ),
        ).not.toThrow();
      });

      it("should allow .hpp files", () => {
        expect(() =>
          validator.validateIncludeNotImplementationFile(
            "#include <vector.hpp>",
            1,
          ),
        ).not.toThrow();
      });

      it("should allow .cnx files", () => {
        expect(() =>
          validator.validateIncludeNotImplementationFile(
            '#include "module.cnx"',
            1,
          ),
        ).not.toThrow();
      });
    });

    describe("should reject implementation files", () => {
      it("should reject .c files", () => {
        expect(() =>
          validator.validateIncludeNotImplementationFile(
            '#include "impl.c"',
            10,
          ),
        ).toThrow(/E0503.*Cannot #include implementation file.*impl\.c/);
      });

      it("should reject .cpp files", () => {
        expect(() =>
          validator.validateIncludeNotImplementationFile(
            "#include <module.cpp>",
            5,
          ),
        ).toThrow(/E0503.*Cannot #include implementation file.*module\.cpp/);
      });

      it("should reject .cc files", () => {
        expect(() =>
          validator.validateIncludeNotImplementationFile(
            '#include "code.cc"',
            1,
          ),
        ).toThrow(/E0503.*Cannot #include implementation file.*code\.cc/);
      });

      it("should reject .cxx files", () => {
        expect(() =>
          validator.validateIncludeNotImplementationFile(
            '#include "code.cxx"',
            1,
          ),
        ).toThrow(/E0503.*Cannot #include implementation file/);
      });

      it("should reject .c++ files", () => {
        expect(() =>
          validator.validateIncludeNotImplementationFile(
            '#include "code.c++"',
            1,
          ),
        ).toThrow(/E0503.*Cannot #include implementation file/);
      });
    });

    describe("edge cases", () => {
      it("should handle malformed includes gracefully", () => {
        expect(() =>
          validator.validateIncludeNotImplementationFile("#include", 1),
        ).not.toThrow();

        expect(() =>
          validator.validateIncludeNotImplementationFile("#include broken", 1),
        ).not.toThrow();
      });

      it("should be case-insensitive for extensions", () => {
        expect(() =>
          validator.validateIncludeNotImplementationFile(
            '#include "file.C"',
            1,
          ),
        ).toThrow(/E0503/);

        expect(() =>
          validator.validateIncludeNotImplementationFile(
            '#include "file.CPP"',
            1,
          ),
        ).toThrow(/E0503/);
      });

      it("should include line number in error message", () => {
        expect(() =>
          validator.validateIncludeNotImplementationFile(
            '#include "impl.c"',
            42,
          ),
        ).toThrow(/Line 42/);
      });
    });
  });

  // ========================================================================
  // CNX Alternative Validation (E0504)
  // ========================================================================

  describe("validateIncludeNoCnxAlternative", () => {
    describe("should skip non-header files", () => {
      it("should skip .cnx includes", () => {
        expect(() =>
          validator.validateIncludeNoCnxAlternative(
            '#include "module.cnx"',
            1,
            "/src/main.cnx",
            [],
            () => true, // Always return true - should still not throw
          ),
        ).not.toThrow();
      });

      it("should skip non-h/hpp files", () => {
        expect(() =>
          validator.validateIncludeNoCnxAlternative(
            '#include "data.json"',
            1,
            "/src/main.cnx",
            [],
            () => true,
          ),
        ).not.toThrow();
      });
    });

    describe("quoted includes (relative to source)", () => {
      it("should throw when .cnx alternative exists", () => {
        expect(() =>
          validator.validateIncludeNoCnxAlternative(
            '#include "driver.h"',
            10,
            "/project/src/main.cnx",
            [],
            (path: string) => path.endsWith("driver.cnx"),
          ),
        ).toThrow(/E0504.*driver\.cnx.*exists/);
      });

      it("should not throw when .cnx alternative does not exist", () => {
        expect(() =>
          validator.validateIncludeNoCnxAlternative(
            '#include "driver.h"',
            10,
            "/project/src/main.cnx",
            [],
            () => false,
          ),
        ).not.toThrow();
      });

      it("should skip when sourcePath is null", () => {
        expect(() =>
          validator.validateIncludeNoCnxAlternative(
            '#include "driver.h"',
            10,
            null,
            [],
            () => true,
          ),
        ).not.toThrow();
      });
    });

    describe("angle bracket includes (search paths)", () => {
      it("should throw when .cnx alternative exists in include path", () => {
        expect(() =>
          validator.validateIncludeNoCnxAlternative(
            "#include <sensors/temp.h>",
            5,
            "/project/src/main.cnx",
            ["/project/include"],
            (path: string) => path === "/project/include/sensors/temp.cnx",
          ),
        ).toThrow(/E0504.*temp\.cnx.*exists/);
      });

      it("should not throw when .cnx alternative does not exist", () => {
        expect(() =>
          validator.validateIncludeNoCnxAlternative(
            "#include <sensors/temp.h>",
            5,
            "/project/src/main.cnx",
            ["/project/include"],
            () => false,
          ),
        ).not.toThrow();
      });

      it("should search multiple include paths", () => {
        const checkedPaths: string[] = [];
        validator.validateIncludeNoCnxAlternative(
          "#include <util.h>",
          1,
          "/src/main.cnx",
          ["/include1", "/include2", "/include3"],
          (path: string) => {
            checkedPaths.push(path);
            return false;
          },
        );

        expect(checkedPaths).toContain("/include1/util.cnx");
        expect(checkedPaths).toContain("/include2/util.cnx");
        expect(checkedPaths).toContain("/include3/util.cnx");
      });
    });

    describe("edge cases", () => {
      it("should handle malformed includes gracefully", () => {
        expect(() =>
          validator.validateIncludeNoCnxAlternative(
            "#include broken",
            1,
            "/src/main.cnx",
            [],
            () => true,
          ),
        ).not.toThrow();
      });

      it("should handle .hpp files", () => {
        expect(() =>
          validator.validateIncludeNoCnxAlternative(
            '#include "module.hpp"',
            1,
            "/src/main.cnx",
            [],
            (path: string) => path.endsWith("module.cnx"),
          ),
        ).toThrow(/E0504.*module\.cnx/);
      });
    });
  });

  // ========================================================================
  // Callback Signature Matching (ADR-029)
  // ========================================================================

  describe("callbackSignaturesMatch", () => {
    it("should return true for matching signatures", () => {
      const a = {
        functionName: "fnA",
        typedefName: "fnA_fp",
        returnType: "void",
        parameters: [
          {
            name: "p",
            type: "u32",
            isConst: false,
            isPointer: false,
            isArray: false,
            arrayDims: "",
          },
        ],
      };
      const b = {
        functionName: "fnB",
        typedefName: "fnB_fp",
        returnType: "void",
        parameters: [
          {
            name: "p",
            type: "u32",
            isConst: false,
            isPointer: false,
            isArray: false,
            arrayDims: "",
          },
        ],
      };
      expect(validator.callbackSignaturesMatch(a, b)).toBe(true);
    });

    it("should return false for different return types", () => {
      const a = {
        functionName: "fnA",
        typedefName: "fnA_fp",
        returnType: "void",
        parameters: [],
      };
      const b = {
        functionName: "fnB",
        typedefName: "fnB_fp",
        returnType: "u32",
        parameters: [],
      };
      expect(validator.callbackSignaturesMatch(a, b)).toBe(false);
    });

    it("should return false for different parameter counts", () => {
      const a = {
        functionName: "fnA",
        typedefName: "fnA_fp",
        returnType: "void",
        parameters: [
          {
            name: "p",
            type: "u32",
            isConst: false,
            isPointer: false,
            isArray: false,
            arrayDims: "",
          },
        ],
      };
      const b = {
        functionName: "fnB",
        typedefName: "fnB_fp",
        returnType: "void",
        parameters: [],
      };
      expect(validator.callbackSignaturesMatch(a, b)).toBe(false);
    });

    it("should return false for different parameter types", () => {
      const a = {
        functionName: "fnA",
        typedefName: "fnA_fp",
        returnType: "void",
        parameters: [
          {
            name: "p",
            type: "u32",
            isConst: false,
            isPointer: false,
            isArray: false,
            arrayDims: "",
          },
        ],
      };
      const b = {
        functionName: "fnB",
        typedefName: "fnB_fp",
        returnType: "void",
        parameters: [
          {
            name: "p",
            type: "i32",
            isConst: false,
            isPointer: false,
            isArray: false,
            arrayDims: "",
          },
        ],
      };
      expect(validator.callbackSignaturesMatch(a, b)).toBe(false);
    });

    it("should return false for different const qualifiers", () => {
      const a = {
        functionName: "fnA",
        typedefName: "fnA_fp",
        returnType: "void",
        parameters: [
          {
            name: "p",
            type: "u32",
            isConst: true,
            isPointer: false,
            isArray: false,
            arrayDims: "",
          },
        ],
      };
      const b = {
        functionName: "fnB",
        typedefName: "fnB_fp",
        returnType: "void",
        parameters: [
          {
            name: "p",
            type: "u32",
            isConst: false,
            isPointer: false,
            isArray: false,
            arrayDims: "",
          },
        ],
      };
      expect(validator.callbackSignaturesMatch(a, b)).toBe(false);
    });

    it("should return false for different pointer qualifiers", () => {
      const a = {
        functionName: "fnA",
        typedefName: "fnA_fp",
        returnType: "void",
        parameters: [
          {
            name: "p",
            type: "u32",
            isConst: false,
            isPointer: true,
            isArray: false,
            arrayDims: "",
          },
        ],
      };
      const b = {
        functionName: "fnB",
        typedefName: "fnB_fp",
        returnType: "void",
        parameters: [
          {
            name: "p",
            type: "u32",
            isConst: false,
            isPointer: false,
            isArray: false,
            arrayDims: "",
          },
        ],
      };
      expect(validator.callbackSignaturesMatch(a, b)).toBe(false);
    });

    it("should return false for different array qualifiers", () => {
      const a = {
        functionName: "fnA",
        typedefName: "fnA_fp",
        returnType: "void",
        parameters: [
          {
            name: "p",
            type: "u32",
            isConst: false,
            isPointer: false,
            isArray: true,
            arrayDims: "",
          },
        ],
      };
      const b = {
        functionName: "fnB",
        typedefName: "fnB_fp",
        returnType: "void",
        parameters: [
          {
            name: "p",
            type: "u32",
            isConst: false,
            isPointer: false,
            isArray: false,
            arrayDims: "",
          },
        ],
      };
      expect(validator.callbackSignaturesMatch(a, b)).toBe(false);
    });
  });

  // ========================================================================
  // Const Assignment Validation (ADR-013)
  // ========================================================================

  describe("checkConstAssignment", () => {
    it("should return error message for const parameter", () => {
      const params = new Map();
      params.set("x", { type: "u32", isConst: true });

      const deps: ITypeValidatorDeps = {
        symbols: null,
        symbolTable,
        typeRegistry,
        typeResolver,
        callbackTypes: new Map(),
        knownFunctions: new Set(),
        knownGlobals: new Set(),
        getCurrentScope: () => null,
        getScopeMembers: () => new Map(),
        getCurrentParameters: () => params,
        getLocalVariables: () => new Set(),
        resolveIdentifier: (name: string) => name,
        getExpressionType: () => null,
      };

      const v = new TypeValidator(deps);
      expect(v.checkConstAssignment("x")).toContain("const parameter");
    });

    it("should return error message for const variable", () => {
      typeRegistry.set("MAX_VALUE", {
        baseType: "u32",
        bitWidth: 32,
        isConst: true,
        isArray: false,
      });

      expect(validator.checkConstAssignment("MAX_VALUE")).toContain(
        "const variable",
      );
    });

    it("should return null for mutable variable", () => {
      typeRegistry.set("counter", {
        baseType: "u32",
        bitWidth: 32,
        isConst: false,
        isArray: false,
      });

      expect(validator.checkConstAssignment("counter")).toBeNull();
    });
  });

  describe("isConstValue", () => {
    it("should return true for const parameter", () => {
      const params = new Map();
      params.set("x", { type: "u32", isConst: true });

      const deps: ITypeValidatorDeps = {
        symbols: null,
        symbolTable,
        typeRegistry,
        typeResolver,
        callbackTypes: new Map(),
        knownFunctions: new Set(),
        knownGlobals: new Set(),
        getCurrentScope: () => null,
        getScopeMembers: () => new Map(),
        getCurrentParameters: () => params,
        getLocalVariables: () => new Set(),
        resolveIdentifier: (name: string) => name,
        getExpressionType: () => null,
      };

      const v = new TypeValidator(deps);
      expect(v.isConstValue("x")).toBe(true);
    });

    it("should return true for const variable", () => {
      typeRegistry.set("MAX", {
        baseType: "u32",
        bitWidth: 32,
        isConst: true,
        isArray: false,
      });

      expect(validator.isConstValue("MAX")).toBe(true);
    });

    it("should return false for non-const values", () => {
      typeRegistry.set("counter", {
        baseType: "u32",
        bitWidth: 32,
        isConst: false,
        isArray: false,
      });

      expect(validator.isConstValue("counter")).toBe(false);
    });
  });

  // ========================================================================
  // Bitmap Field Validation (ADR-034)
  // ========================================================================

  describe("validateBitmapFieldLiteral", () => {
    // Helper to create mock expression context
    const mockExpr = (text: string) =>
      ({ getText: () => text }) as Parameters<
        typeof validator.validateBitmapFieldLiteral
      >[0];

    it("should allow values within range", () => {
      expect(() =>
        validator.validateBitmapFieldLiteral(mockExpr("15"), 4, "nibble"),
      ).not.toThrow();

      expect(() =>
        validator.validateBitmapFieldLiteral(mockExpr("255"), 8, "byte"),
      ).not.toThrow();
    });

    it("should reject decimal values exceeding bit width", () => {
      expect(() =>
        validator.validateBitmapFieldLiteral(mockExpr("16"), 4, "nibble"),
      ).toThrow(/Value 16 exceeds 4-bit field 'nibble' maximum of 15/);

      expect(() =>
        validator.validateBitmapFieldLiteral(mockExpr("256"), 8, "byte"),
      ).toThrow(/Value 256 exceeds 8-bit field 'byte' maximum of 255/);
    });

    it("should validate hex literals", () => {
      expect(() =>
        validator.validateBitmapFieldLiteral(mockExpr("0xFF"), 8, "byte"),
      ).not.toThrow();

      expect(() =>
        validator.validateBitmapFieldLiteral(mockExpr("0x100"), 8, "byte"),
      ).toThrow(/Value 256 exceeds 8-bit field 'byte' maximum of 255/);
    });

    it("should validate binary literals", () => {
      expect(() =>
        validator.validateBitmapFieldLiteral(mockExpr("0b1111"), 4, "nibble"),
      ).not.toThrow();

      expect(() =>
        validator.validateBitmapFieldLiteral(mockExpr("0b10000"), 4, "nibble"),
      ).toThrow(/Value 16 exceeds 4-bit field 'nibble' maximum of 15/);
    });

    it("should skip non-literal expressions", () => {
      // Variables/identifiers should be skipped (can't evaluate at compile time)
      expect(() =>
        validator.validateBitmapFieldLiteral(mockExpr("myVar"), 4, "field"),
      ).not.toThrow();

      expect(() =>
        validator.validateBitmapFieldLiteral(mockExpr("a + b"), 4, "field"),
      ).not.toThrow();
    });
  });

  // ========================================================================
  // Array Bounds Validation (ADR-036)
  // ========================================================================

  describe("checkArrayBounds", () => {
    // Helper to create mock expression context
    const mockExpr = (text: string) =>
      ({ getText: () => text }) as Parameters<
        typeof validator.checkArrayBounds
      >[2][0];

    it("should allow in-bounds indices", () => {
      expect(() =>
        validator.checkArrayBounds("arr", [10], [mockExpr("5")], 1, () => 5),
      ).not.toThrow();
    });

    it("should reject negative indices", () => {
      expect(() =>
        validator.checkArrayBounds("arr", [10], [mockExpr("-1")], 1, () => -1),
      ).toThrow(/Array index out of bounds: -1 is negative for 'arr'/);
    });

    it("should reject indices >= dimension", () => {
      expect(() =>
        validator.checkArrayBounds("arr", [10], [mockExpr("10")], 1, () => 10),
      ).toThrow(/Array index out of bounds: 10 >= 10 for 'arr' dimension 1/);
    });

    it("should check multiple dimensions", () => {
      expect(() =>
        validator.checkArrayBounds(
          "matrix",
          [3, 4],
          [mockExpr("1"), mockExpr("5")],
          1,
          (ctx) => {
            const text = ctx.getText();
            return text === "1" ? 1 : 5;
          },
        ),
      ).toThrow(/Array index out of bounds: 5 >= 4 for 'matrix' dimension 2/);
    });

    it("should skip non-constant indices", () => {
      expect(() =>
        validator.checkArrayBounds(
          "arr",
          [10],
          [mockExpr("i")],
          1,
          () => undefined, // Non-constant
        ),
      ).not.toThrow();
    });
  });

  // ========================================================================
  // Ternary Validation (ADR-022)
  // ========================================================================

  describe("validateNoNestedTernary", () => {
    const mockOrExpr = (text: string) =>
      ({ getText: () => text }) as Parameters<
        typeof validator.validateNoNestedTernary
      >[0];

    it("should allow non-nested expressions", () => {
      expect(() =>
        validator.validateNoNestedTernary(mockOrExpr("a + b"), "true branch"),
      ).not.toThrow();

      expect(() =>
        validator.validateNoNestedTernary(mockOrExpr("x > 5"), "false branch"),
      ).not.toThrow();
    });

    it("should reject nested ternary", () => {
      expect(() =>
        validator.validateNoNestedTernary(
          mockOrExpr("a > 0 ? b : c"),
          "true branch",
        ),
      ).toThrow(/Nested ternary not allowed in true branch/);

      expect(() =>
        validator.validateNoNestedTernary(
          mockOrExpr("x ? y : z"),
          "false branch",
        ),
      ).toThrow(/Nested ternary not allowed in false branch/);
    });
  });

  // ========================================================================
  // getCaseLabelValue (switch validation helper)
  // ========================================================================

  describe("getCaseLabelValue", () => {
    it("should return identifier text", () => {
      const mockCtx = {
        qualifiedType: () => null,
        IDENTIFIER: () => ({ getText: () => "MyValue" }),
        INTEGER_LITERAL: () => null,
        HEX_LITERAL: () => null,
        BINARY_LITERAL: () => null,
        CHAR_LITERAL: () => null,
        children: null,
      } as unknown as Parameters<typeof validator.getCaseLabelValue>[0];

      expect(validator.getCaseLabelValue(mockCtx)).toBe("MyValue");
    });

    it("should return integer literal", () => {
      const mockCtx = {
        qualifiedType: () => null,
        IDENTIFIER: () => null,
        INTEGER_LITERAL: () => ({ getText: () => "42" }),
        HEX_LITERAL: () => null,
        BINARY_LITERAL: () => null,
        CHAR_LITERAL: () => null,
        children: [{ getText: () => "42" }],
      } as unknown as Parameters<typeof validator.getCaseLabelValue>[0];

      expect(validator.getCaseLabelValue(mockCtx)).toBe("42");
    });

    it("should handle negative integer literal", () => {
      const mockCtx = {
        qualifiedType: () => null,
        IDENTIFIER: () => null,
        INTEGER_LITERAL: () => ({ getText: () => "5" }),
        HEX_LITERAL: () => null,
        BINARY_LITERAL: () => null,
        CHAR_LITERAL: () => null,
        children: [{ getText: () => "-" }, { getText: () => "5" }],
      } as unknown as Parameters<typeof validator.getCaseLabelValue>[0];

      expect(validator.getCaseLabelValue(mockCtx)).toBe("-5");
    });

    it("should normalize hex to decimal", () => {
      const mockCtx = {
        qualifiedType: () => null,
        IDENTIFIER: () => null,
        INTEGER_LITERAL: () => null,
        HEX_LITERAL: () => ({ getText: () => "0xFF" }),
        BINARY_LITERAL: () => null,
        CHAR_LITERAL: () => null,
        children: [{ getText: () => "0xFF" }],
      } as unknown as Parameters<typeof validator.getCaseLabelValue>[0];

      expect(validator.getCaseLabelValue(mockCtx)).toBe("255");
    });

    it("should normalize binary to decimal", () => {
      const mockCtx = {
        qualifiedType: () => null,
        IDENTIFIER: () => null,
        INTEGER_LITERAL: () => null,
        HEX_LITERAL: () => null,
        BINARY_LITERAL: () => ({ getText: () => "0b1010" }),
        CHAR_LITERAL: () => null,
        children: null,
      } as unknown as Parameters<typeof validator.getCaseLabelValue>[0];

      expect(validator.getCaseLabelValue(mockCtx)).toBe("10");
    });

    it("should return char literal as-is", () => {
      const mockCtx = {
        qualifiedType: () => null,
        IDENTIFIER: () => null,
        INTEGER_LITERAL: () => null,
        HEX_LITERAL: () => null,
        BINARY_LITERAL: () => null,
        CHAR_LITERAL: () => ({ getText: () => "'a'" }),
        children: null,
      } as unknown as Parameters<typeof validator.getCaseLabelValue>[0];

      expect(validator.getCaseLabelValue(mockCtx)).toBe("'a'");
    });

    it("should handle qualified type (enum member)", () => {
      const mockCtx = {
        qualifiedType: () => ({
          IDENTIFIER: () => [
            { getText: () => "Color" },
            { getText: () => "Red" },
          ],
        }),
        IDENTIFIER: () => null,
        INTEGER_LITERAL: () => null,
        HEX_LITERAL: () => null,
        BINARY_LITERAL: () => null,
        CHAR_LITERAL: () => null,
        children: null,
      } as unknown as Parameters<typeof validator.getCaseLabelValue>[0];

      expect(validator.getCaseLabelValue(mockCtx)).toBe("Color.Red");
    });

    it("should return empty string for unrecognized format", () => {
      const mockCtx = {
        qualifiedType: () => null,
        IDENTIFIER: () => null,
        INTEGER_LITERAL: () => null,
        HEX_LITERAL: () => null,
        BINARY_LITERAL: () => null,
        CHAR_LITERAL: () => null,
        children: null,
      } as unknown as Parameters<typeof validator.getCaseLabelValue>[0];

      expect(validator.getCaseLabelValue(mockCtx)).toBe("");
    });
  });

  // ========================================================================
  // getDefaultCount (switch validation helper)
  // ========================================================================

  describe("getDefaultCount", () => {
    it("should return count for default(n) syntax", () => {
      const mockCtx = {
        INTEGER_LITERAL: () => ({ getText: () => "3" }),
      } as unknown as Parameters<typeof validator.getDefaultCount>[0];

      expect(validator.getDefaultCount(mockCtx)).toBe(3);
    });

    it("should return null for plain default", () => {
      const mockCtx = {
        INTEGER_LITERAL: () => null,
      } as unknown as Parameters<typeof validator.getDefaultCount>[0];

      expect(validator.getDefaultCount(mockCtx)).toBeNull();
    });
  });

  // ========================================================================
  // Shift Amount Validation (MISRA C:2012 Rule 12.2)
  // ========================================================================

  describe("validateShiftAmount", () => {
    // Helper to create mock AdditiveExpressionContext with a literal
    const mockShiftExpr = (literalText: string) => {
      return {
        multiplicativeExpression: () => [
          {
            unaryExpression: () => [
              {
                getText: () => literalText,
                postfixExpression: () => ({
                  primaryExpression: () => ({
                    literal: () => ({ getText: () => literalText }),
                  }),
                }),
                unaryExpression: () => null,
              },
            ],
          },
        ],
      } as unknown as Parameters<typeof validator.validateShiftAmount>[1];
    };

    const mockShiftCtx = (text: string) =>
      ({ getText: () => text }) as Parameters<
        typeof validator.validateShiftAmount
      >[3];

    it("should allow valid shift amounts", () => {
      expect(() =>
        validator.validateShiftAmount(
          "u8",
          mockShiftExpr("7"),
          "<<",
          mockShiftCtx("x << 7"),
        ),
      ).not.toThrow();

      expect(() =>
        validator.validateShiftAmount(
          "u32",
          mockShiftExpr("31"),
          ">>",
          mockShiftCtx("x >> 31"),
        ),
      ).not.toThrow();
    });

    it("should reject shift amount >= type width", () => {
      expect(() =>
        validator.validateShiftAmount(
          "u8",
          mockShiftExpr("8"),
          "<<",
          mockShiftCtx("x << 8"),
        ),
      ).toThrow(/Shift amount \(8\) exceeds type width \(8 bits\)/);

      expect(() =>
        validator.validateShiftAmount(
          "u16",
          mockShiftExpr("16"),
          "<<",
          mockShiftCtx("x << 16"),
        ),
      ).toThrow(/Shift amount \(16\) exceeds type width \(16 bits\)/);

      expect(() =>
        validator.validateShiftAmount(
          "i32",
          mockShiftExpr("32"),
          "<<",
          mockShiftCtx("x << 32"),
        ),
      ).toThrow(/Shift amount \(32\) exceeds type width \(32 bits\)/);
    });

    it("should reject negative shift amounts", () => {
      // Mock a negative literal with unary minus
      const mockNegativeExpr = {
        multiplicativeExpression: () => [
          {
            unaryExpression: () => [
              {
                getText: () => "-1",
                postfixExpression: () => ({
                  primaryExpression: () => ({
                    literal: () => ({ getText: () => "1" }),
                  }),
                }),
                unaryExpression: () => null,
              },
            ],
          },
        ],
      } as unknown as Parameters<typeof validator.validateShiftAmount>[1];

      expect(() =>
        validator.validateShiftAmount(
          "u32",
          mockNegativeExpr,
          "<<",
          mockShiftCtx("x << -1"),
        ),
      ).toThrow(/Negative shift amount \(-1\) is undefined behavior/);
    });

    it("should validate hex literals", () => {
      expect(() =>
        validator.validateShiftAmount(
          "u8",
          mockShiftExpr("0x08"),
          "<<",
          mockShiftCtx("x << 0x08"),
        ),
      ).toThrow(/Shift amount \(8\) exceeds type width \(8 bits\)/);
    });

    it("should validate binary literals", () => {
      expect(() =>
        validator.validateShiftAmount(
          "u8",
          mockShiftExpr("0b1000"),
          "<<",
          mockShiftCtx("x << 0b1000"),
        ),
      ).toThrow(/Shift amount \(8\) exceeds type width \(8 bits\)/);
    });

    it("should skip unknown types", () => {
      expect(() =>
        validator.validateShiftAmount(
          "MyCustomType",
          mockShiftExpr("100"),
          "<<",
          mockShiftCtx("x << 100"),
        ),
      ).not.toThrow();
    });

    it("should skip non-constant expressions", () => {
      const mockNonConstant = {
        multiplicativeExpression: () => [
          {
            unaryExpression: () => [
              {
                getText: () => "i",
                postfixExpression: () => ({
                  primaryExpression: () => ({
                    literal: () => null, // Not a literal
                  }),
                }),
                unaryExpression: () => null,
              },
            ],
          },
        ],
      } as unknown as Parameters<typeof validator.validateShiftAmount>[1];

      expect(() =>
        validator.validateShiftAmount(
          "u8",
          mockNonConstant,
          "<<",
          mockShiftCtx("x << i"),
        ),
      ).not.toThrow();
    });

    it("should handle all integer types", () => {
      // Test each type boundary
      const types = [
        { type: "u8", width: 8 },
        { type: "i8", width: 8 },
        { type: "u16", width: 16 },
        { type: "i16", width: 16 },
        { type: "u32", width: 32 },
        { type: "i32", width: 32 },
        { type: "u64", width: 64 },
        { type: "i64", width: 64 },
      ];

      for (const { type, width } of types) {
        // Max valid shift
        expect(() =>
          validator.validateShiftAmount(
            type,
            mockShiftExpr(String(width - 1)),
            "<<",
            mockShiftCtx(`x << ${width - 1}`),
          ),
        ).not.toThrow();

        // Invalid shift (equals width)
        expect(() =>
          validator.validateShiftAmount(
            type,
            mockShiftExpr(String(width)),
            "<<",
            mockShiftCtx(`x << ${width}`),
          ),
        ).toThrow(/exceeds type width/);
      }
    });
  });

  // ========================================================================
  // Callback Assignment Validation (ADR-029)
  // ========================================================================

  describe("validateCallbackAssignment", () => {
    it("should skip unknown functions", () => {
      const mockExpr = { getText: () => "unknownFunc" } as Parameters<
        typeof validator.validateCallbackAssignment
      >[1];

      expect(() =>
        validator.validateCallbackAssignment(
          "CallbackType",
          mockExpr,
          "handler",
          () => false,
        ),
      ).not.toThrow();
    });

    it("should throw on signature mismatch", () => {
      // Set up known functions and callback types
      const knownFunctions = new Set(["myFunc", "CallbackType"]);
      const callbackTypes = new Map([
        [
          "CallbackType",
          {
            functionName: "CallbackType",
            typedefName: "CallbackType_fp",
            returnType: "void",
            parameters: [
              {
                name: "p",
                type: "u32",
                isConst: false,
                isPointer: false,
                isArray: false,
                arrayDims: "",
              },
            ],
          },
        ],
        [
          "myFunc",
          {
            functionName: "myFunc",
            typedefName: "myFunc_fp",
            returnType: "void",
            parameters: [
              {
                name: "p",
                type: "i32",
                isConst: false,
                isPointer: false,
                isArray: false,
                arrayDims: "",
              },
            ],
          },
        ],
      ]);

      const deps: ITypeValidatorDeps = {
        symbols: null,
        symbolTable,
        typeRegistry,
        typeResolver,
        callbackTypes,
        knownFunctions,
        knownGlobals: new Set(),
        getCurrentScope: () => null,
        getScopeMembers: () => new Map(),
        getCurrentParameters: () => new Map(),
        getLocalVariables: () => new Set(),
        resolveIdentifier: (name: string) => name,
        getExpressionType: () => null,
      };

      const v = new TypeValidator(deps);
      const mockExpr = { getText: () => "myFunc" } as Parameters<
        typeof validator.validateCallbackAssignment
      >[1];

      expect(() =>
        v.validateCallbackAssignment(
          "CallbackType",
          mockExpr,
          "handler",
          () => false,
        ),
      ).toThrow(/signature does not match/);
    });

    it("should throw on nominal type mismatch", () => {
      const knownFunctions = new Set(["funcA", "TypeA"]);
      const callbackTypes = new Map([
        [
          "TypeA",
          {
            functionName: "TypeA",
            typedefName: "TypeA_fp",
            returnType: "void",
            parameters: [],
          },
        ],
        [
          "funcA",
          {
            functionName: "funcA",
            typedefName: "funcA_fp",
            returnType: "void",
            parameters: [],
          },
        ],
      ]);

      const deps: ITypeValidatorDeps = {
        symbols: null,
        symbolTable,
        typeRegistry,
        typeResolver,
        callbackTypes,
        knownFunctions,
        knownGlobals: new Set(),
        getCurrentScope: () => null,
        getScopeMembers: () => new Map(),
        getCurrentParameters: () => new Map(),
        getLocalVariables: () => new Set(),
        resolveIdentifier: (name: string) => name,
        getExpressionType: () => null,
      };

      const v = new TypeValidator(deps);
      const mockExpr = { getText: () => "funcA" } as Parameters<
        typeof validator.validateCallbackAssignment
      >[1];

      // funcA is used as a field type somewhere
      expect(() =>
        v.validateCallbackAssignment(
          "TypeA",
          mockExpr,
          "handler",
          (fn) => fn === "funcA",
        ),
      ).toThrow(/nominal typing/);
    });

    it("should allow matching signature and type", () => {
      const knownFunctions = new Set(["myHandler", "HandlerType"]);
      const callbackTypes = new Map([
        [
          "HandlerType",
          {
            functionName: "HandlerType",
            typedefName: "HandlerType_fp",
            returnType: "void",
            parameters: [
              {
                name: "p",
                type: "u32",
                isConst: false,
                isPointer: false,
                isArray: false,
                arrayDims: "",
              },
            ],
          },
        ],
        [
          "myHandler",
          {
            functionName: "myHandler",
            typedefName: "myHandler_fp",
            returnType: "void",
            parameters: [
              {
                name: "p",
                type: "u32",
                isConst: false,
                isPointer: false,
                isArray: false,
                arrayDims: "",
              },
            ],
          },
        ],
      ]);

      const deps: ITypeValidatorDeps = {
        symbols: null,
        symbolTable,
        typeRegistry,
        typeResolver,
        callbackTypes,
        knownFunctions,
        knownGlobals: new Set(),
        getCurrentScope: () => null,
        getScopeMembers: () => new Map(),
        getCurrentParameters: () => new Map(),
        getLocalVariables: () => new Set(),
        resolveIdentifier: (name: string) => name,
        getExpressionType: () => null,
      };

      const v = new TypeValidator(deps);
      const mockExpr = { getText: () => "myHandler" } as Parameters<
        typeof validator.validateCallbackAssignment
      >[1];

      expect(() =>
        v.validateCallbackAssignment(
          "HandlerType",
          mockExpr,
          "handler",
          () => false,
        ),
      ).not.toThrow();
    });
  });

  // ========================================================================
  // Ternary Condition Validation (ADR-022)
  // ========================================================================

  describe("validateTernaryCondition", () => {
    // Helper to create properly structured mock OrExpressionContext
    const createMockRelational = (hasBitwiseOr: boolean) => ({
      bitwiseOrExpression: () => (hasBitwiseOr ? [{}, {}] : [{}]),
    });

    const createMockEquality = (hasRelational: boolean) => ({
      relationalExpression: () =>
        hasRelational ? [{}, {}] : [createMockRelational(false)],
    });

    const createMockAnd = (hasEquality: boolean, hasRelational: boolean) => ({
      equalityExpression: () =>
        hasEquality ? [{}, {}] : [createMockEquality(hasRelational)],
    });

    const mockOrExprWithComparison = (text: string, hasOperator: string) => {
      const hasLogicalOr = hasOperator === "||";
      const hasLogicalAnd = hasOperator === "&&";
      const hasEquality = hasOperator === "=" || hasOperator === "!=";
      const hasRelational = ["<", ">", "<=", ">="].includes(hasOperator);

      return {
        getText: () => text,
        andExpression: (idx?: number) => {
          if (hasLogicalOr) {
            const items = [
              createMockAnd(false, false),
              createMockAnd(false, false),
            ];
            return idx !== undefined ? items[idx] : items;
          }
          const items = [
            createMockAnd(hasLogicalAnd, hasEquality || hasRelational),
          ];
          if (hasEquality) {
            // For equality, we need relationalExpression to return multiple items
            items[0] = {
              equalityExpression: () => [
                {
                  relationalExpression: () => [{}, {}],
                },
              ],
            };
          } else if (hasRelational) {
            items[0] = {
              equalityExpression: () => [
                {
                  relationalExpression: () => [
                    {
                      bitwiseOrExpression: () => [{}, {}],
                    },
                  ],
                },
              ],
            };
          }
          return idx !== undefined ? items[idx] : items;
        },
      } as unknown as Parameters<typeof validator.validateTernaryCondition>[0];
    };

    it("should allow conditions with || operator", () => {
      expect(() =>
        validator.validateTernaryCondition(
          mockOrExprWithComparison("a || b", "||"),
        ),
      ).not.toThrow();
    });

    it("should allow conditions with && operator", () => {
      const mockAnd = {
        getText: () => "a && b",
        andExpression: (idx?: number) => {
          const items = [
            { equalityExpression: () => [{}] },
            { equalityExpression: () => [{}] },
          ];
          return idx !== undefined ? items[idx] : items;
        },
      } as unknown as Parameters<typeof validator.validateTernaryCondition>[0];

      expect(() => validator.validateTernaryCondition(mockAnd)).not.toThrow();
    });

    it("should allow conditions with equality operator", () => {
      const mockEq = {
        getText: () => "a = b",
        andExpression: (idx?: number) => {
          const items = [
            {
              equalityExpression: (i?: number) => {
                const eqs = [{}, {}];
                return i !== undefined ? eqs[i] : eqs;
              },
            },
          ];
          return idx !== undefined ? items[idx] : items;
        },
      } as unknown as Parameters<typeof validator.validateTernaryCondition>[0];

      expect(() => validator.validateTernaryCondition(mockEq)).not.toThrow();
    });

    it("should allow conditions with relational operator", () => {
      const mockRel = {
        getText: () => "a > b",
        andExpression: (idx?: number) => {
          const items = [
            {
              equalityExpression: (i?: number) => {
                const eqs = [
                  {
                    relationalExpression: (j?: number) => {
                      const rels = [{}, {}];
                      return j !== undefined ? rels[j] : rels;
                    },
                  },
                ];
                return i !== undefined ? eqs[i] : eqs;
              },
            },
          ];
          return idx !== undefined ? items[idx] : items;
        },
      } as unknown as Parameters<typeof validator.validateTernaryCondition>[0];

      expect(() => validator.validateTernaryCondition(mockRel)).not.toThrow();
    });

    it("should reject plain value conditions", () => {
      const mockValue = {
        getText: () => "value",
        andExpression: (idx?: number) => {
          const items = [
            {
              equalityExpression: (i?: number) => {
                const eqs = [
                  {
                    relationalExpression: (j?: number) => {
                      const rels = [
                        {
                          bitwiseOrExpression: () => [{}],
                        },
                      ];
                      return j !== undefined ? rels[j] : rels;
                    },
                  },
                ];
                return i !== undefined ? eqs[i] : eqs;
              },
            },
          ];
          return idx !== undefined ? items[idx] : items;
        },
      } as unknown as Parameters<typeof validator.validateTernaryCondition>[0];

      expect(() => validator.validateTernaryCondition(mockValue)).toThrow(
        /Ternary condition must be a boolean expression/,
      );
    });

    it("should reject missing andExpression", () => {
      const mockEmpty = {
        getText: () => "value",
        andExpression: (idx?: number) => {
          const items: object[] = [];
          return idx !== undefined ? items[idx] : items;
        },
      } as unknown as Parameters<typeof validator.validateTernaryCondition>[0];

      expect(() => validator.validateTernaryCondition(mockEmpty)).toThrow(
        /Ternary condition must be a boolean expression/,
      );
    });
  });

  // ========================================================================
  // Do-While Condition Validation (ADR-027)
  // ========================================================================

  describe("validateDoWhileCondition", () => {
    // Helper to create mock ExpressionContext with proper index-aware methods
    const mockDoWhileExpr = (text: string, hasOperator: string) => {
      const hasLogicalOr = hasOperator === "||";
      const hasLogicalAnd = hasOperator === "&&";
      const hasEquality = hasOperator === "=" || hasOperator === "!=";
      const hasRelational = ["<", ">", "<=", ">="].includes(hasOperator);

      const createOrExpr = () => ({
        getText: () => text,
        andExpression: (idx?: number) => {
          if (hasLogicalOr) {
            const items = [{}, {}];
            return idx !== undefined ? items[idx] : items;
          }
          const items = [
            {
              equalityExpression: (i?: number) => {
                if (hasLogicalAnd) {
                  const eqs = [{}, {}];
                  return i !== undefined ? eqs[i] : eqs;
                }
                const eqs = [
                  {
                    relationalExpression: (j?: number) => {
                      if (hasEquality) {
                        const rels = [{}, {}];
                        return j !== undefined ? rels[j] : rels;
                      }
                      const rels = [
                        {
                          bitwiseOrExpression: (k?: number) => {
                            if (hasRelational) {
                              const bors = [{}, {}];
                              return k !== undefined ? bors[k] : bors;
                            }
                            const bors = [{ getText: () => text }];
                            return k !== undefined ? bors[k] : bors;
                          },
                        },
                      ];
                      return j !== undefined ? rels[j] : rels;
                    },
                  },
                ];
                return i !== undefined ? eqs[i] : eqs;
              },
            },
          ];
          return idx !== undefined ? items[idx] : items;
        },
      });

      return {
        ternaryExpression: () => ({
          orExpression: () => [createOrExpr()],
        }),
      } as unknown as Parameters<typeof validator.validateDoWhileCondition>[0];
    };

    it("should allow conditions with || operator", () => {
      expect(() =>
        validator.validateDoWhileCondition(mockDoWhileExpr("a || b", "||")),
      ).not.toThrow();
    });

    it("should allow conditions with && operator", () => {
      expect(() =>
        validator.validateDoWhileCondition(mockDoWhileExpr("a && b", "&&")),
      ).not.toThrow();
    });

    it("should allow conditions with equality operator", () => {
      expect(() =>
        validator.validateDoWhileCondition(mockDoWhileExpr("count != 0", "!=")),
      ).not.toThrow();
    });

    it("should allow conditions with relational operator", () => {
      expect(() =>
        validator.validateDoWhileCondition(mockDoWhileExpr("i < 10", "<")),
      ).not.toThrow();
    });

    it("should reject plain value conditions", () => {
      expect(() =>
        validator.validateDoWhileCondition(mockDoWhileExpr("count", "none")),
      ).toThrow(/E0701.*do-while condition must be a boolean expression/);
    });

    it("should reject ternary in do-while condition", () => {
      const mockTernaryCondition = {
        ternaryExpression: () => ({
          orExpression: () => [{}, {}], // Multiple orExpression = ternary
        }),
      } as unknown as Parameters<typeof validator.validateDoWhileCondition>[0];

      expect(() =>
        validator.validateDoWhileCondition(mockTernaryCondition),
      ).toThrow(/E0701.*not a ternary/);
    });

    it("should allow boolean literals", () => {
      const mockBoolLiteral = {
        ternaryExpression: () => ({
          orExpression: () => [
            {
              getText: () => "true",
              andExpression: (idx?: number) => {
                const items = [
                  {
                    equalityExpression: (i?: number) => {
                      const eqs = [
                        {
                          relationalExpression: (j?: number) => {
                            const rels = [
                              {
                                bitwiseOrExpression: (k?: number) => {
                                  const bors = [{ getText: () => "true" }];
                                  return k !== undefined ? bors[k] : bors;
                                },
                              },
                            ];
                            return j !== undefined ? rels[j] : rels;
                          },
                        },
                      ];
                      return i !== undefined ? eqs[i] : eqs;
                    },
                  },
                ];
                return idx !== undefined ? items[idx] : items;
              },
            },
          ],
        }),
      } as unknown as Parameters<typeof validator.validateDoWhileCondition>[0];

      expect(() =>
        validator.validateDoWhileCondition(mockBoolLiteral),
      ).not.toThrow();
    });

    it("should allow negation operator", () => {
      const mockNegation = {
        ternaryExpression: () => ({
          orExpression: () => [
            {
              getText: () => "!done",
              andExpression: (idx?: number) => {
                const items = [
                  {
                    equalityExpression: (i?: number) => {
                      const eqs = [
                        {
                          relationalExpression: (j?: number) => {
                            const rels = [
                              {
                                bitwiseOrExpression: (k?: number) => {
                                  const bors = [{ getText: () => "!done" }];
                                  return k !== undefined ? bors[k] : bors;
                                },
                              },
                            ];
                            return j !== undefined ? rels[j] : rels;
                          },
                        },
                      ];
                      return i !== undefined ? eqs[i] : eqs;
                    },
                  },
                ];
                return idx !== undefined ? items[idx] : items;
              },
            },
          ],
        }),
      } as unknown as Parameters<typeof validator.validateDoWhileCondition>[0];

      expect(() =>
        validator.validateDoWhileCondition(mockNegation),
      ).not.toThrow();
    });

    it("should allow boolean variable from type registry", () => {
      typeRegistry.set("isReady", {
        baseType: "bool",
        bitWidth: 1,
        isConst: false,
        isArray: false,
      });

      const mockBoolVar = {
        ternaryExpression: () => ({
          orExpression: () => [
            {
              getText: () => "isReady",
              andExpression: (idx?: number) => {
                const items = [
                  {
                    equalityExpression: (i?: number) => {
                      const eqs = [
                        {
                          relationalExpression: (j?: number) => {
                            const rels = [
                              {
                                bitwiseOrExpression: (k?: number) => {
                                  const bors = [{ getText: () => "isReady" }];
                                  return k !== undefined ? bors[k] : bors;
                                },
                              },
                            ];
                            return j !== undefined ? rels[j] : rels;
                          },
                        },
                      ];
                      return i !== undefined ? eqs[i] : eqs;
                    },
                  },
                ];
                return idx !== undefined ? items[idx] : items;
              },
            },
          ],
        }),
      } as unknown as Parameters<typeof validator.validateDoWhileCondition>[0];

      expect(() =>
        validator.validateDoWhileCondition(mockBoolVar),
      ).not.toThrow();
    });
  });

  // ========================================================================
  // Function Call in Condition Validation (Issue #254)
  // ========================================================================

  describe("validateConditionNoFunctionCall", () => {
    // Helper to create expression with or without function call
    const mockExprWithFunctionCall = (text: string, hasFuncCall: boolean) => {
      const postfixOps = hasFuncCall
        ? [{ argumentList: () => ({}), getText: () => "()" }]
        : [];

      return {
        getText: () => text,
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
                                                    {
                                                      postfixExpression:
                                                        () => ({
                                                          postfixOp: () =>
                                                            postfixOps,
                                                        }),
                                                      unaryExpression: () =>
                                                        null,
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
            },
          ],
        }),
      } as unknown as Parameters<
        typeof validator.validateConditionNoFunctionCall
      >[0];
    };

    it("should allow conditions without function calls", () => {
      expect(() =>
        validator.validateConditionNoFunctionCall(
          mockExprWithFunctionCall("a > b", false),
          "if",
        ),
      ).not.toThrow();
    });

    it("should reject conditions with function calls", () => {
      expect(() =>
        validator.validateConditionNoFunctionCall(
          mockExprWithFunctionCall("isReady()", true),
          "if",
        ),
      ).toThrow(/E0702.*Function call in 'if' condition is not allowed/);
    });

    it("should specify condition type in error message", () => {
      expect(() =>
        validator.validateConditionNoFunctionCall(
          mockExprWithFunctionCall("getValue()", true),
          "while",
        ),
      ).toThrow(/Function call in 'while' condition/);

      expect(() =>
        validator.validateConditionNoFunctionCall(
          mockExprWithFunctionCall("check()", true),
          "for",
        ),
      ).toThrow(/Function call in 'for' condition/);
    });
  });

  describe("validateTernaryConditionNoFunctionCall", () => {
    const mockOrExprWithFunctionCall = (text: string, hasFuncCall: boolean) => {
      const postfixOps = hasFuncCall
        ? [{ argumentList: () => ({}), getText: () => "()" }]
        : [];

      return {
        getText: () => text,
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
                                              {
                                                postfixExpression: () => ({
                                                  postfixOp: () => postfixOps,
                                                }),
                                                unaryExpression: () => null,
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
      } as unknown as Parameters<
        typeof validator.validateTernaryConditionNoFunctionCall
      >[0];
    };

    it("should allow ternary conditions without function calls", () => {
      expect(() =>
        validator.validateTernaryConditionNoFunctionCall(
          mockOrExprWithFunctionCall("x > 0", false),
        ),
      ).not.toThrow();
    });

    it("should reject ternary conditions with function calls", () => {
      expect(() =>
        validator.validateTernaryConditionNoFunctionCall(
          mockOrExprWithFunctionCall("isValid()", true),
        ),
      ).toThrow(/E0702.*Function call in 'ternary' condition/);
    });
  });

  // ========================================================================
  // Switch Statement Validation (ADR-025)
  // ========================================================================

  describe("validateSwitchStatement", () => {
    // Helper to create mock switch context
    const createMockSwitchCtx = (
      cases: { labels: string[] }[],
      hasDefault: boolean,
      defaultCount?: number,
    ) => ({
      switchCase: () =>
        cases.map((c) => ({
          caseLabel: () =>
            c.labels.map((label) => ({
              qualifiedType: () => null,
              IDENTIFIER: () => ({ getText: () => label }),
              INTEGER_LITERAL: () => null,
              HEX_LITERAL: () => null,
              BINARY_LITERAL: () => null,
              CHAR_LITERAL: () => null,
              children: null,
            })),
        })),
      defaultCase: () =>
        hasDefault
          ? {
              INTEGER_LITERAL: () =>
                defaultCount !== undefined
                  ? { getText: () => String(defaultCount) }
                  : null,
            }
          : null,
    });

    const mockExpr = (_type: string | null) =>
      ({}) as Parameters<typeof validator.validateSwitchStatement>[1];

    it("should reject boolean switch expression (MISRA 16.7)", () => {
      const deps: ITypeValidatorDeps = {
        symbols: null,
        symbolTable,
        typeRegistry,
        typeResolver,
        callbackTypes: new Map(),
        knownFunctions: new Set(),
        knownGlobals: new Set(),
        getCurrentScope: () => null,
        getScopeMembers: () => new Map(),
        getCurrentParameters: () => new Map(),
        getLocalVariables: () => new Set(),
        resolveIdentifier: (name: string) => name,
        getExpressionType: () => "bool",
      };

      const v = new TypeValidator(deps);
      const ctx = createMockSwitchCtx(
        [{ labels: ["A"] }, { labels: ["B"] }],
        false,
      );

      expect(() =>
        v.validateSwitchStatement(
          ctx as unknown as Parameters<typeof v.validateSwitchStatement>[0],
          mockExpr("bool"),
        ),
      ).toThrow(/Cannot switch on boolean type.*MISRA 16\.7/);
    });

    it("should reject switch with less than 2 clauses (MISRA 16.6)", () => {
      const deps: ITypeValidatorDeps = {
        symbols: null,
        symbolTable,
        typeRegistry,
        typeResolver,
        callbackTypes: new Map(),
        knownFunctions: new Set(),
        knownGlobals: new Set(),
        getCurrentScope: () => null,
        getScopeMembers: () => new Map(),
        getCurrentParameters: () => new Map(),
        getLocalVariables: () => new Set(),
        resolveIdentifier: (name: string) => name,
        getExpressionType: () => "u32",
      };

      const v = new TypeValidator(deps);
      const ctx = createMockSwitchCtx([{ labels: ["A"] }], false);

      expect(() =>
        v.validateSwitchStatement(
          ctx as unknown as Parameters<typeof v.validateSwitchStatement>[0],
          mockExpr("u32"),
        ),
      ).toThrow(/Switch requires at least 2 clauses.*MISRA 16\.6/);
    });

    it("should allow switch with 2+ clauses", () => {
      const mockSymbols = {
        knownEnums: new Set<string>(),
      };

      const deps: ITypeValidatorDeps = {
        symbols: mockSymbols as unknown as ITypeValidatorDeps["symbols"],
        symbolTable,
        typeRegistry,
        typeResolver,
        callbackTypes: new Map(),
        knownFunctions: new Set(),
        knownGlobals: new Set(),
        getCurrentScope: () => null,
        getScopeMembers: () => new Map(),
        getCurrentParameters: () => new Map(),
        getLocalVariables: () => new Set(),
        resolveIdentifier: (name: string) => name,
        getExpressionType: () => "u32",
      };

      const v = new TypeValidator(deps);
      const ctx = createMockSwitchCtx(
        [{ labels: ["A"] }, { labels: ["B"] }],
        false,
      );

      expect(() =>
        v.validateSwitchStatement(
          ctx as unknown as Parameters<typeof v.validateSwitchStatement>[0],
          mockExpr("u32"),
        ),
      ).not.toThrow();
    });

    it("should count default as a clause", () => {
      const mockSymbols = {
        knownEnums: new Set<string>(),
      };

      const deps: ITypeValidatorDeps = {
        symbols: mockSymbols as unknown as ITypeValidatorDeps["symbols"],
        symbolTable,
        typeRegistry,
        typeResolver,
        callbackTypes: new Map(),
        knownFunctions: new Set(),
        knownGlobals: new Set(),
        getCurrentScope: () => null,
        getScopeMembers: () => new Map(),
        getCurrentParameters: () => new Map(),
        getLocalVariables: () => new Set(),
        resolveIdentifier: (name: string) => name,
        getExpressionType: () => "u32",
      };

      const v = new TypeValidator(deps);
      // One case + default = 2 clauses
      const ctx = createMockSwitchCtx([{ labels: ["A"] }], true);

      expect(() =>
        v.validateSwitchStatement(
          ctx as unknown as Parameters<typeof v.validateSwitchStatement>[0],
          mockExpr("u32"),
        ),
      ).not.toThrow();
    });

    it("should reject duplicate case values", () => {
      const deps: ITypeValidatorDeps = {
        symbols: null,
        symbolTable,
        typeRegistry,
        typeResolver,
        callbackTypes: new Map(),
        knownFunctions: new Set(),
        knownGlobals: new Set(),
        getCurrentScope: () => null,
        getScopeMembers: () => new Map(),
        getCurrentParameters: () => new Map(),
        getLocalVariables: () => new Set(),
        resolveIdentifier: (name: string) => name,
        getExpressionType: () => "u32",
      };

      const v = new TypeValidator(deps);
      const ctx = createMockSwitchCtx(
        [{ labels: ["A"] }, { labels: ["A"] }], // Duplicate
        false,
      );

      expect(() =>
        v.validateSwitchStatement(
          ctx as unknown as Parameters<typeof v.validateSwitchStatement>[0],
          mockExpr("u32"),
        ),
      ).toThrow(/Duplicate case value 'A'/);
    });
  });

  // ========================================================================
  // Enum Exhaustiveness Validation (ADR-025)
  // ========================================================================

  describe("validateEnumExhaustiveness", () => {
    // Helper for creating mock switch context for enum exhaustiveness
    const createMockSwitchCtx = (
      cases: { labels: string[] }[],
      hasDefault: boolean,
      defaultCount?: number,
    ) => ({
      switchCase: () =>
        cases.map((c) => ({
          caseLabel: () => c.labels.map(() => ({})),
        })),
      defaultCase: () =>
        hasDefault
          ? {
              INTEGER_LITERAL: () =>
                defaultCount !== undefined
                  ? { getText: () => String(defaultCount) }
                  : null,
            }
          : null,
    });

    it("should require all variants covered without default", () => {
      // Create a mock symbols with enum members
      const mockSymbols = {
        enumMembers: new Map([
          [
            "Color",
            new Map([
              ["Red", 0],
              ["Green", 1],
              ["Blue", 2],
            ]),
          ],
        ]),
        knownEnums: new Set(["Color"]),
        knownRegisters: new Set<string>(),
      };

      const deps: ITypeValidatorDeps = {
        symbols: mockSymbols as unknown as ITypeValidatorDeps["symbols"],
        symbolTable,
        typeRegistry,
        typeResolver,
        callbackTypes: new Map(),
        knownFunctions: new Set(),
        knownGlobals: new Set(),
        getCurrentScope: () => null,
        getScopeMembers: () => new Map(),
        getCurrentParameters: () => new Map(),
        getLocalVariables: () => new Set(),
        resolveIdentifier: (name: string) => name,
        getExpressionType: () => "Color",
      };

      const v = new TypeValidator(deps);
      const ctx = createMockSwitchCtx(
        [{ labels: ["Red"] }, { labels: ["Green"] }], // Missing Blue
        false,
      );

      expect(() =>
        v.validateEnumExhaustiveness(
          ctx as unknown as Parameters<typeof v.validateEnumExhaustiveness>[0],
          "Color",
          ctx.switchCase() as unknown as Parameters<
            typeof v.validateEnumExhaustiveness
          >[2],
          null,
        ),
      ).toThrow(/Non-exhaustive switch on Color.*missing 1/);
    });

    it("should allow all variants covered", () => {
      const mockSymbols = {
        enumMembers: new Map([
          [
            "Color",
            new Map([
              ["Red", 0],
              ["Green", 1],
              ["Blue", 2],
            ]),
          ],
        ]),
      };

      const deps: ITypeValidatorDeps = {
        symbols: mockSymbols as unknown as ITypeValidatorDeps["symbols"],
        symbolTable,
        typeRegistry,
        typeResolver,
        callbackTypes: new Map(),
        knownFunctions: new Set(),
        knownGlobals: new Set(),
        getCurrentScope: () => null,
        getScopeMembers: () => new Map(),
        getCurrentParameters: () => new Map(),
        getLocalVariables: () => new Set(),
        resolveIdentifier: (name: string) => name,
        getExpressionType: () => "Color",
      };

      const v = new TypeValidator(deps);
      const ctx = createMockSwitchCtx(
        [{ labels: ["Red"] }, { labels: ["Green"] }, { labels: ["Blue"] }],
        false,
      );

      expect(() =>
        v.validateEnumExhaustiveness(
          ctx as unknown as Parameters<typeof v.validateEnumExhaustiveness>[0],
          "Color",
          ctx.switchCase() as unknown as Parameters<
            typeof v.validateEnumExhaustiveness
          >[2],
          null,
        ),
      ).not.toThrow();
    });

    it("should allow plain default without checking exhaustiveness", () => {
      const mockSymbols = {
        enumMembers: new Map([
          [
            "Color",
            new Map([
              ["Red", 0],
              ["Green", 1],
              ["Blue", 2],
            ]),
          ],
        ]),
      };

      const deps: ITypeValidatorDeps = {
        symbols: mockSymbols as unknown as ITypeValidatorDeps["symbols"],
        symbolTable,
        typeRegistry,
        typeResolver,
        callbackTypes: new Map(),
        knownFunctions: new Set(),
        knownGlobals: new Set(),
        getCurrentScope: () => null,
        getScopeMembers: () => new Map(),
        getCurrentParameters: () => new Map(),
        getLocalVariables: () => new Set(),
        resolveIdentifier: (name: string) => name,
        getExpressionType: () => "Color",
      };

      const v = new TypeValidator(deps);
      const ctx = createMockSwitchCtx(
        [{ labels: ["Red"] }], // Only one variant
        true, // Has default
      );

      expect(() =>
        v.validateEnumExhaustiveness(
          ctx as unknown as Parameters<typeof v.validateEnumExhaustiveness>[0],
          "Color",
          ctx.switchCase() as unknown as Parameters<
            typeof v.validateEnumExhaustiveness
          >[2],
          ctx.defaultCase() as unknown as Parameters<
            typeof v.validateEnumExhaustiveness
          >[3],
        ),
      ).not.toThrow();
    });

    it("should validate default(n) counts correctly", () => {
      const mockSymbols = {
        enumMembers: new Map([
          [
            "Color",
            new Map([
              ["Red", 0],
              ["Green", 1],
              ["Blue", 2],
            ]),
          ],
        ]),
      };

      const deps: ITypeValidatorDeps = {
        symbols: mockSymbols as unknown as ITypeValidatorDeps["symbols"],
        symbolTable,
        typeRegistry,
        typeResolver,
        callbackTypes: new Map(),
        knownFunctions: new Set(),
        knownGlobals: new Set(),
        getCurrentScope: () => null,
        getScopeMembers: () => new Map(),
        getCurrentParameters: () => new Map(),
        getLocalVariables: () => new Set(),
        resolveIdentifier: (name: string) => name,
        getExpressionType: () => "Color",
      };

      const v = new TypeValidator(deps);
      // 1 explicit case + default(2) = 3 variants covered
      const ctx = createMockSwitchCtx(
        [{ labels: ["Red"] }],
        true,
        2, // default(2)
      );

      expect(() =>
        v.validateEnumExhaustiveness(
          ctx as unknown as Parameters<typeof v.validateEnumExhaustiveness>[0],
          "Color",
          ctx.switchCase() as unknown as Parameters<
            typeof v.validateEnumExhaustiveness
          >[2],
          ctx.defaultCase() as unknown as Parameters<
            typeof v.validateEnumExhaustiveness
          >[3],
        ),
      ).not.toThrow();
    });

    it("should reject incorrect default(n) count", () => {
      const mockSymbols = {
        enumMembers: new Map([
          [
            "Color",
            new Map([
              ["Red", 0],
              ["Green", 1],
              ["Blue", 2],
            ]),
          ],
        ]),
      };

      const deps: ITypeValidatorDeps = {
        symbols: mockSymbols as unknown as ITypeValidatorDeps["symbols"],
        symbolTable,
        typeRegistry,
        typeResolver,
        callbackTypes: new Map(),
        knownFunctions: new Set(),
        knownGlobals: new Set(),
        getCurrentScope: () => null,
        getScopeMembers: () => new Map(),
        getCurrentParameters: () => new Map(),
        getLocalVariables: () => new Set(),
        resolveIdentifier: (name: string) => name,
        getExpressionType: () => "Color",
      };

      const v = new TypeValidator(deps);
      // 1 explicit case + default(1) = 2, but need 3
      const ctx = createMockSwitchCtx(
        [{ labels: ["Red"] }],
        true,
        1, // default(1) - wrong, should be 2
      );

      expect(() =>
        v.validateEnumExhaustiveness(
          ctx as unknown as Parameters<typeof v.validateEnumExhaustiveness>[0],
          "Color",
          ctx.switchCase() as unknown as Parameters<
            typeof v.validateEnumExhaustiveness
          >[2],
          ctx.defaultCase() as unknown as Parameters<
            typeof v.validateEnumExhaustiveness
          >[3],
        ),
      ).toThrow(/switch covers 2 of 3 Color variants/);
    });

    it("should handle unknown enum gracefully", () => {
      const mockSymbols = {
        enumMembers: new Map(), // No enums defined
      };

      const deps: ITypeValidatorDeps = {
        symbols: mockSymbols as unknown as ITypeValidatorDeps["symbols"],
        symbolTable,
        typeRegistry,
        typeResolver,
        callbackTypes: new Map(),
        knownFunctions: new Set(),
        knownGlobals: new Set(),
        getCurrentScope: () => null,
        getScopeMembers: () => new Map(),
        getCurrentParameters: () => new Map(),
        getLocalVariables: () => new Set(),
        resolveIdentifier: (name: string) => name,
        getExpressionType: () => "UnknownEnum",
      };

      const v = new TypeValidator(deps);
      const ctx = createMockSwitchCtx([{ labels: ["X"] }], false);

      // Should return early without throwing
      expect(() =>
        v.validateEnumExhaustiveness(
          ctx as unknown as Parameters<typeof v.validateEnumExhaustiveness>[0],
          "UnknownEnum",
          ctx.switchCase() as unknown as Parameters<
            typeof v.validateEnumExhaustiveness
          >[2],
          null,
        ),
      ).not.toThrow();
    });
  });
});
