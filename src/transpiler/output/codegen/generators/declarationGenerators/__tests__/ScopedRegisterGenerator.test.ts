import { describe, it, expect } from "vitest";
import generateScopedRegister from "../ScopedRegisterGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import * as Parser from "../../../../../logic/parser/grammar/CNextParser";

// ========================================================================
// Test Helpers
// ========================================================================

/**
 * Register member definition for test setup.
 */
interface IRegisterMemberDef {
  name: string;
  type: string;
  cType: string;
  access: "ro" | "wo" | "rw";
  offset: string;
}

/**
 * Create a minimal mock register member context.
 */
function createMockRegisterMember(def: IRegisterMemberDef) {
  return {
    IDENTIFIER: () => ({ getText: () => def.name }),
    type: () => ({ getText: () => def.type }),
    accessModifier: () => ({ getText: () => def.access }),
    expression: () => ({ __mockOffset: def.offset }),
  };
}

/**
 * Create a minimal mock register declaration context.
 */
function createMockRegisterContext(
  name: string,
  baseAddress: string,
  members: IRegisterMemberDef[],
): Parser.RegisterDeclarationContext {
  return {
    IDENTIFIER: () => ({ getText: () => name }),
    expression: () => ({ __mockBaseAddress: baseAddress }),
    registerMember: () => members.map(createMockRegisterMember),
  } as unknown as Parser.RegisterDeclarationContext;
}

/**
 * Create minimal mock input with optional scoped bitmaps.
 */
