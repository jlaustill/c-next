import { describe, it, expect, vi } from "vitest";
import CallExprUtils from "../CallExprUtils";

describe("CallExprUtils", () => {
  describe("mapTypeToCType", () => {
    it("maps unsigned integer types", () => {
      expect(CallExprUtils.mapTypeToCType("u8")).toBe("uint8_t");
      expect(CallExprUtils.mapTypeToCType("u16")).toBe("uint16_t");
      expect(CallExprUtils.mapTypeToCType("u32")).toBe("uint32_t");
      expect(CallExprUtils.mapTypeToCType("u64")).toBe("uint64_t");
    });

    it("maps signed integer types", () => {
      expect(CallExprUtils.mapTypeToCType("i8")).toBe("int8_t");
      expect(CallExprUtils.mapTypeToCType("i16")).toBe("int16_t");
      expect(CallExprUtils.mapTypeToCType("i32")).toBe("int32_t");
      expect(CallExprUtils.mapTypeToCType("i64")).toBe("int64_t");
    });

    it("maps float types", () => {
      expect(CallExprUtils.mapTypeToCType("f32")).toBe("float");
      expect(CallExprUtils.mapTypeToCType("f64")).toBe("double");
    });

    it("maps bool type", () => {
      expect(CallExprUtils.mapTypeToCType("bool")).toBe("bool");
    });

    it("returns unknown types unchanged", () => {
      expect(CallExprUtils.mapTypeToCType("MyStruct")).toBe("MyStruct");
      expect(CallExprUtils.mapTypeToCType("CustomType")).toBe("CustomType");
    });
  });

  describe("generateSafeDivModHelperName", () => {
    it("generates safe_div helper name", () => {
      expect(
        CallExprUtils.generateSafeDivModHelperName("safe_div", "u32"),
      ).toBe("cnx_safe_div_u32");
      expect(
        CallExprUtils.generateSafeDivModHelperName("safe_div", "i64"),
      ).toBe("cnx_safe_div_i64");
    });

    it("generates safe_mod helper name", () => {
      expect(
        CallExprUtils.generateSafeDivModHelperName("safe_mod", "u32"),
      ).toBe("cnx_safe_mod_u32");
      expect(
        CallExprUtils.generateSafeDivModHelperName("safe_mod", "i16"),
      ).toBe("cnx_safe_mod_i16");
    });

    it("works with all integer types", () => {
      expect(CallExprUtils.generateSafeDivModHelperName("safe_div", "u8")).toBe(
        "cnx_safe_div_u8",
      );
      expect(
        CallExprUtils.generateSafeDivModHelperName("safe_mod", "u16"),
      ).toBe("cnx_safe_mod_u16");
    });
  });

  describe("resolveTargetParam", () => {
    it("returns local param when signature has the parameter", () => {
      const sig = {
        name: "myFunc",
        parameters: [
          { name: "a", baseType: "u32", isConst: false, isArray: false },
        ],
      };

      const result = CallExprUtils.resolveTargetParam(sig, 0, "myFunc", null);

      expect(result.param).toEqual(sig.parameters[0]);
      expect(result.isCrossFile).toBe(false);
    });

    it("returns undefined when signature has no parameter at index", () => {
      const sig = {
        name: "myFunc",
        parameters: [
          { name: "a", baseType: "u32", isConst: false, isArray: false },
        ],
      };

      const result = CallExprUtils.resolveTargetParam(sig, 1, "myFunc", null);

      expect(result.param).toBeUndefined();
      expect(result.isCrossFile).toBe(false);
    });

    it("returns undefined when no signature and no symbol table", () => {
      const result = CallExprUtils.resolveTargetParam(
        undefined,
        0,
        "myFunc",
        null,
      );

      expect(result.param).toBeUndefined();
      expect(result.isCrossFile).toBe(false);
    });

    it("falls back to SymbolTable when no local signature", () => {
      const symbolTable = {
        getOverloadsByCName: vi.fn(() => [
          {
            kind: "function",
            parameters: [
              { name: "val", type: "i32", isConst: true, isArray: false },
            ],
          },
        ]),
      };

      const result = CallExprUtils.resolveTargetParam(
        undefined,
        0,
        "crossFunc",
        symbolTable as any,
      );

      expect(result.param).toEqual({
        name: "val",
        baseType: "i32",
        isConst: true,
        isArray: false,
      });
      expect(result.isCrossFile).toBe(true);
      // Issue #1139: cross-file resolution goes by transpiled C name, which is
      // what codegen holds; the bare-name index misses every scoped function.
      expect(symbolTable.getOverloadsByCName).toHaveBeenCalledWith("crossFunc");
    });

    it("skips non-function symbols in SymbolTable", () => {
      const symbolTable = {
        getOverloadsByCName: vi.fn(() => [
          { kind: "variable" },
          { kind: "struct" },
        ]),
      };

      const result = CallExprUtils.resolveTargetParam(
        undefined,
        0,
        "crossFunc",
        symbolTable as any,
      );

      expect(result.param).toBeUndefined();
      expect(result.isCrossFile).toBe(false);
    });

    it("skips function symbols without parameter at index", () => {
      const symbolTable = {
        getOverloadsByCName: vi.fn(() => [
          {
            kind: "function",
            parameters: [
              { name: "a", type: "u8", isConst: false, isArray: false },
            ],
          },
        ]),
      };

      const result = CallExprUtils.resolveTargetParam(
        undefined,
        1,
        "crossFunc",
        symbolTable as any,
      );

      expect(result.param).toBeUndefined();
      expect(result.isCrossFile).toBe(false);
    });

    it("prefers local signature over SymbolTable", () => {
      const sig = {
        name: "myFunc",
        parameters: [
          { name: "local", baseType: "u32", isConst: false, isArray: false },
        ],
      };
      const symbolTable = {
        getOverloadsByCName: vi.fn(() => [
          {
            kind: "function",
            parameters: [
              { name: "remote", type: "i64", isConst: true, isArray: false },
            ],
          },
        ]),
      };

      const result = CallExprUtils.resolveTargetParam(
        sig,
        0,
        "myFunc",
        symbolTable as any,
      );

      expect(result.param).toEqual(sig.parameters[0]);
      expect(result.isCrossFile).toBe(false);
      expect(symbolTable.getOverloadsByCName).not.toHaveBeenCalled();
    });
  });
});
