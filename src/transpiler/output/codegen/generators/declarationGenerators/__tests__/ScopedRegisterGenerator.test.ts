import { describe, it, expect } from "vitest";
import generateScopedRegister from "../ScopedRegisterGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import * as Parser from "../../../../../logic/parser/grammar/CNextParser";
import TestGeneratorState from "../../__tests__/testGeneratorState";

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
  return TestGeneratorState.create();
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
        "/* Register: Teensy4__GPIO7 @ 0x42004000 */",
      );
      expect(result.code).toContain("#define Teensy4__GPIO7__DR");
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

      expect(result.code).toContain("#define Driver__TIMER__CTRL");
      expect(result.code).toContain("#define Driver__TIMER__COUNT");
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
        "#define HAL__STATUS__FLAGS (*(volatile uint8_t const *)(0x50000000 + 0x00))",
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
        "#define HAL__CMD__SET (*(volatile uint16_t*)(0x50000000 + 0x00))",
      );
    });
  });

  describe("scoped bitmap type resolution", () => {
    it("emits the name the ladder resolved, without re-deriving it", () => {
      // ADR-057 qualification belongs to `orchestrator.generateType`, which is
      // the single resolution point. This generator is transparent to it: a
      // bare `GPIO7Pins` inside `scope Teensy4` arrives ALREADY qualified.
      const ctx = createMockRegisterContext("GPIO7", "0x42004000", [
        {
          name: "PINS",
          type: "GPIO7Pins",
          cType: "GPIO7Pins",
          access: "rw",
          offset: "0x00",
        },
      ]);
      const knownBitmaps = new Set(["Teensy4__GPIO7Pins"]);
      const input = createMockInput(knownBitmaps);
      const state = createMockState();
      // The ladder qualified it -- that is what production hands over.
      const orchestrator = createMockOrchestrator(
        new Map([["GPIO7Pins", "Teensy4__GPIO7Pins"]]),
      );

      const result = generateScopedRegister(
        ctx,
        "Teensy4",
        input,
        state,
        orchestrator,
      );

      expect(result.code).toContain("volatile Teensy4__GPIO7Pins*");
    });

    it("does not re-qualify a resolved name, so an explicit global. survives", () => {
      // The regression guard for #1472. `global.GPIO7Pins` opts out of scope
      // resolution, so the ladder hands over the BARE name -- while a
      // same-named scoped bitmap also exists. The generator used to re-qualify
      // that resolved name and probe the scoped key first, binding
      // `Teensy4__GPIO7Pins` and typing the register with a bitmap whose bit
      // names differ. By this point the two forms are byte-identical, which is
      // exactly why nothing below the ladder may qualify.
      const ctx = createMockRegisterContext("GPIO7", "0x42004000", [
        {
          name: "PINS",
          type: "GPIO7Pins",
          cType: "GPIO7Pins",
          access: "rw",
          offset: "0x00",
        },
      ]);
      const knownBitmaps = new Set(["Teensy4__GPIO7Pins"]);
      const input = createMockInput(knownBitmaps);
      const state = createMockState();
      // The `global.` branch returns the bare identifier.
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

      expect(result.code).toContain("volatile GPIO7Pins*");
      expect(result.code).not.toContain("Teensy4__GPIO7Pins");
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
        `/* Register: Board__GPIO @ 0x401B8000 */
#define Board__GPIO__DR (*(volatile uint32_t*)(0x401B8000 + 0x00))
#define Board__GPIO__GDIR (*(volatile uint32_t*)(0x401B8000 + 0x04))
#define Board__GPIO__PSR (*(volatile uint32_t const *)(0x401B8000 + 0x08))
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
