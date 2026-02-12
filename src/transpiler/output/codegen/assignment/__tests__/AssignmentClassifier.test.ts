import { describe, it, expect, beforeEach } from "vitest";
import AssignmentClassifier from "../AssignmentClassifier";
import AssignmentKind from "../AssignmentKind";
import IAssignmentContext from "../IAssignmentContext";
import CodeGenState from "../../../../state/CodeGenState";
import TTypeInfo from "../../types/TTypeInfo";

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
    statementCtx: {} as IAssignmentContext["statementCtx"],
    targetCtx: {} as IAssignmentContext["targetCtx"],
    valueCtx: null,
    identifiers: ["x"],
    subscripts: [],
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
 */
function setupSymbols(
  overrides: {
    knownRegisters?: Set<string>;
    knownScopes?: Set<string>;
    knownStructs?: Set<string>;
    bitmapFields?: Map<string, Map<string, { offset: number; width: number }>>;
    registerMemberTypes?: Map<string, string>;
    structFields?: Map<string, Map<string, string>>;
    structFieldArrays?: Map<string, Set<string>>;
    structFieldDimensions?: Map<string, Map<string, readonly number[]>>;
  } = {},
): void {
  CodeGenState.symbols = {
    knownScopes: overrides.knownScopes ?? new Set(),
    knownStructs: overrides.knownStructs ?? new Set(),
    knownRegisters: overrides.knownRegisters ?? new Set(),
    knownEnums: new Set<string>(),
    knownBitmaps: new Set<string>(),
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
    scopeVariableUsage: new Map(),
    scopePrivateConstValues: new Map(),
    functionReturnTypes: new Map(),
    getSingleFunctionForVariable: () => null,
    hasPublicSymbols: () => false,
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
    CodeGenState.typeRegistry.set(
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
    CodeGenState.typeRegistry.set(
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
    const registerMemberTypes = new Map([["MOTOR_CTRL", "ControlBits"]]);
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
    CodeGenState.typeRegistry.set(
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
    CodeGenState.typeRegistry.set("flags", createTypeInfo({ baseType: "u8" }));

    const ctx = createMockContext({
      identifiers: ["flags"],
      subscripts: [{} as IAssignmentContext["subscripts"][0]], // Mock subscript
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(AssignmentKind.INTEGER_BIT);
  });

  it("classifies bit range access on integer", () => {
    CodeGenState.typeRegistry.set("flags", createTypeInfo({ baseType: "u32" }));

    const ctx = createMockContext({
      identifiers: ["flags"],
      subscripts: [
        {} as IAssignmentContext["subscripts"][0],
        {} as IAssignmentContext["subscripts"][0],
      ],
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
    CodeGenState.typeRegistry.set(
      "arr",
      createTypeInfo({
        isArray: true,
        arrayDimensions: [10],
      }),
    );

    const ctx = createMockContext({
      identifiers: ["arr"],
      subscripts: [{} as IAssignmentContext["subscripts"][0]],
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.ARRAY_ELEMENT,
    );
  });

  it("classifies array slice", () => {
    CodeGenState.typeRegistry.set(
      "buffer",
      createTypeInfo({
        isArray: true,
        arrayDimensions: [100],
      }),
    );

    const ctx = createMockContext({
      identifiers: ["buffer"],
      subscripts: [
        {} as IAssignmentContext["subscripts"][0],
        {} as IAssignmentContext["subscripts"][0],
      ],
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
    CodeGenState.typeRegistry.set(
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
      firstIdTypeInfo: CodeGenState.typeRegistry.get("name")!,
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
    CodeGenState.typeRegistry.set(
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
    CodeGenState.typeRegistry.set(
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
    CodeGenState.typeRegistry.set(
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
    CodeGenState.typeRegistry.set(
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

  it("classifies global.arr[i]", () => {
    setupSymbols();

    const ctx = createMockContext({
      identifiers: ["arr"],
      subscripts: [{} as IAssignmentContext["subscripts"][0]],
      hasGlobal: true,
      hasArrayAccess: true,
      postfixOpsCount: 1,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.GLOBAL_ARRAY,
    );
  });

  it("classifies this.member", () => {
    setupSymbols();
    CodeGenState.currentScope = "Counter";

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
    CodeGenState.currentScope = "Buffer";

    const ctx = createMockContext({
      identifiers: ["data"],
      subscripts: [{} as IAssignmentContext["subscripts"][0]],
      hasThis: true,
      hasArrayAccess: true,
      postfixOpsCount: 1,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(AssignmentKind.THIS_ARRAY);
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
      subscripts: [{} as IAssignmentContext["subscripts"][0]],
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
      subscripts: [
        {} as IAssignmentContext["subscripts"][0],
        {} as IAssignmentContext["subscripts"][0],
      ],
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
    const knownRegisters = new Set(["Teensy4_GPIO7"]);
    setupSymbols({ knownScopes, knownRegisters });
    CodeGenState.currentScope = "Teensy4";

    const ctx = createMockContext({
      identifiers: ["GPIO7", "DR_SET"],
      subscripts: [{} as IAssignmentContext["subscripts"][0]],
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
    const knownRegisters = new Set(["Teensy4_GPIO7"]);
    const registerMemberTypes = new Map([
      ["Teensy4_GPIO7_ICR1", "ControlBits"],
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
    CodeGenState.typeRegistry.set(
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
      subscripts: [{} as IAssignmentContext["subscripts"][0]],
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
    CodeGenState.typeRegistry.set(
      "matrix",
      createTypeInfo({
        baseType: "u32",
        isArray: true,
        arrayDimensions: [4, 4],
      }),
    );

    const ctx = createMockContext({
      identifiers: ["matrix"],
      subscripts: [
        {} as IAssignmentContext["subscripts"][0],
        {} as IAssignmentContext["subscripts"][0],
        {} as IAssignmentContext["subscripts"][0],
      ],
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.ARRAY_ELEMENT_BIT,
    );
  });

  it("classifies matrix[i][j] as MULTI_DIM_ARRAY_ELEMENT", () => {
    CodeGenState.typeRegistry.set(
      "matrix",
      createTypeInfo({
        baseType: "u32",
        isArray: true,
        arrayDimensions: [4, 4],
      }),
    );

    const ctx = createMockContext({
      identifiers: ["matrix"],
      subscripts: [
        {} as IAssignmentContext["subscripts"][0],
        {} as IAssignmentContext["subscripts"][0],
      ],
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
    const knownRegisters = new Set(["Teensy4_GPIO7"]);
    setupSymbols({ knownRegisters });
    CodeGenState.currentScope = "Teensy4";

    const ctx = createMockContext({
      identifiers: ["GPIO7", "ICR1"],
      subscripts: [
        {} as IAssignmentContext["subscripts"][0],
        {} as IAssignmentContext["subscripts"][0],
      ],
      hasThis: true,
      hasArrayAccess: true,
      postfixOpsCount: 3,
      postfixOps: [
        { COMMA: () => ({}) } as unknown as IAssignmentContext["postfixOps"][0],
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
      subscripts: [{} as IAssignmentContext["subscripts"][0]],
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
      subscripts: [
        {} as IAssignmentContext["subscripts"][0],
        {} as IAssignmentContext["subscripts"][0],
      ],
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
    const knownRegisters = new Set(["Teensy4_GPIO7"]);
    setupSymbols({ knownScopes, knownRegisters });

    const ctx = createMockContext({
      identifiers: ["Teensy4", "GPIO7", "DR_SET"],
      subscripts: [{} as IAssignmentContext["subscripts"][0]],
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
// This Prefix - Scoped Register Bitmap Field
// ========================================================================
describe("AssignmentClassifier - This Prefix Register Bitmap", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  it("classifies this.REG.MEMBER.field as SCOPED_REGISTER_MEMBER_BITMAP_FIELD", () => {
    const knownRegisters = new Set(["Motor_GPIO7"]);
    const registerMemberTypes = new Map([["Motor_GPIO7_ICR1", "CtrlBits"]]);
    const bitmapFields = new Map([
      ["CtrlBits", new Map([["Enable", { offset: 0, width: 1 }]])],
    ]);
    setupSymbols({ knownRegisters, registerMemberTypes, bitmapFields });
    CodeGenState.currentScope = "Motor";

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
    CodeGenState.typeRegistry.set(
      "config",
      createTypeInfo({ baseType: "Config" }),
    );

    const ctx = createMockContext({
      identifiers: ["config", "items"],
      subscripts: [{} as IAssignmentContext["subscripts"][0]],
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(AssignmentClassifier.classify(ctx)).toBe(
      AssignmentKind.MEMBER_CHAIN,
    );
  });
});
