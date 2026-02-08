/**
 * Tests for EnumTypeResolver - enum type inference from expressions
 */

import { describe, it, expect, beforeEach } from "vitest";
import EnumTypeResolver from "../EnumTypeResolver";
import CodeGenState from "../../CodeGenState";
import ICodeGenSymbols from "../../../../types/ICodeGenSymbols";

describe("EnumTypeResolver", () => {
  const createMockSymbols = (
    overrides: Partial<ICodeGenSymbols> = {},
  ): ICodeGenSymbols => ({
    knownScopes: new Set(),
    knownEnums: new Set(),
    knownBitmaps: new Set(),
    knownStructs: new Set(),
    bitmapBitWidth: new Map(),
    enumMembers: new Map(),
    structFields: new Map(),
    structFieldArrays: new Map(),
    functionReturnTypes: new Map(),
    scopeMemberVisibility: new Map(),
    scopeEnums: new Map(),
    ...overrides,
  });

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
      CodeGenState.currentScope = "Motor";
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["State"]),
        functionReturnTypes: new Map([["Motor_getState", "State"]]),
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
        functionReturnTypes: new Map([["Motor_getState", "State"]]),
      });

      const mockCtx = { getText: () => "Motor.getState()" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBe("State");
    });

    it("resolves global.Scope.method() returning enum type", () => {
      CodeGenState.symbols = createMockSymbols({
        knownScopes: new Set(["Motor"]),
        knownEnums: new Set(["State"]),
        functionReturnTypes: new Map([["Motor_getState", "State"]]),
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
      CodeGenState.typeRegistry.set("currentState", {
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
      CodeGenState.typeRegistry.set("count", {
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
        knownEnums: new Set(["Motor_State"]),
      });

      const mockCtx = { getText: () => "Motor.State.IDLE" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBe("Motor_State");
    });

    it("resolves this.Enum.MEMBER inside scope", () => {
      CodeGenState.currentScope = "Motor";
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Motor_State"]),
      });

      const mockCtx = { getText: () => "this.State.IDLE" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBe("Motor_State");
    });

    it("resolves global.Enum.MEMBER pattern", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["ECategory"]),
      });

      const mockCtx = { getText: () => "global.ECategory.CAT_A" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBe("ECategory");
    });

    it("resolves this.variable pattern for enum-typed scope member", () => {
      CodeGenState.currentScope = "Motor";
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Motor_State"]),
      });
      CodeGenState.typeRegistry.set("Motor_current", {
        baseType: "Motor_State",
        bitWidth: 0,
        isArray: false,
        isConst: false,
        isEnum: true,
        enumTypeName: "Motor_State",
      });

      const mockCtx = { getText: () => "this.current" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBe("Motor_State");
    });
  });

  describe("resolve() - edge cases", () => {
    it("returns null for this.Enum.MEMBER when not in a scope", () => {
      CodeGenState.currentScope = null;
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Motor_State"]),
      });

      const mockCtx = { getText: () => "this.State.IDLE" };
      expect(EnumTypeResolver.resolve(mockCtx as never)).toBeNull();
    });

    it("returns null for this.variable when not in a scope", () => {
      CodeGenState.currentScope = null;

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
