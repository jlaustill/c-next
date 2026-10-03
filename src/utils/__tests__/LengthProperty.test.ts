import { describe, expect, it } from "vitest";
import LengthProperty from "../LengthProperty";
import TTypeUtils from "../TTypeUtils";
import type IElementWidthFacts from "../types/IElementWidthFacts";

const NO_FACTS: IElementWidthFacts = {
  enumBitWidth: () => null,
  isEnum: () => false,
  bitmapBitWidth: () => null,
};

describe("LengthProperty (ADR-058, #1175)", () => {
  it.each<[string, (number | string)[], number | null, number | null]>([
    ["element_count", [4], 8, 4],
    ["element_count", [3, 7], 8, 3],
    ["bit_length", [4], 16, 64],
    ["byte_length", [4], 16, 8],
    ["byte_length", [2, 3], 8, 6],
    ["bit_length", [], 32, 32],
    // a dimension only C knows, or none settled, has no value here
    ["element_count", ["BUF_SIZE"], 8, null],
    ["byte_length", [4, "BUF_SIZE"], 8, null],
    ["byte_length", [0], 8, null],
    ["byte_length", [4], null, null],
  ])("%s of %j at %s bits is %s", (property, dims, bits, expected) => {
    expect(LengthProperty.of(property, dims, bits)).toBe(expected);
  });

  it("knows its own property names, and no others", () => {
    expect(LengthProperty.isLength("element_count")).toBe(true);
    expect(LengthProperty.isLength("byte_length")).toBe(true);
    expect(LengthProperty.isLength("char_count")).toBe(false);
  });

  it("measures a string by its whole buffer", () => {
    expect(LengthProperty.stringElementBits(15)).toBe(128);
  });

  it.each([
    ["a primitive", TTypeUtils.createPrimitive("u16"), 16],
    ["an enum: ADR-017's 32 bits", TTypeUtils.createEnum("EColor"), 32],
    ["a string, its buffer", TTypeUtils.createString(7), 64],
    [
      "a struct, whose width C-Next does not fix",
      TTypeUtils.createStruct("P"),
      null,
    ],
  ])("a declared %s is %s bits wide", (_label, type, expected) => {
    expect(LengthProperty.elementBitsOfType(type)).toBe(expected);
  });

  it("asks the facts for an enum's and a bitmap's width, after the primitives", () => {
    const facts: IElementWidthFacts = {
      enumBitWidth: (name) => (name === "motor_mode_t" ? 8 : null),
      isEnum: (name) => name === "EMode",
      bitmapBitWidth: (name) => (name === "Flags" ? 16 : null),
    };
    expect(LengthProperty.elementBits("u32", facts)).toBe(32);
    expect(LengthProperty.elementBits("motor_mode_t", facts)).toBe(8);
    expect(LengthProperty.elementBits("EMode", facts)).toBe(32);
    expect(LengthProperty.elementBits("Flags", facts)).toBe(16);
    expect(LengthProperty.elementBits("uint8_t", NO_FACTS)).toBeNull();
  });
});
