import type IBitmapFieldLayout from "../../../transpiler/types/IBitmapFieldLayout";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach } from "vitest";
import AssignmentClassifier from "../AssignmentClassifier";
import AssignmentKind from "../../../transpiler/types/AssignmentKind";
import AssignmentHandlerRegistry from "../../3-Render/codegen/assignment/index";
import IAssignmentContext from "../../../transpiler/types/IAssignmentContext";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import SymbolTable from "../../../PARSE/3-Declare/SymbolTable";
import TTypeInfo from "../../../transpiler/types/TTypeInfo";
import enterScope from "../../../transpiler/__tests__/enterScope";

// ========================================================================
// Test Helpers
// ========================================================================

/**
 * Create a minimal mock context for testing classification.
 */
function createMockContext(
  overrides: Partial<IAssignmentContext> = {},
): IAssignmentContext {
  // Compute resolvedBaseIdentifier from resolvedTarget if not explicitly provided
  const resolvedTarget = overrides.resolvedTarget ?? "x";
  const resolvedBaseIdentifier =
    overrides.resolvedBaseIdentifier ?? resolvedTarget.split(/[[.]/)[0];

  return {
    renderTarget: () => resolvedTarget,
    analyzeTargetForBitAccess: () =>
      ({
        isBitAccess: false,
      }) as IAssignmentContext["analyzeTargetForBitAccess"] extends () => infer R
        ? R
        : never,
    targetLine: 1,
    hasValue: false,
    valueExpressionType: () => null,
    valueIntegerType: () => null,
    foldValue: () => undefined,
    identifiers: ["x"],
    subscriptCount: 0,
    renderSubscript: () => "0",
    foldSubscript: () => undefined,
    postfixOps: [],
    hasThis: false,
    hasGlobal: false,
    hasMemberAccess: false,
    hasArrayAccess: false,
    postfixOpsCount: 0,
    cnextOp: "<-",
    cOp: "=",
    isCompound: false,
    generatedValue: "5",
    resolvedTarget,
    resolvedBaseIdentifier,
    firstIdTypeInfo: null,
    memberAccessDepth: 0,
    subscriptDepth: 0,
    lastSubscriptExprCount: 1, // default: 1 expression (array element, single bit)
    isSimpleIdentifier: true,
    isSimpleThisAccess: false,
    isSimpleGlobalAccess: false,
    ...overrides,
  };
}

/**
 * Create a minimal mock type info.
 */
function createTypeInfo(overrides: Partial<TTypeInfo> = {}): TTypeInfo {
  return {
    baseType: "u32",
    bitWidth: 32,
    isArray: false,
    isConst: false,
    ...overrides,
  };
}

/**
 * Helper to set up CodeGenState.symbols with minimal fields.
 * Issue #831: Also registers struct fields in SymbolTable (single source of truth).
 */
function setupSymbols(
  overrides: {
    knownRegisters?: Set<string>;
    knownScopes?: Set<string>;
    knownStructs?: Set<string>;
    bitmapFields?: Map<string, Map<string, IBitmapFieldLayout>>;
    registerMemberTypes?: Map<string, string>;
    structFields?: Map<string, Map<string, string>>;
    structFieldArrays?: Map<string, Set<string>>;
    structFieldDimensions?: Map<string, Map<string, readonly number[]>>;
  } = {},
): void {
  // Initialize symbolTable for struct field lookups
  CodeGenState.symbolTable = new SymbolTable();

  // Register struct fields in SymbolTable
  if (overrides.structFields) {
    for (const [structName, fields] of overrides.structFields) {
      for (const [fieldName, fieldType] of fields) {
        CodeGenState.symbolTable.addStructField(
          structName,
          fieldName,
          fieldType,
        );
      }
    }
  }

  CodeGenState.symbols = {
    knownScopes: overrides.knownScopes ?? new Set(),
    knownStructs: overrides.knownStructs ?? new Set(),
    knownRegisters: overrides.knownRegisters ?? new Set(),
    knownEnums: new Set<string>(),
    knownBitmaps: new Set<string>(),
    knownVariables: new Set<string>(),
    scopeMembers: new Map<string, Set<string>>(),
    scopeMemberVisibility: new Map(),
    structFields: overrides.structFields ?? new Map(),
    structFieldArrays: overrides.structFieldArrays ?? new Map(),
    structFieldDimensions: overrides.structFieldDimensions ?? new Map(),
    enumMembers: new Map(),
    bitmapFields: overrides.bitmapFields ?? new Map(),
    bitmapBackingType: new Map(),
    bitmapBitWidth: new Map(),
    scopedRegisters: new Map(),
    registerMemberAccess: new Map(),
    registerMemberTypes: overrides.registerMemberTypes ?? new Map(),
    registerBaseAddresses: new Map(),
    registerMemberOffsets: new Map(),
    registerMemberCTypes: new Map(),
    scopePrivateConstValues: new Map(),
    functionReturnTypes: new Map(),
  };
}

// ========================================================================
// SIMPLE Assignment
// ========================================================================
describe("AssignmentClassifier - SIMPLE", () => {
  beforeEach(() => {
    CodeGenState.reset();
    setupSymbols();
  });

  it("classifies simple identifier assignment", () => {
    const ctx = createMockContext({
      identifiers: ["x"],
      isSimpleIdentifier: true,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(AssignmentKind.SIMPLE);
  });

  it("classifies unknown pattern as SIMPLE fallback", () => {
    const ctx = createMockContext({
      identifiers: ["unknown"],
      hasMemberAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(AssignmentKind.SIMPLE);
  });
});

// ========================================================================
// Bitmap Field Assignments
// ========================================================================
describe("AssignmentClassifier - Bitmap Fields", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  it("classifies single-bit bitmap field", () => {
    const bitmapFields = new Map([
      ["StatusFlags", new Map([["Running", { offset: 0, width: 1 }]])],
    ]);
    setupSymbols({ bitmapFields });
    CodeGenState.setVariableTypeInfo(
      "flags",
      createTypeInfo({ isBitmap: true, bitmapTypeName: "StatusFlags" }),
    );

    const ctx = createMockContext({
      identifiers: ["flags", "Running"],
      hasMemberAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.BITMAP_FIELD_SINGLE_BIT,
    );
  });

  it("classifies multi-bit bitmap field", () => {
    const bitmapFields = new Map([
      ["StatusFlags", new Map([["Mode", { offset: 4, width: 4 }]])],
    ]);
    setupSymbols({ bitmapFields });
    CodeGenState.setVariableTypeInfo(
      "flags",
      createTypeInfo({ isBitmap: true, bitmapTypeName: "StatusFlags" }),
    );

    const ctx = createMockContext({
      identifiers: ["flags", "Mode"],
      hasMemberAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.BITMAP_FIELD_MULTI_BIT,
    );
  });

  it("classifies register member bitmap field", () => {
    const bitmapFields = new Map([
      ["ControlBits", new Map([["Enable", { offset: 0, width: 1 }]])],
    ]);
    const knownRegisters = new Set(["MOTOR"]);
    const registerMemberTypes = new Map([["MOTOR__CTRL", "ControlBits"]]);
    setupSymbols({ bitmapFields, knownRegisters, registerMemberTypes });

    const ctx = createMockContext({
      identifiers: ["MOTOR", "CTRL", "Enable"],
      hasMemberAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD,
    );
  });

  it("classifies struct member bitmap field", () => {
    const bitmapFields = new Map([
      ["DeviceFlags", new Map([["Active", { offset: 0, width: 1 }]])],
    ]);
    const knownStructs = new Set(["Device"]);
    const structFields = new Map([
      ["Device", new Map([["flags", "DeviceFlags"]])],
    ]);
    setupSymbols({ bitmapFields, knownStructs, structFields });
    CodeGenState.setVariableTypeInfo(
      "device",
      createTypeInfo({ baseType: "Device" }),
    );

    const ctx = createMockContext({
      identifiers: ["device", "flags", "Active"],
      hasMemberAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.STRUCT_MEMBER_BITMAP_FIELD,
    );
  });
});

// ========================================================================
// Integer Bit Access
// ========================================================================
describe("AssignmentClassifier - Integer Bit Access", () => {
  beforeEach(() => {
    CodeGenState.reset();
    setupSymbols();
  });

  it("classifies single bit access on integer", () => {
    CodeGenState.setVariableTypeInfo(
      "flags",
      createTypeInfo({ baseType: "u8" }),
    );

    const ctx = createMockContext({
      identifiers: ["flags"],
      subscriptCount: 1, // Mock subscript
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(AssignmentKind.INTEGER_BIT);
  });

  it("classifies bit range access on integer", () => {
    CodeGenState.setVariableTypeInfo(
      "flags",
      createTypeInfo({ baseType: "u32" }),
    );

    const ctx = createMockContext({
      identifiers: ["flags"],
      subscriptCount: 2,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
      lastSubscriptExprCount: 2, // bit range has 2 expressions [start, width]
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.INTEGER_BIT_RANGE,
    );
  });
});

// ========================================================================
// Array Assignments
// ========================================================================
describe("AssignmentClassifier - Array Access", () => {
  beforeEach(() => {
    CodeGenState.reset();
    setupSymbols();
  });

  it("classifies simple array element", () => {
    CodeGenState.setVariableTypeInfo(
      "arr",
      createTypeInfo({
        isArray: true,
        arrayDimensions: [10],
      }),
    );

    const ctx = createMockContext({
      identifiers: ["arr"],
      subscriptCount: 1,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.ARRAY_ELEMENT,
    );
  });

  it("classifies array slice", () => {
    CodeGenState.setVariableTypeInfo(
      "buffer",
      createTypeInfo({
        isArray: true,
        arrayDimensions: [100],
      }),
    );

    const ctx = createMockContext({
      identifiers: ["buffer"],
      subscriptCount: 2,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
      lastSubscriptExprCount: 2, // slice has 2 expressions [start, length]
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(AssignmentKind.ARRAY_SLICE);
  });
});

// ========================================================================
// String Assignments
// ========================================================================
describe("AssignmentClassifier - String Assignments", () => {
  beforeEach(() => {
    CodeGenState.reset();
    setupSymbols();
  });

  it("classifies simple string variable", () => {
    CodeGenState.setVariableTypeInfo(
      "name",
      createTypeInfo({
        baseType: "string<32>",
        isString: true,
        stringCapacity: 32,
      }),
    );

    const ctx = createMockContext({
      identifiers: ["name"],
      isSimpleIdentifier: true,
      firstIdTypeInfo: CodeGenState.getVariableTypeInfo("name")!,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.STRING_SIMPLE,
    );
  });

  it("classifies struct field string", () => {
    const knownStructs = new Set(["Person"]);
    const structFields = new Map([
      ["Person", new Map([["name", "string<64>"]])],
    ]);
    setupSymbols({ knownStructs, structFields });
    CodeGenState.setVariableTypeInfo(
      "person",
      createTypeInfo({ baseType: "Person" }),
    );

    const ctx = createMockContext({
      identifiers: ["person", "name"],
      hasMemberAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.STRING_STRUCT_FIELD,
    );
  });
});

// ========================================================================
// Special Compound Assignments
// ========================================================================
describe("AssignmentClassifier - Special Compound", () => {
  beforeEach(() => {
    CodeGenState.reset();
    setupSymbols();
  });

  it("classifies atomic RMW", () => {
    CodeGenState.setVariableTypeInfo(
      "counter",
      createTypeInfo({
        baseType: "u32",
        isAtomic: true,
      }),
    );

    const ctx = createMockContext({
      identifiers: ["counter"],
      isSimpleIdentifier: true,
      isCompound: true,
      cOp: "+=",
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(AssignmentKind.ATOMIC_RMW);
  });

  it("classifies overflow clamp", () => {
    CodeGenState.setVariableTypeInfo(
      "saturated",
      createTypeInfo({
        baseType: "u8",
        overflowBehavior: "clamp",
      }),
    );

    const ctx = createMockContext({
      identifiers: ["saturated"],
      isSimpleIdentifier: true,
      isCompound: true,
      cOp: "+=",
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.OVERFLOW_CLAMP,
    );
  });

  it("does not classify float as overflow clamp", () => {
    CodeGenState.setVariableTypeInfo(
      "value",
      createTypeInfo({
        baseType: "f32",
        overflowBehavior: "clamp",
      }),
    );

    const ctx = createMockContext({
      identifiers: ["value"],
      isSimpleIdentifier: true,
      isCompound: true,
      cOp: "+=",
    });

    // Floats use native arithmetic, so not OVERFLOW_CLAMP
    expect(AssignmentClassifier.classify(ctx)).toBe(AssignmentKind.SIMPLE);
  });
});

// ========================================================================
// Global/This Prefix Patterns
// ========================================================================
describe("AssignmentClassifier - Prefix Patterns", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  it("classifies global.member", () => {
    const knownScopes = new Set(["Counter"]);
    setupSymbols({ knownScopes });

    const ctx = createMockContext({
      identifiers: ["Counter", "value"],
      hasGlobal: true,
      postfixOpsCount: 1,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.GLOBAL_MEMBER,
    );
  });

  // Issue #1115: `global.arr[i]` classifies as the general ARRAY_ELEMENT, the
  // same as bare `arr[i]` and `this.arr[i]`. The retired GLOBAL_ARRAY kind
  // bypassed SubscriptClassifier and emitted the raw subscript chain.
  it("classifies global.arr[i] as ARRAY_ELEMENT", () => {
    setupSymbols();

    const ctx = createMockContext({
      identifiers: ["arr"],
      subscriptCount: 1,
      hasGlobal: true,
      hasArrayAccess: true,
      postfixOpsCount: 1,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.ARRAY_ELEMENT,
    );
  });

  it("classifies this.member", () => {
    setupSymbols();
    enterScope("Counter");

    const ctx = createMockContext({
      identifiers: ["count"],
      hasThis: true,
      postfixOpsCount: 1,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(AssignmentKind.THIS_MEMBER);
  });

  it("classifies this.arr[i]", () => {
    setupSymbols();
    enterScope("Buffer");

    const ctx = createMockContext({
      identifiers: ["data"],
      subscriptCount: 1,
      hasThis: true,
      hasArrayAccess: true,
      postfixOpsCount: 1,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.ARRAY_ELEMENT,
    );
  });

  // Issue #954 / #1115: scope variable bit access classifies as the general
  // INTEGER_BIT / INTEGER_BIT_RANGE kinds -- `resolvedBaseIdentifier` already
  // carries the scope prefix, so no `this.`-specific kind is needed.
  it("classifies this.flags[3] as INTEGER_BIT for integer type", () => {
    setupSymbols();
    enterScope("Sensor");
    // Register Sensor_flags as a non-array integer type
    CodeGenState.setVariableTypeInfo(
      "Sensor__flags",
      createTypeInfo({ baseType: "u8", isArray: false }),
    );

    const ctx = createMockContext({
      identifiers: ["flags"],
      subscriptCount: 1,
      hasThis: true,
      hasArrayAccess: true,
      postfixOpsCount: 1,
      isSimpleIdentifier: false,
      lastSubscriptExprCount: 1, // single bit
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(AssignmentKind.INTEGER_BIT);
  });

  it("classifies this.value[0, 8] as INTEGER_BIT_RANGE for integer type", () => {
    setupSymbols();
    enterScope("Sensor");
    // Register Sensor_value as a non-array integer type
    CodeGenState.setVariableTypeInfo(
      "Sensor__value",
      createTypeInfo({ baseType: "u16", isArray: false }),
    );

    const ctx = createMockContext({
      identifiers: ["value"],
      subscriptCount: 2,
      hasThis: true,
      hasArrayAccess: true,
      postfixOpsCount: 1,
      isSimpleIdentifier: false,
      lastSubscriptExprCount: 2, // bit range
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.INTEGER_BIT_RANGE,
    );
  });

  it("classifies this.data[i] as ARRAY_ELEMENT for array type", () => {
    setupSymbols();
    enterScope("Buffer");
    // Register Buffer_data as an array type
    CodeGenState.setVariableTypeInfo(
      "Buffer__data",
      createTypeInfo({ baseType: "u8", isArray: true, arrayDimensions: [10] }),
    );

    const ctx = createMockContext({
      identifiers: ["data"],
      subscriptCount: 1,
      hasThis: true,
      hasArrayAccess: true,
      postfixOpsCount: 1,
      isSimpleIdentifier: false,
      lastSubscriptExprCount: 1,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.ARRAY_ELEMENT,
    );
  });
});

// ========================================================================
// Register Bit Access
// ========================================================================
describe("AssignmentClassifier - Register Bit Access", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  it("classifies register single bit", () => {
    const knownRegisters = new Set(["GPIO7"]);
    setupSymbols({ knownRegisters });

    const ctx = createMockContext({
      identifiers: ["GPIO7", "DR_SET"],
      subscriptCount: 1,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.REGISTER_BIT,
    );
  });

  it("classifies register bit range", () => {
    const knownRegisters = new Set(["GPIO7"]);
    setupSymbols({ knownRegisters });

    const ctx = createMockContext({
      identifiers: ["GPIO7", "DR_SET"],
      subscriptCount: 2,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.REGISTER_BIT_RANGE,
    );
  });

  it("classifies scoped register bit", () => {
    const knownScopes = new Set(["Teensy4"]);
    const knownRegisters = new Set(["Teensy4__GPIO7"]);
    setupSymbols({ knownScopes, knownRegisters });
    enterScope("Teensy4");

    const ctx = createMockContext({
      identifiers: ["GPIO7", "DR_SET"],
      subscriptCount: 1,
      hasThis: true,
      hasArrayAccess: true,
      postfixOpsCount: 2,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.SCOPED_REGISTER_BIT,
    );
  });
});

// ========================================================================
// Scoped Register Bitmap Field (4-id pattern)
// ========================================================================
describe("AssignmentClassifier - Scoped Register Bitmap Field", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  it("classifies Scope.REG.MEMBER.field as SCOPED_REGISTER_MEMBER_BITMAP_FIELD", () => {
    const bitmapFields = new Map([
      ["ControlBits", new Map([["Enable", { offset: 0, width: 1 }]])],
    ]);
    const knownScopes = new Set(["Teensy4"]);
    const knownRegisters = new Set(["Teensy4__GPIO7"]);
    const registerMemberTypes = new Map([
      ["Teensy4__GPIO7__ICR1", "ControlBits"],
    ]);
    setupSymbols({
      bitmapFields,
      knownScopes,
      knownRegisters,
      registerMemberTypes,
    });

    const ctx = createMockContext({
      identifiers: ["Teensy4", "GPIO7", "ICR1", "Enable"],
      hasMemberAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.SCOPED_REGISTER_MEMBER_BITMAP_FIELD,
    );
  });

  it("returns null for unknown scope in 4-id pattern", () => {
    setupSymbols();

    const ctx = createMockContext({
      identifiers: ["UnknownScope", "REG", "MEMBER", "field"],
      hasMemberAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(AssignmentKind.SIMPLE);
  });
});

// ========================================================================
// Bitmap Array Element Field
// ========================================================================
describe("AssignmentClassifier - Bitmap Array Element Field", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  it("classifies bitmapArr[i].field as BITMAP_ARRAY_ELEMENT_FIELD", () => {
    const bitmapFields = new Map([
      ["StatusFlags", new Map([["Active", { offset: 0, width: 1 }]])],
    ]);
    setupSymbols({ bitmapFields });
    CodeGenState.setVariableTypeInfo(
      "flagsArr",
      createTypeInfo({
        isBitmap: true,
        isArray: true,
        bitmapTypeName: "StatusFlags",
        arrayDimensions: [10],
      }),
    );

    const ctx = createMockContext({
      identifiers: ["flagsArr", "Active"],
      subscriptCount: 1,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.BITMAP_ARRAY_ELEMENT_FIELD,
    );
  });
});

// ========================================================================
// Multi-dim Array with Bit Indexing
// ========================================================================
describe("AssignmentClassifier - Multi-dim Array Bit Indexing", () => {
  beforeEach(() => {
    CodeGenState.reset();
    setupSymbols();
  });

  it("classifies matrix[i][j][bit] as ARRAY_ELEMENT_BIT", () => {
    CodeGenState.setVariableTypeInfo(
      "matrix",
      createTypeInfo({
        baseType: "u32",
        isArray: true,
        arrayDimensions: [4, 4],
      }),
    );

    const ctx = createMockContext({
      identifiers: ["matrix"],
      subscriptCount: 3,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.ARRAY_ELEMENT_BIT,
    );
  });

  it("classifies matrix[i][j] as MULTI_DIM_ARRAY_ELEMENT", () => {
    CodeGenState.setVariableTypeInfo(
      "matrix",
      createTypeInfo({
        baseType: "u32",
        isArray: true,
        arrayDimensions: [4, 4],
      }),
    );

    const ctx = createMockContext({
      identifiers: ["matrix"],
      subscriptCount: 2,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.MULTI_DIM_ARRAY_ELEMENT,
    );
  });
});

// ========================================================================
// Scoped Register Bit Range via This Prefix
// ========================================================================
describe("AssignmentClassifier - Scoped Register Bit Range", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  it("classifies this.reg[start, width] as SCOPED_REGISTER_BIT_RANGE", () => {
    const knownRegisters = new Set(["Teensy4__GPIO7"]);
    setupSymbols({ knownRegisters });
    enterScope("Teensy4");

    const ctx = createMockContext({
      identifiers: ["GPIO7", "ICR1"],
      subscriptCount: 2,
      hasThis: true,
      hasArrayAccess: true,
      postfixOpsCount: 3,
      postfixOps: [
        // #1445: the plan says "this is a bit range" directly. The node mock
        // said it as `COMMA: () => ({})`, which is the same claim spelled as a
        // token that happens to be present.
        {
          kind: "subscript",
          indexCount: 2,
          renderIndexes: () => ["0", "1"],
        } as IAssignmentContext["postfixOps"][0],
      ],
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.SCOPED_REGISTER_BIT_RANGE,
    );
  });
});

// ========================================================================
// Register Bit Access via classifyMemberWithSubscript (non-scoped, 2+ ids)
// ========================================================================
describe("AssignmentClassifier - Register Bit via MemberWithSubscript", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  it("classifies REG.MEMBER[bit] as REGISTER_BIT (non-this, non-global)", () => {
    const knownRegisters = new Set(["TIMER"]);
    setupSymbols({ knownRegisters });

    const ctx = createMockContext({
      identifiers: ["TIMER", "CTRL"],
      subscriptCount: 1,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.REGISTER_BIT,
    );
  });

  it("classifies REG.MEMBER[start, width] as REGISTER_BIT_RANGE (non-this)", () => {
    const knownRegisters = new Set(["TIMER"]);
    setupSymbols({ knownRegisters });

    const ctx = createMockContext({
      identifiers: ["TIMER", "CTRL"],
      subscriptCount: 2,
      // A bit range is ONE op carrying TWO expressions, so both counts are 2.
      // This was left at the default 1 — a state no real bit range produces —
      // which is why the test passed while `PORT.Set[8, 8]` emitted
      // `PORT__Set.Set` in the actual transpiler (#1244).
      lastSubscriptExprCount: 2,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.REGISTER_BIT_RANGE,
    );
  });

  it("classifies Scope.REG.MEMBER[bit] as REGISTER_BIT via memberWithSubscript", () => {
    const knownScopes = new Set(["Teensy4"]);
    const knownRegisters = new Set(["Teensy4__GPIO7"]);
    setupSymbols({ knownScopes, knownRegisters });

    const ctx = createMockContext({
      identifiers: ["Teensy4", "GPIO7", "DR_SET"],
      subscriptCount: 1,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.REGISTER_BIT,
    );
  });
});

// ========================================================================
// Bare `Scope.` subscript targets (#1244, #1116)
//
// The `global.` prefix is a grammar token, not an identifier, so
// `global.Scope.member[i]` and the bare `Scope.member[i]` reach the classifier
// with identical `identifiers` and must classify identically. Before #1244 the
// bare spelling had no scope-resolution step: the struct-chain branch claimed
// every bit range before the register or the variable was recognized.
// ========================================================================
describe("AssignmentClassifier - Bare Scope-Qualified Subscripts", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  const scopedRegisterCases: ReadonlyArray<
    readonly [string, number, number, AssignmentKind]
  > = [
    ["single bit", 1, 1, AssignmentKind.REGISTER_BIT],
    ["bit range", 2, 2, AssignmentKind.REGISTER_BIT_RANGE],
  ];

  it.each(scopedRegisterCases)(
    "classifies Scope.REG.MEMBER[%s] without a global. prefix",
    (_label, subscriptCount, lastSubscriptExprCount, expected) => {
      setupSymbols({
        knownScopes: new Set(["Hw"]),
        knownRegisters: new Set(["Hw__GPIO"]),
      });

      const ctx = createMockContext({
        identifiers: ["Hw", "GPIO", "Mode"],
        subscriptCount,
        lastSubscriptExprCount,
        hasMemberAccess: true,
        hasArrayAccess: true,
        isSimpleIdentifier: false,
      });

      expect(AssignmentClassifier.classify(ctx)).toBe(expected);
    },
  );

  const scopeVariableCases: ReadonlyArray<
    readonly [string, TTypeInfo, number, number, AssignmentKind]
  > = [
    [
      "bit range on a scalar",
      createTypeInfo({ baseType: "u8", bitWidth: 8 }),
      1,
      2,
      AssignmentKind.INTEGER_BIT_RANGE,
    ],
    [
      "bit on an array element",
      createTypeInfo({
        baseType: "u8",
        bitWidth: 8,
        isArray: true,
        arrayDimensions: [16],
      }),
      2,
      1,
      AssignmentKind.ARRAY_ELEMENT_BIT,
    ],
    [
      "slice on an array",
      createTypeInfo({
        baseType: "u8",
        bitWidth: 8,
        isArray: true,
        arrayDimensions: [16],
      }),
      1,
      2,
      AssignmentKind.ARRAY_SLICE,
    ],
  ];

  it.each(scopeVariableCases)(
    "routes Scope.member[...] to the shared subscript decision: %s",
    (_label, typeInfo, subscriptCount, lastSubscriptExprCount, expected) => {
      setupSymbols({ knownScopes: new Set(["Other"]) });
      CodeGenState.setVariableTypeInfo("Other__member", typeInfo);

      const ctx = createMockContext({
        identifiers: ["Other", "member"],
        subscriptCount,
        lastSubscriptExprCount,
        hasMemberAccess: true,
        hasArrayAccess: true,
        isSimpleIdentifier: false,
      });

      expect(AssignmentClassifier.classify(ctx)).toBe(expected);
    },
  );

  it("leaves a non-register Scope.a.b chain to the struct-chain branch", () => {
    setupSymbols({ knownScopes: new Set(["Other"]) });

    const ctx = createMockContext({
      identifiers: ["Other", "config", "field"],
      subscriptCount: 1,
      lastSubscriptExprCount: 2,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.STRUCT_CHAIN_BIT_RANGE,
    );
  });

  // ADR-057 resolves a bare name local -> scope -> global. A variable of that
  // name at ANY tier wins, so the target stays a struct chain rather than being
  // read as the same-named scope. The tiers are keyed differently — a global
  // under its bare name, a scope member as `Scope__name` — so covering only one
  // of them leaves the other free to regress, which is exactly what happened.
  const adr057ShadowCases: ReadonlyArray<
    readonly [string, string | null, string]
  > = [
    ["a global", null, "Other"],
    ["a scope member", "Reg", "Reg__Other"],
  ];

  it.each(adr057ShadowCases)(
    "keeps %s named like a scope as a struct chain (ADR-057)",
    (_label, currentScopePath, typeInfoKey) => {
      setupSymbols({ knownScopes: new Set(["Other"]) });
      enterScope(currentScopePath);
      CodeGenState.setVariableTypeInfo(
        typeInfoKey,
        createTypeInfo({ baseType: "Point", bitWidth: 0 }),
      );

      const ctx = createMockContext({
        identifiers: ["Other", "member"],
        subscriptCount: 1,
        lastSubscriptExprCount: 2,
        hasMemberAccess: true,
        hasArrayAccess: true,
        isSimpleIdentifier: false,
      });

      expect(AssignmentClassifier.classify(ctx)).toBe(
        AssignmentKind.STRUCT_CHAIN_BIT_RANGE,
      );
    },
  );
});

// ========================================================================
// This Prefix - Scoped Register Bitmap Field
// ========================================================================
describe("AssignmentClassifier - This Prefix Register Bitmap", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  it("classifies this.REG.MEMBER.field as SCOPED_REGISTER_MEMBER_BITMAP_FIELD", () => {
    const knownRegisters = new Set(["Motor__GPIO7"]);
    const registerMemberTypes = new Map([["Motor__GPIO7__ICR1", "CtrlBits"]]);
    const bitmapFields = new Map([
      ["CtrlBits", new Map([["Enable", { offset: 0, width: 1 }]])],
    ]);
    setupSymbols({ knownRegisters, registerMemberTypes, bitmapFields });
    enterScope("Motor");

    const ctx = createMockContext({
      identifiers: ["GPIO7", "ICR1", "Enable"],
      hasThis: true,
      postfixOpsCount: 3,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.SCOPED_REGISTER_MEMBER_BITMAP_FIELD,
    );
  });
});

// ========================================================================
// Member Chain
// ========================================================================
describe("AssignmentClassifier - Member Chain", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  it("classifies complex member chain as MEMBER_CHAIN", () => {
    const knownStructs = new Set(["Config"]);
    const structFields = new Map([["Config", new Map([["items", "Item"]])]]);
    setupSymbols({ knownStructs, structFields });
    CodeGenState.setVariableTypeInfo(
      "config",
      createTypeInfo({ baseType: "Config" }),
    );

    const ctx = createMockContext({
      identifiers: ["config", "items"],
      subscriptCount: 1,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.MEMBER_CHAIN,
    );
  });
});

// ========================================================================
// Kinds the classifier could produce with no test naming them (#1450)
//
// `codegen-decomposition.md` commits twice to "classification tests cover all
// 25 kinds explicitly" -- once as a Testing Strategy target, once as a
// Mitigation for the risk it names, "priority order bugs if new kinds added
// incorrectly". The corpus had grown to 31 kinds while 25 were named here, so
// the count still read as met. A guard that passes by coincidence is the one
// nothing ever prompts anyone to look at.
//
// STRING_THIS_MEMBER is the sharpest of the five: the same kind whose registry
// key, unguarded, emitted a 55-byte out-of-bounds `strncpy` bound
// (`tests/string-assignment/string-assign-scope-this-shared-name.test.cnx`).
// The classifier half of that hole had no test either.
// ========================================================================
describe("AssignmentClassifier - previously unnamed kinds", () => {
  beforeEach(() => {
    CodeGenState.reset();
    setupSymbols();
  });

  it("classifies this.member string as STRING_THIS_MEMBER", () => {
    CodeGenState.currentScopePath = "Logger";
    CodeGenState.setVariableTypeInfo(
      "Logger__message",
      createTypeInfo({
        baseType: "string<64>",
        isString: true,
        stringCapacity: 64,
      }),
    );

    const ctx = createMockContext({
      identifiers: ["message"],
      generatedValue: '"hi"',
      isSimpleIdentifier: false,
      isSimpleThisAccess: true,
      hasThis: true,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.STRING_THIS_MEMBER,
    );
  });

  it("classifies global.<name> string as STRING_GLOBAL", () => {
    CodeGenState.setVariableTypeInfo(
      "banner",
      createTypeInfo({
        baseType: "string<32>",
        isString: true,
        stringCapacity: 32,
      }),
    );

    const ctx = createMockContext({
      identifiers: ["banner"],
      generatedValue: '"hi"',
      isSimpleIdentifier: false,
      isSimpleGlobalAccess: true,
      hasGlobal: true,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.STRING_GLOBAL,
    );
  });

  it("classifies an element of a string ARRAY as STRING_ARRAY_ELEMENT", () => {
    // Two dimensions: [count, capacity+1]. `arrayDimensions.length > 1` is what
    // separates a string array from a plain `string<N>`, which carries one.
    CodeGenState.setVariableTypeInfo(
      "names",
      createTypeInfo({
        baseType: "char",
        isString: true,
        isArray: true,
        stringCapacity: 8,
        arrayDimensions: [4, 9],
      }),
    );

    const ctx = createMockContext({
      identifiers: ["names"],
      generatedValue: '"hi"',
      subscriptCount: 1,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.STRING_ARRAY_ELEMENT,
    );
  });

  it("classifies struct.field[i] string as STRING_STRUCT_ARRAY_ELEMENT", () => {
    setupSymbols({
      knownStructs: new Set(["Config"]),
      structFields: new Map([["Config", new Map([["items", "string<8>"]])]]),
      structFieldArrays: new Map([["Config", new Set(["items"])]]),
      structFieldDimensions: new Map([
        ["Config", new Map([["items", [4, 9]]])],
      ]),
    });
    CodeGenState.setVariableTypeInfo(
      "config",
      createTypeInfo({ baseType: "Config" }),
    );

    const ctx = createMockContext({
      identifiers: ["config", "items"],
      generatedValue: '"hi"',
      subscriptCount: 1,
      hasMemberAccess: true,
      hasArrayAccess: true,
      memberAccessDepth: 1,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.STRING_STRUCT_ARRAY_ELEMENT,
    );
  });

  it("classifies global.<struct>.<field>[i] as GLOBAL_ARRAY", () => {
    // #1115: with ONE identifier `global.x[i]` means what `x[i]` means and is
    // delegated. The chain form is what still reaches GLOBAL_ARRAY, because the
    // subscript applies to the field rather than to `config`.
    setupSymbols({ knownStructs: new Set(["Config"]) });
    CodeGenState.setVariableTypeInfo(
      "config",
      createTypeInfo({ baseType: "Config" }),
    );

    const ctx = createMockContext({
      identifiers: ["config", "items"],
      subscriptCount: 1,
      hasGlobal: true,
      hasMemberAccess: true,
      hasArrayAccess: true,
      memberAccessDepth: 1,
      // The `global.` dispatch is gated on postfixOpsCount > 0 -- `.items` and
      // `[0]` are the two ops. With the mock's default of 0 this context falls
      // through to MEMBER_CHAIN, which is exactly what it did on the first run.
      postfixOpsCount: 2,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.GLOBAL_ARRAY,
    );
  });
});

// ========================================================================
// The obligation, gated rather than remembered (#1450)
//
// `codegen-decomposition.md` requires that classification tests name every
// kind. That was hand-maintained, and it drifted: 25 of 31 kinds were named,
// while the obligation's own wording said "all 25 kinds" -- so the count read
// as met and nothing prompted anyone to look.
//
// Closing that by hand restores the property once. This asserts it, so the
// next kind added cannot land without a test. CLAUDE.md's argument for
// `scripts/__tests__/layer-rules.test.ts` is the same one: derive the claim
// instead of writing it down.
// ========================================================================
describe("AssignmentKind coverage is derived, not asserted", () => {
  /** Every declared kind name, without the reverse numeric mappings. */
  function declaredKinds(): string[] {
    return Object.keys(AssignmentKind).filter((k) => Number.isNaN(Number(k)));
  }

  // What this catches and what it does not: it matches a MENTION of
  // `AssignmentKind.X` anywhere in this file, a comment included. So it stops a
  // kind being added with no test -- the accidental drift that actually
  // happened -- and it would not stop someone writing a bare mention to quiet
  // it. That is a deliberate act, not a thing anyone does by not noticing, and
  // a stricter match (insisting on an `expect(...).toBe(...)` shape) would be
  // brittle against the kinds asserted through a variable.
  it("names every AssignmentKind somewhere in this file", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
    const named = new Set(
      [...source.matchAll(/AssignmentKind\.([A-Z_0-9]+)/g)].map((m) => m[1]),
    );

    const missing = declaredKinds().filter((kind) => !named.has(kind));
    expect(missing).toEqual([]);
  });

  it("gives every AssignmentKind a registered handler", () => {
    // `getHandler` throws lazily, only for a kind something actually
    // dispatches. A kind registered by nobody is invisible until a user
    // program reaches it, so ask for all of them here.
    const unregistered = declaredKinds().filter((kind) => {
      try {
        AssignmentHandlerRegistry.getHandler(
          AssignmentKind[kind as keyof typeof AssignmentKind],
        );
        return false;
      } catch {
        return true;
      }
    });

    expect(unregistered).toEqual([]);
  });
});
