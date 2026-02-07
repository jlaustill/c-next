/**
 * Unit tests for TypeGenerationHelper
 * Tests for C type generation from C-Next type contexts
 */

import { describe, it, expect, vi } from "vitest";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser.js";
import TypeGenerationHelper from "../TypeGenerationHelper.js";
import * as Parser from "../../../../logic/parser/grammar/CNextParser.js";

describe("TypeGenerationHelper", () => {
  /**
   * Helper to extract a type context from a variable declaration.
   */
  function getTypeContext(source: string): Parser.TypeContext | null {
    const result = CNextSourceParser.parse(source);
    const decl = result.tree.declaration(0);
    const varDecl = decl?.variableDeclaration();
    return varDecl?.type() ?? null;
  }

  /**
   * Helper to extract type from function return type.
   */
  function getFunctionReturnType(source: string): Parser.TypeContext | null {
    const result = CNextSourceParser.parse(source);
    const decl = result.tree.declaration(0);
    const funcDecl = decl?.functionDeclaration();
    return funcDecl?.type() ?? null;
  }

  describe("generatePrimitiveType", () => {
    it("maps bool type and requires stdbool", () => {
      const result = TypeGenerationHelper.generatePrimitiveType("bool");
      expect(result.cType).toBe("bool");
      expect(result.include).toBe("stdbool");
    });

    it("maps ISR type and requires isr include", () => {
      const result = TypeGenerationHelper.generatePrimitiveType("ISR");
      expect(result.cType).toBe("ISR");
      expect(result.include).toBe("isr");
    });

    it("maps u8 to uint8_t and requires stdint", () => {
      const result = TypeGenerationHelper.generatePrimitiveType("u8");
      expect(result.cType).toBe("uint8_t");
      expect(result.include).toBe("stdint");
    });

    it("maps i32 to int32_t and requires stdint", () => {
      const result = TypeGenerationHelper.generatePrimitiveType("i32");
      expect(result.cType).toBe("int32_t");
      expect(result.include).toBe("stdint");
    });

    it("maps u64 to uint64_t and requires stdint", () => {
      const result = TypeGenerationHelper.generatePrimitiveType("u64");
      expect(result.cType).toBe("uint64_t");
      expect(result.include).toBe("stdint");
    });

    it("maps f32 to float with stdint include", () => {
      // Note: floats are in TYPE_MAP so they require stdint per original logic
      const result = TypeGenerationHelper.generatePrimitiveType("f32");
      expect(result.cType).toBe("float");
      expect(result.include).toBe("stdint");
    });

    it("maps f64 to double with stdint include", () => {
      // Note: doubles are in TYPE_MAP so they require stdint per original logic
      const result = TypeGenerationHelper.generatePrimitiveType("f64");
      expect(result.cType).toBe("double");
      expect(result.include).toBe("stdint");
    });

    it("returns void unchanged with no include", () => {
      const result = TypeGenerationHelper.generatePrimitiveType("void");
      expect(result.cType).toBe("void");
      expect(result.include).toBe(null);
    });

    it("returns unknown type unchanged", () => {
      const result = TypeGenerationHelper.generatePrimitiveType("CustomType");
      expect(result.cType).toBe("CustomType");
      expect(result.include).toBe(null);
    });
  });

  describe("generateScopedType", () => {
    it("generates prefixed type name within scope", () => {
      const result = TypeGenerationHelper.generateScopedType("State", "Motor");
      expect(result).toBe("Motor_State");
    });

    it("throws when called outside scope", () => {
      expect(() => {
        TypeGenerationHelper.generateScopedType("State", null);
      }).toThrow("Cannot use 'this.Type' outside of a scope");
    });
  });

  describe("generateGlobalType", () => {
    it("returns type name unchanged", () => {
      const result = TypeGenerationHelper.generateGlobalType("GlobalConfig");
      expect(result).toBe("GlobalConfig");
    });
  });

  describe("generateQualifiedType", () => {
    it("joins C++ namespace identifiers with ::", () => {
      const result = TypeGenerationHelper.generateQualifiedType(
        ["MockLib", "Parse", "ParseResult"],
        true,
      );
      expect(result).toBe("MockLib::Parse::ParseResult");
    });

    it("joins C-Next scope identifiers with _", () => {
      const result = TypeGenerationHelper.generateQualifiedType(
        ["Motor", "State"],
        false,
      );
      expect(result).toBe("Motor_State");
    });

    it("validates visibility for 2-part C-Next types", () => {
      const validateFn = vi.fn();
      TypeGenerationHelper.generateQualifiedType(
        ["Motor", "State"],
        false,
        validateFn,
      );
      expect(validateFn).toHaveBeenCalledWith("Motor", "State");
    });

    it("does not validate visibility for 3+ part types", () => {
      const validateFn = vi.fn();
      TypeGenerationHelper.generateQualifiedType(
        ["A", "B", "C"],
        false,
        validateFn,
      );
      expect(validateFn).not.toHaveBeenCalled();
    });

    it("does not validate visibility for C++ namespaces", () => {
      const validateFn = vi.fn();
      TypeGenerationHelper.generateQualifiedType(
        ["Lib", "Type"],
        true,
        validateFn,
      );
      expect(validateFn).not.toHaveBeenCalled();
    });
  });

  describe("generateUserType", () => {
    it("maps cstring to char*", () => {
      const result = TypeGenerationHelper.generateUserType("cstring", false);
      expect(result).toBe("char*");
    });

    it("adds struct keyword when needed", () => {
      const result = TypeGenerationHelper.generateUserType("MyStruct", true);
      expect(result).toBe("struct MyStruct");
    });

    it("returns type unchanged when struct keyword not needed", () => {
      const result = TypeGenerationHelper.generateUserType("MyType", false);
      expect(result).toBe("MyType");
    });
  });

  describe("generateArrayBaseType", () => {
    it("maps primitive type to C type", () => {
      const result = TypeGenerationHelper.generateArrayBaseType(
        "u32",
        null,
        false,
      );
      expect(result).toBe("uint32_t");
    });

    it("returns unknown primitive type unchanged", () => {
      // When primitive type is not in TYPE_MAP, return as-is
      const result = TypeGenerationHelper.generateArrayBaseType(
        "unknownType",
        null,
        false,
      );
      expect(result).toBe("unknownType");
    });

    it("returns user type unchanged", () => {
      const result = TypeGenerationHelper.generateArrayBaseType(
        null,
        "MyType",
        false,
      );
      expect(result).toBe("MyType");
    });

    it("adds struct keyword for user types when needed", () => {
      const result = TypeGenerationHelper.generateArrayBaseType(
        null,
        "CStruct",
        true,
      );
      expect(result).toBe("struct CStruct");
    });

    it("throws when neither primitive nor user type provided", () => {
      expect(() => {
        TypeGenerationHelper.generateArrayBaseType(null, null, false);
      }).toThrow("Array type must have either primitive or user type");
    });
  });

  describe("generateStringType", () => {
    it("returns char for bounded strings", () => {
      const result = TypeGenerationHelper.generateStringType();
      expect(result).toBe("char");
    });
  });

  describe("generate (full context)", () => {
    const defaultDeps = {
      currentScope: null as string | null,
      isCppScopeSymbol: () => false,
      checkNeedsStructKeyword: () => false,
      validateCrossScopeVisibility: vi.fn(),
    };

    it("generates primitive type u32", () => {
      const ctx = getTypeContext("u32 x;");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, defaultDeps);
      expect(result).toBe("uint32_t");
    });

    it("generates primitive type bool", () => {
      const ctx = getTypeContext("bool flag;");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, defaultDeps);
      expect(result).toBe("bool");
    });

    it("generates string type", () => {
      const ctx = getTypeContext("string<32> name;");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, defaultDeps);
      expect(result).toBe("char");
    });

    it("generates scoped type within scope", () => {
      const ctx = getTypeContext("this.State status;");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, {
        ...defaultDeps,
        currentScope: "Motor",
      });
      expect(result).toBe("Motor_State");
    });

    it("throws for scoped type outside scope", () => {
      const ctx = getTypeContext("this.State status;");
      expect(ctx).not.toBeNull();
      expect(() => {
        TypeGenerationHelper.generate(ctx!, defaultDeps);
      }).toThrow();
    });

    it("generates global type", () => {
      const ctx = getTypeContext("global.Config cfg;");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, defaultDeps);
      expect(result).toBe("Config");
    });

    it("generates qualified C-Next type", () => {
      const ctx = getTypeContext("Motor.State status;");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, defaultDeps);
      expect(result).toBe("Motor_State");
    });

    it("generates qualified C++ namespace type", () => {
      const ctx = getTypeContext("Lib.Type val;");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, {
        ...defaultDeps,
        isCppScopeSymbol: (name) => name === "Lib",
      });
      expect(result).toBe("Lib::Type");
    });

    it("generates user type", () => {
      const ctx = getTypeContext("MyStruct obj;");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, defaultDeps);
      expect(result).toBe("MyStruct");
    });

    it("generates user type with struct keyword", () => {
      const ctx = getTypeContext("CStruct obj;");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, {
        ...defaultDeps,
        checkNeedsStructKeyword: (name) => name === "CStruct",
      });
      expect(result).toBe("struct CStruct");
    });

    it("generates cstring as char*", () => {
      const ctx = getTypeContext("cstring ptr;");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, defaultDeps);
      expect(result).toBe("char*");
    });

    it("generates array base type for primitive array", () => {
      // Arrays in C-Next are declared with dimensions after name: u8 arr[10];
      // The type context for arrays is handled separately (not in type context)
      // This test verifies that primitive arrays work via generateArrayBaseType
      const result = TypeGenerationHelper.generateArrayBaseType(
        "u8",
        null,
        false,
      );
      expect(result).toBe("uint8_t");
    });

    it("generates array type with primitive via generate()", () => {
      // Array type in type position: u8[10] as the type
      const ctx = getTypeContext("u8[10] arr;");
      expect(ctx).not.toBeNull();
      expect(ctx!.arrayType()).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, defaultDeps);
      expect(result).toBe("uint8_t");
    });

    it("generates array type with user type via generate()", () => {
      // Array of user-defined type: MyStruct[5] as the type
      const ctx = getTypeContext("MyStruct[5] arr;");
      expect(ctx).not.toBeNull();
      expect(ctx!.arrayType()).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, defaultDeps);
      expect(result).toBe("MyStruct");
    });

    it("generates array type with user type needing struct keyword", () => {
      // Array of C struct type that needs 'struct' prefix
      const ctx = getTypeContext("CStruct[3] arr;");
      expect(ctx).not.toBeNull();
      expect(ctx!.arrayType()).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, {
        ...defaultDeps,
        checkNeedsStructKeyword: (name) => name === "CStruct",
      });
      expect(result).toBe("struct CStruct");
    });

    it("generates void return type", () => {
      const ctx = getFunctionReturnType("void test() { }");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, defaultDeps);
      expect(result).toBe("void");
    });

    it("passes through C++ template types unchanged (fallback)", () => {
      // C++ template types like FlexCAN_T4<CAN1> hit the fallback path
      // and are passed through unchanged for C++ output
      const ctx = getTypeContext("FlexCAN_T4<CAN1> bus;");
      expect(ctx).not.toBeNull();
      expect(ctx!.templateType()).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, defaultDeps);
      expect(result).toBe("FlexCAN_T4<CAN1>");
    });
  });

  describe("getRequiredInclude", () => {
    it("returns stdbool for bool type", () => {
      const ctx = getTypeContext("bool x;");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.getRequiredInclude(ctx!);
      expect(result).toBe("stdbool");
    });

    it("returns stdint for integer types", () => {
      const ctx = getTypeContext("u32 x;");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.getRequiredInclude(ctx!);
      expect(result).toBe("stdint");
    });

    it("returns string for string type", () => {
      const ctx = getTypeContext("string<32> name;");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.getRequiredInclude(ctx!);
      expect(result).toBe("string");
    });

    it("returns null for user types", () => {
      const ctx = getTypeContext("MyStruct obj;");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.getRequiredInclude(ctx!);
      expect(result).toBeNull();
    });

    it("returns stdint for float types (in TYPE_MAP)", () => {
      // Note: floats are in TYPE_MAP so they return stdint per original logic
      const ctx = getTypeContext("f32 x;");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.getRequiredInclude(ctx!);
      expect(result).toBe("stdint");
    });
  });
});
