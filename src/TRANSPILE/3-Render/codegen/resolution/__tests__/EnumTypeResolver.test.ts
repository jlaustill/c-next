/**
 * Tests for EnumTypeResolver - enum type inference from expressions
 */

import { describe, it, expect, beforeEach } from "vitest";
import EnumTypeResolver from "../EnumTypeResolver";
import CodeGenState from "../../../../../transpiler/state/CodeGenState";
import ExpressionUnwrapper from "../../../../../utils/ExpressionUnwrapper";
import TypeResolver from "../../TypeResolver";
import SymbolTable from "../../../../../transpiler/state/SymbolTable";
import createMockSymbols from "../../../../../transpiler/__tests__/codeGenSymbolsHelpers";
import enterScope from "../../../../../transpiler/__tests__/enterScope";

// #1445: `resolve` takes the expression's TEXT and a thunk for the
// struct-member-chain fallback, so there is no node to fake and the
// `as never` casts these tests carried are gone. The thunk returns null
// throughout because none of these cases reach the fallback -- the mock never
// had a tree for it to walk either.
describe("EnumTypeResolver", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  describe("resolve() - function call patterns", () => {
    it("resolves function call returning enum type", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["State"]),
        functionReturnTypes: new Map([["getState", "State"]]),
      });

      expect(EnumTypeResolver.resolve("getState()", () => null)).toBe("State");
    });

    it("resolves this.method() returning enum type", () => {
      enterScope("Motor");
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["State"]),
        functionReturnTypes: new Map([["Motor__getState", "State"]]),
      });

      expect(EnumTypeResolver.resolve("this.getState()", () => null)).toBe(
        "State",
      );
    });

    it("resolves global.func() returning enum type", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["State"]),
        functionReturnTypes: new Map([["getGlobalState", "State"]]),
      });

      expect(
        EnumTypeResolver.resolve("global.getGlobalState()", () => null),
      ).toBe("State");
    });

    it("resolves Scope.method() returning enum type", () => {
      CodeGenState.symbols = createMockSymbols({
        knownScopes: new Set(["Motor"]),
        knownEnums: new Set(["State"]),
        functionReturnTypes: new Map([["Motor__getState", "State"]]),
      });

      expect(EnumTypeResolver.resolve("Motor.getState()", () => null)).toBe(
        "State",
      );
    });

    it("resolves global.Scope.method() returning enum type", () => {
      CodeGenState.symbols = createMockSymbols({
        knownScopes: new Set(["Motor"]),
        knownEnums: new Set(["State"]),
        functionReturnTypes: new Map([["Motor__getState", "State"]]),
      });

      expect(
        EnumTypeResolver.resolve("global.Motor.getState()", () => null),
      ).toBe("State");
    });

    it("returns null for function returning non-enum type", () => {
      CodeGenState.symbols = createMockSymbols({
        functionReturnTypes: new Map([["getValue", "u32"]]),
      });

      expect(EnumTypeResolver.resolve("getValue()", () => null)).toBeNull();
    });

    it("returns null for unknown function", () => {
      CodeGenState.symbols = createMockSymbols();

      expect(EnumTypeResolver.resolve("unknownFunc()", () => null)).toBeNull();
    });
  });

  describe("resolve() - simple identifier patterns", () => {
    it("resolves enum variable by type registry lookup", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["State"]),
      });
      CodeGenState.setVariableTypeInfo("currentState", {
        baseType: "State",
        bitWidth: 0,
        isArray: false,
        isConst: false,
        isEnum: true,
        enumTypeName: "State",
      });

      expect(EnumTypeResolver.resolve("currentState", () => null)).toBe(
        "State",
      );
    });

    it("returns null for non-enum variable", () => {
      CodeGenState.setVariableTypeInfo("count", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });

      expect(EnumTypeResolver.resolve("count", () => null)).toBeNull();
    });
  });

  describe("resolve() - member access patterns", () => {
    it("resolves simple enum member access: State.IDLE", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["State"]),
      });

      expect(EnumTypeResolver.resolve("State.IDLE", () => null)).toBe("State");
    });

    it("resolves scoped enum: Motor.State.IDLE -> Motor_State", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Motor__State"]),
      });

      expect(EnumTypeResolver.resolve("Motor.State.IDLE", () => null)).toBe(
        "Motor__State",
      );
    });

    it("resolves this.Enum.MEMBER inside scope", () => {
      enterScope("Motor");
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Motor__State"]),
      });

      expect(EnumTypeResolver.resolve("this.State.IDLE", () => null)).toBe(
        "Motor__State",
      );
    });

    it("resolves global.Enum.MEMBER pattern", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["ECategory"]),
      });

      expect(
        EnumTypeResolver.resolve("global.ECategory.CAT_A", () => null),
      ).toBe("ECategory");
    });

    it("resolves this.variable pattern for enum-typed scope member", () => {
      enterScope("Motor");
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Motor__State"]),
      });
      CodeGenState.setVariableTypeInfo("Motor__current", {
        baseType: "Motor__State",
        bitWidth: 0,
        isArray: false,
        isConst: false,
        isEnum: true,
        enumTypeName: "Motor__State",
      });

      expect(EnumTypeResolver.resolve("this.current", () => null)).toBe(
        "Motor__State",
      );
    });
  });

  describe("resolve() - TypeResolver fallback for struct member chains", () => {
    /**
     * Helper to build a mock ExpressionContext that contains a full postfix
     * expression tree: global.input.assignedValue
     */

    /**
     * #1445: the struct-member-chain fallback moved to
     * `CodeGenerator.getExpressionEnumType`, which supplies it as a thunk. This
     * is that walk, so the two assertions below still exercise
     * `TypeResolver.getPostfixExpressionType` against a fabricated chain rather
     * than being deleted with the method that used to host them.
     */
    const postfixEnumThunk = (ctx: { getText: () => string }) => () => {
      const postfix = ExpressionUnwrapper.getPostfixExpression(ctx as never);
      if (!postfix) return null;
      const resolved = TypeResolver.getPostfixExpressionType(postfix);
      return resolved && CodeGenState.isKnownEnum(resolved) ? resolved : null;
    };

    const buildStructChainCtx = (
      primaryToken: "GLOBAL" | "THIS" | "IDENTIFIER",
      primaryText: string,
      suffixes: string[],
    ) => {
      const primary = {
        IDENTIFIER: () =>
          primaryToken === "IDENTIFIER" ? { getText: () => primaryText } : null,
        GLOBAL: () =>
          primaryToken === "GLOBAL" ? { getText: () => "global" } : null,
        THIS: () =>
          primaryToken === "THIS" ? { getText: () => "this" } : null,
        literal: () => null,
        expression: () => null,
        castExpression: () => null,
      };
      const children = [
        { getText: () => primaryText },
        ...suffixes.map((s) => ({ getText: () => s })),
      ];
      // #1303: a real PostfixExpressionContext answers postfixOp() as well as
      // children, and getPostfixExpressionType consults it for the
      // `global.Scope.member` spelling. Derived from the same `suffixes` the
      // children come from, so the two views cannot drift apart.
      const postfixOp = () =>
        suffixes.map((suffix) => ({
          IDENTIFIER: () =>
            suffix.startsWith(".") ? { getText: () => suffix.slice(1) } : null,
          LBRACKET: () => (suffix.startsWith("[") ? {} : null),
        }));
      const postfix = { primaryExpression: () => primary, children, postfixOp };

      // Build the full expression tree wrapping the postfix
      const unary = {
        postfixExpression: () => postfix,
        unaryExpression: () => null,
      };
      const mult = { unaryExpression: () => [unary] };
      const add = { multiplicativeExpression: () => [mult] };
      const shift = { additiveExpression: () => [add] };
      const bitAnd = { shiftExpression: () => [shift] };
      const bitXor = { bitwiseAndExpression: () => [bitAnd] };
      const bitOr = { bitwiseXorExpression: () => [bitXor] };
      const rel = { bitwiseOrExpression: () => [bitOr] };
      const eq = { relationalExpression: () => [rel] };
      const and = { equalityExpression: () => [eq] };
      const or = { andExpression: () => [and] };
      const ternary = { orExpression: () => [or] };

      // #1445: no longer cast to `never`. The thunk below casts where the
      // unwrapper needs a real context; the test still needs `getText()` to be
      // readable, because `resolve` takes the text now.
      return {
        getText: () => primaryText + suffixes.join(""),
        ternaryExpression: () => ternary,
      };
    };

    it("resolves global.struct.enumField via TypeResolver fallback", () => {
      const symbolTable = new SymbolTable();
      symbolTable.addStructField("TInput", "assignedValue", "EValueId");
      CodeGenState.symbolTable = symbolTable;
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["EValueId"]),
      });
      CodeGenState.setVariableTypeInfo("input", {
        baseType: "TInput",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });

      const ctx = buildStructChainCtx("GLOBAL", "global", [
        ".input",
        ".assignedValue",
      ]);
      expect(
        EnumTypeResolver.resolve(ctx.getText(), postfixEnumThunk(ctx)),
      ).toBe("EValueId");
    });

    it("returns null when struct field is not an enum type", () => {
      const symbolTable = new SymbolTable();
      symbolTable.addStructField("TInput", "count", "u32");
      CodeGenState.symbolTable = symbolTable;
      CodeGenState.symbols = createMockSymbols();
      CodeGenState.setVariableTypeInfo("input", {
        baseType: "TInput",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });

      const ctx = buildStructChainCtx("GLOBAL", "global", [".input", ".count"]);
      expect(
        EnumTypeResolver.resolve(ctx.getText(), postfixEnumThunk(ctx)),
      ).toBeNull();
    });

    // #1445: "returns null for RelationalExpressionContext" is deleted with the
    // guard it asserted. That union arm was dead -- the only caller,
    // SwitchGenerator, passes `node.expression()` -- so the
    // `!("ternaryExpression" in ctx)` discriminator could never fire. Struct-member
    // enum resolution is covered end-to-end by tests/enum/cross-file-struct-member/.
  });

  describe("resolve() - edge cases", () => {
    it("returns null for this.Enum.MEMBER when not in a scope", () => {
      enterScope(null);
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Motor__State"]),
      });

      expect(
        EnumTypeResolver.resolve("this.State.IDLE", () => null),
      ).toBeNull();
    });

    it("returns null for this.variable when not in a scope", () => {
      enterScope(null);

      expect(EnumTypeResolver.resolve("this.current", () => null)).toBeNull();
    });

    it("returns null for unknown enum in scoped pattern", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(), // No enums
      });

      expect(
        EnumTypeResolver.resolve("Motor.State.IDLE", () => null),
      ).toBeNull();
    });

    it("returns null for single identifier that is not in type registry", () => {
      CodeGenState.symbols = createMockSymbols();

      expect(EnumTypeResolver.resolve("unknownVar", () => null)).toBeNull();
    });
  });
});
