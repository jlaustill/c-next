/**
 * Unit tests for NarrowingCastHelper
 * Issue #845: MISRA C:2012 Rule 10.3 compliance
 */

import { describe, it, expect, beforeEach } from "vitest";
import NarrowingCastHelper from "../NarrowingCastHelper";
import TranspileState from "../../../../TranspileState";

let state = new TranspileState();

describe("NarrowingCastHelper", () => {
  beforeEach(() => {
    state = new TranspileState();
  });

  describe("wrap (C mode)", () => {
    beforeEach(() => {
      state.cppMode = false;
    });

    it("returns expression unchanged for same type", () => {
      expect(NarrowingCastHelper.wrap("x", "u32", "u32", state)).toBe("x");
    });

    it("returns expression unchanged for widening", () => {
      expect(NarrowingCastHelper.wrap("x", "u8", "u32", state)).toBe("x");
    });

    it("adds C cast for narrowing u32 -> u8", () => {
      const expr = "((value >> 0U) & 0xFFU)";
      expect(NarrowingCastHelper.wrap(expr, "u32", "u8", state)).toBe(
        "(uint8_t)((value >> 0U) & 0xFFU)",
      );
    });

    it("adds C cast for narrowing u32 -> u16", () => {
      const expr = "((value >> 0U) & 0xFFFFU)";
      expect(NarrowingCastHelper.wrap(expr, "u32", "u16", state)).toBe(
        "(uint16_t)((value >> 0U) & 0xFFFFU)",
      );
    });

    it("adds C cast for int -> u8 (C promotion result)", () => {
      const expr = "((flags >> 3) & 0x7)";
      expect(NarrowingCastHelper.wrap(expr, "int", "u8", state)).toBe(
        "(uint8_t)((flags >> 3) & 0x7)",
      );
    });

    it("uses != 0U comparison for bool target (MISRA 10.5)", () => {
      const expr = "((flags >> 0) & 1)";
      expect(NarrowingCastHelper.wrap(expr, "int", "bool", state)).toBe(
        "((((flags >> 0) & 1)) != 0U)",
      );
    });

    it("adds cast for char literal to u8", () => {
      expect(NarrowingCastHelper.wrap("'A'", "int", "u8", state)).toBe(
        "(uint8_t)'A'",
      );
    });
  });

  describe("wrap (C++ mode)", () => {
    beforeEach(() => {
      state.cppMode = true;
    });

    it("uses static_cast for narrowing", () => {
      const expr = "((value >> 0U) & 0xFFU)";
      expect(NarrowingCastHelper.wrap(expr, "u32", "u8", state)).toBe(
        "static_cast<uint8_t>(((value >> 0U) & 0xFFU))",
      );
    });

    it("uses != 0U for bool (same as C mode)", () => {
      const expr = "((flags >> 0) & 1)";
      expect(NarrowingCastHelper.wrap(expr, "int", "bool", state)).toBe(
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
