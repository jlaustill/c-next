import { describe, it, expect } from "vitest";
import BitUtils from "./BitUtils";

// ========================================================================
// boolToInt
// ========================================================================
describe("BitUtils.boolToInt", () => {
  it("converts literal true to 1", () => {
    expect(BitUtils.boolToInt("true")).toBe("1");
  });

  it("converts literal false to 0", () => {
    expect(BitUtils.boolToInt("false")).toBe("0");
  });

  it("wraps comparison expressions in ternary", () => {
    expect(BitUtils.boolToInt("x > 5")).toBe("(x > 5 ? 1 : 0)");
  });

  it("wraps variable expressions in ternary", () => {
    expect(BitUtils.boolToInt("isEnabled")).toBe("(isEnabled ? 1 : 0)");
  });

  it("wraps complex expressions in ternary", () => {
    expect(BitUtils.boolToInt("a && b")).toBe("(a && b ? 1 : 0)");
  });

  it("wraps function calls in ternary", () => {
    expect(BitUtils.boolToInt("isReady()")).toBe("(isReady() ? 1 : 0)");
  });
});

// ========================================================================
// maskHex
// ========================================================================
describe("BitUtils.maskHex", () => {
  it("returns 0xFFU for width 8", () => {
    expect(BitUtils.maskHex(8)).toBe("0xFFU");
  });

  it("returns 0xFFFFU for width 16", () => {
    expect(BitUtils.maskHex(16)).toBe("0xFFFFU");
  });

  it("returns 0xFFFFFFFFU for width 32", () => {
    expect(BitUtils.maskHex(32)).toBe("0xFFFFFFFFU");
  });

  it("returns 0xFFFFFFFFFFFFFFFFULL for width 64", () => {
    expect(BitUtils.maskHex(64)).toBe("0xFFFFFFFFFFFFFFFFULL");
  });

  it("returns null for width 1", () => {
    expect(BitUtils.maskHex(1)).toBeNull();
  });

  it("returns null for width 4", () => {
    expect(BitUtils.maskHex(4)).toBeNull();
  });

  it("returns null for width 24", () => {
    expect(BitUtils.maskHex(24)).toBeNull();
  });

  it("returns null for width 0", () => {
    expect(BitUtils.maskHex(0)).toBeNull();
  });
});

// ========================================================================
// oneForType
// ========================================================================
describe("BitUtils.oneForType", () => {
  it("returns 1ULL for u64", () => {
    expect(BitUtils.oneForType("u64")).toBe("1ULL");
  });

  it("returns 1ULL for i64", () => {
    expect(BitUtils.oneForType("i64")).toBe("1ULL");
  });

  it("returns 1 for u32", () => {
    expect(BitUtils.oneForType("u32")).toBe("1");
  });

  it("returns 1 for i32", () => {
    expect(BitUtils.oneForType("i32")).toBe("1");
  });

  it("returns 1 for u8", () => {
    expect(BitUtils.oneForType("u8")).toBe("1");
  });

  it("returns 1 for unknown types", () => {
    expect(BitUtils.oneForType("custom")).toBe("1");
  });
});

// ========================================================================
// formatHex
// ========================================================================
describe("BitUtils.formatHex", () => {
  it("formats 255 as 0xFF", () => {
    expect(BitUtils.formatHex(255)).toBe("0xFF");
  });

  it("formats 31 as 0x1F", () => {
    expect(BitUtils.formatHex(31)).toBe("0x1F");
  });

  it("formats 0 as 0x0", () => {
    expect(BitUtils.formatHex(0)).toBe("0x0");
  });

  it("formats 65535 as 0xFFFF", () => {
    expect(BitUtils.formatHex(65535)).toBe("0xFFFF");
  });

  it("formats single digit as 0xN", () => {
    expect(BitUtils.formatHex(10)).toBe("0xA");
  });

  it("formats large values correctly", () => {
    expect(BitUtils.formatHex(0xdeadbeef)).toBe("0xDEADBEEF");
  });
});

