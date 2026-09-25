/**
 * Unit tests for CastExprGenerator.
 *
 * #1445 box 3 slice 38: the generator takes `{ targetType, targetTypeName,
 * operandCode, operandType }`, so there is no node to fake and no orchestrator
 * to stand in for the recursion.
 *
 * `targetTypeName` is the C-NEXT spelling (`u8`) and `targetType` is the C one
 * (`uint8_t`). They are separate fields because `TYPE_LIMITS` is indexed by the
 * former and the emitted cast uses the latter -- a test that passed the same
 * string for both would pass while conflating them, so every case below gives
 * them different values.
 */
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import generateCast from "../CastExprGenerator";
import RenderState from "../../../../RenderState";

const plan = (
  targetType: string,
  targetTypeName: string,
  operandCode: string,
  operandType: string | null,
) => ({ targetType, targetTypeName, operandCode, operandType });

describe("CastExprGenerator", () => {
  let state = new RenderState();

  beforeEach(() => {
    state = new RenderState();
  });

  afterEach(() => {
    state = new RenderState();
  });

  describe("plain casts", () => {
    it("renders a C cast when the source is not a float", () => {
      expect(generateCast(plan("uint8_t", "u8", "x", "u32"), state)).toBe(
        "(uint8_t)x",
      );
    });

    it("renders a C cast when the source type is unresolved", () => {
      // null means "not known to be a float", so no clamp -- the negative
      // control for the clamping cases below.
      expect(generateCast(plan("int32_t", "i32", "x", null), state)).toBe(
        "(int32_t)x",
      );
    });

    it("uses static_cast in C++ mode", () => {
      state.cppMode = true;

      expect(generateCast(plan("uint8_t", "u8", "x", "u32"), state)).toBe(
        "static_cast<uint8_t>(x)",
      );
    });
  });

  describe("float-to-integer clamping (ADR-024, Issue #632)", () => {
    it("clamps f32 to u8 against the type's limit macros", () => {
      const result = generateCast(plan("uint8_t", "u8", "f", "f32"), state);

      // (f) > MAX ? MAX : (f) < MIN ? MIN : (uint8_t)(f)
      expect(result).toBe(
        "((f) > ((float)UINT8_MAX) ? (uint8_t)UINT8_MAX : (f) < 0.0f ? (uint8_t)0 : (uint8_t)(f))",
      );
    });

    it("compares against double for an f64 source", () => {
      const result = generateCast(plan("int8_t", "i8", "d", "f64"), state);

      expect(result).toContain("((double)INT8_MAX)");
      expect(result).toContain("((double)INT8_MIN)");
    });

    it("omits the f32 literal suffix for an f64 source", () => {
      // The target must be UNSIGNED. `TYPE_MIN` is the literal "0" only for
      // unsigned types, and that is the one branch where the float suffix is
      // emitted at all -- a signed target renders `((double)INT8_MIN)` and
      // never consults it. An earlier version of this test paired f64 with
      // `i8` and asserted `not.toContain("0.0f")`, which held for a reason
      // that had nothing to do with the suffix: there was no `0.0` in the
      // output. Mutating the suffix to a constant `"f"` left it green.
      const f64 = generateCast(plan("uint16_t", "u16", "d", "f64"), state);
      const f32 = generateCast(plan("uint16_t", "u16", "x", "f32"), state);

      expect(f64).toContain("< 0.0 ?");
      expect(f64).not.toContain("0.0f");
      expect(f32).toContain("< 0.0f ?");
    });

    it("requires limits.h only when it actually clamps", () => {
      generateCast(plan("uint8_t", "u8", "x", "u32"), state);
      const afterPlain = state.needsLimits;

      generateCast(plan("uint8_t", "u8", "f", "f32"), state);

      expect(afterPlain).toBe(false);
      expect(state.needsLimits).toBe(true);
    });

    it("falls back to a raw cast for a target with no limit macros", () => {
      // Issue #644: `bool` is in INTEGER_TYPES but has no TYPE_MAX entry, so
      // the clamp cannot be built and the plain cast is the correct answer.
      expect(generateCast(plan("bool", "bool", "f", "f32"), state)).toBe(
        "(bool)f",
      );
    });
  });
});
