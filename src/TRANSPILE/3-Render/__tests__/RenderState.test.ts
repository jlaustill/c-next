/**
 * Tests for RenderState - centralized code generation state management
 */

import SymbolTable from "../../../PARSE/3-Declare/SymbolTable";
import type IScopeSymbol from "../../../transpiler/types/symbols/IScopeSymbol";
import { describe, it, expect, beforeEach } from "vitest";
import type IProgram from "../../../transpiler/types/IProgram";
import installMockSymbols from "../../../transpiler/__tests__/installMockSymbols";
import RenderState from "../RenderState";
import TTypeInfo from "../../../transpiler/types/TTypeInfo";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import IVariableSymbol from "../../../transpiler/types/symbols/IVariableSymbol";
import ICVariableSymbol from "../../../transpiler/types/symbols/c/ICVariableSymbol";
import TTypeUtils from "../../../utils/TTypeUtils";
import TestSymbolUtils from "../../../PARSE/3-Declare/cnext/__tests__/testSymbolUtils";
import SymbolRegistry from "../../../PARSE/3-Declare/SymbolRegistry";
import ScopeUtils from "../../../utils/ScopeUtils";
import createMockSymbols from "../../../transpiler/__tests__/codeGenSymbolsHelpers";
import UNRESOLVED_DIMENSION from "../../../transpiler/constants/UNRESOLVED_DIMENSION";
import TestSourceSpan from "../../../transpiler/types/__testUtils__/testSourceSpan";
import Program from "../../../PARSE/4-Resolve/Program";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import enterScope from "../../../transpiler/__tests__/enterScope";

/** Repo root, for the source-scanning guard in `scopeTypePredicate`. */
const repoRootForGuard = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
);

/**
 * Create a minimal C-Next IVariableSymbol for testing.
 */
function createCNextVariableSymbol(
  overrides: Partial<IVariableSymbol> & { name: string },
): IVariableSymbol {
  return {
    ...TestSymbolUtils.base({
      kind: "variable",
      name: overrides.name,
      scopePath: overrides.scopePath ?? "",
      sourceFile: overrides.sourceFile ?? "test.cnx",
      span: overrides.span ?? TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.CNext,
      visibility: overrides.visibility ?? "private",
    }),
    type: overrides.type ?? TTypeUtils.createPrimitive("u32"),
    isConst: overrides.isConst ?? false,
    isVolatile: overrides.isVolatile ?? false,
    overflowBehavior: "clamp",
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
    span: overrides.span ?? TestSourceSpan.at(1),
    sourceLanguage: ESourceLanguage.C,
    visibility: overrides.visibility ?? "public",
    type: overrides.type,
    isConst: overrides.isConst,
    isArray: overrides.isArray,
    arrayDimensions: overrides.arrayDimensions,
  };
}

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

/**
 * #1452 box 3: register a scope AND publish the graph, because
 * `setCurrentScopeByPath` reads it off `state.program` now rather than
 * off a global registry. Both halves live here so the tests below -- which call
 * the guarded method directly on purpose -- state what they are setting up
 * rather than repeating the wiring.
 */
function registerScope(path: string): IScopeSymbol {
  const scope = registry.getOrCreateScope(path);
  state.program = Program.build([], { registry });
  return scope;
}

let state = new RenderState();

