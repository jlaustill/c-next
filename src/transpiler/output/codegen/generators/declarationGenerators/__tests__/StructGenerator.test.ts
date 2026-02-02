import { describe, it, expect } from "vitest";
import generateStruct from "../StructGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import * as Parser from "../../../../../logic/parser/grammar/CNextParser";

// ========================================================================
// Test Helpers
// ========================================================================

/**
 * Struct member definition for test setup.
 */
interface IStructMemberDef {
  name: string;
  type: string;
  cType: string;
  arrayDims?: string[]; // e.g., ["4"], ["4", "4"]
  isCallback?: boolean;
}

/**
 * Create a minimal mock struct member context.
 */
function createMockStructMember(def: IStructMemberDef) {
  return {
    IDENTIFIER: () => ({ getText: () => def.name }),
    type: () => ({
      getText: () => def.type,
      stringType: () => null, // No string type by default
    }),
    arrayDimension: () =>
      def.arrayDims?.map((dim) => ({ __mockDim: dim })) ?? [],
  };
}

/**
 * Create a minimal mock struct declaration context.
 */
function createMockStructContext(
  name: string,
  members: IStructMemberDef[],
): Parser.StructDeclarationContext {
  return {
    IDENTIFIER: () => ({ getText: () => name }),
    structMember: () => members.map(createMockStructMember),
  } as unknown as Parser.StructDeclarationContext;
}

/**
 * Create minimal mock input with optional callback types and field dimensions.
 */
function createMockInput(
  options: {
    callbackTypes?: Map<string, { typedefName: string }>;
    structFieldDimensions?: Map<string, Map<string, readonly number[]>>;
  } = {},
): IGeneratorInput {
  return {
    callbackTypes: options.callbackTypes ?? new Map(),
    symbols: {
      structFieldDimensions: options.structFieldDimensions ?? new Map(),
      // Other fields not used
      knownScopes: new Set(),
      knownStructs: new Set(),
      knownRegisters: new Set(),
      knownEnums: new Set(),
      knownBitmaps: new Set(),
      scopeMembers: new Map(),
      scopeMemberVisibility: new Map(),
      structFields: new Map(),
      structFieldArrays: new Map(),
      enumMembers: new Map(),
      bitmapFields: new Map(),
      bitmapBackingType: new Map(),
      bitmapBitWidth: new Map(),
      scopedRegisters: new Map(),
      registerMemberAccess: new Map(),
      registerMemberTypes: new Map(),
      scopePrivateConstValues: new Map(),
    },
  } as unknown as IGeneratorInput;
}

/**
 * Create minimal mock state.
 */
function createMockState(): IGeneratorState {
  return {
    currentScope: null,
    indentLevel: 0,
    inFunctionBody: false,
    currentParameters: new Map(),
    localVariables: new Set(),
    localArrays: new Set(),
    expectedType: null,
    selfIncludeAdded: false,
  };
}

/**
 * Create mock orchestrator with required methods.
 */
function createMockOrchestrator(typeMap: Map<string, string>): IOrchestrator {
  return {
    generateType: (ctx: { getText: () => string }) => {
      const cnextType = ctx.getText();
      return typeMap.get(cnextType) ?? cnextType;
    },
    getTypeName: (ctx: { getText: () => string }) => {
      return ctx.getText();
    },
    generateArrayDimensions: (dims: Array<{ __mockDim: string }>) => {
      return dims.map((d) => `[${d.__mockDim}]`).join("");
    },
  } as unknown as IOrchestrator;
}

// ========================================================================
// Tests
// ========================================================================

