/**
 * Unit tests for the struct declaration generator.
 *
 * #1445 box 3: the generator takes `IPlannedStruct`, so these build plans. The
 * four renders stay callbacks in the plan -- each is conditional in the
 * generator, so a test can also assert that a branch does NOT render, which is
 * what the tracked-dimensions case is really about.
 */
import { describe, it, expect } from "vitest";
import generateStruct from "../StructGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import TestGeneratorState from "../../__tests__/testGeneratorState";
import type IPlannedStruct from "../../../types/IPlannedStruct";
import type IPlannedStructField from "../../../types/IPlannedStructField";

// ========================================================================
// Test Helpers
// ========================================================================

/** The C types the type ladder resolves the primitives to. */
const C_TYPES: Record<string, string> = {
  u8: "uint8_t",
  u16: "uint16_t",
  u32: "uint32_t",
  i32: "int32_t",
  f32: "float",
  bool: "bool",
  string: "char",
};

/** Struct field definition for test setup. */
interface IStructFieldDef {
  name: string;
  type: string;
  /** Dimensions written after the NAME, e.g. ["4"] or ["4", "4"]. */
  arrayDims?: string[];
  /** Dimensions written on the TYPE, e.g. "[16]" for `u8[16] data`. */
  typeDims?: string;
  /** ADR-017's zero for the field's type. */
  zero?: string;
}

/** A planned field. */
function field(def: IStructFieldDef): IPlannedStructField {
  return {
    name: def.name,
    typeName: def.type,
    hasNameDimensions: (def.arrayDims?.length ?? 0) > 0,
    hasTypeDimensions: def.typeDims !== undefined,
    renderCType: () => C_TYPES[def.type] ?? def.type,
    renderTypeDimensions: () => def.typeDims ?? "",
    renderNameDimensions: () =>
      (def.arrayDims ?? []).map((dim) => `[${dim}]`).join(""),
    renderZeroInitializer: () => def.zero ?? "0",
  };
}

/** A planned struct. */
function planned(name: string, fields: IStructFieldDef[]): IPlannedStruct {
  return { name, fields: fields.map(field) };
}

/**
 * Create minimal mock input with optional callback types and field dimensions.
 */
