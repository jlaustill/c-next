import { describe, it, expect } from "vitest";
import generateBitmap from "../BitmapGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import * as Parser from "../../../../../logic/parser/grammar/CNextParser";

// ========================================================================
// Test Helpers
// ========================================================================

/**
 * Create a minimal mock bitmap declaration context.
 * BitmapGenerator only uses node.IDENTIFIER().getText()
 */
function createMockBitmapContext(
  name: string,
): Parser.BitmapDeclarationContext {
  return {
    IDENTIFIER: () => ({
      getText: () => name,
    }),
  } as unknown as Parser.BitmapDeclarationContext;
}

/**
 * Bitmap field info structure.
 */
interface IBitmapFieldInfo {
  offset: number;
  width: number;
}

/**
 * Create minimal mock input with bitmap info.
 */
function createMockInput(
  bitmapName: string,
  backingType: string,
  fields?: Map<string, IBitmapFieldInfo>,
): IGeneratorInput {
  return {
    symbols: {
      bitmapBackingType: new Map([[bitmapName, backingType]]),
      bitmapFields: fields ? new Map([[bitmapName, fields]]) : new Map(),
      bitmapBitWidth: new Map(),
      // Other required fields (not used by BitmapGenerator)
      knownScopes: new Set(),
      knownStructs: new Set(),
      knownRegisters: new Set(),
      knownEnums: new Set(),
      knownBitmaps: new Set([bitmapName]),
      scopeMembers: new Map(),
      scopeMemberVisibility: new Map(),
      structFields: new Map(),
      structFieldArrays: new Map(),
      structFieldDimensions: new Map(),
      enumMembers: new Map(),
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
function createMockState(currentScope: string | null = null): IGeneratorState {
  return {
    currentScope,
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
 * Create minimal mock orchestrator.
 * BitmapGenerator doesn't use any orchestrator methods.
 */
function createMockOrchestrator(): IOrchestrator {
  return {} as IOrchestrator;
}

// ========================================================================
// Tests
// ========================================================================

describe("BitmapGenerator", () => {
  describe("basic bitmap generation", () => {
    it("generates typedef for bitmap8", () => {
      const ctx = createMockBitmapContext("Flags");
      const input = createMockInput("Flags", "uint8_t");
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap(ctx, input, state, orchestrator);

      expect(result.code).toContain("/* Bitmap: Flags */");
      expect(result.code).toContain("typedef uint8_t Flags;");
    });

    it("generates typedef for bitmap16", () => {
      const ctx = createMockBitmapContext("StatusWord");
      const input = createMockInput("StatusWord", "uint16_t");
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap(ctx, input, state, orchestrator);

      expect(result.code).toContain("typedef uint16_t StatusWord;");
    });

    it("generates typedef for bitmap32", () => {
      const ctx = createMockBitmapContext("Config");
      const input = createMockInput("Config", "uint32_t");
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap(ctx, input, state, orchestrator);

      expect(result.code).toContain("typedef uint32_t Config;");
    });
  });

  describe("field documentation", () => {
    it("generates field comments for single-bit fields", () => {
      const fields = new Map<string, IBitmapFieldInfo>([
        ["Running", { offset: 0, width: 1 }],
        ["Direction", { offset: 1, width: 1 }],
      ]);
      const ctx = createMockBitmapContext("MotorFlags");
      const input = createMockInput("MotorFlags", "uint8_t", fields);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap(ctx, input, state, orchestrator);

      expect(result.code).toContain("/* Fields:");
      expect(result.code).toContain(" *   Running: bit 0 (1 bit)");
      expect(result.code).toContain(" *   Direction: bit 1 (1 bit)");
      expect(result.code).toContain(" */");
    });

    it("generates field comments for multi-bit fields", () => {
      const fields = new Map<string, IBitmapFieldInfo>([
        ["Mode", { offset: 0, width: 3 }],
        ["Reserved", { offset: 3, width: 5 }],
      ]);
      const ctx = createMockBitmapContext("Control");
      const input = createMockInput("Control", "uint8_t", fields);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap(ctx, input, state, orchestrator);

      expect(result.code).toContain(" *   Mode: bits 0-2 (3 bits)");
      expect(result.code).toContain(" *   Reserved: bits 3-7 (5 bits)");
    });

    it("generates bitmap without field comments when no fields defined", () => {
      const ctx = createMockBitmapContext("Empty");
      const input = createMockInput("Empty", "uint8_t");
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap(ctx, input, state, orchestrator);

      expect(result.code).not.toContain("/* Fields:");
      expect(result.code).toContain("/* Bitmap: Empty */");
      expect(result.code).toContain("typedef uint8_t Empty;");
    });
  });

  describe("scoped bitmap generation (ADR-016)", () => {
    it("applies scope prefix when inside a scope", () => {
      const fields = new Map<string, IBitmapFieldInfo>([
        ["Active", { offset: 0, width: 1 }],
      ]);
      const ctx = createMockBitmapContext("Status");
      // Note: The bitmap name in symbols already includes scope prefix
      const input = createMockInput("Driver_Status", "uint8_t", fields);
      const state = createMockState("Driver");
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap(ctx, input, state, orchestrator);

      expect(result.code).toContain("/* Bitmap: Driver_Status */");
      expect(result.code).toContain("typedef uint8_t Driver_Status;");
    });
  });

  describe("effects", () => {
    it("includes stdint header effect", () => {
      const ctx = createMockBitmapContext("Test");
      const input = createMockInput("Test", "uint8_t");
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap(ctx, input, state, orchestrator);

      expect(result.effects).toContainEqual({
        type: "include",
        header: "stdint",
      });
    });
  });

  describe("error handling", () => {
    it("throws error when bitmap not found in registry", () => {
      const ctx = createMockBitmapContext("Unknown");
      const input = createMockInput("DifferentBitmap", "uint8_t");
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      expect(() => generateBitmap(ctx, input, state, orchestrator)).toThrow(
        "Error: Bitmap Unknown not found in registry",
      );
    });
  });

  describe("complete output format", () => {
    it("generates complete bitmap with all sections", () => {
      const fields = new Map<string, IBitmapFieldInfo>([
        ["Enabled", { offset: 0, width: 1 }],
        ["Priority", { offset: 1, width: 3 }],
        ["Channel", { offset: 4, width: 4 }],
      ]);
      const ctx = createMockBitmapContext("TaskConfig");
      const input = createMockInput("TaskConfig", "uint8_t", fields);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap(ctx, input, state, orchestrator);

      expect(result.code).toBe(
        `/* Bitmap: TaskConfig */
/* Fields:
 *   Enabled: bit 0 (1 bit)
 *   Priority: bits 1-3 (3 bits)
 *   Channel: bits 4-7 (4 bits)
 */
typedef uint8_t TaskConfig;
`,
      );
    });
  });
});
