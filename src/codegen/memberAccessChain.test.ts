/**
 * Tests for memberAccessChain helper module.
 *
 * This module tests the shared logic for building member access chains
 * with proper separators (-> for struct params, _ for cross-scope, . otherwise).
 */

import { vi } from "vitest";
import { ParseTree } from "antlr4ng";
import memberAccessChain from "./memberAccessChain";

const {
  determineSeparator,
  buildMemberAccessChain,
  getStructParamSeparator,
  wrapStructParamValue,
  buildStructParamMemberAccess,
} = memberAccessChain;

// Local type definition for separator options (mirrors internal type)
interface SeparatorOptions {
  isStructParam: boolean;
  isCrossScope: boolean;
  cppMode?: boolean;
}

describe("determineSeparator", () => {
  describe("struct parameter access", () => {
    it("should return -> for struct param at idIndex 1", () => {
      const options: SeparatorOptions = {
        isStructParam: true,
        isCrossScope: false,
      };
      expect(determineSeparator(options, 1)).toBe("->");
    });

    it("should return . for struct param at idIndex > 1", () => {
      const options: SeparatorOptions = {
        isStructParam: true,
        isCrossScope: false,
      };
      expect(determineSeparator(options, 2)).toBe(".");
      expect(determineSeparator(options, 3)).toBe(".");
    });
  });

  describe("cross-scope access", () => {
    it("should return _ for cross-scope at idIndex 1", () => {
      const options: SeparatorOptions = {
        isStructParam: false,
        isCrossScope: true,
      };
      expect(determineSeparator(options, 1)).toBe("_");
    });

    it("should return . for cross-scope at idIndex > 1", () => {
      const options: SeparatorOptions = {
        isStructParam: false,
        isCrossScope: true,
      };
      expect(determineSeparator(options, 2)).toBe(".");
      expect(determineSeparator(options, 3)).toBe(".");
    });
  });

  describe("struct param takes precedence over cross-scope", () => {
    it("should return -> when both struct param and cross-scope at idIndex 1", () => {
      const options: SeparatorOptions = {
        isStructParam: true,
        isCrossScope: true,
      };
      expect(determineSeparator(options, 1)).toBe("->");
    });
  });

  describe("regular access", () => {
    it("should return . when neither struct param nor cross-scope", () => {
      const options: SeparatorOptions = {
        isStructParam: false,
        isCrossScope: false,
      };
      expect(determineSeparator(options, 1)).toBe(".");
      expect(determineSeparator(options, 2)).toBe(".");
    });
  });

  describe("C++ mode (cppMode)", () => {
    it("should return . for struct param at idIndex 1 in C++ mode", () => {
      const options: SeparatorOptions = {
        isStructParam: true,
        isCrossScope: false,
        cppMode: true,
      };
      expect(determineSeparator(options, 1)).toBe(".");
    });

    it("should return -> for struct param at idIndex 1 in C mode (cppMode: false)", () => {
      const options: SeparatorOptions = {
        isStructParam: true,
        isCrossScope: false,
        cppMode: false,
      };
      expect(determineSeparator(options, 1)).toBe("->");
    });

    it("should return -> for struct param when cppMode is undefined (default C mode)", () => {
      const options: SeparatorOptions = {
        isStructParam: true,
        isCrossScope: false,
        // cppMode not specified
      };
      expect(determineSeparator(options, 1)).toBe("->");
    });
  });
});

describe("getStructParamSeparator", () => {
  it("should return -> in C mode", () => {
    expect(getStructParamSeparator({ cppMode: false })).toBe("->");
  });

  it("should return . in C++ mode", () => {
    expect(getStructParamSeparator({ cppMode: true })).toBe(".");
  });
});

describe("wrapStructParamValue", () => {
  it("should dereference in C mode", () => {
    expect(wrapStructParamValue("config", { cppMode: false })).toBe(
      "(*config)",
    );
  });

  it("should return unchanged in C++ mode", () => {
    expect(wrapStructParamValue("config", { cppMode: true })).toBe("config");
  });

  it("should handle parameter names with underscores", () => {
    expect(wrapStructParamValue("my_config", { cppMode: false })).toBe(
      "(*my_config)",
    );
    expect(wrapStructParamValue("my_config", { cppMode: true })).toBe(
      "my_config",
    );
  });
});

