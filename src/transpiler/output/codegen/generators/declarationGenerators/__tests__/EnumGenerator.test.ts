import { describe, it, expect } from "vitest";
import generateEnum from "../EnumGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import * as Parser from "../../../../../logic/parser/grammar/CNextParser";
import TestGeneratorState from "../../__tests__/testGeneratorState";
import IScopeSymbol from "../../../../../types/symbols/IScopeSymbol";
import TestScopeUtils from "../../../../../logic/symbols/cnext/__tests__/testUtils";

// ========================================================================
// Test Helpers
// ========================================================================

/**
 * Create a minimal mock enum declaration context.
 * EnumGenerator only uses node.IDENTIFIER().getText()
 */
function createMockEnumContext(name: string): Parser.EnumDeclarationContext {
  return {
    IDENTIFIER: () => ({
      getText: () => name,
    }),
  } as unknown as Parser.EnumDeclarationContext;
}

/**
 * Create minimal mock input with enum members.
 */
function createMockInput(
  enumName: string,
  members: Map<string, number>,
): IGeneratorInput {
  return {
    symbols: {
      enumMembers: new Map([[enumName, members]]),
      // Other required fields (not used by EnumGenerator)
      knownScopes: new Set(),
      knownStructs: new Set(),
      knownRegisters: new Set(),
      knownEnums: new Set([enumName]),
      knownBitmaps: new Set(),
      scopeMembers: new Map(),
      scopeMemberVisibility: new Map(),
      structFields: new Map(),
      structFieldArrays: new Map(),
      structFieldDimensions: new Map(),
      bitmapFields: new Map(),
      bitmapBackingType: new Map(),
      bitmapBitWidth: new Map(),
      scopedRegisters: new Map(),
      registerMemberAccess: new Map(),
      registerMemberTypes: new Map(),
      scopePrivateConstValues: new Map(),
    },
    symbolTable: null,
    typeRegistry: new Map(),
    functionSignatures: new Map(),
    knownFunctions: new Set(),
    knownStructs: new Set(),
    constValues: new Map(),
    callbackTypes: new Map(),
    callbackFieldTypes: new Map(),
    targetCapabilities: { hasAtomicSupport: false },
    debugMode: false,
  } as unknown as IGeneratorInput;
}

/**
 * Create minimal mock state.
 */
function createMockState(
  currentScope: IScopeSymbol | null = null,
): IGeneratorState {
  return TestGeneratorState.create({ currentScope });
}

/**
 * Create minimal mock orchestrator.
 * EnumGenerator doesn't use any orchestrator methods.
 */
function createMockOrchestrator(): IOrchestrator {
  return {} as IOrchestrator;
}

// ========================================================================
// Tests
// ========================================================================

describe("EnumGenerator", () => {
  describe("basic enum generation", () => {
    it("generates typedef enum with sequential values", () => {
      const members = new Map([
        ["IDLE", 0],
        ["RUNNING", 1],
        ["ERROR", 2],
      ]);
      const ctx = createMockEnumContext("State");
      const input = createMockInput("State", members);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateEnum(ctx, input, state, orchestrator);

      expect(result.code).toBe(
        `typedef enum {
    State__IDLE = 0,
    State__RUNNING = 1,
    State__ERROR = 2
} State;
`,
      );
      expect(result.effects).toEqual([]);
    });

    it("generates typedef enum with explicit values", () => {
      const members = new Map([
        ["OK", 0],
        ["WARNING", 100],
        ["CRITICAL", 255],
      ]);
      const ctx = createMockEnumContext("Severity");
      const input = createMockInput("Severity", members);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateEnum(ctx, input, state, orchestrator);

      expect(result.code).toBe(
        `typedef enum {
    Severity__OK = 0,
    Severity__WARNING = 100,
    Severity__CRITICAL = 255
} Severity;
`,
      );
    });

    it("generates single-member enum", () => {
      const members = new Map([["ONLY", 42]]);
      const ctx = createMockEnumContext("Single");
      const input = createMockInput("Single", members);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateEnum(ctx, input, state, orchestrator);

      expect(result.code).toBe(
        `typedef enum {
    Single__ONLY = 42
} Single;
`,
      );
    });
  });

  describe("scoped enum generation (ADR-016)", () => {
    it("applies scope prefix when inside a scope", () => {
      const members = new Map([
        ["LOW", 0],
        ["HIGH", 1],
      ]);
      // Note: The enum name in symbols already includes scope prefix
      const ctx = createMockEnumContext("Level");
      const input = createMockInput("Motor__Level", members);
      const state = createMockState(TestScopeUtils.createMockScope("Motor"));
      const orchestrator = createMockOrchestrator();

      const result = generateEnum(ctx, input, state, orchestrator);

      expect(result.code).toBe(
        `typedef enum {
    Motor__Level__LOW = 0,
    Motor__Level__HIGH = 1
} Motor__Level;
`,
      );
    });
  });

  describe("error handling", () => {
    it("throws error when enum not found in registry", () => {
      const ctx = createMockEnumContext("Unknown");
      const input = createMockInput("DifferentEnum", new Map());
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      expect(() => generateEnum(ctx, input, state, orchestrator)).toThrow(
        "Error: Enum Unknown not found in registry",
      );
    });
  });

  describe("effects", () => {
    it("returns empty effects array", () => {
      const members = new Map([["A", 0]]);
      const ctx = createMockEnumContext("Test");
      const input = createMockInput("Test", members);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateEnum(ctx, input, state, orchestrator);

      expect(result.effects).toEqual([]);
    });
  });
});
