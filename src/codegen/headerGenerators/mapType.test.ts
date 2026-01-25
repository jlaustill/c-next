/**
 * Tests for mapType utility
 */

import typeUtils from "./mapType";

const { TYPE_MAP, mapType, isBuiltInType } = typeUtils;

describe("TYPE_MAP", () => {
  it("should map all unsigned integer types", () => {
    expect(TYPE_MAP["u8"]).toBe("uint8_t");
    expect(TYPE_MAP["u16"]).toBe("uint16_t");
    expect(TYPE_MAP["u32"]).toBe("uint32_t");
    expect(TYPE_MAP["u64"]).toBe("uint64_t");
  });

  it("should map all signed integer types", () => {
    expect(TYPE_MAP["i8"]).toBe("int8_t");
    expect(TYPE_MAP["i16"]).toBe("int16_t");
    expect(TYPE_MAP["i32"]).toBe("int32_t");
    expect(TYPE_MAP["i64"]).toBe("int64_t");
  });

  it("should map floating point types", () => {
    expect(TYPE_MAP["f32"]).toBe("float");
    expect(TYPE_MAP["f64"]).toBe("double");
  });

  it("should map other primitive types", () => {
    expect(TYPE_MAP["bool"]).toBe("bool");
    expect(TYPE_MAP["void"]).toBe("void");
    expect(TYPE_MAP["ISR"]).toBe("ISR");
  });
});

describe("mapType", () => {
  describe("primitive types", () => {
    it("should map known primitive types", () => {
      expect(mapType("u32")).toBe("uint32_t");
      expect(mapType("i16")).toBe("int16_t");
      expect(mapType("f64")).toBe("double");
      expect(mapType("bool")).toBe("bool");
    });

    it("should pass through unknown types unchanged", () => {
      expect(mapType("MyStruct")).toBe("MyStruct");
      expect(mapType("CustomType")).toBe("CustomType");
    });
  });

  describe("pointer types", () => {
    it("should handle single pointer to primitive", () => {
      expect(mapType("u32*")).toBe("uint32_t*");
      expect(mapType("i8*")).toBe("int8_t*");
    });

    it("should handle pointer to user-defined type", () => {
      expect(mapType("MyStruct*")).toBe("MyStruct*");
    });

    it("should handle double pointers", () => {
      expect(mapType("u8**")).toBe("uint8_t**");
    });
  });

  describe("array types", () => {
    it("should handle fixed-size arrays", () => {
      expect(mapType("u32[10]")).toBe("uint32_t[10]");
      expect(mapType("i16[256]")).toBe("int16_t[256]");
    });

    it("should handle unsized arrays", () => {
      expect(mapType("u8[]")).toBe("uint8_t[]");
    });

    it("should handle arrays of user-defined types", () => {
      expect(mapType("MyStruct[5]")).toBe("MyStruct[5]");
    });
  });

  describe("edge cases", () => {
    it("should handle void type", () => {
      expect(mapType("void")).toBe("void");
    });

    it("should handle ISR function pointer type", () => {
      expect(mapType("ISR")).toBe("ISR");
    });

    it("should handle pointer to void", () => {
      expect(mapType("void*")).toBe("void*");
    });
  });

  // Issue #427: string<N> type handling
  describe("string types", () => {
    it("should map string<N> to char[N+1]", () => {
      expect(mapType("string<32>")).toBe("char[33]");
      expect(mapType("string<16>")).toBe("char[17]");
      expect(mapType("string<64>")).toBe("char[65]");
      expect(mapType("string<0>")).toBe("char[1]");
    });

    it("should handle string<N> with various capacities", () => {
      expect(mapType("string<1>")).toBe("char[2]");
      expect(mapType("string<255>")).toBe("char[256]");
      expect(mapType("string<1024>")).toBe("char[1025]");
    });
  });
});

// Issue #427: isBuiltInType helper
describe("isBuiltInType", () => {
  // Primitive types that should be recognized as built-in
  const builtInPrimitives = [
    "u8",
    "u16",
    "u32",
    "u64",
    "i8",
    "i16",
    "i32",
    "i64",
    "f32",
    "f64",
    "bool",
    "void",
  ];

  it.each(builtInPrimitives)("should return true for primitive %s", (type) => {
    expect(isBuiltInType(type)).toBe(true);
  });

  // String types with various capacities
  const builtInStrings = [
    "string<0>",
    "string<16>",
    "string<32>",
    "string<64>",
    "string<255>",
  ];

  it.each(builtInStrings)("should return true for %s", (type) => {
    expect(isBuiltInType(type)).toBe(true);
  });

  // User-defined types that should NOT be recognized as built-in
  const userDefinedTypes = ["MyStruct", "Configuration", "Point"];

  it.each(userDefinedTypes)(
    "should return false for user-defined type %s",
    (type) => {
      expect(isBuiltInType(type)).toBe(false);
    },
  );

  // Invalid string patterns that should NOT be recognized as built-in
  const invalidStringTypes = ["string", "string<>", "string<abc>"];

  it.each(invalidStringTypes)(
    "should return false for invalid string type %s",
    (type) => {
      expect(isBuiltInType(type)).toBe(false);
    },
  );
});