// ========================================================================
// generateMask
// ========================================================================
describe("BitUtils.generateMask", () => {
  it("uses hex mask for width 8 (number)", () => {
    expect(BitUtils.generateMask(8)).toBe("0xFFU");
  });

  it("uses hex mask for width 8 (string)", () => {
    expect(BitUtils.generateMask("8")).toBe("0xFFU");
  });

  it("uses hex mask for width 16", () => {
    expect(BitUtils.generateMask(16)).toBe("0xFFFFU");
  });

  it("uses hex mask for width 32", () => {
    expect(BitUtils.generateMask(32)).toBe("0xFFFFFFFFU");
  });

  it("uses hex mask for width 64", () => {
    expect(BitUtils.generateMask(64)).toBe("0xFFFFFFFFFFFFFFFFULL");
  });

  it("generates shift expression for width 4", () => {
    expect(BitUtils.generateMask(4)).toBe("((1U << 4) - 1)");
  });

  it("generates shift expression for width 3 (string)", () => {
    expect(BitUtils.generateMask("3")).toBe("((1U << 3) - 1)");
  });

  it("generates shift expression for dynamic width", () => {
    expect(BitUtils.generateMask("n")).toBe("((1U << n) - 1)");
  });

  it("handles expression-based width", () => {
    expect(BitUtils.generateMask("width + 1")).toBe("((1U << width + 1) - 1)");
  });
});

// ========================================================================
// singleBitRead
// ========================================================================
describe("BitUtils.singleBitRead", () => {
  it("generates bit read at offset 0 (number)", () => {
    expect(BitUtils.singleBitRead("flags", 0)).toBe("((flags) & 1)");
  });

  it("generates bit read at offset 0 (string)", () => {
    expect(BitUtils.singleBitRead("flags", "0")).toBe("((flags) & 1)");
  });

  it("generates bit read at offset 3", () => {
    expect(BitUtils.singleBitRead("flags", 3)).toBe("((flags >> 3) & 1)");
  });

  it("generates bit read with dynamic offset", () => {
    expect(BitUtils.singleBitRead("value", "n")).toBe("((value >> n) & 1)");
  });

  it("generates bit read with expression target", () => {
    expect(BitUtils.singleBitRead("reg.STATUS", 7)).toBe(
      "((reg.STATUS >> 7) & 1)",
    );
  });

  it("generates bit read with complex offset expression", () => {
    expect(BitUtils.singleBitRead("data", "i + 1")).toBe(
      "((data >> i + 1) & 1)",
    );
  });
});

// ========================================================================
// bitRangeRead
// ========================================================================
describe("BitUtils.bitRangeRead", () => {
  it("generates range read at offset 0", () => {
    expect(BitUtils.bitRangeRead("value", 0, 4)).toBe(
      "((value) & ((1U << 4) - 1))",
    );
  });

  it("generates range read at offset 0 (string)", () => {
    expect(BitUtils.bitRangeRead("value", "0", 8)).toBe("((value) & 0xFFU)");
  });

  it("generates range read at offset 4 with width 4", () => {
    expect(BitUtils.bitRangeRead("byte", 4, 4)).toBe(
      "((byte >> 4) & ((1U << 4) - 1))",
    );
  });

  it("generates range read with width 8", () => {
    expect(BitUtils.bitRangeRead("word", 8, 8)).toBe("((word >> 8) & 0xFFU)");
  });

  it("generates range read with width 16", () => {
    expect(BitUtils.bitRangeRead("dword", 0, 16)).toBe("((dword) & 0xFFFFU)");
  });

  it("generates range read with dynamic offset", () => {
    expect(BitUtils.bitRangeRead("data", "start", 8)).toBe(
      "((data >> start) & 0xFFU)",
    );
  });

  it("generates range read with dynamic width", () => {
    expect(BitUtils.bitRangeRead("data", 0, "width")).toBe(
      "((data) & ((1U << width) - 1))",
    );
  });
});

// ========================================================================
// singleBitWrite
// ========================================================================
describe("BitUtils.singleBitWrite", () => {
  it("generates RMW for literal true", () => {
    expect(BitUtils.singleBitWrite("flags", 0, "true")).toBe(
      "flags = (flags & ~(1 << 0)) | (1 << 0);",
    );
  });

  it("generates RMW for literal false", () => {
    expect(BitUtils.singleBitWrite("flags", 3, "false")).toBe(
      "flags = (flags & ~(1 << 3)) | (0 << 3);",
    );
  });

  it("generates RMW with ternary for expression value", () => {
    expect(BitUtils.singleBitWrite("reg", 7, "isEnabled")).toBe(
      "reg = (reg & ~(1 << 7)) | ((isEnabled ? 1 : 0) << 7);",
    );
  });

  it("generates RMW with dynamic offset", () => {
    expect(BitUtils.singleBitWrite("byte", "n", "true")).toBe(
      "byte = (byte & ~(1 << n)) | (1 << n);",
    );
  });

  it("handles comparison expression as value", () => {
    expect(BitUtils.singleBitWrite("status", 0, "x > 5")).toBe(
      "status = (status & ~(1 << 0)) | ((x > 5 ? 1 : 0) << 0);",
    );
  });
});