describe("buildStructParamMemberAccess", () => {
  describe("C mode", () => {
    it("should use -> for single member access", () => {
      expect(
        buildStructParamMemberAccess("config", ["magic"], { cppMode: false }),
      ).toBe("config->magic");
    });

    it("should use -> then . for chained member access", () => {
      expect(
        buildStructParamMemberAccess("config", ["inner", "value"], {
          cppMode: false,
        }),
      ).toBe("config->inner.value");
    });

    it("should return just param name when no members", () => {
      expect(
        buildStructParamMemberAccess("config", [], { cppMode: false }),
      ).toBe("config");
    });
  });

  describe("C++ mode", () => {
    it("should use . for single member access", () => {
      expect(
        buildStructParamMemberAccess("config", ["magic"], { cppMode: true }),
      ).toBe("config.magic");
    });

    it("should use . for chained member access", () => {
      expect(
        buildStructParamMemberAccess("config", ["inner", "value"], {
          cppMode: true,
        }),
      ).toBe("config.inner.value");
    });

    it("should return just param name when no members", () => {
      expect(
        buildStructParamMemberAccess("config", [], { cppMode: true }),
      ).toBe("config");
    });
  });
});

// Mock ParseTree for testing - only getText() is used by buildMemberAccessChain
function createMockChildren(tokens: string[]): ParseTree[] {
  return tokens.map(
    (text) => ({ getText: () => text }) as unknown as ParseTree,
  );
}

