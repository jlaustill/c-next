/**
 * Tests for CodeGenState - centralized code generation state management
 */

import { describe, it, expect, beforeEach } from "vitest";
import CodeGenState from "../CodeGenState";
import TTypeInfo from "../../output/codegen/types/TTypeInfo";
import ICodeGenSymbols from "../../types/ICodeGenSymbols";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import IVariableSymbol from "../../types/symbols/IVariableSymbol";
import ICVariableSymbol from "../../types/symbols/c/ICVariableSymbol";
import TestScopeUtils from "../../logic/symbols/cnext/__tests__/testUtils";
import TTypeUtils from "../../../utils/TTypeUtils";

/**
 * Create a minimal C-Next IVariableSymbol for testing.
 */
function createCNextVariableSymbol(
  overrides: Partial<IVariableSymbol> & { name: string },
): IVariableSymbol {
  return {
    kind: "variable",
    name: overrides.name,
    sourceFile: overrides.sourceFile ?? "test.cnx",
    sourceLine: overrides.sourceLine ?? 1,
    sourceLanguage: ESourceLanguage.CNext,
    isExported: overrides.isExported ?? false,
    scope: overrides.scope ?? TestScopeUtils.createMockGlobalScope(),
    type: overrides.type ?? TTypeUtils.createPrimitive("u32"),
    isConst: overrides.isConst ?? false,
    isAtomic: overrides.isAtomic ?? false,
    isArray: overrides.isArray ?? false,
    arrayDimensions: overrides.arrayDimensions,
  };
}

/**
 * Create a minimal C ICVariableSymbol for testing.
 */
function createCVariableSymbol(
  overrides: Partial<ICVariableSymbol> & { name: string; type: string },
): ICVariableSymbol {
  return {
    kind: "variable",
    name: overrides.name,
    sourceFile: overrides.sourceFile ?? "test.h",
    sourceLine: overrides.sourceLine ?? 1,
    sourceLanguage: ESourceLanguage.C,
    isExported: overrides.isExported ?? false,
    type: overrides.type,
    isConst: overrides.isConst,
    isArray: overrides.isArray,
    arrayDimensions: overrides.arrayDimensions,
  };
}

/**
 * Create a minimal mock ICodeGenSymbols with default empty collections.
 */
function createMockSymbols(
  overrides: Partial<{
    knownScopes: Set<string>;
    knownEnums: Set<string>;
    knownBitmaps: Set<string>;
    knownStructs: Set<string>;
    knownRegisters: Set<string>;
    enumMembers: Map<string, Map<string, number>>;
    structFields: Map<string, Map<string, string>>;
    structFieldArrays: Map<string, Set<string>>;
    functionReturnTypes: Map<string, string>;
    scopeMemberVisibility: Map<string, Map<string, "public" | "private">>;
    opaqueTypes: Set<string>;
  }> = {},
): ICodeGenSymbols {
  return {
    knownScopes: overrides.knownScopes ?? new Set(),
    knownEnums: overrides.knownEnums ?? new Set(),
    knownBitmaps: overrides.knownBitmaps ?? new Set(),
    knownStructs: overrides.knownStructs ?? new Set(),
    knownRegisters: overrides.knownRegisters ?? new Set(),
    scopeMembers: new Map(),
    scopeMemberVisibility: overrides.scopeMemberVisibility ?? new Map(),
    structFields: overrides.structFields ?? new Map(),
    structFieldArrays: overrides.structFieldArrays ?? new Map(),
    structFieldDimensions: new Map(),
    enumMembers: overrides.enumMembers ?? new Map(),
    bitmapFields: new Map(),
    bitmapBackingType: new Map(),
    bitmapBitWidth: new Map(),
    scopedRegisters: new Map(),
    registerMemberAccess: new Map(),
    registerMemberTypes: new Map(),
    registerBaseAddresses: new Map(),
    registerMemberOffsets: new Map(),
    registerMemberCTypes: new Map(),
    scopeVariableUsage: new Map(),
    scopePrivateConstValues: new Map(),
    functionReturnTypes: overrides.functionReturnTypes ?? new Map(),
    opaqueTypes: overrides.opaqueTypes ?? new Set(),
    getSingleFunctionForVariable: () => null,
    hasPublicSymbols: () => false,
  };
}

