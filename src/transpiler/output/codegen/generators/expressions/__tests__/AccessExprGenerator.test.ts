import { describe, it, expect } from "vitest";
import accessGenerators from "../AccessExprGenerator";
import TTypeInfo from "../../../types/TTypeInfo";

describe("AccessExprGenerator", () => {
  describe("generateLengthProperty", () => {
    // Helper to create a minimal PropertyContext
    const createContext = (overrides: Record<string, unknown> = {}) => ({
      result: "test",
      primaryId: undefined as string | undefined,
      currentIdentifier: undefined as string | undefined,
      subscriptDepth: 0,
      previousStructType: undefined as string | undefined,
      previousMemberName: undefined as string | undefined,
      typeInfo: undefined as TTypeInfo | undefined,
      mainArgsName: undefined as string | undefined,
      lengthCache: undefined as ReadonlyMap<string, string> | undefined,
      getStructFieldInfo: () =>
        undefined as { type: string; dimensions?: number[] } | undefined,
      getBitmapBitWidth: undefined as
        | ((name: string) => number | undefined)
        | undefined,
      ...overrides,
    });

    describe("main args handling", () => {
      it("returns argc for main args.length", () => {
        const ctx = createContext({
          mainArgsName: "args",
          primaryId: "args",
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("argc");
        expect(result.effects).toHaveLength(0);
      });

      it("does not return argc when primaryId does not match mainArgsName", () => {
        const ctx = createContext({
          mainArgsName: "args",
          primaryId: "other",
          typeInfo: {
            baseType: "u32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).not.toBe("argc");
      });
    });

    describe("struct member .length", () => {
      it("returns element count for string array field without subscript", () => {
        const ctx = createContext({
          previousStructType: "MyStruct",
          previousMemberName: "arr",
          subscriptDepth: 0,
          getStructFieldInfo: (structType: string, fieldName: string) => {
            if (structType === "MyStruct" && fieldName === "arr") {
              return { type: "string<64>", dimensions: [4, 65] };
            }
            return undefined;
          },
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("4");
        expect(result.skipContinue).toBe(true);
      });

      it("returns strlen for string array field with subscript", () => {
        const ctx = createContext({
          result: "ts.arr[0]",
          previousStructType: "MyStruct",
          previousMemberName: "arr",
          subscriptDepth: 1,
          getStructFieldInfo: () => ({
            type: "string<64>",
            dimensions: [4, 65],
          }),
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("strlen(ts.arr[0])");
        expect(result.effects).toContainEqual({
          type: "include",
          header: "string",
        });
        expect(result.skipContinue).toBe(true);
      });

      it("returns strlen for single string field", () => {
        const ctx = createContext({
          result: "ts.str",
          previousStructType: "MyStruct",
          previousMemberName: "str",
          getStructFieldInfo: () => ({ type: "string<64>", dimensions: [65] }),
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("strlen(ts.str)");
        expect(result.effects).toContainEqual({
          type: "include",
          header: "string",
        });
      });

      it("returns dimension for multi-dim array with partial subscript", () => {
        const ctx = createContext({
          previousStructType: "MyStruct",
          previousMemberName: "matrix",
          subscriptDepth: 1,
          getStructFieldInfo: () => ({ type: "u32", dimensions: [3, 4, 5] }),
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("4");
      });

      it("returns bit width for fully subscripted array member", () => {
        const ctx = createContext({
          previousStructType: "MyStruct",
          previousMemberName: "values",
          subscriptDepth: 2,
          getStructFieldInfo: () => ({ type: "u16", dimensions: [3, 4] }),
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("16");
      });

      it("returns bit width for non-array member", () => {
        const ctx = createContext({
          previousStructType: "MyStruct",
          previousMemberName: "value",
          getStructFieldInfo: () => ({ type: "i32" }),
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("32");
      });

      it("returns comment for unsupported element type", () => {
        const ctx = createContext({
          previousStructType: "MyStruct",
          previousMemberName: "values",
          subscriptDepth: 1,
          getStructFieldInfo: () => ({ type: "CustomType", dimensions: [3] }),
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toContain("unsupported element type CustomType");
        expect(result.code).toContain("0");
      });

      it("returns comment for unsupported non-array type", () => {
        const ctx = createContext({
          previousStructType: "MyStruct",
          previousMemberName: "custom",
          getStructFieldInfo: () => ({ type: "UnknownType" }),
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toContain("unsupported type UnknownType");
        expect(result.code).toContain("0");
      });
    });

    describe("string type handling", () => {
      it("returns element count for string array without subscript", () => {
        const typeInfo: TTypeInfo = {
          baseType: "char",
          bitWidth: 8,
          isArray: true,
          arrayDimensions: [4, 65],
          isConst: false,
          isString: true,
        };
        const ctx = createContext({
          typeInfo,
          subscriptDepth: 0,
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("4");
      });

      it("returns strlen for string array with subscript", () => {
        const typeInfo: TTypeInfo = {
          baseType: "char",
          bitWidth: 8,
          isArray: true,
          arrayDimensions: [4, 65],
          isConst: false,
          isString: true,
        };
        const ctx = createContext({
          result: "strArr[0]",
          typeInfo,
          subscriptDepth: 1,
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("strlen(strArr[0])");
        expect(result.effects).toContainEqual({
          type: "include",
          header: "string",
        });
      });

      it("uses cached length when available", () => {
        const typeInfo: TTypeInfo = {
          baseType: "char",
          bitWidth: 8,
          isArray: false,
          isConst: false,
          isString: true,
        };
        const lengthCache = new Map([["myStr", "cached_len"]]);
        const ctx = createContext({
          typeInfo,
          currentIdentifier: "myStr",
          lengthCache,
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("cached_len");
        expect(result.effects).toHaveLength(0);
      });

      it("returns strlen for single string", () => {
        const typeInfo: TTypeInfo = {
          baseType: "char",
          bitWidth: 8,
          isArray: false,
          arrayDimensions: [65],
          isConst: false,
          isString: true,
        };
        const ctx = createContext({
          result: "myStr",
          typeInfo,
          currentIdentifier: "myStr",
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("strlen(myStr)");
        expect(result.effects).toContainEqual({
          type: "include",
          header: "string",
        });
      });
    });

    describe("array type handling", () => {
      it("returns dimension at subscript depth for partial subscript", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u32",
          bitWidth: 32,
          isArray: true,
          arrayDimensions: [10, 20, 30],
          isConst: false,
        };
        const ctx = createContext({
          typeInfo,
          subscriptDepth: 1,
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("20");
      });

      it("returns first dimension when no subscript", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u8",
          bitWidth: 8,
          isArray: true,
          arrayDimensions: [5],
          isConst: false,
        };
        const ctx = createContext({ typeInfo });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("5");
      });

      it("returns 32 for fully subscripted enum array", () => {
        const typeInfo: TTypeInfo = {
          baseType: "Color",
          bitWidth: 32,
          isArray: true,
          arrayDimensions: [3],
          isConst: false,
          isEnum: true,
          enumTypeName: "Color",
        };
        const ctx = createContext({
          typeInfo,
          subscriptDepth: 1,
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("32");
      });

      it("returns strlen for fully subscripted string array", () => {
        const typeInfo: TTypeInfo = {
          baseType: "string<64>",
          bitWidth: 8,
          isArray: true,
          arrayDimensions: [4],
          isConst: false,
          isString: true,
        };
        const ctx = createContext({
          result: "strArr[0]",
          typeInfo,
          subscriptDepth: 1,
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("strlen(strArr[0])");
      });

      it("returns element bit width for fully subscripted primitive array", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u64",
          bitWidth: 64,
          isArray: true,
          arrayDimensions: [10],
          isConst: false,
        };
        const ctx = createContext({
          typeInfo,
          subscriptDepth: 1,
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("64");
      });

      it("returns bitmap bit width for fully subscripted bitmap array", () => {
        const typeInfo: TTypeInfo = {
          baseType: "MyBitmap",
          bitWidth: 16,
          isArray: true,
          arrayDimensions: [5],
          isConst: false,
          isBitmap: true,
          bitmapTypeName: "MyBitmap",
        };
        const ctx = createContext({
          typeInfo,
          subscriptDepth: 1,
          getBitmapBitWidth: (name: string) =>
            name === "MyBitmap" ? 16 : undefined,
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("16");
      });

      it("returns comment for unknown array length", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u32",
          bitWidth: 32,
          isArray: true,
          isConst: false,
        };
        const ctx = createContext({
          typeInfo,
          currentIdentifier: "unknownArr",
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toContain("unknown for unknownArr");
      });
    });

    describe("enum type handling", () => {
      it("returns 32 for enum type", () => {
        const typeInfo: TTypeInfo = {
          baseType: "Color",
          bitWidth: 32,
          isArray: false,
          isConst: false,
          isEnum: true,
          enumTypeName: "Color",
        };
        const ctx = createContext({ typeInfo });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("32");
      });
    });

    describe("integer type handling", () => {
      it("returns bit width for integer types", () => {
        const testCases: [string, number][] = [
          ["u8", 8],
          ["u16", 16],
          ["u32", 32],
          ["u64", 64],
          ["i8", 8],
          ["i16", 16],
          ["i32", 32],
          ["i64", 64],
        ];

        for (const [type, expectedWidth] of testCases) {
          const typeInfo: TTypeInfo = {
            baseType: type,
            bitWidth: expectedWidth,
            isArray: false,
            isConst: false,
          };
          const ctx = createContext({ typeInfo });
          const result = accessGenerators.generateLengthProperty(ctx);
          expect(result.code).toBe(String(expectedWidth));
        }
      });

      it("returns bit width for float types", () => {
        const testCases: [string, number][] = [
          ["f32", 32],
          ["f64", 64],
        ];

        for (const [type, expectedWidth] of testCases) {
          const typeInfo: TTypeInfo = {
            baseType: type,
            bitWidth: expectedWidth,
            isArray: false,
            isConst: false,
          };
          const ctx = createContext({ typeInfo });
          const result = accessGenerators.generateLengthProperty(ctx);
          expect(result.code).toBe(String(expectedWidth));
        }
      });

      it("returns bit width for bool type", () => {
        const typeInfo: TTypeInfo = {
          baseType: "bool",
          bitWidth: 1,
          isArray: false,
          isConst: false,
        };
        const ctx = createContext({ typeInfo });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("1");
      });
    });

    describe("C type width handling for struct members", () => {
      it("returns bit width for C integer types in struct members", () => {
        const testCases: [string, number][] = [
          ["uint8_t", 8],
          ["uint16_t", 16],
          ["uint32_t", 32],
          ["uint64_t", 64],
          ["int8_t", 8],
          ["int16_t", 16],
          ["int32_t", 32],
          ["int64_t", 64],
        ];

        for (const [type, expectedWidth] of testCases) {
          const ctx = createContext({
            previousStructType: "MyStruct",
            previousMemberName: "value",
            getStructFieldInfo: () => ({ type }),
          });
          const result = accessGenerators.generateLengthProperty(ctx);
          expect(result.code).toBe(String(expectedWidth));
        }
      });

      it("returns bit width for C float types in struct members", () => {
        const testCases: [string, number][] = [
          ["float", 32],
          ["double", 64],
        ];

        for (const [type, expectedWidth] of testCases) {
          const ctx = createContext({
            previousStructType: "MyStruct",
            previousMemberName: "value",
            getStructFieldInfo: () => ({ type }),
          });
          const result = accessGenerators.generateLengthProperty(ctx);
          expect(result.code).toBe(String(expectedWidth));
        }
      });
    });

    describe("edge cases", () => {
      it("uses result when currentIdentifier is undefined for strlen", () => {
        const typeInfo: TTypeInfo = {
          baseType: "char",
          bitWidth: 8,
          isArray: false,
          isConst: false,
          isString: true,
        };
        const ctx = createContext({
          result: "expr.str",
          typeInfo,
          currentIdentifier: undefined,
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toBe("strlen(expr.str)");
      });

      it("returns unsupported comment for fully subscripted array with unknown element type", () => {
        const typeInfo: TTypeInfo = {
          baseType: "UnknownCustomType",
          bitWidth: 0,
          isArray: true,
          arrayDimensions: [5],
          isConst: false,
        };
        const ctx = createContext({
          typeInfo,
          subscriptDepth: 1,
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toContain(
          "unsupported element type UnknownCustomType",
        );
        expect(result.code).toContain("0");
      });

      it("returns 0 for bitmap array without getBitmapBitWidth function", () => {
        const typeInfo: TTypeInfo = {
          baseType: "MyBitmap",
          bitWidth: 0,
          isArray: true,
          arrayDimensions: [5],
          isConst: false,
          isBitmap: true,
          bitmapTypeName: "MyBitmap",
        };
        const ctx = createContext({
          typeInfo,
          subscriptDepth: 1,
          getBitmapBitWidth: undefined,
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toContain("unsupported element type MyBitmap");
        expect(result.code).toContain("0");
      });

      it("returns 0 for bitmap array when getBitmapBitWidth returns undefined", () => {
        const typeInfo: TTypeInfo = {
          baseType: "MyBitmap",
          bitWidth: 0,
          isArray: true,
          arrayDimensions: [5],
          isConst: false,
          isBitmap: true,
          bitmapTypeName: "MyBitmap",
        };
        const ctx = createContext({
          typeInfo,
          subscriptDepth: 1,
          getBitmapBitWidth: () => undefined,
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toContain("unsupported element type MyBitmap");
        expect(result.code).toContain("0");
      });
    });

    describe("error handling", () => {
      it("returns comment for unknown type", () => {
        const ctx = createContext({
          result: "unknown",
        });
        const result = accessGenerators.generateLengthProperty(ctx);
        expect(result.code).toContain("unknown type for unknown");
        expect(result.code).toContain("0");
      });
    });
  });

  describe("generateCapacityProperty", () => {
    it("returns string capacity for string type", () => {
      const typeInfo: TTypeInfo = {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 64,
      };
      const result = accessGenerators.generateCapacityProperty(typeInfo);
      expect(result.code).toBe("64");
      expect(result.effects).toHaveLength(0);
    });

    it("returns capacity for string with different sizes", () => {
      const typeInfo: TTypeInfo = {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 255,
      };
      const result = accessGenerators.generateCapacityProperty(typeInfo);
      expect(result.code).toBe("255");
    });

    it("throws error for non-string type", () => {
      const typeInfo: TTypeInfo = {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      };
      expect(() => accessGenerators.generateCapacityProperty(typeInfo)).toThrow(
        "Error: .capacity is only available on string types",
      );
    });

    it("throws error for undefined typeInfo", () => {
      expect(() =>
        accessGenerators.generateCapacityProperty(undefined),
      ).toThrow("Error: .capacity is only available on string types");
    });

    it("throws error for string without capacity defined", () => {
      const typeInfo: TTypeInfo = {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
      };
      expect(() => accessGenerators.generateCapacityProperty(typeInfo)).toThrow(
        "Error: .capacity is only available on string types",
      );
    });
  });

  describe("generateSizeProperty", () => {
    it("returns capacity + 1 for string type", () => {
      const typeInfo: TTypeInfo = {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 64,
      };
      const result = accessGenerators.generateSizeProperty(typeInfo);
      expect(result.code).toBe("65");
      expect(result.effects).toHaveLength(0);
    });

    it("returns correct size for different capacities", () => {
      const typeInfo: TTypeInfo = {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 127,
      };
      const result = accessGenerators.generateSizeProperty(typeInfo);
      expect(result.code).toBe("128");
    });

    it("throws error for non-string type", () => {
      const typeInfo: TTypeInfo = {
        baseType: "i64",
        bitWidth: 64,
        isArray: false,
        isConst: false,
      };
      expect(() => accessGenerators.generateSizeProperty(typeInfo)).toThrow(
        "Error: .size is only available on string types",
      );
    });

    it("throws error for undefined typeInfo", () => {
      expect(() => accessGenerators.generateSizeProperty(undefined)).toThrow(
        "Error: .size is only available on string types",
      );
    });

    it("throws error for string without capacity defined", () => {
      const typeInfo: TTypeInfo = {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
      };
      expect(() => accessGenerators.generateSizeProperty(typeInfo)).toThrow(
        "Error: .size is only available on string types",
      );
    });
  });

  describe("generateBitmapFieldAccess", () => {
    it("generates single bit access", () => {
      const result = accessGenerators.generateBitmapFieldAccess("status", {
        offset: 0,
        width: 1,
      });
      expect(result.code).toBe("((status >> 0) & 1)");
      expect(result.effects).toHaveLength(0);
    });

    it("generates single bit access at different offsets", () => {
      const result = accessGenerators.generateBitmapFieldAccess("flags", {
        offset: 7,
        width: 1,
      });
      expect(result.code).toBe("((flags >> 7) & 1)");
    });

    it("generates multi-bit access with correct mask", () => {
      const result = accessGenerators.generateBitmapFieldAccess("control", {
        offset: 4,
        width: 4,
      });
      // 4-bit mask: (1 << 4) - 1 = 15 = 0xF
      expect(result.code).toBe("((control >> 4) & 0xF)");
    });

    it("generates 2-bit field access", () => {
      const result = accessGenerators.generateBitmapFieldAccess("reg", {
        offset: 2,
        width: 2,
      });
      // 2-bit mask: (1 << 2) - 1 = 3
      expect(result.code).toBe("((reg >> 2) & 0x3)");
    });

    it("generates 8-bit field access", () => {
      const result = accessGenerators.generateBitmapFieldAccess("data", {
        offset: 8,
        width: 8,
      });
      // 8-bit mask: (1 << 8) - 1 = 255 = 0xFF
      expect(result.code).toBe("((data >> 8) & 0xFF)");
    });

    it("handles complex expressions as result", () => {
      const result = accessGenerators.generateBitmapFieldAccess(
        "arr[i].field",
        {
          offset: 0,
          width: 3,
        },
      );
      // 3-bit mask: (1 << 3) - 1 = 7
      expect(result.code).toBe("((arr[i].field >> 0) & 0x7)");
    });

    it("generates 16-bit field access", () => {
      const result = accessGenerators.generateBitmapFieldAccess("word", {
        offset: 0,
        width: 16,
      });
      // 16-bit mask: (1 << 16) - 1 = 65535 = 0xFFFF
      expect(result.code).toBe("((word >> 0) & 0xFFFF)");
    });
  });
});
