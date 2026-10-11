import { describe, expect, it } from "vitest";
import SaturatingCast from "../SaturatingCast";

// #1760 second review: the float's C type had two spellings with opposite
// defaults; both read the one type map now, and only a float is a source
describe("SaturatingCast.floatCType", () => {
  it.each([
    ["f32", "float"],
    ["f64", "double"],
  ])("spells %s as %s", (source, cType) => {
    expect(SaturatingCast.floatCType(source)).toBe(cType);
  });

  it("refuses a source that is not a float", () => {
    expect(() => SaturatingCast.floatCType("u32")).toThrow(
      "a saturating cast's source is a float ('u32')",
    );
  });
});

// #1268 review: which side of each bound saturates is SaturationRule's, the
// rule the compile-time fold applies too
describe("SaturatingCast.expression", () => {
  it("saturates at or past the maximum and below the minimum", () => {
    const c = SaturatingCast.expression(
      "x",
      "f32",
      "u32",
      "uint32_t",
      (t, e) => `(${t})${e}`,
    );
    expect(c).toMatch(/^\(\(x\) >= \(\(float\)UINT32_MAX\) \? /);
    expect(c).toContain(" : (x) < 0.0f ? ");
  });
});
