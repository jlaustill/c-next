import { describe, it, expect } from "vitest";
import AssignmentClassifier from "../AssignmentClassifier";
import AssignmentKind from "../AssignmentKind";
import IAssignmentContext from "../IAssignmentContext";
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
    firstIdTypeInfo: null,
    memberAccessDepth: 0,
    subscriptDepth: 0,
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
 * Create mock classifier dependencies.
 */
function createMockDeps(
  overrides: Partial<{
    typeRegistry: Map<string, TTypeInfo>;
    knownRegisters: Set<string>;
    knownScopes: Set<string>;
    knownStructs: Set<string>;
    bitmapFields: Map<string, Map<string, { offset: number; width: number }>>;
    registerMemberTypes: Map<string, string>;
    structFields: Map<string, Map<string, string>>;
    structFieldArrays: Map<string, Set<string>>;
    structFieldDimensions: Map<string, Map<string, readonly number[]>>;
    currentScope: string | null;
  }> = {},
) {
  const typeRegistry = overrides.typeRegistry ?? new Map();
  const knownRegisters = overrides.knownRegisters ?? new Set();
  const knownScopes = overrides.knownScopes ?? new Set();
  const knownStructs = overrides.knownStructs ?? new Set();
  const bitmapFields = overrides.bitmapFields ?? new Map();
  const registerMemberTypes = overrides.registerMemberTypes ?? new Map();
  const structFields = overrides.structFields ?? new Map();
  const structFieldArrays = overrides.structFieldArrays ?? new Map();
  const structFieldDimensions = overrides.structFieldDimensions ?? new Map();

  return {
    symbols: {
      knownScopes,
      knownStructs,
      knownRegisters,
      knownEnums: new Set<string>(),
      knownBitmaps: new Set<string>(),
      scopeMembers: new Map<string, Set<string>>(),
      scopeMemberVisibility: new Map(),
      structFields,
      structFieldArrays,
      structFieldDimensions,
      enumMembers: new Map(),
      bitmapFields,
      bitmapBackingType: new Map(),
      bitmapBitWidth: new Map(),
      scopedRegisters: new Map(),
      registerMemberAccess: new Map(),
      registerMemberTypes,
      registerBaseAddresses: new Map(),
      registerMemberOffsets: new Map(),
      registerMemberCTypes: new Map(),
      scopeVariableUsage: new Map(),
      scopePrivateConstValues: new Map(),
      getSingleFunctionForVariable: () => null,
      hasPublicSymbols: () => false,
    },
    typeRegistry,
    currentScope: overrides.currentScope ?? null,
    isKnownStruct: (name: string) => knownStructs.has(name),
    isKnownScope: (name: string) => knownScopes.has(name),
    getMemberTypeInfo: (structType: string, memberName: string) => {
      const fields = structFields.get(structType);
      const fieldType = fields?.get(memberName);
      if (fieldType) {
        return createTypeInfo({ baseType: fieldType });
      }
      return null;
    },
  };
}

// ========================================================================
// SIMPLE Assignment
// ========================================================================
describe("AssignmentClassifier - SIMPLE", () => {
  it("classifies simple identifier assignment", () => {
    const deps = createMockDeps();
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["x"],
      isSimpleIdentifier: true,
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.SIMPLE);
  });

  it("classifies unknown pattern as SIMPLE fallback", () => {
    const deps = createMockDeps();
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["unknown"],
      hasMemberAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.SIMPLE);
  });
});