function createMockInput(
  knownBitmaps: Set<string> = new Set(),
): IGeneratorInput {
  return {
    symbols: {
      knownBitmaps,
      // Other fields not used
      knownScopes: new Set(),
      knownStructs: new Set(),
      knownRegisters: new Set(),
      knownEnums: new Set(),
      scopeMembers: new Map(),
      scopeMemberVisibility: new Map(),
      structFields: new Map(),
      structFieldArrays: new Map(),
      structFieldDimensions: new Map(),
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
  return {} as IGeneratorState;
}

/**
 * Create mock orchestrator with generateExpression and generateType.
 */
function createMockOrchestrator(typeMap: Map<string, string>): IOrchestrator {
  return {
    generateExpression: (ctx: {
      __mockBaseAddress?: string;
      __mockOffset?: string;
    }) => {
      return ctx.__mockBaseAddress ?? ctx.__mockOffset ?? "0";
    },
    generateType: (ctx: { getText: () => string }) => {
      const cnextType = ctx.getText();
      return typeMap.get(cnextType) ?? cnextType;
    },
  } as unknown as IOrchestrator;
}

// ========================================================================
// Tests
// ========================================================================

describe("ScopedRegisterGenerator", () => {
  // Standard type mappings
  const standardTypes = new Map([
    ["u8", "uint8_t"],
    ["u16", "uint16_t"],
    ["u32", "uint32_t"],
    ["u64", "uint64_t"],
  ]);

  describe("scope prefix application", () => {
    it("applies scope prefix to register name", () => {
      const ctx = createMockRegisterContext("GPIO7", "0x42004000", [
        {
          name: "DR",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x00",
        },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateScopedRegister(
        ctx,
        "Teensy4",
        input,
        state,
        orchestrator,
      );

      expect(result.code).toContain(
        "/* Register: Teensy4_GPIO7 @ 0x42004000 */",
      );
      expect(result.code).toContain("#define Teensy4_GPIO7_DR");
    });

    it("applies scope prefix to all members", () => {
      const ctx = createMockRegisterContext("TIMER", "0x40000000", [
        {
          name: "CTRL",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x00",
        },
        {
          name: "COUNT",
          type: "u32",
          cType: "uint32_t",
          access: "ro",
          offset: "0x04",
        },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateScopedRegister(
        ctx,
        "Driver",
        input,
        state,
        orchestrator,
      );

      expect(result.code).toContain("#define Driver_TIMER_CTRL");
      expect(result.code).toContain("#define Driver_TIMER_COUNT");
    });
  });

  describe("access modifiers with scope prefix", () => {
    it("generates read-only member with const qualifier", () => {
      const ctx = createMockRegisterContext("STATUS", "0x50000000", [
        {
          name: "FLAGS",
          type: "u8",
          cType: "uint8_t",
          access: "ro",
          offset: "0x00",
        },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateScopedRegister(
        ctx,
        "HAL",
        input,
        state,
        orchestrator,
      );

      expect(result.code).toContain(
        "#define HAL_STATUS_FLAGS (*(volatile uint8_t const *)(0x50000000 + 0x00))",
      );
    });

    it("generates write-only member without const qualifier", () => {
      const ctx = createMockRegisterContext("CMD", "0x50000000", [
        {
          name: "SET",
          type: "u16",
          cType: "uint16_t",
          access: "wo",
          offset: "0x00",
        },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateScopedRegister(
        ctx,
        "HAL",
        input,
        state,
        orchestrator,
      );

      expect(result.code).toContain(
        "#define HAL_CMD_SET (*(volatile uint16_t*)(0x50000000 + 0x00))",
      );
    });
  });

  describe("scoped bitmap type resolution", () => {
    it("resolves bitmap type to scoped name when bitmap exists in scope", () => {
      // Register member uses "GPIO7Pins" type, which should resolve to "Teensy4_GPIO7Pins"
      const ctx = createMockRegisterContext("GPIO7", "0x42004000", [
        {
          name: "PINS",
          type: "GPIO7Pins",
          cType: "GPIO7Pins",
          access: "rw",
          offset: "0x00",
        },
      ]);
      // The scoped bitmap exists
      const knownBitmaps = new Set(["Teensy4_GPIO7Pins"]);
      const input = createMockInput(knownBitmaps);
      const state = createMockState();
      // Type map returns the type unchanged - generator handles scoping
      const orchestrator = createMockOrchestrator(
        new Map([["GPIO7Pins", "GPIO7Pins"]]),
      );

      const result = generateScopedRegister(
        ctx,
        "Teensy4",
        input,
        state,
        orchestrator,
      );

      expect(result.code).toContain("volatile Teensy4_GPIO7Pins*");
    });

    it("keeps original type when scoped bitmap does not exist", () => {
      const ctx = createMockRegisterContext("GPIO7", "0x42004000", [
        {
          name: "DATA",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x00",
        },
      ]);
      const input = createMockInput(); // No scoped bitmaps
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateScopedRegister(
        ctx,
        "Teensy4",
        input,
        state,
        orchestrator,
      );

      expect(result.code).toContain("volatile uint32_t*");
      expect(result.code).not.toContain("Teensy4_u32");
    });
  });

  describe("complete output format", () => {
    it("generates complete scoped register with multiple members", () => {
      const ctx = createMockRegisterContext("GPIO", "0x401B8000", [
        {
          name: "DR",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x00",
        },
        {
          name: "GDIR",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x04",
        },
        {
          name: "PSR",
          type: "u32",
          cType: "uint32_t",
          access: "ro",
          offset: "0x08",
        },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateScopedRegister(
        ctx,
        "Board",
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe(
        `/* Register: Board_GPIO @ 0x401B8000 */
#define Board_GPIO_DR (*(volatile uint32_t*)(0x401B8000 + 0x00))
#define Board_GPIO_GDIR (*(volatile uint32_t*)(0x401B8000 + 0x04))
#define Board_GPIO_PSR (*(volatile uint32_t const *)(0x401B8000 + 0x08))
`,
      );
    });
  });

  describe("effects", () => {
    it("returns empty effects array", () => {
      const ctx = createMockRegisterContext("TEST", "0x40000000", [
        {
          name: "DATA",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x00",
        },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateScopedRegister(
        ctx,
        "Scope",
        input,
        state,
        orchestrator,
      );

      expect(result.effects).toEqual([]);
    });
  });
});