function createMockInput(
  options: {
    callbackTypes?: Map<string, { typedefName: string }>;
    structFieldDimensions?: Map<string, Map<string, readonly number[]>>;
    knownEnums?: Set<string>;
  } = {},
): IGeneratorInput {
  return {
    callbackTypes: options.callbackTypes ?? new Map(),
    symbols: {
      structFieldDimensions: options.structFieldDimensions ?? new Map(),
      knownEnums: options.knownEnums ?? new Set(),
      // Other fields not used
      knownScopes: new Set(),
      knownStructs: new Set(),
      knownRegisters: new Set(),
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

/** Create minimal mock state. */
function createMockState(): IGeneratorState {
  return TestGeneratorState.create();
}

/**
 * The generator reaches the orchestrator for one thing now: the aggregate zero
 * brace the ADR-029 init function opens with. Everything else arrives planned.
 *
 * #1568: the init function zeroes the aggregate before assigning the fields
 * whose value is not zero. `{0}` is the C spelling.
 */
function createMockOrchestrator(): IOrchestrator {
  return {
    getAggregateZeroInitBrace: () => "{0}",
  } as unknown as IOrchestrator;
}

/** Run the generator on a plan. */
function generate(struct: IPlannedStruct, input: IGeneratorInput) {
  return generateStruct(
    struct,
    input,
    createMockState(),
    createMockOrchestrator(),
  );
}

// ========================================================================
// Tests
// ========================================================================

describe("StructGenerator", () => {
  describe("basic struct generation", () => {
    it("generates struct with single field", () => {
      const struct = planned("Point", [{ name: "x", type: "i32" }]);
      const input = createMockInput();

      const result = generate(struct, input);

      expect(result.code).toBe(
        `typedef struct Point {
    int32_t x;
} Point;
`,
      );
    });

    it("generates struct with multiple fields", () => {
      const struct = planned("Point3D", [
        { name: "x", type: "f32" },
        { name: "y", type: "f32" },
        { name: "z", type: "f32" },
      ]);
      const input = createMockInput();

      const result = generate(struct, input);

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
      const struct = planned("Config", [
        { name: "id", type: "u32" },
        { name: "enabled", type: "bool" },
        { name: "value", type: "f32" },
      ]);
      const input = createMockInput();

      const result = generate(struct, input);

      expect(result.code).toContain("uint32_t id;");
      expect(result.code).toContain("bool enabled;");
      expect(result.code).toContain("float value;");
    });
  });

  describe("array fields (ADR-036)", () => {
    it("generates struct with single-dimension array field", () => {
      const struct = planned("Buffer", [
        { name: "data", type: "u8", arrayDims: ["256"] },
      ]);
      const input = createMockInput();

      const result = generate(struct, input);

      expect(result.code).toContain("uint8_t data[256];");
    });

    it("generates struct with multi-dimension array field", () => {
      const struct = planned("Matrix", [
        { name: "values", type: "f32", arrayDims: ["4", "4"] },
      ]);
      const input = createMockInput();

      const result = generate(struct, input);

      expect(result.code).toContain("float values[4][4];");
    });

    it("uses tracked dimensions when available", () => {
      const struct = planned("StringArray", [
        { name: "items", type: "string", arrayDims: ["4"] },
      ]);
      // Tracked dimensions include string capacity
      const structFieldDimensions = new Map([
        ["StringArray", new Map([["items", [4, 65] as readonly number[]]])],
      ]);
      const input = createMockInput({ structFieldDimensions });

      const result = generate(struct, input);

      expect(result.code).toContain("char items[4][65];");
    });

    /**
     * The tracked-dimension branch renders NEITHER dimension source. That is
     * why they are thunks: rendering them would register effects for
     * dimensions this field does not emit.
     */
    it("renders no written dimension when tracked ones are used", () => {
      let renders = 0;
      const counting = (): string => {
        renders += 1;
        return "[IGNORED]";
      };

      const struct: IPlannedStruct = {
        name: "StringArray",
        fields: [
          {
            ...field({ name: "items", type: "string", arrayDims: ["4"] }),
            renderTypeDimensions: counting,
            renderNameDimensions: counting,
          },
        ],
      };

      const result = generate(
        struct,
        createMockInput({
          structFieldDimensions: new Map([
            ["StringArray", new Map([["items", [4, 65] as readonly number[]]])],
          ]),
        }),
      );

      expect(result.code).toContain("char items[4][65];");
      expect(renders).toBe(0);
    });
  });

  describe("callback fields (ADR-029)", () => {
    it("generates struct with callback field", () => {
      const struct = planned("Handler", [
        {
          name: "onEvent",
          type: "EventCallback",
        },
      ]);
      const callbackTypes = new Map([
        ["EventCallback", { typedefName: "EventCallback_t" }],
      ]);
      const input = createMockInput({ callbackTypes });

      const result = generate(struct, input);

      expect(result.code).toContain("EventCallback_t onEvent;");
    });

    it("generates init function for struct with callback", () => {
      const struct = planned("Handler", [
        {
          name: "callback",
          type: "MyCallback",
        },
      ]);
      const callbackTypes = new Map([
        ["MyCallback", { typedefName: "MyCallback_t" }],
      ]);
      const input = createMockInput({ callbackTypes });

      const result = generate(struct, input);

      // #1568: the aggregate is zeroed first, then the callback assigned. The
      // compound literal this replaces named every field with a per-type zero,
      // which is invalid in a designated-initializer position for an array or a
      // scalar typedef.
      expect(result.code).toContain("Handler Handler_init(void) {");
      expect(result.code).toContain("Handler value = {0};");
      expect(result.code).toContain("value.callback = MyCallback;");
      expect(result.code).toContain("return value;");
      expect(result.code).not.toContain("return (Handler){");
    });

    it("generates init function with multiple callbacks", () => {
      const struct = planned("EventManager", [
        {
          name: "onStart",
          type: "StartCallback",
        },
        {
          name: "onStop",
          type: "StopCallback",
        },
      ]);
      const callbackTypes = new Map([
        ["StartCallback", { typedefName: "StartCallback_t" }],
        ["StopCallback", { typedefName: "StopCallback_t" }],
      ]);
      const input = createMockInput({ callbackTypes });

      const result = generate(struct, input);

      expect(result.code).toContain("EventManager value = {0};");
      expect(result.code).toContain("value.onStart = StartCallback;");
      expect(result.code).toContain("value.onStop = StopCallback;");
      // ADR-029 "Never Null": every callback field is assigned, not just the first
      expect(result.code.indexOf("value.onStart")).toBeLessThan(
        result.code.indexOf("value.onStop"),
      );
    });

    it("generates callback array field", () => {
      const struct = planned("Handlers", [
        {
          name: "callbacks",
          type: "Handler",
          arrayDims: ["4"],
        },
      ]);
      const callbackTypes = new Map([
        ["Handler", { typedefName: "Handler_t" }],
      ]);
      const input = createMockInput({ callbackTypes });

      const result = generate(struct, input);

      expect(result.code).toContain("Handler_t callbacks[4];");
    });
  });

  describe("effects", () => {
    it("returns empty effects for simple struct", () => {
      const struct = planned("Simple", [{ name: "value", type: "u32" }]);
      const input = createMockInput();

      const result = generate(struct, input);

      expect(result.effects).toEqual([]);
    });

    it("registers callback field effect", () => {
      const struct = planned("Handler", [
        {
          name: "onEvent",
          type: "Callback",
        },
      ]);
      const callbackTypes = new Map([
        ["Callback", { typedefName: "Callback_t" }],
      ]);
      const input = createMockInput({ callbackTypes });

      const result = generate(struct, input);

      expect(result.effects).toContainEqual({
        type: "register-callback-field",
        key: "Handler.onEvent",
        typeName: "Callback",
      });
    });
  });

  describe("named struct for forward declaration (Issue #296)", () => {
    it("uses named struct syntax", () => {
      const struct = planned("Node", [{ name: "value", type: "i32" }]);
      const input = createMockInput();

      const result = generate(struct, input);

      // Should be "typedef struct Node {" not "typedef struct {"
      expect(result.code).toContain("typedef struct Node {");
    });
  });
});
