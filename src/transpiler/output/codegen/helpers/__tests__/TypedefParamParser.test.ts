/**
 * Unit tests for TypedefParamParser
 */

import { describe, expect, it } from "vitest";
import TypedefParamParser from "../TypedefParamParser";
import IParameterSymbol from "../../../../../utils/types/IParameterSymbol";

describe("TypedefParamParser", () => {
  describe("parse", () => {
    it("should parse simple callback with pointer params", () => {
      const result = TypedefParamParser.parse(
        "void (*)(widget_t *, const rect_t *, uint8_t *)",
      );

      expect(result).not.toBeNull();
      expect(result!.returnType).toBe("void");
      expect(result!.params).toHaveLength(3);

      expect(result!.params[0].isPointer).toBe(true);
      expect(result!.params[0].isConst).toBe(false);
      expect(result!.params[0].baseType).toBe("widget_t");

      expect(result!.params[1].isPointer).toBe(true);
      expect(result!.params[1].isConst).toBe(true);
      expect(result!.params[1].baseType).toBe("rect_t");

      expect(result!.params[2].isPointer).toBe(true);
      expect(result!.params[2].isConst).toBe(false);
      expect(result!.params[2].baseType).toBe("uint8_t");
    });

    it("should parse callback without spaces (C grammar format)", () => {
      // This is the actual format from CResolver - getText() may strip spaces
      const result = TypedefParamParser.parse(
        "void (*)(widget_t*,const rect_t*,uint8_t*)",
      );

      expect(result).not.toBeNull();
      expect(result!.returnType).toBe("void");
      expect(result!.params).toHaveLength(3);

      expect(result!.params[0].isPointer).toBe(true);
      expect(result!.params[0].isConst).toBe(false);
      expect(result!.params[0].baseType).toBe("widget_t");

      expect(result!.params[1].isPointer).toBe(true);
      expect(result!.params[1].isConst).toBe(true);
      expect(result!.params[1].baseType).toBe("rect_t");

      expect(result!.params[2].isPointer).toBe(true);
      expect(result!.params[2].isConst).toBe(false);
      expect(result!.params[2].baseType).toBe("uint8_t");
    });

    it("should parse callback with value params", () => {
      const result = TypedefParamParser.parse("void (*)(Point p)");

      expect(result).not.toBeNull();
      expect(result!.returnType).toBe("void");
      expect(result!.params).toHaveLength(1);

      expect(result!.params[0].isPointer).toBe(false);
      expect(result!.params[0].isConst).toBe(false);
      expect(result!.params[0].baseType).toBe("Point");
    });

    it("should parse callback with no params", () => {
      const result = TypedefParamParser.parse("void (*)(void)");

      expect(result).not.toBeNull();
      expect(result!.returnType).toBe("void");
      expect(result!.params).toHaveLength(0);
    });

    it("should parse callback with primitive return type", () => {
      const result = TypedefParamParser.parse("int (*)(int x, int y)");

      expect(result).not.toBeNull();
      expect(result!.returnType).toBe("int");
      expect(result!.params).toHaveLength(2);

      expect(result!.params[0].isPointer).toBe(false);
      expect(result!.params[0].baseType).toBe("int");

      expect(result!.params[1].isPointer).toBe(false);
      expect(result!.params[1].baseType).toBe("int");
    });

    it("should return null for invalid typedef", () => {
      expect(TypedefParamParser.parse("not a typedef")).toBeNull();
      expect(TypedefParamParser.parse("void foo()")).toBeNull();
      expect(TypedefParamParser.parse("")).toBeNull();
    });

    it("should handle mixed pointer and value params", () => {
      const result = TypedefParamParser.parse(
        "void (*)(Point* p, int count, Rect r)",
      );

      expect(result).not.toBeNull();
      expect(result!.params).toHaveLength(3);

      expect(result!.params[0].isPointer).toBe(true);
      expect(result!.params[0].baseType).toBe("Point");

      expect(result!.params[1].isPointer).toBe(false);
      expect(result!.params[1].baseType).toBe("int");

      expect(result!.params[2].isPointer).toBe(false);
      expect(result!.params[2].baseType).toBe("Rect");
    });

    it("should parse callback with nested function pointer param", () => {
      // Nested function pointer: void (*)(void (*)(int))
      const result = TypedefParamParser.parse("void (*)(void (*)(int))");

      expect(result).not.toBeNull();
      expect(result!.returnType).toBe("void");
      expect(result!.params).toHaveLength(1);

      // The param is itself a function pointer
      expect(result!.params[0].type).toBe("void (*)(int)");
      expect(result!.params[0].isPointer).toBe(true); // Function pointers are pointers
    });

    it("should parse callback with deeply nested function pointer", () => {
      // Two levels of nesting: void (*)(void (*)(void (*)(int)))
      const result = TypedefParamParser.parse(
        "void (*)(void (*)(void (*)(int)))",
      );

      expect(result).not.toBeNull();
      expect(result!.returnType).toBe("void");
      expect(result!.params).toHaveLength(1);
      expect(result!.params[0].type).toBe("void (*)(void (*)(int))");
    });

    it("should parse callback with mixed nested and regular params", () => {
      // Mix of nested function pointer and regular params
      const result = TypedefParamParser.parse(
        "void (*)(int x, void (*)(int), char* str)",
      );

      expect(result).not.toBeNull();
      expect(result!.returnType).toBe("void");
      expect(result!.params).toHaveLength(3);

      expect(result!.params[0].baseType).toBe("int");
      expect(result!.params[0].isPointer).toBe(false);

      expect(result!.params[1].type).toBe("void (*)(int)");
      expect(result!.params[1].isPointer).toBe(true);

      expect(result!.params[2].baseType).toBe("char");
      expect(result!.params[2].isPointer).toBe(true);
    });
  });

  describe("shouldBePointer", () => {
    it("should return true for pointer params", () => {
      const typedef = "void (*)(widget_t *, uint8_t *)";

      expect(TypedefParamParser.shouldBePointer(typedef, 0)).toBe(true);
      expect(TypedefParamParser.shouldBePointer(typedef, 1)).toBe(true);
    });

    it("should return false for value params", () => {
      const typedef = "void (*)(Point p, int count)";

      expect(TypedefParamParser.shouldBePointer(typedef, 0)).toBe(false);
      expect(TypedefParamParser.shouldBePointer(typedef, 1)).toBe(false);
    });

    it("should return null for out of bounds index", () => {
      const typedef = "void (*)(Point p)";

      expect(TypedefParamParser.shouldBePointer(typedef, 1)).toBeNull();
      expect(TypedefParamParser.shouldBePointer(typedef, 99)).toBeNull();
    });

    it("should return null for invalid typedef", () => {
      expect(TypedefParamParser.shouldBePointer("invalid", 0)).toBeNull();
    });
  });

  describe("shouldBeConst", () => {
    it("should return true for const params", () => {
      const typedef = "void (*)(const Point* p, const char* s)";

      expect(TypedefParamParser.shouldBeConst(typedef, 0)).toBe(true);
      expect(TypedefParamParser.shouldBeConst(typedef, 1)).toBe(true);
    });

    it("should return false for non-const params", () => {
      const typedef = "void (*)(Point* p, uint8_t* buf)";

      expect(TypedefParamParser.shouldBeConst(typedef, 0)).toBe(false);
      expect(TypedefParamParser.shouldBeConst(typedef, 1)).toBe(false);
    });

    it("should handle mixed const params", () => {
      const typedef = "void (*)(widget_t* w, const rect_t* area, uint8_t* buf)";

      expect(TypedefParamParser.shouldBeConst(typedef, 0)).toBe(false);
      expect(TypedefParamParser.shouldBeConst(typedef, 1)).toBe(true);
      expect(TypedefParamParser.shouldBeConst(typedef, 2)).toBe(false);
    });
  });

  describe("resolveCallbackParams (Issue #914)", () => {
    function makeParam(
      name: string,
      type: string,
      overrides?: Partial<IParameterSymbol>,
    ): IParameterSymbol {
      return {
        name,
        type,
        isConst: false,
        isArray: false,
        ...overrides,
      };
    }

    it("should set isCallbackPointer for pointer params", () => {
      const params = [makeParam("w", "widget_t"), makeParam("buf", "u8")];
      const typedef = "void (*)(widget_t *, uint8_t *)";

      const result = TypedefParamParser.resolveCallbackParams(params, typedef);

      expect(result[0].isCallbackPointer).toBe(true);
      expect(result[1].isCallbackPointer).toBe(true);
    });

    it("should set isCallbackConst for const pointer params", () => {
      const params = [
        makeParam("w", "widget_t"),
        makeParam("area", "rect_t"),
        makeParam("buf", "u8"),
      ];
      const typedef = "void (*)(widget_t *, const rect_t *, uint8_t *)";

      const result = TypedefParamParser.resolveCallbackParams(params, typedef);

      expect(result[0].isCallbackPointer).toBe(true);
      expect(result[0].isCallbackConst).toBe(false);

      expect(result[1].isCallbackPointer).toBe(true);
      expect(result[1].isCallbackConst).toBe(true);

      expect(result[2].isCallbackPointer).toBe(true);
      expect(result[2].isCallbackConst).toBe(false);
    });

    it("should not set callback flags for value params", () => {
      const params = [makeParam("count", "u32")];
      const typedef = "void (*)(int count)";

      const result = TypedefParamParser.resolveCallbackParams(params, typedef);

      expect(result[0].isCallbackPointer).toBe(false);
      expect(result[0].isCallbackConst).toBe(false);
    });

    it("should preserve existing param fields", () => {
      const params = [
        makeParam("data", "u8", {
          isConst: true,
          isArray: true,
          arrayDimensions: ["10"],
        }),
      ];
      const typedef = "void (*)(uint8_t *)";

      const result = TypedefParamParser.resolveCallbackParams(params, typedef);

      expect(result[0].name).toBe("data");
      expect(result[0].type).toBe("u8");
      expect(result[0].isConst).toBe(true);
      expect(result[0].isArray).toBe(true);
      expect(result[0].arrayDimensions).toEqual(["10"]);
      expect(result[0].isCallbackPointer).toBe(true);
    });

    it("should handle params beyond typedef length gracefully", () => {
      const params = [makeParam("w", "widget_t"), makeParam("extra", "u32")];
      const typedef = "void (*)(widget_t *)";

      const result = TypedefParamParser.resolveCallbackParams(params, typedef);

      expect(result[0].isCallbackPointer).toBe(true);
      expect(result[1].isCallbackPointer).toBeUndefined();
      expect(result[1].isCallbackConst).toBeUndefined();
    });
  });
});
