/**
 * Unit tests for CastRequirement (2.2 Plan).
 *
 * Issue #845 wrote these against `NarrowingCastHelper.needsCast`; #1450 box 4
 * moved the DECISION here and left the formatting -- `wrap` -- in 3-Render.
 * The cases are unchanged, which is the point: the answer did not move, only
 * the pass that owns it.
 */

import { describe, it, expect } from "vitest";
import CastRequirement from "../CastRequirement";

describe("CastRequirement", () => {
  describe("forConversion", () => {
    it("returns false for same type", () => {
      expect(CastRequirement.forConversion("u32", "u32")).toBe(false);
      expect(CastRequirement.forConversion("u8", "u8")).toBe(false);
      expect(CastRequirement.forConversion("bool", "bool")).toBe(false);
    });

    it("returns false for widening (u8 -> u32)", () => {
      expect(CastRequirement.forConversion("u8", "u32")).toBe(false);
      expect(CastRequirement.forConversion("u16", "u32")).toBe(false);
      expect(CastRequirement.forConversion("i8", "i32")).toBe(false);
    });

    it("returns true for narrowing (u32 -> u8)", () => {
      expect(CastRequirement.forConversion("u32", "u8")).toBe(true);
      expect(CastRequirement.forConversion("u32", "u16")).toBe(true);
      expect(CastRequirement.forConversion("i32", "i8")).toBe(true);
    });

    it("returns true for int -> smaller unsigned (C promotion result)", () => {
      expect(CastRequirement.forConversion("int", "u8")).toBe(true);
      expect(CastRequirement.forConversion("int", "u16")).toBe(true);
      expect(CastRequirement.forConversion("int", "i8")).toBe(true);
    });

    it("returns true for int -> bool (different essential type)", () => {
      expect(CastRequirement.forConversion("int", "bool")).toBe(true);
      expect(CastRequirement.forConversion("u32", "bool")).toBe(true);
    });

    it("returns true for char literal type -> u8", () => {
      expect(CastRequirement.forConversion("int", "u8")).toBe(true);
    });
  });
});
