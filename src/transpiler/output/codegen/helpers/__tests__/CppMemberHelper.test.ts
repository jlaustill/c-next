import { describe, it, expect } from "vitest";
import CppMemberHelper from "../CppMemberHelper.js";
import IPostfixOp from "../types/IPostfixOp.js";

// Local type definitions matching CppMemberHelper's internal interfaces
type IParamInfo = {
  baseType: string;
  isStruct?: boolean;
  isConst?: boolean;
};

type ITypeInfo = {
  baseType: string;
  isArray?: boolean;
  isString?: boolean;
};

describe("CppMemberHelper", () => {
  describe("isU8TargetType", () => {
    it("returns true for u8 type", () => {
      expect(CppMemberHelper.isU8TargetType("u8")).toBe(true);
    });

    it("returns false for u16 type", () => {
      expect(CppMemberHelper.isU8TargetType("u16")).toBe(false);
    });

    it("returns false for u32 type", () => {
      expect(CppMemberHelper.isU8TargetType("u32")).toBe(false);
    });

    it("returns false for i32 type", () => {
      expect(CppMemberHelper.isU8TargetType("i32")).toBe(false);
    });

    it("returns false for unknown type", () => {
      expect(CppMemberHelper.isU8TargetType("MyStruct")).toBe(false);
    });
  });

  describe("needsParamMemberConversion", () => {
    it("returns false for primitive parameter types", () => {
      const paramInfo: IParamInfo = { baseType: "u32" };
      expect(CppMemberHelper.needsParamMemberConversion(paramInfo, "u8")).toBe(
        false,
      );
    });

    it("returns true for const struct parameter", () => {
      const paramInfo: IParamInfo = {
        baseType: "Config",
        isStruct: true,
        isConst: true,
      };
      expect(CppMemberHelper.needsParamMemberConversion(paramInfo, "u32")).toBe(
        true,
      );
    });

    it("returns true for non-primitive type with u8 target", () => {
      const paramInfo: IParamInfo = {
        baseType: "MyStruct",
        isStruct: true,
      };
      expect(CppMemberHelper.needsParamMemberConversion(paramInfo, "u8")).toBe(
        true,
      );
    });

    it("returns false for non-primitive type with non-u8 target", () => {
      const paramInfo: IParamInfo = {
        baseType: "MyStruct",
        isStruct: true,
      };
      expect(CppMemberHelper.needsParamMemberConversion(paramInfo, "u32")).toBe(
        false,
      );
    });

    it("treats unknown base type as potential struct", () => {
      const paramInfo: IParamInfo = { baseType: "UnknownType" };
      expect(CppMemberHelper.needsParamMemberConversion(paramInfo, "u8")).toBe(
        true,
      );
    });
  });

  describe("needsArrayElementMemberConversion", () => {
    const makeOp = (hasExpression: boolean): IPostfixOp => ({
      hasExpression,
      hasIdentifier: false,
      hasArgumentList: false,
      textEndsWithParen: false,
    });

    it("returns false when no array subscript in ops", () => {
      const ops = [makeOp(false)];
      const typeInfo: ITypeInfo = { baseType: "MyStruct", isArray: true };
      expect(
        CppMemberHelper.needsArrayElementMemberConversion(ops, typeInfo, "u8"),
      ).toBe(false);
    });

    it("returns false when typeInfo is undefined", () => {
      const ops = [makeOp(true)];
      expect(
        CppMemberHelper.needsArrayElementMemberConversion(ops, undefined, "u8"),
      ).toBe(false);
    });

    it("returns false when type is not array", () => {
      const ops = [makeOp(true)];
      const typeInfo: ITypeInfo = { baseType: "MyStruct", isArray: false };
      expect(
        CppMemberHelper.needsArrayElementMemberConversion(ops, typeInfo, "u8"),
      ).toBe(false);
    });

    it("returns false for primitive element type", () => {
      const ops = [makeOp(true)];
      const typeInfo: ITypeInfo = { baseType: "u32", isArray: true };
      expect(
        CppMemberHelper.needsArrayElementMemberConversion(ops, typeInfo, "u8"),
      ).toBe(false);
    });

    it("returns true for struct array with u8 target", () => {
      const ops = [makeOp(true)];
      const typeInfo: ITypeInfo = { baseType: "MyStruct", isArray: true };
      expect(
        CppMemberHelper.needsArrayElementMemberConversion(ops, typeInfo, "u8"),
      ).toBe(true);
    });

    it("returns false for struct array with non-u8 target", () => {
      const ops = [makeOp(true)];
      const typeInfo: ITypeInfo = { baseType: "MyStruct", isArray: true };
      expect(
        CppMemberHelper.needsArrayElementMemberConversion(ops, typeInfo, "u32"),
      ).toBe(false);
    });
  });

  describe("needsFunctionReturnMemberConversion", () => {
    it("returns false when no function call in ops", () => {
      const ops: IPostfixOp[] = [
        {
          hasExpression: false,
          hasIdentifier: true,
          hasArgumentList: false,
          textEndsWithParen: false,
        },
      ];
      expect(
        CppMemberHelper.needsFunctionReturnMemberConversion(ops, "u8"),
      ).toBe(false);
    });

    it("returns true for function call with u8 target (hasArgumentList)", () => {
      const ops: IPostfixOp[] = [
        {
          hasExpression: false,
          hasIdentifier: false,
          hasArgumentList: true,
          textEndsWithParen: false,
        },
      ];
      expect(
        CppMemberHelper.needsFunctionReturnMemberConversion(ops, "u8"),
      ).toBe(true);
    });

    it("returns true for function call with u8 target (textEndsWithParen)", () => {
      const ops: IPostfixOp[] = [
        {
          hasExpression: false,
          hasIdentifier: false,
          hasArgumentList: false,
          textEndsWithParen: true,
        },
      ];
      expect(
        CppMemberHelper.needsFunctionReturnMemberConversion(ops, "u8"),
      ).toBe(true);
    });

    it("returns false for function call with non-u8 target", () => {
      const ops: IPostfixOp[] = [
        {
          hasExpression: false,
          hasIdentifier: false,
          hasArgumentList: true,
          textEndsWithParen: false,
        },
      ];
      expect(
        CppMemberHelper.needsFunctionReturnMemberConversion(ops, "u32"),
      ).toBe(false);
    });
  });

  describe("needsComplexMemberConversion", () => {
    const makeOps = (...types: string[]): IPostfixOp[] =>
      types.map((t) => ({
        hasExpression: t === "array",
        hasIdentifier: t === "member",
        hasArgumentList: t === "function",
        textEndsWithParen: false,
      }));

    it("returns false for single op", () => {
      const ops = makeOps("member");
      expect(
        CppMemberHelper.needsComplexMemberConversion(ops, undefined, "u8"),
      ).toBe(false);
    });

    it("returns false when last op is not member access", () => {
      const ops = makeOps("member", "array");
      expect(
        CppMemberHelper.needsComplexMemberConversion(ops, undefined, "u8"),
      ).toBe(false);
    });

    it("returns true for array element then member access with struct type and u8 target", () => {
      const ops = makeOps("array", "member");
      const typeInfo: ITypeInfo = { baseType: "MyStruct", isArray: true };
      expect(
        CppMemberHelper.needsComplexMemberConversion(ops, typeInfo, "u8"),
      ).toBe(true);
    });

    it("returns true for function call then member access with u8 target", () => {
      const ops = makeOps("function", "member");
      expect(
        CppMemberHelper.needsComplexMemberConversion(ops, undefined, "u8"),
      ).toBe(true);
    });

    it("returns false for function call then member access with non-u8 target", () => {
      const ops = makeOps("function", "member");
      expect(
        CppMemberHelper.needsComplexMemberConversion(ops, undefined, "u32"),
      ).toBe(false);
    });
  });

  describe("isStringSubscriptPattern", () => {
    it("returns false when no postfix ops", () => {
      expect(
        CppMemberHelper.isStringSubscriptPattern(false, true, undefined, false),
      ).toBe(false);
    });

    it("returns false when last op is not expression", () => {
      expect(
        CppMemberHelper.isStringSubscriptPattern(true, false, undefined, false),
      ).toBe(false);
    });

    it("returns true when typeInfo indicates string", () => {
      const typeInfo: ITypeInfo = { baseType: "string", isString: true };
      expect(
        CppMemberHelper.isStringSubscriptPattern(true, true, typeInfo, false),
      ).toBe(true);
    });

    it("returns true when param is string", () => {
      expect(
        CppMemberHelper.isStringSubscriptPattern(true, true, undefined, true),
      ).toBe(true);
    });

    it("returns false when neither typeInfo nor param indicates string", () => {
      const typeInfo: ITypeInfo = { baseType: "u8", isArray: true };
      expect(
        CppMemberHelper.isStringSubscriptPattern(true, true, typeInfo, false),
      ).toBe(false);
    });
  });

  describe("getLastPostfixOpType", () => {
    it("returns null for empty ops", () => {
      expect(CppMemberHelper.getLastPostfixOpType([])).toBeNull();
    });

    it("returns 'function' for argument list", () => {
      const ops: IPostfixOp[] = [
        {
          hasExpression: false,
          hasIdentifier: false,
          hasArgumentList: true,
          textEndsWithParen: false,
        },
      ];
      expect(CppMemberHelper.getLastPostfixOpType(ops)).toBe("function");
    });

    it("returns 'function' for text ending with paren", () => {
      const ops: IPostfixOp[] = [
        {
          hasExpression: false,
          hasIdentifier: false,
          hasArgumentList: false,
          textEndsWithParen: true,
        },
      ];
      expect(CppMemberHelper.getLastPostfixOpType(ops)).toBe("function");
    });

    it("returns 'member' for identifier", () => {
      const ops: IPostfixOp[] = [
        {
          hasExpression: false,
          hasIdentifier: true,
          hasArgumentList: false,
          textEndsWithParen: false,
        },
      ];
      expect(CppMemberHelper.getLastPostfixOpType(ops)).toBe("member");
    });

    it("returns 'array' for expression", () => {
      const ops: IPostfixOp[] = [
        {
          hasExpression: true,
          hasIdentifier: false,
          hasArgumentList: false,
          textEndsWithParen: false,
        },
      ];
      expect(CppMemberHelper.getLastPostfixOpType(ops)).toBe("array");
    });

    it("returns null for unrecognized op type", () => {
      const ops: IPostfixOp[] = [
        {
          hasExpression: false,
          hasIdentifier: false,
          hasArgumentList: false,
          textEndsWithParen: false,
        },
      ];
      expect(CppMemberHelper.getLastPostfixOpType(ops)).toBeNull();
    });

    it("prioritizes function over member", () => {
      const ops: IPostfixOp[] = [
        {
          hasExpression: false,
          hasIdentifier: true,
          hasArgumentList: true,
          textEndsWithParen: false,
        },
      ];
      expect(CppMemberHelper.getLastPostfixOpType(ops)).toBe("function");
    });

    it("uses last op when multiple ops present", () => {
      const ops: IPostfixOp[] = [
        {
          hasExpression: false,
          hasIdentifier: false,
          hasArgumentList: true,
          textEndsWithParen: false,
        },
        {
          hasExpression: false,
          hasIdentifier: true,
          hasArgumentList: false,
          textEndsWithParen: false,
        },
      ];
      expect(CppMemberHelper.getLastPostfixOpType(ops)).toBe("member");
    });
  });
});
