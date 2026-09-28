import { describe, it, expect } from "vitest";
import BitUtils from "../BitUtils";

// ========================================================================
// boolToInt
// ========================================================================
describe("BitUtils.boolToInt", () => {
  it("converts literal true to 1U (MISRA 10.1 compliance)", () => {
    expect(BitUtils.boolToInt("true")).toBe("1U");
  });

  it("converts literal false to 0U (MISRA 10.1 compliance)", () => {
    expect(BitUtils.boolToInt("false")).toBe("0U");
  });

  it("wraps comparison expressions in ternary with unsigned values", () => {
    expect(BitUtils.boolToInt("x > 5")).toBe("(x > 5 ? 1U : 0U)");
  });

  it("wraps variable expressions in ternary with unsigned values", () => {
    expect(BitUtils.boolToInt("isEnabled")).toBe("(isEnabled ? 1U : 0U)");
  });

  it("wraps complex expressions in ternary with unsigned values", () => {
    expect(BitUtils.boolToInt("a && b")).toBe("(a && b ? 1U : 0U)");
  });

  it("wraps function calls in ternary with unsigned values", () => {
    expect(BitUtils.boolToInt("isReady()")).toBe("(isReady() ? 1U : 0U)");
  });
});

// ========================================================================
// maskHex
// ========================================================================
describe("BitUtils.maskHex", () => {
  // A constant width is written as its value, so no mask is ever computed by
  // a shift that could overflow the type it is done in
  it.each([
    [0, "0x0U"],
    [1, "0x1U"],
    [4, "0xFU"],
    [8, "0xFFU"],
    [12, "0xFFFU"],
    [16, "0xFFFFU"],
    [24, "0xFFFFFFU"],
    [31, "0x7FFFFFFFU"],
    [32, "0xFFFFFFFFU"],
    [40, "0xFFFFFFFFFFU"],
    [64, "0xFFFFFFFFFFFFFFFFU"],
  ])("writes width %i as %s", (width, hex) => {
    expect(BitUtils.maskHex(width)).toBe(hex);
  });
});

// ========================================================================
// generateMask
// ========================================================================
describe("BitUtils.generateMask", () => {
  it.each([
    [8, undefined, "0xFFU"],
    ["8", undefined, "0xFFU"],
    // A width folded from a const carries MISRA's suffix
    ["24U", undefined, "0xFFFFFFU"],
    ["4U", "uint64_t", "0xFU"],
  ])("writes constant width %s as a literal", (width, storage, mask) => {
    expect(BitUtils.generateMask(width, storage)).toBe(mask);
  });

  it.each([
    [undefined, "((1U << width) - 1U)"],
    // `unsigned int` holds a 16-bit storage's widths on every target
    ["uint16_t", "((1U << width) - 1U)"],
    ["uint32_t", "(((uint32_t)1U << width) - 1U)"],
    ["int32_t", "(((uint32_t)1U << width) - 1U)"],
    ["uint64_t", "(((uint64_t)1U << width) - 1U)"],
  ])("computes a run-time width in %s's width", (storage, mask) => {
    expect(BitUtils.generateMask("width", storage)).toBe(mask);
  });

  it("computes a width that only starts with digits, rather than reading its prefix", () => {
    expect(BitUtils.generateMask("4 + n", "uint32_t")).toBe(
      "(((uint32_t)1U << 4 + n) - 1U)",
    );
  });
});

// ========================================================================
// singleBitWrite
// ========================================================================
describe("BitUtils.singleBitWrite", () => {
  it.each([
    ["true", "flags = (flags & ~(1U << 0)) | (1U << 0);"],
    ["false", "flags = (flags & ~(1U << 0)) | (0U << 0);"],
    ["x > 5", "flags = (flags & ~(1U << 0)) | ((x > 5 ? 1U : 0U) << 0);"],
  ])("writes %s into storage of unknown type", (value, code) => {
    expect(BitUtils.singleBitWrite("flags", 0, value)).toBe(code);
  });

  it.each([
    ["uint8_t", "b = (uint8_t)((b & ~(1U << 7)) | (1U << 7));"],
    ["int16_t", "b = (int16_t)((b & ~(1U << 7)) | (1U << 7));"],
  ])(
    "casts %s storage back to its type (MISRA C:2012 Rule 10.3)",
    (storage, code) => {
      expect(BitUtils.singleBitWrite("b", 7, "true", storage)).toBe(code);
    },
  );

  it("shifts in the storage's width even at a low offset (#1668)", () => {
    // Where `unsigned int` is 16 bits, `~(1U << 3)` is 0xFFF7: the AND
    // would clear bits 16-31 of the storage, with nothing to warn about
    expect(BitUtils.singleBitWrite("w", 3, "true", "uint32_t")).toBe(
      "w = (w & ~((uint32_t)1U << 3)) | ((uint32_t)1U << 3);",
    );
  });

  it("shifts a signed storage's bit in its unsigned width", () => {
    expect(BitUtils.singleBitWrite("w", 31, "isSet", "int32_t")).toBe(
      "w = (w & ~((uint32_t)1U << 31)) | ((uint32_t)(isSet ? 1U : 0U) << 31);",
    );
  });

  it("shifts a 64-bit storage's bit in 64 bits", () => {
    expect(BitUtils.singleBitWrite("q", 48, "false", "uint64_t")).toBe(
      "q = (q & ~((uint64_t)1U << 48)) | ((uint64_t)0U << 48);",
    );
  });

  it("keeps a run-time offset as written", () => {
    expect(BitUtils.singleBitWrite("byte", "n", "true")).toBe(
      "byte = (byte & ~(1U << n)) | (1U << n);",
    );
  });
});