// ========================================================================
// Bitmap Field Assignments
// ========================================================================
describe("AssignmentClassifier - Bitmap Fields", () => {
  it("classifies single-bit bitmap field", () => {
    const bitmapFields = new Map([
      ["StatusFlags", new Map([["Running", { offset: 0, width: 1 }]])],
    ]);
    const typeRegistry = new Map([
      [
        "flags",
        createTypeInfo({ isBitmap: true, bitmapTypeName: "StatusFlags" }),
      ],
    ]);

    const deps = createMockDeps({ bitmapFields, typeRegistry });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["flags", "Running"],
      hasMemberAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(
      AssignmentKind.BITMAP_FIELD_SINGLE_BIT,
    );
  });

  it("classifies multi-bit bitmap field", () => {
    const bitmapFields = new Map([
      ["StatusFlags", new Map([["Mode", { offset: 4, width: 4 }]])],
    ]);
    const typeRegistry = new Map([
      [
        "flags",
        createTypeInfo({ isBitmap: true, bitmapTypeName: "StatusFlags" }),
      ],
    ]);

    const deps = createMockDeps({ bitmapFields, typeRegistry });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["flags", "Mode"],
      hasMemberAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(
      AssignmentKind.BITMAP_FIELD_MULTI_BIT,
    );
  });

  it("classifies register member bitmap field", () => {
    const bitmapFields = new Map([
      ["ControlBits", new Map([["Enable", { offset: 0, width: 1 }]])],
    ]);
    const knownRegisters = new Set(["MOTOR"]);
    const registerMemberTypes = new Map([["MOTOR_CTRL", "ControlBits"]]);

    const deps = createMockDeps({
      bitmapFields,
      knownRegisters,
      registerMemberTypes,
    });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["MOTOR", "CTRL", "Enable"],
      hasMemberAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(
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
    const typeRegistry = new Map([
      ["device", createTypeInfo({ baseType: "Device" })],
    ]);

    const deps = createMockDeps({
      bitmapFields,
      knownStructs,
      structFields,
      typeRegistry,
    });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["device", "flags", "Active"],
      hasMemberAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(
      AssignmentKind.STRUCT_MEMBER_BITMAP_FIELD,
    );
  });
});

// ========================================================================
// Integer Bit Access
// ========================================================================
describe("AssignmentClassifier - Integer Bit Access", () => {
  it("classifies single bit access on integer", () => {
    const typeRegistry = new Map([
      ["flags", createTypeInfo({ baseType: "u8" })],
    ]);

    const deps = createMockDeps({ typeRegistry });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["flags"],
      subscripts: [{} as IAssignmentContext["subscripts"][0]], // Mock subscript
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.INTEGER_BIT);
  });

  it("classifies bit range access on integer", () => {
    const typeRegistry = new Map([
      ["flags", createTypeInfo({ baseType: "u32" })],
    ]);

    const deps = createMockDeps({ typeRegistry });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["flags"],
      subscripts: [
        {} as IAssignmentContext["subscripts"][0],
        {} as IAssignmentContext["subscripts"][0],
      ],
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.INTEGER_BIT_RANGE);
  });
});

// ========================================================================
// Array Assignments
// ========================================================================
describe("AssignmentClassifier - Array Access", () => {
  it("classifies simple array element", () => {
    const typeRegistry = new Map([
      [
        "arr",
        createTypeInfo({
          isArray: true,
          arrayDimensions: [10],
        }),
      ],
    ]);

    const deps = createMockDeps({ typeRegistry });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["arr"],
      subscripts: [{} as IAssignmentContext["subscripts"][0]],
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.ARRAY_ELEMENT);
  });

  it("classifies array slice", () => {
    const typeRegistry = new Map([
      [
        "buffer",
        createTypeInfo({
          isArray: true,
          arrayDimensions: [100],
        }),
      ],
    ]);

    const deps = createMockDeps({ typeRegistry });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["buffer"],
      subscripts: [
        {} as IAssignmentContext["subscripts"][0],
        {} as IAssignmentContext["subscripts"][0],
      ],
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.ARRAY_SLICE);
  });
});

// ========================================================================
// String Assignments
// ========================================================================
describe("AssignmentClassifier - String Assignments", () => {
  it("classifies simple string variable", () => {
    const typeRegistry = new Map([
      [
        "name",
        createTypeInfo({
          baseType: "string<32>",
          isString: true,
          stringCapacity: 32,
        }),
      ],
    ]);

    const deps = createMockDeps({ typeRegistry });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["name"],
      isSimpleIdentifier: true,
      firstIdTypeInfo: typeRegistry.get("name")!,
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.STRING_SIMPLE);
  });

  it("classifies struct field string", () => {
    const knownStructs = new Set(["Person"]);
    const structFields = new Map([
      ["Person", new Map([["name", "string<64>"]])],
    ]);
    const typeRegistry = new Map([
      ["person", createTypeInfo({ baseType: "Person" })],
    ]);

    const deps = createMockDeps({ knownStructs, structFields, typeRegistry });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["person", "name"],
      hasMemberAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.STRING_STRUCT_FIELD);
  });
});

