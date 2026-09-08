/**
 * Unit tests for TypeGenerationHelper
 * Tests for C type generation from C-Next type contexts
 */

import { describe, it, expect } from "vitest";
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
    it.each([
      ["maps bool type and requires stdbool", "bool", "bool", "stdbool"],
      ["maps ISR type and requires isr include", "ISR", "ISR", "isr"],
      ["maps u8 to uint8_t and requires stdint", "u8", "uint8_t", "stdint"],
      ["maps i32 to int32_t and requires stdint", "i32", "int32_t", "stdint"],
      ["maps u64 to uint64_t and requires stdint", "u64", "uint64_t", "stdint"],
      [
        "maps f32 to float with stdint include (Note: floats are in TYPE_MAP so they require stdint per original logic)",
        "f32",
        "float",
        "stdint",
      ],
      [
        "maps f64 to double with stdint include (Note: doubles are in TYPE_MAP so they require stdint per original logic)",
        "f64",
        "double",
        "stdint",
      ],
    ])("%s", (_label, source, argument2, expected) => {
      const result = TypeGenerationHelper.generatePrimitiveType(source);
      expect(result.cType).toBe(argument2);
      expect(result.include).toBe(expected);
    });

    it("returns void unchanged with no include", () => {
      const result = TypeGenerationHelper.generatePrimitiveType("void");
      expect(result.cType).toBe("void");
      expect(result.include).toBeNull();
    });

    it("returns unknown type unchanged", () => {
      const result = TypeGenerationHelper.generatePrimitiveType("CustomType");
      expect(result.cType).toBe("CustomType");
      expect(result.include).toBeNull();
    });
  });

  describe("generateScopedType", () => {
    it("generates prefixed type name within scope", () => {
      const result = TypeGenerationHelper.generateScopedType("State", "Motor");
      expect(result).toBe("Motor__State");
    });

    // #1322: the "throws when called outside scope" case is deleted with the
    // guard. `this` outside a scope is E0431 in pass 2.1, which halts before
    // code generation, so the empty-scope call this asserted is unreachable.
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
      expect(result).toBe("Motor__State");
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

  describe("generateStringType", () => {
    it("returns char for bounded strings", () => {
      const result = TypeGenerationHelper.generateStringType();
      expect(result).toBe("char");
    });
  });

  describe("generate (full context)", () => {
    const defaultDeps = {
      currentScopePath: "",
      isCppScopeSymbol: () => false,
      checkNeedsStructKeyword: () => false,
      isScopeType: () => false,
      isCrossFileDeclaration: () => false,
    };

    it.each([
      ["generates primitive type u32", "u32 x;", "uint32_t"],
      ["generates primitive type bool", "bool flag;", "bool"],
      ["generates string type", "string<32> name;", "char"],
    ])("%s", (_label, source, expected) => {
      const ctx = getTypeContext(source);
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, defaultDeps);
      expect(result).toBe(expected);
    });

    it("generates scoped type within scope", () => {
      const ctx = getTypeContext("this.State status;");
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, {
        ...defaultDeps,
        currentScopePath: "Motor",
      });
      expect(result).toBe("Motor__State");
    });

    // #1322: this case asserted that `generate` throws for `this.Type` with no
    // enclosing scope. The guard is deleted, not relocated -- `this` outside a
    // scope is E0431 in pass 2.1, which reaches a TYPE position as well as a
    // value one and halts before code generation. Verified on both shapes that
    // reached this code: a file-scope declaration and a local one, each
    // reporting E0431 at the `this` token.

    // The deps column keeps the two cases needing a non-default dependency in
    // the same table as the rest, rather than stranding them between merged
    // rows. It also makes what each case overrides obvious at a glance.
    // Mirrors the optional half of ITypeGenerationDeps, which is not exported
    // (the project uses default exports only). Deriving from typeof defaultDeps
    // instead would narrow the mocks to their zero-argument shapes.
    type DepsOverride = {
      currentScopePath?: string;
      isCppScopeSymbol?: (name: string) => boolean;
      checkNeedsStructKeyword?: (name: string) => boolean;
      isScopeType?: (qualifiedName: string) => boolean;
    };

    it.each<[string, string, DepsOverride, string]>([
      ["global type", "global.Config cfg;", {}, "Config"],
      ["qualified C-Next type", "Motor.State status;", {}, "Motor__State"],
      [
        "qualified C++ namespace type",
        "Lib.Type val;",
        { isCppScopeSymbol: (name: string) => name === "Lib" },
        "Lib::Type",
      ],
      ["user type", "MyStruct obj;", {}, "MyStruct"],
      [
        "user type with struct keyword",
        "CStruct obj;",
        { checkNeedsStructKeyword: (name: string) => name === "CStruct" },
        "struct CStruct",
      ],
      ["cstring as char*", "cstring ptr;", {}, "char*"],
    ])("generates %s", (_label, source, depsOverride, expected) => {
      const ctx = getTypeContext(source);
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.generate(ctx!, {
        ...defaultDeps,
        ...depsOverride,
      });
      expect(result).toBe(expected);
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
    it.each([
      ["returns stdbool for bool type", "bool x;", "stdbool"],
      ["returns stdint for integer types", "u32 x;", "stdint"],
      ["returns string for string type", "string<32> name;", "string"],
    ])("%s", (_label, source, expected) => {
      const ctx = getTypeContext(source);
      expect(ctx).not.toBeNull();
      const result = TypeGenerationHelper.getRequiredInclude(ctx!);
      expect(result).toBe(expected);
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
