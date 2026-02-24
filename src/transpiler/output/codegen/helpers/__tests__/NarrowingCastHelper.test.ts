/**
 * Unit tests for NarrowingCastHelper
 * Issue #845: MISRA C:2012 Rule 10.3 compliance
 */

import { describe, it, expect, beforeEach } from "vitest";
import NarrowingCastHelper from "../NarrowingCastHelper.js";
import CodeGenState from "../../../../state/CodeGenState.js";

describe("NarrowingCastHelper", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  describe("needsCast", () => {
    it("returns false for same type", () => {
      expect(NarrowingCastHelper.needsCast("u32", "u32")).toBe(false);
      expect(NarrowingCastHelper.needsCast("u8", "u8")).toBe(false);
      expect(NarrowingCastHelper.needsCast("bool", "bool")).toBe(false);
    });

    it("returns false for widening (u8 -> u32)", () => {
      expect(NarrowingCastHelper.needsCast("u8", "u32")).toBe(false);
      expect(NarrowingCastHelper.needsCast("u16", "u32")).toBe(false);
      expect(NarrowingCastHelper.needsCast("i8", "i32")).toBe(false);
    });

    it("returns true for narrowing (u32 -> u8)", () => {
      expect(NarrowingCastHelper.needsCast("u32", "u8")).toBe(true);
      expect(NarrowingCastHelper.needsCast("u32", "u16")).toBe(true);
      expect(NarrowingCastHelper.needsCast("i32", "i8")).toBe(true);
    });

    it("returns true for int -> smaller unsigned (C promotion result)", () => {
      expect(NarrowingCastHelper.needsCast("int", "u8")).toBe(true);
      expect(NarrowingCastHelper.needsCast("int", "u16")).toBe(true);
      expect(NarrowingCastHelper.needsCast("int", "i8")).toBe(true);
    });

    it("returns true for int -> bool (different essential type)", () => {
      expect(NarrowingCastHelper.needsCast("int", "bool")).toBe(true);
      expect(NarrowingCastHelper.needsCast("u32", "bool")).toBe(true);
    });

    it("returns true for char literal type -> u8", () => {
      expect(NarrowingCastHelper.needsCast("int", "u8")).toBe(true);
    });
  });

  describe("wrap (C mode)", () => {
    beforeEach(() => {
      CodeGenState.cppMode = false;
    });

    it("returns expression unchanged for same type", () => {
      expect(NarrowingCastHelper.wrap("x", "u32", "u32")).toBe("x");
    });

    it("returns expression unchanged for widening", () => {
      expect(NarrowingCastHelper.wrap("x", "u8", "u32")).toBe("x");
    });

    it("adds C cast for narrowing u32 -> u8", () => {
      const expr = "((value >> 0U) & 0xFFU)";
      expect(NarrowingCastHelper.wrap(expr, "u32", "u8")).toBe(
        "(uint8_t)((value >> 0U) & 0xFFU)",
      );
    });

    it("adds C cast for narrowing u32 -> u16", () => {
      const expr = "((value >> 0U) & 0xFFFFU)";
      expect(NarrowingCastHelper.wrap(expr, "u32", "u16")).toBe(
        "(uint16_t)((value >> 0U) & 0xFFFFU)",
      );
    });

    it("adds C cast for int -> u8 (C promotion result)", () => {
      const expr = "((flags >> 3) & 0x7)";
      expect(NarrowingCastHelper.wrap(expr, "int", "u8")).toBe(
        "(uint8_t)((flags >> 3) & 0x7)",
      );
    });

    it("uses != 0U comparison for bool target (MISRA 10.5)", () => {
      const expr = "((flags >> 0) & 1)";
      expect(NarrowingCastHelper.wrap(expr, "int", "bool")).toBe(
        "((((flags >> 0) & 1)) != 0U)",
      );
    });

    it("adds cast for char literal to u8", () => {
      expect(NarrowingCastHelper.wrap("'A'", "int", "u8")).toBe("(uint8_t)'A'");
    });
  });

  describe("wrap (C++ mode)", () => {
    beforeEach(() => {
      CodeGenState.cppMode = true;
    });

    it("uses static_cast for narrowing", () => {
      const expr = "((value >> 0U) & 0xFFU)";
      expect(NarrowingCastHelper.wrap(expr, "u32", "u8")).toBe(
        "static_cast<uint8_t>(((value >> 0U) & 0xFFU))",
      );
    });

    it("uses != 0U for bool (same as C mode)", () => {
      const expr = "((flags >> 0) & 1)";
      expect(NarrowingCastHelper.wrap(expr, "int", "bool")).toBe(
        "((((flags >> 0) & 1)) != 0U)",
      );
    });
  });

  describe("getPromotedType", () => {
    it("returns 'int' for u8 (promoted)", () => {
      expect(NarrowingCastHelper.getPromotedType("u8")).toBe("int");
    });

    it("returns 'int' for i8 (promoted)", () => {
      expect(NarrowingCastHelper.getPromotedType("i8")).toBe("int");
    });

    it("returns 'int' for u16 (promoted)", () => {
      expect(NarrowingCastHelper.getPromotedType("u16")).toBe("int");
    });

    it("returns 'int' for i16 (promoted)", () => {
      expect(NarrowingCastHelper.getPromotedType("i16")).toBe("int");
    });

    it("returns same type for u32 (no promotion)", () => {
      expect(NarrowingCastHelper.getPromotedType("u32")).toBe("u32");
    });

    it("returns same type for i32 (no promotion)", () => {
      expect(NarrowingCastHelper.getPromotedType("i32")).toBe("i32");
    });

    it("returns same type for u64 (no promotion)", () => {
      expect(NarrowingCastHelper.getPromotedType("u64")).toBe("u64");
    });

    it("returns same type for i64 (no promotion)", () => {
      expect(NarrowingCastHelper.getPromotedType("i64")).toBe("i64");
    });

    it("returns 'int' for bool (promoted)", () => {
      expect(NarrowingCastHelper.getPromotedType("bool")).toBe("int");
    });

    it("returns same type for unknown types (conservative)", () => {
      expect(NarrowingCastHelper.getPromotedType("custom_type")).toBe(
        "custom_type",
      );
    });
  });
});
