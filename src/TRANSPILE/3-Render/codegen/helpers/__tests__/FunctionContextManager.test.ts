/**
 * Unit tests for FunctionContextManager
 *
 * Issue #793: Tests for the extracted function context manager.
 *
 * #1445: the manager reads planned parameters, so these build values rather
 * than mock parse contexts cast `as never` -- a cast that made the whole
 * surface invisible to the type checker, the same hole slices 12, 14 and 15
 * found elsewhere.
 *
 * Two describes went with the methods they covered. `getStringCapacity` and
 * `extractParamArrayDimensions` read a `TypeContext` and a `ParameterContext`
 * and nothing else; their work is `CodeGenerator.planFunctionParameter`'s now,
 * and the 1259 integration fixtures exercise it. `resolveParameterTypeInfo`'s
 * qualified/scoped/global cases are likewise `TypeBinding`'s answer, supplied
 * here as the classification rather than re-derived.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import FunctionContextManager from "../FunctionContextManager";
import IFunctionContextCallbacks from "../../types/IFunctionContextCallbacks";
import CodeGenState from "../../../../../transpiler/state/CodeGenState";
import type IPlannedType from "../../types/IPlannedType";
import type IPlannedFunctionParameter from "../../types/IPlannedFunctionParameter";
import type INamedTypeResolution from "../../../../../transpiler/types/INamedTypeResolution";

/**
 * Helper to set up CodeGenState.symbols with minimal fields.
 */
function setupSymbols(
  overrides: {
    knownEnums?: Set<string>;
    knownBitmaps?: Set<string>;
    bitmapBitWidth?: Map<string, number>;
  } = {},
): void {
  CodeGenState.symbols = {
    knownScopes: new Set(),
    knownStructs: new Set(),
    knownRegisters: new Set(),
    knownEnums: overrides.knownEnums ?? new Set(),
    knownBitmaps: overrides.knownBitmaps ?? new Set(),
    knownVariables: new Set(),
    scopeMembers: new Map(),
    scopeMemberVisibility: new Map(),
    structFields: new Map(),
    structFieldArrays: new Map(),
    structFieldDimensions: new Map(),
    enumMembers: new Map(),
    bitmapFields: new Map(),
    bitmapBackingType: new Map(),
    bitmapBitWidth: overrides.bitmapBitWidth ?? new Map(),
    scopedRegisters: new Map(),
    registerMemberAccess: new Map(),
    registerMemberTypes: new Map(),
    registerBaseAddresses: new Map(),
    registerMemberOffsets: new Map(),
    registerMemberCTypes: new Map(),
    scopePrivateConstValues: new Map(),
    functionReturnTypes: new Map(),
  };
}

/**
 * Default callbacks for testing.
 */
function createMockCallbacks(): IFunctionContextCallbacks {
  return {
    isStructType: vi.fn(() => false),
  };
}

/** A planned type with every alternative absent unless a test fills one in. */
function plannedType(overrides: Partial<IPlannedType> = {}): IPlannedType {
  return {
    named: null,
    isString: false,
    stringTypeText: undefined,
    primitiveName: null,
    isArray: false,
    userTypeLine: undefined,
    text: "",
    ...overrides,
  };
}

/** A named-type branch as `TypeBinding` reports it. */
function named(
  branch: INamedTypeResolution["branch"],
  written: string,
  name: string = written,
): INamedTypeResolution {
  return { branch, written, name };
}

/** A planned parameter, with the type's alternatives already classified. */
function plannedParam(
  name: string,
  type: IPlannedType,
  overrides: Partial<IPlannedFunctionParameter> = {},
): IPlannedFunctionParameter {
  return {
    name,
    isConst: false,
    isArray: false,
    arrayDimensions: [],
    stringCapacity: undefined,
    type,
    ...overrides,
  };
}