// ========================================================================
// multiBitWrite
// ========================================================================
describe("BitUtils.multiBitWrite", () => {
  it("generates RMW with width 4", () => {
    expect(BitUtils.multiBitWrite("reg", 0, 4, "0x0F")).toBe(
      "reg = (reg & ~(((1U << 4) - 1) << 0)) | ((0x0F & ((1U << 4) - 1)) << 0);",
    );
  });

  it("generates RMW with width 8 at offset 8", () => {
    expect(BitUtils.multiBitWrite("word", 8, 8, "value")).toBe(
      "word = (word & ~(0xFFU << 8)) | ((value & 0xFFU) << 8);",
    );
  });

  it("generates RMW with width 16", () => {
    expect(BitUtils.multiBitWrite("dword", 0, 16, "data")).toBe(
      "dword = (dword & ~(0xFFFFU << 0)) | ((data & 0xFFFFU) << 0);",
    );
  });

  it("handles dynamic offset", () => {
    expect(BitUtils.multiBitWrite("reg", "start", 8, "val")).toBe(
      "reg = (reg & ~(0xFFU << start)) | ((val & 0xFFU) << start);",
    );
  });

  it("handles dynamic width", () => {
    expect(BitUtils.multiBitWrite("data", 0, "width", "bits")).toBe(
      "data = (data & ~(((1U << width) - 1) << 0)) | ((bits & ((1U << width) - 1)) << 0);",
    );
  });
});

// ========================================================================
// writeOnlySingleBit
// ========================================================================
describe("BitUtils.writeOnlySingleBit", () => {
  it("generates write-only for literal true", () => {
    expect(BitUtils.writeOnlySingleBit("SET_REG", 0, "true")).toBe(
      "SET_REG = (1 << 0);",
    );
  });

  it("generates write-only for literal false", () => {
    expect(BitUtils.writeOnlySingleBit("CLR_REG", 3, "false")).toBe(
      "CLR_REG = (0 << 3);",
    );
  });

  it("generates write-only with ternary for expression", () => {
    expect(BitUtils.writeOnlySingleBit("CTRL", 7, "isActive")).toBe(
      "CTRL = ((isActive ? 1 : 0) << 7);",
    );
  });

  it("handles dynamic offset", () => {
    expect(BitUtils.writeOnlySingleBit("PORT", "bit", "true")).toBe(
      "PORT = (1 << bit);",
    );
  });

  it("handles expression offset", () => {
    expect(BitUtils.writeOnlySingleBit("REG", "i + 1", "false")).toBe(
      "REG = (0 << i + 1);",
    );
  });
});

// ========================================================================
// writeOnlyMultiBit
// ========================================================================
describe("BitUtils.writeOnlyMultiBit", () => {
  it("generates write-only with width 4", () => {
    expect(BitUtils.writeOnlyMultiBit("DATA_REG", 0, 4, "value")).toBe(
      "DATA_REG = ((value & ((1U << 4) - 1)) << 0);",
    );
  });

  it("generates write-only with width 8 at offset 8", () => {
    expect(BitUtils.writeOnlyMultiBit("WORD_REG", 8, 8, "byte")).toBe(
      "WORD_REG = ((byte & 0xFFU) << 8);",
    );
  });

  it("generates write-only with width 16", () => {
    expect(BitUtils.writeOnlyMultiBit("OUT_REG", 0, 16, "data")).toBe(
      "OUT_REG = ((data & 0xFFFFU) << 0);",
    );
  });

  it("handles dynamic offset", () => {
    expect(BitUtils.writeOnlyMultiBit("REG", "offset", 8, "val")).toBe(
      "REG = ((val & 0xFFU) << offset);",
    );
  });

  it("handles dynamic width", () => {
    expect(BitUtils.writeOnlyMultiBit("PORT", 0, "n", "bits")).toBe(
      "PORT = ((bits & ((1U << n) - 1)) << 0);",
    );
  });

  it("handles both dynamic offset and width", () => {
    expect(BitUtils.writeOnlyMultiBit("REG", "start", "width", "data")).toBe(
      "REG = ((data & ((1U << width) - 1)) << start);",
    );
  });
});
