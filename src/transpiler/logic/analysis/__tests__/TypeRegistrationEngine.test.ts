/**
 * Unit tests for TypeRegistrationEngine
 * Issue #791: Tests for extracted type registration logic
 */

import { describe, it, expect } from "vitest";
import TypeRegistrationEngine from "../TypeRegistrationEngine";
import CNextSourceParser from "../../parser/CNextSourceParser";
import * as Parser from "../../parser/grammar/CNextParser";

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
});