// ========================================================================
// multiBitWrite
// ========================================================================
describe("BitUtils.multiBitWrite", () => {
  it("writes a constant width's mask as a literal", () => {
    expect(BitUtils.multiBitWrite("reg", 0, 4, "0x0F")).toBe(
      "reg = (reg & ~(0xFU << 0)) | ((0x0F & 0xFU) << 0);",
    );
  });

  it("casts 16-bit storage back to its type", () => {
    expect(BitUtils.multiBitWrite("s", 12, 4, "n", "uint16_t")).toBe(
      "s = (uint16_t)((s & ~(0xFU << 12)) | ((n & 0xFU) << 12));",
    );
  });

  it("widens the mask for 32-bit storage, which widens the value it masks (#1668)", () => {
    expect(BitUtils.multiBitWrite("word", 8, 8, "value", "uint32_t")).toBe(
      "word = (word & ~((uint32_t)0xFFU << 8)) | ((value & (uint32_t)0xFFU) << 8);",
    );
  });

  it("widens the mask for 64-bit storage", () => {
    expect(BitUtils.multiBitWrite("q", 32, 16, "0xABCD", "uint64_t")).toBe(
      "q = (q & ~((uint64_t)0xFFFFU << 32)) | ((0xABCD & (uint64_t)0xFFFFU) << 32);",
    );
  });

  it("computes a run-time width's mask once, in the storage's width", () => {
    expect(BitUtils.multiBitWrite("d", 0, "width", "bits", "uint32_t")).toBe(
      "d = (d & ~((((uint32_t)1U << width) - 1U) << 0)) | ((bits & (((uint32_t)1U << width) - 1U)) << 0);",
    );
  });

  it("keeps a run-time offset as written", () => {
    expect(BitUtils.multiBitWrite("reg", "start", 8, "val")).toBe(
      "reg = (reg & ~(0xFFU << start)) | ((val & 0xFFU) << start);",
    );
  });
});

// ========================================================================
// writeOnlySingleBit
// ========================================================================
describe("BitUtils.writeOnlySingleBit", () => {
  it("writes a one without reading the target", () => {
    expect(BitUtils.writeOnlySingleBit("SET", 0, "true")).toBe(
      "SET = (1U << 0);",
    );
  });

  it("writes the value it is given, not a one (#1775)", () => {
    expect(BitUtils.writeOnlySingleBit("SET", 5, "on", "uint32_t")).toBe(
      "SET = ((uint32_t)(on ? 1U : 0U) << 5);",
    );
  });

  it("casts 8-bit storage back to its type, in the parentheses that group it", () => {
    expect(BitUtils.writeOnlySingleBit("CMD", 1, "go", "uint8_t")).toBe(
      "CMD = (uint8_t)((go ? 1U : 0U) << 1);",
    );
  });
});

// ========================================================================
// writeOnlyMultiBit
// ========================================================================
describe("BitUtils.writeOnlyMultiBit", () => {
  it("writes the masked value without reading the target", () => {
    expect(BitUtils.writeOnlyMultiBit("DATA", 0, 4, "value")).toBe(
      "DATA = ((value & 0xFU) << 0);",
    );
  });

  it("widens the mask for 32-bit storage", () => {
    expect(BitUtils.writeOnlyMultiBit("WORD", 8, 8, "byte", "uint32_t")).toBe(
      "WORD = ((byte & (uint32_t)0xFFU) << 8);",
    );
  });

  it("casts 8-bit storage back to its type", () => {
    expect(BitUtils.writeOnlyMultiBit("R", 1, 3, "v", "uint8_t")).toBe(
      "R = (uint8_t)((v & 0x7U) << 1);",
    );
  });

  it("computes a run-time width's mask in the storage's width", () => {
    expect(
      BitUtils.writeOnlyMultiBit("R", "start", "n", "bits", "uint32_t"),
    ).toBe("R = ((bits & (((uint32_t)1U << n) - 1U)) << start);");
  });
});