describe("StructGenerator", () => {
  // Standard type mappings
  const standardTypes = new Map([
    ["u8", "uint8_t"],
    ["u16", "uint16_t"],
    ["u32", "uint32_t"],
    ["i32", "int32_t"],
    ["f32", "float"],
    ["bool", "bool"],
  ]);

  describe("basic struct generation", () => {
    it("generates struct with single field", () => {
      const ctx = createMockStructContext("Point", [
        { name: "x", type: "i32", cType: "int32_t" },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateStruct(ctx, input, state, orchestrator);

      expect(result.code).toBe(
        `typedef struct Point {
    int32_t x;
} Point;
`,
      );
    });

    it("generates struct with multiple fields", () => {
      const ctx = createMockStructContext("Point3D", [
        { name: "x", type: "f32", cType: "float" },
        { name: "y", type: "f32", cType: "float" },
        { name: "z", type: "f32", cType: "float" },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateStruct(ctx, input, state, orchestrator);

      expect(result.code).toBe(
        `typedef struct Point3D {
    float x;
    float y;
    float z;
} Point3D;
`,
      );
    });

    it("generates struct with mixed types", () => {
      const ctx = createMockStructContext("Config", [
        { name: "id", type: "u32", cType: "uint32_t" },
        { name: "enabled", type: "bool", cType: "bool" },
        { name: "value", type: "f32", cType: "float" },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateStruct(ctx, input, state, orchestrator);

      expect(result.code).toContain("uint32_t id;");
      expect(result.code).toContain("bool enabled;");
      expect(result.code).toContain("float value;");
    });
  });

  describe("array fields (ADR-036)", () => {
    it("generates struct with single-dimension array field", () => {
      const ctx = createMockStructContext("Buffer", [
        { name: "data", type: "u8", cType: "uint8_t", arrayDims: ["256"] },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateStruct(ctx, input, state, orchestrator);

      expect(result.code).toContain("uint8_t data[256];");
    });

    it("generates struct with multi-dimension array field", () => {
      const ctx = createMockStructContext("Matrix", [
        { name: "values", type: "f32", cType: "float", arrayDims: ["4", "4"] },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateStruct(ctx, input, state, orchestrator);

      expect(result.code).toContain("float values[4][4];");
    });

    it("uses tracked dimensions when available", () => {
      const ctx = createMockStructContext("StringArray", [
        { name: "items", type: "string", cType: "char", arrayDims: ["4"] },
      ]);
      // Tracked dimensions include string capacity
      const structFieldDimensions = new Map([
        ["StringArray", new Map([["items", [4, 65] as readonly number[]]])],
      ]);
      const input = createMockInput({ structFieldDimensions });
      const state = createMockState();
      const orchestrator = createMockOrchestrator(
        new Map([["string", "char"]]),
      );

      const result = generateStruct(ctx, input, state, orchestrator);

      expect(result.code).toContain("char items[4][65];");
    });
  });

  describe("callback fields (ADR-029)", () => {
    it("generates struct with callback field", () => {
      const ctx = createMockStructContext("Handler", [
        {
          name: "onEvent",
          type: "EventCallback",
          cType: "EventCallback",
          isCallback: true,
        },
      ]);
      const callbackTypes = new Map([
        ["EventCallback", { typedefName: "EventCallback_t" }],
      ]);
      const input = createMockInput({ callbackTypes });
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateStruct(ctx, input, state, orchestrator);

      expect(result.code).toContain("EventCallback_t onEvent;");
    });

    it("generates init function for struct with callback", () => {
      const ctx = createMockStructContext("Handler", [
        {
          name: "callback",
          type: "MyCallback",
          cType: "MyCallback",
          isCallback: true,
        },
      ]);
      const callbackTypes = new Map([
        ["MyCallback", { typedefName: "MyCallback_t" }],
      ]);
      const input = createMockInput({ callbackTypes });
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateStruct(ctx, input, state, orchestrator);

      expect(result.code).toContain("Handler Handler_init(void) {");
      expect(result.code).toContain("return (Handler){");
      expect(result.code).toContain(".callback = MyCallback");
    });

    it("generates init function with multiple callbacks", () => {
      const ctx = createMockStructContext("EventManager", [
        {
          name: "onStart",
          type: "StartCallback",
          cType: "StartCallback",
          isCallback: true,
        },
        {
          name: "onStop",
          type: "StopCallback",
          cType: "StopCallback",
          isCallback: true,
        },
      ]);
      const callbackTypes = new Map([
        ["StartCallback", { typedefName: "StartCallback_t" }],
        ["StopCallback", { typedefName: "StopCallback_t" }],
      ]);
      const input = createMockInput({ callbackTypes });
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateStruct(ctx, input, state, orchestrator);

      expect(result.code).toContain(".onStart = StartCallback,");
      expect(result.code).toContain(".onStop = StopCallback");
    });

    it("generates callback array field", () => {
      const ctx = createMockStructContext("Handlers", [
        {
          name: "callbacks",
          type: "Handler",
          cType: "Handler",
          isCallback: true,
          arrayDims: ["4"],
        },
      ]);
      const callbackTypes = new Map([
        ["Handler", { typedefName: "Handler_t" }],
      ]);
      const input = createMockInput({ callbackTypes });
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateStruct(ctx, input, state, orchestrator);

      expect(result.code).toContain("Handler_t callbacks[4];");
    });
  });

  describe("effects", () => {
    it("returns empty effects for simple struct", () => {
      const ctx = createMockStructContext("Simple", [
        { name: "value", type: "u32", cType: "uint32_t" },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateStruct(ctx, input, state, orchestrator);

      expect(result.effects).toEqual([]);
    });

    it("registers callback field effect", () => {
      const ctx = createMockStructContext("Handler", [
        {
          name: "onEvent",
          type: "Callback",
          cType: "Callback",
          isCallback: true,
        },
      ]);
      const callbackTypes = new Map([
        ["Callback", { typedefName: "Callback_t" }],
      ]);
      const input = createMockInput({ callbackTypes });
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateStruct(ctx, input, state, orchestrator);

      expect(result.effects).toContainEqual({
        type: "register-callback-field",
        key: "Handler.onEvent",
        typeName: "Callback",
      });
    });
  });

  describe("named struct for forward declaration (Issue #296)", () => {
    it("uses named struct syntax", () => {
      const ctx = createMockStructContext("Node", [
        { name: "value", type: "i32", cType: "int32_t" },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateStruct(ctx, input, state, orchestrator);

      // Should be "typedef struct Node {" not "typedef struct {"
      expect(result.code).toContain("typedef struct Node {");
    });
  });
});
