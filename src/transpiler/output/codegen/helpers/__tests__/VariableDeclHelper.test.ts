/**
 * Unit tests for VariableDeclHelper
 *
 * Issue #792: Tests for extracted variable declaration logic
 */

import { describe, it, expect, beforeEach } from "vitest";
import VariableDeclHelper from "../VariableDeclHelper.js";
import CodeGenState from "../../../../state/CodeGenState.js";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser.js";
import * as Parser from "../../../../logic/parser/grammar/CNextParser.js";

/**
 * Helper to parse a variable declaration from source code.
 */
function parseVarDecl(source: string): Parser.VariableDeclarationContext {
  const result = CNextSourceParser.parse(source);
  const decl = result.tree.declaration(0);
  const varDecl = decl?.variableDeclaration();
  if (!varDecl) {
    throw new Error(`Failed to parse variable declaration from: ${source}`);
  }
  return varDecl;
}

/**
 * Helper to parse a type context from source code.
 */
function parseType(source: string): Parser.TypeContext {
  const varDecl = parseVarDecl(source);
  return varDecl.type();
}

describe("VariableDeclHelper", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  // ========================================================================
  // Tier 1: Pure Utilities
  // ========================================================================

  describe("parseArrayTypeDimension", () => {
    it("returns null for non-array types", () => {
      const typeCtx = parseType("u8 x;");
      expect(VariableDeclHelper.parseArrayTypeDimension(typeCtx)).toBeNull();
    });

    it("returns numeric dimension for literal array type", () => {
      const typeCtx = parseType("u8[10] x;");
      expect(VariableDeclHelper.parseArrayTypeDimension(typeCtx)).toBe(10);
    });

    it("returns null for empty array dimension", () => {
      const typeCtx = parseType("u8[] x;");
      expect(VariableDeclHelper.parseArrayTypeDimension(typeCtx)).toBeNull();
    });

    it("returns null for expression dimension", () => {
      const typeCtx = parseType("u8[SIZE] x;");
      expect(VariableDeclHelper.parseArrayTypeDimension(typeCtx)).toBeNull();
    });
  });

  describe("parseFirstArrayDimension", () => {
    it("returns null for empty array", () => {
      expect(VariableDeclHelper.parseFirstArrayDimension([])).toBeNull();
    });

    it("returns null for empty dimension expression", () => {
      const varDecl = parseVarDecl("u8 x[];");
      const dims = varDecl.arrayDimension();
      expect(VariableDeclHelper.parseFirstArrayDimension(dims)).toBeNull();
    });

    it("returns numeric value for literal dimension", () => {
      // Note: arrayTypeDimension != arrayDimension, so we test with arrayDimension
      const varDecl = parseVarDecl("u8 x[5];");
      const arrayDims = varDecl.arrayDimension();
      expect(VariableDeclHelper.parseFirstArrayDimension(arrayDims)).toBe(5);
    });

    it("returns null for expression dimension", () => {
      const varDecl = parseVarDecl("u8 x[SIZE];");
      const dims = varDecl.arrayDimension();
      expect(VariableDeclHelper.parseFirstArrayDimension(dims)).toBeNull();
    });
  });

  describe("extractBaseTypeName", () => {
    it("extracts primitive type name", () => {
      const typeCtx = parseType("u8 x;");
      expect(VariableDeclHelper.extractBaseTypeName(typeCtx)).toBe("u8");
    });

    it("extracts user type name", () => {
      const typeCtx = parseType("MyStruct x;");
      expect(VariableDeclHelper.extractBaseTypeName(typeCtx)).toBe("MyStruct");
    });

    it("extracts primitive from array type", () => {
      const typeCtx = parseType("u16[8] x;");
      expect(VariableDeclHelper.extractBaseTypeName(typeCtx)).toBe("u16");
    });

    it("extracts user type from array type", () => {
      const typeCtx = parseType("Point[4] x;");
      expect(VariableDeclHelper.extractBaseTypeName(typeCtx)).toBe("Point");
    });
  });

  // ========================================================================
  // Tier 2: Simple Operations
  // ========================================================================

  describe("validateArrayDeclarationSyntax", () => {
    it("allows C-Next style array syntax", () => {
      const varDecl = parseVarDecl("u8[10] arr;");
      const typeCtx = varDecl.type();
      // Should not throw
      expect(() => {
        VariableDeclHelper.validateArrayDeclarationSyntax(
          varDecl,
          typeCtx,
          "arr",
        );
      }).not.toThrow();
    });

    it("allows empty dimension for size inference", () => {
      const varDecl = parseVarDecl("u8 arr[] <- [1, 2, 3];");
      const typeCtx = varDecl.type();
      expect(() => {
        VariableDeclHelper.validateArrayDeclarationSyntax(
          varDecl,
          typeCtx,
          "arr",
        );
      }).not.toThrow();
    });

    it("allows multi-dimensional C-style", () => {
      const varDecl = parseVarDecl("u8 matrix[4][4];");
      const typeCtx = varDecl.type();
      expect(() => {
        VariableDeclHelper.validateArrayDeclarationSyntax(
          varDecl,
          typeCtx,
          "matrix",
        );
      }).not.toThrow();
    });

    it("allows string type with C-style", () => {
      const varDecl = parseVarDecl("string<32> names[4];");
      const typeCtx = varDecl.type();
      expect(() => {
        VariableDeclHelper.validateArrayDeclarationSyntax(
          varDecl,
          typeCtx,
          "names",
        );
      }).not.toThrow();
    });

    it("rejects C-style single dimension for primitives", () => {
      const varDecl = parseVarDecl("u8 arr[10];");
      const typeCtx = varDecl.type();
      expect(() => {
        VariableDeclHelper.validateArrayDeclarationSyntax(
          varDecl,
          typeCtx,
          "arr",
        );
      }).toThrow(/C-style array declaration is not allowed/);
    });
  });

  describe("validateIntegerInitializer", () => {
    it("does nothing for non-integer types", () => {
      const varDecl = parseVarDecl("f32 x <- 1.5;");
      // Should not throw
      expect(() => {
        VariableDeclHelper.validateIntegerInitializer(varDecl, "f32", {
          getExpressionType: () => "f32",
        });
      }).not.toThrow();
    });

    it("accepts valid integer literal", () => {
      const varDecl = parseVarDecl("u8 x <- 255;");
      expect(() => {
        VariableDeclHelper.validateIntegerInitializer(varDecl, "u8", {
          getExpressionType: () => "u8",
        });
      }).not.toThrow();
    });

    it("throws for overflow in literal", () => {
      const varDecl = parseVarDecl("u8 x <- 256;");
      expect(() => {
        VariableDeclHelper.validateIntegerInitializer(varDecl, "u8", {
          getExpressionType: () => "u8",
        });
      }).toThrow();
    });
  });

  describe("finalizeCppClassAssignments", () => {
    beforeEach(() => {
      CodeGenState.reset();
    });

    it("returns simple declaration with semicolon when no pending assignments", () => {
      const typeCtx = parseType("MyClass x;");
      const result = VariableDeclHelper.finalizeCppClassAssignments(
        typeCtx,
        "x",
        "MyClass x",
        { getTypeName: () => "MyClass" },
      );
      expect(result).toBe("MyClass x;");
    });

    it("appends assignments in function body", () => {
      CodeGenState.inFunctionBody = true;
      CodeGenState.pendingCppClassAssignments = ["field1 = value1"];

      const typeCtx = parseType("MyClass x;");
      const result = VariableDeclHelper.finalizeCppClassAssignments(
        typeCtx,
        "x",
        "MyClass x",
        { getTypeName: () => "MyClass" },
      );

      expect(result).toBe("MyClass x;\nx.field1 = value1");
      expect(CodeGenState.pendingCppClassAssignments).toHaveLength(0);
    });

    it("throws error at global scope with pending assignments", () => {
      CodeGenState.inFunctionBody = false;
      CodeGenState.pendingCppClassAssignments = ["field1 = value1"];

      const typeCtx = parseType("MyClass x;");
      expect(() => {
        VariableDeclHelper.finalizeCppClassAssignments(
          typeCtx,
          "x",
          "MyClass x",
          { getTypeName: () => "MyClass" },
        );
      }).toThrow(/global scope/);
    });
  });

  // ========================================================================
  // Tier 3: Complex Operations
  // ========================================================================

  describe("getArrayTypeDimension", () => {
    it("returns empty string for non-array type", () => {
      const typeCtx = parseType("u8 x;");
      const result = VariableDeclHelper.getArrayTypeDimension(typeCtx, {
        tryEvaluateConstant: () => undefined,
        generateExpression: (ctx) => ctx.getText(),
      });
      expect(result).toBe("");
    });

    it("returns dimension string for literal", () => {
      const typeCtx = parseType("u8[10] x;");
      const result = VariableDeclHelper.getArrayTypeDimension(typeCtx, {
        tryEvaluateConstant: () => 10,
        generateExpression: (ctx) => ctx.getText(),
      });
      expect(result).toBe("[10]");
    });

    it("returns empty bracket for unsized dimension", () => {
      const typeCtx = parseType("u8[] x;");
      const result = VariableDeclHelper.getArrayTypeDimension(typeCtx, {
        tryEvaluateConstant: () => undefined,
        generateExpression: (ctx) => ctx.getText(),
      });
      expect(result).toBe("[]");
    });

    it("falls back to expression for non-const", () => {
      const typeCtx = parseType("u8[SIZE] x;");
      const result = VariableDeclHelper.getArrayTypeDimension(typeCtx, {
        tryEvaluateConstant: () => undefined,
        generateExpression: () => "SIZE",
      });
      expect(result).toBe("[SIZE]");
    });
  });

  describe("handleArrayDeclaration", () => {
    beforeEach(() => {
      CodeGenState.reset();
    });

    it("returns not handled for non-array", () => {
      const varDecl = parseVarDecl("u8 x;");
      const typeCtx = varDecl.type();
      const result = VariableDeclHelper.handleArrayDeclaration(
        varDecl,
        typeCtx,
        "x",
        "uint8_t x",
        {
          generateExpression: (ctx) => ctx.getText(),
          getTypeName: () => "u8",
          generateArrayDimensions: () => "",
          tryEvaluateConstant: () => undefined,
        },
      );
      expect(result.handled).toBe(false);
      expect(result.isArray).toBe(false);
    });

    it("returns array with dimension for C-Next style", () => {
      const varDecl = parseVarDecl("u8[10] arr;");
      const typeCtx = varDecl.type();
      const result = VariableDeclHelper.handleArrayDeclaration(
        varDecl,
        typeCtx,
        "arr",
        "uint8_t arr",
        {
          generateExpression: (ctx) => ctx.getText(),
          getTypeName: () => "u8",
          generateArrayDimensions: () => "",
          tryEvaluateConstant: () => 10,
        },
      );
      expect(result.handled).toBe(false);
      expect(result.isArray).toBe(true);
      expect(result.decl).toBe("uint8_t arr[10]");
    });
  });

  describe("generateVariableInitializer", () => {
    beforeEach(() => {
      CodeGenState.reset();
    });

    it("returns zero initializer for uninitialized variable", () => {
      const varDecl = parseVarDecl("u8 x;");
      const typeCtx = varDecl.type();
      const result = VariableDeclHelper.generateVariableInitializer(
        varDecl,
        typeCtx,
        "uint8_t x",
        false,
        {
          generateExpression: (ctx) => ctx.getText(),
          getTypeName: () => "u8",
          getZeroInitializer: () => "0",
          getExpressionType: () => "u8",
        },
      );
      expect(result).toBe("uint8_t x = 0");
    });

    it("generates expression for initialized variable", () => {
      const varDecl = parseVarDecl("u8 x <- 42;");
      const typeCtx = varDecl.type();
      const result = VariableDeclHelper.generateVariableInitializer(
        varDecl,
        typeCtx,
        "uint8_t x",
        false,
        {
          generateExpression: () => "42",
          getTypeName: () => "u8",
          getZeroInitializer: () => "0",
          getExpressionType: () => "u8",
        },
      );
      expect(result).toBe("uint8_t x = 42");
    });
  });

  // ========================================================================
  // Tier 4: Orchestrators
  // ========================================================================

  describe("generateConstructorDecl", () => {
    beforeEach(() => {
      CodeGenState.reset();
      // Set up a const variable in the type registry for constructor argument
      CodeGenState.setVariableTypeInfo("pinConst", {
        baseType: "u8",
        bitWidth: 8,
        isArray: false,
        arrayDimensions: [],
        isConst: true,
      });
    });

    it("generates constructor declaration with const args", () => {
      const varDecl = parseVarDecl("MAX31856 thermo(pinConst);");
      const argListCtx = varDecl.constructorArgumentList()!;

      const result = VariableDeclHelper.generateConstructorDecl(
        varDecl,
        argListCtx,
        { generateType: () => "MAX31856" },
      );

      expect(result).toBe("MAX31856 thermo(pinConst);");
    });

    it("throws for undeclared constructor argument", () => {
      const varDecl = parseVarDecl("MAX31856 thermo(unknownVar);");
      const argListCtx = varDecl.constructorArgumentList()!;

      expect(() => {
        VariableDeclHelper.generateConstructorDecl(varDecl, argListCtx, {
          generateType: () => "MAX31856",
        });
      }).toThrow(/not declared/);
    });

    it("throws for non-const constructor argument", () => {
      CodeGenState.setVariableTypeInfo("nonConstVar", {
        baseType: "u8",
        bitWidth: 8,
        isArray: false,
        arrayDimensions: [],
        isConst: false,
      });

      const varDecl = parseVarDecl("MAX31856 thermo(nonConstVar);");
      const argListCtx = varDecl.constructorArgumentList()!;

      expect(() => {
        VariableDeclHelper.generateConstructorDecl(varDecl, argListCtx, {
          generateType: () => "MAX31856",
        });
      }).toThrow(/must be const/);
    });

    it("tracks the variable in type registry", () => {
      const varDecl = parseVarDecl("MAX31856 thermo(pinConst);");
      const argListCtx = varDecl.constructorArgumentList()!;

      VariableDeclHelper.generateConstructorDecl(varDecl, argListCtx, {
        generateType: () => "MAX31856",
      });

      const typeInfo = CodeGenState.getVariableTypeInfo("thermo");
      expect(typeInfo).toBeDefined();
      expect(typeInfo!.baseType).toBe("MAX31856");
      expect(typeInfo!.isExternalCppType).toBe(true);
    });
  });
});
