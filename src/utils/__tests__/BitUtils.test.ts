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

  // 64-bit target tests (is64Bit parameter)
  it("returns 0xFFULL for width 8 with is64Bit=true", () => {
    expect(BitUtils.maskHex(8, true)).toBe("0xFFULL");
  });

  it("returns 0xFFFFULL for width 16 with is64Bit=true", () => {
    expect(BitUtils.maskHex(16, true)).toBe("0xFFFFULL");
  });

  it("returns 0xFFFFFFFFULL for width 32 with is64Bit=true", () => {
    expect(BitUtils.maskHex(32, true)).toBe("0xFFFFFFFFULL");
  });

  it("returns 0xFFFFFFFFFFFFFFFFULL for width 64 with is64Bit=true", () => {
    expect(BitUtils.maskHex(64, true)).toBe("0xFFFFFFFFFFFFFFFFULL");
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

  it("returns 1U for u32 (MISRA 10.1 compliance)", () => {
    expect(BitUtils.oneForType("u32")).toBe("1U");
  });

  it("returns 1U for i32 (MISRA 10.1 compliance)", () => {
    expect(BitUtils.oneForType("i32")).toBe("1U");
  });

  it("returns 1U for u8 (MISRA 10.1 compliance)", () => {
    expect(BitUtils.oneForType("u8")).toBe("1U");
  });

  it("returns 1U for unknown types (MISRA 10.1 compliance)", () => {
    expect(BitUtils.oneForType("custom")).toBe("1U");
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

  // 64-bit target tests (targetType parameter)
  it("uses ULL hex mask for width 8 with u64 target", () => {
    expect(BitUtils.generateMask(8, "u64")).toBe("0xFFULL");
  });

  it("uses ULL hex mask for width 16 with u64 target", () => {
    expect(BitUtils.generateMask(16, "u64")).toBe("0xFFFFULL");
  });

  it("uses ULL hex mask for width 32 with u64 target", () => {
    expect(BitUtils.generateMask(32, "u64")).toBe("0xFFFFFFFFULL");
  });

  it("uses ULL hex mask for width 16 with i64 target", () => {
    expect(BitUtils.generateMask(16, "i64")).toBe("0xFFFFULL");
  });

  it("generates ULL shift expression for width 4 with u64 target", () => {
    expect(BitUtils.generateMask(4, "u64")).toBe("((1ULL << 4) - 1)");
  });

  it("generates ULL shift expression for dynamic width with u64 target", () => {
    expect(BitUtils.generateMask("n", "u64")).toBe("((1ULL << n) - 1)");
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
  it("generates RMW for literal true (MISRA 10.1 - uses 1U)", () => {
    expect(BitUtils.singleBitWrite("flags", 0, "true")).toBe(
      "flags = (flags & ~(1U << 0)) | (1U << 0);",
    );
  });

  it("generates RMW for literal false (MISRA 10.1 - uses 1U)", () => {
    expect(BitUtils.singleBitWrite("flags", 3, "false")).toBe(
      "flags = (flags & ~(1U << 3)) | (0U << 3);",
    );
  });

  it("generates RMW with ternary for expression value (MISRA 10.1)", () => {
    expect(BitUtils.singleBitWrite("reg", 7, "isEnabled")).toBe(
      "reg = (reg & ~(1U << 7)) | ((isEnabled ? 1U : 0U) << 7);",
    );
  });

  it("generates RMW with dynamic offset (MISRA 10.1 - uses 1U)", () => {
    expect(BitUtils.singleBitWrite("byte", "n", "true")).toBe(
      "byte = (byte & ~(1U << n)) | (1U << n);",
    );
  });

  it("handles comparison expression as value (MISRA 10.1)", () => {
    expect(BitUtils.singleBitWrite("status", 0, "x > 5")).toBe(
      "status = (status & ~(1U << 0)) | ((x > 5 ? 1U : 0U) << 0);",
    );
  });

  // 64-bit target tests (targetType parameter)
  it("generates 64-bit RMW for u64 target at high position", () => {
    expect(BitUtils.singleBitWrite("val64", 32, "true", "u64")).toBe(
      "val64 = (val64 & ~(1ULL << 32)) | ((uint64_t)1U << 32);",
    );
  });

  it("generates 64-bit RMW for u64 target at position 63", () => {
    expect(BitUtils.singleBitWrite("val64", 63, "true", "u64")).toBe(
      "val64 = (val64 & ~(1ULL << 63)) | ((uint64_t)1U << 63);",
    );
  });

  it("generates 64-bit RMW with expression value for u64", () => {
    expect(BitUtils.singleBitWrite("flags", 48, "isSet", "u64")).toBe(
      "flags = (flags & ~(1ULL << 48)) | ((uint64_t)(isSet ? 1U : 0U) << 48);",
    );
  });

  it("generates 64-bit RMW for i64 target", () => {
    expect(BitUtils.singleBitWrite("val64", 40, "false", "i64")).toBe(
      "val64 = (val64 & ~(1ULL << 40)) | ((uint64_t)0U << 40);",
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

  // 64-bit target tests (targetType parameter)
  it("generates 64-bit RMW for u64 target with 16-bit width at position 32", () => {
    expect(BitUtils.multiBitWrite("val64", 32, 16, "0xABCD", "u64")).toBe(
      "val64 = (val64 & ~(0xFFFFULL << 32)) | ((0xABCD & 0xFFFFULL) << 32);",
    );
  });

  it("generates 64-bit RMW for u64 target with 8-bit width at position 48", () => {
    expect(BitUtils.multiBitWrite("val64", 48, 8, "0xFF", "u64")).toBe(
      "val64 = (val64 & ~(0xFFULL << 48)) | ((0xFF & 0xFFULL) << 48);",
    );
  });

  it("generates 64-bit RMW for i64 target", () => {
    expect(BitUtils.multiBitWrite("val64", 40, 16, "data", "i64")).toBe(
      "val64 = (val64 & ~(0xFFFFULL << 40)) | ((data & 0xFFFFULL) << 40);",
    );
  });

  it("generates 64-bit RMW with dynamic width for u64 target", () => {
    expect(BitUtils.multiBitWrite("val64", 32, "width", "bits", "u64")).toBe(
      "val64 = (val64 & ~(((1ULL << width) - 1) << 32)) | ((bits & ((1ULL << width) - 1)) << 32);",
    );
  });
});

// ========================================================================
// writeOnlySingleBit
// ========================================================================
describe("BitUtils.writeOnlySingleBit", () => {
  it("generates write-only for literal true (MISRA 10.1 - uses 1U)", () => {
    expect(BitUtils.writeOnlySingleBit("SET_REG", 0, "true")).toBe(
      "SET_REG = (1U << 0);",
    );
  });

  it("generates write-only for literal false (MISRA 10.1 - uses 0U)", () => {
    expect(BitUtils.writeOnlySingleBit("CLR_REG", 3, "false")).toBe(
      "CLR_REG = (0U << 3);",
    );
  });

  it("generates write-only with ternary for expression (MISRA 10.1)", () => {
    expect(BitUtils.writeOnlySingleBit("CTRL", 7, "isActive")).toBe(
      "CTRL = ((isActive ? 1U : 0U) << 7);",
    );
  });

  it("handles dynamic offset (MISRA 10.1 - uses 1U)", () => {
    expect(BitUtils.writeOnlySingleBit("PORT", "bit", "true")).toBe(
      "PORT = (1U << bit);",
    );
  });

  it("handles expression offset (MISRA 10.1 - uses 0U)", () => {
    expect(BitUtils.writeOnlySingleBit("REG", "i + 1", "false")).toBe(
      "REG = (0U << i + 1);",
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
