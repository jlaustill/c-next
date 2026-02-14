/**
 * Unit tests for FunctionContextManager
 *
 * Issue #793: Tests for the extracted function context manager.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import FunctionContextManager from "../FunctionContextManager.js";
import IFunctionContextCallbacks from "../../types/IFunctionContextCallbacks.js";
import CodeGenState from "../../../../state/CodeGenState.js";

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
    scopeVariableUsage: new Map(),
    scopePrivateConstValues: new Map(),
    functionReturnTypes: new Map(),
    getSingleFunctionForVariable: () => null,
    hasPublicSymbols: () => false,
  };
}

/**
 * Default callbacks for testing.
 */
function createMockCallbacks(): IFunctionContextCallbacks {
  return {
    isStructType: vi.fn(() => false),
    resolveQualifiedType: vi.fn((ids: string[]) => ids.join("_")),
  };
}

/**
 * Helper to create a mock parameter context.
 */
function createMockParam(
  name: string,
  typeText: string,
  options: {
    isArray?: boolean;
    isConst?: boolean;
    isPrimitive?: boolean;
    isUserType?: boolean;
    isString?: boolean;
    stringCapacity?: number;
  } = {},
): never {
  const {
    isArray,
    isConst,
    isPrimitive,
    isUserType,
    isString,
    stringCapacity,
  } = options;

  return {
    IDENTIFIER: () => ({ getText: () => name }),
    arrayDimension: () => (isArray ? [{ expression: () => null }] : []),
    constModifier: () => (isConst ? {} : null),
    type: () => ({
      getText: () => typeText,
      primitiveType: () => (isPrimitive ? { getText: () => typeText } : null),
      userType: () => (isUserType ? { getText: () => typeText } : null),
      qualifiedType: () => null,
      scopedType: () => null,
      globalType: () => null,
      stringType: () =>
        isString
          ? {
              getText: () =>
                stringCapacity ? `string<${stringCapacity}>` : "string",
              INTEGER_LITERAL: () =>
                stringCapacity
                  ? { getText: () => String(stringCapacity) }
                  : null,
            }
          : null,
      arrayType: () => null,
    }),
  } as never;
}

/**
 * Helper to create a mock function declaration context.
 */
function createMockFunctionDecl(
  name: string,
  returnType: string,
  params: never[] = [],
): never {
  return {
    type: () => ({
      getText: () => returnType,
    }),
    parameterList: () =>
      params.length > 0
        ? {
            parameter: () => params,
          }
        : null,
  } as never;
}

