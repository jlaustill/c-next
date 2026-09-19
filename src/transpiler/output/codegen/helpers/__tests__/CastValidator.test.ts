/**
 * Unit tests for CastValidator
 * Issue #632: Float-to-integer clamping
 *
 * #1450 deleted the six type predicates and `getTypeWidth` this file used to
 * exercise. They had no production caller -- these tests were their only
 * readers, which is exactly what made them invisible to knip (#1418) -- and
 * each was also declared on `TypeResolver` under the same name, with two of
 * the pairs disagreeing. Nothing here covered a decision the transpiler makes.
 */

import { describe, it, expect } from "vitest";
import CastValidator from "../CastValidator.js";

describe("CastValidator", () => {
  describe("requiresClampingCast", () => {
    it("returns true for float-to-integer", () => {
      expect(CastValidator.requiresClampingCast("f32", "i32")).toBe(true);
      expect(CastValidator.requiresClampingCast("f64", "u8")).toBe(true);
      expect(CastValidator.requiresClampingCast("f32", "i64")).toBe(true);
    });

    it("returns false for integer-to-integer", () => {
      expect(CastValidator.requiresClampingCast("i32", "i64")).toBe(false);
      expect(CastValidator.requiresClampingCast("u8", "u32")).toBe(false);
    });

    it("returns false for float-to-float", () => {
      expect(CastValidator.requiresClampingCast("f32", "f64")).toBe(false);
      expect(CastValidator.requiresClampingCast("f64", "f32")).toBe(false);
    });

    it("returns false for integer-to-float", () => {
      expect(CastValidator.requiresClampingCast("i32", "f32")).toBe(false);
      expect(CastValidator.requiresClampingCast("u64", "f64")).toBe(false);
    });

    it("returns false for null source type", () => {
      expect(CastValidator.requiresClampingCast(null, "i32")).toBe(false);
    });

    it("returns false when target is not integer", () => {
      expect(CastValidator.requiresClampingCast("f32", "bool")).toBe(false);
      expect(CastValidator.requiresClampingCast("f32", "MyType")).toBe(false);
    });
  });
});
