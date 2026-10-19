import { describe, it, expect } from "vitest";
import AtomicOperandType from "../AtomicOperandType";

const U8 = { typeName: "u8", cType: "uint8_t", bits: 8 };
const U32 = { typeName: "u32", cType: "uint32_t", bits: 32 };
const F32 = { typeName: "f32", cType: "float", bits: 32 };
const HEADER = { typeName: null, cType: "int_fast16_t", bits: 16 };

describe("AtomicOperandType.ofCompound", () => {
  // #2120 review 2: the temporary must not narrow before the clamp helper
  it("holds a saturating value in the helper's wider type", () => {
    expect(AtomicOperandType.ofCompound(U8, "u8", "u32")).toBe("uint32_t");
  });

  it("keeps a wider float value's precision", () => {
    expect(AtomicOperandType.ofCompound(F32, null, "f64")).toBe("double");
  });

  it("holds a wrapping integer value in the atomic's type", () => {
    expect(AtomicOperandType.ofCompound(U8, null, "u32")).toBe("uint8_t");
  });

  it("holds a C header type's value in its C type", () => {
    expect(AtomicOperandType.ofCompound(HEADER, null, "u32")).toBe(
      "int_fast16_t",
    );
  });
});

describe("AtomicOperandType.ofBits", () => {
  it("holds one bit in a bool", () => {
    expect(AtomicOperandType.ofBits(U32, true, false, "uint32_t")).toBe("bool");
  });

  it("holds a float's bits in its bits' unsigned integer", () => {
    expect(AtomicOperandType.ofBits(F32, false, true, "uint8_t")).toBe(
      "uint32_t",
    );
  });

  // #2155 review 8: `c[0, 4] <- x` with `x: u32` on an `atomic i8` writes
  // `x` unconverted inline, so the hoisted value is not narrowed to `int8_t`
  it("keeps wider bits in the value's own C type", () => {
    expect(
      AtomicOperandType.ofBits(
        { typeName: "i8", cType: "int8_t", bits: 8 },
        false,
        false,
        "uint32_t",
      ),
    ).toBe("uint32_t");
  });

  it("falls back to the atomic's C type for a value with none", () => {
    expect(AtomicOperandType.ofBits(U8, false, false, null)).toBe("uint8_t");
  });
});