describe("FunctionContextManager", () => {
  beforeEach(() => {
    CodeGenState.reset();
    setupSymbols();
  });

  describe("setupFunctionContext", () => {
    it("sets current function name without scope", () => {
      const callbacks = createMockCallbacks();
      const ctx = createMockFunctionDecl("myFunc", "void");

      FunctionContextManager.setupFunctionContext("myFunc", ctx, callbacks);

      expect(CodeGenState.currentFunctionName).toBe("myFunc");
    });

    it("sets current function name with scope prefix", () => {
      CodeGenState.currentScope = "MyScope";
      const callbacks = createMockCallbacks();
      const ctx = createMockFunctionDecl("myFunc", "void");

      FunctionContextManager.setupFunctionContext("myFunc", ctx, callbacks);

      expect(CodeGenState.currentFunctionName).toBe("MyScope_myFunc");
    });

    it("sets current function return type", () => {
      const callbacks = createMockCallbacks();
      const ctx = createMockFunctionDecl("myFunc", "u32");

      FunctionContextManager.setupFunctionContext("myFunc", ctx, callbacks);

      expect(CodeGenState.currentFunctionReturnType).toBe("u32");
    });

    it("sets inFunctionBody to true", () => {
      const callbacks = createMockCallbacks();
      const ctx = createMockFunctionDecl("myFunc", "void");

      FunctionContextManager.setupFunctionContext("myFunc", ctx, callbacks);

      expect(CodeGenState.inFunctionBody).toBe(true);
    });

    it("clears local variables", () => {
      CodeGenState.localVariables.add("existingVar");
      const callbacks = createMockCallbacks();
      const ctx = createMockFunctionDecl("myFunc", "void");

      FunctionContextManager.setupFunctionContext("myFunc", ctx, callbacks);

      expect(CodeGenState.localVariables.size).toBe(0);
    });

    it("processes parameters when present", () => {
      const callbacks = createMockCallbacks();
      const params = [createMockParam("x", "u32", { isPrimitive: true })];
      const ctx = createMockFunctionDecl("myFunc", "void", params);

      FunctionContextManager.setupFunctionContext("myFunc", ctx, callbacks);

      expect(CodeGenState.currentParameters.has("x")).toBe(true);
    });
  });

  describe("cleanupFunctionContext", () => {
    it("resets inFunctionBody to false", () => {
      CodeGenState.inFunctionBody = true;

      FunctionContextManager.cleanupFunctionContext();

      expect(CodeGenState.inFunctionBody).toBe(false);
    });

    it("clears local variables", () => {
      CodeGenState.localVariables.add("localVar");

      FunctionContextManager.cleanupFunctionContext();

      expect(CodeGenState.localVariables.size).toBe(0);
    });

    it("clears float bit shadows", () => {
      CodeGenState.floatBitShadows.add("shadow1");

      FunctionContextManager.cleanupFunctionContext();

      expect(CodeGenState.floatBitShadows.size).toBe(0);
    });

    it("clears mainArgsName", () => {
      CodeGenState.mainArgsName = "args";

      FunctionContextManager.cleanupFunctionContext();

      expect(CodeGenState.mainArgsName).toBeNull();
    });

    it("clears currentFunctionName", () => {
      CodeGenState.currentFunctionName = "myFunc";

      FunctionContextManager.cleanupFunctionContext();

      expect(CodeGenState.currentFunctionName).toBeNull();
    });

    it("clears currentFunctionReturnType", () => {
      CodeGenState.currentFunctionReturnType = "u32";

      FunctionContextManager.cleanupFunctionContext();

      expect(CodeGenState.currentFunctionReturnType).toBeNull();
    });

    it("clears parameters", () => {
      CodeGenState.currentParameters.set("x", {
        name: "x",
        baseType: "u32",
        isArray: false,
        isStruct: false,
        isConst: false,
        isCallback: false,
        isString: false,
      });

      FunctionContextManager.cleanupFunctionContext();

      expect(CodeGenState.currentParameters.size).toBe(0);
    });
  });

  describe("resolveReturnTypeAndParams", () => {
    it("returns int for main with args", () => {
      const params = [createMockParam("args", "u8", { isArray: true })];
      const ctx = createMockFunctionDecl("main", "void", params);

      const result = FunctionContextManager.resolveReturnTypeAndParams(
        "main",
        "void",
        true,
        ctx,
      );

      expect(result.actualReturnType).toBe("int");
      expect(result.initialParams).toBe("int argc, char *argv[]");
      expect(CodeGenState.mainArgsName).toBe("args");
    });

    it("returns int for main without args", () => {
      const ctx = createMockFunctionDecl("main", "void");

      const result = FunctionContextManager.resolveReturnTypeAndParams(
        "main",
        "void",
        false,
        ctx,
      );

      expect(result.actualReturnType).toBe("int");
      expect(result.initialParams).toBe("");
    });

    it("preserves return type for non-main functions", () => {
      const ctx = createMockFunctionDecl("myFunc", "u32");

      const result = FunctionContextManager.resolveReturnTypeAndParams(
        "myFunc",
        "u32",
        false,
        ctx,
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
      const params = {
        parameter: () => [
          createMockParam("x", "u32", { isPrimitive: true }),
          createMockParam("y", "i32", { isPrimitive: true }),
        ],
      } as never;

      FunctionContextManager.processParameterList(params, callbacks);

      expect(CodeGenState.currentParameters.size).toBe(2);
      expect(CodeGenState.currentParameters.has("x")).toBe(true);
      expect(CodeGenState.currentParameters.has("y")).toBe(true);
    });
  });

  describe("processParameter", () => {
    it("registers primitive parameter", () => {
      const callbacks = createMockCallbacks();
      const param = createMockParam("x", "u32", { isPrimitive: true });

      FunctionContextManager.processParameter(param, callbacks);

      const paramInfo = CodeGenState.currentParameters.get("x");
      expect(paramInfo).toBeDefined();
      expect(paramInfo!.baseType).toBe("u32");
      expect(paramInfo!.isArray).toBe(false);
      expect(paramInfo!.isStruct).toBe(false);
    });

    it("registers array parameter", () => {
      const callbacks = createMockCallbacks();
      const param = createMockParam("arr", "u8", {
        isPrimitive: true,
        isArray: true,
      });

      FunctionContextManager.processParameter(param, callbacks);

      const paramInfo = CodeGenState.currentParameters.get("arr");
      expect(paramInfo).toBeDefined();
      expect(paramInfo!.isArray).toBe(true);
    });

    it("registers const parameter", () => {
      const callbacks = createMockCallbacks();
      const param = createMockParam("x", "u32", {
        isPrimitive: true,
        isConst: true,
      });

      FunctionContextManager.processParameter(param, callbacks);

      const paramInfo = CodeGenState.currentParameters.get("x");
      expect(paramInfo).toBeDefined();
      expect(paramInfo!.isConst).toBe(true);
    });

    it("registers struct parameter using callback", () => {
      const callbacks = createMockCallbacks();
      (callbacks.isStructType as ReturnType<typeof vi.fn>).mockReturnValue(
        true,
      );
      const param = createMockParam("point", "Point", { isUserType: true });

      FunctionContextManager.processParameter(param, callbacks);

      const paramInfo = CodeGenState.currentParameters.get("point");
      expect(paramInfo).toBeDefined();
      expect(paramInfo!.isStruct).toBe(true);
      expect(callbacks.isStructType).toHaveBeenCalledWith("Point");
    });

    it("registers string parameter", () => {
      const callbacks = createMockCallbacks();
      const param = createMockParam("name", "string<32>", {
        isString: true,
        stringCapacity: 32,
      });

      FunctionContextManager.processParameter(param, callbacks);

      const paramInfo = CodeGenState.currentParameters.get("name");
      expect(paramInfo).toBeDefined();
      expect(paramInfo!.isString).toBe(true);
    });
  });

  describe("resolveParameterTypeInfo", () => {
    it("resolves primitive type", () => {
      const callbacks = createMockCallbacks();
      const typeCtx = {
        primitiveType: () => ({ getText: () => "u32" }),
        userType: () => null,
        qualifiedType: () => null,
        scopedType: () => null,
        globalType: () => null,
        stringType: () => null,
        arrayType: () => null,
        getText: () => "u32",
      } as never;

      const result = FunctionContextManager.resolveParameterTypeInfo(
        typeCtx,
        callbacks,
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
      const typeCtx = {
        primitiveType: () => null,
        userType: () => ({ getText: () => "Point" }),
        qualifiedType: () => null,
        scopedType: () => null,
        globalType: () => null,
        stringType: () => null,
        arrayType: () => null,
        getText: () => "Point",
      } as never;

      const result = FunctionContextManager.resolveParameterTypeInfo(
        typeCtx,
        callbacks,
      );

      expect(result.typeName).toBe("Point");
      expect(result.isStruct).toBe(true);
    });

    it("resolves qualified type using callback", () => {
      const callbacks = createMockCallbacks();
      const typeCtx = {
        primitiveType: () => null,
        userType: () => null,
        qualifiedType: () => ({
          IDENTIFIER: () => [
            { getText: () => "Scope" },
            { getText: () => "Type" },
          ],
        }),
        scopedType: () => null,
        globalType: () => null,
        stringType: () => null,
        arrayType: () => null,
        getText: () => "Scope.Type",
      } as never;

      const result = FunctionContextManager.resolveParameterTypeInfo(
        typeCtx,
        callbacks,
      );

      expect(callbacks.resolveQualifiedType).toHaveBeenCalledWith([
        "Scope",
        "Type",
      ]);
      expect(result.typeName).toBe("Scope_Type");
    });

    it("resolves scoped type with current scope", () => {
      CodeGenState.currentScope = "MyScope";
      const callbacks = createMockCallbacks();
      const typeCtx = {
        primitiveType: () => null,
        userType: () => null,
        qualifiedType: () => null,
        scopedType: () => ({
          IDENTIFIER: () => ({ getText: () => "LocalType" }),
        }),
        globalType: () => null,
        stringType: () => null,
        arrayType: () => null,
        getText: () => "this.LocalType",
      } as never;

      const result = FunctionContextManager.resolveParameterTypeInfo(
        typeCtx,
        callbacks,
      );

      expect(result.typeName).toBe("MyScope_LocalType");
    });

    it("resolves global type", () => {
      const callbacks = createMockCallbacks();
      const typeCtx = {
        primitiveType: () => null,
        userType: () => null,
        qualifiedType: () => null,
        scopedType: () => null,
        globalType: () => ({
          IDENTIFIER: () => ({ getText: () => "GlobalType" }),
        }),
        stringType: () => null,
        arrayType: () => null,
        getText: () => "global.GlobalType",
      } as never;

      const result = FunctionContextManager.resolveParameterTypeInfo(
        typeCtx,
        callbacks,
      );

      expect(result.typeName).toBe("GlobalType");
    });

    it("resolves string type", () => {
      const callbacks = createMockCallbacks();
      const typeCtx = {
        primitiveType: () => null,
        userType: () => null,
        qualifiedType: () => null,
        scopedType: () => null,
        globalType: () => null,
        stringType: () => ({
          getText: () => "string<32>",
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
        arrayType: () => null,
        getText: () => "string<32>",
      } as never;

      const result = FunctionContextManager.resolveParameterTypeInfo(
        typeCtx,
        callbacks,
      );

      expect(result.typeName).toBe("string");
      expect(result.isString).toBe(true);
    });
  });

  describe("registerParameterType", () => {
    it("registers parameter in type registry", () => {
      const param = createMockParam("x", "u32", { isPrimitive: true });

      FunctionContextManager.registerParameterType(
        "x",
        {
          typeName: "u32",
          isStruct: false,
          isCallback: false,
          isString: false,
        },
        param,
        false,
        false,
      );

      const typeInfo = CodeGenState.getVariableTypeInfo("x");
      expect(typeInfo).toBeDefined();
      expect(typeInfo!.baseType).toBe("u32");
      expect(typeInfo!.isParameter).toBe(true);
    });

    it("registers enum parameter with enumTypeName", () => {
      setupSymbols({ knownEnums: new Set(["Color"]) });
      const param = createMockParam("color", "Color", { isUserType: true });

      FunctionContextManager.registerParameterType(
        "color",
        {
          typeName: "Color",
          isStruct: false,
          isCallback: false,
          isString: false,
        },
        param,
        false,
        false,
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
      const param = createMockParam("flags", "Flags", { isUserType: true });

      FunctionContextManager.registerParameterType(
        "flags",
        {
          typeName: "Flags",
          isStruct: false,
          isCallback: false,
          isString: false,
        },
        param,
        false,
        false,
      );

      const typeInfo = CodeGenState.getVariableTypeInfo("flags");
      expect(typeInfo).toBeDefined();
      expect(typeInfo!.isBitmap).toBe(true);
      expect(typeInfo!.bitmapTypeName).toBe("Flags");
      expect(typeInfo!.bitWidth).toBe(8);
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

  describe("getStringCapacity", () => {
    it("returns undefined for non-string types", () => {
      const typeCtx = {
        stringType: () => null,
        arrayType: () => null,
      } as never;

      const result = FunctionContextManager.getStringCapacity(typeCtx, false);

      expect(result).toBeUndefined();
    });

    it("extracts capacity from direct string type", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
        arrayType: () => null,
      } as never;

      const result = FunctionContextManager.getStringCapacity(typeCtx, true);

      expect(result).toBe(32);
    });

    it("extracts capacity from array of strings", () => {
      const typeCtx = {
        stringType: () => null,
        arrayType: () => ({
          stringType: () => ({
            INTEGER_LITERAL: () => ({ getText: () => "64" }),
          }),
        }),
      } as never;

      const result = FunctionContextManager.getStringCapacity(typeCtx, true);

      expect(result).toBe(64);
    });
  });

  describe("extractParamArrayDimensions", () => {
    it("returns empty array for non-array parameters", () => {
      const param = createMockParam("x", "u32", { isPrimitive: true });
      const typeCtx = {
        arrayType: () => null,
      } as never;

      const result = FunctionContextManager.extractParamArrayDimensions(
        param,
        typeCtx,
        false,
      );

      expect(result).toEqual([]);
    });
  });
});