describe("buildMemberAccessChain", () => {
  // Simple expression generator that just returns the expression as-is
  const simpleExprGen = (expr: string) => expr;

  describe("simple member access (no subscripts)", () => {
    it("should build chain with regular separator", () => {
      // cfg.tempInputs.assignedSpn
      const options = {
        firstId: "cfg",
        identifiers: ["cfg", "tempInputs", "assignedSpn"],
        expressions: [],
        children: createMockChildren([
          "cfg",
          ".",
          "tempInputs",
          ".",
          "assignedSpn",
        ]),
        separatorOptions: { isStructParam: false, isCrossScope: false },
        generateExpression: simpleExprGen,
      };

      const result = buildMemberAccessChain(options);
      expect(result.code).toBe("cfg.tempInputs.assignedSpn");
      expect(result.identifiersConsumed).toBe(3);
      expect(result.expressionsConsumed).toBe(0);
    });

    it("should build chain with -> for struct parameter", () => {
      // conf->tempInputs.assignedSpn (conf is a struct param)
      const options = {
        firstId: "conf",
        identifiers: ["conf", "tempInputs", "assignedSpn"],
        expressions: [],
        children: createMockChildren([
          "conf",
          ".",
          "tempInputs",
          ".",
          "assignedSpn",
        ]),
        separatorOptions: { isStructParam: true, isCrossScope: false },
        generateExpression: simpleExprGen,
      };

      const result = buildMemberAccessChain(options);
      expect(result.code).toBe("conf->tempInputs.assignedSpn");
      expect(result.identifiersConsumed).toBe(3);
    });

    it("should build chain with _ for cross-scope", () => {
      // Timing_tickCount (cross-scope access)
      const options = {
        firstId: "Timing",
        identifiers: ["Timing", "tickCount"],
        expressions: [],
        children: createMockChildren(["Timing", ".", "tickCount"]),
        separatorOptions: { isStructParam: false, isCrossScope: true },
        generateExpression: simpleExprGen,
      };

      const result = buildMemberAccessChain(options);
      expect(result.code).toBe("Timing_tickCount");
      expect(result.identifiersConsumed).toBe(2);
    });
  });

  describe("member access with subscripts", () => {
    it("should build chain with subscript at end", () => {
      // cfg.tempInputs[idx]
      const options = {
        firstId: "cfg",
        identifiers: ["cfg", "tempInputs"],
        expressions: ["idx"],
        children: createMockChildren([
          "cfg",
          ".",
          "tempInputs",
          "[",
          "idx",
          "]",
        ]),
        separatorOptions: { isStructParam: false, isCrossScope: false },
        generateExpression: simpleExprGen,
      };

      const result = buildMemberAccessChain(options);
      expect(result.code).toBe("cfg.tempInputs[idx]");
      expect(result.identifiersConsumed).toBe(2);
      expect(result.expressionsConsumed).toBe(1);
    });

    it("should build chain with subscript then member (the issue #69 pattern)", () => {
      // conf->tempInputs[idx].assignedSpn (struct param with subscript then member)
      const options = {
        firstId: "conf",
        identifiers: ["conf", "tempInputs", "assignedSpn"],
        expressions: ["idx"],
        children: createMockChildren([
          "conf",
          ".",
          "tempInputs",
          "[",
          "idx",
          "]",
          ".",
          "assignedSpn",
        ]),
        separatorOptions: { isStructParam: true, isCrossScope: false },
        generateExpression: simpleExprGen,
      };

      const result = buildMemberAccessChain(options);
      expect(result.code).toBe("conf->tempInputs[idx].assignedSpn");
      expect(result.identifiersConsumed).toBe(3);
      expect(result.expressionsConsumed).toBe(1);
    });

    it("should handle multiple subscripts", () => {
      // matrix[i][j]
      const options = {
        firstId: "matrix",
        identifiers: ["matrix"],
        expressions: ["i", "j"],
        children: createMockChildren(["matrix", "[", "i", "]", "[", "j", "]"]),
        separatorOptions: { isStructParam: false, isCrossScope: false },
        generateExpression: simpleExprGen,
      };

      const result = buildMemberAccessChain(options);
      expect(result.code).toBe("matrix[i][j]");
      expect(result.expressionsConsumed).toBe(2);
    });

    it("should handle mixed subscripts and members", () => {
      // data->items[0].value[1].flag
      const options = {
        firstId: "data",
        identifiers: ["data", "items", "value", "flag"],
        expressions: ["0", "1"],
        children: createMockChildren([
          "data",
          ".",
          "items",
          "[",
          "0",
          "]",
          ".",
          "value",
          "[",
          "1",
          "]",
          ".",
          "flag",
        ]),
        separatorOptions: { isStructParam: true, isCrossScope: false },
        generateExpression: simpleExprGen,
      };

      const result = buildMemberAccessChain(options);
      expect(result.code).toBe("data->items[0].value[1].flag");
      expect(result.identifiersConsumed).toBe(4);
      expect(result.expressionsConsumed).toBe(2);
    });
  });

  describe("type tracking and bit access", () => {
    it("should handle initial type that is not a known struct", () => {
      // When initialTypeInfo.baseType is not a known struct, typeState.currentStructType should be undefined
      const mockTypeTracking = {
        getStructFields: vi.fn().mockReturnValue(new Map()),
        getStructArrayFields: vi.fn().mockReturnValue(new Set()),
        isKnownStruct: vi.fn().mockReturnValue(false), // NOT a known struct
      };

      const options = {
        firstId: "data",
        identifiers: ["data", "value"],
        expressions: [],
        children: createMockChildren(["data", ".", "value"]),
        separatorOptions: { isStructParam: false, isCrossScope: false },
        generateExpression: simpleExprGen,
        initialTypeInfo: { isArray: false, baseType: "UnknownType" },
        typeTracking: mockTypeTracking,
      };

      const result = buildMemberAccessChain(options);
      expect(result.code).toBe("data.value");
      expect(mockTypeTracking.isKnownStruct).toHaveBeenCalledWith(
        "UnknownType",
      );
    });

    it("should track nested struct types through member chain", () => {
      // point.inner.x where Point has Inner member which is also a struct
      const mockTypeTracking = {
        getStructFields: vi.fn().mockImplementation((structType) => {
          if (structType === "Point") return new Map([["inner", "Inner"]]);
          if (structType === "Inner") return new Map([["x", "i32"]]);
          return new Map();
        }),
        getStructArrayFields: vi.fn().mockReturnValue(new Set()),
        isKnownStruct: vi
          .fn()
          .mockImplementation((type) => type === "Point" || type === "Inner"),
      };

      const onBitAccess = vi.fn();

      const options = {
        firstId: "point",
        identifiers: ["point", "inner", "x"],
        expressions: [],
        children: createMockChildren(["point", ".", "inner", ".", "x"]),
        separatorOptions: { isStructParam: false, isCrossScope: false },
        generateExpression: simpleExprGen,
        initialTypeInfo: { isArray: false, baseType: "Point" },
        typeTracking: mockTypeTracking,
        onBitAccess,
      };

      const result = buildMemberAccessChain(options);
      expect(result.code).toBe("point.inner.x");
      // Should have checked Point and Inner as structs
      expect(mockTypeTracking.isKnownStruct).toHaveBeenCalledWith("Point");
      expect(mockTypeTracking.isKnownStruct).toHaveBeenCalledWith("Inner");
    });

    it("should handle undefined array fields gracefully", () => {
      // When getStructArrayFields returns undefined, lastMemberIsArray should default to false
      const mockTypeTracking = {
        getStructFields: vi.fn().mockReturnValue(new Map([["value", "u8"]])),
        getStructArrayFields: vi.fn().mockReturnValue(undefined), // Returns undefined
        isKnownStruct: vi.fn().mockImplementation((type) => type === "Data"),
      };

      const options = {
        firstId: "data",
        identifiers: ["data", "value"],
        expressions: [],
        children: createMockChildren(["data", ".", "value"]),
        separatorOptions: { isStructParam: false, isCrossScope: false },
        generateExpression: simpleExprGen,
        initialTypeInfo: { isArray: false, baseType: "Data" },
        typeTracking: mockTypeTracking,
      };

      const result = buildMemberAccessChain(options);
      expect(result.code).toBe("data.value");
    });

    it("should call onBitAccess when accessing primitive integer field with subscript", () => {
      // items[0].byte[7] -> bit access on u8 field
      const mockTypeTracking = {
        getStructFields: vi.fn().mockReturnValue(new Map([["byte", "u8"]])),
        getStructArrayFields: vi.fn().mockReturnValue(new Set()),
        isKnownStruct: vi.fn().mockImplementation((type) => type === "Item"),
      };

      const onBitAccess = vi.fn().mockReturnValue("((items[0].byte >> 7) & 1)");

      const options = {
        firstId: "items",
        identifiers: ["items", "byte"],
        expressions: ["0", "7"],
        children: createMockChildren([
          "items",
          "[",
          "0",
          "]",
          ".",
          "byte",
          "[",
          "7",
          "]",
        ]),
        separatorOptions: { isStructParam: false, isCrossScope: false },
        generateExpression: simpleExprGen,
        initialTypeInfo: { isArray: true, baseType: "Item" },
        typeTracking: mockTypeTracking,
        onBitAccess,
      };

      const result = buildMemberAccessChain(options);
      expect(onBitAccess).toHaveBeenCalledWith("items[0].byte", "7", "u8");
      expect(result.code).toBe("((items[0].byte >> 7) & 1)");
    });

    it("should not trigger bit access for array fields", () => {
      // items[0].indices[12] -> normal array access, not bit access
      const mockTypeTracking = {
        getStructFields: vi.fn().mockReturnValue(new Map([["indices", "u8"]])),
        getStructArrayFields: vi.fn().mockReturnValue(new Set(["indices"])), // indices IS an array
        isKnownStruct: vi.fn().mockImplementation((type) => type === "Item"),
      };

      const onBitAccess = vi.fn();

      const options = {
        firstId: "items",
        identifiers: ["items", "indices"],
        expressions: ["0", "12"],
        children: createMockChildren([
          "items",
          "[",
          "0",
          "]",
          ".",
          "indices",
          "[",
          "12",
          "]",
        ]),
        separatorOptions: { isStructParam: false, isCrossScope: false },
        generateExpression: simpleExprGen,
        initialTypeInfo: { isArray: true, baseType: "Item" },
        typeTracking: mockTypeTracking,
        onBitAccess,
      };

      const result = buildMemberAccessChain(options);
      expect(onBitAccess).not.toHaveBeenCalled();
      expect(result.code).toBe("items[0].indices[12]");
    });
  });

  describe("edge cases", () => {
    it("should handle single identifier with subscript", () => {
      // arr[0]
      const options = {
        firstId: "arr",
        identifiers: ["arr"],
        expressions: ["0"],
        children: createMockChildren(["arr", "[", "0", "]"]),
        separatorOptions: { isStructParam: false, isCrossScope: false },
        generateExpression: simpleExprGen,
      };

      const result = buildMemberAccessChain(options);
      expect(result.code).toBe("arr[0]");
    });

    it("should handle complex expression in subscript", () => {
      // cfg.items[i + 1]
      const options = {
        firstId: "cfg",
        identifiers: ["cfg", "items"],
        expressions: ["expr_placeholder"],
        children: createMockChildren(["cfg", ".", "items", "[", "i + 1", "]"]),
        separatorOptions: { isStructParam: false, isCrossScope: false },
        generateExpression: () => "i + 1", // Mock that generates "i + 1"
      };

      const result = buildMemberAccessChain(options);
      expect(result.code).toBe("cfg.items[i + 1]");
    });
  });
});
