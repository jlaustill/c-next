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
});
