/**
 * Tests for EnumTypeResolver - enum type inference from expressions
 */

import { describe, it, expect, beforeEach } from "vitest";
import EnumTypeResolver from "../EnumTypeResolver";
import CodeGenState from "../../../../state/CodeGenState";
import SymbolTable from "../../../../logic/symbols/SymbolTable";
import createMockSymbols from "../../../../__tests__/codeGenSymbolsHelpers";

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

      const mockCtx = { getText: () => "getState()" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBe("State");
    });

    it("resolves this.method() returning enum type", () => {
      CodeGenState.setCurrentScopeByPath("Motor");
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["State"]),
        functionReturnTypes: new Map([["Motor__getState", "State"]]),
      });

      const mockCtx = { getText: () => "this.getState()" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBe("State");
    });

    it("resolves global.func() returning enum type", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["State"]),
        functionReturnTypes: new Map([["getGlobalState", "State"]]),
      });

      const mockCtx = { getText: () => "global.getGlobalState()" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBe("State");
    });

    it("resolves Scope.method() returning enum type", () => {
      CodeGenState.symbols = createMockSymbols({
        knownScopes: new Set(["Motor"]),
        knownEnums: new Set(["State"]),
        functionReturnTypes: new Map([["Motor__getState", "State"]]),
      });

      const mockCtx = { getText: () => "Motor.getState()" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBe("State");
    });

    it("resolves global.Scope.method() returning enum type", () => {
      CodeGenState.symbols = createMockSymbols({
        knownScopes: new Set(["Motor"]),
        knownEnums: new Set(["State"]),
        functionReturnTypes: new Map([["Motor__getState", "State"]]),
      });

      const mockCtx = { getText: () => "global.Motor.getState()" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBe("State");
    });

    it("returns null for function returning non-enum type", () => {
      CodeGenState.symbols = createMockSymbols({
        functionReturnTypes: new Map([["getValue", "u32"]]),
      });

      const mockCtx = { getText: () => "getValue()" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBeNull();
    });

    it("returns null for unknown function", () => {
      CodeGenState.symbols = createMockSymbols();

      const mockCtx = { getText: () => "unknownFunc()" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBeNull();
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

      const mockCtx = { getText: () => "currentState" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBe("State");
    });

    it("returns null for non-enum variable", () => {
      CodeGenState.setVariableTypeInfo("count", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });

      const mockCtx = { getText: () => "count" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBeNull();
    });
  });

  describe("resolve() - member access patterns", () => {
    it("resolves simple enum member access: State.IDLE", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["State"]),
      });

      const mockCtx = { getText: () => "State.IDLE" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBe("State");
    });

    it("resolves scoped enum: Motor.State.IDLE -> Motor_State", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Motor__State"]),
      });

      const mockCtx = { getText: () => "Motor.State.IDLE" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBe("Motor__State");
    });

    it("resolves this.Enum.MEMBER inside scope", () => {
      CodeGenState.setCurrentScopeByPath("Motor");
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Motor__State"]),
      });

      const mockCtx = { getText: () => "this.State.IDLE" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBe("Motor__State");
    });

    it("resolves global.Enum.MEMBER pattern", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["ECategory"]),
      });

      const mockCtx = { getText: () => "global.ECategory.CAT_A" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBe("ECategory");
    });

    it("resolves this.variable pattern for enum-typed scope member", () => {
      CodeGenState.setCurrentScopeByPath("Motor");
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

      const mockCtx = { getText: () => "this.current" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBe("Motor__State");
    });
  });

  describe("resolve() - TypeResolver fallback for struct member chains", () => {
    /**
     * Helper to build a mock ExpressionContext that contains a full postfix
     * expression tree: global.input.assignedValue
     */
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

      return {
        getText: () => primaryText + suffixes.join(""),
        ternaryExpression: () => ternary,
      } as never;
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
      expect(EnumTypeResolver.resolve(ctx)).toBe("EValueId");
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
      expect(EnumTypeResolver.resolve(ctx)).toBeNull();
    });

    it("returns null for RelationalExpressionContext (no ternaryExpression)", () => {
      CodeGenState.symbols = createMockSymbols();
      // RelationalExpressionContext doesn't have ternaryExpression
      const ctx = { getText: () => "something.weird" } as never;
      expect(EnumTypeResolver.resolve(ctx)).toBeNull();
    });
  });

  describe("resolve() - edge cases", () => {
    it("returns null for this.Enum.MEMBER when not in a scope", () => {
      CodeGenState.setCurrentScopeByPath(null);
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Motor__State"]),
      });

      const mockCtx = { getText: () => "this.State.IDLE" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBeNull();
    });

    it("returns null for this.variable when not in a scope", () => {
      CodeGenState.setCurrentScopeByPath(null);

      const mockCtx = { getText: () => "this.current" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBeNull();
    });

    it("returns null for unknown enum in scoped pattern", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(), // No enums
      });

      const mockCtx = { getText: () => "Motor.State.IDLE" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBeNull();
    });

    it("returns null for single identifier that is not in type registry", () => {
      CodeGenState.symbols = createMockSymbols();

      const mockCtx = { getText: () => "unknownVar" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBeNull();
    });
  });
});
