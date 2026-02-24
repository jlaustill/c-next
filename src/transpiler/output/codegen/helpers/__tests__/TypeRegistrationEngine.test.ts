/**
 * Unit tests for TypeRegistrationEngine
 * Issue #791: Tests for extracted type registration logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import TypeRegistrationEngine from "../TypeRegistrationEngine";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser";
import CodeGenState from "../../../../state/CodeGenState";
import ICodeGenSymbols from "../../../../types/ICodeGenSymbols";
import * as Parser from "../../../../logic/parser/grammar/CNextParser";

/**
 * Create a minimal mock ICodeGenSymbols with default empty collections.
 */
function createMockSymbols(): ICodeGenSymbols {
  return {
    knownScopes: new Set(),
    knownEnums: new Set(),
    knownBitmaps: new Set(),
    knownStructs: new Set(),
    knownRegisters: new Set(),
    scopeMembers: new Map(),
    scopeMemberVisibility: new Map(),
    structFields: new Map(),
    structFieldArrays: new Map(),
    structFieldDimensions: new Map(),
    enumMembers: new Map(),
    bitmapFields: new Map(),
    bitmapBackingType: new Map(),
    bitmapBitWidth: new Map(),
    scopedRegisters: new Map(),
    registerMemberAccess: new Map(),
    registerMemberTypes: new Map(),
    registerBaseAddresses: new Map(),
    registerMemberOffsets: new Map(),
    registerMemberCTypes: new Map(),
    scopeVariableUsage: new Map(),
    scopePrivateConstValues: new Map(),
    functionReturnTypes: new Map(),
    getSingleFunctionForVariable: () => null,
    opaqueTypes: new Set(),
    hasPublicSymbols: () => false,
  };
}

/**
 * Helper to parse a variable declaration and get its arrayType context
 */
function parseArrayType(source: string): Parser.ArrayTypeContext | null {
  const tree = CNextSourceParser.parse(source).tree;
  const decl = tree.declaration(0)?.variableDeclaration();
  return decl?.type()?.arrayType() ?? null;
}

/**
 * Helper to parse a variable declaration and get its type context
 */
function parseTypeContext(source: string): Parser.TypeContext | null {
  const tree = CNextSourceParser.parse(source).tree;
  const decl = tree.declaration(0)?.variableDeclaration();
  return decl?.type() ?? null;
}

describe("TypeRegistrationEngine", () => {
  describe("parseArrayTypeDimension", () => {
    it("returns number for integer literal dimension", () => {
      const ctx = parseArrayType("u8[10] buffer;");
      expect(ctx).not.toBeNull();
      const result = TypeRegistrationEngine.parseArrayTypeDimension(ctx!);
      expect(result).toBe(10);
    });

    it("returns undefined for empty dimension", () => {
      const ctx = parseArrayType("u8[] buffer;");
      expect(ctx).not.toBeNull();
      const result = TypeRegistrationEngine.parseArrayTypeDimension(ctx!);
      expect(result).toBeUndefined();
    });

    it("returns undefined for non-numeric dimension", () => {
      const ctx = parseArrayType("u8[SIZE] buffer;");
      expect(ctx).not.toBeNull();
      const result = TypeRegistrationEngine.parseArrayTypeDimension(ctx!);
      expect(result).toBeUndefined();
    });
  });

  describe("resolveBaseType", () => {
    it("resolves primitive types", () => {
      const ctx = parseTypeContext("u32 counter;");
      expect(ctx).not.toBeNull();
      const result = TypeRegistrationEngine.resolveBaseType(ctx!, null);
      expect(result).toBe("u32");
    });

    it("resolves scoped types with currentScope", () => {
      const ctx = parseTypeContext("this.State value;");
      expect(ctx).not.toBeNull();
      const result = TypeRegistrationEngine.resolveBaseType(ctx!, "Motor");
      expect(result).toBe("Motor_State");
    });

    it("resolves scoped types without currentScope", () => {
      const ctx = parseTypeContext("this.State value;");
      expect(ctx).not.toBeNull();
      const result = TypeRegistrationEngine.resolveBaseType(ctx!, null);
      expect(result).toBe("State");
    });

    it("resolves user types", () => {
      const ctx = parseTypeContext("Point origin;");
      expect(ctx).not.toBeNull();
      const result = TypeRegistrationEngine.resolveBaseType(ctx!, null);
      expect(result).toBe("Point");
    });

    it("resolves global types", () => {
      const ctx = parseTypeContext("global.Config cfg;");
      expect(ctx).not.toBeNull();
      const result = TypeRegistrationEngine.resolveBaseType(ctx!, "Motor");
      expect(result).toBe("Config");
    });

    it("resolves qualified types", () => {
      const ctx = parseTypeContext("Motor.State state;");
      expect(ctx).not.toBeNull();
      const result = TypeRegistrationEngine.resolveBaseType(ctx!, null);
      expect(result).toBe("Motor_State");
    });

    it("returns null for string types", () => {
      const ctx = parseTypeContext("string<64> buffer;");
      expect(ctx).not.toBeNull();
      const result = TypeRegistrationEngine.resolveBaseType(ctx!, null);
      expect(result).toBeNull();
    });
  });

  describe("register orchestration", () => {
    const mockCallbacks = {
      tryEvaluateConstant: vi.fn(),
      requireInclude: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
      CodeGenState.reset();
      CodeGenState.symbols = createMockSymbols();
    });

    afterEach(() => {
      CodeGenState.reset();
    });

    it("registers global variable types", () => {
      const source = `u32 counter;`;
      const tree = CNextSourceParser.parse(source).tree;

      TypeRegistrationEngine.register(tree, mockCallbacks);

      const info = CodeGenState.getVariableTypeInfo("counter");
      expect(info).not.toBeNull();
      expect(info?.baseType).toBe("u32");
      expect(info?.bitWidth).toBe(32);
    });

    it("tracks const values", () => {
      mockCallbacks.tryEvaluateConstant.mockReturnValue(10);
      const source = `const u32 SIZE <- 10;`;
      const tree = CNextSourceParser.parse(source).tree;

      TypeRegistrationEngine.register(tree, mockCallbacks);

      expect(CodeGenState.constValues.get("SIZE")).toBe(10);
    });

    it("requires string include for string types", () => {
      const source = `string<64> message;`;
      const tree = CNextSourceParser.parse(source).tree;

      TypeRegistrationEngine.register(tree, mockCallbacks);

      expect(mockCallbacks.requireInclude).toHaveBeenCalledWith("string");
    });
  });
});