describe("CodeGenState", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  describe("reset()", () => {
    it("resets all state to initial values", () => {
      // Set some state
      CodeGenState.currentScope = "TestScope";
      CodeGenState.currentFunctionName = "testFunc";
      CodeGenState.needsStdint = true;
      CodeGenState.indentLevel = 5;

      // Reset
      CodeGenState.reset();

      // Verify reset
      expect(CodeGenState.currentScope).toBeNull();
      expect(CodeGenState.currentFunctionName).toBeNull();
      expect(CodeGenState.needsStdint).toBe(false);
      expect(CodeGenState.indentLevel).toBe(0);
    });

    it("resets generator reference", () => {
      // Simulate having a generator set
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      CodeGenState.generator = {} as any;

      CodeGenState.reset();

      expect(CodeGenState.generator).toBeNull();
    });

    it("accepts custom target capabilities", () => {
      const customTarget = {
        hasFPU: true,
        hasHardwareDivide: false,
        maxBitWidth: 32,
        hasAtomic: true,
        wordSize: 32 as const,
        hasLdrexStrex: true,
        hasBasepri: true,
      };

      CodeGenState.reset(customTarget);

      expect(CodeGenState.targetCapabilities).toEqual(customTarget);
    });
  });

  describe("Scope Member Helpers", () => {
    it("getScopeMembers returns undefined for unknown scope", () => {
      expect(CodeGenState.getScopeMembers("UnknownScope")).toBeUndefined();
    });

    it("getScopeMembers returns members for known scope", () => {
      const members = new Set(["member1", "member2"]);
      CodeGenState.setScopeMembers("TestScope", members);

      expect(CodeGenState.getScopeMembers("TestScope")).toBe(members);
    });

    it("isCurrentScopeMember returns false when not in a scope", () => {
      CodeGenState.currentScope = null;
      expect(CodeGenState.isCurrentScopeMember("anyMember")).toBe(false);
    });

    it("isCurrentScopeMember returns false for non-member", () => {
      CodeGenState.currentScope = "TestScope";
      CodeGenState.setScopeMembers("TestScope", new Set(["member1"]));

      expect(CodeGenState.isCurrentScopeMember("nonMember")).toBe(false);
    });

    it("isCurrentScopeMember returns true for member", () => {
      CodeGenState.currentScope = "TestScope";
      CodeGenState.setScopeMembers("TestScope", new Set(["member1"]));

      expect(CodeGenState.isCurrentScopeMember("member1")).toBe(true);
    });
  });

  describe("resolveIdentifier()", () => {
    it("returns identifier unchanged when not in a scope", () => {
      CodeGenState.currentScope = null;
      expect(CodeGenState.resolveIdentifier("varName")).toBe("varName");
    });

    it("returns identifier unchanged when not a scope member", () => {
      CodeGenState.currentScope = "TestScope";
      CodeGenState.setScopeMembers("TestScope", new Set(["member1"]));

      expect(CodeGenState.resolveIdentifier("varName")).toBe("varName");
    });

    it("returns scoped name for scope member", () => {
      CodeGenState.currentScope = "TestScope";
      CodeGenState.setScopeMembers("TestScope", new Set(["member1"]));

      expect(CodeGenState.resolveIdentifier("member1")).toBe(
        "TestScope_member1",
      );
    });
  });

  describe("Struct Field Helpers", () => {
    const mockSymbols = createMockSymbols({
      knownStructs: new Set(["MyStruct"]),
      structFields: new Map([["MyStruct", new Map([["field1", "u32"]])]]),
      structFieldArrays: new Map([["MyStruct", new Set(["arrayField"])]]),
    });

    it("getStructFieldType returns undefined without symbols", () => {
      CodeGenState.symbols = null;
      expect(
        CodeGenState.getStructFieldType("MyStruct", "field1"),
      ).toBeUndefined();
    });

    it("getStructFieldType returns field type with symbols", () => {
      CodeGenState.symbols = mockSymbols;
      expect(CodeGenState.getStructFieldType("MyStruct", "field1")).toBe("u32");
    });

    it("isStructFieldArray returns false without symbols", () => {
      CodeGenState.symbols = null;
      expect(CodeGenState.isStructFieldArray("MyStruct", "arrayField")).toBe(
        false,
      );
    });

    it("isStructFieldArray returns true for array field", () => {
      CodeGenState.symbols = mockSymbols;
      expect(CodeGenState.isStructFieldArray("MyStruct", "arrayField")).toBe(
        true,
      );
    });

    it("isStructFieldArray returns false for non-array field", () => {
      CodeGenState.symbols = mockSymbols;
      expect(CodeGenState.isStructFieldArray("MyStruct", "field1")).toBe(false);
    });
  });

  describe("getEnumMembers()", () => {
    it("returns undefined without symbols", () => {
      CodeGenState.symbols = null;
      expect(CodeGenState.getEnumMembers("MyEnum")).toBeUndefined();
    });

    it("returns enum members when available", () => {
      const enumMembers = new Map([
        ["VALUE1", 0],
        ["VALUE2", 1],
      ]);
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["MyEnum"]),
        enumMembers: new Map([["MyEnum", enumMembers]]),
      });

      expect(CodeGenState.getEnumMembers("MyEnum")).toBe(enumMembers);
    });
  });

  describe("getFunctionReturnType()", () => {
    it("returns undefined without symbols", () => {
      CodeGenState.symbols = null;
      expect(CodeGenState.getFunctionReturnType("myFunc")).toBeUndefined();
    });

    it("returns return type when available", () => {
      CodeGenState.symbols = createMockSymbols({
        functionReturnTypes: new Map([["myFunc", "u32"]]),
      });

      expect(CodeGenState.getFunctionReturnType("myFunc")).toBe("u32");
    });
  });

  describe("Include Flag Helpers", () => {
    it("requireStdint sets needsStdint", () => {
      expect(CodeGenState.needsStdint).toBe(false);
      CodeGenState.requireStdint();
      expect(CodeGenState.needsStdint).toBe(true);
    });

    it("requireStdbool sets needsStdbool", () => {
      expect(CodeGenState.needsStdbool).toBe(false);
      CodeGenState.requireStdbool();
      expect(CodeGenState.needsStdbool).toBe(true);
    });

    it("requireString sets needsString", () => {
      expect(CodeGenState.needsString).toBe(false);
      CodeGenState.requireString();
      expect(CodeGenState.needsString).toBe(true);
    });

    it("requireCMSIS sets needsCMSIS", () => {
      expect(CodeGenState.needsCMSIS).toBe(false);
      CodeGenState.requireCMSIS();
      expect(CodeGenState.needsCMSIS).toBe(true);
    });

    it("requireLimits sets needsLimits", () => {
      expect(CodeGenState.needsLimits).toBe(false);
      CodeGenState.requireLimits();
      expect(CodeGenState.needsLimits).toBe(true);
    });

    it("requireISR sets needsISR", () => {
      expect(CodeGenState.needsISR).toBe(false);
      CodeGenState.requireISR();
      expect(CodeGenState.needsISR).toBe(true);
    });
  });

  describe("Type Registration Helpers", () => {
    it("registerType adds to typeRegistry", () => {
      const typeInfo: TTypeInfo = {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      };

      CodeGenState.registerType("myVar", typeInfo);

      expect(CodeGenState.getVariableTypeInfo("myVar")).toBe(typeInfo);
    });

    it("registerConstValue adds to constValues", () => {
      CodeGenState.registerConstValue("MY_CONST", 42);
      expect(CodeGenState.constValues.get("MY_CONST")).toBe(42);
    });

    it("registerLocalVariable adds to localVariables", () => {
      CodeGenState.registerLocalVariable("localVar");
      expect(CodeGenState.localVariables.has("localVar")).toBe(true);
      expect(CodeGenState.localArrays.has("localVar")).toBe(false);
    });

    it("registerLocalVariable with isArray adds to both sets", () => {
      CodeGenState.registerLocalVariable("localArr", true);
      expect(CodeGenState.localVariables.has("localArr")).toBe(true);
      expect(CodeGenState.localArrays.has("localArr")).toBe(true);
    });

    it("registerFunctionSignature adds to functionSignatures and knownFunctions", () => {
      const sig = {
        name: "myFunc",
        returnType: "void",
        parameters: [],
        isPublic: true,
      };

      CodeGenState.registerFunctionSignature("myFunc", sig);

      expect(CodeGenState.functionSignatures.get("myFunc")).toBe(sig);
      expect(CodeGenState.knownFunctions.has("myFunc")).toBe(true);
    });

    it("registerCallbackType adds to callbackTypes", () => {
      const info = {
        functionName: "onClick",
        returnType: "void",
        parameters: [
          {
            name: "x",
            type: "u32",
            isArray: false,
            isConst: false,
            isPointer: false,
            arrayDims: "",
          },
        ],
        typedefName: "ClickHandler",
      };

      CodeGenState.registerCallbackType("MyCallback", info);

      expect(CodeGenState.callbackTypes.get("MyCallback")).toBe(info);
    });

    it("registerCallbackFieldType adds to callbackFieldTypes", () => {
      CodeGenState.registerCallbackFieldType(
        "MyStruct_onClick",
        "ClickHandler",
      );
      expect(CodeGenState.callbackFieldTypes.get("MyStruct_onClick")).toBe(
        "ClickHandler",
      );
    });
  });

  describe("Variable Type Info API (Issue #786)", () => {
    it("getVariableTypeInfo returns local type info from registry", () => {
      const typeInfo: TTypeInfo = {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      };

      CodeGenState.setVariableTypeInfo("localVar", typeInfo);

      expect(CodeGenState.getVariableTypeInfo("localVar")).toBe(typeInfo);
    });

    it("getVariableTypeInfo returns undefined for unknown variable", () => {
      expect(CodeGenState.getVariableTypeInfo("unknownVar")).toBeUndefined();
    });

    it("getVariableTypeInfo falls back to SymbolTable for C-Next variables", () => {
      // Add a C-Next variable to SymbolTable (simulating cross-file include)
      CodeGenState.symbolTable.addTSymbol(
        createCNextVariableSymbol({
          name: "crossFileVar",
          type: TTypeUtils.createPrimitive("u16"),
          isArray: true,
          arrayDimensions: [10],
        }),
      );

      const result = CodeGenState.getVariableTypeInfo("crossFileVar");

      expect(result).toBeDefined();
      expect(result?.baseType).toBe("u16");
      expect(result?.bitWidth).toBe(16);
      expect(result?.isArray).toBe(true);
      expect(result?.arrayDimensions).toEqual([10]);
    });

    it("getVariableTypeInfo does not use C header symbols", () => {
      // Add a C header variable (should NOT be used)
      CodeGenState.symbolTable.addCSymbol(
        createCVariableSymbol({
          name: "cHeaderVar",
          type: "uint32_t",
        }),
      );

      expect(CodeGenState.getVariableTypeInfo("cHeaderVar")).toBeUndefined();
    });

    it("getVariableTypeInfo prefers local registry over SymbolTable", () => {
      // Add both local and SymbolTable version
      const localInfo: TTypeInfo = {
        baseType: "i32",
        bitWidth: 32,
        isArray: false,
        isConst: true,
      };
      CodeGenState.setVariableTypeInfo("mixedVar", localInfo);

      CodeGenState.symbolTable.addTSymbol(
        createCNextVariableSymbol({
          name: "mixedVar",
          type: TTypeUtils.createPrimitive("u8"),
        }),
      );

      // Should return local info, not SymbolTable info
      const result = CodeGenState.getVariableTypeInfo("mixedVar");
      expect(result?.baseType).toBe("i32");
      expect(result?.isConst).toBe(true);
    });

    it("hasVariableTypeInfo returns true for local registry", () => {
      CodeGenState.setVariableTypeInfo("localVar", {
        baseType: "u8",
        bitWidth: 8,
        isArray: false,
        isConst: false,
      });

      expect(CodeGenState.hasVariableTypeInfo("localVar")).toBe(true);
    });

    it("hasVariableTypeInfo returns true for C-Next SymbolTable variable", () => {
      CodeGenState.symbolTable.addTSymbol(
        createCNextVariableSymbol({
          name: "crossFileVar",
          type: TTypeUtils.createPrimitive("u32"),
        }),
      );

      expect(CodeGenState.hasVariableTypeInfo("crossFileVar")).toBe(true);
    });

    it("hasVariableTypeInfo returns false for unknown variable", () => {
      expect(CodeGenState.hasVariableTypeInfo("unknownVar")).toBe(false);
    });

    it("hasVariableTypeInfo returns false for C header variable", () => {
      CodeGenState.symbolTable.addCSymbol(
        createCVariableSymbol({
          name: "cVar",
          type: "int",
        }),
      );

      expect(CodeGenState.hasVariableTypeInfo("cVar")).toBe(false);
    });

    it("setVariableTypeInfo and deleteVariableTypeInfo work correctly", () => {
      const typeInfo: TTypeInfo = {
        baseType: "f32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      };

      CodeGenState.setVariableTypeInfo("tempVar", typeInfo);
      expect(CodeGenState.getVariableTypeInfo("tempVar")).toBe(typeInfo);

      CodeGenState.deleteVariableTypeInfo("tempVar");
      expect(CodeGenState.getVariableTypeInfo("tempVar")).toBeUndefined();
    });

    it("getTypeRegistryView returns readonly view", () => {
      CodeGenState.setVariableTypeInfo("var1", {
        baseType: "u8",
        bitWidth: 8,
        isArray: false,
        isConst: false,
      });
      CodeGenState.setVariableTypeInfo("var2", {
        baseType: "u16",
        bitWidth: 16,
        isArray: false,
        isConst: false,
      });

      const view = CodeGenState.getTypeRegistryView();

      expect(view.size).toBe(2);
      expect(view.has("var1")).toBe(true);
      expect(view.has("var2")).toBe(true);
    });

    it("getTypeInfo is deprecated alias for getVariableTypeInfo", () => {
      const typeInfo: TTypeInfo = {
        baseType: "u64",
        bitWidth: 64,
        isArray: false,
        isConst: false,
      };

      CodeGenState.setVariableTypeInfo("aliasVar", typeInfo);

      // getTypeInfo should return same result
      expect(CodeGenState.getTypeInfo("aliasVar")).toBe(typeInfo);
    });

    it("convertSymbolToTypeInfo handles string<N> types", () => {
      CodeGenState.symbolTable.addTSymbol(
        createCNextVariableSymbol({
          name: "myString",
          type: TTypeUtils.createString(32),
        }),
      );

      const result = CodeGenState.getVariableTypeInfo("myString");

      expect(result?.baseType).toBe("char");
      expect(result?.bitWidth).toBe(8);
      expect(result?.isString).toBe(true);
      expect(result?.stringCapacity).toBe(32);
    });

    it("convertSymbolToTypeInfo handles enum types", () => {
      // Register an enum
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["EColor"]),
      });

      CodeGenState.symbolTable.addTSymbol(
        createCNextVariableSymbol({
          name: "color",
          type: TTypeUtils.createEnum("EColor"),
        }),
      );

      const result = CodeGenState.getVariableTypeInfo("color");

      expect(result?.baseType).toBe("EColor");
      expect(result?.isEnum).toBe(true);
      expect(result?.enumTypeName).toBe("EColor");
    });

    it("convertSymbolToTypeInfo handles const and atomic", () => {
      CodeGenState.symbolTable.addTSymbol(
        createCNextVariableSymbol({
          name: "constAtomicVar",
          type: TTypeUtils.createPrimitive("u32"),
          isConst: true,
          isAtomic: true,
        }),
      );

      const result = CodeGenState.getVariableTypeInfo("constAtomicVar");

      expect(result?.isConst).toBe(true);
      expect(result?.isAtomic).toBe(true);
    });

    it("convertSymbolToTypeInfo filters invalid array dimensions", () => {
      CodeGenState.symbolTable.addTSymbol(
        createCNextVariableSymbol({
          name: "arrayVar",
          type: TTypeUtils.createPrimitive("u8"),
          isArray: true,
          arrayDimensions: [10, "invalid", 20],
        }),
      );

      const result = CodeGenState.getVariableTypeInfo("arrayVar");

      // Should only include valid numeric dimensions
      expect(result?.arrayDimensions).toEqual([10, 20]);
    });
  });

  describe("Overflow Operation Helpers", () => {
    it("markClampOpUsed adds to usedClampOps", () => {
      CodeGenState.markClampOpUsed("add", "u8");
      expect(CodeGenState.usedClampOps.has("add_u8")).toBe(true);
    });

    it("markSafeDivOpUsed adds to usedSafeDivOps", () => {
      CodeGenState.markSafeDivOpUsed("div", "i32");
      expect(CodeGenState.usedSafeDivOps.has("div_i32")).toBe(true);
    });
  });

  describe("Float Bit Shadow Helpers", () => {
    it("registerFloatBitShadow adds to floatBitShadows", () => {
      CodeGenState.registerFloatBitShadow("myFloat_bits");
      expect(CodeGenState.floatBitShadows.has("myFloat_bits")).toBe(true);
    });

    it("hasFloatBitShadow returns correct value", () => {
      expect(CodeGenState.hasFloatBitShadow("myFloat_bits")).toBe(false);
      CodeGenState.registerFloatBitShadow("myFloat_bits");
      expect(CodeGenState.hasFloatBitShadow("myFloat_bits")).toBe(true);
    });

    it("markFloatShadowCurrent adds to floatShadowCurrent", () => {
      CodeGenState.markFloatShadowCurrent("myFloat_bits");
      expect(CodeGenState.floatShadowCurrent.has("myFloat_bits")).toBe(true);
    });

    it("isFloatShadowCurrent returns correct value", () => {
      expect(CodeGenState.isFloatShadowCurrent("myFloat_bits")).toBe(false);
      CodeGenState.markFloatShadowCurrent("myFloat_bits");
      expect(CodeGenState.isFloatShadowCurrent("myFloat_bits")).toBe(true);
    });
  });

  describe("C++ Mode Helpers", () => {
    it("addPendingTempDeclaration adds declaration", () => {
      CodeGenState.addPendingTempDeclaration("int _tmp0 = x;");
      expect(CodeGenState.pendingTempDeclarations).toContain("int _tmp0 = x;");
    });

    it("flushPendingTempDeclarations returns and clears declarations", () => {
      CodeGenState.addPendingTempDeclaration("int _tmp0 = x;");
      CodeGenState.addPendingTempDeclaration("int _tmp1 = y;");

      const decls = CodeGenState.flushPendingTempDeclarations();

      expect(decls).toHaveLength(2);
      expect(decls).toContain("int _tmp0 = x;");
      expect(decls).toContain("int _tmp1 = y;");
      expect(CodeGenState.pendingTempDeclarations).toHaveLength(0);
    });

    it("getNextTempVarName returns incrementing names", () => {
      CodeGenState.reset(); // Reset counter
      expect(CodeGenState.getNextTempVarName()).toBe("_tmp0");
      expect(CodeGenState.getNextTempVarName()).toBe("_tmp1");
      expect(CodeGenState.getNextTempVarName()).toBe("_tmp2");
    });
  });

  describe("Symbol Lookup Helpers", () => {
    it("isKnownEnum returns false without symbols", () => {
      CodeGenState.symbols = null;
      expect(CodeGenState.isKnownEnum("MyEnum")).toBe(false);
    });

    it("isKnownEnum returns true for known enum", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["MyEnum"]),
      });

      expect(CodeGenState.isKnownEnum("MyEnum")).toBe(true);
      expect(CodeGenState.isKnownEnum("UnknownEnum")).toBe(false);
    });

    it("isKnownScope returns false without symbols", () => {
      CodeGenState.symbols = null;
      expect(CodeGenState.isKnownScope("MyScope")).toBe(false);
    });

    it("isKnownScope returns true for known scope", () => {
      CodeGenState.symbols = createMockSymbols({
        knownScopes: new Set(["MyScope"]),
      });

      expect(CodeGenState.isKnownScope("MyScope")).toBe(true);
      expect(CodeGenState.isKnownScope("UnknownScope")).toBe(false);
    });

    it("isOpaqueType returns false without symbols", () => {
      CodeGenState.symbols = null;
      expect(CodeGenState.isOpaqueType("widget_t")).toBe(false);
    });

    it("isOpaqueType returns true for opaque type", () => {
      CodeGenState.symbols = createMockSymbols({
        opaqueTypes: new Set(["widget_t", "display_t"]),
      });

      expect(CodeGenState.isOpaqueType("widget_t")).toBe(true);
      expect(CodeGenState.isOpaqueType("display_t")).toBe(true);
      expect(CodeGenState.isOpaqueType("Point")).toBe(false);
    });
  });

  describe("Local Variable Helpers", () => {
    it("isLocalVariable returns correct value", () => {
      expect(CodeGenState.isLocalVariable("myVar")).toBe(false);
      CodeGenState.localVariables.add("myVar");
      expect(CodeGenState.isLocalVariable("myVar")).toBe(true);
    });

    it("isLocalArray returns correct value", () => {
      expect(CodeGenState.isLocalArray("myArr")).toBe(false);
      CodeGenState.localArrays.add("myArr");
      expect(CodeGenState.isLocalArray("myArr")).toBe(true);
    });
  });

  describe("buildExternalStructFields", () => {
    it("returns empty map when no struct fields exist", () => {
      CodeGenState.buildExternalStructFields();
      const result = CodeGenState.getExternalStructFields();
      expect(result.size).toBe(0);
    });

    it("includes non-array fields in result", () => {
      // Manually add struct fields to the symbol table
      const structFields = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();
      const pointFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      pointFields.set("x", { type: "i32" });
      pointFields.set("y", { type: "i32" });
      structFields.set("Point", pointFields);

      // Use restoreStructFields to populate the symbol table
      CodeGenState.symbolTable.restoreStructFields(structFields);

      CodeGenState.buildExternalStructFields();
      const result = CodeGenState.getExternalStructFields();

      expect(result.has("Point")).toBe(true);
      const fields = result.get("Point");
      expect(fields?.has("x")).toBe(true);
      expect(fields?.has("y")).toBe(true);
    });

    it("excludes array fields from result (Issue #355)", () => {
      const structFields = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();
      const bufferFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      bufferFields.set("size", { type: "u32" }); // Non-array
      bufferFields.set("data", { type: "u8", arrayDimensions: [256] }); // Array

      structFields.set("Buffer", bufferFields);
      CodeGenState.symbolTable.restoreStructFields(structFields);

      CodeGenState.buildExternalStructFields();
      const result = CodeGenState.getExternalStructFields();

      expect(result.has("Buffer")).toBe(true);
      const fields = result.get("Buffer");
      expect(fields?.has("size")).toBe(true); // Non-array included
      expect(fields?.has("data")).toBe(false); // Array excluded
    });

    it("excludes structs with only array fields", () => {
      const structFields = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();
      const arrayOnlyFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      arrayOnlyFields.set("items", { type: "u8", arrayDimensions: [10] });
      arrayOnlyFields.set("values", { type: "i32", arrayDimensions: [5] });

      structFields.set("ArrayOnly", arrayOnlyFields);
      CodeGenState.symbolTable.restoreStructFields(structFields);

      CodeGenState.buildExternalStructFields();
      const result = CodeGenState.getExternalStructFields();

      // Struct should not be included since all fields are arrays
      expect(result.has("ArrayOnly")).toBe(false);
    });

    it("handles mixed structs correctly", () => {
      const structFields = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();

      // Struct with mixed fields
      const mixedFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      mixedFields.set("id", { type: "u32" });
      mixedFields.set("name", { type: "string", arrayDimensions: [32] });
      mixedFields.set("count", { type: "u16" });

      // Struct with only non-array
      const simpleFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      simpleFields.set("value", { type: "f32" });

      structFields.set("Mixed", mixedFields);
      structFields.set("Simple", simpleFields);
      CodeGenState.symbolTable.restoreStructFields(structFields);

      CodeGenState.buildExternalStructFields();
      const result = CodeGenState.getExternalStructFields();

      // Mixed struct should have only non-array fields
      expect(result.get("Mixed")?.size).toBe(2);
      expect(result.get("Mixed")?.has("id")).toBe(true);
      expect(result.get("Mixed")?.has("count")).toBe(true);
      expect(result.get("Mixed")?.has("name")).toBe(false);

      // Simple struct should have its field
      expect(result.get("Simple")?.has("value")).toBe(true);
    });
  });

  describe("Opaque Scope Variable Helpers (Issue #948)", () => {
    it("markOpaqueScopeVariable adds to opaqueScopeVariables", () => {
      CodeGenState.markOpaqueScopeVariable("MyScope_widget");
      expect(CodeGenState.isOpaqueScopeVariable("MyScope_widget")).toBe(true);
    });

    it("isOpaqueScopeVariable returns false for unknown variable", () => {
      expect(CodeGenState.isOpaqueScopeVariable("Unknown_var")).toBe(false);
    });

    it("isOpaqueScopeVariable returns true for marked variable", () => {
      CodeGenState.markOpaqueScopeVariable("Gui_display");
      expect(CodeGenState.isOpaqueScopeVariable("Gui_display")).toBe(true);
    });

    it("reset clears opaqueScopeVariables", () => {
      CodeGenState.markOpaqueScopeVariable("Test_opaque");
      expect(CodeGenState.isOpaqueScopeVariable("Test_opaque")).toBe(true);

      CodeGenState.reset();

      expect(CodeGenState.isOpaqueScopeVariable("Test_opaque")).toBe(false);
    });

    it("handles multiple opaque scope variables", () => {
      CodeGenState.markOpaqueScopeVariable("Scope1_widget");
      CodeGenState.markOpaqueScopeVariable("Scope1_display");
      CodeGenState.markOpaqueScopeVariable("Scope2_handle");

      expect(CodeGenState.isOpaqueScopeVariable("Scope1_widget")).toBe(true);
      expect(CodeGenState.isOpaqueScopeVariable("Scope1_display")).toBe(true);
      expect(CodeGenState.isOpaqueScopeVariable("Scope2_handle")).toBe(true);
      expect(CodeGenState.isOpaqueScopeVariable("Scope1_other")).toBe(false);
    });
  });
});