// ========================================================================
// Special Compound Assignments
// ========================================================================
describe("AssignmentClassifier - Special Compound", () => {
  it("classifies atomic RMW", () => {
    const typeRegistry = new Map([
      [
        "counter",
        createTypeInfo({
          baseType: "u32",
          isAtomic: true,
        }),
      ],
    ]);

    const deps = createMockDeps({ typeRegistry });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["counter"],
      isSimpleIdentifier: true,
      isCompound: true,
      cOp: "+=",
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.ATOMIC_RMW);
  });

  it("classifies overflow clamp", () => {
    const typeRegistry = new Map([
      [
        "saturated",
        createTypeInfo({
          baseType: "u8",
          overflowBehavior: "clamp",
        }),
      ],
    ]);

    const deps = createMockDeps({ typeRegistry });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["saturated"],
      isSimpleIdentifier: true,
      isCompound: true,
      cOp: "+=",
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.OVERFLOW_CLAMP);
  });

  it("does not classify float as overflow clamp", () => {
    const typeRegistry = new Map([
      [
        "value",
        createTypeInfo({
          baseType: "f32",
          overflowBehavior: "clamp",
        }),
      ],
    ]);

    const deps = createMockDeps({ typeRegistry });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["value"],
      isSimpleIdentifier: true,
      isCompound: true,
      cOp: "+=",
    });

    // Floats use native arithmetic, so not OVERFLOW_CLAMP
    expect(classifier.classify(ctx)).toBe(AssignmentKind.SIMPLE);
  });
});

// ========================================================================
// Global/This Prefix Patterns
// ========================================================================
describe("AssignmentClassifier - Prefix Patterns", () => {
  it("classifies global.member", () => {
    const knownScopes = new Set(["Counter"]);
    const deps = createMockDeps({ knownScopes });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["Counter", "value"],
      hasGlobal: true,
      postfixOpsCount: 1,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.GLOBAL_MEMBER);
  });

  it("classifies global.arr[i]", () => {
    const deps = createMockDeps();
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["arr"],
      subscripts: [{} as IAssignmentContext["subscripts"][0]],
      hasGlobal: true,
      hasArrayAccess: true,
      postfixOpsCount: 1,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.GLOBAL_ARRAY);
  });

  it("classifies this.member", () => {
    const deps = createMockDeps({ currentScope: "Counter" });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["count"],
      hasThis: true,
      postfixOpsCount: 1,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.THIS_MEMBER);
  });

  it("classifies this.arr[i]", () => {
    const deps = createMockDeps({ currentScope: "Buffer" });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["data"],
      subscripts: [{} as IAssignmentContext["subscripts"][0]],
      hasThis: true,
      hasArrayAccess: true,
      postfixOpsCount: 1,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.THIS_ARRAY);
  });
});

// ========================================================================
// Register Bit Access
// ========================================================================
describe("AssignmentClassifier - Register Bit Access", () => {
  it("classifies register single bit", () => {
    const knownRegisters = new Set(["GPIO7"]);
    const deps = createMockDeps({ knownRegisters });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["GPIO7", "DR_SET"],
      subscripts: [{} as IAssignmentContext["subscripts"][0]],
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.REGISTER_BIT);
  });

  it("classifies register bit range", () => {
    const knownRegisters = new Set(["GPIO7"]);
    const deps = createMockDeps({ knownRegisters });
    const classifier = new AssignmentClassifier(deps);

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

    expect(classifier.classify(ctx)).toBe(AssignmentKind.REGISTER_BIT_RANGE);
  });

  it("classifies scoped register bit", () => {
    const knownScopes = new Set(["Teensy4"]);
    const knownRegisters = new Set(["Teensy4_GPIO7"]);
    const deps = createMockDeps({
      knownScopes,
      knownRegisters,
      currentScope: "Teensy4",
    });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["GPIO7", "DR_SET"],
      subscripts: [{} as IAssignmentContext["subscripts"][0]],
      hasThis: true,
      hasArrayAccess: true,
      postfixOpsCount: 2,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.SCOPED_REGISTER_BIT);
  });
});

// ========================================================================
// Member Chain
// ========================================================================
describe("AssignmentClassifier - Member Chain", () => {
  it("classifies complex member chain as MEMBER_CHAIN", () => {
    const knownStructs = new Set(["Config"]);
    const structFields = new Map([["Config", new Map([["items", "Item"]])]]);
    const typeRegistry = new Map([
      ["config", createTypeInfo({ baseType: "Config" })],
    ]);

    const deps = createMockDeps({ knownStructs, structFields, typeRegistry });
    const classifier = new AssignmentClassifier(deps);

    const ctx = createMockContext({
      identifiers: ["config", "items"],
      subscripts: [{} as IAssignmentContext["subscripts"][0]],
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classifier.classify(ctx)).toBe(AssignmentKind.MEMBER_CHAIN);
  });
});