describe("FunctionContextManager", () => {
  beforeEach(() => {
    CodeGenState.reset();
    setupSymbols();
  });

  describe("resolveReturnTypeAndParams", () => {
    it("returns int for main with args, and records the args name", () => {
      const result = FunctionContextManager.resolveReturnTypeAndParams(
        "main",
        "void",
        true,
        "args",
      );

      expect(result.actualReturnType).toBe("int");
      expect(result.initialParams).toBe("int argc, char *argv[]");
      expect(CodeGenState.mainArgsName).toBe("args");
    });

    it("returns int for main without args", () => {
      const result = FunctionContextManager.resolveReturnTypeAndParams(
        "main",
        "void",
        false,
        undefined,
      );

      expect(result.actualReturnType).toBe("int");
      expect(result.initialParams).toBe("");
    });

    it("preserves return type for non-main functions", () => {
      const result = FunctionContextManager.resolveReturnTypeAndParams(
        "myFunc",
        "u32",
        false,
        undefined,
      );

      expect(result.actualReturnType).toBe("u32");
      expect(result.initialParams).toBe("");
    });
  });

  describe("processParameterList", () => {
    it("clears existing parameters", () => {
      CodeGenState.currentParameters.set("existing", {
        name: "existing",
        baseType: "u32",
        isArray: false,
        isStruct: false,
        isConst: false,
        isCallback: false,
        isString: false,
      });
      const callbacks = createMockCallbacks();

      FunctionContextManager.processParameterList(null, callbacks);

      expect(CodeGenState.currentParameters.size).toBe(0);
    });

    it("processes multiple parameters", () => {
      const callbacks = createMockCallbacks();

      FunctionContextManager.processParameterList(
        [
          plannedParam("x", plannedType({ primitiveName: "u32" })),
          plannedParam("y", plannedType({ primitiveName: "i32" })),
        ],
        callbacks,
      );

      expect(CodeGenState.currentParameters.size).toBe(2);
      expect(CodeGenState.currentParameters.has("x")).toBe(true);
      expect(CodeGenState.currentParameters.has("y")).toBe(true);
    });
  });

  describe("processParameter", () => {
    it("registers primitive parameter", () => {
      const callbacks = createMockCallbacks();

      FunctionContextManager.processParameter(
        plannedParam("x", plannedType({ primitiveName: "u32" })),
        callbacks,
        0,
      );

      const paramInfo = CodeGenState.currentParameters.get("x");
      expect(paramInfo).toBeDefined();
      expect(paramInfo!.baseType).toBe("u32");
      expect(paramInfo!.isArray).toBe(false);
      expect(paramInfo!.isStruct).toBe(false);
    });

    it("registers array parameter", () => {
      const callbacks = createMockCallbacks();

      FunctionContextManager.processParameter(
        plannedParam(
          "arr",
          plannedType({ primitiveName: "u8", isArray: true }),
          {
            isArray: true,
            arrayDimensions: [8],
          },
        ),
        callbacks,
        0,
      );

      const paramInfo = CodeGenState.currentParameters.get("arr");
      expect(paramInfo).toBeDefined();
      expect(paramInfo!.isArray).toBe(true);
    });

    it("registers const parameter", () => {
      const callbacks = createMockCallbacks();

      FunctionContextManager.processParameter(
        plannedParam("x", plannedType({ primitiveName: "u32" }), {
          isConst: true,
        }),
        callbacks,
        0,
      );

      const paramInfo = CodeGenState.currentParameters.get("x");
      expect(paramInfo).toBeDefined();
      expect(paramInfo!.isConst).toBe(true);
    });

    it("registers struct parameter using callback", () => {
      const callbacks = createMockCallbacks();
      (callbacks.isStructType as ReturnType<typeof vi.fn>).mockReturnValue(
        true,
      );

      FunctionContextManager.processParameter(
        plannedParam("point", plannedType({ named: named("bare", "Point") })),
        callbacks,
        0,
      );

      const paramInfo = CodeGenState.currentParameters.get("point");
      expect(paramInfo).toBeDefined();
      expect(paramInfo!.isStruct).toBe(true);
      expect(callbacks.isStructType).toHaveBeenCalledWith("Point");
    });

    it("registers string parameter", () => {
      const callbacks = createMockCallbacks();

      FunctionContextManager.processParameter(
        plannedParam(
          "name",
          plannedType({ isString: true, stringTypeText: "string<32>" }),
          { stringCapacity: 32 },
        ),
        callbacks,
        0,
      );

      const paramInfo = CodeGenState.currentParameters.get("name");
      expect(paramInfo).toBeDefined();
      expect(paramInfo!.isString).toBe(true);
    });
  });

  describe("resolveParameterTypeInfo", () => {
    it("resolves primitive type", () => {
      const result = FunctionContextManager.resolveParameterTypeInfo(
        plannedType({ primitiveName: "u32", text: "u32" }),
        createMockCallbacks(),
      );

      expect(result.typeName).toBe("u32");
      expect(result.isStruct).toBe(false);
      expect(result.isCallback).toBe(false);
      expect(result.isString).toBe(false);
    });

    it("resolves user type and checks struct", () => {
      const callbacks = createMockCallbacks();
      (callbacks.isStructType as ReturnType<typeof vi.fn>).mockReturnValue(
        true,
      );

      const result = FunctionContextManager.resolveParameterTypeInfo(
        plannedType({ named: named("bare", "Point"), text: "Point" }),
        callbacks,
      );

      expect(result.typeName).toBe("Point");
      expect(result.isStruct).toBe(true);
    });

    /**
     * The four named branches arrive already resolved -- `TypeBinding` decided
     * them, and what it decided is its own test's business. What THIS module
     * decides is the consequence: struct-ness, callback-ness, and that the
     * name is used verbatim.
     */
    it.each<[string, INamedTypeResolution, string]>([
      [
        "a qualified type",
        named("qualified", "Scope.Type", "Scope__Type"),
        "Scope__Type",
      ],
      [
        "a scoped type",
        named("this", "LocalType", "MyScope__LocalType"),
        "MyScope__LocalType",
      ],
      ["a global type", named("global", "GlobalType"), "GlobalType"],
    ])("uses the resolved name for %s", (_label, resolution, expected) => {
      const result = FunctionContextManager.resolveParameterTypeInfo(
        plannedType({ named: resolution, text: resolution.written }),
        createMockCallbacks(),
      );

      expect(result.typeName).toBe(expected);
    });

    it("resolves a top-level string to the bare name", () => {
      const result = FunctionContextManager.resolveParameterTypeInfo(
        plannedType({
          isString: true,
          stringTypeText: "string<32>",
          text: "string<32>",
        }),
        createMockCallbacks(),
      );

      // The capacity travels separately, through stringCapacities.
      expect(result.typeName).toBe("string");
      expect(result.isString).toBe(true);
    });

    it("keeps the written text for a string ARRAY element", () => {
      const result = FunctionContextManager.resolveParameterTypeInfo(
        plannedType({
          isString: true,
          isArray: true,
          stringTypeText: "string<32>",
          text: "string<32>[5]",
        }),
        createMockCallbacks(),
      );

      expect(result.typeName).toBe("string<32>");
      expect(result.isString).toBe(true);
    });

    it("resolves an array of primitives to the element type", () => {
      const result = FunctionContextManager.resolveParameterTypeInfo(
        plannedType({ primitiveName: "u8", isArray: true, text: "u8[10]" }),
        createMockCallbacks(),
      );

      expect(result.typeName).toBe("u8");
      expect(result.isStruct).toBe(false);
    });

    it("resolves an array of user types to the element type", () => {
      const callbacks = createMockCallbacks();
      (callbacks.isStructType as ReturnType<typeof vi.fn>).mockReturnValue(
        true,
      );

      const result = FunctionContextManager.resolveParameterTypeInfo(
        plannedType({
          named: named("bare", "Point"),
          isArray: true,
          text: "Point[5]",
        }),
        callbacks,
      );

      expect(result.typeName).toBe("Point");
      expect(result.isStruct).toBe(true);
    });

    it("returns fallback for unknown type", () => {
      const result = FunctionContextManager.resolveParameterTypeInfo(
        plannedType({ text: "SomeUnknownType" }),
        createMockCallbacks(),
      );

      expect(result.typeName).toBe("SomeUnknownType");
      expect(result.isStruct).toBe(false);
      expect(result.isCallback).toBe(false);
      expect(result.isString).toBe(false);
    });
  });

  describe("registerParameterType", () => {
    it("registers parameter in type registry", () => {
      FunctionContextManager.registerParameterType(
        {
          typeName: "u32",
          isStruct: false,
          isCallback: false,
          isString: false,
        },
        plannedParam("x", plannedType({ primitiveName: "u32" })),
      );

      const typeInfo = CodeGenState.getVariableTypeInfo("x");
      expect(typeInfo).toBeDefined();
      expect(typeInfo!.baseType).toBe("u32");
      expect(typeInfo!.isParameter).toBe(true);
    });

    it("registers enum parameter with enumTypeName", () => {
      setupSymbols({ knownEnums: new Set(["Color"]) });

      FunctionContextManager.registerParameterType(
        {
          typeName: "Color",
          isStruct: false,
          isCallback: false,
          isString: false,
        },
        plannedParam("color", plannedType({ named: named("bare", "Color") })),
      );

      const typeInfo = CodeGenState.getVariableTypeInfo("color");
      expect(typeInfo).toBeDefined();
      expect(typeInfo!.isEnum).toBe(true);
      expect(typeInfo!.enumTypeName).toBe("Color");
    });

    it("registers bitmap parameter with bitWidth", () => {
      setupSymbols({
        knownBitmaps: new Set(["Flags"]),
        bitmapBitWidth: new Map([["Flags", 8]]),
      });

      FunctionContextManager.registerParameterType(
        {
          typeName: "Flags",
          isStruct: false,
          isCallback: false,
          isString: false,
        },
        plannedParam("flags", plannedType({ named: named("bare", "Flags") })),
      );

      const typeInfo = CodeGenState.getVariableTypeInfo("flags");
      expect(typeInfo).toBeDefined();
      expect(typeInfo!.isBitmap).toBe(true);
      expect(typeInfo!.bitmapTypeName).toBe("Flags");
      expect(typeInfo!.bitWidth).toBe(8);
    });

    it("appends the null terminator to a string array's dimensions", () => {
      FunctionContextManager.registerParameterType(
        {
          typeName: "string<32>",
          isStruct: false,
          isCallback: false,
          isString: true,
        },
        plannedParam("names", plannedType({ isString: true, isArray: true }), {
          isArray: true,
          arrayDimensions: [5],
          stringCapacity: 32,
        }),
      );

      const typeInfo = CodeGenState.getVariableTypeInfo("names");
      expect(typeInfo!.arrayDimensions).toEqual([5, 33]);
    });
  });

  describe("clearParameters", () => {
    it("removes parameters from type registry", () => {
      CodeGenState.currentParameters.set("x", {
        name: "x",
        baseType: "u32",
        isArray: false,
        isStruct: false,
        isConst: false,
        isCallback: false,
        isString: false,
      });
      CodeGenState.setVariableTypeInfo("x", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
        isParameter: true,
      });

      FunctionContextManager.clearParameters();

      expect(CodeGenState.getVariableTypeInfo("x")).toBeUndefined();
    });

    it("clears currentParameters map", () => {
      CodeGenState.currentParameters.set("x", {
        name: "x",
        baseType: "u32",
        isArray: false,
        isStruct: false,
        isConst: false,
        isCallback: false,
        isString: false,
      });

      FunctionContextManager.clearParameters();

      expect(CodeGenState.currentParameters.size).toBe(0);
    });

    it("clears localArrays set", () => {
      CodeGenState.localArrays.add("arr");

      FunctionContextManager.clearParameters();

      expect(CodeGenState.localArrays.size).toBe(0);
    });
  });

  describe("enterFunctionBody", () => {
    it("sets inFunctionBody to true", () => {
      CodeGenState.inFunctionBody = false;

      FunctionContextManager.enterFunctionBody();

      expect(CodeGenState.inFunctionBody).toBe(true);
    });

    it("clears local variables", () => {
      CodeGenState.localVariables.add("var");

      FunctionContextManager.enterFunctionBody();

      expect(CodeGenState.localVariables.size).toBe(0);
    });

    it("clears float bit shadows", () => {
      CodeGenState.floatBitShadows.add("shadow");

      FunctionContextManager.enterFunctionBody();

      expect(CodeGenState.floatBitShadows.size).toBe(0);
    });
  });

  describe("exitFunctionBody", () => {
    it("sets inFunctionBody to false", () => {
      CodeGenState.inFunctionBody = true;

      FunctionContextManager.exitFunctionBody();

      expect(CodeGenState.inFunctionBody).toBe(false);
    });

    it("clears mainArgsName", () => {
      CodeGenState.mainArgsName = "args";

      FunctionContextManager.exitFunctionBody();

      expect(CodeGenState.mainArgsName).toBeNull();
    });
  });
});