describe("RenderState", () => {
  beforeEach(() => {
    state = new RenderState();
    state.symbolTable = new SymbolTable();
  });

  describe("reset()", () => {
    it("resets all state to initial values", () => {
      // Set some state
      enterScope(state, "TestScope");
      state.currentFunctionName = "testFunc";
      // #1452: `indentLevel` moved to `RenderState`, which owns its own
      // clearing, so the two resets are asserted side by side rather than one
      // standing in for the other.
      const render = new RenderState();
      render.indentLevel = 5;
      render.needsStdint = true;

      // Reset
      state = new RenderState();
      render.reset();

      // Verify reset
      expect(state.currentScopePath).toBe("");
      expect(state.currentFunctionName).toBeNull();
      expect(render.indentLevel).toBe(0);
      expect(render.needsStdint).toBe(false);
    });

    it("resets generator reference", () => {
      // Simulate having a generator set
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state.generator = {} as any;

      state = new RenderState();

      expect(state.generator).toBeNull();
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
        significantExternalIdentifierChars: 31,
        significantInternalIdentifierChars: 63,
      };

      state.reset(customTarget);

      expect(state.targetCapabilities).toEqual(customTarget);
    });
  });

  describe("Scope Member Helpers", () => {
    it("getScopeMembers returns undefined for unknown scope", () => {
      expect(state.getScopeMembers("UnknownScope")).toBeUndefined();
    });

    it("getScopeMembers returns members for known scope", () => {
      const members = new Set(["member1", "member2"]);
      state.setScopeMembers("TestScope", members);

      expect(state.getScopeMembers("TestScope")).toBe(members);
    });

    it("isCurrentScopeMember returns false when not in a scope", () => {
      enterScope(state, null);
      expect(state.isCurrentScopeMember("anyMember")).toBe(false);
    });

    it("isCurrentScopeMember returns false for non-member", () => {
      enterScope(state, "TestScope");
      state.setScopeMembers("TestScope", new Set(["member1"]));

      expect(state.isCurrentScopeMember("nonMember")).toBe(false);
    });

    it("isCurrentScopeMember returns true for member", () => {
      enterScope(state, "TestScope");
      state.setScopeMembers("TestScope", new Set(["member1"]));

      expect(state.isCurrentScopeMember("member1")).toBe(true);
    });
  });

  describe("resolveIdentifier()", () => {
    it("returns identifier unchanged when not in a scope", () => {
      enterScope(state, null);
      expect(state.resolveIdentifier("varName")).toBe("varName");
    });

    it("returns identifier unchanged when not a scope member", () => {
      enterScope(state, "TestScope");
      state.setScopeMembers("TestScope", new Set(["member1"]));

      expect(state.resolveIdentifier("varName")).toBe("varName");
    });

    it("returns scoped name for scope member", () => {
      enterScope(state, "TestScope");
      state.setScopeMembers("TestScope", new Set(["member1"]));

      expect(state.resolveIdentifier("member1")).toBe("TestScope__member1");
    });
  });

  describe("Struct Field Helpers", () => {
    const mockSymbols = createMockSymbols({
      knownStructs: new Set(["MyStruct"]),
      structFields: new Map([["MyStruct", new Map([["field1", "u32"]])]]),
      structFieldArrays: new Map([["MyStruct", new Set(["arrayField"])]]),
    });

    it("getStructFieldType returns undefined without symbols", () => {
      state.symbols = null;
      expect(state.getStructFieldType("MyStruct", "field1")).toBeUndefined();
    });

    it("getStructFieldType returns field type with symbols", () => {
      state.symbols = mockSymbols;
      expect(state.getStructFieldType("MyStruct", "field1")).toBe("u32");
    });

    it("isStructFieldArray returns false without symbols", () => {
      state.symbols = null;
      expect(state.isStructFieldArray("MyStruct", "arrayField")).toBe(false);
    });

    it("isStructFieldArray returns true for array field", () => {
      state.symbols = mockSymbols;
      expect(state.isStructFieldArray("MyStruct", "arrayField")).toBe(true);
    });

    it("isStructFieldArray returns false for non-array field", () => {
      state.symbols = mockSymbols;
      expect(state.isStructFieldArray("MyStruct", "field1")).toBe(false);
    });
  });

  describe("getEnumMembers()", () => {
    it("returns undefined without symbols", () => {
      state.symbols = null;
      expect(state.getEnumMembers("MyEnum")).toBeUndefined();
    });

    it("returns enum members when available", () => {
      const enumMembers = new Map([
        ["VALUE1", 0],
        ["VALUE2", 1],
      ]);
      installMockSymbols(state, {
        knownEnums: new Set(["MyEnum"]),
        enumMembers: new Map([["MyEnum", enumMembers]]),
      });

      expect(state.getEnumMembers("MyEnum")).toBe(enumMembers);
    });
  });

  describe("getFunctionReturnType()", () => {
    it("returns undefined without symbols", () => {
      state.symbols = null;
      expect(state.getFunctionReturnType("myFunc")).toBeUndefined();
    });

    it("returns return type when available", () => {
      installMockSymbols(state, {
        functionReturnTypes: new Map([["myFunc", "u32"]]),
      });

      expect(state.getFunctionReturnType("myFunc")).toBe("u32");
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

      state.registerType("myVar", typeInfo);

      expect(state.getVariableTypeInfo("myVar")).toBe(typeInfo);
    });

    it("registerConstValue adds to constValues", () => {
      state.registerConstValue("MY_CONST", 42);
      expect(state.constValues.get("MY_CONST")).toBe(42);
    });

    it("registerLocalVariable adds to localVariables", () => {
      state.registerLocalVariable("localVar");
      expect(state.localVariables.has("localVar")).toBe(true);
      expect(state.localArrays.has("localVar")).toBe(false);
    });

    it("registerLocalVariable with isArray adds to both sets", () => {
      state.registerLocalVariable("localArr", true);
      expect(state.localVariables.has("localArr")).toBe(true);
      expect(state.localArrays.has("localArr")).toBe(true);
    });

    it("setCurrentScopeByPath resolves a DOTTED PATH to the registered scope", () => {
      // The contract is a path, not a leaf. This proves the API is chain-capable,
      // so the fix for #1304 is on the caller side: codegen can only supply a
      // leaf today because `scopeMember` admits no `scopeDeclaration`.
      const inner = registerScope("Outer.Inner");

      state.setCurrentScopeByPath("Outer.Inner");

      expect(state.currentScopePath).toBe("Outer.Inner");
      expect(ScopeUtils.pathOf(inner)).toBe("Outer.Inner");
      expect(ScopeUtils.qualifyInScope("tick", state.currentScopePath)).toBe(
        "Outer__Inner__tick",
      );
    });

    it("setCurrentScopeByPath with a LEAF now fails loudly (#1304)", () => {
      // This test used to DOCUMENT the gap: a leaf did not fail, it minted a
      // fresh scope parented to global, and every qualification through it
      // silently lost the outer component. #1304 closes that -- the registry is
      // the authority, so a path it does not know is a broken promise about the
      // symbols pass rather than something to create here.
      registerScope("Outer.Inner");

      expect(() => state.setCurrentScopeByPath("Inner")).toThrow();

      // The failed entry must not have left the state half-updated, and must
      // not have registered `Inner` as a side effect.
      expect(state.currentScopePath).toBe("");
      expect(registry.getScope("Inner")).toBeNull();
    });

    it("setCurrentScopeByPath still enters a scope the registry knows", () => {
      // NEGATIVE CONTROL for the guard above: it must fire only on a path the
      // registry does not hold, not on every entry. Without this the assertion
      // above would pass just as well if the method rejected everything.
      registerScope("Outer.Inner");

      expect(() => state.setCurrentScopeByPath("Outer.Inner")).not.toThrow();
      expect(state.currentScopePath).toBe("Outer.Inner");
      expect(ScopeUtils.qualifyInScope("tick", state.currentScopePath)).toBe(
        "Outer__Inner__tick",
      );
    });

    it("registerLocalVariable leaves a non-shadowing local under its own name", () => {
      state.currentFunctionName = "Counter__test";

      state.registerLocalVariable("fresh");

      expect(state.emittedLocalName("fresh")).toBe("fresh");
    });

    it("registerLocalVariable qualifies a local that shadows a global function", () => {
      state.currentFunctionName = "Counter__test";
      state.knownFunctions.add("count");

      state.registerLocalVariable("count");

      expect(state.emittedLocalName("count")).toBe("Counter__test__count");
    });

    it("registerLocalVariable does not qualify when there is no function context", () => {
      state.currentFunctionName = null;
      state.knownFunctions.add("count");

      state.registerLocalVariable("count");

      expect(state.emittedLocalName("count")).toBe("count");
    });

    it("shadowsFileScopeSymbol ignores an enclosing local", () => {
      state.localVariables.add("outer");
      state.knownFunctions.add("outer");

      // Already local, so C block scoping already gives the right answer and
      // neither `this.` nor `global.` can name an enclosing local.
      expect(state.shadowsFileScopeSymbol("outer")).toBe(false);
    });

    it("shadowsFileScopeSymbol is false for an unknown name", () => {
      expect(state.shadowsFileScopeSymbol("nothingNamedThis")).toBe(false);
    });

    it("exitFunctionBody drops the rename map with the other locals", () => {
      state.currentFunctionName = "Counter__test";
      state.knownFunctions.add("count");
      state.registerLocalVariable("count");
      expect(state.emittedLocalName("count")).toBe("Counter__test__count");

      state.exitFunctionBody();

      // A rename surviving into the next function would rewrite an unrelated
      // local of the same name.
      expect(state.emittedLocalName("count")).toBe("count");
      expect(state.localVariables.size).toBe(0);
      expect(state.localArrays.size).toBe(0);
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
            isStruct: false,
            arrayDims: "",
          },
        ],
        typedefName: "ClickHandler",
      };

      state.registerCallbackType("MyCallback", info);

      expect(state.callbackTypes.get("MyCallback")).toBe(info);
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

      state.setVariableTypeInfo("localVar", typeInfo);

      expect(state.getVariableTypeInfo("localVar")).toBe(typeInfo);
    });

    it("getVariableTypeInfo returns undefined for unknown variable", () => {
      expect(state.getVariableTypeInfo("unknownVar")).toBeUndefined();
    });

    it("getVariableTypeInfo falls back to SymbolTable for C-Next variables", () => {
      // Add a C-Next variable to SymbolTable (simulating cross-file include)
      state.symbolTable.addTSymbol(
        createCNextVariableSymbol({
          name: "crossFileVar",
          type: TTypeUtils.createPrimitive("u16"),
          isArray: true,
          arrayDimensions: [10],
        }),
      );

      const result = state.getVariableTypeInfo("crossFileVar");

      expect(result).toBeDefined();
      expect(result?.baseType).toBe("u16");
      expect(result?.bitWidth).toBe(16);
      expect(result?.isArray).toBe(true);
      expect(result?.arrayDimensions).toEqual([10]);
    });

    it("getVariableTypeInfo does not use C header symbols for primitive types", () => {
      // Add a C header variable with primitive type (should NOT be used)
      state.symbolTable.addCSymbol(
        createCVariableSymbol({
          name: "cHeaderVar",
          type: "uint32_t",
        }),
      );

      expect(state.getVariableTypeInfo("cHeaderVar")).toBeUndefined();
    });

    it("getVariableTypeInfo returns type info for C header struct variables (Issue #978)", () => {
      // Register font_t as a typedef struct type
      state.symbolTable.markTypedefStructType("font_t", "fake_lib.h");

      // Add a C header variable with struct type
      state.symbolTable.addCSymbol(
        createCVariableSymbol({
          name: "big_font",
          type: "font_t",
          isConst: true,
        }),
      );

      const result = state.getVariableTypeInfo("big_font");
      expect(result).toBeDefined();
      expect(result?.baseType).toBe("font_t");
      expect(result?.isConst).toBe(true);
      expect(result?.bitWidth).toBe(0);
      expect(result?.isPointer).toBe(false);
    });

    it("getVariableTypeInfo returns type info for C struct via getStructFields path (Issue #978)", () => {
      // Register struct fields directly (non-typedef struct, e.g., `struct point`)
      state.symbolTable.addStructField("point", "x", "int32_t");
      state.symbolTable.addStructField("point", "y", "int32_t");

      state.symbolTable.addCSymbol(
        createCVariableSymbol({
          name: "origin",
          type: "point",
        }),
      );

      const result = state.getVariableTypeInfo("origin");
      expect(result).toBeDefined();
      expect(result?.baseType).toBe("point");
      expect(result?.bitWidth).toBe(0);
    });

    it("getVariableTypeInfo detects pointer type from C symbol (Issue #978)", () => {
      // Register font_t as a struct
      state.symbolTable.markTypedefStructType("font_t", "lib.h");

      // Pointer variable: type includes * (set by VariableCollector)
      state.symbolTable.addCSymbol(
        createCVariableSymbol({
          name: "font_ptr",
          type: "font_t*",
        }),
      );

      const result = state.getVariableTypeInfo("font_ptr");
      expect(result).toBeDefined();
      expect(result?.baseType).toBe("font_t");
      expect(result?.isPointer).toBe(true);
    });

    it("getVariableTypeInfo ignores C array variables with primitive types", () => {
      state.symbolTable.addCSymbol(
        createCVariableSymbol({
          name: "lookup_table",
          type: "uint8_t",
          isArray: true,
          arrayDimensions: [16],
        }),
      );

      expect(state.getVariableTypeInfo("lookup_table")).toBeUndefined();
    });

    it("getVariableTypeInfo ignores C volatile register variables", () => {
      state.symbolTable.addCSymbol(
        createCVariableSymbol({
          name: "status_reg",
          type: "uint32_t",
        }),
      );

      expect(state.getVariableTypeInfo("status_reg")).toBeUndefined();
    });

    it("getVariableTypeInfo prefers TSymbol over CSymbol with same name (Issue #978)", () => {
      // Both C-Next and C symbols exist with same name
      state.symbolTable.markTypedefStructType("config_t", "config.h");

      state.symbolTable.addTSymbol(
        createCNextVariableSymbol({
          name: "config",
          type: TTypeUtils.createPrimitive("u32"),
        }),
      );

      state.symbolTable.addCSymbol(
        createCVariableSymbol({
          name: "config",
          type: "config_t",
        }),
      );

      // TSymbol should win (checked first in priority order)
      const result = state.getVariableTypeInfo("config");
      expect(result?.baseType).toBe("u32");
    });

    it("getVariableTypeInfo prefers local registry over SymbolTable", () => {
      // Add both local and SymbolTable version
      const localInfo: TTypeInfo = {
        baseType: "i32",
        bitWidth: 32,
        isArray: false,
        isConst: true,
      };
      state.setVariableTypeInfo("mixedVar", localInfo);

      state.symbolTable.addTSymbol(
        createCNextVariableSymbol({
          name: "mixedVar",
          type: TTypeUtils.createPrimitive("u8"),
        }),
      );

      // Should return local info, not SymbolTable info
      const result = state.getVariableTypeInfo("mixedVar");
      expect(result?.baseType).toBe("i32");
      expect(result?.isConst).toBe(true);
    });

    it("hasVariableTypeInfo returns true for local registry", () => {
      state.setVariableTypeInfo("localVar", {
        baseType: "u8",
        bitWidth: 8,
        isArray: false,
        isConst: false,
      });

      expect(state.hasVariableTypeInfo("localVar")).toBe(true);
    });

    it("hasVariableTypeInfo returns true for C-Next SymbolTable variable", () => {
      state.symbolTable.addTSymbol(
        createCNextVariableSymbol({
          name: "crossFileVar",
          type: TTypeUtils.createPrimitive("u32"),
        }),
      );

      expect(state.hasVariableTypeInfo("crossFileVar")).toBe(true);
    });

    it("hasVariableTypeInfo returns false for unknown variable", () => {
      expect(state.hasVariableTypeInfo("unknownVar")).toBe(false);
    });

    it("hasVariableTypeInfo returns false for C header primitive variable", () => {
      state.symbolTable.addCSymbol(
        createCVariableSymbol({
          name: "cVar",
          type: "int",
        }),
      );

      expect(state.hasVariableTypeInfo("cVar")).toBe(false);
    });

    it("hasVariableTypeInfo returns true for C header struct variable (Issue #978)", () => {
      state.symbolTable.markTypedefStructType("widget_t", "widget.h");
      state.symbolTable.addCSymbol(
        createCVariableSymbol({
          name: "my_widget",
          type: "widget_t",
        }),
      );

      expect(state.hasVariableTypeInfo("my_widget")).toBe(true);
    });

    it("hasVariableTypeInfo returns true for C struct via getStructFields path (Issue #978)", () => {
      state.symbolTable.addStructField("vec2", "x", "float");
      state.symbolTable.addStructField("vec2", "y", "float");

      state.symbolTable.addCSymbol(
        createCVariableSymbol({
          name: "position",
          type: "vec2",
        }),
      );

      expect(state.hasVariableTypeInfo("position")).toBe(true);
    });

    it("hasVariableTypeInfo returns false for C pointer to non-struct type", () => {
      state.symbolTable.addCSymbol(
        createCVariableSymbol({
          name: "data_ptr",
          type: "uint8_t*",
        }),
      );

      expect(state.hasVariableTypeInfo("data_ptr")).toBe(false);
    });

    it("setVariableTypeInfo and deleteVariableTypeInfo work correctly", () => {
      const typeInfo: TTypeInfo = {
        baseType: "f32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      };

      state.setVariableTypeInfo("tempVar", typeInfo);
      expect(state.getVariableTypeInfo("tempVar")).toBe(typeInfo);

      state.deleteVariableTypeInfo("tempVar");
      expect(state.getVariableTypeInfo("tempVar")).toBeUndefined();
    });

    it("getTypeRegistryView returns readonly view", () => {
      state.setVariableTypeInfo("var1", {
        baseType: "u8",
        bitWidth: 8,
        isArray: false,
        isConst: false,
      });
      state.setVariableTypeInfo("var2", {
        baseType: "u16",
        bitWidth: 16,
        isArray: false,
        isConst: false,
      });

      const view = state.getTypeRegistryView();

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

      state.setVariableTypeInfo("aliasVar", typeInfo);

      // getTypeInfo should return same result
      expect(state.getTypeInfo("aliasVar")).toBe(typeInfo);
    });

    it("convertSymbolToTypeInfo handles string<N> types", () => {
      state.symbolTable.addTSymbol(
        createCNextVariableSymbol({
          name: "myString",
          type: TTypeUtils.createString(32),
        }),
      );

      const result = state.getVariableTypeInfo("myString");

      expect(result?.baseType).toBe("char");
      expect(result?.bitWidth).toBe(8);
      expect(result?.isString).toBe(true);
      expect(result?.stringCapacity).toBe(32);
    });

    it("convertSymbolToTypeInfo handles enum types", () => {
      // Register an enum
      installMockSymbols(state, {
        knownEnums: new Set(["EColor"]),
      });

      state.symbolTable.addTSymbol(
        createCNextVariableSymbol({
          name: "color",
          type: TTypeUtils.createEnum("EColor"),
        }),
      );

      const result = state.getVariableTypeInfo("color");

      expect(result?.baseType).toBe("EColor");
      expect(result?.isEnum).toBe(true);
      expect(result?.enumTypeName).toBe("EColor");
    });

    it("convertSymbolToTypeInfo handles const and atomic", () => {
      state.symbolTable.addTSymbol(
        createCNextVariableSymbol({
          name: "constAtomicVar",
          type: TTypeUtils.createPrimitive("u32"),
          isConst: true,
          isAtomic: true,
          isVolatile: false,
          overflowBehavior: "clamp",
        }),
      );

      const result = state.getVariableTypeInfo("constAtomicVar");

      expect(result?.isConst).toBe(true);
      expect(result?.isAtomic).toBe(true);
    });

    it("convertSymbolToTypeInfo keeps the slot of a dimension it cannot fold (#1360)", () => {
      state.symbolTable.addTSymbol(
        createCNextVariableSymbol({
          name: "arrayVar",
          type: TTypeUtils.createPrimitive("u8"),
          isArray: true,
          arrayDimensions: [10, "invalid", 20],
        }),
      );

      const result = state.getVariableTypeInfo("arrayVar");

      // This used to assert [10, 20]. Dropping the slot slides every later
      // bound one position left, so checkArrayBounds validated dimension 3's
      // index against dimension 2's bound -- rejecting valid code and skipping
      // the real bound entirely. #1127 already established slot preservation
      // for the sibling conversion (getMemberTypeInfo); this one did not follow
      // it. UNRESOLVED_DIMENSION reads as "size unknown, cannot validate".
      expect(result?.arrayDimensions).toEqual([10, UNRESOLVED_DIMENSION, 20]);
    });

    it("convertSymbolToTypeInfo still folds a numeric string dimension (#1360)", () => {
      // Negative control for the case above: only a dimension that genuinely
      // cannot be folded becomes UNRESOLVED_DIMENSION. A numeric string carries a real
      // bound and must keep it, or the check would silently stop enforcing it.
      state.symbolTable.addTSymbol(
        createCNextVariableSymbol({
          name: "numericStringDims",
          type: TTypeUtils.createPrimitive("u8"),
          isArray: true,
          arrayDimensions: ["16", 3],
        }),
      );

      const result = state.getVariableTypeInfo("numericStringDims");

      expect(result?.arrayDimensions).toEqual([16, 3]);
    });
  });

  describe("Float Bit Shadow Helpers", () => {
    it("registerFloatBitShadow adds to floatBitShadows", () => {
      state.registerFloatBitShadow("myFloat_bits");
      expect(state.floatBitShadows.has("myFloat_bits")).toBe(true);
    });

    it("hasFloatBitShadow returns correct value", () => {
      expect(state.hasFloatBitShadow("myFloat_bits")).toBe(false);
      state.registerFloatBitShadow("myFloat_bits");
      expect(state.hasFloatBitShadow("myFloat_bits")).toBe(true);
    });

    it("markFloatShadowCurrent adds to floatShadowCurrent", () => {
      state.markFloatShadowCurrent("myFloat_bits");
      expect(state.floatShadowCurrent.has("myFloat_bits")).toBe(true);
    });

    it("isFloatShadowCurrent returns correct value", () => {
      expect(state.isFloatShadowCurrent("myFloat_bits")).toBe(false);
      state.markFloatShadowCurrent("myFloat_bits");
      expect(state.isFloatShadowCurrent("myFloat_bits")).toBe(true);
    });
  });

  describe("C++ Mode Helpers", () => {
    it("addPendingTempDeclaration adds declaration", () => {
      state.addPendingTempDeclaration("int cnx_tmp0 = x;");
      expect(state.pendingTempDeclarations).toContain("int cnx_tmp0 = x;");
    });

    it("flushPendingTempDeclarations returns and clears declarations", () => {
      state.addPendingTempDeclaration("int cnx_tmp0 = x;");
      state.addPendingTempDeclaration("int cnx_tmp1 = y;");

      const decls = state.flushPendingTempDeclarations();

      expect(decls).toHaveLength(2);
      expect(decls).toContain("int cnx_tmp0 = x;");
      expect(decls).toContain("int cnx_tmp1 = y;");
      expect(state.pendingTempDeclarations).toHaveLength(0);
    });

    it("getNextTempVarName returns incrementing names", () => {
      state = new RenderState(); // Reset counter
      expect(state.getNextTempVarName()).toBe("cnx_tmp0");
      expect(state.getNextTempVarName()).toBe("cnx_tmp1");
      expect(state.getNextTempVarName()).toBe("cnx_tmp2");
    });
  });

  describe("Symbol Lookup Helpers", () => {
    it("isKnownEnum returns false without symbols", () => {
      state.symbols = null;
      expect(state.isKnownEnum("MyEnum")).toBe(false);
    });

    it("isKnownEnum returns true for known enum", () => {
      installMockSymbols(state, {
        knownEnums: new Set(["MyEnum"]),
      });

      expect(state.isKnownEnum("MyEnum")).toBe(true);
      expect(state.isKnownEnum("UnknownEnum")).toBe(false);
    });

    it("isKnownScope returns false without symbols", () => {
      state.symbols = null;
      expect(state.isKnownScope("MyScope")).toBe(false);
    });

    it("isKnownScope returns true for known scope", () => {
      installMockSymbols(state, {
        knownScopes: new Set(["MyScope"]),
      });

      expect(state.isKnownScope("MyScope")).toBe(true);
      expect(state.isKnownScope("UnknownScope")).toBe(false);
    });

    it("isOpaqueType returns false without a program", () => {
      state.program = null;
      expect(state.isOpaqueType("widget_t")).toBe(false);
    });

    it("isOpaqueType returns true for opaque type", () => {
      // #1511: read from the artifact. This used to install a per-file
      // `ICodeGenSymbols.opaqueTypes` set that `mergeOpaqueTypes` patched the
      // whole-program answer into; both are gone, so the question has one owner.
      const opaque = new Set(["widget_t", "display_t"]);
      state.program = {
        isOpaqueType: (name: string) => opaque.has(name),
      } as unknown as IProgram;

      expect(state.isOpaqueType("widget_t")).toBe(true);
      expect(state.isOpaqueType("display_t")).toBe(true);
      expect(state.isOpaqueType("Point")).toBe(false);

      state.program = null;
    });
  });

  describe("Scope Type Qualification (ADR-057)", () => {
    it("isScopeType matches enums, structs and bitmaps by qualified name", () => {
      installMockSymbols(state, {
        knownEnums: new Set(["A__B"]),
        knownStructs: new Set(["A__S"]),
        knownBitmaps: new Set(["A__Flags"]),
      });

      expect(state.isScopeType("A__B")).toBe(true);
      expect(state.isScopeType("A__S")).toBe(true);
      expect(state.isScopeType("A__Flags")).toBe(true);
      expect(state.isScopeType("A__Nope")).toBe(false);
    });

    it("isScopeType returns false without symbols", () => {
      state.symbols = null;
      expect(state.isScopeType("A__B")).toBe(false);
    });

    // #1452: four `qualifyScopeType` cases lived here. The method had no
    // production caller -- codegen binds the predicate through
    // `typeBindingDeps` instead -- so it is deleted along with the CLAUDE.md
    // rule that named it. The SEMANTICS stay covered on the live utility:
    // `ScopeUtils.test.ts` asserts the chain-qualified lookup, the fall-through
    // to a bare name when a scope member is not a type, and that a different
    // scope's type is not reachable bare. What is gone with them is only the
    // binding to `currentScopePath`, which `scopeTypePredicate`'s own test
    // below covers.
  });

  describe("Local Variable Helpers", () => {
    it("isLocalVariable returns correct value", () => {
      expect(state.isLocalVariable("myVar")).toBe(false);
      state.localVariables.add("myVar");
      expect(state.isLocalVariable("myVar")).toBe(true);
    });

    it("isLocalArray returns correct value", () => {
      expect(state.isLocalArray("myArr")).toBe(false);
      state.localArrays.add("myArr");
      expect(state.isLocalArray("myArr")).toBe(true);
    });
  });

  // #1447: the derivation moved to `Program` -- which fields a header's
  // struct has is a cross-file fact. These still exercise it end to end,
  // through the accessor analyzers actually call.
  describe("external struct fields, via Program", () => {
    it("returns empty map when no struct fields exist", () => {
      state.program = Program.build([], {
        headerStructFields: state.symbolTable.getAllStructFields(),
      });
      const result = state.getExternalStructFields();
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
      state.symbolTable.restoreStructFields(structFields);

      state.program = Program.build([], {
        headerStructFields: state.symbolTable.getAllStructFields(),
      });
      const result = state.getExternalStructFields();

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
      state.symbolTable.restoreStructFields(structFields);

      state.program = Program.build([], {
        headerStructFields: state.symbolTable.getAllStructFields(),
      });
      const result = state.getExternalStructFields();

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
      state.symbolTable.restoreStructFields(structFields);

      state.program = Program.build([], {
        headerStructFields: state.symbolTable.getAllStructFields(),
      });
      const result = state.getExternalStructFields();

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
      state.symbolTable.restoreStructFields(structFields);

      state.program = Program.build([], {
        headerStructFields: state.symbolTable.getAllStructFields(),
      });
      const result = state.getExternalStructFields();

      // Mixed struct should have only non-array fields
      expect(result.get("Mixed")?.size).toBe(2);
      expect(result.get("Mixed")?.has("id")).toBe(true);
      expect(result.get("Mixed")?.has("count")).toBe(true);
      expect(result.get("Mixed")?.has("name")).toBe(false);

      // Simple struct should have its field
      expect(result.get("Simple")?.has("value")).toBe(true);
    });
  });

  describe("isParameterModifiedAnywhere (#1552, #1529)", () => {
    // The one modification fact behind every auto-const decision. Two callers
    // used to answer it separately with OPPOSITE defaults on a missing entry,
    // which is how a single fact produced a `const` the prototype lacked
    // (#1529) and dropped one the prototype had (#1552). The polarity assertion
    // below is the contract, not a detail.
    const programWith = (modified: ReadonlyMap<string, ReadonlySet<string>>) =>
      ({ modifiedParameters: () => modified }) as unknown as IProgram;

    it("reads the whole-program fact when a Program is present", () => {
      state.program = programWith(new Map([["mutate", new Set(["s"])]]));
      // The per-file accumulator this used to contradict is gone (#1452), so
      // the control is structural now: there is no second source a pass could
      // come from.

      expect(state.isParameterModifiedAnywhere("mutate", "s")).toBe(true);

      state.program = null;
    });

    it("treats a function absent from the program as NOT modified", () => {
      // The polarity that matters: an absent entry means auto-const APPLIES,
      // matching what the prototype does. Reading it the other way is what made
      // an included function-as-type lose its const (#1552).
      state.program = programWith(new Map());

      expect(state.isParameterModifiedAnywhere("record", "s")).toBe(false);

      state.program = null;
    });

    it("treats a known function's unlisted parameter as NOT modified", () => {
      state.program = programWith(new Map([["partly", new Set(["written"])]]));

      expect(state.isParameterModifiedAnywhere("partly", "written")).toBe(true);
      expect(state.isParameterModifiedAnywhere("partly", "read")).toBe(false);

      state.program = null;
    });

    it("answers NOT modified when there is no Program", () => {
      // #1452 retired this test's original subject. It asserted a FALLBACK to a
      // per-file accumulator on `RenderState` -- the one this method's own
      // docblock named as the bug in #1529 and #1552, empty while declarations
      // are walked and absent entirely for an included function. The
      // accumulator is gone, so there is no second source to fall back to and
      // the branch cannot be tested because it no longer exists.
      //
      // What remains is the polarity, which is the part that was load-bearing:
      // absent means NOT modified, so auto-const applies.
      state.program = null;

      expect(state.isParameterModifiedAnywhere("localOnly", "target")).toBe(
        false,
      );
    });
  });

  /**
   * Issue #1450 box 4: one binding, not six.
   *
   * `isScopeType` is a static that reads `this.symbolTable`, so a bare
   * reference loses its receiver. Six sites each wrote the same closure to work
   * around that. Unifying them rots silently -- every closure returns the same
   * answer, so a seventh would keep every fixture green -- which is why
   * `docs/architecture/README.md` principle 5 wants the invariant stated with a
   * gate rather than in a comment.
   *
   * The forbidden form is derived by reading `src/`, never listed, so the guard
   * cannot go stale against a file it does not know about. The first attempt at
   * the inventory this replaced grepped for the parameter name `qualifiedName`
   * and missed a site that spelled it `qn` -- matching on the RECEIVER is what
   * makes the spelling irrelevant.
   */
  /**
   * Issue #1450 box 4: `withScopePath` exists for the `finally`.
   *
   * Two sites hand-rolled the save/restore with the restore as a plain trailing
   * statement, so a throw anywhere in the body left `currentScopePath` pointing
   * at the wrong scope. That is the same defect #872 extracted
   * `withExpectedType` to fix -- its doc says "add exception safety" -- and
   * scope path never got the same treatment.
   *
   * The happy path is already covered by 1247 fixtures; it is the THROWING path
   * that had no coverage and is the entire reason the helper exists, so that is
   * what this pins. Mutation: replacing the `finally` with a trailing
   * assignment reddens exactly this test.
   */
  describe("withScopePath", () => {
    it("restores the previous scope path when fn throws", () => {
      // #1304 landed while this branch was open: the registry is now the
      // authority on which scopes exist, so both paths must be registered
      // before they can be entered. `enterScope` is main's helper for exactly
      // this; `Inner` is registered directly because `withScopePath` is what
      // enters it.
      enterScope(state, "Outer");
      registerScope("Inner");
      const before = state.currentScopePath;

      expect(() =>
        state.withScopePath("Inner", () => {
          expect(state.currentScopePath).toBe("Inner");
          throw new Error("boom");
        }),
      ).toThrow("boom");

      expect(state.currentScopePath).toBe(before);
    });

    it("restores the previous scope path on the ordinary path too", () => {
      // #1304 landed while this branch was open: the registry is now the
      // authority on which scopes exist, so both paths must be registered
      // before they can be entered. `enterScope` is main's helper for exactly
      // this; `Inner` is registered directly because `withScopePath` is what
      // enters it.
      enterScope(state, "Outer");
      registerScope("Inner");
      const before = state.currentScopePath;

      const seen = state.withScopePath("Inner", () => state.currentScopePath);

      expect(seen).toBe("Inner");
      expect(state.currentScopePath).toBe(before);
    });
  });

  describe("scopeTypePredicate", () => {
    it("survives being passed unbound, which is why it exists", () => {
      const predicate: (name: string) => boolean = state.scopeTypePredicate;

      expect(() => predicate("NoSuchType")).not.toThrow();
      expect(predicate("NoSuchType")).toBe(false);
    });

    it("is the only closure in src/ that binds state.isScopeType", () => {
      const owner = join("src", "transpiler", "state", "state.ts");
      const binds = /RenderState\s*\.\s*isScopeType\s*\(/;

      const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((entry) => {
          const full = join(dir, entry);
          return statSync(full).isDirectory()
            ? walk(full)
            : entry.endsWith(".ts")
              ? [full]
              : [];
        });

      // Comments are stripped first. `NameExistence` explains at length why
      // `state.isScopeType()` cannot serve its purpose, and a guard that
      // forbade naming the method in prose would forbid exactly the
      // documentation that keeps the next person from reaching for it.
      const code = (source: string): string =>
        source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

      const offenders = walk(join(repoRootForGuard, "src"))
        .map((file) => relative(repoRootForGuard, file))
        .filter((file) => file !== owner && !file.includes("__tests__"))
        .filter((file) =>
          binds.test(code(readFileSync(join(repoRootForGuard, file), "utf8"))),
        );

      expect(offenders).toEqual([]);
    });
  });

  /**
   * #1295 and #1304 are two halves of ONE decision: a scope's identity is its
   * `cnxScopedName`, and the producer (`TSymbolInfoAdapter.processScope`, which
   * keys `scopeMembers` by it) and the reader (`currentScopePath`) must name the
   * same scope OBJECT.
   *
   * They agree by construction rather than by coincidence, because
   * `setCurrentScopeByPath` does not store its argument -- it reads the path back
   * off the registered scope. The single way to break that is for the registry to
   * hand back a different scope than the producer keyed from, which is exactly
   * what `getOrCreateScope` did when handed a leaf: it minted a fresh orphan
   * parented to global, and the producer's key then missed in silence.
   *
   * These tests drive the READERS. The `TSymbolInfoAdapter` block covers the
   * producer; before this, re-inlining `ScopeUtils.leafOf` at any reader site
   * left the whole suite green.
   */
  describe("scope identity comes from the registry, not the caller's string (#1295, #1304)", () => {
    beforeEach(() => {
      state = new RenderState();
    });

    it("resolves a member through the whole path when the scope is registered", () => {
      registerScope("Outer.Inner");
      state.setScopeMembers("Outer.Inner", new Set(["token"]));

      state.setCurrentScopeByPath("Outer.Inner");

      expect(state.currentScopePath).toBe("Outer.Inner");
      expect(state.isCurrentScopeMember("token")).toBe(true);
      expect(state.resolveIdentifier("token")).toBe("Outer__Inner__token");
    });

    /**
     * NEGATIVE CONTROL for the case above. Without it the assertions would pass
     * just as well if every name were qualified.
     */
    it("leaves a name that is not a member unqualified", () => {
      registerScope("Outer.Inner");
      state.setScopeMembers("Outer.Inner", new Set(["token"]));
      state.setCurrentScopeByPath("Outer.Inner");

      expect(state.isCurrentScopeMember("hidden")).toBe(false);
      expect(state.resolveIdentifier("hidden")).toBe("hidden");
    });
  });
});
