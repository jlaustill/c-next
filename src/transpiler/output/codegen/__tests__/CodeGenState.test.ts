/**
 * Tests for CodeGenState - centralized code generation state management
 */

import { describe, it, expect, beforeEach } from "vitest";
import CodeGenState from "../CodeGenState";
import TTypeInfo from "../types/TTypeInfo";
import ICodeGenSymbols from "../../../types/ICodeGenSymbols";

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

    it("accepts custom target capabilities", () => {
      const customTarget = {
        hasFPU: true,
        hasHardwareDivide: false,
        maxBitWidth: 32,
        hasAtomic: true,
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
      CodeGenState.scopeMembers.set("TestScope", members);

      expect(CodeGenState.getScopeMembers("TestScope")).toBe(members);
    });

    it("isCurrentScopeMember returns false when not in a scope", () => {
      CodeGenState.currentScope = null;
      expect(CodeGenState.isCurrentScopeMember("anyMember")).toBe(false);
    });

    it("isCurrentScopeMember returns false for non-member", () => {
      CodeGenState.currentScope = "TestScope";
      CodeGenState.scopeMembers.set("TestScope", new Set(["member1"]));

      expect(CodeGenState.isCurrentScopeMember("nonMember")).toBe(false);
    });

    it("isCurrentScopeMember returns true for member", () => {
      CodeGenState.currentScope = "TestScope";
      CodeGenState.scopeMembers.set("TestScope", new Set(["member1"]));

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
      CodeGenState.scopeMembers.set("TestScope", new Set(["member1"]));

      expect(CodeGenState.resolveIdentifier("varName")).toBe("varName");
    });

    it("returns scoped name for scope member", () => {
      CodeGenState.currentScope = "TestScope";
      CodeGenState.scopeMembers.set("TestScope", new Set(["member1"]));

      expect(CodeGenState.resolveIdentifier("member1")).toBe(
        "TestScope_member1",
      );
    });
  });

  describe("Struct Field Helpers", () => {
    const mockSymbols: ICodeGenSymbols = {
      knownScopes: new Set(),
      knownEnums: new Set(),
      knownBitmaps: new Set(),
      knownStructs: new Set(["MyStruct"]),
      knownCallbacks: new Set(),
      bitmapBitWidth: new Map(),
      enumMembers: new Map(),
      structFields: new Map([["MyStruct", new Map([["field1", "u32"]])]]),
      structFieldArrays: new Map([["MyStruct", new Set(["arrayField"])]]),
      functionReturnTypes: new Map(),
      scopeMemberVisibility: new Map(),
      scopeEnums: new Map(),
    };

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
      CodeGenState.symbols = {
        knownScopes: new Set(),
        knownEnums: new Set(["MyEnum"]),
        knownBitmaps: new Set(),
        knownStructs: new Set(),
        knownCallbacks: new Set(),
        bitmapBitWidth: new Map(),
        enumMembers: new Map([["MyEnum", enumMembers]]),
        structFields: new Map(),
        structFieldArrays: new Map(),
        functionReturnTypes: new Map(),
        scopeMemberVisibility: new Map(),
        scopeEnums: new Map(),
      };

      expect(CodeGenState.getEnumMembers("MyEnum")).toBe(enumMembers);
    });
  });

  describe("getFunctionReturnType()", () => {
    it("returns undefined without symbols", () => {
      CodeGenState.symbols = null;
      expect(CodeGenState.getFunctionReturnType("myFunc")).toBeUndefined();
    });

    it("returns return type when available", () => {
      CodeGenState.symbols = {
        knownScopes: new Set(),
        knownEnums: new Set(),
        knownBitmaps: new Set(),
        knownStructs: new Set(),
        knownCallbacks: new Set(),
        bitmapBitWidth: new Map(),
        enumMembers: new Map(),
        structFields: new Map(),
        structFieldArrays: new Map(),
        functionReturnTypes: new Map([["myFunc", "u32"]]),
        scopeMemberVisibility: new Map(),
        scopeEnums: new Map(),
      };

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

      expect(CodeGenState.typeRegistry.get("myVar")).toBe(typeInfo);
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
        returnType: "void",
        params: [],
        isPublic: true,
      };

      CodeGenState.registerFunctionSignature("myFunc", sig);

      expect(CodeGenState.functionSignatures.get("myFunc")).toBe(sig);
      expect(CodeGenState.knownFunctions.has("myFunc")).toBe(true);
    });

    it("registerCallbackType adds to callbackTypes", () => {
      const info = {
        returnType: "void",
        params: [{ name: "x", type: "u32" }],
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
      CodeGenState.symbols = {
        knownScopes: new Set(),
        knownEnums: new Set(["MyEnum"]),
        knownBitmaps: new Set(),
        knownStructs: new Set(),
        knownCallbacks: new Set(),
        bitmapBitWidth: new Map(),
        enumMembers: new Map(),
        structFields: new Map(),
        structFieldArrays: new Map(),
        functionReturnTypes: new Map(),
        scopeMemberVisibility: new Map(),
        scopeEnums: new Map(),
      };

      expect(CodeGenState.isKnownEnum("MyEnum")).toBe(true);
      expect(CodeGenState.isKnownEnum("UnknownEnum")).toBe(false);
    });

    it("isKnownScope returns false without symbols", () => {
      CodeGenState.symbols = null;
      expect(CodeGenState.isKnownScope("MyScope")).toBe(false);
    });

    it("isKnownScope returns true for known scope", () => {
      CodeGenState.symbols = {
        knownScopes: new Set(["MyScope"]),
        knownEnums: new Set(),
        knownBitmaps: new Set(),
        knownStructs: new Set(),
        knownCallbacks: new Set(),
        bitmapBitWidth: new Map(),
        enumMembers: new Map(),
        structFields: new Map(),
        structFieldArrays: new Map(),
        functionReturnTypes: new Map(),
        scopeMemberVisibility: new Map(),
        scopeEnums: new Map(),
      };

      expect(CodeGenState.isKnownScope("MyScope")).toBe(true);
      expect(CodeGenState.isKnownScope("UnknownScope")).toBe(false);
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
});
